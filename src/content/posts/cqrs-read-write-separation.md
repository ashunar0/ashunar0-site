---
title: CQRS で読み取りと書き込みを別々に最適化する
description: CQRS は、データを書き込む処理と読み取る処理で使うモデルを分ける考え方です。元になった CQS の原則から、コードだけ分ける段階、読み取り専用のテーブルを持つ段階、イベントソーシングとの関係までを、記事投稿サービスの例で整理します。
pubDate: 2026-10-15
tags: [設計]
draft: false
---

## はじめに

CQRS（Command Query Responsibility Segregation）は、データを書き込む処理と読み取る処理で、使うモデルを分ける設計の考え方です。元になったのは「1 つの関数で状態の変更と値の返却を同時にしない」という原則です。CQRS は、この分離を関数からモデルの単位にまで広げています。

分ける理由は、書き込みと読み取りで最適化したい方向が違うからです。書き込みで優先するのは業務のルールを守ることで、読み取りで優先するのは画面に合う形のデータを速く返すことです。1 つのモデルで両方をまかなうと、どちらかが犠牲になります。

CQRS には分け方の段階があります。段階が進むほど読み取りは速く柔軟になり、そのぶん引き受ける代償も大きくなります。

| 段階 | やること | 代償 |
|---|---|---|
| コードだけ分ける | 読み取りはドメインモデルを通さず、画面の形で直接取る | ほぼありません |
| 読み取り専用のテーブルを持つ | 画面用のデータを、書き込みのときに作っておく | 同期なら書き込みが遅くなり、非同期なら反映に時間差が出ます |
| イベントソーシングと組み合わせる | 起きた出来事の履歴を、正のデータとして保存する | 履歴の形を後から変えにくく、すべてが時間差を前提にします |

この記事では記事投稿サービスを題材に、元になった原則から順に、段階ごとのコードと代償を整理します。

## CQS から CQRS へ

Bertrand Meyer は著書『Object-Oriented Software Construction』で、CQS（Command Query Separation）という原則を示しました。CQS では、1 つの関数の役割を、状態を変える Command か、値を返す Query のどちらか一方に限ります。

```ts
// 状態を変えながら、値も返す
function popNextTask(): Task { ... }

// Query：値を返すだけ
function getNextTask(): Task { ... }

// Command：状態を変えるだけ
function completeTask(id: string): void { ... }
```

`popNextTask` は、呼ぶたびにキューからタスクを 1 件取り出します。ログに出すためにもう一度呼ぶと、次のタスクまで消費されてしまいます。分けたあとの `getNextTask` は何度呼んでも状態を変えません。呼び出す側は、回数やタイミングを気にせずに使えます。

CQRS は、この分離を関数からモデルに広げたものです。CQS で分けていたのは関数だけで、扱うデータの形は共通でした。CQRS では、読み取りと書き込みで扱うデータの形そのものを別々に定義します。書き込みには業務のルールの判定に必要な項目だけを持つ型を用意し、読み取りには画面の表示に必要な項目を並べた型を用意します。この考え方に CQRS という名前を付けたのは Greg Young で、2010 年ごろから広まりました。

## 1 つのモデルで読み書きすると何が困るか

題材として、記事を書いて公開できるサービスを考えます。記事を書き込むときには、次のルールを守る必要があります。

- タイトルは必須で、100 文字以内
- 記事を公開できるのは著者本人だけ
- 状態は「下書き」から「公開」への一方通行

公開済みの記事の一覧画面では、1 件ごとにタイトル・著者名・著者のアイコン・いいね数・タグ名を表示します。著者名は `users` テーブル、いいね数は `likes` テーブル、タグ名は `tags` テーブルにあるので、記事のテーブルだけでは揃いません。

この 2 つを 1 つの `Article` 型でまかなうと、型は次のようになります。

```ts
type Article = {
  id: string
  title: string
  status: "draft" | "published"
  authorId: string
  // ここから下は一覧画面のために増えた項目
  authorName: string
  authorIconUrl: string
  likeCount: number
  tagNames: string[]
}
```

この型には困る点が 2 つあります。

### 書き込みのたびに、判定に関係ないデータまで読み込む

公開ボタンが押されたときに判定に使うのは、`status` と `authorId` の 2 つだけです。それでも `Article` を組み立てるには、`users` と `likes` と `tags` を結合して、著者名やいいね数まで取得する必要があります。人気の記事なら、タイトルを 1 文字直すだけでも、いいねを数万件数えることになります。

### 読み取りのたびに、ルールのための型を経由する

