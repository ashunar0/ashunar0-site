---
title: Void でフルスタックな TODO アプリを作ってデプロイまでやってみた
description: VoidZero の Void で、TODO アプリを作って Cloudflare にデプロイしました。pnpm create void で聞かれること、できあがる雛形、void gen model で作られる API、画面からの型つきの呼び出し、void deploy で起きることを順に紹介します。
pubDate: 2026-10-20
tags: [Void, React, Cloudflare]
draft: false
---

## はじめに

[前回の記事](/posts/try-void/)では、Void を触ってみて「いいじゃん！」と思ったところを紹介しました。

今回は、いざ使い始めるときにどんなルートを通るのかを、TODO アプリを作りながら順に見ていきます。

使ったのは Void 1.1.12 です。作ったものはこちらに置いてあります。

https://github.com/ashunar0/void-handson

## プロジェクトを作る

まずは `pnpm create void` からです。

```sh
pnpm create void void-handson
```

実行すると、6 つのことを聞かれました（Void 1.1.12 時点）。

| # | 聞かれること | 選択肢 |
|---|---|---|
| 1 | Initialize a git repository? | Yes / No |
| 2 | Choose a Pages scaffold toolchain | Vite+ / Vite |
| 3 | Choose a Pages framework to scaffold | React / Vue / Svelte / Solid |
| 4 | Choose a Pages starter | D1 (SQLite) / PostgreSQL / MySQL / Static Pages |
| 5 | Where should this project deploy? | Cloudflare / Void / Skip deployment setup |
| 6 | Create .github/workflows/void-deploy.yml to deploy on pushes to main? | Yes / No |

今回は React・D1・Cloudflare を選びました。

デプロイ先に Cloudflare を選んだとき、すでに wrangler でログインしていると、ブラウザも開かずともアカウント ID が `void.lock.json` に書き込まれて、デプロイの準備が完了します。楽ちん。

ついでに、終わった時点でパッケージのインストールと、D1 の最初のマイグレーションの生成も済んでいます。

## 雛形を見てみよう

できあがった雛形はこんな感じです。

```
void-handson/
  pages/
    index.tsx            画面
    index.server.ts      画面のデータを用意する処理
  routes/
    api/hello.ts         API の例
  db/
    schema.ts            テーブル定義（Drizzle）
    seed.ts              初期データ
    migrations/          マイグレーション（作成済み）
  AGENTS.md
  vite.config.ts
  void.config.ts
  void.lock.json
```

Cloudflare に載せるアプリには、ふつう Cloudflare 向けの設定ファイルがあります。Void の内部では、最近新しく出た CLI の `cf` を使ってるっぽいので、 `cloudflare.config.ts` が本来なら必要なところですが、見当たりません。

代わりにあるのが `void.config.ts` です。Void はこれと、コードの import から読み取ったものを合わせて、`import { db } from "void/db"` があれば D1 が要る、みたいな感じでCloudflare 向けの設定を勝手に作ってくれるらしいです。

```
void.config.ts           自分で書く
  + コードの import       void/db なら D1、のように読み取る
        |
        v
.void-wrangler.jsonc     生成される（gitignore）
void.lock.json           作ったリソースの ID を記録（コミットする）
        |
        v  void deploy
cloudflare.config.ts     デプロイのたびに一時フォルダに作られ、cf に渡される
```

したがって、 `void.config.ts` に書くのは、import からは読み取れないものだけです。雛形の時点では、日付が 1 行あるだけです。

```ts
// void.config.ts
export default defineConfig({
  worker: {
    compatibility_date: "2026-02-24",
  },
});
```

ほかに Worker の設定やバインディングを足したいときは、`cloudflare` というキーを足して、`wrangler.jsonc` に書いていた項目をその中に書きます。たとえば、別の Worker を呼ぶ設定はこうです。

```ts
// void.config.ts
export default defineConfig({
  worker: {
    compatibility_date: "2026-02-24",
  },
  cloudflare: {
    services: [{ binding: "API", service: "my-api-worker" }],
  },
});
```

