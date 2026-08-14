---
title: Nani にも使われている Valibot はなぜ小さいのか、Zod と比べて分かるスキーマ検証ライブラリの設計
description: メソッドチェーンと pipe の違いがバンドルサイズに直結する仕組み、スキーマの実体をコンソールに出して確かめる話、esbuild での実測値。import の書き方ひとつで Zod が 5 倍縮む話と、Zod v4 が zod/mini で出した答え。
pubDate: 2026-08-16
tags: [Valibot, Zod, TypeScript, 設計]
draft: false
---

## はじめに

catnose さんの手がける翻訳アプリ Nani!? に Valibot が使われているということを知りました。

https://x.com/catnose99/status/2088157751268774139?s=20

Valibot は最近よく聞く名前なので前々から気になっていたのですが、これを機に調べてみます。今回は、TypeScript のスキーマ検証ライブラリとして Zod を使っている前提で、Valibot が何を変えるのかを整理します。

Valibot は「バンドルサイズが小さい」という点で紹介されることが多いライブラリです。ただしサイズは目的ではなく、設計から出てくる帰結です。この記事では実測値を出したうえで、その数字を生んでいる設計を確認し、サイズ以外に何が変わるのかまで見ます。

検証に使ったバージョンは Valibot 1.4.2、Zod 4.4.3、esbuild 0.28.2 です。

## 二つの書き方

同じスキーマを両方で書くと、こうなります。

```ts
// Zod
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const result = LoginSchema.safeParse(input);
```

```ts
// Valibot
import * as v from 'valibot';

const LoginSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8)),
});

const result = v.safeParse(LoginSchema, input);
```

見た目の差は二つです。

一つは、検証の追加がメソッドチェーンではなく `pipe` の引数になっていること。もう一つは、`safeParse` がスキーマのメソッドではなく、スキーマを第一引数に取る関数になっていることです。

Valibot の公式ドキュメントは、この構成要素を三つに分けて説明しています。型を決める**スキーマ**（`v.string()`、`v.object()`）、スキーマを使う・変換する**メソッド**（`v.parse`、`v.pipe`）、そして `pipe` の中でだけ意味を持つ**アクション**（`v.trim()`、`v.email()`）です。

書き味の話としては、ここは好みで終わります。差が出るのはこの下です。

## スキーマの実体を覗く

`v.string()` が何を返しているのかを、そのままコンソールに出してみます。

```ts
import * as v from 'valibot';

const schema = v.string();
console.log(Object.keys(schema));
console.log(Object.getPrototypeOf(schema) === Object.prototype);
```

```
[ 'kind', 'type', 'reference', 'expects', 'async', 'message', '~standard', '~run' ]
true
```

プロトタイプが `Object.prototype` です。つまり `v.string()` はクラスのインスタンスではなく、**ただのオブジェクト**を返しています。持っているのはプロパティだけで、`.min()` のようなメソッドは生えていません。検証を実行する `~run` が入っているだけです。

Zod で同じことをすると、返ってくるのは `ZodString` のインスタンスです。そのプロトタイプには 40 個以上のメンバがぶら下がっています。
`.min()`、`.email()`、`.uuid()`、`.datetime()`、`.transform()`、といった全部です。

この差がそのままバンドルサイズになります。

バンドラのツリーシェイキングは、「このトップレベル関数はどこからも呼ばれていない」という判断はできます。`v.email()` をインポートしなければ、`v.email` の実装はバンドルに入りません。一方で「このクラスのこのメソッドはどこからも呼ばれていない」という判断は原理的に困難です。`ZodString` を一つでも使えば、`ZodString.prototype` に生えている実装は丸ごとバンドルに入ります。使うのが `.min()` だけでも、`.datetime()` のパーサは付いてきます。

Valibot が小さいのは、実装を削ったからではありません。**振る舞いをクラスに持たせず、外部の関数に置いた**結果として、バンドラが消せるようになっているだけです。

## サイズを測る

先ほどのログインフォームのスキーマをそのままエントリポイントにして、esbuild で bundle + minify したときのサイズです。gzip 後の数字も並べます。

| | minify | minify + gzip |
|---|---|---|
| Valibot | 3,718 B | 1,498 B |
| Zod (`import { z }`) | 327,261 B | 64,990 B |
| Zod (名前付き import) | 65,197 B | 18,247 B |
| `zod/mini` | 11,006 B | 4,244 B |

Valibot と Zod で 12 倍の差があります。これ自体は設計から予想される通りです。

