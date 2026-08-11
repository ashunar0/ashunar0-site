---
title: VSCode の設定紹介
description: 一から作り直した settings.json の全文と、18 個の拡張機能。別の Mac で同じ環境を再現する手順まで。
pubDate: 2026-01-25
tags: [VSCode, 環境構築]
draft: false
---

## この記事について

VSCodeの設定を別のPCでも再現できるように。 `settings.json` をそのまま置いておきます。自分用です。参考はご自由にどうぞ。

### 環境

- macOS
- VSCode 1.132
- 主に触る言語: TypeScript / Vue / Astro / Ruby / Python / LaTeX

## フォント

**Moralerspace Neon HW** を使っています。

```bash
brew install --cask font-moralerspace-hw
```

Moralerspace には標準版と HW 版があり、半角と全角の字幅比が違います。フォントファイルから実際の値を読むとこうなります。

| | 半角 `A` | 全角 `漢` | 比 |
| --- | --- | --- | --- |
| Moralerspace Neon | 600 | 1000 | 1 : 1.667 |
| Moralerspace Neon **HW** | 525 | 1050 | 1 : 2.000 |

標準版は英数字を太らせて可読性を上げる代わりに、全角が半角 2 文字分になりません。HW 版はちょうど 2 倍です。

普段のコードでは差が出ませんが、**Markdown の表や mermaid のソースを手で書くとき**にはっきり効きます。日本語のセルが混ざると `|` の位置が揃わないためです。

## settings.json

