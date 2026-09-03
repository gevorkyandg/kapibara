/**
 * Товары магазина.
 *
 * Две вещи задают цены и доступ:
 *  - требование по уровню игрока — прямо из ТЗ (ускорение 5, двойной прыжок 7,
 *    плащ 10, рогатка 12);
 *  - цена в монетах — от числа монет на первом этапе. Самый дешёвый товар
 *    стоит ровно один пройденный на 100% первый этап. Цена считается из карты
 *    уровня, поэтому правка levels.js двигает и цены.
 *
 * Цены в ТЗ не проставлены («Монеты: ?»), так что это наша калибровка —
 * перед публикацией её можно менять свободно, сохранения от этого не портятся.
 */

import { countCoins } from './levels.js';
import { ABILITIES } from './config.js';

const BASE_PRICE = countCoins(0);
const price = (multiplier) => Math.round((BASE_PRICE * multiplier) / 5) * 5;

export const SHOP_ITEMS = [
  {
    id: 'extraLife',
    kind: 'life', // покупается несколько раз, а не один
    minLevel: 3, // в ТЗ уровень не указан — поставили рано, жизнь нужна новичку
    price: BASE_PRICE,
    icon: 'icon-heart',
    nameKey: 'extraLifeName',
    descKey: 'extraLifeDesc',
  },
  {
    id: 'speedBoost',
    kind: 'ability',
    minLevel: 5,
    price: price(1.5),
    icon: 'icon-boost',
    nameKey: 'speedBoostName',
    descKey: 'speedBoostDesc',
    cooldown: ABILITIES.speedBoost.cooldown,
  },
  {
    id: 'doubleJump',
    kind: 'ability',
    minLevel: 7,
    price: price(2),
    icon: 'icon-jump',
    nameKey: 'doubleJumpName',
    descKey: 'doubleJumpDesc',
    cooldown: ABILITIES.doubleJump.cooldown,
  },
  // Дальше по ТЗ идут плащ (уровень 10) и рогатка (уровень 12). Они появятся
  // здесь, когда будут сделаны сами способности — продавать неработающее нельзя.
];

/**
 * Цена следующего улучшения способности. Каждое дороже предыдущего: первое
 * стоит половину самой способности, дальше прибавляется по четверти.
 *
 * @param {object} item товар из SHOP_ITEMS
 * @param {number} level сколько улучшений уже куплено
 */
export function upgradePrice(item, level) {
  return Math.round((item.price * (0.5 + 0.25 * level)) / 5) * 5;
}
