/**
 * Редактор этапов.
 *
 * Отдельная страница рядом с игрой, на том же Vite и на тех же исходниках:
 * рисует настоящими спрайтами игры, говорит на языке её символов и проверяет
 * карту той же мерой проходимости, что и генератор. Своего набора иконок и
 * своей копии правил здесь нет нарочно — иначе нарисованное и сыгранное
 * разошлись бы, и редактор стал бы врать.
 *
 * Работа устроена так: слева библиотека знаков, справа состав этапа с
 * кнопкой «Сгенерировать», посередине холст. Генератор даёт основу, руки
 * доводят. Готовая карта уходит либо в игру на пробу (через localStorage),
 * либо текстом в levels.js.
 */

import Phaser from 'phaser';
import { createTextures } from '../art.js';
import { generateStage, проверитьПроходимость, РЯДОВ, ПОЛ, ДЛИНА } from '../generate.js';
import { LEVELS } from '../levels.js';
import { ГРУППЫ, ЗНАКИ, МОНСТРЫ } from './символы.js';
import { ПО_УМОЛЧАНИЮ, спецИзСостава } from './состав.js';

const КЛЕТКА = 60;
const ПУСТО = ' ';
const КЛЮЧ_ПРОБЫ = 'capybara-редактор-карта';

const состояние = {
  карта: [], // массив строк
  знак: '#',
  масштаб: 0.6,
  история: [],
  этап: 0, // какой этап подменять при пробе
  состав: { ...ПО_УМОЛЧАНИЮ, монстры: { ...ПО_УМОЛЧАНИЮ.монстры }, опасности: { ...ПО_УМОЛЧАНИЮ.опасности } },
};

let текстуры = null;
const холст = document.getElementById('холст');
const ctx = холст.getContext('2d');

// ── Карта ─────────────────────────────────────────────────────────────────

function пустаяКарта(колонок = 120) {
  return new Array(РЯДОВ).fill(null).map(() => ПУСТО.repeat(колонок));
}

function ширина() {
  return состояние.карта[0]?.length ?? 0;
}

function взять(col, row) {
  return состояние.карта[row]?.[col] ?? ПУСТО;
}

function положить(col, row, знак) {
  if (row < 0 || row >= РЯДОВ || col < 0 || col >= ширина()) return;
  const строка = состояние.карта[row];
  if (строка[col] === знак) return;
  состояние.карта[row] = строка.slice(0, col) + знак + строка.slice(col + 1);
}

/** Снимок для отмены. Карта маленькая, поэтому храним её целиком. */
function запомнить() {
  состояние.история.push(состояние.карта.slice());
  if (состояние.история.length > 60) состояние.история.shift();
}

function отменить() {
  const прошлое = состояние.история.pop();
  if (!прошлое) return сказать('Отменять нечего');
  состояние.карта = прошлое;
  перерисовать();
  сказать('Отменено');
}

// ── Рисование ─────────────────────────────────────────────────────────────

function картинка(ключ) {
  if (!текстуры || !текстуры.exists(ключ)) return null;
  return текстуры.get(ключ).getSourceImage();
}

