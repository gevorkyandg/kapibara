/**
 * Звук синтезируется прямо в браузере (WebAudio): ни одного аудиофайла в
 * сборке — быстрее грузится и нет вопросов с лицензиями на звуки.
 *
 * Требование Яндекса: при потере фокуса вкладки звук должен глохнуть —
 * этим занимается подписка на visibilitychange ниже.
 */

import { isSoundOn } from './save.js';

let ctx = null;
let master = null;
let unlocked = false;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.25;
  master.connect(ctx.destination);
  return ctx;
}

/**
 * Браузеры не дают запускать звук до первого действия игрока.
 * Зовём это из любого первого нажатия.
 */
export function unlockAudio() {
  if (unlocked) return;
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  unlocked = true;
}

export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend();
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended' && unlocked) ctx.resume();
}

/**
 * Одна нота с огибающей.
 * @param {number} freq частота, Гц
 * @param {number} duration длительность, сек
 * @param {object} opts type — форма волны, delay — задержка, gain — громкость,
 *                      slideTo — куда «съезжает» частота
 */
function note(freq, duration, opts = {}) {
  if (!isSoundOn()) return;
  const c = ensureContext();
  if (!c || c.state !== 'running') return;

  const t0 = c.currentTime + (opts.delay || 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);

  // Мягкая атака и затухание: без них слышны щелчки.
  const peak = opts.gain ?? 0.6;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  coin() {
    note(1050, 0.09, { type: 'triangle', gain: 0.5 });
    note(1560, 0.12, { type: 'triangle', gain: 0.4, delay: 0.06 });
  },
  treat() {
    note(700, 0.1, { type: 'sine', gain: 0.5 });
    note(900, 0.1, { type: 'sine', gain: 0.5, delay: 0.08 });
    note(1200, 0.16, { type: 'sine', gain: 0.45, delay: 0.16 });
  },
  jump() {
    note(420, 0.16, { type: 'sine', gain: 0.4, slideTo: 760 });
  },
  doubleJump() {
    note(620, 0.18, { type: 'triangle', gain: 0.4, slideTo: 1050 });
  },
  boost() {
    note(300, 0.25, { type: 'sawtooth', gain: 0.22, slideTo: 900 });
  },
  land() {
    note(180, 0.08, { type: 'sine', gain: 0.35, slideTo: 90 });
  },
  hurt() {
    note(400, 0.3, { type: 'square', gain: 0.25, slideTo: 120 });
  },
  pop() {
    note(900, 0.1, { type: 'square', gain: 0.25, slideTo: 300 });
  },
  click() {
    note(600, 0.06, { type: 'triangle', gain: 0.3 });
  },
  buy() {
    [660, 880, 1320].forEach((f, i) => note(f, 0.2, { type: 'triangle', gain: 0.4, delay: i * 0.09 }));
  },
  star(index = 0) {
    note(660 + index * 220, 0.3, { type: 'triangle', gain: 0.5 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => note(f, 0.28, { type: 'triangle', gain: 0.45, delay: i * 0.12 }));
  },
  fail() {
    [400, 340, 260].forEach((f, i) => note(f, 0.3, { type: 'sine', gain: 0.35, delay: i * 0.14 }));
  },
};

// Вкладка ушла из фокуса — звук замолкает.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspendAudio();
  else resumeAudio();
});
