---
title: Mac でプログラミングを始めるための環境構築
description: Mac に Homebrew・Git・GitHub CLI を入れて、開発を始められる状態にするまでの手順。
pubDate: 2025-12-08
tags: [Mac, 環境構築]
draft: false
---

## この記事について

この記事では、Mac で開発を始めるための土台として、Homebrew・Git・GitHub をセットアップします。仮に内容が分からなかったとしても、一度このセットアップができてしまえば、どの言語で開発するにしてもスムーズに走り出せるようになります。

### インストールするもの

| 道具               | 役割                                                 |
| ------------------ | ---------------------------------------------------- |
| Homebrew           | Mac にソフトをコマンドでインストールするための仕組み |
| Git                | コードの変更履歴を手元に記録するツール               |
| GitHub             | 記録したコードをインターネット上に保管・公開する場所 |
| GitHub CLI（`gh`） | 手元の Git と GitHub をつなぐ道具                    |

Git と GitHub は名前が似ていますが別物です。**Git は手元で履歴を記録するツール**、**GitHub はその履歴を置いておくインターネット上の場所**、と考えると分かりやすいです。

### 前提

- macOS（Apple Silicon / Intel どちらでも可）
- インターネットに接続できること
- Mac のログインパスワードが分かること（インストール中に入力を求められます）

### 所要時間

15分~30分程度です。Homebrew のインストールとコマンドライン・デベロッパツールのインストールに時間がかかるため、ダウンロード速度によって差が出ます。

### ターミナルの開き方

この記事の作業はほとんどターミナルで行います。開き方は 2 通りあります。

- `Command + Space` を押して「ターミナル」と入力し、Enter
- Finder →「アプリケーション」→「ユーティリティ」→「ターミナル」

黒い（または白い）ウィンドウが開き、文字を入力できる状態になれば準備完了です。以降、「以下を実行します」と書かれたコマンドは、このウィンドウに貼り付けて Enter を押してください。

## 1. Homebrew を入れる

Homebrew は、Mac にソフトをコマンドでインストールするための仕組みです。この記事で入れる Git も GitHub CLI も Homebrew 経由で入れるので、最初にこれを用意します。

### すでに入っているか確認する

Mac を買ってすぐの状態でも、以前に何か開発ツールを入れたことがあれば Homebrew が入っている場合があります。まず確認します。

```bash
brew --version
```

- `Homebrew 4.x.x` のように表示された → すでに入っています。「2. Git を入れる」へ進んでください
- `zsh: command not found: brew` と表示された → 次に進んでインストールします

### インストールする

以下を実行します。

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

途中で Mac のログインパスワードを求められます。**入力しても画面には何も表示されません**が、キー入力は受け付けられています。そのまま入力して Enter を押してください。

`Press RETURN/ENTER to continue` と表示されたら、Enter を押すと処理が進みます。

インストールには 5 〜 20 分ほどかかります。Homebrew 本体だけでなく、Apple のコマンドライン・デベロッパツール（Command Line Tools）も一緒にダウンロードされるためです。途中で長時間止まっているように見えても、ダウンロードが進んでいるだけなので終了させずに待ってください。

### PATH を通す

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

### 動作確認

**ターミナルを一度閉じて、開き直してください。** 設定を反映させるために必要です。

新しく開いたターミナルで、もう一度確認します。

```bash
brew --version
```

`Homebrew 4.x.x` のようにバージョンが表示されれば完了です。

## 2. Git を入れる

Git は、コードの変更履歴を手元に記録するツールです。

### すでに入っているか確認する

Mac には Git が最初から入っていることが多く、さらに前の手順で Homebrew を入れた際に Command Line Tools も一緒に入っているため、この時点ですでに使える状態になっている可能性が高いです。まず確認します。

```bash
git --version
```

`git version 2.x.x` のように表示されれば、それで問題ありません。次の手順へ進んでください。

### 入っていなかった場合

`command not found` と表示された場合や、「"git" コマンドを実行するには開発者ツールが必要です」というダイアログが出た場合は、Homebrew で入れます。

```bash
brew install git
```

インストールが終わったら**ターミナルを一度閉じて開き直し**、もう一度 `git --version` で確認してください。

> ダイアログが出た場合は「インストール」を押して Apple のツールを入れる方法もありますが、どちらか一方で構いません。

### 初期設定について

Git には「誰がこの変更を記録したか」を残すための名前とメールアドレスの設定があります。ただしこのメールアドレスは GitHub に登録するものと揃える必要があるため、**GitHub アカウントを作ったあとに設定します**。

先に設定してしまうと後から直すことになるので、ここでは飛ばして次に進んでください。

## 3. GitHub アカウントを作る

GitHub は、Git で記録したコードをインターネット上に保管・公開する場所です。個人利用の範囲では無料で使えます。

ブラウザで <https://github.com/signup> を開いてください。

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/2384d91c-fe2e-4ce3-89b3-f24b74eb0b66.png)

登録方法は 2 通りあります。どちらでも構いません。

#### Google アカウントで登録する

「**Continue with Google**」を押し、使いたい Google アカウントを選択します。パスワードを別途決める必要がないぶん手間が少ない方法です。

そのあと GitHub 上のユーザー名を決める画面になります。

#### メールアドレスとパスワードで登録する

メールアドレス・パスワード・ユーザー名を順に入力していきます。

登録したメールアドレス宛に認証コードが届くので、画面の指示に従って入力すれば完了です。

### ユーザー名の決め方

