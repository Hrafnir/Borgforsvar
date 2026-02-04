/* Version: #11 - Animation Engine Integration */

// === KONFIGURASJON ===
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    debugMode: false, // Skrudd av debug for renere konsoll
    
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
        peasant: { name: "Fotsoldat", cost: 50, damage: 10, range: 120, cooldown: 1.0, type: 'melee', speed: 60, spriteId: 'peasant' },
        archer:  { name: "Bueskytter", cost: 100, damage: 15, range: 300, cooldown: 1.5, type: 'ranged', speed: 70, spriteId: 'archer' },
        knight:  { name: "Ridder", cost: 200, damage: 40, range: 120, cooldown: 0.8, type: 'melee', speed: 50, spriteId: 'knight' }
    }
};

// === ASSET SYSTEM (ANIMASJONER) ===
// Dette erstatter de fargede sirklene med spritesheets
const Assets = {
    sprites: {}, // Her lagres bildene vi genererer
    definitions: {
        // Definerer hvordan animasjonene ser ut (størrelse, antall frames, hastighet)
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
// Slå på pixel-art rendering for skarpere sprites
ctx.imageSmoothingEnabled = false;

const uiWave = document.getElementById('wave-display');
const uiGold = document.getElementById('gold-display');
const uiBaseHp = document.getElementById('base-hp-display');
const uiMessage = document.getElementById('status-message');

// === INITIALISERING ===
function init() {
    console.log("Initialiserer Castle Defense v11 med Animasjon...");
    
    // 1. Generer grafikk (Siden vi ikke laster filer eksternt ennå)
    generatePlaceholderSprites();
    
    // 2. Bygg verden
    createLevelGeometry();
    
    // 3. Setup input
    setupEventListeners();
    addGateControl();
    
    // 4. Start loop
    requestAnimationFrame(gameLoop);
}

// === GENERERING AV GRAFIKK (Placeholder Spritesheets) ===
function generatePlaceholderSprites() {
    // Hjelpefunksjon for å tegne en spritesheet på et canvas i minnet
    const createSheet = (id, color, size, isBoss = false) => {
        const c = document.createElement('canvas');
        c.width = size * 8; // Plass til 8 frames
        c.height = size;
        const x = c.getContext('2d');
        
        // Frame 0: Idle (Står stille)
        drawStickman(x, 0, size, color, 0, false, isBoss);
        
        // Frame 1-4: Walk (Går)
        drawStickman(x, 1, size, color, -5, false, isBoss);
        drawStickman(x, 2, size, color, 0, false, isBoss);
        drawStickman(x, 3, size, color, 5, false, isBoss);
        drawStickman(x, 4, size, color, 0, false, isBoss);

        // Frame 5-6: Attack (Slår/Skyter)
        drawStickman(x, 5, size, color, 10, true, isBoss); // Arm frem
        drawStickman(x, 6, size, color, 5, true, isBoss);  // Arm tilbake

        // Lagre bildet
        const img = new Image();
        img.src = c.toDataURL();
        Assets.sprites[id] = img;
    };

    // Tegnefunksjon for en enkel figur
    const drawStickman = (ctx, frameIdx, s, color, legOffset, attack, isBoss) => {
        const ox = frameIdx * s; // Offset X
        const cx = ox + s/2;     // Center X
        const cy = s/2;          // Center Y
        
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = isBoss ? 4 : 2;

        // Hode
        ctx.beginPath();
        ctx.arc(cx, cy - (s*0.25), s*0.15, 0, Math.PI*2);
        ctx.fill();

        // Kropp
        ctx.beginPath();
        ctx.moveTo(cx, cy - (s*0.1));
        ctx.lineTo(cx, cy + (s*0.2));
        ctx.stroke();

        // Ben (Animerte)
        ctx.beginPath();
        ctx.moveTo(cx, cy + (s*0.2));
        ctx.lineTo(cx - (s*0.1) + legOffset, cy + (s*0.45)); // Venstre ben
        ctx.moveTo(cx, cy + (s*0.2));
        ctx.lineTo(cx + (s*0.1) - legOffset, cy + (s*0.45)); // Høyre ben
        ctx.stroke();

        // Armer (Animerte)
        ctx.beginPath();
        // Hvis angrep: Arm rett frem. Ellers: Hengende ned.
        if (attack) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (s*0.3), cy); // Slag!
        } else {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx - (s*0.15), cy + (s*0.15) - legOffset);
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (s*0.15), cy + (s*0.15) + legOffset);
        }
        ctx.stroke();
    };

    // Lag assets basert på GameConfig farger
    createSheet('peasant', GameConfig.units.peasant.color, 32);
    createSheet('archer', GameConfig.units.archer.color, 32);
    createSheet('knight', GameConfig.units.knight.color, 32);
    createSheet('enemy', '#c0392b', 32);
    createSheet('boss', '#800000', 48, true);
}

