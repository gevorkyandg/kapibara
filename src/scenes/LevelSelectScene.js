import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { LEVELS, countCoins } from '../levels.js';
import { createBackground } from '../background.js';
import { getLevelResult, isLevelUnlocked, getSave } from '../save.js';
import { t, getLanguage } from '../i18n.js';
import { makeButton, panel, starRow, coinBadge, FONT, COLORS } from '../ui.js';

/** Выбор уровня: карточка на каждый уровень со звёздами и лучшим результатом. */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    createBackground(this, 0, GAME_WIDTH);

    this.add
      .text(GAME_WIDTH / 2, 84, t('levelSelect'), {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    coinBadge(this, 40, 44, getSave().coins, 40);

    const cardW = 300;
    const gap = 40;
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;

    LEVELS.forEach((level, i) => {
      const x = startX + i * (cardW + gap);
      const y = GAME_HEIGHT / 2 + 20;
      const unlocked = isLevelUnlocked(i);
      const result = getLevelResult(i);

      panel(this, x, y, cardW, 330);

      this.add
        .text(x, y - 122, `${t('level')} ${i + 1}`, {
          fontFamily: FONT,
          fontSize: '32px',
          color: COLORS.inkDim,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y - 76, getLanguage() === 'ru' ? level.name : level.nameEn, {
          fontFamily: FONT,
          fontSize: '28px',
          color: COLORS.ink,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: cardW - 40 },
        })
        .setOrigin(0.5);

      starRow(this, x, y - 14, unlocked ? result.stars : 0, 0.6);

      this.add
        .text(
          x,
          y + 46,
          unlocked
            ? `${t('collected')}: ${Math.round(result.best * 100)}%\n${t('coins')}: ${countCoins(i)}`
            : t('lockedHint'),
          {
            fontFamily: FONT,
            fontSize: '22px',
            color: COLORS.inkDim,
            align: 'center',
            wordWrap: { width: cardW - 40 },
          }
        )
        .setOrigin(0.5);

      const btn = makeButton(
        this,
        x,
        y + 118,
        200,
        66,
        unlocked ? t('play') : t('locked'),
        () => this.scene.start('GameScene', { levelIndex: i })
      );
      if (!unlocked) btn.setEnabled(false);
    });

    makeButton(this, 140, GAME_HEIGHT - 60, 200, 66, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });
  }
}
