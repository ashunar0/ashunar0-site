// widgets.js が実行時に生やすもの。型は付いてこないのでここで宣言する。
declare global {
  interface Window {
    twttr?: { widgets: { load: (target?: HTMLElement) => void } };
  }
}

/**
 * X の投稿を埋め込む。`data-tweet-url` を持つ器を widgets.js が iframe に差し替える。
 * 器は記事なら remark-link-card が、ニュースなら news-detail が置く。
 * 投稿があるページでだけスクリプトを足したいので、読み込みはここで行う。
 */
export function mountTweets(wrappers: HTMLElement[]): void {
  if (wrappers.length === 0) return;

  const currentTheme = () =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  /*
   * 配色は blockquote の data-theme を見て iframe が組まれるため、
   * 出来上がったあとから変えられない。テーマを変えたら中身ごと作り直す。
   */
  const paint = () => {
    const theme = currentTheme();

    for (const wrapper of wrappers) {
      const quote = document.createElement('blockquote');
      quote.className = 'twitter-tweet';
      quote.dataset.theme = theme;

      // 既定の 550px は本文の中で目立ちすぎる。250〜550 の範囲で指定でき、中身は組み直される。
      quote.dataset.width = '500';

      // 中身のないリンクを置くと、widgets.js が投稿を取ってきて描き換える
      const link = document.createElement('a');
      link.href = wrapper.dataset.tweetUrl!;
      quote.append(link);

      wrapper.replaceChildren(quote);
    }

    window.twttr?.widgets.load();
  };

  paint();

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://platform.twitter.com/widgets.js';
  document.head.append(script);

  // テーマの切り替えは html の class で伝わる。トグル側に手を入れずに拾う。
  let theme = currentTheme();

  new MutationObserver(() => {
    if (currentTheme() === theme) return;
    theme = currentTheme();
    paint();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}
