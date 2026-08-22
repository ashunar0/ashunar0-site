---
title: Hono RPC の型推論が重くなる理由と、oRPC が切ったもの
description: Hono RPC の型がルートを足すたびに積み上がる仕組みを型定義から確認し、CI ビルドが8分かかったという報告の原因を追います。そのうえで oRPC がプロシージャを独立させ、contract-first でクライアントの型依存をスキーマだけに絞っている構造を比較し、乗り換えるべき境目と Hono のまま効く緩和策を整理します。
pubDate: 2026-08-22
tags: [Hono, oRPC, TypeScript, 設計]
draft: false
---

## はじめに

Twitter でこの投稿を見て、oRPC なるものの存在を知りました。

https://x.com/caru_ini/status/2090478578886643889

他にも、「Hono RPC は型推論が遅いので oRPC を使っている」という話を見かけました（引用元がどこか忘れちゃいました）。

Hono RPC は `typeof app` をフロントに渡すだけで型が通る、かなり気持ちのいい仕組みです。それが遅くなるというのは、単にルートが多いから重い、という規模の話に聞こえます。

ただ調べてみると、規模の話ではありませんでした。Hono RPC の型は**ルートを足すたびに前の型を取り込んで伸びる**構造をしていて、遅さはその構造から出ています。そして oRPC は、同じ問題を最適化ではなく構造で回避していました。

この記事では、まず Hono RPC の型がどう作られているかを確認し、そこから oRPC の設計が何を切ったのかを見ます。

## 1. Hono RPC の型はチェーンで積み上がる

Hono RPC の使い方はこうです。

```ts
const app = new Hono()
  .get("/posts", (c) => c.json([{ id: 1 }]))
  .post("/posts", zValidator("json", PostSchema), (c) => c.json({ id: 1 }));

export type AppType = typeof app;
```

フロント側では、この型を import して `hc` に渡します。

```ts
import type { AppType } from "../server";

const client = hc<AppType>("http://localhost:8787");
const res = await client.posts.$get();
```

ここで重要なのは、`AppType` が何を指しているかです。`Hono` クラスの型引数を覗いてみましょう。

```ts
class Hono<E extends Env, S extends Schema, BasePath extends string>
```

第2引数の `S` がルートのスキーマです。そして `.get()` や `.post()` は、**新しい `Hono` 型を返します**。返される型の `S` は、元の `S` に今回のルート分を交差型で足したものです。

つまり、実際に起きているのはこうです。

```ts
new Hono()          // Hono<Env, {}, "/">
  .get("/a", ...)   // Hono<Env, {} & { "/a": {...} }, "/">
  .post("/b", ...)  // Hono<Env, {} & { "/a": {...} } & { "/b": {...} }, "/">
  .get("/c", ...)   // ...以下、ルート数だけ積み上がる
```

型は上書きされず、積まれます。ルートを1本足すたびに、TypeScript はそれまでの全ルート分の型を抱えたまま次の型を組み立てます。

そしてクライアント側の `hc<AppType>` は、この積み上がった `S` を舐めて、パスごとのメソッドを持つオブジェクト型に組み替えます。ルート数が増えると、この組み替えのコストも一緒に膨らみます。

大きなアプリで `Type instantiation is excessively deep and possibly infinite.` が出るのは、これが原因です。

## 2. 実際にどれくらい遅くなるのか

