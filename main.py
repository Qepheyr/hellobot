import os
import telebot
import threading
from flask import Flask, request, jsonify

# --- CONFIGURATION ---
# We get these from Railway Variables directly
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')
WEB_APP_URL = "https://earning-desire.ct.ws"

# Initialize
bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# --- MANUAL CORS (No extra library needed) ---
# This allows your website to talk to this bot securely
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# --- BOT COMMANDS ---
@bot.message_handler(commands=['start'])
def start_command(message):
    try:
        # Create the button
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        # Send reply
        bot.reply_to(message, "Click below to open the app:", reply_markup=markup)
        print(f"Log: Start command received from {message.from_user.id}")
    except Exception as e:
        print(f"Error in start: {e}")

# --- WEBSITE API ---
@app.route('/')
def index():
    return "✅ Bot is Online and Running."

@app.route('/send_to_admin', methods=['POST'])
def receive_message():
    try:
        data = request.json
        user = data.get('user_name', 'Unknown')
        msg = data.get('message', 'Empty')
        
        # Send to your Telegram
        bot.send_message(ADMIN_ID, f"📩 **New Message**\nUser: {user}\nText: {msg}", parse_mode="Markdown")
        
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- RUNNER ---
if __name__ == "__main__":
    # 1. Reset Bot (Fixes 'Conflict' errors)
    print("--- REMOVING OLD WEBHOOKS ---")
    bot.remove_webhook()
    
    # 2. Start Bot in Background
    print("--- STARTING BOT POLLING ---")
    # infinity_polling keeps the bot running automatically
    t = threading.Thread(target=bot.infinity_polling)
    t.daemon = True
    t.start()
    
    # 3. Start Web Server (Required for Railway)
    port = int(os.environ.get("PORT", 5000))
    print(f"--- STARTING SERVER ON PORT {port} ---")
    app.run(host='0.0.0.0', port=port)
