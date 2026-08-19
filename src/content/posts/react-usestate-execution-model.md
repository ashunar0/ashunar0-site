---
title: useState は変数宣言ではない！React がコンポーネントを呼び直す仕組みを 0 から理解してみる
description: コンポーネントは毎回頭から呼び直されるのに、useState の値だけは残る。記憶が Fiber のどこに保存されているのか、useState が実際に何をしているのかを追う。props と state が同じものである理由、フックのルールが順序の話である理由、配列に push しても画面が変わらない理由が、一本でつながる。
pubDate: 2026-08-20
tags: [React, JavaScript, 設計]
draft: false
---

## はじめに

React って、分かっているつもりで実は分かっていないまま使っていることが多いな、ということに最近気づきました。想像以上に複雑ですし、結局慣れで手が動いてしまうので、原理を確かめる機会がないまま進んでしまうんですよね。

それで公式ドキュメントを改めて読み直してみたのですが、React の基本中の基本である `useState` からして、思った以上に理解できていませんでした。なんとなくでスルーしていたところに、案外大事なことが書いてありました。

この記事では、そこで整理できたことをまとめます。これまで逃げてきた React の複雑さと正面からミクあって、`useState`の正体を突き止めてやろうと思います。

まずは、Reactの大前提に立ち帰ります。

## コンポーネントは毎回、頭から呼び直されている

適当なコンポーネントの一行目に、これを置いてみます。

```jsx
function Counter() {
  console.log('Counter が呼ばれた');

  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

ボタンを押すたびにログが出ます。押した回数だけ出ます。

つまり `setCount` を呼ぶと、React は `Counter` という関数を**もう一度、頭から呼び直しています**。差分だけ更新しているのではなく、関数そのものを最初から実行し直して、返ってきた JSX で画面を作り直しています。

（開発中は Strict Mode が有効なので、ログが 2 回ずつ出ることがあります。React がわざと 2 回呼んで、後述する「純粋性」を壊しているコンポーネントを見つけるための仕掛けです。本番では 1 回です）

まぁこれは正直、普段からReactに触れている人なら当たり前だと感じられるでしょう。自分もそうです。`<Counter />` と書いているものが実際には `Counter()` という関数呼び出しである、というのももちろん知っています。でも、この当たり前も冷静になって見つめてみると、おかしなことに気がつきました。

## それなら count は毎回 0 に戻るはずでは？

さっきのコードをもう一度読んでみます。

```jsx
const [count, setCount] = useState(0);
```

自分はこれを、「`count`という変数を宣言する、初期値は0にする」と読んでいました。

関数が頭から実行し直されるなら、当然この行も毎回実行されます。ということは、`count`は毎回宣言され直されて、毎回 0 になるはずでは？でも実際は 1, 2, 3 と増えていく...。前回の値が保存されていることになにか違和感を感じます。

「まぁそういうものだ」と思考を放棄していましたが、よくよく考えたら変です。

それなら前回の値は、誰が、どこに保存しているのか？それは、**React が、関数の外側に持っています。**

```
  React が持っている記憶            Counter 関数（毎回まっさら）
  ┌──────────────────┐
  │ Counter の状態     │  ←──  useState(0) が問い合わせる
  │   [0] → 3          │  ──→  3 が返る
  └──────────────────┘
```

### 「外側」とは具体的にどこか

React 内部では、この記憶は **Fiber** というオブジェクトに置かれています。コンポーネントのインスタンス 1 つにつき 1 個あって、だいたいこういう中身です。

```
Fiber（<Counter /> 1 つにつき 1 個）
├─ type           … どのコンポーネントか（Counter 関数そのもの）
├─ memoizedProps  … 今回渡された props
├─ memoizedState  … state の記憶
└─ child / sibling / return … ツリー上のどこにいるか
```

`useState` が問い合わせているのは `memoizedState` です。ここに値が **1 番目 → 2 番目 → …** と数珠つなぎに並んでいて、`useState` を呼ぶたびに先頭から順番に取り出されます。名前では引かれません。

Fiber はインスタンスごとにあるので、記憶もインスタンスごとに独立しています。

```jsx
<Counter />   {/* この子の記憶と */}
<Counter />   {/* この子の記憶は別物 */}
```

片方のボタンを押してももう片方が動かないのは、`memoizedState` が別だからです。そして「順番に取り出す」という仕組みが、後で出てくるフックのルールに直結します。

### その前提で useState の中身を見る

保存場所が分かったところで、`useState` が何をしているのかを見てみます。

面白いことに、React には `useState` という 1 つの実装があるわけではありません。**初回のレンダーと 2 回目以降で、呼ばれる関数が違います**。細部を落として書くと、こうなっています。

```js
// 初回のレンダー
function mountState(initialState) {
  const hook = mountWorkInProgressHook();   // memoizedState の末尾に枠を 1 つ足す
  hook.memoizedState = initialState;        // initialState が使われるのはここだけ

  const queue = { pending: null, /* ... */ };
  hook.queue = queue;

  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  return [hook.memoizedState, dispatch];
}

