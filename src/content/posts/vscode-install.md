---
title: VSCode をセットアップして開発を始められる状態にする
description: VSCode を入れて日本語化し、拡張機能と設定を整えてエディタの中でターミナルまで開けるようにする手順。Mac と Windows の両方を扱う。
pubDate: 2025-12-12
tags: [VSCode, 環境構築]
draft: false
---

## この記事について

この記事では、コードを書くためのエディタ「Visual Studio Code」（以下 VSCode）をセットアップします。日本語で使えて、フォルダを開いてファイルを編集でき、エディタの中でコマンドも実行できる状態にします。

VSCode はどの言語で開発する場合でも使えるので、Python でも Ruby でもこの記事の内容はそのまま使えます。

Mac と Windows の両方を扱いますが、手順が分かれるのは「1. VSCode を入れる」だけです。それ以降は共通です。

### 前提

インストールに Mac では Homebrew、Windows では winget を使います。まだ用意していない場合は、こちらの記事を参考にしてください。

https://qiita.com/Ashunar0/items/cab94e1a12cb7bf9cfec

https://qiita.com/Ashunar0/items/feba3b3a09f36cec4845

使わずに進めたい場合は、公式サイトからインストーラをダウンロードする方法もあります。

<https://code.visualstudio.com/>

### 所要時間

10 分程度です。

## 1. VSCode を入れる

ここだけ Mac と Windows で手順が分かれます。自分の環境の方だけ実行してください。

#### Mac の場合

ターミナルで以下を実行します。

```bash
brew install --cask visual-studio-code
```

#### Windows の場合

PowerShell で以下を実行します。

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

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/2109f2fd-419c-4a27-812d-a103ca0f246d.png)

`command not found`（Windows では「用語 'code' は…認識されません」）と表示された場合は、まだ開き直せていない可能性があります。もう一度閉じて開き直してから試してください。

## 2. 拡張機能を入れる

VSCode は、拡張機能を入れることで機能を追加していく作りになっています。最初に入れておくとよいものを 3 つ入れます。

```bash
code --install-extension ms-ceintl.vscode-language-pack-ja
code --install-extension pkief.material-icon-theme
code --install-extension esbenp.prettier-vscode
```

| 拡張機能               | 何をするもの                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| Japanese Language Pack | メニューなどの表示を日本語にします                               |
| Material Icon Theme    | ファイルの種類ごとにアイコンが変わり、一覧が見分けやすくなります |
| Prettier               | コードの改行やインデントを自動で整えてくれます                   |

入れ終わったら、**VSCode を一度閉じて開き直してください。** メニューが日本語に変われば反映されています。

入ったか確認します。

```bash
code --list-extensions
```

次の 3 つが並んでいれば完了です。

```
esbenp.prettier-vscode
ms-ceintl.vscode-language-pack-ja
pkief.material-icon-theme
```

VSCodeを立ち上げ直すと、表示が日本語になっているのが確認できるかと思います。

> 拡張機能はあとからいくらでも追加できます。VSCode の左側にある四角が 4 つ並んだアイコンを押すと検索画面が開くので、そこから探して入れることもできます。

## 3. 設定を入れる

VSCode は `settings.json` というファイルに設定を記述することで、自分好みに細かくカスタマイズすることができます。内容はよく分からなくても構いません。とりあえずこれを入れておけば損はないでしょう。

### 設定ファイルを開く

`settings.json` というファイルに書きます。上部メニューから開きます。

1. 「表示」→「コマンド パレット」を選ぶ
2. `settings json` と入力する
3. 「**基本設定: ユーザー設定を開く (JSON)**」を選ぶ

`settings.json` が開きます。

### 設定を書く

開いたファイルに、次の内容を書きます。

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "workbench.iconTheme": "material-icon-theme",
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "editor.renderWhitespace": "boundary",
  "explorer.compactFolders": false
}
```

すでに何か書かれている場合は、いちばん外側の `{` と `}` の内側に追加してください。各行の最後にカンマ `,` が必要になる点にだけ注意してください（いちばん最後の行は不要です）。

書けたら保存します（Mac は `Command + S`、Windows は `Ctrl + S`）。

## 4. 基本の使い方

インストールはここまでで終わりです。いちおう、最低限の使い方だけ確認しておきます。

### フォルダを開く

VSCode は「フォルダを開いて、その中のファイルを編集する」という使い方をします。ファイル 1 つだけを開くこともできますが、開発では基本的にフォルダごと開きます。

練習用に `hello` というフォルダを作って開いてみます。

```bash
mkdir hello
cd hello
code .
```

`code .` の `.` は「いまいる場所」という意味です。これから開発するときも、プロジェクトのフォルダに `cd` してから `code .` を実行するのが基本の流れになります。

VSCode が起動して、左側に `hello` フォルダの中身が表示されます。まだ何も入っていないので空です。

### ファイルを作成・保存する

左側の一覧（エクスプローラー）でフォルダ名にマウスを合わせると、アイコンがいくつか表示されます。一番左の「新しいファイル」を押してファイル名を入力すると、ファイルが作られます。

編集した内容を保存するショートカットは次のとおりです。

- Mac … `Command + S`
- Windows … `Ctrl + S`

保存されていないファイルは、上部のタブでファイル名の横に `●` が表示されます。これが `×` に変われば保存済みです。

### VSCode の中でターミナルを開く

VSCode の中でターミナルを開けます。上部メニューの「ターミナル」→「新しいターミナル」を選んでください。

画面の下半分にターミナルが開きます。このターミナルは **いま開いているフォルダの場所で開く** ので、`cd` で移動する必要がありません。

エディタとターミナルを 1 つのウィンドウで扱えるようになるので、以降の記事で「ターミナルで以下を実行します」と出てきたときは、ここで実行すると楽です。

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/15dcbd49-c54b-4ad9-82e7-da8b8d5b99dd.png)
