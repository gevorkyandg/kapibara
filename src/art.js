/**
 * Вся графика рисуется кодом и превращается в текстуры при старте.
 *
 * Почему так: в сборке нет ни одной картинки — игра весит меньше и грузится
 * быстрее (на порталах это прямо влияет на то, дождётся ли игрок старта),
 * и не нужно ни у кого спрашивать права на рисунки.
 */

import { SLOPE_STEPS } from './config.js';

/** Палитры уровней: 0 — луг, 1 — закатный берег, 2 — вечерний лес. */
export const THEMES = [
  {
    sky: 0x8fd6f2,
    skyBottom: 0xd9f2c8,
    hillFar: 0x9fd9a0,
    hillNear: 0x74c47a,
    grass: 0x6fc25f,
    grassDark: 0x4f9c45,
    dirt: 0xb07a4e,
    dirtDark: 0x8a5c37,
    cloud: 0xffffff,
    tree: 0x4faa54,
  },
  {
    sky: 0xffc48a,
    skyBottom: 0xffe6c0,
    hillFar: 0xf0a978,
    hillNear: 0xd98a63,
    grass: 0xf2d08a,
    grassDark: 0xd4ab5e,
    dirt: 0xc2895a,
    dirtDark: 0x9c6a41,
    cloud: 0xfff1e0,
    tree: 0x7fb069,
  },
  {
    sky: 0x6f7fc4,
    skyBottom: 0xb6a8dd,
    hillFar: 0x5c7a8f,
    hillNear: 0x47617a,
    grass: 0x63a06a,
    grassDark: 0x3f7248,
    dirt: 0x7a5b45,
    dirtDark: 0x5b4231,
    cloud: 0xe6e2f5,
    tree: 0x39865a,
  },
];

const OUTLINE = 0x5a3a22;

/** Мелкий помощник: сохранить нарисованное в текстуру и очистить кисть. */
function bake(g, key, w, h) {
  g.generateTexture(key, w, h);
  g.clear();
}

