/**
 * Уровни игрока, опыт и звёзды за этап — правила из ТЗ.
 *
 * Главная идея кривой опыта: она НЕ прибита гвоздями к числам, а считается из
 * того, сколько содержимого сейчас в игре. ТЗ требует, чтобы игрок, пройдя все
 * этапы на максимум, вышел на 10-й уровень. Значит порог 10-го уровня — это и
 * есть весь опыт кампании. Добавятся этапы — кривая растянется сама, и её не
 * придётся пересчитывать руками.
 */

import { LEVELS, buildLevelMap } from './levels.js';

/** Потолок уровня игрока (ТЗ). */
export const MAX_LEVEL = 15;

/** Уровень, на который игрок должен выйти, пройдя всю кампанию на максимум. */
export const LEVEL_AFTER_CAMPAIGN = 10;

/** Сколько опыта за что дают. */
export const XP = {
  // За этап — по числу звёзд. 0 звёзд = этап не пройден = 0 опыта (ТЗ).
  stage: [0, 30, 60, 100],
  // Монстры по сложности. Пока в игре только простые.
  monster: { easy: 2, medium: 4, hard: 8 },
  // Сладости (ТЗ): капкейк 1, мороженое 2, ломтик тортика 3.
  treat: { cupcake: 1, icecream: 2, cake: 3 },
};

/**
 * Что даёт каждый уровень игрока. В ТЗ это «очки» без размерности —
 * здесь они переведены в пиксели, и это главные ручки баланса.
 */
export const LEVEL_BONUS = {
  speedPerLevel: 6, // px/с к скорости за каждый уровень
  jumpPerTwoLevels: 10, // px/с к силе прыжка каждые два уровня
  levelsPerExtraLife: 5, // каждые 5 уровней +1 максимальная жизнь
  // Две жизни с самого начала. С одной любое касание монстра сразу
  // проваливало этап, и сердечко-подбор лежало мёртвым грузом: возвращать
  // было нечего.
  baseLives: 2,
};

/** Средняя цена сладости в опыте — для прикидки, сколько их даст кампания. */
const AVG_TREAT_XP = (XP.treat.cupcake + XP.treat.icecream + XP.treat.cake) / 3;

/** Символы монстров на карте — по ним считается опыт за этап. */
const МОНСТРЫ = new Set(['m', 'f', 'l', 'e', 'b', 'd', 'w', 'j', 'z', 'H']);

/** Сколько опыта можно выжать из одного этапа при идеальном прохождении. */
export function stageMaxXp(index) {
  const map = buildLevelMap(index);
  let monsters = 0;
  let treatSpots = 0;
  for (const row of map) {
    for (const ch of row) {
      if (МОНСТРЫ.has(ch)) monsters++;
      else if (ch === '*') treatSpots++;
    }
  }
  return (
    XP.stage[3] +
    monsters * XP.monster.easy +
    Math.round(treatSpots * AVG_TREAT_XP)
  );
}

/** Весь опыт кампании — сумма по всем этапам. */
export function campaignXp() {
  return LEVELS.reduce((sum, _level, i) => sum + stageMaxXp(i), 0);
}

/**
 * Сколько всего опыта нужно, чтобы стоять на этом уровне.
 * Кривая слегка ускоряется к концу: ранние уровни даются быстро, поздние —
 * заметно медленнее, и последние пять требуют переигрывать этапы.
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  const share = ((level - 1) / (LEVEL_AFTER_CAMPAIGN - 1)) ** 1.6;
  return Math.round((campaignXp() * share) / 10) * 10;
}

export function levelFromXp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Прогресс внутри текущего уровня: 0..1 — для полоски в меню. */
export function levelProgress(xp) {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return to > from ? (xp - from) / (to - from) : 1;
}

/** Прибавки от уровня: они и делают поздние этапы проходимыми. */
export function levelBonuses(level) {
  return {
    speed: (level - 1) * LEVEL_BONUS.speedPerLevel,
    jump: Math.floor((level - 1) / 2) * LEVEL_BONUS.jumpPerTwoLevels,
    lives: LEVEL_BONUS.baseLives + Math.floor(level / LEVEL_BONUS.levelsPerExtraLife),
  };
}

/**
 * Звёзды за этап (ТЗ).
 *
 * В ТЗ два утверждения спорят между собой: «100% — 3 звезды» и «чтобы
 * получить 3 звезды, нужно не потерять здоровье». Считаем строже:
 * три звезды — это 100% монет И ни одной потерянной жизни. Собрал всё, но
 * получил урон — две звезды.
 *
 * @param {number} percent доля собранных монет, 0..1
 * @param {boolean} lostLife терял ли игрок жизнь на этапе
 */
export function starsFor(percent, lostLife) {
  if (percent >= 1 - 1e-6) return lostLife ? 2 : 3;
  if (percent >= 0.9) return 2;
  if (percent >= 0.5) return 1;
  return 0;
}

/** Порог, ниже которого этап считается непройденным (ТЗ: 49% и меньше). */
export const PASS_PERCENT = 0.5;
