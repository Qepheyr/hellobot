import os
import telebot
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = os.getenv('ADMIN_ID')
WEB_APP_URL = "https://earning-desire.ct.ws" # Your website link

# Initialize Bot and Flask
bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)
CORS(app)  # Allow your website to talk to this backend

# --- BOT CODE ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    user = message.from_user
    # Minimal details reply
    text = f"Hello, {user.first_name}!\nID: `{user.id}`"
    
    # Button to open the Mini App
    markup = telebot.types.InlineKeyboardMarkup()
    web_app = telebot.types.WebAppInfo(WEB_APP_URL)
    markup.add(telebot.types.InlineKeyboardButton("Open Mini App", web_app=web_app))
    
    bot.reply_to(message, text, reply_markup=markup, parse_mode="Markdown")

# --- API FOR WEBSITE ---
@app.route('/')
def home():
    return "Bot Backend is Running!"

@app.route('/send_to_admin', methods=['POST'])
def send_to_admin():
    try:
        data = request.json
        user_name = data.get('user_name', 'Unknown')
        user_id = data.get('user_id', 'Unknown')
        message_text = data.get('message', '')

        # Construct message for Admin
        admin_msg = (
            f"🔔 **New Website Message**\n\n"
            f"👤 **User:** {user_name} (`{user_id}`)\n"
            f"✉️ **Message:**\n{message_text}"
        )

        # Send to Admin
        bot.send_message(ADMIN_ID, admin_msg, parse_mode="Markdown")
        return jsonify({"status": "success", "message": "Sent to admin"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- RUNNING BOTH ---
def run_bot():
    bot.infinity_polling()

if __name__ == '__main__':
    # Start bot in a separate thread so Flask can run
    t = threading.Thread(target=run_bot)
    t.start()
    
    # Run Flask server
    app.run(host='0.0.0.0', port=8080)
