---
title: Cloudflare でコードに触らずサイトを WebMCP に対応させる
description: エッジが HTML に script タグを 1 行差し込む仕組み、ページ自身がツールを宣言する W3C の提案仕様 document.modelContext、用意されている 2 つのパック、サーバー側の MCP との違い。Cloudflare の発表と、その下にある標準を分けて読む。
pubDate: 2026-08-11
tags: [WebMCP, Cloudflare, MCP]
draft: false
---

## はじめに

Cloudflare が、どんなサイトでもコードを一行も変えずに WebMCP に対応させる機能を出しました。ダッシュボードのトグル 1 つで有効になります。開発者プレビューです。

https://x.com/cloudflare/status/2085357766885982635?s=46

WebMCP のほうは Cloudflare の独自機能ではなく、**ページ自身が「このサイトでできること」を道具として宣言し、ブラウザの中の AI エージェントがそれを呼ぶ**という W3C の提案仕様です。話が 2 段になっているので、まず標準のほうから整理します。

## 何を解決するものか

いま AI がウェブサイトを使うときの経路はほぼ 2 つです。

- クローラーがコンテンツをサーバーへ吸い上げ、そちらで処理する
- エージェントが画面を見て、人間向けの UI を推測しながら操作する

前者はサイトに何も返りません。Cloudflare の記事の言い方だと「元のサイトにトラフィックも功績もほとんど渡さない」ものです。後者は壊れやすく、ボタンの位置が変わるたびに動かなくなります。

WebMCP はそこに 3 つ目を置きます。サイトが自分から「検索できます」「カートに入れられます」と道具の形で申告し、エージェントはそれを呼ぶ。推測がなくなり、人間はブラウザの前に居続けます。

## 標準としての WebMCP

W3C の Web Machine Learning コミュニティグループで提案されている仕様で、Chrome に実験的に入っています。`chrome://flags/#enable-webmcp-testing` を立てれば手元で試せて、Chrome 149 からはオリジントライアルも始まっています。

ページ側の API は 2 つあります。HTML のフォームに属性を足して宣言する Declarative API と、JavaScript でツールを登録する Imperative API です。後者はこれだけです。

```javascript
document.modelContext.registerTool({
  name: "search_products",
  description: "商品を検索する",
  inputSchema: {
    /* JSON Schema */
  },
  execute: async (args) => {
    // 実処理。MCP の CallToolResult を返す
  },
});
```

`name` / `description` / `inputSchema` / `execute` の 4 つで、MCP のツール定義そのものです。違うのは**住んでいる場所**だけで、サーバーではなく開いているタブの中にあります。

したがって性質もそこから来ます。

- ページがそのままツールの登録簿になる。別サーバーを立てない
- `execute` はログイン済みのそのタブで動く。認証を作り直さなくていい
- タブが閉じれば消える。常駐プロセスではない

なお資料によって `navigator.modelContext` と書かれているものがありますが、こちらは Chrome 150 で非推奨になりました。`document.modelContext` を使います。

## Cloudflare がやったこと

前述の `registerTool` を、サイトが自分で書かなくて済むようにしました。

ダッシュボードの Agent Readiness > WebMCP でドメインに対してトグルを入れると、エッジの HTMLRewriter が返す HTML に script タグを 1 つ差し込みます。

```html
<script
  type="module"
  src="/.webmcp/bridge.js"
  data-packs="c2pa,mcp-server-client"
  data-mcp-url="/mcp"
></script>
```

タグも `bridge.js` も、どちらもエッジが配信します。

```
訪問者 ←── エッジ ←── オリジン（サイト本体）
            ↑
     ここで script タグを 1 行足している
```

書き換わるのはサイト本体と訪問者の間で、オリジンはそれを知りません。デプロイもビルドも挟まず、次に返る HTML からもう入っています。中身に触らないので、そのサイトが何で作られていても同じように効きます。

`bridge.js` は `document.modelContext` があるかを見て、なければ黙って何もせず戻ります。対応していないブラウザではページの挙動が一切変わりません。

## パック

`data-packs` に並んでいるのがパックです。ツールの束で、個別に入り切りできます。プレビュー時点では 2 つあります。

### Content Credentials

ページ内の画像の C2PA メタデータ（生成元や署名者の情報）を読むツールです。`scan_images_c2pa` は一覧を返します。

