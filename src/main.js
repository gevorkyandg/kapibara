import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEBUG } from './config.js';
import { initPlatform, platform } from './platform/index.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { suspendAudio, resumeAudio } from './audio.js';
import { startWatchdog } from './watchdog.js';
import { разобратьОчередь } from './telemetry.js';

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

  // Быстрый запуск из редактора.
  //
  // Раньше кнопка «Играть» открывала игру заново: полная загрузка страницы,
  // полтораста запросов и заново испечённые текстуры — несколько секунд на
  // каждую пробу. Теперь редактор держит игру уже загруженной в соседнем
  // окне и просто просит перезапустить сцену: карту она перечитает сама, а
  // всё остальное у неё уже готово.
  if (import.meta.env.DEV) {
    window.addEventListener('message', async (событие) => {
      if (событие.origin !== location.origin) return;
      const весть = событие.data;
      if (!весть || typeof весть !== 'object') return;

      if (весть.капибара === 'играть') {
        const { задатьИспытание } = await import('./save.js');
        try {
          const проба = JSON.parse(localStorage.getItem('capybara-редактор-карта') || 'null');
          задатьИспытание(проба?.тест ?? null);
        } catch {
          задатьИспытание(null);
        }
        game.scene.stop('ResultScene');
        game.scene.stop('GameScene');
        game.scene.start('GameScene', { levelIndex: Number(весть.этап) || 0 });
      }

      if (весть.капибара === 'стоп') {
        game.scene.stop('GameScene');
        game.scene.stop('ResultScene');
        game.scene.start('MenuScene');
      }
    });
  }

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

  // Сторож следит, идут ли кадры, поднимает игру из зависания и пишет о
  // случившемся прямо на экране — иначе причину не поймать.
  startWatchdog(game, DEBUG.diagnostics);

  // Записи, которые в прошлый раз не ушли — связь оборвалась или их срезал
  // блокировщик, — отправляем при запуске.
  разобратьОчередь();
});
