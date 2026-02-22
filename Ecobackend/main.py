from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions
from tensorflow.keras.preprocessing import image as keras_image
import numpy as np
from PIL import Image, ImageDraw
from PIL.ExifTags import TAGS
from datetime import datetime, timedelta
import io
import sqlite3
import imagehash
import qrcode
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_headers=["*"],
    allow_methods=["*"],
)

def init_db():
    conn = sqlite3.connect('eco_guardian.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS reported_issues
                 (issue_id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  user_id TEXT, category TEXT, title TEXT, description TEXT, 
                  severity TEXT, location_text TEXT, latitude REAL, longitude REAL, 
                  image_hash TEXT, status TEXT, timestamp TEXT)''')

    c.execute('''CREATE TABLE IF NOT EXISTS user_rewards
                 (reward_id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  user_id TEXT, issue_id INTEGER, 
                  reward_points INTEGER, timestamp TEXT)''')
                  
    # NEW: Secure Certificate Ledger
    c.execute('''CREATE TABLE IF NOT EXISTS certificates
                 (cert_id TEXT PRIMARY KEY, issue_id INTEGER, user_id TEXT, 
                  category TEXT, timestamp TEXT)''')
    conn.commit()
    conn.close()

init_db()

def verify_metadata(image_bytes, app_time_str):
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img._getexif()
        if not exif: return False, "Security Alert: No Camera Metadata"
        metadata = {TAGS.get(tag): value for tag, value in exif.items() if tag in TAGS}
        img_time_str = metadata.get('DateTimeOriginal') or metadata.get('DateTime')
        if img_time_str and app_time_str:
            img_time = datetime.strptime(img_time_str, '%Y:%m:%d %H:%M:%S')
            app_time = datetime.fromisoformat(app_time_str.replace('Z', ''))
            if abs((app_time - img_time).total_seconds()) > 86400: 
                return False, "Security Alert: Photo is too old"
        return True, "Authenticity Verified"
    except Exception as e:
        return False, f"Metadata Error: {str(e)}"

print("Loading AI Model...")
model = MobileNetV2(weights='imagenet')

AI_RULES = {
    "Plastic & Dry Waste": {"rule_type": "standard", "waste": ["bottle", "plastic", "cup", "carton", "paper", "water_bottle"], "disposal": ["ashcan", "trash_can", "recycle_bin", "bucket"]},
    "E-Waste Drive": {"rule_type": "standard", "waste": ["laptop", "mouse", "keyboard", "monitor", "cellular_telephone", "hard_disc", "ipod"], "disposal": ["carton", "box", "recycle_bin", "ashcan", "trash_can", "desk"]},
    "Organic & Composting": {"rule_type": "standard", "waste": ["banana", "apple", "orange", "fruit", "vegetable", "leaf", "strawberry"], "disposal": ["soil", "pot", "earth", "garden", "planter", "bucket"]},
    "Waste Segregation": {"rule_type": "segregation", "dry_items": ["bottle", "carton", "paper", "box", "cup", "water_bottle"], "wet_items": ["banana", "apple", "soil", "leaf", "orange"], "containers": ["ashcan", "trash_can", "bag", "bucket", "recycle_bin"]},
    "General Cleanup": {"rule_type": "standard", "waste": ["bottle", "can", "litter", "wrapper", "laptop", "banana", "cup"], "disposal": ["ashcan", "trash_can", "recycle_bin", "bag", "bucket"]}
}

@app.post("/submit-report")
async def submit_report(
    file: UploadFile = File(...), user_id: str = Form(...), category: str = Form(...),
    title: str = Form(...), description: str = Form(...), severity: str = Form(None),        
    location: str = Form(None), latitude: float = Form(None), longitude: float = Form(None),     
    device_timestamp: str = Form(None) 
):
    try:
        contents = await file.read()
        is_authentic, security_msg = verify_metadata(contents, device_timestamp)
        if not is_authentic: return {"status": "rejected", "reason": security_msg}

        conn = sqlite3.connect('eco_guardian.db')
        c = conn.cursor()

        today_str = datetime.now().strftime("%Y-%m-%d")
        c.execute("SELECT COUNT(*) FROM user_rewards WHERE user_id=? AND timestamp LIKE ?", (user_id, f"{today_str}%"))
        if c.fetchone()[0] >= 3:
            conn.close()
            return {"status": "rejected", "reason": "Daily limit reached."}

        img_for_db = Image.open(io.BytesIO(contents))
        new_hash = imagehash.average_hash(img_for_db)
        img_fingerprint = str(new_hash)

        three_mins_ago = (datetime.now() - timedelta(minutes=3)).isoformat()
        c.execute("SELECT * FROM reported_issues WHERE user_id=? AND timestamp > ?", (user_id, three_mins_ago))
        if c.fetchone():
            conn.close()
            return {"status": "rejected", "reason": "Spam Prevention: Wait 3 mins."}

        yesterday = (datetime.now() - timedelta(days=1)).isoformat()
        c.execute("SELECT image_hash FROM reported_issues WHERE user_id=? AND timestamp > ?", (user_id, yesterday))
        for (old_hash_str,) in c.fetchall():
            try:
                if new_hash - imagehash.hex_to_hash(old_hash_str) < 12:
                    conn.close()
                    return {"status": "rejected", "reason": "Fraud Alert: Same physical object detected."}
            except: pass

        img = img_for_db.resize((224, 224))
        if img.mode != "RGB": img = img.convert("RGB")
        img_array = preprocess_input(np.expand_dims(keras_image.img_to_array(img), axis=0))
        predictions = model.predict(img_array)
        labels = [res[1].lower() for res in decode_predictions(predictions, top=10)[0]]
        
        active_rule = AI_RULES.get(category, AI_RULES["General Cleanup"])
        if active_rule["rule_type"] == "segregation":
            if not (any(c in label for label in labels for c in active_rule["containers"]) and 
                   (any(d in label for label in labels for d in active_rule["dry_items"]) or 
                    any(w in label for label in labels for w in active_rule["wet_items"]))):
                conn.close()
                return {"status": "rejected", "reason": "Segregation Failed."}
        else:
            if not (any(w in label for label in labels for w in active_rule["waste"]) and 
                    any(d in label for label in labels for d in active_rule["disposal"])):
                conn.close()
                return {"status": "rejected", "reason": f"Verification Failed for {category}."}

        timestamp = datetime.now().isoformat()
        c.execute('''INSERT INTO reported_issues 
                     (user_id, category, title, description, severity, location_text, latitude, longitude, image_hash, status, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
                  (user_id, category, title, description, severity, location, latitude, longitude, img_fingerprint, 'Verified', timestamp))
        issue_id = c.lastrowid 

        c.execute("INSERT INTO user_rewards (user_id, issue_id, reward_points, timestamp) VALUES (?, ?, ?, ?)", (user_id, issue_id, 50, timestamp))
        conn.commit()
        conn.close()

        # FIXED: Now returns the issue_id so the frontend can request the certificate!
        return {"status": "verified", "issue_id": issue_id, "labels": labels}

    except Exception as e:
        return {"status": "error", "reason": str(e)}

@app.post("/verify-action")
async def quick_verify(file: UploadFile = File(...), device_timestamp: str = Form(None)):
    try:
        contents = await file.read()
        is_authentic, security_msg = verify_metadata(contents, device_timestamp)
        if not is_authentic: return {"status": "rejected", "reason": security_msg}

        img = Image.open(io.BytesIO(contents)).resize((224, 224)).convert("RGB")
        img_array = preprocess_input(np.expand_dims(keras_image.img_to_array(img), axis=0))
        predictions = model.predict(img_array)
        top_results = decode_predictions(predictions, top=5)[0]
        labels = [res[1].lower() for res in top_results]
        
        if not any(word in label for label in labels for word in ["tree", "plant", "water", "bottle", "plastic", "trash", "ashcan", "recycle", "soil", "leaf", "laptop", "carton"]):
            return {"status": "rejected", "reason": "No environmental elements detected."}

        return {"status": "verified", "labels_detected": labels, "confidence": float(top_results[0][2])}
    except Exception as e:
        return {"status": "error", "reason": str(e)}


# =====================================================================
# CERTIFICATE GENERATOR (TAMPER-PROOF)
# =====================================================================
@app.get("/certificate/{issue_id}")
async def get_certificate(issue_id: int):
    conn = sqlite3.connect('eco_guardian.db')
    c = conn.cursor()
    c.execute("SELECT user_id, category, timestamp FROM reported_issues WHERE issue_id=?", (issue_id,))
    record = c.fetchone()
    
    if not record:
        conn.close()
        return {"error": "Report not found"}
        
    user_id, category, timestamp = record
    date_str = datetime.fromisoformat(timestamp).strftime("%B %d, %Y")
    
    # Check if certificate already exists, otherwise create a new unique ID
    c.execute("SELECT cert_id FROM certificates WHERE issue_id=?", (issue_id,))
    cert_record = c.fetchone()
    if cert_record:
        cert_id = cert_record[0]
    else:
        cert_id = f"CERT-{uuid.uuid4().hex[:8].upper()}"
        c.execute("INSERT INTO certificates VALUES (?, ?, ?, ?, ?)", (cert_id, issue_id, user_id, category, timestamp))
        conn.commit()
    conn.close()

    # --- DRAW THE CERTIFICATE IMAGE ---
    cert_img = Image.new('RGB', (1000, 700), color=(46, 139, 87)) 
    draw = ImageDraw.Draw(cert_img)
    draw.rectangle([20, 20, 980, 680], outline="white", width=5)
    
    draw.text((100, 100), "CERTIFICATE OF ENVIRONMENTAL IMPACT", fill="white", font_size=40)
    draw.text((100, 200), f"Awarded to: {user_id}", fill="white", font_size=30)
    draw.text((100, 300), f"For verified action: {category}", fill="white", font_size=30)
    draw.text((100, 400), f"Date: {date_str}", fill="white", font_size=25)
    draw.text((100, 500), f"Certificate ID: {cert_id}", fill="yellow", font_size=25)
    
    # --- ADD THE ANTI-FRAUD QR CODE ---
    qr = qrcode.QRCode(box_size=5, border=2)
    # CHANGE THIS IP TO MATCH YOUR LAPTOP'S EXACT IP!
    qr.add_data(f"http://192.168.137.99:8000/verify-cert/{cert_id}") 
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    cert_img.paste(qr_img, (750, 450))
    
    img_byte_arr = io.BytesIO()
    cert_img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    return StreamingResponse(img_byte_arr, media_type="image/png")

# =====================================================================
# QR CODE VERIFIER
# =====================================================================
@app.get("/verify-cert/{cert_id}")
async def verify_certificate(cert_id: str):
    conn = sqlite3.connect('eco_guardian.db')
    c = conn.cursor()
    c.execute("SELECT user_id, category, timestamp FROM certificates WHERE cert_id=?", (cert_id,))
    record = c.fetchone()
    conn.close()
    
    if record:
        return {"status": "VALID", "user": record[0], "action": record[1], "date": record[2]}
    return {"status": "FAKE", "message": "This certificate does not exist in our database."}