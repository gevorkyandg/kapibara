/**
 * Задник уровня: небо, облака, холмы, деревья.
 *
 * Слои двигаются с разной скоростью (параллакс) — дальние медленнее ближних.
 * Это даёт ощущение глубины и стоит почти ничего: несколько картинок с
 * разным scrollFactor.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { THEMES } from './art.js';

export function createBackground(scene, themeIndex, worldWidth) {
  const theme = THEMES[themeIndex];

  // Небо — градиент во весь кадр, оно не двигается вообще.
  const sky = scene.add.graphics().setScrollFactor(0).setDepth(-100);
  sky.fillGradientStyle(theme.sky, theme.sky, theme.skyBottom, theme.skyBottom, 1);
  sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const rnd = new Phaser.Math.RandomDataGenerator([`bg-${themeIndex}-${worldWidth}`]);

  // Солнышко
  scene.add
    .circle(GAME_WIDTH - 180, 130, 62, 0xfff3b0, 0.9)
    .setScrollFactor(0)
    .setDepth(-99);

  const layer = (key, count, scrollFactor, yFrom, yTo, scaleFrom, scaleTo, depth, alpha = 1) => {
    // Видимая ширина слоя меньше мира во столько же раз, во сколько он медленнее.
    const span = worldWidth * scrollFactor + GAME_WIDTH;
    for (let i = 0; i < count; i++) {
      scene.add
        .image((i / count) * span + rnd.between(-60, 60), rnd.between(yFrom, yTo), key)
        .setScrollFactor(scrollFactor)
        .setScale(rnd.realInRange(scaleFrom, scaleTo))
        .setAlpha(alpha)
        .setDepth(depth);
    }
  };

  const chunks = Math.ceil(worldWidth / 720);
  layer(`cloud-${themeIndex}`, chunks + 4, 0.15, 70, 240, 0.7, 1.3, -90, 0.95);
  layer(`hill-far-${themeIndex}`, chunks + 2, 0.3, GAME_HEIGHT - 190, GAME_HEIGHT - 150, 0.9, 1.4, -85);
  layer(`hill-near-${themeIndex}`, chunks + 3, 0.5, GAME_HEIGHT - 150, GAME_HEIGHT - 110, 0.8, 1.2, -80);
  layer(`tree-${themeIndex}`, chunks + 2, 0.75, GAME_HEIGHT - 190, GAME_HEIGHT - 160, 0.7, 1.0, -70);
}
