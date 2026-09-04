/**
 * Монстры из ТЗ: кто как выглядит, как двигается и можно ли на него прыгнуть.
 *
 * Всё описание одного монстра лежит в одной записи MONSTERS — добавить нового
 * значит дописать сюда строчку и нарисовать текстуру в art.js. Поведение —
 * маленькая функция update, её каждый кадр зовёт GameScene.
 *
 * Сложность в ТЗ задана словами (простые, средние, сложные), здесь она
 * превращается в числа: скорость, опыт за обезвреживание и то, топчется ли
 * монстр прыжком.
 */

import Phaser from 'phaser';
import { XP } from './progression.js';

/** Идёт по земле, разворачивается у стены и у края площадки. */
function patrol(scene, m) {
  if (m.body.blocked.left) m.dir = 1;
  else if (m.body.blocked.right) m.dir = -1;

  if (m.body.blocked.down) {
    const ahead = m.x + m.dir * 30;
    if (!scene.isSolidAtPixel(ahead, m.body.bottom + 10)) m.dir *= -1;
  }

  m.setVelocityX(m.speed * m.dir);
  m.setFlipX(m.dir < 0);
}

/** Прыгает с места на место: пауза, прыжок, снова пауза. */
function hop(scene, m, time) {
  if (!m.body.blocked.down) return;

  m.setVelocityX(0);
  if (time < m.nextHopAt) return;

  if (m.body.blocked.left) m.dir = 1;
  else if (m.body.blocked.right) m.dir = -1;
  const ahead = m.x + m.dir * 40;
  if (!scene.isSolidAtPixel(ahead, m.body.bottom + 10)) m.dir *= -1;

  m.setVelocity(m.speed * m.dir, m.hopPower);
  m.setFlipX(m.dir < 0);
  m.nextHopAt = time + m.hopEvery;
}

