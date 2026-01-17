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
console.log("🔗 Backend:", BACKEND_URL);

// Create bot
const bot = new TelegramBot(TOKEN, { 
    polling: true
});

// Middleware
app.use(cors());
app.use(express.json());

// --- PROFILE PICTURE ENDPOINT ---
app.get('/get-user-photo', async (req, res) => {
    try {
        const userId = req.query.user_id || req.query.uid;
        
        if (!userId) {
            console.log("❌ No user ID provided");
            return sendDefaultAvatar(res, 'U');
        }
        
        console.log("📸 Getting photo for user:", userId);
        
        try {
            // Get user profile photos
            const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
            
            if (photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                console.log("✅ Found file_id:", fileId);
                
                try {
                    const file = await bot.getFile(fileId);
                    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
                    
                    console.log("✅ Redirecting to Telegram file:", fileUrl);
                    return res.redirect(fileUrl);
                    
                } catch (fileError) {
                    console.error("File error:", fileError.message);
                    return sendDefaultAvatar(res, userId.toString().charAt(0).toUpperCase());
                }
            } else {
                console.log("❌ No profile photo found");
                return sendDefaultAvatar(res, userId.toString().charAt(0).toUpperCase());
            }
            
        } catch (tgError) {
            console.error("Telegram API error:", tgError.message);
            return sendDefaultAvatar(res, userId.toString().charAt(0).toUpperCase());
        }
        
    } catch (error) {
        console.error('❌ Photo endpoint error:', error.message);
        return sendDefaultAvatar(res, 'E');
    }
});

function sendDefaultAvatar(res, initial) {
    const colors = ['#667eea', '#764ba2', '#f56565', '#48bb78', '#ed8936'];
    const color = colors[Math.abs(initial.charCodeAt(0)) % colors.length];
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="95" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="100" y="110" text-anchor="middle" fill="white" font-size="70" font-family="Arial, sans-serif" font-weight="bold">
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
        console.log("Message:", message.substring(0, 50) + '...');
        
        if (!userId || !message) {
            return res.json({ success: false, error: 'Missing user ID or message' });
        }

        // Format message for admin
        const adminMessage = `
📩 *NEW MESSAGE FROM USER*

👤 *Name:* ${firstName || ''} ${lastName || ''}
🔗 *Username:* @${username || 'no_username'}
🆔 *User ID:* \`${userId}\`

📝 *Message:*
${message}

⏰ *Time:* ${new Date().toLocaleString()}
        `.trim();

        // Send to admin
        let adminSent = false;
        try {
            await bot.sendMessage(ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });
            adminSent = true;
            console.log("✅ Message sent to admin");
        } catch (adminError) {
            console.error("❌ Failed to send to admin:", adminError.message);
        }

        // Send confirmation to user
        let userSent = false;
        try {
            await bot.sendMessage(userId, `
✅ *MESSAGE SENT SUCCESSFULLY!*

Your message has been delivered to the admin.

📝 *Your message:*
"${message}"

Thank you for contacting us!
            `.trim(), { parse_mode: 'Markdown' });
            userSent = true;
            console.log("✅ Confirmation sent to user");
        } catch (userError) {
            console.error("❌ Failed to send confirmation:", userError.message);
        }

        return res.json({ 
            success: adminSent || userSent,
            adminSent,
            userSent,
            message: 'Message processed successfully'
        });
        
    } catch (error) {
        console.error('❌ Send message error:', error);
        return res.json({ 
            success: false, 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// --- BOT /start COMMAND ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    console.log(`🚀 /start command from ${firstName} (ID: ${userId})`);

    try {
        // Create web app URL with all parameters
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
                           `Click the button below to open the Mini App:`;

        const keyboard = {
            inline_keyboard: [[
                {
                    text: "📱 Open Mini App",
                    web_app: { url: webAppUrl }
                }
            ]]
        };

        // Try to send with profile photo
        try {
            const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
            if (photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                await bot.sendPhoto(chatId, fileId, {
                    caption: messageText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                console.log("✅ Sent /start with photo");
                return;
            }
        } catch (photoError) {
            console.log("Photo send failed, falling back to text:", photoError.message);
        }

        // Fallback to text message
        await bot.sendMessage(chatId, messageText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        console.log("✅ Sent /start as text");
        
    } catch (error) {
        console.error('❌ /start error:', error.message);
        
        // Simple fallback
        try {
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
        } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError.message);
        }
    }
});

// Handle other messages
bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        // Optional: handle other messages
        // console.log("Message from", msg.from.id, ":", msg.text);
    }
});

// --- HEALTH ENDPOINTS ---
app.get('/', (req, res) => {
    res.json({
        status: 'Telegram Bot Server Running',
        version: '1.0.0',
        endpoints: {
            profilePhoto: 'GET /get-user-photo?user_id=USER_ID',
            sendMessage: 'POST /send-message',
            health: 'GET /health'
        },
        bot: {
            adminId: ADMIN_ID,
            webAppUrl: WEBSITE_URL + '/index.php'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// --- START SERVER ---
const server = app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`📸 Profile photo: ${BACKEND_URL}/get-user-photo?user_id=USER_ID`);
    console.log(`🤖 Bot is ready! Send /start to test`);
    console.log(`🌐 Web App: ${WEBSITE_URL}/index.php`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
