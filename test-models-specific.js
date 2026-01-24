
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModel(modelName) {
    const apiKey = "AIzaSyDDPL0x2ZcMk17ApPt_tHwFQjX8Qbq4U0Q";
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log(`Testing model: ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Test connection");
        console.log(`✅ Success with ${modelName}`);
        return true;
    } catch (error) {
        console.log(`❌ Failed with ${modelName}: ${error.message}`);
        return false;
    }
}

async function run() {
    await testModel("gemini-1.5-flash");
    await testModel("gemini-1.5-flash-latest");
    await testModel("gemini-1.5-flash-001");
    // fallback
    await testModel("gemini-pro");
}

run();
