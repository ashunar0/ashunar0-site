---
title: え、アロー関数って function() と仕様違うの？？
description: アロー関数はfunctionの略記法だと思っていたら、仕様レベルで別物だと知りました。何がどう違うのかを調べてまとめます。
pubDate: 2026-08-30
tags: [JavaScript]
draft: false
---

## はじめに

JavaScriptでアロー関数 `()=>{}` を書く機会はこれまでたくさんありましたが、お恥ずかしながら、`function` をただ短く書くための略記法だと思っていました。が、どうやらなんと別物みたいです。

調べてみると、違いは**アロー関数は自分の `this` を持たない**という一点からほぼ全部出てくるようでした。`arguments` が無いのも、`new` できないのも、`bind` が効かないのも同じ理由です。順に確認していきます。

## 普通に書いている限り、2つは同じに動く

最初に、なぜ何年も気づかなかったのかという話をします。

```js
function add(a, b) {
  return a + b;
}

const add = (a, b) => a + b;
```

この2つは同じに動きます。普段書くコードはほとんどこの形なので、略記法だと思っていても正直特に困りませんでした。

違いが現れるのは `this` が絡むときです。逆に言うと、`this` を書かない限り2つはほぼ入れ替え可能で、Reactの関数コンポーネントやhooksでは `this` がまず出てこないので、その差を目撃する機会がそもそも無かったようです。どうりで知らなかったわけだ。

## 差が出るのは this が絡むとき

じゃあその `this` はどこに出てくるのかというと、関数がオブジェクトのプロパティに入っているときです。順に見ます。

まず、普段の書き方です。

```js
const user = { name: 'asahi' };

function hello(person) {
  return `hi, ${person.name}!`;
}

hello(user); // 'hi, asahi!'
```

データ（`user`）と関数（`hello`）が別々にいて、引数で渡しています。ここまではいつもの世界です。

JavaScriptでは関数も値なので、この2つをひとまとめにできます。文字列を入れるのと同じように、オブジェクトのプロパティへ関数を入れられます。

```js
const user = {
  name: 'asahi',
  hello: function () {
    return `hi, ${this.name}!`;
  },
};

user.hello(); // 'hi, asahi!'
```

結果は同じですが、2つ変わりました。

- 呼び方が `hello(user)` から `user.hello()` になった
- 引数 `person` が消えて、本体が `this.name` になった

つまりこの `this` は、**消えた `person` の代わり**です。ドット付きで呼ぶと、ドットの左側のオブジェクトがまるごと `this` として本体に渡されます。引数リストに書かない代わりに、`this` という固定の名前で受け取る約束になっています。

ちなみに `user.hello()` という形自体は毎日書いていて、`console.log()` も「`console` というオブジェクトから `log` という関数を辿って呼ぶ」という同じ構造です。

そして、引数リストに現れない隠れた引数なので、呼ばれ方が変われば同じ関数でも中身が変わります。

```js
const hello = user.hello; // 関数だけ取り出した
hello(); // TypeError: Cannot read properties of undefined
```

`user.hello` は `user.name` と同じただのプロパティアクセスなので、こうやって関数だけを取り出せます。ただしドット無しで呼ぶと `this` に入れるものが無いので `undefined` になり、本体の `this.name` が `undefined.name` になって落ちました（strict modeでない場合は `globalThis` が入って `'hi, undefined'` になります）。

つまり `function` の `this` は、書いた場所ではなく**呼ばれ方で決まります**。

## アロー関数は this を用意しない

ここでようやく本題です。さっきの `hello` をアロー関数に置き換えてみます。

```js
const user = {
  name: 'asahi',
  hello: () => `hi, ${this.name}!`,
};

user.hello(); // 'hi, asahi!' にはなりません
```

ドット付きで呼んでいるのに、`this` に `user` は入りません。

`function` で作った関数は、呼ばれるたびに隠れた引数として自分の `this` を受け取ります。アロー関数は**受け取りません**。じゃあ中に書かれた `this` はどうなるかというと、自分のものが無いので、**普通の変数と同じルールで外側のスコープへ探しに行きます**。この例だと外側はモジュールのトップレベルなので、`user` とは何の関係もないものが見つかります（環境によって `undefined` だったり `window` だったりしますが、とにかく `user` ではありません）。

整理するとこうです。

