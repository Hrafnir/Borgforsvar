/* Version: #22 - Wave System, Repair & Healing */

// === HJELPEFUNKSJONER ===
function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }
function randomRange(min, max) { return Math.random() * (max - min) + min; }

// === KONFIGURASJON ===
const GameConfig = {
    screenWidth: 1000,
    screenHeight: 600,
    worldWidth: 2000,
    worldHeight: 2000,
    tileSize: 32,
    debugMode: false,
    
    // Wave Settings
    firstWaveTime: 120, // 2 minutter (sekunder)
    waveInterval: 300   // 5 minutter
};

const ResourceTypes = {
    TREE: { type: 'wood', color: '#27ae60', name: 'Tre', capacity: 100, harvestTime: 1.0, icon: '🌲' },
    STONE: { type: 'stone', color: '#95a5a6', name: 'Stein', capacity: 200, harvestTime: 1.5, icon: '🪨' },
    IRON: { type: 'iron', color: '#2c3e50', name: 'Jern', capacity: 300, harvestTime: 2.0, icon: '⚔️' },
    BERRY: { type: 'food', color: '#e74c3c', name: 'Bærbusk', capacity: 50, harvestTime: 0.5, icon: '🍖' }
};

const Buildings = {
    PALISADE: { name: "Palisade", costType: 'wood', cost: 5, hp: 200, spriteId: 'spr_palisade', buildTime: 2.0 },
    WALL:     { name: "Steinmur", costType: 'stone', cost: 5, hp: 800, spriteId: 'spr_wall', buildTime: 4.0, req: 'MASON' },
    HOUSE:    { name: "Hus", costType: 'wood', cost: 20, hp: 100, spriteId: 'spr_house', buildTime: 5.0, popBonus: 5 },
    BOWYER:   { name: "Bueskytterverksted", costType: 'wood', cost: 50, hp: 200, spriteId: 'spr_bowyer', buildTime: 8.0, tech: 'BOWYER' },
    MASON:    { name: "Steinhuggeri", costType: 'wood', cost: 50, hp: 200, spriteId: 'spr_mason', buildTime: 8.0, tech: 'MASON' }
};

const UnitTypes = {
    peasant: { name: "Fotsoldat", cost: { food: 50 }, damage: 5, range: 120, cooldown: 1.0, spriteId: 'peasant', speed: 60, maxHp: 100 },
    archer:  { name: "Bueskytter", cost: { food: 50, wood: 25 }, damage: 8, range: 300, cooldown: 1.5, spriteId: 'archer', speed: 70, req: 'BOWYER', maxHp: 80 },
    knight:  { name: "Ridder", cost: { food: 50, iron: 20 }, damage: 20, range: 120, cooldown: 0.8, spriteId: 'knight', speed: 50, maxHp: 200 }
};

// === ASSETS ===
const Assets = {
    sprites: {},
    definitions: {
        worker: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], work: [5,6] } },
        peasant: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        archer: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        knight: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        enemy: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } }
    }
};

// === SPILL-TILSTAND ===
let gameState = {
    resources: { food: 200, wood: 100, stone: 50, iron: 0 },
    population: { current: 0, max: 0 },
    camera: { x: 500, y: 500 },
    
    // Wave System
    wave: { number: 1, timer: GameConfig.firstWaveTime, active: false },
    
    worldObjects: [],
    workers: [],      
    soldiers: [],
    enemies: [],
    effects: [], // Visuelle effekter
    keep: null,       
    
    selectedEntity: null,
    keys: { w: false, a: false, s: false, d: false },
    buildMode: null, dragStart: null, mouseWorld: { x: 0, y: 0 },
    lastTime: 0
};

// === DOM ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
    res: { pop: document.getElementById('res-pop'), food: document.getElementById('res-food'), wood: document.getElementById('res-wood'), stone: document.getElementById('res-stone'), iron: document.getElementById('res-iron') },
    wave: { num: document.getElementById('wave-num'), timer: document.getElementById('wave-timer') },
    selection: document.getElementById('selection-info'),
    msg: document.getElementById('status-message'),
    btnCancel: document.getElementById('btn-cancel-action'),
    btns: {
        trainArcher: document.getElementById('btn-train-archer'),
        buildWall: document.getElementById('btn-build-wall')
    }
};

// === INITIALISERING ===
function init() {
    console.log("Initialiserer Combat Update (v22)...");
    generatePlaceholderSprites();
    createWorld();
    
    spawnWorker(gameState.keep.x + 50, gameState.keep.y + 50);
    spawnWorker(gameState.keep.x - 50, gameState.keep.y + 50);
    
    setupInput();
    updateUI();
    requestAnimationFrame(gameLoop);
}