ただ、作った直後にエディタで開くと、`tsconfig.json` に「`.void/db.d.ts` が見つかりません」とエラーが出ました。`.void/` には Void が作る型が入るんですが、create の時点ではまだ中身がそろっていないためっぽいです。`pnpm dev` を一度起動するか、`void prepare` を叩けば消えます。

とはいえ、毎回出るのはちょっと煩わしいので、今度 issue でも出しておこうかなと思います。

## dev サーバーを起動する

```sh
pnpm dev
```

起動ログの 1 行目で、もうマイグレーションが当たっています。

```
[void] Applied 1 migration(s): 20261020070535_nebulous_mulholland_black.sql
```

手元の D1 は `.void/` の中に SQLite のファイルとして作られます。DB を立てる手順も、マイグレーションを当てるコマンドもいりません。

初期データは `void db seed` で入ります。ただしこれは DB をいったん空にしてから入れ直すので、dev サーバーを再起動するまで画面には出ません。

```
◇ Reset database. Applied 1 migration.
● Restart your dev server if it's running.
✓ Seeded from db/seed.ts.
```

ちなみに Claude Code のような AI エージェントから `pnpm dev` を起動すると、ログが少し変わります。Cloudflare の Vite プラグインが AI エージェントの中で動いていることに気づいて、手元の D1 や KV の中身を覗ける API の一覧を出してくれるらしいです。AI に動作確認まで任せるときに便利ですね。こういう節々で AI にとっての DX に配慮しているのが感じられてとてもよい。

## `void gen model` で TODO の API を作る

```sh
void gen model todos title:string done:boolean
```

テーブル名と列を渡すと、これだけ作ってくれます。

| ファイル | 中身 |
|---|---|
| `db/schema/todos.ts` | `todos` テーブル。`id`・`createdAt`・`updatedAt` は勝手に足される |
| `db/schema.ts` | 上のファイルを読み込む 1 行 |
| `routes/api/todos/index.ts` | 一覧の GET と、追加の POST |
| `routes/api/todos/[id].ts` | 1 件取得の GET（なければ 404） |

途中で、入力チェックに使うライブラリを聞かれます（Valibot / Zod / ArkType / なし）。今回は Zod にしました。gen は `package.json` に足してはくれないので、`pnpm add zod` は自分で叩きます。先に入れておけば、聞かれずにそれを使ってくれます。

あとはマイグレーションを作って、dev サーバーを再起動すれば API が生えます。手元で試すだけなら `void db push` でもいいんですが、あとでデプロイするので、マイグレーションのファイルを残す `generate` にしています。

```sh
void db generate
```

> Void 1.1.12 では、gen model が作ったままだと、dev サーバーを再起動したところで全ページが `TypeError: __vite_ssr_import_1__.sql is not a function` で落ちました。`db/schema/todos.ts` のテーブルを `db/schema.ts` に移すと動きます。

更新と削除は gen model では作られないので、`[id].ts` に手で足します。生成された GET と同じ形で書けます。

```ts
// routes/api/todos/[id].ts
export const PATCH = defineHandler.withValidator({
  params: z.object({ id: z.string() }),
  body: z.object({
    title: z.string().optional(),
    done: z.boolean().optional(),
  }),
})(async (c, { params, body }) => {
  const [row] = await db
    .update(todos)
    .set({ ...body, updatedAt: sql`(datetime('now'))` })
    .where(eq(todos.id, Number(params.id)))
    .returning();

  if (!row) {
    return new Response("Not found", { status: 404 });
  }
  return row;
});
```

DELETE も同じ形です。

新しいエンドポイントを 1 本足したいときは `void gen route` を使います。

```sh
void gen route api/health
```

これで `routes/api/health.ts` に GET が 1 本入ったファイルができます。`--methods get,post` のように、作るメソッドも選べます。ただし gen route はすでにあるファイルには書き足さないので、さっきの `[id].ts` のように、あるファイルにメソッドを足すときは手で書きます。

