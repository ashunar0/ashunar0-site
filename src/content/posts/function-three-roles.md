---
title: じゃあ function って何者なんだよ
description: アロー関数との違いを調べた前回の続きです。比較対象だった function そのものが何なのかを、他の言語と見比べながら調べます。
pubDate: 2026-09-01
tags: [JavaScript]
draft: false
---

## はじめに

前回、アロー関数は `function` の略記法ではなく別物だ、という話を書きました。

https://ashunar0.dev/posts/arrow-function-vs-function/

調べてみた結果、自分が今まで「関数」だと認識していたものの実態は、アロー関数に非常に近しいようでした。...じゃあ結局 `function` ってなんなんだ？

あんな記事を書いておいてなんですが、そもそも関数に `this` なんてものが出てくること自体、僕にとってはなんだか不自然なようにも思えました。 `this` ってなんとなく、 class とかで出てくるものというイメージがあるんですよね。

そういうわけで、JS の歴史的な経緯も踏まえて、 function とは何者なのかをもう少し解像度高く探ってみました。

## function は3つの顔を持つ

まず、JavaScriptで普段見かける `function` の使われ方を3つ並べます。

```js
// 使い方1: ただの関数
function add(a, b) {
  return a + b;
}
add(1, 2); // 3

// 使い方2: メソッド
const user = {
  name: 'asahi',
  hello: function () {
    return `hi, ${this.name}!`;
  },
};
user.hello(); // 'hi, asahi!'

// 使い方3: コンストラクタ
function User(name) {
  this.name = name;
}
const me = new User('asahi'); // User { name: 'asahi' }
```

名前が分かれていることからわかる通り、関数・メソッド・コンストラクタは本来別々の概念です。違いは **`this` に何が入るか**です。

| | `this` に入るもの | 仕事 |
| --- | --- | --- |
| 関数 | なし | 入力を受け取って出力を返す |
| メソッド | 呼び出し元のオブジェクト | そのオブジェクトの状態を読み書きする |
| コンストラクタ | 作りたての新品オブジェクト | 新しいオブジェクトを初期化する |

3つの使い方、よく見ると**全部同じ `function` 構文**です。宣言のどこにも「これはメソッドです」「これはコンストラクタです」という情報はありません。情報が無いということは区別も無いということで、実際、全部入れ替えられちゃいます。

```js
new add(1, 2); // add を new できてしまう（エラーにならず、空のオブジェクトが返る）

User('asahi'); // new を忘れても呼べてしまう（this が undefined になって落ちる）

const f = user.hello;
f(); // メソッドを取り出して、ただの関数としても呼べてしまう（これも落ちる）
```

落ちるものもありますが、宣言時に禁止されているわけではなく、走ってみたら `this` の中身が変だったというだけです。

つまり `function` は、3つの役のどれかとして宣言されるのではなく、**どの役になるかを呼ばれる瞬間まで決めていません**。`new` 付きで呼べばコンストラクタ、ドット付きで呼べばメソッド、そのまま呼べばただの関数、と、1つの宣言が、呼び方しだいで3つのうちのどれにでもなれます。

なんでこんな変な作りになってしまっているのでしょうか。比較のために、役割を最初から決めさせる言語を見てみます。

## Java では、3役は最初から書き分ける

Java では、関数・メソッド・コンストラクタは書く場所も構文も別々です。

```java
class User {
    String name;

    // コンストラクタ：クラス名と同名で、戻り値の型を書かない専用構文
    User(String name) {
        this.name = name;
    }

    // メソッド：クラスの中にしか書けない
    String hello() {
        return "hi, " + this.name + "!";
    }

    // 関数に相当するもの：static メソッド。this を受け取らないという宣言
    static int add(int a, int b) {
        return a + b;
    }
}
```

```java
User user = new User("asahi"); // コンストラクタは new 経由でしか呼べない
user.hello();                  // "hi, asahi!"
User.add(1, 2);                // static メソッドは this を使わないので、new せずに呼べる
```

