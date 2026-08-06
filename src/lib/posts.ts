import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/**
 * 公開済みの記事を新しい順で返す。
 * getCollection を呼ぶのはこのファイルだけに限る。
 * draft の除外と並び順のルールが散らばると、片方だけ直す事故が起きる。
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** トップに並べる直近の記事。 */
export async function getRecentPosts(limit = 5): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.slice(0, limit);
}
