---
title: Python の学習を始めるための環境構築
description: Mac の Homebrew / Windows の winget から始めて、VSCode と uv を入れ、Python のファイルを書いて実行するところまでを 1 本にまとめた手順。拡張機能と settings.json の設定、動作確認まで扱う。
pubDate: 2025-12-30
tags: [Python, VSCode, 環境構築]
draft: false
---

## この記事について

この記事では、Python の学習を始めるための環境を作ります。エディタで Python のファイルを書き、その場で実行できる状態がゴールです。

Mac と Windows の両方を扱います。手順が分かれるのはインストールのコマンドだけで、それ以外は共通です。

### インストールするもの

| 道具                | 役割                                            |
| ------------------- | ----------------------------------------------- |
| Homebrew / winget   | ソフトをコマンドでインストールするための仕組み  |
| VSCode              | コードを書くためのエディタ                      |
| uv                  | Python 本体とライブラリをまとめて管理する道具    |

**Python 本体を先に用意する必要はありません。** uv が必要な Python を自動でダウンロードして使ってくれます。

Python の環境構築では、これまで「Python 本体を入れる」「バージョンを切り替える道具を入れる」「プロジェクトごとに仮想環境を作る」といった手順が別々に必要でした。uv はこれらをまとめて引き受けます。

Mac に最初から入っている Python は、macOS 自身が使うためのものです。これには手を触れず、uv が用意する Python を使います。

### 前提

- インターネットに接続できること
- Mac の場合、ログインパスワードが分かること（インストール中に入力を求められます）

### 所要時間

30 分程度です。Homebrew のインストールに時間がかかるため、ダウンロード速度によって差が出ます。

### ターミナルの開き方

この記事の作業はほとんどターミナルで行います。

**Mac の場合**

- `Command + Space` を押して「ターミナル」と入力し、Enter
- または Finder →「アプリケーション」→「ユーティリティ」→「ターミナル」

**Windows の場合**

- `Windows キー + X` を押して、表示されたメニューから「ターミナル」（Windows 10 では「Windows PowerShell」）を選ぶ
- またはスタートボタンを押して「PowerShell」と入力し、Enter

ウィンドウが開き、文字を入力できる状態になれば準備完了です。以降、「以下を実行します」と書かれたコマンドは、このウィンドウに貼り付けて Enter を押してください。

> Windows での貼り付けは `Ctrl + V` でできます。うまくいかない場合はウィンドウ内で右クリックしても貼り付けられます。

## 1. パッケージマネージャを用意する

パッケージマネージャは、ソフトをコマンドでインストールするための仕組みです。これから入れる VSCode も uv もこれを経由して入れるので、最初に用意します。

自分の環境の方だけ実行してください。

### Mac の場合（Homebrew）

まず、すでに入っているか確認します。

```bash
brew --version
```

- `Homebrew 4.x.x` のように表示された → すでに入っています。「2. VSCode を入れる」へ進んでください
- `zsh: command not found: brew` と表示された → 次に進んでインストールします

以下を実行します。

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

途中で Mac のログインパスワードを求められます。**入力しても画面には何も表示されません**が、キー入力は受け付けられています。そのまま入力して Enter を押してください。

`Press RETURN/ENTER to continue` と表示されたら、Enter を押すと処理が進みます。

インストールには 5 〜 20 分ほどかかります。Homebrew 本体だけでなく、Apple のコマンドライン・デベロッパツール（Command Line Tools）も一緒にダウンロードされるためです。途中で長時間止まっているように見えても、ダウンロードが進んでいるだけなので終了させずに待ってください。

#### PATH を通す

インストールが終わると、最後に `==> Next steps:` という見出しの下に次のような表示が出ることがあります。

```
==> Next steps:
- Run these commands in your terminal to add Homebrew to your PATH:
    echo >> /Users/あなたのユーザー名/.zprofile
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> /Users/あなたのユーザー名/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
```

これは、Homebrew を入れた場所をターミナルに教えるための設定です。この設定をしないと、次にターミナルを開いたときに `brew` コマンドが見つからない状態になります。

