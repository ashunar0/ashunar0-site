import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * 登壇日はディレクトリ名の先頭から取る。frontmatter には持たない。
 * 詳しくは content.config.ts の talks のコメントを参照。
 */
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})-/;

export type Talk = CollectionEntry<'talks'> & { pubDate: Date };

/*
 * `2026-08-17` を UTC の 0 時として持つ。posts の pubDate（frontmatter の日付文字列を
 * z.coerce.date() が UTC 0 時として解釈する）と揃えるため。
 * ここを JST 0 時にすると、UTC で走る CI のビルドで前日として表示される。
 */
function parsePubDate(id: string): Date {
  const matched = DATE_PREFIX.exec(id);
  if (!matched) {
    throw new Error(
      `登壇ディレクトリ名は YYYY-MM-DD-<名前> の形にすること: src/content/talks/${id}`,
    );
  }
  return new Date(`${matched[1]}T00:00:00Z`);
}

/**
 * 2026.08.17 の形。pubDate は UTC の 0 時なので、表示も UTC で読む。
 * timeZone を指定しないとビルドを走らせた地域によって前日にずれる。
 */
export function formatTalkDate(pubDate: Date): string {
  return pubDate.toLocaleDateString('en-CA', { timeZone: 'UTC' }).replaceAll('-', '.');
}

/**
 * 公開済みの登壇を新しい順で返す。
 * getCollection('talks') を呼ぶのはこのファイルだけに限る。
 *
 * posts と違って予約公開は持たない。登壇は終わってから上げるものなので、
 * 未来の日付を「公開待ち」として隠す必要がない。書き途中は draft で表す。
 *
 * draft も posts と違って dev では表示する。登壇の中身はスライド画像なので、
 * 記事のように VSCode のプレビューで確かめられない。公開前に見る手段が要る。
 */
export async function getPublishedTalks(): Promise<Talk[]> {
  const talks = await getCollection('talks', ({ data }) => import.meta.env.DEV || !data.draft);
  return talks
    .map((talk) => ({ ...talk, pubDate: parsePubDate(talk.id) }))
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