```jsonc
{
  // --------------------------------------------
  // 見た目 / テーマ
  // --------------------------------------------
  "workbench.iconTheme": "material-icon-theme",
  "workbench.colorTheme": "Kanagawa Dragon",

  // --------------------------------------------
  // フォント
  // --------------------------------------------
  // HW 版は 半角:全角 = 1:2 ちょうど。Markdown の表や mermaid の桁が揃う。
  // 標準版（'Moralerspace Neon'）は 1:1.667 で ASCII が太く読みやすい代わりに桁が揃わない。
  "editor.fontFamily": "'Moralerspace Neon HW', Menlo, monospace",
  "editor.fontSize": 13,
  "editor.fontLigatures": false,
  "editor.lineHeight": 1.7,

  // --------------------------------------------
  // エディタの見え方
  // --------------------------------------------
  "editor.minimap.enabled": true,
  // 文字を描かずブロックで表示（縮小図としては形の方が読みやすい）
  "editor.minimap.renderCharacters": false,
  // ファイル全体が常に収まるように縮尺を調整する
  "editor.minimap.size": "fit",
  // 現在位置のハイライトは常時表示（マウスを乗せた時だけ、より分かりやすい）
  "editor.minimap.showSlider": "always",

  // カーソルを置いた変数と同じものを、画面内もミニマップ上も光らせる
  "editor.occurrencesHighlight": "singleFile",
  // 選択した文字列と同じ文字列を光らせるのは切る（ただの文字列一致でノイズが多い）。
  // 変数のハイライトは上の occurrencesHighlight が担当するので失われない
  "editor.selectionHighlight": false,

  // git の変更を「行番号の左」「スクロールバー」「ミニマップ」の全部に出す
  "scm.diffDecorations": "all",
  "scm.diffDecorationsGutterVisibility": "always",
  "editor.renderWhitespace": "none",
  // カーソル行の背景ハイライトを消す
  "editor.renderLineHighlight": "none",
  // カーソルが画面の端に張り付かないよう、常に上下4行の余白を残す
  "editor.cursorSurroundingLines": 4,
  "editor.cursorBlinking": "smooth",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.smoothScrolling": true,
  "editor.stickyScroll.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.bracketPairColorization.enabled": true,
  // 開始タグを直すと閉じタグも追従する（auto-rename-tag 拡張の代替）
  "editor.linkedEditing": true,
  // > を打った時点で閉じタグを自動挿入する（auto-close-tag 拡張の代替）
  "html.autoClosingTags": true,
  "js/ts.autoClosingTags.enabled": true,

  // --------------------------------------------
  // inlay hints（推論結果をコード中に薄く表示する）
  // --------------------------------------------
  "editor.inlayHints.enabled": "on",
  "editor.inlayHints.padding": true,
  // 引数名は「数値やbool等のリテラルを渡している箇所」だけ表示する。
  // "all" にすると変数を渡す箇所にも全部出て、かなり賑やかになる
  "js/ts.inlayHints.parameterNames.enabled": "literals",
  // 関数の戻り値の型（書いていない場合に推論結果を表示）
  "js/ts.inlayHints.functionLikeReturnTypes.enabled": true,
  // enum のメンバーが実際に何番なのかを表示
  "js/ts.inlayHints.enumMemberValues.enabled": true,
  // 変数の型は出さない（量が多すぎてノイズになりやすい）
  "js/ts.inlayHints.variableTypes.enabled": false,

  // --------------------------------------------
  // 保存時の自動処理
  // --------------------------------------------
  "editor.formatOnSave": true,
  "editor.formatOnPaste": false,
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // .prettierrc が無いプロジェクトでは整形しない（他人の repo を壊さないため）
  "prettier.requireConfig": true,

  // 保存時に走らせるコードアクション
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },

  // Prettier が効かないファイル（.txt / .env / .csv 等）にも効く基礎処理
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "files.trimFinalNewlines": true,

  // 上の一括処理を「触ると壊れるファイル」では無効化する
  "[markdown]": {
    // Markdown は行末2スペースが改行の意味を持つので消してはいけない
    "files.trimTrailingWhitespace": false,
    // 長い文章を折り返す（横スクロールしないで読める）
    "editor.wordWrap": "on",
    // 文章を書いている最中に補完候補が飛び出すのを止める
    "editor.quickSuggestions": {
      "comments": "off",
      "strings": "off",
      "other": "off"
    }
  },
  "[diff]": {
    "files.trimTrailingWhitespace": false
  },

  // --------------------------------------------
  // 言語ごとの formatter 割り当て
  //   既定は Prettier。Prettier が扱えない言語だけ個別に指定する。
  // --------------------------------------------

  // Prettier が担当（.prettierrc がある時のみ動く）
  "[javascript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[javascriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[vue]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[jsonc]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[css]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[html]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },

  // Astro 拡張が自前の formatter を持つ（prettier-plugin-astro を同梱）
  "[astro]": { "editor.defaultFormatter": "astro-build.astro-vscode" },

  // YAML 系は redhat.vscode-yaml が担当
  "[yaml]": { "editor.defaultFormatter": "redhat.vscode-yaml" },
  "[dockercompose]": {
    "editor.defaultFormatter": "redhat.vscode-yaml",
    "editor.insertSpaces": true,
    "editor.tabSize": 2,
    "editor.autoIndent": "advanced"
  },
  "[github-actions-workflow]": {
    "editor.defaultFormatter": "redhat.vscode-yaml"
  },
  // Actions のワークフローは拡張側が専用スキーマを当てるので、YAML 側の自動検出を切る
  "yaml.disableSchemaDetection": [
    "**/.github/workflows/*.yml",
    "**/.github/workflows/*.yaml"
  ],

  // Ruby は Ruby LSP が担当（rubocop があればそれを使う）
  "[ruby]": {
    "editor.defaultFormatter": "Shopify.ruby-lsp",
    "editor.tabSize": 2
  },

  // Python は Ruff が担当（拡張が ruff バイナリを同梱しているので PATH 不要）
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "explicit",
      "source.organizeImports.ruff": "explicit"
    }
  },

  // --------------------------------------------
  // Tailwind CSS
  // --------------------------------------------
  // class="..." のような文字列の中でも補完を出す（Tailwind の補完に必須）
  "editor.quickSuggestions": {
    "strings": "on"
  },

  // --------------------------------------------
  // ワークスペースの信頼
  // --------------------------------------------
  // フォルダに属さない単体ファイルは、聞かずにそのまま開く
  // （単体ファイルはタスクや拡張の自動実行が起きないのでリスクが低い）
  "security.workspace.trust.untrustedFiles": "open",
  // 未信頼フォルダを開いた時の確認は、起動のたびではなく初回のみ
  "security.workspace.trust.startupPrompt": "once",

  // --------------------------------------------
  // Unicode の警告表示
  // --------------------------------------------
  // コメントは日本語の散文を書く場所なので検出しない。
  // コード本体では検出を残す（全角スペース混入・ホモグリフの検出は有用なため）
  "editor.unicodeHighlight.includeComments": false,

  // --------------------------------------------
  // AI 機能（Copilot / Chat）
  // --------------------------------------------
  // 組み込みの Copilot は削除できないので、UI ごと無効化して隠す。
  // チャットのアイコン・インライン補完・関連コマンドがすべて出なくなる。
  "chat.disableAIFeatures": true,

  // --------------------------------------------
  // ワークベンチ
  // --------------------------------------------
  // 左の縦アイコン列をやめて、タイトルバーの中に横並びで置く
  "workbench.activityBar.location": "top",
  // 上部中央の検索ボックス風バーを消す（Cmd+P で代替できる）
  "window.commandCenter": false,

  "workbench.list.smoothScrolling": true,
  "workbench.editor.tabSizing": "shrink",
  // 1回クリックで開いた「プレビュータブ」を廃止し、開いたタブは必ず残す
  "workbench.editor.enablePreview": false,
  "workbench.tree.indent": 16,
  "breadcrumbs.enabled": true,
  "window.title": "${rootName}${separator}${activeEditorMedium}",

  // --------------------------------------------
  // Markdown プレビュー
  // --------------------------------------------
  // 相対パスは「開いているフォルダ」基準で解決され、存在しなければ黙って無視される。
  // つまり docs/markdown-preview.css を置いたリポジトリでだけ自動的に効く。
  // .vscode/ に置くと webview が読めず「読み込むことができません」になるので docs/ 直下。
  //
  // ワークスペース側（各リポジトリの .vscode/settings.json）に書くと、
  // markdown.styles は restricted 設定なので未信頼のフォルダでは無視される。
  // ユーザー設定側の値は信頼状態に関係なく使われるため、ここに置く。
  "markdown.styles": ["docs/markdown-preview.css"],

  // --------------------------------------------
  // ファイル操作
  // --------------------------------------------
  // 改行コードを LF に固定（macOS/Linux/CI と揃う）
  "files.eol": "\n",
  // ファイルを移動したら import パスを自動で書き換える（毎回聞かない）
  "js/ts.updateImportsOnFileMove.enabled": "always",
  // ドラッグ移動・ペーストのたびの確認ダイアログを止める
  "explorer.confirmDragAndDrop": false,
  "explorer.confirmPasteNative": false,
  // 親フォルダの .git を勝手に拾いに行かない
  "git.openRepositoryInParentFolders": "never",
  // 中身が1つだけのフォルダを a/b/c と繋げて表示するのをやめる（階層を誤読しないため）
  "explorer.compactFolders": false,

  // --------------------------------------------
  // Git
  // --------------------------------------------
  // リモートの更新を自動で取得する（pull はしない、取ってくるだけ）
  "git.autofetch": true,
  // sync のたびの確認ダイアログを止める
  "git.confirmSync": false,
  // stage していない変更もそのままコミットできる
  "git.enableSmartCommit": true,
  // 差分表示で空白の変更も無視せず見せる
  "diffEditor.ignoreTrimWhitespace": false,

  // --------------------------------------------
  // Emmet
  // --------------------------------------------
  "emmet.triggerExpansionOnTab": true,
  "emmet.variables": {
    "lang": "ja"
  },

  // --------------------------------------------
  // 除外設定
  //   files.exclude         … ファイルツリーから隠す（開けなくなる）
  //   search.exclude        … 検索対象から外す（ツリーには残る）
  //   files.watcherExclude  … 変更監視から外す（CPU/メモリ削減のみ）
  // --------------------------------------------

  // ツリーから隠すのは「中を見ることが絶対に無い」ものだけに絞る
  "files.exclude": {
    "**/.DS_Store": true,
    "**/.astro": true,
    "**/.wrangler": true,
    "**/.turbo": true,
    "**/__pycache__": true,
    "**/.pytest_cache": true,
    "**/.ruff_cache": true,
    "**/*.pyc": true
  },

  // 検索は広めに切る。node_modules は「ツリーには残すが検索には出さない」
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/.next": true,
    "**/.astro": true,
    "**/.wrangler": true,
    "**/.turbo": true,
    "**/coverage": true,
    "**/.venv": true,
    "**/venv": true,
    "**/vendor/bundle": true,
    "**/tmp": true,
    "**/log": true,
    "**/out": true,
    "**/*.lock": true,
    "**/package-lock.json": true,
    "**/pnpm-lock.yaml": true,
    "**/yarn.lock": true,
    "**/bun.lock": true
  },

  // 監視から外す。ここは重さにしか効かないので思い切って切ってよい
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/objects/**": true,
    "**/.git/subtree-cache/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/.next/**": true,
    "**/.astro/**": true,
    "**/.wrangler/**": true,
    "**/.turbo/**": true,
    "**/.venv/**": true,
    "**/vendor/bundle/**": true,
    "**/tmp/**": true
  },

  // --------------------------------------------
  // ファイルツリー
  // --------------------------------------------
  // 関連ファイルを親ファイルの下に畳む
  "explorer.fileNesting.enabled": true,
  // 畳んだ状態で開始する（true だと展開済みになって畳む意味が無い）
  "explorer.fileNesting.expand": false,
  "explorer.fileNesting.patterns": {
    // 設定ファイル群をまとめる
    "package.json": "package-lock.json, yarn.lock, pnpm-lock.yaml, pnpm-workspace.yaml, bun.lockb, bun.lock, .npmrc, .nvmrc, .node-version",
    "tsconfig.json": "tsconfig.*.json",
    ".env": ".env.*",
    // ビルド生成物を元ファイルの下に隠す
    "*.ts": "${capture}.js, ${capture}.js.map, ${capture}.d.ts",
    "*.tsx": "${capture}.ts",
    "*.jsx": "${capture}.js",
    // LaTeX の生成物を .tex の下に畳む
    "*.tex": "${capture}.pdf, ${capture}.aux, ${capture}.log, ${capture}.dvi, ${capture}.synctex.gz, ${capture}.fls, ${capture}.fdb_latexmk, ${capture}.toc, ${capture}.out, ${capture}.bbl, ${capture}.blg",
    // SQLite の付随ファイル
    "*.sqlite": "${capture}.${extname}-*",
    "*.db": "${capture}.${extname}-*",
    "*.sqlite3": "${capture}.${extname}-*",
    "*.db3": "${capture}.${extname}-*"
  },

  // --------------------------------------------
  // LaTeX（TeX Live 2025 / uplatex → dvipdfmx）
  // --------------------------------------------
  "[tex]": {
    // Prettier は LaTeX を扱えないので保存時整形を切る
    "editor.formatOnSave": false,
    "editor.tabSize": 2,
    "editor.suggest.snippetsPreventQuickSuggestions": false
  },
  "[latex]": {
    "editor.formatOnSave": false,
    "editor.tabSize": 2,
    "editor.suggest.snippetsPreventQuickSuggestions": false
  },
  "[bibtex]": {
    "editor.formatOnSave": false,
    "editor.tabSize": 2
  },

  // 使用パッケージのコマンド・環境を補完する
  "latex-workshop.intellisense.package.enabled": true,
  // 自動ビルドは止める（保存のたびにビルドが走ると重い）
  "latex-workshop.latex.autoBuild.run": "never",
  // 中間ファイルは out/ に隔離する
  "latex-workshop.latex.outDir": "out",
  "latex-workshop.latex.defaultRecipe": "uplatex → dvipdfmx",
  "latex-workshop.latex.recipes": [
    {
      "name": "uplatex → dvipdfmx",
      "tools": ["uplatex", "dvipdfmx"]
    }
  ],
  "latex-workshop.latex.tools": [
    {
      "name": "uplatex",
      "command": "uplatex",
      "args": [
        "-interaction=nonstopmode",
        "-file-line-error",
        "-output-directory=out",
        "%DOC%"
      ]
    },
    {
      "name": "dvipdfmx",
      "command": "dvipdfmx",
      "args": ["-o", "%DOCFILE%.pdf", "out/%DOCFILE%.dvi"]
    }
  ],
  "latex-workshop.view.pdf.reload.method": "always",

  // --------------------------------------------
  // ターミナル
  // --------------------------------------------
  "terminal.integrated.fontFamily": "'Moralerspace Neon HW'",
  "terminal.integrated.fontSize": 13,
  "terminal.integrated.smoothScrolling": true
}
```

