import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages публикует проект по адресу https://<аккаунт>.github.io/<репозиторий>/
// Имя репозитория можно переопределить переменной окружения HD_BASE.
export default defineConfig({
  base: process.env.HD_BASE ?? '/Health-Dashboard/',
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
  },
});
