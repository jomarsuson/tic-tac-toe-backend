
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    "https://jomarsuson.github.io",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
    res.json({
        message: "Tic-Tac-Toe API is running!"
    });
});

app.get("/api/db-test", async (req, res) => {
    try {
        const { error } = await supabase
            .from("game_history")
            .select("id")
            .limit(1);

        if (error) throw error;

        res.json({
            message: "Supabase connected successfully!",
            connected: true
        });
    } catch (error) {
        console.error("Database test failed:", error.message);

        res.status(500).json({
            connected: false,
            error: error.message
        });
    }
});

app.post("/api/save-game", async (req, res) => {
    try {
        const { result } = req.body;

        const scores = {
            "Player": [1, 0],
            "AI": [0, 1],
            "Player X": [1, 0],
            "Player O": [0, 1],
            "Draw": [0, 0]
        };

        if (!Object.prototype.hasOwnProperty.call(scores, result)) {
            return res.status(400).json({
                error: "Invalid game result"
            });
        }

        const [playerScore, aiScore] = scores[result];

        const { data, error } = await supabase
            .from("game_history")
            .insert([{
                result,
                player_score: playerScore,
                ai_score: aiScore
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({
            message: "Game saved successfully!",
            game: data
        });
    } catch (error) {
        console.error("Could not save game:", error.message);

        res.status(500).json({
            error: error.message
        });
    }
});

app.get("/api/game-history", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("game_history")
            .select("id, result, player_score, ai_score, created_at")
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error("Could not load game history:", error.message);

        res.status(500).json({
            error: "Failed to load game history"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
