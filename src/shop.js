/**
 * Товары магазина.
 *
 * Цена самого дешёвого улучшения равна числу монет на первом уровне: чтобы
 * купить первое улучшение, нужно пройти уровень 1 на 100%. Цена считается
 * из самого уровня — переставите монетки в levels.js, цена подстроится сама.
 */

import { countCoins } from './levels.js';
import { ABILITIES } from './config.js';

const BASE_PRICE = countCoins(0);

export const SHOP_ITEMS = [
  {
    id: 'doubleJump',
    price: BASE_PRICE,
    icon: 'icon-jump',
    nameKey: 'doubleJumpName',
    descKey: 'doubleJumpDesc',
    cooldown: ABILITIES.doubleJump.cooldown,
  },
  {
    id: 'speedBoost',
    // Второе улучшение дороже: ещё один полный уровень плюс вкусняшки.
    price: Math.round((BASE_PRICE * 1.6) / 5) * 5,
    icon: 'icon-boost',
    nameKey: 'speedBoostName',
    descKey: 'speedBoostDesc',
    cooldown: ABILITIES.speedBoost.cooldown,
  },
];
