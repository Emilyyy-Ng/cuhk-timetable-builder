# src/builder/constraints.py
from typing import Dict, Set, Tuple, List

def can_take_course(course: Dict, completed_courses: Set[str], currently_taking: Set[str]) -> Tuple[bool, str]:
    if completed_courses is None: completed_courses = set()
    if currently_taking is None: currently_taking = set()
    
    full_code = course.get('full_code', course.get('code', ''))
    upper_taken = {c.upper() for c in completed_courses}
    upper_taking = {c.upper() for c in currently_taking}
    
    for excluded in course.get('excluded_courses', []):
        if excluded.upper() in upper_taken:
            return False, f"Cannot take {full_code}: already completed equivalent course {excluded}"
        if excluded.upper() in upper_taking:
            return False, f"Cannot take both {full_code} and {excluded} in same term"
    
    prereq = course.get('prerequisites')
    if not prereq:
        return True, ""
        
    # Clean logic flow for mixed vs any/all
    if prereq.get('type') == 'mixed':
        all_available = upper_taken.union(upper_taking)
        for group in prereq['groups']:
            if not any(c.upper() in all_available for c in group):
                return False, f"Need one from each group: {' and '.join(['(' + ' or '.join(g) + ')' for g in prereq['groups']])}"
        return True, ""
        
    if not prereq.get('courses'):
        return True, ""
        
    all_available = upper_taken.union(upper_taking)
    
    if prereq['type'] == 'any':
        if not any(c.upper() in all_available for c in prereq['courses']):
            return False, f"Need one of: {', '.join(prereq['courses'])}"
    
    elif prereq['type'] == 'all':
        missing = [c for c in prereq['courses'] if c.upper() not in all_available]
        if missing:
            return False, f"Need all of: {', '.join(prereq['courses'])} (missing: {', '.join(missing)})"
            
    return True, ""

def filter_eligible_courses(interested_courses: List[Dict], completed_courses: Set[str]) -> Tuple[List[Dict], List[Tuple[str, str]]]:
    eligible = []
    skipped = []
    for course in interested_courses:
        can_take, reason = can_take_course(course, completed_courses, set())
        if can_take:
            eligible.append(course)
        else:
            skipped.append((course['full_code'], reason))
    return eligible, skipped

def meetings_conflict(meetings1: List[Dict], meetings2: List[Dict]) -> bool:
    if not meetings1 or not meetings2: return False
    for m1 in meetings1:
        if m1.get('is_tba'): continue
        for m2 in meetings2:
            if m2.get('is_tba'): continue
            if m1['day'] != m2['day']: continue
            if max(m1['start_minutes'], m2['start_minutes']) < min(m1['end_minutes'], m2['end_minutes']):
                return True
    return False

def check_lunch_conflict(meetings: List[Dict], lunch_start: int, lunch_end: int) -> bool:
    for m in meetings:
        if m.get('is_tba'): continue
        if max(m['start_minutes'], lunch_start) < min(m['end_minutes'], lunch_end):
            return True
    return False