コンストラクタは「クラス名と同名で、戻り値の型を書かない」専用の書き方で、メソッドはクラスの中に書くものです。`this` を使わないただの関数は `static` を付けて書きます。というより、Java にはクラスの外に関数を書く構文自体がありません。宣言を見た瞬間に、3つのうちどれなのかが確定しています。

そして前の節でやった「越境」は、Java では全部コンパイルエラーです。

| やろうとすること | JavaScript | Java |
| --- | --- | --- |
| メソッドを `new` する | 動いてしまう（空のオブジェクトが返る） | コンパイルエラー |
| コンストラクタを `new` なしで呼ぶ | 動いてしまう（`this` が壊れる） | コンパイルエラー |
| ただの関数の中で `this` を使う | 書けてしまう（`undefined` が入る） | コンパイルエラー |

宣言した時点で役割が一生固定されていて、役割違反は実行する前に弾かれます。だから Java のメソッドの中では、`this` にレシーバがいることを言語が保証してくれています。「`this` に何が入るんだっけ」と考える場面が、そもそも存在しないわけです。

## 1995年の JavaScript に class は無かった

ここで気づくのは、Java のやり方は **class 構文があって初めて成立する**ということです。メソッドは「クラスの中」に書くから `this` が保証され、コンストラクタは「クラス名と同名」だから見分けられます。3役の書き分けは、class という置き場所が支えています。

そして1995年に生まれた JavaScript には、ES2015 まで実に20年もの間、class 構文がありませんでした。本来であればメソッドもコンストラクタも必要なのに、それを書き分けるための「クラスの中」という場所が存在しません。なお、データと動きをまとめたい、同じ形のオブジェクトを量産したい...などのオブジェクト指向の需要もあったので、オブジェクト自体は最初からいました。

そこで JavaScript が選んだ答えが、

*構文は function 1つだけ用意して、役割は呼び方で決める*

というものでした。`new` を付けたらコンストラクタとして、ドット付きで呼んだらメソッドとして、そのまま呼んだらただの関数として動くことにしよう！と決めちゃったんです。

こう見ると、前回の記事の結論「`function` の `this` は呼ばれ方で決まる」に理由がつきます。最初の節の表のとおり、`this` の中身は役割ごとに違います。その役割自体が呼ばれる瞬間まで決まらないのだから、`this` も呼ばれる瞬間まで決まりようがありません。`this` が動的なのは気まぐれな仕様というより、**class 抜きで3役をこなすための必然**だったわけです。

では2015年、JavaScript にもついに class が来ました。役割ごとの専用構文が20年遅れで揃ったとき、function の3役はどうなったのでしょうか。次はそこを見ます。

## ES2015 は、3役を3つの構文に分けた

ES2015 で入ったのは class だけではありません。同じタイミングで、アロー関数とメソッド短縮記法も入りました。この3つを並べると、きれいに1役ずつ対応しています。

```js
// 関数役 → アロー関数
const add = (a, b) => a + b;

// メソッド役 → メソッド短縮記法（function を書かずに済む書き方）
const user = {
  name: 'asahi',
  hello() {
    return `hi, ${this.name}!`;
  },
};

// コンストラクタ役 → class
class User {
  constructor(name) {
    this.name = name;
  }

  hello() {
    return `hi, ${this.name}!`;
  }
}
```

そして重要なのは、**それぞれが担当外の役をやれないようにできている**ことです。3つとも、越境しようとするとその場でエラーになります。

```js
new add(1, 2);    // TypeError: add is not a constructor
new user.hello(); // TypeError: user.hello is not a constructor
User('asahi');    // TypeError: Class constructor User cannot be invoked without 'new'
```

冒頭の例を思い出すと、対比がはっきりします。`function` で同じことをやったときは、エラーにならずに動いてしまうか、`this` が壊れた結果として落ちるだけでした。ES2015 の3構文は、そもそも**その役をやる能力を持っていません**。

