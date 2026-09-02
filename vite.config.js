import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути: Яндекс Игры распаковывают архив в подпапку,
  // и при base:'/' браузер искал бы файлы в корне домена и не нашёл.
  base: './',
  server: {
    host: '127.0.0.1',
    // Свой порт, отдельный от соседнего проекта (там 5173).
    port: Number(process.env.PORT) || 5174,
  },
  build: {
    // Мелкие картинки не превращать в base64 — Phaser грузит их файлами.
    assetsInlineLimit: 0,
  },
});
