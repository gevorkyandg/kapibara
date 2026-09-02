/**
 * Слой-адаптер площадки.
 *
 * Игра НИКОГДА не зовёт SDK портала напрямую — только эти функции. Чтобы
 * выпустить ту же игру на CrazyGames или Poki, рядом дописывается новый
 * адаптер, а код игры не трогается.
 */

import { localPlatform } from './local.js';
import { yandexPlatform } from './yandex.js';

export let platform = localPlatform;

export async function initPlatform() {
  // Скрипт SDK грузится всегда — значит, одного YaGames мало. На настоящей
  // площадке игра открыта не с localhost, поэтому при разработке мы берём
  // локальный адаптер: иначе SDK шлёт сообщения несуществующему порталу и
  // засыпает консоль ошибками «No parent to post message».
  const local = ['localhost', '127.0.0.1', '::1', ''].includes(window.location.hostname);
  const hasYandex = typeof window.YaGames !== 'undefined' && !local;

  if (hasYandex) {
    try {
      await yandexPlatform.init();
      platform = yandexPlatform;
      console.log('[platform] Яндекс Игры, язык:', platform.lang);
      return platform;
    } catch (e) {
      // Если SDK упал — игра всё равно должна запуститься.
      console.warn('[platform] SDK Яндекса не поднялся, откат на локальный', e);
    }
  }

  await localPlatform.init();
  platform = localPlatform;
  return platform;
}
