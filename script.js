/* Version: #23 - RTS Controls, Group Selection & Combat Fixes */

// === HJELPEFUNKSJONER ===
function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }
function randomRange(min, max) { return Math.random() * (max - min) + min; }
// Sjekk om punkt p er inni rektangel r {x, y, w, h} (håndterer negativ w/h)
function pointInRect(px, py, rx, ry, rw, rh) {
    let x = rx, y = ry, w = rw, h = rh;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    return px >= x && px <= x + w && py >= y && py <= y + h;
}

// === KONFIGURASJON ===
const GameConfig = {
    screenWidth: 1000,
    screenHeight: 600,
    worldWidth: 2000,
    worldHeight: 2000,
    tileSize: 32,
    debugMode: false,
    firstWaveTime: 120, 
    waveInterval: 300   
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
    peasant: { name: "Fotsoldat", cost: { food: 50 }, damage: 8, range: 40, cooldown: 1.0, spriteId: 'peasant', speed: 80, maxHp: 100 },
    archer:  { name: "Bueskytter", cost: { food: 50, wood: 25 }, damage: 10, range: 250, cooldown: 1.5, spriteId: 'archer', speed: 90, req: 'BOWYER', maxHp: 80, projectile: true },
    knight:  { name: "Ridder", cost: { food: 50, iron: 20 }, damage: 25, range: 40, cooldown: 0.8, spriteId: 'knight', speed: 70, maxHp: 200 }
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
    wave: { number: 1, timer: GameConfig.firstWaveTime, active: false },
    
    worldObjects: [],
    workers: [],      
    soldiers: [],
    enemies: [],
    projectiles: [], // Piler etc
    effects: [],     // Visuelle effekter
    keep: null,       
    
    // INPUT STATE
    selectedUnits: [], // Array for multi-select
    selectionBox: { active: false, startX: 0, startY: 0, curX: 0, curY: 0 }, // For å tegne boksen
    
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
    console.log("Initialiserer RTS v23...");
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
function spawnSoldier(def, x, y) { gameState.soldiers.push({ id: Math.random().toString(36), type: 'soldier', name: def.name, x: x, y: y, w: 32, h: 32, speed: def.speed, stats: def, state: 'IDLE', target: null, spriteId: def.spriteId, animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true, hp: def.maxHp, maxHp: def.maxHp, garrisoned: false, cooldownTimer: 0 }); }

// === INPUT: RTS CONTROLS ===
function setupInput() {
    canvas.addEventListener('mousedown', (e) => {
        const mouse = getMouseWorldPos(e);
        
        // 1. Byggemodus
        if (gameState.buildMode) {
            if (e.button === 0) {
                if (['HOUSE','BOWYER','MASON'].includes(gameState.buildMode)) placeSingleBuilding(snapToGrid(mouse.x, mouse.y), gameState.buildMode);
                else gameState.dragStart = snapToGrid(mouse.x, mouse.y);
            }
            return;
        }

        // 2. Start Selection Box (Venstreklikk)
        if (e.button === 0) {
            gameState.selectionBox.active = true;
            gameState.selectionBox.startX = mouse.x;
            gameState.selectionBox.startY = mouse.y;
            gameState.selectionBox.curX = mouse.x;
            gameState.selectionBox.curY = mouse.y;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const mouse = getMouseWorldPos(e);
        gameState.mouseWorld = mouse;
        
        if (gameState.selectionBox.active) {
            gameState.selectionBox.curX = mouse.x;
            gameState.selectionBox.curY = mouse.y;
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        const mouse = getMouseWorldPos(e);

        // 1. Fullfør Bygging
        if (gameState.buildMode && gameState.dragStart) {
            const end = snapToGrid(mouse.x, mouse.y);
            placeWallBlueprints(gameState.dragStart, end);
            gameState.dragStart = null;
        }

        // 2. Fullfør Selection Box
        if (gameState.selectionBox.active) {
            gameState.selectionBox.active = false;
            
            // Beregn boks
            const sx = gameState.selectionBox.startX;
            const sy = gameState.selectionBox.startY;
            const w = mouse.x - sx;
            const h = mouse.y - sy;

            // Hvis bare et klikk (veldig liten boks), velg enhet under musen
            if (Math.abs(w) < 5 && Math.abs(h) < 5) {
                selectSingleEntity(mouse.x, mouse.y);
            } else {
                // Rektangel markering
                selectUnitsInRect(sx, sy, w, h);
            }
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (gameState.buildMode) return;
        const mouse = getMouseWorldPos(e);
        
        // HØYREKLIKK: Gi ordre til valgte enheter
        if (gameState.selectedUnits.length > 0) {
            issueCommandToSelected(mouse.x, mouse.y);
        }
    });

    window.addEventListener('keydown', (e) => {
        if(e.key==='w') gameState.keys.w=true; if(e.key==='a') gameState.keys.a=true; if(e.key==='s') gameState.keys.s=true; if(e.key==='d') gameState.keys.d=true;
        if(e.key==='Escape') { setBuildMode(null); gameState.selectedUnits = []; updateUI(); }
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

// === UNIT SELECTION & COMMANDS ===
function selectSingleEntity(wx, wy) {
    gameState.selectedUnits = [];
    let found = null;
    
    // Prioriter soldater/arbeidere
    [...gameState.soldiers, ...gameState.workers].forEach(u => { if(dist(wx, wy, u.x, u.y) < 20) found = u; });
    
    // Hvis ingen enhet, sjekk bygg
    if (!found) gameState.worldObjects.forEach(o => { if(dist(wx, wy, o.x, o.y) < 20) found = o; });

    if (found) gameState.selectedUnits.push(found);
    updateSelectionUI();
}

function selectUnitsInRect(x, y, w, h) {
    gameState.selectedUnits = [];
    [...gameState.soldiers, ...gameState.workers].forEach(u => {
        if (pointInRect(u.x, u.y, x, y, w, h)) {
            gameState.selectedUnits.push(u);
        }
    });
    updateSelectionUI();
}

function issueCommandToSelected(wx, wy) {
    // Sjekk hva vi høyreklikket på
    let target = null;
    
    // Fiende?
    gameState.enemies.forEach(e => { if (dist(wx, wy, e.x, e.y) < 25) target = e; });
    // Bygning/Ressurs?
    if (!target) gameState.worldObjects.forEach(o => { if (dist(wx, wy, o.x, o.y) < 25) target = o; });

    gameState.selectedUnits.forEach((u, index) => {
        // Enkel flokk-logikk: Spre målet litt basert på indeks
        const offsetX = (index % 3) * 15 - 15;
        const offsetY = Math.floor(index / 3) * 15;

        if (u.type === 'worker') {
            if (target && target.type === 'resource') { u.state='MOVING'; u.target=target; u.jobType='GATHER'; }
            else if (target && (target.type === 'wall' || target.type === 'building') && !target.built) { u.state='MOVING'; u.target=target; u.jobType='BUILD'; }
            else if (target && (target.type === 'wall' || target.type === 'building') && target.built && target.hp < target.maxHp) { u.state='MOVING'; u.target=target; u.jobType='REPAIR'; }
            else { u.state='MOVING'; u.target={x: wx + offsetX, y: wy + offsetY}; u.jobType='MOVE'; }
        }
        else if (u.type === 'soldier') {
            if (target && target.type === 'enemy') { 
                // Attack specific enemy
                u.state = 'MOVING'; u.target = target; u.jobType = 'ATTACK_TARGET';
            }
            else if (target && target.type === 'wall' && target.built) {
                u.state='MOVING'; u.target=target; u.jobType='GARRISON';
            }
            else { 
                // Move command
                u.state = 'MOVING'; 
                u.target = {x: wx + offsetX, y: wy + offsetY}; 
                u.jobType = 'MOVE'; 
                u.garrisoned = false; 
            }
        }
    });
    
    // Vis feedback
    const count = gameState.selectedUnits.length;
    if (count > 0) {
        spawnEffect(wx, wy, 'click'); // Visuell prikk der man klikket
        ui.msg.innerText = `Ordre gitt til ${count} enheter.`;
    }
}

function updateSelectionUI() {
    const count = gameState.selectedUnits.length;
    if (count === 0) ui.selection.innerText = "Ingen valgt";
    else if (count === 1) {
        const u = gameState.selectedUnits[0];
        ui.selection.innerText = `${u.type} (${u.hp}/${u.maxHp || u.stats?.maxHp})`;
    } else {
        ui.selection.innerText = `Valgt: ${count} enheter`;
    }
}

// === KOMMANDOER (Interne) ===
function hasBuilding(tech) { if (!tech) return true; return gameState.worldObjects.some(o => o.type === 'building' && o.tech === tech && o.built); }
function attemptSetBuildMode(mode) { if (Buildings[mode].req && !hasBuilding(Buildings[mode].req)) { ui.msg.innerText = `Krever ${Buildings[Buildings[mode].req].name}!`; return; } setBuildMode(mode); }
function attemptTrainSoldier(type) { if (UnitTypes[type].req && !hasBuilding(UnitTypes[type].req)) { ui.msg.innerText = `Krever ${Buildings[UnitTypes[type].req].name}!`; return; } convertWorkerToSoldier(type); }
function attemptCreateWorker() { if (gameState.population.current >= gameState.population.max) { ui.msg.innerText = "Befolkningsgrense nådd! Bygg hus."; return; } if (gameState.resources.food >= 50) { gameState.resources.food -= 50; spawnWorker(gameState.keep.x, gameState.keep.y + 60); updateUI(); ui.msg.innerText = "Ny arbeider!"; } else ui.msg.innerText = "Mangler mat (50)."; }
function convertWorkerToSoldier(type) { const def = UnitTypes[type]; let canAfford = true; for (let res in def.cost) if (gameState.resources[res] < def.cost[res]) canAfford = false; if (!canAfford) { ui.msg.innerText = "Mangler ressurser."; return; } let candidate = gameState.workers.find(w => w.state === 'IDLE'); if (!candidate) { ui.msg.innerText = "Ingen ledige arbeidere!"; return; } for (let res in def.cost) gameState.resources[res] -= def.cost[res]; const idx = gameState.workers.indexOf(candidate); gameState.workers.splice(idx, 1); spawnSoldier(def, candidate.x, candidate.y); updateUI(); ui.msg.innerText = `${def.name} klar!`; }
function setBuildMode(mode) { gameState.buildMode = mode; gameState.dragStart = null; document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active')); ui.btnCancel.classList.add('hidden'); if (mode) { ui.msg.innerText = `BYGG: ${mode}.`; ui.btnCancel.classList.remove('hidden'); } }
function snapToGrid(x, y) { return { x: Math.floor(x/GameConfig.tileSize)*GameConfig.tileSize, y: Math.floor(y/GameConfig.tileSize)*GameConfig.tileSize }; }
function placeSingleBuilding(pos, type) { const def = Buildings[type]; if (gameState.resources[def.costType] < def.cost) { ui.msg.innerText = "Mangler ressurser."; return; } gameState.resources[def.costType] -= def.cost; updateUI(); gameState.worldObjects.push({ id: Math.random().toString(36), type: 'building', subType: type, x: pos.x+16, y: pos.y+16, w: 32, h: 32, spriteId: def.spriteId, hp: def.hp, maxHp: def.hp, built: false, progress: 0, buildTime: def.buildTime, popBonus: def.popBonus||0, tech: def.tech }); ui.msg.innerText = "Bygging startet."; }
function placeWallBlueprints(start, end) { const typeDef = Buildings[gameState.buildMode]; const dx = end.x - start.x; const dy = end.y - start.y; const distVal = dist(0, 0, dx, dy); const count = Math.ceil(distVal / GameConfig.tileSize); if (count <= 0) return; const totalCost = count * typeDef.cost; if (gameState.resources[typeDef.costType] < totalCost) { ui.msg.innerText = "Mangler ressurser."; return; } gameState.resources[typeDef.costType] -= totalCost; updateUI(); for (let i = 0; i <= count; i++) { const factor = count === 0 ? 0 : i / count; const wx = start.x + dx * factor; const wy = start.y + dy * factor; const gridPos = snapToGrid(wx, wy); let blocked = false; gameState.worldObjects.forEach(obj => { if (dist(gridPos.x+16, gridPos.y+16, obj.x, obj.y) < 10) blocked = true; }); if (!blocked) { gameState.worldObjects.push({ id: Math.random().toString(36), type: 'wall', subType: gameState.buildMode, spriteId: typeDef.spriteId, x: gridPos.x+16, y: gridPos.y+16, w: 32, h: 32, hp: typeDef.hp, built: false, progress: 0, buildTime: typeDef.buildTime }); } } ui.msg.innerText = "Mur planlagt."; }
function calculatePopulation() { let cap = 5; gameState.worldObjects.forEach(o => { if (o.type === 'building' && o.subType === 'HOUSE' && o.built) cap += o.popBonus; }); gameState.population.max = cap; gameState.population.current = gameState.workers.length + gameState.soldiers.length; updateUI(); }
function updateCamera(dt) { const s = 500 * dt; if(gameState.keys.w) gameState.camera.y -= s; if(gameState.keys.s) gameState.camera.y += s; if(gameState.keys.a) gameState.camera.x -= s; if(gameState.keys.d) gameState.camera.x += s; gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, GameConfig.worldWidth - GameConfig.screenWidth)); gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, GameConfig.worldHeight - GameConfig.screenHeight)); }
function getMouseWorldPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) + gameState.camera.x, y: (e.clientY - r.top) + gameState.camera.y }; }
function updateUI() { ui.res.pop.innerText = `${gameState.population.current}/${gameState.population.max}`; ui.res.food.innerText = Math.floor(gameState.resources.food); ui.res.wood.innerText = Math.floor(gameState.resources.wood); ui.res.stone.innerText = Math.floor(gameState.resources.stone); ui.res.iron.innerText = Math.floor(gameState.resources.iron); ui.btns.trainArcher.disabled = !hasBuilding('BOWYER'); ui.btns.buildWall.disabled = !hasBuilding('MASON'); }

// === LOGIKK ===
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
    updateProjectiles(dt);
    updateEffects(dt);
    
    gameState.workers.forEach(w => updateWorker(w, dt));
    gameState.soldiers.forEach(s => updateSoldier(s, dt));
    for (let i = gameState.enemies.length - 1; i >= 0; i--) { updateEnemy(gameState.enemies[i], dt, i); }
    calculatePopulation();
}

