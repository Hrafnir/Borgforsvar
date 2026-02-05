/* Version: #21 - Fix: Restore Worker Commands */

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
    debugMode: false
};

const ResourceTypes = {
    TREE: { type: 'wood', color: '#27ae60', name: 'Tre', capacity: 100, harvestTime: 1.0, icon: '🌲' },
    STONE: { type: 'stone', color: '#95a5a6', name: 'Stein', capacity: 200, harvestTime: 1.5, icon: '🪨' },
    IRON: { type: 'iron', color: '#2c3e50', name: 'Jern', capacity: 300, harvestTime: 2.0, icon: '⚔️' },
    BERRY: { type: 'food', color: '#e74c3c', name: 'Bærbusk', capacity: 50, harvestTime: 0.5, icon: '🍖' }
};

const Buildings = {
    // Forsvar
    PALISADE: { name: "Palisade", costType: 'wood', cost: 5, hp: 100, spriteId: 'spr_palisade', buildTime: 2.0 },
    WALL:     { name: "Steinmur", costType: 'stone', cost: 5, hp: 300, spriteId: 'spr_wall', buildTime: 4.0, req: 'MASON' },
    // Sivil
    HOUSE:    { name: "Hus", costType: 'wood', cost: 20, hp: 50, spriteId: 'spr_house', buildTime: 5.0, popBonus: 5 },
    // Tech
    BOWYER:   { name: "Bueskytterverksted", costType: 'wood', cost: 50, hp: 100, spriteId: 'spr_bowyer', buildTime: 8.0, tech: 'BOWYER' },
    MASON:    { name: "Steinhuggeri", costType: 'wood', cost: 50, hp: 100, spriteId: 'spr_mason', buildTime: 8.0, tech: 'MASON' }
};

const UnitTypes = {
    peasant: { name: "Fotsoldat", cost: { food: 50 }, damage: 5, range: 120, cooldown: 1.0, spriteId: 'peasant', speed: 60 },
    archer:  { name: "Bueskytter", cost: { food: 50, wood: 25 }, damage: 8, range: 300, cooldown: 1.5, spriteId: 'archer', speed: 70, req: 'BOWYER' },
    knight:  { name: "Ridder", cost: { food: 50, iron: 20 }, damage: 20, range: 120, cooldown: 0.8, spriteId: 'knight', speed: 50 }
};

// === ASSETS ===
const Assets = {
    sprites: {},
    definitions: {
        worker: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], work: [5,6] } },
        peasant: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        archer: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } },
        knight: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], attack: [5,6] } }
    }
};

// === SPILL-TILSTAND ===
let gameState = {
    resources: { food: 200, wood: 100, stone: 50, iron: 0 },
    population: { current: 0, max: 0 },
    camera: { x: 500, y: 500 },
    
    worldObjects: [],
    workers: [],      
    soldiers: [],
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
    console.log("Initialiserer Stronghold Update (v21 - Fix)...");
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
    // Stick Figures
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

    // Bygninger
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
    gameState.keep = { id: 'keep', type: 'building', subType: 'keep', x: GameConfig.worldWidth/2, y: GameConfig.worldHeight/2, w: 100, h: 100, color: '#8e44ad', built: true, progress: 100, hp: 1000 };
    gameState.worldObjects.push(gameState.keep);
    gameState.camera.x = gameState.keep.x - GameConfig.screenWidth/2; gameState.camera.y = gameState.keep.y - GameConfig.screenHeight/2;
    const cy = GameConfig.worldHeight/2;
    for(let i=0; i<60; i++) spawnResource(ResourceTypes.TREE, randomRange(0, 2000), randomRange(cy-300, 2000));
    for(let i=0; i<20; i++) spawnResource(ResourceTypes.STONE, randomRange(1200, 2000), randomRange(cy+200, 2000));
    for(let i=0; i<30; i++) spawnResource(ResourceTypes.BERRY, randomRange(600, 1400), randomRange(cy, cy+500));
}

