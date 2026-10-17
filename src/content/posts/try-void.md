---
title: Void を触ってみた。もう全部これでよくね？
description: ついに出た VoidZero の Void で、記事投稿サービス（RealWorld 相当）を作ってみました。App Router の書き味を Vite で使えること、API が増えても型チェックが重くならないこと、クライアントでサーバーの状態を持たなくていいこと、AI が書きやすい作りになっていることを紹介します。
pubDate: 2026-10-17
tags: [Void, Hono, React]
draft: false
---

## はじめに

ついに、ついに Void が出ました！！（大歓喜）

発表されてからずっと待っていたので、出たと知ってすぐに触ってみました。

待っていたのは、Void が TS 版の Rails みたいになってくれるんじゃないか、という期待があったからです。自分でもアプリの書き方の規約を作ろうとしていたので、その一部を Void がフレームワークとして引き受けてくれるんじゃないかなと。

題材は、記事を投稿できるサービス（RealWorld の Conduit 相当）です。登録・ログイン、記事の投稿と編集、いいね、コメント、フォローまで作りました。

https://github.com/ashunar0/void-tutorial

結論、めっちゃいいじゃん！でした。この記事では、個人的に「いいじゃん！」と思ったポイントを紹介します。

## Void ってなぁに

Void は、VoidZero（2026 年 6 月に Cloudflare が買収）が作っているフルスタックの基盤です。キャッチコピーは「*Build with Vite. Deploy with Void.*」です。

ざっくり言うと、Vite で作ったアプリを Cloudflare に載せるところまで、まるっと面倒を見てくれるやつです。中身は Hono・Drizzle・Better Auth で、画面は React・Vue・Svelte・Solid から選べます。

基本は Cloudflare に乗っかる前提で作られていて、乗っかってしまえば、DB の用意からデプロイまで `void deploy` でまるっと終わります。めちゃ楽。

とはいえ、Cloudflare 以外の道もちゃんと用意されています。DB は D1 のほかに PostgreSQL や MySQL も選べますし、設定の `target` を変えれば Node.js・Bun・Deno 向けのサーバーとしてビルドして、好きな場所で動かすこともできます（その場合、D1 や KV のような Cloudflare の機能は使えません）。

## いいじゃん！なポイント

### App Router の書き味を Vite で使える

App Router みたいに書きたいなら Next.js、というのがこれまでの定番でした。Void なら、それが Vite のまま書けちゃいます。

```
pages/
  index.tsx                       /
  (auth)/login/index.tsx          /login
  article/[slug]/index.tsx        /article/:slug
routes/
  api/profiles/[username]/follow/index.ts    /api/profiles/:username/follow
```

API も `routes/` に置いて、メソッド名で export するだけです。

```ts
export const PUT = defineHandler(async (c) => { /* フォローする */ });
export const DELETE = defineHandler(async (c) => { /* フォローを外す */ });
```

Next.js の ディレクトリベースルーティングだけはめっちゃ体験がいいなと思っていたので、これは素直に嬉しい。

### API が増えても型チェックが重くならない

これ、地味にめちゃくちゃ大事なポイントです。

Hono RPC は、ルートを 1 本のチェーンでつながないとクライアントに型が届きません。しかもルートを足すほど型が積み上がって、型チェックが重くなります（[前に書いた記事](/posts/hono-rpc-type-inference-and-orpc/)）。ここは Hono もトレードオフとして受け入れていた弱点でもありました。

Void ではこのチェーンから解放されます！型は `routes/` のファイルから URL ごとに生成されるので、いくら足しても積み上がりません。

じゃあ実際どれくらい違うのか、測ってみました。

| API の本数 | Void | Hono RPC |
|---|---|---|
| 100 | 14 万回（0.02 秒） | 95 万回（0.18 秒） |
| 300 | 26 万回（0.04 秒） | 431 万回（0.71 秒） |
| 500 | 38 万回（0.06 秒） | 999 万回（1.59 秒） |

数字は型の生成回数で、カッコ内が型チェックの時間です（TypeScript 7.0.2、0 本からの増分）。Hono 側をルーターに分けても、500 本で Void の 10 倍以上でした。かなりの差になりました。

### クライアントでサーバーの状態を持たなくていい

React でサーバーのデータを扱うと、`useEffect` で取ってきて、読み込み中とエラーを持って、変えたら取り直して……と、やることがたくさんあります。

Void では、この仕事がまるっとなくなります。データは画面の隣の `index.server.ts` の loader が用意して、props で渡してくれます。クライアントは受け取って表示するだけ！

```tsx
// pages/profile/[username]/index.server.ts
export const loader = defineHandler(async (c) => {
  const user = await findUserByName(c.req.param("username"));
  return { profile: { username: user.name } };
});

// pages/profile/[username]/index.tsx
export default function ProfilePage({ profile }: Props) {
  return <h1>@{profile.username}</h1>;
}
```

データを変えたら `router.refresh()` を呼ぶだけで、loader がもう一度動いて props が差し替わります。フォームの送信中やエラーの表示も、`useForm` が引き受けてくれます。

……あれ？これって Inertia と同じじゃん！

と思ってドキュメントを読み返したら、やっぱり書いてありました（笑）

> A page's server loader returns data, and the component receives it as props. This pattern is inspired by [Inertia.js](https://inertiajs.com/) and works with React, Vue, Svelte, and Solid.

Inertia は設計としてとても綺麗だなぁと思っていたので、この思想が取り入れられているのは激アツです。

### AI が書きやすいように作られている

これはこれからの時代に非常に大切な視点です。Voidは、AI に書かせることをめちゃめちゃ意識して作られています。

まず、`node_modules/void/docs/` に、使っている版のドキュメントがまるごと入っています。AI はまだ Void をほぼ知らないので、ふつうは推測で書いて動かない……となりがちなところですが、Void なら AI が手元の説明書を読んでから書くので、今回は一度もそれが起きませんでした。

`AGENTS.md` の中身も、「`node_modules/void/docs/` を読んでねー」だけです。中身はパッケージ側にあるので、Void を上げても内容が古くなることがありません。

ほかにも、気配りがたくさんあります。

- import から要るものを読み取るので、wrangler の設定を書かなくて済みます
- `.void/` に型が生成されるので、AI が 1 歩ごとに `tsc` で確かめられます
- テーブルを消すマイグレーションには、`-- void:allow-destructive` という止めがあります
- `void db reset --yes` のように、対話なしで流せるコマンドが多いです

AI に書かせるのが当たり前の今、ここまで考えてあるのは最高です！

## おわりに

Void、触ってみたら「いいじゃん！」の連続でした。

App Router の書き味を Vite のまま使えて、API をいくら増やしても型チェックは軽いままです。サーバーの状態はクライアントで持たなくてよくて、しかも AI が迷わず書けるように作り込まれています。

AI に書かせる前提でフレームワークを選ぶなら、Void はかなり有力な選択肢になりそうです。今回作ったものは [void-tutorial](https://github.com/ashunar0/void-tutorial) に置いてあるので、気になった人はぜひ触ってみてください！
