from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions
from tensorflow.keras.preprocessing import image as keras_image
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS
from datetime import datetime
import io

app = FastAPI()

# Allow Expo Web/Mobile to communicate with this API without blocking
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_headers=["*"],
    allow_methods=["*"],
)

# --- SECURITY UTILITY: Metadata Forensic Check ---
def verify_metadata(image_bytes, app_time_str):
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img._getexif()
        
        # 1. Check for presence of Metadata
        if not exif:
            return False, "Security Alert: No Camera Metadata (Possible AI/Screenshot)"

        # Extract human-readable tags
        metadata = {TAGS.get(tag): value for tag, value in exif.items() if tag in TAGS}
        
        # 2. Hardware Signature: Genuine photos have camera Make/Model
        if 'Make' not in metadata and 'Model' not in metadata:
            return False, "Security Alert: Missing Hardware Signature"

        # 3. Liveness Check: Compare button press time vs photo capture time
        img_time_str = metadata.get('DateTimeOriginal') or metadata.get('DateTime')
        if img_time_str and app_time_str:
            # Parse image time (format 'YYYY:MM:DD HH:MM:SS')
            img_time = datetime.strptime(img_time_str, '%Y:%m:%d %H:%M:%S')
            # Parse app time (ISO format)
            app_time = datetime.fromisoformat(app_time_str.replace('Z', ''))
            
            # Reject if the photo was taken more than 10 minutes (600s) before the upload
            time_diff = abs((app_time - img_time).total_seconds())
            if time_diff > 600:
                return False, "Security Alert: Photo is not a live capture (Time Mismatch)"

        return True, "Authenticity Verified"
    except Exception as e:
        # If metadata is unreadable or corrupted, we fail safe by rejecting it
        return False, f"Metadata Error: {str(e)}"

print("Loading AI Model (MobileNetV2)...")
model = MobileNetV2(weights='imagenet')
print("Model Loaded Successfully!")

ECO_KEYWORDS = ["tree", "plant", "pot", "flower", "garden", "earth", "soil", "ashcan", "trash_can", "recycle_bin"]

@app.post("/verify-action")
async def verify_action(
    file: UploadFile = File(...),
    latitude: float = Form(None),
    longitude: float = Form(None),
    device_timestamp: str = Form(None) # New field from React Native
):
    try:
        # 1. Read image contents
        contents = await file.read()

        # 2. --- STEP 2: SECURITY LAYER (Authenticity Verification) ---
        is_authentic, security_msg = verify_metadata(contents, device_timestamp)
        if not is_authentic:
            print(f"--- REJECTED: {security_msg} ---")
            return {
                "status": "rejected",
                "reason": security_msg
            }
        # -------------------------------------------------------------

        # 3. Proceed to AI Classification if security check passes
        img = Image.open(io.BytesIO(contents))
        img = img.resize((224, 224))
        if img.mode != "RGB":
            img = img.convert("RGB")

        img_array = keras_image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)

        # 4. AI Prediction
        predictions = model.predict(img_array)
        results = decode_predictions(predictions, top=5)[0]
        labels = [res[1].lower() for res in results]
        
        print(f"\n--- New AUTHENTIC Image Received ---")
        print(f"AI sees: {labels}")

        matched_keywords = [word for word in ECO_KEYWORDS if any(word in label for label in labels)]

        if matched_keywords:
            highest_confidence = max([float(res[2]) for res in results if any(word in res[1].lower() for word in ECO_KEYWORDS)])
            return {
                "status": "verified",
                "confidence": highest_confidence,
                "labels_detected": labels,
                "location": {"lat": latitude, "lon": longitude}
            }
        else:
            return {
                "status": "rejected",
                "reason": f"No environmental elements detected. AI saw: {', '.join(labels)}"
            }

    except Exception as e:
        print(f"Error during verification: {e}")
        return {"status": "error", "reason": str(e)}