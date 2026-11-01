---
title: Hono で API を作る時の個人的ベストプラクティス リターンズ
description: Hono で API を作るときの書き方を、ドメインをまたぐ操作まで考えて作り直しました。モジュラーモノリスを下敷きに routes と domains を分け、ドメインの中は rules・queries・mutations・usecases に分けます。ドメインどうしは index.ts だけでつなぎ、その決まりを oxlint のプラグインで強制しています。
pubDate: 2026-11-01
tags: [Hono, TypeScript, 設計]
draft: false
---

## はじめに

前に、Hono でバックエンドの API を作るときの書き方をまとめたことがあります。

https://zenn.dev/ashunar0/articles/1ba94a110d8622

feature ごとに route・service・repository の 3 層に分ける形でしたが、この形はドメインをまたぐことを全然考えていませんでした。コメントを付けるときに記事を参照する、記事を消すときにコメントも消す、といった操作が増えてくると、どの service がどの repository を触ってよいのかが決まっていないので、実務レベルの、業務ルールが複雑に絡み合うプロダクトには対応できません。

あれから数ヶ月、いろいろ考えて色々迷走して、なんやかんやあって今回のアーキテクチャに辿り着きました。

参考にしたのは、モジュラーモノリスという考え方です。アプリも DB も 1 つのまま、中を業務のまとまり（ドメイン）ごとに分けて、ドメインどうしはそれぞれが外に公開したものだけを通して触れ合います。どこが何を触ってよいかを先に決めておくので、アプリが大きくなっても絡まりません。

例には、前と同じくブログの記事とコメントを使います。

## 全体の形

`src/` の下は、routes・domains・db の 3 つに分けます。

```
src/
  index.ts        # エントリポイント（routes をマウント）
  routes/         # HTTP の入口。リソースごとの sub app
    posts/
    comments/
  domains/        # 業務ロジック。ドメインごとのディレクトリ
    post/
    comment/
  db/             # テーブル定義と DB 接続
```

ふつうは feature ごとにディレクトリを 1 つ作って、route も業務のロジックも同じ場所に置くと思います。前の記事もそうでした。ここで routes と domains を分けているのは、リソースとドメインでは切り方の軸が違うからです。

リソースは URL の名詞で、API をどう見せるかで決まります。ドメインは業務のまとまりで、どのデータを誰が書き換えるかで決まります。たいていは重なりますが、ずれるところが必ず出てきます。

たとえば、記事にコメントを付ける `POST /posts/:id/comments` です。URL は記事の下にありますが、書き込むのはコメントです。feature ごとにまとめていると、posts に置けば記事の service がコメントのテーブルを触ることになり、comments に置けば URL と置き場所がずれます。どちらに置いても、結局どこかで絡まっちゃいます。

最初から分けておけば、この endpoint は URL のとおり `routes/posts/` に置いて、中でコメントのドメインの関数を呼ぶだけです。

routes は HTTP のことだけを受け持ちます。入力を検証して、domains の関数を呼び、結果を状態コードとレスポンスに直したら終わりです。記事を公開してよいか、といった業務の判断は書きません。

その判断は domains に置きます。domains は Hono を import しないので、`c` も状態も出てきません。同じ処理を cron やキューから呼ぶときも、domains の関数をそのまま使えます。

import は routes → domains → db の一方向で、逆向きには import しません。

## ドメインの中

ドメインのディレクトリには、決まった種類のファイルだけを置きます。

```
domains/post/
  index.ts                 # 公開する関数
  rules.ts                 # 業務ルール（I/O なし）
  queries.ts               # 読み取り（SELECT）
  mutations.ts             # 書き込み（INSERT / UPDATE / DELETE）
  usecases/publishPost.ts  # 1 操作（読み取り → 検証 → 書き込み）
```

関数をどのファイルに置くかは、その関数が何に触るかで決まります。

- DB も HTTP も使わない業務ルール → `rules.ts`
- DB から取得するだけ → `queries.ts`
- DB に書くだけ → `mutations.ts`
- それ以外（取得してから書き込む、ほかのドメインを呼ぶ、メールを送る）→ `usecases/`

何に触るかは import を見ればわかるので、置き場所で迷うことはほとんどありません。関数の大きさや「業務っぽいか」で決めると、AI に書かせたときに置き場所が毎回ブレてしまいます。

記事を公開する処理を、この 4 つに割るとこうなります。

