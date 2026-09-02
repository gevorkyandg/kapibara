/**
 * Все числа игры в одном месте. Правится здесь — меняется везде.
 */

// Логический размер кадра. Реальный экран растягивает Phaser.Scale.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Уровни рисуются символами на сетке: 12 рядов по 60 пикселей = 720.
export const TILE = 60;
export const ROWS = 12;

/** Физика и ощущения от управления. */
export const PHYS = {
  gravity: 1750,
  walkSpeed: 240,
  jumpVelocity: -800, // высота прыжка ~183 px (3 клетки), в воздухе ~0.91 с
  // Из этих двух чисел следует: максимальная перепрыгиваемая пропасть — 3 клетки.
  // Уровни спроектированы под это, ускорение для прохождения НЕ обязательно.
  maxFallSpeed: 1200,
  bounceOnEnemy: -520, // отскок, когда капибара приземлилась на монстрика
};

/** Улучшения из магазина. */
export const ABILITIES = {
  doubleJump: {
    cooldown: 6000, // мс, отсчитывается от момента использования
  },
  speedBoost: {
    multiplier: 2,
    duration: 2000,
    cooldown: 6000,
  },
};

/**
 * Звёзды за уровень — по доле собранных монет (вкусняшки не в счёт).
 * Меньше 50% — уровень не пройден.
 */
export const STAR_RULES = [
  { stars: 3, percent: 1.0 },
  { stars: 2, percent: 0.7 },
  { stars: 1, percent: 0.5 },
];

/**
 * Реклама. Межстраничную показываем только между уровнями и редко: частая
 * реклама сбивает рейтинг вовлечения, а по нему Яндекс снимает игры с витрины.
 * Чтобы отключить на время разработки — поставьте false.
 */
export const ADS = {
  interstitialOnLevelEnd: true,
  minIntervalMs: 180000, // не чаще раза в 3 минуты
};

/** Сколько монет даёт вкусняшка (на рейтинг не влияет). */
export const TREAT_COINS = 5;

/** Шанс, что в помеченной точке появится вкусняшка. */
export const TREAT_CHANCE = 0.55;

export function starsForPercent(percent) {
  for (const rule of STAR_RULES) {
    if (percent >= rule.percent - 1e-6) return rule.stars;
  }
  return 0;
}
