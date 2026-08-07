// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  // アイコンはビルド時に svg として埋め込まれるので、クライアントに JS は乗らない。
  integrations: [mdx(), react(), icon()],

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