## 画面に出す

画面は `pages/todos/` に置きます。これで `/todos` が TODO の画面になります。

```
pages/todos/
  index.tsx            画面
  index.server.ts      一覧を読む loader
```

一覧は loader で DB から読みます。返した値の型は `InferProps` で画面の props になるので、型を自分で書く必要はありません。

```ts
// pages/todos/index.server.ts
export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => {
  const rows = await db.select().from(todos).orderBy(desc(todos.id));
  return { todos: rows };
});
```

追加・完了・削除は、さっき gen で作った API を画面から叩きます。叩いたあとに `router.refresh()` を呼ぶと、loader がもう一度動いて一覧が新しくなります。

```tsx
// pages/todos/index.tsx
const toggle = async (todo: Todo) => {
  await fetch("/api/todos/:id", { method: "PATCH", params: { id: String(todo.id) }, body: { done: !todo.done } });
  router.refresh();
};
```

ここで使っている `fetch` は、ブラウザの `fetch` ではなく `void/client` のものです。`routes/` のファイルから型が作られるので、パスもメソッドも body も、間違えると型チェックで止まります。

```
'"/api/todoz"' is not assignable to parameter of type '"/api/hello" | "/api/todos" | "/api/todos/:id"'.
'"PUT"' is not assignable to type 'MethodsOf<"/api/todos"> | undefined'.
```

gen で API を作った瞬間に、画面からも型つきで呼べるようになっています。API の型をクライアントに渡すための手順は、何もしていません。

## デプロイする

最後はデプロイです。

```sh
void deploy
```

これだけで、ビルド・D1 の作成・マイグレーション・Worker のアップロードまで、順番に進みます。

```
◇ Preparing deployment...
◇ Applying D1 migrations...
● Saved a D1 restore point before applying 2 migrations.
  To undo these migrations, restore this point (discards every later write):
    void db restore --bookmark=00000000-0000000e-...
◇ Uploading the Worker and assets...
◇ Publishing the first Worker deployment...
◇ Waiting for the Worker to become ready...
╭─ https://void-handson.asahi-gaia1530.workers.dev ──╮
│  Worker: void-handson                              │
│  D1 migrations up to date                          │
╰────────────────────────────────────────────────────╯
✓ Successfully deployed!
```

3 行目がいい感じですね。本番の D1 にマイグレーションを当てる前に、復元ポイントを勝手に保存してくれます。まずいマイグレーションを当ててしまっても、表示されたコマンドで当てる前に戻せるっぽいです。

作った D1 の ID は `void.lock.json` に記録されます。2 回目からは同じ D1 を使うので、コミットしておけば別のマシンからデプロイしても DB が増えません。

> 1 回目は、D1 を作ったあとに `ENOENT: no such file or directory, open '.wrangler/deploy/config.json'` で落ちました。dev サーバーを止めてからもう一度 `void deploy` したら通りました。

出てきた URL の `/todos` を開けば、手元と同じ TODO の画面が出ます。

## おわりに

create から deploy まで、Void を使い始めるときに通るルートをひととおり歩いてみました。

create で聞かれるのは 6 つだけで、終わった時点で DB つきの雛形とデプロイ先の設定までそろっています。dev サーバーはマイグレーションを勝手に当ててくれて、gen model を叩けば API が生え、画面からはそれを型つきで呼べます。最後は `void deploy` の 1 行で、D1 ごと本番に出ていきました。今回は設定ファイルを全く触らずにすみました。

一方で、1.1.12 の時点では、gen の出力がそのまま動かない、雛形を開くと赤線が出るといった粗さもまだあります。このあたりは issue や PR にして返していこうと思います。

今回作った TODO アプリは [void-handson](https://github.com/ashunar0/void-handson) に置いてあります。節ごとにコミットを分けているので、手元で試すときの答え合わせに使ってください！
