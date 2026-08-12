---
title: Cloudflare から AI エージェントのためのブラウザ「Kitesurf」が登場！
description: 人間が画面を見るための機能を捨て去った新ブラウザ。ページごとに立つ isolate、状態を持たない描画係、eval だけが別扱いになる理由、Chromium と比べて何が速く何が遅いか。置き換えではなく選択肢が 1 つ増えた話として読む。
pubDate: 2026-08-12
tags: [Cloudflare, Kitesurf, ブラウザ自動化]
draft: false
---

## はじめに

2026 年 8 月 6 日に Cloudflare が新たなブラウザ「Kitesurf」を発表しました。人間が使うためのものではなく、AI エージェントが使うために作られています。

特徴的なのは実装方法で、Chromium をヘッドレスで動かしているのではありません。Rust でブラウザエンジンを書き、WebAssembly にコンパイルし、Cloudflare Workers の V8 isolate の中で動かしています。ブラウザが Workers の上に載っている、という構造です。

公開されているもの：

- 発表記事 https://blog.cloudflare.com/kitesurf/
- ドキュメント https://developers.cloudflare.com/browser-run/kitesurf/
- 試せる場所 https://kitesurf.cloudflare.app/

ベータ期間中は無料です（アカウントごとの上限あり）。将来的にはソースを公開し、利用者のアカウント上で動かせるようにする予定とされています。

## 1. 人間にしかいらないものを捨て去った

ブラウザ自動化はこれまで Chromium をヘッドレスで回すのが定石でした。ただ Chromium は「人間が画面を見る」ための機能を全部背負っています。タブ、テーマ、拡張、GPU 合成、ピクセル単位まで正確な描画。エージェントはそのどれも必要としません。

Kitesurf はそれらを捨て去って、代わりに以下を優先します。

- 取り出した内容のトークン数と、コンテキスト長に収まるか
- 同時に何セッション立てられるか
- 費用

「人間向けの機能を全部落として、その分の軽さを取る」という割り切りが設計の出発点になっています。

この割り切りは数字にそのまま出ます（後述）。CPU とメモリは数分の一になり、その代わり 1 リクエストあたりの実時間は遅くなります。同時実行数で効くタイプの最適化です。

## 2. 構成

3 つのコンポーネントに分かれています。

| コンポーネント | 役割 | 状態 |
|---|---|---|
| Engine | 外向きの窓口。Chrome DevTools Protocol の WebSocket と REST を喋る。セッション状態を持つ | 持つ |
| PageScript | ページ 1 枚ごとに 1 isolate。HTML 解析、DOM 構築、JavaScript 実行 | ページごと |
| PageRenderer | 計算済みのページから実際のピクセルを作る | 持たない |

状態を持っているのは Engine だけで、他は状態を持ちません。これが後で効いてきます。

### PageScript — ページごとに isolate を立てる

ページ 1 枚、あるいは別プロセス扱いの iframe 1 つにつき、Dynamic Workers で長寿命の isolate を 1 つ立てます。それぞれの isolate は綺麗な `globalThis` と、そのページ専用の document を持ちます。

Chromium でいうところの「サイトごとにプロセスを分ける」を、プロセスではなく isolate でやっている形です。isolate はプロセスよりはるかに軽いので、同じメモリで立てられる数が変わってきます。

### PageRenderer — 使い捨てにできる描画係

Engine が Workers の RPC で `renderFrame()` を呼び、PageRenderer が PageScript からページの内容（記事中では「シーン」と呼ばれています）を取り、静的アセットから字体や画像を取り、ピクセルの列に焼いて JPEG / PNG / PDF として返します。

ここで効いてくるのが「PageRenderer は状態を持たない」ことです。持っているのは捨ててよいキャッシュだけなので、呼び出しが失敗したり固まったりしたら、Engine は PageRenderer を殺して立て直せます。描画が 1 回ごとに完結していて、やり直しが安全になっています。

## 3. DOM をどう作っているか

HTML と CSS の解析は、Rust で書かれた既存の部品を WebAssembly にして使っています。

