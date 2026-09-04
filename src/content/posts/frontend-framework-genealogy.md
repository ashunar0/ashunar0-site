---
title: フロントエンドフレームワークの歴史と系譜
description: React・Vue・Solid しか触ったことがなかったので、その前にいた Knockout・Backbone・AngularJS まで遡って系譜を追いました。変更をどう検出するか、更新の単位はどこか、という2つの軸で並べ直しながら、各フレームワークの最小のカウンターを見比べていきます。
pubDate: 2026-09-04
tags: [フロントエンド, React, Vue, Solid, リアクティビティ]
draft: false
---

## はじめに

僕がまともに触ったことのあるフロントエンドフレームワークは、React と Vue と Solid の3つだけです。

ただ、この3つより前にも色々あったらしい、というのは知っていました。Knockout.js とか Ember.js とか、名前だけはどこかで聞いたことがあります。が、使ったことはないし、どういうものなのかも知りません。

気になったのは、今のフレームワークがどこから来たのかという部分です。React の仮想DOM も Solid の signal も、いきなり発明されたわけではなくて、その前に誰かが別のやり方を試していたはずです。それを知らないまま「React はこう書くもの」と覚えているのが、少し落ち着かなくなってきました。

そういうわけで、2010年前後まで遡って系譜を追ってみます。年号を並べるだけだと何も分からないので、2つの軸で並べ直します。最後に各フレームワークの最小のカウンターを載せるので、書き味の違いも見比べられるはずです。

## 全部、同じ問題を解いている

先に結論めいたことを書いておくと、ここに出てくるフレームワークは全部、同じひとつの問題を解こうとしています。

*状態が変わったとき、DOM をどうやって追従させるか*

たったこれだけです。ルーティングもデータ取得もビルドツールも、後から乗ってきた話であって、出発点はここにあります。

たとえば jQuery の時代、この問題は人間が解いていました。

```js
let count = 0;
$('#inc').on('click', () => {
  count++;
  $('#count').text(count); // ← ここを書き忘れたら画面が古いまま
});
```

`count` を更新したら `#count` も更新する、というのは誰も保証してくれません。書き忘れたら画面がずれます。しかも状態が2つ、3つと増えて、それぞれが複数の場所に表示されるようになると、「この値を変えたらどこを直すんだっけ」を人間が全部覚えておく必要が出てきます。

ここから先の歴史は、この対応表をどうやって機械に持たせるかの試行錯誤です。

最初の一歩が Backbone.js (2010年10月) でした。状態を DOM から引き剥がして Model に置き、値が変わったら `change` イベントを飛ばします。

```js
const Counter = Backbone.Model.extend({ defaults: { count: 0 } });
const model = new Counter();

model.on('change:count', () => {
  $('#count').text(model.get('count')); // ← ここはまだ手書き
});

model.set('count', model.get('count') + 1);
```

「変わった」を機械が教えてくれるようになりました。ただ、教えてもらった後に DOM をどう直すかは、相変わらず人間が書きます。対応表の左半分だけを機械が持った状態です。

残りの半分、つまり「変わったからここを書き換える」まで渡そうとすると、道が2つに分かれます。

## 軸1: 変更をどうやって知るか

ひとつめは、値が変わったことをどうやって検知するかです。

### 追跡する

値を読んだ瞬間に「今この値を読んだのは誰か」を記録しておいて、値が書き換わったら記録した相手を呼び出します。読む側と書く側の対応表を、実行しながら自動で作る発想です。

この場合、更新の時には必要な分しか動きません。ただし値へのアクセスを全部フレームワーク経由にする必要があります。生の変数を `count++` しても誰も気づけないので、`count()` や `count.value` のような小細工が要ります。

### 見比べる

何も記録しません。とりあえず全部もう一度計算して、前回の結果と突き合わせて、違うところだけ DOM に反映します。対応表を作らない代わりに、毎回総当たりします。

こちらは小細工が要りません。ただの変数、ただの関数として書けます。代わりに、変わっていない箇所も含めて毎回計算しなければならないので、少し無駄が生じがちです。

## 軸2: 更新の単位はどこか

ふたつめは、変更が見つかったときに何を実行し直すかです。

### コンポーネント単位

