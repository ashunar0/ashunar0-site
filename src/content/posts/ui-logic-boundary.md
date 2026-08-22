---
title: UIとロジックの境界は「型が変わる瞬間」にある
description: 画面のコードに事業のルールが吸い寄せられるのは、UIツールが状態を預かる実行環境でもあるからです。UI状態かどうかの判定を「表示に関わるか」ではなく「画面と一緒に消えてよいか」で行い、境界を string から検証済みの型への変換点として型に現します。Valibot と TanStack Query を使って、入力中バリデーションと楽観的更新という分離が崩れやすい二つの例が、どちらも「データは画面側、ルールはロジック側」という同じ形に収まることを確認します。
pubDate: 2026-08-23
tags: [React, TypeScript, Valibot, 設計]
draft: false
---

## はじめに

React の公式ドキュメントに、こんなことが書いてあります。

> React はライブラリです。コンポーネントを組み合わせることはできますが、ルーティングやデータフェッチの方法までは指定しません。React でアプリ全体を構築する場合は、Next.js や React Router のようなフルスタックのフレームワークをお勧めします。

いやうそつけーい！！

「指定しません」と言いながら、実際には次のことを全部強制します。

- **状態をどこに置くか**。自分で用意した変数を書き換えても画面は変わりません。`useState` に預けない限り、React は動きません
- **自分の書いた関数がいつ、何回呼ばれるか**。決めるのは React です
- **副作用をいつ走らせるか**。`useEffect` の実行タイミングはこちらでは選べません
- **関数の書き方**。フックはトップレベルでしか呼べません。条件分岐の中に入れたらエラーです

ライブラリを使うとき、普通ここまで指図されません。しかもアプリ全体を作るならフレームワークを使え、と書いてある。**決めないことを売りにしておいて、決めていない部分は他所で埋めてくれ**と言っているわけです。

ただ、嘘だと言って終わると何も残りません。**「うそつけーい」と言い切るには、React が実際に押し付けているものを並べないといけない**からです。そして並べ終わったとき、手元に残るのは告発ではなく一本の線になります。

React の管轄がどこで終わるのか、という線。それはそのまま、**UIとロジックをどこで分けるか**の線です。

結論を先に書くと、その境界は**型が変わる瞬間**に置けます。

## 何が問題なのか

画面を作るとき、コードは自然と一箇所に集まっていきます。注文フォームを作るなら、入力欄の状態も、金額の計算も、送信処理も、全部その画面のファイルに書けてしまいます。動くので、当面は困りません。

問題は少し先に出てきます。

```jsx
function Checkout({ cart }) {
  const [step, setStep] = useState(0)
  const total = useMemo(() => {
    // 3000円以上で送料無料、会員は5%引き、クーポンは送料に適用しない…
  }, [cart])
}
```

割引のルールが画面の中に入りました。こうなると、

- 割引の計算をテストするのに画面を起動しないといけない
- 「送料無料は3000円から」という仕様を知るには、UIの仕組みを読める人でないといけない
- 管理画面でも同じ計算が必要になったとき、コピーするしかない

事業のルールが表示の都合に巻き込まれている状態です。

## なぜ勝手に混ざるのか

これは書き手の不注意というより、UIツール側に事情があります。

React や Vue のようなモダンなUIツールは、「データが変わったら画面を描き直す」という約束で動いています。この約束を守るには、ツール側が「データが変わった」ことを知る必要があります。だから、これらのツールは必ず**状態を預かる仕組み**を持っています。React なら `useState`、Vue なら `ref` です。

つまりUIツールは単に「描く道具」ではなく、**データを預かり、いつ処理を走らせるかを決める実行環境**でもあります。そして便利なので、つい全部をそこに預けてしまって、結局ロジックが画面とごちゃ混ぜになってしまうわけです。

したがって分離とは、この引力に逆らって **「預けてよいもの」と「預けてはいけないもの」を意識的に仕分ける作業** です。

## 判定の基準は「消えても困らないか」

「これはUIの状態か、ロジックの状態か」の判断基準としてまず思いつくのは「表示に関わるかどうか」ですが、これは使えません。商品一覧のデータも表示に関わるからです。この基準だと全部がUIになってしまいます。

もっと確実に効く問いはこれです。

> 画面を閉じたら消えていいか？

| 状態 | 消えていいか | 分類 |
| --- | --- | --- |
| モーダルが開いているか | 再読み込みで閉じていい | UI |
| 入力欄に打ちかけの文字 | 消えて当然 | UI |
| どの行を選択中か | 消えていい | UI |
| 商品一覧のデータ | 取り直しが必要。本物はサーバーにある | ロジック |
| 注文の内容 | 消えたら事故 | ロジック |

