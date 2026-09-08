---
title: use() はなぜフックのルールを守らなくていいのか
description: React 19 で入った use() は、Promise と Context を読むための API です。if や for の中で呼べるのはなぜか、代わりにどんな制約が付くのかを調べます。
pubDate: 2026-09-07
tags: [React]
draft: false
---

## はじめに

React 19 に `use()` という API が入りました。名前に `use` が付いているので一見フックの仲間に見えますが、じつは`if` の中でも `for` の中でも呼べます。「フックはコンポーネントのトップレベルでのみ呼ぶ」という、React がずっと言い続けてきたルールから外れています。

長く守られてきたルールに例外ができたのが気になったので、`use()` が何を読むための API なのか、なぜ外れていられるのかを調べました。

## use() は何を読むのか

`use()` が受け取れるものは2つだけです。Promise と Context です。

```tsx
import { use } from 'react';

const message = use(messagePromise); // Promise の解決値
const theme = use(ThemeContext);     // Context の値
```

Promise を渡せば解決後の値が返り、Context を渡せば直近の Provider が持っている値が返ります。返ってくるものはまったく別物ですね。

ただ、この2つには共通点があります。**どちらもコンポーネント自身が持っている値ではない**という点です。`useState` や `useRef` は、コンポーネントごとに値を覚えておくためのフックでした。一方 `use()` が返す値は、Context ならツリーの上にある Provider から、Promise なら渡された Promise そのものから来ます。`use()` を呼んだコンポーネントの側には、覚えておくものが何もありません。

既存の API との対応で言うと、`use(context)` は `useContext(context)` と同じ値を返します。`use(promise)` のほうに対応するフックはありません。React 19 で新しく読めるようになったのはこちら側です。

## Promise を読む

Promise から値を取り出すには、本来なら `await` を使います。ですが、クライアントコンポーネントを `async` 関数にすることはできないので、コンポーネントの中で `await` は書けません。`use()` はここを埋めるためのものです。

たとえばサーバーコンポーネント側で fetch を始めて、その Promise をそのままクライアントコンポーネントに渡します。

```tsx
import { Suspense } from 'react';
import { fetchMessage } from './lib';
import { Message } from './message';

export default function App() {
  const messagePromise = fetchMessage(); // await しない

  return (
    <Suspense fallback={<p>読み込み中...</p>}>
      <Message messagePromise={messagePromise} />
    </Suspense>
  );
}
```

受け取る側で `use()` を呼びます。

```tsx
'use client';

import { use } from 'react';

export function Message({ messagePromise }: { messagePromise: Promise<string> }) {
  const message = use(messagePromise);
  return <p>{message}</p>;
}
```

`use(messagePromise)` の行で、Promise が解決するまでこのコンポーネントのレンダリングは中断されます。中断している間は、直近の `<Suspense>` の `fallback` が表示されます。解決すると再開して、`message` に中身が入った状態でレンダリングが続きます。

`useEffect` で fetch して `useState` に入れる形と比べると、ローディング用の state が消えているのが分かります。「まだ来ていない」という状態をコンポーネントの中で持つ必要がなくなり、その表示は `<Suspense>` の担当になります。

失敗したときも同じ考え方です。Promise が reject されると、その値は直近の Error Boundary に飛びます。

```tsx
<ErrorBoundary fallback={<p>読み込みに失敗しました</p>}>
  <Suspense fallback={<p>読み込み中...</p>}>
    <Message messagePromise={messagePromise} />
  </Suspense>
</ErrorBoundary>
```

待っている間の表示は `Suspense`、失敗したときの表示は Error Boundary、成功したときの表示だけがコンポーネント本体、という分かれ方になります。

## Context を読む

こちらは `useContext` の置き換えです。返る値は同じで、直近の Provider の値、無ければ `createContext` に渡した既定値です。

```tsx
function Button() {
  const theme = use(ThemeContext);
  // ...
}
```

これだけだと名前が短くなっただけに見えますが、違いは呼べる場所にあります。`useContext` はコンポーネントのトップレベルでしか呼べないのに対し、`use()` は `if` の中で呼べます。

```tsx
function HorizontalRule({ show }) {
  if (show) {
    const theme = use(ThemeContext);
    return <hr className={theme} />;
  }
  return false;
}
```

`for` の中でも呼べます。早期 return より後ろでも呼べます。

`useContext` でこれを書くと lint に怒られるので、条件に関係なくトップレベルで読んでおいて、使うかどうかを後で分岐する形になります。読む必要がない場合まで読むことになりますが、これはフックのルールを守るために仕方なくそうしているだけで、Context の側の都合ではありません。`use()` はその「仕方なく」が要らなくなります。

前の節の Promise と組み合わせることもできます。Context に Promise を入れて配っている場合は、こう書けます。

```tsx
function Profile() {
  const userPromise = use(UserContext);
  const user = use(userPromise);
  return <h1>{user.name}</h1>;
}
```

1行目が Context の読み取り、2行目が Promise の読み取りです。同じ関数が2つの役割を持っているので少し面食らいますが、渡したものの種類で動きが決まります。

## なぜフックのルールから外れられるのか

そもそもフックのルールが何のためにあるのかを先に確認します。

### フックは呼ばれた順番で値を対応づけている

`useState` を呼ぶとき、React には「この state の名前」を伝えていません。

```tsx
const [name, setName] = useState('');
const [age, setAge] = useState(0);
```

