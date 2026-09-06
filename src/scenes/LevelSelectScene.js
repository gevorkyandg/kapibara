import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { LEVELS, ROUTES, countCoins } from '../levels.js';
import { createBackground } from '../background.js';
import { getLevelResult, isLevelUnlocked, getSave, getLevel } from '../save.js';
import { t, getLanguage, formatTime } from '../i18n.js';
import { makeButton, panel, starRow, coinBadge, FONT, COLORS } from '../ui.js';

/**
 * Выбор маршрута, а внутри него — этапа.
 *
 * Экрана два, но сцена одна: сначала карточки маршрутов, по нажатию — этапы
 * выбранного. Раскладывать все этапы разом нельзя, их станет двадцать пять, и
 * карточки съёжатся до нечитаемых. В будущем список маршрутов заменит
 * кликабельная карта — то есть меняться будет только этот верхний экран.
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(data) {
    this.routeIndex = data?.route ?? null;

    createBackground(this, 0, GAME_WIDTH);
    coinBadge(this, 40, 44, getSave().coins, 40);

    this.add
      .text(GAME_WIDTH - 40, 44, `${t('playerLevel')} ${getLevel()}`, {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5);

    if (this.routeIndex === null) this.showRoutes();
    else this.showStages(this.routeIndex);
  }

  /** Заголовок экрана. */
  title(текст) {
    this.add
      .text(GAME_WIDTH / 2, 76, текст, {
        fontFamily: FONT,
        fontSize: '52px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
  }

  /** Маршрут открыт, если пройден его первый этап или предыдущий маршрут. */
  routeUnlocked(ri) {
    return isLevelUnlocked(ROUTES[ri].levels[0]);
  }

  /** Сколько звёзд собрано в маршруте и сколько их всего. */
  routeStars(ri) {
    const этапы = ROUTES[ri].levels;
    const собрано = этапы.reduce((s, i) => s + getLevelResult(i).stars, 0);
    return { собрано, всего: этапы.length * 3 };
  }

  /** Сколько этапов маршрута пройдено. Пройденным считается тот, где есть звезда. */
  routeStages(ri) {
    const этапы = ROUTES[ri].levels;
    return { пройдено: этапы.filter((i) => getLevelResult(i).stars > 0).length, всего: этапы.length };
  }

  // ── Экран маршрутов ─────────────────────────────────────────────────────
  showRoutes() {
    this.title(t('routeSelect'));

    const всегоЭтапов = ROUTES.reduce((n, r) => n + r.levels.length, 0);
    const пройденоВсего = ROUTES.reduce((n, r) => n + this.routeStages(ROUTES.indexOf(r)).пройдено, 0);
    this.add
      .text(GAME_WIDTH / 2, 126, `${t('passed')}: ${пройденоВсего} / ${всегоЭтапов}`, {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#fff3d0',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const gap = 40;
    const cardW = Math.min(300, (GAME_WIDTH - 160 - (ROUTES.length - 1) * gap) / ROUTES.length);
    const cardH = 340;
    const всего = ROUTES.length * cardW + (ROUTES.length - 1) * gap;
    const startX = (GAME_WIDTH - всего) / 2 + cardW / 2;
    const y = GAME_HEIGHT / 2 + 10;

    ROUTES.forEach((маршрут, ri) => {
      const x = startX + ri * (cardW + gap);
      const открыт = this.routeUnlocked(ri);
      const звёзды = this.routeStars(ri);
      const этапы = this.routeStages(ri);

      panel(this, x, y, cardW, cardH);

      this.add
        .text(x, y - cardH / 2 + 34, `${t('route')} ${ri + 1}`, {
          fontFamily: FONT,
          fontSize: '28px',
          color: COLORS.inkDim,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y - cardH / 2 + 82, getLanguage() === 'ru' ? маршрут.name : маршрут.nameEn, {
          fontFamily: FONT,
          fontSize: '32px',
          color: COLORS.ink,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: cardW - 40 },
        })
        .setOrigin(0.5);

      this.add
        .text(
          x,
          y + 6,
          открыт
            ? `${t('stages')}: ${этапы.пройдено} / ${этапы.всего}\n${t('stars')}: ${звёзды.собрано} / ${звёзды.всего}`
            : t('lockedHint'),
          {
            fontFamily: FONT,
            fontSize: '24px',
            color: COLORS.inkDim,
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: cardW - 40 },
          }
        )
        .setOrigin(0.5);

      const btn = makeButton(
        this,
        x,
        y + cardH / 2 - 46,
        cardW - 60,
        66,
        открыт ? t('open') : t('locked'),
        // Перезапуск сцены с явными данными: scene.start на самой себе данные
        // не всегда подхватывает, и экран открывался прежний.
        () => this.scene.restart({ route: ri })
      );
      if (!открыт) btn.setEnabled(false);
    });

    makeButton(this, 140, GAME_HEIGHT - 56, 200, 64, t('back'), () => this.scene.start('MenuScene'), {
      fill: COLORS.panel,
      edge: COLORS.panelEdge,
    });

    // Загрузка своих этапов — инструмент разработки, как линейка координат.
    // В собранной игре этой ветки нет: игроку доезжает готовое, уже вписанное
    // в кампанию, а не чужой файл из папки «Загрузки».
    if (import.meta.env.DEV) {
      makeButton(
        this,
        GAME_WIDTH - 190,
        GAME_HEIGHT - 56,
        300,
        64,
        'Загрузить этап',
        () => this.загрузитьЭтап(),
        { fill: COLORS.panel, edge: COLORS.panelEdge }
      );
    }
  }

  /**
   * Взять файл этапа из редактора.
   *
   * После удачной загрузки перезапускаем страницу: список этапов собирается
   * при чтении модуля, и честнее пересобрать его целиком, чем чинить по
   * кусочкам уже нарисованный экран.
   */
  загрузитьЭтап() {
    if (!import.meta.env.DEV) return;
    const поле = document.createElement('input');
    поле.type = 'file';
    поле.accept = '.json,application/json';
    поле.addEventListener('change', async () => {
      const файл = поле.files?.[0];
      if (!файл) return;
      try {
        const { добавить } = await import('../свои-этапы.js');
        добавить(await файл.text());
        location.reload();
      } catch (е) {
        this.сказать(`Не вышло: ${е.message}`);
      }
    });
    поле.click();
  }

  /** Сообщение внизу экрана — только для разработки. */
  сказать(текст) {
    this.весть?.destroy();
    this.весть = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 118, текст, {
        fontFamily: FONT,
        fontSize: '26px',
        color: COLORS.ink,
        backgroundColor: '#fff6e0',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5);
  }

  // ── Экран этапов одного маршрута ────────────────────────────────────────
  showStages(ri) {
    const маршрут = ROUTES[ri];
    this.title(getLanguage() === 'ru' ? маршрут.name : маршрут.nameEn);

    const счёт = this.routeStages(ri);
    this.add
      .text(GAME_WIDTH / 2, 126, `${t('passed')}: ${счёт.пройдено} / ${счёт.всего}`, {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#fff3d0',
        fontStyle: 'bold',
        stroke: '#7a4a28',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const gap = 26;
    const всего = маршрут.levels.length;
    const cardW = Math.min(280, (GAME_WIDTH - 160 - (всего - 1) * gap) / всего);
    const scale = cardW / 300;
    const cardH = 360;
    const ширина = всего * cardW + (всего - 1) * gap;
    const startX = (GAME_WIDTH - ширина) / 2 + cardW / 2;
    const y = GAME_HEIGHT / 2 + 10;

    маршрут.levels.forEach((i, j) => {
      const level = LEVELS[i];
      const x = startX + j * (cardW + gap);
      const открыт = isLevelUnlocked(i);
      const результат = getLevelResult(i);

      panel(this, x, y, cardW, cardH);

      this.add
        .text(x, y - cardH / 2 + 30, `${t('stage')} ${j + 1}`, {
          fontFamily: FONT,
          fontSize: `${Math.round(28 * scale)}px`,
          color: COLORS.inkDim,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(x, y - cardH / 2 + 76, getLanguage() === 'ru' ? level.name : level.nameEn, {
          fontFamily: FONT,
          fontSize: `${Math.round(27 * scale)}px`,
          color: COLORS.ink,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: cardW - 36 },
        })
        .setOrigin(0.5);

      starRow(this, x, y - 20, открыт ? результат.stars : 0, 0.6 * scale);

      const строки = открыт
        ? [
            `${t('collected')}: ${Math.round(результат.best * 100)}%`,
            `${t('coins')}: ${countCoins(i)}`,
            результат.bestTime ? `${t('time')}: ${formatTime(результат.bestTime)}` : '',
          ].filter(Boolean)
        : [t('lockedHint')];

      this.add
        .text(x, y + 52, строки.join('\n'), {
          fontFamily: FONT,
          fontSize: `${Math.round(21 * scale)}px`,
          color: COLORS.inkDim,
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: cardW - 36 },
        })
        .setOrigin(0.5);

      const btn = makeButton(
        this,
        x,
        y + cardH / 2 - 40,
        cardW - 50,
        62,
        открыт ? t('play') : t('locked'),
        () => this.scene.start('GameScene', { levelIndex: i })
      );
      if (!открыт) btn.setEnabled(false);

      // Свой этап можно выкинуть прямо отсюда: файл остаётся на диске, из
      // игры уходит только запись.
      if (import.meta.env.DEV && level.свой) {
        makeButton(
          this,
          x + cardW / 2 - 30,
          y - cardH / 2 + 30,
          44,
          44,
          '×',
          async () => {
            const { убрать } = await import('../свои-этапы.js');
            убрать(level.name);
            location.reload();
          },
          { fill: COLORS.panel, edge: COLORS.panelEdge }
        );
      }
    });

    makeButton(
      this,
      140,
      GAME_HEIGHT - 56,
      200,
      64,
      t('back'),
      () => this.scene.restart({ route: null }),
      { fill: COLORS.panel, edge: COLORS.panelEdge }
    );
  }
}
