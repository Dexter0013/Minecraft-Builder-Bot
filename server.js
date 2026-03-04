const WebSocket = require('ws');
const { GoogleGenAI } = require("@google/genai"); // 2026 Standard SDK
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize Gemini 2.5 (The stable 2026 low-latency model)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = ai.models.get("gemini-2.5-flash");

// RENDER FIX: Must use process.env.PORT and host '0.0.0.0'
const port = process.env.PORT || 10000; 
const wss = new WebSocket.Server({ port: port, host: '0.0.0.0' });

const SYSTEM_PROMPT = `You are a Minecraft AI. 
- Output ONLY slash commands. 
- Use relative coordinates (~ ~ ~). 
- Avoid TNT/Griefing. 
- Keep builds optimized for mobile performance.`;

wss.on('connection', (ws) => {
    console.log("🚀 Minecraft Mobile Connected!");

    // Send a welcome message to the game chat
    ws.send(JSON.stringify({
        header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "commandRequest" },
        body: { commandLine: "say §bAI Builder Online. §7Type your request in chat!", version: 1 }
    }));

    // Subscribe to chat events
    ws.send(JSON.stringify({
        header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "subscribe" },
        body: { eventName: "PlayerMessage" }
    }));

    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        
        // Listen for player messages (and ignore messages from the bot itself)
        if (msg.body.eventName === "PlayerMessage" && msg.body.properties.Sender !== "External") {
            const userPrompt = msg.body.properties.Message;
            console.log(`Player requested: ${userPrompt}`);

            try {
                const result = await model.generateContent(SYSTEM_PROMPT + "\nRequest: " + userPrompt);
                const commands = result.response.text().split('\n').filter(c => c.trim().startsWith('/'));

                // Stream commands with 150ms delay to prevent mobile lag/crashes
                commands.forEach((cmd, index) => {
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "commandRequest" },
                            body: { commandLine: cmd.trim(), version: 1 }
                        }));
                    }, index * 150);
                });
            } catch (err) {
                console.error("AI Error:", err.message);
            }
        }
    });

    ws.on('close', () => console.log("❌ Minecraft Disconnected."));
});

console.log(`✅ Server is listening on internal port ${port}`);
