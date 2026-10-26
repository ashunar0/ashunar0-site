---
title: reylo で SQL から直接、TypeScript の型ができちゃう。ORM の立場は...?
description: Zod の作者による reylo は、.sql ファイルを TypeScript から import するだけで型が付くツールです。どんな仕組みなのか、ORM は不要になるのか、技術選定はどう変わるのかを考えてみました。
pubDate: 2026-10-26
tags: [TypeScript, SQL, ORM]
draft: false
---

## はじめに

reylo というツールを見つけて、なんじゃこりゃ！？となりました。

`.sql` ファイルを TypeScript から import すると、なんとそれだけで型が付くんです。SQL のファイルを import できるのにまず驚きますが、型を一行も書いていないのに、クエリの結果にちゃんと型が付いています。DB まわりの型は ORM に作ってもらうものだと思っていたので、SQL から直接型が出てくるのはかなり衝撃でした。

https://x.com/colinhacks/status/2113687534618489242?s=20

どうなっているのか気になったので、実際に触ってみて、浮かんだ疑問について考えてみました。

## reylo ってどんなもの？

reylo は、`.sql` ファイルを TypeScript から import すると型が付くツールです。Zod の作者の Colin McDonnell さんが、2026 年 10 月 21 日に公開しました。

https://github.com/colinhacks/reylo

たとえば、こんな SQL を書いておきます。

```sql
-- get_user.sql
select id, name, bio from users where id = :id
```

これを TypeScript からそのまま import して、DB のクライアントを渡して実行します。

```ts
import getUser from "./get_user.sql";

const user = await getUser.run(db, { id: 1 });
// { id: number; name: string; bio: string | null } | null
```

型は一行も書いていないのに、 `user` には、列ごとの型と「見つからなければ `null`」まで付いています。Tanstack や Inertia のように、ファイルを自動生成してるわけでもありません。不思議。

### 型を決めるのは DB

この型は、reylo が開発用の DB に聞いて決めています。型検査のときに DB へつないで、クエリを実行せずに prepare だけさせ、列と引数の型を読み取ります。

ORM だと逆で、例えば Drizzle なら TypeScript でテーブルの定義を書き、TypeScript の DSL でクエリを組み立てて、その結果の型を ORM が計算します。型の出どころは、TypeScript 側に書き写したスキーマです。

reylo には、TypeScript 側のスキーマがありません。手元にあるのは SQL と DB だけで、型はそこから直接できます。これが今までになかったところだと思います。

### DB だけでは分からないところも推論する

prepare で分かるのは、列と引数のおおまかな型までです。reylo はそこから先を、Rust で書いた解析器で推論しています。

1 つは、null になりうるかどうかです。left join した側の列は null になりえますが、`where` で弾いていれば、そのぶん型から null が外れます。

```sql
select u.name, p.title
from users u
left join posts p on p.user_id = u.id
where p.published_at is not null
```

このクエリだと、`p.title` は `string` になります。ORM の多くは left join を見た時点で `string | null` にするので、受け取った側で `!` や `?? ""` を書くことになりがちです。

もう 1 つは、何行返るかです。

| クエリ | 返り値の型 |
|---|---|
| 主キーや unique キーでの一致、`limit 1` | `Row \| null` |
| `group by` なしの集約、1 行の `insert ... returning` | `Row` |
| `returning` なしの `insert` / `update` / `delete` | `void` |
| それ以外 | `Row[]` |

さっきの `get_user.sql` が配列ではなく `Row | null` になったのは、主キーで引いているからです。

### SQL の間違いが型エラーになる

試してみていちばん驚いたのは、SQL を打ち間違えたときでした。列名の `name` を `nmae` にして `tsc` を回すと、こうなります。

```
queries/get_user.sql(1,12): error reylo6: no such column: nmae
```

エラーの場所が `.sql` ファイルの 1 行目 12 桁目です。TypeScript の型検査が、SQL ファイルの中まで見てくれるようになりました。これはうれしいです。