`echo` で始まる 2 行と `eval` で始まる 1 行、**合計 3 行**をコピーして実行してください。先頭の `==>` の行と `- Run these commands...` の行は説明文なので、コピーする必要はありません。

この表示が出なかった場合は、すでに PATH が通っているのでこの手順はスキップして構いません。

#### 動作確認

**ターミナルを一度閉じて、開き直してください。** 設定を反映させるために必要です。

新しく開いたターミナルで、もう一度確認します。

```bash
brew --version
```

`Homebrew 4.x.x` のようにバージョンが表示されれば完了です。

### Windows の場合（winget）

winget は Windows 11、および比較的新しい Windows 10 には最初から入っているので、インストールは不要です。使える状態かどうかだけ確認します。

```powershell
winget --version
```

`v1.x.x` のようにバージョンが表示されれば、この手順は完了です。

#### 使えなかった場合

次のようなメッセージが表示されることがあります。

```
winget : 用語 'winget' は、コマンドレット、関数、スクリプト ファイル、
または操作可能なプログラムの名前として認識されません。
```

この場合は、winget の本体である「アプリ インストーラー」を入れます。次のページを開いて「入手」を押してください（すでに入っている場合は「更新」と表示されます）。

<https://apps.microsoft.com/detail/9nblggh4nns1>

インストールが終わったら **PowerShell を一度閉じて開き直し**、もう一度 `winget --version` で確認します。

それでも表示されない場合は、Windows のバージョンが古い可能性があります。「設定」→「Windows Update」から更新してください。

## 2. VSCode を入れる

VSCode（Visual Studio Code）は、コードを書くためのエディタです。

#### Mac の場合

```bash
brew install --cask visual-studio-code
```

#### Windows の場合

```powershell
winget install --id Microsoft.VisualStudioCode -e
```

### 入ったか確認する

インストールが終わったら、**ターミナル（PowerShell）を一度閉じて開き直してください。**

新しく開いた画面で以下を実行します。

```bash
code
```

アプリケーションが立ち上がれば成功です。

`command not found`（Windows では「用語 'code' は…認識されません」）と表示された場合は、まだ開き直せていない可能性があります。もう一度閉じて開き直してから試してください。

### うまくいかなかった場合

パッケージマネージャからのインストールが失敗する場合は、公式サイトからインストーラをダウンロードする方法もあります。

<https://code.visualstudio.com/>

## 3. 拡張機能を入れる

VSCode は、拡張機能を入れることで機能を追加していく作りになっています。Python を書くために必要なものを 4 つ入れます。

```bash
code --install-extension ms-ceintl.vscode-language-pack-ja
code --install-extension pkief.material-icon-theme
code --install-extension ms-python.python
code --install-extension charliermarsh.ruff
```

| 拡張機能               | 何をするもの                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| Japanese Language Pack | メニューなどの表示を日本語にします                               |
| Material Icon Theme    | ファイルの種類ごとにアイコンが変わり、一覧が見分けやすくなります |
| Python                 | 補完・エラー表示・実行ボタンなど、Python を書くための機能一式    |
| Ruff                   | コードの改行やインデントを自動で整え、書き方の問題を指摘します   |

入れ終わったら、**VSCode を一度閉じて開き直してください。** メニューが日本語に変われば反映されています。

入ったか確認します。

```bash
code --list-extensions
```

次の 4 つが並んでいれば完了です（順番は違っていても構いません）。

```
charliermarsh.ruff
ms-ceintl.vscode-language-pack-ja
ms-python.python
pkief.material-icon-theme
```

> 拡張機能はあとからいくらでも追加できます。VSCode の左側にある四角が 4 つ並んだアイコンを押すと検索画面が開くので、そこから探して入れることもできます。

## 4. 設定を入れる

VSCode は `settings.json` というファイルに設定を記述することで、自分好みにカスタマイズできます。内容はよく分からなくても構いません。とりあえずこれを入れておけば損はないでしょう。

### 設定ファイルを開く

上部メニューから開きます。

1. 「表示」→「コマンド パレット」を選ぶ
2. `settings json` と入力する
3. 「**基本設定: ユーザー設定を開く (JSON)**」を選ぶ

`settings.json` が開きます。

### 設定を書く

開いたファイルに、次の内容を書きます。

