import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// ファイル名がそのまま URL になる。日本語タイトルは frontmatter の title に持つ。
const posts = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/*
 * 登壇資料。1 登壇 = 1 ディレクトリで、その中に index.md とスライドの PNG が同居する。
 * ディレクトリ名は `YYYY-MM-DD-<短い名前>` で、そのまま URL になる。
 *
 * pubDate をここに持たないのは、ディレクトリ名が既に登壇日を持っているため。
 * 二重に持つとどちらかだけ直す事故が起きるので、日付は features/talks/query.ts で
 * ディレクトリ名から導出する（真実をひとつにする）。
 *
 * PNG は loader のパターンから外れるので、同じディレクトリに置いても拾われない。
 * スライドの読み込みは features/talks/slides.ts が別に持つ。
 */
const talks = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/talks',
    // 既定の id は `2026-08-17-webmcp/index` になる。URL に /index は要らないので落とす。
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    event: z.string(),
    // 資料の公開先（Speaker Deck 等）。サイト内でスライドは見られるので、あくまで補助。
    slidesUrl: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

/*
 * 朝のニュース。1 日 = 1 ファイルで、ファイル名 `YYYY-MM-DD.json` がそのまま URL と日付になる。
 * 中身は Grok bot が X から集めたものを、この形の JSON に詰めて置く。
 *
 * 日付を中に持たないのは talks と同じ理由（ファイル名と二重に持たない）。
 */
const news = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/news' }),
  schema: z.object({
    stories: z.array(
      z.object({
        title: z.string(),
        /*
         * X の投稿の URL に限る。X ニュース（/i/trending/…）は公式の埋め込みがないので、
         * ニュースの話題でも元になった投稿を選ばせる。
         */
        main: z
          .url()
          .regex(/^https:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/, 'main は X の投稿 URL にすること'),
        body: z.string(),
        around: z
          .array(
            z.object({
              url: z.url(),
              name: z.string(),
              summary: z.string(),
            }),
          )
          .default([]),
      }),
    ),
    quick: z
      .array(
        z.object({
          title: z.string(),
          summary: z.string(),
          urgent: z.boolean(),
          source: z.url(),
        }),
      )
      .default([]),
  }),
});

export const collections = { posts, talks, news };
