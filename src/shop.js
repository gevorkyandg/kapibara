/**
 * Товары магазина.
 *
 * Цены и требования по уровню проставлены числами, а не выведены из числа
 * монет на первом этапе, как было раньше. Так их видно с одного взгляда и
 * можно править, не пересчитывая карту: правка этапа больше не двигает
 * магазин у тех, кто уже играет.
 */

import { ABILITIES } from './config.js';

/**
 * Дополнительные жизни дорожают резко: первая 50, вторая 150.
 *
 * Первая — это подстраховка новичку, и она должна быть по карману сразу.
 * Вторая уже меняет правила этапа, поэтому за неё платят втрое.
 */
export const ЦЕНЫ_ЖИЗНЕЙ = [50, 150];

export function ценаЖизни(куплено) {
  return ЦЕНЫ_ЖИЗНЕЙ[Math.min(куплено, ЦЕНЫ_ЖИЗНЕЙ.length - 1)];
}

export const SHOP_ITEMS = [
  {
    id: 'extraLife',
    kind: 'life', // покупается несколько раз, а не один
    minLevel: 3, // жизнь нужна новичку раньше всего прочего
    price: ЦЕНЫ_ЖИЗНЕЙ[0],
    icon: 'icon-heart',
    nameKey: 'extraLifeName',
    descKey: 'extraLifeDesc',
  },
  {
    id: 'speedBoost',
    kind: 'ability',
    minLevel: 3,
    price: 100,
    icon: 'icon-boost',
    nameKey: 'speedBoostName',
    descKey: 'speedBoostDesc',
    cooldown: ABILITIES.speedBoost.cooldown,
  },
  {
    id: 'doubleJump',
    kind: 'ability',
    minLevel: 5,
    price: 130,
    icon: 'icon-jump',
    nameKey: 'doubleJumpName',
    descKey: 'doubleJumpDesc',
    cooldown: ABILITIES.doubleJump.cooldown,
  },
  {
    id: 'cloak',
    kind: 'ability',
    minLevel: 7,
    price: 150,
    icon: 'icon-cloak',
    nameKey: 'cloakName',
    descKey: 'cloakDesc',
    cooldown: ABILITIES.cloak.cooldown,
  },
  {
    id: 'slingshot',
    kind: 'ability',
    minLevel: 10,
    price: 200,
    icon: 'icon-slingshot',
    nameKey: 'slingshotName',
    descKey: 'slingshotDesc',
    cooldown: ABILITIES.slingshot.cooldown,
  },
];

/**
 * Цена следующего улучшения: полсотни сверх прошлой цены.
 *
 * Цепочка простая и предсказуемая. Ускорение стоит 100 — значит его ступени
 * идут по 150, 200, 250. Игроку не нужно гадать, во что обойдётся следующая:
 * она всегда на полсотни дороже предыдущей покупки.
 *
 * @param {object} item товар из SHOP_ITEMS
 * @param {number} level сколько улучшений уже куплено
 */
export const ШАГ_УЛУЧШЕНИЯ = 50;

export function upgradePrice(item, level) {
  return item.price + ШАГ_УЛУЧШЕНИЯ * (level + 1);
}
