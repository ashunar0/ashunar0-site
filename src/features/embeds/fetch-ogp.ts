import { internalPreview } from './internal-preview';

/*
 * リンク先の OGP を読む。ビルド時にだけ走るので、実行時のコストも CORS も関係ない。
 *
 * 取れなかったときは null を返し、呼び出し側で普通のリンクに戻す。
 * 相手のサイトが落ちているだけでこちらのビルドまで倒れるのは割に合わない。
 */

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string;
  host: string;
  favicon: string;
}

/** 同じ URL を何度貼っても取りにいくのは 1 回だけにする。 */
const cache = new Map<string, Promise<LinkPreview | null>>();

/**
 * meta タグを 1 つ拾う。属性の並び順は相手のサイト次第なので、
 * property="og:title" が content の前にある場合と後にある場合の両方を見る。
 */
function readMeta(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const found = html.match(pattern);
    if (found) return decodeEntities(found[1]);
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  middot: '·',
};

/**
 * 実体参照を文字に戻す。
 * &amp; は最後に処理する。先に戻すと &amp;hellip; が &hellip; になり、
 * 続く置換で本来ただの文字列だったものまで … に化ける。
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/&amp;/g, '&');
}

/** 取れなかったら理由を添えて投げる。握りつぶすのは呼び出し側の load。 */
async function request(url: string): Promise<LinkPreview> {
  const response = await fetch(url, {
    // UA を偽らないと HTML を返さないサイトがある
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ashunar0.dev link preview)' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const { host } = new URL(url);

  // og:title が無いサイトは <title> で代用する。それも無ければカードにしない。
  const title =
    readMeta(html, 'og:title') ??
    decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '');

  if (!title) throw new Error('title が無い');

  return {
    url,
    title,
    description: readMeta(html, 'og:description') ?? readMeta(html, 'description'),
    image: readMeta(html, 'og:image'),
    host,
    // 各サイトの favicon を辿るのは面倒なので、Google のサービスに任せる
    favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  };
}

function describe(error: Error): string {
  const { cause } = error;
  if (!(cause instanceof Error)) return error.message;
  const code = 'code' in cause ? ` ${cause.code}` : '';
  return `${error.message}: ${cause.message}${code}`;
}

/*
 * CI（GitHub Actions）からだと、手元では取れるページがときどき取れない。
 * 一度だけ取り直し、それでも駄目なら理由をビルドログに残して素のリンクに戻す。
 * 黙って戻すと、公開後に本番を見るまで誰も気づけない。
 */
async function load(url: string): Promise<LinkPreview | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request(url);
    } catch (error) {
      if (attempt < 2) continue;
      // fetch failed だけでは分からない。DNS・接続・TLS のどれで落ちたかは cause が持つ
      const reason = error instanceof Error ? describe(error) : String(error);
      console.warn(`[link-card] カードにできなかった: ${url} (${reason})`);
      return null;
    }
  }
}

export function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  // 自サイトの記事・登壇は手元のファイルから引く（理由は internal-preview.ts）
  const internal = internalPreview(url);
  if (internal) return Promise.resolve(internal);

  const cached = cache.get(url);
  if (cached) return cached;

  const pending = load(url);
  cache.set(url, pending);
  return pending;
}