function spawnResource(def, x, y) { gameState.worldObjects.push({ id: Math.random().toString(36), type: 'resource', resType: def.type, name: def.name, color: def.color, icon: def.icon, capacity: def.capacity, amount: def.capacity, harvestTime: def.harvestTime, x: x, y: y, w: 32, h: 32 }); }
function spawnWorker(x, y) { gameState.workers.push({ id: Math.random().toString(36), type: 'worker', name: 'Arbeider', x: x, y: y, w: 32, h: 32, speed: 90, state: 'IDLE', target: null, carryType: null, carryAmount: 0, maxCarry: 10, gatherTimer: 0, spriteId: 'worker', animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true }); }
function spawnSoldier(def, x, y) { gameState.soldiers.push({ id: Math.random().toString(36), type: 'soldier', name: def.name, x: x, y: y, w: 32, h: 32, speed: def.speed, stats: def, state: 'IDLE', target: null, spriteId: def.spriteId, animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true, hp: 100, garrisoned: false }); }

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

// === KOMMANDOER (Den manglende delen!) ===
function handleWorkerCommand(w, wx, wy) {
    let target = null;
    gameState.worldObjects.forEach(o => { if(dist(wx, wy, o.x, o.y) < 25) target = o; });
    
    if (target) {
        if (target.type === 'resource') {
            w.state = 'MOVING'; w.target = target; w.jobType = 'GATHER';
            ui.msg.innerText = "Samler ressurser.";
        } else if ((target.type === 'wall' || target.type === 'building') && !target.built) {
            w.state = 'MOVING'; w.target = target; w.jobType = 'BUILD';
            ui.msg.innerText = "Går for å bygge.";
        } else {
            w.state = 'MOVING'; w.target = {x: wx, y: wy}; w.jobType = 'MOVE';
            ui.msg.innerText = "Går.";
        }
    } else {
        w.state = 'MOVING'; w.target = {x: wx, y: wy}; w.jobType = 'MOVE';
        ui.msg.innerText = "Går.";
    }
}

function handleSoldierCommand(s, wx, wy) {
    let wall = null;
    gameState.worldObjects.forEach(o => {
        if ((o.type === 'wall') && o.built && dist(wx, wy, o.x, o.y) < 20) wall = o;
    });

    if (wall) {
        s.target = wall; s.state = 'MOVING'; s.jobType = 'GARRISON';
        ui.msg.innerText = "Går til post på mur.";
    } else {
        s.target = {x: wx, y: wy}; s.state = 'MOVING'; s.jobType = 'MOVE';
        s.garrisoned = false;
        ui.msg.innerText = "Soldat flytter seg.";
    }
}

// === TECH TREE & CHECKS ===
function hasBuilding(tech) {
    if (!tech) return true;
    return gameState.worldObjects.some(o => o.type === 'building' && o.tech === tech && o.built);
}

function attemptSetBuildMode(mode) {
    if (Buildings[mode].req && !hasBuilding(Buildings[mode].req)) { ui.msg.innerText = `Krever ${Buildings[Buildings[mode].req].name}!`; return; }
    setBuildMode(mode);
}

function attemptTrainSoldier(type) {
    if (UnitTypes[type].req && !hasBuilding(UnitTypes[type].req)) { ui.msg.innerText = `Krever ${Buildings[UnitTypes[type].req].name}!`; return; }
    convertWorkerToSoldier(type);
}

// === BYGGING & POPULATION ===
function attemptCreateWorker() {
    if (gameState.population.current >= gameState.population.max) { ui.msg.innerText = "Befolkningsgrense nådd! Bygg hus."; return; }
    if (gameState.resources.food >= 50) {
        gameState.resources.food -= 50; spawnWorker(gameState.keep.x, gameState.keep.y + 60); updateUI(); ui.msg.innerText = "Ny arbeider!";
    } else ui.msg.innerText = "Mangler mat (50).";
}

function convertWorkerToSoldier(type) {
    const def = UnitTypes[type];
    let canAfford = true; for (let res in def.cost) if (gameState.resources[res] < def.cost[res]) canAfford = false;
    if (!canAfford) { ui.msg.innerText = "Mangler ressurser."; return; }
    let candidate = gameState.workers.find(w => w.state === 'IDLE');
    if (!candidate) { ui.msg.innerText = "Ingen ledige arbeidere!"; return; }
    for (let res in def.cost) gameState.resources[res] -= def.cost[res];
    const idx = gameState.workers.indexOf(candidate); gameState.workers.splice(idx, 1);
    spawnSoldier(def, candidate.x, candidate.y);
    updateUI(); ui.msg.innerText = `${def.name} klar!`;
}

