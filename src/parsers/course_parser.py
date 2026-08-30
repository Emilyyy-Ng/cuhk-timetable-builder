# src/parsers/course_parser.py
import json
import re
import os
import logging
from typing import List, Dict, Any, Tuple
from src.parsers.prereq_parser import parse_prerequisites

DAY_NUMBER_TO_NAME = {1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun'}
DAY_NAME_TO_INDEX = {'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6}

def time_to_minutes(time_str: str) -> int:
    if not time_str or time_str == 'TBA':
        return -1
    try:
        h, m = map(int, time_str.split(':'))
        return h * 60 + m
    except:
        return -1

def clean_instructor_string(instructor_str: str) -> str:
    if not instructor_str:
        return ''
    cleaned = re.sub(r',\s*\n+', ', ', instructor_str)
    cleaned = re.sub(r'\n+', ', ', cleaned)
    return re.sub(r'\s+', ' ', cleaned).rstrip(', ').strip()

def extract_all_instructors(time_options: List[Dict]) -> List[str]:
    all_instructors = set()
    for opt in time_options:
        for meeting in opt.get('meetings', []):
            instructor = meeting.get('instructor', '')
            if instructor:
                parts = re.split(r'[,\n]+', instructor)
                for part in parts:
                    cleaned = part.strip()
                    if cleaned and cleaned not in ('', 'TBA', 'N/A'):
                        all_instructors.add(cleaned)
    return sorted(list(all_instructors))

def normalize_days(days):
    """
    Convert days to a list of integers.
    Handles: [1, 2, 3], ['1', '2', '3'], ['Mon', 'Tue'], ['TBA'], etc.
    """
    if not days:
        return []
    
    if isinstance(days, int):
        return [days]
    
    if not isinstance(days, list):
        return []
    
    result = []
    for d in days:
        # Handle string values
        if isinstance(d, str):
            d_clean = d.strip()
            # Check if it's a day name (Mon, Tue, etc.)
            if d_clean in DAY_NAME_TO_INDEX:
                # Convert day name to number (1-7)
                for num, name in DAY_NUMBER_TO_NAME.items():
                    if name == d_clean:
                        result.append(num)
                        break
            elif d_clean.isdigit():
                result.append(int(d_clean))
            elif d_clean.upper() == 'TBA':
                result.append(-1)
            else:
                # Try to parse as day name from string
                day_name_match = re.match(r'([A-Za-z]{3})', d_clean)
                if day_name_match:
                    day_abbr = day_name_match.group(1).capitalize()
                    if day_abbr in DAY_NAME_TO_INDEX:
                        for num, name in DAY_NUMBER_TO_NAME.items():
                            if name == day_abbr:
                                result.append(num)
                                break
                    else:
                        result.append(-1)
                else:
                    result.append(-1)
        elif isinstance(d, int):
            result.append(d)
        else:
            result.append(-1)
    
    return result

def parse_course_sessions(term_data: Dict, term: str) -> Tuple[List[Dict], bool]:
    sections = {}
    all_raw_sessions = []
    
    for session_name, session_details in term_data.items():
        # Skip if session_details is not a dict or doesn't have 'days'
        if not isinstance(session_details, dict):
            continue
            
        # Check if 'days' exists
        if 'days' not in session_details:
            continue
            
        # Normalize days
        raw_days = session_details.get('days', [])
        days = normalize_days(raw_days)
        
        # Skip if days is empty
        if not days:
            continue
            
        all_raw_sessions.append((session_name, session_details))
        clean_name = session_name.strip('-').strip()

        comp_type = 'OTHER'
        for t in ['LEC', 'CLW', 'TUT', 'LAB', 'PRJ']:
            if t in clean_name.upper():
                comp_type = t
                break
        
        section_letter = None
        
        # Extract section prefix properly to support 2-letter postgrad sections (CA, CB)
        section_match = re.match(r'([A-Za-z]+)', clean_name)
        if section_match:
            section_letter = section_match.group(1).upper()
            
            # If the section letter is just the component type (e.g., 'LEC', 'TUT', 'LAB'),
            # it means no explicit section letter was provided. Default to 'A'.
            if section_letter == comp_type.upper():
                section_letter = 'A'
            # If it's a generic tutorial/lab ID like T01, L01 (no section letter prefix)
            elif comp_type in ('TUT', 'LAB', 'CLW', 'PRJ') and re.match(rf'^{comp_type[0]}\d', clean_name):
                section_letter = 'A'
            # For tutorials/labs/clws with section prefix (e.g., AT01-TUT, CAT01-LAB)
            elif comp_type in ('TUT', 'LAB', 'CLW', 'PRJ') and len(section_letter) > 1:
                comp_first_letter = comp_type[0]  # 'T', 'L', 'C', 'P'
                if section_letter[-1] == comp_first_letter:
                    section_letter = section_letter[:-1]
        
        if not section_letter:
            if comp_type in ('LEC', 'CLW'):
                section_letter = 'A'
            else:
                # Fallback if no letters found at all
                generic_match = re.match(r'([A-Za-z])', clean_name)
                if generic_match:
                    section_letter = generic_match.group(1).upper()
                else:
                    section_letter = 'A'
                    comp_type = 'OTHER'

            
        if section_letter not in sections:
            sections[section_letter] = {'LEC': [], 'TUT': [], 'LAB': [], 'PRJ': [], 'CLW': [], 'OTHER': []}
        
        start_times = session_details.get('startTimes', [])
        end_times = session_details.get('endTimes', [])
        locations = session_details.get('locations', [''] * len(start_times))
        instructors = session_details.get('instructors', [''] * len(start_times))
        
        meetings = []
        for i in range(len(start_times)):
            if i >= len(days): 
                break
                
            day_num = days[i]
            
            # Handle case where day_num is -1 (TBA)
            if day_num == -1:
                day_name = 'TBA'
                day_index = -1
            else:
                try:
                    day_num_int = int(day_num)
                    day_name = DAY_NUMBER_TO_NAME.get(day_num_int, 'Unknown')
                    day_index = DAY_NAME_TO_INDEX.get(day_name, -1)
                except (ValueError, TypeError):
                    day_name = 'TBA'
                    day_index = -1
            
            start_min = time_to_minutes(start_times[i]) if i < len(start_times) else -1
            end_min = time_to_minutes(end_times[i]) if i < len(end_times) else -1
            
            meetings.append({
                'day': day_index,
                'day_name': day_name,
                'start': start_times[i] if i < len(start_times) else 'TBA',
                'end': end_times[i] if i < len(end_times) else 'TBA',
                'start_minutes': start_min,
                'end_minutes': end_min,
                'type': comp_type,
                'location': locations[i] if i < len(locations) else '',
                'instructor': clean_instructor_string(instructors[i]) if i < len(instructors) else '',
                'is_tba': (start_times[i] == 'TBA' if i < len(start_times) else True) or start_min == -1 or day_name == 'Unknown',
                'session_code': session_name.strip('-').strip()
            })
        
        # Append meetings directly
        sections[section_letter][comp_type].extend(meetings)
    
    time_options = []
    has_tba_warning = False

    for section_letter, components in sections.items():
        section_meetings = []
        section_has_tba = False
        tba_session_codes = []
        
        # Collect all meetings, separating scheduled from TBA
        for comp_type in ['LEC', 'CLW', 'TUT', 'LAB', 'PRJ', 'OTHER']:
            for m in components[comp_type]:
                if m.get('is_tba', False):
                    section_has_tba = True
                    tba_session_codes.append(m.get('session_code', ''))
                    # Include TBA meetings in the list so the frontend can display them
                    section_meetings.append(m)
                else:
                    section_meetings.append(m)
        
        if section_has_tba:
            has_tba_warning = True
        
        if section_meetings:
            # We have at least one meeting - add this section
            time_options.append({
                'section': section_letter,
                'section_name': section_letter,
                'tutorial_id': None,
                'meetings': section_meetings,
                # Store TBA session info for display purposes
                'tba_components': tba_session_codes if tba_session_codes else None
            })
        # If no scheduled meetings, the section is fully TBA
        # The "Keep fully TBA courses" block at the end handles this case

    # Keep fully TBA courses (courses where ALL sections are fully TBA)
    if not time_options and has_tba_warning:
        all_tba_meetings = []
        for session_name, session_details in all_raw_sessions:
            try:
                raw_days = session_details.get('days', [])
                days = normalize_days(raw_days)
                start_times = session_details.get('startTimes', [])
                end_times = session_details.get('endTimes', [])
                locations = session_details.get('locations', [''] * len(start_times))
                instructors = session_details.get('instructors', [''] * len(start_times))
                
                for i in range(len(start_times)):
                    if i >= len(days): break
                    all_tba_meetings.append({
                        'day': -1, 'day_name': 'TBA',
                        'start': 'TBA', 'end': 'TBA',
                        'start_minutes': -1, 'end_minutes': -1,
                        'type': 'OTHER',
                        'location': locations[i] if i < len(locations) else '',
                        'instructor': instructors[i] if i < len(instructors) else '',
                        'is_tba': True,
                        'session_code': session_name.strip('-').strip()
                    })
            except Exception as e:
                continue
                
        if all_tba_meetings:
            time_options.append({
                'section': 'TBA', 'section_name': 'TBA',
                'tutorial_id': None, 'meetings': all_tba_meetings,
                'is_fully_tba': True
            })

    return time_options, has_tba_warning

def parse_courses(json_path: str, target_term: str) -> List[Dict[str, Any]]:
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            raw_courses = json.load(f)
    except Exception as e:
        logging.error(f"Failed to parse {json_path}: {e}")
        return []

    department = os.path.splitext(os.path.basename(json_path))[0]
    parsed = []
    
    # Track statistics
    total_courses = len(raw_courses)
    parsed_count = 0
    failed_courses = []
    
    for idx, course in enumerate(raw_courses):
        try:
            raw_code = course.get('code', '').strip('()')
            title = course.get('title', '').split('\n')[0].strip()
            
            if 'terms' not in course or not course['terms']:
                failed_courses.append((raw_code, "No terms field"))
                continue
            
            # Ensure terms is a dictionary
            if not isinstance(course['terms'], dict):
                failed_courses.append((raw_code, f"terms is {type(course['terms']).__name__}"))
                continue
                
            terms = list(course['terms'].keys())
            
            # If target term is specified, try to find it
            if target_term:
                # First try exact match
                if target_term in terms:
                    term_to_use = target_term
                else:
                    # Try to find a term that contains the target term
                    matching_terms = [t for t in terms if target_term in t]
                    if matching_terms:
                        term_to_use = matching_terms[0]
                    else:
                        # If no match, skip this course
                        failed_courses.append((raw_code, f"Target term '{target_term}' not found. Available: {terms}"))
                        continue
            else:
                term_to_use = terms[0]
                
            term_data = course['terms'][term_to_use]
            
            # Skip if term_data is not a dict
            if not isinstance(term_data, dict):
                failed_courses.append((raw_code, f"term_data is {type(term_data).__name__}"))
                continue
                
            time_options, has_tba = parse_course_sessions(term_data, term_to_use)
            
            # If no time_options, the course has no valid sessions
            if not time_options:
                failed_courses.append((raw_code, "No valid sessions found"))
                continue
                
            requirements_text = course.get('requirements', '')
            prereq_info = parse_prerequisites(requirements_text)
            
            units_str = str(course.get('units', '3.00'))
            units = float(re.sub(r'[^\d.]', '', units_str) or '3.0')
            
            full_code = f"{department}{raw_code}" if raw_code.isdigit() else f"{department}_{raw_code}"
            letters = ''.join(c for c in full_code if c.isalpha())
            digits = ''.join(c for c in full_code if c.isdigit())
            if len(digits) == 4:
                full_code = letters[:4] + digits
                
            parsed.append({
                'code': raw_code, 'full_code': full_code, 'title': title,
                'department': department, 'career': course.get('career', 'Undergraduate'),
                'units': units, 'grading': course.get('grading', ''),
                'components': course.get('components', ''), 'campus': course.get('campus', ''),
                'academic_group': course.get('academic_group', ''),
                'description': course.get('description', 'No description available.'),
                'prerequisites': prereq_info.get('required'),
                'excluded_courses': prereq_info.get('excluded', []),
                'corequisite': prereq_info.get('corequisite'),
                'requirements_raw': requirements_text,
                'time_options': time_options, 'has_tba_warning': has_tba,
                'term': term_to_use, 'raw_term': term_to_use,
                'required_readings': course.get('required_readings', ''),
                'recommended_readings': course.get('recommended_readings', ''),
                'syllabus': course.get('syllabus', ''), 'outcome': course.get('outcome', ''),
                'assessments': course.get('assessments', {}),
                'all_instructors': extract_all_instructors(time_options),
            })
            parsed_count += 1
            
        except Exception as e:
            raw_code = course.get('code', 'unknown')
            failed_courses.append((raw_code, f"Unexpected error: {str(e)}"))
            continue
    
    # Log summary
    logging.info(f"Parsed {parsed_count}/{total_courses} courses from {json_path}")
    if failed_courses and len(failed_courses) <= 10:
        for code, reason in failed_courses:
            logging.debug(f"  - {code}: {reason}")
            
    return parsed