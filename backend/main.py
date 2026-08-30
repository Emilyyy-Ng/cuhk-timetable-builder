# backend/main.py
import os
import sys
import io
import glob
import logging
from typing import List, Optional, Dict, Set
from functools import lru_cache
from src.builder.beam_search import beam_search_optimizer

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Allow imports of sibling modules at repo root (config.py, src/, transcript_parser.py)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

logger = logging.getLogger("uvicorn.error")

from config import DATA_DIR
from src.parsers.course_parser import parse_courses
from transcript_parser import parse_transcript_pdf

app = FastAPI(title="CUHK Timetable Optimizer API", version="1.0.0")

# ─────────────────────────── CORS ────────────────────────────
# Configure via env var: comma-separated origins, e.g.
# ALLOWED_ORIGINS="https://cuhk-schedule-builder.netlify.app,http://localhost:5173"
_default_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
]
allowed_origins = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", ",".join(_default_origins)).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,   # we use no cookies; False allows wildcard safely
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class OptimizeRequest(BaseModel):
    term: str
    selected_codes: List[str]
    must_take_codes: List[str] = []
    completed_courses: List[str] = []
    max_credits: int = 18
    min_credits: int = 9
    min_courses: int = 3
    max_courses: int = 8
    beam_width: int = 30
    priorities: Dict[str, int] = {"max_credits": 1, "consecutive_days_off": 2, "minimize_gaps": 3}
    ignore_prereqs: bool = False
    lunch_start: Optional[int] = None
    lunch_end: Optional[int] = None


@lru_cache(maxsize=8)
def load_courses_from_json(term: str):
    """Load + parse all JSON data files for a term, cached per process."""
    json_files = sorted(glob.glob(os.path.join(DATA_DIR, "*.json")))
    all_courses = []
    for filepath in json_files:
        try:
            all_courses.extend(parse_courses(filepath, target_term=term))
        except Exception as e:
            logger.warning("Could not parse %s: %s", filepath, e)
    return all_courses


@app.get("/api/courses")
async def get_courses(term: str = Query(..., description="Target term, e.g., '2026-27 Term 1'")):
    try:
        courses = load_courses_from_json(term)
        if not courses:
            raise HTTPException(status_code=404, detail=f"No course data found for '{term}'.")
        return {"status": "success", "data": courses}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading courses: {str(e)}")


@app.post("/api/optimize")
async def optimize_schedule(req: OptimizeRequest):
    # Add backend validation for safety
    if req.min_credits > req.max_credits:
        raise HTTPException(status_code=400, detail="Min credits cannot exceed max credits.")
    all_courses = load_courses_from_json(req.term)
    interested_courses = [c for c in all_courses if c.get("full_code") in req.selected_codes]

    if not interested_courses:
        raise HTTPException(status_code=404, detail="No matching courses found for selected codes.")

    try:
        results = beam_search_optimizer(
            courses=interested_courses,
            completed_courses=set(req.completed_courses),
            max_credits=req.max_credits,
            min_credits=req.min_credits,
            min_courses=req.min_courses,
            max_courses=req.max_courses,
            beam_width=req.beam_width,
            priority_order=req.priorities,         
            ignore_prereqs=req.ignore_prereqs,
            lunch_start=req.lunch_start,
            lunch_end=req.lunch_end,
            required_courses=set(req.must_take_codes),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Optimization failed")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

    serialized = []
    for score, schedule in results:
        serialized.append({
            "score": score,
            "schedule": [{"course": c, "time_option": t} for c, t in schedule],
        })
    return {"status": "success", "schedules": serialized}


@app.post("/api/upload-transcript")
async def upload_transcript(file: UploadFile = File(...)):
    """Parses a transcript PDF IN MEMORY. Never written to disk."""
    if file.filename is None or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    try:
        contents = await file.read()
        file_obj = io.BytesIO(contents)
        file_obj.getvalue = lambda: contents
        completed: Set[str] = parse_transcript_pdf(file_obj)
        return {"status": "success", "completed_courses": sorted(completed)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("PDF parsing failed")
        raise HTTPException(status_code=500, detail=f"Error parsing PDF: {str(e)}")


@app.get("/")
async def root():
    return {"message": "CUHK Timetable Optimizer API is running."}