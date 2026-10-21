---
title: TypeScript、Go の次は Rust になるってよ
description: Cloudflare と VoidZero が、TypeScript のコンパイラを Rust に移植した tsrs を発表しました。Go で書かれた TypeScript 7.0 が出たばかりなのに、なぜ今わざわざ Rust なのかを、AI による移植、Microsoft が Go を選んだ理由、Oxc のツールチェーンとの関係から整理します。
pubDate: 2026-10-21
tags: [TypeScript, Rust, AIエージェント, Cloudflare]
draft: false
---

## はじめに

2026 年 10 月 20 日、Cloudflare と VoidZero が、TypeScript のコンパイラを Rust に移植した tsrs を発表しました。Go で書かれた TypeScript 7.0 と比べて、最大 8 倍速く、メモリは約 70% 少ないそうです。すごい。

https://blog.cloudflare.com/typescript-rust-port/

TypeScript のコンパイラといえば、つい最近、7.0 で Microsoft が Go に移植したばかりです。そこへ今度は Rust 版が出てきました。なんで今？しかもなんでわざわざ Rust なの？が気になったので、整理してみました。

## 何が起きたのか

tsrs は、TypeScript のコンパイラ（tsc）を Rust でリライトしたものです。今はまだ実験段階ですが、`npx tsrs` で試せます。

コンパイラが何の言語で書かれているかは、こんなふうに変わってきました。

| 版 | 書かれている言語 | 作っているところ |
|---|---|---|
| TypeScript 6.0 まで | TypeScript（JS にして Node で動かす） | Microsoft |
| TypeScript 7.0（2026 年 7 月） | Go | Microsoft |
| tsrs（実験版） | Rust | Cloudflare と VoidZero |

Go 版の 7.0 で、もう 6.0 の 10 倍くらい速くなっていました。が、tsrs はそこからさらに、型チェックのワーカー数をそろえた条件で最大 8 倍速く、メモリは約 70% 少ないそうです。そんなに変わるんですね。

ブログでは、フォークではないことが強調されています。

> To be clear, we are not forking TypeScript.

言語をどうするかを決めるのは TypeScript チームで、tsrs はその決定についていく立場です。ベンチマークも TS チームと条件をそろえて取っていて、tsrs で見つけた最適化の一部はすでに TypeScript 7.1 beta に入っているそうです。仲はかなり良さそうですね。

## 正解が揃っていると AI は移植が得意

Cloudflare のブログでは、なぜ今なのかを次のように書いています。

> However, frontier AI models can now do large-scale ports almost independently in a matter of days.

最先端の AI モデルなら、大規模な移植を数日でほぼ自力でこなせるようになった、ということです。

TypeScript のコンパイラは、**何が正しいかが最初から全部決まっている**ので、移植の題材としてかなり AI 向きです。お手本の実装があって、リポジトリには「この入力ならこの出力」という形のテストが大量にあります。移植したものにテストを流して、元と同じ結果が出れば正解です。AI が自分で判断して正解を考える場面がほとんどありません。

vinext も同じような感じでした。Next.js の API を Vite の上に作り直したもので、2026 年 2 月に「1 人のエンジニアが AI に指示して、1 週間足らずで作った」と発表されました。このときも Next.js のテストをそのまま持ってきて、機械的に答え合わせできる仕様として使っています。AI に向いていた理由として挙げていたのも、ドキュメントの揃った API、充実したテスト、土台になるビルドツールの 3 つでした。

### 追いかけ続けるのもエージェントに任せる

TypeScript の移植は昔から何度も試されてきましたが、成功したのは Microsoft 自身の Go 版だけだったそうです。書き上げるのも大変ですが、TypeScript は数か月ごとに新しい版が出るので、その後を追いかけ続けるほうがもっと大変だったんだと思います。

vinext では、この追いかける作業もエージェントが回しています。

- 毎朝、エージェントが Next.js の変更を見て、影響しそうなものを issue にする
- 毎晩、Next.js のテストを流して、どこまで互換かの表を作り直す
- ずれが見つかったら、エージェントが原因を探して、再現手順と修正案を出す

tsrs も同じやり方で TypeScript についていく予定です。書くのも追いかけるのも AI がやれるようになって、ようやく移植が現実的になったんですね。すごい時代だなぁ。

## Rust の大変さを AI が引き受けた

そもそも Microsoft は、なんで Rust じゃなくて Go を選んだんでしょうか？これについては typescript-go の FAQ に答えがあって、一番の理由は「元のコードとできるだけ同じ動きを保つこと」でした。移植として進めたかったので、元のコードと書き方が近い言語を選んでいます。

