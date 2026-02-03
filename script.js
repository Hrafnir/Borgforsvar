/* Version: #5 */

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
    enemySpawnInterval: 1000, // Millisekunder mellom hver fiende
    baseEnemySpeed: 30        // Pixels per sekund
};

// === SPILL-TILSTAND (STATE) ===
let gameState = {
    money: 100,
    wave: 1,
    baseHealth: 100,
    isPaused: false,
    gameActive: false,
    lastTime: 0,
    
    // Bølge-håndtering
    enemiesToSpawn: 0,    // Hvor mange som gjenstår å spawne i denne bølgen
    spawnTimer: 0,        // Teller ned til neste spawn

    // Objekter
    walls: [],
    slots: [],
    enemies: [],
    units: []
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
    if (GameConfig.debugMode) {
        console.log(`[GameLog]: ${msg}`);
    }
}

// === INITIALISERING ===
function init() {
    log("Initialiserer Versjon 5 (Fiender)...");
    createLevelGeometry();
    setupEventListeners();
    requestAnimationFrame(gameLoop);
}

// === GEOMETRI (Uendret fra forrige versjon) ===
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
            id: `wall-${i}`,
            x: wx,
            y: wy,
            width: 60,
            height: 40,
            angle: angle,
            hp: 100,
            maxHp: 100,
            isBroken: false,
            radius: 30 // Brukes for kollisjonssjekk (forenklet sirkel rundt muren)
        };
        gameState.walls.push(wallSegment);

        // Slots (Uendret logikk)
        const outDist = 50;
        gameState.slots.push({
            id: `slot-out-${i}`, type: 'outside', parentWallId: wallSegment.id,
            x: GameConfig.baseX + (GameConfig.wallRadius + outDist) * Math.cos(angle),
            y: GameConfig.baseY + (GameConfig.wallRadius + outDist) * Math.sin(angle),
            occupied: false
        });

        gameState.slots.push({
            id: `slot-wall-${i}`, type: 'wall', parentWallId: wallSegment.id,
            x: wx, y: wy, occupied: false
        });

        const inDist = 50;
        gameState.slots.push({
            id: `slot-in-${i}`, type: 'inside', parentWallId: wallSegment.id,
            x: GameConfig.baseX + (GameConfig.wallRadius - inDist) * Math.cos(angle),
            y: GameConfig.baseY + (GameConfig.wallRadius - inDist) * Math.sin(angle),
            occupied: false
        });
    }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    document.getElementById('btn-buy-peasant').addEventListener('click', () => buyUnit('peasant', 50));
    document.getElementById('btn-buy-archer').addEventListener('click', () => buyUnit('archer', 100));
    document.getElementById('btn-buy-knight').addEventListener('click', () => buyUnit('knight', 200));
    document.getElementById('btn-upgrade-wall').addEventListener('click', upgradeWall);
    document.getElementById('btn-research-dmg').addEventListener('click', researchWeapons);
    document.getElementById('btn-start-wave').addEventListener('click', startNextWave);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    canvas.addEventListener('mousedown', handleCanvasClick);
}

// === SPILL-HANDLINGER ===

function buyUnit(type, cost) {
    if (gameState.money >= cost) {
        gameState.money -= cost;
        updateUI();
        uiMessage.innerText = `Kjøpte ${type}. (Plassering kommer i neste steg)`;
    } else {
        uiMessage.innerText = "Ikke nok penger!";
    }
}

function upgradeWall() {
    if (gameState.money >= 150) {
        gameState.money -= 150;
        gameState.walls.forEach(w => {
            if (!w.isBroken) {
                w.hp = Math.min(w.hp + 50, w.maxHp);
            }
        });
        updateUI();
        uiMessage.innerText = "Murer reparert!";
    }
}

function researchWeapons() {
    // Placeholder
    uiMessage.innerText = "Forskning ikke implementert enda.";
}

