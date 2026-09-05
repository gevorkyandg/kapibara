import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE,
  PHYS,
  LIVES,
  SLOPE_STEPS,
  HIVE,
  DEBUG,
} from '../config.js';
import { LEVELS, ROUTES, routeOf, buildLevelMap, countCoins } from '../levels.js';
import { createBackground } from '../background.js';
import { createCoordRuler } from '../coords.js';
import { начатьЗабег, отметитьСмерть, закончитьЗабег } from '../telemetry.js';
import { createCapybara } from '../capybara.js';
import { MONSTERS } from '../monsters.js';
import {
  getSave,
  addCoins,
  addXp,
  addStats,
  recordStage,
  hasItem,
  getBonuses,
  getMaxLives,
  getLevel,
  getAbility,
  flush,
} from '../save.js';
import {
  starsFor,
  XP,
  levelProgress,
  levelBonuses,
  xpForLevel,
  MAX_LEVEL,
} from '../progression.js';
import { t, formatTime } from '../i18n.js';
import { makeButton, panel, coinBadge, FONT, COLORS } from '../ui.js';
import { sfx, unlockAudio } from '../audio.js';
import { platform } from '../platform/index.js';

/** Сладости и сколько опыта они дают (ТЗ). */
const TREATS = [
  { key: 'treat-cupcake', xp: XP.treat.cupcake },
  { key: 'treat-icecream', xp: XP.treat.icecream },
  { key: 'treat-cake', xp: XP.treat.cake },
];

/**
 * Пружина: сколько миллисекунд она сжимается (в это окно надо успеть нажать
 * прыжок) и на сколько подбрасывает — с нажатием и без него. Высоты заданы
 * долями от обычного прыжка капибары.
 */
// Сколько пружина сжимается, прежде чем выстрелить, и насколько заранее
// засчитывается нажатый прыжок. Оба срока укорочены на пятую часть: с
// прежними пружина ощущалась вязкой.
const SPRING_WINDOW = 208;
const SPRING_BUFFER = 104;

// Сколько пружина не ловит после выстрела.
const SPRING_REST = 420;
// Высота одной ступеньки склона. Чем их больше в клетке, тем мельче шаг и
// тем ровнее выглядит скат.
const SLOPE_STEP = TILE / SLOPE_STEPS;

// Сколько шип дрожит, прежде чем сорваться (ТЗ: «немного трясутся и потом падают»).
const SPIKE_SHAKE_MS = 380;

// Сколько шип может дрожать, если игрок так и не подошёл. Остановиться перед
// ним — честный способ уйти, но висеть и трястись вечно он не должен.
const SPIKE_SHAKE_MAX = 2200;

// Насколько раньше первой осы стоит табличка улья. Больше дальности зрения
// осы (460), чтобы предупреждение всегда успевало прийти первым.
const HIVE_SIGN_AHEAD = 520;

// Дальше этого события в мире не слышно. Без такой границы монстр с другого
// конца этапа звучит ровно так же громко, как стоящий рядом.
const EARSHOT = 900;

// Откуда прикатывается валун — по убыванию: сначала из-за края экрана, чтобы
// игрок успел увидеть табличку раньше камня, и только если оттуда не доедет,
// ставим ближе.
const BOULDER_DISTANCES = [900, 760, 620, 480, 360];

// Насколько далеко от края экрана висит предупреждение о валуне.
const WARN_MARGIN = 78;

// Насколько выше земли он появляется. Камень падает на рельеф и катится по
// нему — так место появления не зависит от того, что там за рельеф: горка,
// ступеньки или ровное место.
const BOULDER_DROP = 220;

// Насколько ниже последней опоры можно улететь, прежде чем это считается
// падением. Экран — 720, так что за нижним краем видимого падать уже некуда.
//
// Раньше смерть наступала только на дне карты. На ровных этапах это значило
// секунду ожидания в пустоте, а на этапах-подъёмах, где под дорогой вообще
// ничего нет, дно оказывается настолько ниже, что падение длилось бы вечно.
const FALL_LIMIT = 760;

/**
 * Невидимые стены на краях этапа: за спиной у старта и сразу за флажком.
 *
 * Высота взята с большим запасом нарочно. Стена в девять клеток кончалась на
 * высоте, куда можно долететь пружиной с двойным прыжком, — и на её верх
 * можно было встать. Со стороны это выглядит поломкой: капибара стоит в
 * воздухе на невидимом. Предел подъёма в игре — около 560 пикселей (пружина
 * 340 плюс двойной прыжок), стена выше вдвое с лишним.
 *
 * Вниз она тоже уходит ниже уровня земли: иначе между её низом и землёй
 * оставалась бы щель, в которую можно провалиться.
 */
const СТЕНА_ВЫСОТА = 24;

const SPRING_IDLE = 0.8;
const SPRING_CHARGED = 2;

// Насколько выше обычного подбрасывает облачко. Было 1.2, убавлено на треть:
// облачко срабатывает само, без нажатия, и слишком щедрый подскок превращал
// цепочку облаков в дорогу, по которой пролетаешь, ничего не делая.
const CLOUD_LIFT = 0.84;

