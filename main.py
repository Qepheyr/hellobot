import os
import telebot
import threading
import requests
from flask import Flask, request, jsonify, send_file
import io

# --- CONFIGURATION ---
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')
WEB_APP_URL = "https://earning-desire.ct.ws"

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# --- CORS (Allow website connection) ---
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# --- BOT START COMMAND ---
@app.route('/')
def home():
    return "Bot Online"

@bot.message_handler(commands=['start'])
def start_command(message):
    try:
        user_id = message.from_user.id
        first_name = message.from_user.first_name
        
        # Create Button
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        # Send Photo directly in Chat
        photos = bot.get_user_profile_photos(user_id, limit=1)
        if photos.total_count > 0:
            photo_id = photos.photos[0][-1].file_id
            bot.send_photo(message.chat.id, photo_id, 
                           caption=f"Hello {first_name}!", reply_markup=markup)
        else:
            bot.reply_to(message, f"Hello {first_name}!", reply_markup=markup)
            
    except Exception as e:
        print(f"Error: {e}")

# --- API 1: SEND MESSAGE TO ADMIN ---
@app.route('/send_to_admin', methods=['POST'])
def receive_message():
    try:
        data = request.json
        user_name = data.get('user_name', 'Unknown')
        user_id = data.get('user_id', 'Unknown')
        msg = data.get('message', '')
        
        bot.send_message(ADMIN_ID, f"📩 **New Website Msg**\n👤 {user_name} (`{user_id}`)\n📝 {msg}", parse_mode="Markdown")
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- API 2: PROFILE PICTURE PROXY (THE FIX) ---
@app.route('/proxy_photo')
def proxy_photo():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return "No user_id", 400

        # 1. Get File Path from Telegram
        photos = bot.get_user_profile_photos(int(user_id), limit=1)
        if photos.total_count == 0:
            # Return a default placeholder if no photo
            return requests.get("https://via.placeholder.com/150").content, 200, {'Content-Type': 'image/png'}

        file_id = photos.photos[0][-1].file_id
        file_info = bot.get_file(file_id)
        telegram_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"

        # 2. Download the image from Telegram
        response = requests.get(telegram_url)
        
        # 3. Serve it as a file
        return send_file(io.BytesIO(response.content), mimetype='image/jpeg')

    except Exception as e:
        print(f"Photo Error: {e}")
        return "Error", 500

# --- RUNNER ---
if __name__ == "__main__":
    bot.remove_webhook()
    
    # Start Bot Thread
    t = threading.Thread(target=bot.infinity_polling)
    t.daemon = True
    t.start()
    
    # Start Flask Server
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
