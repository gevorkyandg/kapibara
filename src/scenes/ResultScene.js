import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ADS } from '../config.js';
import { LEVELS } from '../levels.js';
import { t } from '../i18n.js';
import { makeButton, panel, FONT, COLORS } from '../ui.js';
import { sfx } from '../audio.js';
import { flush } from '../save.js';
import { platform } from '../platform/index.js';

// Когда последний раз показывали межстраничную рекламу. Модуль живёт всю
// сессию, поэтому счётчик переживает переходы между сценами.
let lastAdAt = 0;

/**
 * Итог уровня поверх замершей игры: звёзды, процент собранных монет,
 * что делать дальше.
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data) {
    const { stars, percent, coins, total, treatCoins, levelIndex } = data;
    const passed = stars > 0;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 560);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 220, passed ? t('levelDone') : t('levelFailed'), {
        fontFamily: FONT,
        fontSize: '48px',
        color: passed ? COLORS.ink : '#b4553f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Звёзды появляются по одной — маленький праздник за старания.
    for (let i = 0; i < 3; i++) {
      const star = this.add
        .image(GAME_WIDTH / 2 + (i - 1) * 130, GAME_HEIGHT / 2 - 110, i < stars ? 'star-on' : 'star-off')
        .setScale(0);
      this.tweens.add({
        targets: star,
        scale: i < stars ? 1.15 : 0.95,
        angle: i < stars ? 360 : 0,
        duration: 420,
        delay: 250 + i * 260,
        ease: 'Back.Out',
        onStart: () => i < stars && sfx.star(i),
      });
    }

    const lines = [
      `${t('collected')}: ${coins} / ${total}  (${Math.round(percent * 100)}%)`,
      treatCoins > 0 ? `${t('treatBonus')}: +${treatCoins}` : '',
      passed ? '' : t('failedHint'),
    ].filter(Boolean);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '30px',
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    const hasNext = passed && levelIndex + 1 < LEVELS.length;
    const y = GAME_HEIGHT / 2 + 180;

    makeButton(this, GAME_WIDTH / 2 - (hasNext ? 230 : 130), y, 220, 74, t('retry'), () =>
      this.goToLevel(levelIndex, false)
    );

    makeButton(
      this,
      GAME_WIDTH / 2 + (hasNext ? 0 : 130),
      y,
      220,
      74,
      t('menu'),
      () => {
        flush();
        this.scene.stop('GameScene');
        this.scene.start('LevelSelectScene');
      },
      { fill: COLORS.panel, edge: COLORS.panelEdge }
    );

    if (hasNext) {
      makeButton(
        this,
        GAME_WIDTH / 2 + 230,
        y,
        220,
        74,
        t('next'),
        () => this.goToLevel(levelIndex + 1, true),
        { fill: COLORS.green, edge: COLORS.greenEdge }
      );
    }
  }

  /**
   * Переход на уровень. Реклама — только здесь, в логической паузе между
   * уровнями, и не чаще, чем раз в несколько минут: иначе игроки уходят.
   */
  async goToLevel(index, afterWin) {
    flush();

    const now = Date.now();
    if (ADS.interstitialOnLevelEnd && afterWin && now - lastAdAt > ADS.minIntervalMs) {
      lastAdAt = now;
      await platform.showAd();
    }

    this.scene.stop('GameScene');
    this.scene.start('GameScene', { levelIndex: index });
  }
}