/** Точки пятиконечной звезды. */
function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function createTextures(scene) {
  const g = scene.add.graphics();

  // Капибара: туловище с головой одной текстурой, лапы — отдельной. Так лапы
  // качаются при ходьбе, а перерисовывать всю капибару не нужно.
  const body = 0xc08552;
  const bodyLight = 0xdfae7c;

  // Капибара — это «батон» туловища, плоская голова спереди и крупная
  // прямоугольная морда: именно морда отличает капибару от медвежонка.
  g.fillStyle(body, 1);
  g.lineStyle(4, OUTLINE, 1);
  g.fillCircle(78, 12, 9); // ушко — рисуем до головы, торчит сверху
  g.strokeCircle(78, 12, 9);

  g.fillRoundedRect(4, 32, 90, 48, 22); // туловище
  g.strokeRoundedRect(4, 32, 90, 48, 22);
  g.fillStyle(bodyLight, 1);
  g.fillRoundedRect(14, 58, 70, 20, 10); // светлое брюшко

  // Голова заходит на туловище — так они читаются как одно животное.
  g.fillStyle(body, 1);
  g.fillRoundedRect(66, 10, 52, 48, 20);
  g.strokeRoundedRect(66, 10, 52, 48, 20);

  // Морда сильно выступает вперёд: это главная примета капибары.
  g.fillStyle(bodyLight, 1);
  g.fillRoundedRect(104, 28, 34, 28, 13);
  g.strokeRoundedRect(104, 28, 34, 28, 13);

  g.fillStyle(0x5a3a22, 1);
  g.fillRoundedRect(123, 32, 14, 10, 5); // крупный тёмный нос

  g.fillStyle(0xffffff, 1);
  g.fillCircle(84, 30, 8); // глаз
  g.lineStyle(2, OUTLINE, 0.6);
  g.strokeCircle(84, 30, 8);
  g.fillStyle(0x3a2416, 1);
  g.fillCircle(86, 31, 4.8);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(88, 28, 2.1); // блик в глазу

  g.fillStyle(0xf59fb0, 0.55);
  g.fillCircle(76, 46, 7.5); // румянец

  g.lineStyle(3, OUTLINE, 1);
  g.beginPath();
  g.arc(118, 46, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  g.strokePath(); // улыбка
  bake(g, 'capy', 146, 90);

  g.fillStyle(0xa9743f, 1);
  g.lineStyle(4, OUTLINE, 1);
  g.fillRoundedRect(3, 2, 14, 26, 7);
  g.strokeRoundedRect(3, 2, 14, 26, 7);
  bake(g, 'capy-leg', 20, 32);

  // Монетка
  g.fillStyle(0xffd451, 1);
  g.lineStyle(4, 0xc9922a, 1);
  g.fillCircle(20, 20, 16);
  g.strokeCircle(20, 20, 16);
  g.fillStyle(0xffe999, 1);
  g.fillCircle(15, 15, 5);
  g.lineStyle(3, 0xc9922a, 1);
  g.strokeCircle(20, 20, 9);
  bake(g, 'coin', 40, 40);

  // Ломтик тортика: корж, прослойка с вареньем, розовая глазурь и вишенка.
  g.fillStyle(0xf5d9a8, 1);
  g.lineStyle(3, 0x8d5a2b, 1);
  g.fillRoundedRect(8, 24, 32, 20, 4);
  g.strokeRoundedRect(8, 24, 32, 20, 4);
  g.fillStyle(0xe0454f, 1);
  g.fillRect(9, 31, 30, 5); // прослойка
  g.fillStyle(0xf9a7c0, 1);
  g.lineStyle(3, 0xd06a8c, 1);
  g.fillRoundedRect(5, 15, 38, 11, 5); // глазурь
  g.strokeRoundedRect(5, 15, 38, 11, 5);
  g.fillStyle(0xf9a7c0, 1);
  g.fillCircle(14, 26, 4); // подтёки глазури
  g.fillCircle(34, 26, 4);
  g.fillStyle(0x2f7a3a, 1);
  g.lineStyle(3, 0x2f7a3a, 1);
  g.lineBetween(24, 12, 27, 5);
  g.fillStyle(0xe0454f, 1);
  g.lineStyle(3, 0x9c2b33, 1);
  g.fillCircle(24, 10, 6); // вишенка
  g.strokeCircle(24, 10, 6);
  bake(g, 'treat-cake', 48, 48);

  // Кекс: розовая шапочка, гофрированная корзинка, вишенка.
  const cupBasket = [
    { x: 10, y: 24 },
    { x: 38, y: 24 },
    { x: 33, y: 44 },
    { x: 15, y: 44 },
  ];
  g.fillStyle(0xf48fb1, 1);
  g.fillCircle(16, 18, 9);
  g.fillCircle(32, 18, 9);
  g.fillCircle(24, 12, 10);
  g.fillStyle(0xd9a066, 1);
  g.fillPoints(cupBasket, true);
  g.lineStyle(3, 0x8d5a2b, 1);
  g.strokePoints(cupBasket, true);
  g.lineStyle(2, 0x8d5a2b, 0.5);
  g.lineBetween(19, 25, 18, 43);
  g.lineBetween(29, 25, 30, 43);
  g.fillStyle(0xe0454f, 1);
  g.fillCircle(24, 5, 5);
  bake(g, 'treat-cupcake', 48, 48);

  // Мороженое: рожок и два шарика.
  const cone = [
    { x: 12, y: 26 },
    { x: 36, y: 26 },
    { x: 24, y: 46 },
  ];
  g.fillStyle(0xd9a066, 1);
  g.fillPoints(cone, true);
  g.lineStyle(3, 0x8d5a2b, 1);
  g.strokePoints(cone, true);
  g.fillStyle(0x8ed6c8, 1);
  g.lineStyle(3, 0x4f9d90, 1);
  g.fillCircle(18, 20, 10);
  g.strokeCircle(18, 20, 10);
  g.fillStyle(0xf9a7c0, 1);
  g.lineStyle(3, 0xd06a8c, 1);
  g.fillCircle(30, 16, 10);
  g.strokeCircle(30, 16, 10);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(27, 12, 3);
  bake(g, 'treat-icecream', 48, 48);

  // ── Монстры (ТЗ) ────────────────────────────────────────────────────────
  // Все нестрашные: круглые формы, большие глаза, улыбки. Сложность читается
  // не злобой, а формой — у кого шипы, тот и опасен.

  /** Пара больших глаз с бликами — общая часть почти всех монстров. */
  const eyes = (x1, x2, y, r, pupil = 0x2f2016) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x1, y, r);
    g.fillCircle(x2, y, r);
    g.fillStyle(pupil, 1);
    g.fillCircle(x1 + 1, y + 1, r * 0.5);
    g.fillCircle(x2 + 1, y + 1, r * 0.5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x1 + 2, y - 2, r * 0.22);
    g.fillCircle(x2 + 2, y - 2, r * 0.22);
  };

  const smile = (cx, cy, r, color = 0x2f2016) => {
    g.lineStyle(3, color, 1);
    g.beginPath();
    g.arc(cx, cy, r, 0.1 * Math.PI, 0.9 * Math.PI);
    g.strokePath();
  };

  // Черепашка. Голова смотрит вправо — туда же, куда она идёт по умолчанию;
  // под панцирем плотное тельце, иначе она выглядит полупустой.
  g.fillStyle(0x8ed081, 1);
  g.lineStyle(4, 0x3f7a3a, 1);
  g.fillRoundedRect(6, 30, 44, 20, 9); // тело под панцирем
  g.strokeRoundedRect(6, 30, 44, 20, 9);
  g.fillEllipse(14, 50, 15, 9); // лапки
  g.strokeEllipse(14, 50, 15, 9);
  g.fillEllipse(40, 50, 15, 9);
  g.strokeEllipse(40, 50, 15, 9);

  g.fillEllipse(56, 32, 24, 21); // голова справа
  g.strokeEllipse(56, 32, 24, 21);

  g.fillStyle(0x9c6236, 1);
  g.lineStyle(4, 0x5a3a22, 1);
  g.beginPath();
  g.arc(27, 32, 23, Math.PI, 0); // панцирь
  g.fillPath();
  g.strokePath();
  g.fillStyle(0xbf8146, 1);
  g.fillCircle(20, 24, 5);
  g.fillCircle(34, 26, 5);

  eyes(52, 62, 28, 5);
  smile(58, 36, 4);
  bake(g, 'turtle', 72, 58);

  // Муха: тёмное тельце и большие крылья. Летает вверх-вниз.
  g.fillStyle(0xdff3ff, 0.85);
  g.lineStyle(3, 0x8fb8cc, 1);
  g.fillEllipse(14, 12, 22, 14);
  g.strokeEllipse(14, 12, 22, 14);
  g.fillEllipse(38, 12, 22, 14);
  g.strokeEllipse(38, 12, 22, 14);
  g.fillStyle(0x5b6b7a, 1);
  g.lineStyle(4, 0x2f3a45, 1);
  g.fillEllipse(26, 28, 34, 26);
  g.strokeEllipse(26, 28, 34, 26);
  eyes(20, 33, 24, 7);
  smile(26, 34, 5);
  bake(g, 'fly', 54, 46);

  // Лягушка: прыгает с места на место, топчется прыжком.
  g.fillStyle(0x6fc25f, 1);
  g.lineStyle(4, 0x3f7a3a, 1);
  g.fillEllipse(28, 34, 48, 32); // тело
  g.strokeEllipse(28, 34, 48, 32);
  g.fillEllipse(10, 46, 16, 10); // лапки
  g.strokeEllipse(10, 46, 16, 10);
  g.fillEllipse(46, 46, 16, 10);
  g.strokeEllipse(46, 46, 16, 10);
  g.fillStyle(0x6fc25f, 1);
  g.fillCircle(18, 16, 10); // глазные бугорки
  g.strokeCircle(18, 16, 10);
  g.fillCircle(38, 16, 10);
  g.strokeCircle(38, 16, 10);
  eyes(18, 38, 15, 6);
  smile(28, 34, 9);
  bake(g, 'frog', 60, 56);

  // Ёжик: спина колючая — прыгать нельзя, и это видно. Иголки выложены
  // синусоидой с горкой посередине, а не частоколом одной высоты.
  g.fillStyle(0x6b4a33, 1);
  g.lineStyle(3, 0x3d2a1c, 1);
  for (let i = 0; i < 11; i++) {
    const x = 8 + i * 4.6;
    // Горка посередине: высота иголки идёт по синусу от края к краю.
    const высота = 8 + Math.sin((i / 10) * Math.PI) * 20;
    g.fillPoints(
      [
        { x: x - 4, y: 34 },
        { x: x + 1, y: 34 - высота },
        { x: x + 5, y: 34 },
      ],
      true
    );
  }

  g.fillStyle(0xc9a06b, 1);
  g.lineStyle(4, 0x8d6b4b, 1);
  g.fillEllipse(32, 40, 56, 24); // тело
  g.strokeEllipse(32, 40, 56, 24);

  // Ножки: без них ёжик казался плывущим
  g.fillStyle(0x8d6b4b, 1);
  g.lineStyle(3, 0x5a3a22, 1);
  [16, 30, 46].forEach((x) => {
    g.fillRoundedRect(x, 48, 9, 9, 4);
    g.strokeRoundedRect(x, 48, 9, 9, 4);
  });

  g.fillStyle(0xdcb984, 1);
  g.lineStyle(3, 0x8d6b4b, 1);
  g.fillEllipse(56, 41, 22, 18); // мордочка справа
  g.strokeEllipse(56, 41, 22, 18);
  g.fillStyle(0x2f2016, 1);
  g.fillCircle(65, 40, 3.5); // носик
  eyes(50, 60, 37, 4);
  bake(g, 'hedgehog', 72, 60);

  // Дикобраз: тот же принцип, но иглы во все стороны — он ими и стреляет.
  g.fillStyle(0x5a4636, 1);
  g.lineStyle(3, 0x2f2016, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineBetween(34 + Math.cos(a) * 20, 34 + Math.sin(a) * 20, 34 + Math.cos(a) * 32, 34 + Math.sin(a) * 32);
  }
  g.fillStyle(0x8d6b4b, 1);
  g.lineStyle(4, 0x3d2a1c, 1);
  g.fillCircle(34, 34, 22);
  g.strokeCircle(34, 34, 22);
  eyes(27, 41, 30, 6);
  smile(34, 40, 6);
  bake(g, 'porcupine', 68, 68);

  // Игла дикобраза
  g.fillStyle(0x5a4636, 1);
  g.lineStyle(2, 0x2f2016, 1);
  g.fillPoints([{ x: 2, y: 5 }, { x: 16, y: 8 }, { x: 2, y: 11 }], true);
  g.strokePoints([{ x: 2, y: 5 }, { x: 16, y: 8 }, { x: 2, y: 11 }], true);
  bake(g, 'quill', 18, 16);

  // Оса: темнее пчелы, брови строгие (ТЗ), улыбка на месте.
  g.fillStyle(0xdff3ff, 0.85);
  g.lineStyle(3, 0x8fb8cc, 1);
  g.fillEllipse(18, 10, 20, 14);
  g.strokeEllipse(18, 10, 20, 14);
  g.fillEllipse(38, 10, 20, 14);
  g.strokeEllipse(38, 10, 20, 14);
  g.fillStyle(0xd8a318, 1);
  g.lineStyle(4, 0x5e4408, 1);
  g.fillEllipse(28, 28, 40, 30);
  g.strokeEllipse(28, 28, 40, 30);
  g.fillStyle(0x3a2a06, 1);
  g.fillRect(26, 16, 7, 25);
  g.fillRect(37, 19, 6, 19);
  g.fillPoints([{ x: 48, y: 26 }, { x: 56, y: 30 }, { x: 48, y: 32 }], true); // жало
  eyes(14, 22, 25, 5);
  g.lineStyle(3, 0x3a2a06, 1);
  g.lineBetween(9, 17, 18, 20); // строгие брови
  g.lineBetween(27, 20, 18, 17);
  smile(18, 33, 5);
  bake(g, 'wasp', 58, 46);

  // Оса в атаке: крылья прижаты, жало выставлено вперёд. Картинка рисуется
  // жалом вправо, а в игре поворачивается по направлению удара — так жало
  // всегда смотрит на капибару.
  g.fillStyle(0xdff3ff, 0.8);
  g.lineStyle(3, 0x8fb8cc, 1);
  g.fillEllipse(14, 12, 26, 11); // крылья отброшены назад
  g.strokeEllipse(14, 12, 26, 11);
  g.fillEllipse(12, 32, 24, 10);
  g.strokeEllipse(12, 32, 24, 10);
  g.fillStyle(0xd8a318, 1);
  g.lineStyle(4, 0x5e4408, 1);
  g.fillEllipse(30, 22, 42, 26); // вытянутое тело
  g.strokeEllipse(30, 22, 42, 26);
  g.fillStyle(0x3a2a06, 1);
  g.fillRect(24, 11, 7, 22);
  g.fillRect(35, 14, 6, 16);
  g.fillPoints(
    [
      { x: 50, y: 16 },
      { x: 72, y: 22 },
      { x: 50, y: 28 },
    ],
    true
  ); // длинное жало вперёд
  g.fillStyle(0xffffff, 1);
  g.fillCircle(18, 19, 5);
  g.fillStyle(0x2f2016, 1);
  g.fillCircle(19, 20, 2.6);
  g.lineStyle(3, 0x3a2a06, 1);
  g.lineBetween(11, 12, 22, 16); // сдвинутая бровь — она злится
  bake(g, 'wasp-dive', 76, 46);

  // Оса, потерявшая сознание: лежит на спине, лапки кверху, глаза косые,
  // язык наружу.
  g.fillStyle(0xdff3ff, 0.75);
  g.lineStyle(3, 0x8fb8cc, 1);
  g.fillEllipse(24, 20, 26, 12); // смятые крылья
  g.strokeEllipse(24, 20, 26, 12);
  g.fillStyle(0xd8a318, 1);
  g.lineStyle(4, 0x5e4408, 1);
  g.fillEllipse(32, 34, 46, 24); // тело лежит
  g.strokeEllipse(32, 34, 46, 24);
  g.fillStyle(0x3a2a06, 1);
  g.fillRect(30, 24, 7, 20);
  g.fillRect(41, 26, 6, 16);
  g.lineStyle(3, 0x3a2a06, 1);
  [16, 26, 36].forEach((x) => g.lineBetween(x, 24, x - 4, 14)); // лапки кверху
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 32, 6);
  g.fillCircle(27, 31, 6);
  g.lineStyle(3, 0x2f2016, 1);
  // Косые глаза-крестики
  g.lineBetween(13, 29, 19, 35);
  g.lineBetween(19, 29, 13, 35);
  g.lineBetween(24, 28, 30, 34);
  g.lineBetween(30, 28, 24, 34);
  g.fillStyle(0xf48fb1, 1);
  g.lineStyle(3, 0xc2506a, 1);
  g.fillRoundedRect(6, 36, 14, 8, 4); // высунутый язык
  g.strokeRoundedRect(6, 36, 14, 8, 4);
  bake(g, 'wasp-stunned', 62, 50);

  // Звёздочка над головой оглушённого — их кружится несколько
  g.fillStyle(0xffffff, 1);
  g.lineStyle(2, 0xd9e6f2, 1);
  g.fillPoints(starPoints(9, 9, 8, 3.4), true);
  g.strokePoints(starPoints(9, 9, 8, 3.4), true);
  bake(g, 'star-dizzy', 18, 18);

  // Жаба: больше и темнее лягушки, стреляет языком.
  g.fillStyle(0x4f8a45, 1);
  g.lineStyle(4, 0x2c5427, 1);
  g.fillEllipse(34, 40, 60, 40);
  g.strokeEllipse(34, 40, 60, 40);
  g.fillEllipse(12, 56, 20, 12);
  g.strokeEllipse(12, 56, 20, 12);
  g.fillEllipse(56, 56, 20, 12);
  g.strokeEllipse(56, 56, 20, 12);
  g.fillStyle(0x4f8a45, 1);
  g.fillCircle(22, 18, 12);
  g.strokeCircle(22, 18, 12);
  g.fillCircle(46, 18, 12);
  g.strokeCircle(46, 18, 12);
  eyes(22, 46, 17, 7);
  smile(34, 40, 12);
  bake(g, 'toad', 72, 66);

  // Язык жабы — растягивается по горизонтали
  g.fillStyle(0xf48fb1, 1);
  g.lineStyle(3, 0xc2506a, 1);
  g.fillRoundedRect(0, 2, 24, 12, 6);
  g.strokeRoundedRect(0, 2, 24, 12, 6);
  bake(g, 'tongue', 24, 16);

  // Змея: длинная и тонкая. Тело — основной хитбокс, поэтому оно и рисуется
  // главным: извивающийся ствол от норы вверх и голова с язычком.
  g.lineStyle(17, 0x3f6b2a, 1);
  g.beginPath();
  g.moveTo(20, 116);
  g.lineTo(20, 92);
  g.lineTo(34, 74);
  g.lineTo(18, 54);
  g.lineTo(30, 34);
  g.strokePath();
  g.lineStyle(12, 0x7bb356, 1);
  g.beginPath();
  g.moveTo(20, 116);
  g.lineTo(20, 92);
  g.lineTo(34, 74);
  g.lineTo(18, 54);
  g.lineTo(30, 34);
  g.strokePath();

  // Пятнышки вдоль тела
  g.fillStyle(0x5d8f3d, 1);
  [[20, 100], [28, 82], [24, 62], [26, 44]].forEach(([x, y]) => g.fillCircle(x, y, 3.5));

  g.fillStyle(0x7bb356, 1);
  g.lineStyle(4, 0x3f6b2a, 1);
  g.fillEllipse(34, 24, 34, 24); // голова
  g.strokeEllipse(34, 24, 34, 24);
  eyes(28, 42, 20, 4.5);
  g.fillStyle(0xe0454f, 1);
  g.fillPoints([{ x: 50, y: 26 }, { x: 66, y: 23 }, { x: 66, y: 29 }], true); // язычок
  g.fillStyle(0x3f6b2a, 1);
  g.fillRect(48, 26, 4, 3);
  bake(g, 'snake', 70, 124);

  // Нора: яма, прикрытая соломой (ТЗ) — её видно заранее
  g.fillStyle(0x3d2a1c, 1);
  g.fillEllipse(30, 16, 56, 22);
  g.fillStyle(0xd9b96a, 1);
  g.lineStyle(3, 0xa88a3e, 1);
  for (let i = 0; i < 6; i++) {
    g.lineBetween(6 + i * 9, 10 + (i % 2) * 4, 16 + i * 9, 20 - (i % 2) * 4);
  }
  bake(g, 'burrow', 60, 28);

  // Табличка-предупреждение перед длинной пропастью (ТЗ)
  g.fillStyle(0x8d6b4b, 1);
  g.lineStyle(4, 0x5a3a22, 1);
  g.fillRoundedRect(20, 30, 8, 30, 3);
  g.strokeRoundedRect(20, 30, 8, 30, 3);
  g.fillStyle(0xffd451, 1);
  g.lineStyle(4, 0xc9922a, 1);
  g.fillRoundedRect(2, 2, 44, 32, 8);
  g.strokeRoundedRect(2, 2, 44, 32, 8);
  g.fillStyle(0x5a3a22, 1);
  g.fillRoundedRect(21, 8, 6, 15, 3);
  g.fillCircle(24, 28, 3.4);
  bake(g, 'sign', 48, 62);



  // Табличка с ульем: предупреждает не об одной осе, а о целом рое (ТЗ роя).
  // Улей рисуем полосами-ярусами с летком внизу — так он читается сразу и не
  // путается с восклицательным знаком.
  g.fillStyle(0x8d6b4b, 1);
  g.lineStyle(4, 0x5a3a22, 1);
  g.fillRoundedRect(20, 30, 8, 30, 3);
  g.strokeRoundedRect(20, 30, 8, 30, 3);
  g.fillStyle(0xffd451, 1);
  g.lineStyle(4, 0xc9922a, 1);
  g.fillRoundedRect(2, 2, 44, 32, 8);
  g.strokeRoundedRect(2, 2, 44, 32, 8);
  g.fillStyle(0xc98a2e, 1);
  [
    { y: 9, w: 13 },
    { y: 15, w: 17 },
    { y: 21, w: 15 },
    { y: 27, w: 11 },
  ].forEach((я) => {
    g.fillRoundedRect(24 - я.w / 2, я.y, я.w, 5, 2.5);
  });
  g.fillStyle(0x5a3a22, 1);
  g.fillCircle(24, 26, 2.6); // леток
  bake(g, 'sign-hive', 48, 62);

  // Предупреждение о валуне. Оно висит у края экрана и едет вместе с героем,
  // поэтому палочка ему не нужна: это не столб при дороге, а значок.
  // Знаков столько же, сколько будет камней.
  for (let знаков = 1; знаков <= 3; знаков++) {
    g.fillStyle(0xffd451, 1);
    g.lineStyle(5, 0xc9922a, 1);
    g.fillRoundedRect(3, 3, 86, 56, 14);
    g.strokeRoundedRect(3, 3, 86, 56, 14);
    g.fillStyle(0x5a3a22, 1);
    const шаг = 22;
    const начало = 46 - ((знаков - 1) * шаг) / 2;
    for (let i = 0; i < знаков; i++) {
      const x = начало + i * шаг;
      g.fillRoundedRect(x - 3.5, 13, 7, 22, 3.5);
      g.fillCircle(x, 45, 4);
    }
    bake(g, `warn-${знаков}`, 92, 62);
  }

  // Валун: катится по склону, трогать нельзя (ТЗ). Трещина и пятна нужны
  // не для красоты — без них не видно, что камень крутится.
  g.fillStyle(0x9aa3ac, 1);
  g.lineStyle(4, 0x5f6a75, 1);
  g.fillCircle(30, 30, 27);
  g.strokeCircle(30, 30, 27);
  g.fillStyle(0x7f8993, 1);
  g.fillCircle(20, 22, 7);
  g.fillCircle(38, 36, 9);
  g.fillCircle(24, 41, 5);
  g.lineStyle(3, 0x5f6a75, 1);
  g.beginPath();
  g.moveTo(12, 26);
  g.lineTo(22, 31);
  g.lineTo(16, 38);
  g.strokePath();
  g.fillStyle(0xb6bec6, 1);
  g.fillCircle(38, 19, 5); // блик, чтобы камень не выглядел плоским
  bake(g, 'boulder', 60, 60);

  // Шип, свисающий с потолка пещеры (ТЗ): широкое основание, острый низ.
  g.fillStyle(0xb9c4cf, 1);
  g.lineStyle(3, 0x6b7885, 1);
  const сосулька = [
    { x: 3, y: 2 },
    { x: 33, y: 2 },
    { x: 18, y: 50 },
  ];
  g.fillPoints(сосулька, true);
  g.strokePoints(сосулька, true);
  g.fillStyle(0x8e9aa6, 1);
  g.fillTriangle(18, 2, 33, 2, 18, 34); // тень с одной стороны — объём
  bake(g, 'spike-hang', 36, 52);

  // Ходячий монстрик: круглый и улыбчивый — «нестрашный».
  g.fillStyle(0x8ed081, 1);
  g.lineStyle(4, 0x3f7a3a, 1);
  g.lineBetween(16, 12, 12, 4);
  g.lineBetween(40, 12, 44, 4);
  g.fillCircle(12, 4, 4);
  g.fillCircle(44, 4, 4);
  g.fillEllipse(28, 28, 46, 38);
  g.strokeEllipse(28, 28, 46, 38);
  g.fillEllipse(14, 47, 16, 8);
  g.strokeEllipse(14, 47, 16, 8);
  g.fillEllipse(42, 47, 16, 8);
  g.strokeEllipse(42, 47, 16, 8);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(20, 24, 8);
  g.fillCircle(36, 24, 8);
  g.fillStyle(0x2f2016, 1);
  g.fillCircle(21, 25, 4);
  g.fillCircle(37, 25, 4);
  g.lineStyle(3, 0x2f2016, 1);
  g.beginPath();
  g.arc(28, 34, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  g.strokePath();
  bake(g, 'walker', 56, 54);

  // Летающий монстрик: пчёлка с полупрозрачными крылышками.
  g.fillStyle(0xdff3ff, 0.85);
  g.lineStyle(3, 0x8fb8cc, 1);
  g.fillEllipse(18, 10, 20, 14);
  g.strokeEllipse(18, 10, 20, 14);
  g.fillEllipse(38, 10, 20, 14);
  g.strokeEllipse(38, 10, 20, 14);
  g.fillStyle(0xf7d154, 1);
  g.lineStyle(4, 0x8a6212, 1);
  g.fillEllipse(28, 28, 40, 30);
  g.strokeEllipse(28, 28, 40, 30);
  g.fillStyle(0x8a6212, 1);
  g.fillRect(26, 16, 6, 24);
  g.fillRect(36, 19, 5, 18);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(17, 25, 6);
  g.fillStyle(0x2f2016, 1);
  g.fillCircle(16, 26, 3);
  g.lineStyle(3, 0x2f2016, 1);
  g.beginPath();
  g.arc(16, 33, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  g.strokePath();
  bake(g, 'bee', 56, 46);

  // Шипы
  g.fillStyle(0xb9c4cf, 1);
  g.lineStyle(3, 0x6b7885, 1);
  for (let i = 0; i < 3; i++) {
    const x = 4 + i * 18;
    const pts = [
      { x, y: 34 },
      { x: x + 9, y: 6 },
      { x: x + 18, y: 34 },
    ];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
  }
  bake(g, 'spike', 60, 38);

  // Костёр: как колючки, трогать нельзя ни с какой стороны (ТЗ).
  // Пламя — капля со скруглённым низом и острым верхом: так огонь читается
  // сразу, в отличие от простого треугольника.
  const flame = (cx, bottom, w, h, color) => {
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(cx, bottom - h); // острый кончик
    g.lineTo(cx + w * 0.45, bottom - h * 0.45);
    g.lineTo(cx + w * 0.5, bottom - h * 0.16);
    g.arc(cx, bottom - h * 0.16, w * 0.5, 0, Math.PI); // круглый низ
    g.lineTo(cx - w * 0.45, bottom - h * 0.45);
    g.closePath();
    g.fillPath();
  };

  // Пламя и поленья — двумя отдельными картинками: в игре дрожать должен
  // только огонь, а поленья обязаны лежать смирно.
  flame(34, 56, 40, 52, 0xe8480f); // внешнее пламя
  flame(34, 54, 27, 38, 0xf5900f); // среднее
  flame(34, 52, 15, 24, 0xffd451); // сердцевина
  g.fillStyle(0xfff3b0, 0.9);
  g.fillEllipse(34, 44, 8, 12);
  bake(g, 'campfire-flame', 68, 60);

  g.fillStyle(0x8a3a12, 1);
  g.fillEllipse(34, 8, 46, 12); // угли
  g.fillStyle(0x8d6b4b, 1);
  g.lineStyle(4, 0x5a3a22, 1);
  g.fillRoundedRect(4, 8, 60, 14, 7); // полено
  g.strokeRoundedRect(4, 8, 60, 14, 7);
  g.fillStyle(0x6b4a33, 1);
  g.fillEllipse(11, 15, 10, 10);
  g.fillEllipse(57, 15, 10, 10);
  bake(g, 'campfire-logs', 68, 26);

  // Пружина — двумя картинками, как костёр: подставка стоит на месте, а
  // сжимается только спираль. Одной картинкой не выходит: масштаб по высоте
  // тянет и подставку, и она уезжает из-под пружины.
  g.fillStyle(0x9aa7b4, 1);
  g.lineStyle(4, 0x5f6b78, 1);
  g.fillRoundedRect(6, 2, 48, 12, 5);
  g.strokeRoundedRect(6, 2, 48, 12, 5);
  bake(g, 'spring-base', 60, 16);

  // Спираль с розовой пяткой наверху. Рисуется снизу вверх, чтобы при сжатии
  // низ оставался на подставке.
  g.lineStyle(6, 0xd8dee6, 1);
  g.beginPath();
  g.moveTo(14, 40);
  for (let i = 0; i < 3; i++) {
    g.lineTo(46, 34 - i * 8);
    g.lineTo(14, 28 - i * 8);
  }
  g.strokePath();
  g.fillStyle(0xff8fa3, 1);
  g.lineStyle(4, 0xc2506a, 1);
  g.fillRoundedRect(8, 2, 44, 12, 6);
  g.strokeRoundedRect(8, 2, 44, 12, 6);
  bake(g, 'spring-coil', 60, 42);

  // Облачко: мягкая ступенька, которая лопается после касания
  g.fillStyle(0xffffff, 1);
  g.lineStyle(4, 0xb9cddd, 1);
  g.fillCircle(20, 24, 16);
  g.fillCircle(40, 22, 18);
  g.fillCircle(58, 26, 14);
  g.fillRect(20, 24, 38, 16);
  g.strokeCircle(20, 24, 16);
  g.strokeCircle(40, 22, 18);
  g.strokeCircle(58, 26, 14);
  bake(g, 'cloudlet', 76, 46);

  // Флаг финиша
  const flagCloth = [
    { x: 18, y: 10 },
    { x: 58, y: 24 },
    { x: 18, y: 38 },
  ];
  g.fillStyle(0x8d6b4b, 1);
  g.lineStyle(3, 0x5a3a22, 1);
  g.fillRoundedRect(10, 6, 8, 92, 4);
  g.strokeRoundedRect(10, 6, 8, 92, 4);
  g.fillStyle(0xff8fa3, 1);
  g.fillPoints(flagCloth, true);
  g.lineStyle(3, 0xc2506a, 1);
  g.strokePoints(flagCloth, true);
  bake(g, 'flag', 62, 100);

  // Звёзды результата: горящая и погасшая.
  g.fillStyle(0xffd451, 1);
  g.lineStyle(5, 0xc9922a, 1);
  g.fillPoints(starPoints(36, 36, 32, 14), true);
  g.strokePoints(starPoints(36, 36, 32, 14), true);
  bake(g, 'star-on', 72, 72);

  g.fillStyle(0x000000, 0.25);
  g.lineStyle(5, 0xffffff, 0.4);
  g.fillPoints(starPoints(36, 36, 32, 14), true);
  g.strokePoints(starPoints(36, 36, 32, 14), true);
  bake(g, 'star-off', 72, 72);

  // Частица для искр и пыли
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 6);
  bake(g, 'dot', 12, 12);

  // Значки улучшений: две стрелки вверх — двойной прыжок, молния — ускорение.
  g.fillStyle(0x9fd8ff, 1);
  g.lineStyle(4, 0x4a7ba6, 1);
  g.fillCircle(36, 36, 32);
  g.strokeCircle(36, 36, 32);
  g.fillStyle(0x2b4c66, 1);
  [0, 20].forEach((dy) => {
    g.fillPoints(
      [
        { x: 36, y: 16 + dy },
        { x: 54, y: 34 + dy },
        { x: 44, y: 34 + dy },
        { x: 44, y: 40 + dy },
        { x: 28, y: 40 + dy },
        { x: 28, y: 34 + dy },
        { x: 18, y: 34 + dy },
      ],
      true
    );
  });
  bake(g, 'icon-jump', 72, 72);

  // Сердечки для жизней: целое и потраченное.
  const heart = (cx, cy, s, fill, stroke) => {
    g.fillStyle(fill, 1);
    g.lineStyle(4, stroke, 1);
    g.fillCircle(cx - 6 * s, cy - 4 * s, 7 * s);
    g.fillCircle(cx + 6 * s, cy - 4 * s, 7 * s);
    const pts = [
      { x: cx - 12.6 * s, y: cy - 1 * s },
      { x: cx + 12.6 * s, y: cy - 1 * s },
      { x: cx, y: cy + 14 * s },
    ];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
    g.strokeCircle(cx - 6 * s, cy - 4 * s, 7 * s);
    g.strokeCircle(cx + 6 * s, cy - 4 * s, 7 * s);
    // Обводка кругов перекрывает стык — закрашиваем его обратно.
    g.fillStyle(fill, 1);
    g.fillRect(cx - 8 * s, cy - 6 * s, 16 * s, 8 * s);
  };

  heart(20, 18, 1, 0xe0454f, 0x9c2b33);
  bake(g, 'heart', 40, 40);

  // Сердечко-подбор: то же самое, только крупнее — его берут с земли, а не
  // читают в углу экрана.
  g.fillStyle(0xff5d7a, 1);
  g.lineStyle(4, 0xc2506a, 1);
  g.fillCircle(17, 17, 12);
  g.fillCircle(35, 17, 12);
  g.fillTriangle(4, 22, 48, 22, 26, 47);
  g.fillStyle(0xffa8b8, 1);
  g.fillCircle(15, 14, 4.5);
  bake(g, 'heart-pickup', 52, 52);

  heart(20, 18, 1, 0x8b8178, 0x5f574f);
  bake(g, 'heart-empty', 40, 40);

  g.fillStyle(0xffd0d4, 1);
  g.lineStyle(4, 0xc26a72, 1);
  g.fillCircle(36, 36, 32);
  g.strokeCircle(36, 36, 32);
  heart(36, 33, 1.5, 0xe0454f, 0x9c2b33);
  bake(g, 'icon-heart', 72, 72);

  // Плащ: парашютик — понятнее всего читается как «медленное падение».
  g.fillStyle(0xd8c8f0, 1);
  g.lineStyle(4, 0x6a5b96, 1);
  g.fillCircle(36, 36, 32);
  g.strokeCircle(36, 36, 32);
  g.fillStyle(0x8f7fd0, 1);
  g.lineStyle(3, 0x4b3f77, 1);
  g.beginPath();
  g.arc(36, 40, 22, Math.PI, 0);
  g.fillPath();
  g.strokePath();
  g.lineStyle(3, 0x4b3f77, 1);
  g.lineBetween(16, 42, 30, 56);
  g.lineBetween(36, 42, 36, 56);
  g.lineBetween(56, 42, 42, 56);
  g.fillStyle(0x4b3f77, 1);
  g.fillRoundedRect(30, 54, 12, 8, 3);
  bake(g, 'icon-cloak', 72, 72);

  // Рогатка: рогулька с натянутой резинкой и монеткой
  g.fillStyle(0xcfe8b0, 1);
  g.lineStyle(4, 0x5f8a3f, 1);
  g.fillCircle(36, 36, 32);
  g.strokeCircle(36, 36, 32);
  g.lineStyle(7, 0x8d6b4b, 1);
  g.lineBetween(36, 60, 36, 40);
  g.lineBetween(36, 40, 22, 20);
  g.lineBetween(36, 40, 50, 20);
  g.lineStyle(3, 0x5a3a22, 1);
  g.lineBetween(22, 20, 34, 34);
  g.lineBetween(50, 20, 38, 34);
  g.fillStyle(0xffd451, 1);
  g.lineStyle(3, 0xc9922a, 1);
  g.fillCircle(36, 34, 8);
  g.strokeCircle(36, 34, 8);
  bake(g, 'icon-slingshot', 72, 72);

  // Парашют плаща — висит над капибарой во время планирования
  g.fillStyle(0x8f7fd0, 1);
  g.lineStyle(4, 0x4b3f77, 1);
  g.beginPath();
  g.arc(34, 30, 30, Math.PI, 0);
  g.fillPath();
  g.strokePath();
  g.fillStyle(0xb0a2e6, 1);
  g.beginPath();
  g.arc(34, 30, 12, Math.PI, 0);
  g.fillPath();
  g.lineStyle(3, 0x4b3f77, 1);
  g.lineBetween(6, 31, 26, 50);
  g.lineBetween(34, 31, 34, 50);
  g.lineBetween(62, 31, 42, 50);
  bake(g, 'chute', 68, 54);

  // Летящая монетка рогатки — мельче обычной, чтобы не путать с добычей
  g.fillStyle(0xffd451, 1);
  g.lineStyle(3, 0xc9922a, 1);
  g.fillCircle(12, 12, 9);
  g.strokeCircle(12, 12, 9);
  bake(g, 'pebble', 24, 24);

  g.fillStyle(0xffe08a, 1);
  g.lineStyle(4, 0xc9922a, 1);
  g.fillCircle(36, 36, 32);
  g.strokeCircle(36, 36, 32);
  g.fillStyle(0xe8760f, 1);
  g.fillPoints(
    [
      { x: 42, y: 10 },
      { x: 24, y: 38 },
      { x: 35, y: 38 },
      { x: 29, y: 62 },
      { x: 50, y: 32 },
      { x: 39, y: 32 },
    ],
    true
  );
  bake(g, 'icon-boost', 72, 72);

  // Тайлы земли, платформ и декораций — свои под каждую тему уровня.
  THEMES.forEach((theme, i) => {
    g.fillStyle(theme.dirt, 1);
    g.fillRect(0, 0, 60, 60);
    g.fillStyle(theme.dirtDark, 1);
    g.fillEllipse(16, 36, 12, 8);
    g.fillEllipse(44, 48, 14, 9);
    g.fillStyle(theme.grass, 1);
    g.fillRect(0, 0, 60, 16);
    g.fillStyle(theme.grassDark, 1);
    g.fillRect(0, 14, 60, 4);
    bake(g, `ground-${i}`, 60, 60);

    // Та же земля, но без травяной каймы: ею мостится всё, что засыпано
    // сверху. С каймой на каждой клетке горка читалась как лестница —
    // трава проступала полосой под каждой ступенькой ската.
    g.fillStyle(theme.dirt, 1);
    g.fillRect(0, 0, 60, 60);
    g.fillStyle(theme.dirtDark, 1);
    g.fillEllipse(16, 36, 12, 8);
    g.fillEllipse(44, 48, 14, 9);
    bake(g, `dirt-${i}`, 60, 60);

    // Склоны. Внутри клетки — десять ступенек по 6 пикселей: с ними подъём
    // выглядит ровным скатом, а не лесенкой в человеческий рост. Столько же
    // ступенек стоит и в столкновениях, поэтому картинка не врёт.
    for (const вверх of [true, false]) {
      const ш = 60 / SLOPE_STEPS;
      for (let k = 0; k < SLOPE_STEPS; k++) {
        const x = k * ш;
        const верх = вверх ? 60 - (k + 1) * ш : k * ш;
        g.fillStyle(theme.dirt, 1);
        g.fillRect(x, верх, ш, 60 - верх);
        g.fillStyle(theme.grass, 1);
        g.fillRect(x, верх, ш, Math.min(14, 60 - верх));
        g.fillStyle(theme.grassDark, 1);
        g.fillRect(x, верх + 12, ш, Math.min(4, Math.max(0, 60 - верх - 12)));
      }
      g.fillStyle(theme.dirtDark, 1);
      g.fillEllipse(вверх ? 44 : 16, 48, 12, 8);
      bake(g, `slope-${вверх ? 'up' : 'down'}-${i}`, 60, 60);
    }

    g.fillStyle(theme.dirt, 1);
    g.fillRoundedRect(0, 0, 60, 26, 8);
    g.fillStyle(theme.grass, 1);
    g.fillRoundedRect(0, 0, 60, 14, 7);
    bake(g, `platform-${i}`, 60, 26);

    // Падающая платформа: та же плитка, но с трещинами — по ним её и узнают.
    g.fillStyle(theme.dirt, 1);
    g.fillRoundedRect(0, 0, 60, 26, 8);
    g.fillStyle(theme.grass, 1);
    g.fillRoundedRect(0, 0, 60, 14, 7);
    g.lineStyle(3, theme.dirtDark, 1);
    g.lineBetween(14, 2, 20, 24);
    g.lineBetween(38, 3, 32, 24);
    g.lineBetween(46, 6, 52, 22);
    bake(g, `platform-crack-${i}`, 60, 26);

    // Движущаяся платформа: с рамкой, чтобы отличалась от обычной.
    g.fillStyle(theme.dirtDark, 1);
    g.fillRoundedRect(0, 0, 60, 26, 8);
    g.fillStyle(theme.dirt, 1);
    g.fillRoundedRect(3, 3, 54, 20, 6);
    g.fillStyle(theme.grass, 1);
    g.fillRoundedRect(3, 3, 54, 10, 5);
    bake(g, `platform-move-${i}`, 60, 26);

    g.fillStyle(theme.hillFar, 1);
    g.fillEllipse(200, 210, 400, 300);
    bake(g, `hill-far-${i}`, 400, 220);

    g.fillStyle(theme.hillNear, 1);
    g.fillEllipse(150, 170, 300, 260);
    bake(g, `hill-near-${i}`, 300, 180);

    g.fillStyle(0x8d6b4b, 1);
    g.fillRoundedRect(52, 70, 18, 72, 6);
    g.fillStyle(theme.tree, 1);
    g.fillCircle(60, 56, 38);
    g.fillCircle(32, 74, 26);
    g.fillCircle(90, 74, 26);
    bake(g, `tree-${i}`, 124, 142);

    g.fillStyle(theme.cloud, 1);
    g.fillCircle(44, 40, 26);
    g.fillCircle(80, 34, 32);
    g.fillCircle(116, 42, 24);
    g.fillRect(44, 40, 72, 26);
    bake(g, `cloud-${i}`, 150, 70);
  });

  g.destroy();
}
