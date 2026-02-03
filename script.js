/* Version: #3 */

// === KONFIGURASJON ===
// Her samler vi faste verdier som ikke endres underveis
const GameConfig = {
    canvasWidth: 1000,
    canvasHeight: 600,
    groundLevel: 500, // Y-posisjon hvor bakken starter (pixel fra toppen)
    wallX: 400,       // X-posisjon hvor muren står
    wallWidth: 60,    // Hvor tykk muren er
    debugMode: true   // Sett til false for å skru av detaljert logging senere
};

// === SPILL-TILSTAND (STATE) ===
// Her lagres alt som endres mens vi spiller
let gameState = {
    money: 100,
    wave: 1,
    baseHealth: 100,    // Prosent
    isPaused: false,
    gameActive: false,  // Blir true når vi starter første bølge
    lastTime: 0         // Brukes for å beregne tid mellom frames (delta time)
};

// === DOM ELEMENTER ===
// Vi henter referanser til HTML-elementene vi trenger
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elementer for oppdatering av tall
const uiWave = document.getElementById('wave-display');
const uiGold = document.getElementById('gold-display');
const uiBaseHp = document.getElementById('base-hp-display');
const uiMessage = document.getElementById('status-message');

// === LOGGING FUNKSJON ===
function log(msg) {
    if (GameConfig.debugMode) {
        console.log(`[GameLog]: ${msg}`);
    }
}

// === INITIALISERING ===
// Denne funksjonen kjøres én gang når siden lastes
function init() {
    log("Initialiserer spillet...");
    
    // Sett opp lyttere på knappene (Event Listeners)
    setupEventListeners();
    
    // Start Game Loop
    log("Starter Game Loop...");
    requestAnimationFrame(gameLoop);
}

// === EVENT LISTENERS (KNAPPER OG MUS) ===
function setupEventListeners() {
    // Rekruttering
    document.getElementById('btn-buy-peasant').addEventListener('click', () => buyUnit('peasant', 50));
    document.getElementById('btn-buy-archer').addEventListener('click', () => buyUnit('archer', 100));
    document.getElementById('btn-buy-knight').addEventListener('click', () => buyUnit('knight', 200));

    // Oppgraderinger
    document.getElementById('btn-upgrade-wall').addEventListener('click', () => upgradeWall());
    document.getElementById('btn-research-dmg').addEventListener('click', () => researchWeapons());

    // Spillkontroll
    document.getElementById('btn-start-wave').addEventListener('click', startNextWave);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    
    // Musklikk på canvas (for å plassere ting senere)
    canvas.addEventListener('mousedown', handleCanvasClick);
}

// === HANDLINGSFUNKSJONER (LOGIKK) ===

function buyUnit(type, cost) {
    if (gameState.money >= cost) {
        gameState.money -= cost;
        updateUI();
        log(`Kjøpte enhet: ${type} for ${cost} gull. Ny saldo: ${gameState.money}`);
        uiMessage.innerText = `Rekrutterte ${type}!`;
        // Her skal vi senere legge til logikk for å faktisk plassere soldaten
    } else {
        log(`Ikke nok penger til ${type}. Trenger ${cost}, har ${gameState.money}.`);
        uiMessage.innerText = "Ikke nok penger!";
    }
}

function upgradeWall() {
    const cost = 150;
    if (gameState.money >= cost) {
        gameState.money -= cost;
        // Her skal vi øke murens HP eller stats
        updateUI();
        log("Muren oppgradert/reparert.");
        uiMessage.innerText = "Muren er forsterket!";
    } else {
        uiMessage.innerText = "Mangler gull til mur-oppgradering.";
    }
}

function researchWeapons() {
    const cost = 300;
    if (gameState.money >= cost) {
        gameState.money -= cost;
        updateUI();
        log("Forsket på bedre våpen.");
        uiMessage.innerText = "Våpen er nå skarpere!";
    } else {
        uiMessage.innerText = "Trenger mer gull til forskning.";
    }
}

function startNextWave() {
    if (!gameState.gameActive) {
        gameState.gameActive = true;
    }
    log(`Starter bølge ${gameState.wave}!`);
    uiMessage.innerText = `Bølge ${gameState.wave} kommer!`;
    // Her skal vi senere trigge fiende-spawning
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    const btn = document.getElementById('btn-pause');
    
    if (gameState.isPaused) {
        btn.innerText = "Fortsett";
        btn.style.backgroundColor = "#27ae60"; // Grønn
        log("Spill pauset.");
        uiMessage.innerText = "PAUSE";
    } else {
        btn.innerText = "Pause";
        btn.style.backgroundColor = "#f39c12"; // Oransje
        log("Spill fortsetter.");
        uiMessage.innerText = "Kampen fortsetter!";
    }
}

function handleCanvasClick(event) {
    // Finner musens posisjon relativt til canvaset
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    log(`Klikk registrert på: X=${Math.floor(mouseX)}, Y=${Math.floor(mouseY)}`);
}

function updateUI() {
    uiWave.innerText = gameState.wave;
    uiGold.innerText = gameState.money;
    uiBaseHp.innerText = gameState.baseHealth + "%";
}

// === GAME LOOP (MOTOREN) ===
function gameLoop(timestamp) {
    // Beregn tid siden sist (delta time) - nyttig for jevn bevegelse senere
    const deltaTime = timestamp - gameState.lastTime;
    gameState.lastTime = timestamp;

    if (!gameState.isPaused) {
        update(deltaTime);
        draw();
    }

    // Be om neste frame (ca 60 ganger i sekundet)
    requestAnimationFrame(gameLoop);
}

// === UPDATE (OPPDATER LOGIKK) ===
function update(deltaTime) {
    // Her skal vi flytte fiender, prosjektiler, sjekke kollisjoner osv.
    // Foreløpig tomt, men klart til bruk.
}

// === DRAW (TEGNE ALT PÅ NYTT) ===
function draw() {
    // 1. Tøm hele lerretet før vi tegner på nytt
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Tegn himmel (Bakgrunn)
    // (Vi kan bruke CSS background, men tegner vi her har vi full kontroll)
    
    // 3. Tegn Bakken
    ctx.fillStyle = "#2ecc71"; // Gress-grønn
    ctx.fillRect(0, GameConfig.groundLevel, canvas.width, canvas.height - GameConfig.groundLevel);
    
    // Tegn en linje for bakkenivået
    ctx.strokeStyle = "#27ae60";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GameConfig.groundLevel);
    ctx.lineTo(canvas.width, GameConfig.groundLevel);
    ctx.stroke();

    // 4. Tegn Muren (Placeholder - en grå boks)
    ctx.fillStyle = "#7f8c8d"; // Grå murstein
    ctx.fillRect(GameConfig.wallX, GameConfig.groundLevel - 200, GameConfig.wallWidth, 200);
    
    // Tegn omrisset av muren
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 3;
    ctx.strokeRect(GameConfig.wallX, GameConfig.groundLevel - 200, GameConfig.wallWidth, 200);

    // 5. Tegn "Hjertet" (Slutten av banen - Venstre side)
    ctx.fillStyle = "#c0392b"; // Rød
    ctx.fillRect(10, GameConfig.groundLevel - 60, 40, 60);
    
    // 6. Tegn tekst hvis spillet ikke er aktivt ennå
    if (!gameState.gameActive) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Trykk 'Start Neste Bølge' for å begynne!", canvas.width / 2, canvas.height / 2);
    }
}

// Start hele sulamitten!
// Vi venter til vinduet er lastet for å være sikre på at HTML finnes
window.onload = init;

/* Version: #3 */