コンポーネントの描画関数を丸ごと呼び直します。関数を実行すると新しい UI の姿が返ってくるので、それを前回の姿と比べて、DOM への操作に落とします。

### 式単位

描画関数を呼び直しません。`{{ count }}` のような式ひとつひとつが、あらかじめ自分の担当する DOM ノードを掴んでいて、その式だけが再評価されて、掴んでいたノードだけが書き換わります。

ここが分かりにくかったところなんですが、この軸は軸1とは独立しています。追跡していれば必ず式単位になる、というものではありません。追跡した結果としてコンポーネント丸ごとを呼び直す構成もありえます。

## 2つの軸で並べ直す

というわけで、2×2になります。

| | 見比べる | 追跡する |
| --- | --- | --- |
| **コンポーネント単位** | React / Preact | Vue 2・3 |
| **式単位** | AngularJS | Knockout / Solid / Svelte 5 |

僕が触ったことのある3つが、きれいに3マスに散らばりました。React と Vue と Solid で書き味が違うと感じていたのは、そもそも別のマスにいるからでした。

ちなみに、残った1マス（**見比べる × 式単位**）に AngularJS がいます。追跡していないのに式単位で更新する、という一番想像しにくい位置です。

## 追跡する × 式単位 — Knockout (2010)

Knockout.js は2010年7月に出ました。Microsoft の Steve Sanderson が作ったもので、当時 MVVM と呼ばれていた形です。最小のカウンターはこうなります。

```html
<div id="app">
  <span data-bind="text: count"></span>
  <button data-bind="click: increment">+1</button>
</div>

<script>
  function ViewModel() {
    this.count = ko.observable(0);
    this.increment = () => this.count(this.count() + 1);
  }
  ko.applyBindings(new ViewModel(), document.getElementById('app'));
</script>
```

`ko.observable(0)` が小細工部分です。読むときは `count()`、書くときは `count(1)` と、どちらも関数呼び出しになります。

なぜ関数なのかというと、2010年には他に手がなかったからです。`Object.defineProperty` は当時まだ現役だった IE8 では DOM 要素にしか使えず、普通のオブジェクトのプロパティには適用できませんでした。値の読み書きに割り込みたければ、関数呼び出しにするしかありません。

### 依存追跡

面白いのはここからです。`data-bind="text: count"` を見つけると、Knockout はこの式を一度実行します。実行すると、途中で `count()` が呼ばれます。

Knockout は「今どの式を実行中か」をグローバルに持っています。なので `count()` が呼ばれた瞬間に、observable 側が「自分はこの式から読まれた」と記録できます。

```
1. span の式を実行開始 → 「実行中はこの式」と記録
2. 式の中で count() が呼ばれる → count が「span の式から読まれた」を保存
3. 式の実行終了
```

対応表が、実行しただけで勝手に出来上がります。あとは `count(1)` で書き換えたときに、保存しておいた式だけを呼び直せば済みます。span のテキストだけが書き換わって、ボタンには誰も触りません。

**読まれたら記録する、書かれたら記録先を呼ぶ** だけで、jQuery の時代に人間が覚えていた対応表が機械の側に移りました。2010年の時点で、この仕組みは完成しています。

弱点はテンプレートの側にありました。`data-bind="text: count"` は HTML 属性の中のただの文字列なので、タイプミスをしても何も起きません。エディタも補完してくれません。式が複雑になるほど、属性の中に小さなプログラムを書くことになります。

## 見比べる × 式単位 — AngularJS (2010)

Knockout の3ヶ月後、2010年10月に Google が AngularJS を発表しました。

```html
<div ng-app="app" ng-controller="CounterCtrl">
  <span>{{ count }}</span>
  <button ng-click="increment()">+1</button>
</div>

<script>
  angular.module('app', []).controller('CounterCtrl', function ($scope) {
    $scope.count = 0;
    $scope.increment = function () {
      $scope.count++;
    };
  });
</script>
```

`$scope.count` はただの数値です。小細工がありません。`count++` がそのまま書けます。Knockout の `count(count() + 1)` と見比べると、書き味の差は明らかだと思います。

しかしながら、ただの数値だということは、書き換えに割り込む場所もないということです。`$scope.count++` を実行しても、AngularJS には何の通知も届きません。

### $digest

そこで AngularJS は、**あとから全部見比べる**という手を取ります。

