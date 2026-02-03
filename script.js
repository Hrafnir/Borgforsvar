/* Version: #6 */

// === KONFIGURASJON ===
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    debugMode: true,
    // Base
    baseX: 500,
    baseY: 550,
    wallRadius: 200,
    wallSegments: 7,
    // Fiender
    enemySpawnInterval: 1000,
    baseEnemySpeed: 30,
    // Enheter (Stats)
    units: {
        peasant: { name: "Fotsoldat", cost: 50, damage: 10, range: 60, cooldown: 1.0, color: "#d35400", type: 'melee' }, // Kort rekkevidde
        archer:  { name: "Bueskytter", cost: 100, damage: 15, range: 250, cooldown: 1.5, color: "#27ae60", type: 'ranged' }, // Lang rekkevidde
        knight:  { name: "Ridder", cost: 200, damage: 40, range: 60, cooldown: 0.8, color: "#2980b9", type: 'melee' }  // Høy skade, kort rekkevidde
    }
};

// === SPILL-TILSTAND (STATE) ===
let gameState = {
    money: 250, // Start med litt mer penger så vi får testet
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
    units: [], // Her lagres våre soldater

    // UI Tilstand
    placementMode: null, // Hvilken type enhet vi prøver å plassere (f.eks. 'archer')
    selectedSlot: null   // Hvilken slot musen holder over
};

// === DOM ELEMENTER ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const uiWave = document.getElementById('wave-display');
const uiGold = document.getElementById('gold-display');
const uiBaseHp = document.getElementById('base-hp-display');
const uiMessage = document.getElementById('status-message');

// === LOGGING ===
function log(msg) {
    if (GameConfig.debugMode) console.log(`[GameLog]: ${msg}`);
}

// === INITIALISERING ===
function init() {
    log("Initialiserer Versjon 6 (Soldater)...");
    createLevelGeometry();
    setupEventListeners();
    requestAnimationFrame(gameLoop);
}

// === GEOMETRI ===
function createLevelGeometry() {
    const startAngle = Math.PI * 1.1; 
    const endAngle = Math.PI * 1.9;   
    const totalSegments = GameConfig.wallSegments;

    gameState.walls = [];
    gameState.slots = [];

    for (let i = 0; i < totalSegments; i++) {
        const t = i / (totalSegments - 1);
        const angle = startAngle + t * (endAngle - startAngle);
        const wx = GameConfig.baseX + GameConfig.wallRadius * Math.cos(angle);
        const wy = GameConfig.baseY + GameConfig.wallRadius * Math.sin(angle);

        const wallSegment = {
            id: `wall-${i}`, x: wx, y: wy, width: 60, height: 40,
            angle: angle, hp: 100, maxHp: 100, isBroken: false, radius: 30
        };
        gameState.walls.push(wallSegment);

        // Slots
        const outDist = 50;
        gameState.slots.push({
            id: `slot-out-${i}`, type: 'outside', parentWallId: wallSegment.id,
            x: GameConfig.baseX + (GameConfig.wallRadius + outDist) * Math.cos(angle),
            y: GameConfig.baseY + (GameConfig.wallRadius + outDist) * Math.sin(angle),
            occupied: false, unit: null
        });

        gameState.slots.push({
            id: `slot-wall-${i}`, type: 'wall', parentWallId: wallSegment.id,
            x: wx, y: wy, occupied: false, unit: null
        });

        const inDist = 50;
        gameState.slots.push({
            id: `slot-in-${i}`, type: 'inside', parentWallId: wallSegment.id,
            x: GameConfig.baseX + (GameConfig.wallRadius - inDist) * Math.cos(angle),
            y: GameConfig.baseY + (GameConfig.wallRadius - inDist) * Math.sin(angle),
            occupied: false, unit: null
        });
    }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Merk: Vi kaller nå selectUnitToPlace i stedet for buyUnit direkte
    document.getElementById('btn-buy-peasant').addEventListener('click', () => selectUnitToPlace('peasant'));
    document.getElementById('btn-buy-archer').addEventListener('click', () => selectUnitToPlace('archer'));
    document.getElementById('btn-buy-knight').addEventListener('click', () => selectUnitToPlace('knight'));

    document.getElementById('btn-upgrade-wall').addEventListener('click', upgradeWall);
    document.getElementById('btn-research-dmg').addEventListener('click', researchWeapons);
    document.getElementById('btn-start-wave').addEventListener('click', startNextWave);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    
    canvas.addEventListener('mousedown', handleCanvasClick);
    
    // Legg til en lytter for å avbryte plassering med høyreklikk
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (gameState.placementMode) {
            gameState.placementMode = null;
            uiMessage.innerText = "Plassering avbrutt.";
            canvas.style.cursor = "default";
        }
    });
}