function updateWave(dt) {
    gameState.wave.timer -= dt;
    if (gameState.wave.timer <= 0) { spawnWave(gameState.wave.number); gameState.wave.number++; gameState.wave.timer = GameConfig.waveInterval; }
    const m = Math.floor(gameState.wave.timer / 60); const s = Math.floor(gameState.wave.timer % 60);
    ui.wave.num.innerText = gameState.wave.number; ui.wave.timer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function spawnWave(waveNum) {
    ui.msg.innerText = `Bølge ${waveNum} angriper!`;
    const count = 3 + Math.floor(waveNum * 2.5);
    for (let i = 0; i < count; i++) {
        let ex, ey; const side = Math.floor(Math.random() * 4);
        if (side === 0) { ex = randomRange(0, GameConfig.worldWidth); ey = -50; }
        else if (side === 1) { ex = randomRange(0, GameConfig.worldWidth); ey = GameConfig.worldHeight + 50; }
        else if (side === 2) { ex = -50; ey = randomRange(0, GameConfig.worldHeight); }
        else { ex = GameConfig.worldWidth + 50; ey = randomRange(0, GameConfig.worldHeight); }
        gameState.enemies.push({ id: Math.random(), type: 'enemy', x: ex, y: ey, w: 32, h: 32, speed: 40, hp: 50 + (waveNum * 10), maxHp: 50 + (waveNum * 10), damage: 5 + waveNum, state: 'MOVING', animState: 'walk', animFrame: 0, animTimer: 0, spriteId: 'enemy', attackTimer: 0 });
    }
}

function updateEnemy(e, dt, idx) {
    if (e.hp <= 0) { gameState.enemies.splice(idx, 1); return; }
    if (e.flashTimer > 0) e.flashTimer -= dt; // Skade-effekt

    let target = gameState.keep;
    let action = 'MOVING';
    
    let nearSoldier = null;
    gameState.soldiers.forEach(s => { if(dist(e.x, e.y, s.x, s.y) < 100) nearSoldier = s; });
    if (nearSoldier) target = nearSoldier;
    
    const dx = target.x - e.x; const dy = target.y - e.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    e.facingRight = dx > 0;

    if (d < 40) {
        action = 'ATTACKING';
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
            target.hp -= e.damage;
            e.attackTimer = 1.5;
            spawnEffect((e.x+target.x)/2, (e.y+target.y)/2, 'slash');
            if (target.type === 'soldier' && target.hp <= 0) { const sIdx = gameState.soldiers.indexOf(target); if (sIdx > -1) gameState.soldiers.splice(sIdx, 1); }
            if (target.type === 'building' && target.hp <= 0 && target.subType === 'keep') { alert("GAME OVER!"); location.reload(); }
        }
    } else {
        let wall = null;
        gameState.worldObjects.forEach(o => { if ((o.type==='wall'||o.type==='building') && o.built && dist(e.x, e.y, o.x, o.y) < 30) wall = o; });
        if (wall) {
            action = 'ATTACKING';
            e.attackTimer -= dt;
            if (e.attackTimer <= 0) {
                wall.hp -= e.damage; e.attackTimer = 1.0; spawnEffect((e.x+wall.x)/2, (e.y+wall.y)/2, 'slash');
                if (wall.hp <= 0) { const wIdx = gameState.worldObjects.indexOf(wall); if (wIdx > -1) gameState.worldObjects.splice(wIdx, 1); }
            }
        } else {
            e.x += (dx/d)*e.speed*dt; e.y += (dy/d)*e.speed*dt;
        }
    }
    e.animTimer += dt; const def = Assets.definitions[e.spriteId]; e.animState = action === 'ATTACKING' ? 'attack' : 'walk';
    if(e.animTimer >= (1/def.fps)) { e.animTimer=0; e.animFrame=(e.animFrame+1)%def.anims[e.animState].length; }
}

