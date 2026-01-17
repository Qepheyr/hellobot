import os
import telebot
import logging
import threading
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# 1. SETUP LOGGING
# This will show up in Railway "Deploy Logs"
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RailwayBot")

# 2. CONFIG
load_dotenv()
BOT_TOKEN = os.getenv('BOT_TOKEN', '8502935085:AAEJY-IBTDIJL8emmP9avdp3MySbtH5rQn0')
ADMIN_ID = os.getenv('ADMIN_ID', '8469993808')
WEB_APP_URL = "https://earning-desire.ct.ws"

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)
CORS(app)

# --- BOT COMMANDS ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    logger.info(f"✅ RECEIVED /start from {message.from_user.first_name}")
    try:
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        bot.reply_to(message, "👋 **Bot is Online!**\nClick below to open:", 
                     reply_markup=markup, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"❌ Error sending reply: {e}")

# --- FLASK ROUTES ---
@app.route('/')
def home():
    return "✅ Bot Backend is Running!", 200

@app.route('/send_to_admin', methods=['POST'])
def send_to_admin():
    try:
        data = request.json
        user_name = data.get('user_name', 'Unknown')
        user_id = data.get('user_id', 'Unknown')
        msg = data.get('message', '')

        logger.info(f"📩 Message from website: {user_name}")
        bot.send_message(ADMIN_ID, f"🔔 **Website Msg**\n👤 {user_name}\n📝 {msg}", parse_mode="Markdown")
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"API Error: {e}")
        return jsonify({"status": "error", "error": str(e)}), 500

# --- BACKGROUND RUNNER ---
def run_bot_loop():
    logger.info("🔄 Removing old Webhooks...")
    bot.remove_webhook() # <--- THIS FIXES THE SILENT FAILURES
    time.sleep(1)
    
    logger.info("🚀 Starting Bot Polling...")
    while True:
        try:
            # interval=2 makes it check for messages every 2 seconds
            bot.polling(none_stop=True, interval=2, timeout=20)
        except Exception as e:
            logger.error(f"⚠️ Polling Error: {e}")
            time.sleep(5) # Wait and restart if it crashes

# --- STARTUP ---
if __name__ == '__main__':
    # 1. Start Bot Thread
    t = threading.Thread(target=run_bot_loop)
    t.daemon = True
    t.start()
    
    # 2. Start Web Server
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"🌍 Starting Web Server on Port {port}")
    app.run(host='0.0.0.0', port=port)
