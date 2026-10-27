---
title: Hono で API を作るときのエラー処理をルールにする
description: Hono で API を作るときのエラー処理を、記事を扱う小さな API を題材にルールにしました。失敗を想定内と想定外に分けて return と throw を使い分けること、Result で失敗を RPC の型に残すこと、HTTP の番号を種類からの表 1 か所で決めること、入力の検査やルートが無いときの失敗も同じ形に揃えることを書いています。
pubDate: 2026-10-28
tags: [Hono, TypeScript, 設計]
draft: false
---

## はじめに

Hono は、失敗の返し方を決めてくれません。何も決めずに書くと、見つからない記事を `c.json(undefined)` で返して、200 の空の body になったりします。handler ごとに `{ error: "..." }` や `{ message: "..." }` と形がばらけることもあります。

この記事では、記事を扱う小さな API（1 件取得・作成・公開）を題材にして、エラー処理のルールを決めます。判断の基準は次の 1 つです。

> 呼ぶ側がその失敗を見て動きを変えたいなら return し、変えようがないなら throw する。

ルールは、この基準から順に決めていき、最後に 7 つにまとめます。決め終わると、handler は次の形になります。

```ts
.post("/posts/:id/publish", (c) => {
  const result = publishPost(c.req.param("id"));
  if (!result.ok) return failureResponse(c, result.error);
  return c.json(result.value, 200);
})
```

使ったのは hono 4.13.14 と TypeScript 7.0.2 です。コードはこちらに置いてあります。

https://github.com/ashunar0/hono-error-handling

## 失敗の伝え方は return と throw の 2 つ

Hono の handler で失敗を返す方法は 2 つあります。

### ① return

失敗の応答を、成功のときと同じように handler から返します。

```ts
app.get("/posts/:id", (c) => {
  const post = posts.find((p) => p.id === c.req.param("id"));
  if (!post) {
    return c.json({ error: { message: "記事が見つかりません" } }, 404);
  }
  return c.json(post, 200);
});
```

### ② throw

例外を投げると、Hono が受け止めて `app.onError` に渡します。応答の形は `onError` の中で組み立てます。

```ts
app.get("/posts/:id", (c) => {
  const post = posts.find((p) => p.id === c.req.param("id"));
  if (!post) {
    throw new HTTPException(404, { message: "記事が見つかりません" });
  }
  return c.json(post, 200);
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { message: "サーバーでエラーが起きました" } }, 500);
});
```

2 つは、失敗の通り道が違います。return した失敗は戻り値なので、呼ばれた関数から呼んだ関数へ、1 段ずつ返っていきます。throw した失敗は、途中の関数を飛び越えて `onError` まで届きます。handler から呼んだ関数の奥で起きた失敗でも、そこから直接 `onError` に行きます。

## 失敗を想定内と想定外に分ける

どちらで伝えるかは、その失敗が想定内か想定外かで決めます。

想定内の失敗は、記事が見つからない、公開済みの記事をもう一度公開しようとした、タイトルが空だった、のように、業務の結果として普通に起きるものです。呼ぶ側はこれを見て、「記事はもう公開されています」と表示したり、入力欄を赤くしたりします。そのためには、何の失敗だったのかがクライアントまで届く必要があります。

想定外の失敗は、DB への接続が切れた、`undefined` のプロパティを読んでしまった、のように、バグや障害で起きるものです。こちらは、呼ぶ側にできることがありません。DB が落ちているとき、クライアントがどう分岐しても直せないからです。サーバーのログに中身が残って、クライアントには 500 が返れば十分です。

ここでは、想定内の失敗は戻り値として return し、想定外の失敗は throw したままにして `app.onError` で 500 にします。

想定外の失敗も戻り値で返せます。ただ、そうすると DB を触る関数の戻り値の型は、全部に `| DbError` が付きます。`DbError` を見て分岐するコードはどこにも書かれないので、型が長くなるだけです。

## 想定内の失敗は return する

### throw すると RPC の型から失敗が消える

Hono には RPC という仕組みがあります。サーバーの `app` の型をクライアントに渡すと、`hc` で作ったクライアントが、ルートごとのレスポンスの型を推論してくれます。型を引き継ぐために、ルートは `new Hono()` からチェーンでつないで書きます。

```ts
// サーバー
export const app = new Hono().get("/posts/:id", (c) => {
  /* 前の節の handler */
});
export type AppType = typeof app;

// クライアント
const client = hc<AppType>("http://localhost:8787");
const res = await client.posts[":id"].$get({ param: { id: "999" } });
```

このレスポンスの型は、handler が return したものから作られます。return の書き方なら、失敗の応答も型に出ます。`res.status` で分岐すると、body の型も一緒に絞られます。

