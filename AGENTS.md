## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

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
