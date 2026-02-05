/* Version: #13 - Projectiles & Expanded Defense */

// === KONFIGURASJON ===
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    debugMode: false,
    
    baseX: 500,
    baseY: 550,
    wallRadius: 220,
    wallSegments: 7,
    gateIndex: 3,

    enemySpawnInterval: 1000,
    baseEnemySpeed: 30,

    // Enheter (Skade halvert etter ønske)
    units: {
        peasant: { 
            name: "Fotsoldat", cost: 50, damage: 5, range: 120, cooldown: 1.0, 
            type: 'melee', speed: 60, spriteId: 'peasant', color: "#d35400"
        },
        archer:  { 
            name: "Bueskytter", cost: 100, damage: 7.5, range: 300, cooldown: 1.5, 
            type: 'ranged', speed: 70, spriteId: 'archer', color: "#27ae60",
            projectileSpeed: 200 // Hvor fort pilen flyr
        },
        knight:  { 
            name: "Ridder", cost: 200, damage: 20, range: 120, cooldown: 0.8, 
            type: 'melee', speed: 50, spriteId: 'knight', color: "#2980b9"
        }
    }
};

// === ASSET SYSTEM ===
const Assets = {
    sprites: {}, 
    definitions: {
        peasant: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        archer:  { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        knight:  { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        enemy:   { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        boss:    { w: 48, h: 48, fps: 6, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } }
    }
};

// === SPILL-TILSTAND ===
let gameState = {
    money: 450,
    wave: 1,
    baseHealth: 100,
    isPaused: false,
    gameActive: false,
    lastTime: 0,
    
    enemiesToSpawn: 0,
    spawnTimer: 0,

    walls: [],
    slots: [],
    enemies: [],
    units: [],
    
    // NYTT: Lister for prosjektiler og visuelle effekter
    projectiles: [],
    effects: [],

    selectedUnit: null,
    isGateOpen: false
};

// === DOM & CANVAS ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const uiWave = document.getElementById('wave-display');
const uiGold = document.getElementById('gold-display');
const uiBaseHp = document.getElementById('base-hp-display');
const uiMessage = document.getElementById('status-message');

// === INITIALISERING ===
function init() {
    console.log("Initialiserer Castle Defense v13...");
    generatePlaceholderSprites();
    createLevelGeometry();
    setupEventListeners();
    addGateControl();
    requestAnimationFrame(gameLoop);
}

// === GENERERING AV GRAFIKK (Uendret fra v12) ===
function generatePlaceholderSprites() {
    const createSheet = (id, color, size, isBoss = false) => {
        const c = document.createElement('canvas');
        c.width = size * 8; c.height = size;
        const x = c.getContext('2d');
        const drawFrame = (idx, legOff, armAttack) => {
            const ox = idx * size; const cx = ox + size/2; const cy = size/2;
            x.fillStyle = color; x.strokeStyle = color; x.lineWidth = isBoss ? 4 : 2;
            x.beginPath(); x.arc(cx, cy - (size*0.25), size*0.15, 0, Math.PI*2); x.fill();
            x.beginPath(); x.moveTo(cx, cy - (size*0.1)); x.lineTo(cx, cy + (size*0.2)); x.stroke();
            x.beginPath(); x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx - (size*0.1) + legOff, cy + (size*0.45));
            x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx + (size*0.1) - legOff, cy + (size*0.45)); x.stroke();
            x.beginPath();
            if (armAttack) { x.moveTo(cx, cy); x.lineTo(cx + (size*0.35), cy); } 
            else { x.moveTo(cx, cy); x.lineTo(cx - (size*0.15), cy + (size*0.15) - legOff); x.moveTo(cx, cy); x.lineTo(cx + (size*0.15), cy + (size*0.15) + legOff); }
            x.stroke();
            if (id === 'archer') { x.strokeStyle = "brown"; x.beginPath(); x.arc(cx + (armAttack?10:5), cy, 8, -1, 1); x.stroke(); }
        };
        drawFrame(0, 0, false);
        drawFrame(1, -5, false); drawFrame(2, 0, false); drawFrame(3, 5, false); drawFrame(4, 0, false);
        drawFrame(5, 10, true); drawFrame(6, 5, true);
        const img = new Image(); img.src = c.toDataURL();
        Assets.sprites[id] = img;
    };
    createSheet('peasant', GameConfig.units.peasant.color, 32);
    createSheet('archer', GameConfig.units.archer.color, 32);
    createSheet('knight', GameConfig.units.knight.color, 32);
    createSheet('enemy', '#c0392b', 32);
    createSheet('boss', '#800000', 48, true);
}

