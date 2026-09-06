---
title: useSyncExternalStore は何をしているのか
description: React の外にある値を読むためのフックです。useState と useEffect で書いた版と比べながら、なぜ専用のフックが必要なのか、tearing とは何か、getSnapshot の制約がどこから来るのかを調べます。
pubDate: 2026-09-06
tags: [React, 状態管理]
draft: false
---

## はじめに

ある日、いつものように claude にコードを書かせていると、急に `useSyncExternalStore` という謎のフックが出てきました。見たことがなかったし、何をしているのか分からなかったので、そのときはとりあえず書き直させておきました。

が、気になったのであとで調べてみると、どうやら Zustand や React Redux、TanStack Query の中身でも使われているフックらしいと分かりました。状態管理ライブラリの中身は前から気になっていたところだったので、ちょうどいいやと思い、調べてみました。

## 「React の外にある値」とは何か

名前に `ExternalStore` とある通り、このフックは「外部ストア」を読むためのものです。まず、この外部ストアが何を指すのかを確認します。

たとえば次のようなものです。

- `navigator.onLine` — ブラウザがオンラインかどうか
- `window.innerWidth` — ウィンドウの幅
- `localStorage` の中身
- Redux や Zustand が持っているストア

バラバラに見えますが、共通点があります。**どれも React の外に値があり、React はその値が変わったことを自力では知れない**という点です。

`useState` で持っている値なら、`setState` を呼んだのは React 自身なので、変わったことが分かります。一方で、 `navigator.onLine` は、React がまったく関知しないところで勝手に切り替わります。だから「変わったら教えてもらう」仕組みが別途必要になります。

## useState と useEffect で書いてみる

この「教えてもらう」仕組みは、`useState` と `useEffect` があれば自分で書けます。オンライン状態を読むフックを実装してみましょう。

```tsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
}
```

やっていることは3つです。外部の値を読んで state に入れ、変更イベントを購読し、変わったら `setState` で React に伝えます。まぁ特別難しいことはありませんね。

## 同じものを useSyncExternalStore で書く

これを `useSyncExternalStore` で書き直してみます。