function setBuildMode(mode) {
    gameState.buildMode = mode; gameState.dragStart = null;
    document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
    ui.btnCancel.classList.add('hidden');
    if (mode) { ui.msg.innerText = `BYGG: ${mode}.`; ui.btnCancel.classList.remove('hidden'); }
}

function snapToGrid(x, y) { return { x: Math.floor(x/GameConfig.tileSize)*GameConfig.tileSize, y: Math.floor(y/GameConfig.tileSize)*GameConfig.tileSize }; }

function placeSingleBuilding(pos, type) {
    const def = Buildings[type];
    if (gameState.resources[def.costType] < def.cost) { ui.msg.innerText = "Mangler ressurser."; return; }
    gameState.resources[def.costType] -= def.cost; updateUI();
    gameState.worldObjects.push({
        id: Math.random().toString(36), type: 'building', subType: type, x: pos.x+16, y: pos.y+16, w: 32, h: 32,
        spriteId: def.spriteId, hp: def.hp, maxHp: def.hp, built: false, progress: 0, buildTime: def.buildTime, popBonus: def.popBonus||0, tech: def.tech
    });
    ui.msg.innerText = "Bygging startet.";
}

function placeWallBlueprints(start, end) {
    const typeDef = Buildings[gameState.buildMode];
    const dx = end.x - start.x; const dy = end.y - start.y;
    const distVal = dist(0, 0, dx, dy);
    const count = Math.ceil(distVal / GameConfig.tileSize);
    if (count <= 0) return;
    const totalCost = count * typeDef.cost;
    if (gameState.resources[typeDef.costType] < totalCost) { ui.msg.innerText = "Mangler ressurser."; return; }
    gameState.resources[typeDef.costType] -= totalCost; updateUI();

    for (let i = 0; i <= count; i++) {
        const factor = count === 0 ? 0 : i / count;
        const wx = start.x + dx * factor; const wy = start.y + dy * factor;
        const gridPos = snapToGrid(wx, wy);
        let blocked = false; gameState.worldObjects.forEach(obj => { if (dist(gridPos.x+16, gridPos.y+16, obj.x, obj.y) < 10) blocked = true; });
        if (!blocked) {
            gameState.worldObjects.push({
                id: Math.random().toString(36), type: 'wall', subType: gameState.buildMode, spriteId: typeDef.spriteId,
                x: gridPos.x+16, y: gridPos.y+16, w: 32, h: 32, hp: typeDef.hp, built: false, progress: 0, buildTime: typeDef.buildTime
            });
        }
    }
    ui.msg.innerText = "Mur planlagt.";
}

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
    gameState.workers.forEach(w => updateWorker(w, dt));
    gameState.soldiers.forEach(s => updateSoldier(s, dt));
    calculatePopulation();
}

function calculatePopulation() {
    let cap = 5; gameState.worldObjects.forEach(o => { if (o.type === 'building' && o.subType === 'HOUSE' && o.built) cap += o.popBonus; });
    gameState.population.max = cap; gameState.population.current = gameState.workers.length + gameState.soldiers.length;
    updateUI();
}

function updateCamera(dt) {
    const s = 500 * dt;
    if(gameState.keys.w) gameState.camera.y -= s; if(gameState.keys.s) gameState.camera.y += s;
    if(gameState.keys.a) gameState.camera.x -= s; if(gameState.keys.d) gameState.camera.x += s;
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, GameConfig.worldWidth - GameConfig.screenWidth));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, GameConfig.worldHeight - GameConfig.screenHeight));
}

function updateWorker(w, dt) {
    const isMoving = w.state === 'MOVING'; const isWorking = w.state === 'GATHERING' || w.state === 'BUILDING';
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
            if (nextBuild) { w.target = nextBuild; w.state = 'MOVING'; w.jobType = 'BUILD'; }
            else { w.state = 'IDLE'; }
            return;
        }
        w.target.progress += (100 / w.target.buildTime) * dt;
        if (w.target.progress >= 100) { w.target.progress = 100; w.target.built = true; }
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

function findNearbyBlueprint(worker) {
    let found = null; let minDist = 300;
    gameState.worldObjects.forEach(o => {
        if ((o.type === 'wall' || o.type === 'building') && !o.built) {
            const d = dist(worker.x, worker.y, o.x, o.y);
            if (d < minDist) { minDist = d; found = o; }
        }
    });
    return found;
}

