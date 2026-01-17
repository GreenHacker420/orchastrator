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

    let systemInstruction = `You are the Omni-Retail Super Agent. 
              You orchestrate 4 sub-agents: ShopCore, ShipStream, PayGuard, and CareDesk.
              
              Your goal is to answer complex user queries by delegating to these agents.
              
              CRITICAL RULES:
              1. **Ask for Clarification**: If the user's request is vague (e.g., "Find my order"), DO NOT guess. Ask for their Name, Order ID, or what product they ordered.
              2. **Step-by-Step**: Gather necessary IDs (UserID, OrderID) from ShopCore before querying tracking (ShipStream) or refunds (PayGuard).
              3. **Natural Integration**: When you get a tool result, explain it naturally to the user.
              
              Start by briefly welcoming the user and asking how you can help, or if they have a specific order in mind.`;

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
