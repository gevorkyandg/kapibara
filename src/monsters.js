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
import { PATROL_RANGE } from './config.js';

/**
 * Не пора ли повернуть назад: дошёл до края своего участка.
 *
 * Разворачиваем только того, кто идёт наружу. Симметричная проверка «вышел за
 * край — развернись» запирает монстра на месте, если его вытолкнуло за
 * границу: он дёргается туда-сюда каждый кадр и никуда не идёт.
 */
function заКраемУчастка(m, вперёд = 0) {
  const половина = (m.patrolRange ?? PATROL_RANGE) / 2;
  const сдвиг = m.x - (m.homeX ?? m.x) + m.dir * вперёд;
  if (сдвиг > половина && m.dir > 0) return true;
  if (сдвиг < -половина && m.dir < 0) return true;
  return false;
}

/**
 * Далеко ли улетит прыгун за один прыжок.
 *
 * Нужно для разворота с упреждением: прыгун решает, куда двигаться, только в
 * момент отталкивания, а потом летит по дуге и приземлиться посередине уже не
 * может. Без упреждения он вылетал за край участка ровно на длину прыжка, и
 * участок в 250 пикселей превращался в 370.
 */
function прыжокДлина(scene, m) {
  const тяжесть = scene.physics.world.gravity.y || 1750;
  return Math.abs(m.speed) * ((2 * Math.abs(m.hopPower)) / тяжесть);
}

