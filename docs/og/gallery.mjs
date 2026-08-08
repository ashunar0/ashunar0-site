// 候補を原寸で書き出して、ブラウザで見比べるページを作る。
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const OUT = 'docs/og';
const require = createRequire(import.meta.url);
const font = (f) => readFileSync(require.resolve(`@fontsource/noto-sans-jp/files/${f}`));
const fonts = [
  { name: 'JP', data: font('noto-sans-jp-japanese-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'JP', data: font('noto-sans-jp-japanese-700-normal.woff'), weight: 700, style: 'normal' },
  { name: 'Latin', data: font('noto-sans-jp-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Latin', data: font('noto-sans-jp-latin-700-normal.woff'), weight: 700, style: 'normal' },
];
const avatar = `data:image/png;base64,${readFileSync('src/assets/avatar.png').toString('base64')}`;
const TITLE = 'Hono でバックエンド API を作るときの個人的ベストプラクティス';

const BRAND = '#378180';
const ACCENT = '#ef6452';

const tint = (hex, ratio) => {
  const n = parseInt(hex.slice(1), 16);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v * ratio + 255 * (1 - ratio)).toString(16).padStart(2, '0'))
    .join('')}`;
};
const toHsl = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: h * 60, s, l };
};
const hsl = (hex, { l, s }) => {
  const c = toHsl(hex);
  return `hsl(${Math.round(c.h)}, ${Math.round((s ?? c.s) * 100)}%, ${Math.round(l * 100)}%)`;
};
const grad = (a, b) => `linear-gradient(135deg, ${a}, ${b})`;

const card = ({ bg, pad = 40, surface = '#fff', fg = '#171717', muted = '#737373' }) => ({
  type: 'div',
  props: {
    style: {
      width: 1200, height: 630, display: 'flex', padding: pad,
      // undefined を渡すと satori の css パースが落ちるので、キーごと出し分ける。
      ...(bg.startsWith('linear')
        ? { backgroundImage: bg, backgroundColor: '#fff' }
        : { backgroundColor: bg }),
      fontFamily: 'JP, Latin',
    },
    children: {
      type: 'div',
      props: {
        style: {
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          width: '100%', height: '100%', padding: 48, borderRadius: 16, background: surface,
        },
        children: [
          { type: 'div', props: { style: { display: 'flex', fontSize: 56, fontWeight: 700, lineHeight: 1.45, color: fg }, children: TITLE } },
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: 20 },
              children: [
                { type: 'div', props: { style: { display: 'flex', width: 64, height: 64, borderRadius: 999, overflow: 'hidden' }, children: { type: 'img', props: { src: avatar, width: 64, height: 64 } } } },
                { type: 'div', props: { style: { display: 'flex', fontSize: 30, color: muted }, children: 'ashunar0' } },
              ],
            },
          },
        ],
      },
    },
  },
});


/*
 * 色相環の位置で色を作る。brand は 179 度（青緑）、accent は 6 度（朱）。
 * 参考にした 2 サイトは色相の幅が 56 度と 114 度に収まっていて、
 * その範囲なら中間も彩度を保つので濁らない。真裏まで回すと灰色を通る。
 */
const at = (h, s, l) => `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
const ramp = (h1, h2, { s = 0.72, l1 = 0.74, l2 = 0.82 } = {}) =>
  `linear-gradient(135deg, ${at(h1, s, l1)}, ${at(h2, s, l2)})`;

const H_BRAND = 179;
const H_ACCENT = 6;


const CANDIDATES = [
  { id: '01', label: 'brand → 緑 145°（標準）', opts: { bg: ramp(H_BRAND, 145) } },
  { id: '02', label: 'brand → 緑 145°（淡い）', opts: { bg: ramp(H_BRAND, 145, { s: 0.6, l1: 0.84, l2: 0.89 }) } },
  { id: '03', label: 'brand → 黄緑 120°（もっと回す）', opts: { bg: ramp(H_BRAND, 120) } },
  { id: '04', label: 'accent → オレンジ 38°（標準）', opts: { bg: ramp(H_ACCENT, 38) } },
  { id: '05', label: 'accent → オレンジ 38°（淡い）', opts: { bg: ramp(H_ACCENT, 38, { s: 0.6, l1: 0.84, l2: 0.89 }) } },
  { id: '06', label: 'accent → ピンク 335°（標準）', opts: { bg: ramp(H_ACCENT, 335) } },
  { id: '07', label: 'accent → ピンク 335°（淡い）', opts: { bg: ramp(H_ACCENT, 335, { s: 0.6, l1: 0.84, l2: 0.89 }) } },
  { id: '08', label: 'accent → 黄 50°（標準）', opts: { bg: ramp(H_ACCENT, 50) } },
];

for (const c of CANDIDATES) {
  const svg = await satori(card(c.opts), { width: 1200, height: 630, fonts });
  writeFileSync(`${OUT}/${c.id}.png`, new Resvg(svg).render().asPng());
  console.log(c.id, c.label);
}

const refs = `
  <section class="ref">
    <h2><span class="id">参考</span> Zenn（額縁 38px）</h2>
    <div class="pair">
      <figure><img src="ref-zenn.png" class="full"><figcaption>原寸</figcaption></figure>
      <figure><img src="ref-zenn.png" class="small"><figcaption>タイムライン相当</figcaption></figure>
    </div>
  </section>
  <section class="ref">
    <h2><span class="id">参考</span> azukiazusa さん（額縁 48px）</h2>
    <div class="pair">
      <figure><img src="ref-azusa.png" class="full"><figcaption>原寸</figcaption></figure>
      <figure><img src="ref-azusa.png" class="small"><figcaption>タイムライン相当</figcaption></figure>
    </div>
  </section>`;

const rows = CANDIDATES.map((c) => `
  <section>
    <h2><span class="id">${c.id}</span> ${c.label}</h2>
    <div class="pair">
      <figure><img src="${c.id}.png" class="full"><figcaption>原寸 1200×630</figcaption></figure>
      <figure><img src="${c.id}.png" class="small"><figcaption>X のタイムライン相当</figcaption></figure>
    </div>
  </section>`).join('');

writeFileSync(`${OUT}/index.html`, `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>OG 画像の候補</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 40px; font-family: system-ui, sans-serif; background: #f5f5f5; color: #171717; }
  @media (prefers-color-scheme: dark) { body { background: #0c0a09; color: #fafaf9; } h2 { border-color: #292524 !important; } }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p.note { margin: 0 0 32px; color: #737373; font-size: 14px; }
  section { margin-bottom: 56px; }
  h2 { font-size: 16px; font-weight: 600; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
  .id { display: inline-block; min-width: 28px; color: #737373; font-variant-numeric: tabular-nums; }
  .pair { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  figure { margin: 0; }
  figcaption { margin-top: 6px; font-size: 12px; color: #737373; }
  img { display: block; border-radius: 8px; }
  img.full { width: min(1200px, 100%); height: auto; }
  img.small { width: 504px; height: auto; }
</style></head>
<body>
  <h1>OG 画像の候補</h1>
  <p class="note">上の 2 つが参考。以下は「ベース 1 色 + 色相の近い色」でグラデを作った候補なのだ。Zenn と azuki さんの色相と被らない 4 方向に絞ったのだ。01〜03 が brand 起点、04〜08 が accent 起点。</p>
  ${refs}
  <hr style="margin:48px 0;border:none;border-top:2px solid #d4d4d4">
  ${rows}
</body></html>`);
console.log('\n=> file://' + OUT + '/index.html');
