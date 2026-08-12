import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/**
 * 公開済みの記事を新しい順で返す。
 * getCollection を呼ぶのはこのファイルだけに限る。
 * draft の除外と並び順のルールが散らばると、片方だけ直す事故が起きる。
 *
 * 予約公開: pubDate が未来の記事は落とす。判定はビルド時刻で固定されるので、
 * 公開日を迎えさせるには毎日ビルドし直す必要がある（.github/workflows/deploy.yml）。
 * draft は「まだ書き途中」、未来の pubDate は「書き終わって順番待ち」を表す。
 *
 * dev では未来の記事も見えるようにしてある。予約した記事を書いている最中に
 * 自分のサイトで確認できないと困るため。preview は本番ビルドなので落ちる。
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const buildTime = new Date();
  const posts = await getCollection(
    'posts',
    ({ data }) => !data.draft && (import.meta.env.DEV || data.pubDate <= buildTime),
  );
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** トップに並べる直近の記事。 */
export async function getRecentPosts(limit = 5): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.slice(0, limit);
}
