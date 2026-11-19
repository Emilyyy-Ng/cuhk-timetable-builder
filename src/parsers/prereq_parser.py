# src/parsers/prereq_parser.py
import re
from typing import Dict, Any, List, Optional

COURSE_TOKEN_RE = re.compile(r'\b([A-Z]{4})\s*(\d{4})\b|\b(\d{4})\b')


def _extract_codes(text: str, state: Dict[str, Optional[str]]) -> List[str]:
    """
    Extract normalized course codes like 'CSCI1550' from text, carrying forward
    the last seen 4-letter subject code when a bare 4-digit number appears.
    """
    codes: List[str] = []
    for subj, full_num, bare_num in COURSE_TOKEN_RE.findall(text):
        if subj and full_num:
            state['subject'] = subj.upper()
            codes.append(f"{state['subject']}{full_num}")
        elif bare_num and state.get('subject'):
            codes.append(f"{state['subject']}{bare_num}")
    return codes


def parse_prerequisites(requirements_text: str) -> Dict[str, Any]:
    if not requirements_text:
        return {'required': None, 'excluded': [], 'corequisite': None}

    result = {'required': None, 'excluded': [], 'corequisite': None}

    # Anti-requisites
    not_for_patterns = [
        r'Not for students who have taken ([\w\s,]+?)(?:\.|$|\n)',
        r'Not for students who have taken ([\w\s,]+?)(?:Prerequisite|Pre-requisite|$)',
    ]
    excl_state: Dict[str, Optional[str]] = {'subject': None}
    for pattern in not_for_patterns:
        not_match = re.search(pattern, requirements_text, re.IGNORECASE)
        if not_match:
            excluded_codes = _extract_codes(not_match.group(1), excl_state)
            for code in excluded_codes:
                if code not in result['excluded']:
                    result['excluded'].append(code)

    # Extract prerequisite section
    prereq_patterns = [
        r'(?:Pre-)?requisite/Co-requisite:?\s*(.+?)(?:\.|\n|Not for|$)',
        r'(?:Pre-)?requisite:?\s*(.+?)(?:\.|\n|Not for|$)',
    ]
    prereq_text = None
    for pattern in prereq_patterns:
        match = re.search(pattern, requirements_text, re.IGNORECASE)
        if match:
            prereq_text = match.group(1).strip()
            break

    if not prereq_text:
        return result

    state: Dict[str, Optional[str]] = {'subject': None}

    # Handle mixed logic (parentheses with AND)
    paren_groups = re.findall(r'\(([^)]+)\)', prereq_text)
    if paren_groups and re.search(r'\bAND\b', prereq_text, re.IGNORECASE):
        all_groups = []
        for group in paren_groups:
            courses = _extract_codes(group, state)
            if courses:
                all_groups.append(courses)

        remaining = re.sub(r'\([^)]+\)', '', prereq_text)
        remaining_courses = _extract_codes(remaining, state)
        for course in remaining_courses:
            all_groups.append([course])

        if all_groups:
            result['required'] = {'type': 'mixed', 'groups': all_groups}
            return result

    # Handle commas as AND logic
    if re.search(r'\bAND\b', prereq_text, re.IGNORECASE) or ',' in prereq_text:
        groups = re.split(r'\s+AND\s+|,', prereq_text, flags=re.IGNORECASE)
        all_courses = []
        for group in groups:
            courses = _extract_codes(group, state)
            all_courses.extend(courses)
        if all_courses:
            result['required'] = {'type': 'all', 'courses': all_courses}
            return result

    # OR logic (handles slash notation)
    if re.search(r'\bor\b', prereq_text, re.IGNORECASE) or '/' in prereq_text:
        parts = re.split(r'\s+or\s+|/|\s+and\s+', prereq_text, flags=re.IGNORECASE)
        all_courses = []
        for part in parts:
            courses = _extract_codes(part, state)
            all_courses.extend(courses)
        if all_courses:
            result['required'] = {'type': 'any', 'courses': all_courses}
            return result

    # Single course
    courses = _extract_codes(prereq_text, state)
    if courses:
        result['required'] = {'type': 'any', 'courses': courses}

    return result