```json
{
  "workbench.iconTheme": "material-icon-theme",
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "editor.renderWhitespace": "boundary",
  "explorer.compactFolders": false,
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit"
    }
  }
}
```

すでに何か書かれている場合は、いちばん外側の `{` と `}` の内側に追加してください。各行の最後にカンマ `,` が必要になる点にだけ注意してください（いちばん最後の行は不要です）。

`[python]` で囲まれた部分は、Python のファイルを開いているときだけ効く設定です。保存するたびに Ruff がコードの見た目を整え、`import` の並び順をそろえてくれます。

書けたら保存します（Mac は `Command + S`、Windows は `Ctrl + S`）。

## 5. uv を入れる

uv は、Python 本体とライブラリをまとめて管理する道具です。

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

## 6. Python を動かしてみる

道具はそろったので、実際に動かして確かめます。

### プロジェクトを作る

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

### 実行する

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

## 7. VSCode で開いて編集する

ここまではターミナルだけで進めました。最後に、同じプロジェクトを VSCode で開きます。

### フォルダを開く

`py-test` フォルダにいる状態で、以下を実行します。

```bash
code .
```

`code .` の `.` は「いまいる場所」という意味です。これから開発するときも、プロジェクトのフォルダに `cd` してから `code .` を実行するのが基本の流れになります。

VSCode が起動して、左側に `py-test` フォルダの中身が表示されます。

### 使う Python を選ぶ

`main.py` をクリックして開いてください。右下に、使っている Python のバージョンが表示されます。

`.venv` と書かれていれば、先ほど uv が作った環境が選ばれています。そうなっていない場合は、次の手順で切り替えます。

1. 「表示」→「コマンド パレット」を選ぶ
2. `Python: Select Interpreter` と入力して選ぶ
3. 一覧から `.venv` と書かれたものを選ぶ

この選択がずれていると、ライブラリを入れたのに「見つからない」と言われる、という現象が起きます。うまく動かないときは、まずここを確認してください。

### VSCode の中でターミナルを開く

VSCode の中でターミナルを開けます。上部メニューの「ターミナル」→「新しいターミナル」を選んでください。

画面の下半分にターミナルが開きます。このターミナルは **いま開いているフォルダの場所で開く** ので、`cd` で移動する必要がありません。

ここで、もう一度実行してみます。

```bash
uv run main.py
```

`Hello from py-test!` と表示されれば、エディタとターミナルを 1 つのウィンドウで扱える状態になりました。以降、「ターミナルで以下を実行します」と出てきたときは、ここで実行すると楽です。

### 書き換えて確かめる

`main.py` の中身を書き換えて、保存してから実行してみてください。

```python
def main():
    print("Hello from py-test!")
    print("環境構築が終わりました")


if __name__ == "__main__":
    main()
```

保存した瞬間、インデントや空行が自動で整えられます。これが手順 4 で入れた Ruff の設定です。

```bash
uv run main.py
```

書き換えた内容が表示されれば完了です。

## セットアップの最終確認

すべて終わったら、最後に改めて確認します。ターミナル（PowerShell）を新しく開いて、次を 1 行ずつ実行してください。

```bash
code --version
code --list-extensions
uv --version
```

| コマンド                | 期待される表示                      | 違ったときに戻る手順 |
| ----------------------- | ----------------------------------- | -------------------- |
| `code --version`        | `1.x.x` から始まる 3 行             | 2                    |
| `code --list-extensions`| 拡張機能の ID が 4 つ並ぶ           | 3                    |
| `uv --version`          | `uv 0.x.x`                          | 5                    |

`command not found`（Windows では「用語 '○○' は…認識されません」）と表示された項目があれば、その道具がまだ入っていないか、ターミナルに反映されていません。**ターミナルを一度閉じて開き直してから**、もう一度確認してください。それでも表示されない場合は、右端の番号の手順に戻ってください。

すべて通っていれば、Python を書き始められる状態です。

## 参考

- uv 公式ドキュメント <https://docs.astral.sh/uv/>
- Ruff 公式ドキュメント <https://docs.astral.sh/ruff/>
- Visual Studio Code <https://code.visualstudio.com/>
