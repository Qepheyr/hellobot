const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const TOKEN = process.env.BOT_TOKEN || '8502935085:AAEJY-IBTDIJL8emmP9avdp3MySbtH5rQn0';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '8469993808');
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://earning-desire.ct.ws';
const BACKEND_URL = process.env.RAILWAY_URL || 'https://web-production-dcc8f.up.railway.app';

console.log("🤖 Bot starting...");
console.log("👑 Admin ID:", ADMIN_ID);
console.log("🌐 Website:", WEBSITE_URL);

// Create bot
const bot = new TelegramBot(TOKEN, { 
    polling: true
});

// Middleware
app.use(cors());
app.use(express.json());

// --- GET PROFILE PICTURE ENDPOINT (YOUR METHOD) ---
app.get('/get-user-photo', async (req, res) => {
    try {
        const userId = req.query.user_id || req.query.uid;
        
        if (!userId) {
            console.log("❌ No user ID provided");
            return sendDefaultAvatar(res, 'U');
        }
        
        console.log("📸 Getting profile photo for user:", userId);
        
        // Get user profile photos (YOUR METHOD)
        const photos = await bot.getUserProfilePhotos(userId);
        
        if (photos.total_count > 0) {
            // Get the most recent photo and highest quality size
            const photoArray = photos.photos[0];
            const bestPhoto = photoArray[photoArray.length - 1]; // Last size = highest quality
            const fileId = bestPhoto.file_id;
            
            console.log("✅ Found profile photo, file_id:", fileId);
            
            // Send the photo directly
            try {
                // Get file info to redirect
                const file = await bot.getFile(fileId);
                const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
                
                console.log("✅ Redirecting to Telegram file URL");
                return res.redirect(fileUrl);
                
            } catch (fileError) {
                console.error("File error:", fileError.message);
                return sendDefaultAvatar(res, userId.toString().charAt(0).toUpperCase());
            }
        } else {
            console.log("❌ No profile photos found for user");
            return sendDefaultAvatar(res, userId.toString().charAt(0).toUpperCase());
        }
        
    } catch (error) {
        console.error('❌ Photo endpoint error:', error.message);
        return sendDefaultAvatar(res, 'E');
    }
});

// Helper function for default avatar
function sendDefaultAvatar(res, initial) {
    const colors = ['#667eea', '#764ba2', '#f56565', '#48bb78', '#ed8936'];
    const color = colors[Math.abs(initial.charCodeAt(0)) % colors.length];
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="95" fill="${color}" stroke="white" stroke-width="3"/>
    <text x="100" y="110" text-anchor="middle" fill="white" font-size="80" font-family="Arial" font-weight="bold">
        ${initial}
    </text>
</svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(svg);
}

// --- SEND MESSAGE ENDPOINT ---
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message, username, firstName, lastName } = req.body;
        
        console.log("📨 New message from user:", userId);
        
        if (!userId || !message) {
            return res.json({ success: false, error: 'Missing user ID or message' });
        }

        // Format message for admin
        const adminMessage = `📩 *NEW MESSAGE*\n\n` +
                            `👤 *From:* ${firstName || ''} ${lastName || ''}\n` +
                            `🔗 @${username || 'no_username'}\n` +
                            `🆔 ID: ${userId}\n\n` +
                            `📝 *Message:*\n${message}\n\n` +
                            `⏰ ${new Date().toLocaleString()}`;

        // Send to admin
        let adminSent = false;
        try {
            await bot.sendMessage(ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });
            adminSent = true;
            console.log("✅ Message sent to admin");
        } catch (adminError) {
            console.error("❌ Admin error:", adminError.message);
        }

        // Send confirmation to user
        let userSent = false;
        try {
            await bot.sendMessage(userId, 
                `✅ *Message Sent!*\n\nYour message has been delivered to admin.\n\n📝 *Your message:*\n"${message}"`,
                { parse_mode: 'Markdown' }
            );
            userSent = true;
            console.log("✅ Confirmation sent to user");
        } catch (userError) {
            console.error("❌ User error:", userError.message);
        }

        return res.json({ 
            success: true,
            adminSent,
            userSent
        });
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        return res.json({ success: false, error: error.message });
    }
});

