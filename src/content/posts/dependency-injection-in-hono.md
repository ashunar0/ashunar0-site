---
title: DIとは何かを整理して、HonoとCloudflare Workersで書いてみる
description: DIと聴くと、なんだか難しそうな印象を受けますが、実は割とシンプルなものです。その正体を冷静に見つめ直し、Honoで実践してみます。
pubDate: 2026-08-25
tags: [Hono, Cloudflare, TypeScript, 設計]
draft: false
---

## はじめに

DI（Dependency Injection、依存性の注入）という言葉は、なんとなく仰々しいイメージがあります。

ただ、パターンとしてのDIは本来もっと小さいものです。ライブラリも設定ファイルも要りません。この記事では、まずHonoもサーバーも出さずにDIの正体を確認して、そのあとHonoとCloudflare Workersで実践してみます。

今回出てくるコードパターンは、現在自分が作っているHonoのアーキテクチャ設計とコーディング規約に含まれるものです。変わる可能性もあります！

## 1. DIとは何か

DIを一言で言うと、「**必要なものを自分で作らず、外から受け取る。**」というものです。たったこれだけ！たとえばこんな感じです。

```ts
// 自分で作る
function createGreeter() {
  const clock = new SystemClock();
  return {
    greet(name: string) {
      const hour = clock.now().getHours();
      return `${hour < 12 ? "おはよう" : "こんにちは"}、${name}`;
    },
  };
}
```

```ts
// 受け取る
function createGreeter(clock: Clock) {
  return {
    greet(name: string) {
      const hour = clock.now().getHours();
      return `${hour < 12 ? "おはよう" : "こんにちは"}、${name}さん！`;
    },
  };
}
```

違いは引数が1つ増えただけですが、これだけで大きく変わります。テストすることを考えてみましょう。

前者の `greet` を「朝ならおはようと言う」と確かめる方法は、**実際に朝を待つ以外にありません**。`clock` は関数の内側で作られているので、外から手が届かないからです。

でも、後者なら手が届きます。

```ts
const greeter = createGreeter({ now: () => new Date("2026-08-21T09:00:00") });
greeter.greet("佐藤"); // "おはよう、佐藤さん！"
```

## 2. 受け取る側の型は、実体ではなく約束にする

上の例で `createGreeter` が受け取っている `Clock` は、具体的なクラスではありません。次のような型です。

```ts
type Clock = {
  now(): Date;
};
```

`now()` を持っていれば何でも通ります。受け口が型（＝約束）なので、中身を問いまぜん。

差し替えられると、こういうことができます。

- **テスト**：本物を用意せずに動かせる
- **環境の切り替え**：本番とローカルで別の実装を渡す
- **外部サービスの隔離**：課金の走るAPIをテストで叩かずに済む

逆に言うと、DIの利点はここに尽きます。「疎結合になる」「拡張しやすくなる」といった説明もよく見ますが、結局嬉しいのは**差し替えられること**、というすごく単純なものです。

## 3. Honoで素直に書くとこうなる

さて、ここからはHonoです。まず、DIを何も考えずに書いてみます。

```ts
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { posts } from "./schema";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/posts/:id", async (c) => {
  const db = drizzle(c.env.DATABASE_URL);
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, c.req.param("id")));

  if (!post) return c.json({ error: "not found" }, 404);
  return c.json(post);
});
```

もちろんこれは至極真っ当な正しいコードです。エンドポイントが数本のうちは、これ以上の構造は要らないでしょう。

問題が出てくるのは、主にハンドラの中に「判断」や「条件分岐」が増えたときです。下書きは本人にしか見せない、公開済みは誰でも読める...などとといった規則が入り始めると、正しい挙動を示すか確かめたくなります。しかしこのコードを確かめるには、Honoを起動してデータベースを繋ぐ必要があります。判断が `c.env` と同じ場所に閉じ込められているからです。

## 4. Workersで最初にぶつかる壁

Node.jsのサーバーなら、こう書くのが自然です。

```ts
// db.ts
export const db = drizzle(process.env.DATABASE_URL!);
```

起動時に一度だけ接続を作り、あとは各所から `import { db }` する。プロセスが起動しっぱなしなので成立します。

しかし、Cloudflare Workersでは、これが書けません。Workersのfetchハンドラのシグネチャは次の形で、環境変数やバインディングは第2引数の `env` として渡されます。

```js
async fetch(request, env, ctx)
```

つまり `env` はハンドラが呼ばれて初めて存在します。モジュールのトップレベル、すなわち `import` が解決される時点では、まだ渡されていません。Honoで `c.env` からしか取れないのはこのためです。

結果として、Workersでは「接続はリクエストごとに作る」が強制されます。Node.jsの常識がそのまま持ち込めません。

ただし、これで自動的にDIになるわけではありません。「接続をリクエストごとに作る」のは**作り方**の話で、それを**誰が受け取るか**はまだ何も決まっていないからです。先ほどのハンドラも、リクエストのたびに `drizzle(c.env.DATABASE_URL)` を呼んでいる点では同じことをしています。

Workersが決めてくれるのはあくまで、依存をグローバルに置く道が無い、という前提までです。渡し先を決めるのは自分の仕事で、それが次の話になります。

## 5. 受け取る形に直す