function updateSoldier(s, dt) {
    if (dist(s.x, s.y, gameState.keep.x, gameState.keep.y) < 150 && s.hp < s.maxHp) s.hp += 5 * dt;
    if (s.cooldownTimer > 0) s.cooldownTimer -= dt;

    // Kamp-logikk (Auto-scan)
    let target = null;
    let minDist = Infinity;
    
    // Hvis vi har et spesifikt angrepsmål, bruk det
    if (s.jobType === 'ATTACK_TARGET' && s.target && s.target.hp > 0) {
        target = s.target;
        minDist = dist(s.x, s.y, target.x, target.y);
    } else {
        // Ellers scan etter nærmeste
        gameState.enemies.forEach(e => {
            const d = dist(s.x, s.y, e.x, e.y);
            if (d < minDist) { minDist = d; target = e; }
        });
    }

    let isAttacking = false;
    
    if (target && minDist <= s.stats.range) {
        // Vi er i range! Stopp og skyt.
        s.facingRight = target.x > s.x;
        isAttacking = true;
        
        if (s.cooldownTimer <= 0) {
            s.cooldownTimer = s.stats.cooldown;
            
            if (s.stats.projectile) {
                spawnProjectile(s, target, s.stats.damage);
            } else {
                target.hp -= s.stats.damage;
                target.flashTimer = 0.2; // Visuell skade
                spawnEffect((s.x+target.x)/2, (s.y+target.y)/2, 'slash');
            }
        }
    }

    // Bevegelse (Kun hvis vi ikke angriper, eller hvis vi må gå nærmere)
    if (!isAttacking && s.state === 'MOVING' && s.target) {
        const tPos = s.target.x !== undefined ? s.target : s.target; // Håndter objekt eller {x,y}
        const dx = tPos.x - s.x; const dy = tPos.y - s.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        
        // Stopp hvis fremme (eller i range hvis angrep)
        const stopDist = (s.jobType === 'ATTACK_TARGET') ? s.stats.range - 10 : 5;

        if (d > stopDist) {
            s.x += (dx/d)*s.speed*dt; s.y += (dy/d)*s.speed*dt; s.facingRight = dx > 0;
        } else {
            if (s.jobType === 'GARRISON' && s.target.type === 'wall') { s.garrisoned = true; s.state = 'IDLE'; }
            else if (s.jobType !== 'ATTACK_TARGET') { s.state = 'IDLE'; }
        }
    } else if (isAttacking) {
        // Stå i ro mens man angriper
    }

    // Animasjon
    s.animState = isAttacking ? 'attack' : (s.state === 'MOVING' && !isAttacking ? 'walk' : 'idle');
    const def = Assets.definitions[s.spriteId];
    s.animTimer += dt; if (s.animTimer >= (1/def.fps)) { s.animTimer = 0; s.animFrame = (s.animFrame+1) % def.anims[s.animState].length; }
}

