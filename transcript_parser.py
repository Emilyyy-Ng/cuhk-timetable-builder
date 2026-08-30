# transcript_parser.py
import re
import os
import io
import logging
from typing import Set  

logger = logging.getLogger(__name__)

MAX_PDF_SIZE_MB = 10
MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024

try:
    from pypdf import PdfReader as PdfReaderClass
except ImportError:
    try:
        from PyPDF2 import PdfReader as PdfReaderClass
    except ImportError:
        try:
            from PyPDF2 import PdfFileReader as PdfReaderClass
        except ImportError:
            raise ImportError(
                "No PDF parsing library found. Install 'pypdf' or 'PyPDF2'."
            )

def parse_transcript_pdf(uploaded_file) -> Set[str]:
    # Check file size BEFORE calling getvalue()
    uploaded_file.seek(0, os.SEEK_END)
    file_size = uploaded_file.tell()
    uploaded_file.seek(0) # Reset pointer

    if file_size > MAX_PDF_SIZE_BYTES:
        raise ValueError(f"Uploaded file exceeds maximum size limit of {MAX_PDF_SIZE_MB}MB")
        
    if file_size == 0:
        raise ValueError("Uploaded file is empty")

    try:
        pdf_reader = PdfReaderClass(io.BytesIO(uploaded_file.getvalue()))
        full_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        course_codes = set()

        # Pattern: Exactly 4 uppercase letters followed by 4 digits
        # This matches CUHK's standard format: XXXX0000
        main_pattern = r'\b([A-Z]{4}\d{4})\b'
        # Split into lines for line-by-line processing
        lines = full_text.split('\n')

        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Skip obvious non-course lines
            skip_phrases = [
                'Course Code', 'Course Title', 'Units Passed', 
                'Term GPA', 'Cumulative GPA', 'Honors / Awards',
                'Cumulative Units'
            ]
            if any(phrase in line for phrase in skip_phrases):
                continue
            
            # Extract course codes
            matches = re.findall(main_pattern, line)
            for match in matches:
                # Validate: must start with letters, not all same letter
                letters = match[:4]
                digits = match[4:]
                if letters.isalpha() and digits.isdigit() and len(digits) == 4:
                    course_codes.add(match)
        
        return course_codes
    
    except Exception as e:
        raise Exception(f"Error parsing PDF: {e}")


def parse_transcript_text(text: str) -> Set[str]:
    if not text:
        return set()
    pattern = r'\b([A-Z]{4}\d{4})\b'
    matches = re.findall(pattern, text.upper())
    return set(matches)
