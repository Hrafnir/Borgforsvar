/* Version: #10 */

// === SEKSJON 1: KONFIGURASJON ===
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    debugMode: true, // Sett til true for å se hva soldatene tenker i konsollen
    
    // Base og Verdenskart
    baseX: 500,
    baseY: 550,
    wallRadius: 220,
    wallSegments: 7,
    gateIndex: 3, // Indeks 3 er midten (0, 1, 2, [3], 4, 5, 6)

    // Fiender
    enemySpawnInterval: 1000, // Ms mellom hver spawn (justeres av logikk)
    baseEnemySpeed: 30,       // Pixels per sekund

    // Enheter (Stats)
    units: {
        peasant: { 
            name: "Fotsoldat", 
            cost: 50, 
            damage: 10, 
            range: 120, // Rekker over muren
            cooldown: 1.0, 
            color: "#d35400", 
            type: 'melee', 
            speed: 60 
        },
        archer: { 
            name: "Bueskytter", 
            cost: 100, 
            damage: 15, 
            range: 300, // Lang rekkevidde
            cooldown: 1.5, 
            color: "#27ae60", 
            type: 'ranged', 
            speed: 70 
        },
        knight: { 
            name: "Ridder", 
            cost: 200, 
            damage: 40, 
            range: 120, // Rekker over muren
            cooldown: 0.8, 
            color: "#2980b9", 
            type: 'melee', 
            speed: 50 
        }
    }
};

// === SEKSJON 2: SPILL-TILSTAND (STATE) ===
let gameState = {
    // Økonomi og Progresjon
    money: 450,
    wave: 1,
    baseHealth: 100,
    
    // Motor-variabler
    isPaused: false,
    gameActive: false,
    lastTime: 0,
    
    // Bølge-håndtering
    enemiesToSpawn: 0,
    spawnTimer: 0,

    // Spillobjekter (Arrays)
    walls: [],
    slots: [],
    enemies: [],
    units: [],

    // UI og Interaksjon
    selectedUnit: null,
    isGateOpen: false
};

// === SEKSJON 3: DOM ELEMENTER ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const uiWave = document.getElementById('wave-display');
const uiGold = document.getElementById('gold-display');
const uiBaseHp = document.getElementById('base-hp-display');
const uiMessage = document.getElementById('status-message');

// === SEKSJON 4: INITIALISERING ===
function init() {
    console.log("Initialiserer spillet (Versjon #10 - Full Restore)...");
    
    // 1. Bygg verdenen
    createLevelGeometry();
    
    // 2. Sett opp input (mus/knapper)
    setupEventListeners();
    
    // 3. Legg til port-knappen dynamisk
    addGateControl();
    
    // 4. Start loopen
    requestAnimationFrame(gameLoop);
}

// Hjelpefunksjon for å legge til knapp for porten
function addGateControl() {
    const panel = document.querySelector('.control-group:nth-child(3)'); // Spillkontroll-boksen
    if (panel) {
        // Unngå duplikater
        if (document.getElementById('btn-toggle-gate')) return;

        const btn = document.createElement('button');
        btn.id = 'btn-toggle-gate';
        btn.className = 'game-btn';
        btn.innerText = "Åpne Porten";
        btn.style.borderLeft = "5px solid #fff";
        btn.onclick = toggleGate;
        panel.appendChild(btn);
    }
}