### 補足したい設定

**`prettier.requireConfig`**

`.prettierrc` があるプロジェクトでだけ整形します。人のリポジトリを開いて保存した瞬間に全行が差分になる、という事故が起きません。代わりに自分の新規プロジェクトには `.prettierrc` を必ず置くことになります。

**`editor.codeActionsOnSave` の `"explicit"`**

`true` ではなく `"explicit"` にしています。`true` だと自動保存でも走るため、書きかけのコードから import が消えたりします。`"explicit"` なら明示的に保存したときだけです。

**除外設定の 3 種類**

役割が違うので使い分けます。

| 設定 | 効果 |
| --- | --- |
| `files.exclude` | ファイルツリーから消える。`Cmd+P` でも開けなくなる |
| `search.exclude` | 検索に出ない。ツリーには残る |
| `files.watcherExclude` | 監視しない。重さにしか効かない |

`node_modules` は `search.exclude` にだけ入れています。ライブラリの型定義を読みに行くことがあるので、ツリーからは消したくないためです。

**`explorer.fileNesting`**

`package.json` の下に lock ファイルや `.npmrc` を畳みます。ルート直下は必ず散らかる場所なので、これだけでもかなり静かになります。

なお `explorer.fileNesting.enabled` を書かないと動きません。`patterns` だけ書いて満足していると何も起きないので注意してください。

**`chat.disableAIFeatures`**

Copilot は組み込み拡張なのでアンインストールできません。この設定で UI ごと隠せます。

## 拡張機能

| 拡張機能 | 用途 |
| --- | --- |
| esbenp.prettier-vscode | 整形 |
| dbaeumer.vscode-eslint | Lint |
| vue.volar | Vue |
| astro-build.astro-vscode | Astro |
| bradlc.vscode-tailwindcss | Tailwind |
| shopify.ruby-lsp | Ruby |
| ms-python.python / vscode-pylance / debugpy / vscode-python-envs | Python |
| charliermarsh.ruff | Python の整形と Lint |
| redhat.vscode-yaml | YAML |
| github.vscode-github-actions | GitHub Actions |
| ms-azuretools.vscode-containers | Docker |
| james-yu.latex-workshop | LaTeX |
| metaphore.kanagawa-vscode-color-theme | テーマ |
| pkief.material-icon-theme | アイコン |
| ms-ceintl.vscode-language-pack-ja | 日本語化 |

言語サーバー以外はほとんど入れていません。
