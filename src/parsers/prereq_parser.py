# src/parsers/prereq_parser.py
import re
from typing import Dict, Any, List

def parse_prerequisites(requirements_text: str) -> Dict[str, Any]:
    if not requirements_text:
        return {'required': None, 'excluded': [], 'corequisite': None}
    
    result = {'required': None, 'excluded': [], 'corequisite': None}
    
    # Anti-requisites
    not_for_patterns = [
        r'Not for students who have taken ([\w\s,]+?)(?:\.|$|\n)',
        r'Not for students who have taken ([\w\s,]+?)(?:Prerequisite|Pre-requisite|$)',
    ]
    for pattern in not_for_patterns:
        not_match = re.search(pattern, requirements_text, re.IGNORECASE)
        if not_match:
            excluded_codes = re.findall(r'([A-Z]{4}\d{4})', not_match.group(1))
            result['excluded'].extend(excluded_codes)
    
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
    
    # Handle mixed logic (parentheses with AND)
    paren_groups = re.findall(r'\(([^)]+)\)', prereq_text)
    if paren_groups and re.search(r'\bAND\b', prereq_text, re.IGNORECASE):
        all_groups = []
        for group in paren_groups:
            courses = re.findall(r'([A-Z]{4}\d{4})', group)
            if courses:
                all_groups.append(courses)
        
        remaining = re.sub(r'\([^)]+\)', '', prereq_text)
        remaining_courses = re.findall(r'([A-Z]{4}\d{4})', remaining)
        for course in remaining_courses:
            all_groups.append([course])
        
        if all_groups:
            result['required'] = {'type': 'mixed', 'groups': all_groups}
            return result
    
    # Handle commas as AND logic
    if re.search(r'\bAND\b', prereq_text, re.IGNORECASE) or ',' in prereq_text:
        # Split by AND or comma
        groups = re.split(r'\s+AND\s+|,', prereq_text, flags=re.IGNORECASE)
        all_courses = []
        for group in groups:
            courses = re.findall(r'([A-Z]{4}\d{4})', group)
            all_courses.extend(courses)
        if all_courses:
            result['required'] = {'type': 'all', 'courses': all_courses}
            return result
    
    # OR logic (handles slash notation)
    if re.search(r'\bor\b', prereq_text, re.IGNORECASE) or '/' in prereq_text:
        parts = re.split(r'\s+or\s+|/|\s+and\s+', prereq_text, flags=re.IGNORECASE)
        all_courses = []
        for part in parts:
            courses = re.findall(r'([A-Z]{4}\d{4})', part)
            all_courses.extend(courses)
        if all_courses:
            result['required'] = {'type': 'any', 'courses': all_courses}
            return result
    
    # Single course
    courses = re.findall(r'([A-Z]{4}\d{4})', prereq_text)
    if courses:
        result['required'] = {'type': 'any', 'courses': courses}
        
    return result