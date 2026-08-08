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

## 文中のリンク

文の途中にある [Astro のドキュメント](https://docs.astro.build) は、そのまま普通のリンクとして残ります。
自分で文言を付けた場合も同じで、[こう書けば](https://github.com/ashunar0/hisui) カードになりません。

## 取得に失敗する URL

繋がらない先はカードにせず、ただのリンクとして残します。

https://this-domain-does-not-exist-ashunar0.example