どちらの方法でもユーザー名を決める必要があります。使えるのは半角英数字とハイフンです。

このユーザー名は、あとで作るリポジトリの URL にそのまま入ります。

```
https://github.com/ユーザー名/リポジトリ名
```

作ったものを人に見せるときに使う URL なので、そのつもりで決めてください。あとから変更もできますが、変更すると以前の URL でアクセスできなくなります。

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/42be9b62-fd18-45c1-9618-a35c486b33f3.png)

登録が終わるとログインした状態になります。これで GitHub 側の準備は完了です。

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/63036ad2-83aa-4267-83d9-26f381ab4eb1.png)

> 登録画面の項目や順序は変わることがあります。細かい表示がこの記事と違っていても、メールアドレス・パスワード・ユーザー名を登録してメール認証を通せば完了です。プランを選ぶ画面が出た場合は無料プラン（Free）を選んでください。

## 4. Git の初期設定

手順 2 で飛ばした Git の初期設定をします。設定するのは 3 つです。

### 名前とメールアドレス

Git は変更を記録するとき、「誰が記録したか」を一緒に残します。そのための名前とメールアドレスを設定します。

**メールアドレスは、GitHub に登録したものと同じにしてください。** 一致していると、GitHub 上でその記録が自分のアカウントのものとして表示されます。違うアドレスにすると、自分で記録したものが他人の記録のように扱われます。

```bash
git config --global user.name "自分の名前"
git config --global user.email "GitHubに登録したメールアドレス"
```

（例）

```bash
git config --global user.name "Sato Taro"
git config --global user.email "satotaro@example.com"
```

名前は本名でもハンドルネームでも構いません。記録に残る表示名になります。

### デフォルトのブランチ名

これは必須ではありませんが、一応やっておくといいでしょう。

```bash
git config --global init.defaultBranch main
```

Git で新しくプロジェクトを作ると、`master` という名前の場所にコードが記録されます。ただし GitHub 側は `main` を標準としているため、揃えておかないと後で名前の食い違いが起きます。この設定で、最初から `main` が使われるようになります。今はわからなくても大丈夫です。

### 設定できたか確認する

設定しても画面には何も表示されないので、読み出して確認します。

```bash
git config --global --list
```

次のように、設定した内容が一覧で表示されれば完了です。

```
user.name=Sato Taro
user.email=satotaro@example.com
init.defaultbranch=main
```

設定した項目が表示されない場合は設定できていないので、もう一度実行してください。

## 5. GitHub CLI でログイン

ここまでで、手元の Git と GitHub のアカウントはそれぞれ用意できました。最後に、この 2 つをつなぎます。

つなぐというのは、手元のコードを GitHub に送るときに「これは自分だ」と証明できる状態にすることです。これには昔から SSH 鍵を作る方法がありますが、鍵の生成と登録で手順が増えます。GitHub CLI（`gh`）を使うと、ブラウザでログインするだけで同じことができます。

### インストールする

```bash
brew install gh
```

動作確認します。

```bash
gh --version
```

`gh version 2.x.x` のように表示されれば完了です。

### ログインする

```bash
gh auth login
```

いくつか質問されるので、矢印キーで選んで Enter で決定します。

| 質問                                                  | 選ぶもの                     |
| ----------------------------------------------------- | ---------------------------- |
| `Where do you use GitHub?`                            | **GitHub.com**               |
| `What is your preferred protocol for Git operations?` | **HTTPS**                    |
| `Authenticate Git with your GitHub credentials?`      | **Yes**                      |
| `How would you like to authenticate GitHub CLI?`      | **Login with a web browser** |

3 つめの `Authenticate Git with your GitHub credentials?` で **Yes** を選ぶのが重要です。ここで Yes にすると、以降 `git push` するたびにパスワードを聞かれることがなくなります。

選び終わると、次のような 8 桁のコードが表示されます。

```
! First copy your one-time code: A1B2-C3D4
Press Enter to open github.com in your browser...
```

コードをコピーしてから Enter を押すと、ブラウザが開きます。コードを貼り付けて、続けて表示される画面で許可すればログイン完了です。

ターミナルに戻って、次のように表示されていれば成功です。

```
✓ Logged in as あなたのユーザー名
```

### ログインできているか確認する

あとから確認したくなったときは、次のコマンドで状態を見られます。

```bash
gh auth status
```

## セットアップの最終確認

すべて終わったら、最後に改めて確認してみましょう。ターミナルを新しく開いて、次の 5 つを 1 行ずつ実行してください。

```bash
brew --version
git --version
git config --global --list
gh --version
gh auth status
```

それぞれ、次のように表示されていれば完了です。

| コマンド                     | 期待される表示                                              | 違ったときに戻る手順 |
| ---------------------------- | ----------------------------------------------------------- | -------------------- |
| `brew --version`             | `Homebrew 4.x.x`                                            | 1                    |
| `git --version`              | `git version 2.x.x`                                         | 2                    |
| `git config --global --list` | `user.name` `user.email` `init.defaultbranch` の 3 つが並ぶ | 4                    |
| `gh --version`               | `gh version 2.x.x`                                          | 5                    |
| `gh auth status`             | `✓ Logged in to github.com account ...`                     | 5                    |

`command not found` と表示された項目があれば、その道具がまだ入っていないか、ターミナルに反映されていません。**ターミナルを一度閉じて開き直してから**、もう一度確認してください。それでも表示されない場合は、右端の番号の手順に戻ってください。

ここまで 5 つとも通っていれば、土台は完成です。
