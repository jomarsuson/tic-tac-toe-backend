
"use strict";

// Render backend URL
const API_URL = "https://tic-tac-toe-backend-1vkx.onrender.com";

// Game elements
const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const historyList = document.getElementById("historyList");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const historyMenuBtn = document.getElementById("historyMenuBtn");
const historySidebar = document.getElementById("historySidebar");
const closeHistoryBtn = document.getElementById("closeHistoryBtn");

const aiModeBtn = document.getElementById("aiModeBtn");
const twoPlayerModeBtn = document.getElementById("twoPlayerModeBtn");
const opponentLabel = document.getElementById("opponentLabel");
const boardElement = document.querySelector(".board");
const gameContainer = document.querySelector(".game-container");

// Sound effects
const soundToggle = document.getElementById("soundToggle");
const soundIcon = document.getElementById("soundIcon");
const soundText = document.getElementById("soundText");

// Suggestion form elements
const suggestionForm = document.getElementById("suggestionForm");
const suggestionName = document.getElementById("suggestionName");
const suggestionType = document.getElementById("suggestionType");
const suggestionMessage = document.getElementById("suggestionMessage");
const suggestionStatus = document.getElementById("suggestionStatus");
const submitSuggestionBtn = document.getElementById("submitSuggestionBtn");

let soundEnabled = false;
let audioContext = null;

let board = Array(9).fill("");
let gameActive = false;
let aiThinking = false;
let resultSaved = false;
let gameMode = "ai";
let currentPlayer = "X";
let aiTimer = null;

const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// ----------------------------------
// SOUND EFFECTS
// ----------------------------------

function playTone(
    frequency,
    duration = 0.12,
    type = "sine",
    volume = 0.06
) {
    if (!soundEnabled) return;

    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => {});
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(
            volume,
            now + 0.015
        );
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    } catch (error) {
        console.warn("Sound effect unavailable:", error);
    }
}

function playMoveSound(mark) {
    playTone(mark === "X" ? 420 : 560, 0.1, "sine", 0.055);
}

function playWinSound() {
    playTone(523, 0.13, "sine", 0.07);
    setTimeout(() => playTone(659, 0.13, "sine", 0.07), 140);
    setTimeout(() => playTone(784, 0.22, "sine", 0.07), 280);
}

function playDrawSound() {
    playTone(360, 0.16, "triangle", 0.05);
    setTimeout(() => playTone(290, 0.22, "triangle", 0.05), 170);
}

function updateSoundButton() {
    if (!soundToggle || !soundIcon || !soundText) return;

    soundIcon.textContent = soundEnabled ? "🔊" : "🔇";
    soundText.textContent = soundEnabled ? "ON" : "OFF";

    soundToggle.setAttribute(
        "aria-pressed",
        String(soundEnabled)
    );

    soundToggle.setAttribute(
        "aria-label",
        soundEnabled
            ? "Disable sound effects"
            : "Enable sound effects"
    );
}

if (soundToggle) {
    soundToggle.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        updateSoundButton();

        if (soundEnabled) {
            playTone(660, 0.08, "sine", 0.04);
        }
    });
}

updateSoundButton();

// ----------------------------------
// API HELPER
// ----------------------------------

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { error: text || "Unexpected server response." };
    }

    if (!response.ok) {
        throw new Error(
            data.error || `Request failed (${response.status}).`
        );
    }

    return data;
}

// ----------------------------------
// GAME LOGIC
// ----------------------------------

function getWinningCombo(position) {
    for (const combo of wins) {
        const [a, b, c] = combo;

        if (
            position[a] &&
            position[a] === position[b] &&
            position[b] === position[c]
        ) {
            return combo;
        }
    }

    return null;
}

function getWinner(position) {
    const combo = getWinningCombo(position);
    return combo ? position[combo[0]] : null;
}

// Save completed game to Supabase via Render
async function saveGameResult(result) {
    if (resultSaved) return;

    resultSaved = true;

    try {
        const data = await apiRequest("/api/save-game", {
            method: "POST",
            body: JSON.stringify({ result })
        });

        console.log("Game saved:", data);
        await loadGameHistory();
    } catch (error) {
        // Do not silently hide save errors.
        // Allow a future retry if the request failed.
        resultSaved = false;

        console.error("Could not save game:", error.message);
    }
}

function renderBoard() {
    cells.forEach((cell, index) => {
        const mark = board[index];
        const previousMark = cell.dataset.renderedMark || "";

        cell.textContent = mark;
        cell.disabled =
            !gameActive || aiThinking || mark !== "";

        cell.setAttribute(
            "aria-label",
            `Cell ${index + 1}${mark ? `, ${mark}` : ""}`
        );

        cell.classList.toggle("cell-x", mark === "X");
        cell.classList.toggle("cell-o", mark === "O");

        if (mark && mark !== previousMark) {
            cell.classList.remove("mark-pop");
            void cell.offsetWidth;
            cell.classList.add("mark-pop");
        }

        if (!mark) {
            cell.classList.remove(
                "mark-pop",
                "winning-cell",
                "draw-cell"
            );
        }

        cell.dataset.renderedMark = mark;
    });
}

