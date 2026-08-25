---
title: なんとなく使っていたPromiseを、基礎から整理する
description: Promiseの3つの状態、thenが新しいPromiseを返すこと、async/awaitとの対応関係を確認します。あわせて、forEachの中のawaitが効かない理由、await忘れ、Promise.allとallSettledの違い、new Promiseで包むべきでない場面を扱います。
pubDate: 2026-08-27
tags: [JavaScript, 非同期]
draft: false
---

## はじめに

Promiseは「とりあえずawaitしておけば動く」とざっくり使っていましたが、基礎から色々振り返ると、結構いろんなところにサラッと書かれているんですよね。理解が足りず苦労することがしばしばありました。というわけでこの記事では、状態の話から始めて、`then`が何を返しているか、async/awaitがそれとどう対応するかまでを順に確認します。後半はよくある落とし穴です。

## 1. Promiseは値ではなく箱

まずここが一番大事です。

```js
const p = fetch("/api/users");
console.log(p); // Promise { <pending> }
```

`p`は**ユーザー一覧ではありません**。「そのうち値か、エラーが入る箱」です。

箱には3つの状態があります。

| 状態 | 意味 |
|---|---|
| pending | まだ決まっていない |
| fulfilled | 値が入った（成功） |
| rejected | エラーが入った（失敗） |

そして**一度pendingから抜けたら、二度と変わりません**。ここがPromiseの核です。だから何回`.then()`してもいいし、あとから`.then()`しても結果は取れます。

```js
const p = Promise.resolve(1);
p.then((v) => console.log(v)); // 1
p.then((v) => console.log(v)); // 1  何度でもOK
```

## 2. thenは中身を取り出すのではなく、新しい箱を作る

ここが誤解されがちなポイントです。自分もよくわかっていませんでした。

```js
const a = Promise.resolve(1);
const b = a.then((v) => v + 1);
// b は 2 ではない。「2 が入る予定の新しい Promise」
```

`.then()`は必ず**新しいPromiseを返します**。だからチェーンが繋がります。

thenのコールバックが返した値によって、次の箱の中身が決まります。

```js
.then((v) => 42)                    // 次は 42 が入る
.then((v) => fetchSomething())      // Promise を返すと「解けるまで待つ」
.then((v) => { throw new Error() }) // 次は rejected になる
.then((v) => { console.log(v) })    // return なし → 次は undefined
```

2つ目の「Promiseを返すと待ってくれる」が、ネストが平らになる理由です。

4つ目の`return`書き忘れは事故りやすいところです。。

```js
// 待ってくれない
.then((user) => { save(user) })

// 待ってくれる
.then((user) => save(user))
```

## 3. エラーはチェーンを落ちていく

```js
fetchUser()
  .then((u) => fetchPosts(u.id))   // ここで throw されたら
  .then((p) => render(p))          // ← ここは飛ばされる
  .catch((e) => console.error(e)); // ← ここに来る
```

try/catchとだいたい同じ感覚です。`catch`もPromiseを返すので、その後にまた`.then()`を繋げられます。catchで回復した扱いになります。

`finally`は成功でも失敗でも走ります。値を素通しするので、ローディング解除などに使えます。

## 4. async / await はthenの書き換え

```js
// これと
async function main() {
  const u = await fetchUser();
  const p = await fetchPosts(u.id);
  return render(p);
}

// これは（ほぼ）同じ
function main() {
  return fetchUser()
    .then((u) => fetchPosts(u.id))
    .then((p) => render(p));
}
```

覚えておきたいのは2つです。

**`async`を付けた関数は、必ずPromiseを返します。**

```js
async function f() {
  return 1;
}
f(); // Promise { 1 }  ← 1 ではない
```

**`await`が止めるのは、その関数の中だけです。**

プログラム全体は止まりません。`await`に当たった時点でその関数はいったん中断して、呼び出し元に制御を返します。裏でスレッドが止まっているわけではありません。

## 5. ハマりどころ

### 実行は作った瞬間に始まる

Promiseはlazyではありません。

```js
const p = fetch("/api"); // ← この行でもうリクエストは飛んでいる
await p;                 // ← ここは「結果を待つ」だけ
```

これを利用すると並列化できます。

```js
// 直列。合計2秒
const a = await fetchA(); // 1秒
const b = await fetchB(); // 1秒

// 並列。合計1秒
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

### forEachの中のawaitは効かない

定番の罠です。

```js
// 待たずに抜ける
items.forEach(async (item) => {
  await save(item);
});
console.log("done"); // save が終わる前に出る

// 順番に待つ
for (const item of items) {
  await save(item);
}

// 並列で全部待つ
await Promise.all(items.map((item) => save(item)));
```

`forEach`は渡された関数の戻り値（＝Promise）を捨てます。`map`は返すので`Promise.all`に渡せます。

### awaitし忘れたPromise

```js
async function main() {
  save(data); // await なし
}
```

これは失敗しても誰も気づきません。`unhandledRejection`になって、環境によっては黙って消えます。ESLintの`no-floating-promises`を入れておくと安心です。

### Promise.allは1つ落ちたら全部落ちる

```js
Promise.all([a, b, c]);        // 1つ reject → 即 reject
Promise.allSettled([a, b, c]); // 全部待つ。結果は {status, value/reason} の配列
```

全部成功が前提なら`all`、失敗も含めて結果が欲しいなら`allSettled`です。

### new Promiseで包まない

```js
// 無意味なラップ
function get() {
  return new Promise((resolve) => {
    fetch("/api").then((r) => resolve(r));
  });
}

// これで足りる
function get() {
  return fetch("/api");
}
```

`new Promise`を書くのは、**Promiseではないもの**をPromiseにするときだけです。コールバックAPI、イベント、setTimeoutなどですね。

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
```

## 6. なぜ次の行より先に進むのか

```js
console.log("1");
Promise.resolve().then(() => console.log("3"));
console.log("2");
// 1, 2, 3
```

`.then()`のコールバックは**マイクロタスクキュー**に積まれて、今実行中の同期コードが全部終わってから走るからです。それゆえ、`3`が最後になります。

「Promiseは同期コードに割り込まない」と覚えておけば、事足りるかと思います。

## おわりに

特にわかっていなかったのは、**thenは新しい箱を作る**ことと、**実行は作った瞬間に始まる**ことの2つでした。これでまた一つ、JSに詳しくなれました。