| 構文 | 担当する役 | 自分の `this` | `new` できるか |
| --- | --- | --- | --- |
| アロー関数 | 関数 | 持たない | できない |
| メソッド短縮記法 | メソッド | 持つ | できない |
| class | コンストラクタ | 持つ | `new` でしか呼べない |
| `function` | 3役ぜんぶ | 持つ | できる |

アロー関数が `this` を持たないのも、メソッド短縮記法と class のメソッドが `new` できないのも、担当する役に要らない装備だからです。実際、`new` に必要な `prototype` プロパティは、`function` にはありますが、アロー関数とメソッド短縮記法にはそもそも生えていません。

```js
typeof function f() {}.prototype; // 'object'
typeof ((() => {}).prototype);    // 'undefined'
typeof user.hello.prototype;      // 'undefined'
```

前回の記事で調べた「アロー関数は `this` を持たない」という性質も、こう並べると位置づけが変わります。アロー関数が `function` から機能を削った劣化版なのではなく、**3役ぶんの装備を持った `function` から、関数役だけを切り出したもの**だったわけです。自分が「関数」だと思っていたものがアロー関数の方に近かったのも、今思えば当然といえば当然で、アロー関数の方が「関数」という役に忠実だからでした。

こうして役ごとの専用構文が揃った結果、`function` は3役を兼ねる必要がなくなりました。

## それでも function を使う場面

とはいえ `function` が用済みになったわけではありません。専用構文に引き取られなかった仕事がいくつか残っています。

ひとつはジェネレータです。`function*` という書き方は `function` にしかなく、アロー関数版は構文として存在しません。

```js
function* gen() {
  yield 1;
  yield 2;
}
[...gen()]; // [1, 2]
```

もうひとつは巻き上げです。`function` 宣言は定義より前の行から呼べますが、`const` に入れたアロー関数はできません。

```js
hoisted(); // 'ok'。定義より前だが呼べる
function hoisted() {
  return 'ok';
}

notHoisted(); // ReferenceError: Cannot access 'notHoisted' before initialization
const notHoisted = () => 'ok';
```

ヘルパー関数をファイルの下の方にまとめて置きたいときなど、呼ぶ順に縛られないのは `function` の利点です。

最後に、呼び出し側から `this` を受け取りたい場合です。数は少ないですが、`addEventListener` のコールバックのように、呼ぶ側が `this` に有用なものを入れてくれる API がまだ残っています。

```js
button.addEventListener('click', function () {
  this.disabled = true; // this にはクリックされた要素が入る
});
```

ここをアロー関数にすると外側の `this` を見にいってしまうので、`function` を選ぶ理由になります。もっとも、`event.currentTarget` でも同じものが取れるので、必須というほどではありません。

## まとめ

`function` は、関数・メソッド・コンストラクタという3つの役を1つで兼ねる構文でした。どの役になるかは宣言時には決まらず、`new` を付けたか、ドット付きで呼んだか、そのまま呼んだかという**呼び出しの形**で決まります。

そうなっているのは、JavaScript に20年間 class が無かったせいです。Java のように役ごとに書き分けるには「クラスの中」という置き場所が要りますが、それが無いまま3役をこなすには、1つの構文に無理やり全部やらせて呼び方で振り分けるしかありませんでした。前回わからなかった「`this` が呼ばれ方で決まる」という性質も、役割自体が呼ばれ方で決まる以上そうなるしかない、という話でした。

そして ES2015 で、3役はそれぞれ専用構文に分かれました。関数役がアロー関数、メソッド役がメソッド短縮記法、コンストラクタ役が class です。3つとも担当外の役をやる能力を持っておらず、その境界を越えようとすればその場でエラーになります。

つまり `function` は「関数」というより**分割前の全部入り**でした。アロー関数を「関数」だと感じていたのは、それが3役から関数の役だけを切り出したものだからで、感覚の方が合っていたわけです。歴史を振り返ってみると、なかなか奥が深くて興味深いですね。

## 参考

- [function 宣言 - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Statements/function)
- [クラス - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Classes)
- [メソッド定義 - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Functions/Method_definitions)
- [new 演算子 - JavaScript | MDN](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Operators/new)