// === GRAFIKK ===
function generatePlaceholderSprites() {
    const createSheet = (id, color, size, weapon) => {
        const c = document.createElement('canvas'); c.width = size * 8; c.height = size;
        const x = c.getContext('2d');
        const drawFrame = (idx, legOff, armAction) => {
            const ox = idx * size; const cx = ox + size/2; const cy = size/2;
            x.fillStyle = color; x.strokeStyle = color; x.lineWidth = 2;
            x.beginPath(); x.arc(cx, cy - (size*0.25), size*0.15, 0, Math.PI*2); x.fill();
            x.beginPath(); x.moveTo(cx, cy - (size*0.1)); x.lineTo(cx, cy + (size*0.2)); x.stroke();
            x.beginPath(); x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx - (size*0.1) + legOff, cy + (size*0.45));
            x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx + (size*0.1) - legOff, cy + (size*0.45)); x.stroke();
            x.beginPath();
            if (armAction) { x.moveTo(cx, cy); x.lineTo(cx + (size*0.3), cy - (size*0.1)); x.moveTo(cx, cy); x.lineTo(cx + (size*0.3), cy + (size*0.1)); }
            else { x.moveTo(cx, cy); x.lineTo(cx - (size*0.15), cy + (size*0.15) - legOff); x.moveTo(cx, cy); x.lineTo(cx + (size*0.15), cy + (size*0.15) + legOff); }
            x.stroke();
            if(weapon === 'bow') { x.strokeStyle="brown"; x.beginPath(); x.arc(cx+5, cy, 8, -1, 1); x.stroke(); }
            if(weapon === 'sword') { x.strokeStyle="#ccc"; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx+10, cy-5); x.stroke(); }
        };
        drawFrame(0, 0, false); drawFrame(1, -5, false); drawFrame(2, 0, false); drawFrame(3, 5, false); drawFrame(4, 0, false); drawFrame(5, 0, true); drawFrame(6, 0, true);
        const img = new Image(); img.src = c.toDataURL(); Assets.sprites[id] = img;
    };
    createSheet('worker', '#f1c40f', 32, null);
    createSheet('peasant', '#d35400', 32, 'sword');
    createSheet('archer', '#27ae60', 32, 'bow');
    createSheet('knight', '#2980b9', 32, 'sword');
    createSheet('enemy', '#c0392b', 32, 'sword');

    const createTile = (id, drawFn) => {
        const c = document.createElement('canvas'); c.width = 32; c.height = 32;
        const x = c.getContext('2d'); drawFn(x);
        const img = new Image(); img.src = c.toDataURL(); Assets.sprites[id] = img;
    };
    createTile('spr_palisade', (x) => { x.fillStyle = "#5d4037"; for(let i=0;i<4;i++){x.fillRect(i*8,2,6,30);x.beginPath();x.moveTo(i*8,2);x.lineTo(i*8+3,0);x.lineTo(i*8+6,2);x.fill();} x.fillStyle = "rgba(0,0,0,0.3)"; x.fillRect(0,20,32,4); });
    createTile('spr_wall', (x) => { x.fillStyle = "#7f8c8d"; x.fillRect(0,0,32,32); x.strokeStyle="#555"; x.lineWidth=1; x.beginPath(); x.moveTo(0,10);x.lineTo(32,10);x.moveTo(0,20);x.lineTo(32,20);x.moveTo(10,0);x.lineTo(10,10);x.moveTo(20,10);x.lineTo(20,20);x.moveTo(10,20);x.lineTo(10,32);x.stroke(); });
    createTile('spr_house', (x) => { x.fillStyle = "#a1887f"; x.fillRect(4,12,24,20); x.fillStyle = "#5d4037"; x.beginPath(); x.moveTo(0,12); x.lineTo(16,0); x.lineTo(32,12); x.fill(); x.fillStyle = "#3e2723"; x.fillRect(12,22,8,10); });
    createTile('spr_bowyer', (x) => { x.fillStyle = "#e67e22"; x.fillRect(2,10,28,22); x.fillStyle = "#d35400"; x.beginPath(); x.moveTo(0,10); x.lineTo(16,0); x.lineTo(32,10); x.fill(); x.strokeStyle="#fff"; x.beginPath(); x.arc(16,20,6,-1,1); x.stroke(); });
    createTile('spr_mason', (x) => { x.fillStyle = "#95a5a6"; x.fillRect(2,10,28,22); x.fillStyle = "#7f8c8d"; x.beginPath(); x.moveTo(0,10); x.lineTo(16,0); x.lineTo(32,10); x.fill(); x.fillStyle="#fff"; x.font="10px Arial"; x.fillText("⚒️", 10, 25); });
}