DB のテーブルから列を消したときも同じで、その列を使っている `.sql` と、結果を受け取っている TypeScript の両方がエラーになります。

## どこまでが TS の機能で、reylo は何をしているの？

TypeScript が用意したのは、TypeScript 以外のファイルの型を、外のプログラムに書かせる仕組みだけです。SQL を読むことも、DB につなぐことも、全部 reylo がやっています。

### TypeScript 7.1 の content mappers

この仕組みは content mappers という名前で、TypeScript 7.1 で入りました（まだ beta です）。

https://github.com/microsoft/typescript-go/pull/4712

`tsconfig.json` に「`.sql` はこのパッケージに任せる」と書いておくと、型検査のときに TypeScript がそのパッケージのプログラムを立ち上げて、ファイルの中身を渡します。プログラムは型を TypeScript のコードとして書いて返し、TypeScript はそれをそのファイルの型として扱います。

```jsonc
{
  "contentMappers": [
    { "package": "reylo", "extensions": [".sql", ".reylo.yaml", ".reylo.yml"] }
  ]
}
```

エラーの位置の対応も一緒に返せるので、さっきのエラーは `.sql` の行と桁に出ます。型検査の途中で外のプログラムを動かすので、`tsc` には `--runExternalCode` を付けて許可します。

TypeScript 側は SQL について何も知らず、`.sql` を `.ts` に変える係を外に呼んでいるだけです。

### reylo がやっていること

型検査のときは、SQL を DB に prepare させ、Rust の解析器で null や行数を推論して、型の宣言を返します。`get_user.sql` なら、おおよそこんなコードです。

```ts
import type { Query } from "reylo";
export type Params = { id: number };
export type Row = { id: number; name: string; bio: string | null };
declare const query: Query<Params, Row, "maybeOne", "sqlite">;
export default query;
```

`"maybeOne"` が「0 行か 1 行」の意味で、`.run()` が `Row | null` を返すのはここから来ています。

実行時は TypeScript の出番がないので、`.sql` を `.run()` 付きの JavaScript に変えるのも reylo です。Vite や esbuild のプラグインと、Node 用の `--import reylo/register` が用意されています。

content mappers 自体は SQL 専用ではないので、GraphQL や OpenAPI の定義ファイルにも、同じやり方で型を付けられそうです。

## ORM は不要になる？

TypeScript で Prisma や Drizzle を使ういちばん大きな理由は、型を TypeScript で作れることでした。生の SQL を書くと結果が `any` になるので、型を手で書くしかありません。手で書いた型は、DB の実態とずれても誰も気づきません。

でも、SQL から直接型が出てくるなら、ORM っていらなくなるんでしょうか？

### 型だけなら reylo で足りる

reylo は DB から直接型を作るので、ORM より正確です。window 関数や CTE のように ORM の DSL で書きにくいクエリでも、`` sql<number>`...` `` と自分で型を宣言せずに済みます。「SQL を書くのがだるい」という理由も、AI が SQL を書くようになってだいぶ薄れました。

ただ、ORM がやっていた仕事は型だけではありません。

| ORM の仕事 | reylo では |
|---|---|
| クエリの結果に型を付ける | 代わりにやれる。DB に聞くので ORM より正確 |
| 関連するデータをまとめて取る | だいたいやれる。`json_agg` などで入れ子の JSON にすると、その形のまま型が付く |
| 条件に応じてクエリを組み立てる | SQL の中の分岐で書く |
| マイグレーション | やらない。Drizzle Kit や dbmate など、別の道具を使う |
| DB を差し替えられるようにする | やらない。その DB の SQL をそのまま書く |

残るのはマイグレーションと、クエリの組み立てです。マイグレーションは reylo では持たず、Drizzle Kit などをそのまま使うように FAQ に書かれています。

### クエリの組み立ては SQL の中で分岐する

