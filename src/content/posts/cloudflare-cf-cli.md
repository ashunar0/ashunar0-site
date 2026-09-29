---
title: Cloudflare の新しい CLI「cf」を wrangler と並べて触ってみた
description: Cloudflare が wrangler の後継として出した CLI「cf」を、wrangler と同じ Hono アプリで並べて触りました。
pubDate: 2026-09-29
tags: [Cloudflare, Cloudflare Workers, cf, Wrangler, AIエージェント]
draft: false
---

## はじめに

先日、Findy テック文化祭 2026 で「個人開発はCloudflareにすべてを賭けろ」という発表をしてきました。Cloudflare は AI エージェントファーストな環境づくりにも力を入れていて、とにかく使いやすいので、みんな使ってね！という話です。自分も普段から Durable Objects や Containers をたくさん使っていて、かなりお世話になっています。

https://ashunar0.dev/talks/2026-09-26-cloudflare-all-in/

そんな折に、Cloudflare から新しい CLI「cf」が発表されました。なんと wrangler の後継です。

https://blog.cloudflare.com/cloudflare-cf-cli-launch/

ざっと調べてみると、設定ファイルを書き換えるたびに毎回手で型を作り直す手間がなくなり、コマンドで扱える操作の数もなんと驚愕の 10 倍以上に爆増しているようです！これまではダッシュボードで確認するしかなかった Containers の請求額のような情報まで、コマンドで取れるようになっています。アツすぎる！

これはめちゃくちゃいいじゃん！となったので、早速触ってみました。この記事では、wrangler と並べて、cf で何が変わって何が嬉しいのかを見ていきます。

## cf とは

cf は、Cloudflare が 2026 年 9 月 28 日に公開した新しい CLI です。現在は open beta で、npm からインストールできます。

```bash
npm i -g cf
```

ソースは GitHub の cloudflare/cf で公開されています。この記事では、執筆時点で最新だった `1.0.0-beta.5` を使っています。

位置づけは wrangler の後継です。発表記事には、wrangler の今後について次のように書かれています。

> When the open beta ends we will release a final major version of Wrangler that directs you and your agent to use cf. We'll continue to provide maintenance support for Wrangler for 18 months after the beta ends, to give you time to migrate.

beta が終わった時点で、cf への移行を案内する wrangler の最後のメジャーバージョンが出ます。その後も 18 か月はメンテナンスが続くので、wrangler は当面そのまま使えます。

作り直した理由として、発表記事は 2 つの数字を挙げています。1 つは**操作の数**です。wrangler が扱えるのは約 280 の操作ですが、Cloudflare の API には 3,000 を超える操作があります。もう 1 つは、**wrangler を誰が使っているか**です。エージェント経由の利用は、前年には 1 桁 % でしたが、2026 年 3 月には 4 分の 1 になり、発表の前の週にはなんと 48% にまで達したそうです。

## 扱える範囲が Cloudflare API 全体になった

これまでの wrangler のコマンドは、Workers とその周辺に限られていました。`wrangler --help` に並ぶのは `dev` `deploy` `kv` `d1` `r2` `queues` などで、DNS やキャッシュ、ゾーンの設定を操作するコマンドはありません。これらはダッシュボードで操作するか、API を直接呼ぶ必要があります。

これに対し、cf の `--help` には、トップレベルのコマンドが約 80 個並びます。Workers まわりに加えて、`dns` `cache` `zones` `firewall` `registrar` `billing` のように、Cloudflare のほぼすべての製品が入っています。たとえば DNS レコードの作成は `cf dns records create`、キャッシュの削除は `cf cache purge` です。

操作の数で比べると、wrangler の約 280 に対して、cf は Cloudflare API の 3,000 を超える操作をすべて扱えます。実に 10 倍以上に増えたことになります。

これがあれば、エージェントを利用した CLI 経由の開発がより便利になりそうですね！

## エージェントが使う前提で作られている

cf には、使う側がエージェントであることを前提にした作りがいくつかあります。

### --help がエージェントに指示を出す

Claude Code の中で `cf --help` を実行すると、コマンド一覧の前に次のような文章が出ます。

