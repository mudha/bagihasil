
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs');

async function testOCR() {
    console.log("Starting Tesseract test...");
    console.log("This might take a while if downloading language data for the first time...");

    try {
        const worker = await createWorker('ind');
        console.log("✓ Worker created and language data loaded.");

        // Create a simple text image or testing buffer is hard without an image file. 
        // We will just verify initialization for now.

        await worker.terminate();
        console.log("✓ Test completed successfully.");
    } catch (error) {
        console.error("❌ Tesseract Error:", error);
    }
}

testOCR();
