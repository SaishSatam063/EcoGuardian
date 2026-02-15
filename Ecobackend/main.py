from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions
from tensorflow.keras.preprocessing import image as keras_image
import numpy as np
from PIL import Image
import io

app = FastAPI()

# Allow Expo Web/Mobile to communicate with this API without blocking
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading AI Model (This might take a few seconds on startup)...")
# MobileNetV2 is a pre-trained model capable of recognizing 1000 common objects
model = MobileNetV2(weights='imagenet')
print("Model Loaded Successfully!")

# These are the keywords the AI will look for to verify an "Eco" action.
# You can expand this list (e.g., adding "trash_can", "bottle" for waste segregation)
ECO_KEYWORDS = ["tree", "plant", "pot", "flower", "garden", "earth", "soil", "ashcan", "trash_can", "recycle_bin"]

@app.post("/verify-action")
async def verify_action(
    file: UploadFile = File(...),
    latitude: float = Form(None), # Receives the GPS data from your React Native app
    longitude: float = Form(None)
):
    try:
        # 1. Read the uploaded image from the React Native app
        contents = await file.read()
        img = Image.open(io.BytesIO(contents))

        # 2. Preprocess the image for the AI (MobileNet requires exact 224x224 size)
        img = img.resize((224, 224))
        
        # Convert to RGB (in case the user uploads a PNG with a transparent background)
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Convert image to a mathematical array
        img_array = keras_image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)

        # 3. Make the Prediction!
        predictions = model.predict(img_array)
        results = decode_predictions(predictions, top=5)[0]  # Get the top 5 guesses

        # 4. Check if the AI's guesses match our ECO_KEYWORDS
        labels = [res[1].lower() for res in results]
        
        # Print to your terminal so you can see exactly what the AI thinks it's looking at
        print(f"\n--- New Image Received ---")
        print(f"AI sees: {labels}") 
        if latitude and longitude:
            print(f"Location: Lat {latitude}, Lon {longitude}")

        # Check for overlaps between what the AI saw and what we accept
        matched_keywords = [word for word in ECO_KEYWORDS if any(word in label for label in labels)]

        if matched_keywords:
            # Find the highest confidence score of the matched eco-items
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