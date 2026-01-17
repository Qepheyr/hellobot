import os
import telebot
import threading
from flask import Flask, request, jsonify, make_response

# --- CONFIGURATION ---
BOT_TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')
WEB_APP_URL = "https://earning-desire.ct.ws"

bot = telebot.TeleBot(BOT_TOKEN)
app = Flask(__name__)

# --- CORS FIX (The "Network Error" Solver) ---
# This function handles the "Pre-flight" check browsers make
def build_cors_response(data, code=200):
    response = make_response(jsonify(data), code)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# --- BOT: START COMMAND (Sends Photo + Button) ---
@bot.message_handler(commands=['start'])
def start_command(message):
    try:
        user_id = message.from_user.id
        first_name = message.from_user.first_name
        
        # 1. Create the Button
        markup = telebot.types.InlineKeyboardMarkup()
        web_app = telebot.types.WebAppInfo(url=WEB_APP_URL)
        markup.add(telebot.types.InlineKeyboardButton("🚀 Open Mini App", web_app=web_app))
        
        caption_text = f"Hello {first_name}!\nClick below to open your profile:"

        # 2. Get User Profile Photo
        photos = bot.get_user_profile_photos(user_id, limit=1)
        
        if photos.total_count > 0:
            # Send Photo with Caption and Button
            # We use photos.photos[0][-1].file_id to get the best quality
            photo_id = photos.photos[0][-1].file_id
            bot.send_photo(message.chat.id, photo_id, caption=caption_text, reply_markup=markup)
        else:
            # No photo? Just send text
            bot.reply_to(message, caption_text, reply_markup=markup)
            
    except Exception as e:
        print(f"Error in start: {e}")

# --- API: SEND MESSAGE (With OPTIONS fix) ---
@app.route('/send_to_admin', methods=['POST', 'OPTIONS'])
def receive_message():
    # Handle the Browser "Pre-flight" check
    if request.method == 'OPTIONS':
        return build_cors_response({'status': 'ok'})

    try:
        data = request.json
        user = data.get('user_name', 'Unknown')
        msg = data.get('message', 'Empty')
        
        bot.send_message(ADMIN_ID, f"📩 **New Message**\nUser: {user}\nText: {msg}", parse_mode="Markdown")
        return build_cors_response({"status": "success"})
    except Exception as e:
        return build_cors_response({"error": str(e)}, 500)

# --- API: GET PHOTO (With OPTIONS fix) ---
@app.route('/get_user_photo', methods=['POST', 'OPTIONS'])
def get_user_photo():
    if request.method == 'OPTIONS':
        return build_cors_response({'status': 'ok'})

    try:
        data = request.json
        # Convert to int immediately to prevent errors
        user_id = int(data.get('user_id'))
        
        photos = bot.get_user_profile_photos(user_id, limit=1)
        
        if photos.total_count > 0:
            file_id = photos.photos[0][-1].file_id
            file_info = bot.get_file(file_id)
            final_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
            return build_cors_response({"status": "success", "url": final_url})
        else:
            return build_cors_response({"status": "no_photo"})
            
    except Exception as e:
        return build_cors_response({"status": "error", "error": str(e)}, 500)

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
