/**
 * Внешний вид капибары: контейнер из туловища и четырёх лапок.
 *
 * Физика живёт отдельно (невидимый спрайт в GameScene), а этот контейнер
 * просто едет за ней и «играет»: качает лапками при ходьбе, поджимает их в
 * прыжке, дышит в покое. Разделение удобно тем, что от анимации нельзя
 * случайно сломать столкновения.
 */

export function createCapybara(scene, x, y, scale = 0.62) {
  const container = scene.add.container(x, y);

  // Дальние лапки темнее — простая имитация объёма. Координаты подобраны так,
  // чтобы лапы росли из-под туловища: картинка капибары смещена вправо, потому
  // что голова у неё спереди, а середина контейнера — это центр физики.
  const backLegs = [
    scene.add.image(-28, 13, 'capy-leg').setOrigin(0.5, 0.12).setTint(0x8a5f34),
    scene.add.image(-13, 13, 'capy-leg').setOrigin(0.5, 0.12).setTint(0x8a5f34),
  ];
  const body = scene.add.image(23, -12, 'capy');
  const frontLegs = [
    scene.add.image(12, 15, 'capy-leg').setOrigin(0.5, 0.12),
    scene.add.image(27, 15, 'capy-leg').setOrigin(0.5, 0.12),
  ];

  container.add([...backLegs, body, ...frontLegs]);
  container.setScale(scale);

  const legs = [...backLegs, ...frontLegs];
  const phase = [0, Math.PI, Math.PI, 0]; // диагональные лапы ходят в противофазе

  /**
   * @param {number} time миллисекунды игры
   * @param {'idle'|'walk'|'air'} state что капибара делает
   * @param {number} speedRatio 0..2 — доля от обычной скорости (для бега)
   */
  container.animate = (time, state, speedRatio = 1) => {
    if (state === 'air') {
      // В воздухе лапки поджаты, туловище чуть задрано.
      legs.forEach((leg, i) => (leg.rotation = i < 2 ? 0.5 : -0.4));
      body.y = -14;
      body.rotation = -0.06;
      return;
    }

    if (state === 'walk') {
      const swing = 0.55;
      const rate = 0.014 * Math.max(0.6, speedRatio);
      legs.forEach((leg, i) => {
        leg.rotation = Math.sin(time * rate + phase[i]) * swing;
      });
      // Туловище подпрыгивает в такт шагам.
      body.y = -12 + Math.abs(Math.sin(time * rate)) * -3;
      body.rotation = Math.sin(time * rate) * 0.03;
      return;
    }

    // Покой: лапки прямые, капибара дышит.
    legs.forEach((leg) => (leg.rotation *= 0.8));
    body.y = -12 + Math.sin(time * 0.003) * 1.5;
    body.rotation = 0;
  };

  /** Повернуть капибару: 1 — вправо, -1 — влево. */
  container.face = (dir) => {
    container.scaleX = Math.abs(container.scaleX) * (dir < 0 ? -1 : 1);
  };

  container.bodyImage = body;
  return container;
}