いわばUIの状態とは **「画面と共に心中してもいい状態」** です。

逆に、画面が消えても存在し続けるべきものには、たいてい事業上の名前がついています。注文、ユーザー、請求書。**名前がついているものはロジック側**、と考えるとほぼ外れません。要はドメイン知識ですね。

## 境界は型が変わる瞬間に現れる

判定基準がわかっても、コード上のどこが境目なのかは曖昧に感じられます。ここではっきりするのが、**型の変化を見る**という方法です。

プロフィール編集フォームで考えます。入力中の値はただの文字列です。まだ何者でもありません。それが「送信する」瞬間に、初めて意味のあるデータになります。

まずロジック側に、そのデータが何であるかを定義します。

```ts
// features/profile/schema.ts
import * as v from 'valibot'

export const emailSchema = v.pipe(v.string(), v.email('メールアドレスの形式が違います'))
export const displayNameSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(20))

export const profileInput = v.object({
  email: emailSchema,
  displayName: displayNameSchema,
})

export type ProfileInput = v.InferOutput<typeof profileInput>
```

送信もロジック側です。受け取る型は `ProfileInput` であって、`string` の寄せ集めではありません。

```ts
// features/profile/api.ts
export function useUpdateProfile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: ProfileInput) => api.profile.$put({ json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}
```

画面側が持つのは、あくまで文字列です。

```tsx
const [email, setEmail] = useState('')
const [displayName, setDisplayName] = useState('')
const [errors, setErrors] = useState<Record<string, string>>({})
const { mutate, isPending } = useUpdateProfile()

const onSubmit = () => {
  const result = v.safeParse(profileInput, { email, displayName })
  if (!result.success) return setErrors(toFieldErrors(result.issues))

  mutate(result.output)     // ← ここが境界
}
```

`string` を持っている間は画面の世界、`ProfileInput` になった瞬間からロジックの世界です。`mutate` は生の文字列を受け取れないので、**検証を飛ばして送信することができません**。

ここが重要なところで、境界が図やチーム内の口約束ではなく、型として存在しています。越えようとするとコンパイラが止まります。規約は破れますが、型は破れません。

なお `ProfileInput` は手で書いた型ではなく、スキーマから導かれた型です。値の形だけでなく「検証を通った」という事実まで型が持っているので、`string & { __brand: ... }` のような細工を自分で用意しなくても、同じ効果が得られます。

## 分離が崩れやすい二つの例

分離を実際にやると必ずぶつかる例が二つあります。どちらも同じ形で解けます。

### 入力中のバリデーション

「送信前にリアルタイムで形式チェックしたい」となると、ロジックが入力中の値を覗きに来るように見えます。境界が壊れそうです。

でも壊れません。

```tsx
const emailError =
  email && !v.safeParse(emailSchema, email).success
    ? 'メールアドレスの形式が違います'
    : null
```

`emailSchema` はロジック側が持つ検証規則そのものです。値は画面側が持ったまま、**判定だけを借りています**。ルールは一箇所にあり、同じスキーマをサーバー側の検証にも使えます。

### 楽観的更新

「いいね」を押した瞬間に、サーバーの返事を待たずに画面のカウントを増やすやつです。「サーバーがまだ知らないのに、画面上はもう確定している値」なので、UI状態ともロジック状態とも言いにくく見えます。

整理の鍵は、**画面に出ているサーバー由来のデータは、すべて表示用のコピーにすぎない**と捉えることです。本物はサーバーにあります。楽観的更新とは、そのコピーを一時的に先回りさせているだけで、新しい種類のデータが生まれたわけではありません。

この見方をすると、失敗時のロールバックが自明に正しくなります。コピーを捨てるだけで、本物は何も失われていないからです。もし楽観値が本物だったら、ロールバックは「データを消す操作」という怖い話になります。

ただし、コピーに加える「+1する」という操作自体はロジックです。楽観的更新の本質は**サーバーの計算結果を予測すること**であり、予測するにはサーバーと同じルールを知っている必要があります。つまり放っておくと、ルールがクライアントとサーバーの二箇所に複製されます。

なのでルールは関数として切り出し、キャッシュ操作はそれを呼ぶだけにします。

```ts
// features/post/like.ts — ルールの本体。React もキャッシュも知らない
export function applyLike(post: Post): Post {
  return { ...post, liked: true, likeCount: post.likeCount + 1 }
}
```

