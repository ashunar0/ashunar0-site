## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## 登壇資料（talks）の追加

1 登壇 = 1 ディレクトリ。`src/content/talks/YYYY-MM-DD-<短い名前>/` を作り、
スライドの PNG を `00.png` から入れて `index.md` を置く。それだけで一覧と詳細に出る。

```
src/content/talks/2026-08-17-split-api-timeline/
  index.md
  00.png … 13.png
```

```yaml
---
title: 発表タイトル
description: 何を話したか2〜3文（OG の説明文にもなる）
event: 'Ginza.js #11'
slidesUrl: https://speakerdeck.com/...   # 任意
draft: false
---
```

- **ディレクトリ名がそのまま URL になり、登壇日もここから取る**。frontmatter に
  `pubDate` は持たない（二重に持つとどちらかだけ直す事故が起きる）
- **PNG は `index.md` に一枚も書かない**。`features/talks/slides.ts` がディレクトリを
  読んでファイル名順に並べる。一覧のサムネも 1 枚目を自動で使う
- 並びは numeric 比較なので `1.png, 2.png, 10.png` でも正しい。ゼロ埋めは任意
- 書き出しは 16:9（1920×1080 想定）。横幅は 1920 までで十分で、それ以上は
  リポジトリが太るだけ。1 枚 100KB 台に収まる解像度にする
- 本文は空でよい。空なら本文カードごと出ない
- **`event` に `#` が入るときは必ずクォートで囲む**。YAML では `#` 以降がコメントになり、
  `event: Ginza.js #11` は**エラーにならずに黙って** `Ginza.js` になる
- posts と違い、draft でも dev では表示する（スライドの見え方を公開前に確かめるため）

記事（posts）とは別コレクションにしてある。持つメタデータが違い、混ぜると
記事一覧に本文の薄いページが並んで一覧の意味が壊れるため。

## 記事本文のスタイル

記事本文の見た目は `src/styles/post-body.css` にある（`.post-body` 配下）。
記事詳細（post-detail）と登壇詳細（talk-detail）の両方がここを読む。

**ここを変えたら `docs/markdown-preview.css` も手で合わせること。**

こちらは VSCode の Markdown プレビューを公開後の見た目に寄せるための写し。
本体は Tailwind v4 の `@theme` に依存していて素の CSS では解決できないため、
自動生成ではなく二重管理にしている。写しの側は `.post-body` を `body` に読み替え、
使っている色（`--color-brand` 等）を実値で持っている。

読み込みは VSCode の**ユーザー設定**側で `"markdown.styles": ["docs/markdown-preview.css"]`
と指定している（このリポジトリには設定を置いていない）。相対パスは開いているフォルダ基準で
解決され、ファイルが無ければ無視されるため、この置き場所の規約さえ守れば自動的に効く。
`.vscode/` に置くと読み込みに失敗するので `docs/` 直下に置くこと。

プレビュー側で再現できないもの: リンクカード、X の埋め込み、コードのコピーボタン
（いずれも remark プラグインや実行時スクリプトが作るため）。

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
