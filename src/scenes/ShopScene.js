import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { createBackground } from '../background.js';
import { SHOP_ITEMS, upgradePrice, ценаЖизни } from '../shop.js';
import {
  getSave,
  getLevel,
  hasItem,
  buyItem,
  buyUpgrade,
  getUpgrade,
  getAbility,
  buyExtraLife,
  getExtraLives,
  MAX_BOUGHT_LIVES,
} from '../save.js';
import { t } from '../i18n.js';
import { makeButton, panel, coinBadge, FONT, COLORS } from '../ui.js';
import { sfx } from '../audio.js';

/** Секунды с одним знаком после запятой: 2 сек, 2,7 сек. */
function sec(ms) {
  const value = Math.round(ms / 100) / 10;
  return String(value).replace('.', ',');
}

/**
 * Магазин. Товары берутся из shop.js — новое улучшение добавляется туда одной
 * записью, сцену трогать не нужно.
 *
 * Доступ к товару по ТЗ двойной: нужен и уровень игрока, и монеты. Купленную
 * способность можно улучшать несколько раз, каждый раз дороже предыдущего.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create() {
    createBackground(this, 1, GAME_WIDTH);

    this.add
      .text(GAME_WIDTH / 2, 62, t('shop'), {
        fontFamily: FONT,
        fontSize: '50px',
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
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 122, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // Карточек уже пять — ширина считается от их числа, иначе они не влезут.
    const gap = 16;
    const margin = 40;
    const cardW = Math.min(380, (GAME_WIDTH - margin * 2 - (SHOP_ITEMS.length - 1) * gap) / SHOP_ITEMS.length);
    const totalW = SHOP_ITEMS.length * cardW + (SHOP_ITEMS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;

    this.cards = SHOP_ITEMS.map((item, i) => this.buildCard(item, startX + i * (cardW + gap), 372, cardW));

    this.refresh();

    makeButton(this, 140, GAME_HEIGHT - 52, 200, 62, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });
  }

  buildCard(item, x, y, cardW) {
    panel(this, x, y, cardW, 470);

    const scale = cardW / 380;
    this.add.image(x, y - 168, item.icon).setScale(0.8 * scale);

    this.add
      .text(x, y - 96, t(item.nameKey), {
        fontFamily: FONT,
        fontSize: `${Math.round(29 * scale)}px`,
        color: COLORS.ink,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: cardW - 50 },
      })
      .setOrigin(0.5);

    this.add
      .text(x, y - 44, t(item.descKey), {
        fontFamily: FONT,
        fontSize: `${Math.round(20 * scale)}px`,
        color: COLORS.inkDim,
        align: 'center',
        wordWrap: { width: cardW - 50 },
      })
      .setOrigin(0.5);

    // Полоска купленных улучшений — сразу видно, сколько ещё можно взять.
    const pips = this.add.graphics();

    // Что даёт следующее улучшение и какие числа сейчас
    const state = this.add
      .text(x, y + 40, '', {
        fontFamily: FONT,
        fontSize: `${Math.round(19 * scale)}px`,
        color: COLORS.ink,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: cardW - 40 },
      })
      .setOrigin(0.5, 0);

    const price = coinBadge(this, x - 34, y + 140, item.price, 28 * scale);
    const btn = makeButton(this, x, y + 190, cardW - 40, 58, '', () => this.onCardButton(item), {
      fontSize: Math.round(28 * scale),
      fill: COLORS.green,
      edge: COLORS.greenEdge,
    });

    return { item, x, y, cardW, pips, state, price, btn };
  }

  /** Одна кнопка на карточке: сначала покупает, потом улучшает. */
  onCardButton(item) {
    const level = getLevel();
    if (level < item.minLevel) {
      this.say(t('needLevel', { n: item.minLevel }));
      return;
    }

    if (item.kind === 'life') {
      const цена = ценаЖизни(getExtraLives());
      this.pay(() => buyExtraLife(цена), цена);
      return;
    }

    if (!hasItem(item.id)) {
      this.pay(() => buyItem(item.id, item.price), item.price);
      return;
    }

    const next = upgradePrice(item, getUpgrade(item.id));
    this.pay(() => buyUpgrade(item.id, next), next);
  }

  /** Общая часть покупки: проверить монеты, купить, обновить витрину. */
  pay(action, price) {
    if (getSave().coins < price) {
      this.say(t('notEnough'));
      return;
    }
    if (!action()) return;

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

    this.cards.forEach((card) => this.refreshCard(card, level));
  }

  refreshCard({ item, x, y, cardW, pips, state, price, btn }, level) {
    const locked = level < item.minLevel;

    // Жизни — просто несколько одинаковых покупок
    if (item.kind === 'life') {
      const bought = getExtraLives();
      const maxed = bought >= MAX_BOUGHT_LIVES;
      this.drawPips(pips, x, y + 8, MAX_BOUGHT_LIVES, bought);
      state.setText(
        locked ? t('needLevel', { n: item.minLevel }) : t('boughtOf', { n: bought, m: MAX_BOUGHT_LIVES })
      );
      const цена = ценаЖизни(bought);
      const affordable = getSave().coins >= цена;
      price.value.setText(String(цена));
      price.setAlpha(maxed ? 0.35 : 1);
      btn.label.setText(maxed ? t('bought') : t('buy'));
      btn.setEnabled(!maxed && !locked && affordable);
      return;
    }

    const owned = hasItem(item.id);
    const ability = getAbility(item.id);
    const maxed = owned && ability.level >= ability.maxLevel;

    this.drawPips(pips, x, y + 8, ability.maxLevel, ability.level);

    const lines = [];
    if (locked) {
      lines.push(t('needLevel', { n: item.minLevel }));
    } else if (!owned) {
      lines.push(t('upgradesAvailable', { n: ability.maxLevel }));
    } else {
      // Текущие числа способности и что изменится после улучшения
      lines.push(`${t('cooldown')}: ${sec(ability.cooldown)} ${t('secShort')}`);
      if (ability.duration) lines.push(`${t('duration')}: ${sec(ability.duration)} ${t('secShort')}`);
      lines.push(
        maxed
          ? t('fullyUpgraded')
          : t('upgradeOf', { n: ability.level + 1, m: ability.maxLevel })
      );
    }
    state.setText(lines.join('\n'));

    const nextPrice = owned && !maxed ? upgradePrice(item, ability.level) : item.price;
    const affordable = getSave().coins >= nextPrice;
    price.value.setText(String(nextPrice));
    price.setAlpha(maxed ? 0.35 : 1);

    btn.label.setText(maxed ? t('bought') : owned ? t('upgrade') : t('buy'));
    // Не хватает монет — кнопка серая: понятно до нажатия, а не после.
    btn.setEnabled(!maxed && !locked && affordable);
  }

  /** Точки-деления: сколько улучшений уже куплено из возможных. */
  drawPips(g, x, y, total, filled) {
    g.clear();
    if (!total) return;
    const step = 22;
    const startX = x - ((total - 1) * step) / 2;
    for (let i = 0; i < total; i++) {
      g.fillStyle(i < filled ? 0x7bc36a : 0xe2d6c0, 1);
      g.fillCircle(startX + i * step, y, 7);
      g.lineStyle(3, i < filled ? 0x4f9c45 : 0xc9b99c, 1);
      g.strokeCircle(startX + i * step, y, 7);
    }
  }
}
