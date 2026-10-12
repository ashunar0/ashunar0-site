---
title: Deno はなぜ Cloudflare に合流したのか、Durable Objects から読み解く
description: Deno のチームが Cloudflare に移り、Deno ランタイムは 1 年後に開発を終えます。サーバーを増やしても壊れない Durable Objects の書き方、AI エージェントの居場所、ランタイム単独の事業の難しさの 3 つから、その理由を整理します。
pubDate: 2026-10-12
tags: [Cloudflare, Durable Objects, Deno, AIエージェント]
draft: false
---

## はじめに

2026 年 10 月 9 日、Deno のチームが Cloudflare に移ることが発表されました。Deno ランタイムは 1 年後に開発を終えて、チームは Workers と Durable Objects を Cloudflare の外でも動かせるようにする仕事に移ります。正直めっちゃびっくりしました。

https://deno.com/blog/cloudflare

https://blog.cloudflare.com/deno-joins-cloudflare/

最初は Cloudflare が常駐型のランタイムに手を広げる話かと思ったのですが、読んでみると Deno の人たちが Workers の側に来る話でした。Node.js と Deno を作った Ryan Dahl さんが、自分のランタイムを畳んでまで Workers を選んだ理由が気になったので、調べて整理してみました。

この記事では、その理由を 3 つの方向から自分なりに考察してみます。

## 何が起きたのか

Deno 側の発表では、プロダクトごとの今後が次のように書かれています。

| 対象 | 今後 |
|---|---|
| Deno ランタイム | あと 1 年は毎月リリースを出し、その後は開発を終える。OSS としては残る |
| Deno Deploy | あと 6 か月動かしてから終了。有料ユーザーには Workers への移行支援がある |
| JSR | 続く。インフラは Cloudflare に移る |
| rusty_v8 | サポートを続け、workerd に組み込む方向 |

Deno ランタイムについては、原文だと次のとおりです。

> We will support the Deno runtime for another year with monthly releases containing bug fixes and security updates. After that year we will end our development of the Deno runtime.

移ったチームが取り組むのは、workerd と celld の統合です。workerd は Cloudflare Workers のランタイムで、OSS として公開されています。celld は Ryan さんが 2026 年 8 月に出したソフトで、Durable Objects を自分のサーバー上で分散して動かせます。Rust 製のバイナリ 1 つで動き、外部に必要なのはオブジェクトストレージだけです。

workerd だけでも Durable Objects は動きますが、1 台のマシンの中でしか動かせません。Cloudflare の記事でも、これが Workers を自前で本番運用するときの大きな障害だったと書かれています。celld を workerd に取り込むと、Workers と Durable Objects を自分のサーバーでも本番の規模で動かせるようになります。

Deno を作っていた人たちは、Workers の書き方を Cloudflare の外に広げる仕事に移る、ということですね。

## Ryan は Durable Objects のどこに惚れたのか

Ryan さんは X への投稿で、Workers の書き方について「スケールすることを強制する（really force scalability）」と書いています。これが何を指しているのか、チャットルームを例に見ていきます。

### Node や Deno では状態をメモリに置く

Node や Deno でチャットを作ると、サーバーのプロセスがずっと動いていて、部屋ごとの接続をメモリに持つ形になります。

```ts
const rooms = new Map<string, Set<WebSocket>>()

// メッセージが来たら、同じ部屋の全員に送る
rooms.get(roomId)?.forEach((ws) => ws.send(msg))
```

サーバーが 1 台なら、これで問題なく動きます。

### サーバーを 2 台にすると壊れる

アクセスが増えたり、落ちたときの保険がほしくなったりすると、サーバーを 2 台以上に増やしてロードバランサーで振り分けます。

メッセージの履歴は DB に入っているので、どのサーバーからでも読めます。困るのは WebSocket の接続です。接続は「このマシンとこのブラウザがつながっている」という生きた回線なので、DB には入れられず、どれか 1 台のメモリにしか置けません。

A さんが 1 台目、B さんが 2 台目につながると、`rooms` が別々のメモリにあるので、同じ部屋にいても A さんの発言は B さんに届きません。直すには、間に Redis などを挟んで、サーバー同士でメッセージを中継することになります。

```
A -> server1 -> Redis -> server1, server2 -> B
```

サーバーと Redis と DB を噛み合わせる構成になって、1 台のときのコードはほぼ書き直しです。

### Durable Objects では部屋ごとに置き場を作る

Workers と Durable Objects では、部屋ごとに専用の置き場を 1 つ作って、接続も履歴もそこに集めます。Worker 自体は状態を持たず、リクエストを部屋の Durable Object に渡すだけです。