// === GEOMETRI (Oppdatert med 5 slots på muren) ===
function createLevelGeometry() {
    const startAngle = Math.PI * 1.1; const endAngle = Math.PI * 1.9; const totalSegments = GameConfig.wallSegments;
    gameState.walls = []; gameState.slots = [];

    for (let i = 0; i < totalSegments; i++) {
        const t = i / (totalSegments - 1);
        const angle = startAngle + t * (endAngle - startAngle);
        const wx = GameConfig.baseX + GameConfig.wallRadius * Math.cos(angle);
        const wy = GameConfig.baseY + GameConfig.wallRadius * Math.sin(angle);
        const isGate = (i === GameConfig.gateIndex);

        const wallSegment = { id: `wall-${i}`, x: wx, y: wy, width: 60, height: 40, angle: angle, hp: 100, maxHp: isGate ? 300 : 150, isBroken: false, isGate: isGate, radius: 35 };
        gameState.walls.push(wallSegment);

        const createSlot = (type, dist, offsetSide, label) => {
            const bx = GameConfig.baseX + (GameConfig.wallRadius + dist) * Math.cos(angle);
            const by = GameConfig.baseY + (GameConfig.wallRadius + dist) * Math.sin(angle);
            const sideAngle = angle + Math.PI / 2;
            const finalX = bx + (offsetSide * 10) * Math.cos(sideAngle); // 10px spacing
            const finalY = by + (offsetSide * 10) * Math.sin(sideAngle);
            gameState.slots.push({ id: `slot-${type}-${i}-${label}`, type: type, parentWallId: wallSegment.id, x: finalX, y: finalY, occupied: false, unit: null });
        };

        // 2 slots ute
        createSlot('outside', 60, -1.5, 'A'); createSlot('outside', 60, 1.5, 'B');
        
        // 5 slots PÅ MUREN (Oppdatert)
        // Offsetter: -2, -1, 0, 1, 2 (ganger spacing på 10px)
        createSlot('wall', 0, -2, 'A');
        createSlot('wall', 0, -1, 'B');
        createSlot('wall', 0, 0, 'C');
        createSlot('wall', 0, 1, 'D');
        createSlot('wall', 0, 2, 'E');
        
        // 2 slots inne
        createSlot('inside', -60, -1.5, 'A'); createSlot('inside', -60, 1.5, 'B');
    }
}

function setupEventListeners() {
    document.getElementById('btn-buy-peasant').addEventListener('click', () => buyUnit('peasant'));
    document.getElementById('btn-buy-archer').addEventListener('click', () => buyUnit('archer'));
    document.getElementById('btn-buy-knight').addEventListener('click', () => buyUnit('knight'));
    document.getElementById('btn-upgrade-wall').addEventListener('click', upgradeWall);
    document.getElementById('btn-start-wave').addEventListener('click', startNextWave);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); deselectUnit(); });
}

function addGateControl() {
    const panel = document.querySelector('.control-group:nth-child(3)');
    if (panel && !document.getElementById('btn-toggle-gate')) {
        const btn = document.createElement('button'); btn.id = 'btn-toggle-gate'; btn.className = 'game-btn'; btn.innerText = "Åpne Porten"; btn.style.borderLeft = "5px solid #fff"; btn.onclick = toggleGate; panel.appendChild(btn);
    }
}