// --- BOT COMMANDS ---

// /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    console.log(`🚀 /start from ${firstName} (ID: ${userId})`);

    try {
        // Try to get user's profile photo
        let hasPhoto = false;
        try {
            const photos = await bot.getUserProfilePhotos(userId);
            if (photos.total_count > 0) {
                hasPhoto = true;
            }
        } catch (photoError) {
            console.log("Couldn't check photos:", photoError.message);
        }

        // Create web app URL with photo parameter
        const photoUrl = `${BACKEND_URL}/get-user-photo?user_id=${userId}`;
        const webAppUrl = `${WEBSITE_URL}/index.php?` +
            `user_id=${userId}&` +
            `first_name=${encodeURIComponent(firstName)}&` +
            `last_name=${encodeURIComponent(lastName)}&` +
            `username=${encodeURIComponent(username)}&` +
            `photo_url=${encodeURIComponent(photoUrl)}`;
        
        const messageText = `👋 *Welcome ${firstName}!*\n\n` +
                           `🆔 *Your ID:* \`${userId}\`\n` +
                           `👤 *Username:* @${username || 'no_username'}\n\n` +
                           `Click below to open Mini App:`;

        const keyboard = {
            inline_keyboard: [[
                {
                    text: "📱 Open Mini App",
                    web_app: { url: webAppUrl }
                }
            ]]
        };

        // Send message with photo if available
        if (hasPhoto) {
            try {
                const photos = await bot.getUserProfilePhotos(userId);
                const photoArray = photos.photos[0];
                const bestPhoto = photoArray[photoArray.length - 1];
                const fileId = bestPhoto.file_id;
                
                await bot.sendPhoto(chatId, fileId, {
                    caption: messageText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                console.log("✅ Sent /start with profile photo");
                return;
                
            } catch (sendError) {
                console.log("Couldn't send photo, falling back:", sendError.message);
            }
        }

        // Fallback: Send text message
        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        console.log("✅ Sent /start as text");
        
    } catch (error) {
        console.error('❌ /start error:', error.message);
        
        // Simple fallback
        await bot.sendMessage(chatId, 
            `Welcome ${firstName}! Click below to open Mini App:`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: "📱 Open Mini App", 
                            web_app: { url: `${WEBSITE_URL}/index.php?user_id=${userId}` } 
                        }
                    ]]
                }
            }
        );
    }
});

// /getpic command (for testing)
bot.onText(/\/getpic/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`📸 /getpic from ${userId}`);
    
    try {
        const photos = await bot.getUserProfilePhotos(userId);
        
        if (photos.total_count > 0) {
            // Get the highest quality photo
            const photoArray = photos.photos[0];
            const bestPhoto = photoArray[photoArray.length - 1];
            const fileId = bestPhoto.file_id;
            
            await bot.sendPhoto(chatId, fileId, {
                caption: `✅ Your profile picture\nUser ID: ${userId}`
            });
            console.log("✅ Sent profile picture via /getpic");
            
        } else {
            await bot.sendMessage(chatId, "❌ No profile picture found.");
        }
        
    } catch (error) {
        console.error('❌ /getpic error:', error);
        await bot.sendMessage(chatId, "❌ Error fetching profile picture.");
    }
});

// /test command
bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    await bot.sendMessage(chatId, 
        `🧪 Bot is working!\nYour ID: ${userId}\nAdmin ID: ${ADMIN_ID}\nBackend: ${BACKEND_URL}`
    );
});

// --- HEALTH ENDPOINTS ---
app.get('/', (req, res) => {
    res.json({
        status: 'Bot Server Running',
        endpoints: {
            getPhoto: 'GET /get-user-photo?user_id=USER_ID',
            sendMessage: 'POST /send-message',
            botCommands: '/start, /getpic, /test'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`📸 Photo endpoint: ${BACKEND_URL}/get-user-photo?user_id=USER_ID`);
    console.log(`🤖 Bot commands: /start, /getpic, /test`);
    console.log(`🌐 Web App: ${WEBSITE_URL}/index.php`);
});