// === VERDEN ===
function createWorld() {
    gameState.keep = { id: 'keep', type: 'building', subType: 'keep', x: GameConfig.worldWidth/2, y: GameConfig.worldHeight/2, w: 100, h: 100, color: '#8e44ad', built: true, progress: 100, hp: 5000, maxHp: 5000 };
    gameState.worldObjects.push(gameState.keep);
    gameState.camera.x = gameState.keep.x - GameConfig.screenWidth/2; gameState.camera.y = gameState.keep.y - GameConfig.screenHeight/2;
    const cy = GameConfig.worldHeight/2;
    for(let i=0; i<60; i++) spawnResource(ResourceTypes.TREE, randomRange(0, 2000), randomRange(cy-300, 2000));
    for(let i=0; i<20; i++) spawnResource(ResourceTypes.STONE, randomRange(1200, 2000), randomRange(cy+200, 2000));
    for(let i=0; i<30; i++) spawnResource(ResourceTypes.BERRY, randomRange(600, 1400), randomRange(cy, cy+500));
}

function spawnResource(def, x, y) { gameState.worldObjects.push({ id: Math.random().toString(36), type: 'resource', resType: def.type, name: def.name, color: def.color, icon: def.icon, capacity: def.capacity, amount: def.capacity, harvestTime: def.harvestTime, x: x, y: y, w: 32, h: 32 }); }
function spawnWorker(x, y) { gameState.workers.push({ id: Math.random().toString(36), type: 'worker', name: 'Arbeider', x: x, y: y, w: 32, h: 32, speed: 90, state: 'IDLE', target: null, carryType: null, carryAmount: 0, maxCarry: 10, gatherTimer: 0, spriteId: 'worker', animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true }); }
function spawnSoldier(def, x, y) { gameState.soldiers.push({ id: Math.random().toString(36), type: 'soldier', name: def.name, x: x, y: y, w: 32, h: 32, speed: def.speed, stats: def, state: 'IDLE', target: null, spriteId: def.spriteId, animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true, hp: def.maxHp, maxHp: def.maxHp, garrisoned: false }); }

