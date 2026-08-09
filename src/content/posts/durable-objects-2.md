---
title: Durable Objects でリアルタイムな状態共有を実現する
description: 名前で決まるインスタンス、ロックのいらない直列化、Alarm と WebSocket Hibernation、RPC 境界で壊れるもの。リアルタイム投票アプリを一本作りながら、Durable Objects の要素を順に通す。
pubDate: 2026-08-10
tags: [Cloudflare, Durable Objects]
draft: false
---

前回、Durable Object とはなにかをまとめました。ここでは実際に 1 つアプリを作り、Durable Objects の要素を順に通していきます。

https://ashunar0.dev/posts/durable-objects/

題材はリアルタイム投票アプリです。お題を作り、複数人が同時に投票し、票が全員の画面に即座に反映され、締切時刻になると自動で締まる、というものです。

今回使用したコードは GitHub に置いてあります。

https://github.com/ashunar0/poll-do

デプロイしたものはこちらです。複数タブで開くと票が同期します。`?id=dinner` を付けると別の Durable Object になります。

https://poll-do.asahi-gaia1530.workers.dev

なお SQLite ストレージの Durable Objects は Workers の無料プランで使えます（キーバリューのほうは有料プランが必要です）。

## 全体の構成

```
src/
├── index.ts                 Worker のエントリ（Hono）
├── poll.ts                  Durable Object 本体
├── schema.ts                状態とコマンドの定義（zod）
├── lib/synced/              輸送だけを担う土台
│   ├── protocol.ts
│   ├── server.ts
│   └── react.ts
└── client/                  React
```

`lib/synced/` は投票のことを何も知らない層です。この分け方の理由は最後の章に書きます。

## 1. 名前でインスタンスが決まる

Durable Object は、名前を指定すると常に同じインスタンスに繋がります。

```typescript
const poll = c.env.POLL.getByName("lunch");
await poll.vote(2);
```

`getByName("lunch")` は、世界のどこから何回呼んでも同じ 1 つのインスタンスに届きます。`"dinner"` を渡せば別のインスタンスです。両者は別々のストレージを持ち、互いの存在を知りません。

### `env.POLL` はどこから来るのか

`POLL` は wrangler の設定ファイルにあります。

```jsonc
// wrangler.jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "POLL", "class_name": "Poll" }],
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Poll"] }],
}
```

`class_name` がコード上のクラス名、`name` が呼び出すときの名札です。この対応付けを binding と呼びます。設定ファイルに書いた binding は実行時にまとめて `env` に詰められ、ハンドラの第 2 引数として渡ってきます。KV も D1 も R2 も同じ仕組みです。

型は手で書かず `wrangler types` で生成します。

```typescript
// worker-configuration.d.ts（生成物）
POLL: DurableObjectNamespace<import("./src/index").Poll>;
```

このジェネリクスがあるおかげで、`poll.vote(2)` の引数も戻り値も型が効きます。存在しないメソッドを呼べばコンパイルが落ちます。

### 設定ファイルは「登録」であって「生成」ではない

wrangler.jsonc がやっているのはクラスの登録です。インスタンスが生まれるのは `getByName()` を最初に呼んだ瞬間です。

```
POLL（Namespace）
├─ "lunch"  → インスタンス + 専属ストレージ
├─ "dinner" → インスタンス + 専属ストレージ
└─ "race"   → インスタンス + 専属ストレージ
```

クラスが設計図、binding がその置き場、`getByName()` が個々の実体、という関係です。

### Durable Object クラスは re-export する

見落としやすい点として、Durable Object のクラスは Worker のエントリから export されている必要があります。

```typescript
// src/index.ts
export { Poll } from "./poll";
```

これがないと wrangler がクラスを見つけられません。

## 2. 直列化

Durable Object の中では、排他制御を自分で書きません。

```typescript
async vote(optionId: number): Promise<VoteResult> {
  if (this.readState().closed) {
    return { ok: false, reason: "closed" };
  }

  const cursor = this.ctx.storage.sql.exec(
    "UPDATE options SET votes = votes + 1 WHERE id = ?",
    optionId,
  );
  if (cursor.rowsWritten === 0) {
    return { ok: false, reason: "option_not_found" };
  }

  this.broadcast();
  return { ok: true, state: this.readState() };
}
```

読んで、判断して、書く。通常のサーバーであれば典型的な競合状態ですが、Durable Object ではそのインスタンスへのリクエストが直列に処理されるため安全です。