// === HANDLINGSFUNKSJONER ===

function selectUnitToPlace(type) {
    const stats = GameConfig.units[type];
    
    if (gameState.money < stats.cost) {
        uiMessage.innerText = `Ikke nok penger! ${stats.name} koster ${stats.cost}g.`;
        return;
    }

    gameState.placementMode = type;
    uiMessage.innerText = `Valgt: ${stats.name}. Klikk på en sirkel for å plassere! (Høyreklikk for å avbryte)`;
    canvas.style.cursor = "crosshair"; // Endre peker
}

function upgradeWall() {
    if (gameState.money >= 150) {
        gameState.money -= 150;
        gameState.walls.forEach(w => { if (!w.isBroken) w.hp = Math.min(w.hp + 50, w.maxHp); });
        updateUI();
        uiMessage.innerText = "Murer reparert!";
    }
}

function researchWeapons() { uiMessage.innerText = "Forskning kommer snart."; }

function startNextWave() {
    if (gameState.enemiesToSpawn > 0 || gameState.enemies.length > 0) return;
    gameState.gameActive = true;
    const enemyCount = 3 + (gameState.wave * 2);
    gameState.enemiesToSpawn = enemyCount;
    uiMessage.innerText = `Bølge ${gameState.wave} starter!`;
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('btn-pause').innerText = gameState.isPaused ? "Fortsett" : "Pause";
}

function handleCanvasClick(event) {
    // 1. Finn hvor vi klikket
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // 2. Sjekk om vi traff en slot
    let clickedSlot = null;
    gameState.slots.forEach(slot => {
        const dx = mouseX - slot.x;
        const dy = mouseY - slot.y;
        if (Math.sqrt(dx*dx + dy*dy) < 15) { // 15px radius for klikk
            clickedSlot = slot;
        }
    });

    // 3. Hvis vi er i "Placement Mode" og klikket en slot
    if (gameState.placementMode && clickedSlot) {
        attemptPlaceUnit(clickedSlot);
    }
}

function attemptPlaceUnit(slot) {
    const unitType = gameState.placementMode;
    const stats = GameConfig.units[unitType];

    // Sjekk 1: Er slotten opptatt?
    if (slot.occupied) {
        uiMessage.innerText = "Denne plassen er opptatt!";
        return;
    }

    // Sjekk 2: Er det lovlig plassering?
    // Nærkamp kan ikke stå på muren
    if (stats.type === 'melee' && slot.type === 'wall') {
        uiMessage.innerText = "Nærkamp-enheter kan ikke stå på muren!";
        return;
    }

    // Sjekk 3: Har vi penger? (Dobbeltsjekk)
    if (gameState.money < stats.cost) {
        uiMessage.innerText = "Ikke nok penger lenger!";
        gameState.placementMode = null;
        canvas.style.cursor = "default";
        return;
    }

    // --- UTFØR KJØP ---
    gameState.money -= stats.cost;
    
    // Opprett enheten
    const newUnit = {
        type: unitType,
        x: slot.x,
        y: slot.y,
        damage: stats.damage,
        range: stats.range,
        cooldownMax: stats.cooldown,
        cooldownTimer: 0,
        color: stats.color,
        slotId: slot.id,
        target: null, // Hvem skyter vi på?
        attackLine: null // For visuell effekt
    };

    gameState.units.push(newUnit);
    
    // Marker slot som opptatt
    slot.occupied = true;
    slot.unit = newUnit;

    // Reset UI
    uiMessage.innerText = `${stats.name} plassert!`;
    gameState.placementMode = null;
    canvas.style.cursor = "default";
    updateUI();
}