ただ、この表には設計とは別の話が混ざっています。**同じ Zod なのに、import の書き方だけで 5 倍違います。**

## `import { z } from "zod"` が引き連れてくるもの

上の 1 行目と 2 行目のスキーマ定義はまったく同じで、違うのは import 文だけです。

```ts
import { z } from 'zod';        // 64,990 B (gzip)
import { object, string } from 'zod'; // 18,247 B (gzip)
```

esbuild の metafile で内訳を見ると、原因が分かります。

```
  31825  zod/v4/core/schemas.js
  22483  zod/v4/classic/schemas.js
  10628  zod/v4/core/util.js
  10111  zod/v4/core/api.js
   9392  zod/v4/locales/he.js
   8445  zod/v4/core/json-schema-processors.js
   8375  zod/v4/core/checks.js
   7777  zod/v4/classic/from-json-schema.js
   6874  zod/v4/locales/ru.js
   6687  zod/v4/locales/ta.js
   6633  zod/v4/locales/th.js
   6582  zod/v4/locales/be.js
```

ヘブライ語、ロシア語、タミル語、タイ語、ベラルーシ語。エラーメッセージのロケール定義です。合計すると、minify 後 327KB のうち **198KB、全体の 61% がロケールファイル**でした。

`z` は名前空間オブジェクトです。`z.locales` からすべてのロケールに到達できるので、バンドラは「どれも使われていない」と判断できません。名前付き import に変えると `z` という束が消えるので、ロケールも JSON Schema 変換も落ちます。

Valibot は名前空間の `import * as v` で書くのが公式の推奨ですが、こちらは問題になりません。Valibot の名前空間は個別の export をまとめただけで、`v.email` を参照しなければ `v.email` の実装には到達できないためです。ロケールも `@valibot/i18n` という別パッケージに切り出されていて、本体には英語のメッセージしか入っていません。

つまりこの 5 倍は、Zod のバンドルサイズの話というより、**バレルエクスポートと名前空間オブジェクトの一般的な罠**です。Zod を使い続けるとしても、フロントエンドに載せるなら import の書き方は見直す価値があります。

## Zod v4 の答え — `zod/mini`

Zod もこの構造を認識していて、v4 で `zod/mini` という別エントリを用意しました。

```ts
import * as z from 'zod/mini';

const LoginSchema = z.object({
  email: z.string().check(z.trim(), z.email()),
  password: z.string().check(z.minLength(8)),
});

const result = z.safeParse(LoginSchema, input);
```

`.min()` が `check(z.minLength(8))` になり、`safeParse` が関数になっています。Valibot の `pipe` とほぼ同じ形です。同じ問題に対して同じ答えが出ています。

サイズも 4,244 B（gzip）まで落ちます。Valibot の 1,498 B とはまだ 3 倍近い差がありますが、これは Zod がスキーマ本体をクラスとして持っている構造が残っているためで、`zod/mini` は「チェックの部分だけ関数化した」中間形です。

注意点として、Zod のドキュメントは `zod/mini` の欠点を自分で挙げています。IDE の補完が効きにくくなること、記述が冗長になること、そして**バックエンドでは使うなと明言していること**です。Lambda のコールドスタートで測っても改善は 0.6ms 程度で、DX を落とす対価に見合わない、という立場です。

ここは Valibot を検討するときにも同じことが言えます。Node や Cloudflare Workers 上の API サーバでスキーマがクライアントに載らないなら、サイズの差は体感に出ません。**サイズを理由に乗り換えるかどうかは、スキーマがブラウザに送られるかどうかで決まります。**

では、サーバサイドだけで使う場合に Valibot を選ぶ理由はないのか。次はそこを見ます。

## 組み込みと自作が同じ格に並ぶ

Valibot で独自の検証を足すときは `v.check()` を使います。この結果を、組み込みの `v.email()` と並べてみます。

```ts
const builtin = v.email();
const custom = v.check((s: string) => !s.endsWith('@example.com'), 'ng');

console.log(Object.keys(builtin));
console.log(Object.keys(custom));
console.log(builtin.kind, custom.kind);
```

```
[ 'kind', 'type', 'reference', 'expects', 'async', 'requirement', 'message', '~run' ]
[ 'kind', 'type', 'reference', 'async', 'expects', 'requirement', 'message', '~run' ]
validation validation
```

キーの集合が一致していて、`kind` も両方 `validation` です。構造として区別がありません。だから `pipe` の中では同格に並びます。

```ts
const EmailSchema = v.pipe(v.string(), v.trim(), v.email(), custom);
```

