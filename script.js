/* Version: #17 - Stick Figures & Wall Building */

// === KONFIGURASJON ===
const GameConfig = {
    screenWidth: 1000,
    screenHeight: 600,
    worldWidth: 2000,
    worldHeight: 2000,
    tileSize: 32, // Grid størrelse for bygging
    debugMode: false
};

const ResourceTypes = {
    TREE: { type: 'wood', color: '#27ae60', name: 'Tre', capacity: 100, harvestTime: 1.0, icon: '🌲' },
    STONE: { type: 'stone', color: '#95a5a6', name: 'Stein', capacity: 200, harvestTime: 1.5, icon: '🪨' },
    IRON: { type: 'iron', color: '#2c3e50', name: 'Jern', capacity: 300, harvestTime: 2.0, icon: '⚔️' },
    BERRY: { type: 'food', color: '#e74c3c', name: 'Bærbusk', capacity: 50, harvestTime: 0.5, icon: '🍖' }
};

const Buildings = {
    PALISADE: { name: "Palisade", costType: 'wood', cost: 5, hp: 100, color: '#8d6e63' },
    WALL:     { name: "Steinmur", costType: 'stone', cost: 5, hp: 300, color: '#7f8c8d' }
};

// === ASSETS (STICK FIGURES) ===
const Assets = {
    sprites: {},
    definitions: {
        worker: { w: 32, h: 32, fps: 8, anims: { idle: [0], walk: [1,2,3,4], work: [5,6] } }
    }
};

// === SPILL-TILSTAND ===
let gameState = {
    resources: { food: 100, wood: 100, stone: 50, iron: 0 },
    camera: { x: 500, y: 500 },
    
    worldObjects: [], 
    workers: [],      
    keep: null,       
    
    // Input & Modes
    selectedEntity: null,
    keys: { w: false, a: false, s: false, d: false },
    
    buildMode: null, // 'PALISADE', 'WALL' eller null
    dragStart: null, // {x, y} i verdenskoordinater
    mouseWorld: { x: 0, y: 0 }, // Musens posisjon i verden akkurat nå
    
    lastTime: 0
};

// === DOM ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const uiResources = {
    food: document.getElementById('res-food'),
    wood: document.getElementById('res-wood'),
    stone: document.getElementById('res-stone'),
    iron: document.getElementById('res-iron')
};
const uiSelection = document.getElementById('selection-info');
const uiMessage = document.getElementById('status-message');
const btnCancel = document.getElementById('btn-cancel-action');

// === INITIALISERING ===
function init() {
    console.log("Initialiserer RTS Fase 2...");
    generatePlaceholderSprites();
    createWorld();
    
    // Start med 2 arbeidere
    spawnWorker(gameState.keep.x + 50, gameState.keep.y + 50);
    spawnWorker(gameState.keep.x - 50, gameState.keep.y + 50);
    
    setupInput();
    updateUI();
    requestAnimationFrame(gameLoop);
}

// === GRAFIKK GENERATOR (STICK FIGURES) ===
function generatePlaceholderSprites() {
    const createSheet = (id, color, size) => {
        const c = document.createElement('canvas');
        c.width = size * 8; c.height = size;
        const x = c.getContext('2d');
        
        const drawFrame = (idx, legOff, armAction) => {
            const ox = idx * size; const cx = ox + size/2; const cy = size/2;
            x.fillStyle = color; x.strokeStyle = color; x.lineWidth = 2;
            // Hode
            x.beginPath(); x.arc(cx, cy - (size*0.25), size*0.15, 0, Math.PI*2); x.fill();
            // Kropp
            x.beginPath(); x.moveTo(cx, cy - (size*0.1)); x.lineTo(cx, cy + (size*0.2)); x.stroke();
            // Ben
            x.beginPath(); x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx - (size*0.1) + legOff, cy + (size*0.45));
            x.moveTo(cx, cy + (size*0.2)); x.lineTo(cx + (size*0.1) - legOff, cy + (size*0.45)); x.stroke();
            // Armer
            x.beginPath();
            if (armAction) { // Jobber (Hugger/Bærer)
                x.moveTo(cx, cy); x.lineTo(cx + (size*0.3), cy - (size*0.1)); 
                x.moveTo(cx, cy); x.lineTo(cx + (size*0.3), cy + (size*0.1));
            } else {
                x.moveTo(cx, cy); x.lineTo(cx - (size*0.15), cy + (size*0.15) - legOff);
                x.moveTo(cx, cy); x.lineTo(cx + (size*0.15), cy + (size*0.15) + legOff);
            }
            x.stroke();
        };

        // Idle
        drawFrame(0, 0, false);
        // Walk
        drawFrame(1, -5, false); drawFrame(2, 0, false); drawFrame(3, 5, false); drawFrame(4, 0, false);
        // Work
        drawFrame(5, 0, true); drawFrame(6, 0, true);

        const img = new Image(); img.src = c.toDataURL();
        Assets.sprites[id] = img;
    };
    // Gul arbeider
    createSheet('worker', '#f1c40f', 32);
}

