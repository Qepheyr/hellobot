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

// Validate environment variables
if (!TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN is not set in .env file");
    process.exit(1);
}

if (!ADMIN_ID) {
    console.error("❌ ERROR: ADMIN_ID is not set in .env file");
    process.exit(1);
}

console.log("🤖 Bot Token:", TOKEN.substring(0, 10) + "...");
console.log("👑 Admin ID:", ADMIN_ID);
console.log("🌐 Website URL:", WEBSITE_URL);

// Create bot in POLLING mode
const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API: RECEIVE MESSAGE FROM WEBSITE ---
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message, username, firstName, lastName } = req.body;
        
        console.log("📨 Received message from website:", { userId, message });
        
        if (!userId || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing userId or message' 
            });
        }

        // Format message for admin
        const userInfo = `👤 ${firstName || ''} ${lastName || ''}`;
        const adminMsg = `${userInfo} ${username ? `(@${username})` : ''}\n🆔 ${userId}\n\n📝 ${message}`;
        
        // Send to Admin
        try {
            await bot.sendMessage(ADMIN_ID, adminMsg);
            console.log("✅ Message sent to admin:", ADMIN_ID);
        } catch (adminError) {
            console.error("❌ Error sending to admin:", adminError.message);
        }

        // Send confirmation to User
        try {
            await bot.sendMessage(userId, `✅ Your message has been sent to admin!\n\nYour message: "${message}"`);
            console.log("✅ Confirmation sent to user:", userId);
        } catch (userError) {
            console.error("❌ Error sending confirmation to user:", userError.message);
        }

        res.json({ 
            success: true,
            message: 'Message sent successfully'
        });
        
    } catch (error) {
        console.error('❌ API Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message' 
        });
    }
});

// --- API: GET USER PHOTO ---
app.get('/proxy-photo/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log("📸 Requesting photo for user:", userId);
        
        if (!userId) {
            return res.status(400).send("No user ID provided");
        }

        // Get user profile photos
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        
        if (photos.total_count === 0) {
            console.log("No photo found for user:", userId);
            // Redirect to default placeholder
            return res.redirect("https://via.placeholder.com/150/667eea/ffffff?text=" + encodeURIComponent("User"));
        }

        const fileId = photos.photos[0][0].file_id;
        console.log("Found file ID:", fileId);
        
        // Get the file link
        const fileLink = await bot.getFileLink(fileId);
        console.log("File link:", fileLink);
        
        // Stream the image
        const response = await axios({
            url: fileLink,
            method: 'GET',
            responseType: 'stream'
        });

        // Set appropriate headers
        res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        
        response.data.pipe(res);
        
    } catch (error) {
        console.error('❌ Photo proxy error:', error.message);
        res.redirect("https://via.placeholder.com/150/667eea/ffffff?text=Error");
    }
});

// --- API: GET USER INFO ---
app.get('/user-info/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Since we can't directly get user info without them interacting with bot,
        // we'll return basic info
        res.json({
            success: true,
            userId: userId,
            message: "User info will be available when user interacts with bot"
        });
    } catch (error) {
        console.error('User info error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- BOT COMMANDS ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    console.log(`🚀 /start command from ${firstName} ${lastName} (@${username}) ID: ${userId}`);

    try {
        // Get user profile photo
        let photoSent = false;
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        
        const messageText = `👋 *Hello ${firstName} ${lastName}!*\n\n` +
                           `🆔 *Your ID:* \`${userId}\`\n` +
                           `👤 *Username:* @${username || 'Not set'}\n\n` +
                           `Click the button below to open the Mini App and send messages to admin.`;
        
        const opts = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { 
                        text: "📱 Open Mini App", 
                        web_app: { 
                            url: `${WEBSITE_URL}/index.php?user_id=${userId}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&username=${username}` 
                        } 
                    }
                ]]
            }
        };

        // Try to send with photo
        if (photos.total_count > 0) {
            try {
                const fileId = photos.photos[0][0].file_id;
                await bot.sendPhoto(chatId, fileId, {
                    caption: messageText,
                    ...opts
                });
                photoSent = true;
            } catch (photoError) {
                console.error("Photo send error:", photoError.message);
                photoSent = false;
            }
        }
        
        // If no photo or photo failed, send text message
        if (!photoSent) {
            await bot.sendMessage(chatId, messageText, opts);
        }
        
    } catch (error) {
        console.error('❌ Start command error:', error);
        
        // Send fallback message
        await bot.sendMessage(chatId, 
            `Welcome! Click below to open the Mini App:`,
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

// Handle any other messages
bot.on('message', async (msg) => {
    // Ignore /start command (already handled)
    if (msg.text && msg.text.startsWith('/')) return;
    
    // Optional: Echo messages or handle other text
    // console.log("Message received:", msg.text);
});

// Error handling for bot
bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.code, error.message);
});

bot.on('webhook_error', (error) => {
    console.error('❌ Webhook error:', error);
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Telegram Mini App Bot',
        endpoints: {
            sendMessage: 'POST /send-message',
            userPhoto: 'GET /proxy-photo/:userId',
            userInfo: 'GET /user-info/:userId'
        },
        botInfo: {
            adminId: ADMIN_ID,
            website: WEBSITE_URL
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        bot: 'running'
    });
});

// Start server
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`🌐 Open in browser: http://localhost:${port}`);
    console.log(`🤖 Bot is running in polling mode`);
    console.log(`🔗 Website URL: ${WEBSITE_URL}`);
});
