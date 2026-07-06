(function () {
  const canvas = document.getElementById("fight-canvas");
  const readout = document.getElementById("input-readout");

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const FLOOR_Y = 590;
  const GRAVITY = 0.92;
  const keys = new Set();
  const pressed = new Set();

  const player = {
    name: "Jugador",
    x: 340,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    w: 64,
    h: 148,
    facing: 1,
    health: 100,
    color: "#f01621",
    accent: "#fff0d0",
    state: "idle",
    attackTimer: 0,
    dashTimer: 0,
    grounded: true,
  };

  const cpu = {
    name: "CPU",
    x: 880,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    w: 68,
    h: 154,
    facing: -1,
    health: 100,
    color: "#43d5d0",
    accent: "#ffb83d",
    state: "guard",
    attackTimer: 0,
    dashTimer: 0,
    grounded: true,
  };

  const keyLabels = {
    KeyW: "W",
    KeyA: "A",
    KeyS: "S",
    KeyD: "D",
    Space: "Espacio",
    KeyJ: "J rapido",
    KeyK: "K pesado",
    KeyL: "L dash",
  };

  window.addEventListener("keydown", (event) => {
    if (keyLabels[event.code]) {
      event.preventDefault();
      if (!keys.has(event.code)) {
        pressed.add(event.code);
      }
      keys.add(event.code);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (keyLabels[event.code]) {
      event.preventDefault();
      keys.delete(event.code);
    }
  });

  function consume(code) {
    if (!pressed.has(code)) {
      return false;
    }
    pressed.delete(code);
    return true;
  }

  function update() {
    const left = keys.has("KeyA");
    const right = keys.has("KeyD");
    const crouch = keys.has("KeyS");
    const up = keys.has("KeyW");
    const speed = crouch ? 2 : 4.6;

    player.vx = 0;
    player.state = crouch ? "crouch" : "idle";

    if (left) {
      player.vx -= speed;
      player.facing = -1;
      player.state = "walk";
    }

    if (right) {
      player.vx += speed;
      player.facing = 1;
      player.state = "walk";
    }

    if ((consume("Space") || consume("KeyW")) && player.grounded && !crouch) {
      player.vy = -18;
      player.grounded = false;
      player.state = "jump";
    }

    if (consume("KeyL") && player.dashTimer <= 0) {
      player.dashTimer = 14;
      player.vx = player.facing * 15;
      player.state = "dash";
    }

    if (consume("KeyJ")) {
      player.attackTimer = 14;
      player.state = up ? "anti-air" : crouch ? "low quick" : "quick";
      cpu.health = Math.max(0, cpu.health - (Math.abs(player.x - cpu.x) < 190 ? 4 : 0));
    }

    if (consume("KeyK")) {
      player.attackTimer = 22;
      player.state = up ? "rising heavy" : crouch ? "sweep" : "heavy";
      cpu.health = Math.max(0, cpu.health - (Math.abs(player.x - cpu.x) < 220 ? 7 : 0));
    }

    applyPhysics(player);
    updateCpu();
    applyPhysics(cpu);
    faceEachOther();

    if (readout) {
      const active = [...keys].map((code) => keyLabels[code]).join(" + ");
      readout.textContent = active || `Estado: ${player.state}`;
    }

    pressed.clear();
  }

  function applyPhysics(fighter) {
    if (fighter.dashTimer > 0) {
      fighter.dashTimer -= 1;
    }

    if (fighter.attackTimer > 0) {
      fighter.attackTimer -= 1;
    }

    fighter.x += fighter.vx;
    fighter.y += fighter.vy;
    fighter.vy += GRAVITY;

    if (fighter.y >= FLOOR_Y) {
      fighter.y = FLOOR_Y;
      fighter.vy = 0;
      fighter.grounded = true;
    }

    fighter.x = Math.max(120, Math.min(WIDTH - 120, fighter.x));
  }

  function updateCpu() {
    const distance = player.x - cpu.x;
    cpu.vx = 0;
    cpu.state = "guard";

    if (Math.abs(distance) > 320) {
      cpu.vx = Math.sign(distance) * 2.2;
      cpu.state = "stalk";
    }

    if (Math.abs(distance) < 210 && cpu.attackTimer <= 0) {
      cpu.attackTimer = 34;
      cpu.state = "probe";
      if (Math.abs(distance) < 150) {
        player.health = Math.max(0, player.health - 2);
      }
    }
  }

  function faceEachOther() {
    player.facing = player.x <= cpu.x ? 1 : -1;
    cpu.facing = cpu.x <= player.x ? 1 : -1;
  }

  function render() {
    drawStage();
    drawHud();
    drawFighter(cpu, false);
    drawFighter(player, true);
    drawCenterLine();
  }

  function drawStage() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#080609");
    sky.addColorStop(0.55, "#18080b");
    sky.addColorStop(1, "#050304");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawCityLayer(40, 90, 0.34, "#0e0b10", "#4c0d13");
    drawCityLayer(150, 72, 0.58, "#171016", "#8f1118");

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 420, WIDTH, 150);

    ctx.strokeStyle = "rgba(255,240,208,0.16)";
    ctx.lineWidth = 4;
    for (let x = 0; x < WIDTH; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 420);
      ctx.lineTo(x + 18, 568);
      ctx.stroke();
    }

    ctx.fillStyle = "#17100f";
    ctx.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);
    ctx.fillStyle = "#26110f";
    ctx.fillRect(0, FLOOR_Y, WIDTH, 18);

    for (let x = -40; x < WIDTH; x += 92) {
      ctx.fillStyle = x % 184 === 0 ? "#2e1512" : "#1b0c0b";
      ctx.fillRect(x, FLOOR_Y + 20, 76, 26);
      ctx.strokeStyle = "rgba(240,22,33,0.22)";
      ctx.strokeRect(x, FLOOR_Y + 20, 76, 26);
    }

    drawReflection(250, "#f01621");
    drawReflection(1010, "#43d5d0");

    ctx.fillStyle = "rgba(255,184,61,0.75)";
    ctx.fillRect(88, 464, 80, 8);
    ctx.fillRect(1030, 472, 92, 8);
  }

  function drawCityLayer(baseY, step, alpha, building, light) {
    ctx.globalAlpha = alpha;
    for (let x = -20; x < WIDTH; x += step) {
      const h = 110 + ((x * 37) % 180);
      const w = 38 + ((x * 19) % 56);
      ctx.fillStyle = building;
      ctx.fillRect(x, baseY + 260 - h, w, h);
      ctx.fillStyle = light;
      for (let wy = baseY + 280 - h; wy < baseY + 230; wy += 28) {
        if ((x + wy) % 3 === 0) {
          ctx.fillRect(x + 10, wy, 10, 14);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawReflection(x, color) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    for (let i = 0; i < 7; i += 1) {
      ctx.fillRect(x - i * 18, FLOOR_Y + 38 + i * 12, 86 + i * 22, 5);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    drawHealth(46, 38, 460, player.health, player.name, false);
    drawHealth(WIDTH - 506, 38, 460, cpu.health, cpu.name, true);

    ctx.fillStyle = "#080506";
    ctx.strokeStyle = "#ffb83d";
    ctx.lineWidth = 3;
    ctx.fillRect(WIDTH / 2 - 52, 24, 104, 74);
    ctx.strokeRect(WIDTH / 2 - 52, 24, 104, 74);
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 42px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("99", WIDTH / 2, 75);
  }

  function drawHealth(x, y, width, health, label, flip) {
    ctx.fillStyle = "#080506";
    ctx.strokeStyle = "#fff0d0";
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, width, 34);
    ctx.strokeRect(x, y, width, 34);

    const fillWidth = Math.max(0, width - 8) * (health / 100);
    const barX = flip ? x + width - 4 - fillWidth : x + 4;
    ctx.fillStyle = health > 35 ? "#f01621" : "#ffb83d";
    ctx.fillRect(barX, y + 4, fillWidth, 26);

    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.textAlign = flip ? "right" : "left";
    ctx.fillText(label.toUpperCase(), flip ? x + width : x, y + 62);
  }

  function drawFighter(fighter, isPlayer) {
    const x = Math.round(fighter.x);
    const y = Math.round(fighter.y);
    const facing = fighter.facing;
    const bob = fighter.grounded ? Math.sin(performance.now() / 130) * 3 : 0;
    const torsoTop = y - fighter.h + 44 + bob;
    const headY = y - fighter.h + 18 + bob;

    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1);

    drawShadow(0, y);

    const primary = fighter.color;
    const accent = fighter.accent;
    const dark = "#090506";

    ctx.fillStyle = dark;
    ctx.fillRect(-34, torsoTop + 3, 68, 86);
    ctx.fillStyle = primary;
    ctx.fillRect(-30, torsoTop, 60, 78);
    ctx.fillStyle = "#171114";
    ctx.fillRect(-20, torsoTop + 12, 40, 66);
    ctx.fillStyle = accent;
    ctx.fillRect(-24, torsoTop + 4, 48, 8);

    ctx.fillStyle = "#2a1712";
    ctx.fillRect(-22, headY, 44, 36);
    ctx.fillStyle = isPlayer ? "#f01621" : "#141114";
    ctx.fillRect(-26, headY - 10, 52, 18);
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(7, headY + 14, 8, 6);

    drawArm(fighter, -34, torsoTop + 18, -62, torsoTop + 58, primary);
    drawArm(fighter, 30, torsoTop + 22, 62, torsoTop + 55, primary);
    drawLeg(-22, y - 58, -48, y, primary);
    drawLeg(22, y - 56, 44, y, primary);

    if (fighter.attackTimer > 0) {
      drawAttack(fighter);
    }

    if (fighter.dashTimer > 0) {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = primary;
      ctx.fillRect(-72, torsoTop + 22, 34, 62);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawShadow(x, y) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawArm(fighter, sx, sy, ex, ey, color) {
    ctx.strokeStyle = "#090506";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(ex - 9, ey - 9, 18, 18);
  }

  function drawLeg(sx, sy, ex, ey, color) {
    ctx.strokeStyle = "#090506";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(ex - 20, ey - 9, 42, 14);
  }

  function drawAttack(fighter) {
    const reach = fighter.state.includes("heavy") || fighter.state === "sweep" ? 102 : 76;
    const height = fighter.state === "sweep" ? -42 : -98;
    ctx.fillStyle = fighter.state.includes("heavy") || fighter.state === "sweep" ? "#ffb83d" : "#fff0d0";
    ctx.fillRect(35, FLOOR_Y + height, reach, 12);
    ctx.fillStyle = "rgba(240,22,33,0.58)";
    ctx.fillRect(52, FLOOR_Y + height - 8, reach + 24, 4);
  }

  function drawCenterLine() {
    ctx.fillStyle = "rgba(255,240,208,0.24)";
    ctx.fillRect(WIDTH / 2 - 1, FLOOR_Y - 18, 2, 18);
  }

  function tick() {
    update();
    render();
    requestAnimationFrame(tick);
  }

  tick();
})();
