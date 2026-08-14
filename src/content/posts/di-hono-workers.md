---
title: DI とはなにか、そして Hono に DI コンテナが要らない理由
description: 依存を引数で受け取るだけの設計が、なぜテスト容易性と読解可能性を同時に上げるのか。DI とDI コンテナは別物であること、TypeScript でコンテナを入れると型検査が実行時エラーに化けること、Cloudflare Workers では lifetime が実質一種類しかないこと。そのうえで、寿命を isolate / invocation / lazy の三層に割る設計と、composition root を route ではなく実行単位に置く話まで。
pubDate: 2026-08-16
tags: [設計, Hono, Cloudflare, TypeScript]
draft: true
---

## はじめに

DI（Dependency Injection、依存性の注入）は名前が仰々しい割に、実体は非常に小さいものです。この記事では、その実体を確認したうえで、「では DI コンテナは要るのか」という実務的な問いに答えます。題材は Hono と Cloudflare Workers ですが、前半の議論は言語もフレームワークも問いません。

## DI とはなにか

**使うものを自分で作らず、外から受け取る。** これだけです。

自分で作る場合。

```ts
// service が repository を自分で組み立てている
export function postsService() {
  const repo = postsRepository(createDb(process.env.DATABASE_URL));

  return {
    async list() {
      return repo.findAll();
    },
  };
}
```

外から受け取る場合。

```ts
export function postsService(repo: PostsRepository) {
  return {
    async list() {
      return repo.findAll();
    },
  };
}
```

差分は引数ひとつです。これが DI です。クラスで書けばコンストラクタ引数になりますが、本質は変わりません。

## 何が変わるのか

### 差し替えられる

前者は `postsService()` を呼んだ瞬間に本物の DB へつながります。テストを書こうとすれば DB を立てるしかありません。後者ならこう書けます。

```ts
const service = postsService({
  findAll: async () => [{ id: "1", title: "テスト用" }],
});
```

ここで効いているのは、service が repository から**型だけ**を取っていることです。

```ts
import type { PostsRepository } from "./repository";
```

`import type` は実行時に消えます。service のバンドルに repository の実装は一切残りません。だから手書きのオブジェクトがそのまま代わりに立てます。テスト用ライブラリもモックフレームワークも要りません。

### 依存が signature に現れる

```ts
export function submitInvoice(
  invoiceRepo: InvoiceRepository,
  notifier: Notifier,
  logger: Logger,
) {
```

この関数が何を触るのかが、本体を読まずに 1 行でわかります。自分で作る方式だと、全部読み終わるまで「この関数、裏でメールを送っていた」が判明しません。

テスト容易性の話として語られがちですが、実務で効くのはむしろこちらです。**依存が引数に出ているということは、その関数の影響範囲が宣言されている**ということです。

### 組み立てる場所が 1 箇所に集まる

全員が受け取るだけなら、どこかで誰かが本物を組み立てなければなりません。その場所を **composition root** と呼びます。

```ts
// route の先頭。ここだけが本物を知っている
const service = (c: Context<Env>) =>
  postsService(postsRepository(createDb(c.env.DATABASE_URL)));
```

各ハンドラは `service(c)` を呼ぶだけです。依存が増えても、直すのはこの 1 行だけで済みます。

逆に言えば、DI とは**「本物を知っている場所」を極小にする**設計です。他の全ファイルは型しか知りません。

## DI と DI コンテナは別物

ここが混同されやすいところです。Spring、NestJS、InversifyJS のような「コンテナ」を使うことが DI だと思われがちですが、コンテナは **DI を自動化する道具**であって、DI そのものではありません。

上に書いた引数渡しのコードは、コンテナゼロで完全な DI です。

| やり方 | 呼び方 | 例 |
| --- | --- | --- |
| 引数で渡す | constructor injection（手動 DI） | 素の TypeScript / Go |
| プロパティに後から差す | setter injection | 旧来の Spring |
| コンテナが型から自動解決 | DI コンテナ | NestJS の `@Injectable()` |

そして「コンテナを使うか」は、多くの場合そもそも選択ではありません。NestJS や Spring では**フレームワークに内蔵**されているので、使う / 使わないの議論が発生しません。議論になるのは、Hono のようにフレームワークが DI 機構を持たない場合だけです。

## コンテナが本来解決する問題

手動配線が苦しくなるのは、こういう状況です。