ここからは、Workersの制約とは関係のない、置き場所の話です。先ほどのハンドラを分解していきます。やることは最初と同じで、「自分で作る」を「受け取る」に変えるだけです。

まず、データベースを触る部分を切り出します。ここでも受け口を型で先に書きます。

```ts
// repository.ts
export type PostRow = {
  id: string;
  authorId: string;
  status: "draft" | "published";
  title: string;
};

export type PostsRepository = {
  findById(id: string): Promise<PostRow | null>;
};

export function postsRepository(db: Db): PostsRepository {
  return {
    async findById(id) {
      const [row] = await db.select().from(posts).where(eq(posts.id, id));
      return row ?? null;
    },
  };
}
```

次に、判断を持つ層を作ります。ここが `db` ではなく `PostsRepository` を受け取るのが要点です。

```ts
// service.ts
export function postsService(repo: PostsRepository) {
  return {
    /** 下書きは著者本人だけが読める。他人には存在も知らせない */
    async get(id: string, viewerId: string | null): Promise<PostRow> {
      const post = await repo.findById(id);
      if (!post) throw new HTTPException(404);
      if (post.status === "draft" && post.authorId !== viewerId) {
        throw new HTTPException(404);
      }
      return post;
    },
  };
}
```

最後に、本物を組み立てる場所を1箇所だけ用意します。

```ts
export const wirePosts = (db: Db) => postsService(postsRepository(db));
```

結果として、ハンドラはこうなります。

```ts
app.get("/posts/:id", async (c) => {
  const db = drizzle(c.env.DATABASE_URL);
  const post = await wirePosts(db).get(c.req.param("id"), c.get("userId"));
  return c.json(post);
});
```

`postsService` は `db` も `c.env` もHonoも知りません。知っているのは `PostsRepository` という約束だけです。組み立ての知識は `wirePosts` の1行に集まっていて、この関数だけが本物を知っています。

## 6. テストを書く

ここまでの形にすると、テストはこうなります。

```ts
import { describe, expect, it } from "vitest";
import { postsService } from "./service";
import type { PostsRepository } from "./repository";

function fakeRepo(row: PostRow | null): PostsRepository {
  return {
    async findById() {
      return row;
    },
  };
}

const draft: PostRow = {
  id: "p-1",
  authorId: "u-1",
  status: "draft",
  title: "書きかけ",
};

describe("postsService.get", () => {
  it("下書きは著者本人なら読める", async () => {
    const post = await postsService(fakeRepo(draft)).get("p-1", "u-1");
    expect(post.title).toBe("書きかけ");
  });

  it("下書きは他人には404（存在を知らせない）", async () => {
    const run = postsService(fakeRepo(draft)).get("p-1", "u-2");
    await expect(run).rejects.toMatchObject({ status: 404 });
  });
});
```

データベースは一切出てきません。Honoも起動していません。モックライブラリも使っていません。ただ`PostsRepository` を満たすオブジェクトを手で書いて渡しているだけです。

`fakeRepo` が成立するのは、`postsService` が受け取る型を `Db` ではなく `PostsRepository` にしたからです。もし `postsService(db)` の形のまま中で `postsRepository(db)` を作っていたら、テストにはDrizzleの偽物が必要になります。それでは割に合わないので、たいてい書かれずに終わります。

## 7. どこまでDIするか

全部に適用する必要はありません。判断の基準は「**そのコードは、配線・判断のどっち？**」だけです。

配線しかしていないなら、`db` を直接受け取って構わないでしょう。

```ts
export const createProfile = async (db: Db, userId: string, name: string) => {
  await wireProfiles(db).create(userId, name);
};
```

これにテストを書いても、「呼ぶべきものを呼んだ」ことを確かめるだけで、壊れたときに気づける類のものにはなりません。テストしにくいのではなく、そもそも**テストする必要がありません**。

一方、条件分岐などが入ると話が変わります。「下書きは他人に見せない」「同じ通知は1時間に1回まで」といった規則は、いつか誰かが壊します。そのときすぐに気づけるように、判断を持つコードは、差し替えられる形で受け取る場所に置きます。

言い換えると、層の名前は本質ではありません。serviceと呼ぼうがusecaseと呼ごうが、**判断を持っている層が約束（型）を受け取っていれば目的は達成されます**。逆に、名前だけ整えて中で本物を作っていると、層は増えたのにテストは書けないという状態になってしまいます。

## まとめ

- DIは「必要なものを自分で作らず、外から受け取る」こと。ライブラリは要らない
- 受け口は実体ではなく型にする。そうすると本物と偽物が同じ穴に刺さる
- Cloudflare Workersでは `env` がfetchハンドラの引数なので、モジュールトップで接続を作れない。依存は渡されるしかなく、DIと相性が良い
- 組み立ては1箇所（composition root）に集める
- 全部に適用する必要はない。配線は `db` を直接受けてよく、判断を持つコードだけを差し替え可能にする

最近、ようやくテストのありがたみが実感できるようになってきました。Honoのアーキテクチャもだいぶ安定してきたので、近いうちに公開と思います！

## 参考

- [Testing - Hono](https://hono.dev/docs/guides/testing)
- [Examples - Hono](https://hono.dev/examples)
- [fetch() handler - Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