```ts
// Worker：部屋の Durable Object に渡すだけ
const room = env.CHAT_ROOM.getByName(roomId)
return room.fetch(request)
```

```ts
// Durable Object：この部屋の接続と履歴はここにだけある
export class ChatRoom extends DurableObject {
  // WebSocket を持って全員に配る。履歴は中の SQLite に保存する
}
```

同じ名前の Durable Object は世界に 1 つしかないので、A さんと B さんがどこからつないでも同じ部屋に届きます。Redis は要りません。部屋が 1 つでも 100 万でも、コードは同じです。

Durable Objects の仕組みそのものは、以前の記事で詳しく書きました。

https://ashunar0.dev/posts/durable-objects/

### メモリに状態を置く書き方ができない

Workers では、さっきの `rooms` のようにメモリに置いた状態を、リクエストをまたいで当てにできません。状態は Durable Objects に入れるしかないので、最初から台数を増やしても壊れない形でしか書けないんです。Ryan さんの言う「スケールすることを強制する」は、このことだと思います。

Deno は Node より書きやすいランタイムでしたが、プロセスがずっと動いてメモリに状態を置く、という書き方は Node と同じです。サーバーを増やしたときに書き直しになる問題は、Deno でもそのまま残ります。

差が出るのは、チャットや共同編集のように、複数の人が同じ状態をリアルタイムに触るものです。投稿一覧やログインのような普通の Web アプリは、状態がすべて DB にあるので、Node でもサーバーを増やせば済みます。

## 勝手に動くエージェントの居場所

Ryan さんの投稿には、AI エージェントの話も出てきます。

> The number of agents is exploding and I don't think they all need a Linux VM. A much more lightweight Durable Object would suffice for many applications.

エージェントの数は爆発的に増えているけど、そのすべてに Linux の VM が要るとは思わない、多くの用途はもっと軽い Durable Object で足りるはず、という主張です。

### モデルは何も覚えていない

この話は、モデルとエージェントを分けて考えると分かりやすいです。Claude API を呼ぶと、モデルは Anthropic のサーバーで動きます。ただ、モデルは前の会話を覚えていません。呼ぶたびに、会話の履歴を全部思い出す必要があります。

```ts
// 履歴を持っているのは呼ぶ側
const history: Message[] = []

async function onUserMessage(text: string) {
  history.push({ role: "user", content: text })
  const reply = await callClaude(history) // 毎回、履歴を丸ごと渡す
  history.push(reply)
  return reply
}
```

モデルは渡された履歴から次の返事を計算するだけです。履歴を持つのも、モデルに言われた道具（DB を引く、メールを送る）を使うのも、呼ぶ側のプログラムです。この記事では、この呼ぶ側をエージェントと呼びます。

### 呼び出すだけなら DB で十分

人が話しかけて、その場で返事をもらうだけのチャットボットなら、Durable Objects は要りません。メッセージが来たら DB から履歴を読んで、モデルに渡して、返事を保存すれば済みます。

### 勝手に動くエージェントには Durable Objects が合う

Durable Objects が合うのは、Grok bot や、かつて流行った OpenClaw のように、呼ばれなくても自分で自律的に動くエージェントです。Discord で話せる AI 秘書で考えてみます。

> 自分：明日 10 時に歯医者。前の日の夜に教えて
> （21 時）秘書：明日 10 時に歯医者だよ
> 自分：やっぱ 11 時にずれた
> 秘書：歯医者を 11 時に変えといたよ

この秘書は、予定を覚えておく必要があります。覚えていないと、「11 時にずれた」が何の話か分かりません。さらに、21 時になったら自分から起きて連絡する必要があります。それ以外の時間は、ずっと寝ています。

DB だけで作ると、自分から起きるところでつまずきます。DB は自分から動けないので、cron で毎分「今通知すべき人はいるか」を全員分探しに行く仕組みを別に作ることになります。

秘書 1 人を Durable Object 1 つにすると、必要なものが 1 か所にそろいます。予定は中の SQLite に置けて、21 時の目覚ましは Alarm で Durable Object ごとに持てます。動いていない間はメモリから追い出されるので、料金もほとんどかかりません（保存しているデータの分はかかります）。

### マシン 1 台ずつだと重すぎる

Clawdbot が流行ったとき、24 時間動かすために Mac mini を買う人がたくさんいました。自分用に 1 つ動かすなら、それで十分です。でも、同じものをサービスとして 10 万人に出すと、ほとんど寝ているエージェントのために 10 万台のマシンを動かし続けることになります。Ryan さんが「Linux VM は要らない」と言っているのは、この重さのことだと思います。

