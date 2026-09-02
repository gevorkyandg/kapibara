import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { createBackground } from '../background.js';
import { SHOP_ITEMS } from '../shop.js';
import { getSave, hasItem, buyItem } from '../save.js';
import { t } from '../i18n.js';
import { makeButton, panel, coinBadge, FONT, COLORS } from '../ui.js';
import { sfx } from '../audio.js';

/**
 * Магазин. Пока два товара, но список берётся из shop.js — новые улучшения
 * добавляются туда одной записью, сцену трогать не нужно.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create() {
    createBackground(this, 1, GAME_WIDTH);

    this.add
      .text(GAME_WIDTH / 2, 80, t('shop'), {
        fontFamily: FONT,
        fontSize: '58px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.wallet = coinBadge(this, 40, 44, getSave().coins, 40);

    this.message = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 130, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const cardW = 420;
    const gap = 60;
    const totalW = SHOP_ITEMS.length * cardW + (SHOP_ITEMS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;

    this.cards = SHOP_ITEMS.map((item, i) => {
      const x = startX + i * (cardW + gap);
      const y = GAME_HEIGHT / 2 - 10;
      panel(this, x, y, cardW, 380);

      this.add.image(x, y - 118, item.icon).setScale(0.9);

      this.add
        .text(x, y - 34, t(item.nameKey), {
          fontFamily: FONT,
          fontSize: '32px',
          color: COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y + 30, t(item.descKey), {
          fontFamily: FONT,
          fontSize: '22px',
          color: COLORS.inkDim,
          align: 'center',
          wordWrap: { width: cardW - 60 },
        })
        .setOrigin(0.5);

      const price = coinBadge(this, x - 40, y + 92, item.price, 30);

      const btn = makeButton(this, x, y + 150, 260, 64, '', () => this.tryBuy(item), {
        fill: COLORS.green,
        edge: COLORS.greenEdge,
      });

      return { item, btn, price };
    });

    this.refresh();

    makeButton(this, 140, GAME_HEIGHT - 60, 200, 66, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });
  }

  tryBuy(item) {
    if (hasItem(item.id)) return;

    if (getSave().coins < item.price) {
      // Не хватает монеток — говорим об этом, а не молчим.
      this.message.setText(t('notEnough'));
      this.tweens.add({ targets: this.message, scale: { from: 1.2, to: 1 }, duration: 250 });
      sfx.fail();
      return;
    }

    buyItem(item.id, item.price);
    sfx.buy();
    this.message.setText('');
    this.refresh();
  }

  refresh() {
    this.wallet.value.setText(String(getSave().coins));
    this.cards.forEach(({ item, btn, price }) => {
      const owned = hasItem(item.id);
      btn.label.setText(owned ? t('bought') : t('buy'));
      btn.setEnabled(!owned);
      price.setAlpha(owned ? 0.35 : 1);
    });
  }
}
