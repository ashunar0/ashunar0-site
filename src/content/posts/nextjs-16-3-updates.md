---
title: Next.js 16.3のアップデート内容まとめ
description: 2026年8月にリリースされたNext.js 16.3の変更点を整理します。Turbopackのメモリ削減とビルドキャッシュ、TypeScript 7対応、catchError・root params・import.meta.globの新API、opt-inのInstant Navigations、そして同月のセキュリティリリース（Critical 2件）まで。
pubDate: 2026-08-29
tags: [Next.js, React, TypeScript, セキュリティ]
draft: false
---

## はじめに

2026年8月3日にNext.js 16.3が出ました！16.0が去年の11月なので、そこから数えていちばん大きい更新になります。さらに8月25日にはCritical 2件のセキュリティリリースもあり、この2つは両方追いかけないと危ないやつです。

この記事では、16.3の変更点を「上げるだけで効くもの」「新しく増えたAPI」「opt-inのInstant Navigations」「experimental」の4つに分けて整理して、最後にセキュリティリリースも確認します。

## 上げるだけで効くもの

まずはアプリケーションコードを一切触らずに効いてくるものから。

| 項目 | 内容 |
|---|---|
| devのメモリ削減 | 長時間の`next dev`で最大90%減 |
| ビルド高速化 | CIの再ビルドが最大5.5倍速 |
| 型チェック高速化 | `next build`でTypeScript 7が使える |
| SSR高速化 | 負荷時に最大22%多くのリクエストをさばける |
| prefetchリクエスト削減 | 小さいprefetchを自動でまとめる |
| static assetのキャッシュ | immutableなassetをデプロイ跨ぎで再利用 |

### devのメモリ削減

Turbopackのdisk cache（16.1で入ったもの）と、新しく入ったmemory evictionが、どちらもデフォルトONになりました。

これにより、vercel.comのダッシュボードだと50ルートをコンパイルした時点のメモリがなんと 21.5GB → 2GB と、 **約90%減** になっています。いや極端すぎん！？

nextjs.org自体でも4,600MBが840MB。長く`next dev`を立ち上げっぱなしにするほど効くタイプの改善なので、体感しやすく嬉しいですね。

### ビルド高速化

同じdisk cacheが`next build`にも効くようになりました。こちらもデフォルトON。

Vercel社内で数ヶ月ドッグフーディングした結果として、nextjs.orgが 21秒 → 9.2秒、vercel.com/geistが 30秒 → 5.5秒 と出ています。キャッシュが効いた状態での数字なので、CIでキャッシュを永続化する設定とセットで考える話です。これまた極端な...。

### 型チェック高速化

先月出たTypeScript 7がそのまま使えます。ネイティブ移植版で、Goになったことで型チェックが10倍速いとされているやつです。

やることはローカルの依存を上げるだけ。

```bash
pnpm add -D typescript@^7
```

これで `next build` が勝手にそれを使ってくれます。

### SSR高速化

App Routerのレンダリング層が、web streamsからNode.jsのネイティブstreamsに置き換わりました。今までは両者の変換コストを毎回払っていたことになります。

ベンチマークでは負荷時のスループットが22%改善。これもコード変更なしで効きます。いやだから極端だな...。

## 新しく増えたAPI

3つあります！どれも「今まで回避策でやっていたこと」が正面から書けるようになった系です。

### catchError — retryできるerror boundary

`next/error`から`catchError`が生えました。

今までのReact error boundaryには2つ問題がありました。`notFound()`や`redirect()`を呼ぶコードと干渉すること、それとリセットできるのがクライアント側の状態だけで、レンダリングに失敗したServer Componentを再試行する手段がなかったことです。

```tsx
'use client';
import { catchError, type ErrorInfo } from 'next/error';

function ErrorFallback(props: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <div>
      <h2>{props.title}</h2>
      <p>{error.message}</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  );
}

export default catchError(ErrorFallback);
```

第2引数で受け取る`retry()`が今回の本体で、これを呼ぶとboundaryの子をfetchし直します。Server Componentの再レンダリングも含みます。データ取得が一時的にコケただけのケースを、ページ全体のリロードなしに拾えるようになりました。結構嬉しいかも。

### root params — 上位のparamsをprop drillingなしで取る

`app/[lang]/posts/[slug]/page.tsx`のような構成で、`lang`を深いところまで持っていくのが面倒でした。ルートレイアウトより上で定義されたparamsは実質グローバルなのに、propsとして手で降ろすしかなかったからです。

