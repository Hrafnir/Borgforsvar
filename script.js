/* Version: #14 - RTS Phase 1: Economy & World */

// === KONFIGURASJON ===
const GameConfig = {
    screenWidth: 1000,
    screenHeight: 600,
    worldWidth: 2000,  // Verden er større enn skjermen
    worldHeight: 2000,
    tileSize: 32,
    debugMode: false
};

// === RESSURSER OG OBJEKTER ===
const ResourceTypes = {
    TREE: { type: 'wood', color: '#27ae60', name: 'Tre', capacity: 100, harvestTime: 1.0, icon: '🌲' },
    STONE: { type: 'stone', color: '#95a5a6', name: 'Stein', capacity: 200, harvestTime: 1.5, icon: '🪨' },
    IRON: { type: 'iron', color: '#2c3e50', name: 'Jern', capacity: 300, harvestTime: 2.0, icon: '⚔️' },
    BERRY: { type: 'food', color: '#e74c3c', name: 'Bærbusk', capacity: 50, harvestTime: 0.5, icon: '🍖' }
};

// === SPILL-TILSTAND ===
let gameState = {
    // Økonomi
    resources: {
        food: 100,
        wood: 0,
        stone: 0,
        iron: 0,
        gold: 100
    },
    
    // Kamera
    camera: { x: 500, y: 500 }, // Starter sentrert rundt midten av verden
    
    // Verden
    worldObjects: [], // Trær, steiner, bygninger
    workers: [],      // Våre arbeidere
    keep: null,       // Referanse til borgen
    
    // Input
    selectedEntity: null,
    keys: { w: false, a: false, s: false, d: false },
    
    lastTime: 0
};

// === DOM & CANVAS ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiResources = {
    food: document.getElementById('res-food'),
    wood: document.getElementById('res-wood'),
    stone: document.getElementById('res-stone'),
    iron: document.getElementById('res-iron'),
    gold: document.getElementById('res-gold')
};
const uiSelection = document.getElementById('selection-info');
const uiMessage = document.getElementById('status-message');

// === INITIALISERING ===
function init() {
    console.log("Initialiserer RTS Engine Fase 1...");
    
    // 1. Lag verdenen
    createWorld();
    
    // 2. Lag arbeidere
    spawnWorker(gameState.keep.x + 50, gameState.keep.y + 50);
    spawnWorker(gameState.keep.x - 50, gameState.keep.y + 50);
    
    // 3. Input
    setupInput();
    
    // 4. Start Loop
    requestAnimationFrame(gameLoop);
}

// === VERDENS-GENERERING ===
function createWorld() {
    // 1. Plasser Borgen (Hub) i midten
    gameState.keep = {
        id: 'keep',
        type: 'building',
        subType: 'keep',
        x: GameConfig.worldWidth / 2,
        y: GameConfig.worldHeight / 2,
        w: 100, h: 100,
        color: '#8e44ad'
    };
    gameState.worldObjects.push(gameState.keep);
    
    // Sett kamera til å starte på borgen
    gameState.camera.x = gameState.keep.x - GameConfig.screenWidth / 2;
    gameState.camera.y = gameState.keep.y - GameConfig.screenHeight / 2;

    // 2. Generer Ressurser (Mest i Sør)
    const centerY = GameConfig.worldHeight / 2;
    
    // Trær (Mye i sør, litt overalt)
    for (let i = 0; i < 50; i++) {
        spawnResource(ResourceTypes.TREE, randomRange(0, 2000), randomRange(centerY - 200, 2000));
    }
    
    // Stein (Kun i sør-øst)
    for (let i = 0; i < 15; i++) {
        spawnResource(ResourceTypes.STONE, randomRange(1000, 2000), randomRange(centerY + 200, 2000));
    }
    
    // Jern (Sjelden, dypt i sør)
    for (let i = 0; i < 5; i++) {
        spawnResource(ResourceTypes.IRON, randomRange(500, 1500), randomRange(1600, 2000));
    }
    
    // Mat (Busker, nært borgen)
    for (let i = 0; i < 20; i++) {
        spawnResource(ResourceTypes.BERRY, randomRange(800, 1200), randomRange(centerY, centerY + 400));
    }
}

function spawnResource(def, x, y) {
    gameState.worldObjects.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'resource',
        resType: def.type, // 'wood', 'stone' etc.
        name: def.name,
        color: def.color,
        icon: def.icon,
        capacity: def.capacity,
        amount: def.capacity, // Hvor mye er igjen
        harvestTime: def.harvestTime,
        x: x, y: y,
        w: 30, h: 30 // Hitbox
    });
}

function spawnWorker(x, y) {
    gameState.workers.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'worker',
        name: 'Arbeider',
        x: x, y: y,
        w: 20, h: 20,
        speed: 80,
        state: 'IDLE', // IDLE, MOVING, GATHERING, RETURNING
        target: null,  // Hvor skal han?
        carryType: null, // Hva bærer han?
        carryAmount: 0,
        maxCarry: 10,
        gatherTimer: 0
    });
}

