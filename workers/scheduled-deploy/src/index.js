/**
 * 毎朝 GitHub Actions の Deploy ワークフローを叩くだけの Worker。
 *
 * なぜ要るか:
 * 静的サイトなので、ビルドし直さない限り公開日を迎えた記事は出てこない。
 * その定時ビルドを GitHub Actions の schedule に任せていたが、公式が
 * 「毎時 00 分は高負荷帯で、遅延するし場合によっては drop される」と
 * 明言していて、実際に 1 時間以上の遅延と不発が起きた。
 * 発火の主導権を Actions の待ち行列の外（= ここ）に移すのが目的。
 *
 * ビルドそのものは Actions のまま。astro build には Node と pnpm が要り、
 * Worker では動かせないため、ここは「時計」だけを担当する。
 */

const REPO = 'ashunar0/ashunar0-site';
const WORKFLOW = 'deploy.yml';
const BRANCH = 'main';

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(dispatchDeploy(env));
  },
};

/**
 * fetch ハンドラは意図的に持たない。
 * 公開 URL から誰でもデプロイを起動できてしまうため。
 * 手元で試すときは `wrangler dev --test-scheduled` を使い、
 * 別シェルから `curl "http://localhost:8787/__scheduled"` を叩く。
 */
async function dispatchDeploy(env) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub API は User-Agent が無いと 403 を返す。
        'User-Agent': 'ashunar0-site-scheduled-deploy',
      },
      body: JSON.stringify({ ref: BRANCH }),
    },
  );

  // 成功は 204 No Content。
  if (!res.ok) {
    // ここで投げないと「無言で止まる」最悪の壊れ方になる。
    // トークン失効もこの経路で表に出る。
    throw new Error(`workflow_dispatch failed: ${res.status} ${await res.text()}`);
  }
}