// === VERDEN ===
function createWorld() {
    gameState.keep = {
        id: 'keep', type: 'building', subType: 'keep',
        x: GameConfig.worldWidth/2, y: GameConfig.worldHeight/2, w: 100, h: 100, color: '#8e44ad'
    };
    gameState.worldObjects.push(gameState.keep);
    
    // Senter kamera
    gameState.camera.x = gameState.keep.x - GameConfig.screenWidth/2;
    gameState.camera.y = gameState.keep.y - GameConfig.screenHeight/2;

    const cy = GameConfig.worldHeight/2;
    // Ressurser
    for(let i=0; i<60; i++) spawnResource(ResourceTypes.TREE, randomRange(0, 2000), randomRange(cy-300, 2000));
    for(let i=0; i<20; i++) spawnResource(ResourceTypes.STONE, randomRange(1200, 2000), randomRange(cy+200, 2000));
    for(let i=0; i<30; i++) spawnResource(ResourceTypes.BERRY, randomRange(600, 1400), randomRange(cy, cy+500));
}

function spawnResource(def, x, y) {
    gameState.worldObjects.push({
        id: Math.random().toString(36).substr(2,9), type: 'resource', resType: def.type,
        name: def.name, color: def.color, icon: def.icon, capacity: def.capacity, amount: def.capacity,
        harvestTime: def.harvestTime, x: x, y: y, w: 32, h: 32
    });
}

function spawnWorker(x, y) {
    gameState.workers.push({
        id: Math.random().toString(36).substr(2,9), type: 'worker', name: 'Arbeider',
        x: x, y: y, w: 32, h: 32, speed: 90,
        state: 'IDLE', target: null, carryType: null, carryAmount: 0, maxCarry: 10, gatherTimer: 0,
        // Animasjon
        spriteId: 'worker', animState: 'idle', animFrame: 0, animTimer: 0, facingRight: true
    });
}

