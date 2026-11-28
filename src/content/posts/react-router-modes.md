---
title: React Router の「モード」を整理する
description: React Router には Declarative・Data・Framework の3つのモードがある。同じ2画面のアプリを3つのモードで書き比べて違いを整理し、Framework モードで選べる SSR・SPA・プリレンダリングの3つのレンダリング方式もまとめた。
pubDate: 2026-11-28
tags: [React Router, React, SSR, SPA]
draft: false
---

## はじめに

最近、勉強のために、Hono を使ってクライアントのルーターを作ってみてます。当然、React Router や TanStack Router を参考にするんですが... React Router 周りで特に「なんか話が噛み合わねぇな...」ってことが多かったんです。

よくよく調べてみると、React Router にはモードがいくつもあることが発覚しました。これまではそれをよくわからんまま適当に使ってたんですね...

この記事では、まず3つのモードを整理し、そのあと Framework モードの中の選択肢（SSR・SPA・プリレンダリング）を見ていきます。

## 3つのモード

各モードは「React Router にどこまで任せるか」が違います。どのモードになるかは、アプリの一番上で使うルーター API で決まります。

| モード | ざっくり言うと | 書き方の目印 |
| --- | --- | --- |
| Declarative | URL と画面をつなぐだけ。昔ながらの使い方 | `<BrowserRouter>` |
| Data | データの取得や送信もルーターが面倒をみる | `createBrowserRouter` + `<RouterProvider>` |
| Framework | ビルドや型生成まで引き受ける。Next.js に近い感覚 | `routes.ts` + Vite プラグイン |

Framework モードは、旧 Remix の後継にあたります。Remix が React Router に合流した形なんですね。

## 3つのモードの包含関係

機能は積み上げ式で、`Framework ⊃ Data ⊃ Declarative` の関係にあります。

<svg viewBox="0 0 420 225" role="img" aria-label="Framework の中に Data、Data の中に Declarative が入る入れ子の図" style="display:block;width:100%;max-width:420px;margin:1.5rem auto;font-size:14px">
  <g style="fill:none;stroke:var(--color-fg-muted);stroke-opacity:0.5;stroke-width:1.25">
    <rect x="0.75" y="0.75" width="418.5" height="223.5" rx="12"/>
    <rect x="16" y="64" width="388" height="144" rx="10"/>
    <rect x="32" y="128" width="356" height="64" rx="8"/>
  </g>
  <g style="fill:var(--color-brand);font-weight:700">
    <text x="16" y="28">Framework</text>
    <text x="32" y="92">Data</text>
    <text x="48" y="156">Declarative</text>
  </g>
  <g style="fill:var(--color-fg-muted);font-size:13px">
    <text x="16" y="48">+ 型生成・コード分割・SSR など</text>
    <text x="32" y="112">+ loader・action</text>
    <text x="48" y="176">Link・useNavigate・useLocation など</text>
  </g>
</svg>

- Data モードでは、Declarative の機能（`<Link>`、`useNavigate`、`useLocation` など）に加えて `loader` や `action` が使えます
- Framework モードの中身は Data モードで、Vite プラグインが型生成やコード分割、SSR などを足しています

ただし、包含関係はあくまで機能の範囲の話です。1つのアプリで使うモードは1つだけで、混ぜて使うものではありません。

また、上のモードほど「このファイル構成で」「このビルドの仕組みで」とルーターが決める部分が増えます。Framework が一番優れているとかではなく、どこまで任せたいかで選ぶものです。

## コードで見比べてみる

「トップページ」と「商品ページ（`/products/:pid`）」の2画面だけのアプリを、3つのモードでそれぞれ書いてみましょう。

### Declarative モード

```tsx
// main.tsx
import { BrowserRouter, Routes, Route } from "react-router";

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products/:pid" element={<Product />} />
    </Routes>
  </BrowserRouter>
);
```

```tsx
// Product.tsx
import { useParams } from "react-router";
import { useEffect, useState } from "react";

function Product() {
  const { pid } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    getProduct(pid).then(setProduct); // データ取得は自分でやる
  }, [pid]);

  if (!product) return <p>Loading...</p>;
  return <h1>{product.name}</h1>;
}
```

ルートは JSX で書きます。データ取得は `useEffect` などで自分で行います。ただパスとコンポーネントをマッチングしてくれるだけです。

### Data モード