実際に 100 リクエストを同時に投げて確認しました。

```bash
seq 1 100 | xargs -P 50 -I{} curl -s -X POST .../vote -d '{"optionId":1}'
# → votes: 100
```

ロックを 1 行も書かずに、1 票も欠けません。エッジで強い一貫性が得られる、というのはこの性質を指しています。

### 例外：外部 I/O を挟むと割り込む

ストレージ操作の間は自動でガードされます（input / output gates）が、外部への `fetch()` は対象外です。

```typescript
const item = await this.ctx.storage.get("item");
await fetch("https://api.example.com/..."); // ここで他のリクエストが入り込める
await this.ctx.storage.put("item", updated); // 上書き事故
```

外部 API を叩く処理を書くときだけ、この点を意識する必要があります。

## 3. 専属ストレージ

各インスタンスは自分だけの SQLite を持ちます。スキーマ作成は constructor で一度だけ行います。

```typescript
constructor(ctx: DurableObjectState, env: Env) {
  super(ctx, env);

  ctx.blockConcurrencyWhile(async () => {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS options (
        id    INTEGER PRIMARY KEY,
        label TEXT    NOT NULL,
        votes INTEGER NOT NULL DEFAULT 0
      );
      ...
    `);
  });
}
```

`blockConcurrencyWhile()` はその間の全リクエストを待たせます。使ってよいのは constructor での初期化だけです。毎リクエストで呼ぶと、そのままスループットの上限になります。

SQL API は同期です。`await` を挟まない連続した書き込みは 1 つのトランザクションにまとまります。

```typescript
this.ctx.storage.sql.exec(
  "UPDATE accounts SET balance = balance - ? WHERE id = ?",
  amount,
  from,
);
this.ctx.storage.sql.exec(
  "UPDATE accounts SET balance = balance + ? WHERE id = ?",
  amount,
  to,
);
// この 2 つは原子的にコミットされる
```

逆に、間に `await` を入れると別々のトランザクションになります。

### メモリとストレージの使い分け

使われていないインスタンスはメモリから追い出されます（eviction）。次のアクセスで復活します。

- クラスのプロパティ → 消える
- `ctx.storage` に書いたもの → 残る

鉄則は「まずストレージに永続化し、次にメモリにキャッシュする」です。開発中に何度もサーバーを再起動しましたが、投票データはそのまま残り続けました。

## 4. Alarm

Durable Object は「n ミリ秒後に自分を起こす」予約ができます。

```typescript
async schedule(closesInMs: number): Promise<PollState> {
  const closesAt = Date.now() + closesInMs;
  this.ctx.storage.sql.exec(
    "UPDATE meta SET closes_at = ?, closed = 0 WHERE id = 1",
    closesAt,
  );
  await this.ctx.storage.setAlarm(closesAt);

  this.broadcast();
  return this.readState();
}

override async alarm(): Promise<void> {
  this.ctx.storage.sql.exec("UPDATE meta SET closed = 1 WHERE id = 1");
  this.broadcast();
}
```

実行するとこうなります。

```
t=0.2s  schedule(2000) → closesAt がセットされる
t=0.4s  投票 → 通る
t=2.2s  Alarm 発火 → closed=true が接続中の全員にプッシュされる
t=3.4s  投票 → HTTP 409 / WebSocket は error を返す
```

`t=2.2s` の行が肝です。誰もリクエストしていないのに、Durable Object が自分で起きて、状態を変えて、繋がっている全員に通知しています。

### cron との違い

```
cron：  1 分ごとに起動 → 全お題をスキャン → 期限切れを探す
Alarm： お題ごとに自分の締切を持つ → 時間が来たものだけが起きる
```

エンティティごとにタイマーを持てるのが本質です。お題が 10 万個あってもスキャンは発生しません。

注意点は 3 つです。

- 1 つの Durable Object につき Alarm は 1 つだけ。`setAlarm()` は既存の予約を上書きする
- 失敗すると自動でリトライされる。ハンドラは冪等に書く
- Hibernation 中でも発火する。復活してから呼ばれる

複数の締切が必要なら「次の 1 つ」だけをセットし、発火時に次を再セットします。

## 5. WebSocket

投票が入った瞬間に全員へ配ります。

```typescript
const [client, server] = Object.values(new WebSocketPair());
this.ctx.acceptWebSocket(server);
server.send(this.stateMessage());
return new Response(null, { status: 101, webSocket: client });
```

`acceptWebSocket()` で渡すのが重要です。これで Hibernation の対象になり、アイドル中は Durable Object がメモリから落ちても接続は維持されます。メッセージが届いたら復活して `webSocketMessage()` が呼ばれます。自前で `addEventListener` すると常駐してしまい、接続数に比例して課金されます。

### Hibernation を実際に観測する

これは外から見えないので、constructor に一時的なログを仕込んで確認しました。インスタンスが作り直されれば constructor が再び走るはずです。

デプロイした環境に WebSocket で接続し、1 回投票してから 120 秒放置し、もう一度投票しました。サーバー側のログはこうなりました。

```
14:14:17  constructed
14:14:18  webSocketMessage handled
          ── 120 秒アイドル ──
