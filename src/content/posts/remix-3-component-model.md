---
title: Remix 3 も面白そう
description: Remix 3 は React をやめて自前のコンポーネントモデルを持ちました。外側の関数が一度だけ走り、返した関数が更新のたびに走ります。state がただの変数でいられる理由と、更新を明示的に呼ぶ仕組みを調べます。
pubDate: 2026-09-08
tags: [Remix, React, Solid, 状態管理]
draft: false
---

## はじめに

[Remix 3] が 2026 年 10 月 2 日にリリース予定です。バージョン 2 までとの一番大きな違いは、React から脱却です。ルーティングもデータ取得も UI も、Remix 自身が持つようになりました。

https://remix.run/

その UI の部分、`remix/ui` のコンポーネントが変わった形をしています。関数コンポーネントであることは React と同じですが、返すものが JSX ではなく**関数**です。この記事では、そのコンポーネントの書き方と、それが何を可能にしているのかを調べます。

## コンポーネントは関数を返す関数

公式ガイドに載っている一番小さな例です。

```tsx
import type { Handle } from "remix/ui";

export function AlbumHeading(handle: Handle<AlbumHeadingProps>) {
  // Setup: runs once for this component instance.

  return () => {
    // Render: runs for the initial render and every update.
    return (
      <header>
        <p>{handle.props.artist}</p>
        <h1>{handle.props.title}</h1>
      </header>
    );
  };
}
```

関数がふたつあります。外側の `AlbumHeading` と、それが `return` している無名関数です。ドキュメントはこのふたつを **setup** と **render** と呼び分けていて、走るタイミングが違います。

- setup は、Remix がこのコンポーネントを作るときに**一度だけ**走ります
- render は、setup の直後に一度走り、そのあとは**更新のたびに**走ります

React の関数コンポーネントは、この区別を持ちません。関数の本体がそのまま render であり、初回も更新もまったく同じ関数を頭から実行します。Remix 3 は同じ場所をふたつに割って、一度きりの区画と何度でも走る区画を作っています。

props は引数ではなく `handle.props` から読みます。`handle` そのものはコンポーネントの生存中ずっと同じオブジェクトで、各プロパティの値が render の直前に差し替わります。setup は一度しか走らないので、props を setup スコープの変数に受け取ってしまうと初回の値で固定されます。読むのは render の中から、というのがここでの約束です。

## state がただの変数になる

setup が一度しか走らないので、そこに置いた変数はコンポーネントが生きているあいだ残り続けます。つまり state 専用の仕組みが要りません。アルバムの一覧を絞り込む例です。

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

type Album = {
  id: string;
  title: string;
  year: number;
};

export function AlbumList(handle: Handle<{ albums: Album[] }>) {
  let filter = "";

  return () => {
    let visibleAlbums = handle.props.albums.filter((album) =>
      album.title.toLowerCase().includes(filter.toLowerCase()),
    );

    return (
      <div>
        <input
          aria-label="Filter albums"
          mix={on("input", (event) => {
            filter = event.currentTarget.value;
            handle.update();
          })}
          type="search"
        />
        <ul>
          {visibleAlbums.map((album) => (
            <li key={album.id}>{album.title}</li>
          ))}
        </ul>
      </div>
    );
  };
}
```

絞り込みの文字列は `let filter = ""` です。`useState` も `signal` も出てきません。render が走るたびにこの変数を読みますが、代入の記録は setup スコープのクロージャに残っているので、前回入力した値がそのまま見えます。

React で同じことを `let` で書くと動きません。React は更新のたびに関数本体を頭から実行するので、`let filter = ""` の行も毎回実行されて空文字に戻ります。値を次の実行まで運ぶ場所が関数の中に無いため、React は `useState` という外部の置き場所を用意しています。Remix 3 は関数を二段に割ったことで、その置き場所が関数の中にできています。

置き場所が普通の変数なので、置けるものにも制限がありません。オブジェクトでもクラスのインスタンスでも `Map` でも、必要なものをそのまま宣言できます。宣言する位置も自由です。フックのルール（トップレベルでのみ呼ぶ、条件分岐やループの中で呼ばない）は、React が呼び出し順で state を対応づけているために必要なものでした。Remix 3 は変数名で対応づけるので、その制約が生まれません。

一方で、setup に置くものは選びます。ガイドは「レンダリングに影響する値を保持し、それ以外はすべて render の中で導出する」と書いています。上の例では `visibleAlbums` が導出にあたります。`filter` と `handle.props.albums` から毎回計算し直しているので、絞り込み結果を変数として持つ必要がありません。React の `useMemo` にあたるものを最初から書かない形です。

## 更新は自分で呼ぶ

前の例のイベントハンドラをもう一度見てみましょう。

```tsx
<input
  aria-label="Filter albums"
  mix={on("input", (event) => {
    filter = event.currentTarget.value;
    handle.update();
  })}
  type="search"
