// ==========================================================================
// SIMON SAYS — Game Logic & Web Audio Synthesizer
// ==========================================================================

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

// Audio Configuration & Frequencies (Harmonic C-Major triad frequencies)
const toneFrequencies = {
    red: 261.63,    // C4
    green: 329.63,  // E4
    yellow: 392.00, // G4
    blue: 523.25    // C5
};

let audioCtx = null;
let soundMuted = localStorage.getItem('simonSaysMuted') === 'true';

// Difficulty timing configurations (ms)
const difficulties = {
    easy: { delay: 700, gap: 350, displayTime: 500 },
    medium: { delay: 500, gap: 200, displayTime: 350 },
    hard: { delay: 350, gap: 120, displayTime: 220 }
};

// DOM References
const colorBtns = colors.map(c => document.getElementById(c));
const startBtn = document.getElementById("start-btn");
const messageDisplay = document.getElementById("message");

const scoreVal = document.getElementById("score-val");
const bestVal = document.getElementById("best-val");
const seqVal = document.getElementById("seq-val");
const reactionVal = document.getElementById("reaction-val");

const stateDisplay = document.getElementById("state-display");
const stateText = document.getElementById("state-text");
const soundBtn = document.getElementById("sound-btn");
const soundIconOn = document.getElementById("sound-icon-on");
const soundIconOff = document.getElementById("sound-icon-off");

// Legacy references for backwards compatibility
const legacyScore = document.getElementById("score");
const legacyPerf = document.getElementById("performance-display");
const legacyDiff = document.getElementById("difficulty-display");

// ==========================================================================
// WEB AUDIO SYNTHESIZER
// ==========================================================================
function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, duration = 0.25, type = 'sine') {
    if (soundMuted) return;
    initAudio();
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.05);
    } catch (e) {
        console.warn('Audio playback error:', e);
    }
}

function playSuccessChime() {
    if (soundMuted) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.22, 'triangle'), idx * 80);
    });
}

function playGameOverTone() {
    if (soundMuted) return;
    initAudio();
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.5);
    } catch (e) {
        console.warn('Game over tone error:', e);
    }
}

function toggleSound() {
    soundMuted = !soundMuted;
    localStorage.setItem('simonSaysMuted', soundMuted);
    updateSoundIcon();
}

function updateSoundIcon() {
    if (soundMuted) {
        soundIconOn.classList.add("hidden");
        soundIconOff.classList.remove("hidden");
        soundBtn.setAttribute("aria-label", "Unmute sound");
    } else {
        soundIconOn.classList.remove("hidden");
        soundIconOff.classList.add("hidden");
        soundBtn.setAttribute("aria-label", "Mute sound");
    }
}

// ==========================================================================
// DISPLAY UPDATES
// ==========================================================================
function updateDisplay() {
    // HUD Cards
    scoreVal.textContent = score;
    bestVal.textContent = bestScore;
    seqVal.textContent = sequence.length;
    reactionVal.textContent = avgReactionTime > 0 ? `${avgReactionTime}ms` : "--";

    // State Pill Indicator
    stateText.textContent = gameState;
    stateDisplay.className = `state-pill state-${gameState.toLowerCase().replace('_', '-')}`;

    // Prompts and Messages
    if (gameState === "IDLE") {
        messageDisplay.textContent = score > 0 ? "Ready for next round" : "Press Start Game to begin sequence";
    } else if (gameState === "WATCHING") {
        messageDisplay.textContent = "Watch carefully...";
    } else if (gameState === "PLAYING") {
        messageDisplay.textContent = "Your turn! Repeat the pattern";
    } else if (gameState === "GAME_OVER") {
        messageDisplay.textContent = `Game Over! Final Score: ${score}. Press Start to retry.`;
    }

    // Start button text
    if (playing) {
        startBtn.textContent = "Restart Game";
    } else {
        startBtn.textContent = gameState === "GAME_OVER" ? "Play Again" : "Start Game";
    }

    // Legacy DOM sync if needed
    if (legacyScore) legacyScore.textContent = `Score: ${score} | Best: ${bestScore} | Seq: ${sequence.length}`;
    if (legacyPerf && avgReactionTime > 0) legacyPerf.textContent = `AVG REACTION: ${avgReactionTime}ms`;
    if (legacyDiff) legacyDiff.textContent = `DIFFICULTY: ${difficulty.toUpperCase()}`;
}

// ==========================================================================
// GAMEPLAY LOGIC
// ==========================================================================
function activatePad(color, duration = 300) {
    const btn = document.getElementById(color);
    if (!btn) return;

    btn.classList.add("active");
    playTone(toneFrequencies[color], duration / 1000);

    setTimeout(() => {
        btn.classList.remove("active");
    }, duration);
}

function playSequence() {
    userSequence = [];
    gameState = "WATCHING";
    updateDisplay();
    colorBtns.forEach(btn => btn.disabled = true);

    let i = 0;
    const config = difficulties[difficulty];

    const playNextLight = () => {
        if (!playing) return;

        if (i >= sequence.length) {
            colorBtns.forEach(btn => btn.disabled = false);
            gameState = "PLAYING";
            startTime = Date.now();
            updateDisplay();
            return;
        }

        const color = sequence[i];
        activatePad(color, config.displayTime);

        i++;
        setTimeout(playNextLight, config.displayTime + config.gap);
    };

    setTimeout(playNextLight, config.delay);
}

function nextRound() {
    if (!playing) return;
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
    playSequence();
}

function handleColorClick(e) {
    if (!playing || gameState !== "PLAYING") return;

    initAudio();
    const color = e.currentTarget.id;
    const clickTime = Date.now();
    const reactionTime = clickTime - startTime;

    userSequence.push(color);
    activatePad(color, 220);

    const idx = userSequence.length - 1;

    // Wrong guess
    if (userSequence[idx] !== sequence[idx]) {
        gameState = "GAME_OVER";
        playing = false;
        colorBtns.forEach(btn => btn.disabled = true);
        playGameOverTone();

        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('simonSaysBestScore', bestScore);
        }
        updateDisplay();
        return;
    }

    // Reaction tracking
    reactionTimes.push(reactionTime);
    const sum = reactionTimes.reduce((a, b) => a + b, 0);
    avgReactionTime = Math.round(sum / reactionTimes.length);

    // Completed current sequence
    if (userSequence.length === sequence.length) {
        score++;
        gameState = "IDLE";
        colorBtns.forEach(btn => btn.disabled = true);
        playSuccessChime();
        updateDisplay();
        setTimeout(nextRound, 1000);
    } else {
        startTime = Date.now(); // Reset timer for the next press
    }
}

function startGame() {
    initAudio();
    sequence = [];
    userSequence = [];
    score = 0;
    reactionTimes = [];
    avgReactionTime = 0;
    playing = true;
    gameState = "IDLE";
    updateDisplay();
    colorBtns.forEach(btn => btn.disabled = true);
    setTimeout(nextRound, 800);
}

function setDifficulty(level) {
    // Prevent changing difficulty during active gameplay
    if (playing) return;

    difficulty = level;
    updateDisplay();
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === level);
    });
}

// ==========================================================================
// EVENT LISTENERS & INITIALIZATION
// ==========================================================================
colorBtns.forEach(btn => {
    btn.addEventListener("click", handleColorClick);
});

startBtn.addEventListener("click", () => {
    initAudio();
    startGame();
});

soundBtn.addEventListener("click", toggleSound);

document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
});

// Sound and display initialization
updateSoundIcon();
updateDisplay();
