---
title: Tailwindの代替？StyleXについて調べてみた
description: MetaのStyleXについて調べた記録。Tailwindとの構造の違いを中心に見ていきます。そのあと、実際に採用するなら支払うことになる代償についても考えます。
pubDate: 2026-08-28
tags: [CSS, StyleX, TypeScript, 設計]
draft: false
---

## はじめに

最近、TwitterでStyleXなるものが少し話題になっていました。Metaが作っているスタイリングライブラリで、Tailwindの代替として名前が挙がっています。

正直、名前を見た時点では「またCSS-in-JSかぁ」くらいに思っていました。実行時にスタイルを注入するタイプのライブラリは性能の問題で一度下火になったはずで、いまさら戻る理由が思いつかなかったからです。

ただ調べてみると、StyleXは実行時ではなくビルド時に静的なCSSを吐くコンパイラでした。しかもMeta本体（Facebook、Instagram、WhatsApp、Messenger、Threads）で標準として動いていて、外部でもFigmaやSnowflakeが採用しています。一過性の流行にしては、ずいぶん実績があります。

というわけで、じゃあ具体的に何が嬉しいのかを調べました。この記事は、Tailwindと比べて**構造的に違う**と感じた点を3つに絞って見ていきます。

（追記）ムーザルちゃんねるでもStyleXが紹介されてました！

https://x.com/moozaru_ch/status/2092932805286404344

## 1. スタイルの受け渡しを型の契約にできる

StyleXでいちばん他と違うのが、ここだと思っています。

コンポーネントの見た目を外から少しだけ変えたいとき、素直にやるならスタイルを受け取るpropを開けることになります。

```tsx
type Props = { className?: string };

function Card({ className }: Props) {
  return <div className={`rounded border p-4 ${className}`} />;
}
```

問題は、このpropの型は`string`だということです。つまり、**何を渡してもコンパイラは通してしまいます**。`p-4`を上書きするつもりで`p-8`を渡しちゃったり、`position: fixed`相当を渡してレイアウトを壊しても当然エラーは出ません。「余白だけ調整してほしい、それ以外は触らないで」という設計者の意図は、お願いでしかありませんでした。

StyleXでは、この意図をそのまま型に書けます。

```ts
import type { StyleXStyles } from '@stylexjs/stylex';

type Props = {
  style?: StyleXStyles<{
    color?: 'red' | 'blue' | 'green';
    padding?: 0 | 4 | 8 | 16 | 32;
  }>;
};
```

受け付けるプロパティを制限できるだけでなく、**値の側も列挙で縛れます**。`padding: 6`は書けません。デザイントークンから外れた値が入ってくる経路が、レビューではなくコンパイルで閉じます。

逆向きの制約も用意されていて、「これだけは受け付けない」は`StyleXStylesWithout<>`、「このプロパティと値だけ」と完全に固定するなら`StaticStyles<>`を使います。

CSSの世界では長いこと、「スタイルの受け渡し」は文字列でやるものでした。`className`も`style`属性の文字列も、どこまで自由に上書きできるかは型に現れません。StyleXはそこを、**関数の引数と同じ扱いに引き上げています**。何を受け取るかを宣言し、宣言していないものは渡せません。

## 2. 合成の結果が決定的に決まる

これも地味に嬉しいポイントです。

スタイルを複数重ねたとき、どれが勝つのか。CSSではこれが詳細度と記述順の合成関数で決まります。そしてファイルをまたぐと追いきれず、`!important`が乱立します。これが制御できず何度頭を抱えたことか...

StyleXではこの悩みが消えます！**勝つのは最後に渡したものです。**

```tsx
const styles = stylex.create({
  base: { fontSize: 16, lineHeight: 1.5, color: 'grey' },
  highlighted: { color: 'rebeccapurple' },
});

// 紫
<div {...stylex.props(styles.base, styles.highlighted)} />

// グレー
<div {...stylex.props(styles.highlighted, styles.base)} />
```

引数の順序がそのまま優先順位です。詳細度は関係ありません。StyleXは1プロパティ1宣言のアトミックなクラスを吐き、それらをCSSの`@layer`で並べるので、**どのクラスも必ず同じ強さになります**。あとは`stylex.props`が、同じプロパティを持つクラスのうち後ろのものだけを残してくれます。

これは「文字列を連結する」方式とは別物です。`className`の連結では、`p-4 p-8`のように同じプロパティを指す2つが両方DOMに残ります。どちらが効くかはCSSファイル内での順序で決まるので、書いた順とは無関係です。そのためTailwindでは`tailwind-merge`のような、**クラス名同士の衝突を知っている外部の辞書**が必要ですが、StyleXでは合成がライブラリ側の責務なので、この層自体がそもそも存在しません。

条件分岐はJSと同じように書けます。

```tsx
<div
  {...stylex.props(
    styles.base,
    props.isHighlighted && styles.highlighted,
    isActive ? styles.active : styles.inactive,
  )}
/>
```

`false`や`null`は無視されます。`clsx`のような補助関数はもう要りません。

## 3. 動的な値も実行時のスタイル注入なしで扱える

ビルド時に値が分からないスタイルもあります。ドラッグ中の座標、計算結果の高さ、ユーザーが選んだ色。従来のCSS-in-JSはここで実行時に`<style>`を作って挿していました。そしてこれがCSS-in-JSの性能問題の中心でした。