function перерисовать() {
  const кл = КЛЕТКА * состояние.масштаб;
  холст.width = Math.max(1, ширина() * кл);
  холст.height = РЯДОВ * кл;

  // Небо и сетка.
  ctx.fillStyle = '#8fd6f2';
  ctx.fillRect(0, 0, холст.width, холст.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= ширина(); c++) {
    ctx.beginPath();
    ctx.moveTo(c * кл + 0.5, 0);
    ctx.lineTo(c * кл + 0.5, холст.height);
    ctx.stroke();
  }
  for (let r = 0; r <= РЯДОВ; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * кл + 0.5);
    ctx.lineTo(холст.width, r * кл + 0.5);
    ctx.stroke();
  }

  // Линия пола: подсказка, на какой высоте генератор стелет землю.
  ctx.strokeStyle = 'rgba(40,90,40,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ПОЛ * кл);
  ctx.lineTo(холст.width, ПОЛ * кл);
  ctx.stroke();

  // Сами знаки.
  for (let row = 0; row < РЯДОВ; row++) {
    for (let col = 0; col < ширина(); col++) {
      const знак = взять(col, row);
      if (знак === ПУСТО) continue;
      const опись = ЗНАКИ.get(знак);
      const x = col * кл;
      const y = row * кл;
      if (!опись) {
        ctx.fillStyle = '#d33';
        ctx.fillRect(x + 2, y + 2, кл - 4, кл - 4);
        continue;
      }
      // Земля под землёй рисуется без травяной шапки — как в игре.
      const ключ =
        знак === '#' && взять(col, row - 1) === '#' ? 'dirt-0' : опись.тек;
      const img = картинка(ключ) || картинка(опись.тек);
      if (!img) continue;
      if (опись.плитка) {
        ctx.drawImage(img, x, y, кл, кл);
      } else {
        const w = img.width * состояние.масштаб;
        const h = img.height * состояние.масштаб;
        ctx.drawImage(img, x + кл / 2 - w / 2, y + кл - h, w, h);
      }
    }
  }

  // Линейка поверх карты: номер клетки и пиксель, как в отладочной строке
  // игры — чтобы найденное в игре место находилось и здесь.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, холст.width, 16);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  for (let col = 0; col < ширина(); col += 5) {
    ctx.fillText(`${col}·${col * КЛЕТКА}`, col * кл + 2, 11);
  }

  document.getElementById('размер').textContent =
    `${ширина()} клеток · ${ширина() * КЛЕТКА} px`;
}

// ── Работа мышью ──────────────────────────────────────────────────────────

let рисуем = false;
let стираем = false;

function клеткаПоСобытию(e) {
  const кл = КЛЕТКА * состояние.масштаб;
  const r = холст.getBoundingClientRect();
  return {
    col: Math.floor((e.clientX - r.left) / кл),
    row: Math.floor((e.clientY - r.top) / кл),
  };
}

function мазок(e) {
  const { col, row } = клеткаПоСобытию(e);
  const знак = стираем ? ПУСТО : состояние.знак;
  if (e.shiftKey && !стираем) {
    // С шифтом столбец заливается до низа: так стелется земля и стены,
    // ради которых иначе пришлось бы щёлкать по каждой клетке.
    for (let r = row; r < РЯДОВ; r++) положить(col, r, знак);
  } else {
    положить(col, row, знак);
  }
  перерисовать();
}

холст.addEventListener('contextmenu', (e) => e.preventDefault());
холст.addEventListener('pointerdown', (e) => {
  запомнить();
  рисуем = true;
  стираем = e.button === 2;
  холст.setPointerCapture(e.pointerId);
  мазок(e);
});
холст.addEventListener('pointermove', (e) => {
  if (рисуем) мазок(e);
});
холст.addEventListener('pointerup', () => {
  рисуем = false;
});

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    отменить();
    return;
  }
  if (e.target.matches('input, textarea, select')) return;
  if (ЗНАКИ.has(e.key)) {
    выбрать(e.key);
  } else if (e.key === ' ') {
    e.preventDefault();
    выбрать(ПУСТО);
  }
});

// ── Палитра ───────────────────────────────────────────────────────────────

function выбрать(знак) {
  состояние.знак = знак;
  document.querySelectorAll('.знак').forEach((el) => {
    el.classList.toggle('выбран', el.dataset.знак === знак);
  });
  const имя = знак === ПУСТО ? 'Ластик' : ЗНАКИ.get(знак)?.имя ?? знак;
  document.getElementById('текущий').textContent = имя;
}

function собратьПалитру() {
  const корень = document.getElementById('палитра');
  корень.innerHTML = '';
  for (const группа of [...ГРУППЫ, { имя: 'Правка', знаки: [{ знак: ПУСТО, имя: 'Ластик' }] }]) {
    const блок = document.createElement('div');
    блок.className = 'группа';
    блок.innerHTML = `<h3>${группа.имя}</h3>`;
    const сетка = document.createElement('div');
    сетка.className = 'сетка';
    for (const з of группа.знаки) {
      const кнопка = document.createElement('button');
      кнопка.className = 'знак';
      кнопка.dataset.знак = з.знак;
      кнопка.title = `${з.имя}   «${з.знак === ПУСТО ? 'пробел' : з.знак}»`;
      const холстик = document.createElement('canvas');
      холстик.width = 40;
      холстик.height = 40;
      кнопка.append(холстик);
      const подпись = document.createElement('span');
      подпись.textContent = з.имя;
      кнопка.append(подпись);
      кнопка.addEventListener('click', () => выбрать(з.знак));
      сетка.append(кнопка);
    }
    блок.append(сетка);
    корень.append(блок);
  }
}