```ts
if (res.status === 404) {
  const body = await res.json(); // { error: { message: string } }
}
if (res.status === 200) {
  const body = await res.json(); // Post
}
```

throw の書き方だと、handler が return しているのは成功だけです。そのため、RPC の型にも成功しか出ません。`onError` で返している 404 は、型の上では無いことになります。

```ts
res.status; // 型は 200 だけ。実際には 404 も返ってくる

if (res.status === 404) {
  // error TS2367: This comparison appears to be unintentional
  // because the types '200' and '404' have no overlap.
}
```

想定内の失敗は、クライアントがそれを見て分岐したいものでした。throw で伝えると、その分岐を書いたところで型エラーになってしまいます。

なお、成功の `c.json(post, 200)` の 200 も省かずに書きます。省くと、成功の status の型が「body を持てる status 全部」（`ContentfulStatusCode`）になり、その中に 404 も入ります。すると `res.status === 404` で絞っても、body の型は失敗と `Post` のどちらか、のままになります。

### Result で返すと code まで型に出る

return で応答を返せるのは、handler の中だけです。記事を探す処理や「公開済みなら公開できない」という判断を関数に切り出すと、その関数は `c` を持っていないので、応答を作れません。そこで関数は失敗を値として返し、handler がそれを応答に直します。

成功か失敗かを `ok` で見分ける型を用意します。

```ts
// src/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T) => ({ ok: true, value }) as const;

export const err = <const E>(error: E) => ({ ok: false, error }) as const;
```

`err` の `const E` は、`err("POST_NOT_FOUND")` の型を `string` に広げず、`"POST_NOT_FOUND"` のまま残すためのものです。

切り出した関数は、失敗の code を返します。

```ts
// src/post-service.ts
export const publishPost = (
  id: string,
): Result<Post, "POST_NOT_FOUND" | "ALREADY_PUBLISHED"> => {
  const post = posts.find((p) => p.id === id);
  if (!post) return err("POST_NOT_FOUND");
  if (post.status === "published") return err("ALREADY_PUBLISHED");
  post.status = "published";
  return ok(post);
};
```

起きうる失敗が、戻り値の型にそのまま書いてあります。404 や 409 といった HTTP の番号は、この関数には出てきません。

code を持たせるのは、status だけでは失敗を見分けられないことがあるからです。404 は「無い」の 1 つに意味が決まりますが、409 のような「できない」には、理由が何通りもありえます。

handler は、code を見て応答に直します。

```ts
// src/app.ts
export const app = new Hono().post("/posts/:id/publish", (c) => {
  const result = publishPost(c.req.param("id"));
  if (!result.ok) {
    switch (result.error) {
      case "POST_NOT_FOUND":
        return c.json({ error: { code: result.error, message: "記事が見つかりません" } }, 404);
      case "ALREADY_PUBLISHED":
        return c.json({ error: { code: result.error, message: "記事はもう公開されています" } }, 409);
    }
  }
  return c.json(result.value, 200);
});
```

handler が return しているので、失敗は RPC の型に戻ってきます。status ごとに、code まで絞り込めます。

```ts
const res = await client.posts[":id"].publish.$post({ param: { id: "999" } });
res.status; // 200 | 404 | 409
if (res.status === 404) {
  const body = await res.json();
  body.error.code; // "POST_NOT_FOUND"
}
```

失敗の扱い忘れも、型で止まります。`publishPost` に失敗を 1 つ足して、handler の `switch` に足し忘れたとします。すると `!result.ok` の中を抜けて失敗が下まで落ちてくるので、最後の `result.value` が型エラーになります。

```
error TS2339: Property 'value' does not exist on type
'Result<Post, "ALREADY_PUBLISHED" | "POST_NOT_FOUND" | "TITLE_REQUIRED">'.
```

エラーの文は「足し忘れています」とは言ってくれませんが、止まりはします。

## HTTP の番号は表 1 か所で決める

前の節の handler は、code を番号と message に直す方法を、自分の中に書いています。`"POST_NOT_FOUND"` を 404 と「記事が見つかりません」に直す行は、記事を 1 件返す `GET /posts/:id` にも同じものが要ります。記事を扱う handler が増えるたびに、同じ対応を書き写すことになります。

書き写したものは、ずれます。ある handler で `POST_NOT_FOUND` を 404 にして、別の handler で 400 にしても、何も止めてくれません。

そこで、応答に直すための材料を、失敗そのものに持たせます。

### 失敗を code・種類・message の値にする

失敗を、文字列の code から、code・種類・message を持つ値に変えます。

```ts
// src/failure.ts
export type FailureKind = "notFound" | "conflict";

export type Failure = {
  readonly code: string;
  readonly kind: FailureKind;
  readonly message: string;
};
```

