const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

async function findWorkingModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ No API key found");
        return;
    }

    console.log("Testing API Key:", apiKey.slice(0, 12) + "...\n");

    const genAI = new GoogleGenerativeAI(apiKey);

    // List of models to test
    const modelsToTest = [
        "gemini-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
        "models/gemini-1.5-flash",
        "models/gemini-pro"
    ];

    console.log("🔍 Testing models...\n");

    for (const modelName of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            const response = await result.response;
            console.log(`✅ ${modelName} - WORKING!`);
            console.log(`   Response: ${response.text().slice(0, 20)}...\n`);
        } catch (error) {
            console.log(`❌ ${modelName} - ${error.message.slice(0, 60)}...`);
        }
    }
}

findWorkingModel();
