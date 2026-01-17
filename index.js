const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const WEBSITE_URL = process.env.WEBSITE_URL || "https://earning-desire.ct.ws";

// Validate
if (!TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN is not set");
    process.exit(1);
}

console.log("🤖 Bot initialized");
console.log("👑 Admin ID:", ADMIN_ID);
console.log("🌐 Website URL:", WEBSITE_URL);

// Create bot
const bot = new TelegramBot(TOKEN, { 
    polling: true,
    request: {
        proxy: process.env.PROXY || null
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create public directory for images
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}
if (!fs.existsSync('public/images')) {
    fs.mkdirSync('public/images');
}

// Store user photos temporarily (in production use database)
const userPhotos = new Map();

// --- API: Send Message ---
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message, username, firstName, lastName } = req.body;
        
        console.log("📨 Message from:", userId, "->", message.substring(0, 50));
        
        if (!userId || !message) {
            return res.status(400).json({ error: 'Missing data' });
        }

        // Send to Admin
        const adminMsg = `📩 *New Message*\n\n👤 *From:* ${firstName || ''} ${lastName || ''}\n🔗 @${username || 'no_username'}\n🆔 ID: ${userId}\n\n📝 *Message:*\n${message}`;
        
        try {
            await bot.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
            console.log("✅ Sent to admin");
        } catch (adminErr) {
            console.error("Admin error:", adminErr.message);
        }

        // Send confirmation to User
        try {
            await bot.sendMessage(userId, `✅ *Message Sent!*\n\nYour message has been delivered to admin.\n\n📝 *Your message:*\n${message}`, { 
                parse_mode: 'Markdown' 
            });
            console.log("✅ Confirmation sent to user");
        } catch (userErr) {
            console.error("User error:", userErr.message);
        }

        res.json({ success: true });
        
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to send' });
    }
});

// --- API: Get User Photo (Improved) ---
app.get('/get-photo/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log("📸 Photo request for:", userId);
        
        if (!userId) {
            return res.redirect('https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=150');
        }

        // Check if we have cached photo
        const cachePath = path.join(__dirname, 'public', 'images', `${userId}.jpg`);
        
        if (fs.existsSync(cachePath)) {
            console.log("✅ Serving cached photo for", userId);
            return res.sendFile(cachePath);
        }

        // Get photo from Telegram
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        
        if (photos.total_count === 0) {
            console.log("❌ No photo found for", userId);
            // Generate avatar with first letter
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userId)}&background=667eea&color=fff&size=150`;
            return res.redirect(avatarUrl);
        }

        // Get the largest photo
        const photoSizes = photos.photos[0];
        const largestPhoto = photoSizes[photoSizes.length - 1];
        const fileId = largestPhoto.file_id;
        
        console.log("📸 Found photo for", userId, "file_id:", fileId);
        
        // Get file path
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
        
        console.log("📸 File URL:", fileUrl);
        
        // Download and cache the image
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        });

        // Create write stream
        const writer = fs.createWriteStream(cachePath);
        response.data.pipe(writer);
        
        // Send the image
        response.data.pipe(res);
        
        writer.on('finish', () => {
            console.log("✅ Photo cached for", userId);
        });
        
        writer.on('error', (err) => {
            console.error("Cache error:", err);
        });
        
    } catch (error) {
        console.error('❌ Photo error:', error.message);
        // Fallback to avatar
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.userId || 'User')}&background=667eea&color=fff&size=150`;
        res.redirect(avatarUrl);
    }
});

// --- BOT: /start command with photo ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || 'no_username';
    
    console.log(`🚀 /start from ${firstName} (ID: ${userId})`);

    try {
        // Try to get user photo
        let photoUrl = `${process.env.RAILWAY_URL || `http://localhost:${port}`}/get-photo/${userId}`;
        
        // Get photos from Telegram
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        
        let hasPhoto = false;
        if (photos.total_count > 0) {
            // Get the best quality photo
            const photoSizes = photos.photos[0];
            const bestPhoto = photoSizes[photoSizes.length - 1];
            const fileId = bestPhoto.file_id;
            
            // Send photo with caption
            await bot.sendPhoto(chatId, fileId, {
                caption: `👋 *Hello ${firstName} ${lastName}!*\n\n` +
                        `🆔 *Your ID:* \`${userId}\`\n` +
                        `👤 *Username:* @${username}\n\n` +
                        `📱 *Click the button below to open Mini App:*`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: "🚀 Open Mini App", 
                            web_app: { 
                                url: `${WEBSITE_URL}/index.php?user_id=${userId}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&username=${username}&photo_url=${encodeURIComponent(photoUrl)}` 
                            } 
                        }
                    ]]
                }
            });
            hasPhoto = true;
            console.log("✅ Sent photo with /start");
        }
        
        // If no photo, send text message
        if (!hasPhoto) {
            await bot.sendMessage(chatId, 
                `👋 *Hello ${firstName} ${lastName}!*\n\n` +
                `🆔 *Your ID:* \`${userId}\`\n` +
                `👤 *Username:* @${username}\n\n` +
                `📱 *Click the button below to open Mini App:*`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { 
                                text: "🚀 Open Mini App", 
                                web_app: { 
                                    url: `${WEBSITE_URL}/index.php?user_id=${userId}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&username=${username}&photo_url=${encodeURIComponent(photoUrl)}` 
                                } 
                            }
                        ]]
                    }
                }
            );
            console.log("✅ Sent text /start (no photo)");
        }
        
    } catch (error) {
        console.error('❌ Start error:', error.message);
        
        // Fallback
        await bot.sendMessage(chatId, 
            `Welcome ${firstName}! Click below to open Mini App:`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: "📱 Open Mini App", 
                            web_app: { 
                                url: `${WEBSITE_URL}/index.php?user_id=${userId}` 
                            } 
                        }
                    ]]
                }
            }
        );
    }
});

// --- Health Check ---
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running',
        endpoints: {
            getPhoto: 'GET /get-photo/:userId',
            sendMessage: 'POST /send-message',
            health: 'GET /health'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`🌐 Photo endpoint: http://localhost:${port}/get-photo/:userId`);
    console.log(`🤖 Bot is polling for messages...`);
});
