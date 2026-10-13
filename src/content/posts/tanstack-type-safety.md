---
title: TanStack Start の「型安全」が型にしている 5 つの場所
description: TanStack Start 1.0 が安定版になりました。売りにしている型安全を、ルートの一覧・遷移・クエリ文字列・loader と context・server function の 5 か所に分けて、コードと一緒に整理します。
pubDate: 2026-10-14
tags: [TanStack, React, TypeScript]
draft: false
---

## はじめに

2026 年 10 月 13 日、TanStack Start 1.0 がついに安定版として公開されました。TanStack Start は TanStack Router を土台にしたフルスタックフレームワークで、Router の頃から**型安全**を一番の売りにしています。

https://tanstack.com/blog/tanstack-start-1-0

発表記事の中で、作者の Tanner Linsley さんは Router を作り始めた動機を次のように書いています。

> I wanted my routes to know which paths existed, which parameters they needed, which search parameters were valid

要するに、存在するパス、必要なパラメータ、有効なクエリ文字列を、ルート自身が知っている状態にしたかった、ってことです。「型安全」という言葉はどのフレームワークも使うので、TanStack が具体的に何を型にしているのかを整理してみました。

## ざっくり言うと

TanStack の言う「型安全」とは、URL とサーバー通信という、文字列がアプリに入ってくる 2 つの場所を、定義した時点で型に変える仕組みのことです。URL の型はルート定義で、通信の型は server function の定義で決まります。決まった型は、ルートなら親子関係に沿って子のルートへ、server function なら呼び出し側へ流れていきます。

型に変えている場所は、次の 5 つに分けられます。最後の節では、5 つすべてにまたがる `from` という仕組みも扱います。

| 場所 | 型になるもの |
|---|---|
| ルートの一覧 | アプリに存在するパス |
| 遷移 | `Link` の遷移先と、そこに渡すパラメータ |
| クエリ文字列 | `?page=2&sort=new` の中身 |
| loader と context | 取得したデータと、親のルートが用意した値 |
| server function | サーバーとの通信の入力と出力 |

## ルートの一覧が型になる

TanStack Router でファイルベースのルーティングを使うと、`src/routes/` 以下のファイル構成から `routeTree.gen.ts` というファイルが自動で生成されます。たとえば次のような構成です。

```
src/routes/
+-- __root.tsx
+-- index.tsx         -> /
+-- posts/
    +-- index.tsx     -> /posts
    +-- $postId.tsx   -> /posts/$postId
```

生成されたファイルには、ルート同士の親子関係と、次のような型が書かれています。

```ts
// src/routeTree.gen.ts（自動生成、抜粋）
export interface FileRouteTypes {
  fullPaths: '/' | '/posts' | '/posts/$postId'
  // ...
}
```

`fullPaths` に、アプリに存在するパスが文字列リテラルのユニオン型として並んでいます。これがこの記事でいう「ルートの一覧」です。ファイルを足したり消したりすると、開発サーバーがこのファイルを書き直します。

生成されただけの段階では、ライブラリ側の `Link` や `useParams` はまだこの一覧を知りません。TanStack Router 単体で使う場合は、作ったルーターを `Register` というインターフェースに登録します。

```ts
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

`declare module` で、ライブラリが用意した空の `Register` にアプリのルーターを書き足しています。登録は 1 回だけで、その後はどのファイルの `Link` も型引数なしでこの一覧を参照します。

## 遷移先とパラメータを検査する

ルートの一覧が型になると、`Link` の `to` には一覧にあるパスしか書けなくなります。

```tsx
<Link to="/posts">記事一覧</Link> // OK
<Link to="/post">記事一覧</Link>  // 型エラー：存在しないパス
```

`$postId` のようなパラメータを含むパスでは、値をパスの文字列に埋め込まず、`params` で別に渡します。

```tsx
<Link to="/posts/$postId" params={{ postId: '1' }}>記事</Link> // OK

