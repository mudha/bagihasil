
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API key found");
    process.exit(1);
}

async function listModels() {
    try {
        // For listing models, we don't need a specific model instance, 
        // but the SDK structure usually assumes we know what we want. 
        // Actually, checking the docs, SDK might not have a direct listModels helper 
        // exposed easily on the main class in all versions, but let's try to just 
        // use a basic fetch if the SDK doesn't help, or assume looking for specific known ones.

        // Changing strategy: The SDK doesn't make listing models super obvious 
        // without using the model manager which might differ by version.
        // Let's try to hit the REST API directly for listing to be sure.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name} (${m.displayName})`);
                }
            });
        } else {
            console.log("No models found or error:", data);
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
