const dotenv = require("dotenv");
dotenv.config();

async function listAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ No API key");
        return;
    }

    console.log("Fetching models list from Google API...\n");

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            console.error(`❌ API returned: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response:", text.slice(0, 200));
            return;
        }

        const data = await response.json();

        if (!data.models || data.models.length === 0) {
            console.log("⚠️  No models found. API key might be restricted.");
            return;
        }

        console.log("✅ Available models:\n");
        data.models
            .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
            .forEach(model => {
                console.log(`📌 ${model.name}`);
                console.log(`   Display: ${model.displayName}`);
                console.log(`   Methods: ${model.supportedGenerationMethods.join(', ')}`);
                console.log('');
            });

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

listAvailableModels();