function updateWorker(w, dt) {
    // (Samme logikk som før, forkortet for plass)
    const isMoving = w.state === 'MOVING'; const isWorking = ['GATHERING','BUILDING','REPAIRING'].includes(w.state);
    w.animState = isWorking ? 'work' : (isMoving ? 'walk' : 'idle');
    const def = Assets.definitions[w.spriteId]; w.animTimer += dt; if (w.animTimer >= (1/def.fps)) { w.animTimer = 0; w.animFrame = (w.animFrame+1) % def.anims[w.animState].length; }
    if (w.state === 'IDLE') return;
    if (w.state === 'MOVING') {
        const dx = w.target.x - w.x; const dy = w.target.y - w.y; const d = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) { w.x += (dx/d)*w.speed*dt; w.y += (dy/d)*w.speed*dt; w.facingRight = dx > 0; }
        else {
            if (w.jobType === 'GATHER') { w.state = 'GATHERING'; w.gatherTimer = w.target.harvestTime; }
            else if (w.jobType === 'BUILD') w.state = 'BUILDING';
            else if (w.jobType === 'REPAIR') w.state = 'REPAIRING';
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
        if (!w.target || w.target.built) { const nb = findNearbyBlueprint(w); if(nb){w.target=nb; w.state='MOVING'; w.jobType='BUILD';} else w.state='IDLE'; return; }
        w.target.progress += (100 / w.target.buildTime) * dt; if (w.target.progress >= 100) { w.target.progress = 100; w.target.built = true; }
    }
    else if (w.state === 'DEPOSITING') {
        gameState.resources[w.carryType] += w.carryAmount; w.carryAmount = 0; w.carryType = null;
        if (w.lastResourcePos) {
            let near = null, minDist = Infinity;
            gameState.worldObjects.forEach(o => { if(o.type === 'resource' && o.resType === w.lastResourcePos.type) { const d = dist(w.lastResourcePos.x, w.lastResourcePos.y, o.x, o.y); if(d < minDist) { minDist = d; near = o; } } });
            if (near && minDist < 300) { w.state = 'MOVING'; w.target = near; w.jobType = 'GATHER'; } else w.state = 'IDLE';
        } else w.state = 'IDLE';
    }
    else if (w.state === 'REPAIRING') {
        if (!w.target || w.target.hp >= w.target.maxHp) { w.state = 'IDLE'; return; }
        w.target.hp += 20 * dt; if (w.target.hp > w.target.maxHp) w.target.hp = w.target.maxHp;
    }
}

