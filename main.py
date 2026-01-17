import os
import telebot
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import logging
import time

# 1. SETUP LOGGING (Crucial for debugging)
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# 2. CONFIGURATION
BOT_TOKEN = "8502935085:AAEJY-IBTDIJL8emmP9avdp3MySbtH5rQn0" # Ideally use env vars
ADMIN_ID = "8469993808"
# NOTE: This MUST be the direct website link, NOT the t.me link
WEB_APP_URL = "https://earning-desire.ct.ws" 

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)
CORS(app)

# --- BOT COMMANDS ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    try:
        user = message.from_user
        logger.info(f"Command /start from {user.first_name}")
        
        text = (
            f"👋 Hello **{user.first_name}**!\n"
            f"🆔 ID: `{user.id}`\n\n"
            "Click the button below to open the Mini App."
        )
        
        markup = telebot.types.InlineKeyboardMarkup()
        # This opens the Mini App inside Telegram
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        bot.reply_to(message, text, reply_markup=markup, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"Error in start: {e}")

# --- API FOR WEBSITE ---
@app.route('/')
def home():
    return "Bot Backend Online. Use the Telegram Bot."

@app.route('/send_to_admin', methods=['POST'])
def send_to_admin():
    try:
        data = request.json
        user_name = data.get('user_name', 'Unknown')
        user_id = data.get('user_id', 'Unknown')
        message = data.get('message', 'No message')

        admin_text = (
            f"🔔 **New Message**\n"
            f"👤 {user_name} (`{user_id}`)\n"
            f"📝 {message}"
        )
        
        bot.send_message(ADMIN_ID, admin_text, parse_mode="Markdown")
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"API Error: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500

# --- RUNNER ---
def run_bot_thread():
    while True:
        try:
            logger.info("Bot polling started...")
            bot.infinity_polling(timeout=10, long_polling_timeout=5)
        except Exception as e:
            logger.error(f"Bot Crashed: {e}")
            time.sleep(5) # Wait before restarting

if __name__ == '__main__':
    # Start Bot in background
    t = threading.Thread(target=run_bot_thread)
    t.daemon = True
    t.start()
    
    # Start Flask (Railway sets the PORT env var automatically)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