// === GEOMETRI & SETUP (Lik v10) ===
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

// === SPILL-LOGIKK ===

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
            state: 'IDLE', // IDLE, MOVING, ATTACKING
            targetSlot: null,
            targetX: spawnX, targetY: spawnY,
            hp: 100, stats: stats,
            cooldownTimer: 0,
            
            // ANIMASJONS-DATA (Nytt i v11)
            spriteId: stats.spriteId,
            animState: 'idle', // 'idle', 'walk', 'attack'
            animFrame: 0,
            animTimer: 0,
            facingRight: true // For å speilvende spriten
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

function gameLoop(timestamp) {
    if (!gameState.lastTime) { gameState.lastTime = timestamp; requestAnimationFrame(gameLoop); return; }
    const dt = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;
    if (!gameState.isPaused) { update(dt); draw(); }
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Spawne fiender
    if (gameState.gameActive && gameState.enemiesToSpawn > 0) {
        gameState.spawnTimer -= dt;
        if (gameState.spawnTimer <= 0) {
            spawnEnemy();
            gameState.spawnTimer = GameConfig.enemySpawnInterval / 1000;
            gameState.enemiesToSpawn--;
        }
    }

    // Oppdater enheter
    gameState.units.forEach(unit => updateUnit(unit, dt));

    // Oppdater fiender
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        updateEnemy(gameState.enemies[i], dt, i);
    }

    // Sjekk status
    if (gameState.gameActive && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0) endWave();
    if (gameState.baseHealth <= 0) { gameState.isPaused = true; uiMessage.innerText = "GAME OVER!"; }
}

// === UNIT UPDATE MED ANIMASJON ===
function updateUnit(unit, dt) {
    if (unit.cooldownTimer > 0) unit.cooldownTimer -= dt;

    let isMoving = false;
    let isAttacking = false;

    // BEVEGELSE
    if (unit.state === 'MOVING' && unit.targetSlot) {
        const dx = unit.targetSlot.x - unit.x;
        const dy = unit.targetSlot.y - unit.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const moveStep = unit.stats.speed * dt;

        if (dist > 5) {
            unit.x += (dx / dist) * moveStep;
            unit.y += (dy / dist) * moveStep;
            isMoving = true;
            unit.facingRight = dx > 0; // Snu figuren
        } else {
            unit.x = unit.targetSlot.x; unit.y = unit.targetSlot.y;
            unit.state = 'STATIONED';
        }
    }

    // KAMP
    let closestEnemy = null;
    let minDistance = Infinity;
    gameState.enemies.forEach(enemy => {
        const d = Math.sqrt((enemy.x - unit.x)**2 + (enemy.y - unit.y)**2);
        if (d < minDistance) { minDistance = d; closestEnemy = enemy; }
    });

    if (closestEnemy && minDistance <= unit.stats.range) {
        // Snu mot fienden
        unit.facingRight = (closestEnemy.x - unit.x) > 0;
        
        if (unit.cooldownTimer <= 0) {
            closestEnemy.hp -= unit.stats.damage;
            unit.cooldownTimer = unit.stats.cooldown;
            // Trigger angreps-animasjon
            isAttacking = true;
            unit.animState = 'attack'; 
            unit.animFrame = 0; // Reset frame for å starte slaget
        }
    }

    // ANIMASJONSKONTROLLER
    // Hvis vi ikke angriper (angrep overstyrer alt), sjekk bevegelse
    if (!isAttacking && unit.cooldownTimer > (unit.stats.cooldown - 0.3)) {
         // Liten hack: Hvis cooldown nettopp startet, er vi i "attack" modus litt til
         unit.animState = 'attack';
    } else if (isMoving) {
        unit.animState = 'walk';
    } else if (unit.animState !== 'attack') {
        unit.animState = 'idle';
    }

    // Oppdater frame timer
    const def = Assets.definitions[unit.spriteId];
    unit.animTimer += dt;
    if (unit.animTimer >= (1 / def.fps)) {
        unit.animTimer = 0;
        const frames = def.anims[unit.animState];
        // Hvis vi angriper, ikke loop uendelig hvis vi er ferdige
        if (unit.animState === 'attack' && unit.animFrame === frames.length - 1) {
            // Ferdig med slag
        } else {
            unit.animFrame = (unit.animFrame + 1) % frames.length;
        }
    }
}