```tsx
function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

引数は3つです。さっきのとどこに対応しているかを並べてみます。

| 引数 | 役割 | さっきのやつ |
| --- | --- | --- |
| `subscribe` | 変更を購読し、解除関数を返す | `useEffect` の中身 |
| `getSnapshot` | 現在の値を読む | `navigator.onLine` を読む部分 |
| `getServerSnapshot` | サーバーレンダリング時に読む値 | （`useState` 版には無い） |

`useState` が消えていますね。さっきは「外部の値を React の state に**コピーして**持つ」形でしたが、こちらは値を持ちません。`getSnapshot` を必要なときに呼んで、その場で読みます。

`getServerSnapshot` だけは対応するものがありません。サーバー上には `window` も `navigator` も無いので、`getSnapshot` をそのまま呼ぶことはできません。そこでサーバーと hydration のときだけ使う別の関数を渡します。SSR しないなら省略できますが、省略した状態でサーバーレンダリングするとエラーになります。

書き換えてみると、やっていることはさっきとほとんど同じに見えます。違いが出るのは、レンダリングが途中で中断されたときです。

## 違いはレンダリングが中断されたときに出る

React 18 から入った concurrent rendering では、React はレンダリングを**途中で中断して、あとから再開できる**ようになりました。コンポーネントツリーを一度に描き切るのではなく、少し描いてはブラウザに制御を返して、また少し描く、という進み方をします。`startTransition` で囲んだ更新などがこれにあたります。

中断している間、ブラウザは他の仕事をします。タイマーが発火したり、`fetch` の結果が返ってきたり、イベントハンドラが動いたりします。もしここで**外部ストアが書き換わる**と、中断の前に描いた部分と後に描いた部分で、違う値を読んでしまいます。

分かりやすくするために、カウンタを持つだけのストアを用意します。

```tsx
let count = 0;
const listeners = new Set<() => void>();

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return count;
  },
  increment() {
    count += 1;
    listeners.forEach((listener) => listener());
  },
};
```

これを `useState` 版のフックで読み、同じ値を表示する項目をたくさん並べます。

```tsx
function Item() {
  const value = useCount();
  return <li>{value}</li>;
}
```

この一覧を `startTransition` の中でレンダリングし、レンダリングの途中で `store.increment()` が呼ばれたとしましょう。すると、

1. 最初の何個かの `Item` は `count === 0` を読んでレンダリングされる
2. React がブラウザに制御を返す
3. その隙に `count` が `1` になる
4. React がレンダリングを再開し、残りの `Item` は `count === 1` を読む
5. これらがまとめて画面に反映される

結果として、**同じ値を表示しているはずの一覧に `0` と `1` が混ざってしまいました**。

同期的にレンダリングされる場合は起きません。中断が挟まらないので、ストアが書き換わる隙など無いからです。concurrent rendering が「中断できる」という性能上の利点を手に入れた代わりに、外部の値を読むコードに開いてしまった穴だと言えます。

## なぜ useState は壊れないのか

じゃあさっき自前で実装したとき、`useState` で持っている値も、レンダリングの途中で `setState` されたら同じことが起きるのでは？と、思うところですが、これは起きません。なぜかというと、**その値を持っているのが React 自身だから**です。

`useState` の値は、React が内部で各コンポーネントに紐づけて管理しています。レンダリングの途中で `setState` が呼ばれても、進行中のレンダリングが読む値がその場で書き換わることはありません。更新は「次のレンダリングでやること」としてキューに積まれるだけです。しかも React は、より優先度の高い更新が入ってきたときに、**進行中のレンダリングを捨ててやり直す**という判断ができます。値が変わったことを React が知っているからこそ、そういう判断ができるわけです。

一方、外部ストアにはこれがありません。`count += 1` は React の関知しないところで起きるので、React は「値が変わったのでやり直す」という判断のしようがありません。**変わったことを知らないまま**、古い値で描いた部分と新しい値で描いた部分を、そのまま画面に出してしまいます。

`useState` と外部ストアの違いは、値の置き場所ではなく、**変化を React が把握できるかどうか**にあります。

## React はどうやって防いでいるのか

`useSyncExternalStore` は、この「知らないまま進んでしまう」ところにチェックを入れます。

レンダリング中、React は各コンポーネントで `getSnapshot` を呼んで値を読み、**そのとき読んだ値を覚えておきます**。そして画面に反映する直前に、覚えておいた値と、今あらためて `getSnapshot` を呼んで得た値を突き合わせます。ズレていたら、そのレンダリング結果は捨てます。

捨てたあと、React はレンダリングをやり直します。このとき使うのが**同期レンダリング**です。同期レンダリングは中断されないので、その間に外部ストアが書き換わることがありません。全コンポーネントが必ず同じ値を読むので、ズレは起きません。

つまりこのフックは、ズレを検知したら **concurrent rendering をやめる**ことで整合性を守っています。名前の頭についている `Sync` は、ここを指しているんですね。

`startTransition` で囲んだ更新の途中でストアが変わった場合も同じです。React はその更新を中断可能な扱いから外し、ブロッキングな更新として処理し直します。せっかく「重い処理を後回しにする」ために transition を使ったのに、外部ストアが絡むと後回しにできなくなる、ということが起こり得ます。

整合性と中断可能性は同時には取れず、`useSyncExternalStore` は整合性のほうを選んでいる、という設計になっています。

## getSnapshot には厳しい約束がある

ここまでの仕組みから、`getSnapshot` に課される制約が出てきます。

React は再レンダリングが必要かどうかを、`getSnapshot` が返した値の `Object.is` 比較で判断しています。前回と違う値が返ってきたら「ストアが変わった」とみなします。ということは、**中身が変わっていないのに毎回違う値を返す `getSnapshot`** を書くと、React は永久に「変わった」と判断し続けます。

やりがちなのがこれです。

```tsx
function getSnapshot() {
  return { todos: store.todos };
}
```

オブジェクトリテラルなので、呼ばれるたびに別のオブジェクトが返ります。中身が同じでも `Object.is` は `false` になり、再レンダリング、また `getSnapshot`、また別のオブジェクト、と無限ループに入ります。開発モードでは `The result of getSnapshot should be cached to avoid an infinite loop` という警告が出ます。

正しくは、ストア側で値をキャッシュしておき、**変わったときだけ新しいオブジェクトを作る**ようにします。

```tsx
function getSnapshot() {
  return store.todos;
}
```

`navigator.onLine` の例で問題が起きなかったのは、返しているのが真偽値というプリミティブだったからです。オブジェクトや配列を返す瞬間に、この制約が効いてきます。

`subscribe` にも似た話があります。レンダリングのたびに違う関数を渡すと、React はそのつど購読し直します。だから最初の例では `subscribe` をコンポーネントの外に置きました。コンポーネント内で組み立てる必要があるなら `useCallback` で固定します。

どちらも「同じ状況なら同じものを返す」という要求です。React が値の変化を検知する手段が `Object.is` しかない以上、これは避けようがない制約です。

## 誰が使っているのか

冒頭に挙げたライブラリが、実際にどう使っているかを見てみます。

**Zustand** は、ストアの `subscribe` と `getState` をそのまま渡しています。

```tsx
const slice = React.useSyncExternalStore(
  api.subscribe,
  React.useCallback(() => selector(api.getState()), [api, selector]),
  React.useCallback(() => selector(api.getInitialState()), [api, selector]),
);
```

`getServerSnapshot` に `getInitialState` を渡しているのが目を引きます。サーバーではまだ何も操作されていないので、初期状態を返せばよい、という判断です。

**TanStack Query** も同じ形です。

```tsx
React.useSyncExternalStore(
  React.useCallback(
    (onStoreChange) => observer.subscribe(notifyManager.batchCalls(onStoreChange)),
    [observer],
  ),
  () => observer.getCurrentResult(),
  () => observer.getCurrentResult(),
);
```

キャッシュを持っているのは `QueryClient` であって React ではありません。React から見れば、これも外部ストアです。

**React Redux** だけは少し違い、`useSyncExternalStoreWithSelector` という別のフックを使っています。

```tsx
const selectedState = useSyncExternalStoreWithSelector(
  subscription.addNestedSub,
  store.getState,
  getServerState || store.getState,
  wrappedSelector,
  equalityFn,
);
```

これは `use-sync-external-store` という npm パッケージが提供しているもので、セレクタと比較関数を追加で受け取れます。`useSelector` は「ストア全体のうち一部だけを取り出す」フックなので、取り出した結果をどう比較するかを指定できる必要があります。素の `useSyncExternalStore` は `Object.is` 固定なので、その外側に一段かぶせている形です。

3つとも構造は同じです。**状態の本体は React の外にあり、React はそれを購読して読むだけです**。状態管理ライブラリを作ろうとすると必然的にこの形になるので、どれも同じフックに行き着きます。

## まとめ

`useSyncExternalStore` は、React の外にある値を安全に読むためのフックでした。

- 対象は「React が変化を自力で知れない値」。ブラウザ API と、状態管理ライブラリのストアが代表例です
- `useState` と `useEffect` でも似たものは書けますが、レンダリングが中断されたときにコンポーネント間で値がズレます
- このフックは、画面に反映する直前にストアの値を検査し、ズレていたら同期レンダリングでやり直します
- その代償として、中断可能なレンダリングの利点は失われます。名前の `Sync` はそこを指しています
- `getSnapshot` は変化していなければ同じ値を返す必要があります。`Object.is` で比較されるためです

アプリのコードで直接書く機会は、ブラウザ API を読むときくらいだと思います。ただ、状態管理ライブラリを使っているなら、その下では必ずこれが動いています。中身が気になったときの入り口としてちょうどよさそうです。

## 参考

- [useSyncExternalStore – React](https://react.dev/reference/react/useSyncExternalStore)
- [How useSyncExternalStore() works internally in React?](https://jser.dev/2023-08-02-usesyncexternalstore/)
- [pmndrs/zustand — src/react.ts](https://github.com/pmndrs/zustand/blob/main/src/react.ts)
- [reduxjs/react-redux — src/hooks/useSelector.ts](https://github.com/reduxjs/react-redux/blob/master/src/hooks/useSelector.ts)
- [TanStack/query — packages/react-query/src/useBaseQuery.ts](https://github.com/TanStack/query/blob/main/packages/react-query/src/useBaseQuery.ts)
