
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

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json({ limit: "10kb" }));

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
    res.json({
        message: "Tic-Tac-Toe API is running!"
    });
});

// Test Supabase connection
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
            error: "Database connection failed."
        });
    }
});

// Save a completed game
app.post("/api/save-game", async (req, res) => {
    try {
        const result = typeof req.body?.result === "string"
            ? req.body.result.trim()
            : "";

        const scores = {
            "Player Wins": [1, 0],
            "AI Wins": [0, 1],
            "Player X Wins": [1, 0],
            "Player O Wins": [0, 1],
            "Player": [1, 0],
            "AI": [0, 1],
            "Draw": [0, 0]
        };

        if (!Object.prototype.hasOwnProperty.call(scores, result)) {
            return res.status(400).json({
                error: "Invalid game result."
            });
        }

        const [playerScore, aiScore] = scores[result];

        const { data, error } = await supabase
            .from("game_history")
            .insert([{
                result: result,
                player_score: playerScore,
                ai_score: aiScore
            }])
            .select("id, result, player_score, ai_score, created_at")
            .single();

        if (error) throw error;

        res.status(201).json({
            message: "Game saved successfully!",
            game: data
        });
    } catch (error) {
        console.error("Could not save game:", error.message);

        res.status(500).json({
            error: "Could not save game."
        });
    }
});

// Load the latest 20 games
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
            error: "Failed to load game history."
        });
    }
});

// Save a suggestion or comment
app.post("/api/suggestions", async (req, res) => {
    try {
        const message = typeof req.body?.message === "string"
            ? req.body.message.trim()
            : "";

        const name = typeof req.body?.name === "string"
            ? req.body.name.trim().slice(0, 80)
            : "";

        const type = typeof req.body?.type === "string"
            ? req.body.type.trim().slice(0, 40)
            : "";

        if (message.length < 5 || message.length > 500) {
            return res.status(400).json({
                error: "Message must contain 5 to 500 characters."
            });
        }

        const suggestion = { message };

        if (name) suggestion.name = name;
        if (type) suggestion.type = type;

        const { data, error } = await supabase
            .from("suggestions")
            .insert([suggestion])
            .select("id, created_at, type, message, name")
            .single();

        if (error) throw error;

        res.status(201).json({
            message: "Suggestion submitted successfully!",
            suggestion: data
        });
    } catch (error) {
        console.error("Could not save suggestion:", error.message);

        res.status(500).json({
            error: "Could not submit suggestion."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
