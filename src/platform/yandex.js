/**
 * Адаптер Яндекс Игр. Тот же набор методов, что у localPlatform, — код игры
 * не знает, на какой площадке он запущен.
 *
 * Что здесь закрыто по требованиям модерации:
 *  - LoadingAPI.ready()   — «игра загрузилась» (частая причина отказа);
 *  - GameplayAPI          — разметка активного геймплея;
 *  - game_api_pause/resume — пауза со стороны платформы;
 *  - i18n.lang            — автоопределение языка;
 *  - гостевой режим       — неавторизованный игрок сохраняется локально.
 */

const GUEST_KEY = 'capybara-save-guest';
const SAVE_KEY = 'save';

export const yandexPlatform = {
  name: 'yandex',
  lang: 'ru',

  ysdk: null,
  player: null,
  readyCalled: false,

  async init() {
    this.ysdk = await YaGames.init();
    this.lang = this.ysdk.environment?.i18n?.lang || 'ru';

    try {
      // scopes:false — не показывать окно авторизации: гость тоже должен играть.
      this.player = await this.ysdk.getPlayer({ scopes: false });
    } catch (e) {
      console.warn('[platform] игрок недоступен, работаем гостем', e);
      this.player = null;
    }
  },

  ready() {
    if (this.readyCalled) return;
    this.readyCalled = true;
    this.ysdk?.features?.LoadingAPI?.ready();
  },

  gameplayStart() {
    this.ysdk?.features?.GameplayAPI?.start();
  },

  gameplayStop() {
    this.ysdk?.features?.GameplayAPI?.stop();
  },

  onPause(cb) {
    this.ysdk?.on('game_api_pause', cb);
  },

  onResume(cb) {
    this.ysdk?.on('game_api_resume', cb);
  },

  /** Межстраничная реклама. Показывать только в логических паузах. */
  async showAd() {
    return new Promise((resolve) => {
      if (!this.ysdk?.adv) return resolve(false);
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: (wasShown) => resolve(Boolean(wasShown)),
          onError: () => resolve(false),
        },
      });
    });
  },

  /** Реклама за награду. Награда выдаётся только в onRewarded. */
  async showRewardedAd() {
    return new Promise((resolve) => {
      if (!this.ysdk?.adv) return resolve(false);
      let rewarded = false;
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => resolve(rewarded),
          onError: () => resolve(false),
        },
      });
    });
  },

  async saveProgress(data) {
    // Гость: игрока нет — кладём в localStorage, прогресс всё равно не теряется.
    if (!this.player?.setData) {
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('[platform] гостевое сохранение не удалось', e);
      }
      return;
    }
    try {
      // false — не ждать подтверждения записи, чтобы не тормозить игру.
      await this.player.setData({ [SAVE_KEY]: data }, false);
    } catch (e) {
      console.warn('[platform] setData не удался', e);
    }
  },

  async loadProgress() {
    if (!this.player?.getData) {
      try {
        const raw = localStorage.getItem(GUEST_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    try {
      const data = await this.player.getData([SAVE_KEY]);
      return data?.[SAVE_KEY] ?? null;
    } catch (e) {
      console.warn('[platform] getData не удался', e);
      return null;
    }
  },
};
