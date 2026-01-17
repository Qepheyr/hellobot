const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const WEBSITE_URL = process.env.WEBSITE_URL || "https://earning-desire.ct.ws";
const BACKEND_URL = process.env.RAILWAY_URL || `http://localhost:${port}`;

// Validate
if (!TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN is not set");
    process.exit(1);
}

console.log("🤖 Bot initialized");
console.log("👑 Admin ID:", ADMIN_ID);

// Create bot
const bot = new TelegramBot(TOKEN, { 
    polling: true
});

// Middleware
app.use(cors());
app.use(express.json());

// --- API: Get Profile Picture (EXACTLY like your working example) ---
app.get('/get-pfp', async (req, res) => {
    try {
        const uid = req.query.uid;
        console.log("📸 PFP request for UID:", uid);
        
        if (!uid) {
            return res.status(400).send("No user ID provided");
        }

        // Get user profile photos
        const photos = await bot.getUserProfilePhotos(uid, { limit: 1 });
        
        if (photos.total_count > 0) {
            // Get the first photo (smallest size)
            const file_id = photos.photos[0][0].file_id;
            
            // Get file info
            const file_info = await bot.getFile(file_id);
            
            // Construct download URL
            const dl_url = `https://api.telegram.org/file/bot${TOKEN}/${file_info.file_path}`;
            console.log("📸 Download URL:", dl_url);
            
            // Fetch and stream the image
            const response = await axios({
                url: dl_url,
                method: 'GET',
                responseType: 'stream',
                timeout: 5000
            });
            
            // Set content type
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            
            // Pipe the image to response
            response.data.pipe(res);
            
        } else {
            console.log("❌ No profile photo found for user:", uid);
            // Return a default image
            const defaultImage = `<svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="75" cy="75" r="70" fill="#667eea" stroke="#fff" stroke-width="3"/>
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="40" font-family="Arial">
                    ${uid.toString().charAt(0).toUpperCase()}
                </text>
            </svg>`;
            
            res.setHeader('Content-Type', 'image/svg+xml');
            res.send(defaultImage);
        }
        
    } catch (error) {
        console.error('❌ PFP error:', error.message);
        
        // Return error image
        const errorImage = `<svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="75" cy="75" r="70" fill="#ff6b6b" stroke="#fff" stroke-width="3"/>
            <text x="50%" y="45%" text-anchor="middle" fill="white" font-size="20" font-family="Arial">Error</text>
            <text x="50%" y="60%" text-anchor="middle" fill="white" font-size="12" font-family="Arial">Loading Image</text>
        </svg>`;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(errorImage);
    }
});

// --- API: Send Message ---
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message, username, firstName, lastName } = req.body;
        
        console.log("📨 Message from user:", userId);
        
        if (!userId || !message) {
            return res.status(400).json({ error: 'Missing data' });
        }

        // Format message
        const userInfo = `👤 *User:* ${firstName || ''} ${lastName || ''}\n🔗 @${username || 'no_username'}\n🆔 ${userId}`;
        const adminMsg = `${userInfo}\n\n📝 *Message:*\n${message}`;
        
        // Send to admin
        try {
            await bot.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
            console.log("✅ Sent to admin");
        } catch (err) {
            console.error("Admin send error:", err.message);
        }
        
        // Send confirmation to user
        try {
            await bot.sendMessage(userId, `✅ *Message Sent!*\n\nYour message to admin:\n"${message}"`, { 
                parse_mode: 'Markdown' 
            });
            console.log("✅ Confirmation sent to user");
        } catch (err) {
            console.error("User send error:", err.message);
        }

        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// --- BOT: /start command ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    console.log(`🚀 /start from ${firstName} (ID: ${userId})`);

    try {
        // Try to get user photo
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        
        const messageText = `👋 *Hello ${firstName}!*\n\n` +
                           `🆔 *ID:* \`${userId}\`\n` +
                           `👤 *Username:* @${username || 'no_username'}\n\n` +
                           `📱 *Click below to open the Mini App:*`;
        
        const webAppUrl = `${WEBSITE_URL}/index.php?` + 
                         `user_id=${userId}&` +
                         `first_name=${encodeURIComponent(firstName)}&` +
                         `last_name=${encodeURIComponent(lastName)}&` +
                         `username=${encodeURIComponent(username)}&` +
                         `photo_url=${encodeURIComponent(`${BACKEND_URL}/get-pfp?uid=${userId}`)}`;
        
        const keyboard = {
            inline_keyboard: [[
                { 
                    text: "🚀 Open Mini App", 
                    web_app: { url: webAppUrl } 
                }
            ]]
        };

        // Send with photo if available
        if (photos.total_count > 0) {
            try {
                // Get the file_id of the photo
                const fileId = photos.photos[0][0].file_id;
                
                await bot.sendPhoto(chatId, fileId, {
                    caption: messageText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                
                console.log("✅ Sent /start with photo");
                return;
                
            } catch (photoError) {
                console.error("Photo send failed:", photoError.message);
            }
        }
        
        // Fallback to text message
        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        console.log("✅ Sent /start as text");
        
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
        status: 'Bot Server Running',
        endpoints: {
            getPfp: 'GET /get-pfp?uid=USER_ID',
            sendMessage: 'POST /send-message',
            health: 'GET /health'
        },
        usage: 'Use /start in Telegram bot'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        bot: 'active'
    });
});

// Start server
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`🌐 PFP endpoint: ${BACKEND_URL}/get-pfp?uid=USER_ID`);
    console.log(`🤖 Bot is polling...`);
    console.log(`📱 Mini App URL: ${WEBSITE_URL}/index.php`);
});