// === INPUT ===
function setupInput() {
    canvas.addEventListener('mousedown', (e) => {
        const mouse = getMouseWorldPos(e);
        if (gameState.buildMode) {
            if (e.button === 0) {
                if (['HOUSE','BOWYER','MASON'].includes(gameState.buildMode)) placeSingleBuilding(snapToGrid(mouse.x, mouse.y), gameState.buildMode);
                else gameState.dragStart = snapToGrid(mouse.x, mouse.y);
            }
            return;
        }
        if (e.button === 0) selectEntity(mouse.x, mouse.y);
    });

    canvas.addEventListener('mousemove', (e) => gameState.mouseWorld = getMouseWorldPos(e));
    
    canvas.addEventListener('mouseup', (e) => {
        if (gameState.buildMode && gameState.dragStart) {
            const end = snapToGrid(gameState.mouseWorld.x, gameState.mouseWorld.y);
            placeWallBlueprints(gameState.dragStart, end);
            gameState.dragStart = null;
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (gameState.buildMode) return;
        const mouse = getMouseWorldPos(e);
        if (gameState.selectedEntity && gameState.selectedEntity.type === 'worker') handleWorkerCommand(gameState.selectedEntity, mouse.x, mouse.y);
        else if (gameState.selectedEntity && gameState.selectedEntity.type === 'soldier') handleSoldierCommand(gameState.selectedEntity, mouse.x, mouse.y);
    });

    window.addEventListener('keydown', (e) => {
        if(e.key==='w') gameState.keys.w=true; if(e.key==='a') gameState.keys.a=true; if(e.key==='s') gameState.keys.s=true; if(e.key==='d') gameState.keys.d=true;
        if(e.key==='Escape') setBuildMode(null);
    });
    window.addEventListener('keyup', (e) => {
        if(e.key==='w') gameState.keys.w=false; if(e.key==='a') gameState.keys.a=false; if(e.key==='s') gameState.keys.s=false; if(e.key==='d') gameState.keys.d=false;
    });

    document.getElementById('btn-create-worker').onclick = attemptCreateWorker;
    document.getElementById('btn-build-house').onclick = () => setBuildMode('HOUSE');
    document.getElementById('btn-build-bowyer').onclick = () => setBuildMode('BOWYER');
    document.getElementById('btn-build-mason').onclick = () => setBuildMode('MASON');
    document.getElementById('btn-build-palisade').onclick = () => setBuildMode('PALISADE');
    document.getElementById('btn-build-wall').onclick = () => attemptSetBuildMode('WALL');
    document.getElementById('btn-train-peasant').onclick = () => convertWorkerToSoldier('peasant');
    document.getElementById('btn-train-archer').onclick = () => attemptTrainSoldier('archer');
    document.getElementById('btn-train-knight').onclick = () => convertWorkerToSoldier('knight');
    ui.btnCancel.onclick = () => setBuildMode(null);
}

// === KOMMANDOER ===
function handleWorkerCommand(w, wx, wy) {
    let target = null;
    gameState.worldObjects.forEach(o => { if(dist(wx, wy, o.x, o.y) < 25) target = o; });
    
    if (target) {
        if (target.type === 'resource') { w.state='MOVING'; w.target=target; w.jobType='GATHER'; ui.msg.innerText="Samler ressurser."; }
        else if ((target.type === 'wall' || target.type === 'building') && !target.built) {
            w.state='MOVING'; w.target=target; w.jobType='BUILD'; ui.msg.innerText="Går for å bygge.";
        }
        else if ((target.type === 'wall' || target.type === 'building') && target.built && target.hp < target.maxHp) {
            // REPARASJON
            w.state='MOVING'; w.target=target; w.jobType='REPAIR'; ui.msg.innerText="Går for å reparere.";
        }
        else { w.state='MOVING'; w.target={x: wx, y: wy}; w.jobType='MOVE'; ui.msg.innerText="Går."; }
    } else {
        w.state='MOVING'; w.target={x: wx, y: wy}; w.jobType='MOVE'; ui.msg.innerText="Går.";
    }
}

function handleSoldierCommand(s, wx, wy) {
    let wall = null;
    gameState.worldObjects.forEach(o => {
        if ((o.type === 'wall') && o.built && dist(wx, wy, o.x, o.y) < 20) wall = o;
    });

    if (wall) { s.target = wall; s.state = 'MOVING'; s.jobType = 'GARRISON'; ui.msg.innerText = "Går til post på mur."; }
    else { s.target = {x: wx, y: wy}; s.state = 'MOVING'; s.jobType = 'MOVE'; s.garrisoned = false; ui.msg.innerText = "Soldat flytter seg."; }
}

// === SPILL-LOGIKK ===
function gameLoop(timestamp) {
    if (!gameState.lastTime) gameState.lastTime = timestamp;
    const dt = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    updateCamera(dt);
    updateWave(dt);
    
    gameState.workers.forEach(w => updateWorker(w, dt));
    gameState.soldiers.forEach(s => updateSoldier(s, dt));
    
    // Oppdater fiender (baklengs)
    for (let i = gameState.enemies.length - 1; i >= 0; i--) { updateEnemy(gameState.enemies[i], dt, i); }
    
    calculatePopulation();
}

function updateWave(dt) {
    gameState.wave.timer -= dt;
    if (gameState.wave.timer <= 0) {
        spawnWave(gameState.wave.number);
        gameState.wave.number++;
        gameState.wave.timer = GameConfig.waveInterval; // Reset timer
    }
    
    // UI Update for timer
    const m = Math.floor(gameState.wave.timer / 60);
    const s = Math.floor(gameState.wave.timer % 60);
    ui.wave.num.innerText = gameState.wave.number;
    ui.wave.timer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function spawnWave(waveNum) {
    ui.msg.innerText = `Bølge ${waveNum} angriper!`;
    const count = 3 + Math.floor(waveNum * 2.5); // Økning
    
    for (let i = 0; i < count; i++) {
        // Spawn fra tilfeldig kant
        let ex, ey;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { ex = randomRange(0, GameConfig.worldWidth); ey = -50; } // Nord
        else if (side === 1) { ex = randomRange(0, GameConfig.worldWidth); ey = GameConfig.worldHeight + 50; } // Sør
        else if (side === 2) { ex = -50; ey = randomRange(0, GameConfig.worldHeight); } // Vest
        else { ex = GameConfig.worldWidth + 50; ey = randomRange(0, GameConfig.worldHeight); } // Øst
        
        gameState.enemies.push({
            id: Math.random(), type: 'enemy', x: ex, y: ey, w: 32, h: 32, speed: 40, 
            hp: 50 + (waveNum * 10), maxHp: 50 + (waveNum * 10), damage: 5 + waveNum,
            state: 'MOVING', animState: 'walk', animFrame: 0, animTimer: 0, spriteId: 'enemy', attackTimer: 0
        });
    }
}

function updateEnemy(e, dt, idx) {
    if (e.hp <= 0) { gameState.enemies.splice(idx, 1); return; }
    
    // AI: Gå mot Borgen, men angrip hindringer
    let target = gameState.keep;
    let action = 'MOVING';
    
    // 1. Sjekk om soldater er nærme
    let nearSoldier = null;
    gameState.soldiers.forEach(s => { if(dist(e.x, e.y, s.x, s.y) < 100) nearSoldier = s; });
    if (nearSoldier) target = nearSoldier;
    
    const dx = target.x - e.x; const dy = target.y - e.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    e.facingRight = dx > 0;

    // 2. Sjekk kollisjon/angrep
    if (d < 40) {
        action = 'ATTACKING';
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
            target.hp -= e.damage;
            e.attackTimer = 1.5;
            if (target.type === 'soldier' && target.hp <= 0) {
                // Drep soldat
                const sIdx = gameState.soldiers.indexOf(target);
                if (sIdx > -1) gameState.soldiers.splice(sIdx, 1);
            }
            if (target.type === 'building' && target.hp <= 0 && target.subType === 'keep') {
                alert("GAME OVER - Borgen falt!"); location.reload();
            }
        }
    } else {
        // Sjekk om mur blokkerer
        let wall = null;
        gameState.worldObjects.forEach(o => {
            if ((o.type==='wall'||o.type==='building') && o.built && dist(e.x, e.y, o.x, o.y) < 30) wall = o;
        });
        
        if (wall) {
            action = 'ATTACKING';
            e.attackTimer -= dt;
            if (e.attackTimer <= 0) {
                wall.hp -= e.damage;
                e.attackTimer = 1.0;
                if (wall.hp <= 0) {
                    const wIdx = gameState.worldObjects.indexOf(wall);
                    if (wIdx > -1) gameState.worldObjects.splice(wIdx, 1);
                }
            }
        } else {
            // Bevegelse
            e.x += (dx/d)*e.speed*dt; e.y += (dy/d)*e.speed*dt;
        }
    }
    
    // Animasjon
    e.animTimer += dt;
    const def = Assets.definitions[e.spriteId];
    e.animState = action === 'ATTACKING' ? 'attack' : 'walk';
    if(e.animTimer >= (1/def.fps)) { e.animTimer=0; e.animFrame=(e.animFrame+1)%def.anims[e.animState].length; }
}

function updateWorker(w, dt) {
    const isMoving = w.state === 'MOVING'; const isWorking = w.state === 'GATHERING' || w.state === 'BUILDING' || w.state === 'REPAIRING';
    w.animState = isWorking ? 'work' : (isMoving ? 'walk' : 'idle');
    const def = Assets.definitions[w.spriteId];
    w.animTimer += dt; if (w.animTimer >= (1/def.fps)) { w.animTimer = 0; w.animFrame = (w.animFrame+1) % def.anims[w.animState].length; }

    if (w.state === 'IDLE') return;

    if (w.state === 'MOVING') {
        const dx = w.target.x - w.x; const dy = w.target.y - w.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) {
            w.x += (dx/d)*w.speed*dt; w.y += (dy/d)*w.speed*dt; w.facingRight = dx > 0;
        } else {
            if (w.jobType === 'GATHER') { w.state = 'GATHERING'; w.gatherTimer = w.target.harvestTime; }
            else if (w.jobType === 'BUILD') { w.state = 'BUILDING'; }
            else if (w.jobType === 'REPAIR') { w.state = 'REPAIRING'; }
            else if (w.jobType === 'RETURN') w.state = 'DEPOSITING';
            else w.state = 'IDLE';
        }
    } 
    else if (w.state === 'GATHERING') {
        w.gatherTimer -= dt;
        if (w.gatherTimer <= 0) {
            w.carryType = w.target.resType; w.carryAmount = w.maxCarry; w.target.amount -= w.maxCarry;
            if (w.target.amount <= 0) { const idx = gameState.worldObjects.indexOf(w.target); if(idx>-1)gameState.worldObjects.splice(idx,1); w.target = null; }
            w.state = 'MOVING'; w.target = gameState.keep; w.jobType = 'RETURN'; w.lastResourcePos = { x: w.x, y: w.y, type: w.carryType };
        }
    } 
    else if (w.state === 'BUILDING') {
        if (!w.target || w.target.built) {
            const nextBuild = findNearbyBlueprint(w);
            if (nextBuild) { w.target = nextBuild; w.state = 'MOVING'; w.jobType = 'BUILD'; } else w.state = 'IDLE';
            return;
        }
        w.target.progress += (100 / w.target.buildTime) * dt;
        if (w.target.progress >= 100) { w.target.progress = 100; w.target.built = true; }
    }
    else if (w.state === 'REPAIRING') {
        if (!w.target || w.target.hp >= w.target.maxHp) { w.state = 'IDLE'; return; }
        w.target.hp += 20 * dt; // Reparer 20 HP i sekundet
        if (w.target.hp > w.target.maxHp) w.target.hp = w.target.maxHp;
    }
    else if (w.state === 'DEPOSITING') {
        gameState.resources[w.carryType] += w.carryAmount; w.carryAmount = 0; w.carryType = null;
        if (w.lastResourcePos) {
            let near = null, minDist = Infinity;
            gameState.worldObjects.forEach(o => { if(o.type === 'resource' && o.resType === w.lastResourcePos.type) { const d = dist(w.lastResourcePos.x, w.lastResourcePos.y, o.x, o.y); if(d < minDist) { minDist = d; near = o; } } });
            if (near && minDist < 300) { w.state = 'MOVING'; w.target = near; w.jobType = 'GATHER'; } else w.state = 'IDLE';
        } else w.state = 'IDLE';
    }
}

