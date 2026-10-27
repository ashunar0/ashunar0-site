---
title: TanStack Redact で、React アプリのコードはそのままに React だけを小さくする
description: TanStack Redact は、React で書いたアプリの React 本体だけを差し替えるツールです。実際に入れてみて、どれくらい小さくなるのか、その代わりに何を手放すのかを確かめました。
pubDate: 2026-10-27
tags: [TanStack, React, Vite]
draft: false
---

## はじめに

TanStack の Redact が 0.2.0 に上がった、という話が流れてきました。React で書いたアプリを、コードを変えずに小さくできるものらしいです。

https://x.com/tan_stack/status/2114748369470128216?s=20

これは気になります。ちょうどいいタイミングだったので、実際に入れてみて、どれくらい小さくなるのか、その代わりに何がなくなるのかを確かめてみました。

## Redact ってなんぞや

Redact は、React で書いたアプリの React 本体だけを、小さい別物に差し替えるツールです。TanStack Query や TanStack Router でおなじみの TanStack が作っていて、2026 年 10 月 26 日に 0.2.0 が出ました。

https://tanstack.com/redact

使い方は、Vite のプラグインを 1 つ足すだけです。めちゃ楽です。アプリの中の `import { useState } from 'react'` は書き換えません。ビルドのときに、プラグインが `react` や `react-dom` の読み込み先を Redact に付け替えてくれます。

```ts
// vite.config.ts
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  plugins: [react(), redact()],
})
```

Vite のほかに、TanStack Start、Next.js、Vinext にも対応しています。Next.js では、サーバー側は本物の React のままで、ブラウザで動く部分だけを Redact が受け持ちます。

### それって別に Preact でよくない？

「`react` を小さいものに差し替える」と聞いて、Preact でいいじゃんって思いました。Preact にも preact/compat という互換の仕組みがあって、同じように読み込み先を付け替えて使えるはずです。

どうやら作者の Tanner も、最初は Preact を試したそうです。ところが preact/compat は React 19 の新しい API に追いついていなくて、`use()` や Server Actions、portal、エラー境界、hydration で問題が次々に出ました。直すたびに回避策の上に回避策を重ねることになり、5 つ目あたりで諦めたと書いています。

https://tannerlinsley.com/posts/projecting-react

そこで、React の公開 API を出発点にして、自分のサイトで使う分だけを作り直したのが Redact の始まりです。Preact は公式に「React の再実装は目指していない」と書いているので、React 19 との互換を基準に作る Redact とは、出発点が逆なんですね。

## 入れてみた

まずは、Vite で作った React のひな形にそのまま入れてみました。

```sh
npm create vite@latest redact-tryout -- --template react-ts
cd redact-tryout
npm install -D @tanstack/redact
```

`vite.config.ts` に `redact()` を足して、ビルドした JS の大きさを比べます。

| | JS | gzip |
|---|---:|---:|
| React | 222.4KB | 69.3KB |
| Redact | 54.4KB | 20.8KB |

gzip で 69.3KB が 20.8KB になって、7 割も減りました！`src/` は 1 文字も触っていません。ひな形のアプリは中身のほとんどが React 本体なので、その React が 3 分の 1 になった分がそのまま差分として現れています。

### 実際のアプリだと 2 割

ひな形には React くらいしか入っていないので、ふだん運用しているアプリでも試しました。TanStack Router、TanStack Query、Ark UI、dnd-kit、react-hook-form が入っていて、React Compiler も使っているアプリです。

こちらも足したのは `vite.config.ts` の 2 行だけで、ビルドはエラーも警告もなく通りました。

| gzip | React | Redact | 差 |
|---|---:|---:|---:|
| 最初に読む JS | 168KB | 129KB | −39KB（−23%） |
| 全部の JS | 614KB | 574KB | −40KB（−7%） |

減った量は約 40KB で、ひな形のときとほぼ同じです。小さくなるのは React 本体の分だけなので、当然ながらライブラリや画面のコードが多いアプリほど、減る割合は小さくなります。それでも、最初の表示で読む JS が 2 割減るのはうれしいです。

画面もひととおり触ってみました。ページの移動、戻る・進む、無限スクロール、メニューやダイアログ、フォームの入力チェック、検索まで、コンソールにエラーは出ませんでした。保存や送信のような書き込む操作は試していません。

## 何を手放したの？

React が 3 分の 1 になるなら、何かを削っているはずです。Redact が手放したのは、**重い描画の途中で手を止めて、ユーザーの入力を先に通す機能**です。

検索欄に打つたびに、下の大きなリストが絞り込まれる画面を考えてみます。React は、リストを描いている途中でもキーが押されたら手を止めて、先に入力欄へ文字を出せます。リストはあとから追いつきます。`useTransition` は、React に「このリストは後回しでいいよ」と伝えるための印です。

Redact は描画を全部同期で走らせるので、リストを描き始めたら最後まで止まりません。その間に打った文字は待たされます。公式も「重い描画で入力が遅れることがあるので、いちばん重い画面で試してほしい」と書いています。

### 4 通り試してみた

本当にそうなるのか、ひな形のアプリで確かめました。入力欄に打つたびに、描くのに約 0.3 秒かかるリストを描き直す画面です。

```tsx
// 1 件ごとにわざと 1ms かけて、300 件で約 0.3 秒
const SlowList = memo(function SlowList({ query }: { query: string }) {
  const items = Array.from({ length: 300 }, (_, i) => `${query} #${i}`)
  return <ul>{items.map((text) => <SlowItem key={text} text={text} />)}</ul>
})

const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  setInput(e.target.value)
  startTransition(() => setQuery(e.target.value))
}
```

React と Redact のそれぞれで、`useTransition` ありとなしを切り替えて、入力欄に速く打ってみました（開発モードで試しています）。

| | `useTransition` あり | なし |
|---|---|---|
| React | 入力欄はすぐ出る。リストだけ遅れる | 固まる |
| Redact | 固まる | 固まる |

予想どおり、入力がサクサク動いたのは React で `useTransition` ありのときだけでした。Redact では、`useTransition` を付けても付けなくても同じように固まります。`useTransition` 自体は呼べて、エラーも出ません。ただ、入力を先に通す効果はなくて、いつも `useTransition` なしの React と同じ動きになります。

ちなみに、リストを `memo` で包むのを忘れると、React でも固まります。入力のたびに、急ぎの描画の側でもリストが描き直されてしまうからです。最初これでハマって、React も Redact も両方固まって「あれ？」となりました（笑）

### 重い描画がなければ差は出ない

裏を返すと、描画が軽い画面では違いが出ません。ふつうのフォームや一覧なら描画は数ミリ秒で終わるので、固まる時間そのものがないからです。Redact を入れられるかどうかは、入力しながら重い描画が走る画面があるかどうかで決まります。

## おわりに

Redact は、`vite.config.ts` に 2 行足すだけで React 本体を 3 分の 1 にしてくれました。ひな形なら 7 割、実際のアプリでも最初に読む JS が 2 割減って、ふつうに触る範囲では何も壊れませんでした。

手放すのは、重い描画の途中で入力を先に通す機能です。入力しながら重い描画が走る画面がなければ、ほとんど気にしなくてよさそうです。

外すときもプラグインの 1 行を消すだけなので、まずはお手元のアプリに入れてみるのが早いかと思います。まだ 0.x なので、本番に入れるなら版を固定しておくと安心です。
