import os
import telebot
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time

# 1. MAX LOGGING
logging.basicConfig(level=logging.DEBUG) # Show ALL debug info
logger = logging.getLogger(__name__)

# 2. SETUP
BOT_TOKEN = "8502935085:AAEJY-IBTDIJL8emmP9avdp3MySbtH5rQn0"
ADMIN_ID = "8469993808"
WEB_APP_URL = "https://earning-desire.ct.ws"

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)
CORS(app)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    logger.info(f"GOT COMMAND: /start from {message.from_user.id}") # LOG THIS
    try:
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        bot.reply_to(message, "✅ Bot is Online! Click below:", reply_markup=markup)
    except Exception as e:
        logger.error(f"ERROR REPLYING: {e}")

@app.route('/')
def home():
    return "✅ Backend is running!", 200

@app.route('/send_to_admin', methods=['POST'])
def send_to_admin():
    data = request.json
    bot.send_message(ADMIN_ID, f"Message from {data.get('user_name')}: {data.get('message')}")
    return jsonify({"status": "sent"})

def start_bot():
    logger.info("--- ATTEMPTING TO CONNECT TO TELEGRAM ---")
    try:
        # Remove webhook internally just in case
        bot.remove_webhook()
        time.sleep(1)
        bot.infinity_polling(timeout=10, long_polling_timeout=5)
    except Exception as e:
        logger.critical(f"BOT CRASHED: {e}")

if __name__ == '__main__':
    # Start Bot Thread
    t = threading.Thread(target=start_bot)
    t.daemon = True
    t.start()
    
    # Start Server
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"--- STARTING FLASK ON PORT {port} ---")
    app.run(host='0.0.0.0', port=port)
