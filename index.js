const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Required for Option 4
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '00000000');
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://your-website.com';
const BACKEND_URL = process.env.RAILWAY_URL || 'https://your-app.up.railway.app';

console.log("🤖 Bot starting...");

// Create bot
const bot = new TelegramBot(TOKEN, { 
    polling: true
});

// Middleware
app.use(cors());
app.use(express.json());

// --- MODIFIED /START COMMAND (WITH 5 PFP OPTIONS) ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const username = msg.from.username || '';

    console.log(`🚀 /start from ${firstName} (ID: ${userId})`);

    // 1. Send the Mini App Menu First (Standard Welcome)
    const webAppUrl = `${WEBSITE_URL}/index.php?user_id=${userId}`;
    const keyboard = {
        inline_keyboard: [[
            { text: "📱 Open Mini App", web_app: { url: webAppUrl } }
        ]]
    };

    await bot.sendMessage(chatId, `👋 *Welcome ${firstName}!*\nTesting 5 PFP methods below...`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });

    // 2. Execute 5 PFP Options
    try {
        const userProfile = await bot.getUserProfilePhotos(userId);

        if (userProfile.total_count === 0) {
            return bot.sendMessage(chatId, "❌ **Error:** You have no profile photos.");
        }

        // Prepare Data
        const currentPhotoSet = userProfile.photos[0];
        const fileIdHighQuality = currentPhotoSet[currentPhotoSet.length - 1].file_id;
        const fileIdLowQuality = currentPhotoSet[0].file_id;

        // --- OPTION 1: Standard High-Res (file_id) ---
        try {
            await bot.sendPhoto(chatId, fileIdHighQuality, {
                caption: "1️⃣ **High-Res** (Standard file_id)"
            });
        } catch (err) {
            await bot.sendMessage(chatId, `⚠️ **Option 1 Failed:** ${err.message}`);
        }

        // --- OPTION 2: Low-Res Thumbnail (file_id) ---
        try {
            await bot.sendPhoto(chatId, fileIdLowQuality, {
                caption: "2️⃣ **Low-Res** (Smallest size)"
            });
        } catch (err) {
            await bot.sendMessage(chatId, `⚠️ **Option 2 Failed:** ${err.message}`);
        }

        // --- OPTION 3: As Document (Uncompressed) ---
        try {
            await bot.sendDocument(chatId, fileIdHighQuality, {
                caption: "3️⃣ **As File** (Document format)"
            });
        } catch (err) {
            await bot.sendMessage(chatId, `⚠️ **Option 3 Failed:** ${err.message}`);
        }

        // --- OPTION 4: Buffer (Download & Re-upload) ---
        try {
            const fileLink = await bot.getFileLink(fileIdHighQuality);
            const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
            const fileBuffer = Buffer.from(response.data);

            await bot.sendPhoto(chatId, fileBuffer, {
                caption: "4️⃣ **Buffer** (Downloaded & Re-uploaded)"
            });
        } catch (err) {
            await bot.sendMessage(chatId, `⚠️ **Option 4 Failed:** ${err.message}`);
        }

        // --- OPTION 5: Historical PFP (Previous Photo) ---
        try {
            if (userProfile.total_count > 1) {
                const oldPhotoSet = userProfile.photos[1]; // Index 1 = 2nd newest
                const oldFileId = oldPhotoSet[oldPhotoSet.length - 1].file_id;

                await bot.sendPhoto(chatId, oldFileId, {
                    caption: "5️⃣ **Historical** (Your previous photo)"
                });
            } else {
                await bot.sendMessage(chatId, "ℹ️ **Option 5 Skipped:** No history found (only 1 photo).");
            }
        } catch (err) {
            await bot.sendMessage(chatId, `⚠️ **Option 5 Failed:** ${err.message}`);
        }

    } catch (error) {
        console.error("Critical PFP Error:", error);
        bot.sendMessage(chatId, "❌ Critical error fetching profile photos.");
    }
});

// --- EXISTING ENDPOINTS (KEPT FROM YOUR FILE) ---

// GET Profile Picture Endpoint
app.get('/get-user-photo', async (req, res) => {
    try {
        const userId = req.query.user_id || req.query.uid;
        if (!userId) return sendDefaultAvatar(res, 'U');
        
        const photos = await bot.getUserProfilePhotos(userId);
        if (photos.total_count > 0) {
            const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
            const file = await bot.getFile(fileId);
            return res.redirect(`https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`);
        }
        return sendDefaultAvatar(res, userId.toString().charAt(0).toUpperCase());
    } catch (error) {
        return sendDefaultAvatar(res, 'E');
    }
});

// Send Message Endpoint
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message } = req.body;
        if (!userId || !message) return res.json({ success: false, error: 'Missing data' });

        await bot.sendMessage(ADMIN_ID, `📩 New Message from ${userId}:\n${message}`);
        await bot.sendMessage(userId, `✅ Message sent to admin!`);
        
        return res.json({ success: true });
    } catch (error) {
        return res.json({ success: false, error: error.message });
    }
});

// Helper for default avatar
function sendDefaultAvatar(res, initial) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#667eea"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="80" fill="white">${initial}</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
}

// Health Check
app.get('/', (req, res) => res.json({ status: 'Bot Running' }));

// Start Server
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});
