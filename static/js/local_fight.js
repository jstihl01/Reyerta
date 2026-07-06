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
  const raindrops = Array.from({ length: 90 }, (_, index) => ({
    x: (index * 97) % WIDTH,
    y: (index * 53) % HEIGHT,
    speed: 7 + (index % 6),
  }));

  const stageImage = new Image();
  stageImage.src = canvas.dataset.stageSrc || "";

  const CHARACTERS = {
    rizo: {
      id: "rizo",
      name: "Rizo",
      archetype: "mecanico de impacto",
      bio: "Golpes pesados, avance firme y castigo brutal.",
      palette: {
        primary: "#f01621",
        secondary: "#ffb83d",
        dark: "#111015",
        cloth: "#fff0d0",
        skin: "#c98554",
        hair: "#402012",
        shadow: "#080506",
      },
      stats: { power: 6, speed: 3, range: 4, health: 110, move: 4.35, dash: 13, jump: 17.2 },
      attacks: {
        quick: { label: "puño rapido", startup: 5, active: 7, recovery: 11, damage: 7, reach: 94, height: 82, y: -108, stun: 16, hitStop: 6, shake: 5, slide: 3, type: "punch" },
        heavy: { label: "gancho pesado", startup: 9, active: 9, recovery: 20, damage: 14, reach: 122, height: 96, y: -120, stun: 26, hitStop: 10, shake: 10, slide: 6, type: "hook" },
        low: { label: "barrido llave", startup: 9, active: 10, recovery: 22, damage: 10, reach: 128, height: 44, y: -48, stun: 30, hitStop: 8, shake: 8, slide: 4, knockdown: true, type: "sweep" },
        antiAir: { label: "uppercut taller", startup: 7, active: 10, recovery: 22, damage: 12, reach: 78, height: 132, y: -174, stun: 24, hitStop: 9, shake: 9, slide: 4, type: "uppercut" },
        airQuick: { label: "martillo aereo", startup: 6, active: 8, recovery: 13, damage: 8, reach: 86, height: 82, y: -122, stun: 17, hitStop: 6, shake: 5, slide: 3, type: "air" },
        airHeavy: { label: "caida brutal", startup: 9, active: 10, recovery: 18, damage: 13, reach: 102, height: 102, y: -136, stun: 24, hitStop: 9, shake: 8, slide: 5, type: "airHeavy" },
      },
    },
    nara: {
      id: "nara",
      name: "Nara",
      archetype: "patadas y evasion",
      bio: "Movilidad alta, alcance largo y recuperacion rapida.",
      palette: {
        primary: "#43d5d0",
        secondary: "#f01621",
        dark: "#101015",
        cloth: "#fff0d0",
        skin: "#d99662",
        hair: "#161218",
        shadow: "#080506",
      },
      stats: { power: 3, speed: 6, range: 5, health: 90, move: 5.6, dash: 17, jump: 18.5 },
      attacks: {
        quick: { label: "jab relampago", startup: 3, active: 6, recovery: 8, damage: 4, reach: 98, height: 74, y: -104, stun: 11, hitStop: 4, shake: 3, slide: 2, type: "palm" },
        heavy: { label: "patada giratoria", startup: 7, active: 11, recovery: 15, damage: 9, reach: 148, height: 92, y: -116, stun: 18, hitStop: 7, shake: 7, slide: 4, type: "roundhouse" },
        low: { label: "patada baja", startup: 5, active: 8, recovery: 13, damage: 6, reach: 134, height: 42, y: -52, stun: 18, hitStop: 5, shake: 4, slide: 2, knockdown: true, type: "lowKick" },
        antiAir: { label: "luna ascendente", startup: 6, active: 10, recovery: 17, damage: 8, reach: 92, height: 132, y: -166, stun: 19, hitStop: 7, shake: 6, slide: 3, type: "risingKick" },
        airQuick: { label: "talon aereo", startup: 4, active: 9, recovery: 10, damage: 5, reach: 106, height: 82, y: -126, stun: 13, hitStop: 5, shake: 4, slide: 2, type: "airKick" },
        airHeavy: { label: "cometa roja", startup: 7, active: 11, recovery: 15, damage: 9, reach: 132, height: 100, y: -138, stun: 20, hitStop: 7, shake: 7, slide: 4, type: "airSpin" },
      },
    },
  };

  let frame = 0;
  let gamePhase = "select";
  let selectedPlayerId = "rizo";
  let selectedCpuId = "nara";
  let player = null;
  let cpu = null;
  let roundMessage = "";
  let roundTimer = 99;
  let roundTick = 0;
  let readyTimer = 0;
  let hitStop = 0;
  let screenShake = 0;
  let screenFlash = 0;
  let selectPulse = 0;

  const keyLabels = {
    ArrowLeft: "Izquierda",
    ArrowRight: "Derecha",
    KeyA: "A",
    KeyD: "D",
    KeyW: "W",
    KeyS: "S",
    Space: "Espacio",
    Enter: "Enter",
    Escape: "Escape",
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

  canvas.addEventListener("click", (event) => {
    if (gamePhase !== "select") {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    if (x < WIDTH / 2) {
      selectedPlayerId = "rizo";
      selectedCpuId = "nara";
    } else {
      selectedPlayerId = "nara";
      selectedCpuId = "rizo";
    }
    startMatch();
  });

  function consume(code) {
    if (!pressed.has(code)) {
      return false;
    }
    pressed.delete(code);
    return true;
  }

  function createFighter(characterId, config) {
    const character = CHARACTERS[characterId];
    return {
      character,
      id: character.id,
      name: character.name,
      x: config.x,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      w: character.id === "rizo" ? 78 : 66,
      h: character.id === "rizo" ? 164 : 150,
      facing: config.facing,
      maxHealth: character.stats.health,
      health: character.stats.health,
      energy: 0,
      wins: 0,
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
      bufferedAttack: null,
      bufferedTimer: 0,
      ai: Boolean(config.ai),
      aiCooldown: 44,
    };
  }

  function startMatch() {
    selectedCpuId = selectedPlayerId === "rizo" ? "nara" : "rizo";
    player = createFighter(selectedPlayerId, { x: 330, facing: 1 });
    cpu = createFighter(selectedCpuId, { x: 905, facing: -1, ai: true });
    resetRound("ROUND 1");
  }

  function resetRound(message) {
    if (!player || !cpu) {
      startMatch();
      return;
    }

    player.x = 330;
    cpu.x = 905;
    for (const fighter of [player, cpu]) {
      fighter.y = FLOOR_Y;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.health = fighter.maxHealth;
      fighter.energy = 0;
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

    gamePhase = "ready";
    roundMessage = message || "ROUND 1";
    roundTimer = 99;
    roundTick = 0;
    readyTimer = 56;
    hitStop = 0;
    screenShake = 0;
    screenFlash = 0;
    effects.length = 0;
    sparks.length = 0;
    faceEachOther();
  }

  function update() {
    frame += 1;
    selectPulse = (selectPulse + 1) % 90;

    if (consume("Escape")) {
      if (gamePhase === "select") {
        window.location.href = "/";
      } else {
        gamePhase = "select";
        roundMessage = "";
        effects.length = 0;
        sparks.length = 0;
      }
    }

    if (gamePhase === "select") {
      updateSelect();
      return;
    }

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

    if (gamePhase === "ready") {
      readyTimer -= 1;
      roundMessage = readyTimer > 22 ? "ROUND 1" : "FIGHT";
      if (readyTimer <= 0) {
        gamePhase = "fight";
        roundMessage = "";
      }
      updateEffects();
      pressed.clear();
      return;
    }

    if (gamePhase === "ended") {
      screenShake = Math.max(0, screenShake - 1);
      screenFlash = Math.max(0, screenFlash - 1);
      updateEffects();
      if (readout) {
        readout.textContent = `${roundMessage} - R revancha / Esc selector`;
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
      readout.textContent = active || `${player.name}: ${state}`;
    }

    pressed.clear();
  }

  function updateSelect() {
    if (consume("ArrowLeft") || consume("KeyA")) {
      selectedPlayerId = "rizo";
      selectedCpuId = "nara";
    }
    if (consume("ArrowRight") || consume("KeyD")) {
      selectedPlayerId = "nara";
      selectedCpuId = "rizo";
    }
    if (consume("Enter") || consume("Space") || consume("KeyJ")) {
      startMatch();
    }
    if (readout) {
      readout.textContent = `Elige luchador: ${CHARACTERS[selectedPlayerId].name} - Enter/J para combatir`;
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
      bufferAttack(player, up ? "antiAir" : crouch ? "low" : player.grounded ? "quick" : "airQuick");
    }
    if (consume("KeyK")) {
      bufferAttack(player, up ? "antiAir" : crouch ? "low" : player.grounded ? "heavy" : "airHeavy");
    }
    if (player.stunTimer > 0 || player.attack) {
      return;
    }

    const speed = crouch ? player.character.stats.move * 0.42 : player.character.stats.move;
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
      player.vy = -player.character.stats.jump;
      player.grounded = false;
      player.state = "jump";
    }
    if (consume("KeyL") && player.dashCooldown <= 0) {
      player.dashTimer = 12;
      player.dashCooldown = 32;
      player.invulnTimer = 10;
      player.vx = player.facing * player.character.stats.dash;
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
    const playerThreatening = player.attack && absDistance < 220;
    cpu.vx = 0;
    cpu.state = "guard";
    cpu.blockTimer = playerThreatening ? 10 : Math.max(0, cpu.blockTimer - 1);

    if (cpu.aiCooldown > 0) {
      cpu.aiCooldown -= 1;
    }

    if (playerThreatening) {
      cpu.vx = -Math.sign(distance) * (cpu.character.stats.move * 0.42);
      cpu.state = "guard";
    } else if (absDistance > 300) {
      cpu.vx = Math.sign(distance) * (cpu.character.stats.move * 0.58);
      cpu.state = "stalk";
    } else if (absDistance < 92) {
      cpu.vx = -Math.sign(distance) * (cpu.character.stats.move * 0.48);
      cpu.state = "backstep";
    } else if (absDistance > 170) {
      cpu.vx = Math.sign(distance) * (cpu.character.stats.move * 0.25);
      cpu.state = "probe";
    }

    if (cpu.aiCooldown <= 0 && !playerThreatening && absDistance < 230) {
      const choice = absDistance < 118 ? "quick" : Math.random() > 0.44 ? "heavy" : "low";
      startAttack(cpu, choice);
      cpu.aiCooldown = cpu.id === "nara" ? 46 + Math.floor(Math.random() * 26) : 58 + Math.floor(Math.random() * 32);
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
      fighter.vx = fighter.facing * fighter.character.stats.dash * 0.78;
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
    fighter.attack = fighter.character.attacks[attackName];
    fighter.attackFrame = 0;
    fighter.hasHit = false;
    fighter.state = fighter.attack.label;
    fighter.vx *= 0.2;
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
    defender.energy = Math.min(100, defender.energy + (blocking ? 7 : 4));
    attacker.energy = Math.min(100, attacker.energy + (blocking ? 5 : 11));
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

    for (let i = 0; i < 12; i += 1) {
      sparks.push({
        x: hitbox.x + hitbox.w * 0.62,
        y: hitbox.y + hitbox.h * 0.48,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6,
        life: 18 + Math.random() * 10,
        color: blocking ? "#43d5d0" : i % 2 ? "#fff0d0" : "#ffb83d",
      });
    }
  }

  function getHurtBox(fighter) {
    const crouch = fighter.state === "crouch";
    const height = crouch ? fighter.h * 0.66 : fighter.h;
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
    const extend = active ? 12 : -12;
    const reach = attack.reach + extend;
    const x = fighter.facing === 1 ? fighter.x + 28 : fighter.x - 28 - reach;
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

    fighter.x = Math.max(120, Math.min(WIDTH - 120, fighter.x));
  }

  function resolveSpacing() {
    const minDistance = 86;
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
    gamePhase = "ended";
    winner.wins += 1;
    roundMessage = `${reason} ${winner.name.toUpperCase()}`;
    player.state = winner === player ? "victory" : "ko";
    cpu.state = winner === cpu ? "victory" : "ko";
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

    if (gamePhase === "select") {
      drawSelectScreen();
    } else {
      drawStage();
      drawHud();
      drawFighter(cpu, false);
      drawFighter(player, true);
      drawEffects();
      drawRoundBanner();
      drawFlash();
    }
    ctx.restore();
  }

  function drawSelectScreen() {
    drawStageBase();
    ctx.fillStyle = "rgba(5,3,4,0.54)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawRain();
    drawScanlines();

    drawPanel(92, 94, 458, 500, selectedPlayerId === "rizo", CHARACTERS.rizo);
    drawPanel(WIDTH - 550, 94, 458, 500, selectedPlayerId === "nara", CHARACTERS.nara);

    ctx.save();
    ctx.translate(WIDTH / 2, 352);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#090506";
    ctx.strokeStyle = "#ffb83d";
    ctx.lineWidth = 5;
    ctx.fillRect(-58, -58, 116, 116);
    ctx.strokeRect(-58, -58, 116, 116);
    ctx.restore();

    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 56px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("VS", WIDTH / 2, 372);

    ctx.fillStyle = "#ffb83d";
    ctx.font = "bold 48px Trebuchet MS";
    ctx.fillText("ELIGE LUCHADOR", WIDTH / 2, 62);

    drawButton(WIDTH / 2 - 184, 628, 368, 58, "ENTER / J  LOCAL", true);
  }

  function drawPanel(x, y, w, h, selected, character) {
    const colors = character.palette;
    ctx.fillStyle = selected ? "rgba(240,22,33,0.36)" : "rgba(5,3,4,0.78)";
    ctx.strokeStyle = selected ? "#fff0d0" : "rgba(255,240,208,0.3)";
    ctx.lineWidth = selected ? 5 : 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    if (selected) {
      ctx.strokeStyle = selectPulse < 45 ? "#ffb83d" : "#f01621";
      ctx.strokeRect(x - 10, y - 10, w + 20, h + 20);
    }

    ctx.fillStyle = character.id === "rizo" ? "#f01621" : "#43d5d0";
    ctx.fillRect(x, y, w, 74);
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 48px Trebuchet MS";
    ctx.textAlign = "left";
    ctx.fillText(character.name.toUpperCase(), x + 24, y + 52);

    drawCharacterPortrait(character, x + 38, y + 112, 170);
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.fillText(character.archetype.toUpperCase(), x + 222, y + 128);
    ctx.fillStyle = "rgba(255,240,208,0.76)";
    ctx.font = "16px Trebuchet MS";
    wrapText(character.bio, x + 222, y + 160, 190, 22);

    drawStat("POTENCIA", character.stats.power, x + 222, y + 238, colors.primary);
    drawStat("VELOCIDAD", character.stats.speed, x + 222, y + 300, character.id === "nara" ? "#43d5d0" : "#ffb83d");
    drawStat("ALCANCE", character.stats.range, x + 222, y + 362, colors.secondary);

    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(x + 24, y + 430, w - 48, 48);
    ctx.strokeStyle = "rgba(255,240,208,0.26)";
    ctx.strokeRect(x + 24, y + 430, w - 48, 48);
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 17px Trebuchet MS";
    const move = character.id === "rizo" ? "J puño / K gancho / S+K barrido" : "J jab / K giro / S+K patada baja";
    ctx.fillText(move, x + 38, y + 461);
  }

  function drawStat(label, value, x, y, color) {
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 18px Trebuchet MS";
    ctx.fillText(label, x, y);
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i < value ? color : "rgba(255,240,208,0.16)";
      ctx.fillRect(x + i * 30, y + 16, 23, 22);
    }
  }

  function drawButton(x, y, w, h, text, selected) {
    ctx.fillStyle = selected ? "#b70f16" : "#090506";
    ctx.strokeStyle = selected ? "#fff0d0" : "#f01621";
    ctx.lineWidth = 4;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 26px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(text, x + w / 2, y + 38);
  }

  function drawStage() {
    drawStageBase();
    drawRain();
    drawCrowdPulse();
    drawGroundReflections();
    drawScanlines();
  }

  function drawStageBase() {
    if (stageImage.complete && stageImage.naturalWidth > 0) {
      ctx.drawImage(stageImage, 0, 0, WIDTH, HEIGHT);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#080609");
      sky.addColorStop(0.55, "#18080b");
      sky.addColorStop(1, "#050304");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawRain() {
    ctx.strokeStyle = "rgba(255,240,208,0.16)";
    ctx.lineWidth = 1;
    for (const drop of raindrops) {
      drop.y += drop.speed;
      if (drop.y > HEIGHT) {
        drop.y = -20;
      }
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + 3, drop.y + 18);
      ctx.stroke();
    }
  }

  function drawCrowdPulse() {
    ctx.globalAlpha = 0.16 + (frame % 80 < 40 ? 0.04 : 0);
    ctx.fillStyle = "#f01621";
    for (let x = 80; x < WIDTH; x += 92) {
      ctx.fillRect(x, 378 + ((x / 92) % 2) * 8, 10, 28);
    }
    ctx.globalAlpha = 1;
  }

  function drawGroundReflections() {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#f01621";
    for (let i = 0; i < 7; i += 1) {
      ctx.fillRect(180 + i * 8, FLOOR_Y + 58 + i * 11, 190 - i * 16, 4);
    }
    ctx.fillStyle = "#43d5d0";
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(900 + i * 8, FLOOR_Y + 62 + i * 11, 170 - i * 14, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawScanlines() {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 0; y < HEIGHT; y += 4) {
      ctx.fillRect(0, y, WIDTH, 1);
    }
  }

  function drawHud() {
    drawFighterHud(player, 24, 22, false);
    drawFighterHud(cpu, WIDTH - 520, 22, true);

    ctx.fillStyle = "#080506";
    ctx.strokeStyle = "#ffb83d";
    ctx.lineWidth = 4;
    ctx.save();
    ctx.translate(WIDTH / 2, 56);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-42, -42, 84, 84);
    ctx.strokeRect(-42, -42, 84, 84);
    ctx.restore();

    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 40px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(String(roundTimer).padStart(2, "0"), WIDTH / 2, 72);
  }

  function drawFighterHud(fighter, x, y, flip) {
    const barWidth = 424;
    const portraitSize = 82;
    const portraitX = flip ? x + barWidth - portraitSize : x;
    const barX = flip ? x : x + portraitSize + 12;

    ctx.fillStyle = "#080506";
    ctx.strokeStyle = "#fff0d0";
    ctx.lineWidth = 3;
    ctx.fillRect(portraitX, y, portraitSize, portraitSize);
    ctx.strokeRect(portraitX, y, portraitSize, portraitSize);
    drawCharacterPortrait(fighter.character, portraitX + 8, y + 8, 66);

    ctx.fillStyle = "#080506";
    ctx.strokeStyle = "#ffb83d";
    ctx.fillRect(barX, y + 8, barWidth - portraitSize - 18, 28);
    ctx.strokeRect(barX, y + 8, barWidth - portraitSize - 18, 28);

    const healthRatio = fighter.health / fighter.maxHealth;
    const fillWidth = (barWidth - portraitSize - 26) * healthRatio;
    ctx.fillStyle = healthRatio > 0.35 ? "#f01621" : "#ffb83d";
    if (flip) {
      ctx.fillRect(barX + barWidth - portraitSize - 22 - fillWidth, y + 13, fillWidth, 18);
    } else {
      ctx.fillRect(barX + 4, y + 13, fillWidth, 18);
    }

    ctx.fillStyle = "#0b2d3a";
    ctx.fillRect(barX, y + 45, barWidth - portraitSize - 18, 12);
    ctx.fillStyle = "#43d5d0";
    const energyWidth = (barWidth - portraitSize - 18) * (fighter.energy / 100);
    if (flip) {
      ctx.fillRect(barX + barWidth - portraitSize - 18 - energyWidth, y + 45, energyWidth, 12);
    } else {
      ctx.fillRect(barX, y + 45, energyWidth, 12);
    }

    ctx.fillStyle = "#fff0d0";
    ctx.font = "bold 19px Trebuchet MS";
    ctx.textAlign = flip ? "right" : "left";
    ctx.fillText(fighter.name.toUpperCase(), flip ? barX + barWidth - portraitSize - 18 : barX, y + 80);

    ctx.fillStyle = fighter.wins > 0 ? "#ffb83d" : "rgba(255,240,208,0.25)";
    for (let i = 0; i < 2; i += 1) {
      ctx.save();
      ctx.translate((flip ? barX + barWidth - portraitSize - 52 - i * 24 : barX + i * 24), y + 68);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
  }

  function drawCharacterPortrait(character, x, y, size) {
    const p = character.palette;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    const scale = size / 120;
    ctx.scale(scale, scale);
    ctx.fillStyle = p.shadow;
    ctx.fillRect(-44, -18, 88, 58);
    ctx.fillStyle = p.dark;
    ctx.fillRect(-38, -20, 76, 54);
    ctx.fillStyle = p.skin;
    ctx.fillRect(-22, -36, 44, 42);
    ctx.fillRect(-28, -18, 12, 22);
    ctx.fillRect(16, -18, 12, 22);
    ctx.fillStyle = p.hair;
    if (character.id === "rizo") {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(i * 10 - 6, -54 - Math.abs(i) * 3, 12, 20);
      }
      ctx.fillStyle = p.primary;
      ctx.fillRect(-30, -40, 60, 8);
      ctx.fillStyle = "#d8d8d8";
      ctx.fillRect(-8, -48, 16, 16);
    } else {
      ctx.fillRect(-28, -48, 48, 22);
      ctx.fillRect(18, -58, 38, 22);
      ctx.fillStyle = p.secondary;
      ctx.fillRect(20, -45, 28, 8);
    }
    ctx.fillStyle = "#080506";
    ctx.fillRect(-12, -20, 9, 5);
    ctx.fillRect(10, -20, 9, 5);
    ctx.fillStyle = p.primary;
    ctx.fillRect(-36, 14, 18, 20);
    ctx.fillRect(18, 14, 18, 20);
    ctx.fillStyle = p.cloth;
    ctx.fillRect(-18, 0, 36, 7);
    ctx.restore();
  }

  function drawFighter(fighter, isPlayer) {
    const x = Math.round(fighter.x);
    const y = Math.round(fighter.y);
    const facing = fighter.facing;
    const flicker = fighter.invulnTimer > 0 && frame % 4 < 2;
    const bob = fighter.grounded ? Math.sin(frame / 8) * 3 : 0;
    const p = fighter.character.palette;

    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(facing, 1);
    ctx.globalAlpha = flicker ? 0.62 : 1;
    drawShadow(0, y);

    if (fighter.id === "rizo") {
      drawRizo(fighter, y, bob, p);
    } else {
      drawNara(fighter, y, bob, p);
    }

    if (fighter.attack) {
      drawAttackTrail(fighter);
    }
    if (fighter.dashTimer > 0) {
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = p.primary;
      ctx.fillRect(-88, y - 116, 42, 78);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawRizo(fighter, y, bob, p) {
    const torsoTop = y - fighter.h + 46 + bob;
    const headY = y - fighter.h + 20 + bob;
    const hitColor = fighter.state === "hit" ? "#fff0d0" : p.primary;
    const attacking = fighter.attack;

    ctx.fillStyle = p.shadow;
    ctx.fillRect(-48, torsoTop + 4, 96, 100);
    ctx.fillStyle = p.dark;
    ctx.fillRect(-42, torsoTop, 84, 88);
    ctx.fillStyle = "#202027";
    ctx.fillRect(-48, torsoTop + 12, 20, 72);
    ctx.fillRect(28, torsoTop + 12, 20, 72);
    ctx.fillStyle = p.cloth;
    ctx.fillRect(-20, torsoTop + 12, 40, 70);
    ctx.fillStyle = "#ffb83d";
    ctx.fillRect(-30, torsoTop + 76, 60, 8);
    ctx.fillStyle = hitColor;
    ctx.fillRect(-42, torsoTop + 4, 16, 58);
    ctx.fillRect(26, torsoTop + 4, 16, 58);
    ctx.fillStyle = "#cfd3d6";
    ctx.fillRect(-53, torsoTop + 78, 16, 34);
    ctx.fillRect(-58, torsoTop + 104, 34, 10);

    ctx.fillStyle = p.skin;
    ctx.fillRect(-23, headY, 46, 38);
    ctx.fillRect(-30, headY + 13, 10, 20);
    ctx.fillRect(20, headY + 13, 10, 20);
    ctx.fillStyle = p.hair;
    for (let i = -3; i <= 3; i += 1) {
      ctx.fillRect(i * 11 - 5, headY - 16 - Math.abs(i) * 2, 11, 20);
    }
    ctx.fillStyle = p.primary;
    ctx.fillRect(-31, headY - 6, 62, 8);
    ctx.fillStyle = "#cfd3d6";
    ctx.fillRect(-8, headY - 17, 16, 16);
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(6, headY + 15, 8, 6);
    ctx.fillStyle = "#080506";
    ctx.fillRect(-12, headY + 13, 9, 5);
    ctx.fillRect(8, headY + 13, 9, 5);

    const armReach = attacking ? (fighter.attack.type === "hook" ? 96 : 78) : 60;
    drawLimb(-36, torsoTop + 25, -68, torsoTop + 67, p.primary, 18);
    drawLimb(34, torsoTop + 24, armReach, torsoTop + (attacking ? 38 : 62), p.primary, 20);
    drawGlove(armReach, torsoTop + (attacking ? 38 : 62), p.primary);
    drawLimb(-24, y - 66, -54, y, p.dark, 24);
    drawLimb(24, y - 64, 52, y, p.dark, 24);
    drawBoot(-54, y);
    drawBoot(52, y);
  }

  function drawNara(fighter, y, bob, p) {
    const torsoTop = y - fighter.h + 42 + bob;
    const headY = y - fighter.h + 18 + bob;
    const hitColor = fighter.state === "hit" ? "#fff0d0" : p.primary;
    const kicking = fighter.attack && ["roundhouse", "lowKick", "risingKick", "airKick", "airSpin"].includes(fighter.attack.type);

    ctx.fillStyle = p.shadow;
    ctx.fillRect(-38, torsoTop + 3, 76, 84);
    ctx.fillStyle = p.dark;
    ctx.fillRect(-32, torsoTop, 64, 78);
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(-36, torsoTop + 6, 14, 58);
    ctx.fillRect(22, torsoTop + 6, 14, 58);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(-48, torsoTop + 58, 96, 14);
    ctx.fillRect(-58, torsoTop + 72, 104, 12);
    ctx.fillStyle = p.cloth;
    ctx.fillRect(-24, torsoTop + 4, 48, 8);

    ctx.fillStyle = p.skin;
    ctx.fillRect(-21, headY, 42, 36);
    ctx.fillRect(-26, headY + 14, 9, 19);
    ctx.fillRect(17, headY + 14, 9, 19);
    ctx.fillStyle = p.hair;
    ctx.fillRect(-28, headY - 12, 50, 20);
    ctx.fillRect(15, headY - 31, 55, 24);
    ctx.fillRect(54, headY - 24, 18, 44);
    ctx.fillStyle = p.secondary;
    ctx.fillRect(24, headY - 22, 30, 7);
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(7, headY + 14, 8, 6);
    ctx.fillStyle = "#080506";
    ctx.fillRect(-12, headY + 13, 9, 5);
    ctx.fillRect(8, headY + 13, 9, 5);

    drawLimb(-30, torsoTop + 22, -64, torsoTop + 56, hitColor, 14);
    drawLimb(28, torsoTop + 22, fighter.attack && !kicking ? 78 : 58, torsoTop + (fighter.attack && !kicking ? 42 : 54), hitColor, 14);

    if (kicking) {
      const kickY = fighter.attack.type === "lowKick" ? y - 44 : y - 102;
      drawLimb(14, y - 62, 112, kickY, hitColor, 18);
      drawBoot(112, kickY);
      drawLimb(-20, y - 58, -44, y, p.dark, 18);
      drawBoot(-44, y);
    } else {
      drawLimb(-20, y - 58, -44, y, p.dark, 18);
      drawLimb(22, y - 58, 44, y, p.dark, 18);
      drawBoot(-44, y);
      drawBoot(44, y);
    }
  }

  function drawLimb(sx, sy, ex, ey, color, width) {
    ctx.strokeStyle = "#090506";
    ctx.lineWidth = width + 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  function drawGlove(x, y, color) {
    ctx.fillStyle = "#090506";
    ctx.fillRect(x - 13, y - 13, 26, 26);
    ctx.fillStyle = color;
    ctx.fillRect(x - 10, y - 10, 20, 20);
  }

  function drawBoot(x, y) {
    ctx.fillStyle = "#090506";
    ctx.fillRect(x - 24, y - 10, 48, 17);
    ctx.fillStyle = "#fff0d0";
    ctx.fillRect(x - 21, y - 8, 42, 12);
  }

  function drawShadow(x, y) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 76, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAttackTrail(fighter) {
    const box = getAttackBox(fighter);
    const attack = fighter.attack;
    const active = fighter.attackFrame >= attack.startup && fighter.attackFrame <= attack.startup + attack.active;
    const localX = fighter.facing === 1 ? box.x - fighter.x : fighter.x - box.x - box.w;
    ctx.fillStyle = active ? "rgba(255,240,208,0.82)" : "rgba(255,184,61,0.32)";
    ctx.fillRect(localX, box.y, box.w, 10);
    ctx.fillStyle = fighter.id === "nara" ? "rgba(67,213,208,0.62)" : "rgba(240,22,33,0.62)";
    ctx.fillRect(localX + 14, box.y - 9, box.w + 24, 5);
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
    if (gamePhase === "fight" && !roundMessage) {
      return;
    }
    const ended = gamePhase === "ended";
    const text = ended ? roundMessage : roundMessage || "FIGHT";
    const subtext = ended ? "R REVANCHA / ESC SELECTOR" : "";

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
      color: fighter.character.palette.primary,
      life: 16,
    });
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = `${line}${word} `;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = `${word} `;
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
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
    selectCharacter(characterId) {
      if (CHARACTERS[characterId]) {
        selectedPlayerId = characterId;
        selectedCpuId = characterId === "rizo" ? "nara" : "rizo";
        startMatch();
      }
    },
    getState() {
      return {
        gamePhase,
        selectedPlayerId,
        selectedCpuId,
        player: player ? {
          id: player.id,
          name: player.name,
          x: Math.round(player.x),
          y: Math.round(player.y),
          health: player.health,
          maxHealth: player.maxHealth,
          state: player.state,
        } : null,
        cpu: cpu ? {
          id: cpu.id,
          name: cpu.name,
          x: Math.round(cpu.x),
          y: Math.round(cpu.y),
          health: cpu.health,
          maxHealth: cpu.maxHealth,
          state: cpu.state,
        } : null,
        roundMessage,
        roundTimer,
        hitStop,
      };
    },
  };

  tick();
})();
