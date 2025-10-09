// Simon Says Game Logic
const colors = ["green", "red", "yellow", "blue"];
let sequence = [];
let userSequence = [];
let score = 0;
let playing = false;

const colorBtns = colors.map(c => document.getElementById(c));
const startBtn = document.getElementById("start-btn");
const scoreDisplay = document.getElementById("score");
const messageDisplay = document.getElementById("message");

function playSequence() {
    userSequence = [];
    messageDisplay.textContent = "Watch the sequence!";
    colorBtns.forEach(btn => btn.disabled = true);

    let i = 0;
    const playNextLight = () => {
        if (i >= sequence.length) {
            colorBtns.forEach(btn => btn.disabled = false);
            messageDisplay.textContent = "Your turn!";
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
            }, 400);
        }, 250);
    };

    setTimeout(playNextLight, 500);
}

function nextRound() {
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
    playSequence();
}

function handleColorClick(e) {
    if (!playing) return;
    const color = e.target.id;
    userSequence.push(color);
    e.target.classList.add("active");
    setTimeout(() => e.target.classList.remove("active"), 200);
    const idx = userSequence.length - 1;
    if (userSequence[idx] !== sequence[idx]) {
        messageDisplay.textContent = "Wrong! Game Over.";
        playing = false;
        colorBtns.forEach(btn => btn.disabled = true);
        return;
    }
    if (userSequence.length === sequence.length) {
        score++;
        scoreDisplay.textContent = `Score: ${score}`;
        messageDisplay.textContent = "Correct! Next round...";
        setTimeout(nextRound, 1000);
    }
}

function startGame() {
    sequence = [];
    userSequence = [];
    score = 0;
    playing = true;
    scoreDisplay.textContent = "Score: 0";
    messageDisplay.textContent = "Get ready!";
    colorBtns.forEach(btn => btn.disabled = true);
    setTimeout(nextRound, 1000);
}

colorBtns.forEach(btn => btn.addEventListener("click", handleColorClick));
startBtn.addEventListener("click", startGame);