<Link to="/posts/$postId">記事</Link>                      // 型エラー：params がない
<Link to="/posts/$postId" params={{ id: '1' }}>記事</Link> // 型エラー：キー名が違う
```

`to` に `/posts/$postId` を選んだ時点で、`params` は `{ postId: string }` を要求する型になります。Next.js の `typedRoutes` は値を `` `/blog/${slug}` `` のように文字列へ埋め込むので、パラメータの名前までは検査できません。`navigate` や `redirect` も `Link` と同じ検査を受けます。

アプリの中でパスを文字列で組み立てる場面がなくなるので、ルートのファイル名を変えると、古いパスを指していた `Link` や `navigate` が全部型エラーになります。直し漏れを、ブラウザで踏む前にエディタ上で見つけられます。

## クエリ文字列に型を付ける

TanStack Router でいちばん特徴的なのがこの部分です。ルート定義の `validateSearch` にスキーマを渡すと、そのルートのクエリ文字列に型が付きます。

```tsx
// src/routes/posts/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().int().min(1).default(1),
  sort: z.enum(['new', 'popular']).default('new'),
})

export const Route = createFileRoute('/posts/')({
  validateSearch: searchSchema,
  component: Posts,
})

function Posts() {
  const { page, sort } = Route.useSearch()
  // page: number
  // sort: 'new' | 'popular'
}
```

`/posts?page=2&sort=popular` で開くと、`useSearch()` は `{ page: 2, sort: 'popular' }` を返します。`?page=abc` のように型に合わない値が来た場合は検証が失敗するので、コンポーネントには不正な値が届きません。

### 書き込む側も同じスキーマで検査される

クエリ文字列を変える `Link` の `search` も、同じスキーマで検査されます。

```tsx
<Link to="/posts" search={{ page: 2, sort: 'popular' }}>2 ページ目</Link> // OK
<Link to="/posts" search={{ page: '2' }}>2 ページ目</Link>                // 型エラー：page は number
```

今の値をもとに次の値を作る書き方もできます。

```tsx
<Link from="/posts" to="/posts" search={(prev) => ({ ...prev, page: prev.page + 1 })}>
  次のページ
</Link>
```

ここで `from="/posts"` を外すと、`prev.page` が `undefined` かもしれない型になって、`+ 1` の行が型エラーになります。`Link` はどのページに置かれるか分からないので、今いるルートを `from` で宣言しないと、`prev` がどのルートのクエリ文字列なのか決まらないからです。

読む側の `useSearch()` と書く側の `search` が同じスキーマを見ているので、片方だけ直して食い違う、ということが起きません。

## loader の戻り値と context を子に流す

### loader の戻り値がコンポーネントに届く

ルートの `loader` が返した値は、`useLoaderData()` の戻り値の型になります。

```tsx
// src/routes/posts/$postId.tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    // params.postId: string
    return { post: await fetchPost(params.postId) }
  },
  component: PostPage,
})

function PostPage() {
  const { post } = Route.useLoaderData()
  // post: fetchPost の戻り値の型
}
```

`loader` の引数の `params` にも、パスの `$postId` から型が付いています。取得したデータの型を手で書く場所がないので、`fetchPost` の戻り値を変えれば、使っている側にそのまま反映されます。

### context は親から子へ型ごと引き継がれる

ルートを読み込む前に走る `beforeLoad` が返した値は、そのルートと子のルートの `context` に足されます。認証が必要なページをまとめる親のルートで、ログイン中のユーザーを入れる例です。

```tsx
// src/routes/_authed.tsx
export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const user = await getCurrentUser() // User | null
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
})
```

```tsx
// src/routes/_authed/dashboard.tsx
export const Route = createFileRoute('/_authed/dashboard')({
  loader: ({ context }) => fetchDashboard(context.user.id),
  // context.user: User
})
```

親の `beforeLoad` では、ユーザーがいなければ `redirect` を投げて処理を抜けます。そのため `return { user }` の時点で `user` は `null` を除いた `User` 型になっていて、子のルートでもその型のまま受け取れます。ページごとに `if (!user)` を書く必要がありません。URL のルートの親子関係が、そのまま `context` の型を引き継ぐ親子関係にもなっています。

## server function の入力と出力をつなぐ

ここまでの 4 つは TanStack Router の機能で、この節だけが TanStack Start の機能です。server function は、サーバーで動く処理を普通の関数として定義して、クライアントからそのまま呼べるようにする仕組みです。

```ts
// src/server/posts.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const createPost = createServerFn({ method: 'POST' })
  .validator(z.object({ title: z.string().min(1) }))
  .handler(async ({ data }) => {
    // data: { title: string }
    return db.posts.create({ title: data.title })
  })
