from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
# from openai import OpenAI
import shutil
import os
import tempfile
import re
from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional
import json
import logging
from faster_whisper import WhisperModel

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://lect-audio-explorer-3yy8bni6i-tejaswinis-projects-252f8206.vercel.app",
        "https://lect-audio-explorer.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client - we'll use mock data for simplicity
api_key = None
client = None
logger.warning("Using mock data for testing without OpenAI API key.")

# Load the model once at startup (choose 'base', 'small', 'medium', or 'large')
model = WhisperModel("base", device="cpu", compute_type="int8")

# Create rich mock data for better testing
def create_mock_segments(duration=300):
    """
    Create realistic mock transcript segments for an audio lecture
    with a specified duration (in seconds)
    """
    segments = []
    segment_length = 15  # seconds per segment
    
    # Create sample lecture topics with time-aligned segments
    lecture_content = [
        "Welcome to this lecture on artificial intelligence. Today we'll be exploring the fundamentals of machine learning and its applications.",
        "Let's start by defining AI. Artificial intelligence is the simulation of human intelligence processes by machines, especially computer systems.",
        "Machine learning is a subset of AI that focuses on the development of algorithms that can learn from and make predictions on data.",
        "There are several types of machine learning: supervised learning, unsupervised learning, and reinforcement learning.",
        "In supervised learning, algorithms are trained using labeled data. The algorithm learns to map inputs to outputs based on example input-output pairs.",
        "Unsupervised learning uses unlabeled data. The algorithm tries to learn the patterns and structure from the data without explicit guidance.",
        "Reinforcement learning involves an agent learning to make decisions by taking actions in an environment to maximize some notion of reward.",
        "Let's discuss some applications of AI in the real world. One major application is in healthcare, where AI systems can help diagnose diseases.",
        "Natural language processing is another important field that allows computers to understand and generate human language.",
        "Computer vision enables machines to interpret and make decisions based on visual data from the world around them.",
        "Self-driving cars combine many AI technologies including computer vision, sensor fusion, and decision-making algorithms.",
        "AI ethics is a critical consideration as these technologies become more prevalent in society.",
        "Questions about privacy, bias, and the impact of automation on employment are important ethical considerations.",
        "In conclusion, AI and machine learning are rapidly evolving fields with tremendous potential to transform many aspects of our lives.",
        "For next week, please read the assigned papers on neural networks and be prepared to discuss them in class."
    ]
    
    start_time = 0
    for i, content in enumerate(lecture_content):
        end_time = start_time + segment_length
        segments.append({
            "id": i,
            "start": start_time,
            "end": end_time,
            "text": content
        })
        start_time = end_time
    
    return segments

@app.post("/transcribe/")
async def transcribe(file: UploadFile = File(...)):
    logger.info(f"Received file for transcription: {file.filename}")

    # Save the uploaded file to a temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    # Transcribe using faster-whisper
    segments, info = model.transcribe(tmp_path, beam_size=5)
    transcript_segments = []
    full_text = ""
    for i, segment in enumerate(segments):
        transcript_segments.append({
            "id": i,
            "start": segment.start,
            "end": segment.end,
            "text": segment.text
        })
        full_text += segment.text + " "

    # Clean up temp file
    os.remove(tmp_path)

    return {"text": full_text.strip(), "segments": transcript_segments}

class TextRequest(BaseModel):
    text: str

@app.post("/extract-topics/")
async def extract_topics(request: TextRequest):
    logger.info(f"Extracting topics from text of length: {len(request.text)}")
    
    # Create mock topics with proper time ranges to match our mock segments
    mock_topics = [
        {
            "topic": "Introduction to AI",
            "description": "Overview of artificial intelligence and the scope of the lecture",
            "start": 0,
            "end": 45
        },
        {
            "topic": "Machine Learning Fundamentals",
            "description": "Explanation of different types of machine learning approaches",
            "start": 46,
            "end": 120
        },
        {
            "topic": "Real-world Applications",
            "description": "Discussion of AI applications in various industries",
            "start": 121,
            "end": 195
        },
        {
            "topic": "Ethics and Future Considerations",
            "description": "Examination of ethical issues and future developments in AI",
            "start": 196,
            "end": 300
        }
    ]
    
    # Simulate processing delay
    import time
    time.sleep(1)  # Simulate 1-second processing time
    
    return {"topics": mock_topics}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
