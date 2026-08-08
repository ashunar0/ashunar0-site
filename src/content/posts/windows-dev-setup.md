---
title: Windows でプログラミングを始めるための環境構築
description: Windows に開発環境を用意したときの手順と、詰まったところの記録。
pubDate: 2025-12-08
tags: [Windows, 環境構築]
draft: false
---

## この記事について

この記事では、Windows で開発を始めるための土台として、Git と GitHub をセットアップします。仮に内容が分からなかったとしても、一度このセットアップができてしまえば、どの言語で開発するにしてもスムーズに走り出せるようになります。

作業はすべて PowerShell の中で行います。WSL（Windows の中で Linux を動かす仕組み）は使いません。

### インストールするもの

| 道具               | 役割                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| winget             | Windows にソフトをコマンドでインストールするための仕組み（最初から入っています） |
| Git                | コードの変更履歴を手元に記録するツール                                           |
| GitHub             | 記録したコードをインターネット上に保管・公開する場所                             |
| GitHub CLI（`gh`） | GitHub 上のリポジトリをコマンドから作れるようにする道具                          |

Git と GitHub は名前が似ていますが別物です。**Git は手元で履歴を記録するツール**、**GitHub はその履歴を置いておくインターネット上の場所**、と考えると分かりやすいです。

### 前提

- Windows 11、または Windows 10（バージョン 1709 以降）
- インターネットに接続できること

管理者権限で PowerShell を開いておく必要はありません。作業中に「このアプリがデバイスに変更を加えることを許可しますか?」という確認ダイアログが出た場合は、「はい」を選んでください。

### 所要時間

15 分程度です。

### PowerShell の開き方

この記事の作業はすべて PowerShell で行います。開き方は 2 通りあります。

- `Windows キー + X` を押して、表示されたメニューから「ターミナル」（Windows 10 では「Windows PowerShell」）を選ぶ
- スタートボタンを押して「PowerShell」と入力し、Enter

青い、または黒いウィンドウが開き、文字を入力できる状態になれば準備完了です。以降、「以下を実行します」と書かれたコマンドは、このウィンドウに貼り付けて Enter を押してください。

> 貼り付けは `Ctrl + V` でできます。うまくいかない場合はウィンドウ内で右クリックしても貼り付けられます。

## 1. winget が使えるか確認する

winget は、Windows にソフトをコマンドでインストールするための仕組みです。この記事で入れる Git も GitHub CLI も winget 経由で入れます。

Windows 11、および比較的新しい Windows 10 には最初から入っているので、インストールは不要です。使える状態かどうかだけ確認します。

```powershell
winget --version
```

`v1.x.x` のようにバージョンが表示されれば、この手順は完了です。「2. Git を入れる」へ進んでください。

### 使えなかった場合

次のようなメッセージが表示されることがあります。

```
winget : 用語 'winget' は、コマンドレット、関数、スクリプト ファイル、
または操作可能なプログラムの名前として認識されません。
```

この場合は、winget の本体である「アプリ インストーラー」を入れます。次のページを開いて「入手」を押してください（すでに入っている場合は「更新」と表示されます）。

<https://apps.microsoft.com/detail/9nblggh4nns1>

インストールが終わったら **PowerShell を一度閉じて開き直し**、もう一度 `winget --version` で確認します。

それでも表示されない場合は、Windows のバージョンが古い可能性があります。「設定」→「Windows Update」から更新してください。

## 2. Git を入れる

Git は、コードの変更履歴を手元に記録するツールです。Windows には最初から入っていないので、winget で入れます。

```powershell
winget install --id Git.Git -e
```

インストールが終わったら、**PowerShell を一度閉じて開き直してください。** 開き直さないと `git` コマンドが見つからない状態のままになります。

新しく開いた PowerShell で確認します。

```powershell
git --version
```

`git version 2.x.x.windows.1` のように表示されれば完了です。末尾に `windows` と付きますが、これで正しい表示です。

### うまくいかなかった場合

winget でのインストールが失敗する場合は、公式サイトからインストーラをダウンロードして入れることもできます。

<https://git-scm.com/download/win>

インストーラの設定項目はすべて初期状態のままで問題ありません。「Next」を押し続けてください。

終わったら PowerShell を開き直して、もう一度 `git --version` で確認します。

### 初期設定について

Git には「誰がこの変更を記録したか」を残すための名前とメールアドレスの設定があります。ただしこのメールアドレスは GitHub に登録するものと揃える必要があるため、**GitHub アカウントを作ったあとに設定します**。

先に設定してしまうと後から直すことになるので、ここでは飛ばして次に進んでください。

## 3. GitHub アカウントを作る

GitHub は、Git で記録したコードをインターネット上に保管・公開する場所です。個人利用の範囲では無料で使えます。

ブラウザで <https://github.com/signup> を開いてください。

