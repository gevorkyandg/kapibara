import Phaser from 'phaser';
import { createTextures } from '../art.js';
import { loadSave } from '../save.js';
import { setLanguage } from '../i18n.js';
import { platform } from '../platform/index.js';

/**
 * Стартовая сцена: рисует все текстуры, читает прогресс, говорит площадке
 * «игра загрузилась» и уходит в меню. Своих экранов не показывает — до этого
 * момента виден заглушечный экран из index.html.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    createTextures(this);
    setLanguage(platform.lang);
    await loadSave();

    // Заглушку из index.html убираем только сейчас: под ней уже готовый кадр.
    document.getElementById('boot')?.remove();

    // Game Ready. Неработающий вызов — частая причина отказа модерации.
    platform.ready();

    // Редактор открывает игру ссылкой вида ?этап=3 — чтобы пробовать
    // нарисованное сразу, не проходя меню. Только в разработке.
    const этап = import.meta.env.DEV
      ? Number(new URLSearchParams(location.search).get('этап'))
      : NaN;
    if (Number.isInteger(этап) && этап >= 0) {
      this.scene.start('GameScene', { levelIndex: этап });
      return;
    }

    this.scene.start('MenuScene');
  }
}