function updateSoldier(s, dt) {
    // Healing logic
    if (dist(s.x, s.y, gameState.keep.x, gameState.keep.y) < 150 && s.hp < s.maxHp) {
        s.hp += 5 * dt; // 5 HP/sek regen ved borgen
    }

    // Combat Logic
    let target = null;
    let minDist = Infinity;
    gameState.enemies.forEach(e => {
        const d = dist(s.x, s.y, e.x, e.y);
        if (d < minDist) { minDist = d; target = e; }
    });

    if (target && minDist < s.stats.range) {
        s.state = 'ATTACKING';
        s.animState = 'attack';
        s.facingRight = target.x > s.x;
        
        if (s.cooldownTimer <= 0) {
            s.cooldownTimer = s.stats.cooldown;
            target.hp -= s.stats.damage;
        } else {
            s.cooldownTimer -= dt;
        }
    } else {
        // Ingen fiender, gå tilbake til idle eller bevegelse
        if (s.state === 'ATTACKING') s.state = 'IDLE';
    }

    // Bevegelse
    if (s.state === 'MOVING' && s.target) {
        const dx = s.target.x - s.x; const dy = s.target.y - s.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) {
            s.x += (dx/d)*s.speed*dt; s.y += (dy/d)*s.speed*dt; s.facingRight = dx > 0;
            s.animState = 'walk';
        } else {
            if (s.jobType === 'GARRISON') { s.garrisoned = true; s.state = 'IDLE'; } else s.state = 'IDLE';
        }
    }

    // Animasjon
    const def = Assets.definitions[s.spriteId];
    s.animTimer += dt; if (s.animTimer >= (1/def.fps)) { s.animTimer = 0; s.animFrame = (s.animFrame+1) % def.anims[s.animState].length; }
}

