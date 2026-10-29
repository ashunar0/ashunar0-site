import { existsSync } from 'node:fs';
import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * 日付はファイル名（`2026-10-29.json`）から取る。JSON の中には持たない。
 * 詳しくは content.config.ts の news のコメントを参照。
 */
const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;

export type News = CollectionEntry<'news'> & { pubDate: Date };

// UTC の 0 時として持つ理由は features/talks/query.ts と同じ（CI が UTC で走る）
function parsePubDate(id: string): Date {
  if (!DATE_ID.test(id)) {
    throw new Error(`ニュースのファイル名は YYYY-MM-DD.json の形にすること: src/content/news/${id}`);
  }
  return new Date(`${id}T00:00:00Z`);
}

/**
 * ニュースを新しい順で返す。
 * getCollection('news') を呼ぶのはこのファイルだけに限る。
 */
export async function getNewsList(): Promise<News[]> {
  const list = await getCollection('news');
  return list
    .map((news) => ({ ...news, pubDate: parsePubDate(news.id) }))
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

/**
 * 2026.10.29 の形。pubDate は UTC の 0 時なので、表示も UTC で読む。
 * timeZone を指定しないとビルドを走らせた地域によって前日にずれる。
 */
export function formatNewsDate(pubDate: Date): string {
  return pubDate.toLocaleDateString('en-CA', { timeZone: 'UTC' }).replaceAll('-', '.');
}

/** 投稿 URL の `@handle`。名前は JSON に持つが、ハンドルは URL に入っているので二重に持たない。 */
export function handleOf(url: string): string | undefined {
  const name = new URL(url).pathname.split('/')[1];
  return name ? `@${name}` : undefined;
}

/*
 * 周辺に出る人のアイコン。Grok bot が JSON を置くときに X から取ってきて、
 * public/news/avatars/<ハンドルの小文字>.<拡張子> に保存する（手順は docs/news.md）。
 * 見る人のブラウザから外部サービスへ取りに行かせないため、サイトの中に置いて配る。
 */
const AVATAR_DIR = 'public/news/avatars';
const AVATAR_EXTENSIONS = ['jpg', 'png', 'webp'];

/** ハンドル（`@yusukebe`）のアイコンのパス。まだ保存されていなければ undefined。 */
export function avatarOf(handle: string): string | undefined {
  const name = handle.replace(/^@/, '').toLowerCase();
  const extension = AVATAR_EXTENSIONS.find((ext) => existsSync(`${AVATAR_DIR}/${name}.${ext}`));
  return extension && `/news/avatars/${name}.${extension}`;
}
