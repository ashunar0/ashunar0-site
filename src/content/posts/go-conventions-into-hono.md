---
title: Goの一貫性に学ぶ、Honoの規約を型とlintで再現する方法
description: Goはフレームワーク側の規約を持たないのに大規模でも破綻しにくいと言われます。その一貫性を書き方・置き場所と届く範囲・エラーの通り道・抽象化の仕方・時間軸の5つに分解し、TypeScriptとHonoに無かった3つを埋めた記録です。oxlintのカスタム規則、dbを渡さないrepository、ApiErrorをexportせずファクトリ経由に強制した話など。
pubDate: 2026-08-27
tags: [Go, Hono, TypeScript, 設計, Lint]
draft: false
---

## はじめに

Honoには、Railsのようなガッチガチの規約がありません。どこに何を置くかは基本的に自分で決めます。AIにコーディングさせても出力を安定させられるよう、自分でバックエンドの規約を考えていて、その形でコードを生成するgeneratorを作ったりしています。

規約やgeneratorはこちらに置いています（まだ育てている途中なので、変わる可能性も大いにあります！あくまで暫定です）。

https://github.com/ashunar0/hnkに置いてあります。

ところでふと思ったのですが、Goもまた、フレームワーク側の規約を持たない言語です。それでも企業で広く採用されていて、大きなコードベースでも破綻しにくいと言われます。なぜそこまで人気か出たのか？もしかしたら、同じ規約が薄い同士、何か参考にできることがあるのでは...？

ということでこの記事は、Goの利点がどこから来ているのかを分解して、対応するものをHonoとTypeScriptで書くとどうなるかを見ていきます。

## Goの一貫性を5つに分解する

Go言語が人気な理由の一つに、「一貫性」が挙げられます。「同じ問題には、いつでもどこでも同じ形のコードが書かれる」という性質です。これを分解すると、こんな感じの5つに分けられます。

| 揃うもの | Goでの中身 | TS / Honoに |
|---|---|---|
| 書き方 | `gofmt`に設定項目がない。タブかスペースか、どこで改行するかを議論する余地がそもそもない | **ある** |
| 置き場所と届く範囲 | 循環`import`はコンパイルエラー。`internal/`は親より外から`import`できない | **ない** |
| エラーの通り道 | エラーは例外ではなく戻り値。`if err != nil`の一本道 | **ない** |
| 抽象化の仕方 | 継承がない。interfaceは`implements`を書かずに暗黙的に満たされる | **ある** |
| 時間軸 | Go 1互換性保証。2012年に書いたコードが、今のコンパイラでそのまま通る | **ない** |

「ある」と書いた2つは、ここで片付けてしまいます。

フォーマットはPrettierが一意に決めます。設定項目の数は`gofmt`より多いですが、プロジェクトに1つ置いてしまえば、そこから先で議論が起きないという点は同じです。

抽象化の関しては、むしろTypeScriptのほうが強いです。構造的部分型はGoの暗黙のinterfaceと同じ発想ですが、`Pick<Db, "select">`のように部分型をその場で組み立てられます。これはGoには書けない形で、あとで実際に使います。

残る3つは現状ありません。ということは、ここはGoを真似すれば、HonoもGoの一貫性を手に入れられるかもしれません。

以降、1つずつ検証していきます。

## 1. 置き場所と届く範囲が揃う

Goのコンパイラは、`import`について2つのことを拒否します。循環した`import`と、`internal/`の外からの`import`です。

どちらも「どこから何に手が届くか」の話です。Goではこれがコンパイラの管轄なので、循環`import`を許すかどうかという議論が、そもそも発生しません。

TypeScriptにはどちらもありません。循環`import`は普通に通るし、実行時に片方が`undefined`になって初めて気づきます。ディレクトリ単位の可視性に至っては、そういう概念がありません。近いのはモジュール境界（`export`しなければ外から見えない）ですが、これは1ファイルの話で、ディレクトリ同士の関係は表せません。