```ts
// src/posts.ts
export const PostNotFound = {
  code: "POST_NOT_FOUND",
  kind: "notFound",
  message: "記事が見つかりません",
} as const satisfies Failure;

export const AlreadyPublished = {
  code: "ALREADY_PUBLISHED",
  kind: "conflict",
  message: "記事はもう公開されています",
} as const satisfies Failure;
```

失敗に持たせるのは、HTTP の番号の代わりに種類（kind）です。「無い」「ぶつかる」のような、HTTP を知らなくても通じる分け方にしておきます。こうしておくと、同じ関数を cron やキューから呼んだときにも、失敗の意味が変わりません。種類は、いま使っている 2 つだけにしています。

失敗の定義は、記事の型と同じ `posts.ts` に置きます。「公開済みなら公開できない」は記事の決まりなので、その失敗も記事と一緒にしておきます。

切り出した関数は、code の文字列の代わりにこの値を返します。

```ts
// src/post-service.ts
export const publishPost = (
  id: string,
): Result<Post, typeof PostNotFound | typeof AlreadyPublished> => {
  const post = posts.find((p) => p.id === id);
  if (!post) return err(PostNotFound);
  if (post.status === "published") return err(AlreadyPublished);
  post.status = "published";
  return ok(post);
};
```

### 種類から番号への表を 1 つだけ作る

種類を番号に直す表は、HTTP の応答を作る側に 1 つだけ置きます。

```ts
// src/errors.ts
const FAILURE_STATUS = {
  notFound: 404,
  conflict: 409,
} as const satisfies Record<FailureKind, ContentfulStatusCode>;

export const failureResponse = <F extends Failure>(c: Context, failure: F) =>
  c.json(
    { error: { code: failure.code, message: failure.message } },
    FAILURE_STATUS[failure.kind],
  ) as FailureResponse<F>;
```

「notFound は 404」を知っているのは、この表だけです。同じ失敗が handler によって違う番号になることは、もう起きません。`satisfies Record<FailureKind, ...>` が付いているので、種類を足して表に書き忘れると型エラーになります。

表を code ごとに作らず種類ごとにしたのは、行を増やさないためです。code は失敗を 1 つ足すたびに増えますが、種類はめったに増えません。

handler は、失敗が何であっても `failureResponse` に渡すだけになります。

```ts
// src/app.ts
export const app = new Hono().post("/posts/:id/publish", (c) => {
  const result = publishPost(c.req.param("id"));
  if (!result.ok) return failureResponse(c, result.error);
  return c.json(result.value, 200);
});
```

前の節の `switch` が消えました。RPC の型は前の節と変わらず、404 なら code は `"POST_NOT_FOUND"`、409 なら `"ALREADY_PUBLISHED"` に絞り込めます。

### `as FailureResponse<F>` が要る理由

`failureResponse` の中の `c.json(...)` の型をそのまま使うと、code の型が `string` に広がってしまいます。`F["code"]` のような、まだ決まっていない型を `c.json` に渡すと、Hono が JSON の型を計算するところで広がるためです。そこで戻り値の型を自分で書いて、`as` で上書きしています。

```ts
// src/errors.ts
type FailureResponse<F extends Failure> = F extends Failure
  ? Response &
      TypedResponse<
        { error: { code: F["code"]; message: string } },
        (typeof FAILURE_STATUS)[F["kind"]],
        "json"
      >
  : never;
```

`F extends Failure ? ... : never` と書くと、`F` が 2 つの失敗の union のとき、1 つずつ別々に計算されます。そのおかげで「404 なら `POST_NOT_FOUND`」という組が崩れません。`as` を書くのはこの 1 か所だけで、handler には出てきません。

## 残りの出口も同じ形にする

handler が返す失敗は、`failureResponse` で同じ形になりました。ただ、失敗の出口はほかにもあります。何も手を入れないと、それぞれ次の形で返ってきます。

| 失敗 | status | body |
|---|---|---|
| 入力の検査に落ちる（`@hono/zod-validator`） | 400 | `{ success: false, error: { name: "ZodError", message: "[...]" } }` |
| body が JSON として読めない | 400 | テキストの `Malformed JSON in request body` |
| ルートが無い | 404 | テキストの `404 Not Found` |
| 想定外の throw | 500 | テキストの `Internal Server Error` |

クライアントから見ると、失敗の読み方が 5 通りあることになります。これを全部 `{ error: { code, message } }` に揃えます。

形を組み立てる場所が増えるので、先に関数にしておきます。`failureResponse` の中もこれを使うように変えます。

```ts
// src/errors.ts
export const errorBody = (code: string, message: string) => ({
  error: { code, message },
});
```

### 入力の検査は `fail()` で throw する

入力の検査も想定内の失敗なので、`Failure` として定義します。種類に `invalid` を足します。