```
=== STOP: AGENT COMMAND DISCOVERY ===
AGENTS: Do not explore commands by chaining nested --help calls.
Your first port of call and the best way to discover commands is:
AGENTS: Keep cf cli search queries anonymous; describe the action and resource type only.
Never include names, email addresses, domains, account or resource IDs, tokens, or other identifying values.
  cf cli search "<describe the task you want to accomplish>"
It returns five compact JSON matches with short descriptions. Pick the best match instead of repeating similar searches.
```

`--help` を何段もたどってコマンドを探さずに `cf cli search` を使うこと、検索語にドメインや ID などを入れないこと、似た検索を繰り返さずに候補から選ぶこと、の 3 つを指示しています。`cf cli search` は、やりたいことを文章で渡すと、候補のコマンドを 5 つ JSON で返すコマンドです。

これは Claude Code が設定する環境変数 `CLAUDECODE=1` があるときにだけ出ます。普通のターミナルで実行すると、通常のヘルプだけが表示されます。

AI エージェントファーストの環境づくりを率先的に行っている Cloudflare ならではの気遣いですね。

### wrangler にも入っているもの

エージェントへの対応は cf だけのものでもありません。`wrangler dev` を Claude Code の中で起動すると、「エージェントの中で実行されている」と表示したうえで、ローカルの KV や D1 の中身を HTTP で確認できる API の一覧をログに出します。cf の dev サーバーでも同じ表示が出ました。

## 設定が TypeScript になり、型が設定に追従する

Worker の設定は、wrangler では `wrangler.jsonc` に書いていました。cf では `cloudflare.config.ts` という TypeScript のファイルに書きます。変数 `WORLD` と KV の `CACHE` を持つ Worker で比べると、次のようになります。

```jsonc
// wrangler.jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-25",
  "vars": { "WORLD": "World" },
  "kv_namespaces": [{ "binding": "CACHE", "id": "dummy-id" }]
}
```

```ts
// cloudflare.config.ts
import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "my-worker",
    compatibilityDate: "2026-09-25",
    entrypoint,
    env: {
      WORLD: bindings.text("World"),
      CACHE: bindings.kv({ id: "dummy-id" }),
    },
  },
});
```

書き方は違いますが、ここから作られる `Env` の型は同じです。どちらも次の型になります。

```ts
{
  CACHE: KVNamespace;
  WORLD: "World";
}
```

違うのは、設定を書き換えたときの扱いです。

wrangler では、`wrangler.jsonc` を書き換えるたびに `wrangler types` を実行して、型のファイルを作り直していました。これを忘れると、設定に足した binding がコードから見えず、型エラーになります。`wrangler.jsonc` はあくまでただの JSON で、TypeScript からは中身が読めないため、コマンドで型を書き出すしかありませんでした。

cf では、TypeScript が `cloudflare.config.ts` から直接型を読み取ります。設定を書き換えればそのまま型に反映されるので、手で型を作り直す必要はありません。設定ファイル自体が TypeScript なので、型チェックのときに、ほかのコードと一緒に読み込まれるからです。

毎回実行するのはびみょ〜に面倒だなと思っていたので、これは素直に嬉しいです。

## dev サーバーが Vite になった

`wrangler dev` は、wrangler 独自の dev サーバーで Worker を動かします（`http://localhost:8787`）。Worker のバンドルには esbuild を使っています。

cf では、`cf init` で作ったプロジェクトに最初から `vite.config.ts` が入っていて、Cloudflare の Vite プラグインが設定されています。

```ts
// vite.config.ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare()],
});
```

`cf dev` を実行すると `Delegating to pnpm vite` と表示され、Vite の dev サーバーが立ち上がります（`http://localhost:5173`）。cf 自身は dev サーバーを持たず、Vite に任せています。Worker のコードは、Vite の中で Workers と同じ実行環境（workerd）で動きます。

Vite プラグイン自体は以前からあり、wrangler の時代でも入れれば同じ構成にできました。cf では、それが最初から入った状態になります。

