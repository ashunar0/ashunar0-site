---
title: リンクカードの動作確認
description: 段落に URL だけを置いたときの見え方を確かめるための記事。公開しない。
pubDate: 2026-08-08
tags: [検証]
draft: true
---

## 単独の URL

段落に URL だけを置くと、カードになります。

https://github.com/ashunar0/hisui

https://docs.astro.build/en/guides/content-collections/

https://zenn.dev/

## 記事を埋め込む

Zenn の記事。

https://zenn.dev/ashunar0/articles/1ba94a110d8622

同じサイトの別記事。

https://ashunar0.dev/posts/mac-dev-setup/

## X の投稿

投稿の URL は、カードではなく埋め込みになります。

https://x.com/yusukebe/status/2049020835516854392?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E2049020835516854392%7Ctwgr%5E18c93877b1331d467c139959629820ceb0d27527%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fembed.zenn.studio%2Ftweetzenn-embedded__ee371124ffa2a

同じ x.com でも、投稿以外はカードのままです。

https://x.com/astrodotbuild

## 文中のリンク

文の途中にある [Astro のドキュメント](https://docs.astro.build) は、そのまま普通のリンクとして残ります。
自分で文言を付けた場合も同じで、[こう書けば](https://github.com/ashunar0/hisui) カードになりません。

## 取得に失敗する URL

繋がらない先はカードにせず、ただのリンクとして残します。

https://this-domain-does-not-exist-ashunar0.example