// 2 回目以降のレンダー
function updateState(initialState) {
  const hook = updateWorkInProgressHook();  // memoizedState から順に 1 つ取り出す
  // initialState はどこにも出てこない
  // queue に溜まった更新を適用して、新しい値を作る
  return [hook.memoizedState, hook.queue.dispatch];
}
```

どちらにも、変数を作っている行がありません。やっているのは、**保管されている枠から値を取り出して返す**ことだけです。

そして `initialState`、つまり `useState(0)` の `0` は、**初回の `mountState` にしか登場しません**。2 回目以降の `updateState` は受け取ってはいるものの、一度も参照しないまま捨てています。

「初期値を代入する」ではなく、**まだ枠が無ければ 0 を入れる。あるなら 0 は無視する**。これが `useState(0)` の `0` の正体でした。

`count` という変数自体は毎回まっさらに作り直されています。ただ、その中身を React から受け取っているので 3 になるというだけで、関数は記憶を持っていません。

関数の外にある React の記憶に引っ掛けて、値を取ってきているから、 `useState` に「フック（hooks）」という語彙が当てられるんですね。

## state は props と同じもの

ここで、そもそも宣言的 UI とは何だったかを思い出します。よく `UI = f(state)` という式で説明されるものです。

自分はこれを、**外から与えられた入力をもとに UI を計算して返す**ことだと理解しています。バニラ JS のように「このタグのこの中身を書き換える」と手順を手続的に指示するのではなく、「この入力ならこう表示する」という対応を書く。だから関数なんですね。

その観点で見ると、props と state に意味上の区別はありません。**どちらも UI を決めるために外から与えられる引数**です。違うのは、値を持っているのが誰かだけでした。

| | 値を持っているのは | 受け取り方 |
|---|---|---|
| props | 親コンポーネント | 引数として渡ってくる |
| state | React | `useState` で取りに行く |

親が持っているなら props、React が持っているなら state。`f` の引数が 2 種類あるように見えて、実は出どころが違うだけだったわけです。

### そもそも、なぜ props で渡せないのか

宣言的 UI を理解しようとすると、たとえばこういう関数を思い浮かべます。

```jsx
function Counter(count) {
  return <h1>{count}</h1>;
}
```

「count という入力に対して UI を計算して返す関数」。「このタグのここを書き換える」ではなく「こう表示する」を書く。この認識は完全に正しくて、React が目指しているそのものです。

ただ、この関数は誰かが `count` を渡さないと動きません。親が渡すとして、その親も関数です。呼ばれるたびに頭からまっさらになるので、値を保持できません。さらに上に遡っても同じで、**コンポーネントは全部「毎回まっさらな関数」なので、誰も値を持てません**。

持てるのは、関数ではないもの、つまり **React** だけです。

```jsx
// 親が持っている場合
function Counter(count) {
  return <h1>{count}</h1>;
}

// React が持っている場合
function Counter() {
  const [count, setCount] = useState(0);
  return <h1>{count}</h1>;
}
```

やっていることは同じです。入力を受け取って UI を返す。違うのは入力の出どころだけ。

React 目線で書き下すと、こうなります。

>あくまでイメージです！！

```jsx
// 実際に書くコード
function Counter() {
  const [count, setCount] = useState(0);
  return <h1>{count}</h1>;
}