// === INPUT ===
function setupInput() {
    canvas.addEventListener('mousedown', (e) => {
        const mouse = getMouseWorldPos(e);
        
        // HVIS BYGGEMODUS: Start å dra
        if (gameState.buildMode) {
            if (e.button === 0) {
                gameState.dragStart = snapToGrid(mouse.x, mouse.y);
            }
            return; // Ikke velg enheter mens vi bygger
        }

        // Ellers: Velg enhet
        if (e.button === 0) selectEntity(mouse.x, mouse.y);
    });

    canvas.addEventListener('mousemove', (e) => {
        gameState.mouseWorld = getMouseWorldPos(e);
    });

    canvas.addEventListener('mouseup', (e) => {
        // HVIS BYGGEMODUS: Fullfør mur
        if (gameState.buildMode && gameState.dragStart) {
            const end = snapToGrid(gameState.mouseWorld.x, gameState.mouseWorld.y);
            completeWallBuild(gameState.dragStart, end);
            gameState.dragStart = null; // Reset drag, men behold modus for å bygge mer
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (gameState.buildMode) return; // Ingen høyreklikk i byggemodus
        const mouse = getMouseWorldPos(e);
        if (gameState.selectedEntity && gameState.selectedEntity.type === 'worker') {
            handleWorkerCommand(gameState.selectedEntity, mouse.x, mouse.y);
        }
    });

    // Tastatur
    window.addEventListener('keydown', (e) => {
        if(e.key==='w') gameState.keys.w=true; if(e.key==='a') gameState.keys.a=true;
        if(e.key==='s') gameState.keys.s=true; if(e.key==='d') gameState.keys.d=true;
        if(e.key==='Escape') setBuildMode(null);
    });
    window.addEventListener('keyup', (e) => {
        if(e.key==='w') gameState.keys.w=false; if(e.key==='a') gameState.keys.a=false;
        if(e.key==='s') gameState.keys.s=false; if(e.key==='d') gameState.keys.d=false;
    });

    // UI Knapper
    document.getElementById('btn-create-worker').onclick = () => {
        if (gameState.resources.food >= 50) {
            gameState.resources.food -= 50;
            spawnWorker(gameState.keep.x, gameState.keep.y+60);
            updateUI(); uiMessage.innerText = "Ny arbeider!";
        } else uiMessage.innerText = "Mangler mat (50).";
    };

    document.getElementById('btn-build-palisade').onclick = () => setBuildMode('PALISADE');
    document.getElementById('btn-build-wall').onclick = () => setBuildMode('WALL');
    btnCancel.onclick = () => setBuildMode(null);
}

// === BYGGESYSTEM ===
function setBuildMode(mode) {
    gameState.buildMode = mode;
    gameState.dragStart = null;
    
    // Reset knapper
    document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
    btnCancel.classList.add('hidden');

    if (mode) {
        uiMessage.innerText = `BYGGEMODUS: ${mode}. Klikk og dra for å bygge. ESC for å avbryte.`;
        btnCancel.classList.remove('hidden');
        if(mode==='PALISADE') document.getElementById('btn-build-palisade').classList.add('active');
        if(mode==='WALL') document.getElementById('btn-build-wall').classList.add('active');
    } else {
        uiMessage.innerText = "Velg en arbeider.";
    }
}

function snapToGrid(x, y) {
    return {
        x: Math.floor(x / GameConfig.tileSize) * GameConfig.tileSize,
        y: Math.floor(y / GameConfig.tileSize) * GameConfig.tileSize
    };
}

function completeWallBuild(start, end) {
    const typeDef = Buildings[gameState.buildMode];
    
    // Beregn antall segmenter
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const count = Math.ceil(dist / GameConfig.tileSize); // Antall vegger

    if (count <= 0) return;

    const totalCost = count * typeDef.cost;
    
    // Sjekk råd
    if (gameState.resources[typeDef.costType] < totalCost) {
        uiMessage.innerText = `Mangler ressurser! Trenger ${totalCost} ${typeDef.costType}.`;
        return;
    }

    // Trekk ressurser
    gameState.resources[typeDef.costType] -= totalCost;
    updateUI();
    uiMessage.innerText = `Bygget ${count} ${typeDef.name} for ${totalCost} ressurser.`;

    // Plasser vegger
    for (let i = 0; i <= count; i++) {
        // Interpoler posisjon
        const factor = count === 0 ? 0 : i / count;
        const wx = start.x + dx * factor;
        const wy = start.y + dy * factor;
        
        // Snap hver del til grid
        const gridPos = snapToGrid(wx, wy);

        // Enkel kollisjonssjekk: Ikke bygg oppå borgen eller ressurser
        let blocked = false;
        gameState.worldObjects.forEach(obj => {
            if (dist(gridPos.x, gridPos.y, obj.x, obj.y) < 20) blocked = true;
        });

        if (!blocked) {
            gameState.worldObjects.push({
                id: Math.random().toString(36),
                type: 'wall',
                subType: gameState.buildMode, // 'PALISADE' el 'WALL'
                x: gridPos.x + GameConfig.tileSize/2, // Sentrer i tile
                y: gridPos.y + GameConfig.tileSize/2,
                w: GameConfig.tileSize, h: GameConfig.tileSize,
                color: typeDef.color,
                hp: typeDef.hp
            });
        }
    }
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
}

function updateCamera(dt) {
    const s = 500 * dt;
    if(gameState.keys.w) gameState.camera.y -= s; if(gameState.keys.s) gameState.camera.y += s;
    if(gameState.keys.a) gameState.camera.x -= s; if(gameState.keys.d) gameState.camera.x += s;
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, GameConfig.worldWidth - GameConfig.screenWidth));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, GameConfig.worldHeight - GameConfig.screenHeight));
}

