---
title: Cloudflare Durable Objects
description: Durable Objects を「グローバルに1つだけ存在する、永続ストレージ付きのクラスインスタンス」として捉え直す。binding の仕組み、直列実行の効き方、分割の単位の決め方まで。
pubDate: 2026-08-09
tags: [Cloudflare, Durable Objects]
draft: false
---

## はじめに

Durable Objects を一言でいうと、**グローバルに1つだけ存在する、永続ストレージ付きのクラスインスタンス**です。

ドキュメントを開くと、ストレージ・WebSocket・アラームと機能が並んでいて、結局これが何なのか掴みづらいところがあります。ですが軸はこの一文だけで、個々の機能はすべてここから素直に導けます。

この記事では、その一文を出発点に、何を解決するものなのか、どう呼び出すのか、どういう単位で分割するのかを順に見ていきます。

## 何を解決するものか

通常の Worker はステートレスです。リクエストごとに世界のどこかのマシンで独立に実行されるため、「同じデータを複数のリクエストが同時に触る」ということができません。

```
リクエストA ──→ Worker (東京)
リクエストB ──→ Worker (大阪)
リクエストC ──→ Worker (ロンドン)
```

D1 や KV に書けば状態そのものは共有できますが、今度は競合が起きます。在庫1個を2人が同時に買う、といった状況です。

Durable Objects は、ここに **「名前で指定できる、世界に1つしかないインスタンス」** を導入します。

```
リクエストA ┐
リクエストB ├→ 必ず同じインスタンス「room-123」（世界に1個）
リクエストC ┘   └ 専属のストレージが付属
```

## 本質は「状態を持ったオブジェクトがサーバー側に住んでいること」

Durable Object の正体は、次の3つがセットになったものです。

| 要素             | 意味                                                 |
| ---------------- | ---------------------------------------------------- |
| 一意な識別子     | `getByName("room-123")` は常に同じインスタンスに届く |
| 単一スレッド実行 | そのインスタンスへの処理は1つずつ。ロック不要        |
| 専属ストレージ   | そのインスタンスだけの SQLite が付属                 |

つまり「クラスのインスタンスが、グローバルに1つだけ、永続化された状態で存在する」という形です。名前がそのままアドレスになっています。

```typescript
export class ChatRoom extends DurableObject<Env> {
  async sendMessage(userId: string, content: string) {
    this.ctx.storage.sql.exec(
      "INSERT INTO messages (user_id, content) VALUES (?, ?)",
      userId,
      content,
    );
  }
}

// Worker 側 — ただのメソッド呼び出しに見える（RPC）
const room = env.CHAT_ROOM.getByName("room-123");
await room.sendMessage("asahi", "hello");
```

呼び出しは RPC です。HTTP を組み立てる必要がなく、型もそのまま貫通します。

## `env.CHAT_ROOM` はどこから来るのか

上のコードに出てくる `env.CHAT_ROOM` は、コード上のどこにも定義がありません。実体は wrangler の設定ファイルで宣言します。

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "CHAT_ROOM", "class_name": "ChatRoom" }],
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["ChatRoom"] }],
}
```

- `class_name` … コード上のクラス名
- `name` … そのクラスを呼び出すときの名札

この対応付けを binding と呼びます。KV や D1 や R2 も同じ仕組みで、設定ファイルに書いた binding は実行時にまとめて `env` に詰められ、ハンドラの第2引数として渡ってきます。

```typescript
export interface Env {
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
}