function startNextWave() {
    if (gameState.enemiesToSpawn > 0 || gameState.enemies.length > 0) {
        uiMessage.innerText = "Bølgen er allerede i gang!";
        return;
    }

    gameState.gameActive = true;
    
    // Beregn antall fiender basert på bølgenummer (Enkel formel)
    // Bølge 1: 5 fiender. Bølge 2: 7 fiender...
    const enemyCount = 3 + (gameState.wave * 2);
    gameState.enemiesToSpawn = enemyCount;
    
    log(`Starter Bølge ${gameState.wave}. Fiender: ${enemyCount}`);
    uiMessage.innerText = `Bølge ${gameState.wave} starter!`;
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('btn-pause').innerText = gameState.isPaused ? "Fortsett" : "Pause";
}

function handleCanvasClick(event) {
    // Placeholder for klikk
}

function updateUI() {
    uiWave.innerText = gameState.wave;
    uiGold.innerText = gameState.money;
    uiBaseHp.innerText = Math.floor(gameState.baseHealth) + "%";
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    const deltaTime = (timestamp - gameState.lastTime) / 1000; // Sekunder
    gameState.lastTime = timestamp;

    if (!gameState.isPaused) {
        update(deltaTime);
        draw();
    }
    requestAnimationFrame(gameLoop);
}

// === UPDATE LOGIKK (VIKTIG) ===
function update(dt) {
    // 1. Spawne fiender hvis vi skal
    if (gameState.gameActive && gameState.enemiesToSpawn > 0) {
        gameState.spawnTimer -= dt;
        if (gameState.spawnTimer <= 0) {
            spawnEnemy();
            gameState.spawnTimer = GameConfig.enemySpawnInterval / 1000; // Reset timer
            gameState.enemiesToSpawn--;
        }
    }

    // 2. Oppdater alle fiender
    // Vi bruker en omvendt løkke for å trygt kunne fjerne fiender som dør
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        updateEnemy(enemy, dt, i);
    }

    // 3. Sjekk om bølgen er ferdig
    if (gameState.gameActive && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0) {
        endWave();
    }
    
    // 4. Game Over sjekk
    if (gameState.baseHealth <= 0) {
        gameState.isPaused = true;
        uiMessage.innerText = "GAME OVER! Kongen er død.";
        log("Game Over triggered.");
    }
}

function spawnEnemy() {
    // Boss hver 4. bølge
    const isBoss = (gameState.wave % 4 === 0) && (gameState.enemiesToSpawn === 1); // Siste fiende i bossbølger
    
    const spawnX = Math.random() * (canvas.width - 200) + 100; // Tilfeldig X mellom 100 og 900
    
    const newEnemy = {
        x: spawnX,
        y: -20, // Starter rett over skjermen
        speed: isBoss ? 15 : GameConfig.baseEnemySpeed + (gameState.wave * 2), // Raskere per bølge
        hp: isBoss ? 500 : 20 + (gameState.wave * 10),
        maxHp: isBoss ? 500 : 20 + (gameState.wave * 10),
        damage: isBoss ? 50 : 10,
        radius: isBoss ? 20 : 10,
        color: isBoss ? "#800000" : "#c0392b", // Mørkerød boss, vanlig rød fiende
        isBoss: isBoss,
        state: 'moving', // 'moving' eller 'attacking'
        target: null,     // Hva angriper den?
        attackTimer: 0
    };
    
    gameState.enemies.push(newEnemy);
    log(`Spawned enemy at X:${Math.floor(spawnX)} (Boss: ${isBoss})`);
}

