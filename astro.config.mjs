// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), react()],

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