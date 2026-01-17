import os
import telebot
import threading
import requests
from flask import Flask, request, jsonify, send_file, make_response
import io

# --- CONFIGURATION ---
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')
WEB_APP_URL = "https://earning-desire.ct.ws"

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# --- HELPER: HANDLE THE HANDSHAKE (CORS) ---
def build_cors_response(data, code=200):
    response = make_response(data, code)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# --- BOT START ---
@app.route('/')
def home():
    return "Bot Online"

@bot.message_handler(commands=['start'])
def start_command(message):
    try:
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        # Send photo directly in chat
        photos = bot.get_user_profile_photos(message.from_user.id, limit=1)
        if photos.total_count > 0:
            photo_id = photos.photos[0][-1].file_id
            bot.send_photo(message.chat.id, photo_id, 
                           caption=f"Hello {message.from_user.first_name}!", reply_markup=markup)
        else:
            bot.reply_to(message, "Hello!", reply_markup=markup)
    except Exception as e:
        print(f"Start Error: {e}")

# --- API 1: SEND MESSAGE (With OPTIONS fix) ---
@app.route('/send_to_admin', methods=['POST', 'OPTIONS'])
def receive_message():
    # 1. Answer the Browser's Security Question
    if request.method == 'OPTIONS':
        return build_cors_response(jsonify({'status': 'ok'}))

    # 2. Process the Message
    try:
        data = request.json
        user = data.get('user_name', 'Unknown')
        msg = data.get('message', '')
        
        bot.send_message(ADMIN_ID, f"📩 **New Website Msg**\n👤 {user}\n📝 {msg}", parse_mode="Markdown")
        return build_cors_response(jsonify({"status": "success"}))
    except Exception as e:
        return build_cors_response(jsonify({"error": str(e)}), 500)

# --- API 2: PHOTO PROXY (With OPTIONS fix) ---
@app.route('/proxy_photo', methods=['GET', 'OPTIONS'])
def proxy_photo():
    if request.method == 'OPTIONS':
        return build_cors_response(jsonify({'status': 'ok'}))

    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return "No ID", 400

        photos = bot.get_user_profile_photos(int(user_id), limit=1)
        if photos.total_count == 0:
            # Redirect to placeholder if no photo
            return requests.get("https://via.placeholder.com/150").content, 200

        file_id = photos.photos[0][-1].file_id
        file_info = bot.get_file(file_id)
        telegram_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"

        # Download and forward
        response = requests.get(telegram_url)
        return send_file(io.BytesIO(response.content), mimetype='image/jpeg')

    except Exception as e:
        return f"Error: {e}", 500

# --- RUNNER ---
if __name__ == "__main__":
    bot.remove_webhook()
    t = threading.Thread(target=bot.infinity_polling)
    t.daemon = True
    t.start()
    
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
