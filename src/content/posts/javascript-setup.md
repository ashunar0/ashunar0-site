---
title: JavaScript の開発環境構築
description: Node.jsを入れて、JavaScript と React を動かせるようにするまでの手順。
pubDate: 2025-12-16
tags: [JavaScript, 環境構築]
draft: false
---

## この記事について

この記事では、JavaScript と React を動かすための環境を作ります。Node.js を入れて、React のプロジェクトを作り、ブラウザで表示するところまで進めます。

### インストールするもの

| 道具    | 役割                                                   |
| ------- | ------------------------------------------------------ |
| Node.js | JavaScript をブラウザの外で動かすための実行環境        |
| npm     | ライブラリを追加・管理する道具（Node.js に同梱）       |
| Vite    | React のプロジェクトを作り、開発中の画面を表示する道具 |

JavaScript はもともとブラウザの中で動く言語です。Node.js を入れると、ブラウザを開かなくても手元で JavaScript を実行できるようになります。React の開発では、この Node.js の上でプロジェクトを組み立てていきます。

### 前提

Mac では Homebrew、Windows では winget を使います。エディタは VSCode を想定しています。まだの場合は先に済ませてください。

### 所要時間

20 分程度です。

## 1. Node.js を入れる

Node.js には複数のバージョンがあり、そのうち長期間サポートされるものが LTS と呼ばれます。学習用途では LTS を選んでおくのが安全です。この記事では **Node.js 24** を入れます。

ここだけ Mac と Windows で手順が分かれます。自分の環境の方だけ実行してください。

#### Mac の場合

```bash
brew install node@24
```

インストールが終わったら、続けて次のコマンドを実行します。

```bash
brew link --force node@24
```

これは、入れた Node.js をターミナルから使えるようにするための設定です。バージョンを指定して入れた場合は自動では設定されないため、この 1 行が必要になります。

#### Windows の場合

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

### 入ったか確認する

インストールが終わったら、**ターミナル（PowerShell）を一度閉じて開き直してください。**

新しく開いた画面で以下を実行します。

```bash
node --version
npm --version
```

次のように表示されれば完了です。

```
v24.x.x
11.x.x
```

`node` と一緒に `npm` も入ります。`npm` はライブラリを追加するための道具で、このあと使います。

> Node.js の LTS は 1 年ごとに切り替わります。この記事を読んでいる時点で 24 より新しい LTS が出ている場合は、そちらを入れても構いません。現在の LTS は <https://nodejs.org> で確認できます。

## 2. JavaScript を動かしてみる（任意）

Node.js が入ったので、JavaScript をターミナルで実行できるようになっています。React に進む前に、軽く動かして確認しておきます。

この手順は飛ばしても問題ありません。

作業用のフォルダを作って VSCode で開きます。

```bash
mkdir js-test
cd js-test
code .
```

VSCode で `hello.js` というファイルを作り、次の 1 行を書いて保存します。

```javascript
console.log("Hello, JavaScript!");
```

VSCode のターミナル（「ターミナル」→「新しいターミナル」）で実行します。

```bash
node hello.js
```

`Hello, JavaScript!` と表示されれば成功です。

`console.log` はブラウザの開発者ツールで見たことがあるかもしれませんが、Node.js を使うとブラウザを開かなくてもターミナルに表示されます。これが「JavaScript をブラウザの外で動かす」ということです。

## 3. React プロジェクトを作る（任意）

React のプロジェクトを作ってみます。ここでは **Vite** という道具を使います。React 本体だけでは開発用の画面表示やファイルの変換ができないため、その周辺をまとめて用意してくれるものだと考えてください。

`js-test` フォルダにいる場合は、一度そこから出ておきます。

```bash
cd ..
```

プロジェクトを作ります。

```bash
npm create vite@latest my-app -- --template react
```

`my-app` がフォルダ名になります。別の名前にしたい場合はそこを変えてください。

作成が終わったら、フォルダに移動してライブラリをインストールします。

```bash
cd my-app
npm install
```

`npm install` は、プロジェクトが必要とするライブラリをまとめてダウンロードするコマンドです。`node_modules` というフォルダが作られ、その中に入ります。数十秒かかることがあります。

VSCode で開いてみます。

```bash
code .
```

`src/App.jsx` が、画面の中身を書くファイルです。

## 4. 開発サーバーを起動する（任意）

作ったプロジェクトを実際に表示してみます。`my-app` フォルダにいる状態で実行します。

```bash
npm run dev
```

次のような表示が出ます。

```
  VITE v8.x.x  ready in 312 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

`Local:` の横に出ている <http://localhost:5173/> をブラウザで開いてください。React のロゴが回っている画面が表示されれば成功です。

### 編集が反映されるか確認する

サーバーを起動したまま、VSCode で `src/App.jsx` を開きます。ファイルの中ほどに次のような行があります。

```jsx
<h1>Vite + React</h1>
```

ここを好きな文字に書き換えて保存してください。

```jsx
<h1>はじめての React</h1>
```

ブラウザに戻ると、**再読み込みしなくても表示が変わっています。** 保存するたびに画面へ反映されるので、この状態のまま開発を進めていきます。

### サーバーを止める

ターミナルで `Ctrl + C` を押すと止まります。Mac でも `Command` ではなく `Ctrl` です。

止めたあと再開したいときは、もう一度 `npm run dev` を実行してください。