- **Blitz** … Rust 製のモジュール式レンダリングエンジン。DOM の構築を担当
- **Stylo** … Firefox の CSS エンジン。そのまま流用

`<script>` や `.wasm` は、同じ PageScript の isolate の中で実行されます。ここはブラウザを自作しているというより、Workers がもともと持っている V8 をそのまま JavaScript 実行系として使っている、という形です。

### eval だけが特殊

ところが 1 箇所詰まるところがあります。Workers はセキュリティ上の理由で `eval` を提供していません。ブラウザとしては `eval` が動かないと困ります。

そこで **Boa** という Rust 製の ECMAScript 実装を持ち込み、`eval` の中身だけそちらでコンパイル・実行しています。記事の中でも「ランタイムの上でランタイムを動かしている」と認めていて、最適ではないが動く、という位置づけです。Workers 側が将来 `eval` を提供できるようになれば Boa は外す、と書かれています。

自作エンジンが実行環境の制約に当たったときの逃げ方として、素直で面白い部分です。

## 4. 描画

ラスタライズは Blitz の一部である **blitz-paint** が担当します。文字については **Parley** が字形への変換、字体の選択、行の折り返しを行います。

GPU は使いません。ソフトウェアで焼きます。ここが後述する「実時間で遅い」の主要因です。

## 5. ネットワーク隔離

外に出る通信は **SandboxOutbound** という Worker 1 つだけを通ります。他のコンポーネントは直接インターネットに触れません。これは行儀の約束ではなく、Dynamic Workers の側で強制されています。

SandboxOutbound がやること：

- CORS の強制
- ブラウザらしい形のヘッダーを足す
- 応答の絞り込み
- ページごとに Cookie の入れ物を分ける
- 方針に反する通信には 403 を返す

前提は「読み込むページはすべて信用できない入力であり、セッションは毎回まっさらから始まる」です。各コンポーネントには必要最小限のものしか渡しません。Workers がもともと持っている隔離の上に、アプリケーション側の強制を重ねている構造です。

例外の扱いについての方針も明快でした。

> どの失敗も、空のフレームか欠けた要素に落とす。セッションを殺してはいけない。境界ごとに障害を捕まえ、安全で空なものを既定にし、原因が追える程度には記録する。

## 6. 性能

14 個の URL を対象にした中央値です。比較対象は温めた状態の Chromium。

| 項目 | Kitesurf | Chromium | 比 |
|---|---|---|---|
| CPU（スクリーンショット） | 380 ms | 1,173 ms | 3.1 倍少ない |
| CPU（HTML 抽出） | 229 ms | 877 ms | 3.8 倍少ない |
| メモリ（スクリーンショット） | 57.8 MiB | 271.0 MiB | 4.7 倍少ない |
| メモリ（HTML 抽出） | 39.4 MiB | 273.7 MiB | 7.0 倍少ない |
| 実時間（スクリーンショット） | 1,148 ms | 637 ms | 1.8 倍遅い |
| 実時間（HTML 抽出） | 820 ms | 472 ms | 1.7 倍遅い |

実時間で負けている理由は、JIT の有無と、ソフトウェアでのラスタライズおよび JPEG / PNG への符号化です。記事でも「差の大半はラスタライズと符号化から来ている」と説明されています。

読み方としては、**1 本を速く終わらせる話ではなく、同じ資源で何本並べられるかの話**です。メモリが 7 分の 1 なら、同じ機械で 7 倍のセッションが載ります。エージェントの仕事は突発的に何十本も同時に走るので、そちらの効き方のほうが実用上は大きい、という賭けになっています。

Web Platform Tests は 235,000 件以上のサブテストを通過。内訳は DOM 97%、HTML 96%、Selection 99%。毎週数百件ずつ増えているとのことです（発表記事の時点では 215,000 件以上と書かれており、その後も伸び続けています）。

## 7. 使い方

既存の道具をそのまま使えるのが実用上いちばん大きいところです。Chrome DevTools Protocol に対応しているので、Puppeteer、Playwright、chrome-remote-interface、それに MCP を喋るエージェントがそのまま動きます。