function clearGameEffects() {
    if (boardElement) {
        boardElement.classList.remove("board-win", "draw-board");
    }

    if (gameContainer) {
        gameContainer.classList.remove("game-celebration");
    }

    cells.forEach(cell => {
        cell.classList.remove(
            "winning-cell",
            "draw-cell",
            "mark-pop"
        );
    });
}

function updateModeButtons() {
    if (aiModeBtn) {
        aiModeBtn.classList.toggle("active", gameMode === "ai");
        aiModeBtn.setAttribute(
            "aria-pressed",
            String(gameMode === "ai")
        );
    }

    if (twoPlayerModeBtn) {
        twoPlayerModeBtn.classList.toggle(
            "active",
            gameMode === "two"
        );

        twoPlayerModeBtn.setAttribute(
            "aria-pressed",
            String(gameMode === "two")
        );
    }

    if (opponentLabel) {
        opponentLabel.innerHTML = gameMode === "ai"
            ? 'AI <strong>O</strong>'
            : 'OPPONENT <strong>O</strong>';
    }
}

function selectMode(mode) {
    gameMode = mode;

    clearTimeout(aiTimer);
    aiThinking = false;

    updateModeButtons();
    startGame();
}

function startGame() {
    clearTimeout(aiTimer);
    clearGameEffects();

    board = Array(9).fill("");
    gameActive = true;
    aiThinking = false;
    resultSaved = false;
    currentPlayer = "X";

    renderBoard();

    if (statusText) {
        statusText.textContent = gameMode === "ai"
            ? "Your turn! Play as X."
            : "Player X's turn.";
    }
}

function endGame() {
    const winner = getWinner(board);

    if (winner) {
        gameActive = false;

        let result;
        let message;

        if (gameMode === "ai") {
            result = winner === "X" ? "Player Wins" : "AI Wins";
            message = winner === "X" ? "You win!" : "AI wins!";
        } else {
            result = winner === "X"
                ? "Player X Wins"
                : "Player O Wins";

            message = winner === "X"
                ? "Player X wins!"
                : "Player O wins!";
        }

        if (statusText) statusText.textContent = message;

        playWinSound();
        renderBoard();

        const winningCombo = getWinningCombo(board);

        if (boardElement) {
            boardElement.classList.add("board-win");
        }

        if (gameContainer) {
            gameContainer.classList.add("game-celebration");
        }

        if (winningCombo) {
            winningCombo.forEach(index => {
                cells[index].classList.add("winning-cell");
            });
        }

        saveGameResult(result);
        return true;
    }

    if (board.every(cell => cell !== "")) {
        gameActive = false;

        if (statusText) {
            statusText.textContent = "It's a draw!";
        }

        playDrawSound();
        renderBoard();

        if (boardElement) {
            boardElement.classList.add("draw-board");
        }

        cells.forEach(cell => {
            cell.classList.add("draw-cell");
        });

        saveGameResult("Draw");
        return true;
    }

    return false;
}

// ----------------------------------
// AI: MINIMAX
// ----------------------------------

function minimax(position, isMaximizing, depth = 0) {
    const winner = getWinner(position);

    if (winner === "O") return 10 - depth;
    if (winner === "X") return depth - 10;

    if (position.every(cell => cell !== "")) return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;

        for (let i = 0; i < 9; i++) {
            if (position[i] === "") {
                position[i] = "O";

                const score = minimax(
                    position,
                    false,
                    depth + 1
                );

                position[i] = "";
                bestScore = Math.max(bestScore, score);
            }
        }

        return bestScore;
    }

    let bestScore = Infinity;

    for (let i = 0; i < 9; i++) {
        if (position[i] === "") {
            position[i] = "X";

            const score = minimax(
                position,
                true,
                depth + 1
            );

            position[i] = "";
            bestScore = Math.min(bestScore, score);
        }
    }

    return bestScore;
}

function getBestMove() {
    let bestScore = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < 9; i++) {
        if (board[i] === "") {
            board[i] = "O";

            const score = minimax(board, false);

            board[i] = "";

            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }

    return bestMove;
}

function aiMove() {
    if (!gameActive || gameMode !== "ai") return;

    aiThinking = true;
    renderBoard();

    if (statusText) {
        statusText.textContent = "AI is thinking...";
    }

    aiTimer = setTimeout(() => {
        if (!gameActive || gameMode !== "ai") {
            aiThinking = false;
            renderBoard();
            return;
        }

        const move = getBestMove();

        if (move !== -1) {
            board[move] = "O";
            playMoveSound("O");
        }

        aiThinking = false;

        if (!endGame()) {
            if (statusText) {
                statusText.textContent = "Your turn! Play as X.";
            }

            renderBoard();
        }
    }, 500);
}