`{{ count }}` のような式を見つけるたびに、AngularJS は watcher を登録します。watcher は「評価する式」と「前回の値」を持ったペアです。そしてイベントハンドラが終わったタイミングで `$digest` というループが走り、登録された watcher を**全部**評価して、前回の値と違うものを探します。違っていたら、その watcher が担当する DOM だけを書き換えます。

更新されるのは式ひとつ分です。でも、そこに辿り着くまでに全部の watcher を評価しています。これが「見比べる × 式単位」の中身です。

しかも `$digest` は1周では終わりません。ある watcher の更新が別の値を書き換えることがあるので、変化が出なくなるまでループを回します。10周しても収まらないと AngularJS はエラーを投げます。

```
Error: [$rootScope:infdig] 10 $digest() iterations reached. Aborting!
```

コストは watcher の数に比例します。1回のクリックで、全 watcher が最低2回は評価されます（変化を見つけた周と、変化がないことを確認する周）。当時「watcher は2000個くらいまで」という目安がよく言われていましたが、60fps を保つには1フレーム16msに収める必要があるので、そのあたりが限界だったんだと思います。

テーブルに1000行並べて各行に3つバインディングを置いたら、それだけで3000個です。「行数を増やすと重くなる」ではなく、「行数を増やすとページ全体が重くなる」という壊れ方をします。

### もうひとつの遺産

AngularJS がもたらしたもので、変更検出と同じくらい影響が大きかったのが双方向バインディングです。

```html
<input ng-model="name">
<p>こんにちは、{{ name }}さん</p>
```

`ng-model` を書くだけで、input への入力が `$scope.name` に流れ、`$scope.name` の変更が input に流れます。1行で双方向につながります。

当時これは魔法のように見えたはずです。実際、書く量は劇的に減ります。ただし、アプリが大きくなると「今この値を書き換えたのは誰か」が追えなくなります。input かもしれないし、別のコントローラかもしれないし、`$digest` の途中で走った別の watcher かもしれません。

この問題への回答が、次に出てくる React です。

## 見比べる × コンポーネント単位 — React (2013)

2013年5月、Facebook が React を公開します。当時の書き方だとカウンターはこうなります。

```jsx
var Counter = React.createClass({
  getInitialState: function () {
    return { count: 0 };
  },
  increment: function () {
    this.setState({ count: this.state.count + 1 });
  },
  render: function () {
    return (
      <div>
        <span>{this.state.count}</span>
        <button onClick={this.increment}>+1</button>
      </div>
    );
  },
});
```

今の書き方だとこうです。

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}
```

13年でずいぶん見た目が変わりましたが、変更検出のやり方は最初から最後まで同じです。

### 値の流れを1本にする

AngularJS の `ng-model` に対する回答が、単方向データフローでした。React では値が state から JSX へ一方向にしか流れません。画面側から state に戻ってくる経路がないので、書き換えたければ `setCount` を呼びます。

input を扱うときは `value` と `onChange` を両方書くことになるので、`ng-model` の1行と比べると明らかに面倒です。その代わり、値が変わる場所がコードに全部現れます。

### 追跡を捨てる

ここからが変更検出の話です。`setCount(1)` を呼んだとき、React は「`count` を読んでいたのは誰か」を調べません。記録していないので調べられません。

代わりに `Counter` 関数を丸ごと呼び直します。関数を実行すれば今の正しい UI が返ってくるので、それを前回の戻り値と見比べて、違う部分だけを DOM に当てます。この戻り値が仮想DOM です。JSX が返しているのは DOM 要素ではなく、「こういう DOM であってほしい」を表しただけのオブジェクトです。

見返りは大きくて、`count` はただの数値のままでいられます。読むのに `count()` も `count.value` も要りません。分岐もループも普通の JavaScript です。Knockout の `data-bind` 文字列も、AngularJS の `ng-repeat` も要りません。テンプレート言語という発想そのものが消えます。

コストは、変わっていないものまで呼び直すことです。親の state がひとつ変わると、その下のコンポーネントは全部呼び直されます。ちょっと無駄があります。

そこで `memo` や `useMemo` や `useCallback` が出てきて、依存配列を書くことになります。

```jsx
const total = useMemo(() => items.reduce(sum, 0), [items]);
//                                                 ^^^^^^^ これ
```

この `[items]` は、「この計算は `items` に依存している」を人間が申告したものです。Knockout が実行時に自動で作っていた対応表を、React では人間が手で書き戻しています。追跡を捨てた分の請求が、ここに来ています。

2025年10月に React Compiler 1.0 が出て、この依存配列をビルド時に自動で埋められるようになりました。人間が書いていた対応表を、今度はコンパイラが作ります。

## 追跡する × コンポーネント単位 — Vue (2014)

2014年2月、Evan You が Vue.js を公開します。今の書き方だとこうです。

```vue
<script setup>
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <span>{{ count }}</span>
  <button @click="count++">+1</button>