/>
```

2 行あります。1 行目で変数に代入し、2 行目で `handle.update()` を呼んでいます。ガイドの言い方では「更新は明示的で、変数を変えてもコンポーネントが更新を要求するまで何も描画されない」となります。`handle.update()` を消すと、`filter` の値は変わったまま画面だけが古いままになります。

`handle.update()` が何をするかというと、setup が返した render 関数をもう一度呼びます。setup は走りません。返した関数だけをもう一度実行して、返ってきた JSX を DOM に反映します。

React の `setState` や Solid の signal への代入は、値の変更が更新のきっかけになっていました。値と描画のあいだに依存関係の追跡があって、それが自動で走ります。Remix 3 には追跡がありません。代入はただの代入で、描画を要求するのは `handle.update()` の一行だけです。Ryan Florence はこの形を **MFGR（Manual Fine-Grained Reactivity）** と呼んでいます。

呼び出しを自分で書くので、まとめて書き換えてから一度だけ更新する、という制御が自然に書けます。逆に、更新後の DOM を前提にした処理を続けたいときは `handle.update()` を `await` できます。

ここは忘れる可能性もあるので、ちょっぴり面倒ですね。

イベントの登録に使っている `mix` は、要素にふるまいやスタイルをまとめて足すための属性です。配列を渡せるので、複数を合成できます。

```tsx
<button
  mix={[
    btn.secondaryStyle,
    on("click", async (_, signal) => {
      // async behavior with abort signal handling
    }),
  ]}
>
```

ハンドラの第 2 引数には `AbortSignal` が渡ります。同じハンドラが再び発火すると前回の signal が abort されるので、これを `fetch` に渡しておくと古いリクエストが自動で打ち切られます。非同期処理の競合を防ぐ仕組みが、ハンドラの引数として最初から用意されています。

## React とも Solid とも違う位置

「一度きりで走る区画」と「何度でも走る区画」の分け方は、フレームワークごとに違います。3 つ並べます。

React の関数コンポーネントは、更新のたびに関数本体を頭から実行し直します。変数の宣言も、`if` も、途中の計算も全部やり直します。一度きりの区画がないので、実行をまたいで残したいものは `useState` や `useRef` に預けます。返ってきた要素の木は前回のものと比較され、差分だけが DOM に反映されます。

Solid のコンポーネント関数は、生成時に一度だけ走ります。そのあとは二度と呼ばれません。JSX の中で signal を読んだ箇所ひとつひとつが購読者になっていて、signal が書き換わると、その値を使っている DOM のノードだけが更新されます。コンポーネントという単位で再実行が起きません。

Remix 3 は、コンポーネントを setup と render に割って、setup だけを一度きりにしました。更新のたびに走るのは render 関数だけです。ここが Solid と違うところで、更新の単位はコンポーネントのままです。render が返した JSX は、起点にした Preact 由来の仕組みで差分として DOM に反映されます。

| | 一度だけ走る部分 | 更新のたびに走る部分 | 更新のきっかけ |
| --- | --- | --- | --- |
| React | なし | 関数本体すべて | `setState` の呼び出し（依存追跡は自動） |
| Solid | コンポーネント関数 | なし（DOM ノードを直接更新） | signal の書き換え（依存追跡は自動） |
| Remix 3 | setup | render 関数 | `handle.update()` の呼び出し（追跡なし） |

表の右端の列が MFGR の意味するところです。React も Solid も、値が変わったことを検知して描画につなげる仕組みを内部に持っています。React は再実行して比較し、Solid は購読者を辿ります。Remix 3 はどちらもやりません。値が変わったことは誰も知らないままで、描画は `handle.update()` を書いた場所からだけ始まります。

## 全部提供されている

ここは興味深いところです。

Remix 3 では `remix` というひとつのパッケージに全部を入れて配る形をとっています。ガイドが挙げている範囲は、型付きのルーティングと middleware、サーバーレンダリングとハイドレーションを伴う UI コンポーネント、ナビゲーション、スタイリングとイベントのプリミティブ、データの検証と永続化、認証とセッション、アセットのコンパイル、テストです。

これは公開されている 6 つの設計原則のうち、最後の **Distribute Cohesively** にあたります。原則 5 で「抽象は単一目的で差し替え可能であるべき」と言った直後に、「ただし極端に composable なエコシステムは学習も利用も難しい。したがってパッケージ群は単一のパッケージにまとめ、ひとつの道具箱として再 export する」と書いています。細かく割る方針と、割ったものを束ねて配る方針が並んでいます。

データベース周りは `remix/data-table` が担当しています。ドキュメントは「typed relational query toolkit」と名乗っていて、フルの ORM でも素のクエリビルダでもない中間だと説明しています。PostgreSQL・MySQL・SQLite で同じ API が使えます。

```js
import { column as c, hasMany, table } from 'remix/data-table'