// === SEKSJON 5: GEOMETRI (Murer og Slots) ===
function createLevelGeometry() {
    const startAngle = Math.PI * 1.1; // Starter litt til venstre
    const endAngle = Math.PI * 1.9;   // Slutter litt til høyre
    const totalSegments = GameConfig.wallSegments;

    gameState.walls = [];
    gameState.slots = [];

    for (let i = 0; i < totalSegments; i++) {
        // Beregn posisjon i buen
        const t = i / (totalSegments - 1);
        const angle = startAngle + t * (endAngle - startAngle);
        
        // Posisjon for muren
        const wx = GameConfig.baseX + GameConfig.wallRadius * Math.cos(angle);
        const wy = GameConfig.baseY + GameConfig.wallRadius * Math.sin(angle);

        const isGate = (i === GameConfig.gateIndex);

        // Opprett Mur-objekt
        const wallSegment = {
            id: `wall-${i}`,
            x: wx,
            y: wy,
            width: 60,
            height: 40,
            angle: angle,
            hp: 100,
            maxHp: isGate ? 300 : 150, // Porten er sterkere
            isBroken: false,
            isGate: isGate,
            radius: 35 // Kollisjonsradius
        };
        gameState.walls.push(wallSegment);

        // --- SLOTS GENERERING ---
        // Funksjon for å plassere slots relativt til muren
        const createSlot = (type, distFromBase, offsetSide, label) => {
            // Base posisjon (avstand fra sentrum)
            const bx = GameConfig.baseX + (GameConfig.wallRadius + distFromBase) * Math.cos(angle);
            const by = GameConfig.baseY + (GameConfig.wallRadius + distFromBase) * Math.sin(angle);
            
            // Sideveis offset
            const sideAngle = angle + Math.PI / 2;
            const sideDist = 15; 
            
            const finalX = bx + (offsetSide * sideDist) * Math.cos(sideAngle);
            const finalY = by + (offsetSide * sideDist) * Math.sin(sideAngle);

            gameState.slots.push({
                id: `slot-${type}-${i}-${label}`,
                type: type, // 'outside', 'wall', 'inside'
                parentWallId: wallSegment.id,
                x: finalX,
                y: finalY,
                occupied: false,
                unit: null
            });
        };

        // Vi oppretter 6 slots per murbit (2 ute, 2 på, 2 inne)
        createSlot('outside', 60, -1, 'A');
        createSlot('outside', 60, 1, 'B');
        
        createSlot('wall', 0, -1, 'A');
        createSlot('wall', 0, 1, 'B');
        
        createSlot('inside', -60, -1, 'A');
        createSlot('inside', -60, 1, 'B');
    }
}

// === SEKSJON 6: EVENT LISTENERS ===
function setupEventListeners() {
    // Kjøpsknapper
    document.getElementById('btn-buy-peasant').addEventListener('click', () => buyUnit('peasant'));
    document.getElementById('btn-buy-archer').addEventListener('click', () => buyUnit('archer'));
    document.getElementById('btn-buy-knight').addEventListener('click', () => buyUnit('knight'));

    // Andre knapper
    document.getElementById('btn-upgrade-wall').addEventListener('click', upgradeWall);
    document.getElementById('btn-start-wave').addEventListener('click', startNextWave);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    
    // Mus
    canvas.addEventListener('mousedown', handleCanvasClick);
    
    // Høyreklikk for å avvelge enhet
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        deselectUnit();
    });
}

// === SEKSJON 7: ENHETS-LOGIKK (KJØP OG STYRING) ===

function buyUnit(type) {
    const stats = GameConfig.units[type];
    if (gameState.money >= stats.cost) {
        gameState.money -= stats.cost;
        
        // Spawn ved kongen (litt tilfeldig spredning)
        const spawnX = GameConfig.baseX + (Math.random() - 0.5) * 40;
        const spawnY = GameConfig.baseY + (Math.random() - 0.5) * 40;

        const newUnit = {
            id: Math.random().toString(36).substr(2, 9),
            type: type,
            x: spawnX,
            y: spawnY,
            state: 'IDLE', 
            targetSlot: null,
            targetX: spawnX, 
            targetY: spawnY,
            hp: 100,
            stats: stats,
            color: stats.color,
            cooldownTimer: 0, // Viktig: Må starte på 0
            attackLine: 0
        };
        
        gameState.units.push(newUnit);
        
        // Velg enheten automatisk
        selectUnit(newUnit);
        updateUI();
        uiMessage.innerText = `${stats.name} klar! Flytt ham til muren.`;
    } else {
        uiMessage.innerText = "Ikke nok penger.";
    }
}

function selectUnit(unit) {
    gameState.selectedUnit = unit;
    uiMessage.innerText = `Valgt: ${unit.stats.name}. Rekkevidde: ${unit.stats.range}px.`;
}

