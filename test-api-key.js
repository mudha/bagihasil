const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

// Load env
dotenv.config();

async function testGeminiKey() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ No GEMINI_API_KEY found in .env");
        return;
    }

    console.log("Testing API Key:", apiKey.slice(0, 15) + "...");
    console.log("Full key length:", apiKey.length);

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Test dengan model 2.0 flash (current)
        console.log("\n--- Testing gemini-2.0-flash ---");
        const model20 = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result20 = await model20.generateContent("Say 'OK'");
        const response20 = await result20.response;
        console.log("✅ Gemini 2.0 Flash: WORKING");
        console.log("Response:", response20.text());
    } catch (error) {
        console.log("❌ Gemini 2.0 Flash: FAILED");
        console.log("Error:", error.message);
        if (error.status === 429) {
            console.log("⚠️  QUOTA EXCEEDED for gemini-2.0-flash");
        }
    }

    try {
        // Test dengan model 1.5 flash (alternative with higher quota)
        console.log("\n--- Testing gemini-1.5-flash ---");
        const model15 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result15 = await model15.generateContent("Say 'OK'");
        const response15 = await result15.response;
        console.log("✅ Gemini 1.5 Flash: WORKING");
        console.log("Response:", response15.text());
    } catch (error) {
        console.log("❌ Gemini 1.5 Flash: FAILED");
        console.log("Error:", error.message);
        if (error.status === 429) {
            console.log("⚠️  QUOTA EXCEEDED for gemini-1.5-flash");
        }
    }
}

testGeminiKey();
