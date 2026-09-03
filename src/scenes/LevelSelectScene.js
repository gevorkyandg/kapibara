import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { LEVELS, countCoins } from '../levels.js';
import { createBackground } from '../background.js';
import { getLevelResult, isLevelUnlocked, getSave, getLevel } from '../save.js';
import { t, getLanguage, formatTime } from '../i18n.js';
import { makeButton, panel, starRow, coinBadge, FONT, COLORS } from '../ui.js';

/** Выбор этапа: карточка на каждый этап со звёздами и лучшим результатом. */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    createBackground(this, 0, GAME_WIDTH);

    this.add
      .text(GAME_WIDTH / 2, 76, t('stageSelect'), {
        fontFamily: FONT,
        fontSize: '52px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    coinBadge(this, 40, 44, getSave().coins, 40);

    this.add
      .text(GAME_WIDTH - 40, 44, `${t('playerLevel')} ${getLevel()}`, {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5);

    // Карточки ужимаются под число этапов: их станет 25, и жёсткая ширина
    // давно бы уехала за край экрана.
    const gap = 30;
    const margin = 90;
    const cardW = Math.min(300, (GAME_WIDTH - margin * 2 - (LEVELS.length - 1) * gap) / LEVELS.length);
    const scale = cardW / 300; // мельче карточка — мельче и всё внутри
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;

    LEVELS.forEach((level, i) => {
      const x = startX + i * (cardW + gap);
      const y = GAME_HEIGHT / 2 + 20;
      const unlocked = isLevelUnlocked(i);
      const result = getLevelResult(i);

      panel(this, x, y, cardW, 350);

      this.add
        .text(x, y - 132, `${t('stage')} ${i + 1}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(30 * scale)}px`,
          color: COLORS.inkDim,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y - 88, getLanguage() === 'ru' ? level.name : level.nameEn, {
          fontFamily: FONT,
          fontSize: `${Math.round(27 * scale)}px`,
          color: COLORS.ink,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: cardW - 40 },
        })
        .setOrigin(0.5);

      starRow(this, x, y - 26, unlocked ? result.stars : 0, 0.6 * scale);

      const lines = unlocked
        ? [
            `${t('collected')}: ${Math.round(result.best * 100)}%`,
            `${t('coins')}: ${countCoins(i)}`,
            result.bestTime ? `${t('time')}: ${formatTime(result.bestTime)}` : '',
          ].filter(Boolean)
        : [t('lockedHint')];

      this.add
        .text(x, y + 46, lines.join('\n'), {
          fontFamily: FONT,
          fontSize: `${Math.round(21 * scale)}px`,
          color: COLORS.inkDim,
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: cardW - 40 },
        })
        .setOrigin(0.5);

      const btn = makeButton(this, x, y + 128, cardW - 60, 64, unlocked ? t('play') : t('locked'), () =>
        this.scene.start('GameScene', { levelIndex: i })
      );
      if (!unlocked) btn.setEnabled(false);
    });

    makeButton(this, 140, GAME_HEIGHT - 56, 200, 64, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });
  }
}
