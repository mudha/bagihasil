import fs from 'fs';
import path from 'path';

async function testUpload() {
    const filePath = path.join(process.cwd(), 'package.json'); // Any file just to see if it hits size limit or type limit properly
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', blob, 'package.json');

    const uploadRes = await fetch('http://localhost:3000/api/upload/payment-proof', {
        method: 'POST',
        body: formData
    });

    console.log('Status:', uploadRes.status);
    console.log('Result:', await uploadRes.text());
}

testUpload().catch(console.error);