function updateWorker(w, dt) {
    // Animasjon
    const isMoving = w.state === 'MOVING';
    const isWorking = w.state === 'GATHERING';
    
    if (isWorking) w.animState = 'work';
    else if (isMoving) w.animState = 'walk';
    else w.animState = 'idle';

    const def = Assets.definitions[w.spriteId];
    w.animTimer += dt;
    if (w.animTimer >= (1/def.fps)) {
        w.animTimer = 0;
        const frames = def.anims[w.animState];
        w.animFrame = (w.animFrame+1) % frames.length;
    }

    if (w.state === 'IDLE') return;

    if (w.state === 'MOVING') {
        const dx = w.target.x - w.x; const dy = w.target.y - w.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d > 5) {
            w.x += (dx/d)*w.speed*dt; w.y += (dy/d)*w.speed*dt;
            w.facingRight = dx > 0;
        } else {
            if (w.jobType === 'GATHER' && w.target.type === 'resource') { w.state = 'GATHERING'; w.gatherTimer = w.target.harvestTime; }
            else if (w.jobType === 'RETURN') w.state = 'DEPOSITING';
            else w.state = 'IDLE';
        }
    } else if (w.state === 'GATHERING') {
        w.gatherTimer -= dt;
        if (w.gatherTimer <= 0) {
            w.carryType = w.target.resType; w.carryAmount = w.maxCarry;
            w.target.amount -= w.maxCarry;
            if (w.target.amount <= 0) {
                const idx = gameState.worldObjects.indexOf(w.target);
                if (idx > -1) gameState.worldObjects.splice(idx, 1);
                w.target = null;
            }
            w.state = 'MOVING'; w.target = gameState.keep; w.jobType = 'RETURN';
            w.lastResourcePos = { x: w.x, y: w.y, type: w.carryType };
        }
    } else if (w.state === 'DEPOSITING') {
        gameState.resources[w.carryType] += w.carryAmount;
        w.carryAmount = 0; w.carryType = null; updateUI();
        // Finn ny ressurs
        if (w.lastResourcePos) {
            let near = null, minDist = Infinity;
            gameState.worldObjects.forEach(o => {
                if(o.type === 'resource' && o.resType === w.lastResourcePos.type) {
                    const d = dist(w.lastResourcePos.x, w.lastResourcePos.y, o.x, o.y);
                    if(d < minDist) { minDist = d; near = o; }
                }
            });
            if (near && minDist < 300) { w.state = 'MOVING'; w.target = near; w.jobType = 'GATHER'; }
            else w.state = 'IDLE';
        } else w.state = 'IDLE';
    }
}