// === CONTROLS ===
function buyUnit(type) {
    const stats = GameConfig.units[type];
    if (gameState.money >= stats.cost) {
        gameState.money -= stats.cost;
        const spawnX = GameConfig.baseX + (Math.random() - 0.5) * 40;
        const spawnY = GameConfig.baseY + (Math.random() - 0.5) * 40;

        const newUnit = {
            id: Math.random().toString(36).substr(2, 9),
            type: type,
            x: spawnX, y: spawnY,
            state: 'IDLE', targetSlot: null,
            hp: 100, stats: stats,
            cooldownTimer: 0,
            spriteId: stats.spriteId,
            animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true
        };
        gameState.units.push(newUnit);
        selectUnit(newUnit);
        updateUI();
        uiMessage.innerText = `${stats.name} klar!`;
    } else { uiMessage.innerText = "Mangler penger."; }
}

function selectUnit(unit) { gameState.selectedUnit = unit; uiMessage.innerText = `Valgt: ${unit.stats.name}`; }
function deselectUnit() { gameState.selectedUnit = null; uiMessage.innerText = "Ingen enhet valgt."; }

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let clickedUnit = null; let clickedSlot = null;
    gameState.units.forEach(u => { if(Math.sqrt((u.x-mouseX)**2+(u.y-mouseY)**2) < 15) clickedUnit = u; });
    gameState.slots.forEach(s => { if(Math.sqrt((s.x-mouseX)**2+(s.y-mouseY)**2) < 8) clickedSlot = s; }); // Mindre klikke-radius på slots siden de er tette

    if (gameState.selectedUnit && clickedSlot) { moveUnitToSlot(gameState.selectedUnit, clickedSlot); return; }
    if (clickedUnit) { selectUnit(clickedUnit); return; }
    if (!clickedUnit && !clickedSlot) { deselectUnit(); }
}

function moveUnitToSlot(unit, slot) {
    if (slot.occupied && slot.unit !== unit) { uiMessage.innerText = "Opptatt!"; return; }
    if (unit.stats.type === 'melee' && slot.type === 'wall') { uiMessage.innerText = "Kan ikke stå på mur!"; return; }
    if (unit.targetSlot) { unit.targetSlot.occupied = false; unit.targetSlot.unit = null; }
    slot.occupied = true; slot.unit = unit;
    unit.targetSlot = slot; unit.state = 'MOVING';
    uiMessage.innerText = `${unit.stats.name} flytter seg.`;
}

function toggleGate() {
    gameState.isGateOpen = !gameState.isGateOpen;
    const btn = document.getElementById('btn-toggle-gate');
    if(btn) { btn.innerText = gameState.isGateOpen ? "Lukk Porten" : "Åpne Porten"; btn.style.backgroundColor = gameState.isGateOpen ? "#e74c3c" : "#95a5a6"; }
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    if (!gameState.lastTime) { gameState.lastTime = timestamp; requestAnimationFrame(gameLoop); return; }
    const dt = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;
    if (!gameState.isPaused) { update(dt); draw(); }
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (gameState.gameActive && gameState.enemiesToSpawn > 0) {
        gameState.spawnTimer -= dt;
        if (gameState.spawnTimer <= 0) {
            spawnEnemy();
            gameState.spawnTimer = GameConfig.enemySpawnInterval / 1000;
            gameState.enemiesToSpawn--;
        }
    }

    gameState.units.forEach(unit => updateUnit(unit, dt));
    for (let i = gameState.enemies.length - 1; i >= 0; i--) { updateEnemy(gameState.enemies[i], dt, i); }
    
    // NYTT: Oppdater prosjektiler og effekter
    updateProjectiles(dt);
    updateEffects(dt);

    if (gameState.gameActive && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0) endWave();
    if (gameState.baseHealth <= 0) { gameState.isPaused = true; uiMessage.innerText = "GAME OVER!"; }
}

// === NY LOGIKK FOR PROSJEKTILER ===
function spawnProjectile(source, target, damage, type) {
    gameState.projectiles.push({
        x: source.x,
        y: source.y,
        target: target, // Vi lagrer referansen til målet for "homing" (enklest) eller lastKnownPos
        speed: type === 'arrow' ? 200 : 0,
        damage: damage,
        type: type,
        active: true
    });
}