```ts
new OrderController(
  new OrderService(
    new OrderRepository(db),
    new InventoryService(new InventoryRepository(db), new LockManager(redis)),
    new PricingService(new TaxTable(), new DiscountEngine(new CouponRepo(db))),
  ),
  new AuditLogger(new Kinesis(config)),
);
```

これが 200 箇所ある、というのがコンテナの本来の適応症です。依存グラフが深く広く、同じ組み立てが何度も現れるとき、「型を見て自動で解決してほしい」の価値が配線コストを上回ります。

もうひとつが **lifetime 管理**です。singleton（プロセス全体で 1 個）、scoped（リクエストごとに 1 個）、transient（毎回新規）を宣言で切り替えたい、という要求です。Spring や .NET のコンテナが強いのはこの領域です。

## TypeScript でコンテナを入れる代償

InversifyJS や tsyringe は decorator と `reflect-metadata` に依存します。

```ts
@injectable()
class PostsService {
  constructor(@inject(TYPES.Repo) private repo: PostsRepository) {}
}
```

支払うものが 3 つあります。

**ビルド設定が特殊になる。** `experimentalDecorators` と `emitDecoratorMetadata` の有効化が要ります。バンドラやランタイムによっては、ここで詰まります。

**interface を型で解決できない。** TypeScript の型は実行時に消えるので、`TYPES.Repo` のような Symbol トークンを手で定義し、手で結び付ける必要があります。手動配線を別の形で書き直しているだけ、という状態になりがちです。

**エラーが実行時に出る。** これが最大の代償です。手動配線なら「引数が足りません」と `tsc` が停めてくれます。コンテナ経由だと、`No matching bindings found` が本番のリクエスト中に飛びます。静的検査を動的解決と交換していることになります。

Java のように実行時リフレクションが本物として使える言語なら、この交換は割に合います。TypeScript では、消える型を補うために別の配線を書く形になるため、割の良さが目減りします。

## Hono / Workers ではどうか

結論から言うと、コンテナの適応症がどちらも成立しません。

### 依存グラフが深くならない

`route → service → repository → db` の 4 段で打ち止めになる構造では、composition root は 1 行に収まります。

```ts
const service = (c: Context<Env>) =>
  postsService(postsRepository(createDb(c.env.DATABASE_URL)));
```

これが 2 行、3 行になっても人間が読めます。**コンテナは「読めなくなった配線」を隠すための道具**なので、読める配線に導入すると、隠す働きだけが残ります。

配線が 10 行を超えて読めなくなったときは、まず層の数を疑うほうが筋がよいです。

### lifetime が実質一種類しかない

Workers はリクエストごとに実行が隔離されます。DB ハンドルのようなリクエスト固有のものは、module scope ではなくハンドラの中で作る必要があります。

```ts
// route の中で作る。module scope には置かない
const db = createDb(c.env.DATABASE_URL);
```

つまり大半のものが request-scoped 固定です。singleton と scoped を使い分ける必要がないなら、コンテナの lifetime 機能はまるごと余剰になります。

それどころか、多くのコンテナは**デフォルトが singleton** です。設定を誤れば、リクエスト間で状態が漏れます。機能が課題を解かないどころか、事故の入口になります。

## Hono が用意しているもの

Hono 自体に DI 機構はありませんが、`c.set()` / `c.get()` と `Variables` 型があります。

```ts
type Env = {
  Variables: { db: Db; user: User };
};

app.use(async (c, next) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
});
```

middleware で入れたものをハンドラで取り出す形の、リクエストコンテキストに相乗りする軽量な仕組みです。認証済みユーザーのような**全ルート横断のもの**にはよく合います。

ただし、feature 固有の service をここに載せると、失われるものがあります。

```ts
.get("/", async (c) => {
  const { posts } = c.get("container");   // 依存が signature に出ない
```

このハンドラが何に依存しているかが、本体を読むまでわかりません。`container` は全部入りなので、型のうえでは posts も payments も notifier も触れます。DI の利点として挙げた 2 つ目が消えます。

composition root 方式なら、route ファイルの先頭 1 行を見た時点で「この feature は posts repository しか触らない」が確定します。

## 寿命の話

ここまでは「コンテナは要らない」という話でしたが、コンテナと無関係に、Workers では**寿命の設計**が効きます。

先ほど「Workers は実質 request-scoped 固定」と書きましたが、これはリクエスト固有のデータについての話です。不変なものについては当てはまりません。