function updateEnemy(enemy, dt, index) {
    
    // --- TILSTAND: BEVEGELSE ---
    if (enemy.state === 'moving') {
        // Beregn retning mot basen
        const dx = GameConfig.baseX - enemy.x;
        const dy = GameConfig.baseY - enemy.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Flytt fienden
        if (dist > 0) {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
        }

        // Sjekk kollisjon med BASEN (Kongen)
        if (dist < 30) { // Nådde fram
            gameState.baseHealth -= enemy.damage;
            updateUI();
            log("Fiende traff basen!");
            gameState.enemies.splice(index, 1); // Fjern fiende
            return;
        }

        // Sjekk kollisjon med MURER
        // Vi sjekker alle murer for å se om vi krasjer
        for (let w of gameState.walls) {
            if (!w.isBroken) {
                const wDx = w.x - enemy.x;
                const wDy = w.y - enemy.y;
                const wDist = Math.sqrt(wDx*wDx + wDy*wDy);
                
                // Hvis vi treffer muren (avstand < sum av radiusene)
                if (wDist < (w.radius + enemy.radius)) {
                    enemy.state = 'attacking';
                    enemy.target = w;
                    break; // Slutt å lete, vi fant en mur å slå på
                }
            }
        }
    }

    // --- TILSTAND: ANGREP PÅ MUR ---
    else if (enemy.state === 'attacking') {
        // Sjekk om muren fortsatt eksisterer og ikke er ødelagt
        if (enemy.target && !enemy.target.isBroken) {
            enemy.attackTimer -= dt;
            if (enemy.attackTimer <= 0) {
                // SLÅ!
                enemy.target.hp -= enemy.damage;
                enemy.attackTimer = 1.0; // Slår en gang i sekundet
                
                // Sjekk om muren knakk
                if (enemy.target.hp <= 0) {
                    enemy.target.hp = 0;
                    enemy.target.isBroken = true;
                    enemy.state = 'moving'; // Fortsett å gå
                    enemy.target = null;
                    log("En mur ble ødelagt!");
                }
            }
        } else {
            // Muren er borte (kanskje ødelagt av en annen), fortsett å gå
            enemy.state = 'moving';
            enemy.target = null;
        }
    }
}

function endWave() {
    gameState.gameActive = false;
    gameState.wave++;
    updateUI();
    uiMessage.innerText = `Bølge ferdig! Gjør deg klar til bølge ${gameState.wave}.`;
    log("Bølge fullført.");
    
    // Gi spilleren litt penger for å overleve
    gameState.money += 100;
    updateUI();
}

// === TEGNING ===
function draw() {
    // 1. Bakgrunn
    ctx.fillStyle = "#27ae60"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Basen
    ctx.fillStyle = "#8e44ad";
    ctx.beginPath(); ctx.arc(GameConfig.baseX, GameConfig.baseY, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("♔", GameConfig.baseX, GameConfig.baseY);

    // 3. Murer
    gameState.walls.forEach(wall => {
        ctx.save();
        ctx.translate(wall.x, wall.y);
        ctx.rotate(wall.angle + Math.PI / 2);

        if (!wall.isBroken) {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            
            // HP Bar
            const hpPercent = wall.hp / wall.maxHp;
            ctx.fillStyle = "red"; ctx.fillRect(-wall.width/2, -5, wall.width, 5);
            ctx.fillStyle = "#00ff00"; ctx.fillRect(-wall.width/2, -5, wall.width * hpPercent, 5);
        } else {
            // Ødelagt mur
            ctx.fillStyle = "rgba(0,0,0,0.5)"; // Mørk skygge
            ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            ctx.fillStyle = "#fff"; ctx.font = "20px Arial"; ctx.fillText("X", 0, 0);
        }
        ctx.restore();
    });

    // 4. Slots (Viser bare når vi debuggger eller skal plassere, men tegner dem svakt nå)
    gameState.slots.forEach(slot => {
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fill();
    });

    // 5. FIENDER
    gameState.enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        // HP Bar over fienden
        const hpPercent = enemy.hp / enemy.maxHp;
        ctx.fillStyle = "red";
        ctx.fillRect(enemy.x - 10, enemy.y - enemy.radius - 8, 20, 4);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(enemy.x - 10, enemy.y - enemy.radius - 8, 20 * hpPercent, 4);
    });
}

window.onload = init;
/* Version: #5 */
