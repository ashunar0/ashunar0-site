import type { APIRoute, GetStaticPaths } from 'astro';
import { getPublishedPosts } from '@/features/posts/query';

/*
 * 記事の生 markdown。AI に渡す用途を想定している。
 *
 * HTML に本文をもう一部埋め込んでコピーさせる手もあるが、記事ぶんページが重くなるうえ、
 * 本文に </script> が出ると壊れる。ビルド時に .md を書き出して fetch で取りにいく形にすれば
 * どちらも起きず、URL 自体を貼って渡すこともできる（/posts/xxx.md）。
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { slug: post.id } }));
};

export const GET: APIRoute = async ({ params, site }) => {
  const posts = await getPublishedPosts();
  const post = posts.find(({ id }) => id === params.slug);

  if (!post) return new Response('Not found', { status: 404 });

  // 本文は h2 から始まるので、title を h1 として被せると見出しの階層が揃う。
  // 出典を添えるのは、AI に渡したとき何を読んでいるかが本文だけでは分からないため。
  const source = new URL(`/posts/${post.id}/`, site);
  const markdown = `# ${post.data.title}\n\n> ${source}\n\n${post.body}`;

  return new Response(markdown, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
