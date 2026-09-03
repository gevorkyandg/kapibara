import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ADS } from '../config.js';
import { LEVELS } from '../levels.js';
import { t, formatTime } from '../i18n.js';
import { makeButton, panel, FONT, COLORS } from '../ui.js';
import { sfx } from '../audio.js';
import { flush } from '../save.js';
import { platform } from '../platform/index.js';

// Когда последний раз показывали межстраничную рекламу. Модуль живёт всю
// сессию, поэтому счётчик переживает переходы между сценами.
let lastAdAt = 0;

/**
 * Итог этапа поверх замершей игры (ТЗ): звёзды, монеты, время, сладости,
 * обезвреженные монстры и что делать дальше.
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(data) {
    const {
      stars,
      percent,
      failedBy,
      coins,
      total,
      treats,
      treatXp,
      monsters,
      monsterXp,
      timeMs,
      stageXp,
      levelBefore,
      levelAfter,
      levelIndex,
    } = data;
    const passed = stars > 0;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 780, 640);

    const title = passed ? t('stageDone') : failedBy === 'lives' ? t('outOfLives') : t('stageFailed');
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 268, title, {
        fontFamily: FONT,
        fontSize: '46px',
        color: passed ? COLORS.ink : '#b4553f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Звёзды появляются по одной — маленький праздник за старания.
    for (let i = 0; i < 3; i++) {
      const star = this.add
        .image(GAME_WIDTH / 2 + (i - 1) * 130, GAME_HEIGHT / 2 - 170, i < stars ? 'star-on' : 'star-off')
        .setScale(0);
      this.tweens.add({
        targets: star,
        scale: i < stars ? 1.1 : 0.9,
        angle: i < stars ? 360 : 0,
        duration: 420,
        delay: 250 + i * 260,
        ease: 'Back.Out',
        onStart: () => i < stars && sfx.star(i),
      });
    }

    // Итоги строчками: слева название, справа число — так читается быстрее.
    // Опыт подписан у каждого источника: иначе кажется, что за монстров и
    // сладости его не дают.
    const totalXp = stageXp + treatXp + monsterXp;
    const rows = [
      [t('collected'), `${coins} / ${total}  (${Math.round(percent * 100)}%)`],
      [t('time'), formatTime(timeMs)],
      [t('treats'), treats > 0 ? `${treats}   +${treatXp} ${t('xpShort')}` : '0'],
      [t('neutralized'), monsters > 0 ? `${monsters}   +${monsterXp} ${t('xpShort')}` : '0'],
      [t('xpGained'), `+${stageXp}`],
    ];

    rows.forEach(([label, value], i) => {
      const y = GAME_HEIGHT / 2 - 110 + i * 38;
      this.add
        .text(GAME_WIDTH / 2 - 300, y, label, {
          fontFamily: FONT,
          fontSize: '27px',
          color: COLORS.inkDim,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(GAME_WIDTH / 2 + 300, y, value, {
          fontFamily: FONT,
          fontSize: '27px',
          color: COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);
    });

    // Итоговая строка опыта — отдельно и заметнее остальных.
    const totalY = GAME_HEIGHT / 2 - 110 + rows.length * 38 + 10;
    this.add
      .text(GAME_WIDTH / 2 - 300, totalY, t('xpTotal'), {
        fontFamily: FONT,
        fontSize: '30px',
        color: COLORS.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.add
      .text(GAME_WIDTH / 2 + 300, totalY, `+${totalXp}`, {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#3f8f4f',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    // Подсказка, почему этап не засчитан
    if (!passed) {
      this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 + 140,
          failedBy === 'lives' ? t('outOfLivesHint') : t('failedHint'),
          { fontFamily: FONT, fontSize: '24px', color: '#b4553f' }
        )
        .setOrigin(0.5);
    }

    // Новый уровень игрока — заметное событие, его стоит отпраздновать.
    // Уровень может подняться и на провальном забеге (за сладости и монстров),
    // поэтому плашка встаёт ниже подсказки, а не поверх неё.
    if (levelAfter > levelBefore) {
      const banner = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + (passed ? 140 : 182), `${t('levelUp')}  ${t('playerLevel')} ${levelAfter}`, {
          fontFamily: FONT,
          fontSize: '30px',
          color: '#3f8f4f',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setScale(0);
      this.tweens.add({
        targets: banner,
        scale: 1,
        duration: 500,
        delay: 1100,
        ease: 'Back.Out',
        onStart: () => sfx.win(),
      });
    }

    const hasNext = passed && levelIndex + 1 < LEVELS.length;
    const y = GAME_HEIGHT / 2 + 230;

    makeButton(this, GAME_WIDTH / 2 - (hasNext ? 240 : 130), y, 230, 74, t('retry'), () =>
      this.goToStage(levelIndex, false)
    );

    makeButton(
      this,
      GAME_WIDTH / 2 + (hasNext ? 0 : 130),
      y,
      230,
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
      makeButton(this, GAME_WIDTH / 2 + 240, y, 230, 74, t('next'), () => this.goToStage(levelIndex + 1, true), {
        fill: COLORS.green,
        edge: COLORS.greenEdge,
      });
    }
  }

  /**
   * Переход на этап. Реклама — только здесь, в логической паузе между
   * этапами, и не чаще, чем раз в несколько минут: иначе игроки уходят.
   */
  async goToStage(index, afterWin) {
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