`v.email()` が三番目で、自作が四番目。どちらが組み込みかは、この行を読んでも分かりません。追加の方法が一つしかないので、覚えることも一つです。

### Zod v4 との差はどこまで残るか

ここは Zod v4 でも縮んでいます。v4 では classic 側にも `.check()` が入り、組み込みと自作を混ぜられます。

```ts
const S = z.string().check(
  z.minLength(3),
  z.refine((s) => !s.endsWith('!'), 'ng'),
);
```

これは動きます。「Zod では自作の検証が二級市民になる」という説明は、v4 では正確ではありません。

残る差は、能力ではなく**一貫性**の方です。Zod には `z.string().min(3)` と `z.string().check(z.minLength(3))` の二つの書き方が併存していて、ドキュメントで先に出てくるのも IDE が補完してくれるのも前者です。結果として、組み込みはチェーン、自作は `.refine()`、という混在した書き方に落ち着きやすくなります。Valibot には `pipe` しかないので、そもそも混ざりません。

「読んで分かるコード」を規約で担保しようとするとき、この差は地味に効きます。**選択肢が一つしかないことは、規約を一つ書かなくて済むことと同じ**です。

## 変換の順序が引数の順になる

`pipe` は検証だけでなく変換も同じ列に置けます。クエリパラメータのように、文字列で来たものを数値にしてから検証したい場面がそのまま書けます。

```ts
const Page = v.pipe(
  v.string(),
  v.transform(Number),
  v.number(),
  v.minValue(1),
);

v.parse(Page, '3');   // 3 (number)
v.parse(Page, '0');   // Invalid value: Expected >=1 but received 0
v.parse(Page, 'abc'); // Invalid type: Expected number but received NaN
```

上から読むと、文字列を受け取り、数値に変換し、数値であることを確認し、1 以上を要求する、と書いてある通りに動きます。入力の型と出力の型が違うことも、この列を見れば分かります。型としては `v.InferInput<typeof Page>` が `string`、`v.InferOutput<typeof Page>` が `number` と、対称な名前で取り出せます。

Zod にも `z.input` / `z.output` があり、同じことはできます。違いは、変換がチェーンの途中に挟まるのか、列の一要素として並ぶのかという見た目の問題に近く、ここは好みで判断していい部分です。

なお、**変換を挟んだあとにスキーマの構造をいじるのは、どちらも素直ではありません**。Zod v4 で `z.object({...}).transform(...)` すると返り値は `ZodPipe` になり、`.extend()` は消えます。Valibot で `v.pipe(ObjectSchema, v.transform(...))` した結果に `v.omit()` を掛けると、呼び出しは通るのに省いたはずのキーが要求され続けます。**この一点に限れば、型エラーとして即座に気づける Zod の方が安全です。** 変換は最後に一度だけ掛ける、という運用でどちらも回避できます。

## エコシステムと Standard Schema

実務で効くのはここです。2026 年 8 月時点の主要パッケージを並べます。

| 用途 | Zod | Valibot |
|---|---|---|
| Hono のバリデータ | `@hono/zod-validator` | `@hono/valibot-validator` |
| Drizzle 連携 | `drizzle-zod` | `drizzle-valibot` |
| OpenAPI | `@hono/zod-openapi` | `hono-openapi` + `@valibot/to-json-schema` |
| メッセージの多言語化 | 本体同梱 | `@valibot/i18n`（別パッケージ） |

Hono での書き味はほぼ同じです。

```ts
import * as v from 'valibot';
import { vValidator } from '@hono/valibot-validator';

const schema = v.object({ name: v.string(), age: v.number() });

app.post('/author', vValidator('json', schema), (c) => {
  const data = c.req.valid('json');
  return c.json({ ok: true, message: `${data.name} is ${data.age}` });
});
```

そして、この表の見え方を変える仕様が **Standard Schema** です。検証ライブラリが共通で実装する 60 行ほどの TypeScript インターフェースで、Zod v4・Valibot・ArkType・TypeBox が対応済みです。先ほど `v.string()` の中身に `~standard` というキーが混ざっていたのは、これです。

対応したツール側は、どのライブラリのスキーマでも同じように受け取れます。Hono には `@hono/standard-validator` があり、tRPC や TanStack Form / Router も対応しています。

```ts
import { sValidator } from '@hono/standard-validator';

// schema が Zod でも Valibot でも、この行は変わらない
app.post('/author', sValidator('json', schema), handler);
```