/** Дорисовать иконки в палитре — только когда текстуры испеклись. */
function иконкиПалитры() {
  document.querySelectorAll('.знак').forEach((кнопка) => {
    const знак = кнопка.dataset.знак;
    const опись = ЗНАКИ.get(знак);
    const c = кнопка.querySelector('canvas');
    const g = c.getContext('2d');
    g.clearRect(0, 0, 40, 40);
    const img = опись && картинка(опись.тек);
    if (!img) {
      g.strokeStyle = '#888';
      g.strokeRect(6, 6, 28, 28);
      return;
    }
    const k = Math.min(38 / img.width, 38 / img.height);
    g.drawImage(img, 20 - (img.width * k) / 2, 20 - (img.height * k) / 2, img.width * k, img.height * k);
  });
}

// ── Панель состава ────────────────────────────────────────────────────────

function поле(имя, подпись, значение, шаг = 1) {
  return `<label><span>${подпись}</span><input name="${имя}" type="number" step="${шаг}" value="${значение}"></label>`;
}

function собратьПанель() {
  const s = состояние.состав;
  const монстры = МОНСТРЫ.map(
    (м) => `<label class="мелкое"><span>${м.имя}</span>
      <input name="монстр:${м.знак}" type="number" min="0" value="${s.монстры[м.знак] ?? 0}"></label>`
  ).join('');

  document.getElementById('панель').innerHTML = `
    <h3>Состав этапа</h3>
    <form id="форма">
      <label><span>Название</span><input name="название" value="${s.название}"></label>
      ${поле('длина', 'Длина (1 = 120 клеток)', s.длина, 0.1)}
      ${поле('сложность', 'Сложность 1–5', s.сложность)}
      ${поле('монет', 'Монет', s.монет)}
      ${поле('сладостей', 'Сладостей', s.сладостей)}
      ${поле('зерно', 'Зерно случайности', s.зерно)}
      <label class="галка"><input name="сердечко" type="checkbox" ${s.сердечко ? 'checked' : ''}><span>Сердечко</span></label>

      <h4>Препятствия</h4>
      ${поле('пропастей', 'Пропастей', s.пропастей)}
      ${поле('горок', 'Горок с валунами', s.горок)}
      ${поле('пещер', 'Пещер с шипами', s.пещер)}
      ${поле('островков', 'Островков', s.островков)}
      ${поле('сплошных', 'Сплошных пропастей', s.сплошных)}
      ${поле('пружин', 'Пружин', s.пружин)}
      ${поле('гор', 'Гор (в конце)', s.гор)}
      ${поле('опасность:^', 'Полос колючек', s.опасности['^'] ?? 0)}
      ${поле('опасность:~', 'Полос костров', s.опасности['~'] ?? 0)}

      <h4>Монстры</h4>
      <div class="монстры">${монстры}</div>

      <button type="submit" class="главная">Сгенерировать</button>
      <p class="сноска">Генерация затирает нарисованное.</p>
    </form>
  `;

  document.getElementById('форма').addEventListener('submit', (e) => {
    e.preventDefault();
    сгенерировать(new FormData(e.target));
  });
}

function сгенерировать(данные) {
  const s = состояние.состав;
  s.монстры = {};
  s.опасности = {};
  for (const [ключ, значение] of данные.entries()) {
    if (ключ.startsWith('монстр:')) s.монстры[ключ.slice(7)] = Number(значение) || 0;
    else if (ключ.startsWith('опасность:')) s.опасности[ключ.slice(10)] = Number(значение) || 0;
    else if (ключ === 'название') s.название = значение;
    else s[ключ] = Number(значение);
  }
  s.сердечко = данные.get('сердечко') === 'on';

  запомнить();
  const spec = спецИзСостава(s);
  состояние.карта = generateStage({ seed: Number(s.зерно) || 1, ...spec });
  перерисовать();

  // Генератор умеет растягивать этап промежутками, но не сжимать: если
  // заказанного содержимого больше, чем заказанной длины, этап выйдет
  // длиннее. Молчать об этом нельзя — иначе цифра в поле «длина» врёт.
  const цель = Math.round(ДЛИНА * (Number(s.длина) || 1));
  const хвост =
    ширина() > цель + 2
      ? ` — содержимое не поместилось в заказанные ${цель}`
      : '';
  сказать(`Сгенерировано: ${ширина()} клеток${хвост}, участков ${spec.участки.length}`);
}

