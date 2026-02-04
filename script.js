/* Version: #12 - Robust Animation & Logic Restore */

// === KONFIGURASJON ===
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    debugMode: false, // Sett til true for å se kollisjonsbokser
    
    // Base
    baseX: 500,
    baseY: 550,
    wallRadius: 220,
    wallSegments: 7,
    gateIndex: 3,

    // Fiender
    enemySpawnInterval: 1000,
    baseEnemySpeed: 30,

    // Enheter
    units: {
        peasant: { 
            name: "Fotsoldat", cost: 50, damage: 10, range: 120, cooldown: 1.0, 
            type: 'melee', speed: 60, spriteId: 'peasant', color: "#d35400"
        },
        archer:  { 
            name: "Bueskytter", cost: 100, damage: 15, range: 300, cooldown: 1.5, 
            type: 'ranged', speed: 70, spriteId: 'archer', color: "#27ae60"
        },
        knight:  { 
            name: "Ridder", cost: 200, damage: 40, range: 120, cooldown: 0.8, 
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

    selectedUnit: null,
    isGateOpen: false
};

// === DOM & CANVAS ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // Pixel-art look

const uiWave = document.getElementById('wave-display');
const uiGold = document.getElementById('gold-display');
const uiBaseHp = document.getElementById('base-hp-display');
const uiMessage = document.getElementById('status-message');

// === INITIALISERING ===
function init() {
    console.log("Initialiserer Castle Defense v12...");
    
    // 1. Generer grafikk (Sprites)
    generatePlaceholderSprites();
    
    // 2. Bygg verden
    createLevelGeometry();
    
    // 3. Setup input
    setupEventListeners();
    addGateControl();
    
    // 4. Start loop
    requestAnimationFrame(gameLoop);
}

// === GENERERING AV GRAFIKK ===
function generatePlaceholderSprites() {
    const createSheet = (id, color, size, isBoss = false) => {
        const c = document.createElement('canvas');
        c.width = size * 8; c.height = size;
        const x = c.getContext('2d');
        
        // Helper for drawing body parts
        const drawFrame = (idx, legOff, armAttack) => {
            const ox = idx * size; const cx = ox + size/2; const cy = size/2;
            x.fillStyle = color; x.strokeStyle = color; x.lineWidth = isBoss ? 4 : 2;
            
            // Hode
            x.beginPath(); x.arc(cx, cy - (size*0.25), size*0.15, 0, Math.PI*2); x.fill();
            // Kropp
            x.beginPath(); x.moveTo(cx, cy - (size*0.1)); x.lineTo(cx, cy + (size*0.2)); x.stroke();
            // Ben
            x.beginPath(); x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx - (size*0.1) + legOff, cy + (size*0.45));
            x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx + (size*0.1) - legOff, cy + (size*0.45)); x.stroke();
            // Armer
            x.beginPath();
            if (armAttack) {
                x.moveTo(cx, cy); x.lineTo(cx + (size*0.35), cy); // Attack pose
            } else {
                x.moveTo(cx, cy); x.lineTo(cx - (size*0.15), cy + (size*0.15) - legOff);
                x.moveTo(cx, cy); x.lineTo(cx + (size*0.15), cy + (size*0.15) + legOff);
            }
            x.stroke();
            
            // Våpen (Enkel strek)
            if (id === 'archer') {
                x.strokeStyle = "brown";
                x.beginPath(); x.arc(cx + (armAttack?10:5), cy, 8, -1, 1); x.stroke(); // Bue
            }
        };

        // Tegn frames: 0=Idle, 1-4=Walk, 5-6=Attack
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

// === GEOMETRI ===
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
            const finalX = bx + (offsetSide * 15) * Math.cos(sideAngle);
            const finalY = by + (offsetSide * 15) * Math.sin(sideAngle);
            gameState.slots.push({ id: `slot-${type}-${i}-${label}`, type: type, parentWallId: wallSegment.id, x: finalX, y: finalY, occupied: false, unit: null });
        };
        createSlot('outside', 60, -1, 'A'); createSlot('outside', 60, 1, 'B');
        createSlot('wall', 0, -1, 'A'); createSlot('wall', 0, 1, 'B');
        createSlot('inside', -60, -1, 'A'); createSlot('inside', -60, 1, 'B');
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

// === UNIT CONTROLS ===
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
    gameState.slots.forEach(s => { if(Math.sqrt((s.x-mouseX)**2+(s.y-mouseY)**2) < 12) clickedSlot = s; });

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

    if (gameState.gameActive && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0) endWave();
    if (gameState.baseHealth <= 0) { gameState.isPaused = true; uiMessage.innerText = "GAME OVER!"; }
}