`.sql` は静的なファイルなので、ORM のように if 文でクエリを組み立てられません。代わりに全部の条件を 1 本の SQL に書いておいて、引数が null なら条件を外します。

```sql
select id, title
from posts
where title like '%' || coalesce(:q::nullable(text), '') || '%'
  and user_id = coalesce(:author_id::nullable(integer), user_id)
```

引数の型は `{ q?: string | null; author_id?: number | null }` になり、省略した条件は消えます。URL の検索パラメータをそのまま渡せるので、かなり楽です。

困ったのは、PATCH のように渡された項目だけ更新するクエリでした。`set bio = coalesce(:bio::nullable(text), bio)` だと、`{ bio: null }` を渡しても「渡されなかった」と区別できず、bio を消せません。

JSON の引数で受けて、キーがあるかを SQLite の `json_type` で調べると区別できます。引数の型は `{ patch: { name?: string; bio?: string | null } }` になり、「`name` は省略できるけど null にはできない」まで型に乗ります。ただ、項目ごとに JSON Schema と分岐を SQL に書くので、手で書くには重いです。

### 依存は減らないけど、抜けやすい

生の SQL にすれば依存が減る、という見方もありますが、reylo 自体が TypeScript 7.1 の beta やプラグイン、型検査用の DB を連れてくるので、依存はあまり減りません。変わるのはやめるときの手間で、クエリは普通の `.sql` のまま残るので、reylo をやめても失うのは型だけです。

## 仮にこれが台頭したら、技術選定はどうなる？

今は TypeScript で DB を扱うとき、「Prisma にするか Drizzle にするか」のように ORM 同士を比べて選んでいます。reylo のようなものが広がったら、何を比べて選ぶことになるんでしょうか。

### スキーマを書き写すか、DB を正にするか

Prisma も Drizzle も、型の出どころは自前のスキーマ定義です。reylo では DB そのものなので、どの ORM にするかより前に「スキーマを TypeScript 側に書き写すか、DB を正にするか」を決めることになりそうです。

DB を正にすると、ORM が 1 つでやっていた仕事を、マイグレーションは Drizzle Kit や `wrangler d1 migrations`、型は reylo、組み立てが多いところは Kysely のようなクエリビルダー、と分けて受け持つ形になります。手元で Hono と Cloudflare D1 で試したときも、マイグレーションは wrangler、型は reylo で組めて、Hono の RPC 越しにクライアントまで型が届きました。

その代わり、エディタでも CI でも、型検査のたびに DB が要ります。SQLite や D1 ならただのファイルですが、Postgres なら CI でコンテナを立てることになります。

### AI エージェントには選ぶ理由になる

SQL は何十年も大きく変わっていないので、版ごとに API が変わる ORM の DSL より、エージェントが存在しないメソッドを書く心配が少ないです。それに、エージェントが書いた SQL の間違いを `tsc` が実行前に `.sql` の行で教えてくれるので、エージェントが自分で直せます。reylo もエージェント向けの skill と `llms.txt` を用意しています。

### 今はまだ試す段階

TypeScript 7.1 は beta で、reylo も 0.5.0 です。Hono で試したときは入力の検査とつながっておらず、PATCH の body の型はクライアントに届きませんでした。不正な body は reylo が実行前に弾きますが、エラーのクラスが公開されていないので 500 になります。どれも、周りの道具が追いつけば埋まりそうな穴です。

## おわりに

reylo がやっていることは「`.sql` を import すると型が付く」だけですが、型の出どころが ORM のスキーマ定義から DB そのものに移るので、ORM の立ち位置まで変わりそうです。型のために ORM を使っていた部分は reylo で置き換えられて、残るのはマイグレーションとクエリの組み立てでした。

TypeScript 側の content mappers は SQL 専用の仕組みではないので、これから似た道具が増えていくと思います。TypeScript 7.1 の正式版が出たら、もう一度触ってみたいです。
