/**
 * Локализация. Яндекс требует автоопределение языка через SDK: русский для
 * ru/be/kk/uk/uz, английский для остального мира.
 */

const STRINGS = {
  ru: {
    title: 'Капибара',
    subtitle: 'приключение',
    play: 'Играть',
    shop: 'Магазин',
    back: 'Назад',
    levelSelect: 'Выбор уровня',
    level: 'Уровень',
    locked: 'Закрыто',
    lockedHint: 'Пройдите предыдущий уровень',
    coins: 'Монетки',
    buy: 'Купить',
    bought: 'Куплено',
    notEnough: 'Не хватает монеток',
    doubleJumpName: 'Двойной прыжок',
    doubleJumpDesc: 'Второй прыжок в воздухе. Перезарядка 6 сек.',
    speedBoostName: 'Ускорение',
    speedBoostDesc: 'Двойная скорость на 2 сек. Перезарядка 6 сек.',
    levelDone: 'Уровень пройден!',
    levelFailed: 'Мало монеток',
    failedHint: 'Нужно собрать хотя бы 50%',
    collected: 'Собрано',
    treatBonus: 'Вкусняшки',
    retry: 'Заново',
    next: 'Дальше',
    menu: 'В меню',
    pause: 'Пауза',
    resume: 'Продолжить',
    tapToStart: 'Нажмите, чтобы начать',
    hintMove: 'Стрелки или A/D — идти',
    hintJump: 'Пробел или ↑ — прыжок',
    hintBoost: 'Shift — ускорение',
    sound: 'Звук',
    loading: 'Загрузка...',
  },
  en: {
    title: 'Capybara',
    subtitle: 'adventure',
    play: 'Play',
    shop: 'Shop',
    back: 'Back',
    levelSelect: 'Select level',
    level: 'Level',
    locked: 'Locked',
    lockedHint: 'Finish the previous level',
    coins: 'Coins',
    buy: 'Buy',
    bought: 'Owned',
    notEnough: 'Not enough coins',
    doubleJumpName: 'Double jump',
    doubleJumpDesc: 'A second jump in mid-air. 6 sec cooldown.',
    speedBoostName: 'Speed boost',
    speedBoostDesc: 'Double speed for 2 sec. 6 sec cooldown.',
    levelDone: 'Level complete!',
    levelFailed: 'Too few coins',
    failedHint: 'Collect at least 50%',
    collected: 'Collected',
    treatBonus: 'Treats',
    retry: 'Retry',
    next: 'Next',
    menu: 'Menu',
    pause: 'Paused',
    resume: 'Resume',
    tapToStart: 'Tap to start',
    hintMove: 'Arrows or A/D to walk',
    hintJump: 'Space or Up to jump',
    hintBoost: 'Shift to dash',
    sound: 'Sound',
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

/** @param {string} key ключ из STRINGS */
export function t(key) {
  return STRINGS[current][key] ?? STRINGS.ru[key] ?? key;
}
