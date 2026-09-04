/**
 * Сторож игрового цикла и видимая диагностика.
 *
 * Зачем: игра иногда замирала — картинка на месте, а нажатия не работают.
 * Причин у такого две, и обе снаружи не различить:
 *
 *  1. Оборвалась цепочка кадров. Phaser просит следующий кадр в конце
 *     предыдущего, поэтому одна упавшая функция останавливает игру навсегда.
 *  2. Кадры идут, но ввод выключен — например, после возврата из свёрнутого
 *     окна.
 *
 * Сторож проверяет и то, и другое раз в секунду и чинит. А чтобы понять, что
 * именно случилось, он пишет об этом прямо на экране: в консоль браузера
 * новичку лезть неудобно, а полоска сверху видна сразу.
 */

const МОЛЧАНИЕ_МС = 900; // столько кадров может не быть, прежде чем бить тревогу

/** Полоска сообщений поверх игры. Появляется только когда есть что сказать. */
function создатьПолоску() {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'top:0',
    'z-index:9999',
    'padding:6px 10px',
    'font:600 13px/1.35 system-ui, sans-serif',
    'color:#fff',
    'background:rgba(180,60,40,.94)',
    'white-space:pre-wrap',
    'display:none',
    'max-height:40vh',
    'overflow:auto',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

/**
 * @param {Phaser.Game} game
 * @param {boolean} показывать показывать ли полоску с диагностикой
 */
export function startWatchdog(game, показывать = true) {
  const полоска = показывать ? создатьПолоску() : null;
  const строки = [];

  const сказать = (текст) => {
    const время = new Date().toLocaleTimeString('ru-RU');
    строки.push(`${время} — ${текст}`);
    if (строки.length > 6) строки.shift();
    console.warn('[сторож]', текст);
    if (полоска) {
      полоска.textContent = строки.join('\n');
      полоска.style.display = 'block';
    }
  };

  /**
   * Поднять игру из любого застывшего состояния.
   *
   * loop.wake() сам по себе не помогает: он выходит сразу, если флаг running
   * ещё поднят, — а поднятым он и остаётся, когда цепочка кадров оборвалась.
   * Поэтому сначала честно усыпляем, потом будим. Заодно возвращаем ввод:
   * он мог остаться выключенным после потери фокуса.
   */
  const поднять = (причина) => {
    сказать(`поднимаю игру: ${причина}`);
    try {
      game.loop.sleep();
      game.loop.wake();
      if (game.isPaused) game.resume();
      game.input.enabled = true;
      if (game.input.keyboard) game.input.keyboard.enabled = true;
      if (game.input.mouse) game.input.mouse.enabled = true;
      if (game.input.touch) game.input.touch.enabled = true;
    } catch (e) {
      сказать(`не удалось поднять: ${e}`);
    }
  };

  // ── Ошибки. Упавший кадр обрывает цепочку — ловим и показываем текст ──────
  window.addEventListener('error', (e) => {
    const где = e.filename ? ` (${String(e.filename).split('/').pop()}:${e.lineno})` : '';
    сказать(`ОШИБКА: ${e.message}${где}`);
    setTimeout(() => поднять('после ошибки'), 0);
  });

  window.addEventListener('unhandledrejection', (e) => {
    сказать(`ОШИБКА в промисе: ${e.reason?.message || e.reason}`);
  });

  // ── Кадры ────────────────────────────────────────────────────────────────
  let последнийКадр = -1;
  let последнееДвижение = performance.now();

  setInterval(() => {
    if (document.hidden) return;
    const сейчас = performance.now();

    if (game.loop.frame !== последнийКадр) {
      последнийКадр = game.loop.frame;
      последнееДвижение = сейчас;
      return;
    }
    if (сейчас - последнееДвижение > МОЛЧАНИЕ_МС) {
      поднять('кадры встали');
      последнееДвижение = сейчас;
    }
  }, 1000);

  /** Кадры точно идут? Если нет — поднимаем. */
  const проверить = () => {
    if (document.hidden) return;
    if (performance.now() - последнееДвижение > 400) поднять('после возврата в окно');
  };

  window.addEventListener('focus', проверить);
  window.addEventListener('pageshow', проверить);
  document.addEventListener('visibilitychange', проверить);

  // Ввод Phaser разбирает внутри кадра: пока кадров нет, нажатия копятся,
  // и кнопки кажутся мёртвыми. Эти слушатели висят на странице и от цикла
  // не зависят, поэтому доберутся до игры в любом состоянии.
  document.addEventListener('pointerdown', проверить, true);
  document.addEventListener('keydown', проверить, true);

  return { сказать, поднять };
}