```json
{
  "imageCount": 12,
  "withC2pa": 8,
  "results": [
    {
      "src": "https://example.com/hero.jpg",
      "hasC2pa": true,
      "claimGenerator": "Adobe Firefly",
      "signedBy": "Adobe Inc."
    }
  ]
}
```

`inspect_image_c2pa` は 1 枚のマニフェストを全部展開します。ただし現時点では署名の検証はしておらず、`signatureVerified: false` を返します。

### Site MCP Server

すでに自分の MCP サーバーを持っているサイト向けの中継です。`data-mcp-url`（既定は同一オリジンの `/mcp`）に対して `tools/list` を投げ、返ってきたツールをそのまま `registerTool` で登録し直します。呼ばれたら中継します。

```javascript
const res = await fetch(mcpUrl, {
  method: "POST",
  credentials: "same-origin",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: tool.name, arguments: args },
  }),
});
```

見るべきは `credentials: "same-origin"` の行です。訪問者のセッションのまま、同一オリジンに投げています。エージェント用のトークンを別途発行する必要がありません。

## サーバー側の MCP との違い

同じ MCP でも、置き場所が変わると性質がまるごと変わります。

|                | リモート MCP サーバー  | WebMCP                                   |
| -------------- | ---------------------- | ---------------------------------------- |
| 実行場所       | サーバー               | 訪問者のブラウザ                         |
| 認証           | OAuth などを別途用意   | 開いているタブのセッションをそのまま使う |
| 生存期間       | 常駐                   | タブを閉じるまで                         |
| 見えている範囲 | サーバーが持つ全データ | いま開いているページ                     |
| 呼ぶ側         | どのエージェントでも   | そのブラウザの中のエージェント           |

「ページの文脈」が要るものは WebMCP、「サイト全体に対する操作」は従来のサーバー、という分かれ方になります。Content Credentials のパックが分かりやすい例で、いま見ているページの画像を調べるという仕事はサーバーに送っても意味がありません。

## 分けて見る

この発表には、性質の違う 2 つが入っています。

|                | 中身                                       | 効く相手                          |
| -------------- | ------------------------------------------ | --------------------------------- |
| WebMCP（標準） | ページがツールを宣言する、という発想の転換 | 全員。Cloudflare とは無関係に来る |
| エッジでの注入 | それを配る手段                             | コードに触れない人、数が多い人    |

新しいのは上です。人間向けの UI を機械に推測させるのをやめて、先に道具を差し出す。ブラウザ側の話なので、Cloudflare を使っていなくても向き合うことになります。

下は配り方の工夫です。自分でデプロイしている人にとって、script タグ 1 行はエッジに任せるほどの手間ではありません。要る権限がコードからインフラに移るだけで、ゼロにはなりません（ドメインが Cloudflare を経由している必要があります）。効くのは、中身に触れないサイト、ドメインが大量にある場合、そして仕様の追従を預けたい場合です。WebMCP はまだ動いている仕様なので、自分で `registerTool` を書けば変更に追いかけられるのは自分です。最後の 1 つだけは規模に関係なく効きます。

ただし「触らなくていい」がそのまま成立するのは Content Credentials だけです。Site MCP Server は中継役なので、`/mcp` に自分のサーバーが先に要ります。触らなくていいパックほど中身が薄く、サイト固有のツールを宣言する手段はまだありません。

## おわりに

これまでウェブサイトの入口は 1 つでした。人間向けの画面があり、機械はそれを横から覗くしかありませんでした。WebMCP はその隣に機械向けの入口を作ります。

そうなると、作る側の問いが 1 つ増えます。どう見せるか、だけでなく、**何をできることとして宣言するか**です。画面には出ていないが呼べる操作もあれば、画面にはあるが宣言したくない操作もあります。この線引きは今のところ誰も持っていません。

Cloudflare の実装はまだ開発者プレビューで、パックも 2 つだけです。ただ、標準のほうは Cloudflare を使っているかどうかに関係なく来ます。触っておくなら早いほうが得です。

## 参考

- https://blog.cloudflare.com/webmcp/
- https://github.com/webmachinelearning/webmcp
- https://developer.chrome.com/docs/ai/webmcp
- https://github.com/GoogleChrome/modern-web-guidance
