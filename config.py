# config.py
import os
from typing import Dict, Any
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")
FAVOURITES_FILE = os.path.join(BASE_DIR, "favourites.json")

# Optimizer constraints
DEFAULT_MIN_CREDITS = 9
DEFAULT_MAX_CREDITS = 18
SUMMER_MAX_CREDITS = 6
MAX_MUST_TAKE_COURSES = 6
MAX_OPTIMIZER_COMBINATIONS = 50000

# Beam search - hardcoded optimal values (removed from UI)
DEFAULT_BEAM_WIDTH = 30  # Good balance for up to 200 courses

# Scoring weights
SCORE_WEIGHTS = {1: 100.0, 2: 10.0, 3: 1.0}
GAP_NORMALIZATION_MINUTES = 480.0

# ICS Export
SEMESTER_START_DATES = {
    "Term 1": datetime(2026, 9, 7),
    "Term 2": datetime(2027, 1, 11),
    "Summer": datetime(2027, 5, 17),
}
ICS_WEEK_COUNT = 13

# UI Limits
MAX_DISPLAY_SCHEDULES = 20
MAX_COMPARE_SCHEDULES = 3
MAX_COURSE_TABS = 15
RESULTS_PER_PAGE = 5  # Number of schedules to show per page

# Timetable display settings
TIMETABLE_START_HOUR = 8
TIMETABLE_END_HOUR = 19  # 7:00 PM
TIMETABLE_HOURS = list(range(TIMETABLE_START_HOUR, TIMETABLE_END_HOUR + 1))
DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
DISPLAY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']  # Exclude Sunday by default