let users = table({
  name: 'users',
  columns: {
    id: c.uuid(),
    email: c.varchar(255),
    role: c.enum(['customer', 'admin']),
    created_at: c.integer(),
  },
})

let orders = table({
  name: 'orders',
  columns: {
    id: c.uuid(),
    user_id: c.uuid(),
    status: c.enum(['pending', 'processing', 'shipped', 'delivered']),
    total: c.decimal(10, 2),
    created_at: c.integer(),
  },
})

let userOrders = hasMany(users, orders)
```

OTM 的なものもあります。読み書きの API は 2 系統あって、join や集約を書くクエリビルダと、単純な操作のための CRUD ヘルパーです。

```js
// クエリビルダ
let recentPendingOrders = await db
  .query(orders)
  .where({ status: 'pending' })
  .orderBy('created_at', 'desc')
  .limit(20)
  .all()

// CRUD ヘルパー
let user = await db.find(users, 'u_001')
let updatedUser = await db.update(users, 'u_003', { role: 'admin' })
```

マイグレーションはスキーマ定義から生成するのではなく、SQL を直接書きます。タイムスタンプ付きのディレクトリに `up.sql` と `down.sql` を置く形です。

```
app/db/migrations/
  20260228090000_create_users/
    up.sql
    down.sql
  20260301113000_add_user_status/
    up.sql
    down.sql
```

適用は CLI から行います。適用済みのマイグレーションは journal テーブルに記録され、チェックサムのずれも検出されます。

```bash
remix db status              # 適用状況を見る
remix db migrate             # 未適用のものを適用する
remix db rollback --step 2   # 2 つ戻す
remix db seed                # seed を流す
remix db reset --force       # 作り直す
```

検証は `remix/data-schema` が担当していて、Zod や Valibot にあたる位置にあります。認証とセッションも同梱です。外から足すものが減っている状態です。

ツールを考えなくていいというのはありがたいですね。Rails の良かったところの一つでもあります。もちろん、必要なところだけ Zod や Drizzle などを導入しても ok です。何はともあれ、こうやって全部入りで提供される FW は、JS の世界ではあまりなかったので、面白い要素です。

## おわりに

Remix 3 のコンポーネントは、setup と render のふたつに分かれています。setup は生成時に一度だけ、render は更新のたびに走ります。この分け方によって、setup スコープに置いた変数がそのまま state として使えるようになり、フックのルールも消えています。このメンタルモデルはなかなか賛成できます。

描画のきっかけは `handle.update()` の呼び出しだけです。値の変更を検知する仕組みが無いので、React のように再実行して比較することも、Solid のように購読者を辿ることもありません。更新の単位は Solid のような DOM ノードではなく、コンポーネントの render 関数です。

安定版は 2026 年 10 月 2 日、Remix Jam でのリリース予定です。楽しみですね。

## 参考

- [Wake up, Remix! | Remix](https://remix.run/blog/wake-up-remix)
- [Remix 3 Beta Preview | Remix](https://remix.run/blog/remix-3-beta-preview)
- [Remix 3 Release Candidate | Remix](https://remix.run/blog/remix-3-release-candidate)
- [Rendering UI | Remix Docs](https://guides.remix.run/rendering-ui/)
- [remix/data-table | Remix API Documentation](https://api.remix.run/api/remix/data-table/overview/)
- [Unpacking Remix 3 Pt.1: Frontend](https://giuseppegurgone.com/unpacking-remix3-pt1-frontend)