[honojs/hono#3869](https://github.com/honojs/hono/issues/3869) に報告がありました。

- CI での型チェック込みのビルドに **約8分**
- 開発時のリロードが当初 **約2分**、複数の回避策を入れてようやく約10秒

報告者は最終的に、Nx モノレポに組み替え、ルータを esbuild のライブラリ単位に分割し、開発時は型チェックを切る、というところまでやっています。これは「ルートが多いと少し重い」という話の範囲を超えています。

## 3. 本当の問題は、型が実装に触れていること

同じ issue の中で、報告者がこう書いています。

> you have to compile your entire app (including your ORM, hidden business logic and etc) just to have RPC functionality for your frontend, which is essentially just the inputs/outputs for your API, and shouldn't be more than that.
>
> （フロントエンドで RPC を使うためだけに、ORM や表に出ないビジネスロジックまで含めたアプリ全体をコンパイルしなければならない。本質的に必要なのは API の入力と出力だけで、それ以上であるべきではない。）

ここが問題の中心だと思います。

`typeof app` は、`app` という値の型です。`app` の型を確定させるには、そこにぶら下がったハンドラの返り値の型を確定させる必要があり、そのためにはハンドラが呼んでいるサービスの型が要り、その先には ORM のクエリビルダの型があります。

フロントが欲しいのは「`GET /posts` に何を渡すと何が返るか」だけです。にもかかわらず、その一点を知るために、サーバー側の依存グラフ全体を型解決させています。

つまり **フロントの型チェックが、バックエンドの実装の重さを直接引き受けている**状態です。ルート数はあくまできっかけであって、原因ではありません。

## 4. oRPC はどう組まれているか

[oRPC](https://orpc.dev/) は TypeScript のエンドツーエンド型安全 API ライブラリです。tRPC に近い書き味を持ちつつ、OpenAPI 出力を最初から備えているのが特徴ですが、ここでは型構造の話に絞ります。

書き方はこうです。

```ts
import { os } from "@orpc/server";
import * as z from "zod";

export const listPosts = os
  .input(z.object({ limit: z.number().optional() }))
  .handler(async ({ input }) => {
    return [{ id: 1, title: "はじめての投稿" }];
  });
```

ルータは、プレーンなオブジェクトです。

```ts
export const router = {
  post: {
    list: listPosts,
    find: findPost,
  },
};
```

ここに Hono との差があります。`listPosts` と `findPost` は**互いの型を知りません**。それぞれが自分の入出力型だけを持った独立した値で、ルータはそれを束ねるオブジェクトにすぎません。

Hono がチェーンで型を積むのに対して、oRPC は積みません。ルートを1本足しても、既存のルートの型は再計算されません。

ただし、これだけでは3節の問題は残ります。`typeof router` を辿れば、結局ハンドラの実装に到達するからです。

## 5. contract-first が切っているもの

oRPC には、契約だけを先に定義する仕組みがあります。

```ts
// packages/contract/index.ts
import { oc } from "@orpc/contract";
import * as z from "zod";

export const contract = {
  post: {
    find: oc
      .input(z.object({ id: z.number() }))
      .output(z.object({ id: z.number(), title: z.string() })),
  },
};
```

サーバーはこの契約を実装します。

```ts
import { implement } from "@orpc/server";
import { contract } from "@my/contract";

const os = implement(contract); // @orpc/server の os を置き換える

export const findPost = os.post.find.handler(({ input }) => {
  return { id: input.id, title: "はじめての投稿" };
});
```

そしてクライアントは、**契約の型だけ**を見ます。

```ts
import type { ContractRouterClient } from "@orpc/contract";
import type { contract } from "@my/contract";

const client: ContractRouterClient<typeof contract> = createORPCClient(link);
```

`typeof contract` が指しているのは Zod スキーマの集合だけです。ハンドラもサービスも ORM も、この型からは辿れません。

3節で見た「フロントの型チェックがバックエンドの実装の重さを引き受ける」という依存が、ここで物理的に切れています。最適化ではなく、依存の向きを変えることで消しています。

Hono の issue で報告者が提案していた「入出力を先に定義するコントラクトモデル」は、oRPC には最初から入っている、という関係になります。

## 6. Hono を捨てる必要はない

ここまで対比で書いてきましたが、oRPC は Hono の代わりではありません。oRPC が担うのは RPC の層で、HTTP サーバーは別に要ります。Hono 用のアダプタが用意されています。

```ts
import { Hono } from "hono";
import { RPCHandler } from "@orpc/server/fetch";

const handler = new RPCHandler(router);
const app = new Hono();

app.use("/rpc/*", async (c, next) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: "/rpc",
    context: {},
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});
```

Hono は Fetch API 準拠なので、`c.req.raw` をそのまま渡すだけです。`matched` が `false` なら `next()` に流れるため、`/rpc/*` を oRPC に任せつつ、他のパスは通常の Hono ルートとして残せます。CORS も認証もロギングも、Hono 側のミドルウェアのままで動きます。

置き換わるのは Hono RPC（`hc` と `typeof app`）の部分だけです。

## 7. どこが乗り換えの境目か

構造としては oRPC の方が素直ですが、それは常に乗り換えるべきという意味ではありません。

8分ビルドは数百ルート規模の話です。ルートが数十本のアプリなら、Hono RPC で困ることはまずありません。むしろ、契約パッケージを切って両側を繋ぎ直すコストの方が大きくなります。

検討する価値が出てくるのは、次のあたりからだと思います。

- ルート数が増えて、エディタの補完に体感できる遅延が出てきた
- フロントとバックのリポジトリが分かれていて、モノレポ前提の `typeof app` が渡しにくい
- API を外部に公開する必要があり、OpenAPI 仕様が要る

逆に、Hono のままで効く手も先にあります。ルータを機能単位に分けて `app.route()` で束ねる、`tsconfig` の `incremental` を有効にする、といったものです。#3869 の報告者も、まずルータの分割から手をつけています。

## おわりに

「Hono RPC は型推論が遅い」という話は、規模の問題ではなく構造の問題でした。型がチェーンで積み上がること、そしてその型がサーバーの実装に触れていること。この2つが重なった結果として遅くなります。

oRPC はプロシージャを独立させることで前者を、contract-first で後者を外しています。どちらも速度のためのチューニングではなく、依存の切り方の設計です。

ライブラリを選ぶときに「速い / 遅い」で比べると、次のバージョンで逆転するかもしれない話になります。何が何に依存しているかで比べると、もう少し長持ちする判断ができそうです。

## 参考

- [oRPC](https://orpc.dev/)
- [Contract First - oRPC](https://orpc.dev/docs/contract-first/define-contract)
- [Hono Adapter - oRPC](https://orpc.dev/docs/adapters/hono)
- [Hono Type Inference is taking too long during builds · Issue #3869 · honojs/hono](https://github.com/honojs/hono/issues/3869)
- [Pure RPC client types · Issue #2489 · honojs/hono](https://github.com/honojs/hono/issues/2489)
- [RPC - Hono](https://hono.dev/docs/guides/rpc)
- [Grouping routes for RPC - Hono](https://hono.dev/examples/grouping-routes-rpc)
