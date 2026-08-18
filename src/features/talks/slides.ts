import type { ImageMetadata } from 'astro';

/*
 * スライドは登壇ディレクトリに置いた PNG をそのまま順番に並べる。
 * index.md には一枚も書かない。20 枚を毎回手で並べるのが登壇追加の面倒さになるので、
 * 「ディレクトリに入れたら出る」を規約にする。
 *
 * import.meta.glob は静的解析でパスを解決するため、パターンは文字列リテラルで書く。
 * 変数を挟むと解決できずビルド時に空になる。
 */
const files = import.meta.glob<ImageMetadata>('/src/content/talks/*/*.png', {
  eager: true,
  import: 'default',
});

const SLIDE_PATH = /^\/src\/content\/talks\/([^/]+)\/([^/]+)\.png$/;

/*
 * numeric 比較にしてあるので `1.png, 2.png, 10.png` でも正しく並ぶ。
 * ゼロ埋めしてもしなくてよい。
 */
const byFileName = new Intl.Collator('en', { numeric: true }).compare;

const slidesByTalk = ((): Map<string, ImageMetadata[]> => {
  const grouped = new Map<string, { name: string; image: ImageMetadata }[]>();

  for (const [path, image] of Object.entries(files)) {
    const matched = SLIDE_PATH.exec(path);
    if (!matched) continue;
    const [, talkId, name] = matched;
    const slides = grouped.get(talkId) ?? [];
    slides.push({ name, image });
    grouped.set(talkId, slides);
  }

  return new Map(
    [...grouped].map(([talkId, slides]) => [
      talkId,
      slides.sort((a, b) => byFileName(a.name, b.name)).map((slide) => slide.image),
    ]),
  );
})();

/** 登壇 id（＝ディレクトリ名）のスライドをファイル名順で返す。無ければ空配列。 */
export function getSlides(talkId: string): ImageMetadata[] {
  return slidesByTalk.get(talkId) ?? [];
}

/** 一覧のサムネに使う 1 枚目。スライドを置いていなければ undefined。 */
export function getCoverSlide(talkId: string): ImageMetadata | undefined {
  return getSlides(talkId)[0];
}
