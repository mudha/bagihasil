
const dotenv = require("dotenv");

// Load env vars
dotenv.config();

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ No GEMINI_API_KEY found in .env");
        return;
    }

    console.log(`Using API Key: ${apiKey.slice(0, 5)}...`);
    console.log("\n--- Fetching Models via REST API ---");

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            console.error(`REST API Failed: ${response.status} ${response.statusText}`);
            console.error(await response.text());
        } else {
            const data = await response.json();
            console.log("Available Models:");
            if (data.models) {
                data.models.forEach(m => {
                    console.log(`- ${m.name}`);
                    // console.log(`  Methods: ${m.supportedGenerationMethods.join(", ")}`);
                });
            } else {
                console.log("No models found in response");
            }
        }
    } catch (e) {
        console.error("Global error:", e);
    }
}

run();