ただ、全部を Durable Objects に置けるわけではありません。Durable Objects では Linux のコマンドを実行できないので、シェルを叩いたりコードを実行したりするエージェントには、隔離された実行環境が別に要ります。Ryan さんも "many applications"（多くの用途）と書いていて、すべてとは言っていません。記憶や段取りは Durable Objects に置いて、コードを実行するときだけサンドボックスを呼ぶ、という組み合わせになりそうです。

Ryan さんは投稿の最後で、Durable Objects で大量のエージェントを自前で動かしたい人に連絡を呼びかけています。celld が workerd に入れば、こうしたエージェントを自社のサーバーでも大量に動かせるようになります。

## ランタイム単独では続けにくかった

ここまでは技術の話でしたが、Deno を単独で続ける道そのものが細くなっていた、という事情もあったと思います。

### Node が売りを取り込んだ

Deno の売りは、TS がそのまま動くこと、権限を明示しないとファイルやネットワークに触れない安全さ、fetch などの Web 標準の API でした。Bun の売りは速さと、ランタイム、パッケージマネージャー、バンドラー、テストランナーが全部入っていることです。

この数年で、Node はこれらを次々に取り込みました。fetch、テストランナー、ファイル変更の監視、`.env` の読み込み、権限モデル、そして TS の型を剥がしてそのまま実行する機能です。今は `node main.ts` で TS が動きます。

Deno のほうも、2024 年の Deno 2 で npm や Node との互換に大きく寄せました。Node のパッケージが使えないと、誰も乗り換えてくれないからです。結果として 3 つとも同じような場所に寄っていき、動いている Node のアプリをわざわざ書き換えるほどの差はなくなりました。

### ランタイムは売れない

Deno と Bun は、どちらも投資を受けた会社が作っています。Node が財団で運営されているのとは違って、いつかはお金を回収しないといけません。

ところが、ランタイムは無料の OSS なので、それ自体ではお金になりません。Deno は Deno Deploy というホスティングで稼ごうとしましたが、相手は Vercel や Cloudflare です。

Node は使う人が多すぎて、思い切った変更を入れにくいランタイムです。Deno は、Node では試せない考え方を形にして見せる場所になっていて、そこで良かったものが Node に取り込まれていきました。Ryan さんは本気で Node を置き換えるつもりだったと思いますが、結果としては実質的に、JavaScript の標準を前に進める実験場の役割を果たしたのだと思います。そういう意味では、その存在には確かな価値があったと言えるでしょう。

### Bun は続き、Deno は止まる

Node の対抗として出てきたランタイムは、2 つとも大きな会社に入りました。Bun は 2025 年 12 月に Anthropic が買収しています。

https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone

ただ、その後が違います。Claude Code は Bun の上で動いていて、Anthropic にとって Bun は自社製品の土台です。Bun そのものが必要なので、MIT ライセンスのまま開発が続きます。

一方の Cloudflare には、ランタイムならもう workerd があります。欲しかったのは Deno を作った人たちと celld なので、Deno ランタイムは止まります。

Cloudflare がこの 1 年で迎えたチームと並べると、違いがよく分かります。

| 買収 | 時期 | 技術 | 人 |
|---|---|---|---|
| Astro | 2026 年 1 月 | MIT のまま続く | 同じ Astro を作り続ける |
| VoidZero | 2026 年 6 月 | Vite などは MIT のまま続く | Evan You さんたちが引き続き舵を取る |
| Deno | 2026 年 10 月 | ランタイムは止まる。JSR は続く | workerd を作る側に回る |

Astro と VoidZero は、人も技術もコミュニティも丸ごとです。Deno だけは、ランタイムを止めて人を別の仕事に回しています。3 つの中で、一番「人」が目当ての合流だと思います。

## おわりに

今回の合流で広がるのは Durable Objects です。Workers を基本にして、状態をまとめるところだけ Durable Objects に任せる、という今の形のまま、Cloudflare の外でも分散して動かせるようになります。

Ryan さんから見ると、Deno を磨き続けても「Node より少し良いランタイム」にとどまります。それより、台数を増やしても壊れない書き方や、AI エージェントの軽い居場所を Cloudflare の外にも広げるほうが大きな仕事だ、と判断したんだと思います。Node を作り、Deno を作った人が、自分のものより良い形を見つけてそっちに移った、という出来事でした。

celld と workerd の統合は、数か月以内に詳しい発表があるそうです。この合流によってDurable Objects や Workers がどう進化するのか、今からとても楽しみです。

## 参考

- https://deno.com/blog/cloudflare
- https://blog.cloudflare.com/deno-joins-cloudflare/
- https://www.anthropic.com/news/anthropic-acquires-bun-as-claude-code-reaches-usd1b-milestone
- https://ashunar0.dev/posts/durable-objects/
- https://ashunar0.dev/posts/durable-objects-2/
