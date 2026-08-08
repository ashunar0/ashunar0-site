import { fetchLinkPreview, type LinkPreview } from './fetch-ogp';

/*
 * 段落に URL だけが単独で置かれているとき、リンクカードに差し替える。
 * 文中に混ざったリンクはそのまま（本文の流れを切りたくない場所まで箱にしない）。
 *
 * Zenn と同じ判定にしてある。カード化したくなければ [テキスト](url) と書けばよい。
 */

/** mdast の必要な部分だけ。unified の型を引くほどの構造ではない。 */
interface Node {
  type: string;
  url?: string;
  value?: string;
  children?: Node[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 段落が「裸の URL 一つ」だけで出来ているか。
 * 表示文字列が URL と違う（= 自分で文言を付けた）ものは対象外にする。
 */
function bareUrlOf(node: Node): string | undefined {
  if (node.type !== 'paragraph' || node.children?.length !== 1) return;

  const [child] = node.children;
  if (child.type !== 'link' || !child.url) return;
  if (!/^https?:\/\//.test(child.url)) return;

  const label = child.children?.map((c) => c.value ?? '').join('') ?? '';
  if (label !== child.url) return;

  return child.url;
}

function renderCard(preview: LinkPreview): string {
  const { url, title, description, image, host, favicon } = preview;

  // 画像は相手のサーバーから読むので、遅延読み込みと参照元の秘匿だけ付けておく
  const thumbnail = image
    ? `<div class="link-card__image"><img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>`
    : '';

  const summary = description
    ? `<p class="link-card__description">${escapeHtml(description)}</p>`
    : '';

  return `<a class="link-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
  <div class="link-card__text">
    <p class="link-card__title">${escapeHtml(title)}</p>
    ${summary}
    <p class="link-card__host"><img src="${escapeHtml(favicon)}" alt="" loading="lazy" /><span>${escapeHtml(host)}</span></p>
  </div>
  ${thumbnail}
</a>`;
}

export function remarkLinkCard() {
  return async (tree: Node) => {
    const targets: { node: Node; url: string }[] = [];

    // 裸の URL は本文直下にしか現れないので、根の子だけ見れば足りる
    for (const node of tree.children ?? []) {
      const url = bareUrlOf(node);
      if (url) targets.push({ node, url });
    }

    if (targets.length === 0) return;

    // 記事内のリンクをまとめて取りにいく。1 本ずつ待つとビルドが伸びる
    const previews = await Promise.all(targets.map(({ url }) => fetchLinkPreview(url)));

    targets.forEach(({ node }, i) => {
      const preview = previews[i];

      // 取れなかったものは段落のまま残す（普通のリンクとして読める）
      if (!preview) return;

      node.type = 'html';
      node.value = renderCard(preview);
      delete node.children;
    });
  };
}
