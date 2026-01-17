import os
import telebot
import threading
from flask import Flask, request, jsonify

# --- CONFIGURATION ---
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')
# Note: Use your actual website URL here for the button
WEB_APP_URL = "https://earning-desire.ct.ws" 

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# --- CORS (Allow your website to talk to this backend) ---
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# --- BOT COMMANDS ---
@bot.message_handler(commands=['start'])
def start_command(message):
    try:
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        bot.reply_to(message, "Click below to open the app:", reply_markup=markup)
    except Exception as e:
        print(f"Error in start: {e}")

# --- API 1: SEND MESSAGE TO ADMIN ---
@app.route('/send_to_admin', methods=['POST'])
def receive_message():
    try:
        data = request.json
        user = data.get('user_name', 'Unknown')
        msg = data.get('message', 'Empty')
        
        bot.send_message(ADMIN_ID, f"📩 **New Message**\nUser: {user}\nText: {msg}", parse_mode="Markdown")
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- API 2: GET PROFILE PHOTO ---
@app.route('/get_user_photo', methods=['POST'])
def get_user_photo():
    try:
        data = request.json
        user_id = data.get('user_id')
        
        # 1. Ask Telegram for the user's photos
        photos = bot.get_user_profile_photos(int(user_id), limit=1)
        
        if photos.total_count > 0:
            # 2. Get file ID
            file_id = photos.photos[0][-1].file_id
            # 3. Get file path
            file_info = bot.get_file(file_id)
            # 4. Construct valid URL
            final_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
            return jsonify({"status": "success", "url": final_url})
        else:
            return jsonify({"status": "no_photo"})
            
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

# --- RUNNER ---
if __name__ == "__main__":
    # Fix conflict errors
    bot.remove_webhook()
    
    # Start Bot
    t = threading.Thread(target=bot.infinity_polling)
    t.daemon = True
    t.start()
    
    # Start Server
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