埋め方は3段階になりました。既製品で済むもの、規則を自分で書くもの、型で消せるものです。

### 既製品で済む — 循環`import`

`import/no-cycle`というlint規則があるので、有効にするだけです。Goのコンパイラがやっていることの中で、これがいちばん安く手に入ります。

### 規則を書く — ディレクトリ同士の関係

Goの`internal/`は、そのディレクトリの親より外から`import`できないことをコンパイラが保証します。「公開したくないものを公開しない」を、ディレクトリの名前だけで表せます。

自分の規約にも、同じ性質の決まりが3つありました。

| 決まり | 意図 |
|---|---|
| 他のドメインの`repository`を触らない | データの触り方はそのドメインが決める |
| `service`が他のドメインの`service`を呼ばない | ドメイン同士が数珠つなぎになるのを防ぐ |
| `lib/`が`features/`や`db/`に依存しない | `lib/`はそのまま他のプロジェクトに持ち出せる状態を保つ |

これをAIにも強制させるために、oxlintでカスタムlintを書きました。

```json
// .oxlintrc.json
{
  "plugins": ["import"],
  "jsPlugins": ["./hnk-lint-plugin.mjs"],
  "rules": {
    "import/no-cycle": "error"
  },
  "overrides": [
    {
      "files": ["api/**/*.ts"],
      "rules": {
        "hnk/no-foreign-repository": "error",
        "hnk/no-foreign-service-from-service": "error",
        "hnk/lib-stays-portable": "error"
      }
    }
  ]
}
```

3本のうち上2本は「他のドメインの特定の層に触れていないか」という同じ形なので、層の名前を差し替えるだけにできます。

```js
import path from "node:path";

/** 相対importだけ解決する。パッケージやエイリアスは対象外 */
const resolveRelative = (file, specifier) =>
  specifier.startsWith(".") ? path.resolve(path.dirname(file), specifier) : null;

const foreignLayerRule = ({ layer, appliesTo, message }) => ({
  create(context) {
    const file = fileOf(context);
    const self = featureOf(file);              // features/<name>/ の <name>
    if (!self) return {};
    if (appliesTo && !appliesTo.test(file)) return {};

    return {
      ImportDeclaration(node) {
        // 解決先が features/<other>/<layer> なら落とす
        const target = layerAt(resolveRelative(file, node.source.value), layer);
        if (target && target !== self) {
          context.report({ node, message: message(target) });
        }
      },
    };
  },
});
```

要点は`resolveRelative`です。`import`のパスを解決してから判定するので、`../`がいくつ並んでいるかに左右されません。ファイルが1階層深いところに移っても効き続けます。文字列で`../../invoices/repository`を探す書き方だと、ここで取りこぼします。

あとは`foreignLayerRule({ layer: "repository", ... })`のように層の名前を渡して登録するだけです。3本目の`lib/`は形が違うので単体で書いていますが、やっていることは「`lib/`の中のファイルが`features`や`db`を`import`していたら落とす」だけです。

### 型で消す — 見えていても使えなくする

`internal/`が制限するのは「どのコードから見えるか」までです。その先に、**見えていても使えないようにする**という段があります。ここからはGoに対応するものがありません。

[前回の記事](/posts/dependency-injection-in-hono)で、`repository`をこう書きました。

```ts
export function postsRepository(db: Db) { ... }
```

`db`を丸ごと渡しています。この`repository`は、宣言の上では`posts`テーブルを扱うものですが、実際には全テーブルに書き込めます。

自分の規約では、他ドメインのテーブルは**読んでよいが書いてはいけない**ことになっています。ここは読み書きであえて非対称にしています。読みが古い前提のままなら、いずれ型が合わなくなってコンパイラが止めますが、書きは、規則をすり抜けてもエラーなく通ってしまいます。

最初は書き込みだけ包む`writesTo(db, invoices)`を作りました。これは効きません。`db`が引数に残っているので、`db.delete(otherTable)`がそのまま書けます。実際に書いて通ることを確認しました。