// === INPUT HANDLERS ===
function setupInput() {
    // Mus
    canvas.addEventListener('mousedown', (e) => {
        const mouse = getMouseWorldPos(e);
        
        // Venstreklikk: Velg
        if (e.button === 0) {
            selectEntity(mouse.x, mouse.y);
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouse = getMouseWorldPos(e);
        
        // Høyreklikk: Gi ordre
        if (gameState.selectedEntity && gameState.selectedEntity.type === 'worker') {
            handleWorkerCommand(gameState.selectedEntity, mouse.x, mouse.y);
        }
    });

    // Tastatur (Kamera)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'ArrowUp') gameState.keys.w = true;
        if (e.key === 'a' || e.key === 'ArrowLeft') gameState.keys.a = true;
        if (e.key === 's' || e.key === 'ArrowDown') gameState.keys.s = true;
        if (e.key === 'd' || e.key === 'ArrowRight') gameState.keys.d = true;
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'ArrowUp') gameState.keys.w = false;
        if (e.key === 'a' || e.key === 'ArrowLeft') gameState.keys.a = false;
        if (e.key === 's' || e.key === 'ArrowDown') gameState.keys.s = false;
        if (e.key === 'd' || e.key === 'ArrowRight') gameState.keys.d = false;
    });

    // UI Knapper
    document.getElementById('btn-create-worker').addEventListener('click', () => {
        if (gameState.resources.food >= 50) {
            gameState.resources.food -= 50;
            spawnWorker(gameState.keep.x, gameState.keep.y + 60);
            updateUI();
            uiMessage.innerText = "Ny arbeider trent!";
        } else {
            uiMessage.innerText = "Mangler mat (50).";
        }
    });
}

function getMouseWorldPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) + gameState.camera.x,
        y: (e.clientY - rect.top) + gameState.camera.y
    };
}

function selectEntity(wx, wy) {
    // Sjekk arbeidere først
    let found = null;
    gameState.workers.forEach(w => {
        if (dist(wx, wy, w.x, w.y) < 20) found = w;
    });
    
    if (!found) {
        // Sjekk bygninger/ressurser
        gameState.worldObjects.forEach(obj => {
            if (dist(wx, wy, obj.x, obj.y) < 20) found = obj;
        });
    }

    gameState.selectedEntity = found;
    updateSelectionUI();
}

function handleWorkerCommand(worker, wx, wy) {
    // Sjekk om vi klikket på en ressurs
    let targetRes = null;
    gameState.worldObjects.forEach(obj => {
        if (obj.type === 'resource' && dist(wx, wy, obj.x, obj.y) < 25) {
            targetRes = obj;
        }
    });

    if (targetRes) {
        // Gå og hent ressurs
        worker.state = 'MOVING';
        worker.target = targetRes;
        worker.jobType = 'GATHER';
        uiMessage.innerText = `Arbeider sendt til ${targetRes.name}.`;
    } else {
        // Bare gå dit (Move command)
        worker.state = 'MOVING';
        worker.target = { x: wx, y: wy }; // Dummy target posisjon
        worker.jobType = 'MOVE';
        uiMessage.innerText = "Arbeider flytter seg.";
    }
}

// === GAME LOOP ===
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
    
    // Oppdater arbeidere
    gameState.workers.forEach(w => updateWorker(w, dt));
}

function updateCamera(dt) {
    const speed = 500 * dt;
    if (gameState.keys.w) gameState.camera.y -= speed;
    if (gameState.keys.s) gameState.camera.y += speed;
    if (gameState.keys.a) gameState.camera.x -= speed;
    if (gameState.keys.d) gameState.camera.x += speed;

    // Begrens kamera til verden
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, GameConfig.worldWidth - GameConfig.screenWidth));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, GameConfig.worldHeight - GameConfig.screenHeight));
}

// === WORKER AI ===
function updateWorker(w, dt) {
    if (w.state === 'IDLE') return;

    if (w.state === 'MOVING') {
        const dx = w.target.x - w.x;
        const dy = w.target.y - w.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        
        if (d > 5) {
            w.x += (dx/d) * w.speed * dt;
            w.y += (dy/d) * w.speed * dt;
        } else {
            // Fremme!
            if (w.jobType === 'GATHER' && w.target.type === 'resource') {
                w.state = 'GATHERING';
                w.gatherTimer = w.target.harvestTime;
            } else if (w.jobType === 'RETURN') {
                w.state = 'DEPOSITING';
            } else {
                w.state = 'IDLE';
            }
        }
    }
    
    else if (w.state === 'GATHERING') {
        w.gatherTimer -= dt;
        if (w.gatherTimer <= 0) {
            // Ferdig å samle
            w.carryType = w.target.resType;
            w.carryAmount = w.maxCarry;
            
            // Trekk fra ressursen
            w.target.amount -= w.maxCarry;
            if (w.target.amount <= 0) {
                // Ressurs tom! Fjern den.
                const idx = gameState.worldObjects.indexOf(w.target);
                if (idx > -1) gameState.worldObjects.splice(idx, 1);
                w.target = null; // Må finne ny senere
            }

            // Gå hjem
            w.state = 'MOVING';
            w.target = gameState.keep;
            w.jobType = 'RETURN';
            
            // Husk hvor vi var (for å gå tilbake)
            w.lastResourcePos = { x: w.x, y: w.y, type: w.carryType };
        }
    }
    
    else if (w.state === 'DEPOSITING') {
        // Legg til ressurser
        gameState.resources[w.carryType] += w.carryAmount;
        w.carryAmount = 0;
        w.carryType = null;
        updateUI();

        // Gå tilbake til jobb?
        if (w.lastResourcePos) {
            // Finn nærmeste ressurs av samme type der vi var
            let nearest = null;
            let minDist = Infinity;
            gameState.worldObjects.forEach(obj => {
                if (obj.type === 'resource' && obj.resType === w.lastResourcePos.type) {
                    const d = dist(w.lastResourcePos.x, w.lastResourcePos.y, obj.x, obj.y);
                    if (d < minDist) { minDist = d; nearest = obj; }
                }
            });

            if (nearest && minDist < 200) { // Bare gå hvis den er i nærheten
                w.state = 'MOVING';
                w.target = nearest;
                w.jobType = 'GATHER';
            } else {
                w.state = 'IDLE'; // Fant ingen mer
            }
        } else {
            w.state = 'IDLE';
        }
    }
}

