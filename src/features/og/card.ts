import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

/*
 * SNS に貼られたときのカード画像の共通部分。記事（pages/og）とニュース（pages/og/news）が使う。
 * ビルド時に png を書き出すので、実行時のコストはゼロ（Cloudflare には出来上がった静的ファイルだけが乗る）。
 *
 * satori が HTML/CSS を svg にし、resvg がそれを png にする。
 * satori は flexbox しか解釈しないので、ここでの style は普段の CSS とは別物。
 * display: flex を省くと子要素が重なるため、箱にはすべて明示する。
 */

export const WIDTH = 1200;
export const HEIGHT = 630;

/*
 * 寸法は Zenn と azukiazusa.dev の実物を測って合わせたもの。
 * 額縁は Zenn 38px / azuki さん 48px、角丸とカード内の余白もその間に置いてある。
 * ここを大きくすると途端にぼてっとするので、変えるときは実物と見比べる。
 */
const FRAME = 40;
const CARD_PADDING = 48;
const CARD_RADIUS = 16;

/*
 * 背景のグラデーション。accent（朱・色相 6°）を起点に、色相を 335° まで
 * 31° だけ回してピンクへ流す。
 *
 * brand と accent を両端に置く案は色相が 173° 離れていて、中間が彩度 0 の
 * 灰色を通るため濁った。色相の幅を狭く取るのが要点で、参考にした 2 サイトも
 * 56° と 114° に収まっている。
 */
const BG_FROM = '#ec968c';
const BG_TO = '#f2b0cb';

// カードは白のまま固定する。OG 画像はテーマ切替が効かないので light 側に寄せる。
const SURFACE = '#ffffff';
export const FG = '#171717';
export const FG_MUTED = '#737373';

const require = createRequire(import.meta.url);

/*
 * satori は woff2 を読めないので woff を使う。
 * Noto Sans JP は配布時に unicode-range で 100 以上に分割されているため、
 * 「日本語がまとまった 1 枚」と「ラテンだけの 1 枚」を選んで両方渡す。
 *
 * このとき family 名を分けるのが要点。同じ名前で複数枚を登録すると satori は
 * 先頭の 1 枚しか見ず、そこに無いグリフは豆腐（□）になって fallback が働かない。
 * 別名にしたうえで fontFamily に両方並べると、無い字だけ次の family に流れる。
 */
export const font = (file: string) => readFileSync(require.resolve(`@fontsource/${file}`));

export const FONT_FAMILY = 'JP, Latin';

const fonts = [
  { name: 'JP', data: font('noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'JP', data: font('noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
  { name: 'Latin', data: font('noto-sans-jp/files/noto-sans-jp-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Latin', data: font('noto-sans-jp/files/noto-sans-jp-latin-700-normal.woff'), weight: 700 as const, style: 'normal' as const },
];

// satori は外部 URL を取りに行かないので、画像は data URI にして渡す。
export const avatar = `data:image/png;base64,${readFileSync('src/assets/avatar.png').toString('base64')}`;

/*
 * satori は React 要素の形をしたただのオブジェクトを受け取る。
 * endpoint は .ts なので JSX は書けず、素の object で組み立てる。
 */
export type Node = { type: string; props: Record<string, unknown> };

/** 額縁と白いカード。中身（上下に分かれて並ぶ）だけを渡す。 */
export const frame = (children: Node[]): Node => ({
  type: 'div',
  props: {
    // 外側。グラデーションは額縁の幅でしか見えないので、向きより幅のほうが効く。
    style: {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      padding: FRAME,
      backgroundImage: `linear-gradient(135deg, ${BG_FROM}, ${BG_TO})`,
      fontFamily: FONT_FAMILY,
    },
    children: {
      type: 'div',
      props: {
        // 内側の白いカード。区切りは余白で作り、枠線は引かない。
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: CARD_PADDING,
          borderRadius: CARD_RADIUS,
          background: SURFACE,
        },
        children,
      },
    },
  },
});

/** カードの下に置く、アイコンと名前の行。 */
export const author = (): Node => ({
  type: 'div',
  props: {
    style: { display: 'flex', alignItems: 'center', gap: 20 },
    children: [
      /*
       * img に borderRadius を当てても resvg 側で角が残るので、
       * 丸く抜く箱を一枚かぶせる。サイト本体の rounded-full に揃える。
       */
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            width: 64,
            height: 64,
            borderRadius: 999,
            overflow: 'hidden',
          },
          children: {
            type: 'img',
            props: { src: avatar, width: 64, height: 64 },
          },
        },
      },
      /*
       * 名前とハンドルは濃さで区別する。
       * satori は 1 つの div に文字色を 2 つ持てないので、箱を分けて並べる。
       */
      {
        type: 'div',
        props: {
          style: { display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 36 },
          children: [
            { type: 'div', props: { style: { display: 'flex', color: FG }, children: 'asahi' } },
            { type: 'div', props: { style: { display: 'flex', color: FG_MUTED }, children: '/ @ashunar0' } },
          ],
        },
      },
    ],
  },
});

type Font = Parameters<typeof satori>[1]['fonts'][number];

/** 組んだ要素を png の Response にする。本文以外の書体を使うときは extraFonts で足す。 */
export async function renderPng(node: Node, extraFonts: Font[] = []): Promise<Response> {
  /*
   * satori の引数の型は ReactNode だが、実体は上のような素のオブジェクトも受け付ける。
   * key を持たないぶん ReactElement とは型が合わないので、ここだけ寄せる。
   */
  const element = node as unknown as Parameters<typeof satori>[0];

  const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts: [...fonts, ...extraFonts] });
  const png = new Resvg(svg).render().asPng();

  // Buffer をそのまま渡すと Response の型（BodyInit）に合わないので Uint8Array にする。
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