つまり、**バリデータ層をライブラリに固定しないで書けます**。乗り換えのコストがゼロになるわけではありませんが、「片方を選んだらフレームワーク連携ごと縛られる」という以前の状況ではなくなりました。検討のハードルは下がっています。

なお、OpenAPI の生成周りは Zod の方が厚みがあります。`@hono/zod-openapi` はルート定義とスキーマを一体で書く形が確立していて、Valibot 側の `hono-openapi` は同じことができるものの、情報量とサンプルの多さで差があります。ここを重く使っている構成では、乗り換えの手間はバリデータ層だけでは済みません。

## 正直な欠点

Valibot 側の不利な点も挙げておきます。

**補完が弱くなります。** チェーンなら `z.string().` と打った時点で候補がその型に使えるものだけに絞られますが、`v.` の後には全 API が並びます。`pipe` の中で何が使えるかは、型が合わなければエラーになるとはいえ、書いている最中には教えてくれません。Zod のドキュメントが `zod/mini` の欠点として挙げているのと同じ話です。

**記述が長くなります。** `z.string().min(8)` が `v.pipe(v.string(), v.minLength(8))` になります。一箇所なら誤差ですが、スキーマが増えると差は積み上がります。

**情報量が違います。** 詰まったときに検索して出てくる件数、AI に書かせたときの精度、いずれも Zod の方が有利です。これは設計の優劣ではなく採用実績の差なので、時間が解決するかもしれませんし、しないかもしれません。まぁこれに関しては、Skills や参考実装で十分解決できそうな気はしますが。

## どちらを選ぶか

判断の軸は二つあります。

### 一つめ：スキーマがブラウザに送られるか

送られるなら、差は実測で 12 倍あります。フォームの検証をクライアントとサーバで共有する構成では、Valibot を選ぶ理由がはっきりあります。ここは好みの話ではありません。

送られないなら、この軸では差がつきません。Zod の言う通り、サーバ側でのサイズ差は体感に出ません。バックエンドだけで使うなら、一つめの軸は判断材料から外れます。

### 二つめ：書き方を一つに絞りたいか

サイズが効かない場面でも、こちらの軸は残ります。そして実際にコードベースを長く保つうえでは、こちらの方が重い軸です。

Valibot には検証を足す方法が `pipe` しかありません。組み込みの `v.email()` も自作の `v.check()` も、同じ列に同じ格で並びます。書き手が選べる余地がないので、スキーマの書き方は誰が書いても同じ形になります。

Zod は同じことが二通り書けます。`z.string().min(3)` と `z.string().check(z.minLength(3))` は結果が同じで、どちらを使うかは書き手が決めます。決められるということは、レビューで指摘する対象が一つ増え、規約に一行書く必要が生まれるということです。そして規約は、書けば守られるものではありません。

**選択肢が一つしかないことは、規約を一つ書かなくて済むことと同じです。** これは複数人で触るコードベースほど効きます。書き方が揺れないスキーマは、読むときに形を確認する必要がありません。`pipe` の中を上から読めば、それが全部です。

Valibot を採る理由としては、こちらの方が強いと考えています。サイズは分かりやすい入口ですが、日々の読み書きに効き続けるのは一貫性の方です。

### 持ち帰れる話

どちらを選ぶにしても効く話が一つあります。**`import { z } from "zod"` をやめて名前付き import にすると、gzip 後で 65KB が 18KB になります。** これは Valibot と関係なく効きます。

## おわりに

Valibot は「小さいライブラリ」として紹介されますが、小さくするための工夫はどこにもありませんでした。スキーマをクラスではなくただのオブジェクトにして、振る舞いを外の関数に置いた。バンドラが消せるようになったのはその結果です。数字は設計を見た後でないと意味が読めません。

そして同じ設計から、サイズとは別のものが出てきます。振る舞いが外の関数にあるということは、組み込みの関数と自分で書いた関数を区別する理由がないということです。だから `pipe` に同じ格で並び、書き方が一つに定まります。**サイズと一貫性は、別々の長所ではなく同じ判断から出た二つの面です。**

ライブラリを比べるときに出てくる数字は、たいてい設計の断面です。断面だけ並べても、どちらが自分の状況に効くかは決まりません。今回で言えば、12 倍という数字が効くのはブラウザに載せる場合だけで、載せない場合に残るのは「選べる余地がない」という、数字にならない方の面でした。

## 参考

- [Valibot 公式ドキュメント](https://valibot.dev/)
- [Comparison | Valibot](https://valibot.dev/guides/comparison/)
- [Zod Mini | Zod](https://zod.dev/packages/mini)
- [Standard Schema](https://standardschema.dev/)