```

```tsx
// コンポーネントや loader から呼ぶ
const post = await createPost({ data: { title: 'こんにちは' } })
// post: db.posts.create の戻り値の型

await createPost({ data: { title: 1 } }) // 型エラー：title は string
```

`validator` に渡したスキーマが、`handler` の `data` の型と、呼び出すときの `data` の型の両方を決めます。`handler` の戻り値は、そのまま呼び出し側の戻り値の型になります。クライアントから呼んだときは、ビルドの段階で関数の中身がサーバーへのリクエストに置き換わるので、通信のための型を別に書く必要はありません。

### ミドルウェアが足した値も型で届く

server function にはミドルウェアを挟めます。ミドルウェアが `next()` に渡した `context` は、`handler` の `context` に型付きで届きます。

```ts
// src/server/auth-middleware.ts
import { createMiddleware } from '@tanstack/react-start'

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await getSession() // Session | null
    if (!session) throw new Error('Unauthorized')
    return next({ context: { session } })
  },
)
```

```ts
createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context.session: Session
  })
```

前の節の `beforeLoad` と同じく、セッションがなければ例外で抜けるので、`handler` に届く `session` は `null` を含みません。ルートでは親子関係に沿って `context` が引き継がれ、server function ではミドルウェアの並びに沿って引き継がれます。

## from で呼び出し元のルートを宣言する

ここまでの例では `Route.useSearch()` のように、ルート定義の `Route` からフックを呼んでいました。`Route` が手元にない共通のコンポーネントでは、どのルートの文脈で呼んでいるかを `from` で宣言します。

```tsx
const { postId } = useParams({ from: '/posts/$postId' })
// postId: string

const { page } = useSearch({ from: '/posts' })
// page: number
```

`from` に書けるのはルートの一覧にあるパスだけで、`from` を書かずに `useParams({})` とすると型エラーになります。どのルートとも決めずに読みたい場合は、`strict: false` を明示します。

```tsx
const params = useParams({ strict: false })
// params: { postId?: string; userId?: string; ... }
```

この場合はアプリの全ルートのパラメータを寄せ集めた型になり、どれも `undefined` かもしれない扱いになります。宣言したぶんだけ型が絞られ、宣言しなければ広い型のまま返ってくる、という作りです。

`from` は実行時にも確かめられます。`from: '/posts/$postId'` と書いたコンポーネントが別のルートで表示されると、開発中は `Could not find an active match from "/posts/$postId"` というエラーで止まります。

## おわりに

TanStack の型安全を 5 つの場所に分けて見てきました。どの場所の型も、ルート定義か server function の定義で一度だけ宣言され、そこから使う側へ流れていきます。使う側がやることは、`from` でどのルートの文脈かを宣言することくらいです。

TanStack は最近特に伸びてきているスタックなので、Start の安定化でどう広がるのか、動向が楽しみですね。

## 参考

- https://tanstack.com/blog/tanstack-start-1-0
- https://tanstack.com/router/latest/docs/guide/search-params
- https://tanstack.com/router/latest/docs/guide/data-loading
- https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- https://tanstack.com/start/latest/docs/framework/react/guide/middleware
- https://nextjs.org/docs/app/api-reference/config/typescript