`name` や `age` という変数名は JavaScript 側だけの話で、React には届いていません。では React はどうやって前回の値と対応づけているかというと、**呼ばれた順番**です。コンポーネントごとにフックの値を並べて持っていて、1回目の `useState` は1番目、2回目は2番目、と番号で紐づけます。

だから順番が変わると壊れます。

```tsx
function Form({ showName }) {
  if (showName) {
    const [name, setName] = useState(''); // ❌
  }
  const [age, setAge] = useState(0);
}
```

`showName` が `true` の間、`age` は2番目の値を読んでいます。`false` になった瞬間に `useState` の呼び出しは1回だけになるので、`age` は1番目の値、つまり `name` のために置かれていた `''` を読みます。

「フックはトップレベルでのみ呼ぶ」というルールは、これを防ぐためのものです。言い換えると**毎回同じ順番で同じ回数呼べ**という要求で、番号がずれないことを保証しています。

### use() は番号を持たない

`use()` はコンポーネントに値を覚えさせません。ここが分かれ目です。

Context の場合、React は呼び出したコンポーネントからツリーを上に辿って Provider を探します。このとき手がかりにするのは、渡された Context オブジェクトそのものです。`ThemeContext` を渡せば `ThemeContext.Provider` が見つかります。何番目に呼ばれたかという情報は使っていません。

Promise の場合は、Promise 自身が値の置き場所になります。React は渡された Promise オブジェクトに解決結果を書き込んでおき、次にレンダリングされたときは同じオブジェクトからそれを読みます。値が付いているのは Promise であって、コンポーネントの何番目のスロットでもありません。

つまり `use()` は、レンダリングをまたいで値を対応づけるのに呼び出し順を使っていません。使っていないので、順番がずれても壊れるものがありません。`if` の中でも `for` の中でも早期 return の後でも呼べるのは、そういう理由です。

React の公式ドキュメントが `use` をフックと呼ばず「API」と呼んでいるのも同じ話だと思います。`eslint-plugin-react-hooks` の `rules-of-hooks` も、`use` についてだけは条件分岐とループの中での呼び出しを許可しています。

## 代わりに付く制約

呼ぶ場所は自由になりましたが、代わりの制約が3つ付いています。

### Promise はレンダリングのたびに作らない

いちばん踏みやすいのがこれです。

```tsx
function Albums() {
  const albums = use(fetch('/albums')); // ❌
  // ...
}
```

`fetch()` はレンダリングのたびに新しい Promise を返します。前の節のとおり、React は Promise オブジェクトそのものを値の置き場所にしているので、毎回違うオブジェクトが来ると前回の結果を見つけられません。未解決の Promise として扱って中断し、フォールバックを出し、再開してまた新しい Promise を作る、という繰り返しになります。

渡す Promise は、レンダリングの外で作られたものである必要があります。サーバーコンポーネントで作って渡す、フレームワークのキャッシュ層から取る、といった形です。クライアントで作るなら、`useState` の初期化関数に入れて固定する手があります。

```tsx
const [albumsPromise] = useState(() => fetchData('/albums'));
```

初期化関数は初回レンダリングでしか呼ばれないので、同じ Promise が返り続けます。

なお公式ドキュメントには、`promise.status` を直接読んで、解決済みなら `use()` を呼ばずに済ませる、という書き方をしないよう注意があります。解決済みかどうかの判断は React に任せる形になっています。

### try...catch で囲めない

`use()` は中断するときに内部で throw します。Suspense はこの throw を受け取って `fallback` に切り替えるので、`try...catch` で囲むと、その throw を横から掴んでしまいます。

```tsx
try {
  const message = use(messagePromise); // ❌
} catch {
  // 中断のための throw まで捕まえる
}
```

React はこれを検知して `Suspense Exception: This is not a real error!` という警告を出します。エラーではないものが例外として飛んでいる、という意味です。Promise が reject されたときの処理を書きたい場合は、`try...catch` ではなく Error Boundary を置きます。

### コンポーネントかフックの中でしか呼べない

`if` や `for` の中では呼べますが、コンポーネントの外では呼べません。イベントハンドラの中や、コンポーネントの外に置いた普通の関数の中では使えません。この点はフックと同じです。

`use` という接頭辞が付いているのは、ここを守らせるためだと思います。名前で呼べる場所を示す、という規約自体は変わっていません。

## まとめ

`use()` は Promise と Context を読むための API でした。

- 渡せるのは Promise と Context の2つです。Promise を渡すと解決まで中断して `Suspense` に、reject されたら Error Boundary に渡ります
- `if` や `for` の中で呼べます。フックのルールが守っていた「呼び出し順」を、`use()` は値の対応づけに使っていないためです
- 値の置き場所は、Context ならツリー上の Provider、Promise なら Promise オブジェクト自身です。どちらもコンポーネントの側には何も残りません
- 代わりに、渡す Promise はレンダリングの外で作る、`try...catch` で囲まない、コンポーネントかフックの中で呼ぶ、という制約が付きます

フックのルールが「React の決まりごと」ではなく、**呼び出し順でフックの値を対応づけている実装から出てきた制約**だったことが、外れられる側を見てはっきりしました。

## 参考

- [use – React](https://react.dev/reference/react/use)
- [RFC: First class support for promises and async/await – reactjs/rfcs #229](https://github.com/reactjs/rfcs/pull/229)
- [rules-of-hooks – React](https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks)
- [React 19 – React Blog](https://react.dev/blog/2024/12/05/react-19)