// React から見た実態
function Counter(Reactの記憶) {
  const count = Reactの記憶[0] ?? 0;    // ← useState(0) はこれ
  return <h1>{count}</h1>;
}
```

`useState(0)` は、**引数リストに書けない引数を、関数の中で受け取るための構文**でした。渡すのが親ではなく React なので、引数として書けないだけです。

## フックのルールが順序の話だった理由

ここまで分かると、暗記するけど実はよく分からないがちのあのルールの意味が分かります。

*「フックを条件分岐やループの中で呼んではいけない」*

たとえば、こう書くと壊れます。

```jsx
function Form({ isEditing }) {
  const [name, setName] = useState('');

  if (isEditing) {
    const [draft, setDraft] = useState('');   // 🔴 条件分岐の中
  }

  const [error, setError] = useState(null);
}
```

なぜ壊れるのか。React が持っている記憶には、**名前がついていません**。呼ばれた順番で管理されているだけです。配列みたいなイメージです（正確には連結リストです）。

上のように書いてしまうと、 `isEditing` が `true` のときと `false` のときで、フックが呼ばれる回数が変わります。順番で引かれるので、こうなります。

```
isEditing === true            isEditing === false
1 番目 → name                 1 番目 → name
2 番目 → draft                2 番目 → error   ← draft の枠を引いてしまう
3 番目 → error                （3 番目は誰も引かない）
```

`error` が、前回まで `draft` が使っていた枠を取りに行きます。`null` を期待している変数に、空文字が入ってくる。そこから下は全部ずれます。

同じ理由で、これらも禁止されています。

```jsx
// 🔴 早期リターンより後
function Profile({ user }) {
  if (!user) return null;              // ここで抜けると、下は呼ばれない
  const [name, setName] = useState(user.name);
}

// 🔴 ループの中
function List({ items }) {
  for (const item of items) {
    const [x, setX] = useState(item);  // items の数でフックの数が変わる
  }
}
```

どれも「**毎回同じ順番で、同じ回数だけ呼ばれる**」を壊しています。逆に言えば、それさえ守っていればどこに書いても構いません。

なお、この手のコードを書くと React が気づいて教えてくれます。

```
Warning: React has detected a change in the order of Hooks called by Form.
Rendered more hooks than during the previous render.
```

「フックの順番が変わった」と、そのまま言われます。踏む機会は少ないかもしれませんが、理屈を知ったら当たり前だと思えますね。

## React は箱の中身しか見ていない

ここまでで、記憶がどこにあって、どう取り出されるかは分かりました。残っているのは「**いつ呼び直されるのか**」です。

トリガーは `setState()` です。ただし、呼べば必ず再実行されるわけではありません。React は**渡された値が前回と同じかどうかを見ていて、同じなら何もしません**。

そしてこの「同じかどうか」の判定が、React で一番ハマるところだと思います。実はプログラミングスクールでメンターとしてインターンをしているんですは、かつて受講生に質問されたときに、うまく説明できずに濁したという苦い思い出があります。

以下のコードを見てみましょう。これだと、正しく動きません。

```js
const [todos, setTodos] = useState([]);

function handleAdd(newTodo) {
  todos.push(newTodo);   // 配列の中身は確実に増えた
  setTodos(todos);       // でも画面が変わらない
}
```

これを説明するには、JavaScript の変数の話に降りる必要があります。React の仕様ではなく JS の仕様なので、ここが分かると React 側は自動的に分かります。

### 変数という箱には、何が入っているか

変数を箱だと考えるのは正しいのですが、**箱の中に何が入っているかが型によって違います**。

```
let count = 1;

┌────────┐
│ count:  1      │ ← 箱の中に「値そのもの」が入っている
└────────┘


let todos = [10, 20];

┌──────────┐         ┌────────┐
│ todos: 0x1234      │ ───→ │   [10, 20]     │   ← 実体は別の場所
└──────────┘         └────────┘
         ↑
    箱の中身は「アドレス」
```

数値や文字列（プリミティブ）は、箱の中に値そのものが入っています。一方で、配列やオブジェクト（参照型）は、箱の中にアドレスが入っていて、実体は別の場所にあります。

そして比較は、**どちらの場合も箱の中身を取り出して比べています**。

```js
count === count2    // 箱の中身は 1 と 1  → 値の比較になる
todos === todos2    // 箱の中身は 0x1234 と 0x5678 → アドレスの比較になる
```

ルールは「箱の中身を比べる」の 1 つだけです。ただ、箱に入っているものがプリミティブなら値、参照型ならアドレスになる。それだけの違いでした。

### だから push しても気づかれない

```js
todos.push(30);
```

```
┌──────────┐         ┌─────────┐
│ todos: 0x1234      │ ───→ │  [10, 20, 30]    │   ← 実体は変わった
└──────────┘         └─────────┘
         ↑
    箱の中身は 0x1234 のまま
