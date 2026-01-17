import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables");
}

export const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export const GeminiService = {
    // Placeholder for future service methods if needed
};
