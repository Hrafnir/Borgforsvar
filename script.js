/* Version: #4 */

// === KONFIGURASJON ===
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    debugMode: true,
    // Base-konfigurasjon
    baseX: 500,         // Basen ligger midt på i bredden
    baseY: 550,         // Basen ligger langt nede (Sør)
    wallRadius: 200,    // Hvor langt ut fra basen muren står
    wallSegments: 7     // Antall soner i muren
};

// === SPILL-TILSTAND (STATE) ===
let gameState = {
    money: 100,
    wave: 1,
    baseHealth: 100, // Basens totale liv
    isPaused: false,
    gameActive: false,
    lastTime: 0,
    
    // Lister for spillobjekter
    walls: [],      // Lagrer objektene som utgjør muren
    slots: [],      // Lagrer steder man kan plassere soldater
    enemies: [],    // Lagrer fiender (kommer senere)
    units: []       // Lagrer våre soldater (kommer senere)
};

// === DOM ELEMENTER ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elementer
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
    log("Initialiserer Top-Down Base Defense...");
    
    // Generer muren og slots basert på hestesko-formen
    createLevelGeometry();

    setupEventListeners();
    
    log("Starter Game Loop...");
    requestAnimationFrame(gameLoop);
}

// === OPPSETT AV NIVÅ (GEOMETRI) ===
function createLevelGeometry() {
    // Vi skal lage en halvsirkel (hestesko) rundt basen.
    // Basen er (500, 550). Fiender kommer fra Nord (Y=0).
    // Vi sprer murene fra vinkel 180 grader (Venstre/Vest) til 0 grader (Høyre/Øst), 
    // men vi begrenser det litt så det peker mest mot Nord.
    // La oss bruke vinkler fra ca 200 grader til 340 grader (hvor 270 er rett opp).

    const startAngle = Math.PI * 1.1; // Ca 198 grader
    const endAngle = Math.PI * 1.9;   // Ca 342 grader
    const totalSegments = GameConfig.wallSegments;

    gameState.walls = [];
    gameState.slots = [];

    for (let i = 0; i < totalSegments; i++) {
        // Beregn vinkel for denne seksjonen
        // Interpolering: Finn hvor mellom start og slutt vi er (0.0 til 1.0)
        const t = i / (totalSegments - 1);
        const angle = startAngle + t * (endAngle - startAngle);

        // Beregn posisjon (Polar til Kartesisk)
        // X = cx + r * cos(a)
        // Y = cy + r * sin(a)
        const wx = GameConfig.baseX + GameConfig.wallRadius * Math.cos(angle);
        const wy = GameConfig.baseY + GameConfig.wallRadius * Math.sin(angle);

        // Opprett Mur-Seksjon
        const wallSegment = {
            id: `wall-${i}`,
            x: wx,
            y: wy,
            width: 60,
            height: 40,
            angle: angle, // Lagrer vinkelen for å rotere tegningen riktig
            hp: 100,
            maxHp: 100,
            isBroken: false
        };
        gameState.walls.push(wallSegment);

        // Opprett Slots (Plasseringspunkter) for denne muren
        // Vi bruker vektorer for å finne posisjon "foran" og "bak" muren i forhold til basen
        
        // Slot 1: Utside (Mot fienden) - Litt lenger ut enn muren
        const outDist = 50;
        gameState.slots.push({
            id: `slot-out-${i}`,
            type: 'outside',
            parentWallId: wallSegment.id,
            x: GameConfig.baseX + (GameConfig.wallRadius + outDist) * Math.cos(angle),
            y: GameConfig.baseY + (GameConfig.wallRadius + outDist) * Math.sin(angle),
            occupied: false
        });

        // Slot 2: På Muren
        gameState.slots.push({
            id: `slot-wall-${i}`,
            type: 'wall',
            parentWallId: wallSegment.id,
            x: wx,
            y: wy,
            occupied: false
        });

        // Slot 3: Innside (Trygt) - Litt nærmere basen
        const inDist = 50;
        gameState.slots.push({
            id: `slot-in-${i}`,
            type: 'inside',
            parentWallId: wallSegment.id,
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

// === LOGIKK FUNKSJONER ===

function buyUnit(type, cost) {
    if (gameState.money >= cost) {
        // I et strategispill velger man ofte enhet FØRst, så klikker man på kartet.
        // For enkelhets skyld nå: Vi lagrer hva vi vil kjøpe i en "selectedAction" variabel (kommer senere)
        // Enn så lenge trekker vi penger bare for å vise at knappen virker
        gameState.money -= cost;
        updateUI();
        uiMessage.innerText = `Valgt ${type}. Klikk på en hvit sirkel for å plassere! (Ikke implementert enda)`;
    } else {
        uiMessage.innerText = "Ikke nok penger!";
    }
}

function upgradeWall() {
    if (gameState.money >= 150) {
        gameState.money -= 150;
        // Reparer alle murer litt
        gameState.walls.forEach(w => {
            w.hp = Math.min(w.hp + 20, w.maxHp);
        });
        updateUI();
        uiMessage.innerText = "Alle murer reparert (+20 HP)!";
    } else {
        uiMessage.innerText = "Mangler gull (150g).";
    }
}

function researchWeapons() {
    if (gameState.money >= 300) {
        gameState.money -= 300;
        updateUI();
        uiMessage.innerText = "Våpenteknologi oppgradert!";
    } else {
        uiMessage.innerText = "Mangler gull (300g).";
    }
}

function startNextWave() {
    gameState.gameActive = true;
    log(`Starter bølge ${gameState.wave} fra NORD!`);
    uiMessage.innerText = `Fiender kommer fra Nord!`;
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    const btn = document.getElementById('btn-pause');
    btn.innerText = gameState.isPaused ? "Fortsett" : "Pause";
    btn.style.backgroundColor = gameState.isPaused ? "#27ae60" : "#f39c12";
}

function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Sjekk om vi traff en slot
    let clickedSlot = null;
    
    // Enkel sirkel-sjekk for klikk
    const clickRadius = 15; 

    gameState.slots.forEach(slot => {
        const dx = mouseX - slot.x;
        const dy = mouseY - slot.y;
        if (Math.sqrt(dx*dx + dy*dy) < clickRadius) {
            clickedSlot = slot;
        }
    });

    if (clickedSlot) {
        log(`Klikket på slot: ${clickedSlot.id} (${clickedSlot.type})`);
        uiMessage.innerText = `Valgt sone: ${clickedSlot.type}`;
    } else {
        log(`Klikk på bakken: ${Math.floor(mouseX)}, ${Math.floor(mouseY)}`);
    }
}

function updateUI() {
    uiWave.innerText = gameState.wave;
    uiGold.innerText = gameState.money;
    uiBaseHp.innerText = gameState.baseHealth + "%";
}

// === GAME LOOP ===
function gameLoop(timestamp) {
    const deltaTime = timestamp - gameState.lastTime;
    gameState.lastTime = timestamp;

    if (!gameState.isPaused) {
        update(deltaTime);
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    // Her vil fiende-bevegelse skje
}

// === TEGNING (DRAWING) ===
function draw() {
    // 1. Bakgrunn (Gress)
    ctx.fillStyle = "#27ae60"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Rutenett / Grid (Valgfritt, for å se perspektivet bedre)
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i+=50) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i+=50) {
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // 3. Tegn Basen (Hjertet) i Sør
    ctx.fillStyle = "#8e44ad"; // Lilla konge-farge
    ctx.beginPath();
    ctx.arc(GameConfig.baseX, GameConfig.baseY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Et lite symbol i midten
    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♔", GameConfig.baseX, GameConfig.baseY);

    // 4. Tegn Muren (Seksjoner)
    gameState.walls.forEach(wall => {
        ctx.save(); // Lagre nåværende tegnestil
        
        // Flytt origo til murens posisjon for å kunne rotere den
        ctx.translate(wall.x, wall.y);
        // Roter slik at muren følger buen (+90 grader / PI/2 fordi rektangler tegnes flatt)
        ctx.rotate(wall.angle + Math.PI / 2);

        if (!wall.isBroken) {
            ctx.fillStyle = "#7f8c8d"; // Grå mur
            // Tegn rektangel sentrert på punktet (-width/2)
            ctx.fillRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            
            // Kantlinje
            ctx.strokeStyle = "#2c3e50";
            ctx.lineWidth = 2;
            ctx.strokeRect(-wall.width / 2, -wall.height / 2, wall.width, wall.height);
            
            // HP Bar på muren
            const hpPercent = wall.hp / wall.maxHp;
            ctx.fillStyle = "red";
            ctx.fillRect(-wall.width/2, -5, wall.width, 5);
            ctx.fillStyle = "#2ecc71"; // Grønn
            ctx.fillRect(-wall.width/2, -5, wall.width * hpPercent, 5);
        } else {
            // Ødelagt mur
            ctx.fillStyle = "#555";
            ctx.fillText("X", 0, 0);
        }

        ctx.restore(); // Tilbakestill transformasjon
    });

    // 5. Tegn Slots (Sirkler hvor man kan plassere soldater)
    gameState.slots.forEach(slot => {
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 8, 0, Math.PI * 2);
        
        if (slot.occupied) {
            ctx.fillStyle = "blue"; // Opptatt
            ctx.fill();
        } else {
            // Fargekode basert på type
            if (slot.type === 'inside') ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; // Hvit ring
            if (slot.type === 'wall') ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";         // Svart ring
            if (slot.type === 'outside') ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";  // Rød ring
            
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Fyll med svak farge så de er synlige
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.fill();
        }
    });

    // 6. Tegn en pil som viser hvor fienden kommer fra
    if (gameState.gameActive) {
        ctx.fillStyle = "rgba(192, 57, 43, 0.5)";
        ctx.beginPath();
        ctx.moveTo(GameConfig.baseX, 10);
        ctx.lineTo(GameConfig.baseX - 20, 40);
        ctx.lineTo(GameConfig.baseX + 20, 40);
        ctx.fill();
    }
}

window.onload = init;
/* Version: #4 */