// ── Проверки ──────────────────────────────────────────────────────────────

/**
 * Что проверяем помимо проходимости.
 *
 * Это те правила, которые генератор соблюдает сам, а рука — нет. Рисованный
 * этап из-под них выпадает, и единственный способ не потерять их — сказать
 * о нарушении вслух.
 */
function претензии() {
  const карта = состояние.карта;
  const беды = [];

  const непроходимо = проверитьПроходимость(карта);
  for (const п of непроходимо) {
    беды.push(
      `Клетка ${п.col} (${п.col * КЛЕТКА} px): пропасть в ${п.пусто} клеток — ` +
        `${п.пусто * КЛЕТКА} px при пределе ${п.предел}`
    );
  }

  const поверхность = (col) => {
    for (let r = 0; r < РЯДОВ; r++) if ('#=/\\'.includes(карта[r][col])) return r;
    return РЯДОВ;
  };
  const естьЗнак = (з) => карта.some((строка) => строка.includes(з));
  if (!естьЗнак('P')) беды.push('Нет старта «P»');
  if (!естьЗнак('F')) беды.push('Нет финиша «F»');

  let стартCol = 0;
  for (let col = 0; col < карта[0].length; col++) {
    if (карта.some((с) => с[col] === 'P')) стартCol = col;
  }

  const монстры = new Set(МОНСТРЫ.map((м) => м.знак));
  for (let col = 0; col < карта[0].length; col++) {
    for (let row = 0; row < РЯДОВ; row++) {
      const з = карта[row][col];
      if (з === ПУСТО) continue;

      if (монстры.has(з) && (col - стартCol) * КЛЕТКА < 400) {
        беды.push(`Клетка ${col}: монстр «${ЗНАКИ.get(з).имя}» ближе 400 px к старту`);
      }
      if (з === 'o') {
        // Над пропастью монета висит не «высоко», а на дуге прыжка: мерить
        // её высотой над землёй нельзя — земли под ней нет. Считаем только
        // те, под которыми поверхность действительно есть.
        const пов = поверхность(col);
        const высота = пов < РЯДОВ && пов > row ? пов - row : 0;
        // Под пружиной и облачком мерка другая: пружина подбрасывает на 340
        // px — почти шесть клеток, — и монета над ней взята нарочно высоко.
        const подброс = карта
          .slice(row, пов)
          .some((строка) => строка[col] === 's' || строка[col] === 'c');
        if (высота > 4 && !подброс) {
          беды.push(`Клетка ${col}: монетка выше 4 клеток — не достать`);
        }
        const рядомОпасно = [-1, 0, 1].some((d) => {
          const сосед = карта.map((с) => с[col + d]).join('');
          return сосед.includes('^') || сосед.includes('~');
        });
        if (рядомОпасно && высота < 3) {
          беды.push(`Клетка ${col}: монетка у огня или колючек ниже третьей клетки`);
        }
      }
    }
  }
  return беды;
}

function проверить() {
  const беды = претензии();
  const где = document.getElementById('претензии');
  if (!беды.length) {
    где.innerHTML = '<li class="хорошо">Замечаний нет</li>';
    сказать('Проверено: чисто');
    return;
  }
  где.innerHTML = беды.map((б) => `<li>${б}</li>`).join('');
  сказать(`Замечаний: ${беды.length}`);
}

// ── Обмен с игрой и с levels.js ───────────────────────────────────────────

function текстомДляLevels() {
  const строки = состояние.карта.map((с) => `      '${с.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`).join('\n');
  return `  {\n    name: '${состояние.состав.название}',\n    theme: 0,\n    карта: [\n${строки}\n    ],\n  },`;
}

function экспорт() {
  const окно = document.getElementById('обмен');
  окно.value = текстомДляLevels();
  окно.parentElement.hidden = false;
  окно.select();
  сказать('Скопируйте и вставьте в levels.js');
}

