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
  const effects = [];
  const sparks = [];

  let frame = 0;
  let roundState = "ready";
  let roundMessage = "ROUND 1";
  let roundTimer = 99;
  let roundTick = 0;
  let readyTimer = 54;
  let hitStop = 0;
  let screenShake = 0;
  let screenFlash = 0;

  const attacks = {
    quick: { label: "rapido", startup: 4, active: 7, recovery: 10, damage: 5, reach: 92, height: 82, y: -108, stun: 14, hitStop: 5, shake: 4, slide: 2 },
    heavy: { label: "pesado", startup: 8, active: 9, recovery: 18, damage: 11, reach: 128, height: 90, y: -112, stun: 22, hitStop: 8, shake: 8, slide: 5 },
    lowQuick: { label: "bajo rapido", startup: 5, active: 7, recovery: 12, damage: 4, reach: 96, height: 42, y: -56, stun: 12, hitStop: 5, shake: 3, slide: 1 },
    sweep: { label: "barrido", startup: 9, active: 10, recovery: 22, damage: 9, reach: 132, height: 42, y: -48, stun: 28, knockdown: true, hitStop: 8, shake: 8, slide: 3 },
    antiAir: { label: "anti-air", startup: 5, active: 9, recovery: 16, damage: 7, reach: 72, height: 116, y: -158, stun: 18, hitStop: 6, shake: 5, slide: 2 },
    risingHeavy: { label: "ascendente", startup: 9, active: 11, recovery: 24, damage: 12, reach: 88, height: 128, y: -170, stun: 24, hitStop: 9, shake: 9, slide: 4 },
    airQuick: { label: "aereo rapido", startup: 4, active: 8, recovery: 12, damage: 5, reach: 88, height: 74, y: -118, stun: 14, hitStop: 5, shake: 4, slide: 2 },
    airHeavy: { label: "aereo pesado", startup: 7, active: 10, recovery: 18, damage: 10, reach: 106, height: 94, y: -132, stun: 21, hitStop: 8, shake: 7, slide: 4 },
  };

  const player = createFighter({
    name: "Jugador",
    x: 340,
    color: "#f01621",
    accent: "#fff0d0",
    facing: 1,
  });

  const cpu = createFighter({
    name: "CPU",
    x: 890,
    color: "#43d5d0",
    accent: "#ffb83d",
    facing: -1,
    ai: true,
  });

  const keyLabels = {
    KeyW: "W",
    KeyA: "A",
    KeyS: "S",
    KeyD: "D",
    Space: "Espacio",
    KeyJ: "J rapido",
    KeyK: "K pesado",
    KeyL: "L dash",
    KeyR: "R reiniciar",
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

  function createFighter(config) {
    return {
      name: config.name,
      x: config.x,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      w: 64,
      h: 148,
      facing: config.facing,
      health: 100,
      wins: 0,
      color: config.color,
      accent: config.accent,
      state: "idle",
      grounded: true,
      attack: null,
      attackFrame: 0,
      hasHit: false,
      dashTimer: 0,
      dashCooldown: 0,
      stunTimer: 0,
      invulnTimer: 0,
      blockTimer: 0,
      ai: Boolean(config.ai),
      aiCooldown: 40,
      bufferedAttack: null,
      bufferedTimer: 0,
    };
  }

  function consume(code) {
    if (!pressed.has(code)) {
      return false;
    }
    pressed.delete(code);
    return true;
  }

  function resetRound(message) {
    player.x = 340;
    cpu.x = 890;
    for (const fighter of [player, cpu]) {
      fighter.y = FLOOR_Y;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.health = 100;
      fighter.state = "idle";
      fighter.attack = null;
      fighter.attackFrame = 0;
      fighter.hasHit = false;
      fighter.dashTimer = 0;
      fighter.dashCooldown = 0;
      fighter.stunTimer = 0;
      fighter.invulnTimer = 20;
      fighter.blockTimer = 0;
      fighter.grounded = true;
      fighter.bufferedAttack = null;
      fighter.bufferedTimer = 0;
    }
    roundState = "ready";
    roundMessage = message || "ROUND 1";
    roundTimer = 99;
    roundTick = 0;
    readyTimer = 54;
    hitStop = 0;
    screenShake = 0;
    screenFlash = 0;
    effects.length = 0;
    sparks.length = 0;
    faceEachOther();
  }

  function update() {
    frame += 1;

    if (consume("KeyR")) {
      resetRound("RESET");
    }

    if (hitStop > 0) {
      hitStop -= 1;
      screenShake = Math.max(0, screenShake - 1);
      screenFlash = Math.max(0, screenFlash - 1);
      updateEffects();
      pressed.clear();
      return;
    }

    if (roundState === "ready") {
      readyTimer -= 1;
      roundMessage = readyTimer > 22 ? "ROUND 1" : "FIGHT";
      if (readyTimer <= 0) {
        roundState = "fight";
        roundMessage = "";
      }
      updateEffects();
      pressed.clear();
      return;
    }

    if (roundState !== "fight") {
      screenShake = Math.max(0, screenShake - 1);
      screenFlash = Math.max(0, screenFlash - 1);
      updateEffects();
      if (readout) {
        readout.textContent = `${roundMessage} - pulsa R para reiniciar`;
      }
      pressed.clear();
      return;
    }

    roundTick += 1;
    if (roundTick >= 60) {
      roundTick = 0;
      roundTimer = Math.max(0, roundTimer - 1);
      if (roundTimer === 0) {
        endRound(player.health >= cpu.health ? player : cpu, "TIME");
      }
    }

    updatePlayer();
    updateCpu();
    applyPhysics(player);
    applyPhysics(cpu);
    resolveSpacing();
    faceEachOther();
    updateAttack(player, cpu);
    updateAttack(cpu, player);
    updateEffects();
    screenShake = Math.max(0, screenShake - 1);
    screenFlash = Math.max(0, screenFlash - 1);

    if (player.health <= 0) {
      endRound(cpu, "K.O.");
    } else if (cpu.health <= 0) {
      endRound(player, "K.O.");
    }

    if (readout) {
      const active = [...keys].filter((code) => code !== "KeyR").map((code) => keyLabels[code]).join(" + ");
      const state = player.attack ? player.attack.label : player.state;
      readout.textContent = active || `Estado: ${state}`;
    }

    pressed.clear();
  }

  function updatePlayer() {
    tickStatus(player);

    const left = keys.has("KeyA");
    const right = keys.has("KeyD");
    const crouch = keys.has("KeyS");
    const up = keys.has("KeyW");
    const guarding = crouch || (player.facing === 1 ? left : right);
    player.blockTimer = guarding ? 8 : Math.max(0, player.blockTimer - 1);

    if (consume("KeyJ")) {
      bufferAttack(player, up ? "antiAir" : crouch ? "lowQuick" : player.grounded ? "quick" : "airQuick");
    }

    if (consume("KeyK")) {
      bufferAttack(player, up ? "risingHeavy" : crouch ? "sweep" : player.grounded ? "heavy" : "airHeavy");
    }

    if (player.stunTimer > 0 || player.attack) {
      return;
    }

    const speed = crouch ? 2 : 4.9;

    player.vx = 0;
    player.state = crouch ? "crouch" : guarding ? "guard" : "idle";

    if (left) {
      player.vx -= speed;
      player.state = "walk";
    }

    if (right) {
      player.vx += speed;
      player.state = "walk";
    }

    if ((consume("Space") || consume("KeyW")) && player.grounded && !crouch) {
      player.vy = -18;
      player.grounded = false;
      player.state = "jump";
    }

    if (consume("KeyL") && player.dashCooldown <= 0) {
      player.dashTimer = 12;
      player.dashCooldown = 32;
      player.invulnTimer = 10;
      player.vx = player.facing * 16;
      player.state = "dash";
      spawnAfterimage(player);
    }

    tryBufferedAttack(player);
  }

  function updateCpu() {
    tickStatus(cpu);

    if (cpu.stunTimer > 0 || cpu.attack) {
      return;
    }

    const distance = player.x - cpu.x;
    const absDistance = Math.abs(distance);
    cpu.vx = 0;
    cpu.state = "guard";
    const playerThreatening = player.attack && absDistance < 210;
    cpu.blockTimer = playerThreatening ? 10 : Math.max(0, cpu.blockTimer - 1);

    if (cpu.aiCooldown > 0) {
      cpu.aiCooldown -= 1;
    }

    if (playerThreatening) {
      cpu.vx = -Math.sign(distance) * 2.1;
      cpu.state = "guard";
    } else if (absDistance > 275) {
      cpu.vx = Math.sign(distance) * 2.8;
      cpu.state = "stalk";
    } else if (absDistance < 98) {
      cpu.vx = -Math.sign(distance) * 2.4;
      cpu.state = "backstep";
    } else if (absDistance > 165) {
      cpu.vx = Math.sign(distance) * 1.1;
      cpu.state = "probe";
    }

    if (cpu.aiCooldown <= 0 && !playerThreatening && absDistance < 220) {
      const choice = absDistance < 120 ? "quick" : Math.random() > 0.42 ? "heavy" : "sweep";
      startAttack(cpu, choice);
      cpu.aiCooldown = 54 + Math.floor(Math.random() * 34);
    }
  }

  function tickStatus(fighter) {
    fighter.dashCooldown = Math.max(0, fighter.dashCooldown - 1);
    fighter.invulnTimer = Math.max(0, fighter.invulnTimer - 1);
    fighter.stunTimer = Math.max(0, fighter.stunTimer - 1);
    fighter.bufferedTimer = Math.max(0, fighter.bufferedTimer - 1);
    if (fighter.bufferedTimer <= 0) {
      fighter.bufferedAttack = null;
    }

    if (fighter.dashTimer > 0) {
      fighter.dashTimer -= 1;
      fighter.vx = fighter.facing * 13;
    }
  }

  function bufferAttack(fighter, attackName) {
    fighter.bufferedAttack = attackName;
    fighter.bufferedTimer = 9;
  }

  function tryBufferedAttack(fighter) {
    if (!fighter.bufferedAttack || fighter.stunTimer > 0 || fighter.attack) {
      return false;
    }
    startAttack(fighter, fighter.bufferedAttack);
    fighter.bufferedAttack = null;
    fighter.bufferedTimer = 0;
    return true;
  }

  function startAttack(fighter, attackName) {
    fighter.attack = attacks[attackName];
    fighter.attackFrame = 0;
    fighter.hasHit = false;
    fighter.state = fighter.attack.label;
    fighter.vx *= 0.25;
  }

  function updateAttack(attacker, defender) {
    if (!attacker.attack) {
      return;
    }

    attacker.attackFrame += 1;
    const attack = attacker.attack;
    const activeStart = attack.startup;
    const activeEnd = attack.startup + attack.active;

    if (attacker.attackFrame >= activeStart && attacker.attackFrame <= activeEnd && !attacker.hasHit) {
      const hitbox = getAttackBox(attacker);
      const hurtbox = getHurtBox(defender);
      if (overlap(hitbox, hurtbox) && defender.invulnTimer <= 0) {
        applyHit(attacker, defender, attack, hitbox);
        attacker.hasHit = true;
      }
    }

    if (attacker.attackFrame > attack.startup + attack.active + attack.recovery) {
      attacker.attack = null;
      attacker.attackFrame = 0;
      attacker.hasHit = false;
      attacker.state = "idle";
    }
  }

  function applyHit(attacker, defender, attack, hitbox) {
    const blocking = defender.blockTimer > 0 && defender.facing !== attacker.facing && defender.grounded;
    const damage = blocking ? Math.ceil(attack.damage * 0.35) : attack.damage;
    defender.health = Math.max(0, defender.health - damage);
    defender.stunTimer = blocking ? 7 : attack.stun;
    defender.invulnTimer = 8;
    defender.vx = attacker.facing * (blocking ? 3 : 7 + attack.slide);
    defender.vy = attack.knockdown && !blocking ? -7 : defender.vy;
    defender.state = blocking ? "block" : attack.knockdown ? "knockdown" : "hit";
    attacker.vx += attacker.facing * (blocking ? 0.8 : 1.8);
    hitStop = blocking ? Math.max(3, attack.hitStop - 2) : attack.hitStop;
    screenShake = blocking ? Math.max(2, Math.floor(attack.shake / 2)) : attack.shake;
    screenFlash = blocking ? 4 : 7;

    effects.push({
      x: hitbox.x + hitbox.w * 0.65,
      y: hitbox.y + hitbox.h * 0.45,
      text: blocking ? "BLOCK" : `-${damage}`,
      color: blocking ? "#43d5d0" : "#ffb83d",
      life: 34,
    });

    for (let i = 0; i < 9; i += 1) {
      sparks.push({
        x: hitbox.x + hitbox.w * 0.62,
        y: hitbox.y + hitbox.h * 0.48,
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 5,
        life: 18 + Math.random() * 8,
        color: blocking ? "#43d5d0" : "#fff0d0",
      });
    }
  }

  function getHurtBox(fighter) {
    const crouch = fighter.state === "crouch";
    const height = crouch ? 94 : fighter.h;
    return {
      x: fighter.x - fighter.w / 2,
      y: fighter.y - height,
      w: fighter.w,
      h: height,
    };
  }

  function getAttackBox(fighter) {
    const attack = fighter.attack;
    const active = fighter.attackFrame >= attack.startup && fighter.attackFrame <= attack.startup + attack.active;
    const extend = active ? 10 : -12;
    const reach = attack.reach + extend;
    const x = fighter.facing === 1 ? fighter.x + 26 : fighter.x - 26 - reach;
    return {
      x,
      y: fighter.y + attack.y,
      w: reach,
      h: attack.height,
    };
  }

  function applyPhysics(fighter) {
    fighter.x += fighter.vx;
    fighter.y += fighter.vy;
    fighter.vy += GRAVITY;
    fighter.vx *= fighter.grounded ? 0.78 : 0.94;

    if (fighter.y >= FLOOR_Y) {
      fighter.y = FLOOR_Y;
      fighter.vy = 0;
      fighter.grounded = true;
      if (fighter.state === "knockdown" && fighter.stunTimer <= 0) {
        fighter.state = "idle";
      }
    } else {
      fighter.grounded = false;
    }

    fighter.x = Math.max(110, Math.min(WIDTH - 110, fighter.x));
  }

  function resolveSpacing() {
    const minDistance = 82;
    const delta = cpu.x - player.x;
    if (Math.abs(delta) < minDistance) {
      const push = (minDistance - Math.abs(delta)) / 2;
      const dir = delta >= 0 ? 1 : -1;
      player.x -= push * dir;
      cpu.x += push * dir;
    }
  }

  function faceEachOther() {
    player.facing = player.x <= cpu.x ? 1 : -1;
    cpu.facing = cpu.x <= player.x ? 1 : -1;
  }

  function endRound(winner, reason) {
    roundState = "ended";
    winner.wins += 1;
    roundMessage = `${reason} ${winner.name.toUpperCase()}`;
    screenShake = 14;
    screenFlash = 12;
  }

  function updateEffects() {
    for (const effect of effects) {
      effect.y -= effect.big ? 0 : 0.7;
      effect.life -= 1;
    }
    for (const spark of sparks) {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vy += 0.35;
      spark.life -= 1;
    }

    removeDead(effects);
    removeDead(sparks);
  }

  function removeDead(items) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].life <= 0) {
        items.splice(i, 1);
      }
    }
  }

  function render() {
    ctx.save();
    if (screenShake > 0) {
      const shake = screenShake * 0.55;
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawStage();
    drawHud();
    drawFighter(cpu, false);
    drawFighter(player, true);
    drawDebugBoxes();
    drawEffects();
    drawRoundBanner();
    drawFlash();
    ctx.restore();
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
      const h = 110 + Math.abs((x * 37) % 180);
      const w = 38 + Math.abs((x * 19) % 56);
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
    drawHealth(46, 38, 460, player.health, player.name, false, player.wins);
    drawHealth(WIDTH - 506, 38, 460, cpu.health, cpu.name, true, cpu.wins);

    ctx.fillStyle = "#080506";
    ctx.strokeStyle = "#ffb83d";
    ctx.lineWidth = 3;
    ctx.fillRect(WIDTH / 2 - 52, 24, 104, 74);
    ctx.strokeRect(WIDTH / 2 - 52, 24, 104, 74);
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 42px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(String(roundTimer).padStart(2, "0"), WIDTH / 2, 75);
  }

  function drawHealth(x, y, width, health, label, flip, wins) {
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

    ctx.fillStyle = wins > 0 ? "#ffb83d" : "rgba(255,240,208,0.25)";
    const start = flip ? x + width - 28 : x;
    for (let i = 0; i < 2; i += 1) {
      ctx.fillRect(start + (flip ? -i * 24 : i * 24), y + 74, 18, 8);
    }
  }

  function drawFighter(fighter, isPlayer) {
    const x = Math.round(fighter.x);
    const y = Math.round(fighter.y);
    const facing = fighter.facing;
    const flicker = fighter.invulnTimer > 0 && frame % 4 < 2;
    const bob = fighter.grounded ? Math.sin(frame / 8) * 3 : 0;
    const torsoTop = y - fighter.h + 44 + bob;
    const headY = y - fighter.h + 18 + bob;

    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1);
    ctx.globalAlpha = flicker ? 0.62 : 1;

    drawShadow(0, y);

    const primary = fighter.state === "hit" ? "#fff0d0" : fighter.color;
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
    drawArm(fighter, 30, torsoTop + 22, fighter.attack ? 84 : 62, torsoTop + (fighter.attack ? 40 : 55), primary);
    drawLeg(-22, y - 58, -48, y, primary);
    drawLeg(22, y - 56, 44, y, primary);

    if (fighter.attack) {
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
    const attack = fighter.attack;
    const box = getAttackBox(fighter);
    const active = fighter.attackFrame >= attack.startup && fighter.attackFrame <= attack.startup + attack.active;
    ctx.fillStyle = active ? "rgba(255,240,208,0.82)" : "rgba(255,184,61,0.34)";
    ctx.fillRect(fighter.facing === 1 ? box.x - fighter.x : fighter.x - box.x - box.w, box.y, box.w, 10);
    ctx.fillStyle = "rgba(240,22,33,0.58)";
    ctx.fillRect(fighter.facing === 1 ? box.x - fighter.x + 16 : fighter.x - box.x - box.w - 16, box.y - 8, box.w + 26, 4);
  }

  function drawDebugBoxes() {
    if (!keys.has("KeyR")) {
      return;
    }

    drawBox(getHurtBox(player), "rgba(67,213,208,0.65)");
    drawBox(getHurtBox(cpu), "rgba(67,213,208,0.65)");
    if (player.attack) {
      drawBox(getAttackBox(player), "rgba(255,184,61,0.7)");
    }
    if (cpu.attack) {
      drawBox(getAttackBox(cpu), "rgba(255,184,61,0.7)");
    }
  }

  function drawBox(box, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
  }

  function drawEffects() {
    for (const spark of sparks) {
      ctx.fillStyle = spark.color;
      ctx.fillRect(spark.x, spark.y, 5, 5);
    }

    for (const effect of effects) {
      ctx.fillStyle = effect.color;
      ctx.textAlign = "center";
      ctx.font = effect.big ? "bold 54px Trebuchet MS" : "bold 24px Trebuchet MS";
      ctx.fillText(effect.text, effect.x, effect.y);
    }
  }

  function drawRoundBanner() {
    if (roundState === "fight" && !roundMessage) {
      return;
    }

    const ended = roundState === "ended";
    const text = ended ? roundMessage : roundMessage || "FIGHT";
    const subtext = ended ? "PULSA R PARA REVANCHA" : "";

    ctx.save();
    ctx.globalAlpha = ended ? 0.96 : 0.84;
    ctx.fillStyle = "rgba(5,3,4,0.82)";
    ctx.fillRect(0, HEIGHT / 2 - 74, WIDTH, ended ? 150 : 110);
    ctx.strokeStyle = ended ? "#ffb83d" : "#f01621";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT / 2 - 74);
    ctx.lineTo(WIDTH, HEIGHT / 2 - 74);
    ctx.moveTo(0, HEIGHT / 2 + (ended ? 76 : 36));
    ctx.lineTo(WIDTH, HEIGHT / 2 + (ended ? 76 : 36));
    ctx.stroke();

    ctx.fillStyle = ended ? "#fff0d0" : "#ffb83d";
    ctx.font = ended ? "bold 58px Trebuchet MS" : "bold 64px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 - (ended ? 4 : 2));

    if (subtext) {
      ctx.fillStyle = "#43d5d0";
      ctx.font = "bold 22px Trebuchet MS";
      ctx.fillText(subtext, WIDTH / 2, HEIGHT / 2 + 46);
    }
    ctx.restore();
  }

  function drawFlash() {
    if (screenFlash <= 0) {
      return;
    }
    ctx.fillStyle = `rgba(255,240,208,${screenFlash / 70})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function spawnAfterimage(fighter) {
    effects.push({
      x: fighter.x - fighter.facing * 70,
      y: fighter.y - 92,
      text: "DASH",
      color: fighter.color,
      life: 16,
    });
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function tick() {
    update();
    render();
    requestAnimationFrame(tick);
  }

  window.__reyertaLocalFight = {
    getState() {
      return {
        player: {
          x: Math.round(player.x),
          y: Math.round(player.y),
          health: player.health,
          state: player.state,
        },
        cpu: {
          x: Math.round(cpu.x),
          y: Math.round(cpu.y),
          health: cpu.health,
          state: cpu.state,
        },
        roundState,
        roundMessage,
        roundTimer,
        hitStop,
      };
    },
  };

  resetRound("ROUND 1");
  tick();
})();
