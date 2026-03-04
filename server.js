const WebSocket = require('ws');
const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

const SYSTEM_PROMPT = `You are a Minecraft Mobile Builder. 
- Use ONLY Bedrock slash commands. 
- All coordinates must be relative (~ ~ ~).
- Avoid 'tnt', 'lava', and 'bedrock'.
- Keep builds compact for mobile performance.`;

wss.on('connection', (ws) => {
    console.log("Mobile Player Connected!");

    // Initial Handshake for Bedrock
    ws.send(JSON.stringify({
        header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "subscribe" },
        body: { eventName: "PlayerMessage" }
    }));

    ws.on('message', async (data) => {
        const msg = JSON.parse(data);
        if (msg.body.eventName === "PlayerMessage" && msg.body.properties.Sender !== "External") {
            const prompt = msg.body.properties.Message;

            try {
                // Request building logic from Gemini 2.5 Flash
                const result = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\nRequest: " + prompt }] }]
                });

                const commands = result.response.text().split('\n').filter(c => c.trim().startsWith('/'));

                // Execute commands with a slight delay to prevent mobile crashing
                for (let i = 0; i < commands.length; i++) {
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "commandRequest" },
                            body: { commandLine: commands[i].trim(), version: 1 }
                        }));
                    }, i * 150); // 150ms gap between blocks
                }
            } catch (err) {
                console.error("Mobile AI Error:", err);
            }
        }
    });
});

console.log(`Mobile-ready server listening on ${port}`);