function deselectUnit() {
    gameState.selectedUnit = null;
    uiMessage.innerText = "Ingen enhet valgt.";
}

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    let clickedUnit = null;
    let clickedSlot = null;

    // Sjekk treff på enheter
    gameState.units.forEach(u => {
        const d = Math.sqrt((u.x - mouseX)**2 + (u.y - mouseY)**2);
        if (d < 15) clickedUnit = u;
    });

    // Sjekk treff på slots
    gameState.slots.forEach(s => {
        const d = Math.sqrt((s.x - mouseX)**2 + (s.y - mouseY)**2);
        if (d < 12) clickedSlot = s;
    });

    // Logikk for hva som skjer ved klikk
    if (gameState.selectedUnit && clickedSlot) {
        moveUnitToSlot(gameState.selectedUnit, clickedSlot);
        return;
    }

    if (clickedUnit) {
        selectUnit(clickedUnit);
        return;
    }

    if (!clickedUnit && !clickedSlot) {
        deselectUnit();
    }
}

function moveUnitToSlot(unit, slot) {
    // Validering
    if (slot.occupied && slot.unit !== unit) {
        uiMessage.innerText = "Plassen er opptatt!";
        return;
    }
    
    if (unit.stats.type === 'melee' && slot.type === 'wall') {
        uiMessage.innerText = "Nærkamp kan ikke stå oppå muren!";
        return;
    }

    // Frigjør gammel slot
    if (unit.targetSlot) {
        unit.targetSlot.occupied = false;
        unit.targetSlot.unit = null;
    }

    // Okkuper ny slot
    slot.occupied = true;
    slot.unit = unit;
    
    // Sett ordre
    unit.targetSlot = slot;
    unit.state = 'MOVING';
    
    uiMessage.innerText = `${unit.stats.name} flytter seg.`;
}

function toggleGate() {
    gameState.isGateOpen = !gameState.isGateOpen;
    const btn = document.getElementById('btn-toggle-gate');
    if (btn) {
        btn.innerText = gameState.isGateOpen ? "Lukk Porten" : "Åpne Porten";
        btn.style.backgroundColor = gameState.isGateOpen ? "#e74c3c" : "#95a5a6";
    }
}

// === SEKSJON 8: GAME LOOP ===
function gameLoop(timestamp) {
    // Håndter første frame for å unngå rar deltaTime
    if (!gameState.lastTime) {
        gameState.lastTime = timestamp;
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = (timestamp - gameState.lastTime) / 1000; // Sekunder
    gameState.lastTime = timestamp;

    if (!gameState.isPaused) {
        update(deltaTime);
        draw();
    }
    requestAnimationFrame(gameLoop);
}

// === SEKSJON 9: UPDATE (Hovedlogikk) ===
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

    // 2. Oppdater alle enheter
    gameState.units.forEach(unit => updateUnit(unit, dt));

    // 3. Oppdater alle fiender (baklengs loop for trygg sletting)
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        updateEnemy(gameState.enemies[i], dt, i);
    }

    // 4. Sjekk om bølgen er ferdig
    if (gameState.gameActive && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0) {
        endWave();
    }
    
    // 5. Sjekk Game Over
    if (gameState.baseHealth <= 0) {
        gameState.isPaused = true;
        uiMessage.innerText = "GAME OVER! Kongen falt.";
    }
}