```tsx
import { lang } from 'next/root-params';

export default async function PostPage(props: PageProps<'/[lang]/posts/[slug]'>) {
  const { slug } = await props.params;
  const language = await lang();
  // ...
}
```

`next/root-params`から、パラメータ名と同じ名前の関数がexportされます。i18nみたいに共有ユーティリティや深い階層のコンポーネントが軒並み現在の言語を欲しがるケースで嬉しいやつです。`use cache`スコープの中でも動きます。これもなかなか使えそう。

ちなみに現状はServer Componentのみ対応で、route handlerとServer Actionは今後とのこと。

### import.meta.glob — Turbopackのglob import

Vite互換の`import.meta.glob`をTurbopackがサポートしました。

```tsx
const posts = import.meta.glob('./posts/*.md', { eager: true });
```

ローカルファイルを読むServer Componentで`fs`を直接叩くと、モジュールグラフに乗らないのでHMRが効きませんでした。globならバンドラが依存を把握するので、ファイルを足したり直したりした瞬間に反映されます。`.md`を読むなら`next.config.js`側にloaderの登録が要ります。

## Instant Navigations（opt-in）

ここからは`next.config.ts`にフラグを足して有効化するものです。

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
```

背景としては、Server Componentsによって「送るJSは減ったしウォーターフォールも消えたけど、ナビゲーションがSPAより遅く感じる」という状態が続いていました。SPAはリンクを押した瞬間にサーバーを待たずローディング状態を出せるからです。

Next.jsでも`loading.tsx`をルートごとに置けば同じことはできましたが、置き忘れると素直に遅くなるうえ、置き忘れたことに気づく手段がありませんでした。このあたりの話は、こっちの記事で話してます。

https://ashunar0.dev/posts/saas-spa-vs-nextjs

16.3では、動的UIを返すコンポーネント側がSuspenseでインラインにローディング状態を宣言するか、`'use cache'`で一部をprerender可能と印を付けるかを選べます。どちらの場合もNext.jsがそのUIを抽出してナビゲーション前にクライアントへ載せられる、という仕組みです。つまり、ローディング状態が「ルートごとのファイルに置くもの」から「コンポーネントから抽出できるもの」に変わりました。

この挙動は将来のメジャーでデフォルトになると明言されています。よき。

### Partial Prefetching

16.2までのprefetchは、`loading.tsx`で使い回せるシェルを定義するか、`<Link prefetch={true}>`でページ丸ごと取りに行くかの二択でした。粒度が荒いので、結果的にリンククリックでブロックされるアプリが多かったところです。

16.3ではどのルートのUIからでも使い回せるローディングシェルを抽出でき、`<Link prefetch={true}>`で「遷移先のどこまでを含めるか」を指定できます。

### Instant Insights

DevToolsに、instantでなかったナビゲーションを自動で検出するパネルが増えました。置き忘れに気づく手段がなかった問題に対する答えです。

検出されたものにはそれぞれ、選んだ修正方法をエージェントに教えるためのプロンプトが付いてきます。

### Navigation Inspector

Next.jsは開発中はprefetchを無効にするので、ユーザーが実際に見るローディングの見え方が確認しづらいという問題がありました。

Navigation Inspectorはページロードやクライアントサイド遷移をシェルの状態で一時停止させられるので、その瞬間の画面をそのまま目で見られます。

### ISRの改善

`generateStaticParams`でルートの一部だけをビルド時にprerenderしている場合、残りのページはこれまで「ローディングシェルは出るがprerenderされない」か「シェルなしで最初の訪問者を待たせる」かのどちらかでした。

16.3では、prerenderしていないページも初回訪問時にローディングシェルを即出しして、裏でprerenderに昇格します。2人目以降はキャッシュから完成品を受け取ります。

### instant() — Playwrightテストヘルパー

今日instantなページが、明日には遅くなっているというのがよくある壊れ方です。共有ヘッダーに`cookies()`を読むコンポーネントが足されてルート全体がリクエスト時レンダリングに落ちるとか、リファクタで`<Suspense>`の位置がずれて一部がブロックし始めるとか。

`@next/playwright`の`instant()`は、「ネットワークを待たずに何が見えているべきか」をアサートできます。

```ts
import { expect, test } from '@playwright/test';
import { instant } from '@next/playwright';