function findNearbyBlueprint(worker) {
    let found = null; let minDist = 300;
    gameState.worldObjects.forEach(o => { if ((o.type === 'wall' || o.type === 'building') && !o.built) { const d = dist(worker.x, worker.y, o.x, o.y); if (d < minDist) { minDist = d; found = o; } } });
    return found;
}

// === UI & TECH TREE ===
function hasBuilding(tech) { if (!tech) return true; return gameState.worldObjects.some(o => o.type === 'building' && o.tech === tech && o.built); }
function attemptSetBuildMode(mode) { if (Buildings[mode].req && !hasBuilding(Buildings[mode].req)) { ui.msg.innerText = `Krever ${Buildings[Buildings[mode].req].name}!`; return; } setBuildMode(mode); }
function attemptTrainSoldier(type) { if (UnitTypes[type].req && !hasBuilding(UnitTypes[type].req)) { ui.msg.innerText = `Krever ${Buildings[UnitTypes[type].req].name}!`; return; } convertWorkerToSoldier(type); }
function attemptCreateWorker() { if (gameState.population.current >= gameState.population.max) { ui.msg.innerText = "Befolkningsgrense nådd!"; return; } if (gameState.resources.food >= 50) { gameState.resources.food -= 50; spawnWorker(gameState.keep.x, gameState.keep.y + 60); updateUI(); ui.msg.innerText = "Ny arbeider!"; } else ui.msg.innerText = "Mangler mat (50)."; }
function convertWorkerToSoldier(type) { const def = UnitTypes[type]; let canAfford = true; for (let res in def.cost) if (gameState.resources[res] < def.cost[res]) canAfford = false; if (!canAfford) { ui.msg.innerText = "Mangler ressurser."; return; } let candidate = gameState.workers.find(w => w.state === 'IDLE'); if (!candidate) { ui.msg.innerText = "Ingen ledige arbeidere!"; return; } for (let res in def.cost) gameState.resources[res] -= def.cost[res]; const idx = gameState.workers.indexOf(candidate); gameState.workers.splice(idx, 1); spawnSoldier(def, candidate.x, candidate.y); updateUI(); ui.msg.innerText = `${def.name} klar!`; }
function setBuildMode(mode) { gameState.buildMode = mode; gameState.dragStart = null; document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active')); ui.btnCancel.classList.add('hidden'); if (mode) { ui.msg.innerText = `BYGG: ${mode}.`; ui.btnCancel.classList.remove('hidden'); } }
function snapToGrid(x, y) { return { x: Math.floor(x/GameConfig.tileSize)*GameConfig.tileSize, y: Math.floor(y/GameConfig.tileSize)*GameConfig.tileSize }; }
function placeSingleBuilding(pos, type) { const def = Buildings[type]; if (gameState.resources[def.costType] < def.cost) { ui.msg.innerText = "Mangler ressurser."; return; } gameState.resources[def.costType] -= def.cost; updateUI(); gameState.worldObjects.push({ id: Math.random().toString(36), type: 'building', subType: type, x: pos.x+16, y: pos.y+16, w: 32, h: 32, spriteId: def.spriteId, hp: def.hp, maxHp: def.hp, built: false, progress: 0, buildTime: def.buildTime, popBonus: def.popBonus||0, tech: def.tech }); ui.msg.innerText = "Bygging startet."; }
function placeWallBlueprints(start, end) { const typeDef = Buildings[gameState.buildMode]; const dx = end.x - start.x; const dy = end.y - start.y; const distVal = dist(0, 0, dx, dy); const count = Math.ceil(distVal / GameConfig.tileSize); if (count <= 0) return; const totalCost = count * typeDef.cost; if (gameState.resources[typeDef.costType] < totalCost) { ui.msg.innerText = "Mangler ressurser."; return; } gameState.resources[typeDef.costType] -= totalCost; updateUI(); for (let i = 0; i <= count; i++) { const factor = count === 0 ? 0 : i / count; const wx = start.x + dx * factor; const wy = start.y + dy * factor; const gridPos = snapToGrid(wx, wy); let blocked = false; gameState.worldObjects.forEach(obj => { if (dist(gridPos.x+16, gridPos.y+16, obj.x, obj.y) < 10) blocked = true; }); if (!blocked) { gameState.worldObjects.push({ id: Math.random().toString(36), type: 'wall', subType: gameState.buildMode, spriteId: typeDef.spriteId, x: gridPos.x+16, y: gridPos.y+16, w: 32, h: 32, hp: typeDef.hp, built: false, progress: 0, buildTime: typeDef.buildTime }); } } ui.msg.innerText = "Mur planlagt."; }
function calculatePopulation() { let cap = 5; gameState.worldObjects.forEach(o => { if (o.type === 'building' && o.subType === 'HOUSE' && o.built) cap += o.popBonus; }); gameState.population.max = cap; gameState.population.current = gameState.workers.length + gameState.soldiers.length; updateUI(); }
function updateCamera(dt) { const s = 500 * dt; if(gameState.keys.w) gameState.camera.y -= s; if(gameState.keys.s) gameState.camera.y += s; if(gameState.keys.a) gameState.camera.x -= s; if(gameState.keys.d) gameState.camera.x += s; gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, GameConfig.worldWidth - GameConfig.screenWidth)); gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, GameConfig.worldHeight - GameConfig.screenHeight)); }
function selectEntity(wx, wy) { let f = null; [...gameState.workers, ...gameState.soldiers, ...gameState.enemies].forEach(u => { if(dist(wx, wy, u.x, u.y)<20) f=u; }); if(!f) gameState.worldObjects.forEach(o => { if(dist(wx, wy, o.x, o.y)<20) f=o; }); gameState.selectedEntity = f; ui.selection.innerText = f ? `${f.type} ${f.hp}/${f.maxHp||f.stats?.maxHp}` : "Ingen valgt"; }
function getMouseWorldPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) + gameState.camera.x, y: (e.clientY - r.top) + gameState.camera.y }; }
function updateUI() { ui.res.pop.innerText = `${gameState.population.current}/${gameState.population.max}`; ui.res.food.innerText = Math.floor(gameState.resources.food); ui.res.wood.innerText = Math.floor(gameState.resources.wood); ui.res.stone.innerText = Math.floor(gameState.resources.stone); ui.res.iron.innerText = Math.floor(gameState.resources.iron); ui.btns.trainArcher.disabled = !hasBuilding('BOWYER'); ui.btns.buildWall.disabled = !hasBuilding('MASON'); }

