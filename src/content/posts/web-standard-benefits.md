---
title: web標準って何がいいんだっけ？
description: HonoやRemixは「Web標準の上に構築されている」ことを公式に謳っています。一方でNext.jsはServer Actions/RSCのように標準のFetch APIに乗らない部分も持っています。Web標準に乗ることで具体的に何を得ているのかを、マルチランタイム対応・WinterCGという業界の動き・テストのしやすさ・フルスタックでのAPI共有という観点から調べました。
pubDate: 2026-09-11
tags: [Hono, Remix, Web標準, Fetch API]
draft: false
---

## はじめに

Hono も Remix も、READMEや公式ドキュメントで「Web標準の上に構築されている」ことを明言しています。Hono は "built on Web Standards" と書き、Remix も Request・Response・FormData といったプラットフォームAPIの上に組み立てられていると説明しています。

一方で Next.js は、全部が全部そうというわけではありません。Route Handlers は `Request`/`Response` をほぼそのまま使いますが、Server Actions や RSC は標準の Fetch には乗らない独自のプロトコルを持っています。

「Web標準」を謳っているものがあるということは、それには相応のメリットがあるはずです。

## Web標準に乗る、とは具体的に何か

ここでの「Web標準」は、ブラウザが実装している Fetch API のことです。`Request` `Response` `Headers` `URL` `FormData` `ReadableStream` といった、WHATWG が仕様を定めているオブジェクト群を指します。

従来のサーバーサイドフレームワークは、ここを自前で持っていました。Express の `req` `res` は Node.js の `http.IncomingMessage` `http.ServerResponse` のラッパーで、ブラウザの `Request` `Response` とは別物です。ヘッダーの読み方もボディの取り出し方も、フレームワークごとに独自の API を覚える必要がありました。

Hono のハンドラは、ここを直接ブラウザと同じオブジェクトでやり取りします。

```ts
app.get('/posts/:id', (c) => {
  const id = c.req.param('id')
  return c.json({ id })
})
```

`c.req.raw` で取り出せるのは、フレームワーク独自のラッパーではなく標準の `Request` そのものです。`c.json()` も、内部では標準の `Response` を組み立てて返しています。

Remix も同じ形です。loader/action は `Request` を受け取り、`Response` を返します。

```ts
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')
  return json({ results: await search(query) })
}
```

ここでの `request` の型は Remix 独自のものではなく、ブラウザで `fetch` を書くときに触っているのと同じ `Request` です。

この「フレームワーク独自のラッパーを介さない」という点が、以降で見る利点の土台になっています。

## マルチランタイムで同じコードが動く

Hono公式サイトは、自身をこう説明しています。

> Hono is a small, simple, and ultrafast web framework built on Web Standards. It works on any JavaScript runtime.

Cloudflare Workers、Deno、Bun、Node.js、AWS Lambda、Fastly Compute といった、実行環境の異なるランタイムの上で、同じコードがそのまま動きます。

Express の `req`/`res` は Node.js の `http` モジュールに依存しているので、Node.js 以外のランタイムでは動きません。Hono が依存しているのは Fetch API という「ブラウザが実装している仕様」で、Node.js 固有の機構ではないので、それぞれのランタイムが Fetch API を実装してさえいれば、Hono 側は同じコードで動作します。

これを支えているのが WinterCG（現 WinterTC）というコミュニティグループです。2022年に Cloudflare・Deno・Shopify などが立ち上げ、Node.js・Deno・Cloudflare Workers といった非ブラウザ環境で「Fetch API がどの環境でも同じ挙動をする」ことを保証するための最小限の仕様、Minimum Common Web Platform API を策定しています。Hono公式ドキュメントにも、このコミュニティを踏まえた記述があります。

> Cloudflare Workers, Deno, Shopify, and others launched WinterCG to discuss the possibility of using the Web Standards.

つまり Hono が謳っている「どこでも動く」は、Hono が単独で頑張っている話ではなく、業界横断でランタイム間の互換性を揃えようとする動きの上に乗った結果です。

