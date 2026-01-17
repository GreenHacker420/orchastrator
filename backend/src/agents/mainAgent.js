import { GeminiService, genAI } from "../lib/gemini.js"; // Adjusted path
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from "@google/genai";
import { askShopCore, askShipStream, askPayGuard, askCareDesk } from "./subAgents.js";

const toolsMap = {
    askShopCore,
    askShipStream,
    askPayGuard,
    askCareDesk
};

const toolDefinitions = [
    {
        functionDeclarations: [
            {
                name: "askShopCore",
                description: "Query the ShopCore database (User accounts, Products, Orders). Use this to find UserIDs, OrderIDs, or product details.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Natural language query for the ShopCore agent" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "askShipStream",
                description: "Query the ShipStream database (Shipments, Warehouses, Tracking). Use this to track physical status of orders via OrderID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Natural language query for the ShipStream agent" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "askPayGuard",
                description: "Query the PayGuard database (Wallets, Transactions, Refunds). Use this to check payment status or refunds via UserID or OrderID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Natural language query for the PayGuard agent" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "askCareDesk",
                description: "Query the CareDesk database (Tickets, Messages, Surveys). Use this to check for existing support tickets via UserID or ReferenceID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Natural language query for the CareDesk agent" }
                    },
                    required: ["query"]
                }
            }
        ]
    }
];

const MODEL_NAME = "gemini-2.5-flash-native-audio-preview-12-2025";