function updateProjectiles(dt) {
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        const p = gameState.projectiles[i];
        if (!p.active) { gameState.projectiles.splice(i, 1); continue; }

        if (p.type === 'arrow') {
            // Hvis målet er dødt, fjern pilen (eller la den fly til siste posisjon, men dette er enklest)
            if (p.target.hp <= 0) { p.active = false; continue; }

            const dx = p.target.x - p.x;
            const dy = p.target.y - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 10) {
                // Treff!
                p.target.hp -= p.damage;
                p.active = false;
            } else {
                // Flytt pilen
                p.x += (dx / dist) * p.speed * dt;
                p.y += (dy / dist) * p.speed * dt;
                p.angle = Math.atan2(dy, dx); // For tegning
            }
        }
    }
}

function spawnEffect(x, y, type) {
    gameState.effects.push({ x: x, y: y, type: type, life: 0.2 }); // Lever i 0.2 sekunder
}

function updateEffects(dt) {
    for (let i = gameState.effects.length - 1; i >= 0; i--) {
        const e = gameState.effects[i];
        e.life -= dt;
        if (e.life <= 0) gameState.effects.splice(i, 1);
    }
}


// === LOGIKK: VÅRE SOLDATER ===
function updateUnit(unit, dt) {
    if (unit.cooldownTimer > 0) unit.cooldownTimer -= dt;

    let isMoving = false;
    if (unit.state === 'MOVING' && unit.targetSlot) {
        const dx = unit.targetSlot.x - unit.x;
        const dy = unit.targetSlot.y - unit.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const moveStep = unit.stats.speed * dt;

        if (dist > 5) {
            unit.x += (dx / dist) * moveStep;
            unit.y += (dy / dist) * moveStep;
            unit.facingRight = dx > 0;
            isMoving = true;
        } else {
            unit.x = unit.targetSlot.x; unit.y = unit.targetSlot.y;
            unit.state = 'STATIONED';
        }
    }

    const isAttacking = handleUnitCombat(unit);
    updateAnimationState(unit, isMoving, isAttacking, dt);
}

function handleUnitCombat(unit) {
    let closestEnemy = null;
    let minDistance = Infinity;

    gameState.enemies.forEach(enemy => {
        const d = Math.sqrt((enemy.x - unit.x)**2 + (enemy.y - unit.y)**2);
        if (d < minDistance) { minDistance = d; closestEnemy = enemy; }
    });

    if (closestEnemy && minDistance <= unit.stats.range) {
        unit.facingRight = (closestEnemy.x - unit.x) > 0;
        
        if (unit.cooldownTimer <= 0) {
            unit.cooldownTimer = unit.stats.cooldown;
            
            if (unit.stats.type === 'ranged') {
                // Spawn Pil
                spawnProjectile(unit, closestEnemy, unit.stats.damage, 'arrow');
            } else {
                // Melee: Direkte skade + Visuell effekt
                closestEnemy.hp -= unit.stats.damage;
                // Legg til "Slash" effekt midt mellom soldat og fiende
                const midX = (unit.x + closestEnemy.x) / 2;
                const midY = (unit.y + closestEnemy.y) / 2;
                spawnEffect(midX, midY, 'slash');
            }
            return true; // Trigget angrep
        }
    }
    return false;
}

function updateAnimationState(entity, isMoving, isAttacking, dt) {
    if (isAttacking) {
        entity.animState = 'attack';
        entity.animFrame = 0;
    } else if (entity.animState === 'attack') {
        const def = Assets.definitions[entity.spriteId];
        const frames = def.anims.attack;
        if (entity.animFrame >= frames.length - 1) {
             entity.animState = isMoving ? 'walk' : 'idle';
        }
    } else {
        entity.animState = isMoving ? 'walk' : 'idle';
    }

    const def = Assets.definitions[entity.spriteId];
    entity.animTimer += dt;
    if (entity.animTimer >= (1 / def.fps)) {
        entity.animTimer = 0;
        const frames = def.anims[entity.animState];
        entity.animFrame = (entity.animFrame + 1) % frames.length;
    }
}

