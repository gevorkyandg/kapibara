/**
 * Прогресс игрока: кошелёк, купленные улучшения, звёзды за уровни.
 *
 * Записи буферизуются. У Яндекса лимит setData — 100 запросов за 5 минут,
 * и сохранять по событию (каждая монетка) нельзя: упрёмся в лимит и записи
 * начнут отваливаться. Поэтому save() только помечает данные грязными,
 * а реальная запись идёт не чаще раза в SAVE_INTERVAL и по flush().
 */

import { platform } from './platform/index.js';

const SAVE_INTERVAL = 3000;

const DEFAULT_SAVE = {
  v: 1,
  coins: 0,
  items: { doubleJump: false, speedBoost: false },
  levels: {}, // { "0": { stars: 0..3, best: 0..1 } }
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
    };
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

/** Записать немедленно (конец уровня, покупка, уход в меню). */
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

export function addCoins(amount) {
  data.coins = Math.max(0, data.coins + amount);
  markDirty();
}

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

/** Результат уровня: сохраняем только если он лучше прошлого. */
export function recordLevel(index, percent, stars) {
  const key = String(index);
  const prev = data.levels[key] || { stars: 0, best: 0 };
  data.levels[key] = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, percent),
  };
  markDirty();
  flush();
}

export function getLevelResult(index) {
  return data.levels[String(index)] || { stars: 0, best: 0 };
}

/** Первый уровень открыт всегда, следующий — когда предыдущий пройден. */
export function isLevelUnlocked(index) {
  if (index === 0) return true;
  return getLevelResult(index - 1).stars > 0;
}

export function isSoundOn() {
  return data.sound !== false;
}

export function setSound(on) {
  data.sound = on;
  markDirty();
}