// === TEGNING ===
function draw() {
    // 1. Bakgrunn
    ctx.fillStyle = "#1e272e"; // Mørk bakgrunn
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // 2. Kamera Transformasjon
    ctx.translate(-gameState.camera.x, -gameState.camera.y);

    // Tegn Verdensgrenser (Gress)
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(0, 0, GameConfig.worldWidth, GameConfig.worldHeight);
    
    // Grid (valgfritt, for å se størrelsen)
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for(let i=0; i<GameConfig.worldWidth; i+=100) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, GameConfig.worldHeight); ctx.stroke(); }
    for(let i=0; i<GameConfig.worldHeight; i+=100) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(GameConfig.worldWidth, i); ctx.stroke(); }

    // 3. Tegn Objekter (Trær, Stein, Borg)
    gameState.worldObjects.forEach(obj => {
        if (obj.type === 'building') {
            // Borg
            ctx.fillStyle = obj.color;
            ctx.fillRect(obj.x - obj.w/2, obj.y - obj.h/2, obj.w, obj.h);
            ctx.strokeStyle = "#fff"; ctx.lineWidth=2; ctx.strokeRect(obj.x - obj.w/2, obj.y - obj.h/2, obj.w, obj.h);
            ctx.fillStyle = "#fff"; ctx.textAlign="center"; ctx.font="14px Arial"; ctx.fillText("BORG", obj.x, obj.y);
        } 
        else if (obj.type === 'resource') {
            // Ressurs
            ctx.font = "24px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillText(obj.icon, obj.x, obj.y);
            // Mengde bar
            const pct = obj.amount / obj.capacity;
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(obj.x-10, obj.y+15, 20, 3);
            ctx.fillStyle = "#fff"; ctx.fillRect(obj.x-10, obj.y+15, 20*pct, 3);
        }
    });

    // 4. Tegn Arbeidere
    gameState.workers.forEach(w => {
        ctx.fillStyle = "#f1c40f"; // Gul arbeider
        ctx.beginPath(); ctx.arc(w.x, w.y, 8, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth=1; ctx.stroke();
        
        // Bærer han noe?
        if (w.carryType) {
            ctx.font = "12px Arial";
            const icon = w.carryType === 'wood' ? '🌲' : (w.carryType === 'stone' ? '🪨' : (w.carryType==='food'?'🍖':'📦'));
            ctx.fillText(icon, w.x, w.y - 12);
        }

        // Seleksjon
        if (gameState.selectedEntity === w) {
            ctx.strokeStyle = "#fff"; ctx.lineWidth=2;
            ctx.beginPath(); ctx.arc(w.x, w.y, 12, 0, Math.PI*2); ctx.stroke();
        }
    });

    ctx.restore();
}

// === HJELPEFUNKSJONER ===
function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }
function randomRange(min, max) { return Math.random() * (max - min) + min; }

function updateUI() {
    uiResources.food.innerText = Math.floor(gameState.resources.food);
    uiResources.wood.innerText = Math.floor(gameState.resources.wood);
    uiResources.stone.innerText = Math.floor(gameState.resources.stone);
    uiResources.iron.innerText = Math.floor(gameState.resources.iron);
    uiResources.gold.innerText = Math.floor(gameState.resources.gold);
}

function updateSelectionUI() {
    const sel = gameState.selectedEntity;
    if (!sel) {
        uiSelection.innerText = "Ingen valgt";
        return;
    }
    
    if (sel.type === 'worker') {
        uiSelection.innerText = `Arbeider | Status: ${sel.state} | Bærer: ${sel.carryAmount} ${sel.carryType || ''}`;
    } else if (sel.type === 'resource') {
        uiSelection.innerText = `${sel.name} | Igjen: ${Math.floor(sel.amount)}`;
    } else if (sel.type === 'building') {
        uiSelection.innerText = "Borgtårnet (Lever ressurser her)";
    }
}

window.onload = init;
/* Version: #14 */
