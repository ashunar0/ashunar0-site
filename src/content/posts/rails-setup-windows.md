---
title: Rails の環境構築（Windows / PowerShell）
description: PowerShell で Ruby on Rails の環境構築をする手順。
pubDate: 2025-12-18
tags: [Ruby, Ruby on Rails, 環境構築]
draft: false
---

## この記事について

この記事では、Windows で Ruby on Rails の開発環境を作ります。すべて PowerShell の中で完結します。

### インストールするもの

| 道具          | 役割                                       |
| ------------- | ------------------------------------------ |
| Ruby + Devkit | Rails を動かすための言語と、その周辺ツール |
| Rails         | Web アプリを作るためのフレームワーク       |

### 前提

- Windows 11、または Windows 10（バージョン 1709 以降）
- winget が使えること
- エディタは VSCode を想定しています

### 所要時間

30 分程度です。

### PowerShell の開き方

- `Windows キー + X` を押して、表示されたメニューから「ターミナル」（Windows 10 では「Windows PowerShell」）を選ぶ
- スタートボタンを押して「PowerShell」と入力し、Enter

## 1. Ruby を入れる

Ruby 3.4 を入れます。

```powershell
winget install --id RubyInstallerTeam.RubyWithDevKit.3.4 -e
```

`WithDevKit` と付いているものを選ぶのが重要です。Ruby 本体だけでなく、次の手順で使う開発ツールが一緒に入ります。これが無いと、あとで Rails をインストールするときに失敗します。

インストールには数分かかります。

### 入ったか確認する

インストールが終わったら、**PowerShell を一度閉じて開き直してください。**

新しく開いた PowerShell で以下を実行します。

```powershell
ruby -v
```

次のように表示されれば完了です。

```
ruby 3.4.10 (2026-XX-XX revision xxxxxxx) [x64-mingw-ucrt]
```

末尾の `[x64-mingw-ucrt]` は Windows 版であることを示す表示なので、気にしなくて構いません。

ライブラリを入れるための `gem` コマンドも一緒に入っています。

```powershell
gem -v
```

`3.x.x` のように表示されれば問題ありません。

## 2. gem をビルドできるようにする

Ruby のライブラリ（gem）の中には、インストール時にパソコン上で組み立てが必要なものがあります。Rails はそうした gem を多く使うので、そのための道具を先に用意します。

```powershell
ridk install
```

次のような選択画面が表示されます。

```
   1 - MSYS2 base installation
   2 - MSYS2 system update (optional)
   3 - MSYS2 and MINGW development toolchain

Which components shall be installed? If unsure press ENTER
```

**何も入力せずに Enter を押してください。** 必要なものが自動で選ばれます。

インストールには 5 〜 10 分かかります。大量の文字が流れますが、そのまま待ってください。

終わったら、**PowerShell を一度閉じて開き直してください。**

> この手順がうまくいったかどうかは、次の「3. Rails を入れる」が成功するかで分かります。ここでは確認用のコマンドはありません。

## 3. Rails を入れる

Rails は gem（Ruby のライブラリ）として配布されているので、`gem` コマンドで入れます。

```powershell
gem install rails
```

数分かかります。Rails 本体だけでなく、Rails が必要とする多数の gem が一緒に入るためです。

### 入ったか確認する

```powershell
rails -v
```

`Rails 8.x.x` のように表示されれば完了です。

### エラーが出た場合

インストールの途中で次のようなメッセージが出て止まることがあります。

```
ERROR: Failed to build gem native extension.
```

これは、gem を組み立てるための道具が足りていないときに出ます。手順 2 の `ridk install` が終わっていないか、実行後に PowerShell を開き直していない可能性が高いです。手順 2 をもう一度実行してから、PowerShell を閉じて開き直し、再度 `gem install rails` を試してください。

## 4. アプリを作って起動する（任意）

実際に Rails アプリを 1 つ作って、動くところまで確認します。この手順は飛ばしても問題ありません。

アプリを作りたい場所に移動してから実行します。

```powershell
rails new rails-test
```

`rails-test` がフォルダ名になります。**数分かかります。** アプリの骨組みが作られたあと、必要な gem がまとめてインストールされるためです。

作られたフォルダに移動して、開発サーバーを起動します。

```powershell
cd rails-test
rails s
```

`s` は `server` の省略形です。`rails server` と書いても同じです。

次のような表示が出ます。

```
=> Booting Puma
=> Rails 8.x.x application starting in development
* Listening on http://127.0.0.1:3000
```

ブラウザで <http://localhost:3000> を開いてください。Rails のロゴが表示された画面が出れば成功です。

### サーバーを止める

PowerShell で `Ctrl + C` を押すと止まります。

再開したいときは、`rails-test` フォルダの中で `rails s` をもう一度実行してください。

### VSCode で開く

別の PowerShell を開いて、`rails-test` フォルダで次を実行すると VSCode で編集できます。

```powershell
code .
```

## つまずいたら

#### 「用語 'ruby' は…認識されません」と表示される

インストール後に PowerShell を開き直していない可能性があります。一度閉じて開き直してから、もう一度試してください。

開き直しても表示される場合は、手順 1 のインストールが完了していません。`winget install --id RubyInstallerTeam.RubyWithDevKit.3.4 -e` をもう一度実行してください。

#### `http://localhost:3000` を開いても表示されない

次の順に確認してください。

1. PowerShell で `rails s` が動いたままになっているか（`Ctrl + C` で止めていないか）
2. URL の `http://` を省略していないか
3. 一度 `Ctrl + C` で止めて、`rails s` で起動し直す

`rails s` を実行した PowerShell は、サーバーが動いている間はそのまま使えません。別のコマンドを打ちたいときは、PowerShell をもう 1 つ開いてください。

#### コピペしたのにコマンドが動かない

全角スペースや全角記号が混ざっている可能性があります。コマンドは半角で入力する必要があります。手で打ち直さず、この記事からコピーして貼り付けるのが確実です。
