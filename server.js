const WebSocket = require('ws');
const { GoogleGenAI } = require("@google/genai"); 
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// FIX: In the 2026 SDK, we initialize the client first
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const port = process.env.PORT || 10000; 
const wss = new WebSocket.Server({ port: port, host: '0.0.0.0' });

const SYSTEM_PROMPT = `You are a Minecraft AI. Respond ONLY with slash commands. Use relative coordinates (~ ~ ~).`;

wss.on('connection', (ws) => {
    console.log("🚀 Minecraft Connected!");

    // Handshake
    ws.send(JSON.stringify({
        header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "subscribe" },
        body: { eventName: "PlayerMessage" }
    }));

    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.body.eventName === "PlayerMessage" && msg.body.properties.Sender !== "External") {
            const prompt = msg.body.properties.Message;

            try {
                // FIX: Use the client.models.generateContent method directly 
                // Using gemini-2.5-flash (the 2026 workhorse model)
                const result = await client.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\nRequest: " + prompt }] }]
                });

                const responseText = result.response.text();
                const commands = responseText.split('\n').filter(c => c.trim().startsWith('/'));

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
});

console.log(`✅ Server active on port ${port}`);