```ts
// features/post/api.ts
export function useLike(postId: string) {
  const qc = useQueryClient()
  const key = ['post', postId]

  return useMutation({
    mutationFn: () => api.posts[':id'].like.$post({ param: { id: postId } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Post>(key)
      qc.setQueryData<Post>(key, (prev) => prev && applyLike(prev))
      return { previous }
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
```

画面側はボタンを置くだけです。

```tsx
const like = useLike(post.id)

return <button onClick={() => like.mutate()}>いいね {post.likeCount}</button>
```

このフックは React に依存していますが、中身は通信とキャッシュ操作だけで、表示の都合は入っていません。ルールの本体は `applyLike` という純粋な関数で、フックはその配線です。

**データは画面側が持ち、ルールはロジック側から借りる。** バリデーションも楽観的更新も、この一つの形に収まります。二つの違う問題が同じ解になるということは、この分け方が偶然ではないということでもあります。

## 落とし穴：先回りした値を放置しない

楽観的更新の理屈は「コピーを先回りさせ、成功したらサーバーの本物で置き換える」です。この最後の一歩が実装ではよく抜けます。

- `onSettled` での再検証を書き忘れる
- ミューテーションのレスポンスを使わず、楽観値をそのまま残す

こうなると、そのデータは**一度も本物で裏付けられていない値**のまま画面に残り続けます。もうコピーではなく、クライアントが勝手に作った真実です。ここから先、画面とサーバーの食い違いは誰にも検知されません。

つまり「コピーにすぎない」という整理は、無条件に成り立つわけではなく、規律とセットです。

> 先回りして書き換えた値は、成功時に必ずサーバーの値で置き換える。予測値を最終状態として残さない。

## 境界を物理的に強制する

ここまでの分離は、意識していないと簡単に崩れます。画面のファイルの中でデータ取得もロジックも書けてしまう以上、**越えても何も起きない**からです。何も起きない境界は、そのうち見えなくなります。

この点で参考になるのが、サーバー側が画面に渡すデータを組み立てて `props` として送り込む方式です。[Inertia.js](https://inertiajs.com/) がこの形で、Hono なら [`@hono/inertia`](https://github.com/honojs/middleware/tree/main/packages/inertia) で書けます。

```ts
// サーバー側が、この画面に必要なデータを決めて渡す
app.get('/users', async (c) => {
  const users = await listUsers()
  return c.render('Users/Index', { users })
})
```

```jsx
// 画面側は受け取って描くだけ。取りに行く手段がない
export default function Index({ users }) {
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}
```

この構成では、

- クライアントからデータを取りに行く処理が存在しない
- 表示に必要なデータは必ずサーバーが決めた形で降ってくる
- 「サーバーのデータ」と「画面が持つ状態」が別物として物理的に分かれる

境界がネットワークによって強制されるので、混ぜようとしても混ざりません。この構成を一度経験すると、通常のSPAでも同じ線がどこにあるかが見えるようになります。

これは設計の話でよく起きる現象だと思います。パッケージを分けて初めて依存の汚さが見える、別サービスに切り出して初めて責務の曖昧さが見える。**強制された制約が、もともとあった構造を発見させる**というパターンです。境界は最初からそこにあって、越えられなかったから見えただけ、ということです。

## まとめ

1. UIツールは状態を預かる実行環境でもあるので、放っておくとロジックが画面に吸い寄せられる
2. 仕分けの基準は「表示に関わるか」ではなく「画面と一緒に消えていいか」
3. 境界は型が変わる瞬間に置くと、規約ではなくコンパイラが守ってくれる
4. 迷ったら「データは画面側、ルールはロジック側」に当てはめる
5. 予測して書き換えた値は、必ず本物で置き換える
6. 境界が物理的に強制される構成を一度経験すると、線が見えるようになる

「React はUIライブラリか」という問いには答えが出ませんでしたが、その問いを経由して「UIツールの管轄はどこで終わるか」を言葉にできました。使えるのは後者だけです。ラベルは、その境界の代理でしかありません。

## 参考

- [React 公式トップページ](https://ja.react.dev/)
- [useState – React](https://react.dev/reference/react/useState)
- [You Might Not Need an Effect – React](https://react.dev/learn/you-might-not-need-an-effect)
- [Keeping Components Pure – React](https://react.dev/learn/keeping-components-pure)
- [Reactivity Fundamentals – Vue.js](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Optimistic Updates – TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Inertia.js](https://inertiajs.com/)