function импорт() {
  const окно = document.getElementById('обмен');
  окно.parentElement.hidden = false;
  const текст = окно.value.trim();
  if (!текст) return сказать('Вставьте строки карты в поле и нажмите «Импорт» ещё раз');
  const строки = [...текст.matchAll(/'([^']*)'/g)].map((м) => м[1].replace(/\\\\/g, '\\'));
  if (строки.length !== РЯДОВ) return сказать(`Нужно ${РЯДОВ} строк, найдено ${строки.length}`);
  запомнить();
  const ширинаКарты = Math.max(...строки.map((с) => с.length));
  состояние.карта = строки.map((с) => с.padEnd(ширинаКарты, ПУСТО));
  перерисовать();
  сказать('Карта загружена');
}

function проба() {
  localStorage.setItem(
    КЛЮЧ_ПРОБЫ,
    JSON.stringify({ этап: состояние.этап, строки: состояние.карта })
  );
  window.open(`/?этап=${состояние.этап}`, 'капибара-проба');
  сказать(`Карта подменит этап ${состояние.этап + 1}. Игра открыта в соседней вкладке`);
}

function открытьЭтап(i) {
  запомнить();
  состояние.карта = generateStage({ seed: i + 1, ...LEVELS[i].generate });
  состояние.этап = i;
  состояние.состав.название = LEVELS[i].name;
  перерисовать();
  сказать(`Открыт этап ${i + 1}: «${LEVELS[i].name}»`);
}

function постелитьПол() {
  запомнить();
  for (let row = ПОЛ; row < РЯДОВ; row++) {
    состояние.карта[row] = '#'.repeat(ширина());
  }
  положить(2, ПОЛ - 1, 'P');
  положить(ширина() - 3, ПОЛ - 1, 'F');
  перерисовать();
  сказать('Пол постелен, старт и финиш поставлены');
}

function сказать(текст) {
  document.getElementById('строка').textContent = текст;
}

// ── Сборка страницы ───────────────────────────────────────────────────────

function кнопки() {
  const выбор = document.getElementById('этапы');
  выбор.innerHTML = LEVELS.map((л, i) => `<option value="${i}">${i + 1}. ${л.name}</option>`).join('');
  выбор.addEventListener('change', (e) => открытьЭтап(Number(e.target.value)));

  document.getElementById('открыть').addEventListener('click', () => открытьЭтап(Number(выбор.value)));
  document.getElementById('пол').addEventListener('click', постелитьПол);
  document.getElementById('проверить').addEventListener('click', проверить);
  document.getElementById('экспорт').addEventListener('click', экспорт);
  document.getElementById('импорт').addEventListener('click', импорт);
  document.getElementById('играть').addEventListener('click', проба);
  document.getElementById('отменить').addEventListener('click', отменить);
  document.getElementById('шире').addEventListener('click', () => {
    запомнить();
    состояние.карта = состояние.карта.map((с) => с + ПУСТО.repeat(20));
    перерисовать();
  });
  document.getElementById('крупнее').addEventListener('click', () => {
    состояние.масштаб = Math.min(1.2, состояние.масштаб + 0.2);
    перерисовать();
  });
  document.getElementById('мельче').addEventListener('click', () => {
    состояние.масштаб = Math.max(0.3, состояние.масштаб - 0.2);
    перерисовать();
  });
}

/**
 * Испечь текстуры игры.
 *
 * Пхасер рисует их кодом и только внутри сцены, поэтому поднимаем крошечную
 * игру размером 4×4 в невидимом углу: она нужна ровно на один кадр — чтобы
 * отдать нам готовые картинки.
 */
function испечьТекстуры() {
  return new Promise((готово) => {
    const кухня = document.createElement('div');
    кухня.style.display = 'none';
    document.body.append(кухня);
    const игра = new Phaser.Game({
      type: Phaser.CANVAS,
      width: 4,
      height: 4,
      parent: кухня,
      scene: {
        create() {
          createTextures(this);
          готово(игра.textures);
        },
      },
    });
  });
}

async function запуск() {
  состояние.карта = пустаяКарта();
  собратьПалитру();
  собратьПанель();
  кнопки();
  выбрать('#');
  перерисовать();
  сказать('Пеку текстуры…');
  текстуры = await испечьТекстуры();
  иконкиПалитры();
  перерисовать();
  сказать('Готово. Рисуйте мышью, правая кнопка стирает, Shift заливает столбец до низа');
}

запуск();