function updateUI() {
    uiWave.innerText = gameState.wave;
    uiGold.innerText = gameState.money;
    uiBaseHp.innerText = Math.floor(gameState.baseHealth) + "%";
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    const deltaTime = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;

    if (!gameState.isPaused) {
        update(deltaTime);
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 1. Spawne fiender
    if (gameState.gameActive && gameState.enemiesToSpawn > 0) {
        gameState.spawnTimer -= dt;
        if (gameState.spawnTimer <= 0) {
            spawnEnemy();
            gameState.spawnTimer = GameConfig.enemySpawnInterval / 1000;
            gameState.enemiesToSpawn--;
        }
    }

    // 2. Oppdater enheter (Våre soldater)
    gameState.units.forEach(unit => updateUnit(unit, dt));

    // 3. Oppdater fiender
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        updateEnemy(gameState.enemies[i], dt, i);
    }

    // 4. Sjekk bølge-slutt
    if (gameState.gameActive && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0) {
        endWave();
    }
    
    // 5. Game Over
    if (gameState.baseHealth <= 0) {
        gameState.isPaused = true;
        uiMessage.innerText = "GAME OVER!";
    }
}

// === ENHETS-LOGIKK (VÅRE SOLDATER) ===
function updateUnit(unit, dt) {
    // Reduser cooldown
    if (unit.cooldownTimer > 0) unit.cooldownTimer -= dt;
    if (unit.attackLine > 0) unit.attackLine -= dt; // Visuell timer for laserskudd

    // Finn nærmeste fiende
    let closestEnemy = null;
    let minDistance = Infinity;

    gameState.enemies.forEach(enemy => {
        const dx = enemy.x - unit.x;
        const dy = enemy.y - unit.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < minDistance) {
            minDistance = dist;
            closestEnemy = enemy;
        }
    });

    // Angrip hvis innenfor rekkevidde og klar
    if (closestEnemy && minDistance <= unit.range) {
        if (unit.cooldownTimer <= 0) {
            // FIRE!
            closestEnemy.hp -= unit.damage;
            unit.cooldownTimer = unit.cooldownMax;
            
            // Lagre info for å tegne angrepslinje
            unit.targetX = closestEnemy.x;
            unit.targetY = closestEnemy.y;
            unit.attackLine = 0.1; // Vis streken i 0.1 sekund
        }
    }
}

function spawnEnemy() {
    const isBoss = (gameState.wave % 4 === 0) && (gameState.enemiesToSpawn === 1);
    const spawnX = Math.random() * (canvas.width - 200) + 100;
    
    gameState.enemies.push({
        x: spawnX, y: -20,
        speed: isBoss ? 15 : GameConfig.baseEnemySpeed + (gameState.wave * 2),
        hp: isBoss ? 500 : 20 + (gameState.wave * 10),
        maxHp: isBoss ? 500 : 20 + (gameState.wave * 10),
        damage: isBoss ? 50 : 10,
        radius: isBoss ? 20 : 10,
        color: isBoss ? "#800000" : "#c0392b",
        state: 'moving', attackTimer: 0, target: null
    });
}

