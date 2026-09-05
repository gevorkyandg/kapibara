import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/**
 * Метка сборки: версия из package.json плюс короткий номер коммита.
 *
 * Она уходит в статистику вместе с каждой записью. Без неё нельзя сравнить
 * «до» и «после»: в один день чинишь горку, на следующий смотришь на цифры и
 * не понимаешь, какая половина данных снята со старой версии.
 */
function меткаСборки() {
  const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
  try {
    const коммит = execSync('git rev-parse --short HEAD').toString().trim();
    return `${version}-${коммит}`;
  } catch {
    // Собирают не из репозитория — обойдёмся одной версией.
    return version;
  }
}

export default defineConfig({
  define: {
    __СБОРКА__: JSON.stringify(меткаСборки()),
  },
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