// === LOGIKK: VÅRE SOLDATER ===
function updateUnit(unit, dt) {
    if (unit.cooldownTimer > 0) unit.cooldownTimer -= dt;

    // 1. Bevegelse
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

    // 2. Kamp (Skilt ut for oversikt)
    const isAttacking = handleUnitCombat(unit);

    // 3. Animasjonsoppdatering
    updateAnimationState(unit, isMoving, isAttacking, dt);
}

function handleUnitCombat(unit) {
    let closestEnemy = null;
    let minDistance = Infinity;

    // Finn nærmeste fiende
    gameState.enemies.forEach(enemy => {
        const d = Math.sqrt((enemy.x - unit.x)**2 + (enemy.y - unit.y)**2);
        if (d < minDistance) { minDistance = d; closestEnemy = enemy; }
    });

    // Angrip hvis innenfor rekkevidde
    if (closestEnemy && minDistance <= unit.stats.range) {
        unit.facingRight = (closestEnemy.x - unit.x) > 0; // Snu mot fienden
        
        if (unit.cooldownTimer <= 0) {
            closestEnemy.hp -= unit.stats.damage;
            unit.cooldownTimer = unit.stats.cooldown;
            // Returner true for å trigge animasjon
            return true;
        }
    }
    return false;
}

function updateAnimationState(entity, isMoving, isAttacking, dt) {
    // Bestem state
    if (isAttacking) {
        entity.animState = 'attack';
        entity.animFrame = 0; // Start slaget
    } else if (entity.animState === 'attack') {
        // La angrepet spille ferdig før vi bytter tilbake
        const def = Assets.definitions[entity.spriteId];
        const frames = def.anims.attack;
        if (entity.animFrame >= frames.length - 1) {
             entity.animState = isMoving ? 'walk' : 'idle';
        }
    } else {
        entity.animState = isMoving ? 'walk' : 'idle';
    }

    // Timer for frames
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

    // Logikk for bevegelse og angrep
    const action = handleEnemyLogic(enemy, dt);
    
    // Oppdater animasjon
    updateAnimationState(enemy, action === 'MOVING', action === 'ATTACKING', dt);
}

function handleEnemyLogic(enemy, dt) {
    const dx = GameConfig.baseX - enemy.x;
    const dy = GameConfig.baseY - enemy.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    enemy.facingRight = dx > 0;

    // Sjekk murer
    for (let w of gameState.walls) {
        if (!w.isBroken) {
            if (w.isGate && gameState.isGateOpen) continue; // Ignorer åpen port
            const wDist = Math.sqrt((w.x - enemy.x)**2 + (w.y - enemy.y)**2);
            if (wDist < (w.radius + enemy.radius)) {
                // Angrip mur
                enemy.attackTimer -= dt;
                if (enemy.attackTimer <= 0) {
                    w.hp -= enemy.damage;
                    enemy.attackTimer = 1.0;
                    if (w.hp <= 0) { w.hp = 0; w.isBroken = true; }
                    return 'ATTACKING'; // Trigget slag
                }
                return 'ATTACKING'; // Venter på cooldown
            }
        }
    }

    // Bevegelse mot base
    if (dist > 30) {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * dt;
        return 'MOVING';
    } else {
        // Angrip base
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
    // Bakgrunn
    ctx.fillStyle = "#27ae60"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Base
    ctx.fillStyle = "#8e44ad"; ctx.beginPath(); ctx.arc(GameConfig.baseX, GameConfig.baseY, 25, 0, Math.PI*2); ctx.fill();

    // Murer
    gameState.walls.forEach(wall => {
        ctx.save(); ctx.translate(wall.x, wall.y); ctx.rotate(wall.angle + Math.PI/2);
        ctx.fillStyle = "#8d6e63"; ctx.fillRect(-10, 20, 20, 30); // Stige
        if (!wall.isBroken) {
            ctx.fillStyle = (wall.isGate && gameState.isGateOpen) ? "#34495e" : (wall.isGate ? "#5d4037" : "#7f8c8d");
            if (wall.isGate && gameState.isGateOpen) { ctx.strokeStyle = "#5d4037"; ctx.lineWidth=2; ctx.strokeRect(-wall.width/2, -wall.height/2, wall.width, wall.height); }
            else { 
                ctx.fillRect(-wall.width/2, -wall.height/2, wall.width, wall.height); 
                ctx.strokeRect(-wall.width/2, -wall.height/2, wall.width, wall.height);
                const hpP = wall.hp/wall.maxHp; ctx.fillStyle="#00ff00"; ctx.fillRect(-wall.width/2, -5, wall.width*hpP, 5);
            }
