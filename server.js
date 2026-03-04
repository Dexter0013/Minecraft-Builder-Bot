const WebSocket = require('ws');
const http = require('http'); // Added HTTP module
const { GoogleGenAI } = require("@google/genai"); 
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const port = process.env.PORT || 10000;

// 1. Create a standard HTTP server for Railway to "talk" to
const server = http.createServer((req, res) => {
    // This is the Health Check - it stops the 502 error
    res.writeHead(200);
    res.end("✅ Bot is Awake and Listening");
});

// 2. Attach WebSocket to that HTTP server
const wss = new WebSocket.Server({ server }); 

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SYSTEM_PROMPT = `You are a Minecraft AI. Respond ONLY with slash commands. Use relative coordinates (~ ~ ~).`;

wss.on('connection', (ws) => {
    console.log("🚀 Minecraft Connected!");

    ws.send(JSON.stringify({
        header: { version: 1, requestId: uuidv4(), messageType: "commandRequest", messagePurpose: "subscribe" },
        body: { eventName: "PlayerMessage" }
    }));

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.body && msg.body.eventName === "PlayerMessage" && msg.body.properties.Sender !== "External") {
                const prompt = msg.body.properties.Message;
                console.log(`💬 User said: ${prompt}`);

                const result = await client.models.generateContent({
                    model: "gemini-2.0-flash", // Adjusted to verified 2026 model string
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
                    }, index * 200); // Slightly slower for better command execution
                });
            }
        } catch (err) {
            console.error("❌ Error:", err.message);
        }
    });
});

// 3. Bind to 0.0.0.0 so Railway can route traffic from India
server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server active on port ${port}`);
});