14:16:18  constructed              ← 作り直されている
14:16:18  webSocketMessage handled
```

同じ時間帯のクライアント側です。

```
14:14:15  接続した
14:16:16  readyState = 1（接続維持）  ← close イベントは一度も来ていない
14:16:16  投票 → 正常に反映された
```

接続は生きたまま、Durable Object だけがメモリから消えて作り直されていました。クライアントからは何も起きていないように見えます。

ここで効いてくるのが「メモリ上の値は消える」という制約です。もし票数をクラスのプロパティに持っていたら、この 2 分間で消えていました。ストレージに書いているので、作り直された後もそのまま続きが読めます。

配信は接続の一覧を取って回すだけです。

```typescript
protected broadcast(): void {
  const payload = this.stateMessage();
  for (const ws of this.ctx.getWebSockets()) {
    ws.send(payload);
  }
}
```

### ここが Durable Objects の勘所

通常のサーバーで同じことをすると、こうなります。

```
ブラウザA ── サーバー1 ──┐
                          ├→ DB
ブラウザB ── サーバー2 ──┘

サーバー1 は「ブラウザBが繋がっている」ことを知らない
→ Redis Pub/Sub などで別途つなぐ必要がある
```

Durable Objects では、接続を持っている場所とデータを持っている場所が同じです。

```
ブラウザA ──┐
            ├→ Poll("lunch")
ブラウザB ──┘
```

`getWebSockets()` で「今このお題を見ている全員」がその場で取れます。Pub/Sub のインフラが要りません。

### upgrade だけは RPC ではなく fetch

Durable Object の呼び出しは基本的に RPC ですが、WebSocket の upgrade だけは 101 レスポンスを返す必要があるため `fetch()` を使います。

```typescript
.get("/api/polls/:id/ws", (c) => {
  const poll = c.env.POLL.getByName(c.req.param("id"));
  return poll.fetch(c.req.raw);
});
```

## 6. 踏んだ罠

ここからが実際に作らないと気づけなかった部分です。

### RPC 境界を例外は越えられない

最初、投票の失敗をカスタム例外で表現しました。

```typescript
export class InvalidVoteError extends Error {}

// DO 側
throw new InvalidVoteError(`option ${optionId} does not exist`);

// Worker 側
catch (e) {
  if (e instanceof InvalidVoteError) return c.json({ error: e.message }, 400);
  throw e;
}
```

これは動きません。500 が返ります。

```
Uncaught Error: option 999 does not exist
```

`InvalidVoteError` がただの `Error` になっています。Durable Object の RPC はプロセス境界を越えるため、例外はシリアライズされて向こう側で作り直されます。`message` は残りますが、クラスの identity は失われ、`instanceof` が効きません。

Durable Objects に限らず RPC 一般の性質です。例外で制御フローを渡す設計が、境界を越えられません。

想定内の失敗は、例外ではなく戻り値で表現します。

```typescript
export type VoteResult =
  | { ok: true; state: PollState }
  | { ok: false; reason: "option_not_found" | "closed" };
```

プレーンなオブジェクトなら境界を無事に越えます。想定外のバグは例外のままで構いません。500 になるべきだからです。この線引きが RPC 設計の勘所です。

### 検証を入口ごとに書くと片方が緩くなる

投票の経路は 2 つあります。HTTP と WebSocket です。最初はこうなっていました。

```typescript
// HTTP 側 — zod で守られている
.post("/api/polls/:id/vote", zValidator("json", voteSchema), ...)