// --- LOGIKK FOR SOLDATER (VÅRE) ---
function updateUnit(unit, dt) {
    // A. Reduser cooldowns
    if (unit.cooldownTimer > 0) unit.cooldownTimer -= dt;
    if (unit.attackLine > 0) unit.attackLine -= dt;

    // B. Bevegelse
    if (unit.state === 'MOVING' && unit.targetSlot) {
        const dx = unit.targetSlot.x - unit.x;
        const dy = unit.targetSlot.y - unit.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        const moveStep = unit.stats.speed * dt;

        if (dist <= moveStep || dist < 5) {
            // Fremme
            unit.x = unit.targetSlot.x;
            unit.y = unit.targetSlot.y;
            unit.state = 'STATIONED';
        } else {
            // Gå
            unit.x += (dx / dist) * moveStep;
            unit.y += (dy / dist) * moveStep;
        }
    }

    // C. KAMP (Søk etter fiender)
    // Soldater søker ALLTID etter fiender, selv om de går.
    let closestEnemy = null;
    let minDistance = Infinity;

    gameState.enemies.forEach(enemy => {
        const dx = enemy.x - unit.x;
        const dy = enemy.y - unit.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        
        if (d < minDistance) {
            minDistance = d;
            closestEnemy = enemy;
        }
    });

    // Hvis fiende er funnet og innenfor rekkevidde
    if (closestEnemy && minDistance <= unit.stats.range) {
        if (unit.cooldownTimer <= 0) {
            // ANGRIP!
            closestEnemy.hp -= unit.stats.damage;
            unit.cooldownTimer = unit.stats.cooldown;
            
            // Visuell effekt
            unit.targetX = closestEnemy.x; 
            unit.targetY = closestEnemy.y;
            unit.attackLine = 0.15; // Vis streken litt lenger
            
            // console.log(`${unit.stats.name} angrep fiende!`); // Debug
        }
    }
}

// --- LOGIKK FOR FIENDER ---
function updateEnemy(enemy, dt, index) {
    // Sjekk død
    if (enemy.hp <= 0) {
        gameState.enemies.splice(index, 1);
        gameState.money += 15;
        updateUI();
        return;
    }

    const dx = GameConfig.baseX - enemy.x;
    const dy = GameConfig.baseY - enemy.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    let canMove = true;

    // Sjekk kollisjon med murer
    for (let w of gameState.walls) {
        if (!w.isBroken) {
            // Ignorer porten hvis den er åpen
            if (w.isGate && gameState.isGateOpen) continue;

            const wDist = Math.sqrt((w.x - enemy.x)**2 + (w.y - enemy.y)**2);
            // Hvis vi treffer muren
            if (wDist < (w.radius + enemy.radius)) {
                canMove = false;
                enemy.attackTimer -= dt;
                
                // Slå på muren
                if (enemy.attackTimer <= 0) {
                    w.hp -= enemy.damage;
                    enemy.attackTimer = 1.0;
                    if (w.hp <= 0) {
                        w.hp = 0; 
                        w.isBroken = true;
                    }
                }
                break; // Slå bare på én mur om gangen
            }
        }
    }

    // Bevegelse
    if (canMove) {
        if (dist > 30) {
            enemy.x += (dx / dist) * enemy.speed * dt;
            enemy.y += (dy / dist) * enemy.speed * dt;
        } else {
            // Angrip basen
            gameState.baseHealth -= (enemy.damage * dt);
            updateUI();
        }
    }
}

// === SEKSJON 10: HJELPEFUNKSJONER ===
function startNextWave() {
    if (gameState.enemiesToSpawn > 0 || gameState.enemies.length > 0) {
        uiMessage.innerText = "Fullfør bølgen først!";
        return;
    }
    gameState.gameActive = true;
    const enemyCount = 5 + (gameState.wave * 3);
    gameState.enemiesToSpawn = enemyCount;
    uiMessage.innerText = `Bølge ${gameState.wave} starter!`;
}

function upgradeWall() {
    if (gameState.money >= 150) {
        gameState.money -= 150;
        gameState.walls.forEach(w => { 
            if (!w.isBroken) w.hp = Math.min(w.hp + 50, w.maxHp); 
        });
        updateUI();
        uiMessage.innerText = "Murer reparert!";
    }
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
}

function endWave() {
    gameState.gameActive = false;
    gameState.wave++;
    gameState.money += 150;
    updateUI();
    uiMessage.innerText = "Bølge over! +150 gull.";
}

function spawnEnemy() {
    const isBoss = (gameState.wave % 4 === 0) && (gameState.enemiesToSpawn === 1);
    const spawnX = Math.random() * (canvas.width - 200) + 100;
    
    gameState.enemies.push({
        x: spawnX, 
        y: -20,
        speed: isBoss ? 20 : GameConfig.baseEnemySpeed + (gameState.wave * 2),
        hp: isBoss ? 600 : 30 + (gameState.wave * 10),
        maxHp: isBoss ? 600 : 30 + (gameState.wave * 10),
        damage: isBoss ? 50 : 10,
        radius: isBoss ? 20 : 10,
        color: isBoss ? "#800000" : "#c0392b",
        attackTimer: 0
    });
}

