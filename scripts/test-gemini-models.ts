
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        // There isn't a direct listModels method on the client instance in some versions,
        // but let's try the ModelManager if available or just try to instantiate a few common ones.
        // Actually, newer SDKs might expose it via a different manager or not at all for client-side.
        // Let's try to just run a simple generateContent on a few candidate models and see which one works.

        const candidates = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-latest",
            "gemini-pro",
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest",
            "gemini-1.0-pro"
        ];

        console.log("Testing models...");

        for (const modelName of candidates) {
            process.stdout.write(`Testing ${modelName}... `);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                await result.response;
                console.log(`SUCCESS!`);
            } catch (error: any) {
                console.log(`FAILED: ${error.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error("Error listed models:", error);
    }
}

listModels();
