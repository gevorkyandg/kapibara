import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE,
  PHYS,
  TREAT_CHANCE,
  LIVES,
} from '../config.js';
import { LEVELS, buildLevelMap, countCoins } from '../levels.js';
import { createBackground } from '../background.js';
import { createCapybara } from '../capybara.js';
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

/** Сама игра: один уровень от старта до флага. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data) {
    this.levelIndex = data?.levelIndex ?? 0;
    const level = LEVELS[this.levelIndex];
    this.themeIndex = level.theme;

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
    this.levelAtStart = getLevel();

    // Прибавки за уровень игрока — именно они делают поздние этапы проходимыми.
    const bonus = getBonuses();
    this.walkSpeed = PHYS.walkSpeed + bonus.speed;
    this.jumpVelocity = PHYS.jumpVelocity - bonus.jump; // скорость прыжка отрицательная

    // Числа способностей — с учётом улучшений из магазина.
    this.boost = getAbility('speedBoost');
    this.doubleJump = getAbility('doubleJump');

    // Состояние умений. Время везде — игровое (мс от старта сцены).
    this.airJumpUsed = false;
    this.doubleJumpReadyAt = 0;
    this.boostUntil = 0;
    this.boostReadyAt = 0;
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

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const ch = this.map[row][col];
        if (ch === ' ') continue;

        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;
        const top = row * TILE;

        switch (ch) {
          case '#':
            this.solids.create(cx, cy, `ground-${th}`);
            break;

          case '=':
            // Платформа занимает верхние 26 px клетки.
            this.solids.create(cx, top + 13, `platform-${th}`);
            break;

          case 'o':
            this.addCoin(cx, cy);
            break;

          case '*':
            if (Math.random() < TREAT_CHANCE) this.addTreat(cx, cy);
            break;

          case '^': {
            this.add.image(cx, top + TILE - 19, 'spike').setDepth(2);
            // Зона урона уже картинки: касание кончиком не должно убивать.
            this.hazards.push(new Phaser.Geom.Rectangle(cx - 24, top + TILE - 26, 48, 26));
            break;
          }

          case 'm': {
            const w = this.walkers.create(cx, cy, 'walker');
            w.setDepth(3);
            w.body.setSize(44, 40).setOffset(6, 12);
            w.dir = Math.random() < 0.5 ? -1 : 1;
            break;
          }

          case 'b': {
            const b = this.flyers.create(cx, cy, 'bee');
            b.setDepth(3);
            b.body.setSize(40, 30).setOffset(8, 12);
            this.tweens.add({
              targets: b,
              y: cy + 150,
              duration: 1900,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            break;
          }

          case 'P':
            this.startPos = { x: cx, y: cy };
            break;

          case 'F': {
            this.flag = this.physics.add
              .staticImage(cx, top + TILE - 50, 'flag')
              .setDepth(2);
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

  addCoin(x, y) {
    const coin = this.coins.create(x, y, 'coin').setDepth(2);
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
      delay: Math.random() * 700,
    });
  }

  addTreat(x, y) {
    // Чем дороже сладость по опыту, тем реже она попадается (ТЗ).
    const pick = Phaser.Math.RND.pick([
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

    this.checkpoint = { x, y };
  }

  createColliders() {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.walkers, this.solids);

    this.physics.add.overlap(this.player, this.coins, (_p, coin) => this.collectCoin(coin));
    this.physics.add.overlap(this.player, this.treats, (_p, treat) => this.collectTreat(treat));
    this.physics.add.overlap(this.player, this.walkers, (_p, e) => this.touchEnemy(e));
    this.physics.add.overlap(this.player, this.flyers, (_p, e) => this.touchEnemy(e));
    if (this.flag) {
      this.physics.add.overlap(this.player, this.flag, () => this.finishLevel());
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

    // Таймер этапа — по ТЗ он идёт с начала и замирает на паузе.
    fixed(panel(this, GAME_WIDTH / 2, 44, 190, 58, COLORS.panel, COLORS.panelEdge));
    this.timerText = fixed(
      this.add
        .text(GAME_WIDTH / 2, 44, '00:00', {
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

  useTouchHint() {
    if (this.levelIndex > 0) return '';
    const lines = [t('hintMove'), t('hintJump')];
    if (hasItem('speedBoost')) lines.push(t('hintBoost'));
    return lines.join('\n');
  }

  createControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    // Буквы читаются по физической клавише, поэтому раскладка не важна.
    this.keys = this.input.keyboard.addKeys('W,A,D,SPACE,SHIFT,ESC');

    this.touch = { left: false, right: false, boost: false, jumpQueued: false };

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
    mkPad(GAME_WIDTH - 110, GAME_HEIGHT - 100, 70, '▲', () => (this.touch.jumpQueued = true));
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
    }

    // Таймер этапа идёт, пока игрок играет: пауза и финиш его останавливают.
    this.stageMs += delta;
    this.timerText.setText(formatTime(this.stageMs));

    this.handleMovement(time, onFloor);
    this.updateWalkers();
    this.updateHazards();
    this.updateCapyVisual(time, onFloor);
    if (this.auraRings?.length) {
      this.auraRings.forEach((r) => r.setPosition(this.player.x, this.player.y));
    }
    this.updateAbilityIcons(time);

    // Упала в пропасть
    if (this.player.y > this.worldH + 120) this.hurt(time, true);

    // Точка возврата: последнее место, где капибара спокойно стояла на земле.
    if (onFloor && time - this.lastCheckpointAt > 400 && Math.abs(body.velocity.y) < 40) {
      this.lastCheckpointAt = time;
      this.checkpoint = { x: this.player.x, y: this.player.y - 10 };
    }
  }

  handleMovement(time, onFloor) {
    const k = this.keys;
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

    if (Phaser.Input.Keyboard.JustDown(k.ESC)) this.setPaused(true);

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

    if (left && !right) {
      this.player.setVelocityX(-speed);
      this.facing = -1;
    } else if (right && !left) {
      this.player.setVelocityX(speed);
      this.facing = 1;
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

    this.boosting = boosting;
  }

  updateWalkers() {
    this.walkers.children.iterate((w) => {
      if (!w || !w.active) return;
      if (w.body.blocked.left) w.dir = 1;
      else if (w.body.blocked.right) w.dir = -1;

      // У края платформы монстрик разворачивается, а не падает.
      if (w.body.blocked.down) {
        const aheadX = w.x + w.dir * 30;
        if (!this.isSolidAtPixel(aheadX, w.body.bottom + 10)) w.dir *= -1;
      }

      w.setVelocityX(60 * w.dir);
      w.setFlipX(w.dir < 0);
    });
  }

  /** Есть ли опора в этой точке мира (по карте символов, без физики). */
  isSolidAtPixel(x, y) {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    const ch = this.map[row][col];
    if (ch === '#') return true;
    // Платформа — только верхние 26 px своей клетки.
    return ch === '=' && y - row * TILE <= 26;
  }

  updateHazards() {
    if (!this.hazards.length) return;
    const b = this.player.body;
    const rect = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
    for (const hz of this.hazards) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, hz)) {
        this.hurt(this.time.now);
        return;
      }
    }
  }

  updateCapyVisual(time, onFloor) {
    this.capy.setPosition(this.player.x, this.player.y - 2);

    const vx = Math.abs(this.player.body.velocity.x);
    const state = !onFloor ? 'air' : vx > 30 ? 'walk' : 'idle';
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
      const readyAt = a.id === 'doubleJump' ? this.doubleJumpReadyAt : this.boostReadyAt;
      const cd = a.id === 'doubleJump' ? this.doubleJump.cooldown : this.boost.cooldown;
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
    this.coinsCollected += 1;
    this.coinBadge.value.setText(`${this.coinsCollected} / ${this.totalCoins}`);
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
    const fallingOnto =
      this.player.body.velocity.y > 60 && this.player.body.bottom < enemy.body.top + 26;

    if (fallingOnto) {
      enemy.disableBody(true, true);
      this.player.setVelocityY(PHYS.bounceOnEnemy);
      this.monstersDown += 1;
      this.monsterXp += XP.monster.easy;
      // Опыт за монстра начисляем сразу: если игрок потом потеряет все жизни,
      // старания всё равно зачтутся.
      addXp(XP.monster.easy);
      this.checkLevelUp();
      sfx.pop();
      this.puff(enemy.x, enemy.y, 0x8ed081);
      this.floatLabel(enemy.x, enemy.y, `+${XP.monster.easy}`);
      return;
    }

    this.hurt(time);
  }

  /**
   * Капибара пострадала. По ТЗ: минус жизнь, возврат на последнюю твёрдую
   * поверхность и 2 секунды неуязвимости. Кончились жизни — этап заново.
   *
   * @param {number} time игровое время
   * @param {boolean} fromPit падение в пропасть — от него неуязвимость не спасает
   */
  hurt(time, fromPit = false) {
    if (this.finished) return;
    if (!fromPit && time < this.invulnUntil) return;

    this.lives -= 1;
    this.lostLife = true;
    this.invulnUntil = time + LIVES.invulnMs;
    this.updateHearts();

    sfx.hurt();
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(200, 255, 180, 180);

    this.player.setVelocity(0, 0);
    this.player.setPosition(this.checkpoint.x, this.checkpoint.y);
    this.capy.setPosition(this.checkpoint.x, this.checkpoint.y);

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

    stars > 0 ? sfx.win() : sfx.fail();
    this.showResult({ stars, percent, stageXp, failedBy: stars > 0 ? null : 'coins' }, 400);
  }

  /** Жизни кончились: этап не пройден, придётся заново (ТЗ). */
  failStage() {
    if (this.finished) return;
    this.finished = true;
    this.player.setVelocity(0, 0);
    platform.gameplayStop();

    // Собранные монетки остаются игроку, но этап не засчитан: ни звёзд, ни
    // опыта за этап.
    addCoins(this.coinsCollected);
    this.saveStageStats();
    flush();

    sfx.fail();
    this.showResult(
      { stars: 0, percent: this.totalCoins ? this.coinsCollected / this.totalCoins : 0, stageXp: 0, failedBy: 'lives' },
      700
    );
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