// === LOGIKK: FIENDER ===
function updateEnemy(enemy, dt, index) {
    if (enemy.hp <= 0) {
        gameState.enemies.splice(index, 1); gameState.money += 15; updateUI(); return;
    }
    const action = handleEnemyLogic(enemy, dt);
    updateAnimationState(enemy, action === 'MOVING', action === 'ATTACKING', dt);
}

function handleEnemyLogic(enemy, dt) {
    const dx = GameConfig.baseX - enemy.x;
    const dy = GameConfig.baseY - enemy.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    enemy.facingRight = dx > 0;

    for (let w of gameState.walls) {
        if (!w.isBroken) {
            if (w.isGate && gameState.isGateOpen) continue;
            const wDist = Math.sqrt((w.x - enemy.x)**2 + (w.y - enemy.y)**2);
            if (wDist < (w.radius + enemy.radius)) {
                enemy.attackTimer -= dt;
                if (enemy.attackTimer <= 0) {
                    w.hp -= enemy.damage;
                    enemy.attackTimer = 1.0;
                    if (w.hp <= 0) { w.hp = 0; w.isBroken = true; }
                    spawnEffect(enemy.x + (w.x-enemy.x)*0.5, enemy.y + (w.y-enemy.y)*0.5, 'slash'); // Fiende slash
                    return 'ATTACKING';
                }
                return 'ATTACKING';
            }
        }
    }

    if (dist > 30) {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
        return 'MOVING';
    } else {
        gameState.baseHealth -= (enemy.damage * dt);
        updateUI();
        return 'ATTACKING';
    }
}

// === BØLGE SYSTEM ===
function startNextWave() {
    if (gameState.enemiesToSpawn > 0 || gameState.enemies.length > 0) return;
    gameState.gameActive = true;
    gameState.enemiesToSpawn = 5 + (gameState.wave * 3);
    uiMessage.innerText = `Bølge ${gameState.wave} starter!`;
}
function upgradeWall() {
    if(gameState.money >= 150) { gameState.money-=150; gameState.walls.forEach(w=>{if(!w.isBroken) w.hp=Math.min(w.hp+50, w.maxHp)}); updateUI(); }
}
function togglePause() { gameState.isPaused = !gameState.isPaused; }
function endWave() { gameState.gameActive = false; gameState.wave++; gameState.money += 150; updateUI(); uiMessage.innerText = "Bølge over!"; }
function updateUI() { uiWave.innerText = gameState.wave; uiGold.innerText = gameState.money; uiBaseHp.innerText = Math.floor(gameState.baseHealth) + "%"; }

function spawnEnemy() {
    const isBoss = (gameState.wave % 4 === 0) && (gameState.enemiesToSpawn === 1);
    const spawnX = Math.random() * (canvas.width - 200) + 100;
    gameState.enemies.push({
        x: spawnX, y: -20,
        speed: isBoss ? 20 : GameConfig.baseEnemySpeed + (gameState.wave * 2),
        hp: isBoss ? 600 : 30 + (gameState.wave * 10),
        maxHp: isBoss ? 600 : 30 + (gameState.wave * 10),
        damage: isBoss ? 50 : 10,
        radius: isBoss ? 20 : 10,
        attackTimer: 0,
        spriteId: isBoss ? 'boss' : 'enemy',
        animState: 'walk', animFrame: 0, animTimer: 0, facingRight: false
    });
}

