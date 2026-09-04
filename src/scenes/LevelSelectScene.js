import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { LEVELS, ROUTES, countCoins } from '../levels.js';
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

    // Этапы разложены по маршрутам: один маршрут — одна строка карточек.
    // Карточки ужимаются под самый длинный маршрут, иначе при 25 этапах
    // жёсткая ширина давно бы уехала за край экрана.
    const gap = 24;
    const margin = 80;
    const вСтроке = Math.max(...ROUTES.map((r) => r.levels.length));
    const cardW = Math.min(260, (GAME_WIDTH - margin * 2 - (вСтроке - 1) * gap) / вСтроке);
    const scale = cardW / 300;
    // Строки делят свободную высоту: заголовок сверху, кнопка «Назад» снизу.
    // Жёсткие числа не годятся — маршрутов станет пять.
    const верх = 128;
    const низ = GAME_HEIGHT - 92;
    const высотаСтроки = (низ - верх) / ROUTES.length;
    const картаH = Math.min(340, высотаСтроки - 34);

    ROUTES.forEach((маршрут, ri) => {
      const строкаY = верх + ri * высотаСтроки + 34 + картаH / 2;
      const всего = маршрут.levels.length;
      const ширинаСтроки = всего * cardW + (всего - 1) * gap;
      const startX = (GAME_WIDTH - ширинаСтроки) / 2 + cardW / 2;

      this.add
        .text(margin, строкаY - картаH / 2 - 22, `${t('route')} ${ri + 1}. ${
          getLanguage() === 'ru' ? маршрут.name : маршрут.nameEn
        }`, {
          fontFamily: FONT,
          fontSize: '26px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#7a4a28',
          strokeThickness: 6,
        })
        .setOrigin(0, 0.5);

      маршрут.levels.forEach((i, j) => {
        const level = LEVELS[i];
        const x = startX + j * (cardW + gap);
        const y = строкаY;
        const unlocked = isLevelUnlocked(i);
        const result = getLevelResult(i);

        panel(this, x, y, cardW, картаH);

        this.add
          .text(x, y - картаH / 2 + 24, `${t('stage')} ${j + 1}`, {
            fontFamily: FONT,
            fontSize: `${Math.round(26 * scale)}px`,
            color: COLORS.inkDim,
            fontStyle: 'bold',
          })
          .setOrigin(0.5);

        this.add
          .text(x, y - картаH / 2 + 62, getLanguage() === 'ru' ? level.name : level.nameEn, {
            fontFamily: FONT,
            fontSize: `${Math.round(25 * scale)}px`,
            color: COLORS.ink,
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: cardW - 30 },
          })
          .setOrigin(0.5);

        starRow(this, x, y - 4, unlocked ? result.stars : 0, 0.55 * scale);

        const lines = unlocked
          ? [
              `${t('collected')}: ${Math.round(result.best * 100)}%`,
              `${t('coins')}: ${countCoins(i)}`,
              result.bestTime ? `${t('time')}: ${formatTime(result.bestTime)}` : '',
            ].filter(Boolean)
          : [t('lockedHint')];

        this.add
          .text(x, y + 22, lines.join('\n'), {
            fontFamily: FONT,
            fontSize: `${Math.round(18 * scale)}px`,
            color: COLORS.inkDim,
            align: 'center',
            lineSpacing: 3,
            wordWrap: { width: cardW - 30 },
          })
          .setOrigin(0.5);

        const btn = makeButton(
          this,
          x,
          y + картаH / 2 - 34,
          cardW - 46,
          56,
          unlocked ? t('play') : t('locked'),
          () => this.scene.start('GameScene', { levelIndex: i })
        );
        if (!unlocked) btn.setEnabled(false);
      });
    });

    makeButton(this, 140, GAME_HEIGHT - 56, 200, 64, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });
  }
}