`db`自体を渡さない形にします。

```ts
// db/index.ts
export type ReadDb = Pick<Db, "select">;

export const scopeTo = <T extends SQLiteTable>(db: Db, table: T) => ({
  reads: db as ReadDb,                    // 読みは越境自由（joinのため）
  insert: (values: InferInsertModel<T>) => db.insert(table).values(values),
  update: (values: Partial<InferInsertModel<T>>) => db.update(table).set(values),
  delete: () => db.delete(table),
});
```

`reads`は`select`しか持たないので読み放題、書き込みは`table`に固定されます。規約の非対称性がそのまま型になりました。冒頭で「あとで使う」と書いた構造的部分型は、ここの話でした。

```ts
// features/invoices/repository.ts — factory自体はexportしない
function invoicesRepository(scope: Scope<typeof invoices>): InvoicesRepository { ... }

export const wireInvoicesRepository = (db: Db) =>
  invoicesRepository(scopeTo(db, invoices));
```

`db`を持っているのは組み立ての1行だけになりました。ついでに`repository`のファクトリを`export`しなくなったので、`invoicesService(invoicesRepository(db))`のような手組みも書けなくなります。

一般化すると、**型は「何を受け取って何を返すか」は縛りますが、「途中で何をするか」は縛りません。** 途中を縛りたいなら、途中で使える道具のほうを減らすしかありません。依存の渡し方は正しくても、渡している物が広すぎた、という話でした。

そしてここは、Goを追い越せる場所でもあります。Goで`func NewRepo(db *sql.DB)`と書けば、中で何のテーブルでも触れます。テーブル単位の権限を型で表現する文化はGoにありません。TypeScriptの構造的部分型のほうが、この手の「持ち物を削った型」を作るのは楽です。

## 2. エラーの通り道が揃う

Goにはエラーの通り道が1本しかありません。エラーは戻り値なので、必ず呼び出し元に返ってきます。

```go
row, err := repo.Find(ctx, id)
if err != nil {
    return nil, err
}
```

一見すると冗長ですが、代わりに**エラーが起きたときに制御がどこへ行くかが、はっきりしています。** 例外のように、遠くのcatchへ飛んだり、誰も受け止めずにプロセスの外まで抜けたりしません。

残念ながら、TypeScriptにこれはありません。`throw`はどこへでも飛ばせちゃいます。

そして厄介なことに、Honoでは**Goのやり方をそのままは持ち込めません**。失敗を戻り値にすると、成功時のレスポンスと混ざってRPCの型推論に乗ってしまうからです。フロント側は成功形だけを見たいのに、失敗形とのunionが届きます。つまりここでは、Goと逆に**`throw`を強制する**ことになります。

### 揃えられるのは「作り方」のほう

`if err != nil`が一貫して見える理由を分けると、2つあります。

1. 制御が飛ばないので、通り道がその場に書いてある
2. エラーの作り方が決まっている（`errors.New`と`fmt.Errorf`しかない）

1は言語の設計なので諦めます。が、2は埋められそうです。

規約では、失敗を表す`ApiError`を`lib/errors.ts`に1つだけ置いています。問題は、これを`export`していたことでした。`new ApiError("NOT_FOUND", 404, ...)`が、どのファイルからでも書けちゃいます。コードとHTTPステータスの対応を1箇所で決めたかったのに、その1箇所を通らずに失敗を作れる状態です。

そこで`export`を外して、ファクトリだけを`export`しました。

```ts
/**
 * 失敗は必ず throw する。返り値にすると RPC の推論に混ざる。
 * export しないので、feature 側は下のファクトリ経由でしか失敗を作れない
 */
class ApiError extends HTTPException {
  constructor(
    readonly code: ApiErrorCode,
    readonly httpStatus: ContentfulStatusCode,
    message: string,
  ) {
    super(httpStatus, { message });
  }
}

export const notFound = (message = "対象が見つかりません") =>
  new ApiError("NOT_FOUND", 404, message);

export const forbidden = (message = "この操作は許可されていません") =>
  new ApiError("FORBIDDEN", 403, message);

export const conflict = (message: string) =>
  new ApiError("CONFLICT", 409, message);
```