一覧に 20 件を表示するときも、まず `Article` を 20 個組み立て、そこから画面に必要な項目を取り出します。書き込みのルールを守るための型を、ルールが関係しない表示にまで通している状態です。`likeCount` は記事のルールのどれにも登場しない集計値で、一覧画面がなければ `Article` に入る理由がありません。画面に表示項目が増えるたびに、ルールを扱う型の項目も増えていきます。

書き込みは、ルールを守るために必要な項目だけを正確に扱いたい処理です。読み取りは、画面に合わせて複数のテーブルにまたがるデータを速く返したい処理です。目的の違う 2 つを 1 つの型に押し込むと、型はどちらの目的にも合わない形に膨らみます。CQRS では、この 2 つに別々の型を与えます。

## 段階 1：同じデータベースのまま、コードだけ分ける

最初の段階では、データベースには手を入れません。`articles`・`users`・`likes`・`tags` の各テーブルはそのままで、データを読み書きするコードの通り道だけを 2 つに分けます。

```
articles/
+-- commands/
|   +-- publish-article.ts   書き込み: ルールを守る
+-- queries/
    +-- list-articles.ts     読み取り: 画面の形で返す
```

以降のコードでは、SQL の実行に [postgres.js](https://github.com/porsager/postgres) のタグ付きテンプレート `sql` を使います。

### Command 側は判定に必要な項目だけを読む

記事を公開する処理は次のようになります。

```ts
// articles/commands/publish-article.ts

// 公開の判定に必要な項目だけを持つ型
type ArticleForPublish = {
  id: string
  authorId: string
  status: "draft" | "published"
}

type PublishResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_author" | "already_published" }

// ルールの判定。データベースを知らない純粋な関数
function canPublish(article: ArticleForPublish, requesterId: string): PublishResult {
  if (article.authorId !== requesterId) return { ok: false, reason: "not_author" }
  if (article.status === "published") return { ok: false, reason: "already_published" }
  return { ok: true }
}

export async function publishArticle(articleId: string, requesterId: string): Promise<PublishResult> {
  const [article] = await sql<ArticleForPublish[]>`
    select id, author_id as "authorId", status from articles where id = ${articleId}
  `
  if (!article) return { ok: false, reason: "not_found" }

  const result = canPublish(article, requesterId)
  if (!result.ok) return result

  await sql`update articles set status = 'published', published_at = now() where id = ${articleId}`
  return { ok: true }
}
```

`ArticleForPublish` には、公開してよいかの判定に使う 3 項目しかありません。データベースから読むのも `articles` テーブルの 3 列だけで、著者名やいいね数には触れません。

`publishArticle` が返すのは、成功したか、失敗したならその理由だけです。記事のデータは返しません。CQS の「Command は状態を変えるだけ」をそのまま守っています。新しく作った記事の ID だけを返す、といった程度の例外は実務でもよく認められています。

### Query 側はルールを通らずに画面の形で取る

一覧画面のデータを返す処理は次のようになります。

```ts
// articles/queries/list-articles.ts

// 一覧画面の 1 行分の型
export type ArticleListItem = {
  id: string
  title: string
  authorName: string
  authorIconUrl: string
  likeCount: number
  tagNames: string[]
}

export async function listPublishedArticles(): Promise<ArticleListItem[]> {
  return sql<ArticleListItem[]>`
    select
      a.id,
      a.title,
      u.name     as "authorName",
      u.icon_url as "authorIconUrl",
      (select count(*) from likes l where l.article_id = a.id)::int as "likeCount",
      coalesce(
        (select array_agg(t.name) from article_tags at join tags t on t.id = at.tag_id
          where at.article_id = a.id),
        '{}'
      ) as "tagNames"
    from articles a
    join users u on u.id = a.author_id
    where a.status = 'published'
    order by a.published_at desc
    limit 20
  `
}
```

`ArticleListItem` は、一覧画面の 1 行に表示する項目をそのまま並べた型です。SQL 1 回で複数のテーブルを結合し、画面が使う形にして返します。

この処理は `canPublish` のようなルールを一切通りません。読み取りはデータを変更しないので、守るべきルールがそもそもありません。

### 分けた結果

| | Command 側 | Query 側 |
|---|---|---|
| 型 | `ArticleForPublish`（判定に必要な項目だけ） | `ArticleListItem`（一覧画面の 1 行） |
| ルール | 必ず通る | 通らない |
| 返すもの | 成功か失敗かだけ | データだけ |
| 変更のきっかけ | 業務のルールが変わったとき | 画面が変わったとき |

これで、前の節で挙げた 2 つの問題が解消されます。記事を公開するときに著者名やいいね数を取得しなくなり、一覧を表示するときに `Article` を 20 個組み立てる必要もなくなりました。

テーブルは 1 組のままなので、書き込んだ内容はその瞬間から一覧にも反映されます。読み取りと書き込みでデータがずれることは、この段階では起きません。

## 段階 2：読み取り専用のテーブルを持つ

段階 1 の一覧 SQL は、表示のたびに記事 20 件分のいいねを数え、タグを集約しています。記事が 10 万件、いいねが 500 万件に増えると、この集計が重くなります。一覧は書き込みの何百倍も読まれるので、表示のたびに計算するより、書き込んだときに 1 回だけ計算して保存しておくほうが全体の処理は少なく済みます。

### 画面の 1 行をそのまま保存する

一覧画面の 1 行を、そのまま 1 レコードとして持つテーブルを作ります。このような読み取り専用のデータを、CQRS ではリードモデルと呼びます。

```sql
create table article_list_items (
  id              text primary key,
  title           text not null,
  author_name     text not null,
  author_icon_url text not null,
  like_count      int  not null,
  tag_names       text[] not null,
  published_at    timestamptz not null
);
```

Query 側は、このテーブルを読むだけになります。

```ts
export async function listPublishedArticles(): Promise<ArticleListItem[]> {
  return sql<ArticleListItem[]>`
    select id, title, author_name as "authorName", author_icon_url as "authorIconUrl",
           like_count as "likeCount", tag_names as "tagNames"
    from article_list_items
    order by published_at desc
    limit 20
  `
}
```

結合も集計もなくなりました。戻り値の `ArticleListItem` 型は段階 1 から変わっていないので、この関数を呼ぶ側のコードはそのまま動きます。段階 1 で読み取りの入口を分けておいたおかげで、データの取り方だけを差し替えられました。

### 元のテーブルからリードモデルを作り直す

正しいデータを持っているのは、これまでどおり `articles` や `likes` などの元のテーブルです。`article_list_items` は、そこから計算して作ったコピーにあたります。元のテーブルが変わったら、コピーも作り直さなければなりません。この作り直す処理をプロジェクションと呼びます。

```ts
// 記事 1 件分の行を、元のテーブルから計算し直して上書きする
async function projectArticleListItem(db: typeof sql, articleId: string) {
  await db`
    insert into article_list_items
      (id, title, author_name, author_icon_url, like_count, tag_names, published_at)
    select a.id, a.title, u.name, u.icon_url,
           (select count(*) from likes where article_id = a.id),
           coalesce((select array_agg(t.name) from article_tags at join tags t on t.id = at.tag_id
                     where at.article_id = a.id), '{}'),
           a.published_at
    from articles a join users u on u.id = a.author_id
    where a.id = ${articleId} and a.status = 'published'
    on conflict (id) do update set
      title = excluded.title, author_name = excluded.author_name,
      author_icon_url = excluded.author_icon_url, like_count = excluded.like_count,
      tag_names = excluded.tag_names, published_at = excluded.published_at
  `
}
```

この関数は、いいね数に 1 を足すような差分の更新をしません。対象の 1 件を、元のテーブルから毎回まるごと計算し直します。こうしておくと、同じ記事について 2 回呼ばれても結果は変わりません。後で説明する非同期の更新では同じ処理が重複して実行されることがあり、そのときもデータが壊れません。

プロジェクションを呼ぶ場面は、記事の公開だけにとどまりません。いいねが付いたとき、タイトルを直したとき、タグを付け替えたときにも呼びます。著者が名前を変えたときは、その著者の記事すべての行を作り直します。元のテーブルのどの変更が、リードモデルのどの行に影響するかを、すべて把握しておく必要があります。

### 同期で更新する

プロジェクションを呼ぶタイミングは 2 通りあります。1 つ目は、書き込みと同じトランザクションの中で呼ぶ方法です。

```ts
await sql.begin(async (tx) => {
  await tx`update articles set status = 'published', published_at = now() where id = ${articleId}`
  await projectArticleListItem(tx, articleId)
})
```

元のテーブルとリードモデルが同時に更新されるので、データのずれは起きません。公開した瞬間から一覧にも表示されます。

その代わり、書き込みのたびにプロジェクションの計算を待つので、書き込みが遅くなります。リードモデルの更新でエラーが起きると、記事の公開そのものも失敗します。一覧画面の都合が、書き込みの成否を左右するようになります。

### 非同期で更新する

2 つ目は、書き込みが終わったあとに、別のプロセスがリードモデルを更新する方法です。

```ts
// Command 側：記事の更新と同じトランザクションで、出来事を outbox テーブルに記録する
await sql.begin(async (tx) => {
  await tx`update articles set status = 'published', published_at = now() where id = ${articleId}`
  await tx`insert into outbox (type, article_id) values ('ArticlePublished', ${articleId})`
})

// ワーカー（別プロセス）：outbox を順に読んで、リードモデルを更新する
for (const event of await fetchUnprocessedEvents()) {
  await projectArticleListItem(sql, event.articleId)
  await markProcessed(event.id)
}
```

書き込みはプロジェクションを待たずに終わり、リードモデルの更新に失敗しても記事の公開は成功します。

出来事を `outbox` テーブルに記録しているのは、記事の更新とキューへの送信を別々に行うと、片方だけが成功する場合があるからです。記事は公開されたのにキューへの送信に失敗すると、その記事は一覧に載らないままになります。同じトランザクションで `outbox` に書けば、記事の更新と出来事の記録は必ず両方成功するか、両方失敗します。この手法は Outbox パターンと呼ばれています。

### 非同期にすると、反映に時間差が出る

非同期の更新では、書き込みが終わってからリードモデルに反映されるまでに時間差が生まれます。いずれは必ず揃うものの、途中のある瞬間にはずれていることがある、という性質を結果整合性と呼びます。

時間差は、たとえば次のような場面で問題になります。

1. 著者が公開ボタンを押し、一覧画面に移動する
2. ワーカーがまだ処理していないので、一覧に自分の記事がない
3. 公開に失敗したと思って、もう一度公開ボタンを押す
4. `already_published` のエラーが返ってくる

ユーザーから見ると、これはバグにしか見えません。よく取られる対処は次の 3 つです。

- 自分の操作の結果は、Command の戻り値やフロントエンドが持っている状態から表示する
- 本人が見るページだけは、元のテーブルから読む
- 反映まで数秒かかることを画面に書いておく

どの対処も、全員にとって即座に揃うことは諦めています。守っているのは、自分の操作の結果だけは本人にすぐ見えることです。他人の記事が一覧に数秒遅れて載っても、気づく人はまずいません。

### リードモデルは捨てて作り直せる

`article_list_items` は元のテーブルから計算したコピーなので、壊れても全件を消してプロジェクションを全記事分回せば復元できます。

一覧画面にカテゴリ名を追加したくなったときも、`article_list_items` に列を足して作り直すだけで済みます。元のテーブルにも、書き込み側のコードにも手を入れる必要はありません。画面の変更が書き込み側に波及しないことが、ここでも確かめられます。

| | 段階 1 | 段階 2（同期） | 段階 2（非同期） |
|---|---|---|---|
| テーブル | 元のテーブルだけ | 元のテーブルとリードモデル | 元のテーブルとリードモデル |
| データのずれ | 起きない | 起きない | 起きる（結果整合性） |
| 読み取りの速さ | 普通 | 速い | 速い |
| 書き込みの速さ | 普通 | 遅くなる | 普通 |
| 必要な仕組み | なし | プロジェクション | プロジェクション、outbox、ワーカー、時間差への対処 |

## イベントソーシングとの関係

イベントソーシングは、CQRS とセットで紹介されることの多い考え方です。ただし、両者の依存は一方向です。イベントソーシングを採用するなら CQRS はほぼ必須になりますが、CQRS を採用するのにイベントソーシングは要りません。段階 1 と段階 2 は、どちらもイベントソーシングなしで成り立っていました。

### 出来事の履歴を正しいデータにする

ここまでの `articles` テーブルは、`status = 'published'` のように記事の今の状態を持っていました。イベントソーシングでは、記事に起きた出来事を順番に保存し、それを正しいデータとして扱います。今の状態は、保存した出来事を先頭から順に適用して、その都度計算します。

```ts
type ArticleEvent =
  | { type: "ArticleDrafted"; articleId: string; authorId: string; title: string }
  | { type: "ArticleRetitled"; articleId: string; title: string }
  | { type: "ArticlePublished"; articleId: string }

type ArticleState = {
  id: string
  authorId: string
  title: string
  status: "draft" | "published"
}

// 出来事を先頭から順に適用して、今の状態を求める
function currentState(events: ArticleEvent[]): ArticleState | null {
  return events.reduce<ArticleState | null>((state, e) => {
    switch (e.type) {
      case "ArticleDrafted":
        return { id: e.articleId, authorId: e.authorId, title: e.title, status: "draft" }
      case "ArticleRetitled":
        return state && { ...state, title: e.title }
      case "ArticlePublished":
        return state && { ...state, status: "published" }
    }
  }, null)
}
```

記事を公開する Command は、出来事を読み込んで今の状態を求め、ルールを判定し、新しい出来事を追加します。

```ts
export async function publishArticle(articleId: string, requesterId: string): Promise<PublishResult> {
  const events = await loadEvents(articleId)
  const article = currentState(events)
  if (!article) return { ok: false, reason: "not_found" }

  const result = canPublish(article, requesterId)
  if (!result.ok) return result

  await appendEvent({ type: "ArticlePublished", articleId })
  return { ok: true }
}
```

ルールを判定する `canPublish` は、段階 1 のものをそのまま使えます。変わったのは、判定の材料を出来事から計算するようになったことと、結果を `update` の代わりに出来事の追加で記録するようになったことです。保存した出来事は書き換えも削除もせず、追加していくだけです。

### イベントソーシングには CQRS が必要になる

出来事の列は、記事 1 件について今の状態を求めるのには向いています。一方で、「公開済みの記事を新しい順に 20 件」という問いには答えられません。答えるには全記事の出来事をすべて読み込んで計算する必要があり、一覧を表示するたびにそれを行うのは現実的ではないからです。

そこで、出来事を受け取ってリードモデルを更新するプロジェクションが必要になります。これは段階 2 の非同期の更新と同じ構造です。段階 2 で `outbox` に記録していた `ArticlePublished` のような出来事が、イベントソーシングでは正しいデータそのものになっています。ワーカーが `outbox` の代わりに出来事の保存先を読んで、`article_list_items` を更新します。

読み取りをリードモデルに任せることが前提になるので、イベントソーシングを採用すると CQRS の段階 2 を非同期で採用することになります。

### 得るものと引き受ける代償

イベントソーシングで得られるのは、次の 2 つです。

- いつ、誰が、何を変えたかの履歴が、仕組みとして全部残る
- 後から思いついた問いにも、新しいリードモデルを作って答えられる

2 つ目は、段階 2 で見た「リードモデルは捨てて作り直せる」をさらに進めたものです。たとえば「公開から 24 時間以内にタイトルを直した記事の割合」を後から集計したくなっても、`ArticleRetitled` の出来事が残っているので、過去の分まで遡って計算できます。今の状態だけを保存していたら、この集計はできません。

引き受ける代償は、次の 4 つです。

- 保存した出来事は書き換えられません。出来事の形を変えたくなっても過去の分は古い形のまま残るので、古い形と新しい形の両方を読める処理を持ち続けることになります
- 個人情報の削除を求められたときに、追加するだけという前提と衝突します。削除に対応するための設計が別途必要です
- 読み取りはすべてリードモデル経由になるので、段階 2 の非同期で見た時間差への対処が常に必要です
- 出来事が増えると、今の状態を求める計算が遅くなります。途中の状態をスナップショットとして保存しておく工夫が必要になります

## どこまでやるか

段階は、必要になった分だけ進めるのが基本です。どの段階を選ぶかは次のように判断できます。

| 段階 | 採用する場面 |
|---|---|
| 段階 1 | ほぼいつでも採用できます。必要なのは、読み取りをドメインモデルに通さないという取り決めだけです |
| 段階 2（同期） | 特定の読み取りが遅いと計測で分かったときです。いいね数のような集計値を 1 列だけ保存しておく、といった小さな規模から始められます |
| 段階 2（非同期） | 読み取りと書き込みで、負荷や保存先が根本的に違うときです。全文検索のために検索エンジンへデータを入れる構成は、この段階のリードモデルにあたります |
| イベントソーシング | 履歴そのものが業務の中心にあるときです。会計の仕訳、口座の入出金、在庫の入出庫などがこれにあたります |

段階 1 は、データベースもデータの流れも変えずに、コードの分け方だけで始められます。段階 2 からはリードモデルとプロジェクションの保守が加わり、非同期にした時点で結果整合性への対処も必要になります。イベントソーシングでは、保存した出来事がずっと残ることを前提に設計することになります。

### システム全体に一律で適用しない

よくある失敗は、システム全体に同じ段階を一律で当てはめることです。Martin Fowler は、CQRS はシステムの特定の部分にだけ使うべきで、多くのシステムは読み取りと書き込みで同じモデルを使う素直な作りが合っている、と書いています。

記事投稿サービスでいえば、読まれる回数の多い記事一覧には段階 2 を使い、設定画面のような読み書きの単純なところは段階 1 か、分けずにそのまま作る、という選び方になります。CQRS は、システムの部分ごとに、読み取りと書き込みをどこまで分けるかを決めるための考え方です。

## 参考

- [CQRS - Martin Fowler](https://martinfowler.com/bliki/CQRS.html)