// === TEGNING ===
function draw() {
    ctx.fillStyle = "#1e272e"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.translate(-gameState.camera.x, -gameState.camera.y);
    ctx.fillStyle = "#2ecc71"; ctx.fillRect(0,0,GameConfig.worldWidth,GameConfig.worldHeight);
    
    const allObjects = [...gameState.worldObjects, ...gameState.workers, ...gameState.soldiers, ...gameState.enemies];
    allObjects.sort((a,b) => a.y - b.y);

    allObjects.forEach(obj => {
        const isBlueprint = (obj.type === 'wall' || obj.type === 'building') && !obj.built;
        if (isBlueprint) ctx.globalAlpha = 0.5;

        if (obj.type === 'building' || obj.type === 'wall') {
            const img = Assets.sprites[obj.spriteId];
            if (img) ctx.drawImage(img, obj.x-16, obj.y-16);
            else { ctx.fillStyle=obj.color; ctx.fillRect(obj.x-16, obj.y-16, 32, 32); }
            if (!obj.built && obj.type !== 'resource') {
                ctx.fillStyle = "black"; ctx.fillRect(obj.x-16, obj.y-22, 32, 4);
                ctx.fillStyle = "yellow"; ctx.fillRect(obj.x-16, obj.y-22, 32 * (obj.progress/100), 4);
            }
            // HP Bar for buildings
            if (obj.built && obj.hp < obj.maxHp) {
                ctx.fillStyle = "red"; ctx.fillRect(obj.x-16, obj.y-22, 32, 4);
                ctx.fillStyle = "green"; ctx.fillRect(obj.x-16, obj.y-22, 32 * (obj.hp/obj.maxHp), 4);
            }
        } 
        else if (obj.type === 'resource') {
            ctx.font="24px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(obj.icon, obj.x, obj.y);
            const p = obj.amount/obj.capacity; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(obj.x-10, obj.y+15, 20, 3);
            ctx.fillStyle="#fff"; ctx.fillRect(obj.x-10, obj.y+15, 20*p, 3);
        } 
        else {
            const yOffset = obj.garrisoned ? -12 : 0;
            ctx.save(); ctx.translate(0, yOffset);
            drawSprite(obj);
            if (obj.carryType) { ctx.font="12px Arial"; const ic = obj.carryType==='wood'?'🌲':(obj.carryType==='stone'?'🪨':'🍖'); ctx.fillText(ic, obj.x, obj.y-20); }
            if (gameState.selectedEntity === obj) { ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(obj.x, obj.y, 15, 0, Math.PI*2); ctx.stroke(); }
            // Healing visual
            if (dist(obj.x, obj.y, gameState.keep.x, gameState.keep.y) < 150 && obj.hp < (obj.maxHp || 100) && obj.type === 'soldier') {
                ctx.fillStyle = "#2ecc71"; ctx.font="10px Arial"; ctx.fillText("++", obj.x+10, obj.y-10);
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
    });

    if (gameState.buildMode && gameState.dragStart && gameState.buildMode !== 'HOUSE' && gameState.buildMode !== 'BOWYER' && gameState.buildMode !== 'MASON') {
        const start = gameState.dragStart; const end = snapToGrid(gameState.mouseWorld.x, gameState.mouseWorld.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(start.x + 16, start.y + 16); ctx.lineTo(end.x + 16, end.y + 16); ctx.stroke();
    }
    if (['HOUSE','BOWYER','MASON'].includes(gameState.buildMode)) {
        const pos = snapToGrid(gameState.mouseWorld.x, gameState.mouseWorld.y);
        ctx.globalAlpha = 0.5; const sprite = Buildings[gameState.buildMode].spriteId; if(Assets.sprites[sprite]) ctx.drawImage(Assets.sprites[sprite], pos.x, pos.y); ctx.globalAlpha = 1.0;
    }
    ctx.restore();
}

function drawSprite(entity) {
    const def = Assets.definitions[entity.spriteId]; const img = Assets.sprites[entity.spriteId]; if (!img || !def) return;
    const idx = def.anims[entity.animState]; const frame = idx[entity.animFrame % idx.length]; const sx = frame * def.w;
    ctx.save(); ctx.translate(entity.x, entity.y); if (!entity.facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 10, 8, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.drawImage(img, sx, 0, def.w, def.h, -def.w/2, -def.h/2, def.w, def.h);
    // HP Bar units
    if (entity.hp < (entity.maxHp||100)) {
        ctx.fillStyle = "red"; ctx.fillRect(-10, -20, 20, 4);
        ctx.fillStyle = "#00ff00"; ctx.fillRect(-10, -20, 20 * (entity.hp/(entity.maxHp||100)), 4);
    }
    ctx.restore();
}

window.onload = init;
/* Version: #22 */
