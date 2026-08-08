---
title: Python の開発環境構築
description: Python を入れて、仮想環境とパッケージ管理まで含めて開発を始められる状態にするまでの手順。
pubDate: 2025-12-14
tags: [Python, 環境構築]
draft: false
---

## この記事について

この記事では、**uv** という道具を使って Python の開発環境を作ります。

### インストールするもの

| 道具 | 役割                                          |
| ---- | --------------------------------------------- |
| uv   | Python 本体とライブラリをまとめて管理する道具 |

入れるのは uv だけです。**Python 本体を先に用意する必要はありません。** uv が必要な Python を自動でダウンロードして使ってくれます。

Python の環境構築では、これまで「Python 本体を入れる」「バージョンを切り替える道具を入れる」「プロジェクトごとに仮想環境を作る」といった手順が別々に必要でした。uv はこれらをまとめて引き受けます。

### 前提

Mac では Homebrew、Windows では winget を使います。エディタは VSCode を想定しています。まだの場合は先に済ませてください。

Mac に最初から入っている Python は、macOS 自身が使うためのものです。これには手を触れず、uv が用意する Python を使います。

https://ashunar0.dev/posts/windows-dev-setup/

https://ashunar0.dev/posts/mac-dev-setup/

### 所要時間

10 分程度です。

## 1. uv を入れる

ここだけ Mac と Windows で手順が分かれます。自分の環境の方だけ実行してください。

#### Mac の場合

```bash
brew install uv
```

#### Windows の場合

```powershell
winget install --id astral-sh.uv -e
```

### 入ったか確認する

インストールが終わったら、**ターミナル（PowerShell）を一度閉じて開き直してください。**

新しく開いた画面で以下を実行します。

```bash
uv --version
```

`uv 0.x.x` のように表示されれば完了です。

### うまくいかなかった場合

パッケージマネージャからのインストールが失敗する場合は、公式のインストールスクリプトを使う方法もあります。

Mac の場合。

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Windows の場合。

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

終わったらターミナル（PowerShell）を開き直して、もう一度 `uv --version` で確認します。

## 2. Python を動かしてみる（任意）

uv が入ったので、実際に Python を動かしてみます。この手順は飛ばしても問題ありません。

作業用のフォルダを作って、プロジェクトとして初期化します。

```bash
mkdir py-test
cd py-test
uv init
```

フォルダの中に、いくつかのファイルが作られます。

```
main.py           実行される Python ファイル
pyproject.toml    このプロジェクトの設定と、使うライブラリの一覧
.python-version   使う Python のバージョン
```

`main.py` を実行します。

```bash
uv run main.py
```

初回は次のような表示が出ます。

```
Installed Python 3.14.x
Using CPython 3.14.x
Creating virtual environment at: .venv
Hello from py-test!
```

最後に `Hello from py-test!` と表示されれば成功です。

ここで起きていることが 2 つあります。

まず、**Python 本体が自動でダウンロードされました。** 事前に Python を入れていなくても動くのはこのためです。一度落とせば次回以降は再利用されるので、この待ち時間は初回だけです。

もう 1 つ、`.venv` というフォルダが作られました。これは**このプロジェクト専用の Python 環境**です。ライブラリはここに入るので、別のプロジェクトに影響しません。

> `uv run` を使うかぎり、この `.venv` は自動的に使われます。仮想環境を手動で有効にする操作（`source .venv/bin/activate` など）は不要です。