```tsx
// main.tsx
import { createBrowserRouter, RouterProvider } from "react-router";

const router = createBrowserRouter([
  { path: "/", Component: Home },
  {
    path: "/products/:pid",
    Component: Product,
    loader: async ({ params }) => {
      return { product: await getProduct(params.pid) };
    },
  },
]);

ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
```

```tsx
// Product.tsx
import { useLoaderData } from "react-router";

function Product() {
  const { product } = useLoaderData(); // 画面を出す前に取得済み
  return <h1>{product.name}</h1>;
}
```

ルートは JSX の外に、オブジェクトの配列形式で書きます。`loader` を書いておくと、ページを表示する前にルーターがデータを取ってきてくれます。これで `useEffect` も Loading 用の state も不要になりました。

### Framework モード

```ts
// app/routes.ts
import { index, route } from "@react-router/dev/routes";

export default [
  index("./home.tsx"),
  route("products/:pid", "./product.tsx"),
];
```

```tsx
// app/product.tsx
import type { Route } from "./+types/product"; // 自動生成される型

export async function loader({ params }: Route.LoaderArgs) {
  return { product: await getProduct(params.pid) };
}

export default function Product({ loaderData }: Route.ComponentProps) {
  return <h1>{loaderData.product.name}</h1>; // 型が付く
}
```

ルートは `routes.ts` に一覧で書いて、1ページを1ファイルにします。`loader` とコンポーネントは、同じファイルから `export` する形です。実は `main.tsx` のような起動コードはもう書かなくてよくて、Vite プラグインが用意してくれます。さらに `+types` に型が自動生成されるので、`loaderData` の中身にもちゃんと型が付くんですね。

### 違いのまとめ

|  | ルートの書き方 | データ取得 | 起動コード |
| --- | --- | --- | --- |
| Declarative | JSX | 自分で（`useEffect` など） | 自分で書く |
| Data | オブジェクトの配列 | `loader`（ルーターが実行） | 自分で書く |
| Framework | `routes.ts` + ページごとのファイル | `loader`（型付き） | プラグインが用意 |

下の行に行くほど自分で書くコードは減ります。そのかわり、ルーターの決まりに乗っかることになります。

## Framework モードのレンダリング方式

Framework モードを選ぶと、さらに「HTML をどこで、いつ作るか」を選べるようになります。選択肢は SSR・SPA・プリレンダリングの3つで、設定はどれも `react-router.config.ts` に書きます。Declarative と Data はそもそもブラウザで動く SPA なので、この選択肢自体がありません。

### SSR（デフォルト）

```ts
export default { ssr: true } satisfies Config;
```

アクセスがあるたびに、サーバーで HTML を作って返します。`loader` もサーバーで動くので、DB に直接アクセスしたり、 API のシークレットキーを使ったりもできます。ただその代わり、Node などのサーバーを用意しないといけません。

```tsx
// app/product.tsx
import { db } from "~/db.server";

export async function loader({ params }: Route.LoaderArgs) {
  // サーバーで動くので、DB を直接読める
  const product = await db.product.findUnique({ where: { id: params.pid } });
  return { product };
}
```

`loader` のコードはブラウザ用のバンドルから取り除かれるので、DB の接続情報が外に漏れる心配もありません。

### SPAモード

```ts
export default { ssr: false } satisfies Config;
```

サーバーは使わず、画面は全部ブラウザで作ります。ビルドすると `index.html` と JS が出力されるので、S3 や Netlify、GitHub Pages などにそのまま置くことができます。ただし、動いている間はサーバーで `loader` を動かせません。データ取得には、ブラウザで動く `clientLoader` を使います。

```tsx
// app/product.tsx
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  // ブラウザで動くので、API を fetch して取ってくる
  const res = await fetch(`https://api.example.com/products/${params.pid}`);
  return { product: await res.json() };
}
```

ブラウザから DB には直接つなげないので、データを返す API を別に用意して `fetch` することになります。ただ、コンポーネント側はこれまでどおり `loaderData` で受け取れます。

### プリレンダリング（静的生成）

```ts
export default {
  prerender: ["/", "/about"], // true にすると全ページ
} satisfies Config;
```

指定したページの HTML を、ビルドのときに作っておきます。その時点の `loader` の結果が HTML に焼き込まれてしまうので、トップや会社概要、ブログ記事のような、中身があまり変わらないページ向きです。

```tsx
// app/about.tsx
import { readFile } from "node:fs/promises";

