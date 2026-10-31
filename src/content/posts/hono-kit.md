---
title: Hono の API を「上手に」作るための Hono Kit
description: Hono で API を上手に作るための決まりをまとめた、Hono Kit を作っています。Hono v5 の defineHandler の上に、失敗も return して型を hc に乗せる reply、auth の必須化、ディレクトリがそのまま URL になる置き場所、依存と時刻を外から受け取る決まりを足しました。決まりから外れると lint が直し方まで返すので、AI に書かせても自分で直せます。
pubDate: 2026-10-31
tags: [Hono, TypeScript, 設計]
draft: false
---

## はじめに

最近、Hono Kit というものを作っています。これは、Hono で API を「上手に」作るためのものです。

https://github.com/ashunar0/hono-kit

Hono は、API を作るための部品をひととおり用意してくれています。ルーティングもミドルウェアも入力の検査もそろっていて、何を書いてもちゃんと動きます。作れることは Hono が保証してくれているんです。

ただ、Hono には「こう書きましょう」という規約がありません（Hono としてはそれが正解だと思っていますが）。実務レベルでちゃんとしたものを作ろうとすると、これって結構キツくないですか？ ファイルをどこに置くか、失敗をどう返すか、誰が呼べるようにするか...などといったことを全部自分で決めないといけません。しかも、それを意識しながら書いていると、結局毎回同じことを気にしているんですよね。

だったら、それをまとめてパッケージにしてしまおう、と思って作ったのが Hono Kit です。

Hono Kit は、その決まりを型と lint にしてあるので、外れた書き方をするとすぐ教えてくれます。Hono の上に薄く載るだけなので、抜いても素の Hono のコードとして読めます。

## Void と被ってない？

はい、被っています...

Hono の上でアプリを作る道具に、つい最近 VoidZero からリリースされた Void があります。Hono Kit を作っていたときは Void はリリース前で、存在をすっかり忘れていて、気づいたら同じようなところに手を出していました...泣 `src/routes/` のディレクトリがそのまま URL になるところとかモロかぶりです笑

とはいえ、狙っているレイヤーが少し違うとは思っています。Void は、ルーティングから DB、認証、デプロイまで用意して、作ることをとにかく楽にしてくれます。特にインフラ周りのサポートが手厚いです。Hono Kit がやりたいのは、その一段上の「上手に」作るほうです。誰が呼べるか、失敗をどう返すか、といった書き方を決めて、外れたら教えてくれます。なので、Void の上で書くときにも、その上に同じ決まりは要ると思っています。

## Hono Kit が決めていること

Hono Kit で書いた endpoint はこうなります。たとえば、家計簿の API の支出を 1 件取る GET です。

```ts
// src/routes/expenses/[id]/index.ts
export const GET = createEndpoint(
  {
    auth: requireAuth,
    request: { param: z.object({ id: z.string() }) },
    responses: { 200: expenseResponseSchema, ...errorResponses(NotFound) },
  },
  async (c, reply) => {
    const { id } = c.req.valid("param");
    const row = await findExpense(c.var.deps.db, c.var.currentUser.id, id);
    if (row === undefined) return reply.failure(NotFound.code);

    return reply.success(expenseResponse(row));
  },
);
```

### createEndpoint

endpoint は、全部この `createEndpoint` で書きます。中身は Hono v5 で入る予定の `defineHandler` の上に作っていて、入力の検証と、`auth` などの middleware は defineHandler がやってくれます（v5 が出るまでは、Hono Kit の中にコピーして使っています）。

handler は、2 つ目の引数の `reply` で返します。`c.json` の代わりに、成功は `reply.success`、失敗は `reply.failure` を使います。`reply` は `responses` の宣言を読んで作られるので、宣言と違うものを渡すと型エラーになります。成功の出力の検証も `reply.success` がやっていて、宣言に無い項目は落としてから返します。

これだけでもかなりいいのですが、今の defineHandler に足りないのは、**失敗の扱い**です。defineHandler で出力を検証すると、handler が返せるのは成功の値だけになります。失敗は throw して `onError` に任せることになるので、どんな失敗が返ってくるかが `hc` の型に乗りません。