## サーバーを起動しなくてもテストできる

Hono公式のテストガイドには、次のような説明があります。

> All you need to do is create a Request and pass it to the Hono application to validate the Response.

具体的には、こう書けます。

```ts
import { describe, it, expect } from 'vitest'
import app from './app'

describe('GET /posts/:id', () => {
  it('returns the post', async () => {
    const res = await app.request('/posts/1')
    expect(res.status).toBe(200)
  })
})
```

`app.request()` は、内部で HTTP サーバーを起動しません。標準の `Request` をアプリケーションに直接渡し、返ってきた標準の `Response` をそのまま検証します。ポートを開いてリクエストを送る E2E テストとは違って、プロセスの起動やネットワークの待ち受けが要りません。

これも、ハンドラが受け取る型と返す型が標準の `Request`/`Response` であることの帰結です。標準のオブジェクトなので、テストコード側も標準のコンストラクタでそのまま作れます。フレームワーク独自の `req`/`res` だと、テスト用のモックやヘルパーをフレームワークごとに別に用意する必要があります。

## フルスタックでコンテキストスイッチが減る

Remix公式サイトには、次のような説明があります。

> Remix builds on Request, Response, URL, FormData, headers, cookies, and JavaScript because shared platform APIs reduce context switching across the full stack while keeping your application portable.

たとえば、フォームの送信を考えます。Remix Docs は、mutation（データの変更）の仕組みが `<form>` と HTTP という 2 つの基本的な Web API の上に成り立っていると説明しています。

```tsx
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const title = formData.get('title')
  await createPost({ title })
  return redirect('/posts')
}
```

`request.formData()` は、ブラウザの `<form>` が POST するときに使っているのと同じ `FormData` です。サーバー側の action でフォームの値を受け取る処理と、ブラウザ側で JavaScript から `fetch` でフォームを送る処理が、同じ API の上に乗ります。

Remix が言う「コンテキストスイッチが減る」は、ここを指しています。サーバー用の型とブラウザ用の型が別々に存在すると、コードを書く側は今どちらの API を触っているかを都度切り替える必要があります。Request/Response/FormData が両側で共通なら、その切り替えが起きません。

## おわりに

Hono と Remix が謳う「Web標準の上に構築されている」は、具体的には Fetch API（Request / Response / Headers / FormData / URL 等）を、フレームワーク独自のラッパーを介さずにそのまま使っていることを指していました。

そこから確認できたのは次の点です。

- Node.js 固有の機構に依存しないため、Cloudflare Workers・Deno・Bun・Node.js など異なるランタイムで同じコードが動く。これは WinterCG という業界横断のコミュニティが、非ブラウザ環境での Fetch API 互換性を仕様として揃えていることに支えられている
- ハンドラの入出力が標準の Request/Response なので、テストコード側も HTTP サーバーを起動せず、標準のコンストラクタで直接作った Request を渡すだけで検証できる
- サーバー側とブラウザ側で同じ Request/FormData を扱うため、フルスタックで書くときに型や API を切り替える必要がない

一方で Next.js のように、Route Handlers では標準の Request/Response を使いながら、Server Actions/RSC では標準の Fetch に乗らない独自のプロトコルを持つフレームワークもあります。どこまでを標準 API の上に乗せ、どこをフレームワーク独自の仕組みにするかは、フレームワークごとに設計判断が分かれるところのようです。

## 参考

- [Hono - Web application framework built on Web Standards](https://hono.dev/)
- [Web Standard | Hono](https://hono.dev/docs/concepts/web-standard)
- [Testing | Hono](https://hono.dev/docs/guides/testing)
- [Remix](https://remix.run/)
- [Forms and Mutations | Remix Docs](https://guides.remix.run/forms-and-mutations/)
- [Announcing WinterCG | Deno](https://deno.com/blog/announcing-wintercg)
- [WinterTC FAQ](https://wintertc.org/faq)