function updateUI() {
    uiWave.innerText = gameState.wave;
    uiGold.innerText = gameState.money;
    uiBaseHp.innerText = Math.floor(gameState.baseHealth) + "%";
}

// === SEKSJON 11: TEGNING ===
function draw() {
    // 1. Bakgrunn
    ctx.fillStyle = "#27ae60"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Basen
    ctx.fillStyle = "#8e44ad";
    ctx.beginPath(); ctx.arc(GameConfig.baseX, GameConfig.baseY, 25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "20px Arial"; ctx.fillText("♔", GameConfig.baseX, GameConfig.baseY);

    // 3. Murer
    gameState.walls.forEach(wall => {
        ctx.save();
        ctx.translate(wall.x, wall.y);
        ctx.rotate(wall.angle + Math.PI / 2);

        // Tegn trapp bak
        ctx.fillStyle = "#8d6e63"; ctx.fillRect(-10, 20, 20, 30); 

        if (!wall.isBroken) {
            // Fargelegging
            if (wall.isGate) {
                ctx.fillStyle = gameState.isGateOpen ? "#34495e" : "#5d4037"; 
            } else {
                ctx.fillStyle = "#7f8c8d";
            }
            
            // Tegn selve boksen
            if (wall.isGate && gameState.isGateOpen) {
                 ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2;
                 ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            } else {
                ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
                ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
                // HP Bar
                const hpPercent = wall.hp / wall.maxHp;
                ctx.fillStyle = "#00ff00"; ctx.fillRect(-wall.width/2, -5, wall.width * hpPercent, 5);
            }
        } else {
            // Ødelagt
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillText("X", 0, 0);
        }
        ctx.restore();
    });

    // 4. Slots (Vis kun relevante)
    gameState.slots.forEach(slot => {
        // Vis hvis enhet er valgt (for å vise hvor man kan gå) ELLER hvis slotten har en enhet
        const showSlots = (gameState.selectedUnit && gameState.selectedUnit.state !== 'MOVING') || slot.unit;
        
        if (showSlots) {
            ctx.beginPath(); 
            ctx.arc(slot.x, slot.y, 6, 0, Math.PI * 2);
            
            // Hvis vi skal flytte noen, vis fargekoder
            if (!slot.unit && gameState.selectedUnit) {
                 const isMelee = gameState.selectedUnit.stats.type === 'melee';
                 const illegal = (isMelee && slot.type === 'wall');
                 
                 ctx.fillStyle = illegal ? "rgba(255,0,0,0.3)" : "rgba(255,255,255,0.4)";
                 ctx.fill(); 
                 ctx.strokeStyle = "#fff"; ctx.stroke();
            }
        }
    });

    // 5. Enheter (Våre soldater)
    gameState.units.forEach(u => {
        ctx.beginPath(); 
        ctx.arc(u.x, u.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = u.color; 
        ctx.fill();
        
        // Markering av valgt enhet
        if (gameState.selectedUnit === u) {
            ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
            
            // Vis rekkevidde
            ctx.beginPath();
            ctx.arc(u.x, u.y, u.stats.range, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.3)";
            ctx.setLineDash([5, 5]); 
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            ctx.strokeStyle = "#000"; ctx.stroke();
        }

        ctx.fillStyle = "#fff"; ctx.font = "12px Arial"; ctx.fillText(u.stats.name.charAt(0), u.x, u.y);

        // Tegn angreps-laser
        if (u.attackLine > 0) {
            ctx.strokeStyle = "yellow"; ctx.lineWidth = 2; 
            ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.targetX, u.targetY); ctx.stroke();
        }
    });

    // 6. Fiender
    gameState.enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill();
        
        // HP Bar
        const hpPercent = e.hp / e.maxHp;
        ctx.fillStyle = "red"; ctx.fillRect(e.x-10, e.y-15, 20, 4);
        ctx.fillStyle = "#00ff00"; ctx.fillRect(e.x-10, e.y-15, 20*hpPercent, 4);
    });
}

// Start
window.onload = init;

/* Version: #10 */