export const setupMainAgent = (socket) => {
    let session = null;

    let systemInstruction = `
    # CONTEXT (CO-STAR)
    You are the "Omni-Retail Super Agent", the advanced AI orchestrator for OmniLife, a massive e-commerce conglomerate. 
    You manage four specialized sub-agents, each guarding a specific database:
    1. **ShopCore**: User accounts, products, and new orders ("I want to buy...", "My account ID...").
    2. **ShipStream**: Logistics, tracking numbers, and warehouse status ("Where is my package?").
    3. **PayGuard**: Payments, wallets, and refunds ("I need a refund", "Payment failed").
    4. **CareDesk**: Customer support tickets and surveys ("I have a complaint", "Ticket status").

    # OBJECTIVE
    Your goal is to answer complex, multi-domain customer queries by INTELLIGENTLY ORCHESTRATING these sub-agents. 
    You must NOT guess data. You must retrieve it from the correct sub-agent.

    # STYLE & TONE
    - **Professional, yet warm and helpful.**
    - **Concise but thorough.**
    - **Systematic and logic-driven.**

    # AUDIENCE
    You are speaking to end-users (customers) who may be frustrated or confused. Be reassuring.

    # CHAIN OF THOUGHT (CRITICAL)
    Before calling ANY tool, you must silently "Plan" your actions.
    
    ## Pivot Strategy (One ID is enough):
    - You only need ONE valid ID (UserID, OrderID, or TrackingNumber) to start the chain.
    - **From UserID** -> Find Orders (ShopCore) -> Find Tracking (ShipStream).
    - **From OrderID** -> Find Tracking (ShipStream) OR Find User (ShopCore).
    - **From TrackingNumber** -> Find Shipment (ShipStream) -> Find Order (ShopCore).
    
    ## Execution Loop:
    1. **Identify Anchor**: What ID do I have? (Name? OrderID? Tracking?).
    2. **Pivot**: Call the agent relevant to that ID.
    3. **Expand**: Use the result to get new IDs for other agents.
    4. **Synthesize**: Combine all findings into a helpful answer.

    # RESPONSE FORMAT
    - When you answer, speak naturally.
    - Do not read out raw JSON keys like "shipping_status" or "user_id". Say "Your shipment is currently..."
    `;

    let config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: toolDefinitions,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        realtimeInputConfig: {
            automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 20,
                silenceDurationMs: 500,
            }
        }
    };

    const connectToGemini = async () => {
        try {
            console.log("Connecting to Gemini Live API...");
            session = await genAI.live.connect({
                model: MODEL_NAME,
                config: config,
                callbacks: {
                    onopen: () => {
                        console.log("Gemini Live Session Opened");
                        socket.emit("status", { message: "Connected to Gemini" });
                    },
                    onclose: (event) => {
                        console.log("Gemini Live Session Closed", event);
                        socket.emit("status", { message: "Gemini Disconnected" });
                    },
                    onerror: (error) => {
                        console.log("Gemini Error:", error);
                        console.dir(error, { depth: null });
                        socket.emit("error", { message: "Gemini Validation Error: " + error.message });
                    },
                    onmessage: async (msg) => {
                        // Handle Function Calls (Reference Style)
                        if (msg.toolCall) {
                            console.log("Function call requested:", msg.toolCall.functionCalls);
                            const functionResponses = [];

                            for (const call of msg.toolCall.functionCalls) {
                                console.log(`Executing ${call.name}...`, call.args);
                                const fn = toolsMap[call.name];
                                if (fn) {
                                    try {
                                        const result = await fn(call.args.query);
                                        console.log(`Tool Result:`, result);
                                        functionResponses.push({
                                            name: call.name,
                                            id: call.id,
                                            response: { result: result }
                                        });
                                    } catch (err) {
                                        console.error(`Tool Execution Error (${call.name}):`, err);
                                        // Still send a response so Gemini knows it failed
                                        functionResponses.push({
                                            name: call.name,
                                            id: call.id,
                                            response: { error: "Tool execution failed" } // Simplified error for agent
                                        });
                                    }
                                } else {
                                    console.warn(`Tool ${call.name} not found.`);
                                }
                            }

                            if (functionResponses.length > 0) {
                                session.sendToolResponse({ functionResponses });
                                console.log("Sent Tool Responses");
                            }
                        }

                        // Handle serverContent
                        if (msg.serverContent) {
                            if (msg.serverContent.modelTurn?.parts) {
                                msg.serverContent.modelTurn.parts.forEach(p => {
                                    if (p.inlineData && p.inlineData.data) {
                                        socket.emit("audio", { data: p.inlineData.data });
                                    }
                                });
                            }

                            if (msg.serverContent.modelTurn?.parts) {
                                for (const part of msg.serverContent.modelTurn.parts) {
                                    if (part.functionCall) {
                                        // Fallback for standard style if toolCall isn't used
                                        console.log("Function call (Fallback):", part.functionCall);
                                        const call = part.functionCall;
                                        const fn = toolsMap[call.name];
                                        if (fn) {
                                            const result = await fn(call.args.query);
                                            session.sendToolResponse({
                                                functionResponses: [{
                                                    name: call.name,
                                                    id: call.id,
                                                    response: { result: result }
                                                }]
                                            });
                                        }
                                    }
                                }
                            }

                            if (msg.serverContent.outputTranscription?.text) {
                                socket.emit("transcript", { source: "Model", text: msg.serverContent.outputTranscription.text });
                            }
                            if (msg.serverContent.inputTranscription?.text) {
                                socket.emit("transcript", { source: "User (Voice)", text: msg.serverContent.inputTranscription.text });
                            }

                            if (msg.serverContent.interrupted) {
                                console.log("-> Session Interrupted");
                                socket.emit("interrupted");
                            }

                            if (msg.serverContent.turnComplete) {
                                console.log("-> Turn Complete");
                                socket.emit("turnComplete");
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.error("Connection failed:", err);
            socket.disconnect();
        }
    };

    connectToGemini();

    socket.on("audio", (data) => {
        if (!session) {
            console.log("Ignored audio (No Session)");
            return;
        }
        const audioData = typeof data === 'string' ? data : data.data;
        if (audioData) {
            // console.log("<- Client sent audio chunk");
            session.sendRealtimeInput({
                audio: {
                    mimeType: "audio/pcm;rate=16000",
                    data: audioData
                }
            });
        }
    });

    socket.on("text", (data) => {
        console.log("Received text input:", data);
        if (!session) return;
        const text = typeof data === 'string' ? data : data.text;
        if (text) {
            session.sendClientContent({
                turns: [{ role: "user", parts: [{ text: text }] }],
                turnComplete: true
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        // Clean up session if needed
    });
};