export default {
  async fetch(request: Request, env: Env) {
    const room = env.CHAT_ROOM.getByName("room-123");
    await room.sendMessage("asahi", "hello");
    return new Response("ok");
  },
};
```

`DurableObjectNamespace<ChatRoom>` のジェネリクスがあることで、RPC メソッドの型がそのまま効きます。この `Env` は手書きせず、`wrangler types` で設定ファイルから自動生成するのが楽です。オブジェクト側からも `this.env` で他の binding を触れるので、あるオブジェクトから別のオブジェクトを呼ぶ親子構造もここで作れます。

## 「1つずつ実行される」の効き方

Durable Object の中では、排他制御を自分で書く必要がありません。

```typescript
async buy() {
  const stock = this.ctx.storage.sql.exec("SELECT qty FROM item").one().qty;
  if (stock <= 0) throw new Error("売り切れ");
  this.ctx.storage.sql.exec("UPDATE item SET qty = qty - 1");
}
```

通常のサーバーであれば典型的な競合状態ですが、Durable Object ではそのインスタンスへのリクエストが直列化されるため安全です。エッジで強い一貫性が得られる、というのはこの性質を指しています。

ただし注意点が1つあります。**外部への `fetch()` を挟むと割り込みが起きます。**

```typescript
const item = await this.ctx.storage.get("item");
await fetch("https://api.example.com/..."); // ここで他のリクエストが入り込める
await this.ctx.storage.put("item", updated); // 上書き事故
```

ストレージ操作の間は自動でガードされます（input / output gates）が、外部 I/O は対象外です。ここだけは意識が必要です。

## 設計の勘所：「調整の単位」で切る

設計はほぼこれに尽きます。

```typescript
// 良い例：チャットルームごとに1つ → いくらでも並ぶ
env.CHAT_ROOM.getByName(roomId);

// 悪い例：全部を1つに集約 → 世界中のリクエストが1本の列に並ぶ
env.CHAT_ROOM.getByName("global");
```

Durable Object は単体では速くありませんが、**無数に並ぶことでスケールします**。「1つのオブジェクトに全部載せる」は最悪のアンチパターンです。

切り方の例：

- チャット → ルームごと
- ゲーム → マッチごと
- SaaS → テナントごと / ユーザーごと
- 予約システム → 会議室ごと・日付ごと

## 付随する機能

### Alarm

オブジェクト自身が「n ミリ秒後に自分を起こす」予約をできます。cron と違い、**エンティティごとに**持てるのが特徴です。サブスクリプションの更新、ゲームのターン制限時間、リマインダーなどに使えます。

```typescript
await this.ctx.storage.setAlarm(Date.now() + 60_000);

async alarm() {
  // 起きたときの処理。必要なら再スケジュールする
}
```

1オブジェクトにつきアラームは1つで、`setAlarm()` は既存の予約を上書きします。失敗時は自動でリトライされるため、ハンドラは冪等に書きます。

### WebSocket Hibernation

**WebSocket を繋いだまま、アイドル中はオブジェクトをメモリから落とせます**（接続は維持されます）。課金されずに常時接続を維持できるため、リアルタイム系ではこれが決め手になります。

## ライフサイクル：落ちるし、復活する

使われていないオブジェクトはメモリから追い出されます（eviction）。次のアクセスで復活します。

- クラスのプロパティ（メモリ上の値）→ **消える**
- `ctx.storage` に書いたもの → **残る**

したがって鉄則は「まずストレージに永続化し、次にメモリにキャッシュする」です。逆順、あるいはメモリだけ、は事故のもとです。

## 使わないほうがいい場面

- ただのステートレスな API → 素の Worker で十分
- 全世界に読みを配りたい → KV や Cache API
- 互いに独立したリクエストの大量並列 → 挟む意味がない

Durable Objects は「調整が必要なとき」だけの道具です。

## おわりに

Durable Objects は新しいデータベースではなく、**置き場所の設計をアプリケーション側に引き戻す**仕組みです。「どのデータが、どの単位で、誰と競合するのか」を先に決める。それさえ決まれば、実装はほぼ機械的に決まります。

逆にいえば、その単位が決められない領域には向きません。使いどころを見誤らないことが、この仕組みを使ううえで一番効きます。

## 参考

- https://developers.cloudflare.com/durable-objects/
- https://developers.cloudflare.com/durable-objects/best-practices/