```

`setTodos(todos)` で React に渡るのは**箱の中身、つまり `0x1234`** です。前回も `0x1234` でした。だから「同じものが来た」で終わります。

React が中身を覗いていないのではなく、**覗きようがない**。渡されているのはアドレスだけだからです。

正しくは、新しい実体を作って渡します。

```js
setTodos([...todos, newTodo]);
```

```
┌──────────┐         ┌─────────┐
│ todos:    0x1234   │ ───→ │  [10, 20]        │
└──────────┘         └─────────┘

┌──────────┐         ┌─────────┐
│ 新しい配列: 0x9999 │ ───→ │  [10, 20, 30]    │  ← 新しい実体
└──────────┘         └─────────┘
```

箱の中身が `0x9999` になるので、React に「違うものが来た」と伝わります。「state を直接書き換えず、新しく作って渡す」というルールは、ここから来ていました。

### setCount は実行中の値を変えない

もう一つ、`setState` まわりでよく踏むところがあります。

```js
function handleClick() {
  setCount(count + 1);   // count は 0 → 1 にして、とお願い
  setCount(count + 1);   // count はまだ 0 → 1 にして、とお願い
}
// 結果：1
```

2 回書いたのに 1 しか増えません。どちらも `0 + 1` を計算しているからです。

`setCount` を呼んでも、**実行中の `count` は変わりません**。これは以下のようなコードを実行してみると確かめられます。

```js
function handleClick() {
  console.log(count);      // 0
  setCount(count + 1);
  console.log(count);      // ← ここも 0
}
```

この関数の中の `count` は「今回呼ばれたときに受け取った入力」だからです。引数が実行中に書き換わらないのと同じで、新しい値になるのは次に呼ばれたときです。`setCount(1)` は `count` を変えているのではなく、**次回の `count` を決めている**わけです。

ではどう書けば 2 増えるのか。値ではなく、関数を渡します。

```js
function handleClick() {
  setCount(prev => prev + 1);
  setCount(prev => prev + 1);
}
// 結果：2
```

関数を渡すと、React がそのとき最新の値を `prev` に入れて呼んでくれます。前の値をもとに更新するなら、こちらが安全です。特に `await` を挟んだ後は `count` が古くなっている可能性が高くなります。

## なぜこんな設計なのか

最後に、React がここまでして関数を呼び直す形にしている理由です。

React 公式は純粋関数の条件を 2 つ挙げています。

> **It minds its own business.** It does not change any objects or variables that existed before it was called.
> **Same inputs, same output.** Given the same inputs, a pure function should always return the same result.
>
> — [Keeping Components Pure](https://react.dev/learn/keeping-components-pure)

そしてこう続きます。

> React is designed around this concept. React assumes that every component you write is a pure function.

もし関数自身が記憶を持っていたら、同じ入力を渡しても中の状態次第で違う結果が返ります。「同じ入力なら同じ出力」が成立しなくなる。

成立していると、React が関数を好きに扱えるようになります。

- 好きなタイミングで呼び直せる
- 途中で中断して、後でやり直せる
- 結果が同じだと分かっていれば呼ばずに済ませられる
- サーバー上でも呼べる

値の変化を細かく追跡する代わりに、React は追跡をやめて「何度呼んでも同じ結果になる関数であること」を要求しました。記憶を React 側に引き取っているのも、`push` ではなく新しい配列を要求するのも、全部その一貫性のためです。`useState` の回りくどさは、純粋性を守るための代償でした。

## まとめ

今回言語化できたのは、このあたりです。

- コンポーネントは、React に呼ばれる側の関数である
- 記憶は関数の外、Fiber の `memoizedState` にある。名前ではなく順番で引かれる
- `useState` は変数宣言ではなく、引数リストに書けない入力の受け取り
- props も state も外から渡される入力。持ち主が親か React かの違いだけ
- `setState` は実行中の値を変えない。次回の入力を決めているだけ
- React は箱の中身しか見ていない。参照型の場合それはアドレスなので、`push` では気づけない

もともとの直感に反する部分も多く、理解するのにはなかなか苦労しました。ちなみに、ここで持った疑問をもとに、「じゃあ自分ならどう設計するか？」を考えてみたことろ、Signalを再発明するというまさかの結果になりました。なかなか面白かったので、これについてもまたいつか書こうと思います。

## 参考

- [Keeping Components Pure – React](https://react.dev/learn/keeping-components-pure)
- [State: A Component's Memory – React](https://react.dev/learn/state-a-components-memory)
- [Queueing a Series of State Updates – React](https://react.dev/learn/queueing-a-series-of-state-updates)
- [Updating Arrays in State – React](https://react.dev/learn/updating-arrays-in-state)
