import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { initPlatform, platform } from './platform/index.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { suspendAudio, resumeAudio } from './audio.js';

const config = {
  type: Phaser.AUTO, // WebGL, а если его нет — canvas
  parent: 'game',
  backgroundColor: '#8fd6f2',
  scale: {
    // FIT: вписать кадр в экран целиком, сохранив пропорции. По краям могут
    // остаться поля — зато ничего не обрежется ни на одном телефоне, и игра
    // переживает поворот экрана (требование Яндекса).
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1750 },
      debug: false,
    },
  },
  // Чёткие контуры: вся графика рисуется кодом, сглаживание её только мылит.
  render: { antialias: true, roundPixels: true },
  scene: [BootScene, MenuScene, LevelSelectScene, ShopScene, GameScene, ResultScene],
};

// Сначала поднимаем площадку, потом игру: портал должен успеть ответить,
// на каком языке говорить и какой прогресс у игрока.
initPlatform().then(() => {
  const game = new Phaser.Game(config);

  // Только в режиме разработки: доступ к игре из консоли браузера.
  // В собранной версии этой строки нет.
  if (import.meta.env.DEV) window.__game = game;

  // Пауза со стороны площадки (реклама, сворачивание) — сцена сама решит,
  // что с этим делать. Подписываемся один раз здесь, а не в сцене, чтобы
  // обработчики не копились при каждом перезапуске уровня.
  platform.onPause(() => {
    suspendAudio();
    game.events.emit('platform:pause');
  });
  platform.onResume(() => {
    resumeAudio();
  });

  /**
   * Разбудить игру после возвращения в окно.
   *
   * Свернули окно — браузер перестаёт давать кадры, и Phaser усыпляет свой
   * цикл. Иногда он не просыпается сам: картинка остаётся (видно меню паузы),
   * но кадры не идут, а вместе с ними не обрабатывается и ввод — кнопки не
   * нажимаются. Поэтому будим цикл руками на каждое возвращение фокуса.
   */
  /**
   * Перезапуск игрового цикла.
   *
   * Просто позвать loop.wake() недостаточно: он выходит сразу, если флаг
   * running ещё поднят. А поднятым он и остаётся, когда браузер перестал
   * выдавать кадры или очередной кадр упал с ошибкой — цепочка
   * requestAnimationFrame обрывается, но игра считает, что работает.
   * Поэтому сначала честно усыпляем (это сбрасывает флаги и останавливает
   * RAF), и только потом будим.
   */
  const restartLoop = () => {
    game.loop.sleep();
    game.loop.wake();
    game.input.enabled = true;
  };

  // Сторож: раз в секунду смотрит, идут ли кадры. Живёт на таймере, а не на
  // кадрах, поэтому переживает любую остановку цикла.
  let lastFrame = -1;
  let lastAdvanceAt = performance.now();

  setInterval(() => {
    if (document.hidden) return;
    const now = performance.now();
    if (game.loop.frame !== lastFrame) {
      lastFrame = game.loop.frame;
      lastAdvanceAt = now;
      return;
    }
    if (now - lastAdvanceAt > 900) {
      console.warn('[игра] кадры встали — перезапускаем цикл');
      restartLoop();
      lastAdvanceAt = now;
    }
  }, 1000);

  /** Разбудить, если кадры действительно стоят. Иначе не трогаем. */
  const wakeUpIfStalled = () => {
    if (document.hidden) return;
    if (performance.now() - lastAdvanceAt > 400) restartLoop();
  };

  window.addEventListener('focus', wakeUpIfStalled);
  window.addEventListener('pageshow', wakeUpIfStalled);
  document.addEventListener('visibilitychange', wakeUpIfStalled);

  // Любое касание или клавиша тоже проверяют цикл: ввод Phaser разбирает
  // внутри кадра, и пока кадров нет, нажатия копятся, а кнопки кажутся
  // мёртвыми. Эти слушатели висят на странице и от цикла не зависят.
  document.addEventListener('pointerdown', wakeUpIfStalled, true);
  document.addEventListener('keydown', wakeUpIfStalled, true);

  // Упавший кадр обрывает цепочку RAF навсегда — поднимаем её обратно.
  window.addEventListener('error', () => setTimeout(restartLoop, 0));
});
