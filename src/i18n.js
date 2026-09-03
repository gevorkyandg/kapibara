/**
 * Локализация. Яндекс требует автоопределение языка через SDK: русский для
 * ru/be/kk/uk/uz, английский для остального мира.
 *
 * Словарь плоский, и в строках бывают подстановки вида {n} — см. t().
 */

const STRINGS = {
  ru: {
    title: 'Капибара',
    subtitle: 'приключение',
    play: 'Играть',
    shop: 'Магазин',
    back: 'Назад',
    stageSelect: 'Выбор этапа',
    stage: 'Этап',
    locked: 'Закрыто',
    lockedHint: 'Пройдите предыдущий этап',
    coins: 'Монетки',
    buy: 'Купить',
    bought: 'Куплено',
    notEnough: 'Не хватает монеток',
    needLevel: 'Нужен уровень {n}',
    boughtOf: 'Куплено {n} из {m}',

    doubleJumpName: 'Двойной прыжок',
    doubleJumpDesc: 'Второй прыжок в воздухе. Перезарядка 6 сек.',
    speedBoostName: 'Ускорение',
    speedBoostDesc: 'Двойная скорость на 2 сек. Перезарядка 6 сек.',
    extraLifeName: 'Ещё одна жизнь',
    extraLifeDesc: 'Максимум жизней больше на одну.',

    // Игрок и прогресс
    playerLevel: 'Уровень',
    xp: 'Опыт',
    lives: 'Жизни',
    levelUp: 'Новый уровень!',
    stagesPassed: 'Пройдено этапов',
    maxLevel: 'Максимум',

    // Итоги этапа
    stageDone: 'Этап пройден!',
    stageFailed: 'Мало монеток',
    failedHint: 'Нужно собрать хотя бы 50%',
    outOfLives: 'Жизни закончились',
    outOfLivesHint: 'Этап придётся пройти заново',
    collected: 'Собрано',
    treats: 'Сладости',
    neutralized: 'Обезврежено',
    time: 'Время',
    xpGained: 'Опыт за этап',
    retry: 'Заново',
    next: 'Дальше',
    menu: 'В меню',

    // Статистика
    stats: 'Статистика',
    statsPlayTime: 'Время в игре',
    statsReset: 'Сбросить',
    statsResetAsk: 'Сбросить статистику?',
    statsResetNote: 'Пройденные этапы и покупки останутся',
    yes: 'Сбросить',
    cancel: 'Отмена',
    abilities: 'Способности',
    none: 'пока нет',

    pause: 'Пауза',
    resume: 'Продолжить',
    hintMove: 'Стрелки или A/D — идти',
    hintJump: 'Пробел или ↑ — прыжок',
    hintBoost: 'Shift — ускорение',
    sound: 'Звук',
    on: 'вкл',
    off: 'выкл',
    loading: 'Загрузка...',
  },

  en: {
    title: 'Capybara',
    subtitle: 'adventure',
    play: 'Play',
    shop: 'Shop',
    back: 'Back',
    stageSelect: 'Select stage',
    stage: 'Stage',
    locked: 'Locked',
    lockedHint: 'Finish the previous stage',
    coins: 'Coins',
    buy: 'Buy',
    bought: 'Owned',
    notEnough: 'Not enough coins',
    needLevel: 'Requires level {n}',
    boughtOf: 'Bought {n} of {m}',

    doubleJumpName: 'Double jump',
    doubleJumpDesc: 'A second jump in mid-air. 6 sec cooldown.',
    speedBoostName: 'Speed boost',
    speedBoostDesc: 'Double speed for 2 sec. 6 sec cooldown.',
    extraLifeName: 'One more life',
    extraLifeDesc: 'Raises your maximum lives by one.',

    playerLevel: 'Level',
    xp: 'XP',
    lives: 'Lives',
    levelUp: 'Level up!',
    stagesPassed: 'Stages cleared',
    maxLevel: 'Max',

    stageDone: 'Stage complete!',
    stageFailed: 'Too few coins',
    failedHint: 'Collect at least 50%',
    outOfLives: 'Out of lives',
    outOfLivesHint: 'The stage starts over',
    collected: 'Collected',
    treats: 'Sweets',
    neutralized: 'Neutralized',
    time: 'Time',
    xpGained: 'XP earned',
    retry: 'Retry',
    next: 'Next',
    menu: 'Menu',

    stats: 'Statistics',
    statsPlayTime: 'Time played',
    statsReset: 'Reset',
    statsResetAsk: 'Reset statistics?',
    statsResetNote: 'Cleared stages and purchases stay',
    yes: 'Reset',
    cancel: 'Cancel',
    abilities: 'Abilities',
    none: 'none yet',

    pause: 'Paused',
    resume: 'Resume',
    hintMove: 'Arrows or A/D to walk',
    hintJump: 'Space or Up to jump',
    hintBoost: 'Shift to dash',
    sound: 'Sound',
    on: 'on',
    off: 'off',
    loading: 'Loading...',
  },
};

// Языки, для которых показываем русский. Всем остальным — английский.
const RU_LANGS = ['ru', 'be', 'kk', 'uk', 'uz'];

let current = 'ru';

export function setLanguage(lang) {
  current = RU_LANGS.includes(String(lang || '').slice(0, 2)) ? 'ru' : 'en';
  return current;
}

export function getLanguage() {
  return current;
}

/**
 * @param {string} key ключ из STRINGS
 * @param {object} [vars] подстановки: t('needLevel', {n: 5})
 */
export function t(key, vars) {
  const raw = STRINGS[current][key] ?? STRINGS.ru[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name) => vars[name] ?? `{${name}}`);
}

/** Время в виде 01:23 — так его показывает таймер и экран итогов. */
export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
