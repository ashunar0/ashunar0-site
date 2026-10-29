import { readFileSync } from 'node:fs';
import type { APIRoute, GetStaticPaths } from 'astro';
import { avatar, font, HEIGHT, renderPng, WIDTH, type Node } from '@/features/og/card';
import { getNewsList, type News } from '@/features/news/query';

/*
 * ニュース 1 日分のカード画像。一覧のサムネと、X に貼ったときのカードを兼ねる。
 *
 * 記事の OG（明るい額縁 + 白いカード）とは並んだときに見分けがつくよう、形から変えてある。
 * 写真を敷いて暗くし、日付を主役に大きく置く。中身は 1 本目の見出しだけで、残りは本数で示す。
 * 候補を見比べた経緯は docs/og/news/（node docs/og/news/gallery.mjs で作り直せる）。
 */

const WHITE = '#ffffff';
const WHITE_MUTED = 'rgba(255,255,255,0.75)';

// 背景の写真（Unsplash / Andrew Neel）。元画像を 1200×630 に切り抜いて置いてある
const photo = `data:image/jpeg;base64,${readFileSync('src/assets/news-og.jpg').toString('base64')}`;

/*
 * 日付と News だけ新聞の見出しのようなセリフ体にする。英数字しか載せないので latin の 1 枚で足りる。
 * Playfair の数字は高さが揃わない形（9 が下に出る）だが、それも含めて選んだ。
 */
const DISPLAY = 'Playfair';
const displayFont = {
  name: DISPLAY,
  data: font('playfair-display/files/playfair-display-latin-900-normal.woff'),
  weight: 900 as const,
  style: 'normal' as const,
};

export const getStaticPaths: GetStaticPaths = async () => {
  const list = await getNewsList();
  return list.map((news) => ({
    params: { slug: news.id },
    props: { news },
  }));
};

interface Props {
  news: News;
}

const box = (style: Record<string, unknown>, children?: unknown): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
});

// 写真と覆いを重ねるための、画像いっぱいの層
const layer = (style: Record<string, unknown>, children?: unknown) =>
  box({ position: 'absolute', top: 0, left: 0, width: WIDTH, height: HEIGHT, ...style }, children);

const author = () =>
  box({ alignItems: 'center', gap: 16 }, [
    // img に borderRadius を当てても resvg 側で角が残るので、丸く抜く箱をかぶせる
    box({ width: 52, height: 52, borderRadius: 999, overflow: 'hidden' }, {
      type: 'img',
      props: { src: avatar, width: 52, height: 52 },
    }),
    box({ alignItems: 'baseline', gap: 8, fontSize: 26 }, [
      box({ color: WHITE }, 'asahi'),
      box({ color: WHITE_MUTED }, '/ @ashunar0'),
    ]),
  ]);

const card = (news: News) => {
  const [year, month, day] = news.id.split('-');
  const { stories } = news.data;
  const rest = stories.length - 1;

  return box({ position: 'relative', width: WIDTH, height: HEIGHT, backgroundColor: '#000000', fontFamily: 'JP, Latin' }, [
    layer({}, { type: 'img', props: { src: photo, width: WIDTH, height: HEIGHT } }),

    /*
     * トップの hero と同じ覆い方。全面に黒を敷くと写真が濁るので、文字の乗る側だけ暗くする。
     * 下（日付と見出し）と左から濃く。右上は壁と窓が明るく名前が沈むので、上辺にも薄く敷く。
     */
    layer({ backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0) 35%)' }),
    layer({ backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35) 55%, rgba(0,0,0,0))' }),
    layer({ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0) 60%)' }),

    layer({ flexDirection: 'column', justifyContent: 'space-between', padding: 64 }, [
      box({ alignItems: 'center', justifyContent: 'space-between' }, [
        box({ alignItems: 'baseline', gap: 14, fontSize: 32, fontFamily: DISPLAY, fontWeight: 900 }, [
          box({ color: WHITE }, 'News'),
          box({ color: WHITE_MUTED }, year),
        ]),
        author(),
      ]),

      box({ flexDirection: 'column', gap: 28 }, [
        box(
          { fontSize: 200, lineHeight: 1, color: WHITE, fontFamily: DISPLAY, fontWeight: 900, letterSpacing: -4 },
          `${month}.${day}`,
        ),
        box({ flexDirection: 'column', gap: 6 }, [
          // 1 行に収める。折り返すと日付を上へ押し出すので、はみ出したぶんは … で切る
          box(
            {
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.5,
              color: WHITE,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
            stories[0]?.title ?? '',
          ),
          // satori は style に undefined を渡すと落ちるので、要らないときは要素ごと出さない
          ...(rest > 0 ? [box({ fontSize: 24, color: WHITE_MUTED }, `ほか ${rest} 本`)] : []),
        ]),
      ]),
    ]),
  ]);
};

export const GET: APIRoute = async ({ props }) => {
  const { news } = props as Props;
  return renderPng(card(news), [displayFont]);
};