function findNearbyBlueprint(worker) {
    let found = null; let minDist = 300;
    gameState.worldObjects.forEach(o => { if ((o.type === 'wall' || o.type === 'building') && !o.built) { const d = dist(worker.x, worker.y, o.x, o.y); if (d < minDist) { minDist = d; found = o; } } });
    return found;
}

// === EFFECTS & PROJECTILES ===
function spawnProjectile(source, target, damage) {
    gameState.projectiles.push({ x: source.x, y: source.y, target: target, damage: damage, speed: 250, active: true });
}
function updateProjectiles(dt) {
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
        const p = gameState.projectiles[i];
        if (!p.active || p.target.hp <= 0) { gameState.projectiles.splice(i, 1); continue; }
        const dx = p.target.x - p.x; const dy = p.target.y - p.y; const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 10) { 
            p.target.hp -= p.damage; p.target.flashTimer = 0.2; p.active = false; 
        } else {
            p.x += (dx/d)*p.speed*dt; p.y += (dy/d)*p.speed*dt; p.angle = Math.atan2(dy, dx);
        }
    }
}
function spawnEffect(x, y, type) { gameState.effects.push({ x: x, y: y, type: type, life: 0.2 }); }
function updateEffects(dt) {
    for (let i = gameState.effects.length - 1; i >= 0; i--) {
        const e = gameState.effects[i]; e.life -= dt; if (e.life <= 0) gameState.effects.splice(i, 1);
    }
}

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

        // Flash effect on hit
        if (obj.flashTimer > 0) ctx.filter = "brightness(2.0)";

        if (obj.type === 'building' || obj.type === 'wall') {
            const img = Assets.sprites[obj.spriteId];
            if (img) ctx.drawImage(img, obj.x-16, obj.y-16);
            else { ctx.fillStyle=obj.color; ctx.fillRect(obj.x-16, obj.y-16, 32, 32); }
            if (!obj.built && obj.type !== 'resource') {
                ctx.fillStyle = "black"; ctx.fillRect(obj.x-16, obj.y-22, 32, 4);
                ctx.fillStyle = "yellow"; ctx.fillRect(obj.x-16, obj.y-22, 32 * (obj.progress/100), 4);
            }
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
            
            // Selection Circle
            if (gameState.selectedUnits.includes(obj)) { 
                ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(obj.x, obj.y, 15, 0, Math.PI*2); ctx.stroke(); 
            }
            
            if (dist(obj.x, obj.y, gameState.keep.x, gameState.keep.y) < 150 && obj.hp < (obj.maxHp || 100) && obj.type === 'soldier') {
                ctx.fillStyle = "#2ecc71"; ctx.font="10px Arial"; ctx.fillText("++", obj.x+10, obj.y-10);
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
        ctx.filter = "none";
    });

    // Projectiles
    gameState.projectiles.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = "#fff"; ctx.fillRect(-5, -1, 10, 2); ctx.fillStyle = "#aaa"; ctx.fillRect(2, -2, 3, 4);
        ctx.restore();
    });

    // Effects
    gameState.effects.forEach(e => {
        if (e.type === 'slash') { ctx.strokeStyle = `rgba(255,255,255,${e.life*5})`; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(e.x, e.y, 15, 0, Math.PI*2); ctx.stroke(); }
        if (e.type === 'click') { ctx.strokeStyle = `rgba(0,255,0,${e.life*5})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(e.x, e.y, 10 - (e.life*20), 0, Math.PI*2); ctx.stroke(); }
    });

    // Selection Box
    if (gameState.selectionBox.active) {
        ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 1; ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
        const w = gameState.selectionBox.curX - gameState.selectionBox.startX;
        const h = gameState.selectionBox.curY - gameState.selectionBox.startY;
        ctx.fillRect(gameState.selectionBox.startX, gameState.selectionBox.startY, w, h);
        ctx.strokeRect(gameState.selectionBox.startX, gameState.selectionBox.startY, w, h);
    }

    // Build Preview
    if (gameState.buildMode && gameState.dragStart && !['HOUSE','BOWYER','MASON'].includes(gameState.buildMode)) {
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
    if (entity.hp < (entity.maxHp||100)) { ctx.fillStyle = "red"; ctx.fillRect(-10, -20, 20, 4); ctx.fillStyle = "#00ff00"; ctx.fillRect(-10, -20, 20 * (entity.hp/(entity.maxHp||100)), 4); }
    ctx.restore();
}

window.onload = init;
/* Version: #23 */