function updateEnemy(enemy, dt, index) {
    if (enemy.hp <= 0) {
        gameState.enemies.splice(index, 1); gameState.money += 15; updateUI(); return;
    }

    // Animasjon
    enemy.animTimer += dt;
    const def = Assets.definitions[enemy.spriteId];
    if (enemy.animTimer >= (1/def.fps)) {
        enemy.animTimer = 0;
        const frames = def.anims[enemy.animState];
        enemy.animFrame = (enemy.animFrame + 1) % frames.length;
    }

    const dx = GameConfig.baseX - enemy.x;
    const dy = GameConfig.baseY - enemy.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Snu fiende mot målet
    enemy.facingRight = dx > 0;

    let canMove = true;
    for (let w of gameState.walls) {
        if (!w.isBroken) {
            if (w.isGate && gameState.isGateOpen) continue;
            const wDist = Math.sqrt((w.x - enemy.x)**2 + (w.y - enemy.y)**2);
            if (wDist < (w.radius + enemy.radius)) {
                canMove = false;
                enemy.animState = 'attack';
                enemy.attackTimer -= dt;
                if (enemy.attackTimer <= 0) {
                    w.hp -= enemy.damage;
                    enemy.attackTimer = 1.0;
                    if (w.hp <= 0) { w.hp = 0; w.isBroken = true; }
                }
                break;
            }
        }
    }

    if (canMove) {
        enemy.animState = 'walk';
        if (dist > 30) {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
        } else {
            enemy.animState = 'attack'; // Slår på kongen
            gameState.baseHealth -= (enemy.damage * dt);
            updateUI();
        }
    }
}

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
        // Animasjon
        spriteId: isBoss ? 'boss' : 'enemy',
        animState: 'walk',
        animFrame: 0,
        animTimer: 0,
        facingRight: false // Fiender går vanligvis ned/venstre/høyre, men starter ofte mot venstre
    });
}

// === TEGNING MED SPRITES ===
function draw() {
    // Bakgrunn
    ctx.fillStyle = "#27ae60"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Basen
    ctx.fillStyle = "#8e44ad"; ctx.beginPath(); ctx.arc(GameConfig.baseX, GameConfig.baseY, 25, 0, Math.PI*2); ctx.fill();

    // Murer (Beholder enkel tegning for murer foreløpig, fokus på enheter)
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
        } else { ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillText("X", 0, 0); }
        ctx.restore();
    });

    // Slots
    gameState.slots.forEach(slot => {
        const show = (gameState.selectedUnit && gameState.selectedUnit.state!=='MOVING') || slot.unit;
        if(show) {
            ctx.beginPath(); ctx.arc(slot.x, slot.y, 6, 0, Math.PI*2);
            if(!slot.unit && gameState.selectedUnit) {
                 const illegal = (gameState.selectedUnit.stats.type==='melee' && slot.type==='wall');
                 ctx.fillStyle = illegal ? "rgba(255,0,0,0.3)" : "rgba(255,255,255,0.4)";
                 ctx.fill(); ctx.strokeStyle="#fff"; ctx.stroke();
            }
        }
    });

    // === TEGNE ENHETER (NYTT) ===
    gameState.units.forEach(u => drawSprite(u));
    gameState.enemies.forEach(e => drawSprite(e));
}

function drawSprite(entity) {
    const def = Assets.definitions[entity.spriteId];
    const img = Assets.sprites[entity.spriteId];
    
    if (!img || !def) return; // Fallback hvis noe mangler

    // Hvilken frame skal vi tegne?
    const frameIndices = def.anims[entity.animState];
    // Sikre at indeksen er gyldig
    const safeFrameIndex = entity.animFrame < frameIndices.length ? frameIndices[entity.animFrame] : frameIndices[0];
    
    const sx = safeFrameIndex * def.w; // Source X på spritesheet
    const sy = 0;                      // Source Y (vi har bare én rad foreløpig)
    
    ctx.save();
    ctx.translate(entity.x, entity.y);
    
    // Speilvending
    if (!entity.facingRight) {
        ctx.scale(-1, 1);
    }

    // Tegn skygge
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // Tegn Sprite (Sentrert)
    // Tegner bildet fra spritesheetet (sx, sy, w, h) til canvas (-w/2, -h/2, w, h)
    ctx.drawImage(img, sx, sy, def.w, def.h, -def.w/2, -def.h/2, def.w, def.h);
    
    ctx.restore();

    // Tegn HP Bar og Seleksjon (Ovenpå, ikke speilvendt)
    if (entity.hp < entity.maxHp || entity === gameState.selectedUnit) {
        const hpP = entity.hp / (entity.maxHp || entity.stats.hp || 100);
        ctx.fillStyle = "red"; ctx.fillRect(entity.x-10, entity.y-20, 20, 4);
        ctx.fillStyle = "#00ff00"; ctx.fillRect(entity.x-10, entity.y-20, 20*hpP, 4);
    }
    
    if (gameState.selectedUnit === entity) {
        ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(entity.x, entity.y, 15, 0, Math.PI*2); ctx.stroke();
        // Range indicator
        ctx.beginPath(); ctx.arc(entity.x, entity.y, entity.stats.range, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
    }
}

window.onload = init;

/* Version: #11 */