![スクリーンショット 2026-08-06 21.54.26.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/0208f3e4-3612-426c-bc0a-33113d1a2fd2.png)

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

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/274c5800-f166-45cd-8886-80e10cb800cb.png)

登録が終わるとログインした状態になります。これで GitHub 側の準備は完了です。

![スクリーンショット 2026-08-06 21.58.31.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/4124101/60082031-7b16-4c06-a37b-46d6b08e926a.png)

> 登録画面の項目や順序は変わることがあります。細かい表示がこの記事と違っていても、メールアドレス・パスワード・ユーザー名を登録してメール認証を通せば完了です。プランを選ぶ画面が出た場合は無料プラン（Free）を選んでください。

## 4. Git の初期設定

手順 2 で飛ばした Git の初期設定をします。設定するのは 3 つです。

### 名前とメールアドレス

Git は変更を記録するとき、「誰が記録したか」を一緒に残します。そのための名前とメールアドレスを設定します。

**メールアドレスは、GitHub に登録したものと同じにしてください。** 一致していると、GitHub 上でその記録が自分のアカウントのものとして表示されます。違うアドレスにすると、自分で記録したものが他人の記録のように扱われます。

```powershell
git config --global user.name "自分の名前"
git config --global user.email "GitHubに登録したメールアドレス"
```

（例）

```powershell
git config --global user.name "Sato Taro"
git config --global user.email "satotaro@example.com"
```

名前は本名でもハンドルネームでも構いません。記録に残る表示名になります。

### デフォルトのブランチ名

これは必須ではありませんが、一応やっておくといいでしょう。

```powershell
git config --global init.defaultBranch main
```

Git で新しくプロジェクトを作ると、`master` という名前の場所にコードが記録されます。ただし GitHub 側は `main` を標準としているため、揃えておかないと後で名前の食い違いが起きます。この設定で、最初から `main` が使われるようになります。今はわからなくても大丈夫です。

### 設定できたか確認する

設定しても画面には何も表示されないので、読み出して確認します。

```powershell
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

GitHub CLI（`gh`）は、GitHub の操作をコマンドから行える道具です。これを入れておくと、GitHub 上に新しいリポジトリを作るときにブラウザを開かずに済みます。

### インストールする

```powershell
winget install --id GitHub.cli -e
```

インストールが終わったら、**PowerShell を一度閉じて開き直してください。**

新しく開いた PowerShell で確認します。

```powershell
gh --version
```

`gh version 2.x.x` のように表示されれば完了です。

### ログインする

```powershell
gh auth login
```

いくつか質問されるので、矢印キーで選んで Enter で決定します。

| 質問                                                  | 選ぶもの                     |
| ----------------------------------------------------- | ---------------------------- |
| `Where do you use GitHub?`                            | **GitHub.com**               |
| `What is your preferred protocol for Git operations?` | **HTTPS**                    |
| `Authenticate Git with your GitHub credentials?`      | **No**                       |
| `How would you like to authenticate GitHub CLI?`      | **Login with a web browser** |

3 つめは **No** を選びます。Windows では Git 側の認証がすでに用意されているため、ここで設定を上書きする必要がありません。

選び終わると、次のような 8 桁のコードが表示されます。

```
! First copy your one-time code: A1B2-C3D4
Press Enter to open github.com in your browser...
```

コードをコピーしてから Enter を押すと、ブラウザが開きます。コードを貼り付けて、続けて表示される画面で許可すればログイン完了です。

PowerShell に戻って、次のように表示されていれば成功です。

```
✓ Logged in as あなたのユーザー名
```

### ログインできているか確認する

あとから確認したくなったときは、次のコマンドで状態を見られます。

```powershell
gh auth status
```

## セットアップの最終確認

すべて終わったら、最後に改めて確認してみましょう。PowerShell を新しく開いて、次の 5 つを 1 行ずつ実行してください。

```powershell
winget --version
git --version
git config --global --list
gh --version
gh auth status
```

それぞれ、次のように表示されていれば完了です。

| コマンド                     | 期待される表示                                              | 違ったときに戻る手順 |
| ---------------------------- | ----------------------------------------------------------- | -------------------- |
| `winget --version`           | `v1.x.x`                                                    | 1                    |
| `git --version`              | `git version 2.x.x.windows.1`                               | 2                    |
| `git config --global --list` | `user.name` `user.email` `init.defaultbranch` の 3 つが並ぶ | 4                    |
| `gh --version`               | `gh version 2.x.x`                                          | 5                    |
| `gh auth status`             | `✓ Logged in to github.com account ...`                     | 5                    |

「用語 '○○' は、コマンドレット、関数、スクリプト ファイル、または操作可能なプログラムの名前として認識されません」と表示された項目があれば、その道具がまだ入っていないか、PowerShell に反映されていません。**PowerShell を一度閉じて開き直してから**、もう一度確認してください。それでも表示されない場合は、右端の番号の手順に戻ってください。

ここまで 5 つとも通っていれば、土台は完成です。
