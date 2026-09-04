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
    passed: 'Пройдено этапов',
    routeSelect: 'Выбор маршрута',
    stages: 'Этапов',
    stars: 'Звёзды',
    open: 'Открыть',
    route: 'Маршрут',
    stage: 'Этап',
    locked: 'Закрыто',
    lockedHint: 'Пройдите предыдущий этап',
    coins: 'Монетки',
    buy: 'Купить',
    bought: 'Куплено',
    notEnough: 'Не хватает монеток',
    needLevel: 'Нужен уровень {n}',
    boughtOf: 'Куплено {n} из {m}',
    upgrade: 'Улучшить',
    upgradeOf: 'Улучшение {n} из {m}',
    upgradesAvailable: 'Потом можно улучшить {n} раз',
    fullyUpgraded: 'Улучшено полностью',
    cooldown: 'Перезарядка',
    duration: 'Время действия',
    secShort: 'сек',

    doubleJumpName: 'Двойной прыжок',
    doubleJumpDesc: 'Второй прыжок прямо в воздухе.',
    speedBoostName: 'Ускорение',
    speedBoostDesc: 'Ненадолго удваивает скорость бега.',
    cloakName: 'Плащ',
    cloakDesc: 'В падении держите прыжок — капибара планирует.',
    slingshotName: 'Рогатка',
    slingshotDesc: 'Стреляет монеткой и обезвреживает любого монстра.',
    noCoins: 'нет монеток',
    hintFire: 'F — рогатка',
    hintCloak: 'Держите прыжок в падении — плащ',
    extraLifeName: 'Ещё одна жизнь',
    extraLifeDesc: 'Максимум жизней больше на одну.',

    // Игрок и прогресс
    playerLevel: 'Уровень',
    xp: 'Опыт',
    lives: 'Жизни',
    levelUp: 'Новый уровень!',
    bonusSpeed: 'к скорости',
    bonusJump: 'к прыжку',
    bonusLife: 'жизнь',
    statSpeed: 'Скорость бега',
    statJump: 'Высота прыжка',
    stagesPassed: 'Пройдено этапов',
    maxLevel: 'Максимум',

    // Итоги этапа
    stageDone: 'Этап пройден!',
    stageFailed: 'Мало монеток',
    failedHint: 'Нужно собрать хотя бы 50%',
    outOfTime: 'Время вышло',
    outOfTimeHint: 'Этап не пройден: не успели до конца отсчёта.',
    outOfLives: 'Жизни закончились',
    outOfLivesHint: 'Этап придётся пройти заново',
    collected: 'Собрано',
    treats: 'Сладости',
    neutralized: 'Обезврежено',
    time: 'Время',
    xpGained: 'Опыт за этап',
    xpTotal: 'Всего опыта',
    xpShort: 'опыта',
    retry: 'Заново',
    next: 'Дальше',
    menu: 'В меню',

    // Статистика
    stats: 'Статистика',
    statsPlayTime: 'Время в игре',
    statsReset: 'Сбросить',
    resetAll: 'Сбросить прогресс',
    cheatLevel: 'Уровень +1',
    cheatCoins: '+10 монеток',
    resetAllAsk: 'Сбросить весь прогресс?',
    resetAllNote: 'Сотрутся уровень и опыт, монеты,\nпокупки в магазине, звёзды и статистика',
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
    passed: 'Stages done',
    routeSelect: 'Select route',
    stages: 'Stages',
    stars: 'Stars',
    open: 'Open',
    route: 'Route',
    stage: 'Stage',
    locked: 'Locked',
    lockedHint: 'Finish the previous stage',
    coins: 'Coins',
    buy: 'Buy',
    bought: 'Owned',
    notEnough: 'Not enough coins',
    needLevel: 'Requires level {n}',
    boughtOf: 'Bought {n} of {m}',
    upgrade: 'Upgrade',
    upgradeOf: 'Upgrade {n} of {m}',
    upgradesAvailable: 'Upgradable {n} times later',
    fullyUpgraded: 'Fully upgraded',
    cooldown: 'Cooldown',
    duration: 'Duration',
    secShort: 'sec',

    doubleJumpName: 'Double jump',
    doubleJumpDesc: 'A second jump in mid-air.',
    speedBoostName: 'Speed boost',
    speedBoostDesc: 'Doubles your run speed for a while.',
    cloakName: 'Cloak',
    cloakDesc: 'Hold jump while falling to glide.',
    slingshotName: 'Slingshot',
    slingshotDesc: 'Shoots a coin that neutralizes any monster.',
    noCoins: 'no coins',
    hintFire: 'F — slingshot',
    hintCloak: 'Hold jump while falling to glide',
    extraLifeName: 'One more life',
    extraLifeDesc: 'Raises your maximum lives by one.',

    playerLevel: 'Level',
    xp: 'XP',
    lives: 'Lives',
    levelUp: 'Level up!',
    bonusSpeed: 'speed',
    bonusJump: 'jump',
    bonusLife: 'life',
    statSpeed: 'Run speed',
    statJump: 'Jump height',
    stagesPassed: 'Stages cleared',
    maxLevel: 'Max',

    stageDone: 'Stage complete!',
    stageFailed: 'Too few coins',
    failedHint: 'Collect at least 50%',
    outOfTime: 'Time is up',
    outOfTimeHint: 'Stage failed: the countdown ran out',
    outOfLives: 'Out of lives',
    outOfLivesHint: 'The stage starts over',
    collected: 'Collected',
    treats: 'Sweets',
    neutralized: 'Neutralized',
    time: 'Time',
    xpGained: 'XP earned',
    xpTotal: 'XP total',
    xpShort: 'XP',
    retry: 'Retry',
    next: 'Next',
    menu: 'Menu',

    stats: 'Statistics',
    statsPlayTime: 'Time played',
    statsReset: 'Reset',
    resetAll: 'Reset progress',
    cheatLevel: 'Level +1',
    cheatCoins: '+10 coins',
    resetAllAsk: 'Reset all progress?',
    resetAllNote: 'Level and XP, coins, purchases,\nstars and statistics will be erased',
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