StyleXなら、関数を書けます。

```tsx
const styles = stylex.create({
  bar: (height) => ({ height }),
});

function MyComponent() {
  const [height, setHeight] = useState(10);
  return <div {...stylex.props(styles.bar(height))} />;
}
```

コンパイル後、`height`はCSS変数を参照するアトミッククラスに変わり、**実際の値はインラインのCSS変数として渡ります**。新しいCSSルールは実行時に一切生成されません。クラスの集合はビルド時に確定していて、変わるのは変数の中身だけです。

Tailwindの側でこれをやろうとすると、`style={{ height }}`に落とすか、CSS変数を自分で用意することになります。できないわけではありませんが、**動的な部分だけがユーティリティの体系から外れます**。StyleXでは同じ`stylex.create`の中に収まったままです。

なお、デザイントークンも同じ考え方で扱えます。`stylex.defineVars`で定義したトークンはコンパイル時にCSS変数になりますが、こちらが触るのは`tokens.accent`という型のついたJavaScriptの値です。`--color-accent`のようなマジックストリングは出てきません。

## 代償

ここまで利点を並べましたが、じゃあ今すぐ採用するかというと、それは別の話です。以下はv0.19.0時点の話で、いくつかは公式のv1.0.0ロードマップにも課題として載っています。

### 書く量が倍になる

Tailwindで作ったコンポーネントライブラリをStyleXに移植した[実測の記事](https://blog.logrocket.com/tailwind-css-vs-stylex-a-real-migration-with-20-components/)があります。20コンポーネントで、**1,568行が3,143行になっています**。ちょうど2倍です。

`stylex.create`でオブジェクトに包み、名前をつけ、`stylex.props`で展開する。この往復が毎回必要になります。1つしかスタイルが無くてもオブジェクトに包む必要があるので、`class="p-4"`と1箇所書けば終わる世界からは、かなり遠いです。冗長さはStyleX側も認識していて、ロードマップには`sx()`の追加やインラインスタイルの検討が並んでいます。

### CSSなら1行のことが、JavaScriptのコードになる

任意のセレクタが書けません。`:last-child`も`>`も`[data-*]`も使えません。

「フォームの最後の行だけmargin-bottomを消す」は、`:last-child`が使えないのでindexを持ち回る話になります。「親をhoverしたら子を表示する」に至っては、CSSなら`.parent:hover .child { opacity: 1 }`の1行で済むものが、stateとpropの受け渡しになります。

これは「styling at a distance を許さない」という意図的な設計判断です。2番目に挙げた合成の決定性も、元をたどればこの判断から来ています。ただ、CSSが得意な領域をJavaScriptで書き直すことになるので、素直に高くつきます。`stylex.when.*`という新しいAPIで一部を埋めようとしている最中です。

### 境界をまたげない

これがいちばん重いと思います。

借りる側として、shadcn/uiはTailwindのクラス名を吐く前提なので、そのままでは使えません。そして配る側になると、もっと厄介です。StyleXで書かれたコンポーネントライブラリを公開すると、**利用者側にもStyleXのセットアップを要求します**。`node_modules`の中もコンパイルしてCSSを抽出する必要があるからです。

つまり、StyleXで書いたライブラリは、StyleXを採用したアプリにしか配れません。

## おわりに

「Tailwindの代替になるか」でいうと、少なくとも今のところ、Tailwindをやめる理由にはならないかなぁというのが正直な感想ですね。

ただ、StyleXが持ち込んだものは1つはっきりしていて、**スタイルを文字列ではなく値として扱う**、ということです。値だから型がつけられるし、渡した順序で合成できるし、実行時に中身だけ差し替えられます。

そしてこれは、Tailwindを使い続けるとしても持ち帰れる視点だと思っています。`className?: string`と書いた瞬間、そのコンポーネントは「見た目に関して何を許すか」を放棄しています。渡されたものが余白の微調整なのか、レイアウトを壊す指定なのかを、型で区別する手段がありません。普段はそれで困っていないのですが、困っていないのは自分たちで気をつけているからで、仕組みで防げているわけではないんですよね。

StyleXが刺さるのは、自分でデザインシステムを持っていて、それをコンポーネントのAPIとして他人に配る立場のときだと思います。Metaが作ったのはまさにそれで、逆に週次で機能を出していく規模だと、得られるものより支払うもののほうが大きくなりそうです。

## 参考

- [StyleX — Learn](https://stylexjs.com/docs/learn/)
- [StyleX: A Styling Library for CSS at Scale - Engineering at Meta](https://engineering.fb.com/2025/11/11/web/stylex-a-styling-library-for-css-at-scale/)
- [StyleXStyles<> | StyleX](https://stylexjs.com/docs/api/types/StyleXStyles/)
- [Using styles | StyleX](https://stylexjs.com/docs/learn/styling-ui/using-styles/)
- [[roadmap] StyleX v1.0.0 · Issue #1356 · facebook/stylex](https://github.com/facebook/stylex/issues/1356)
- [Tailwind CSS vs. StyleX: A real migration with 20 components - LogRocket Blog](https://blog.logrocket.com/tailwind-css-vs-stylex-a-real-migration-with-20-components/)
- [Why I Hate Using StyleX at Work - Nathan Redblur](https://nathanredblur.dev/posts/why-i-hate-using-stylex-at-work/)
