// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  // OGP の og:image / og:url は絶対 URL でないとクローラが解決できない。
  // その基準になるので、ドメインを変えたらここも変える。
  site: 'https://ashunar0.dev',

  // アイコンはビルド時に svg として埋め込まれるので、クライアントに JS は乗らない。
  integrations: [
    mdx(),
    react(),
    icon({
      // svgo は既定で id を a, b, c… へ短縮する。ローカルの svg が複数あると
      // 別ファイル同士で id がぶつかり、グラデーションが他方の定義を拾って色が化ける。
      svgoOptions: {
        plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false } } }],
      },
    }),
  ],

  markdown: {
    // Shiki はテーマの色をインライン style で書き込むため、CSS からは上書きできない。
    // コードブロックの配色はここが唯一の指定場所になる。
    shikiConfig: {
      theme: 'github-dark',
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});