// WebSocket 側 — 手書きの if
if (msg.type === "vote" && typeof msg.optionId === "number") {
  await this.vote(msg.optionId);
}
```

HTTP 側は「正の整数」まで縛っているのに、WebSocket 側は `-1` でも通ります。入口が 2 つあるのに、守りが片方にしかない状態です。

直し方は 2 段構えにしました。

- **形の検証**は入口で。スキーマを 1 箇所に置き、両方の入口から使う
- **意味の検証**は Durable Object の中で。「実在する選択肢か」「締切済みか」はここでしか判断できない

```
入口①HTTP  ─ zValidator(voteSchema) ─┐
                                      ├→ Poll.vote() ← 実在チェックはここ
入口②WS    ─ pollCommandSchema ──────┘
```

こうすると、入口がいくつ増えても不正な票は入りません。

## 7. 輸送と意味を分ける

Durable Object を使うコードには、性質の違う 2 種類のものが混ざります。

- **輸送** … WebSocket を張る、切れたら繋ぎ直す、受信を検証する、全員に配る
- **意味** … 投票とは何か、誰が投票できるか、いつ締まるか

分ける基準は「変わる理由が違うか」です。輸送が変わる理由は再接続や認証を足したいときで、意味が変わる理由は投票の仕様が変わったときです。理由が違うものを 1 つのファイルに置くと、片方を触るたびにもう片方を読むことになります。

### 抽出の判断基準

共通化できそう、で切ると失敗します。こう問うのが確実です。

> 2 つ目のユースケースを持ってきたとき、この部分は書き換わるか？

書き換わらないなら抽出する価値があります。書き換わるなら、2 つ目が来るまで待ちます。輸送の部分は別のアプリでも一文字も変わりません。逆に「コマンドを受けて何をするか」は全部書き換わるので、そこを抽象化してはいけません。

### サーバー側

輸送は抽象クラスに置きます。ここは投票のことを何も知りません。

```typescript
export abstract class SyncedObject<
  TState,
  TCommand,
> extends DurableObject<Env> {
  protected abstract readonly commandSchema: z.ZodType<TCommand>;
  protected abstract readState(): TState;
  protected abstract handle(command: TCommand): Promise<CommandResult>;

  override async fetch(request: Request) {
    /* upgrade + acceptWebSocket */
  }
  override async webSocketMessage(ws, message) {
    /* 検証してディスパッチ */
  }
  protected broadcast() {
    /* getWebSockets().forEach */
  }
}
```

意味の側は、その 3 つを埋めるだけです。

```typescript
export class Poll extends SyncedObject<PollState, PollCommand> {
  protected readonly commandSchema = pollCommandSchema;
  protected readState(): PollState {
    /* SQL */
  }
  protected async handle(command: PollCommand): Promise<CommandResult> {
    const result = await this.vote(command.optionId);
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  }
  // あとは setup / schedule / vote / alarm ＝ 投票の意味そのもの
}
```

`Poll` に `WebSocketPair` も `acceptWebSocket` も `getWebSockets` も出てきません。

クライアント側も同じ形です。`useSyncedObject` が接続・再接続・受信検証を持ち、`usePoll` は投票の語彙だけを持ちます。

### Agents SDK も同じ構造

この形は Cloudflare の Agents SDK とほぼ同じです。

| Agents SDK                | 今回作ったもの                                 |
| ------------------------- | ---------------------------------------------- |
| `Agent`（基底クラス）     | `SyncedObject`                                 |
| `useAgent`（フック）      | `useSyncedObject`                              |
| `onMessage`               | `handle`                                       |
| `agents` / `agents/react` | `lib/synced/server.ts` / `lib/synced/react.ts` |

`useAgent` が薄く見えるのは、輸送を全部飲み込んだ結果です。内側を一度自分で書くと、あれがブラックボックスでなくなります。

## おわりに

Durable Objects で書くコードの分量自体は多くありません。難しいのは、どこに何を置くかの判断です。

今回の題材を通して繰り返し出てきたのは、次の 3 つでした。

- **調整の単位でインスタンスを切る**。お題ごと、ルームごと、マッチごと。1 つに集約すると全リクエストが 1 本の列に並ぶ
- **不変条件は Durable Object の中で守る**。入口は増えるが、中心は 1 つのまま
- **境界を越える値はプレーンにする**。例外も、片側だけの検証も、境界で壊れる

どれも「どこが変わりにくい場所か」を決める作業です。それさえ決まれば、実装はほぼ機械的に決まります。
