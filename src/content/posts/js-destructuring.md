---
title: 分割代入、実はよく分かってないんだよね
description: 分割代入は props やカスタムフックでなんとなく使っていますが、日本語で説明できませんでした。MDN の定義から、配列の分割代入（useState）、名前の変更・デフォルト値・残余プロパティまで調べてみました。
pubDate: 2026-11-13
tags: [JavaScript, React]
draft: false
---

## はじめに

分割代入ってむずいし、よく分かってなくね？とふと思いました。

普段使うとしたら、props とカスタムフックくらいです。

```jsx
function Item({ name, text, onDelete }) {
  // ...
}

const { user, login } = useAuth()
```

もちろん使えはします。props も本当は `props` というオブジェクトで、それを `()` の中にそのまま書いちゃっているのがいつもの使い方、ということくらいは知っています。

でも、なんとなくでしか使っていなくて、分割代入って何？を聞かれると、普通に日本語で説明できないんですよね。

なのでこの記事では、分割代入をちゃんと調べてみます。

## そもそも分割代入って何？

https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/Destructuring

なんかいつの間にか、日本語の名前が「構造分解」に変わっていました。この記事では、使い慣れている「分割代入」のほうでいきます。

MDN には、こう書いてあります。

> 配列から値を取り出して、あるいはオブジェクトからプロパティを取り出して別個の変数に代入することを可能にする JavaScript の構文です。

日本語で一言にすると、「オブジェクトや配列から中身を取り出して、変数に入れる書き方」です。

分割代入を使わずに書くと、こうなります。

```jsx
// 分割代入
const { name, text, onDelete } = props

// 使わずに書くと
const name = props.name
const text = props.text
const onDelete = props.onDelete
```

useAuth も同じです。

```jsx
// useAuth の中
return { user, login }

// 使う側
const { user, login } = useAuth()

// 使わずに書くと
const auth = useAuth()
const user = auth.user
const login = auth.login
```

毎回 `props.` とか `auth.` を書くのがくどいので、返ってきたオブジェクトから、`user` と `login` を同じ名前の変数に取り出しているだけです。

## 配列も分割代入だった

ここまではオブジェクトの話でしたが、定義には「配列から値を取り出して」とも書いてあります。

配列も分割代入できるの？と思ったら、毎日使っていました。

```jsx
const [count, setCount] = useState(0)
```

これが配列の分割代入です。ぜんぜん知らないで使ってました。

`useState` は `[値, 更新する関数]` の配列を返していて、それを前から順に取り出しています。

```jsx
// 使わずに書くと
const state = useState(0)
const count = state[0]
const setCount = state[1]
```

オブジェクトと配列の違いは、何で取り出すかです。

- オブジェクト `{ }`：名前で取り出す
- 配列 `[ ]`：順番で取り出す

そういえば、`useState` はなんでオブジェクトじゃないんだろう、となんとなく思ったこともありました。

順番で取り出すなら、名前は好きにつけられます。`[count, setCount]` も `[name, setName]` も、毎回自分で名前を決められます。たぶん、そのために配列なんだと思います。

ただ、React のドキュメントを見ても、配列にした理由ははっきり書いてありませんでした。古いほうのドキュメントには、`[ ]` は React の機能ではなく JavaScript の配列の分割代入で、左側の名前は好きに決めていい、とだけ書いてあります。

https://legacy.reactjs.org/docs/hooks-state.html

## ほかにもできること

分割代入には、ただ取り出す以外にもできることがあります。

### 名前を変えて取り出す

オブジェクトは名前で取り出すので、基本は同じ名前の変数になります。別の名前にしたいときは、`:` で変えられます。

```jsx
const { user: me } = useAuth()
```

`useAuth()` が返した `user` を、`me` という変数に入れています。これは使ったことがありました。

### デフォルト値をつける

`=` で、値がないときのデフォルト値をつけられます。props でも使えて、React のドキュメントにもそのまま載っていました。

```jsx
function Avatar({ person, size = 100 }) {
  // ...
}
```

`size` を渡さなかったら `100` になります。

ただ、`null` や `0` を渡したときは、デフォルト値は使われません。使われるのは、渡さなかったときと `undefined` を渡したときだけです。

https://react.dev/learn/passing-props-to-a-component

### 残りをまとめて取る

`...` で、取り出さなかった残りをまとめて取れます。shadcn/ui の Button がこの形です（型は省いています）。

```jsx
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  // ...
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

`className` や `variant` だけ取り出して、残りは `props` にまとめて、そのままボタンに渡しています。`onClick` や `disabled` は、ここに入って渡されます。

スプレッド構文とノリは一緒ですね。分割代入の中では「残余プロパティ」という名前がついています。

## おわりに

そもそも分割代入を、定義をきちんと知らずに使っていました。`useState` もなんとなくで使っていたので、分割代入であることに気づいていませんでした。

たまにこういう仕様とかを振り返ってみるのも面白いし、新しい発見があるかもしれません。
