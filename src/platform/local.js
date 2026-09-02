/**
 * Локальная площадка: прогресс в localStorage, реклама — запись в консоль.
 * Нужна, чтобы игра запускалась и разрабатывалась без SDK портала.
 *
 * Все методы async: у настоящих SDK они возвращают промисы, и если сделать
 * их синхронными, при подключении портала пришлось бы переписывать вызовы.
 */

const SAVE_KEY = 'capybara-save';

export const localPlatform = {
  name: 'local',
  lang: 'ru',

  async init() {
    // Язык берём из браузера — грубая замена SDK-определению.
    this.lang = (navigator.language || 'ru').slice(0, 2);
    console.log('[platform] local: SDK портала не подключён');
  },

  /** Все ресурсы загружены, экранов загрузки нет. */
  ready() {},

  gameplayStart() {},
  gameplayStop() {},

  /** Подписки на паузу платформы — локально их некому вызывать. */
  onPause() {},
  onResume() {},

  async showAd() {
    console.log('[platform] showAd()');
  },

  async showRewardedAd() {
    console.log('[platform] showRewardedAd() -> награда выдана (заглушка)');
    return true;
  },

  async saveProgress(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[platform] не удалось сохранить прогресс', e);
    }
  },

  async loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[platform] не удалось прочитать прогресс', e);
      return null;
    }
  },
};
