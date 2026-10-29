import type { APIRoute, GetStaticPaths } from 'astro';
import { author, FG, frame, renderPng } from '@/features/og/card';
import { getPublishedPosts, type Post } from '@/features/posts/query';

// 記事を SNS に貼ったときのカード画像。額縁やフォントの事情は features/og/card.ts を参照。

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
};

interface Props {
  post: Post;
}

const card = (title: string) =>
  frame([
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1.45,
          color: FG,
        },
        children: title,
      },
    },
    author(),
  ]);

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as Props;
  return renderPng(card(post.data.title));
};