export async function loader() {
  // ビルドのときに1回だけ動く
  const body = await readFile("content/about.md", "utf-8");
  return { body };
}
```

書き方は SSR の `loader` と同じですが、動くのはビルドのときだけです。ビルドするマシンの上で動くので、ファイルや DB をそのまま読めます。

### 組み合わせもできる

プリレンダリングは SSR や SPA と組み合わせて使えます。

- `ssr: true` + `prerender`：一部のページは事前に作り、残りは SSR
- `ssr: false` + `prerender`：一部のページは事前に作り、残りは SPA

|  | HTML を作る場所・タイミング | サーバー | データ取得 |
| --- | --- | --- | --- |
| SSR | アクセスのたびにサーバーで | 必要 | `loader`（サーバー） |
| SPA | ブラウザで | 不要 | `clientLoader`（ブラウザ） |
| プリレンダリング | ビルドのときに | 単独なら不要 | ビルド時に `loader` |

## まとめ

<svg viewBox="0 0 480 287" role="img" aria-label="React Router のモードと、Framework モードのレンダリング方式" style="display:block;width:100%;max-width:480px;margin:1.5rem auto;font-size:14px;letter-spacing:0">
  <defs>
    <marker id="rr-modes-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--color-fg-muted)"/></marker>
  </defs>
  <g style="fill:var(--color-surface-sunken)">
    <rect x="0.5" y="60" width="479" height="96" rx="10"/>
    <rect x="0.5" y="190" width="479" height="96" rx="10"/>
  </g>
  <g style="fill:var(--color-surface);stroke:var(--color-fg-muted);stroke-opacity:0.5;stroke-width:1.25">
    <rect x="168" y="1" width="144" height="36" rx="8"/>
    <rect x="12" y="90" width="144" height="54" rx="8"/>
    <rect x="168" y="90" width="144" height="54" rx="8"/>
    <rect x="324" y="90" width="144" height="54" rx="8"/>
    <rect x="12" y="220" width="144" height="54" rx="8"/>
    <rect x="168" y="220" width="144" height="54" rx="8"/>
    <rect x="324" y="220" width="144" height="54" rx="8"/>
  </g>
  <rect x="324" y="90" width="144" height="54" rx="8" style="fill:var(--color-brand);fill-opacity:0.12;stroke:var(--color-brand);stroke-width:2"/>
  <g style="fill:none;stroke:var(--color-fg-muted);stroke-width:1.25">
    <path d="M240 37V58" marker-end="url(#rr-modes-arrow)"/>
    <path d="M396 144V218" marker-end="url(#rr-modes-arrow)"/>
  </g>
  <g style="fill:var(--color-fg);font-weight:700;font-size:13px">
    <text x="12" y="80">モード</text>
    <text x="12" y="210">Framework のレンダリング方式</text>
  </g>
  <g style="fill:var(--color-fg);font-weight:700" text-anchor="middle">
    <text x="240" y="24">React Router</text>
    <text x="84" y="112">Declarative</text>
    <text x="240" y="112">Data</text>
    <text x="396" y="112">Framework</text>
    <text x="84" y="242">SSR（デフォルト）</text>
    <text x="240" y="242">SPAモード</text>
    <text x="396" y="242">プリレンダリング</text>
  </g>
  <g style="fill:var(--color-fg-muted);font-size:12px" text-anchor="middle">
    <text x="84" y="132">&lt;BrowserRouter&gt;</text>
    <text x="240" y="132">createBrowserRouter</text>
    <text x="396" y="132">routes.ts</text>
    <text x="84" y="262">ssr: true</text>
    <text x="240" y="262">ssr: false</text>
    <text x="396" y="262">prerender</text>
  </g>
</svg>

最後に、どのモードを選ぶかの目安です。公式ドキュメントの「Picking a Mode」をもとに、ざっくりまとめると次のようになります。

- **Declarative**：とにかくシンプルに使いたい。または、データ取得を TanStack Query のような別のライブラリに任せている
- **Data**：`loader` や `action` は使いたい。でも、ビルドやサーバーまわりは自分で決めたい
- **Framework**：特にこだわりがない。SSR するかもしれないし、しないかもしれない

ちなみに公式は、どのモードでも SPA にも SSR にもできるので、「SSR したいかどうか」ではなく「どこまで自分でやりたいか」で選ぶものだと言っています。Declarative や Data で SSR をやるなら、その仕組みを自分で組むことになる、というだけなんですね。
