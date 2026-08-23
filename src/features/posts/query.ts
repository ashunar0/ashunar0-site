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

/**
 * 記事の下に出す関連記事。タグの重なりが多い順、同数なら新しい順で返す。
 *
 * 人気順にしないのは、アクセス数がビルド時に取れないため（Cloudflare Web Analytics
 * にしかない）。手で順位を書くと更新が止まった瞬間に腐るし、流入が X 中心で記事単位に
 * 来るので、今読んでいる記事と同じ話題を出すほうが素直。
 *
 * タグが 1 つも重ならない記事しかない場合は新着で埋める。0 件で枠ごと消えるより、
 * どこかへ抜ける導線がある方がいい。
 */
export async function getRelatedPosts(current: Post, limit = 3): Promise<Post[]> {
  const posts = await getPublishedPosts();
  const tags = new Set(current.data.tags);

  const candidates = posts
    .filter((post) => post.id !== current.id)
    .map((post) => ({
      post,
      overlap: post.data.tags.filter((tag) => tags.has(tag)).length,
    }));

  // getPublishedPosts が新しい順なので、重なり数だけで安定ソートすれば同数は新しい順になる。
  const related = candidates
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .map(({ post }) => post);

  if (related.length >= limit) return related.slice(0, limit);

  const filler = candidates
    .filter(({ overlap }) => overlap === 0)
    .map(({ post }) => post);
  return [...related, ...filler].slice(0, limit);
}
