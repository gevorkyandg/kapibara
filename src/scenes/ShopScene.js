import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { createBackground } from '../background.js';
import { SHOP_ITEMS } from '../shop.js';
import {
  getSave,
  getLevel,
  hasItem,
  buyItem,
  buyExtraLife,
  getExtraLives,
  MAX_BOUGHT_LIVES,
} from '../save.js';
import { t } from '../i18n.js';
import { makeButton, panel, coinBadge, FONT, COLORS } from '../ui.js';
import { sfx } from '../audio.js';

/**
 * Магазин. Товары берутся из shop.js — новое улучшение добавляется туда одной
 * записью, сцену трогать не нужно.
 *
 * Доступ к товару по ТЗ двойной: нужен и уровень игрока, и монеты.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create() {
    createBackground(this, 1, GAME_WIDTH);

    this.add
      .text(GAME_WIDTH / 2, 70, t('shop'), {
        fontFamily: FONT,
        fontSize: '54px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.wallet = coinBadge(this, 40, 44, getSave().coins, 40);

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

    this.message = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 128, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const cardW = 380;
    const gap = 28;
    const totalW = SHOP_ITEMS.length * cardW + (SHOP_ITEMS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;

    this.cards = SHOP_ITEMS.map((item, i) => {
      const x = startX + i * (cardW + gap);
      const y = GAME_HEIGHT / 2 - 10;
      panel(this, x, y, cardW, 400);

      this.add.image(x, y - 130, item.icon).setScale(0.85);

      this.add
        .text(x, y - 50, t(item.nameKey), {
          fontFamily: FONT,
          fontSize: '30px',
          color: COLORS.ink,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: cardW - 50 },
        })
        .setOrigin(0.5);

      this.add
        .text(x, y + 12, t(item.descKey), {
          fontFamily: FONT,
          fontSize: '21px',
          color: COLORS.inkDim,
          align: 'center',
          wordWrap: { width: cardW - 50 },
        })
        .setOrigin(0.5);

      const price = coinBadge(this, x - 40, y + 82, item.price, 30);

      // Строка состояния: сколько куплено или какой уровень нужен.
      const note = this.add
        .text(x, y + 122, '', { fontFamily: FONT, fontSize: '20px', color: COLORS.inkDim })
        .setOrigin(0.5);

      const btn = makeButton(this, x, y + 165, 260, 62, '', () => this.tryBuy(item), {
        fill: COLORS.green,
        edge: COLORS.greenEdge,
      });

      return { item, btn, price, note };
    });

    this.refresh();

    makeButton(this, 140, GAME_HEIGHT - 56, 200, 64, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });
  }

  tryBuy(item) {
    const level = getLevel();
    if (level < item.minLevel) {
      this.say(t('needLevel', { n: item.minLevel }));
      return;
    }
    if (getSave().coins < item.price) {
      this.say(t('notEnough'));
      return;
    }

    const bought = item.kind === 'life' ? buyExtraLife(item.price) : buyItem(item.id, item.price);
    if (!bought) return;

    sfx.buy();
    this.message.setText('');
    this.refresh();
  }

  /** Сказать игроку, почему не получилось: молчащая кнопка раздражает. */
  say(text) {
    this.message.setText(text);
    this.tweens.add({ targets: this.message, scale: { from: 1.15, to: 1 }, duration: 250 });
    sfx.fail();
  }

  refresh() {
    const level = getLevel();
    this.wallet.value.setText(String(getSave().coins));

    this.cards.forEach(({ item, btn, price, note }) => {
      const locked = level < item.minLevel;
      const lives = getExtraLives();
      const owned = item.kind === 'life' ? lives >= MAX_BOUGHT_LIVES : hasItem(item.id);

      if (item.kind === 'life') {
        note.setText(locked ? t('needLevel', { n: item.minLevel }) : t('boughtOf', { n: lives, m: MAX_BOUGHT_LIVES }));
      } else {
        note.setText(locked ? t('needLevel', { n: item.minLevel }) : '');
      }

      btn.label.setText(owned ? t('bought') : t('buy'));
      btn.setEnabled(!owned && !locked);
      price.setAlpha(owned ? 0.35 : 1);
    });
  }
}