- Hono の app インスタンス
- 検証済みの設定
- Secrets Manager から取得したシークレット

これらをリクエストごとに作り直すと、単に無駄です。特に外部 I/O を伴う初期化は、そのまま遅延になります。

依存を寿命で三層に割る、という整理があります。

| 層 | 中身 | 寿命 |
| --- | --- | --- |
| isolate scope | Hono app、検証済み config、secrets | isolate が生きている間 |
| invocation scope | DB wrapper、認証情報 | リクエスト 1 回 |
| lazy | primary / replica connection | 初めて使われたとき |

3 段目の lazy が入るのは、読み取りしかしないリクエストで書き込み用の接続まで開くのが無駄だからです。

### isolate scope のキャッシュ

isolate scope のものを素朴にキャッシュすると、cold start 直後に問題が出ます。同時に届いた複数のリクエストが、揃って Secrets Manager を叩きに行きます。

値ではなく **Promise 自体**をキャッシュすると、これが解けます。

```ts
function createIsolateMemo<T, A>(loader: (arg: A) => Promise<T>) {
  let cached: Promise<T> | undefined;

  return (arg: A): Promise<T> => {
    cached ??= loader(arg).catch((error) => {
      cached = undefined;
      throw error;
    });
    return cached;
  };
}
```

処理中の Promise が入っているので、後続のリクエストはそれを待つだけになり、外部 API を叩くのは 1 回で済みます。失敗時に `cached = undefined` へ戻しているので、次のリクエストが再挑戦できます。ここを省くと、一度の失敗が isolate の寿命いっぱい残ります。

この形が要るのは、初期化に外部 I/O があるときです。`c.env` を読むだけの `createDb` に被せても得るものはありません。

## composition root は route ではなく実行単位

最後に、実務で必ず当たる論点です。

「composition root は route」という置き方は、**入口が HTTP だけである前提**に立っています。cron や Queue consumer が生えた瞬間、この前提が崩れます。cron ハンドラは `Context` を持たないので、`service(c)` を呼べません。

```ts
export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),

  scheduled(_event, env, ctx) {
    ctx.waitUntil(withContainer(env, ctx, (ctn) => ctn.jobs.run()));
  },

  queue(batch, env, ctx) {
    return withContainer(env, ctx, (ctn) => ctn.queue.process(batch));
  },
};
```

正しい一般化は、**composition root を実行単位（invocation）に置く**ことです。HTTP なら route、cron なら `scheduled`、Queue なら consumer。「リクエストごと」ではなく「実行ごと」と捉えると、3 つの入口が同じ規則で扱えます。

なお、この統一のために全部入りの container を作ると、前述のとおりハンドラの signature から依存が消えます。入口を揃えることと、依存を明示することは別の要求なので、feature 単位のファクトリを保ったまま入口だけ揃えるほうが、失うものが少なくなります。

## まとめ

- DI は「使うものを外から受け取る」だけ。引数ひとつの話
- 効くのは 3 点。差し替えられること、依存が signature に出ること、本物を知る場所が 1 箇所に集まること
- DI コンテナは DI の自動化装置であって、DI そのものではない
- コンテナが要るのは、依存グラフが深く広いときと、lifetime を使い分けたいとき。Hono / Workers ではどちらも成立しにくい
- TypeScript でコンテナを入れると、静的検査を実行時解決と交換することになる
- コンテナとは別に、寿命の設計は効く。isolate / invocation / lazy で割る
- composition root は route ではなく実行単位に置くと、cron や Queue でも同じ規則が通る

コンテナ導入は後からでもできます。ファクトリ関数はそのまま binding にできるので、先回りして入れる理由はありません。逆に、依存を引数で受け取る形にしていない状態から後で DI へ寄せるのは、全ファイルに触ることになります。**先にやるべきは DI であって、コンテナではない**、という順序です。

## 参考

- https://zenn.dev/rdlabo/articles/workers-hono-container-lifecycle … 寿命の三層分離と `createIsolateMemo`、複数入口の統一
- https://developers.cloudflare.com/hyperdrive/configuration/connect-to-postgres/ … ハンドラごとにクライアントを作る、という Hyperdrive 側の推奨
- https://hono.dev/docs/api/context#set-get … `c.set` / `c.get` と `Variables`
- https://martinfowler.com/articles/injection.html … Fowler による DI とコンテナの整理（原典）