test('product title is available immediately', async ({ page }) => {
  await page.goto('/products/shoes');

  await instant(page, async () => {
    await page.click('a[href="/products/hats"]');
    await expect(page.locator('h1')).toContainText('Baseball Cap');
    await expect(page.getByText('Checking inventory...')).toBeVisible();
  });

  await expect(page.getByText('12 in stock')).toBeVisible();
});
```

原因が何であれ、instantに見えていたUIが見えなくなればテストが落ちます。パフォーマンスの回帰を、速度の数値ではなく「何が見えるか」で固定できるのは結構いいと思います。

## experimental

2つあります。

### Rust版React Compiler

React CompilerはこれまでBabel経由でNode.js上を通っていました。それをTurbopackの中で直接動かすRust移植版です。

```ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
};
```

v0での計測で、`next dev`からページが出るまでがcoldで34%、warmで46%短縮。ただしこれはBabelを完全に外した前提の数字で、他の変換でBabelが残っているなら効きは小さくなります。

### useOffline — ネットワーク断への耐性

`experimental.useOffline`を有効にすると、ネットワークが切れたときにsoft navigation・データ取得・Server Actionがthrowせず、pendingのまま保持されて復帰時にリトライされます。

`useOffline`フックで状態を出せます。

```tsx
'use client';
import { useOffline } from 'next/offline';

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;
  return <div>You're offline. Retrying when you reconnect.</div>;
}
```

Partial Prefetchingがルートのシェルをクライアントに載せているので、prefetch済みのルートならオフラインで遷移してもシェルは描画されて、再接続後にデータが流れ込んできます。この2つはセットで考えるものです。

## 8月のセキュリティリリース

16.3の機能とは別で、8月25日にセキュリティリリースが出ています。**Criticalが2件**で、どちらも重要です。

パッチは**v16.3.3**（Active LTS）と**v15.5.24**（Maintenance LTS）です。

```bash
npm install next@16.3.3   # 16.3系
npm install next@15.5.24  # 15.5系
```

### AVIF経由のRCE（Critical）

`sharp`が内部で使っているlibheifの脆弱性で、攻撃者が用意したAVIF画像をImage Optimization APIが最適化すると、認証なしでリモートコード実行に至ります。

対応が特殊で、**パッチ版はAVIF最適化そのものを無効化しています**。upstream側の修正が降りてくるまでの措置とのこと。つまり上げると画像最適化の挙動が変わるので、AVIFを配信しているなら把握しておく必要があります。

### Windowsホストでの RCE（CVE-2026-75604、Critical）

Pages RouterとApp Routerを併用していて、かつCache Componentsを使っていないアプリが対象です。Next.jsサーバーがWindowsファイルシステム上で動いている場合に、認証なしのリモートコード実行が成立します。

LinuxとmacOSは影響を受けません。そしてWindowsホストには**回避策が存在しない**と明記されているので、該当するならパッチを当てるしかありません。

## まとめ

16.3は、上げるだけで効く部分（メモリ・ビルド・SSR）とopt-inの部分（Instant Navigations）がはっきり分かれている構成でした。前者は今すぐでいいと思います。後者は将来デフォルト化が宣言されているので、`cacheComponents`を有効にして何が壊れるかだけでも見ておくと、次のメジャーが楽になりそうです。

セキュリティのほうは16.3の機能とは無関係に効いてくるので、Windowsホストで動かしているなら最優先、そうでなくてもAVIF最適化の挙動変化とセットで16.3.3に上げるのが良さそうです。

## 参考

- [Next.js 16.3 | Next.js](https://nextjs.org/blog/next-16-3)
- [Instant Navigations | Next.js](https://nextjs.org/blog/next-16-3-instant-navigations)
- [Turbopack: up to 90% less memory | Next.js](https://nextjs.org/blog/next-16-3-turbopack)
- [August 2026 Security Release | Next.js](https://nextjs.org/blog/august-2026-security-release)
- [GHSA-2xp9-vwfh-vxw4（AVIF / libheif）](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
- [GHSA-p293-qw3h-jr36 / CVE-2026-75604（Windows）](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- [next/root-params | Next.js Docs](https://nextjs.org/docs/app/api-reference/functions/next-root-params)
- [Instant Navigation ガイド | Next.js Docs](https://nextjs.org/docs/app/guides/instant-navigation)