```ts
// src/failure.ts
export type FailureKind = "invalid" | "notFound" | "conflict";

export const InvalidInput = {
  code: "VALIDATION_ERROR",
  kind: "invalid",
  message: "入力が正しくありません",
} as const satisfies Failure;
```

種類を足した時点で、`FAILURE_STATUS` に `invalid` の行が無いことが型エラーになります。表に `invalid: 400` を足します。

入力の検査は、`zValidator` の第 3 引数の hook で失敗を受け取ります。hook は handler の外にあるので、handler の戻り値として返す道がありません。そこで、ここは throw して `onError` に任せます。

throw するものは、`HTTPException` を継承して code を持たせた `ApiError` です。ただし `ApiError` は export せず、`Failure` から作る `fail()` だけを外に出します。

```ts
// src/errors.ts
class ApiError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(status, { message });
  }
}

export const fail = (failure: Failure, message = failure.message) =>
  new ApiError(FAILURE_STATUS[failure.kind], failure.code, message);
```

```ts
// src/app.ts
.post(
  "/posts",
  zValidator("json", createPostSchema, (result) => {
    if (!result.success) {
      throw fail(InvalidInput, result.error.issues[0]?.message);
    }
  }),
  (c) => { /* 記事を作って 201 */ },
)
```

外からは `fail(InvalidInput)` の形でしか作れないので、throw する側にも番号を直接書く道がありません。番号は、ここでも `FAILURE_STATUS` から決まります。message は、zod が出した最初の issue のものを使っています。

エラーのクラスを export せず、決まった関数を通してしか作れないようにする話は、[Go の一貫性を型や lint で真似する記事](/posts/go-conventions-into-hono/)でも書きました。

なお、hook の中で throw の代わりに `return c.json(errorBody(...), 400)` と書くと、400 も RPC の型に出ます。代わりに、hook の書き方が handler と揃わなくなります。

### 残りは `onError` と `notFound` で揃える

`onError` は、throw されたものを種類ごとに同じ形にします。

```ts
// src/errors.ts
export const onError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(errorBody(err.code, err.message), err.status);
  }
  if (err instanceof HTTPException) {
    return c.json(errorBody("HTTP_ERROR", err.message), err.status);
  }
  console.error(err);
  return c.json(errorBody("INTERNAL_SERVER_ERROR", "サーバーでエラーが起きました"), 500);
};
```

```ts
// src/app.ts
app.notFound((c) => c.json(errorBody("ROUTE_NOT_FOUND", "ルートが見つかりません"), 404));
app.onError(onError);
```

`ApiError` の枝には、さっきの入力の検査が来ます。

`HTTPException` の枝には、Hono やミドルウェアが投げたものが来ます。body が JSON として読めないときは、Hono の validator が `HTTPException(400)` を投げています。`bearerAuth` の 401 なども、ここに来ます。

最後の枝が想定外の失敗です。message は固定の文にして、`err.message` は返しません。`DB connection lost` のような中の事情が、そのまま外に出てしまうからです。中身は `console.error` でサーバーのログにだけ残します。

ルートが無いときは、`onError` には来ません。`app.notFound` で別に書きます。

これで、どの出口の失敗も `{ error: { code, message } }` で返ります。番号が書いてある場所は、`FAILURE_STATUS` と、ルートが無いときの 404、想定外の 500 だけです。404 と 500 は業務の失敗ではなく HTTP の仕組みの失敗なので、表の外に置いています。

## おわりに

ここまでで決めたことを、ルールとして並べておきます。

1. 失敗の形は `{ error: { code, message } }` の 1 つにして、組み立てるのは `errorBody` だけにする
2. 想定内の失敗は `Failure`（code・kind・message）として、それが属するもの（記事なら `posts.ts`）と一緒に定義する。HTTP の番号は持たせない
3. handler から切り出した関数は、想定内の失敗を Result で return する
4. handler は `failureResponse(c, result.error)` で返す
5. 入力の検査のように、handler の戻り値にできない想定内の失敗は `fail()` で throw する
6. 想定外の失敗は catch しない。`onError` がログに残して、中身を隠した 500 を返す
7. 番号を知っているのは、種類から番号への表だけにする。ルートが無いときの 404 と、想定外の 500 だけは表の外に置く

迷ったときは、呼ぶ側がその失敗を見て動きを変えたいかどうかで決めます。変えたいなら return して型に出し、変えようがないなら throw して `onError` に任せます。

扱わなかったことも 2 つあります。入力の検査で返す 400 は、RPC の型には出ません。出したいときは、hook の中で throw の代わりに return します。もう 1 つは想定外の 500 で、ここではログに出すだけにしています。リクエスト ID を付けてログと応答を結びつける話は、この記事では扱っていません。
