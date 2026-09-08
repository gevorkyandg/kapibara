-- Обновление статистики: новые поля забега и таблица покупок.
--
-- Выполнять в SQL Editor Supabase целиком, одним запуском. Всё написано так,
-- чтобы повтор ничего не сломал: колонки добавляются «если ещё нет», таблица
-- создаётся «если ещё нет».
--
-- Зачем это нужно. Прежние записи отвечали на вопрос «трудный ли этап»:
-- сколько раз умерли и где. Теперь мы спрашиваем другое — сходится ли
-- экономика: за сколько игрок набирает уровень, копит ли он на покупку и не
-- скупает ли магазин, пройдя пять этапов из двадцати пяти.

-- ── Забеги: чего не хватало ────────────────────────────────────────────────

alter table runs add column if not exists created_at timestamptz default now();
alter table runs add column if not exists session text;

-- Кошелёк и опыт на входе в забег. Из «собрано за забег» не видно, копит
-- игрок или тратит всё сразу.
alter table runs add column if not exists coins_wallet integer;
alter table runs add column if not exists xp integer;
alter table runs add column if not exists stages_passed integer;

-- Что у него куплено и насколько прокачано.
alter table runs add column if not exists upgrades jsonb;
alter table runs add column if not exists lives_bought integer;

-- Опыт за забег и из чего он сложился.
alter table runs add column if not exists xp_gained integer;
alter table runs add column if not exists xp_stars integer;
alter table runs add column if not exists xp_monsters integer;
alter table runs add column if not exists xp_treats integer;

-- Как убивали монстров. Опыт платится за умение: прыжок сверху и рогатка
-- платят, размен жизни — нет. По этим трём числам видно, каким путём игроки
-- идут на самом деле.
alter table runs add column if not exists kills_stomp integer;
alter table runs add column if not exists kills_sling integer;
alter table runs add column if not exists kills_touch integer;

-- ── Покупки ────────────────────────────────────────────────────────────────

create table if not exists purchases (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  player text,
  session text,
  build text,
  item text,          -- extraLife | speedBoost | doubleJump | cloak | slingshot
  kind text,          -- buy | upgrade | life
  step integer,       -- какая по счёту ступень (0 для первой покупки)
  price integer,
  coins_before integer,
  coins_after integer,
  hero_level integer,
  stages_passed integer,
  play_ms bigint
);

-- Права те же, что у забегов: игра только добавляет записи и ничего не читает.
alter table purchases enable row level security;

drop policy if exists "игра пишет покупки" on purchases;
create policy "игра пишет покупки" on purchases for insert to anon with check (true);

-- ── Готовые сводки ─────────────────────────────────────────────────────────
--
-- Смотреть их в Supabase: Table Editor → представление, или SQL Editor →
-- select * from имя.

-- Игрок целиком: сколько играл, сколько собрал, до какого уровня дошёл.
create or replace view игроки as
select
  player,
  count(*)                                    as забегов,
  count(distinct session)                     as сессий,
  round(sum(ms) / 60000.0, 1)                 as минут_в_игре,
  max(stages_passed)                          as этапов_пройдено,
  max(hero_level)                             as уровень,
  max(xp + coalesce(xp_gained, 0))            as опыт,
  sum(coins_taken)                            as монет_собрано,
  max(coins_wallet)                           as монет_на_руках,
  sum(coalesce(kills_stomp, 0))               as убито_прыжком,
  sum(coalesce(kills_sling, 0))               as убито_рогаткой,
  sum(coalesce(kills_touch, 0))               as убито_касанием,
  min(created_at)                             as первый_забег,
  max(created_at)                             as последний_забег
from runs
where build not like '%-dev'
group by player;

-- Этап целиком: сколько с него получают и сколько на нём умирают.
create or replace view этапы as
select
  route,
  stage,
  count(*)                                             as попыток,
  round(100.0 * count(*) filter (where outcome = 'finish') / count(*), 1) as процент_прохождений,
  round(avg(ms) / 1000.0, 1)                           as секунд_в_среднем,
  round(avg(deaths), 2)                                as смертей_в_среднем,
  round(avg(coins_taken::numeric / nullif(coins_total, 0)) * 100, 1) as процент_монет,
  round(avg(coalesce(xp_gained, 0)), 1)                as опыта_в_среднем,
  round(avg(coalesce(xp_monsters, 0)), 1)              as из_них_за_монстров,
  round(avg(coalesce(kills_touch, 0)), 2)              as разменов_жизни
from runs
where build not like '%-dev'
group by route, stage
order by route, stage;

-- Покупки: за сколько времени и на каком уровне игроки решаются.
create or replace view покупки_сводка as
select
  item,
  kind,
  step,
  count(*)                          as покупок,
  round(avg(price), 0)              as цена,
  round(avg(hero_level), 1)         as уровень_в_среднем,
  round(avg(stages_passed), 1)      as этапов_к_покупке,
  round(avg(play_ms) / 60000.0, 1)  as минут_к_покупке,
  round(avg(coins_after), 0)        as осталось_монет
from purchases
where build not like '%-dev'
group by item, kind, step
order by item, step;