</template>
```

`ref(0)` は Knockout の `ko.observable(0)` の子孫です。読み書きに `.value` を使うところまで役割が同じで、割り込む手段だけが時代とともに変わりました。Vue 2 は `Object.defineProperty`、Vue 3 は `Proxy` を使っています。Knockout が関数呼び出しにするしかなかったのは IE8 が現役だったからで、それが落ちた分だけ書き方が素直になりました。

テンプレートの中で `.value` が要らないのは、コンパイラが自動で外しているからです。

さて、`ref` を使って追跡しているなら、Knockout や Solid と同じ「式単位」に入りそうなものです。でも Vue が入るのは「コンポーネント単位」です。

`count` が変わったとき、Vue は `count` を読んでいたコンポーネントを特定します。ここまでは追跡です。そのあと、そのコンポーネントの描画関数を丸ごと呼び直して、仮想DOM の差分を取ります。ここは React と同じです。追跡でコンポーネントを絞り込んで、その中は見比べる、という組み合わせになっています。

そのため、 React でいう `useMemo` の依存配列は Vue には出てきません。`computed` は何にも申告せず、中で読んだ `ref` から依存を勝手に拾います。追跡している側の見返りがここに出ます。

そして今、Vue はここから動こうとしています。Vue 3.6 で入る Vapor Mode では、仮想DOM を使わずテンプレートを直接 DOM 操作にコンパイルする方式です。2026年8月時点では RC 段階で、コンポーネント単位で opt-in する形になっています。有効にした部分は「追跡する × 式単位」に移ります。

## 追跡する × 式単位 — Solid (2021)

Ryan Carniato の Solid は2018年から公開されていて、1.0 が2021年6月に出ました。カウンターはこうです。

```jsx
function Counter() {
  const [count, setCount] = createSignal(0);
  return (
    <div>
      <span>{count()}</span>
      <button onClick={() => setCount(count() + 1)}>+1</button>
    </div>
  );
}
```

ぱっと見は React とほとんど同じです。`useState` が `createSignal` になって、`count` に括弧が付いただけです。

でも動きは正反対です。`Counter` 関数が実行されるのは、最初の1回だけです。`setCount` を呼んでも `Counter` は二度と呼ばれません。呼び直されるのは `<span>` の中の `count()` という式だけで、書き換わるのはその span のテキストノードだけです。

その括弧ひとつが、React と分ける全部を持っています。`count()` という呼び出しがあるから、実行した瞬間に「今この式が count を読んだ」を記録できます。読む場所がコードに関数呼び出しとして現れているので、どこで追跡が起きるかも目で見えます。React の `count` はただの数値なので、読まれても誰にも分かりません。

### 11年ぶりの再会

Knockout と並べてみます。

```js
// Knockout (2010)
this.count = ko.observable(0);
this.count();                   // 読む
this.count(this.count() + 1);   // 書く
```

```jsx
// Solid (2021)
const [count, setCount] = createSignal(0);
count();                        // 読む
setCount(count() + 1);          // 書く
```

読むのも書くのも関数呼び出しで、依存追跡の仕組みも同じです。11年空いて、同じところに戻ってきています。

違うのはテンプレートの側だけです。Knockout は `data-bind` という HTML 属性の中の文字列でしたが、Solid は JSX です。React が持ち込んだ「テンプレート言語をやめて JavaScript で書く」を、Knockout のリアクティビティに接続したものが Solid だと言えます。2010年に分かれた2本の道が、ここで合流しています。

## 全員が同じマスに集まる

2023年あたりから、signal という名前で同じものが各フレームワークに入りました。合流の仕方が2通りあったので、順に見ます。

### コンパイラ側から来た Svelte

Svelte (2016) は3つ目のやり方を試したフレームワークです。ここまで見てきた追跡は全部実行時のものでしたが、Svelte 3 と 4 は**ビルド時**にやりました。

```js
let count = 0; // ただの変数
$: doubled = count * 2;
```

コンパイラがソースを読んで、`count` への代入文と `count` を参照している箇所を突き合わせ、対応表をビルド時に確定させます。実行時に記録する処理が要らないので、出力される JavaScript が小さくなります。

ただ、ソースを読んで分かる範囲にしか対応表を作れません。リアクティブな計算を別の関数に切り出すと、コンパイラが依存を追いきれなくなります。公式の runes 発表記事でも、リファクタリングすると `$:` が期待通りに動かなくなる点が理由として挙げられていました。

そこで2023年9月に runes が発表され、2024年10月の Svelte 5 で実行時追跡に切り替わります。

```js
let count = $state(0);
let doubled = $derived(count * 2);
```

依存は式を評価したときに決まるようになりました。Knockout や Solid と同じやり方です。

### 15年かけて戻ってきた Angular

AngularJS の `$digest` が watcher の数に比例して重くなる話は前に書きました。Angular 2 (2016) は全面的に作り直されましたが、変更検出は「見比べる」側のままです。Zone.js が非同期処理に割り込んで「何か起きたかもしれない」タイミングを検知し、コンポーネントツリーを上から辿って値を突き合わせます。

そして2023年5月の v16 で signals が入りました。公式ドキュメントの説明が分かりやすいと思います。

> a system that granularly tracks how and where your state is used throughout an application

「どこで使われたかを細かく追跡する」と書いてあります。2010年に Knockout がやっていたことです。AngularJS が「見比べる」で始めてから、13年かけて反対側に来ました。

### 2026年の盤面

最初の表を、今の状態で描き直します。

| | 見比べる | 追跡する |
| --- | --- | --- |
| **コンポーネント単位** | React | Vue 3 |
| **式単位** | （空席） | Knockout / Solid / Svelte 5 / Angular / Vue Vapor |

AngularJS がいたマスが空きました。追跡しないまま式単位で更新するやり方は、誰も選んでいません。

そして右下に全員が集まっています。Knockout が2010年に置いた場所です。

左に残っているのは React だけですが、React も最近は気持ちだけは同じ方向を向こうとしています。React Compiler がやっているのは、`useMemo` の依存配列をビルド時に作ることです。追跡はしないという判断は結局変わっていませんが、依存関係を機械が持つという点では他と同じところに来ていると言っても差し支えないでしょう。

## おわりに

はじめ、Knockout は「勝負に負けて消えたもの」かと思っていましたが、実際は少し違いました。

Knockout の公式サイトは今も動いていて、トップページの機能一覧に dependency tracking が並んでいます。この仕組みは負けていません。消えたのは `data-bind="text: count"` という HTML 属性の中に式を書く形式の方で、リアクティビティの部分は名前を signal に変えて全員のところに残りました。

React が仮想DOM で追跡を捨てたのは、その意味では遠回りに見えるかもしれません。ただ、追跡を捨てたからこそ `count` がただの数値でいられて、ただの数値だからテンプレート言語を使わずに JavaScript で書けるようになりました。JSX はこの賭けの副産物です。そして Solid がその JSX を、Knockout の observable に繋ぎ直しました。2010年に分かれた道が、両方とも必要だったことになります。

僕が React と Vue と Solid で感じていた書き味の差は、ただの好みの違いではなくて、2010年に分かれた2つの答えのうちどれを選んだかの差でした。`count` なのか `count.value` なのか `count()` なのか、あの括弧やドットは、そのまま出自を示しています。これから新しい FW が台頭することはあるんでしょうか。今後の動向も楽しみですね。

## 参考

- [Knockout: Home](https://knockoutjs.com/)
- [Introducing runes | Svelte](https://svelte.dev/blog/runes)
- [Signals • Overview • Angular](https://angular.dev/guide/signals)
- [React Compiler v1.0 | React](https://react.dev/blog/2025/10/07/react-compiler-1)
- [SolidJS Official Release: The long road to 1.0](https://dev.to/ryansolid/solidjs-official-release-the-long-road-to-1-0-4ldd)
