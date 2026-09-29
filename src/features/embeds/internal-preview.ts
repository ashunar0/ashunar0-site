import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { LinkPreview } from './fetch-ogp';

/*
 * 自サイトへのリンクは HTTP で取りにいかず、手元の Markdown の frontmatter から組み立てる。
 *
 * 本番を fetch していた頃は、CI（GitHub Actions）からの取得がときどき失敗して
 * 黙って素のリンクに戻っていた。ほかにも、未デプロイの記事はカードにならない、
 * 直したタイトルが次のデプロイまで古い、タイトルに `| ashunar0` が付く、という問題があった。
 *
 * remark プラグインは astro.config から読み込まれるので astro:content は使えない。
 * そのためファイルを直接読む。パスの規約は content.config.ts の loader と揃えてある。
 */

// astro.config の site と同じ。ドメインを変えたらここも変える。
const HOST = 'ashunar0.dev';

const CONTENT_DIR = new URL('../../content/', import.meta.url);

function readFrontmatter(file: URL): Record<string, unknown> | undefined {
  if (!existsSync(file)) return;
  const source = readFileSync(file, 'utf8');
  const yaml = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  return yaml ? parse(yaml) : undefined;
}

/** 記事と登壇のどちらのファイルを見るか。該当しなければ undefined。 */
function sourceOf(pathname: string): { file: URL; image?: string } | undefined {
  const post = pathname.match(/^\/posts\/([^/]+)\/?$/)?.[1];
  if (post) {
    const file = ['md', 'mdx']
      .map((ext) => new URL(`posts/${post}.${ext}`, CONTENT_DIR))
      .find((f) => existsSync(f));
    // 記事の OG 画像は pages/og がビルド時に書き出す
    return file && { file, image: `https://${HOST}/og/${post}.png` };
  }

  const talk = pathname.match(/^\/talks\/([^/]+)\/?$/)?.[1];
  if (talk) return { file: new URL(`talks/${talk}/index.md`, CONTENT_DIR) };
}

/**
 * 自サイトの記事・登壇ならプレビューを返す。
 * 自サイトでない URL、または該当するファイルが無い URL は undefined（呼び出し側で fetch に回す）。
 */
export function internalPreview(url: string): LinkPreview | undefined {
  const { host, pathname } = new URL(url);
  if (host !== HOST) return;

  const source = sourceOf(pathname);
  if (!source) return;

  const data = readFrontmatter(source.file);
  if (typeof data?.title !== 'string') return;

  return {
    url,
    title: data.title,
    description: typeof data.description === 'string' ? data.description : undefined,
    image: source.image,
    host,
    favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  };
}