// === TEGNING ===
function draw() {
    ctx.fillStyle = "#27ae60"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#8e44ad"; ctx.beginPath(); ctx.arc(GameConfig.baseX, GameConfig.baseY, 25, 0, Math.PI*2); ctx.fill();

    // Murer
    gameState.walls.forEach(wall => {
        ctx.save(); ctx.translate(wall.x, wall.y); ctx.rotate(wall.angle + Math.PI/2);
        ctx.fillStyle = "#8d6e63"; ctx.fillRect(-10, 20, 20, 30);
        if (!wall.isBroken) {
            ctx.fillStyle = (wall.isGate && gameState.isGateOpen) ? "#34495e" : (wall.isGate ? "#5d4037" : "#7f8c8d");
            if (wall.isGate && gameState.isGateOpen) { ctx.strokeStyle = "#5d4037"; ctx.lineWidth=2; ctx.strokeRect(-wall.width/2, -wall.height/2, wall.width, wall.height); }
            else { 
                ctx.fillRect(-wall.width/2, -wall.height/2, wall.width, wall.height); 
                ctx.strokeRect(-wall.width/2, -wall.height/2, wall.width, wall.height);
                const hpP = wall.hp/wall.maxHp; ctx.fillStyle="#00ff00"; ctx.fillRect(-wall.width/2, -5, wall.width*hpP, 5);
            }
        } else { ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillText("X", 0, 0); }
        ctx.restore();
    });

    // Slots
    gameState.slots.forEach(slot => {
        const show = (gameState.selectedUnit && gameState.selectedUnit.state!=='MOVING') || slot.unit;
        if(show) {
            ctx.beginPath(); ctx.arc(slot.x, slot.y, 4, 0, Math.PI*2); // Mindre sirkler
            if(!slot.unit && gameState.selectedUnit) {
                 const illegal = (gameState.selectedUnit.stats.type==='melee' && slot.type==='wall');
                 ctx.fillStyle = illegal ? "rgba(255,0,0,0.3)" : "rgba(255,255,255,0.4)";
                 ctx.fill(); ctx.strokeStyle="#fff"; ctx.stroke();
            }
        }
    });

    gameState.units.forEach(u => drawSprite(u));
    gameState.enemies.forEach(e => drawSprite(e));

    // NYTT: Tegn prosjektiler
    gameState.projectiles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = "#fff";
        // Enkel pil: En strek med en klump
        ctx.fillRect(-5, -1, 10, 2); // Skaft
        ctx.fillStyle = "#aaa";
        ctx.fillRect(2, -2, 3, 4);   // Spiss
        ctx.restore();
    });

    // NYTT: Tegn effekter (Slash)
    gameState.effects.forEach(e => {
        if (e.type === 'slash') {
            ctx.strokeStyle = "rgba(255, 255, 255, " + (e.life * 5) + ")"; // Fader ut
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(e.x, e.y, 15, 0, Math.PI*2); // Enkel sirkel-slash
            ctx.stroke();
        }
    });
}

function drawSprite(entity) {
    const def = Assets.definitions[entity.spriteId];
    const img = Assets.sprites[entity.spriteId];
    if (!img || !def) return;

    const frameIndices = def.anims[entity.animState];
    const safeFrameIndex = entity.animFrame < frameIndices.length ? frameIndices[entity.animFrame] : frameIndices[0];
    const sx = safeFrameIndex * def.w;

    ctx.save();
    ctx.translate(entity.x, entity.y);
    if (!entity.facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 10, 8, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.drawImage(img, sx, 0, def.w, def.h, -def.w/2, -def.h/2, def.w, def.h);
    if (GameConfig.debugMode) { ctx.strokeStyle = "red"; ctx.strokeRect(-def.w/2, -def.h/2, def.w, def.h); }
    ctx.restore();

    if (entity.hp < (entity.maxHp || 100) || entity === gameState.selectedUnit) {
        const max = entity.maxHp || 100;
        const hpP = entity.hp / max;
        ctx.fillStyle = "red"; ctx.fillRect(entity.x-10, entity.y-20, 20, 4);
        ctx.fillStyle = "#00ff00"; ctx.fillRect(entity.x-10, entity.y-20, 20*hpP, 4);
    }
    
    if (gameState.selectedUnit === entity) {
        ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(entity.x, entity.y, 15, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(entity.x, entity.y, entity.stats.range, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
    }
}

window.onload = init;
/* Version: #13 */