```ts
// domains/post/rules.ts
export function canPublish(post: { status: "draft" | "published"; body: string }) {
  return post.status === "draft" && post.body.length > 0;
}

// domains/post/queries.ts
export function findPost(db: DB, id: string) {
  return db.select().from(posts).where(eq(posts.id, id)).get();
}

// domains/post/mutations.ts
export function markPublished(db: DB, id: string, now: Date) {
  return db
    .update(posts)
    .set({ status: "published", publishedAt: now })
    .where(and(eq(posts.id, id), eq(posts.status, "draft")));
}

// domains/post/usecases/publishPost.ts
export async function publishPost(db: DB, id: string, now: Date) {
  const post = await findPost(db, id);
  if (!post) return { ok: false, error: "not_found" } as const;
  if (!canPublish(post)) return { ok: false, error: "cannot_publish" } as const;

  await markPublished(db, id, now);
  return { ok: true } as const;
}
```

書き込みは、確かめることがなくても必ず usecase を通します。タイトルを変えるだけの `renamePost` も、中で mutation を呼ぶだけの usecase にします。確かめることがあるかを毎回判断しなくて済みますし、あとで確かめることが増えても置き場所が変わりません。取得だけのときは usecase を作らず、route が queries を直接呼びます。

usecase の役割は、よくある service と同じです。違うのは、1 つの操作を 1 つのファイルにしていることです。service はメソッドが 1 ファイルに溜まっていき、メソッドどうしで呼び合っても外からは見えません。1 操作 1 ファイルなら、usecase が何を呼んでいるかは import を見ればわかるので、「同じドメインの usecase どうしは呼び合わない」という決まりも import で確かめられます。

## ドメインどうし

ドメインの外から import できるのは、そのドメインの `index.ts` だけです。`index.ts` は queries と usecases だけを公開します。

```ts
// domains/post/index.ts
export { findPost } from "./queries";
export { publishPost } from "./usecases/publishPost";
export { renamePost } from "./usecases/renamePost";
```

mutations は公開しないので、ほかのドメインは記事のテーブルに直接書き込めません。記事のデータを変えたいときは、記事のドメインの usecase を呼びます。テーブルを触れるのは、その持ち主のドメインだけです。

コメントを付ける処理で見てみます。コメントは公開済みの記事にしか付けられないので、コメントのドメインの usecase が記事のドメインの `findPost` を呼びます。

```ts
// domains/comment/usecases/addComment.ts
import { findPost } from "../../post";
import { insertComment } from "../mutations";

export async function addComment(db: DB, postId: string, body: string, now: Date) {
  const post = await findPost(db, postId);
  if (!post || post.status !== "published") {
    return { ok: false, error: "post_not_found" } as const;
  }

  await insertComment(db, { postId, body, createdAt: now });
  return { ok: true } as const;
}
```

`POST /posts/:id/comments` の route は、この `addComment` を呼ぶだけです。

いくつものドメインに書き込む操作は、1 つの usecase が手順を持ち、各ドメインの usecase を順に呼びます。

ドメインどうしの依存の向きは、後からできるほうが先にあるほうに依存する形に揃えます。コメントは記事がないと作れないので、コメントのドメインが記事のドメインに依存します。

## lint で強制する

ここまでの決まりは、どれも「どのファイルが何を import してよいか」の形で書けます。そこで oxlint のプラグインにして、決まりから外れた import をエラーにしています。

たとえば、コメントの usecase が記事の mutations を直接 import すると、次のエラーになります。

```
error domains(imports): src/domains/comment/usecases/addComment.ts may not import
../../post/mutations. Another domain is read only through its index.ts (queries, usecases)
or its rules.ts: import from "#/domains/post/index" or "#/domains/post/rules".
More: docs/domains.md
```

エラーには、どこから import し直せばいいかも書いてあります。

決まりを文章で渡すだけだと、AI がそれを守るかどうかは毎回ブレてしまいますが、lint で強制しておけば、AI はエラーに従って自分で直すので、決まりから外れたコードが残りません。

## おわりに

AI にコードを書かせるようになって、アーキテクチャの決まりは、人が理解して守るものから、機械で検証できるものに変わってきていると思います。文章でどれだけ丁寧に書いても、AI が毎回同じように解釈してくれるとは限りません。今回の決まりをできるだけ import の形で書いたのは、lint で検証できるようにするためです。

この形でいくつかアプリを作ってみましたが、今のところかなりいい感じに書けています。もしもっと良くできるところがあれば、ぜひ教えてください！