| | `this` はどこから来るか | いつ決まるか |
| --- | --- | --- |
| `function` | 呼び出し側（ドットの左） | 呼ばれた瞬間 |
| アロー関数 | 外側のスコープ | 書いた時点 |

で、これはアロー関数の欠陥ではなく、狙ってそう作られています。「呼ばれ方で `this` が変わる」性質は、コールバック——`map` に渡す関数や `onClick` のように、**あとで相手に呼んでもらうために渡す関数**——で事故のもとだったからです。

ブラウザ組み込みの `setInterval` で見てみます。渡した関数を、指定したミリ秒ごとに繰り返し呼んでくれるやつです。

```js
const timer = {
  seconds: 0,
  start: function () {
    setInterval(function () {
      this.seconds++; // 動かない。setInterval が呼ぶとき、ドットの左はいない
    }, 1000);
  },
};
```

`setInterval` に渡した瞬間、関数はただの値として切り離されます。呼ぶのは `setInterval` の側で、そのとき `this` に `timer` を入れてくれる人はいません。前の節の「取り出したら TypeError」と同じ現象です。

ここで、内側のコールバックだけをアロー関数に変えます。

```js
const timer = {
  seconds: 0,
  start: function () {
    // timer.start() で呼ばれるので、start の this には timer が入っている
    setInterval(() => {
      this.seconds++; // 自分の this が無い → 外側 = start の this（timer）に行き着く
    }, 1000);
  },
};

timer.start();
```

コールバックは自分の `this` を持たないので、外側のスコープ——つまり `start` の `this`——を探しに行きます。`timer.start()` と呼ばれていれば、それは `timer` です。

ちなみに `start` 自体までアロー関数にすると、今度は `start` が `this` を受け取らなくなるので、ドット付きで呼んでも `timer` は入らず壊れます。外側に `this` を受け取る `function` がいて初めて、内側のアロー関数に拾うものができます。

「呼ばれ方で変わる `this`」と「書いた場所で決まる `this`」。アロー関数は略記法ではなく、後者が欲しい場面のための別の道具だったようです。

## arguments / new / bind も同じ理由

はじめに書いた残りの違いも、「呼び出しの文脈を自分用に用意しない」という同じ理由で説明がつきます。

### arguments が無い

`function` は `this` のほかに、`arguments`（実際に渡された引数の一覧）も呼び出しのたびに用意します。宣言していないのに使える隠れた引数の仲間です。

```js
function f() {
  return arguments[0];
}
f('hi'); // 'hi'

const g = () => arguments[0];
g('hi'); // ReferenceError: arguments is not defined
```

アロー関数は用意しないので、`this` と同じく外側へ探しに行きます。外側に `function` がいればそっちの `arguments` が見つかり、いなければエラーです。とはいえ、いまは引数をまとめて受けたいならレスト引数 `(...args)` を使うので、これで困ることはあまりなさそうです。

### new できない

`new f()` は「新しい空のオブジェクトを作って、それを `this` に入れて `f` を呼ぶ」という仕組みです。`this` を受け取らないアロー関数では成立しないので、コンストラクタとして扱えないことになっています。

```js
const Person = (name) => {};
new Person('asahi'); // TypeError: Person is not a constructor
```

### call / apply / bind が効かない

`call` / `apply` / `bind` は、`this` に入れるものを呼ぶ側が明示的に指定するためのメソッドです。アロー関数には入れる場所が無いので効きません。しかも**エラーにならず、黙って無視されます**。

```js
const arrow = () => this;
arrow.call({ name: 'x' }); // { name: 'x' } は無視される
```

`bind` による引数の先渡しは普通に効きます。効かないのは `this` の指定だけです。

## まとめ

アロー関数は `function` の略記法ではなく、`this` や `arguments` といった**呼び出しの文脈を自分用に用意しない関数**でした。用意しないから、中に書いた `this` は普通の変数と同じルールで外側に行き着きます。`new` できないのも `bind` が効かないのも、全部この一点の現れです。

したがって、使い分けとしては、`this` を受け取りたい関数は `function`、外側の `this` をそのまま使いたいコールバックはアロー関数。そして `this` に用が無いなら、どちらで書いてもほぼ同じに動きます。だから略記法だと思ったまま何年も困らなかった、というオチでした。

ちゃんと調べてみるととても奥が深いですね！

## 参考

- [アロー関数式 - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Functions/Arrow_functions)
- [this - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/this)
- [arguments - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Functions/arguments)