呼ぶ側は`throw notFound()`と書きます。`NOT_FOUND`に400を添える、といった取り違えは**書けません**。コードとステータスの組を決めている場所が1つしかないからです。レビューで指摘する対象が、コンパイルの対象になりました。

先に`private constructor`を試して失敗しています。TypeScriptの`private`は**クラス単位**なので、同じファイルのトップレベルに置いたファクトリからも呼べません。ファクトリ側が全部エラーになりました。`export`を外すほうが、変更としても小さくて済みました。

そして、やってみたら穴が1つ出てきました。`validationFailed`だけファクトリが存在せず、バリデータが直接`new ApiError(...)`を呼んでいたのです。「対応を1箇所で決める」という意図が、400番だけ破れていました。**規則を機械に移すと、守れているつもりだった箇所が出てきます。** 規約ドキュメントを読み返しても、これは見つかりませんでした。

### 飛ばないのではなく、飛び先が1つ

ここで埋まったのはまだ半分です。Goが持っている「制御がどこへ行くか、その場に書いてある」は再現できていません。`throw notFound()`と書いたとき、そこから先がどこへ行くかは、その行を見ても分かりません。

代わりにあるのは、**飛び先が1つしかない**という保証です。`ApiError`は`HTTPException`を継承しているので、Honoの`onError`が拾います。そして`onError`はアプリ全体で1つ、app側に1回だけ登録します。

```ts
/** 全ての失敗の唯一の出口 */
export const onError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.httpStatus,
    );
  }
  // ...
};
```

Goは「飛ばないから追える」で、Honoは「飛び先が1つだから追える」。別の手段ですが同じところに着地できました。


## 3. 時間が経っても壊れない

Go 1互換性保証は、言語としてかなり異常な水準の約束です。2012年に書いたコードが、今のコンパイラでそのまま通ります。ここまでの2つと違って、これは書き方の話ではありません。**今日書いた規約が、来年も効いているか**という話です。

TypeScriptにこの保証はありません。そしてこれは、規約を機械に守らせようとする上で少し痛手です。守らせる側の機械が動かなくなれば、せっかく作った規約も一緒に消えてしまいます。

そこでoxlintです。oxcはRust製の自前パーサを持っているので、**TSのバージョンに依存しません**。Goでは、互換を言語そのものが約束してくれます。TypeScriptでその約束は手に入らないので、代わりにできるのは**約束してくれる相手を減らすこと**でした。

## まとめ

| 一貫性 | Goでの担保 | HonoとTypeScriptでの再現 |
|---|---|---|
| 書き方 | `gofmt` | Prettier（既にあった） |
| 置き場所と届く範囲 | 循環`import`の禁止、`internal/` | `import/no-cycle`、oxlintのカスタム規則3本、`scopeTo`で型に落とす |
| エラーの通り道 | エラーは戻り値、`if err != nil` | `ApiError`を`export`せずファクトリ経由に強制、出口は`onError`ひとつ |
| 抽象化の仕方 | 暗黙のinterface | 構造的部分型（既にあった。むしろ強い） |
| 時間軸 | Go 1互換性保証 | 保証してくれる相手への依存を切る |

実際にやってみて、Goから学べるのは答えではなく、その「**機構**」にありました。層の切り方も命名も依存の組み立て方も、Goでも標準がありません。`pkg/`をどう使うかは今も揉めるそうだし、errorのラップの仕方に決着はついていません。Goが持っているのはあくまで「決めたことを人が守らなくてよくする」ほうの仕組みで、その中身は自分で決めるしかありません。

「こう書きましょう」と書いてあるものは、読まれた回数だけ守られます。書けなくしてあるものは、書かれた回数だけ守られます。Goが強いのは後者の割合が高いからで、そこは言語が違っても寄せていける、というのが今回の結論でした。