やることは Browser Run の接続先に `browser=kitesurf` を足すだけです。

### Quick Actions

```sh
curl -X POST 'https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-run/screenshot?browser=kitesurf' \
  -H 'Authorization: Bearer <API_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' \
  --output "screenshot.png"
```

### CDP でつなぐ

```
wss://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-run/devtools/browser?browser=kitesurf
```

Puppeteer や Playwright の接続先をこれに差し替えるだけです。

### MCP から使う

```json
{
  "mcp": {
    "kitesurf": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "chrome-devtools-mcp@latest",
        "--wsEndpoint=wss://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-run/devtools/browser?browser=kitesurf",
        "--wsHeaders={\"Authorization\":\"Bearer <API_TOKEN>\"}"
      ],
      "enabled": true
    }
  }
}
```

コードを書かずに試すなら https://kitesurf.cloudflare.app/ に試験場があります。Chrome の開発者ツールがそのまま繋がるので、中で何が起きているか覗けます。

## 8. 今できないこと

- 動画の再生
- WebGL の描画
- bot 判定の TLS 指紋のやりとり
- 数分にわたって認証状態を保ち続けるセッション

これらは Browser Run の既定（Chromium）を使え、とドキュメントに明記されています。置き換えではなく選択肢が増えた、という位置づけです。

特に 3 つ目は現実的な制約で、bot 対策のかかっているサイトには入れません。用途としては、自分で用意した対象や、素直に開けるページの取得・スクリーンショット生成に向いています。

## 9. 設計として面白いところ

いちばん面白いのは、**制約を先に決めてから作り直している**ところだと思いました。

既存のブラウザを軽くしようとすると、どうしても「何を削れるか」の議論になります。Kitesurf は逆で、「エージェントが必要とするのは何か」から始めて、必要ないものは最初から実装していません。タブがないのは削ったからではなく、要らないので作らなかったからです。

もう 1 つは、部品の集め方です。DOM は Blitz、CSS は Firefox の Stylo、文字組みは Parley、`eval` は Boa。ブラウザエンジンを全部自分で書いたのではなく、Rust で書かれた既存の部品を集めて Workers に載せた、という組み立てです。Rust 製ブラウザエンジン部品が実用水準で揃ってきたことが、この作り方を可能にしています。

## おわりに

Kitesurf の良さは 3 つに絞れます。

**1. 同じ資源で何倍も並べられる**

メモリが 4.7〜7 分の 1、CPU が 3〜4 分の 1。1 本あたりの実時間は 1.8 倍遅いので、人間が待つ画面には向きません。ただエージェントの仕事は「1 本を速く」より「何十本を同時に」なので、こちらの効き方のほうが実用上は大きくなります。

**2. 切り替えが 1 パラメータで済む**

Chrome DevTools Protocol に合わせてあるので、Puppeteer も Playwright も MCP のクライアントも、接続先に `browser=kitesurf` を足すだけで動きます。中身がゼロから書き直された別物であることを、使う側は知らずに済みます。試すコストがほぼゼロなのが、実用上いちばん大きい点です。

**3. エージェントに渡す形で出てくる**

人間向けの装飾を最初から持っていないので、抽出結果がそのままモデルに食わせやすい形になります。トークン数とコンテキスト長を設計目標に置いた結果です。

向いているのは、画像生成を大量に回す、記事の本文を抽出する、エージェントに Web を見せる、といった用途です。逆に、重い JavaScript のアプリを正確に描画したい、見た目を検証したい、bot 対策のあるサイトを開きたい、という場合は Chromium のままにしておくのが無難です。

いま Browser Run を使っている処理があるなら、パラメータを 1 つ足して結果を見比べるところから始められます。

## 参考

- https://blog.cloudflare.com/kitesurf/
- https://developers.cloudflare.com/browser-run/kitesurf/
- https://developers.cloudflare.com/changelog/post/2026-08-06-kitesurf/
- https://kitesurf.cloudflare.app/
