/**
 * Общие детали интерфейса: кнопки, панельки, значок с монетками.
 * Собраны в одном месте, чтобы во всех сценах они выглядели одинаково.
 */

import { sfx, unlockAudio } from './audio.js';

export const FONT = 'Nunito, Comic Sans MS, Verdana, sans-serif';

export const COLORS = {
  ink: '#4a3524',
  inkDim: '#8a7359',
  panel: 0xfff6e5,
  panelEdge: 0xd9b98c,
  accent: 0xffc247,
  accentEdge: 0xd39316,
  green: 0x8ed081,
  greenEdge: 0x4f9c45,
  gray: 0xcfc6b8,
  grayEdge: 0xa89e8e,
};

/** Панель со скруглением и обводкой — фон под текст и кнопки. */
export function panel(scene, x, y, w, h, fill = COLORS.panel, edge = COLORS.panelEdge) {
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 24);
  g.lineStyle(5, edge, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 24);
  return g;
}

/**
 * Кнопка. Возвращает контейнер, у которого можно потом менять текст
 * (btn.label) и включать/выключать (btn.setEnabled).
 */
export function makeButton(scene, x, y, w, h, text, onClick, opts = {}) {
  const fill = opts.fill ?? COLORS.accent;
  const edge = opts.edge ?? COLORS.accentEdge;
  const fontSize = opts.fontSize ?? 30;

  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: opts.color ?? COLORS.ink,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: w - 24 },
    })
    .setOrigin(0.5);

  const draw = (tint, edgeTint) => {
    g.clear();
    g.fillStyle(tint, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    g.lineStyle(5, edgeTint, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  };
  draw(fill, edge);

  container.add([g, label]);
  container.label = label;
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });

  let enabled = true;
  container.setEnabled = (on) => {
    enabled = on;
    draw(on ? fill : COLORS.gray, on ? edge : COLORS.grayEdge);
    label.setAlpha(on ? 1 : 0.6);
    return container;
  };

  // Кнопка срабатывает только если нажали и отпустили на ней же. Иначе
  // случайное отпускание мыши над кнопкой считалось бы нажатием — так можно
  // нечаянно купить улучшение.
  let pressed = false;

  container.on('pointerover', () => enabled && container.setScale(1.05));
  container.on('pointerout', () => {
    pressed = false;
    container.setScale(1);
  });
  container.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    container.setScale(0.96);
    unlockAudio();
  });
  container.on('pointerup', () => {
    container.setScale(1);
    if (!enabled || !pressed) return;
    pressed = false;
    sfx.click();
    onClick?.();
  });

  return container;
}

/** Монетка с числом — используется в меню, магазине и на уровне. */
export function coinBadge(scene, x, y, value, size = 34) {
  const c = scene.add.container(x, y);
  const icon = scene.add.image(0, 0, 'coin').setScale(size / 40);
  const text = scene.add
    .text(size * 0.7, 0, String(value), {
      fontFamily: FONT,
      fontSize: `${Math.round(size * 0.95)}px`,
      color: COLORS.ink,
      fontStyle: 'bold',
    })
    .setOrigin(0, 0.5);
  c.add([icon, text]);
  c.value = text;
  return c;
}

/** Ряд из трёх звёзд: сколько горит — столько и заработано. */
export function starRow(scene, x, y, stars, scale = 0.5) {
  const c = scene.add.container(x, y);
  const step = 74 * scale;
  for (let i = 0; i < 3; i++) {
    c.add(
      scene.add
        .image((i - 1) * step, i === 1 ? -6 * scale : 0, i < stars ? 'star-on' : 'star-off')
        .setScale(scale)
    );
  }
  return c;
}