function handleCellClick(event) {
    const index = Array.from(cells).indexOf(event.currentTarget);

    if (
        !gameActive ||
        aiThinking ||
        index < 0 ||
        board[index] !== ""
    ) {
        return;
    }

    board[index] = currentPlayer;
    playMoveSound(currentPlayer);

    if (endGame()) return;

    if (gameMode === "ai") {
        renderBoard();
        aiMove();
    } else {
        currentPlayer = currentPlayer === "X" ? "O" : "X";

        if (statusText) {
            statusText.textContent =
                `Player ${currentPlayer}'s turn.`;
        }

        renderBoard();
    }
}

cells.forEach(cell => {
    cell.addEventListener("click", handleCellClick);
});

if (startBtn) {
    startBtn.addEventListener("click", startGame);
}

if (restartBtn) {
    restartBtn.addEventListener("click", startGame);
}

if (aiModeBtn) {
    aiModeBtn.addEventListener("click", () => selectMode("ai"));
}

if (twoPlayerModeBtn) {
    twoPlayerModeBtn.addEventListener(
        "click",
        () => selectMode("two")
    );
}

// ----------------------------------
// GAME HISTORY
// ----------------------------------

async function loadGameHistory() {
    if (!historyList) return;

    historyList.innerHTML = "<p>Loading game history...</p>";

    try {
        const games = await apiRequest("/api/game-history");

        if (!Array.isArray(games) || games.length === 0) {
            historyList.innerHTML = "<p>No games played yet.</p>";
            return;
        }

        historyList.replaceChildren();

        games.forEach(game => {
            const item = document.createElement("div");
            item.className = "history-item";

            const result = document.createElement("strong");
            result.textContent = game.result || "Unknown result";

            const scores = document.createElement("span");
            scores.textContent =
                `Player: ${game.player_score} | Opponent: ${game.ai_score}`;

            const date = document.createElement("small");
            date.textContent = game.created_at
                ? new Date(game.created_at).toLocaleString()
                : "Date unavailable";

            item.append(result, scores, date);
            historyList.appendChild(item);
        });
    } catch (error) {
        console.error("Could not load game history:", error.message);
        historyList.innerHTML =
            "<p>Unable to load game history. Please try again.</p>";
    }
}

if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener("click", loadGameHistory);
}

function openHistory() {
    if (!historySidebar || !historyMenuBtn) return;

    historySidebar.classList.add("open");
    historyMenuBtn.setAttribute("aria-expanded", "true");
    historySidebar.setAttribute("aria-hidden", "false");

    loadGameHistory();
}

function closeHistory() {
    if (!historySidebar || !historyMenuBtn) return;

    historySidebar.classList.remove("open");
    historyMenuBtn.setAttribute("aria-expanded", "false");
    historySidebar.setAttribute("aria-hidden", "true");

    historyMenuBtn.focus();
}

if (historyMenuBtn) {
    historyMenuBtn.addEventListener("click", openHistory);
}

if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener("click", closeHistory);
}

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        historySidebar &&
        historySidebar.classList.contains("open")
    ) {
        closeHistory();
    }
});

// ----------------------------------
// SUGGESTIONS AND COMMENTS
// ----------------------------------

if (suggestionForm) {
    suggestionForm.addEventListener("submit", async event => {
        event.preventDefault();

        const name = suggestionName
            ? suggestionName.value.trim()
            : "";

        const type = suggestionType
            ? suggestionType.value
            : "Suggestion";

        const message = suggestionMessage
            ? suggestionMessage.value.trim()
            : "";

        if (message.length < 5 || message.length > 500) {
            if (suggestionStatus) {
                suggestionStatus.textContent =
                    "Your message must be between 5 and 500 characters.";
            }
            return;
        }

        if (submitSuggestionBtn) {
            submitSuggestionBtn.disabled = true;
            submitSuggestionBtn.textContent = "Sending...";
        }

        if (suggestionStatus) {
            suggestionStatus.textContent = "Submitting your feedback...";
        }

        try {
            const data = await apiRequest("/api/suggestions", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    type,
                    message
                })
            });

            if (suggestionStatus) {
                suggestionStatus.textContent =
                    data.message || "Thank you! Your feedback was submitted.";
            }

            suggestionForm.reset();
        } catch (error) {
            console.error("Could not submit feedback:", error.message);

            if (suggestionStatus) {
                suggestionStatus.textContent =
                    `Unable to send feedback: ${error.message}`;
            }
        } finally {
            if (submitSuggestionBtn) {
                submitSuggestionBtn.disabled = false;
                submitSuggestionBtn.textContent = "Send Feedback";
            }
        }
    });
}

// ----------------------------------
// INITIALIZE GAME
// ----------------------------------

updateModeButtons();
renderBoard();

if (statusText) {
    statusText.textContent =
        "Choose a mode, then press Start Game.";
}

loadGameHistory();
