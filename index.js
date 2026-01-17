const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Create bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;
const WEBSITE_URL = process.env.WEBSITE_URL;

// Store to keep track of messages (in production use database)
const userMessages = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook for receiving messages from mini app
app.post('/send-message', async (req, res) => {
    try {
        const { userId, message, userPhoto, username, firstName, lastName } = req.body;
        
        if (!userId || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Format user info
        const userInfo = `👤 ${firstName || ''} ${lastName || ''} ${username ? `(@${username})` : ''}`;
        const fullMessage = `${userInfo}\n\n📨 Message: ${message}`;

        // Send to admin
        await bot.sendMessage(ADMIN_ID, fullMessage);

        // Send confirmation to user
        await bot.sendMessage(userId, `✅ Your message has been sent to admin!\n\nYour message: ${message}`);

        // Store message (optional)
        if (!userMessages.has(userId)) {
            userMessages.set(userId, []);
        }
        userMessages.get(userId).push({
            message,
            timestamp: new Date().toISOString()
        });

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Bot commands
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    const username = msg.from.username || '';
    
    try {
        // Get user profile photos
        const photos = await bot.getUserProfilePhotos(userId);
        
        let profilePhotoUrl = '';
        if (photos && photos.total_count > 0) {
            const photo = photos.photos[0][photos.photos[0].length - 1];
            const file = await bot.getFile(photo.file_id);
            profilePhotoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
        }

        // Create inline keyboard with mini app button
        const keyboard = {
            inline_keyboard: [
                [{
                    text: "📱 Open Mini App",
                    web_app: { url: `${WEBSITE_URL}/index.php?user_id=${userId}` }
                }],
                [{
                    text: "🔄 Refresh",
                    callback_data: 'refresh_profile'
                }]
            ]
        };

        // Send user details with photo if available
        let caption = `👤 *User Details*\n\n` +
                     `🆔 ID: ${userId}\n` +
                     `📛 Name: ${firstName} ${lastName}\n` +
                     `🔗 Username: @${username || 'Not set'}\n\n` +
                     `Click the button below to open the mini app:`;

        if (profilePhotoUrl) {
            await bot.sendPhoto(chatId, profilePhotoUrl, {
                caption: caption,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } else {
            await bot.sendMessage(chatId, caption, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }

    } catch (error) {
        console.error('Error in /start command:', error);
        await bot.sendMessage(chatId, 'Welcome! Click below to open the mini app:', {
            reply_markup: {
                inline_keyboard: [[{
                    text: "📱 Open Mini App",
                    web_app: { url: `${WEBSITE_URL}/index.php?user_id=${userId}` }
                }]]
            }
        });
    }
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    
    if (data === 'refresh_profile') {
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        await bot.sendMessage(msg.chat.id, 'Please send /start again to refresh your profile.');
    }
});

// Handle any text message
bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        // Optional: Echo messages or handle other text
        // await bot.sendMessage(msg.chat.id, `You said: ${msg.text}`);
    }
});

// Set webhook for bot (if using webhooks instead of polling)
app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Bot is running in polling mode`);
    console.log(`Mini app URL: ${WEBSITE_URL}/index.php`);
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});