// === TEGNING ===
function draw() {
    ctx.fillStyle = "#1e272e"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(-gameState.camera.x, -gameState.camera.y);

    // Bakke
    ctx.fillStyle = "#2ecc71"; ctx.fillRect(0,0,GameConfig.worldWidth,GameConfig.worldHeight);
    
    // Grid (svakt)
    ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth=1;
    for(let x=0; x<GameConfig.worldWidth; x+=32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,GameConfig.worldHeight); ctx.stroke(); }
    for(let y=0; y<GameConfig.worldHeight; y+=32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(GameConfig.worldWidth,y); ctx.stroke(); }

    // Objekter (Sorter etter Y for dybde)
    const allObjects = [...gameState.worldObjects, ...gameState.workers];
    allObjects.sort((a,b) => a.y - b.y);

    allObjects.forEach(obj => {
        if (obj.type === 'building') {
            ctx.fillStyle = obj.color; ctx.fillRect(obj.x-obj.w/2, obj.y-obj.h/2, obj.w, obj.h);
            ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.strokeRect(obj.x-obj.w/2, obj.y-obj.h/2, obj.w, obj.h);
            ctx.fillStyle="#fff"; ctx.font="14px Arial"; ctx.textAlign="center"; ctx.fillText("BORG", obj.x, obj.y);
        } else if (obj.type === 'resource') {
            ctx.font="24px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(obj.icon, obj.x, obj.y);
            // Bar
            const p = obj.amount/obj.capacity; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(obj.x-10, obj.y+15, 20, 3);
            ctx.fillStyle="#fff"; ctx.fillRect(obj.x-10, obj.y+15, 20*p, 3);
        } else if (obj.type === 'worker') {
            drawSprite(obj);
            if(obj.carryType) {
                 ctx.font="12px Arial"; const ic = obj.carryType==='wood'?'🌲':(obj.carryType==='stone'?'🪨':'🍖');
                 ctx.fillText(ic, obj.x, obj.y-20);
            }
            if(gameState.selectedEntity === obj) {
                ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(obj.x, obj.y, 15, 0, Math.PI*2); ctx.stroke();
            }
        } else if (obj.type === 'wall') {
            ctx.fillStyle = obj.color; 
            // Tegn murstein/palisade look
            ctx.fillRect(obj.x-obj.w/2, obj.y-obj.h/2, obj.w, obj.h);
            ctx.strokeStyle = "#000"; ctx.lineWidth=1;
            ctx.strokeRect(obj.x-obj.w/2, obj.y-obj.h/2, obj.w, obj.h);
            // Detaljer
            if (obj.subType === 'PALISADE') {
                ctx.beginPath(); ctx.moveTo(obj.x, obj.y-obj.h/2); ctx.lineTo(obj.x, obj.y+obj.h/2); ctx.stroke();
            }
        }
    });

    // TEGN "GHOST WALL" (PREVIEW) HVIS VI DRAR
    if (gameState.buildMode && gameState.dragStart) {
        const start = gameState.dragStart;
        const end = snapToGrid(gameState.mouseWorld.x, gameState.mouseWorld.y);
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(start.x + 16, start.y + 16); ctx.lineTo(end.x + 16, end.y + 16); ctx.stroke();
        
        // Vis kostnad ved musen
        const dx = end.x - start.x; const dy = end.y - start.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const count = Math.ceil(dist / GameConfig.tileSize);
        const cost = count * Buildings[gameState.buildMode].cost;
        
        ctx.fillStyle = "#fff"; ctx.font = "14px Arial";
        ctx.fillText(`${cost} ${Buildings[gameState.buildMode].costType}`, end.x, end.y - 10);
    }

    ctx.restore();
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
    ctx.restore();
}

// === HJELP ===
function getMouseWorldPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) + gameState.camera.x, y: (e.clientY - r.top) + gameState.camera.y };
}
function selectEntity(wx, wy) {
    let f = null;
    gameState.workers.forEach(w => { if(dist(wx, wy, w.x, w.y) < 20) f = w; });
    if(!f) gameState.worldObjects.forEach(o => { if(dist(wx, wy, o.x, o.y) < 20) f = o; });
    gameState.selectedEntity = f;
    uiSelection.innerText = f ? `${f.type} (${f.amount || f.state || ''})` : "Ingen valgt";
}
function handleWorkerCommand(w, wx, wy) {
    let res = null;
    gameState.worldObjects.forEach(o => { if(o.type==='resource' && dist(wx, wy, o.x, o.y)<25) res = o; });
    if(res) { w.state='MOVING'; w.target=res; w.jobType='GATHER'; uiMessage.innerText="Samler ressurser."; }
    else { w.state='MOVING'; w.target={x: wx, y: wy}; w.jobType='MOVE'; uiMessage.innerText="Går."; }
}
function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }
function randomRange(min, max) { return Math.random() * (max - min) + min; }
function updateUI() {
    uiResources.food.innerText = Math.floor(gameState.resources.food);
    uiResources.wood.innerText = Math.floor(gameState.resources.wood);
    uiResources.stone.innerText = Math.floor(gameState.resources.stone);
    uiResources.iron.innerText = Math.floor(gameState.resources.iron);
}

window.onload = init;
/* Version: #17 */