Vite で動かすことで得られるものとして、発表記事は次の点を挙げています。

- Vite のプラグインをそのまま使える
- ホットリロードが使える
- ビルドに Rust 製の Rolldown が使われ、使われていないコードが取り除かれる
- Vitest のプラグインと組み合わせて、開発とテストを同じ環境で行える

Vite+ が 1.0 になったばかりですし、ここに乗っけて使いたいですね。

加えて、フロントエンドを同じプロジェクトに足すときも、1 つの Vite の dev サーバーでまとめて動かせます。

## アプリのコードは変わらない

ここまでの変化は、どれも設定や開発環境の側の話です。Worker のコード自体は、wrangler でも cf でも同じものがそのまま動きます。

同じ Hono のアプリを両方で作って確かめました。

```ts
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => {
    const cached = await c.env.CACHE.get("greeting");
    return c.text(cached ?? `Hello ${c.env.WORLD}!`);
  })
  .get("/api/greeting", (c) => {
    return c.json({ message: `Hello ${c.env.WORLD}!` });
  });

export type AppType = typeof app;
export default app;
```

違ったのは、`Bindings` に渡す型の名前だけです。Hono の wrangler 向けテンプレートは `wrangler types --env-interface CloudflareBindings` で型を作るので `CloudflareBindings`、cf では `Env` になります。KV の読み出しも JSON のレスポンスも、`hc<AppType>()` で作った RPC クライアントの型（`{ message: string }`）も、両方で同じ結果になりました。大した差ではありません。

## 既存のプロジェクトの移行

これまでに作った wrangler のプロジェクトは、`cf migrate` で cf 用に変換できるようになっています。

```bash
cf migrate
```

実行すると、`wrangler.jsonc` の内容をもとに `cloudflare.config.ts` が作られ、`package.json` に cf が追加されます。変数や KV などの binding も、そのまま移っていました。

一方で、`wrangler.jsonc` は消されず、`package.json` の `scripts` も `wrangler dev` のまま残ります。この状態だと、`cf dev` は `cloudflare.config.ts` を、`pnpm dev`（中身は `wrangler dev`）は `wrangler.jsonc` を読むので、起動の仕方によって違う設定で動きます。古い設定ファイルの削除と `scripts` の書き換えは、手で行う必要があります。

ビルドについては、Vite のプラグインが入っていないプロジェクトの場合、`cf dev` を実行しても中では wrangler が esbuild でビルドしていました。発表記事にも、esbuild を使い続ける Worker については、cf が wrangler に任せると書かれています。

## おわりに

cf で変わったことは、大きく 2 つに分けられます。

1 つは、Cloudflare を操作する道具としての変化です。扱える操作が wrangler の約 280 から 3,000 超に爆増して、Workers 以外の DNS やキャッシュもコマンドで操作できるようになりました。`--help` がエージェントに探し方を指示するなど、エージェントが使うことを前提にした作りも入っています。

もう 1 つは、Worker を開発するときの変化です。設定が TypeScript になって型を手で作り直す必要がなくなり、dev サーバーが Vite になりました。Worker のコードはそのまま動くので、アプリの書き方は変わりません。

総じて、コード自体は変えずに、開発者体験が向上するといった印象ですね。個人的には速攻で乗り換えたいくらいです。

ちなみに、これ以外にも、Vite+ や Vinext が 1.0 になったり、まだまだ気になるニュースがたくさんあります。今後の Cloudflare の進化がまずます楽しみですね。やはり全人類 Cloudflare に注目しましょう！

## 参考

- [Introducing cf: the agentic CLI for the entire Cloudflare API](https://blog.cloudflare.com/cloudflare-cf-cli-launch/)
- [cloudflare/cf](https://github.com/cloudflare/cf)
- [Vite plugin · Cloudflare Workers docs](https://developers.cloudflare.com/workers/vite-plugin/)
- [Write Cloudflare Workers in TypeScript · Cloudflare Workers docs](https://developers.cloudflare.com/workers/languages/typescript/)
- [Cloudflare Workers - Hono](https://hono.dev/docs/getting-started/cloudflare-workers)
