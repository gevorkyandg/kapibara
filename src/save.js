/**
 * Прогресс игрока: кошелёк, опыт, купленные улучшения, результаты этапов
 * и общая статистика.
 *
 * Записи буферизуются. У Яндекса лимит setData — 100 запросов за 5 минут,
 * и сохранять по событию (каждая монетка) нельзя: упрёмся в лимит и записи
 * начнут отваливаться. Поэтому markDirty() только помечает данные грязными,
 * а реальная запись идёт не чаще раза в SAVE_INTERVAL и по flush().
 */

import { platform } from './platform/index.js';
import { XP, levelFromXp, levelBonuses, MAX_LEVEL } from './progression.js';

const SAVE_INTERVAL = 3000;

/** Сколько дополнительных жизней можно купить в магазине (ТЗ: максимум 2). */
export const MAX_BOUGHT_LIVES = 2;

const DEFAULT_SAVE = {
  v: 2,
  coins: 0,
  xp: 0,
  items: { doubleJump: false, speedBoost: false, cloak: false, slingshot: false },
  extraLives: 0, // купленные жизни, 0..MAX_BOUGHT_LIVES
  levels: {}, // { "0": { stars: 0..3, best: 0..1, bestTime: мс } }
  stats: { playMs: 0, coins: 0, treats: 0, monsters: 0, stages: 0 },
  sound: true,
};

let data = structuredClone(DEFAULT_SAVE);
let dirty = false;
let lastWrite = 0;
let timer = null;

export function getSave() {
  return data;
}

export async function loadSave() {
  const raw = await platform.loadProgress();
  if (raw && typeof raw === 'object') {
    data = {
      ...structuredClone(DEFAULT_SAVE),
      ...raw,
      items: { ...DEFAULT_SAVE.items, ...(raw.items || {}) },
      levels: { ...(raw.levels || {}) },
      stats: { ...DEFAULT_SAVE.stats, ...(raw.stats || {}) },
    };

    // Сохранения первой версии не знали про опыт. Начислим его задним числом
    // по уже заработанным звёздам, чтобы прогресс не пропал.
    if (!raw.v || raw.v < 2) {
      data.xp = Object.values(data.levels).reduce(
        (sum, r) => sum + (XP.stage[r?.stars ?? 0] || 0),
        0
      );
      data.v = 2;
    }
  }
  return data;
}

/** Пометить прогресс изменённым; запись произойдёт сама, с задержкой. */
export function markDirty() {
  dirty = true;
  if (timer) return;
  const wait = Math.max(0, SAVE_INTERVAL - (Date.now() - lastWrite));
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, wait);
}

/** Записать немедленно (конец этапа, покупка, уход в меню). */
export function flush() {
  if (!dirty) return;
  dirty = false;
  lastWrite = Date.now();
  platform.saveProgress(data);
}

// Игрок сворачивает вкладку или закрывает игру — дописываем то, что ещё
// лежало в буфере. Иначе можно потерять последние секунды прогресса, а этого
// площадка не прощает.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flush();
});
window.addEventListener('pagehide', flush);

// ── Кошелёк и опыт ─────────────────────────────────────────────────────────

export function addCoins(amount) {
  data.coins = Math.max(0, data.coins + amount);
  markDirty();
}

export function addXp(amount) {
  if (amount <= 0) return;
  data.xp += amount;
  markDirty();
}

export function getLevel() {
  return levelFromXp(data.xp);
}

/** Прибавки к скорости, прыжку и жизням от текущего уровня. */
export function getBonuses() {
  return levelBonuses(getLevel());
}

export function isMaxLevel() {
  return getLevel() >= MAX_LEVEL;
}

/** Сколько всего жизней у игрока: базовые + за уровни + купленные. */
export function getMaxLives() {
  return getBonuses().lives + (data.extraLives || 0);
}

// ── Магазин ────────────────────────────────────────────────────────────────

export function hasItem(id) {
  return Boolean(data.items[id]);
}

/** @returns {boolean} удалось ли купить */
export function buyItem(id, price) {
  if (data.items[id] || data.coins < price) return false;
  data.coins -= price;
  data.items[id] = true;
  markDirty();
  flush();
  return true;
}

export function getExtraLives() {
  return data.extraLives || 0;
}

export function buyExtraLife(price) {
  if (getExtraLives() >= MAX_BOUGHT_LIVES || data.coins < price) return false;
  data.coins -= price;
  data.extraLives = getExtraLives() + 1;
  markDirty();
  flush();
  return true;
}

// ── Результаты этапов ──────────────────────────────────────────────────────

/**
 * Итог этапа. Сохраняем только то, что лучше прошлого: звёзды, процент и
 * лучшее время. Опыт начисляется отдельно — и только за прирост звёзд, иначе
 * можно было бы фармить опыт, переигрывая один и тот же лёгкий этап.
 *
 * @returns {number} сколько опыта начислено за этап
 */
export function recordStage(index, { percent, stars, timeMs }) {
  const key = String(index);
  const prev = data.levels[key] || { stars: 0, best: 0, bestTime: 0 };

  const gainedXp = Math.max(0, (XP.stage[stars] || 0) - (XP.stage[prev.stars] || 0));

  data.levels[key] = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, percent),
    bestTime: prev.bestTime && prev.bestTime < timeMs ? prev.bestTime : timeMs,
  };
  if (stars > 0 && prev.stars === 0) data.stats.stages += 1;

  addXp(gainedXp);
  markDirty();
  flush();
  return gainedXp;
}

export function getLevelResult(index) {
  return data.levels[String(index)] || { stars: 0, best: 0, bestTime: 0 };
}

/** Первый этап открыт всегда, следующий — когда предыдущий пройден. */
export function isLevelUnlocked(index) {
  if (index === 0) return true;
  return getLevelResult(index - 1).stars > 0;
}

/** Сколько этапов пройдено — для шкалы прохождения в меню. */
export function countPassedStages() {
  return Object.values(data.levels).filter((r) => r.stars > 0).length;
}

// ── Статистика ─────────────────────────────────────────────────────────────

/** @param {{playMs?:number, coins?:number, treats?:number, monsters?:number}} add */
export function addStats(add) {
  for (const [key, value] of Object.entries(add)) {
    if (value) data.stats[key] = (data.stats[key] || 0) + value;
  }
  markDirty();
}

export function getStats() {
  return data.stats;
}

/** Сброс статистики (ТЗ: с подтверждением). Прогресс этапов не трогаем. */
export function resetStats() {
  data.stats = { ...DEFAULT_SAVE.stats, stages: countPassedStages() };
  markDirty();
  flush();
}

// ── Звук ───────────────────────────────────────────────────────────────────

export function isSoundOn() {
  return data.sound !== false;
}

export function setSound(on) {
  data.sound = on;
  markDirty();
}