export const MONSTERS = {
  // ── Простые ────────────────────────────────────────────────────────────
  m: {
    // Черепашка. Медленно ходит влево-вправо, топчется прыжком.
    key: 'turtle',
    xp: XP.monster.easy,
    stompable: true,
    ground: true,
    body: { w: 56, h: 32, ox: 8, oy: 22 },
    speed: 45,
    update: patrol,
  },

  f: {
    // Муха. Летает вверх-вниз, топчется прыжком.
    key: 'fly',
    xp: XP.monster.easy,
    stompable: true,
    ground: false,
    body: { w: 34, h: 26, ox: 10, oy: 12 },
    float: { y: 130, ms: 1500 },
  },

  l: {
    // Лягушка. Прыгает на небольшую высоту, топчется прыжком.
    key: 'frog',
    xp: XP.monster.easy,
    stompable: true,
    ground: true,
    body: { w: 46, h: 34, ox: 7, oy: 20 },
    // Скорость и прыжок подняты на 20% — лягушка стала заметно живее.
    speed: 108,
    hopPower: -504,
    hopEvery: 1400,
    update: hop,
  },

  // ── Средние ────────────────────────────────────────────────────────────
  e: {
    // Ёжик. Быстрее черепахи, и прыгать на него нельзя — колючки.
    key: 'hedgehog',
    xp: XP.monster.medium,
    stompable: false,
    ground: true,
    body: { w: 60, h: 28, ox: 6, oy: 28 },
    speed: 132, // на 20% быстрее прежнего
    update: patrol,
  },

  b: {
    // Пчёлка. Летает и вверх-вниз, и влево-вправо.
    key: 'bee',
    xp: XP.monster.medium,
    stompable: true,
    ground: false,
    body: { w: 40, h: 30, ox: 8, oy: 12 },
    // Размах шире и вниз она уходит заметно глубже, чтобы доставать бегущего
    // по земле игрока, а не висеть недосягаемой.
    float: { x: 156, y: 300, ms: 1460 },
  },

  // ── Сложные ────────────────────────────────────────────────────────────
  d: {
    // Дикобраз. Стоит на месте и раз в две секунды выпускает иглы во все
    // стороны. Перед выстрелом полсекунды раздувается — есть время отойти.
    key: 'porcupine',
    xp: XP.monster.hard,
    stompable: false,
    ground: true,
    body: { w: 46, h: 46, ox: 11, oy: 14 },
    speed: 0,
    shootEvery: 2200, // на 10% реже прежнего
    warnMs: 500,
    update(scene, m, time) {
      m.setVelocityX(0);
      if (!m.nextShotAt) m.nextShotAt = time + m.shootEvery;

      // Раздувается — сигнал, что сейчас стрельнёт
      if (!m.warning && time >= m.nextShotAt - m.warnMs) {
        m.warning = true;
        scene.tweens.add({ targets: m, scale: 1.18, duration: m.warnMs, yoyo: true });
      }
      if (time < m.nextShotAt) return;

      m.warning = false;
      m.nextShotAt = time + m.shootEvery;
      scene.shootQuills(m);
    },
  },

  w: {
    /**
     * Оса. Самый расчётливый монстр в игре.
     *
     * Она не бросается, когда капибара просто оказалась рядом, — она считает
     * упреждение: где герой будет к моменту удара, если продолжит бежать так
     * же. И начинает атаку заранее, чтобы прилететь именно туда. Поэтому
     * бегущего игрока оса достаёт, а тот, кто включил ускорение, проскакивает
     * под ней: к моменту удара он уже дальше, чем оса рассчитала.
     *
     * Промахнулась и врезалась в землю — лежит оглушённая две секунды, над
     * головой кружатся звёздочки. После подъёма ещё две секунды не нападает.
     */
    key: 'wasp',
    diveKey: 'wasp-dive',
    stunKey: 'wasp-stunned',
    xp: XP.monster.hard,
    stompable: true,
    ground: false,
    body: { w: 40, h: 30, ox: 9, oy: 12 },
    sight: 460, // замечает издалека, чтобы успеть рассчитать удар
    diveSpeed: 430,
    diveAngle: 45, // градусы; можно калибровать, лишь бы доставала
    aimTolerance: 46, // допуск расчёта, иначе идеальный момент не поймать
    hoverAmp: 40, // насколько качается на месте
    hoverMs: 1300,
    warnMs: 400, // столько целится перед броском
    attackEvery: 2600,
    stunMs: 2000,
    calmAfterRiseMs: 2000, // после подъёма не атакует
    update(scene, m, time) {
      const игрок = scene.player;

      // ── Лежит оглушённая ────────────────────────────────────────────────
      if (m.state === 'stun') {
        if (time < m.stunUntil) return;
        m.state = 'rise';
        m.setTexture(m.type.key).setAngle(0).setFlipY(false);
        m.readyAt = time + m.calmAfterRiseMs;
        scene.tweens.add({
          targets: m,
          y: m.homeY,
          duration: 600,
          ease: 'Sine.easeOut',
          onComplete: () => {
            m.state = 'hover';
          },
        });
        return;
      }

      // ── Пикирует ────────────────────────────────────────────────────────
      if (m.state === 'dive') {
        const врезалась =
          scene.isSolidAtPixel(m.x, m.body.bottom + 6) || m.y > scene.worldH - 40;
        if (!врезалась) return;

        m.state = 'stun';
        m.stunUntil = time + m.stunMs;
        m.setVelocity(0, 0);
        m.setTexture(m.type.stunKey).setAngle(0).setFlipY(false);
        scene.puff(m.x, m.y, 0xffe08a);
        scene.spinDizzyStars(m, m.stunMs);
        return;
      }

      // ── Взлетает обратно ────────────────────────────────────────────────
      if (m.state === 'rise') return;

      // ── Целится ─────────────────────────────────────────────────────────
      if (m.state === 'aim') {
        if (time < m.aimUntil) return;

        m.state = 'dive';
        m.readyAt = time + m.attackEvery;

        const рад = Phaser.Math.DegToRad(m.diveAngle);
        const vx = Math.cos(рад) * m.diveSpeed * m.aimDir;
        const vy = Math.sin(рад) * m.diveSpeed;
        m.setVelocity(vx, vy);

        // Жало смотрит туда же, куда летит оса.
        m.setTexture(m.type.diveKey);
        m.setFlipY(m.aimDir < 0);
        m.setRotation(Math.atan2(vy, vx));
        return;
      }

      // ── Парит и считает упреждение ──────────────────────────────────────
      m.y = m.homeY + Math.sin(time / m.hoverMs) * m.hoverAmp;

      if (time < (m.readyAt || 0)) return;
      if (Math.abs(игрок.x - m.x) > m.sight) return;

      const глубина = игрок.body.bottom - m.y; // насколько ниже нас капибара
      if (глубина < 60) return; // она выше — бить некуда

      const рад = Phaser.Math.DegToRad(m.diveAngle);
      const время = глубина / (Math.sin(рад) * m.diveSpeed); // сколько лететь вниз
      const охват = Math.cos(рад) * m.diveSpeed * время; // на столько сместимся вбок

      // Где капибара окажется к удару, если продолжит бежать как сейчас.
      const прогноз = игрок.x + игрок.body.velocity.x * (m.warnMs / 1000 + время);
      const нужно = прогноз - m.x;

      // Момент настал, когда нужное смещение совпало с тем, что оса пролетит.
      if (Math.abs(Math.abs(нужно) - охват) > m.aimTolerance) return;

      m.state = 'aim';
      m.aimUntil = time + m.warnMs;
      m.aimDir = Math.sign(нужно) || 1;
      m.setFlipX(m.aimDir < 0);
      scene.tweens.add({ targets: m, scaleX: 1.2, scaleY: 0.85, duration: m.warnMs, yoyo: true });
    },
  },

  j: {
    // Жаба. Прыгает, а вблизи останавливается и выстреливает языком.
    // Прыгнуть можно только на саму жабу, язык отнимает жизнь.
    key: 'toad',
    xp: XP.monster.hard,
    stompable: true,
    ground: true,
    body: { w: 56, h: 40, ox: 8, oy: 24 },
    // Прыжок выше и ход на 30% быстрее — жаба перестала быть вялой.
    speed: 91,
    hopPower: -494,
    hopEvery: 1500,
    sight: 320,
    tongueEvery: 2400,
    tongueReach: 220, // втрое дальше прежнего
    update(scene, m, time) {
      const player = scene.player;
      const dist = Math.abs(player.x - m.x);
      const level = Math.abs(player.y - m.y) < 70;

      if (dist < m.sight && level && time >= (m.tongueReadyAt || 0)) {
        m.tongueReadyAt = time + m.tongueEvery;
        m.setVelocityX(0);
        scene.shootTongue(m, player.x < m.x ? -1 : 1);
        return;
      }
      hop(scene, m, time);
    },
  },

  z: {
    // Змея. Длинная, из норы поднимается во весь рост и бросается на
    // капибару, пока та рядом. Основной хитбокс — само тело, поэтому прыгать
    // на неё нельзя: она кусает и в полёте.
    key: 'snake',
    xp: XP.monster.hard,
    stompable: false,
    ground: false,
    body: { w: 30, h: 104, ox: 12, oy: 14 },
    sight: 300, // издалека замечает
    strikeRange: 190, // на этой дистанции бросается
    strikeEvery: 900, // и повторяет броски, пока игрок близко
    outMs: 4200,
    hideMs: 1200,
    update(scene, m, time) {
      const игрок = scene.player;
      const dist = Math.abs(игрок.x - m.x);

      if (!m.out) {
        if (dist < m.sight && time >= (m.nextOutAt || 0)) {
          m.out = true;
          m.hideAt = time + m.outMs;
          m.body.enable = true;
          m.nextStrikeAt = time + 250;
          scene.tweens.add({
            targets: m,
            y: m.homeY,
            alpha: 1,
            duration: 240,
            ease: 'Back.Out',
          });
        }
        return;
      }

      // Пока игрок рядом, змея не прячется — прячется, только когда он ушёл
      if (dist < m.sight) m.hideAt = Math.max(m.hideAt, time + 1200);

      if (time >= m.hideAt) {
        m.out = false;
        m.nextOutAt = time + m.hideMs;
        m.body.enable = false;
        scene.tweens.add({ targets: m, y: m.homeY + 96, alpha: 0, duration: 280 });
        return;
      }

      // Бросок: тело вытягивается в сторону капибары и возвращается.
      if (dist < m.strikeRange && time >= (m.nextStrikeAt || 0)) {
        m.nextStrikeAt = time + m.strikeEvery;
        const dir = игрок.x < m.x ? -1 : 1;
        m.setFlipX(dir < 0);
        scene.tweens.add({
          targets: m,
          x: m.x + dir * 70,
          angle: dir * 22,
          duration: 170,
          yoyo: true,
          ease: 'Back.In',
        });
      }
    },
  },
};

/** Символы монстров — по ним карта отличает их от прочего. */
export const MONSTER_KEYS = Object.keys(MONSTERS);
