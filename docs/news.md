# 朝のニュースを置く手順

Grok bot が毎朝やること。X から集めたテックニュースを 1 日 1 つの JSON にして、
このリポジトリに push する。main に push されると deploy の workflow が動き、
`https://ashunar0.dev/news/<日付>` に出る。

## 流れ

```sh
git pull --rebase                         # 1. 最新にする
# 2. src/content/news/YYYY-MM-DD.json を書く（下の形）
pnpm astro sync                           # 3. 形を検査する。exit 1 なら直す
git add src/content/news/YYYY-MM-DD.json
git commit -m "feat: YYYY-MM-DD のニュースを追加"
git push                                  # 4. これで公開される
```

- 触るのは `src/content/news/` の、その日の 1 ファイルだけ。ほかのファイルは変えない
- 検査（`pnpm astro sync`）が通らないまま push しない。push するとビルドが落ちて、その日のニュースも出ない
- 同じ日のファイルがもうあるときは上書きしない

## ファイル

`src/content/news/YYYY-MM-DD.json`。日付は JST のその朝の日付。

- **ファイル名が URL と日付になる。** `2026-10-30.json` なら `/news/2026-10-30`
- `YYYY-MM-DD` 以外の名前（`2026-10-30-news.json` など）にしない。検査は通るがビルドで落ちる
- 日付は JSON の中には書かない

## JSON の形

```json
{
  "stories": [
    {
      "title": "Vite+ 移行の実例が続々、ビルド時間が半分近くに",
      "main": "https://x.com/harshil1712/status/2115423128486662633",
      "body": "Cloudflare の harshil1712 さんが、Cloudflare Certification のモノレポを Vite+ に移行。コード変更なしで本番ビルドが admin で −59%、user で −41% になり、型チェックも 21 秒（tsc ×6）から 5.3 秒（tsgo 1コマンド）に縮んだ。",
      "around": [
        {
          "url": "https://x.com/yusukebe/status/2115435665030885737",
          "name": "yusukebe",
          "summary": "Ramen API も Vite+ を使い始めた"
        }
      ]
    }
  ],
  "quick": [
    {
      "title": "Rolldown の次版で chunk.code の扱いが速くなる",
      "summary": "プラグインが chunk.code や renderedLength を読むたびに、Rust から JS へコードをコピーしなくなる。",
      "source": "https://x.com/voidzerodev/status/2115473594327400687"
    }
  ]
}
```

### stories（1 本ずつめくって読む話題）

| キー | 中身 |
|---|---|
| `title` | 見出し。日本語で 1 行 |
| `main` | その話の元になった **X の投稿の URL**（`https://x.com/<名前>/status/<数字>`）。画面に埋め込まれる |
| `body` | 解説。2〜3 文 |
| `around` | 周辺の投稿。反応・引用・同じ話題の別の投稿。なければ空配列か省略 |

`around` の 1 件:

| キー | 中身 |
|---|---|
| `url` | 投稿の URL |
| `name` | 投稿した人の表示名（`Evan You` など）。@ハンドルは URL から取るので書かない |
| `summary` | その投稿が何を言っているかの一行要約 |

### quick（1 本にするほどではない短いニュース）

最後にまとめて 1 枚で並ぶ。なければ空配列か省略。

| キー | 中身 |
|---|---|
| `title` | 見出し。日本語で 1 行 |
| `summary` | 要約。1〜2 文 |
| `source` | 元の投稿や記事の URL |

## 中身のルール

- **大事な順に並べる。** stories も quick も、配列の順がそのまま画面の順になる。番号や「重要」の印は付けない
- **`main` は必ず投稿の URL。** X ニュース（`/i/trending/…`）の URL は埋め込めないので使えない（検査で落ちる）。話題が X ニュースから来たときも、元になった投稿を探してそれを使う
- **1 つの story には 1 つの話題。** 別の話（例: Cloudflare の話と GitHub の話）は別の story に分ける
- **解説の数字や固有名詞は、`main` か `around` の投稿に書いてあるものだけ。** 読む人が元の投稿で確かめられるようにする。覚えている知識や推測で数字を足さない
- **個人に向けた一言は書かない。**「〜さんにとって参考になりそう」「〜を考える材料になりそう」のような、読む人に向けた感想や提案は入れない。起きたことだけを書く
- **見出しに絵文字を付けない。**
- 本数の目安: stories は 3〜6 本、quick は 0〜5 本。無理に埋めない
