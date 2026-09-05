// ==========================================================================
// SIMON SAYS — Game Logic & Web Audio Synthesizer
// Hardened for Standalone & Sandboxed Iframe Embedding
// ==========================================================================

// Safe Storage Helper (avoids DOMException in sandboxed iframes)
function safeGetStorage(key, fallback = null) {
    try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
            const val = window.localStorage.getItem(key);
            return val !== null ? val : fallback;
        }
    } catch (e) {
        // Storage access blocked by sandbox or browser privacy settings
    }
    return fallback;
}

function safeSetStorage(key, value) {
    try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
            window.localStorage.setItem(key, value);
        }
    } catch (e) {
        // Storage write blocked by sandbox or browser privacy settings
    }
}

// Game State Variables
const colors = ["green", "red", "yellow", "blue"];
let sequence = [];
let userSequence = [];
let score = 0;
let bestScore = parseInt(safeGetStorage('simonSaysBestScore', '0'), 10) || 0;
let playing = false;
let gameState = "IDLE"; // IDLE, WATCHING, PLAYING, GAME_OVER
let difficulty = "medium";
let startTime = 0;
let reactionTimes = [];
let avgReactionTime = 0;

// Audio Configuration (Harmonic C-Major triad frequencies)
const toneFrequencies = {
    red: 261.63,    // C4
    green: 329.63,  // E4
    yellow: 392.00, // G4
    blue: 523.25    // C5
};

let audioCtx = null;
let soundMuted = safeGetStorage('simonSaysMuted', 'false') === 'true';

// Difficulty timing configurations (ms)
const difficulties = {
    easy: { delay: 650, gap: 300, displayTime: 450 },
    medium: { delay: 450, gap: 180, displayTime: 320 },
    hard: { delay: 300, gap: 100, displayTime: 200 }
};

// DOM References (populated on initialization)
let colorBtns = [];
let startBtn = null;
let messageDisplay = null;
let scoreVal = null;
let bestVal = null;
let seqVal = null;
let reactionVal = null;
let stateDisplay = null;
let stateText = null;
let soundBtn = null;
let soundIconOn = null;
let soundIconOff = null;
let legacyScore = null;
let legacyPerf = null;
let legacyDiff = null;

// ==========================================================================
// WEB AUDIO SYNTHESIZER (Graceful fallback if restricted)
// ==========================================================================
function initAudio() {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    } catch (e) {
        console.warn('AudioContext initialization failed or blocked:', e);
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
        // Audio output muted/prevented by policy
    }
}

function playSuccessChime() {
    if (soundMuted) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.2, 'triangle'), idx * 75);
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
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
    } catch (e) {
        // Ignored
    }
}

function toggleSound() {
    soundMuted = !soundMuted;
    safeSetStorage('simonSaysMuted', soundMuted ? 'true' : 'false');
    updateSoundIcon();
}

function updateSoundIcon() {
    if (!soundIconOn || !soundIconOff || !soundBtn) return;
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
// DISPLAY & HUD UPDATES
// ==========================================================================
function updateDisplay() {
    if (scoreVal) scoreVal.textContent = score;
    if (bestVal) bestVal.textContent = bestScore;
    if (seqVal) seqVal.textContent = sequence.length;
    if (reactionVal) reactionVal.textContent = avgReactionTime > 0 ? `${avgReactionTime}ms` : "--";

    if (stateText) stateText.textContent = gameState;
    if (stateDisplay) {
        stateDisplay.className = `state-pill state-${gameState.toLowerCase().replace('_', '-')}`;
    }

    if (messageDisplay) {
        if (gameState === "IDLE") {
            messageDisplay.textContent = score > 0 ? "Ready for next round" : "Press Start Game to begin sequence";
        } else if (gameState === "WATCHING") {
            messageDisplay.textContent = "Watch carefully...";
        } else if (gameState === "PLAYING") {
            messageDisplay.textContent = "Your turn! Repeat the pattern";
        } else if (gameState === "GAME_OVER") {
            messageDisplay.textContent = `Game Over! Final Score: ${score}. Press Start to retry.`;
        }
    }

    if (startBtn) {
        if (playing) {
            startBtn.textContent = "Restart Game";
        } else {
            startBtn.textContent = gameState === "GAME_OVER" ? "Play Again" : "Start Game";
        }
    }

    // Legacy DOM sync for backward compatibility
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
    colorBtns.forEach(btn => { if (btn) btn.disabled = true; });

    let i = 0;
    const config = difficulties[difficulty];

    const playNextLight = () => {
        if (!playing) return;

        if (i >= sequence.length) {
            colorBtns.forEach(btn => { if (btn) btn.disabled = false; });
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
    const target = e.currentTarget || e.target;
    const color = target ? target.id : null;
    if (!color || !colors.includes(color)) return;

    const clickTime = Date.now();
    const reactionTime = startTime > 0 ? (clickTime - startTime) : 0;

    userSequence.push(color);
    activatePad(color, 200);

    const idx = userSequence.length - 1;

    // Incorrect move
    if (userSequence[idx] !== sequence[idx]) {
        gameState = "GAME_OVER";
        playing = false;
        colorBtns.forEach(btn => { if (btn) btn.disabled = true; });
        playGameOverTone();

        if (score > bestScore) {
            bestScore = score;
            safeSetStorage('simonSaysBestScore', String(bestScore));
        }
        updateDisplay();
        return;
    }

    // Record valid reaction time
    if (reactionTime > 0) {
        reactionTimes.push(reactionTime);
        const sum = reactionTimes.reduce((a, b) => a + b, 0);
        avgReactionTime = Math.round(sum / reactionTimes.length);
    }

    // Sequence completed successfully
    if (userSequence.length === sequence.length) {
        score++;
        gameState = "IDLE";
        colorBtns.forEach(btn => { if (btn) btn.disabled = true; });
        playSuccessChime();
        updateDisplay();
        setTimeout(nextRound, 900);
    } else {
        startTime = Date.now(); // Reset timer for next input in sequence
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
    colorBtns.forEach(btn => { if (btn) btn.disabled = true; });
    setTimeout(nextRound, 600);
}

function setDifficulty(level) {
    // Prevent changing difficulty during gameplay
    if (playing) return;

    difficulty = level;
    updateDisplay();
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === level);
    });
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
function initGame() {
    colorBtns = colors.map(c => document.getElementById(c)).filter(Boolean);
    startBtn = document.getElementById("start-btn");
    messageDisplay = document.getElementById("message");

    scoreVal = document.getElementById("score-val");
    bestVal = document.getElementById("best-val");
    seqVal = document.getElementById("seq-val");
    reactionVal = document.getElementById("reaction-val");

    stateDisplay = document.getElementById("state-display");
    stateText = document.getElementById("state-text");
    soundBtn = document.getElementById("sound-btn");
    soundIconOn = document.getElementById("sound-icon-on");
    soundIconOff = document.getElementById("sound-icon-off");

    legacyScore = document.getElementById("score");
    legacyPerf = document.getElementById("performance-display");
    legacyDiff = document.getElementById("difficulty-display");

    colorBtns.forEach(btn => {
        btn.addEventListener("click", handleColorClick);
    });

    if (startBtn) {
        startBtn.addEventListener("click", () => {
            initAudio();
            startGame();
        });
    }

    if (soundBtn) {
        soundBtn.addEventListener("click", toggleSound);
    }

    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
    });

    updateSoundIcon();
    updateDisplay();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGame);
} else {
    initGame();
}
