---
title: XのWebアプリが変わったらしいけど、Fastifyなんだ
description: X が Web アプリをゼロから作り直したという記事を読みました。技術スタックを見て最初に思ったのは「Fastify なんだ」でした。記事に選んだ理由は書かれていないので、なぜ Fastify なのかを自分なりに考えてみます。
pubDate: 2026-11-07
tags: [Fastify, Node.js, TypeScript]
draft: false
---

## はじめに

X の Web アプリが、ゼロから作り直されたらしいです。バックエンドではなく、フロントエンドの話です。

2026 年 11 月 4 日に、X のブログに記事が出ていました。遅い回線だと最初の投稿が出るまで 22 秒以上 → 2.7 秒になったそうです（計測環境での数字です）。快適になったっぽいですね。ログイン後の画面はまだ国ごとに切り替えている途中ですが、ログアウト状態の x.com はもう新しいほうで動いています。

https://blog.x.com/en/engineering/rebuilding-the-global-town-square-from-scratch

で、技術スタックはというと、こんな感じです。

- Vite
- React
- Fastify
- Relay と GraphQL
- XDS（Base UI と Tailwind CSS の上に作った UI ライブラリ）
- TypeScript と tsrs

ふむふむ。

Fastify なんだ！？

めずらしい。Fastify を採用しているプロダクトを今まで知らなかったので、ここで　名前を聞くとは思いませんでした。

じゃあなんで Fastify を選んだのかというと、記事のどこにも書いてありません。なのでこの記事では、X がなぜ Fastify を選んだのかを勝手に考えてみます。

## そもそも Fastify って？

Fastify は、Node.js で Web サーバーを書くためのフレームワークです。Express 系です。Hono とか Elysia とか H3 とかの仲間みたいな感じです。リクエストを受けて、URL ごとに処理を振り分けて、レスポンスを返します。

```js
import Fastify from 'fastify'

const fastify = Fastify({ logger: true })

fastify.get('/', (request, reply) => {
  reply.send({ hello: 'world' })
})

await fastify.listen({ port: 3000 })
```

主な特徴はこんな感じです。

- **Node.js に特化している：** Hono はエッジ、Elysia は Bun と、それぞれ得意な場所がありますが、Fastify の場合はそれが Node.js です。README にも「Fast and low overhead web framework, for Node.js」と書いてあります。`request.raw` や `reply.raw` で、Node.js の `req` / `res` をそのまま触れます。
- **JSON Schema を関数にコンパイルする：** スキーマを先に高速な関数へ変換しておいて、入力の検証とレスポンスの変換を速くしています。
- **プラグインで影響範囲を区切れる：** プラグインの中で足したフックや機能は、そのプラグインの外には漏れません。
- **ログが最初から組み込まれている：** `Fastify({ logger: true })` と書くだけで、Pino というロガーで JSON のログが出ます。

## なんで Fastify なのか

X では、新しいアプリへのリクエストを全部 Fastify が受けて、React で作った HTML を返しています。いわゆる SSR です。

でも SSR するなら、React Router や TanStack Start でいいんじゃないの？と思うのですが、X のルーターは自前です。React Router でも作れそうなのに、なんで自前なのかはよくわかりませんでした。元の記事にも、既存のルーターではできなかったとは書かれていません。

ただ、自前で組むとなると、リクエストを受けて HTML を返すサーバーも自分で用意することになります。そこで Fastify が出てきます。

x.com は、2017 年の Twitter Lite のころから Node.js のサーバーで動いてきました。今回はバンドラも描画の仕方もごっそり変えていますが、実行環境は Node.js のままです。昔から Node.js で、今後も変わらないなら、Node.js に特化した Fastify で、まあそれでいいんだろうなと。

ただ、Node.js のままでいいなら、もともとの Express のままという選択肢もあったはずです。公式サイトのベンチマークを見ても、Fastify は Express の約 1.3 倍で、速さがめっちゃ変わるわけではありません。

じゃあ、作り直すついでに Express から替えたのはなんでなのか。これも書かれていませんが、Express も Fastify も Node.js の `req` / `res` の上に作られていて、考え方も近いです。もともと Express だったから、その延長で選んだのかもしれません。たぶんものすごい深い理由があるわけじゃなさそうです。

## ちょこっと tsrs

もう 1 つ面白いなと思ったのが、型チェックに tsrs を使っていることです。

tsrs は、TypeScript のコンパイラを Rust に移植したものです。詳しくは前に記事を書きました。

https://ashunar0.dev/posts/tsrs-rust-port/

tsrs が発表されたのは 2026 年 10 月 20 日で、X の記事が出るわずか 2 週間前です。まだ実験段階なのに、もう X で使われているんですね。早速実戦投入されているということで、今後がとても楽しみです。

## おわりに

結局、そんなにちゃんとした理由はわかりませんでした！

2017 年当時は React Router もまだ今ほど発展していなかったので、Express で自分たちで作って、それをそのまま引き継いだのかな、くらいに勝手に思っています（違ったらすみません）。

ただ、フロントエンドのサーバーに Fastify みたいなものを使うという発想がそもそもなかったので、そういうのもありなんだなと思いました。ちょっと Hono で試してみても面白いかも。

## 参考

- [Rebuilding the global town square from scratch（X Engineering）](https://blog.x.com/en/engineering/rebuilding-the-global-town-square-from-scratch)
- [Fastify 公式サイト](https://fastify.dev/)
- [fastify/fastify（GitHub）](https://github.com/fastify/fastify)
