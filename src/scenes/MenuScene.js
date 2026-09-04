import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEBUG } from '../config.js';
import { LEVELS } from '../levels.js';
import { createBackground } from '../background.js';
import { createCapybara } from '../capybara.js';
import {
  getSave,
  getLevel,
  addXp,
  addCoins,
  getStats,
  getMaxLives,
  hasItem,
  countPassedStages,
  resetProgress,
  isSoundOn,
  setSound,
  flush,
} from '../save.js';
import { levelProgress, xpForLevel, MAX_LEVEL } from '../progression.js';
import { SHOP_ITEMS } from '../shop.js';
import { t } from '../i18n.js';
import { makeButton, panel, coinBadge, FONT, COLORS } from '../ui.js';
import { unlockAudio, sfx } from '../audio.js';
import { platform } from '../platform/index.js';

/** Время в игре: часы показываем только когда они есть. */
function formatPlayTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ч ${String(m).padStart(2, '0')} мин`;
  return `${m} мин ${String(s).padStart(2, '0')} с`;
}

/**
 * Главное меню (ТЗ): уровень игрока, шкала прохождения, статистика со
 * сбросом, кнопки «Играть» и «Магазин».
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    platform.gameplayStop(); // в меню геймплея нет
    createBackground(this, 0, GAME_WIDTH);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 60, 'ground-0');

    this.add
      .text(GAME_WIDTH / 2, 66, t('title'), {
        fontFamily: FONT,
        fontSize: '68px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 11,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 118, t('subtitle'), {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#fff3d0',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    coinBadge(this, 40, 44, getSave().coins, 40);

    this.buildPlayerCard();
    this.buildButtons();

    // Капибара гуляет по меню туда-сюда — сразу видно, кто главный герой.
    // Глубина ниже нуля: капибара гуляет за карточками, но перед фоном.
    this.capy = createCapybara(this, 300, GAME_HEIGHT - 60, 0.75).setDepth(-5);
    this.tweens.add({
      targets: this.capy,
      x: GAME_WIDTH - 300,
      duration: 7000,
      yoyo: true,
      repeat: -1,
      onYoyo: () => this.capy.face(-1),
      onRepeat: () => this.capy.face(1),
    });

    // Звук в браузере включается только после действия игрока.
    this.input.once('pointerdown', unlockAudio);
    this.input.keyboard.once('keydown', unlockAudio);
  }

  /** Карточка игрока: уровень, опыт, прогресс по этапам и статистика. */
  buildPlayerCard() {
    const x = 340;
    const y = 400;
    const w = 580;
    panel(this, x, y, w, 470);

    const save = getSave();
    const level = getLevel();
    const atMax = level >= MAX_LEVEL;

    this.add
      .text(x - w / 2 + 30, y - 200, `${t('playerLevel')} ${level}`, {
        fontFamily: FONT,
        fontSize: '38px',
        color: COLORS.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(
        x + w / 2 - 30,
        y - 200,
        atMax ? t('maxLevel') : `${t('xp')}: ${save.xp} / ${xpForLevel(level + 1)}`,
        { fontFamily: FONT, fontSize: '24px', color: COLORS.inkDim }
      )
      .setOrigin(1, 0.5);

    // Полоса опыта
    const barW = w - 60;
    const bar = this.add.graphics();
    bar.fillStyle(0xe2d6c0, 1);
    bar.fillRoundedRect(x - barW / 2, y - 176, barW, 20, 10);
    bar.fillStyle(0x7bc36a, 1);
    const fill = Math.max(0.02, levelProgress(save.xp));
    bar.fillRoundedRect(x - barW / 2, y - 176, barW * fill, 20, 10);

    // Шкала прохождения игры
    const passed = countPassedStages();
    this.add
      .text(x - w / 2 + 30, y - 122, `${t('stagesPassed')}: ${passed} / ${LEVELS.length}`, {
        fontFamily: FONT,
        fontSize: '26px',
        color: COLORS.ink,
      })
      .setOrigin(0, 0.5);

    // Жизни, которые сейчас есть у капибары
    const lives = getMaxLives();
    for (let i = 0; i < lives; i++) {
      this.add.image(x + w / 2 - 30 - i * 34, y - 122, 'heart').setScale(0.7);
    }

    // Статистика
    this.add
      .text(x - w / 2 + 30, y - 70, t('stats'), {
        fontFamily: FONT,
        fontSize: '28px',
        color: COLORS.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const stats = getStats();
    const owned = SHOP_ITEMS.filter((it) => it.kind === 'ability' && hasItem(it.id)).map((it) =>
      t(it.nameKey)
    );
    const rows = [
      [t('statsPlayTime'), formatPlayTime(stats.playMs)],
      [t('coins'), String(stats.coins)],
      [t('treats'), String(stats.treats)],
      [t('neutralized'), String(stats.monsters)],
      [t('abilities'), owned.length ? owned.join(', ') : t('none')],
    ];

    rows.forEach(([label, value], i) => {
      const ry = y - 26 + i * 34;
      this.add
        .text(x - w / 2 + 30, ry, label, {
          fontFamily: FONT,
          fontSize: '22px',
          color: COLORS.inkDim,
        })
        .setOrigin(0, 0.5);
      this.add
        .text(x + w / 2 - 30, ry, value, {
          fontFamily: FONT,
          fontSize: '22px',
          color: COLORS.ink,
          fontStyle: 'bold',
          align: 'right',
          wordWrap: { width: 300 },
        })
        .setOrigin(1, 0.5);
    });

    // Сброс статистики — пока инструмент для тестирования (DEBUG в config.js).
    if (DEBUG.statsReset) {
      makeButton(this, x, y + 190, 300, 56, t('resetAll'), () => this.askResetStats(), {
        fill: COLORS.panel,
        edge: COLORS.panelEdge,
        fontSize: 24,
      });
    }
  }

  buildButtons() {
    const x = 960;

    makeButton(this, x, 320, 380, 104, t('play'), () => this.scene.start('LevelSelectScene'), {
      fontSize: 38,
    });

    makeButton(this, x, 450, 380, 92, t('shop'), () => this.scene.start('ShopScene'), {
      fill: COLORS.green,
      edge: COLORS.greenEdge,
      fontSize: 34,
    });

    // Временные кнопки для тестирования (DEBUG.cheats в config.js).
    // Перед публикацией флаг выключается, и кнопок нет.
    if (DEBUG.cheats) {
      makeButton(
        this,
        x - 100,
        640,
        180,
        56,
        t('cheatLevel'),
        () => {
          // Ровно столько опыта, сколько нужно до следующего уровня.
          const level = getLevel();
          if (level >= MAX_LEVEL) return;
          addXp(xpForLevel(level + 1) - getSave().xp);
          flush();
          this.scene.restart();
        },
        { fill: COLORS.panel, edge: COLORS.panelEdge, fontSize: 22 }
      );
      makeButton(
        this,
        x + 100,
        640,
        180,
        56,
        t('cheatCoins'),
        () => {
          addCoins(10);
          flush();
          this.scene.restart();
        },
        { fill: COLORS.panel, edge: COLORS.panelEdge, fontSize: 22 }
      );
    }

    this.soundBtn = makeButton(
      this,
      x,
      560,
      380,
      70,
      `${t('sound')}: ${isSoundOn() ? t('on') : t('off')}`,
      () => {
        setSound(!isSoundOn());
        this.soundBtn.label.setText(`${t('sound')}: ${isSoundOn() ? t('on') : t('off')}`);
        flush();
      },
      { fill: COLORS.panel, edge: COLORS.panelEdge, fontSize: 26 }
    );
  }

  /** Полный сброс прогресса — только с подтверждением. */
  askResetStats() {
    if (this.confirmBox) return;

    const box = this.add.container(0, 0).setDepth(200);
    box.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5));
    box.add(panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 620, 300));
    box.add(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, t('resetAllAsk'), {
          fontFamily: FONT,
          fontSize: '36px',
          color: COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );
    box.add(
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, t('resetAllNote'), {
          fontFamily: FONT,
          fontSize: '22px',
          color: COLORS.inkDim,
        })
        .setOrigin(0.5)
    );

    const close = () => {
      box.destroy();
      this.confirmBox = null;
    };

    box.add(
      makeButton(this, GAME_WIDTH / 2 - 130, GAME_HEIGHT / 2 + 70, 220, 70, t('yes'), () => {
        resetProgress();
        sfx.click();
        close();
        this.scene.restart();
      })
    );
    box.add(
      makeButton(this, GAME_WIDTH / 2 + 130, GAME_HEIGHT / 2 + 70, 220, 70, t('cancel'), close, {
        fill: COLORS.panel,
        edge: COLORS.panelEdge,
      })
    );

    // Кнопки внутри контейнера должны и попадания считать по экрану, а не
    // по миру (третий аргумент — «и детям тоже»).
    box.setScrollFactor(0, 0, true);

    this.confirmBox = box;
  }

  update(time) {
    this.capy.animate(time, 'walk');
  }
}
