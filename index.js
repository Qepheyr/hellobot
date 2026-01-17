const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const WEBSITE_URL = process.env.WEBSITE_URL || "https://earning-desire.ct.ws";
const BOT_URL = `https://api.telegram.org/bot${TOKEN}`;

// Validate
if (!TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN is not set");
    process.exit(1);
}

console.log("🤖 Bot Token:", TOKEN.substring(0, 10) + "...");
console.log("👑 Admin ID:", ADMIN_ID);
console.log("🌐 Website:", WEBSITE_URL);

// Create bot
const bot = new TelegramBot(TOKEN, { 
    polling: true,
    filepath: false // Don't save files locally
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SIMPLE PROFILE PICTURE ENDPOINT ---
app.get('/profile-pic', async (req, res) => {
    try {
        const userId = req.query.user_id;
        
        if (!userId) {
            return res.status(400).send('No user ID');
        }

        console.log("📸 Fetching profile pic for:", userId);
        
        // Get user profile photos from Telegram
        const response = await fetch(`${BOT_URL}/getUserProfilePhotos?user_id=${userId}&limit=1`);
        const data = await response.json();
        
        if (data.ok && data.result.total_count > 0) {
            const fileId = data.result.photos[0][0].file_id;
            
            // Get file path
            const fileResponse = await fetch(`${BOT_URL}/getFile?file_id=${fileId}`);
            const fileData = await fileResponse.json();
            
            if (fileData.ok) {
                const filePath = fileData.result.file_path;
                const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
                
                console.log("✅ Found photo URL:", fileUrl);
                
                // Redirect to Telegram's file URL
                return res.redirect(fileUrl);
            }
        }
        
        // If no photo found, return default avatar
        console.log("❌ No photo found, using default");
        const defaultSvg = generateAvatar(userId);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(defaultSvg);
        
    } catch (error) {
        console.error('❌ Profile pic error:', error.message);
        const defaultSvg = generateAvatar('error');
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(defaultSvg);
    }
});

// Generate SVG avatar
function generateAvatar(text) {
    const initial = text.charAt(0).toUpperCase();
    const colors = ['#667eea', '#764ba2', '#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1'];
    const color = colors[text.length % colors.length];
    
    return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="95" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-size="80" font-family="Arial, sans-serif" font-weight="bold">
            ${initial}
        </text>
    </svg>`;
}

// --- SEND MESSAGE ENDPOINT ---
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message, username, firstName, lastName } = req.body;
        
        console.log("📨 Message from:", userId);
        
        if (!userId || !message) {
            return res.json({ success: false, error: 'Missing data' });
        }

        // Prepare message for admin
        const adminMessage = `
📩 *New Message from User*

👤 *Name:* ${firstName || ''} ${lastName || ''}
🔗 *Username:* @${username || 'no_username'}
🆔 *ID:* \`${userId}\`

📝 *Message:*
${message}
        `.trim();

        // Send to admin
        try {
            await bot.sendMessage(ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });
            console.log("✅ Sent to admin");
        } catch (adminError) {
            console.error("Admin error:", adminError.message);
        }

        // Send confirmation to user
        try {
            await bot.sendMessage(userId, `
✅ *Message Sent Successfully!*

Your message has been delivered to the admin.

📝 *Your message:*
"${message}"

Thank you for your message!
            `.trim(), { parse_mode: 'Markdown' });
            console.log("✅ Confirmation sent to user");
        } catch (userError) {
            console.error("User error:", userError.message);
        }

        return res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        return res.json({ success: false, error: error.message });
    }
});

// --- BOT /start COMMAND ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';

    console.log(`🚀 /start from ${firstName} (ID: ${userId})`);

    try {
        // Try to get profile photo
        let photoUrl = '';
        try {
            const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
            if (photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                const file = await bot.getFile(fileId);
                photoUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
            }
        } catch (photoError) {
            console.log("Photo error, using default");
        }

        // Create web app URL
        const webAppUrl = new URL(WEBSITE_URL + '/index.php');
        webAppUrl.searchParams.append('user_id', userId);
        webAppUrl.searchParams.append('first_name', firstName);
        webAppUrl.searchParams.append('last_name', lastName);
        webAppUrl.searchParams.append('username', username);
        if (photoUrl) {
            webAppUrl.searchParams.append('photo_url', photoUrl);
        }

        // Prepare message
        const messageText = `👋 *Welcome ${firstName}!*\n\n` +
                           `🆔 *Your ID:* \`${userId}\`\n` +
                           `👤 *Username:* @${username || 'no_username'}\n\n` +
                           `Click the button below to open the Mini App and send messages to admin:`;

        const keyboard = {
            inline_keyboard: [[
                {
                    text: "📱 Open Mini App",
                    web_app: { url: webAppUrl.toString() }
                }
            ]]
        };

        // Send with photo if available
        if (photoUrl) {
            try {
                // Get file_id for sending
                const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
                if (photos.total_count > 0) {
                    const fileId = photos.photos[0][0].file_id;
                    await bot.sendPhoto(chatId, fileId, {
                        caption: messageText,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                    console.log("✅ Sent with photo");
                    return;
                }
            } catch (sendError) {
                console.log("Couldn't send photo:", sendError.message);
            }
        }

        // Fallback: Send without photo
        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        console.log("✅ Sent as text message");

    } catch (error) {
        console.error('❌ /start error:', error.message);
        
        // Ultimate fallback
        await bot.sendMessage(chatId, 
            `Welcome ${firstName}! Click below to open Mini App:`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: "📱 Open Mini App", 
                            web_app: { url: WEBSITE_URL + '/index.php?user_id=' + userId } 
                        }
                    ]]
                }
            }
        );
    }
});

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
    res.json({
        status: 'Bot Server Running',
        endpoints: {
            profilePic: 'GET /profile-pic?user_id=USER_ID',
            sendMessage: 'POST /send-message',
            health: 'GET /health'
        },
        bot: 'Active'
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- START SERVER ---
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`📸 Profile pic endpoint: http://0.0.0.0:${port}/profile-pic?user_id=USER_ID`);
    console.log(`🤖 Bot is ready! Send /start to test`);
});
