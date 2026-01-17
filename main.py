import os
import telebot
import threading
import requests
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- CONFIGURATION ---
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')
WEB_APP_URL = "https://earning-desire.ct.ws"

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# --- ENABLE CORS (THE CONNECTION FIX) ---
# This line automatically handles all "OPTIONS" checks and security headers.
# It allows your InfinityFree site to talk to Railway.
CORS(app, resources={r"/*": {"origins": "*"}}) 

# --- BOT START ---
@bot.message_handler(commands=['start'])
def start_command(message):
    try:
        # Create button
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        # Send simple welcome
        bot.send_message(
            message.chat.id, 
            "👋 **Welcome!**\nClick the button below to open your profile.", 
            reply_markup=markup, 
            parse_mode="Markdown"
        )
    except Exception as e:
        print(f"Start Error: {e}")

# --- API 1: SEND MESSAGE ---
@app.route('/send_to_admin', methods=['POST'])
def receive_message():
    try:
        data = request.json
        user = data.get('user_name', 'Unknown')
        msg = data.get('message', '')
        
        bot.send_message(ADMIN_ID, f"📩 **Website Message**\n👤 {user}\n📝 {msg}")
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- API 2: BASE64 PHOTO (THE NEW METHOD) ---
@app.route('/get_photo_base64', methods=['POST'])
def get_photo_base64():
    try:
        data = request.json
        user_id = data.get('user_id')
        
        # 1. Get Photo Info from Telegram
        photos = bot.get_user_profile_photos(int(user_id), limit=1)
        
        if photos.total_count == 0:
            return jsonify({"status": "no_photo"})

        # 2. Get the file path
        file_id = photos.photos[0][0].file_id # Use small version [0] for speed
        file_info = bot.get_file(file_id)
        url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
        
        # 3. Download and Convert to Base64 Text
        response = requests.get(url)
        if response.status_code == 200:
            # Convert binary image data to text string
            base64_img = base64.b64encode(response.content).decode('utf-8')
            return jsonify({
                "status": "success", 
                "image_data": f"data:image/jpeg;base64,{base64_img}"
            })
            
        return jsonify({"status": "failed_download"})

    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

# --- RUNNER ---
@app.route('/')
def index():
    return "Bot Online"

if __name__ == "__main__":
    bot.remove_webhook()
    t = threading.Thread(target=bot.infinity_polling)
    t.daemon = True
    t.start()
    
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
