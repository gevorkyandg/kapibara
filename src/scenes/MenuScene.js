import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { createBackground } from '../background.js';
import { createCapybara } from '../capybara.js';
import { getSave, isSoundOn, setSound, flush } from '../save.js';
import { t } from '../i18n.js';
import { makeButton, coinBadge, FONT, COLORS } from '../ui.js';
import { unlockAudio } from '../audio.js';
import { platform } from '../platform/index.js';

/** Главное меню: кошелёк, кнопки «Играть» и «Магазин», звук. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    platform.gameplayStop(); // в меню геймплея нет
    createBackground(this, 0, GAME_WIDTH);

    // Земля под капибарой
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 60, 'ground-0');

    this.add
      .text(GAME_WIDTH / 2, 120, t('title'), {
        fontFamily: FONT,
        fontSize: '86px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 186, t('subtitle'), {
        fontFamily: FONT,
        fontSize: '38px',
        color: '#fff3d0',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    // Капибара гуляет по меню туда-сюда — сразу видно, кто главный герой.
    this.capy = createCapybara(this, 300, GAME_HEIGHT - 92, 0.9);
    this.tweens.add({
      targets: this.capy,
      x: GAME_WIDTH - 300,
      duration: 6000,
      yoyo: true,
      repeat: -1,
      onYoyo: () => this.capy.face(-1),
      onRepeat: () => this.capy.face(1),
    });

    makeButton(this, GAME_WIDTH / 2, 330, 340, 92, t('play'), () => {
      this.scene.start('LevelSelectScene');
    });

    makeButton(
      this,
      GAME_WIDTH / 2,
      440,
      340,
      82,
      t('shop'),
      () => this.scene.start('ShopScene'),
      { fill: COLORS.green, edge: COLORS.greenEdge }
    );

    // Кошелёк
    coinBadge(this, 40, 44, getSave().coins, 40);

    this.soundBtn = makeButton(
      this,
      GAME_WIDTH - 90,
      46,
      120,
      56,
      isSoundOn() ? '🔊' : '🔈',
      () => {
        setSound(!isSoundOn());
        this.soundBtn.label.setText(isSoundOn() ? '🔊' : '🔈');
        flush();
      },
      { fill: COLORS.panel, edge: COLORS.panelEdge, fontSize: 26 }
    );

    // Звук в браузере включается только после действия игрока.
    this.input.once('pointerdown', unlockAudio);
    this.input.keyboard.once('keydown', unlockAudio);
  }

  update(time) {
    this.capy.animate(time, 'walk');
  }
}
