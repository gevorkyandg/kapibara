/**
 * Линейка мировых координат по нижнему и левому краю экрана.
 *
 * Это инструмент для разговора, а не часть игры: по нему можно сказать
 * «валун появляется около 5900» или прислать скриншот, на котором видно, где
 * именно что-то не так. Включается флагом DEBUG.coords и перед публикацией
 * выключается вместе с остальными отладочными вещами.
 *
 * Координаты именно мировые, а не экранные: экран едет за героем, а карта
 * стоит на месте, и договариваться удобно про карту.
 */

import { GAME_WIDTH, GAME_HEIGHT, TILE } from './config.js';
import { FONT } from './ui.js';

const ШАГ = 120; // через сколько пикселей ставим подпись
const ПОЛЕ = 22; // ширина полоски под подписи

export function createCoordRuler(scene) {
  const слой = scene.add.container(0, 0).setScrollFactor(0).setDepth(900);

  const фон = scene.add.graphics();
  фон.fillStyle(0x101820, 0.55);
  фон.fillRect(0, GAME_HEIGHT - ПОЛЕ, GAME_WIDTH, ПОЛЕ);
  фон.fillRect(0, 0, ПОЛЕ + 26, GAME_HEIGHT);
  слой.add(фон);

  const сетка = scene.add.graphics();
  слой.add(сетка);

  const стиль = { fontFamily: FONT, fontSize: '13px', color: '#cfe3ff' };
  const снизу = [];
  const сбоку = [];

  for (let x = ПОЛЕ + 26; x <= GAME_WIDTH - 40; x += ШАГ) {
    const t = scene.add.text(x + 3, GAME_HEIGHT - ПОЛЕ + 4, '', стиль);
    снизу.push({ t, x });
    слой.add(t);
  }
  for (let y = 0; y <= GAME_HEIGHT; y += ШАГ) {
    const t = scene.add.text(3, y + 3, '', стиль);
    сбоку.push({ t, y });
    слой.add(t);
  }

  const где = scene.add
    .text(GAME_WIDTH - 8, GAME_HEIGHT - ПОЛЕ - 20, '', {
      fontFamily: FONT,
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: '#101820cc',
      padding: { x: 6, y: 3 },
    })
    .setOrigin(1, 1);
  слой.add(где);

  const обновить = () => {
    const кам = scene.cameras.main;
    const сдвигX = Math.round(кам.scrollX);
    const сдвигY = Math.round(кам.scrollY);

    сетка.clear();
    // Линии еле заметны нарочно: они помогают прицелиться по координате, но
    // не должны читаться как полосы на земле.
    сетка.lineStyle(1, 0xffffff, 0.1);
    for (const м of снизу) {
      м.t.setText(String(сдвигX + м.x));
      сетка.lineBetween(м.x, 0, м.x, GAME_HEIGHT - ПОЛЕ);
    }
    for (const м of сбоку) {
      м.t.setText(String(сдвигY + м.y));
      сетка.lineBetween(ПОЛЕ + 26, м.y, GAME_WIDTH, м.y);
    }

    const p = scene.player;
    if (p) {
      где.setText(
        `капибара  x ${Math.round(p.x)}  y ${Math.round(p.y)}   ` +
          `клетка ${Math.floor(p.x / TILE)}:${Math.floor(p.y / TILE)}`
      );
    }
  };

  обновить();
  return { обновить, слой };
}
