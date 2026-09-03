/**
 * Вся графика рисуется кодом и превращается в текстуры при старте.
 *
 * Почему так: в сборке нет ни одной картинки — игра весит меньше и грузится
 * быстрее (на порталах это прямо влияет на то, дождётся ли игрок старта),
 * и не нужно ни у кого спрашивать права на рисунки.
 */

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

    g.fillStyle(theme.dirt, 1);
    g.fillRoundedRect(0, 0, 60, 26, 8);
    g.fillStyle(theme.grass, 1);
    g.fillRoundedRect(0, 0, 60, 14, 7);
    bake(g, `platform-${i}`, 60, 26);

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