Hono Kit では、想定内の失敗も return します。`responses` に起こりうる失敗を宣言しておくと、`reply.failure` は宣言したものしか返せなくなり、失敗にも型が付いて `hc` に乗ります。アーキテクチャを考えてレイヤーを分けると、失敗はだいたい handler より奥で起きます。そこから型を途切れさせずに運ぶには、return のほうが都合がいいんです。考え方は前の記事に書きました。

https://ashunar0.dev/posts/hono-error-handling/

もう 1 つ足したのが、`auth` を必須にしたことです。defineHandler では middleware は任意なので、認証を付け忘れても動きます。付け忘れた endpoint は黙って誰でも呼べるようになって、わざと公開したものと見分けがつきません。AI に書かせていると、これはかなり怖いです。Hono Kit では `auth` を書かないと型エラーになり、公開するときも `allowAnonymous` と書きます。これにより、AI のミスをひとつ未然に防ぐことができます。

### 置き場所

Next.js や Void と同じで、`src/routes/` のディレクトリがそのまま URL になります。`src/routes/expenses/[id]/index.ts` で `GET` を export すると、`GET /expenses/:id` です。

### 返すもの

成功は、いつも 200 で返します。`reply.success` は番号を取らないので、200 にするか 201 にするかで迷うことがありません。

同じデータを JSON 以外でも返したいときは、`responses` の 200 に形式を並べます。

```tsx
responses: {
  200: {
    "application/json": expenseResponseSchema,
    "text/html": (data: Expense) => <ExpensePage {...data} />,
  },
},
```

リクエストの `Accept` を見て、どれで返すかは Hono Kit が選びます。ブラウザには HTML、AI には Markdown、のように、同じ endpoint のまま相手に合わせて返せます。

### 依存と時刻は外から受け取る

handler の中で、DB の接続や時刻を自分で作らないことにしています。どれも外から受け取ります。

- DB などの依存は、`src/main.ts` の `makeDeps` で組み立てて、handler は `c.var.deps` から受け取ります。Workers はリクエストをまたいで DB の接続を持てないので、組み立て方を渡しておいて、リクエストごとに作ります。この辺は Go を参考にしました。
- 時刻は `c.get("now")` で読みます。`new Date()` を直接書くと lint が教えてくれます。これにより、テストでは時刻を固定できます。
- モジュールの一番上に、変わる値（`let` や `Map`）を置きません。並行するリクエストで共有されてしまうからで、置くと lint が教えてくれます。

## 外れたときは直し方まで教えてくれる

決まりから外れると、lint は直し方まで返します。たとえば handler で `new Date()` を書くと、こう出ます。

```
error hnk(no-clock-outside-app-entry): src/routes/expenses/[id]/index.ts reads the clock (new Date()).
The app reads it once, so tests can fix it: in a handler use c.get("now"), in a job the now it is
passed, and the functions they call take now as an argument. More: node_modules/hono-kit/docs/rules.md
```

最後の `More:` は、その決まりの理由が書いてあるページです。決まりの文書はパッケージの中に入っているので、インストールした版と同じものを読めます。

AI に書かせるときは、「`pnpm check` を通して」と言うだけで足ります。型検査・lint・format・テストをまとめて回して、外れたところと直し方を返すので、AI はそれを読んで自分で直してくれます。

## おわりに

Hono Kit は、Hono で API を作れることはそのままに、「上手に」作るための決まりを足したものです。この記事で紹介したのは、endpoint を書くところの決まりです。

その上には、業務のルールをどこに置くかという、アーキテクチャの話があります。Hono Kit ではレイヤーを分けることがほぼ前提なので、そこをどう決めているかは別の記事で書こうかと思います。

試すときは、雛形を作って `pnpm check` を通してください。雛形は現状、Cloudflare Workers + D1 と Node + SQLite の 2 つを用意しています。

```sh
pnpm create hnk my-app --template workers
cd my-app && pnpm install
pnpm check
```

（この記事のコードは Hono Kit 0.18.0 で書いています。）
