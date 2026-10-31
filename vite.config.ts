import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
// @ts-expect-error локальный Node-модуль конвейера без .d.ts
import { localPipelineVitePlugin } from './pipeline/review-api.mjs';

// GitHub Pages публикует проект по адресу https://<аккаунт>.github.io/<репозиторий>/
// Имя репозитория можно переопределить переменной окружения HD_BASE.
const base = process.env.HD_BASE ?? '/Health-Dashboard/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    localPipelineVitePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Здоровье — Персональный медицинский дашборд',
        short_name: 'Здоровье',
        description: 'Персональная медицинская база, анализы, хронология и архив документов (AES-256-GCM)',
        lang: 'ru',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
});