/** Идёт по земле, разворачивается у стены, у края площадки и своего участка. */
function patrol(scene, m) {
  if (m.body.blocked.left) m.dir = 1;
  else if (m.body.blocked.right) m.dir = -1;
  else if (заКраемУчастка(m)) m.dir *= -1;

  if (m.body.blocked.down) {
    // Край площадки или скат? Смотрим не в одну точку, а вглубь: на склоне
    // земля впереди ниже на те же 30 пикселей, и по одной точке монстр решал,
    // что перед ним обрыв, и разворачивался у каждой ступеньки.
    // Смотрим на клетку с лишним вперёд, а не себе под нос. Монстр, стоящий
    // вплотную к обрыву, запирает переправу: игроку нужен разбег и место для
    // приземления, а их занимает он.
    const ahead = m.x + m.dir * 70;
    let опора = false;
    for (let d = 10; d <= 44 && !опора; d += 8) {
      if (scene.isSolidAtPixel(ahead, m.body.bottom + d)) опора = true;
    }
    // Пружина для монстра — та же стена: встав на неё, он караулит игрока
    // ровно там, где увернуться уже нельзя. Склон — тоже граница: наверх
    // горки монстрам ходу нет.
    if (
      !опора ||
      scene.пружинаВ(ahead) ||
      scene.склонВпереди(ahead, m.body.bottom) ||
      scene.уСтарта(ahead)
    ) {
      m.dir *= -1;
    }
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
  else if (заКраемУчастка(m, прыжокДлина(scene, m))) m.dir *= -1;

  // Прыгуну до края нужно ещё больше места: он улетает по дуге и с края
  // сходит целиком.
  const ahead = m.x + m.dir * 90;
  if (
    !scene.isSolidAtPixel(ahead, m.body.bottom + 10) ||
    scene.пружинаВ(ahead) ||
    scene.склонВпереди(ahead, m.body.bottom) ||
    scene.уСтарта(ahead)
  ) {
    m.dir *= -1;
  }

  m.setVelocity(m.speed * m.dir, m.hopPower);
  m.setFlipX(m.dir < 0);
  m.nextHopAt = time + m.hopEvery;
}

/**
 * Панголин сворачивается в клубок.
 *
 * В клубке он неуязвим: ни прыжок, ни рогатка, ни касание его не берут — от
 * катящегося клубка можно только уйти. Поэтому направление выбирается один
 * раз, в момент превращения: дальше он катится, не подруливая.
 */
function свернуться(scene, m) {
  m.state = 'roll';
  m.броня = true;
  m.rollFrom = m.x;
  m.dir = scene.player.x < m.x ? -1 : 1;
  m.setTexture(m.type.ballKey).setFlipX(false);
  const b = m.type.ballBody;
  m.body.setSize(b.w, b.h).setOffset(b.ox, b.oy);
  scene.убратьТревогу(m);
  scene.puff(m.x, m.y, 0xd8c0b8);
}

/** Панголин разворачивается обратно в зверя — целого или оглушённого. */
function развернуться(m, текстура) {
  m.броня = false;
  m.setTexture(текстура).setAngle(0);
  const b = m.type.body;
  m.body.setSize(b.w, b.h).setOffset(b.ox, b.oy);
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
    // Участок вчетверо короче обычного: лягушка медленная, и на маршруте во
    // весь экран она половину времени скачет где-то вдали, а игрок видит
    // пустую дорогу вместо монстра.
    patrolRange: 300,
    hopPower: -504,
    hopEvery: 1400,
    update: hop,
  },

  // ── Средние ────────────────────────────────────────────────────────────
  e: {
    // Ёжик. Быстрее черепахи, и прыгать на него нельзя — колючки.
    //
    // Колючки работают в обе стороны: касание тоже его не убивает. Зверь,
    // весь покрытый иглами, не может погибнуть от того, что в него врезались
    // боком, — платит за такую встречу только герой. Снять ёжика можно
    // рогаткой: камешек прилетает туда, куда телом не подойти.
    key: 'hedgehog',
    xp: XP.monster.medium,
    stompable: false,
    колючий: true,
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
    // Иглы во все стороны — значит, и касание его не берёт: подойти к
    // дикобразу вплотную и остаться целым нельзя ни герою, ни ему. Снимается
    // рогаткой.
    колючий: true,
    ground: true,
    body: { w: 46, h: 46, ox: 11, oy: 14 },
    speed: 0,
    shootEvery: 2200, // на 10% реже прежнего
    warnMs: 500,
    sight: 640, // полэкрана: дальше иглы всё равно не долетают
    update(scene, m, time) {
      m.setVelocityX(0);
      if (!m.nextShotAt) m.nextShotAt = time + m.shootEvery;

      // Пока игрок далеко — не стреляем вовсе. Раньше дикобраз палил всегда,
      // где бы игрок ни находился, и на этапе с тремя дикобразами это было
      // слышно с самого старта: три выстрела разом каждые 2.2 секунды,
      // ровным метрономом. Таймер при этом двигаем вперёд, чтобы первый
      // выстрел после подхода игрока начинался с обычного раздувания, а не
      // прилетал мгновенно.
      if (Math.abs(scene.player.x - m.x) > m.sight) {
        m.nextShotAt = time + m.shootEvery;
        m.warning = false;
        return;
      }

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
    diveSpeed: 430, // скорость падения; вбок — сколько нужно для попадания
    // Вилка наклона удара: 0.4 — почти отвесно, 1.7 — очень полого. Внутри
    // неё оса сама подбирает угол под расстояние, поэтому бьёт и вперёд,
    // и назад, а не ждёт единственного совпадения.
    minSlope: 0.4,
    maxSlope: 1.7,
    chaseSpeed: 20, // медленнее — считаем, что герой стоит на месте
    standRange: 240, // стоящего бьёт только с этого расстояния
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
        m.setVelocity(m.aimVx, m.aimVy);

        // Жало смотрит туда же, куда летит оса.
        m.setTexture(m.type.diveKey);
        m.setFlipY(m.aimVx < 0);
        m.setRotation(Math.atan2(m.aimVy, m.aimVx));
        return;
      }

      // ── Парит и считает упреждение ──────────────────────────────────────
      m.y = m.homeY + Math.sin(time / m.hoverMs) * m.hoverAmp;

      if (time < (m.readyAt || 0)) return;
      if (Math.abs(игрок.x - m.x) > m.sight) return;

      const глубина = игрок.body.bottom - m.y; // насколько ниже нас капибара
      if (глубина < 60) return; // она выше — бить некуда

      // Вниз оса всегда падает с одной скоростью, а вбок — на сколько нужно.
      // Раньше угол был жёстко 45°, и оса ждала, пока звёзды сойдутся: чаще
      // всего момент не наступал вовсе, и она пропускала игрока мимо.
      const vy = m.diveSpeed;
      const время = глубина / vy;

      // Где капибара окажется к удару, если продолжит бежать как сейчас.
      //
      // Считаем по обычному бегу, даже если герой мчит быстрее: оса не умеет
      // предвидеть рывок. Поэтому включённое ускорение выносит капибару из
      // точки, куда оса метила, — ровно та лазейка, ради которой ускорение и
      // покупается.
      const предел = scene.walkSpeed; // обычный бег героя, уже с бонусами уровня
      const обычныйХод = Math.max(-предел, Math.min(предел, игрок.body.velocity.x));
      const прогноз = игрок.x + обычныйХод * (m.warnMs / 1000 + время);
      const нужно = прогноз - m.x;
      const vx = нужно / время;

      // Слишком полого или слишком отвесно — это уже не удар, а падение.
      // В таком случае просто ждём: цель либо подойдёт, либо уйдёт.
      const пологость = Math.abs(vx) / vy;
      if (пологость > m.maxSlope || пологость < m.minSlope) return;

      // Бежит — бьём только вдогонку, в ту же сторону.
      //
      // Оса замечает капибару за 460 пикселей, и первое подходящее окно
      // наступает, когда та ещё далеко позади: точка встречи оказывается
      // с другой стороны от осы, и удар выходит навстречу бегущему. Он
      // засчитывается, начинается перезарядка — и к моменту, когда герой
      // добегает, оса уже занята. Поэтому такие окна пропускаем и ждём
      // того, где оса нагоняет героя сверху-сзади. Стоящего на месте бьём
      // в любую сторону: догонять там некого.
      const ходИгрока = игрок.body.velocity.x;
      if (Math.abs(ходИгрока) > m.chaseSpeed) {
        if (Math.sign(vx) !== Math.sign(ходИгрока)) return;
      } else if (Math.abs(игрок.x - m.x) > m.standRange) {
        // Стоит далеко — тоже ждём. Иначе оса тратит удар по неподвижной
        // цели за полэкрана, а когда та побежит, ей уже нечем ответить.
        return;
      }

      m.state = 'aim';
      m.aimUntil = time + m.warnMs;
      m.aimVx = vx;
      m.aimVy = vy;
      m.setFlipX(vx < 0);
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
    // Язык укорочен и замедлен ещё на пятую часть: в связке с прыжком он не
    // оставлял игроку ни одного кадра на решение.
    tongueEvery: 2880,
    tongueReach: 150,
    // Участок патруля короткий, как у лягушки: жаба тоже прыгает, и на
    // маршруте во весь экран она успевает уйти к самому обрыву.
    patrolRange: 300,
    update(scene, m, time) {
      const player = scene.player;
      const dist = Math.abs(player.x - m.x);
      const level = Math.abs(player.y - m.y) < 70;

      // Языком бьёт только стоя на земле. В прыжке жаба и так неуязвима
      // сверху, и добавлять к этому удар — значит не оставлять выбора вовсе.
      if (m.body.blocked.down && dist < m.sight && level && time >= (m.tongueReadyAt || 0)) {
        m.tongueReadyAt = time + m.tongueEvery;
        m.setVelocityX(0);
        scene.shootTongue(m, player.x < m.x ? -1 : 1);
        return;
      }
      hop(scene, m, time);
    },
  },

  p: {
    /**
     * Панголин. Ходит медленно, но заметив героя — сворачивается в клубок и
     * катится быстрее, чем тот бегает.
     *
     * Его нельзя переждать и нельзя перестрелять: в клубке он неуязвим и не
     * останавливается. Останавливает его только край обрыва или стена, и
     * ровно в этот миг он и уязвим — оглушённый после удара он лежит секунду,
     * и это единственное окно, чтобы с ним покончить. Отсюда и весь замысел:
     * не «убей монстра», а «заведи его в стену».
     *
     * Восклицательный знак над головой — обещание игроку: между «заметил» и
     * «покатился» есть семь десятых секунды, и их хватает, чтобы отпрыгнуть.
     */
    key: 'pangolin',
    runKey: 'pangolin-run',
    ballKey: 'pangolin-ball',
    stunKey: 'pangolin-stunned',
    xp: XP.monster.hard,
    stompable: true,
    ground: true,
    body: { w: 44, h: 30, ox: 27, oy: 24 },
    ballBody: { w: 46, h: 44, ox: 25, oy: 10 },
    speed: 120, // половина хода героя
    // Участок короткий нарочно: панголин ценен не прогулкой, а разгоном, и
    // стоять он должен там, куда его поставили, — перед выступом.
    patrolRange: 300,
    rollSpeed: 288, // и вдвое с лишним быстрее в клубке — 1.2 от хода героя
    sight: 500, // видит на 500 в обе стороны — и вплотную тоже
    rollRange: 1200, // дальше этого клубок не катится
    curlMs: 700, // столько думает, прежде чем свернуться
    edgeMs: 1000, // столько стоит на краю обрыва
    stunMs: 1000, // столько лежит после удара о стену
    update(scene, m, time) {
      const игрок = scene.player;

      // Два кадра бега, восемь раз в секунду: по ножкам видно, что зверь
      // перебирает ими, а не едет по земле.
      const перебирает = () => {
        const ключ = Math.floor(time / 130) % 2 ? m.type.runKey : m.type.key;
        if (m.texture.key !== ключ) m.setTexture(ключ);
      };

      // ── Лежит оглушённый ────────────────────────────────────────────
      if (m.state === 'stun') {
        m.setVelocityX(0);
        if (time < m.stunUntil) return;
        развернуться(m, m.type.key);
        m.state = 'back';
        return;
      }

      // ── Замер на краю обрыва ────────────────────────────────────────
      if (m.state === 'edge') {
        m.setVelocityX(0);
        if (time < m.edgeUntil) return;
        развернуться(m, m.type.key);
        m.state = 'back';
        return;
      }

      // ── Катится ─────────────────────────────────────────────────────
      if (m.state === 'roll') {
        m.setVelocityX(m.dir * m.rollSpeed);
        m.angle += m.dir * 9;

        // Врезался в твёрдое — оглушение и звёздочки, как у осы.
        if (m.dir > 0 ? m.body.blocked.right : m.body.blocked.left) {
          m.state = 'stun';
          m.stunUntil = time + m.stunMs;
          m.setVelocity(0, 0);
          развернуться(m, m.type.stunKey);
          scene.puff(m.x, m.y, 0xffe08a);
          scene.spinDizzyStars(m, m.stunMs);
          return;
        }

        // Докатился до обрыва — встал на краю.
        const впереди = m.x + m.dir * 40;
        if (m.body.blocked.down && !scene.isSolidAtPixel(впереди, m.body.bottom + 10)) {
          m.state = 'edge';
          m.edgeUntil = time + m.edgeMs;
          m.setVelocityX(0);
          return;
        }

        // Разгон не бесконечен: 1200 пикселей — и клубок сам встаёт, как у
        // обрыва. Иначе один панголин уезжает через полэтапа и попадается
        // игроку там, где его никто не ставил.
        if (Math.abs(m.x - (m.rollFrom ?? m.x)) >= m.rollRange) {
          m.state = 'edge';
          m.edgeUntil = time + m.edgeMs;
          m.setVelocityX(0);
        }
        return;
      }

      // ── Заметил героя и вот-вот свернётся ───────────────────────────
      if (m.state === 'alert') {
        m.setVelocityX(0);
        if (time >= m.curlAt) свернуться(scene, m);
        return;
      }

      // ── Видит героя ─────────────────────────────────────────────────
      //
      // Смотрит он не вперёд, а вокруг: 500 пикселей в обе стороны, и
      // вплотную тоже. И бросается из любого положения — идёт ли он по
      // маршруту или возвращается на него после неудачного заезда. Ждать,
      // пока панголин дотопает до своей точки, чтобы он снова стал опасен,
      // игроку негде: стоять рядом с ним всё это время он и так не может.
      const наОдномУровне = Math.abs(игрок.y - m.y) < 200;
      if (Math.abs(игрок.x - m.x) <= m.sight && наОдномУровне) {
        m.state = 'alert';
        m.curlAt = time + m.curlMs;
        m.setVelocityX(0);
        m.setFlipX(игрок.x < m.x);
        scene.показатьТревогу(m, m.curlMs);
        return;
      }

      // ── Возвращается на свой маршрут ────────────────────────────────
      if (m.state === 'back') {
        const куда = (m.homeX ?? m.x) - m.x;
        // Упёрся по дороге назад — значит, дошёл: толкаться в стену до конца
        // этапа он не должен.
        if (Math.abs(куда) < 24 || m.body.blocked.left || m.body.blocked.right) {
          m.state = 'walk';
          m.setVelocityX(0);
          return;
        }
        m.dir = куда < 0 ? -1 : 1;
        m.setVelocityX(m.dir * m.speed);
        m.setFlipX(m.dir < 0);
        перебирает();
        return;
      }

      // ── Обычный ход ─────────────────────────────────────────────────
      patrol(scene, m);
      перебирает();
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
    strikeRange: 171, // на этой дистанции бросается
    // Выпад короче на десятую часть, а повторяет змея вдвое реже: очередь из
    // бросков раз в 900 мс не оставляла промежутка, в который можно пройти.
    strikeSpeed: 504,
    strikeEvery: 1800,
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
        // Бросок делаем скоростью: твин по x физическое тело перебивает,
        // и от размаха оставалась четверть. Наклон — твином, его физика
        // не трогает.
        m.setVelocityX(dir * m.strikeSpeed);
        scene.tweens.add({ targets: m, angle: dir * 62, duration: 190, yoyo: true });
        scene.time.delayedCall(190, () => m.active && m.setVelocityX(-dir * m.strikeSpeed));
        scene.time.delayedCall(380, () => m.active && m.setVelocityX(0));
      }
    },
  },
};

/** Символы монстров — по ним карта отличает их от прочего. */
export const MONSTER_KEYS = Object.keys(MONSTERS);
