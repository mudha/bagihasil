import ImageKit from 'imagekit';
import fs from 'fs';
import path from 'path';

// dotenv is needed to read .env
require('dotenv').config();

const imagekit = new ImageKit({
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
});

async function main() {
    try {
        console.log("Keys:", {
            pub: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
            priv: process.env.IMAGEKIT_PRIVATE_KEY?.substring(0, 10) + '...',
            url: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
        });

        const fileBuffer = fs.readFileSync('public/favicon.ico');

        const uploadResult = await new Promise((resolve, reject) => {
            imagekit.upload({
                file: fileBuffer,
                fileName: 'test-icon.ico',
                folder: '/profit-sharing-app/payment-proofs',
            }, (error, result) => {
                if (error) reject(error)
                else resolve(result)
            })
        });

        console.log("Success:", uploadResult);
    } catch (e) {
        console.error("Failed:", e);
    }
}

main();
