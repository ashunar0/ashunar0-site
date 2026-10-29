// ニュースの OG 画像の候補を原寸で書き出して、ブラウザで見比べるページを作る。
// node docs/og/news/gallery.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const OUT = 'docs/og/news';
const require = createRequire(import.meta.url);
const font = (f) => readFileSync(require.resolve(`@fontsource/noto-sans-jp/files/${f}`));
const fonts = [
  { name: 'JP', data: font('noto-sans-jp-japanese-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'JP', data: font('noto-sans-jp-japanese-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Latin', data: font('noto-sans-jp-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Latin', data: font('noto-sans-jp-latin-700-normal.woff'), weight: 700, style: 'normal' },
];
/*
 * 日付と News だけに使う欧文の見出し書体。候補を見比べるためだけなので、依存には足さず
 * fontsource の配布物を CDN から直接読む（satori は woff2 を読めないので woff）。
 */
const remote = async (name, file, weight) => ({
  name,
  data: Buffer.from(await (await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/${file}`)).arrayBuffer()),
  weight,
  style: 'normal',
});
fonts.push(
  await remote('Playfair', 'playfair-display/files/playfair-display-latin-900-normal.woff', 900),
  await remote('DMSerif', 'dm-serif-display/files/dm-serif-display-latin-400-normal.woff', 400),
  await remote('Bebas', 'bebas-neue/files/bebas-neue-latin-400-normal.woff', 400),
  await remote('Oswald', 'oswald/files/oswald-latin-700-normal.woff', 700),
  await remote('Fraktur', 'unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff', 400),
);

const avatar = `data:image/png;base64,${readFileSync('src/assets/avatar.png').toString('base64')}`;

const news = JSON.parse(readFileSync('src/content/news/2026-10-29.json', 'utf8'));
const TITLES = news.stories.map((s) => s.title);
const YEAR = '2026';
const DAY = '10.29';
const DATE = `${YEAR}.${DAY}`;

// サイトの色（global.css）
const BRAND = '#378180';
const BRAND_DARK = '#4fa8a6';
const STONE_950 = '#0c0a09';
const STONE_900 = '#1c1917';
const STONE_800 = '#292524';
const STONE_400 = '#a8a29e';
const STONE_50 = '#fafaf9';
const FG = '#171717';
const MUTED = '#737373';

// --- 部品 -------------------------------------------------------------

const box = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });
const text = (children, style = {}) => box(style, children);

const authorRow = (fg, muted, size = 30) =>
  box({ alignItems: 'center', gap: 16 }, [
    box({ width: 52, height: 52, borderRadius: 999, overflow: 'hidden' }, {
      type: 'img',
      props: { src: avatar, width: 52, height: 52 },
    }),
    box({ alignItems: 'baseline', gap: 8, fontSize: size }, [
      text('asahi', { color: fg }),
      text('/ @ashunar0', { color: muted }),
    ]),
  ]);

const titleList = (titles, { color, size = 28, gap = 10, max = 5 }) =>
  box(
    { flexDirection: 'column', gap, minWidth: 0 },
    titles.slice(0, max).map((t) =>
      text(t, {
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.5,
        color,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }),
    ),
  );

// ストーリーの進み具合のバー
const bars = (count, current, on, off) =>
  box(
    { gap: 6, width: '100%' },
    Array.from({ length: count }, (_, i) =>
      box({ flex: 1, height: 5, borderRadius: 999, backgroundColor: i <= current ? on : off }),
    ),
  );

const page = (bg, children, extra = {}) =>
  box({ width: 1200, height: 630, fontFamily: 'JP, Latin', backgroundColor: bg, ...extra }, children);

// --- 候補 -------------------------------------------------------------

// 日付を主役にして、見出しは 1 本目だけ。2026-10-29 の 1 回目の候補（一覧の見出しを全部載せる案）は
// 「内容はそんなに描かなくていい、日付を前に」で取り下げた。
const lead = (color, size) =>
  text(TITLES[0], { fontSize: size, fontWeight: 700, lineHeight: 1.5, color });
const restNote = (color, size = 24) => text(`ほか ${TITLES.length - 1} 本`, { fontSize: size, color });

// 縦積み: 上に日付、下に見出し 1 本
const stacked = ({ bg, fg, muted, accent, dayColor }) =>
  page(
    bg,
    [
      box({ flexDirection: 'column' }, [
        box({ alignItems: 'baseline', gap: 14, fontSize: 32 }, [
          text('News', { color: accent, fontWeight: 700 }),
          text(YEAR, { color: muted }),
        ]),
        text(DAY, { fontSize: 220, fontWeight: 700, lineHeight: 1, color: dayColor, letterSpacing: -8, marginTop: 8 }),
      ]),
      box({ alignItems: 'flex-end', justifyContent: 'space-between', gap: 48 }, [
        box({ flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }, [lead(fg, 34), restNote(muted)]),
        box({ width: 64, height: 64, borderRadius: 999, overflow: 'hidden', flexShrink: 0 }, {
          type: 'img',
          props: { src: avatar, width: 64, height: 64 },
        }),
      ]),
    ],
    { flexDirection: 'column', justifyContent: 'space-between', padding: 72 },
  );

// 横並び: 左に日付、右に見出し 1 本
const sideBySide = ({ bg, fg, muted, accent, dayColor }) =>
  page(
    bg,
    [
      box({ flexDirection: 'column', justifyContent: 'space-between', width: 560 }, [
        box({ flexDirection: 'column' }, [
          box({ alignItems: 'baseline', gap: 14, fontSize: 32 }, [
            text('News', { color: accent, fontWeight: 700 }),
            text(YEAR, { color: muted }),
          ]),
          text(DAY, { fontSize: 190, fontWeight: 700, lineHeight: 1.1, color: dayColor, letterSpacing: -6 }),
        ]),
        authorRow(fg, muted, 26),
      ]),
      box({ flex: 1, flexDirection: 'column', justifyContent: 'center', gap: 12, paddingLeft: 24, minWidth: 0 }, [
        lead(fg, 34),
        restNote(muted),
      ]),
    ],
    { padding: 72 },
  );

// 背景の写真。1200×630 に切り抜いてから data URI で渡す（satori は外部 URL を読まない）
const PHOTO_SRC = process.env.PHOTO ?? 'src/assets/news-og.jpg';
const photo = `data:image/jpeg;base64,${(
  await sharp(PHOTO_SRC).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
).toString('base64')}`;

const layer = (style, children) =>
  box({ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, ...style }, children);

/*
 * トップの hero と同じ覆い方。全面に黒を敷くと写真が濁るので、文字の乗る側だけ暗くする。
 * shade: 'edge' は下と左から、'flat' は全面に一様に。
 */
const overlays = (shade) =>
  shade === 'edge' || shade === 'edge-top'
    ? [
        ...(shade === 'edge-top'
          ? [layer({ backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0) 35%)' })]
          : []),
        layer({ backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.35) 55%, rgba(0,0,0,0))' }),
        layer({ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0) 60%)' }),
      ]
    : [layer({ backgroundColor: `rgba(0,0,0,${shade})` })];

const WHITE = '#ffffff';
const WHITE_MUTED = 'rgba(255,255,255,0.75)';

// display: 日付（と News）の書体。指定がなければ本文と同じ Noto Sans JP
const onPhoto = ({ shade, dayColor = WHITE, layout, display, newsDisplay = display }) => {
  const dayFont = display
    ? { fontFamily: display.family, fontWeight: display.weight, letterSpacing: display.spacing ?? 0 }
    : { fontWeight: 700, letterSpacing: -6 };
  const newsFont = newsDisplay
    ? { fontFamily: newsDisplay.family, fontWeight: newsDisplay.weight, fontSize: newsDisplay.newsSize ?? 32 }
    : { fontWeight: 700 };
  const head = box({ alignItems: 'baseline', gap: 14, fontSize: 32 }, [
    text('News', { color: WHITE, ...newsFont }),
    text(YEAR, { color: WHITE_MUTED, ...(display ? { fontFamily: display.family, fontWeight: display.weight } : {}) }),
  ]);
  const day = (size) =>
    text(DAY, { fontSize: display?.size ?? size, lineHeight: 1, color: dayColor, ...dayFont });
  const headline = box({ flexDirection: 'column', gap: 6, minWidth: 0 }, [lead(WHITE, 32), restNote(WHITE_MUTED)]);

  const content =
    layout === 'stacked-top'
      ? layer({ flexDirection: 'column', justifyContent: 'space-between', padding: 64 }, [
          box({ alignItems: 'center', justifyContent: 'space-between' }, [head, authorRow(WHITE, WHITE_MUTED, 26)]),
          box({ flexDirection: 'column', gap: 28 }, [day(200), headline]),
        ])
      : layout === 'stacked'
      ? layer({ flexDirection: 'column', justifyContent: 'space-between', padding: 64 }, [
          head,
          box({ flexDirection: 'column', gap: 28 }, [
            day(200),
            box({ alignItems: 'flex-end', justifyContent: 'space-between', gap: 40 }, [
              headline,
              box({ flexShrink: 0 }, [authorRow(WHITE, WHITE_MUTED, 26)]),
            ]),
          ]),
        ])
      : layer({ padding: 64, gap: 24 }, [
          box({ flexDirection: 'column', justifyContent: 'space-between', width: 540 }, [
            box({ flexDirection: 'column', gap: 8 }, [head, day(190)]),
            authorRow(WHITE, WHITE_MUTED, 26),
          ]),
          box({ flex: 1, flexDirection: 'column', justifyContent: 'center', minWidth: 0 }, [headline]),
        ]);

  return page('#000000', [
    layer({}, { type: 'img', props: { src: photo, width: 1200, height: 630 } }),
    ...overlays(shade),
    content,
  ], { position: 'relative' });
};

const base = { shade: 'edge-top', layout: 'stacked-top' };
const PLAYFAIR = { family: 'Playfair', weight: 900, spacing: -4 };

const candidates = [
  { id: '16', name: '（採用）いまの書体', note: 'Noto Sans JP の太字。比較用。', node: onPhoto(base) },
  { id: '17', name: 'Playfair Display', note: '新聞の見出しのような、太いセリフ体。', node: onPhoto({ ...base, display: PLAYFAIR }) },
  { id: '18', name: 'DM Serif Display', note: '細身でコントラストの強いセリフ体。雑誌の表紙寄り。', node: onPhoto({ ...base, display: { family: 'DMSerif', weight: 400, spacing: -4 } }) },
  { id: '19', name: 'Bebas Neue', note: '縦長に詰まった大文字の書体。ニュース番組のテロップ寄り。', node: onPhoto({ ...base, display: { family: 'Bebas', weight: 400, spacing: 2, size: 240, newsSize: 40 } }) },
  { id: '20', name: 'Oswald', note: 'Bebas より少し幅のある詰まった書体。', node: onPhoto({ ...base, display: { family: 'Oswald', weight: 700, spacing: -2, size: 210 } }) },
  { id: '21', name: '題字だけ髭文字 + 日付は Playfair', note: '「News」を新聞の題字のようなブラックレターに。日付は 17 と同じ。', node: onPhoto({ ...base, display: PLAYFAIR, newsDisplay: { family: 'Fraktur', weight: 400, newsSize: 44 } }) },
];

// --- 書き出し -----------------------------------------------------------

for (const c of candidates) {
  const svg = await satori(c.node, { width: 1200, height: 630, fonts });
  writeFileSync(`${OUT}/${c.id}.png`, new Resvg(svg).render().asPng());
}

const sections = candidates
  .map(
    (c) => `
  <section>
    <h2><span class="id">${c.id}</span> ${c.name}</h2>
    <p class="note">${c.note}</p>
    <div class="pair">
      <figure><img class="small" src="${c.id}.png"><figcaption>X のタイムライン幅（504px）</figcaption></figure>
      <figure><img class="thumb" src="${c.id}.png"><figcaption>一覧のサムネ（360px）</figcaption></figure>
    </div>
    <details><summary>原寸</summary><img class="full" src="${c.id}.png"></details>
  </section>`,
  )
  .join('');

writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>ニュースの OG 画像の候補</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 40px; font-family: system-ui, sans-serif; background: #f5f5f5; color: #171717; }
  @media (prefers-color-scheme: dark) { body { background: #0c0a09; color: #fafaf9; } h2 { border-color: #292524 !important; } }
  h1 { font-size: 20px; margin: 0 0 32px; }
  section { margin-bottom: 56px; }
  h2 { font-size: 16px; font-weight: 600; margin: 0 0 4px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
  p.note { margin: 8px 0 16px; color: #737373; font-size: 14px; }
  .id { display: inline-block; min-width: 28px; color: #737373; font-variant-numeric: tabular-nums; }
  .pair { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  figure { margin: 0; }
  figcaption { margin-top: 6px; font-size: 12px; color: #737373; }
  img { display: block; border-radius: 8px; }
  img.small { width: 504px; height: auto; }
  img.thumb { width: 360px; height: auto; }
  img.full { width: min(1200px, 100%); height: auto; margin-top: 12px; }
  summary { cursor: pointer; font-size: 13px; color: #737373; margin-top: 12px; }
</style></head>
<body>
  <h1>ニュースの OG 画像の候補</h1>
  ${sections}
</body></html>
`,
);

console.log(`wrote ${candidates.length} candidates to ${OUT}`);