/** Сама игра: один уровень от старта до флага. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data) {
    this.levelIndex = data?.levelIndex ?? 0;
    const level = LEVELS[this.levelIndex];
    this.levelData = level;
    this.themeIndex = level.theme;

    this.finishX = null; // сцена переиспользуется, старая черта не должна остаться
    // Своя случайность этапа, засеянная его номером.
    //
    // Всё, что решается «броском монетки» при сборке карты — какой монстр
    // встанет на метку «?», выпадет ли сладость, в какую сторону пойдёт
    // черепашка, — должно решаться одинаково при каждом запуске. Иначе один
    // и тот же этап у одного игрока проходится, а у другого нет, и бот
    // не может прогнать его дважды с одинаковым результатом.
    this.rnd = new Phaser.Math.RandomDataGenerator([`stage-${this.levelIndex}`]);

    this.map = buildLevelMap(this.levelIndex);
    this.cols = this.map[0].length;
    this.rows = this.map.length;
    this.worldW = this.cols * TILE;
    this.worldH = this.rows * TILE;

    this.totalCoins = countCoins(this.levelIndex);
    this.coinsCollected = 0;
    this.treatsTaken = 0;
    this.treatXp = 0;
    this.monstersDown = 0;
    this.monsterXp = 0;
    this.finished = false;
    this.isPaused = false;

    // Жизни и таймер этапа (ТЗ). Жизней столько, сколько даёт уровень игрока
    // плюс купленные в магазине.
    this.maxLives = getMaxLives();
    this.lives = this.maxLives;
    this.lostLife = false; // потеря жизни лишает третьей звезды
    this.stageMs = 0;

    // Сколько дано на этап. По умолчанию — вдвое больше, чем нужно, чтобы
    // пройти его насквозь самым обычным шагом: считается от длины этапа и
    // базовой скорости, поэтому подгонять руками ничего не нужно.
    this.timeLimitMs =
      level.timeMs ?? Math.round((this.worldW / PHYS.walkSpeed) * 2) * 1000;
    this.levelAtStart = getLevel();

    // Прибавки за уровень игрока — именно они делают поздние этапы проходимыми.
    const bonus = getBonuses();
    this.walkSpeed = PHYS.walkSpeed + bonus.speed;
    this.jumpVelocity = PHYS.jumpVelocity - bonus.jump; // скорость прыжка отрицательная

    // Числа способностей — с учётом улучшений из магазина.
    this.boost = getAbility('speedBoost');
    this.doubleJump = getAbility('doubleJump');
    this.cloak = getAbility('cloak');
    this.sling = getAbility('slingshot');

    // Состояние умений. Время везде — игровое (мс от старта сцены).
    this.airJumpUsed = false;
    this.doubleJumpReadyAt = 0;
    this.boostUntil = 0;
    this.boostReadyAt = 0;
    this.springHold = null; // пока сжата пружина — держим капибару на ней
    this.cloakActive = false;
    this.cloakUntil = 0;
    this.cloakReadyAt = 0;
    this.jumpReleasedInAir = false;
    this.slingReadyAt = 0;
    this.invulnUntil = 0;
    this.lastFloorTime = -9999;
    this.jumpBufferedAt = -9999;
    this.lastCheckpointAt = 0;
    this.facing = 1;

    this.physics.world.gravity.y = PHYS.gravity;
    // Мир ниже экрана продолжается: в пропасть надо успеть упасть, а не
    // упереться в невидимый пол.
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH + 600);

    createBackground(this, this.themeIndex, this.worldW, this.worldH);
    this.buildLevel();
    this.createPlayer();
    this.createColliders();
    this.createHud();
    this.createControls();

    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.player, true, 0.14, 0.16, -120, 40);
    // Мёртвая зона: пока капибара прыгает в её пределах, камера стоит.
    // Без этого на высоком этапе кадр дёргался бы от каждого прыжка.
    this.cameras.main.setDeadzone(200, 240);

    // Линейка координат — инструмент для разговора о карте (DEBUG.coords).
    this.ruler = DEBUG.coords ? createCoordRuler(this) : null;

    // Запись о попытке. Она копится по ходу этапа и уходит один раз в конце:
    // запросы посреди игры мешали бы играть на плохой связи, а нам нужен
    // только итог.
    // Флажок сбрасываем нарочно: Phaser переиспользует объект сцены между
    // этапами, и без сброса «запись уже закрыта» переезжало на следующий этап,
    // а его статистика не уходила никуда.
    this.забегЗакрыт = false;
    this.монетыВзяты = new Set();

    const место = routeOf(this.levelIndex);
    this.забег = начатьЗабег({
      маршрут: место.route + 1,
      этап: место.stage + 1,
      уровеньГероя: this.levelAtStart,
      жизней: this.maxLives,
      способности: ['speedBoost', 'doubleJump', 'cloak', 'slingshot'].filter((и) => hasItem(и)),
      монетВсего: this.totalCoins,
    });

    // Ушли из этапа, не доиграв: закрыли вкладку, вышли в меню, начали
    // заново. Такие попытки тоже важны — по ним видно, где игру бросают.
    this.events.once('shutdown', () => {
      // В try нарочно. Обработчики выключения идут цепочкой, и ошибка в
      // первом обрывает все остальные: сцена не снимает своих слушателей и
      // не разбирает объекты, а каждый перезапуск добавляет ещё один
      // невыключенный слой. Игра от статистики ломаться не должна.
      try {
        this.закрытьЗабег('quit');
      } catch (e) {
        console.warn('[статистика] забег не закрылся', e);
      }
    });
    this.cameras.main.fadeIn(250);

    platform.gameplayStart();

    // Пауза от площадки и потеря фокуса вкладки — игра замирает сама.
    this.onExternalPause = () => this.setPaused(true);
    this.game.events.on('platform:pause', this.onExternalPause);
    this.game.events.on('blur', this.onExternalPause);
    this.events.once('shutdown', () => {
      this.game.events.off('platform:pause', this.onExternalPause);
      this.game.events.off('blur', this.onExternalPause);
    });
  }

  // ── Постройка уровня из карты символов ───────────────────────────────────

  buildLevel() {
    const th = this.themeIndex;
    this.solids = this.physics.add.staticGroup();
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    this.treats = this.physics.add.group({ allowGravity: false, immovable: true });
    this.walkers = this.physics.add.group();
    this.flyers = this.physics.add.group({ allowGravity: false, immovable: true });
    this.hazards = []; // прямоугольники шипов: проверяем их вручную, так проще
    this.pebbles = this.physics.add.group(); // монетки из рогатки
    this.springs = this.physics.add.staticGroup(); // пружины
    // Имя hearts занято сердечками в углу экрана, поэтому подбираемые — свои.
    this.heartDrops = this.physics.add.group({ allowGravity: false, immovable: true });
    this.cloudlets = this.physics.add.staticGroup(); // облачка
    this.fallers = this.physics.add.staticGroup(); // падающие платформы
    this.movers = this.physics.add.group(); // движущиеся платформы
    this.quills = this.physics.add.group(); // иглы дикобраза
    this.tongues = []; // языки жаб: обычные картинки, попадание считаем сами
    this.boulders = this.physics.add.group(); // катящиеся валуны
    this.boulderRuns = []; // места, где валун сорвётся, когда игрок подойдёт
    this.dropSpikes = []; // шипы, свисающие с потолка пещеры

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const ch = this.map[row][col];
        if (ch === ' ') continue;

        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;
        const top = row * TILE;

        switch (ch) {
          case '#': {
            // Кайма травы только у той клетки, что видна сверху. Ниже кладём
            // голую землю: иначе толща под горкой полосатится, и склон
            // читается лесенкой, а не склоном.
            const сверху = row > 0 ? this.map[row - 1][col] : ' ';
            const закрыта = сверху === '#' || сверху === '/' || сверху === '\\';
            this.solids.create(cx, cy, закрыта ? `dirt-${th}` : `ground-${th}`);
            break;
          }

          case '=':
            // Платформа занимает верхние 26 px клетки.
            this.solids.create(cx, top + 13, `platform-${th}`);
            break;

          case '/':
          case '\\': {
            // Склон. Одна клетка — десять ступенек по 6 пикселей, и столько же
            // отдельных тел в столкновениях: так картинка и физика совпадают,
            // а капибара идёт по скату, не спотыкаясь.
            // От верха клетки, а не от середины: картинка выше клетки на
            // толщину каймы, и лишнее должно свисать вниз, на землю под
            // скатом. И чуть выше блоков по глубине — иначе земля, которая
            // рисуется после, закрывает этот свес обратно.
            this.add
              .image(cx, top, `slope-${ch === '/' ? 'up' : 'down'}-${th}`)
              .setOrigin(0.5, 0)
              .setDepth(0.5);
            for (let k = 0; k < SLOPE_STEPS; k++) {
              const шагX = col * TILE + k * SLOPE_STEP;
              const верх = top + (ch === '/' ? TILE - (k + 1) * SLOPE_STEP : k * SLOPE_STEP);
              const высота = top + TILE - верх;
              const тело = this.add.rectangle(
                шагX + SLOPE_STEP / 2,
                верх + высота / 2,
                SLOPE_STEP,
                высота
              );
              this.physics.add.existing(тело, true);
              this.solids.add(тело);
            }
            break;
          }

          case 'o':
            this.addCoin(cx, cy);
            break;

          case '*':
            // Сладость на метке появляется всегда: их число задано в описании
            // этапа, и бросать за него кости значит расходиться с описанием.
            this.addTreat(cx, cy);
            break;

          case '^': {
            this.add.image(cx, top + TILE - 19, 'spike').setDepth(2);
            // Зона урона уже картинки: касание кончиком не должно убивать.
            const колючки = new Phaser.Geom.Rectangle(cx - 24, top + TILE - 26, 48, 26);
            колючки.вид = 'spike';
            this.hazards.push(колючки);
            break;
          }

          case 'z':
            this.placeMonster(ch, cx, cy, top);
            break;

          case '~': {
            // Костёр: трогать нельзя ни с какой стороны, как колючки (ТЗ).
            // Поленья лежат смирно, дрожит только пламя.
            this.add.image(cx, top + TILE - 13, 'campfire-logs').setDepth(2);
            const fire = this.add
              .image(cx, top + TILE - 26, 'campfire-flame')
              .setOrigin(0.5, 1)
              .setDepth(2);
            this.tweens.add({
              targets: fire,
              scaleY: 1.12,
              scaleX: 0.94,
              duration: 420,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            const огонь = new Phaser.Geom.Rectangle(cx - 22, top + TILE - 50, 44, 50);
            огонь.вид = 'fire';
            this.hazards.push(огонь);
            break;
          }

          case 's': {
            // Пружина: подбрасывает вдвое выше обычного прыжка. Подставка —
            // физическое тело, спираль — отдельная картинка поверх: сжимается
            // только она, а подставка стоит на месте.
            const пол = top + TILE;
            this.add.image(cx, пол, 'spring-base').setOrigin(0.5, 1).setDepth(2);
            const coil = this.add.image(cx, пол - 16, 'spring-coil').setOrigin(0.5, 1).setDepth(2);

            // Ловчая зона — отдельный невидимый прямоугольник, а не сама
            // картинка: статическому телу Phaser пересчитывает размер из
            // картинки и затирает заданный вручную, отчего зона съёживалась
            // до подставки и пружина ловила только у самой земли.
            const spring = this.add.rectangle(cx, пол - 36, 50, 44);
            this.physics.add.existing(spring, true);
            this.springs.add(spring);
            spring.coil = coil;
            break;
          }

          case 'c': {
            // Облачко: даёт +20% к прыжку и сразу лопается.
            const cloudlet = this.cloudlets.create(cx, top + 26, 'cloudlet');
            cloudlet.setDepth(2).setScale(0.8);
            cloudlet.body.setSize(64, 26).setOffset(6, 10);
            this.tweens.add({
              targets: cloudlet,
              y: cloudlet.y - 8,
              duration: 1400,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            break;
          }

          case 'x': {
            // Падающая платформа: подрожит и рухнет.
            const weak = this.fallers.create(cx, top + 13, `platform-crack-${th}`);
            weak.setDepth(2);
            weak.startY = weak.y;
            break;
          }

          case '-':
          case '|': {
            // Движущаяся платформа. Двигаем её скоростью, а не твином: твин
            // меняет картинку, а физическое тело возвращает её обратно, и
            // платформа стоит на месте.
            const mover = this.movers.create(cx, top + 13, `platform-move-${th}`);
            mover.setDepth(2);
            mover.body.setAllowGravity(false);
            mover.body.setImmovable(true);

            mover.axis = ch === '-' ? 'x' : 'y';
            mover.speed = ch === '-' ? 80 : 60;
            const range = ch === '-' ? 170 : 130;

            // Качается вокруг своего места, а не уезжает от него. Иначе в
            // цепочке через пропасть промежутки перестают быть одинаковыми:
            // площадка уходит на весь размах в одну сторону, и с одного бока
            // разрыв вдвое шире заданного, а с другого её почти не видно.
            if (mover.axis === 'x') {
              mover.min = cx - range / 2;
              mover.max = cx + range / 2;
              mover.setVelocityX(mover.speed);
            } else {
              mover.min = top + 13 - range / 2;
              mover.max = top + 13 + range / 2;
              mover.setVelocityY(mover.speed);
            }
            break;
          }

          case '!':
            // Табличка перед длинной пропастью (ТЗ): предупреждает, что
            // дальше без разгона или способности не перепрыгнуть.
            this.add.image(cx, top + TILE - 31, 'sign').setDepth(1);
            break;

          case 'B': {
            // Валун (ТЗ, с 4-го уровня). Метка ставится на склоне; сам валун
            // сорвётся сверху, когда игрок подойдёт. Две метки подряд — два
            // валуна, между ними можно встать.
            if (col > 0 && this.map[row][col - 1] === 'B') break; // уже учли
            let сколько = 1;
            while (col + сколько < this.cols && this.map[row][col + сколько] === 'B') сколько++;
            this.planBoulderRun(cx, row, col, сколько);
            break;
          }

          case 'v':
          case 'V': {
            // Шип с потолка пещеры (ТЗ): подрожит и падает. Заглавная «V» —
            // тот, что срывается точно под ноги бегущему без остановки.
            const шип = this.add.image(cx, top, 'spike-hang').setOrigin(0.5, 0).setDepth(2);
            this.dropSpikes.push({ шип, state: 'hang', точный: ch === 'V' });
            break;
          }

          case 'H':
            // Улей: одна метка разворачивает целый рой ос.
            this.buildHive(cx, cy);
            break;

          case 'h': {
            // Сердечко: возвращает потерянную жизнь. Качается медленно и
            // еле-еле — так его видно издалека, но оно не мельтешит.
            const сердце = this.heartDrops.create(cx, cy, 'heart').setDepth(3);
            сердце.body.setSize(36, 34).setOffset(2, 3);
            this.tweens.add({
              targets: сердце,
              y: cy - 7,
              duration: 1500,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            break;
          }

          case 'P': {
            this.startPos = { x: cx, y: cy };

            // Стена за спиной: побежав назад, игрок иначе сходит с края карты
            // и теряет жизнь ни за что.
            this.поставитьСтену(cx - TILE * 2, top);
            break;
          }

          default:
            // Всё остальное — монстры из monsters.js
            if (MONSTERS[ch]) this.addMonster(ch, cx, cy);
            break;

          case 'F': {
            // Финиш — это не касание флажка, а вся область за ним: пробежал
            // черту и всё, этап пройден.
            this.finishX = cx;
            this.flag = this.physics.add
              .staticImage(cx, top + TILE - 50, 'flag')
              .setDepth(2);

            // Стена сразу за флажком. Черту игрок пересекает по любой высоте,
            // но если он перелетит её в прыжке и приземлится дальше, за
            // финишной площадкой может оказаться пропасть. Стена не даёт туда
            // улететь.
            this.поставитьСтену(cx + TILE * 2, top);
            this.tweens.add({
              targets: this.flag,
              scaleX: 1.06,
              duration: 900,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            break;
          }
        }
      }
    }
  }

  /**
   * Создать монстра по символу карты. Всё, чем они отличаются, описано
   * в monsters.js — здесь только общая сборка.
   */
  addMonster(symbol, x, y) {
    const type = MONSTERS[symbol];
    const group = type.ground ? this.walkers : this.flyers;
    const m = group.create(x, y, type.key).setDepth(3);

    m.kind = symbol;
    m.type = type;
    m.xpValue = type.xp;
    m.stompable = type.stompable;

    // Все числа из описания переносим на самого монстра разом. Раньше они
    // перечислялись поимённо, и добавленная настройка молча не доезжала:
    // змея, например, переставала бросаться, потому что дальность броска
    // осталась в описании и до неё не дошли.
    for (const [ключ, значение] of Object.entries(type)) {
      if (typeof значение === 'number') m[ключ] = значение;
    }

    m.dir = this.rnd.frac() < 0.5 ? -1 : 1;
    m.nextHopAt = 0;
    m.homeX = x; // середина участка патруля
    m.homeY = y;
    m.state = 'hover';

    const b = type.body;
    m.body.setSize(b.w, b.h).setOffset(b.ox, b.oy);
    if (!type.ground) m.body.setAllowGravity(false);

    // Летуны без своего поведения просто покачиваются по заданным осям.
    if (type.float) {
      if (type.float.y) {
        // Сколько места под монстром: глубже земли качаться нельзя, иначе
        // пчела с широким размахом уходила бы прямо в грунт.
        const место = () => {
          for (let d = 20; d <= type.float.y; d += 10) {
            if (this.isSolidAtPixel(x, y + d + 26)) return Math.max(0, d - 10);
          }
          return type.float.y;
        };

        // Если места почти нет, поднимаем монстра, пока оно не появится.
        // Без этого размах схлопывается почти в ноль, и летун просто висит на
        // месте, прижавшись к платформе под собой — со стороны это выглядит
        // как сломанный монстр.
        let глубина = место();
        for (let i = 0; i < 4 && глубина < type.float.y * 0.6; i++) {
          if (this.isSolidAtPixel(x, y - TILE + 20)) break; // сверху стена
          y -= TILE;
          m.y = y;
          m.homeY = y;
          глубина = место();
        }

        this.tweens.add({
          targets: m,
          y: y + глубина,
          duration: type.float.ms,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
      if (type.float.x) {
        this.tweens.add({
          targets: m,
          x: x + type.float.x,
          duration: type.float.ms * 1.4,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    // Змея сидит в норе и вылезает, только когда игрок подойдёт. Основание
    // тела должно стоять на земле, поэтому её опорная высота считается от
    // низа клетки, а не от её центра.
    if (symbol === 'z') {
      m.homeY = y - 26;
      m.y = m.homeY + 96;
      m.setAlpha(0);
      m.body.enable = false;
    }

    return m;
  }

  addCoin(x, y) {
    const coin = this.coins.create(x, y, 'coin').setDepth(2);
    // Номер монетки по порядку сборки карты. Карта у всех одинаковая, поэтому
    // одного номера хватает, чтобы потом понять, какую именно не взяли, — и
    // координаты хранить не нужно.
    coin.номер = this.coins.getChildren().length - 1;
    coin.body.setCircle(15, 5, 5);
    // Монетка покачивается и «крутится» сжатием по горизонтали.
    this.tweens.add({
      targets: coin,
      y: y - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: coin,
      scaleX: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: this.rnd.frac() * 700,
    });
  }

  addTreat(x, y) {
    // Чем дороже сладость по опыту, тем реже она попадается (ТЗ).
    const pick = this.rnd.pick([
      TREATS[0], TREATS[0], TREATS[0],
      TREATS[1], TREATS[1],
      TREATS[2],
    ]);
    const treat = this.treats.create(x, y, pick.key).setDepth(2);
    treat.xpValue = pick.xp;
    treat.body.setSize(38, 38).setOffset(5, 5);
    this.tweens.add({
      targets: treat,
      y: y - 10,
      angle: 6,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  createPlayer() {
    const { x, y } = this.startPos;

    // Физика — невидимый прямоугольник, вид — отдельный контейнер. Так
    // анимация не может случайно испортить столкновения.
    this.player = this.physics.add.sprite(x, y, 'dot').setVisible(false);
    this.player.body.setSize(52, 56).setOffset(-20, -22);
    this.player.setMaxVelocity(700, PHYS.maxFallSpeed);

    this.capy = createCapybara(this, x, y, 0.62);
    this.capy.setDepth(6);

    // Парашют плаща висит над капибарой и показывается только в планировании.
    this.chute = this.add.image(x, y - 46, 'chute').setDepth(5).setVisible(false);

    this.checkpoint = { x, y };
    this.lastFloorY = y + 20;
  }

  createColliders() {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.walkers, this.solids);

    this.physics.add.overlap(this.player, this.coins, (_p, coin) => this.collectCoin(coin));
    this.physics.add.overlap(this.player, this.treats, (_p, treat) => this.collectTreat(treat));
    this.physics.add.overlap(this.player, this.heartDrops, (_p, h) => this.collectHeart(h));
    this.physics.add.overlap(this.player, this.quills, () => this.hurt(this.time.now, false, 'quill'));
    // Валун только задевает — оттолкнуть игрока он не должен, иначе им можно
    // проехаться до финиша.
    this.physics.add.overlap(this.player, this.boulders, () => this.hurt(this.time.now, false, 'boulder'));
    this.physics.add.collider(this.boulders, this.solids);
    this.physics.add.overlap(this.player, this.walkers, (_p, e) => this.touchEnemy(e));
    this.physics.add.overlap(this.player, this.flyers, (_p, e) => this.touchEnemy(e));
    // Платформы, по которым можно ходить
    this.physics.add.collider(this.player, this.movers);
    this.physics.add.collider(this.player, this.fallers, (_p, weak) => this.touchFaller(weak));
    this.physics.add.collider(this.walkers, this.movers);

    // Подкидывающие: срабатывают, когда капибара падает на них сверху
    this.physics.add.overlap(this.player, this.springs, (_p, spring) => this.touchSpring(spring));
    this.physics.add.overlap(this.player, this.cloudlets, (_p, cloud) =>
      this.bounce(cloud, CLOUD_LIFT, true)
    );

    this.physics.add.collider(this.pebbles, this.solids, (pebble) => pebble.destroy());
    this.physics.add.overlap(this.pebbles, this.walkers, (pebble, e) => this.pebbleHit(pebble, e));
    this.physics.add.overlap(this.pebbles, this.flyers, (pebble, e) => this.pebbleHit(pebble, e));

    if (this.flag) {
      // Касание больше не нужно: черту проверяем в цикле по координате.
    }
  }

  // ── Интерфейс поверх игры ────────────────────────────────────────────────

  createHud() {
    const fixed = (obj) => obj.setScrollFactor(0).setDepth(100);

    fixed(panel(this, 150, 46, 260, 62, COLORS.panel, COLORS.panelEdge));
    this.coinBadge = fixed(coinBadge(this, 44, 46, `0 / ${this.totalCoins}`, 34));

    // Сердечки жизней под счётчиком монет.
    this.hearts = [];
    for (let i = 0; i < this.maxLives; i++) {
      this.hearts.push(fixed(this.add.image(44 + i * 42, 104, 'heart').setScale(0.85)));
    }

    // Общий кошелёк рядом со счётчиком этапа: слева собрано на этапе,
    // справа — сколько монеток всего. Рогатка тратит именно их.
    fixed(panel(this, 530, 46, 210, 62, COLORS.panel, COLORS.panelEdge));
    this.walletBadge = fixed(coinBadge(this, 448, 46, String(getSave().coins), 34));

    // Таймер этапа — по ТЗ он идёт с начала и замирает на паузе.
    const timerX = 750;
    fixed(panel(this, timerX, 44, 190, 58, COLORS.panel, COLORS.panelEdge));
    this.timerText = fixed(
      this.add
        .text(timerX, 44, '00:00', {
          fontFamily: FONT,
          fontSize: '32px',
          color: COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    // Шкала опыта и уровень игрока — всегда на виду, под таймером.
    this.buildXpBar(fixed);

    fixed(
      makeButton(this, GAME_WIDTH - 70, 46, 92, 56, '❚❚', () => this.setPaused(true), {
        fill: COLORS.panel,
        edge: COLORS.panelEdge,
        fontSize: 24,
      })
    );

    // Значки умений с кольцом перезарядки — только для купленного.
    this.abilityIcons = [];
    const abilities = [
      { id: 'doubleJump', key: 'icon-jump' },
      { id: 'speedBoost', key: 'icon-boost' },
      { id: 'cloak', key: 'icon-cloak' },
      { id: 'slingshot', key: 'icon-slingshot' },
    ].filter((a) => hasItem(a.id));

    abilities.forEach((a, i) => {
      const x = GAME_WIDTH - 80 - i * 96;
      const y = GAME_HEIGHT - 80;
      const icon = fixed(this.add.image(x, y, a.key).setScale(0.78));
      const cooldown = fixed(this.add.graphics());
      this.abilityIcons.push({ ...a, icon, cooldown, x, y });
    });

    // Подсказка по управлению в начале уровня — гаснет сама.
    const hint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 150,
        this.useTouchHint(),
        {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#ffffff',
          fontStyle: 'bold',
          align: 'center',
          stroke: '#7a4a28',
          strokeThickness: 6,
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    this.tweens.add({ targets: hint, alpha: 0, delay: 3500, duration: 900 });
  }

  /**
   * Шкала опыта под таймером: слева кружок с уровнем, справа сама полоса.
   * Она наполняется прямо во время игры — видно, что монстры и сладости
   * действительно что-то дают.
   */
  buildXpBar(fixed) {
    const w = 420;
    const x = GAME_WIDTH / 2;
    const y = 96;

    this.xpBarGeom = { x: x - w / 2 + 34, y, w: w - 34, h: 20 };

    fixed(panel(this, x, y, w, 46, COLORS.panel, COLORS.panelEdge));

    this.xpBar = fixed(this.add.graphics());

    this.levelBadge = fixed(this.add.circle(x - w / 2 + 4, y, 22, 0x7bc36a));
    this.levelBadge.setStrokeStyle(4, 0x4f9c45);
    this.levelText = fixed(
      this.add
        .text(x - w / 2 + 4, y, String(this.levelAtStart), {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    this.xpText = fixed(
      this.add
        .text(x + w / 2 - 16, y, '', {
          fontFamily: FONT,
          fontSize: '18px',
          color: COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5)
    );

    this.currentLevel = this.levelAtStart;
    this.refreshXpBar();
  }

  /** Монетки в кошельке: их тратит рогатка, поэтому число всегда на виду. */
  refreshWallet() {
    this.walletBadge.value.setText(String(getSave().coins));
  }

  refreshXpBar() {
    const level = getLevel();
    const xp = getSave().xp;
    const { x, y, w, h } = this.xpBarGeom;

    this.xpBar.clear();
    this.xpBar.fillStyle(0xe2d6c0, 1);
    this.xpBar.fillRoundedRect(x, y - h / 2, w, h, h / 2);

    const filled = level >= MAX_LEVEL ? 1 : levelProgress(xp);
    if (filled > 0) {
      this.xpBar.fillStyle(0x7bc36a, 1);
      this.xpBar.fillRoundedRect(x, y - h / 2, Math.max(h, w * filled), h, h / 2);
    }

    this.levelText.setText(String(level));
    this.xpText.setText(level >= MAX_LEVEL ? t('maxLevel') : `${xp} / ${xpForLevel(level + 1)}`);
  }

  /**
   * Проверяем после каждого начисления опыта: не вырос ли уровень.
   * Если вырос — аура вокруг капибары, надпись сверху и сразу же новые
   * прибавки, не дожидаясь конца этапа.
   */
  checkLevelUp() {
    this.refreshXpBar();

    const level = getLevel();
    if (level <= this.currentLevel) return;

    const before = levelBonuses(this.currentLevel);
    const after = levelBonuses(level);
    this.currentLevel = level;

    // Прибавки применяем немедленно — иначе награда чувствуется только
    // на следующем этапе.
    this.walkSpeed = PHYS.walkSpeed + after.speed;
    this.jumpVelocity = PHYS.jumpVelocity - after.jump;

    const gains = [];
    if (after.speed > before.speed) gains.push(`+${after.speed - before.speed} ${t('bonusSpeed')}`);
    if (after.jump > before.jump) gains.push(`+${after.jump - before.jump} ${t('bonusJump')}`);
    if (after.lives > before.lives) {
      const extra = after.lives - before.lives;
      this.maxLives += extra;
      this.lives += extra;
      this.addHearts(extra);
      gains.push(`+${extra} ${t('bonusLife')}`);
    }

    this.showAura();
    this.showLevelUpBanner(level, gains);
    sfx.win();
  }

  /** Дорисовать сердечки, когда максимум жизней вырос прямо на этапе. */
  addHearts(count) {
    for (let i = 0; i < count; i++) {
      const index = this.hearts.length;
      this.hearts.push(
        this.add
          .image(44 + index * 42, 104, 'heart')
          .setScale(0.85)
          .setScrollFactor(0)
          .setDepth(100)
      );
    }
    this.updateHearts();
  }

  /** Аура вокруг героя: расходящиеся кольца в момент нового уровня. */
  showAura() {
    this.auraRings = this.auraRings || [];
    for (let i = 0; i < 3; i++) {
      const ring = this.add
        .circle(this.player.x, this.player.y, 34, 0xffffff, 0)
        .setStrokeStyle(7, 0xffe08a, 0.95)
        .setDepth(5);
      this.auraRings.push(ring);
      this.tweens.add({
        targets: ring,
        scale: 3.2,
        alpha: 0,
        duration: 900,
        delay: i * 180,
        ease: 'Cubic.Out',
        onComplete: () => {
          this.auraRings = this.auraRings.filter((r) => r !== ring);
          ring.destroy();
        },
      });
    }
    // Тёплая вспышка на самой капибаре
    this.capy.bodyImage.setTintFill(0xfff3b0);
    this.time.delayedCall(160, () => this.capy.bodyImage.clearTint());
  }

  showLevelUpBanner(level, gains) {
    const lines = [`${t('levelUp')}  ${t('playerLevel')} ${level}`, ...gains];
    const banner = this.add
      .text(GAME_WIDTH / 2, 150, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#3f7a3a',
        strokeThickness: 7,
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(120)
      .setScale(0);

    this.tweens.add({ targets: banner, scale: 1, duration: 420, ease: 'Back.Out' });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 120,
      delay: 2200,
      duration: 700,
      onComplete: () => banner.destroy(),
    });
  }

  /** Подсказка по управлению в начале первого этапа — с учётом покупок. */
  useTouchHint() {
    if (this.levelIndex > 0) return '';
    const lines = [t('hintMove'), t('hintJump')];
    if (hasItem('speedBoost')) lines.push(t('hintBoost'));
    if (hasItem('cloak')) lines.push(t('hintCloak'));
    if (hasItem('slingshot')) lines.push(t('hintFire'));
    return lines.join('\n');
  }

  createControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    // Буквы читаются по физической клавише, поэтому раскладка не важна.
    this.keys = this.input.keyboard.addKeys('W,A,D,SPACE,SHIFT,ESC,F');

    this.touch = { left: false, right: false, boost: false, jumpQueued: false, jumpHeld: false, fireQueued: false };

    // Esc открывает и закрывает паузу. Обработчик события, а не опрос в
    // update(): на паузе update() не работает, и опрос бы не сработал —
    // выглядело бы как зависшая игра.
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.finished) return;
      this.setPaused(!this.isPaused);
    });

    // Несколько пальцев одновременно: идти и прыгать надо уметь вместе.
    this.input.addPointer(3);

    const isTouch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
    if (!isTouch) return;

    const mkPad = (x, y, radius, glyph, onDown, onUp) => {
      const circle = this.add
        .circle(x, y, radius, 0xffffff, 0.32)
        .setStrokeStyle(4, 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(99)
        .setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains);
      this.add
        .text(x, y, glyph, { fontFamily: FONT, fontSize: `${radius}px`, color: '#4a3524' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(99);
      circle.on('pointerdown', () => {
        unlockAudio();
        onDown();
      });
      circle.on('pointerup', () => onUp?.());
      circle.on('pointerout', () => onUp?.());
      return circle;
    };

    mkPad(110, GAME_HEIGHT - 100, 62, '◀', () => (this.touch.left = true), () => (this.touch.left = false));
    mkPad(255, GAME_HEIGHT - 100, 62, '▶', () => (this.touch.right = true), () => (this.touch.right = false));
    mkPad(
      GAME_WIDTH - 110,
      GAME_HEIGHT - 100,
      70,
      '▲',
      () => {
        this.touch.jumpQueued = true;
        this.touch.jumpHeld = true; // удержание нужно плащу
      },
      () => (this.touch.jumpHeld = false)
    );
    if (hasItem('slingshot')) {
      mkPad(GAME_WIDTH - 250, GAME_HEIGHT - 210, 48, '•', () => (this.touch.fireQueued = true));
    }
    if (hasItem('speedBoost')) {
      mkPad(
        GAME_WIDTH - 250,
        GAME_HEIGHT - 90,
        52,
        '»',
        () => (this.touch.boost = true),
        () => (this.touch.boost = false)
      );
    }
  }

  // ── Ход игры ─────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.finished || this.isPaused) {
      this.capy.animate(time, 'idle');
      return;
    }

    const body = this.player.body;
    const onFloor = body.blocked.down;
    if (onFloor) {
      this.lastFloorTime = time;
      this.airJumpUsed = false;
      this.lastFloorY = body.bottom;
    }

    // Таймер этапа идёт, пока игрок играет: пауза и финиш его останавливают.
    this.stageMs += delta;
    const осталось = Math.max(0, this.timeLimitMs - this.stageMs);
    this.timerText.setText(formatTime(осталось));
    this.timerText.setColor(осталось < 20000 ? '#ff6b6b' : '#5a3a22');
    if (осталось <= 0) {
      this.failStage('time');
      return;
    }

    this.updateSpring(time);
    this.handleMovement(time, onFloor);
    this.stepUpSlope(onFloor);
    this.updateMonsters(time);
    this.rideMovers();
    this.updateBoulders(time, delta);
    this.updateDropSpikes(time, delta);
    this.updateHazards();
    this.updateCapyVisual(time, onFloor);
    if (this.auraRings?.length) {
      this.auraRings.forEach((r) => r.setPosition(this.player.x, this.player.y));
    }
    this.updateAbilityIcons(time);
    this.ruler?.обновить();

    // Пересекла финишную черту — этап пройден, где бы она ни была по высоте.
    if (this.finishX != null && this.player.x >= this.finishX) {
      this.finishLevel();
      return;
    }

    // Упала в пропасть: считаем от последней опоры, а не от дна карты.
    const пределПадения = this.levelData.fallLimit ?? FALL_LIMIT;
    const улетела = body.top > (this.lastFloorY ?? 0) + пределПадения;
    if (улетела || this.player.y > this.worldH + 120) this.hurt(time, true);

    // Сторож от застревания: капибара внутри блока двигаться не может, и
    // выбраться сама не сумеет — вытаскиваем её наверх.
    if (this.overlapsSolid(this.player.x, this.player.y)) {
      const место = this.freeSpotAbove(this.player.x, this.player.y);
      this.player.setPosition(место.x, место.y);
      this.player.setVelocity(0, 0);
    }

    // Точка возврата: последнее место, где капибара спокойно стояла на
    // НАСТОЯЩЕЙ земле.
    //
    // Падающая площадка точкой возврата быть не может: к моменту возврата её
    // уже нет, и капибара падает снова — и так до последней жизни. То же с
    // движущейся: она уедет. Поэтому проверяем не «стояли ли мы», а «есть ли
    // под этим местом опора, которая никуда не денется».
    if (onFloor && time - this.lastCheckpointAt > 400 && Math.abs(body.velocity.y) < 40) {
      this.lastCheckpointAt = time;
      const x = this.player.x;
      const y = this.player.y - 10;
      if (!this.overlapsSolid(x, y) && this.надёжнаяОпора(x, body.bottom)) {
        this.checkpoint = { x, y };
      }
    }
  }

  /**
   * Невидимая стена на краю этапа.
   *
   * Стоит сплошняком от уровня ниже земли и выше любой досягаемой высоты,
   * чтобы на неё нельзя было ни встать сверху, ни просочиться снизу.
   */
  поставитьСтену(x, top) {
    const высота = TILE * СТЕНА_ВЫСОТА;
    const низ = top + TILE * 2;
    const стена = this.add.rectangle(x, низ - высота / 2, TILE, высота);
    this.physics.add.existing(стена, true);
    this.solids.add(стена);
    return стена;
  }

  /**
   * Есть ли под этим местом опора, которая никуда не денется.
   *
   * Земля, площадка и склон остаются на месте всегда. Падающая площадка
   * рушится, движущаяся уезжает, облачко лопается, пружина выстреливает —
   * возвращать игрока на них нельзя.
   */
  надёжнаяОпора(x, низ) {
    const col = Math.floor(x / TILE);
    if (col < 0 || col >= this.cols) return false;
    const отРяда = Math.max(0, Math.floor(низ / TILE) - 1);
    for (let r = отРяда; r < this.rows; r++) {
      const ch = this.map[r][col];
      if (ch === '#' || ch === '=' || ch === '/' || ch === '\\') return true;
      if (ch === 'x' || ch === '-' || ch === '|' || ch === 'c' || ch === 's') return false;
    }
    return false;
  }

/**
   * Стоит ли в этой точке пружина.
   *
   * Ходячим монстрам на пружину заходить нельзя: расчистить окрестности при
   * сборке карты мало, потому что лягушка допрыгивает до неё сама — участок
   * патруля шириной в экран легко достаёт. Поэтому пружина работает для них
   * как стена, и они разворачиваются перед ней.
   */
  пружинаВ(x) {
    let есть = false;
    this.springs.children.iterate((s) => {
      // Полтора корпуса: замер показал, что при полукорпусной мерке лягушка
      // всё равно останавливается в пятидесяти пикселях и телом накрывает
      // ловчую зону пружины.
      if (s && s.active && Math.abs(s.x - x) < 110) есть = true;
    });
    return есть;
  }

  /**
   * Где мы сейчас: «Долина · этап 3 из 5». Нужно и в паузе, и в отладочной
   * линейке — по скриншоту иначе не понять, о каком этапе речь.
   */
  где() {
    const { route, stage } = routeOf(this.levelIndex);
    const маршрут = ROUTES[route];
    const всего = маршрут ? маршрут.levels.length : LEVELS.length;
    const имя = маршрут ? маршрут.name : '';
    return `${имя} · этап ${stage + 1} из ${всего} · «${this.levelData.name}»`;
  }

  handleMovement(time, onFloor) {
    const k = this.keys;
    const тело = this.player.body;
    const left = this.cursors.left.isDown || k.A.isDown || this.touch.left;
    const right = this.cursors.right.isDown || k.D.isDown || this.touch.right;

    const jumpKey =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(k.W) ||
      Phaser.Input.Keyboard.JustDown(k.SPACE);
    if (jumpKey || this.touch.jumpQueued) {
      this.jumpBufferedAt = time;
      this.touch.jumpQueued = false;
    }

    // Пока пружина сжата, нажатие прыжка только заряжает её. Иначе то же
    // нажатие тут же тратилось бы на двойной прыжок и гасило выстрел.
    if (this.springHold) {
      this.player.setVelocityX(0);
      this.boosting = false;
      return;
    }

    // Ускорение
    const boostPressed = k.SHIFT.isDown || this.touch.boost;
    if (
      boostPressed &&
      hasItem('speedBoost') &&
      time >= this.boostReadyAt &&
      time >= this.boostUntil
    ) {
      this.boostUntil = time + this.boost.duration;
      // Перезарядка считается от момента включения: пока действует ускорение,
      // она уже идёт.
      this.boostReadyAt = time + this.boost.cooldown;
      sfx.boost();
      this.puff(this.player.x, this.player.y + 20, 0xffe08a);
    }
    const boosting = time < this.boostUntil;
    const speed = this.walkSpeed * (boosting ? this.boost.multiplier : 1);

    // Стоим на движущейся платформе — её скорость становится нашей опорой.
    // Без этого платформа уезжает из-под ног: Arcade сам пассажиров не возит.
    const ride = this.ridingMover && this.ridingMover.axis === 'x'
      ? this.ridingMover.body.velocity.x
      : 0;

    // Пока идём вверх — в стену не толкаемся.
    //
    // Толкаться там бесполезно и вредно: за кадр тело въезжает в стену на
    // несколько пикселей, и Arcade видит перекрытие сразу по двум осям —
    // вбок и вверх. Разводит он по вертикали, и прыжок гаснет в первом же
    // кадре. Со стороны это выглядит так, будто у стены кнопка прыжка не
    // работает: капибара дёргается на четыре пикселя и садится обратно.
    //
    // На земле поведение прежнее: там упор в стену безобиден, а «blocked»
    // нужен заходу на ступеньку склона.
    const шаг = right ? 1 : left ? -1 : 0;
    const взлетаем =
      тело.velocity.y < 0 || (time - this.jumpBufferedAt < 130 && (onFloor || time - this.lastFloorTime < 110));
    const впереди = this.player.x + шаг * (тело.halfWidth + 3);
    const вСтену =
      шаг !== 0 &&
      взлетаем &&
      (this.isSolidAtPixel(впереди, тело.center.y) || this.isSolidAtPixel(впереди, тело.top + 6));

    if (left && !right) {
      this.player.setVelocityX(вСтену ? ride : ride - speed);
      this.facing = -1;
    } else if (right && !left) {
      this.player.setVelocityX(вСтену ? ride : ride + speed);
      this.facing = 1;
    } else if (ride) {
      this.player.setVelocityX(ride);
    } else {
      // Небольшое торможение вместо мгновенной остановки — так мягче.
      this.player.setVelocityX(this.player.body.velocity.x * 0.6);
    }

    // Прыжок. Coyote-время: 110 мс после схода с края прыжок ещё засчитывается,
    // а буфер в 130 мс прощает нажатие чуть раньше приземления.
    const wantsJump = time - this.jumpBufferedAt < 130;
    const canGroundJump = onFloor || time - this.lastFloorTime < 110;

    if (wantsJump && canGroundJump) {
      this.player.setVelocityY(this.jumpVelocity);
      this.jumpBufferedAt = -9999;
      this.lastFloorTime = -9999;
      sfx.jump();
      this.puff(this.player.x, this.player.y + 26, 0xffffff);
    } else if (
      wantsJump &&
      !onFloor &&
      hasItem('doubleJump') &&
      !this.airJumpUsed &&
      time >= this.doubleJumpReadyAt
    ) {
      this.player.setVelocityY(this.jumpVelocity * 0.92);
      this.airJumpUsed = true;
      this.doubleJumpReadyAt = time + this.doubleJump.cooldown;
      this.jumpBufferedAt = -9999;
      sfx.doubleJump();
      this.puff(this.player.x, this.player.y + 20, 0x9fd8ff);
    }

    this.handleCloak(time, onFloor);
    this.handleSlingshot(time);
    this.boosting = boosting;
  }

  /** Кнопка прыжка зажата — держим ли мы её сейчас (для плаща). */
  isJumpHeld() {
    const k = this.keys;
    return this.cursors.up.isDown || k.W.isDown || k.SPACE.isDown || this.touch.jumpHeld;
  }

  /**
   * Плащ (ТЗ): пока кнопка прыжка зажата в падении, капибара планирует.
   * Отпустил — плащ сразу складывается, снова раскрыть можно только после
   * нового прыжка и перезарядки.
   */
  handleCloak(time, onFloor) {
    if (!hasItem('cloak')) return;

    const held = this.isJumpHeld();
    const falling = !onFloor && this.player.body.velocity.y > 0;

    if (!this.cloakActive) {
      // Раскрываем только в падении и только по свежему удержанию кнопки:
      // иначе плащ распахивался бы сам, если игрок просто не отпустил прыжок.
      if (held && falling && time >= this.cloakReadyAt && this.jumpReleasedInAir) {
        this.cloakActive = true;
        this.cloakUntil = time + this.cloak.duration;
        this.cloakReadyAt = time + this.cloak.cooldown;
        this.chute.setVisible(true).setScale(0.2);
        this.tweens.add({ targets: this.chute, scale: 1, duration: 220, ease: 'Back.Out' });
        sfx.jump();
      }
      if (!held && !onFloor) this.jumpReleasedInAir = true;
      if (onFloor) this.jumpReleasedInAir = false;
      return;
    }

    // Плащ раскрыт: держим скорость падения, пока не отпустили и не вышло время
    if (!held || onFloor || time >= this.cloakUntil) {
      this.cloakActive = false;
      this.chute.setVisible(false);
      return;
    }
    if (this.player.body.velocity.y > this.cloak.fallSpeed) {
      this.player.setVelocityY(this.cloak.fallSpeed);
    }
  }

  /**
   * Рогатка (ТЗ): стреляет монеткой, монетка обезвреживает любого монстра,
   * каждая атака отнимает монетку из кошелька.
   */
  handleSlingshot(time) {
    if (!hasItem('slingshot')) return;

    const fire = Phaser.Input.Keyboard.JustDown(this.keys.F) || this.touch.fireQueued;
    this.touch.fireQueued = false;
    if (!fire || time < this.slingReadyAt) return;

    if (getSave().coins < this.sling.coinCost) {
      this.floatLabel(this.player.x, this.player.y - 40, t('noCoins'));
      return;
    }

    addCoins(-this.sling.coinCost);
    this.refreshWallet();
    this.slingReadyAt = time + this.sling.cooldown;

    // Точка выстрела на уровне груди: с прежней высоты монетка перелетала
    // монстров, если подойти к ним вплотную.
    const pebble = this.pebbles.create(this.player.x + this.facing * 34, this.player.y - 4, 'pebble');
    pebble.setDepth(4);
    pebble.body.setCircle(9, 3, 3);
    // Своя гравитация: на первом уровне монетка падает по дуге, на последнем
    // летит почти прямо. Мировую гравитацию вычитаем, она тут ни при чём.
    pebble.body.setGravityY(this.sling.gravity - PHYS.gravity);
    pebble.setVelocityX(this.facing * this.sling.speed);
    pebble.setVelocityY(this.sling.liftOff);
    sfx.pop();

    // Монетка живёт полторы секунды — дальше она всё равно уже вне экрана.
    this.time.delayedCall(1500, () => pebble.active && pebble.destroy());
  }

  /** Каждый монстр живёт по своему правилу из monsters.js. */
  updateMonsters(time) {
    const шаг = (m) => {
      if (!m || !m.active || !m.type) return;
      if (m.type.ground && m.dir) this.stepOverLedge(m, m.dir);
      m.type.update?.(this, m, time);
    };
    this.walkers.children.iterate(шаг);
    this.flyers.children.iterate(шаг);
  }

  /**
   * Звук события в мире: слышно только то, что происходит рядом с героем.
   * Синтезатор не умеет расстояний, поэтому границу ставим сами.
   */
  soundAt(x, звук) {
    if (Math.abs(x - this.player.x) > EARSHOT) return;
    звук();
  }

  /**
   * Подобрать сердечко. Берётся только когда жизнь и правда потеряна: с
   * полным здоровьем оно остаётся лежать, чтобы игрок вернулся за ним, когда
   * припечёт.
   */
  collectHeart(сердце) {
    if (!сердце.active || this.lives >= this.maxLives) return;
    сердце.disableBody(true, true);
    this.lives += 1;
    this.updateHearts();
    sfx.treat();
    this.puff(сердце.x, сердце.y, 0xff5d7a);
    this.floatLabel(сердце.x, сердце.y, '+1');
  }

  /** Дикобраз выпускает иглы во все стороны (ТЗ). */
  shootQuills(m) {
    this.soundAt(m.x, sfx.pop);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const quill = this.quills.create(m.x + Math.cos(a) * 30, m.y + Math.sin(a) * 30, 'quill');
      quill.setDepth(3).setRotation(a);
      quill.body.setAllowGravity(false);
      quill.body.setSize(14, 10);
      quill.setVelocity(Math.cos(a) * 260, Math.sin(a) * 260);
      this.time.delayedCall(900, () => quill.active && quill.destroy());
    }
  }

  /** Жаба выстреливает языком: коснулся языка — потерял жизнь (ТЗ). */
  shootTongue(m, dir) {
    const дальность = m.type.tongueReach ?? 120;

    // Язык растёт из пасти сплошной полосой, а не летит отдельным комком.
    const tongue = this.add
      .image(m.x + dir * 26, m.y + 4, 'tongue')
      .setOrigin(dir > 0 ? 0 : 1, 0.5)
      .setDepth(3);
    tongue.displayHeight = 13;
    tongue.displayWidth = 8;
    this.tongues.push(tongue);
    this.soundAt(m.x, sfx.pop);

    this.tweens.add({
      targets: tongue,
      displayWidth: дальность,
      duration: 190,
      hold: 130,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tongues = this.tongues.filter((t) => t !== tongue);
        tongue.destroy();
      },
    });
  }

  /**
   * Задевает ли тело капибары сплошной блок, стоя в этой точке.
   * Тело 52×56, проверяем девять точек — этого хватает, чтобы поймать
   * застревание в стене.
   */
  overlapsSolid(x, y, halfW = 22, halfH = 24) {
    for (const px of [x - halfW, x, x + halfW]) {
      for (const py of [y - halfH, y, y + halfH]) {
        if (this.isSolidAtPixel(px, py)) return true;
      }
    }
    return false;
  }

  /**
   * Ближайшее свободное место над точкой. Страховка от застревания: если
   * контрольная точка оказалась в стене (кривой кусок карты, край платформы),
   * герой должен всё равно очнуться в воздухе, а не внутри блока.
   */
  freeSpotAbove(x, y) {
    for (let dy = 0; dy <= 300; dy += 20) {
      if (!this.overlapsSolid(x, y - dy)) return { x, y: y - dy };
    }
    return { ...this.startPos };
  }

  /** Есть ли опора в этой точке мира (по карте символов, без физики). */
  isSolidAtPixel(x, y) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    const ch = this.map[row][col];
    if (ch === '#') return true;
    if (ch === '/' || ch === '\\') {
      // Внутри клетки склона твёрдо всё, что ниже нужной ступеньки.
      const местныйX = x - col * TILE;
      const номер = Phaser.Math.Clamp(
        Math.floor((ch === '/' ? местныйX : TILE - местныйX) / SLOPE_STEP),
        0,
        SLOPE_STEPS - 1
      );
      return y - row * TILE >= TILE - (номер + 1) * SLOPE_STEP;
    }
    // Платформа — только верхние 26 px своей клетки.
    return ch === '=' && y - row * TILE <= 26;
  }

  updateHazards() {
    const b = this.player.body;
    const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);

    for (const hz of this.hazards) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, hz)) {
        this.hurt(this.time.now, false, hz.вид ?? 'hazard');
        return;
      }
    }

    // Язык жабы: он тянется и укорачивается, поэтому границы берём у самой
    // картинки, а не у физического тела.
    for (const tongue of this.tongues) {
      if (!tongue.active) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, tongue.getBounds())) {
        this.hurt(this.time.now, false, 'tongue');
        return;
      }
    }
  }

  updateCapyVisual(time, onFloor) {
    this.capy.setPosition(this.player.x, this.player.y - 2);
    if (this.chute.visible) this.chute.setPosition(this.player.x, this.player.y - 48);

    const vx = Math.abs(this.player.body.velocity.x);
    // На пружине состояние фиксируем: без этого «в воздухе» и «на земле»
    // сменяли друг друга каждый кадр, и капибара мерцала.
    const state = this.springHold ? 'idle' : !onFloor ? 'air' : vx > 30 ? 'walk' : 'idle';
    this.capy.animate(time, state, vx / this.walkSpeed);

    // На ускорении капибара чуть вытягивается вперёд и приседает — видно,
    // что бежит. Знак scaleX задаёт, куда она смотрит.
    const wide = this.boosting ? 0.7 : 0.62;
    const tall = this.boosting ? 0.56 : 0.62;
    this.capyWide = Phaser.Math.Linear(this.capyWide ?? wide, wide, 0.2);
    this.capyTall = Phaser.Math.Linear(this.capyTall ?? tall, tall, 0.2);
    this.capy.setScale(this.capyWide * this.facing, this.capyTall);
  }

  updateAbilityIcons(time) {
    this.abilityIcons.forEach((a) => {
      const readyAt = {
        doubleJump: this.doubleJumpReadyAt,
        speedBoost: this.boostReadyAt,
        cloak: this.cloakReadyAt,
        slingshot: this.slingReadyAt,
      }[a.id];
      const cd = this[a.id === 'speedBoost' ? 'boost' : a.id === 'slingshot' ? 'sling' : a.id].cooldown;
      const left = Math.max(0, readyAt - time);
      a.cooldown.clear();
      if (left <= 0) {
        a.icon.setAlpha(1);
        return;
      }
      // Тёмный сектор поверх значка — сколько ещё ждать.
      a.icon.setAlpha(0.5);
      const frac = left / cd;
      a.cooldown.fillStyle(0x000000, 0.55);
      a.cooldown.slice(
        a.x,
        a.y,
        29,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * frac),
        false
      );
      a.cooldown.fillPath();
    });
  }

  // ── События ──────────────────────────────────────────────────────────────

  collectCoin(coin) {
    if (!coin.active) return;
    coin.disableBody(true, true);
    // Номер собранной запоминаем сразу. Спрашивать в конце у самих монеток
    // нельзя: этап может закрыться выключением сцены, а к этому моменту
    // группы уже разобраны и спрашивать не у кого.
    this.монетыВзяты.add(coin.номер);
    this.coinsCollected += 1;
    this.coinBadge.value.setText(`${this.coinsCollected} / ${this.totalCoins}`);
    this.refreshWallet();
    sfx.coin();
    this.puff(coin.x, coin.y, 0xffd451);
  }

  collectTreat(treat) {
    if (!treat.active) return;
    treat.disableBody(true, true);
    // По ТЗ сладость даёт опыт, а не монеты, и на звёзды не влияет.
    this.treatsTaken += 1;
    this.treatXp += treat.xpValue;
    addXp(treat.xpValue);
    this.checkLevelUp();
    sfx.treat();
    this.puff(treat.x, treat.y, 0xf9a7c0);
    this.floatLabel(treat.x, treat.y, `+${treat.xpValue}`);
  }

  touchEnemy(enemy) {
    if (!enemy.active || this.finished) return;
    const time = this.time.now;

    // Прыжок сверху — монстрик исчезает с хлопком, капибара отскакивает.
    // Колючих (ёжик, дикобраз) и змею топтать нельзя — только рогаткой.
    const fallingOnto =
      enemy.stompable !== false &&
      this.player.body.velocity.y > 60 &&
      this.player.body.bottom < enemy.body.top + 26;

    if (fallingOnto) {
      this.player.setVelocityY(PHYS.bounceOnEnemy);
      this.neutralize(enemy);
      return;
    }

    this.hurt(time, false, enemy.kind);
  }

  /**
   * Пружина и облачко подкидывают капибару вверх. Срабатывают только сверху:
   * задел сбоку — просто прошёл мимо.
   *
   * @param {number} heightMul во сколько раз выше обычного прыжка подкинуть
   * @param {boolean} popped лопается ли после касания (облачко — да)
   */
  bounce(thing, heightMul, popped = false) {
    if (!thing.active || this.finished) return;
    const body = this.player.body;
    if (body.velocity.y < 0 || body.bottom > thing.body.top + 30) return;

    this.launch(heightMul);

    if (popped) {
      // Облачко лопается сразу после касания (ТЗ).
      thing.disableBody(true, false);
      this.puff(thing.x, thing.y, 0xffffff);
      this.tweens.add({
        targets: thing,
        scale: 1.3,
        alpha: 0,
        duration: 220,
        onComplete: () => thing.destroy(),
      });
    }
  }

  /**
   * Подбросить капибару на заданную долю от обычной высоты прыжка.
   *
   * Высота растёт как квадрат скорости, поэтому «вдвое выше» — это не двойная
   * скорость, а корень из двух. Иначе пружина забрасывала бы вчетверо выше.
   */
  launch(heightMul) {
    this.player.setVelocityY(this.jumpVelocity * Math.sqrt(heightMul));
    this.airJumpUsed = false; // после подкидывания двойной прыжок снова доступен
    sfx.jump();
  }

  /**
   * Пружина (ТЗ). Капибара приземляется — пружина сжимается, и есть окно, пока
   * она разжимается, чтобы нажать прыжок:
   *
   *  - ничего не нажали → подскок на 80% от обычного прыжка, стоять на
   *    пружине и пружинить можно бесконечно;
   *  - нажали прыжок за время сжатия → пружина выстреливает вдвое выше.
   *
   * Окно в SPRING_WINDOW мс: не мгновение, но и не «жми когда хочешь».
   */
  /** Видимый верх спирали: он опускается, пока пружина сжимается. */
  верхПружины(spring) {
    return spring.coil ? spring.coil.y - spring.coil.displayHeight : spring.body.top;
  }

  touchSpring(spring) {
    if (!spring.active || this.finished || this.springHold) return;
    if (this.time.now < (spring.readyAt || 0)) return;
    const body = this.player.body;

    // Пружина ловит только того, кто на неё падает. Пройти мимо по земле или
    // задеть боком нельзя: иначе она срабатывает сама по себе, а игрок этого
    // не просил.
    if (body.velocity.y < 60) return;
    if (body.bottom > spring.body.top + 34) return;

    // Ставим капибару ровно на пружину: сдвигаем ровно на столько, на
    // сколько ноги провалились ниже её верха. Иначе она оседала до земли.
    this.player.setVelocityY(0);
    this.player.y += this.верхПружины(spring) - body.bottom;

    this.springHold = {
      spring,
      until: this.time.now + SPRING_WINDOW,
      // Нажатый прямо перед касанием прыжок тоже засчитываем — иначе
      // попадание требовало бы ювелирной точности.
      charged: this.time.now - this.jumpBufferedAt < SPRING_BUFFER,
    };

    sfx.land();
    // Сжатие ведём вручную в updateSpring: твин на той же спирали спорил сам
    // с собой при повторных касаниях, и пружина едва проседала.
  }

  /** Пока пружина сжата: ловим нажатие прыжка и отпускаем в конце окна. */
  updateSpring(time) {
    const hold = this.springHold;
    if (!hold) return;

    // Держим капибару ровно на пружине, пока та сжимается. Скорость обнулять
    // мало: гравитация за кадр всё равно утягивает вниз, и за время сжатия
    // капибара оседала внутрь пружины.
    this.player.setVelocityY(0);
    if (hold.spring.active) {
      // Спираль садится ровно по ходу окна, от целой до 0.55.
      const доля = Phaser.Math.Clamp(1 - (hold.until - time) / SPRING_WINDOW, 0, 1);
      hold.spring.coil?.setScale(1, 1 - 0.45 * доля);

      // Держимся за видимый верх спирали, а не за неподвижное тело: пружина
      // проседает, и капибара проседает вместе с ней.
      this.player.y += this.верхПружины(hold.spring) - this.player.body.bottom;
    }

    if (time - this.jumpBufferedAt < SPRING_BUFFER) hold.charged = true;
    if (time < hold.until) return;

    this.springHold = null;
    this.jumpBufferedAt = -9999;

    if (hold.spring.active) {
      this.tweens.add({ targets: hold.spring.coil, scaleY: 1, duration: 128, ease: 'Back.Out' });
    }
    // Пружина отдыхает: за это время капибара успевает оттолкнуться и уйти,
    // а не быть пойманной снова тем же кадром.
    if (hold.spring.active) hold.spring.readyAt = time + SPRING_REST;

    // Нажал вовремя — двойная высота, не нажал — мягкий подскок.
    this.launch(hold.charged ? SPRING_CHARGED : SPRING_IDLE);
    if (hold.charged) this.puff(this.player.x, this.player.y + 24, 0xd8dee6);
  }

  /**
   * Наступили на треснувшую платформу: она дрожит и через мгновение падает.
   * Восстанавливается при перезапуске этапа.
   */
  touchFaller(weak) {
    if (weak.falling || !weak.active) return;
    if (this.player.body.bottom > weak.body.top + 20) return; // задели снизу
    weak.falling = true;

    this.tweens.add({
      targets: weak,
      x: weak.x + 3,
      duration: 55,
      yoyo: true,
      repeat: 8,
      onComplete: () => {
        weak.body.enable = false;
        this.tweens.add({
          targets: weak,
          y: weak.y + 400,
          alpha: 0,
          duration: 700,
          onComplete: () => weak.destroy(),
        });
      },
    });
  }

  /**
   * Шаг на ступеньку в одну клетку.
   *
   * Склоны из ТЗ в карте — это лесенка из клеток, а Arcade сам через уступ не
   * переступает: капибара упирается в 60-пиксельный порог и встаёт намертво.
   * Прыгать на каждой ступеньке — не склон, а полоса препятствий, поэтому
   * поднимаем сами: если впереди ровно одна клетка и над ней свободно, герой
   * заходит на неё с ходу. Выше клетки уступ так и остаётся препятствием.
   */
  stepUpSlope(onFloor) {
    if (!onFloor) return;
    const vx = this.player.body.velocity.x;
    if (Math.abs(vx) < 20) return;
    this.stepOverLedge(this.player, Math.sign(vx));
  }

  /**
   * Заход на мелкую ступеньку склона. Одна на всех: и герой, и ходячие
   * монстры иначе упираются в 1.2-пиксельный порог и встают намертво.
   *
   * Порог низкий нарочно: уступ выше ступеньки склона так и остаётся
   * препятствием, через него положено прыгать.
   */
  stepOverLedge(sprite, dir) {
    const тело = sprite.body;
    if (!тело.blocked.down) return false;
    if (!(dir > 0 ? тело.blocked.right : тело.blocked.left)) return false;

    const впереди = sprite.x + dir * (тело.halfWidth + 4);
    if (!this.isSolidAtPixel(впереди, тело.bottom - 1)) return false;

    let подъём = null;
    const предел = Math.ceil(SLOPE_STEP) + 4;
    for (let h = 1; h <= предел; h++) {
      if (!this.isSolidAtPixel(впереди, тело.bottom - 1 - h)) {
        подъём = h;
        break;
      }
    }
    if (подъём === null) return false;
    if (this.overlapsSolid(sprite.x + dir * 4, sprite.y - подъём, тело.halfWidth, тело.halfHeight))
      return false;

    sprite.y -= подъём;
    sprite.x += dir * 2;
    // Иначе патруль тут же решит, что упёрся в стену, и развернётся.
    тело.blocked.left = false;
    тело.blocked.right = false;
    return true;
  }

  /**
   * Улей (ТЗ роя). Одна оса — это одна оса; улей ставится одной меткой «H» и
   * разворачивает стандартный рой из шести. Перед ним всегда стоит табличка с
   * рисунком улья: игрок должен понимать, во что бежит, до того как влетит.
   *
   * Осы висят в два ряда со сдвигом, а готовность к удару у каждой своя —
   * иначе шесть ос срываются залпом и уклониться нечем. Со сдвигом получается
   * очередь: пока уворачиваешься от первой, заходит следующая.
   *
   * Сложность этапа задаёт поле hive: число ос и шаг между ними.
   */
  buildHive(cx, cy) {
    const набор = { ...HIVE, ...(this.levelData.hive || {}) };

    // Раскладываем рой в два ряда со сдвигом: так осы не висят шеренгой и
    // заходят по очереди с разных высот.
    const вРяду = Math.ceil(набор.count / 2);
    const места = [];
    for (let i = 0; i < набор.count; i++) {
      const ряд = i < вРяду ? 0 : 1;
      const место = ряд === 0 ? i : i - вРяду;
      const всегоВРяду = ряд === 0 ? вРяду : набор.count - вРяду;
      const x = cx + (место - (всегоВРяду - 1) / 2) * набор.dx + (ряд ? набор.dx / 2 : 0);
      места.push({ x, y: cy + ряд * набор.dy, номер: i });
    }

    // Табличка стоит перед роем — и с запасом от края, а не от середины.
    // Иначе она оказывалась ближе к первой осе, чем дальность её зрения, и
    // предупреждение приходило после атаки.
    const край = Math.min(...места.map((м) => м.x));
    const знакX = край - HIVE_SIGN_AHEAD;
    const знакРяд = this.surfaceRow(Math.floor(знакX / TILE), 0);
    if (знакX > 40 && знакРяд < this.rows) {
      this.add.image(знакX, знакРяд * TILE - 31, 'sign-hive').setDepth(1);
    }

    for (const м of места) {
      if (м.x < 40 || м.x > this.worldW - 40) continue;
      const оса = this.addMonster('w', м.x, м.y);
      // У каждой осы своя готовность: шесть залпом — это не бой, а стена.
      оса.readyAt = м.номер * набор.delayMs;
      оса.hoverMs += м.номер * 90;
    }
  }

  /** Поставить монстра, не забыв про нору у змеи. */
  placeMonster(symbol, cx, cy, top) {
    if (!MONSTERS[symbol]) return null;
    // Нора видна заранее — по ТЗ её всегда должно быть заметно.
    if (symbol === 'z') this.add.image(cx, top + TILE - 14, 'burrow').setDepth(1);
    return this.addMonster(symbol, cx, cy);
  }

  /** Ряд верхней твёрдой клетки в столбце, считая от ряда «откуда смотрим». */
  /**
   * Поверхность в столбце — та, на которой стоят, если находиться на высоте
   * «отРяда».
   *
   * Просто «первая твёрдая клетка сверху» не годится: в пещере ею оказывается
   * потолок. Просто «первая твёрдая вниз от метки» тоже: если метка попала
   * внутрь горки, полом окажется её нутро, а не склон сверху. Поэтому если на
   * заданной высоте уже твёрдо — поднимаемся до верха этой толщи, а если
   * пусто — спускаемся до первой опоры.
   *
   * Благодаря этому высота самой метки ничего не значит: важно, где игрок.
   */
  surfaceRow(col, отРяда = 0) {
    if (col < 0 || col >= this.cols) return this.rows;
    const твёрдо = (r) => {
      const ch = this.map[r][col];
      return ch === '#' || ch === '/' || ch === '\\';
    };

    let r = Math.max(0, Math.min(this.rows - 1, Math.floor(отРяда)));
    if (твёрдо(r)) {
      while (r > 0 && твёрдо(r - 1)) r--;
      return r;
    }
    while (r < this.rows && !твёрдо(r)) r++;
    return r; // this.rows — значит пропасть
  }

  /**
   * Запланировать валун. Метка «B» на карте говорит только «здесь бывают
   * валуны»; сторона выбирается случайно в момент запуска, а катится камень
   * по тому рельефу, какой есть.
   *
   * Раньше сторону определял сам рельеф: искали верх склона и пускали камень
   * оттуда. Это привязывало валуны к специально нарисованной горке. Теперь
   * камень приходит просто издалека — сзади или спереди, как повезёт, — и
   * ступеньки ему не мешают, он по ним прекрасно скатывается.
   */
  planBoulderRun(cx, row, col, сколько) {
    this.boulderRuns.push({
      x: cx,
      row, // от этого ряда ищем пол: в пещере выше есть ещё и потолок
      count: Math.min(сколько, 3),
      fired: false,
    });
  }

  /**
   * Откуда пустить валун, чтобы он честно докатился до игрока.
   *
   * Перебираем обе стороны в случайном порядке и несколько дистанций: ближе
   * ставим только если издалека путь не годится. Путь годится, когда от места
   * появления до игрока земля нигде не поднимается выше точки старта и нигде
   * не прерывается пропастью — иначе камень либо встанет, либо провалится, не
   * доехав.
   */
  выбратьМестоВалуна(целX, отРяда = 0) {
    // Путь проверяем не до самой метки, а немного за неё: игрок стоит рядом с
    // меткой, и нередко именно за ней — на склоне. Камень, доехавший ровно до
    // метки и вставший, до игрока так и не добирается.
    const цельCol = Math.floor(целX / TILE);

    // Сторона — как повезёт, но негодная заменяется другой. Негодная это та,
    // где между камнем и игроком земля поднимается выше места появления:
    // вверх камень не едет, он упирается, гаснет и рассыпается.
    const стороны = Phaser.Utils.Array.Shuffle([-1, 1]);
    const запасной = [];

    for (const dir of стороны) {
      for (const даль of BOULDER_DISTANCES) {
        const опора = this.найтиОпору(Math.floor((целX - dir * даль) / TILE), отРяда);
        if (!опора) continue;
        const место = { dir, col: опора.col, row: опора.row };
        if (this.путьВниз(опора.col, цельCol + dir * 6, опора.row)) return место;
        запасной.push(место);
      }
    }

    // Ни одна сторона не идеальна — берём самую ближнюю: чем меньше рельефа
    // между камнем и игроком, тем больше шансов, что камень доедет. Отказаться
    // ставить камень нельзя: игрок уже увидел табличку.
    if (!запасной.length) return null;
    return запасной.reduce((a, b) =>
      Math.abs(b.col * TILE - целX) < Math.abs(a.col * TILE - целX) ? b : a
    );
  }

  /**
   * Доедет ли камень от места появления до цели.
   *
   * Смотрим не «поверхность» столбца, а два простых вопроса на уровне самого
   * камня: не торчит ли впереди земля выше него — в неё он упрётся, — и есть
   * ли под ним опора, иначе он провалится, не доехав. По поверхности считать
   * нельзя: в пещере ею оказывается потолок, а на горке — засыпка под склоном,
   * и проверка проходит вхолостую.
   */
  путьВниз(отCol, доCol, полРяд) {
    const шаг = отCol < доCol ? 1 : -1;
    const полY = полРяд * TILE;
    for (let c = отCol; c !== доCol; c += шаг) {
      const x = c * TILE + TILE / 2;
      if (this.isSolidAtPixel(x, полY - 20)) return false; // земля выше камня

      // Земля может уходить далеко вниз — по склону она опускается на четыре
      // клетки, и камень просто скатывается. Пропасть это только там, где
      // опоры нет вовсе на добрую высоту экрана.
      let опора = false;
      for (let d = 4; d <= 600 && !опора; d += 20) {
        if (this.isSolidAtPixel(x, полY + d)) опора = true;
      }
      if (!опора) return false;
    }
    return true;
  }

  /**
   * Где под этим столбцом земля, если она вообще есть поблизости.
   *
   * Искать с самого верха карты нельзя: в пещере первым попадётся потолок, и
   * камень «обопрётся» на него — покатится поверху и до игрока не доедет, а
   * проверка пути при этом пройдёт вхолостую, ведь выше потолка ничего нет.
   * Поэтому отсчёт всегда идёт от ряда метки вниз.
   */
  найтиОпору(col, отРяда = 0) {
    for (let d = 0; d <= 8; d++) {
      for (const c of d === 0 ? [col] : [col - d, col + d]) {
        const r = this.surfaceRow(c, отРяда);
        if (r < this.rows) return { col: c, row: r };
      }
    }
    return null;
  }

  /** Валуны: предупреждающая табличка, потом сам камень. */
  updateBoulders(time, delta) {
    const настройки = this.levelData.boulder || {};
    const масштаб = настройки.scale ?? 1;
    // Быстрее бега героя (270) с заметным запасом: на спуске валун должен
    // догонять, а не плестись сзади до самого истечения срока.
    const скорость = настройки.speed ?? 420;

    for (const run of this.boulderRuns) {
      if (run.fired) continue;
      if (Math.abs(this.player.x - run.x) > 380) continue;
      run.fired = true;

      // Место появления привязано к метке на карте, а не к игроку: карта
      // решает, откуда камень выкатывается, игрок — только когда. Иначе
      // точка уезжала вместе с героем, и один и тот же валун приходил каждый
      // раз из нового места.
      const откуда = run.x;
      // Высоту берём по игроку: метка может стоять на любой высоте, а важно,
      // на каком ярусе сейчас герой.
      const место = this.выбратьМестоВалуна(откуда, Math.floor(this.player.y / TILE));
      if (!место) {
        run.count = 0; // прикатиться неоткуда
        continue;
      }
      run.dir = место.dir;
      run.spawnX = место.col * TILE + TILE / 2;
      run.spawnY = место.row * TILE - BOULDER_DROP;

      // Предупреждение висит у края экрана с той стороны, откуда идёт камень,
      // и едет вместе с героем: пока он бежит, значок остаётся на виду.
      // Раньше табличка стояла на земле, и убежавший вперёд игрок терял её из
      // поля зрения ровно тогда, когда она нужнее всего.
      const уКрая = run.dir > 0 ? WARN_MARGIN : GAME_WIDTH - WARN_MARGIN;
      const знак = this.add
        .image(уКрая, GAME_HEIGHT / 2, `warn-${Math.min(run.count, 3)}`)
        .setScrollFactor(0)
        .setDepth(60);
      this.tweens.add({ targets: знак, angle: 7, duration: 70, yoyo: true, repeat: 13 });

      for (let i = 0; i < run.count; i++) {
        // Второй камень идёт следом, но не вплотную: между ними есть щель,
        // в которой можно устоять и отпрыгнуть (ТЗ).
        this.time.delayedCall(1000 + i * 460, () => {
          if (this.finished) return;
          this.spawnBoulder(run, масштаб, скорость);
        });
      }
      this.time.delayedCall(1000 + run.count * 460, () => знак.destroy());
    }

    // Катящиеся камни: крутим по пройденному пути и убираем, когда отработали.
    this.boulders.getChildren().forEach((b) => {
      if (!b.active) return;

      b.rotation += ((b.body.velocity.x * delta) / 1000 / 27) * (1 / масштаб);
      // Встретил твёрдое — рассыпался. Столкновение гасит скорость вбок, по
      // ней и узнаём: мелкие ступеньки склона её не трогают.
      const застрял = time - b.born > 200 && Math.abs(b.body.velocity.x) < 40;
      const ушёл = b.x < -80 || b.x > this.worldW + 80 || b.y > this.worldH + 120;
      if (застрял || ушёл || time - b.born > 9000) {
        if (!ушёл) this.puff(b.x, b.y, 0x9aa3ac);
        b.destroy();
      }
    });
  }

  spawnBoulder(run, масштаб, скорость) {
    const b = this.boulders.create(run.spawnX, run.spawnY, 'boulder');
    b.setDepth(3).setScale(масштаб);
    b.body.setCircle(27, 3, 3);
    b.setBounce(0); // без отскока камень держится склона и не летит в лицо
    b.setVelocityX(run.dir * скорость);
    b.born = this.time.now;
    this.puff(b.x, b.y, 0xb6bec6);
  }

  /**
   * Падающие шипы в пещерах (ТЗ). Шип срывается так, чтобы прийтись ровно на
   * бегущего без остановки: время падения умножаем на обычную скорость бега.
   * Поэтому уйти можно двумя способами — притормозить или включить ускорение,
   * и оба честно работают. Насколько раньше падает шип, задаёт этап полем
   * spikeLead: 1 — точно под ноги, больше — падает впереди, и его видно.
   */
  updateDropSpikes(time, delta) {
    // Единица — шип приходит ровно на бегущего. Больше единицы значит «падает
    // впереди», и такой шип уже не угроза, а украшение: игрок пробегает под
    // ним, даже не сбавив шага.
    const поУмолчанию = this.levelData.spikeLead ?? 1;
    const b = this.player.body;
    const игрок = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);

    for (const s of this.dropSpikes) {
      const шип = s.шип;
      if (!шип.active) continue;

      if (s.state === 'hang') {
        const пол = this.surfaceRow(Math.floor(шип.x / TILE), Math.floor(шип.y / TILE));
        s.полY = пол * TILE;
        s.высота = Math.max(60, s.полY - (шип.y + шип.height));
        s.времяПадения = Math.sqrt((2 * s.высота) / PHYS.gravity);

        // Тряска — только предупреждение, и начинается она заведомо заранее.
        const предупредить = this.walkSpeed * (SPIKE_SHAKE_MS / 1000 + s.времяПадения) * 1.6;
        if (Math.abs(this.player.x - шип.x) > предупредить) continue;

        s.state = 'shake';
        s.дрожитС = time;
        this.tweens.add({
          targets: шип,
          x: шип.x + 3,
          duration: SPIKE_SHAKE_MS / 8,
          yoyo: true,
          repeat: -1,
        });
        continue;
      }

      if (s.state === 'shake') {
        // Момент срыва решается заново каждый кадр, а не один раз в начале
        // тряски. Иначе достаточно было включить ускорение пораньше: шип
        // считал, что игрок так и будет мчать, и падал в пустоту перед ним,
        // когда рывок уже кончился.
        //
        // Скорость для расчёта берём не больше обычного бега. Поэтому
        // бегущий ровно получает шип точно на себя, а тот, кто мчит вдвое
        // быстрее, проскакивает под ним — ровно та лазейка, ради которой
        // ускорение и покупается.
        const ход = Math.min(Math.abs(this.player.body.velocity.x), this.walkSpeed);
        // Этап может попросить ронять шипы заранее — тогда они превращаются
        // из угрозы в предупреждение. По умолчанию запас равен единице.
        const нужно = ход * s.времяПадения * (s.точный ? 1 : поУмолчанию);
        const далеко = Math.abs(this.player.x - шип.x) > нужно;
        const заждался = time - s.дрожитС > SPIKE_SHAKE_MAX;
        if (далеко && !заждался) continue;

        this.tweens.killTweensOf(шип);
        s.state = 'fall';
        s.vy = 0;
        continue;
      }

      if (s.state === 'fall') {
        const dt = delta / 1000;
        s.vy = Math.min(s.vy + PHYS.gravity * dt, PHYS.maxFallSpeed);
        шип.y += s.vy * dt;

        if (Phaser.Geom.Intersects.RectangleToRectangle(игрок, шип.getBounds())) {
          this.hurt(time, false, 'dropSpike');
          s.state = 'done';
          this.puff(шип.x, шип.y + шип.height, 0xb9c4cf);
          шип.destroy();
          continue;
        }

        if (шип.y + шип.height >= s.полY) {
          s.state = 'done';
          this.puff(шип.x, s.полY - 10, 0xb9c4cf);
          шип.destroy();
        }
      }
    }
  }

  /**
   * Капибара едет вместе с движущейся платформой. Arcade сам этого не делает:
   * платформа уезжает из-под ног, и герой остаётся висеть на месте.
   */
  rideMovers() {
    this.ridingMover = null;

    this.movers.children.iterate((m) => {
      if (!m || !m.active) return;

      // Разворот на краях своего отрезка
      if (m.axis === 'x') {
        if (m.x >= m.max) m.setVelocityX(-m.speed);
        else if (m.x <= m.min) m.setVelocityX(m.speed);
      } else {
        if (m.y >= m.max) m.setVelocityY(-m.speed);
        else if (m.y <= m.min) m.setVelocityY(m.speed);
      }

      // Капибара стоит сверху — запоминаем платформу, чтобы двигаться с ней
      const body = this.player.body;
      const стоитСверху =
        Math.abs(body.bottom - m.body.top) < 10 &&
        body.right > m.body.left + 4 &&
        body.left < m.body.right - 4;

      if (стоитСверху) {
        this.ridingMover = m;
        // По вертикали переносим положением: гравитация иначе отрывает
        // капибару от платформы, когда та едет вниз.
        if (m.axis === 'y') this.player.y += m.body.deltaY();
      }
    });
  }

  /** Монетка из рогатки долетела до монстра. */
  pebbleHit(pebble, enemy) {
    if (!pebble.active || !enemy.active) return;
    pebble.destroy();
    this.neutralize(enemy);
  }

  /**
   * Монстрик обезврежен — неважно, прыжком сверху или монеткой из рогатки.
   * Опыт начисляем сразу: если игрок потом потеряет все жизни, старания
   * всё равно зачтутся.
   */
  neutralize(enemy) {
    enemy.disableBody(true, true);
    this.monstersDown += 1;
    this.monsterXp += enemy.xpValue ?? XP.monster.easy;
    addXp(enemy.xpValue ?? XP.monster.easy);
    this.checkLevelUp();
    sfx.pop();
    this.puff(enemy.x, enemy.y, 0x8ed081);
    this.floatLabel(enemy.x, enemy.y, `+${XP.monster.easy}`);
  }

  /**
   * Капибара пострадала. По ТЗ: минус жизнь, возврат на последнюю твёрдую
   * поверхность и 2 секунды неуязвимости. Кончились жизни — этап заново.
   *
   * @param {number} time игровое время
   * @param {boolean} fromPit падение в пропасть — от него неуязвимость не спасает
   */
  hurt(time, fromPit = false, от = fromPit ? 'pit' : '?') {
    if (this.finished) return;
    if (!fromPit && time < this.invulnUntil) return;

    отметитьСмерть(this.забег, { мс: this.stageMs, x: this.player.x, y: this.player.y, от });
    this.lives -= 1;
    this.lostLife = true;
    this.invulnUntil = time + LIVES.invulnMs;
    this.updateHearts();

    sfx.hurt();
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(200, 255, 180, 180);

    const место = this.freeSpotAbove(this.checkpoint.x, this.checkpoint.y);
    this.player.setVelocity(0, 0);
    this.player.setPosition(место.x, место.y);
    this.capy.setPosition(место.x, место.y);
    this.lastFloorY = место.y + this.player.body.halfHeight;

    if (this.lives <= 0) {
      this.failStage();
      return;
    }

    // Мигание, пока действует неуязвимость.
    this.tweens.add({
      targets: this.capy,
      alpha: 0.3,
      duration: 160,
      yoyo: true,
      repeat: Math.floor(LIVES.invulnMs / 320),
      onComplete: () => this.capy.setAlpha(1),
    });
  }

  updateHearts() {
    this.hearts.forEach((heart, i) => {
      heart.setTexture(i < this.lives ? 'heart' : 'heart-empty');
    });
  }

  finishLevel() {
    if (this.finished) return;
    this.finished = true;
    this.player.setVelocity(0, 0);
    platform.gameplayStop();

    const percent = this.totalCoins ? this.coinsCollected / this.totalCoins : 1;
    const stars = starsFor(percent, this.lostLife);

    // Монетки достаются игроку в любом случае — они собраны честно.
    addCoins(this.coinsCollected);
    this.saveStageStats();

    // Опыт за этап — только за прирост звёзд, чтобы лёгкий этап нельзя было
    // фармить бесконечно. Опыт за монстров и сладости уже начислен по ходу.
    const stageXp = stars > 0 ? recordStage(this.levelIndex, { percent, stars, timeMs: this.stageMs }) : 0;
    flush();

    this.закрытьЗабег('finish', stars);

    stars > 0 ? sfx.win() : sfx.fail();
    this.showResult({ stars, percent, stageXp, failedBy: stars > 0 ? null : 'coins' }, 400);
  }

  /** Жизни кончились: этап не пройден, придётся заново (ТЗ). */
  failStage(причина = 'lives') {
    if (this.finished) return;
    this.finished = true;
    this.player.setVelocity(0, 0);
    platform.gameplayStop();

    // Собранные монетки остаются игроку, но этап не засчитан: ни звёзд, ни
    // опыта за этап.
    addCoins(this.coinsCollected);
    this.saveStageStats();
    flush();

    this.закрытьЗабег(причина);

    sfx.fail();
    this.showResult(
      { stars: 0, percent: this.totalCoins ? this.coinsCollected / this.totalCoins : 0, stageXp: 0, failedBy: причина },
      700
    );
  }

  /**
   * Закрыть запись о попытке и отправить.
   *
   * Несобранные монетки считаем по номерам: те, что не попали в
   * «монетыВзяты», и есть ответ на вопрос «какие именно не берут». Монетка,
   * которую за сотни забегов не взял никто, почти наверняка ловушка или
   * ошибка карты, а не привычка игроков.
   */
  закрытьЗабег(исход, звёзд = 0) {
    if (!this.забег || this.забегЗакрыт) return;
    this.забегЗакрыт = true;

    const мимо = [];
    for (let n = 0; n < this.totalCoins; n++) {
      if (!this.монетыВзяты.has(n)) мимо.push(n);
    }

    закончитьЗабег(this.забег, {
      исход,
      мс: this.stageMs,
      монетВзято: this.coinsCollected,
      монетМимо: мимо,
      звёзд,
    });
  }

  saveStageStats() {
    addStats({
      playMs: this.stageMs,
      coins: this.coinsCollected,
      treats: this.treatsTaken,
      monsters: this.monstersDown,
    });
  }

  showResult({ stars, percent, stageXp, failedBy }, delay) {
    this.time.delayedCall(delay, () => {
      this.scene.pause();
      this.scene.launch('ResultScene', {
        levelIndex: this.levelIndex,
        stars,
        percent,
        failedBy, // null | 'coins' | 'lives'
        coins: this.coinsCollected,
        total: this.totalCoins,
        treats: this.treatsTaken,
        treatXp: this.treatXp,
        monsters: this.monstersDown,
        monsterXp: this.monsterXp,
        timeMs: this.stageMs,
        stageXp,
        levelBefore: this.levelAtStart,
        levelAfter: getLevel(),
      });
    });
  }

  // ── Пауза ────────────────────────────────────────────────────────────────

  setPaused(on) {
    if (this.finished || this.isPaused === on) return;
    this.isPaused = on;

    if (on) {
      this.physics.pause();
      platform.gameplayStop();
      this.showPauseMenu();
    } else {
      this.physics.resume();
      platform.gameplayStart();
      this.pauseMenu?.destroy();
      this.pauseMenu = null;
    }
  }

  showPauseMenu() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

    c.add(this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45));
    c.add(panel(this, cx, cy, 560, 620));
    c.add(
      this.add
        .text(cx, cy - 262, t('pause'), {
          fontFamily: FONT,
          fontSize: '44px',
          color: COLORS.ink,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    c.add(
      this.add
        .text(cx, cy - 212, this.где(), {
          fontFamily: FONT,
          fontSize: '20px',
          color: COLORS.inkSoft ?? COLORS.ink,
          align: 'center',
          wordWrap: { width: 500 },
        })
        .setOrigin(0.5)
    );

    this.buildPauseStats(c, cx, cy - 100);

    c.add(makeButton(this, cx, cy + 126, 360, 62, t('resume'), () => this.setPaused(false)));
    c.add(
      makeButton(this, cx, cy + 198, 360, 62, t('retry'), () => {
        this.physics.resume();
        this.scene.restart({ levelIndex: this.levelIndex });
      })
    );
    c.add(
      makeButton(
        this,
        cx,
        cy + 270,
        360,
        62,
        t('menu'),
        () => {
          flush();
          this.scene.start('MenuScene');
        },
        { fill: COLORS.panel, edge: COLORS.panelEdge }
      )
    );
    // Третий аргумент — «и детям тоже». Без него дети контейнера рисуются
    // неподвижно (по контейнеру), а вот попадание мыши считается по миру: как
    // только камера отъедет от начала уровня, кнопки перестают нажиматься,
    // хотя видны на месте. Клавиатуре это не мешает — отсюда и ощущение,
    // что игра зависла, но Esc работает.
    c.setScrollFactor(0, 0, true);

    this.pauseMenu = c;
  }

  /**
   * Характеристики героя на паузе. Базовое число белым, прибавка от уровней —
   * зелёным рядом: сразу видно, что дала прокачка.
   */
  buildPauseStats(container, cx, top) {
    const w = 470;
    const h = 226;

    const card = this.add.graphics();
    card.fillStyle(0x3b2f26, 1);
    card.fillRoundedRect(cx - w / 2, top - 40, w, h, 18);
    container.add(card);

    const level = getLevel();
    const bonus = levelBonuses(level);

    // Высоту прыжка считаем из скорости: h = v² / (2g). Игроку понятнее
    // «на сколько подпрыгивает», чем внутренняя скорость.
    const jumpHeight = (v) => Math.round((v * v) / (2 * PHYS.gravity));
    const baseJump = jumpHeight(PHYS.jumpVelocity);
    const nowJump = jumpHeight(this.jumpVelocity);

    container.add(
      this.add
        .text(cx - w / 2 + 24, top - 8, `${t('playerLevel')} ${level}`, {
          fontFamily: FONT,
          fontSize: '30px',
          color: '#ffe08a',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
    );

    const row = (label, base, gain, y) => {
      container.add(
        this.add
          .text(cx - w / 2 + 24, y, label, {
            fontFamily: FONT,
            fontSize: '24px',
            color: '#cfc2b4',
          })
          .setOrigin(0, 0.5)
      );
      // Сначала базовое число, следом зелёная прибавка: «240 +54».
      const right = cx + w / 2 - 24;
      let gainWidth = 0;
      if (gain > 0) {
        const gainText = this.add
          .text(right, y, `+${gain}`, {
            fontFamily: FONT,
            fontSize: '26px',
            color: '#7bdc6a',
            fontStyle: 'bold',
          })
          .setOrigin(1, 0.5);
        container.add(gainText);
        gainWidth = gainText.width + 12;
      }
      container.add(
        this.add
          .text(right - gainWidth, y, String(base), {
            fontFamily: FONT,
            fontSize: '26px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(1, 0.5)
      );
    };

    row(t('statSpeed'), PHYS.walkSpeed, this.walkSpeed - PHYS.walkSpeed, top + 44);
    row(t('statJump'), baseJump, nowJump - baseJump, top + 88);

    // Жизни — просто иконками, сколько есть
    container.add(
      this.add
        .text(cx - w / 2 + 24, top + 138, t('lives'), {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#cfc2b4',
        })
        .setOrigin(0, 0.5)
    );
    for (let i = 0; i < this.maxLives; i++) {
      const fromRight = this.maxLives - 1 - i;
      container.add(
        this.add
          .image(cx + w / 2 - 24 - fromRight * 36, top + 138, i < this.lives ? 'heart' : 'heart-empty')
          .setScale(0.72)
          .setOrigin(1, 0.5)
      );
    }
  }

  /**
   * Звёздочки над оглушённым монстром — их видно, пока он лежит.
   * Кружатся над головой и гаснут вместе с оглушением.
   */
  spinDizzyStars(m, durationMs) {
    const звёзд = 5;
    for (let i = 0; i < звёзд; i++) {
      const star = this.add.image(m.x, m.y - 34, 'star-dizzy').setDepth(6).setScale(0.9);
      const фаза = (i / звёзд) * Math.PI * 2;

      // Крутим вручную, потому что оса под нами ещё и лежит не на месте.
      const событие = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const угол = фаза + this.time.now / 260;
          star.x = m.x + Math.cos(угол) * 26;
          star.y = m.y - 32 + Math.sin(угол) * 9;
          star.setScale(0.7 + Math.sin(угол) * 0.25);
        },
      });

      this.time.delayedCall(durationMs, () => {
        событие.remove();
        this.tweens.add({
          targets: star,
          alpha: 0,
          duration: 200,
          onComplete: () => star.destroy(),
        });
      });
    }
  }

  /** Всплывающая надпись над предметом: сколько опыта только что дали. */
  floatLabel(x, y, text) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({
      targets: label,
      y: y - 70,
      alpha: 0,
      duration: 900,
      onComplete: () => label.destroy(),
    });
  }

  /** Облачко искр — им отмечаем всё приятное и всё резкое. */
  puff(x, y, tint) {
    const p = this.add.particles(x, y, 'dot', {
      speed: { min: 50, max: 170 },
      lifespan: 420,
      scale: { start: 0.7, end: 0 },
      tint,
      emitting: false,
    });
    p.setDepth(20);
    p.explode(9);
    this.time.delayedCall(700, () => p.destroy());
  }
}
