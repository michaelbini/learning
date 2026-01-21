/**
 * Upload vocabulary to Firebase using REST API
 * Run with: node admin/upload-to-firebase.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FIREBASE_URL = 'trip-9506c-default-rtdb.firebaseio.com';

function postToFirebase(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: FIREBASE_URL,
            path: `/${path}.json`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function uploadEnglish() {
    console.log('📤 Uploading English vocabulary...');
    const filePath = path.join(__dirname, '../english/vocabulary.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const words = data.vocabulary || [];

    let count = 0;
    for (const word of words) {
        await postToFirebase('vocabulary/english', word);
        count++;
        if (count % 20 === 0) console.log(`   Uploaded ${count}/${words.length}...`);
    }
    console.log(`✅ English complete: ${count} words\n`);
    return count;
}

async function uploadHebrew() {
    console.log('📤 Uploading Hebrew vocabulary...');
    const filePath = path.join(__dirname, '../hebrew/vocabulary.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const pairs = data.wordPairs || [];

    let count = 0;
    for (const pair of pairs) {
        await postToFirebase('vocabulary/hebrew', pair);
        count++;
        if (count % 100 === 0) console.log(`   Uploaded ${count}/${pairs.length}...`);
    }
    console.log(`✅ Hebrew complete: ${count} pairs\n`);
    return count;
}

async function main() {
    console.log('🚀 Firebase Vocabulary Upload\n');
    console.log('================================\n');

    try {
        const englishCount = await uploadEnglish();
        const hebrewCount = await uploadHebrew();

        console.log('================================');
        console.log('🎉 Upload complete!');
        console.log(`   English: ${englishCount} words`);
        console.log(`   Hebrew: ${hebrewCount} pairs`);
        console.log('================================');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
