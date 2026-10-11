/*
 * 段落に画像だけが単独で置かれていて title が付いているとき、figure にしてキャプションを付ける。
 *
 *   ![開場前の会場](./media/venue.jpeg "朝イチの会場")
 *
 * alt は「何が写っているか」の説明でスクリーンリーダーが読むもの、キャプションは画面に出す一言。
 * 役割が違うので title の方を使う。title がなければ何もしない。
 */

/** mdast の必要な部分だけ。unified の型を引くほどの構造ではない。 */
interface Node {
  type: string;
  title?: string | null;
  value?: string;
  children?: Node[];
  data?: { hName?: string };
}

export function remarkFigure() {
  return (tree: Node) => {
    // 単独の画像は本文直下の段落にしか現れないので、根の子だけ見れば足りる
    for (const node of tree.children ?? []) {
      if (node.type !== 'paragraph' || node.children?.length !== 1) continue;

      const [image] = node.children;
      if (image.type !== 'image' || !image.title) continue;

      const caption = image.title;

      // html ノードに差し替えると Astro の画像最適化を通らなくなる。
      // 画像ノードはそのまま残し、出力するタグ名だけを変える。
      node.data = { ...node.data, hName: 'figure' };
      node.children.push({
        type: 'figcaption',
        data: { hName: 'figcaption' },
        children: [{ type: 'text', value: caption }],
      });

      // 残すとホバーで同じ文言がツールチップに出る
      image.title = null;
    }
  };
}