function updateSoldier(s, dt) {
    const isMoving = s.state === 'MOVING';
    s.animState = isMoving ? 'walk' : 'idle';
    const def = Assets.definitions[s.spriteId];
    s.animTimer += dt; if (s.animTimer >= (1/def.fps)) { s.animTimer = 0; s.animFrame = (s.animFrame+1) % def.anims[s.animState].length; }

    if (s.state === 'MOVING' && s.target) {
        const dx = s.target.x - s.x; const dy = s.target.y - s.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) {
            s.x += (dx/d)*s.speed*dt; s.y += (dy/d)*s.speed*dt; s.facingRight = dx > 0;
        } else {
            if (s.jobType === 'GARRISON' && s.target.type === 'wall') { s.garrisoned = true; s.state = 'IDLE'; }
            else { s.state = 'IDLE'; }
        }
    }
}

// === TEGNING ===
function draw() {
    ctx.fillStyle = "#1e272e"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.translate(-gameState.camera.x, -gameState.camera.y);

    ctx.fillStyle = "#2ecc71"; ctx.fillRect(0,0,GameConfig.worldWidth,GameConfig.worldHeight);
    
    const allObjects = [...gameState.worldObjects, ...gameState.workers, ...gameState.soldiers];
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
        } 
        else if (obj.type === 'resource') {
            ctx.font="24px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(obj.icon, obj.x, obj.y);
            const p = obj.amount/obj.capacity; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(obj.x-10, obj.y+15, 20, 3);
            ctx.fillStyle="#fff"; ctx.fillRect(obj.x-10, obj.y+15, 20*p, 3);
        } 
        else if (obj.type === 'worker' || obj.type === 'soldier') {
            const yOffset = obj.garrisoned ? -12 : 0;
            ctx.save(); ctx.translate(0, yOffset);
            drawSprite(obj);
            if (obj.carryType) { ctx.font="12px Arial"; const ic = obj.carryType==='wood'?'🌲':(obj.carryType==='stone'?'🪨':'🍖'); ctx.fillText(ic, obj.x, obj.y-20); }
            if (gameState.selectedEntity === obj) { ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(obj.x, obj.y, 15, 0, Math.PI*2); ctx.stroke(); }
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
        ctx.globalAlpha = 0.5; 
        const sprite = Buildings[gameState.buildMode].spriteId;
        if(Assets.sprites[sprite]) ctx.drawImage(Assets.sprites[sprite], pos.x, pos.y);
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
}

function drawSprite(entity) {
    const def = Assets.definitions[entity.spriteId];
    const img = Assets.sprites[entity.spriteId];
    if (!img || !def) return;
    const idx = def.anims[entity.animState];
    const frame = idx[entity.animFrame % idx.length];
    const sx = frame * def.w;
    ctx.save(); ctx.translate(entity.x, entity.y);
    if (!entity.facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 10, 8, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.drawImage(img, sx, 0, def.w, def.h, -def.w/2, -def.h/2, def.w, def.h);
    ctx.restore();
}

function getMouseWorldPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) + gameState.camera.x, y: (e.clientY - r.top) + gameState.camera.y }; }
function selectEntity(wx, wy) {
    let f = null; [...gameState.workers, ...gameState.soldiers].forEach(u => { if(dist(wx, wy, u.x, u.y)<20) f=u; });
    if(!f) gameState.worldObjects.forEach(o => { if(dist(wx, wy, o.x, o.y)<20) f=o; });
    gameState.selectedEntity = f;
    ui.selection.innerText = f ? `${f.type} ${f.name || ''}` : "Ingen valgt";
}
function updateUI() {
    ui.res.pop.innerText = `${gameState.population.current}/${gameState.population.max}`;
    ui.res.food.innerText = Math.floor(gameState.resources.food);
    ui.res.wood.innerText = Math.floor(gameState.resources.wood);
    ui.res.stone.innerText = Math.floor(gameState.resources.stone);
    ui.res.iron.innerText = Math.floor(gameState.resources.iron);
    ui.btns.trainArcher.disabled = !hasBuilding('BOWYER');
    ui.btns.buildWall.disabled = !hasBuilding('MASON');
}

window.onload = init;
/* Version: #21 */
