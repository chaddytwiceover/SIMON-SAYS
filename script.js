// Simon Says Game Logic
const colors = ["green", "red", "yellow", "blue"];
let sequence = [];
let userSequence = [];
let score = 0;
let bestScore = parseInt(localStorage.getItem('simonSaysBestScore')) || 0;
let playing = false;
let gameState = "IDLE"; // IDLE, WATCHING, PLAYING, GAME_OVER
let difficulty = "medium";
let startTime = 0;
let reactionTimes = [];
let avgReactionTime = 0;

// Difficulty configurations
const difficulties = {
    easy: { delay: 800, gap: 400, displayTime: 600 },
    medium: { delay: 600, gap: 250, displayTime: 400 },
    hard: { delay: 400, gap: 150, displayTime: 250 }
};

const colorBtns = colors.map(c => document.getElementById(c));
const startBtn = document.getElementById("start-btn");
const scoreDisplay = document.getElementById("score");
const messageDisplay = document.getElementById("message");

function updateDisplay() {
    scoreDisplay.textContent = `Score: ${score} | Best: ${bestScore} | Seq: ${sequence.length}`;
    document.getElementById("state-display").textContent = `STATE: ${gameState}`;
    document.getElementById("difficulty-display").textContent = `DIFFICULTY: ${difficulty.toUpperCase()}`;
    
    if (avgReactionTime > 0) {
        document.getElementById("performance-display").textContent = `AVG REACTION: ${avgReactionTime}ms`;
    }
}

function playSequence() {
    userSequence = [];
    gameState = "WATCHING";
    updateDisplay();
    colorBtns.forEach(btn => btn.disabled = true);

    let i = 0;
    const config = difficulties[difficulty];
    const playNextLight = () => {
        if (i >= sequence.length) {
            colorBtns.forEach(btn => btn.disabled = false);
            gameState = "PLAYING";
            startTime = Date.now();
            updateDisplay();
            return;
        }

        const color = sequence[i];
        const btn = colorBtns[colors.indexOf(color)];
        
        setTimeout(() => {
            btn.classList.add("active");
            setTimeout(() => {
                btn.classList.remove("active");
                i++;
                playNextLight();
            }, config.displayTime);
        }, config.gap);
    };

    setTimeout(playNextLight, config.delay);
}

function nextRound() {
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
    playSequence();
}

function handleColorClick(e) {
    if (!playing || gameState !== "PLAYING") return;
    
    const color = e.target.id;
    const clickTime = Date.now();
    const reactionTime = clickTime - startTime;
    
    userSequence.push(color);
    e.target.classList.add("active");
    setTimeout(() => e.target.classList.remove("active"), 200);
    
    const idx = userSequence.length - 1;
    if (userSequence[idx] !== sequence[idx]) {
        gameState = "GAME_OVER";
        playing = false;
        colorBtns.forEach(btn => btn.disabled = true);
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('simonSaysBestScore', bestScore);
        }
        updateDisplay();
        return;
    }
    
    // Update average reaction time incrementally
    reactionTimes.push(reactionTime);
    const sum = reactionTimes.reduce((a, b) => a + b, 0);
    avgReactionTime = Math.round(sum / reactionTimes.length);
    
    if (userSequence.length === sequence.length) {
        score++;
        gameState = "IDLE";
        updateDisplay();
        setTimeout(nextRound, 1000);
    } else {
        startTime = Date.now(); // Reset timer for next button
    }
}

function startGame() {
    sequence = [];
    userSequence = [];
    score = 0;
    reactionTimes = [];
    avgReactionTime = 0;
    playing = true;
    gameState = "IDLE";
    updateDisplay();
    colorBtns.forEach(btn => btn.disabled = true);
    setTimeout(nextRound, 1000);
}

function setDifficulty(level) {
    // Prevent changing difficulty during active gameplay
    if (playing) return;
    
    difficulty = level;
    updateDisplay();
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === level);
    });
}

colorBtns.forEach(btn => btn.addEventListener("click", handleColorClick));
startBtn.addEventListener("click", startGame);

// Initialize difficulty buttons
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
});

// Initial display update
updateDisplay();