function updateEnemy(enemy, dt, index) {
    if (enemy.hp <= 0) {
        // Fiende død!
        gameState.enemies.splice(index, 1);
        gameState.money += 15; // Belønning
        updateUI();
        return;
    }

    // Bevegelse og angrep (som før)
    if (enemy.state === 'moving') {
        const dx = GameConfig.baseX - enemy.x;
        const dy = GameConfig.baseY - enemy.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 0) {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
        }

        if (dist < 30) {
            gameState.baseHealth -= enemy.damage;
            updateUI();
            gameState.enemies.splice(index, 1);
            return;
        }

        // Kollisjon med murer
        for (let w of gameState.walls) {
            if (!w.isBroken) {
                const wDist = Math.sqrt(Math.pow(w.x-enemy.x, 2) + Math.pow(w.y-enemy.y, 2));
                if (wDist < (w.radius + enemy.radius)) {
                    enemy.state = 'attacking';
                    enemy.target = w;
                    break;
                }
            }
        }
    } else if (enemy.state === 'attacking') {
        if (enemy.target && !enemy.target.isBroken) {
            enemy.attackTimer -= dt;
            if (enemy.attackTimer <= 0) {
                enemy.target.hp -= enemy.damage;
                enemy.attackTimer = 1.0;
                if (enemy.target.hp <= 0) {
                    enemy.target.hp = 0;
                    enemy.target.isBroken = true;
                    enemy.state = 'moving';
                    enemy.target = null;
                }
            }
        } else {
            enemy.state = 'moving';
            enemy.target = null;
        }
    }
}

function endWave() {
    gameState.gameActive = false;
    gameState.wave++;
    updateUI();
    uiMessage.innerText = `Bølge ferdig! +100 gull.`;
    gameState.money += 100;
}

// === TEGNING ===
function draw() {
    // Bakgrunn
    ctx.fillStyle = "#27ae60"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Base
    ctx.fillStyle = "#8e44ad";
    ctx.beginPath(); ctx.arc(GameConfig.baseX, GameConfig.baseY, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText("♔", GameConfig.baseX, GameConfig.baseY);

    // Murer
    gameState.walls.forEach(wall => {
        ctx.save();
        ctx.translate(wall.x, wall.y);
        ctx.rotate(wall.angle + Math.PI / 2);
        if (!wall.isBroken) {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            const hpPercent = wall.hp / wall.maxHp;
            ctx.fillStyle = "#00ff00"; ctx.fillRect(-wall.width/2, -5, wall.width * hpPercent, 5);
        } else {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            ctx.fillStyle = "#fff"; ctx.fillText("X", 0, 0);
        }
        ctx.restore();
    });

    // Slots & Enheter
    gameState.slots.forEach(slot => {
        // Tegn slot-sirkel
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 8, 0, Math.PI * 2);
        
        // Fargelegg basert på om det er lov å bygge der i nåværende modus
        let highlight = false;
        if (gameState.placementMode) {
            const stats = GameConfig.units[gameState.placementMode];
            const isMelee = stats.type === 'melee';
            // Hvis melee: Ikke lov på vegg. Ellers OK.
            if (!(isMelee && slot.type === 'wall')) {
                highlight = true;
            }
        }

        if (highlight && !slot.occupied) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; // Lys opp lovlige plasser
        } else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        }
        ctx.fill();
        
        // Type-indikator (ring)
        if (slot.type === 'outside') ctx.strokeStyle = "rgba(231, 76, 60, 0.5)";
        else if (slot.type === 'wall') ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        else ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tegn ENHET hvis den finnes
        if (slot.unit) {
            const u = slot.unit;
            ctx.fillStyle = u.color;
            ctx.beginPath();
            ctx.arc(u.x, u.y, 10, 0, Math.PI * 2);
            ctx.fill();
            // Tegn en bokstav for typen (P, A, K)
            ctx.fillStyle = "#fff";
            ctx.font = "12px Arial";
            ctx.fillText(u.type.charAt(0).toUpperCase(), u.x, u.y);

            // Tegn angreps-strek (Visualisering av skudd/slag)
            if (u.attackLine > 0) {
                ctx.strokeStyle = "yellow";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(u.x, u.y);
                ctx.lineTo(u.targetX, u.targetY);
                ctx.stroke();
            }
        }
    });

    // Fiender
    gameState.enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2); ctx.fill();
        const hpPercent = enemy.hp / enemy.maxHp;
        ctx.fillStyle = "red"; ctx.fillRect(enemy.x - 10, enemy.y - enemy.radius - 8, 20, 4);
        ctx.fillStyle = "#00ff00"; ctx.fillRect(enemy.x - 10, enemy.y - enemy.radius - 8, 20 * hpPercent, 4);
    });
}

window.onload = init;
/* Version: #6 */