> Idiomatic Go strongly resembles the existing coding patterns of the TypeScript codebase.

メモリ管理やデータ構造を根っこから考え直す必要がある言語は、一から書き直すなら向いているけど今回の移植には向かない、とも書いています。名前は出していませんが、Rust はまさにこのタイプです。

### Rust にはガベージコレクションがない

Rust で考え直しが要るのは、メモリの片付け方です。JS や Go には GC（ガベージコレクション）があって、使い終わったメモリを実行中に自動で片付けてくれます。元の tsc も、GC がある前提で書かれています。

Rust には GC がありません。代わりに「この値の持ち主は誰か」という所有権のルールがあって、いつメモリを捨てるかをコンパイラが決めます。持ち主がはっきりしない書き方はコンパイルが通らないので、元のコードを一行ずつ写せません。

tsrs をどう作ったかの細かい話はブログにありませんが、なぜ今なのかの答えに AI を挙げているので、この組み直しを AI に任せたんだと思います。Microsoft が Go を選んだ理由だった移植の手間が、AI でほぼ消えたことになります。

### Rust だと Wasm で軽く動く

Cloudflare は、Rust を選んだ理由として WebAssembly（Wasm）を挙げています。Wasm はブラウザで JS 以外の言語を動かすための形式で、今は Workers のようなブラウザの外でも動きます。

Go も Wasm にできますが、Wasm 自体には GC がないので、Go の GC も一緒に詰め込むことになります。Rust ならそれが要らないので、小さくかつ軽く動かせます。メモリが少ないぶん、Workers の上でビルドやデプロイを何度も回すときにも有利だそうです。

これで、型チェックをブラウザや Workers、AI エージェントのサンドボックスの中でも動かせるようになります。Wasm 版は `@tsrs/wasm` として npm に出ています。

## 型チェックが Vite 系のツールチェーンに入る

tsc の仕事は、大きく分けて 2 つあります。

- 型を剥がして JS にする
- 型チェックをする

型を剥がすほうは比較的簡単なので、esbuild や SWC、Oxc がずっと前から肩代わりしてくれてました。Vite が速いのもこのおかげです。一方で型チェックは難しく、これまで作れたのは TypeScript チームだけでした。なので Vite のプロジェクトでも、型チェックだけは `tsc --noEmit` を別に回すのが普通でした。

### Oxc も自前の型チェッカーは諦めていた

Oxc のチームも、最初は自分たちで型チェッカーを書こうとしていました。でも、動きの速い TypeScript に追いつき続けるのは無理だとして、諦めています。

> maintaining a type-checker on par with a fast-moving target like TypeScript is not feasible.

代わりに選んだのが、Go 版の TypeScript を借りる道です。Oxlint の型を見るリントは、Go で書かれた tsgolint を別に入れて、Oxlint からそれを呼び出す形で動いています。今はこの仕組みで型エラーも出せるようになっていて、`tsc --noEmit` を別に回さなくても済むようになってきました。

### Rust で全部そろう

tsrs が入ると、この Go の部分も Rust にできます。Vite の下で動く Rolldown、Oxlint、Oxfmt、そして型チェックまで、全部 Rust でそろう見込みです。Cloudflare も、Oxlint の型を見るリントなどに tsrs を深く組み込むことを試すと書いています。これは非常に楽しみですね。

Oxc が型チェッカーを諦めた理由は「追いつき続けられない」でした。今回はそこを、vinext と同じエージェントの運用で乗り越えようとしています。

## おわりに

tsrs が今 Rust で出てきたのは、AI で移植の手間がほぼ消えたからでした。Microsoft が Go を選んだのも、Oxc が型チェッカーを諦めたのも、理由は「人の手では大変すぎる」でした。そこが崩れたので、Wasm で軽く動いて、Oxc とも同じ言語でつながる Rust を選べるようになったんだと思います。

書くのも追いかけるのも AI がやれるなら、人の手に残るのは「何が正しいか」を決める仕事です。フォークではないと強く言っているのも、そこを TypeScript チームに残しておくためなんだと思います。

まだ実験版で、診断メッセージの出る順番など、本家との違いも残っています。安定版までにこの違いを減らしていくそうなので、そこまで来たらまた触ってみたいです。

## 参考

- https://blog.cloudflare.com/typescript-rust-port/
- https://github.com/oxc-project/tsrs
- https://blog.cloudflare.com/vinext/
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://github.com/microsoft/typescript-go/discussions/411
- https://voidzero.dev/posts/announcing-oxlint-type-aware-linting
- https://oxc.rs/blog/2025-12-08-type-aware-alpha
