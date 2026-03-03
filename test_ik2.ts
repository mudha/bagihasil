import ImageKit from 'imagekit';
import fs from 'fs';
require('dotenv').config();

const imagekit = new ImageKit({
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || '',
});

async function main() {
    try {
        const fileBuffer = fs.readFileSync('test.txt');
        const uploadResult = await new Promise((resolve, reject) => {
            imagekit.upload({ file: fileBuffer, fileName: 'test.txt', folder: '/profit-sharing-app/payment-proofs' }, (err, res) => {
                if (err) reject(err); else resolve(res);
            });
        });
        console.log('Success:', uploadResult);
    } catch (e) {
        console.error('Failed:', e);
    }
}
main();
