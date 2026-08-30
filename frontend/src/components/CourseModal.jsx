// frontend/src/components/CourseModal.jsx

import React, { useEffect, useRef } from 'react';
import { X, XCircle } from 'lucide-react';
import { formatTime } from '../utils/time';
import Button from './ui/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CourseModal Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-overlay-in"
          style={{ backdropFilter: 'blur(5px)' }}
          onClick={this.props.onClose}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="bg-white rounded-xl md:rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 text-center animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-lg md:text-2xl font-bold text-slate-800 mb-2">Unable to Display Course</h2>
            <p className="text-slate-600 mb-5 text-sm md:text-base">There was an error parsing the course data.</p>
            <Button variant="secondary" onClick={this.props.onClose}>Close</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const INTRO_COLON_RE = /^\s*[^\n:]{0,220}?(?::|：)\s*/;

const INTRO_CUE_RE =
  /(after|upon|following|by the end|at the end|on completion|students?|learners?|objectives?|aims?|goals?|outcomes?|able to|expected to|you will)/i;

const stripIntroPhrase = (t) => {
  if (!t) return t;
  const m = t.match(INTRO_COLON_RE);
  if (!m) return t;
  const head = m[0];
  if (INTRO_CUE_RE.test(head) && head.trim().length < 240) {
    return t.slice(head.length);
  }
  return t;
};

const stripLeadingDots = (s) => {
  let out = s;
  while (/^[.][\s]*/.test(out)) {
    out = out.replace(/^[.][\s]*/, '');
  }
  return out;
};

const CourseModal = ({ course, onClose, selectedMeeting }) => {
  const closeButtonRef = useRef(null);

  // Dialog behaviour: Escape closes, focus moves to close button on open,
  // body scroll is locked, and focus is restored to the trigger on close.
  useEffect(() => {
    if (!course) return;
    const previouslyFocused = document.activeElement;
    const focusTimer = setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [course, onClose]);

  if (!course) return null;

  const typeIcons = { 
    LEC: '📚', CLW: '📚', TUT: '📝', LAB: '🔬', PRJ: '📋', 
    SEM: '🎓', TMC: '📖', ASB: '📢', DEB: '🎯', DIS: '💬', 
    EXR: '✏️', FLD: '🌍', IND: '📚', PRA: '🔧', STD: '🎨', 
    VST: '👀', WBL: '💻', WKS: '🔧', OTHER: '📎' 
  };

  const getSessionType = (sessionCode, fallbackType) => {
    if (!sessionCode) return (fallbackType || 'OTHER').toUpperCase();
    if (sessionCode.includes('-')) {
      const parts = sessionCode.split('-');
      const lastPart = parts[parts.length - 1];
      const typeMatch = lastPart.match(/^([A-Z]{3})/i);
      if (typeMatch) return typeMatch[1].toUpperCase();
    }
    const match = sessionCode.match(/([A-Z]{3})/);
    if (match) return match[1].toUpperCase();
    return (fallbackType || 'OTHER').toUpperCase();
  };

  const getTypeDisplayName = (type) => {
    const names = {
      LEC: 'Lectures', CLW: 'Classwork', TUT: 'Interactive Tutorials',
      LAB: 'Laboratories', PRJ: 'Projects', SEM: 'Seminars',
      TMC: 'Thesis Research', ASB: 'Assemblies', DEB: 'Debates',
      DIS: 'Discussions', EXR: 'Exercises', FLD: 'Field Studies',
      IND: 'Independent Study', PRA: 'Practicum', STD: 'Studio',
      VST: 'Visits', WBL: 'Web-enhanced Teaching', WKS: 'Workshops',
      OTHER: 'Other Sessions'
    };
    return names[type] || 'Other Sessions';
  };

  const getSectionLetter = (sessionCode) => {
    if (!sessionCode) return 'Main';
    const dashMatch = sessionCode.match(/^([A-Z]+)-[A-Z]{3}/);
    if (dashMatch) return dashMatch[1];
    const sectionMatch = sessionCode.match(/^([A-Z]+[0-9]+)-/);
    if (sectionMatch) return sectionMatch[1];
    return 'Main';
  };

  const getSectionDisplayName = (sectionLetter) => {
    if (sectionLetter === 'Main' || sectionLetter === 'TBA') 
      return sectionLetter === 'TBA' ? 'TBA (Zoom)' : 'Main Section';
    return `Section ${sectionLetter}`;
  };

  const getMeetingSectionId = (meeting) => {
    if (!meeting) return null;
    return getSectionLetter(meeting.session_code || '');
  };

  const isSectionSelected = (timeOption) => {
    if (!selectedMeeting || !timeOption?.meetings) return false;
    const selectedSection = getMeetingSectionId(selectedMeeting);
    if (!selectedSection) return false;
    return timeOption.meetings.some(m => getMeetingSectionId(m) === selectedSection);
  };

  const isEmptyText = (text) => {
    if (!text) return true;
    const cleaned = text.trim().toLowerCase();
    const emptyPatterns = [
      'n/a', 'nil', '-', 'tba', 'to be assigned', 'to be provided', 
      'to be announced', 'no required textbook', 'no textbook required',
      'there is no textbook', 'lecture notes', 'readings will be recommended',
      'the required readings will be assigned', 'the recommended readings will be suggested',
      'the course instructor will recommend'
    ];
    return emptyPatterns.some(p => cleaned === p || cleaned.startsWith(p));
  };

  const rejoinWrappedLines = (text) => {
    const lines = text.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const prevLine = result[result.length - 1];
      
      if (prevLine) {
        const prevEndsWithUrl = /https?:\/\/[^\s]*$/.test(prevLine) || /www\.[^\s]*$/.test(prevLine);
        const currIsUrlContinuation = /^[^\s]+\.[a-z]{2,}/i.test(trimmed);
        
        const prevEndsWithHyphen = /\w-$/.test(prevLine);
        
        const prevEndsWithDigits = /\d$/.test(prevLine);
        const currStartsWithDigits = /^\d/.test(trimmed);
        
        const prevEndsWithCapital = /[A-Z]$/.test(prevLine);
        const currStartsWithLowercase = /^[a-z]/.test(trimmed);
        
        const currStartsWithPunctuation = /^[,.;:!?)]/.test(trimmed);
        
        const currStartsNewItem = /^\s*[-–—•·▪▸►→]/.test(trimmed) || 
                                   /^\s*\(\d+\)/.test(trimmed) || 
                                   /^\s*\d{1,2}[\.\)、]/.test(trimmed) ||
                                   /^\s*(?:CLO|ILO|L)\d/i.test(trimmed) ||
                                   /^[A-Za-z]+\d+\s*:/i.test(trimmed) ||
                                   /^[.]\s/.test(trimmed);
        
        const prevEndsWithPunctuation = /[.!?;:。；：]$/.test(prevLine);
        
        const shouldJoinForUrl = prevEndsWithUrl && currIsUrlContinuation;
        const shouldJoinForHyphen = prevEndsWithHyphen;
        const shouldJoinForDigits = prevEndsWithDigits && currStartsWithDigits && !currStartsNewItem;
        const shouldJoinForMidWord = prevEndsWithCapital && currStartsWithLowercase && !currStartsNewItem;
        const shouldJoinForDigitPunct = prevEndsWithDigits && currStartsWithPunctuation && !currStartsNewItem;
        const shouldJoinForContinuation = !prevEndsWithPunctuation && !currStartsNewItem && !prevEndsWithUrl;
        
        if (shouldJoinForUrl || shouldJoinForHyphen || shouldJoinForDigits || 
            shouldJoinForMidWord || shouldJoinForDigitPunct || shouldJoinForContinuation) {
          if (prevEndsWithHyphen) {
            result[result.length - 1] = prevLine.replace(/-\s*$/, '') + trimmed;
          } else if (shouldJoinForDigits || shouldJoinForMidWord || shouldJoinForDigitPunct) {
            result[result.length - 1] = prevLine + trimmed;
          } else {
            result[result.length - 1] = prevLine + ' ' + trimmed;
          }
          continue;
        }
      }
      
      result.push(trimmed);
    }
    
    return result.join('\n');
  };

  const insertMissingSeparators = (text) => {
    text = text.replace(/([^\s\n])([A-Za-z]+\d+\s*:)/g, '$1\n$2');
    text = text.replace(/([^\s\n])(\(\d+\))/g, '$1\n$2');
    text = text.replace(/([^\s\n\d])(\d{1,2}\.\s+[A-Z])/g, '$1\n$2');
    text = text.replace(/([^\s\n])(\d+、)/g, '$1\n$2');
    return text;
  };

  const cleanOutcomeFragment = (item) => {
    let cleaned = String(item).trim();
    
    cleaned = cleaned.replace(/^[-–—•·▪▸►→]\s*/, '');
    cleaned = cleaned.replace(/^\(\d+\)\s*/, '');
    cleaned = cleaned.replace(/^\d{1,2}\.\s*/, '');
    cleaned = cleaned.replace(/^(?:CLO|ILO|L)\s*\d+\s*[:.)]?\s*/i, '');
    cleaned = cleaned.replace(/^[A-Za-z]+\d+\s*:\s*/, '');
    cleaned = cleaned.replace(/^[a-z]\)\s*/, '');
    cleaned = stripLeadingDots(cleaned);
    
    if (/^To\s+[a-z]/i.test(cleaned)) {
      cleaned = cleaned.replace(/^To\s+/i, '');
    }
    
    cleaned = cleaned.replace(/[.;,]\s*$/, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned;
  };

  const parseLearningOutcomes = (outcomeText) => {
    if (!outcomeText || isEmptyText(outcomeText)) return [];
    
    try {
      const rawNormalized = outcomeText.replace(/\u00a0/g, ' ');
      const rawPreStripped = stripIntroPhrase(rawNormalized);
      const candidateLines = rawPreStripped
        .split('\n')
        .map(l => stripIntroPhrase(l.trim()))
        .map(l => stripLeadingDots(l))
        .filter(Boolean);
      
      let text = rawNormalized;
      
      text = rejoinWrappedLines(text);
      text = insertMissingSeparators(text);
      text = stripIntroPhrase(text);
      
      const intros = [
        'After completing this course, students should be able to: ',
        'After completing this course, students should be able to ',
        'After completing this course, students will be able to: ',
        'After completing this course, students will be able to ',
        'After completing this course, students are expected to: ',
        'After completing this course, students are expected to ',
        'After taking this course, students are expected to be able to: ',
        'After taking this course, students are expected to be able to ',
        'After taking this course, students will be able to: ',
        'After taking this course, students will be able to ',
        'After taking this course, students should be able to: ',
        'After taking this course, students should be able to ',
        'After taking this course, students can: ',
        'After taking this course, students will: ',
        'At the end of this course, students will be able to: ',
        'At the end of this course, students should be able to: ',
        'Upon successful completion of this course, students will be able to: ',
        'Upon successful completion of this course, students will be able to ',
        'After taking the course, students should: ',
        'The objectives of the course are to: ',
        'Students will: ',
        'Students can: ',
      ];
      
      for (const intro of intros) {
        if (text.startsWith(intro)) {
          text = text.slice(intro.length);
          break;
        }
      }
      
      let items = [];
      
      if (text.includes('(') && /\(\d+\)/.test(text)) {
        const parts = text.split(/\s*\(\d+\)\s*/);
        items = parts.map(p => p.trim()).filter(p => p.length > 5);
      }
      
      if (items.length <= 1 && /^\d{1,2}\./.test(text)) {
        const parts = text.split(/\s*\d{1,2}\.\s*/);
        items = parts.map(p => p.trim()).filter(p => p.length > 5);
      }
      
      if (items.length <= 1 && /(?:CLO|ILO|L)\s*\d/i.test(text)) {
        const parts = text.split(/\s*(?:CLO|ILO|L)\s*\d+\s*[:.)]?\s*/i);
        items = parts.map(p => p.trim()).filter(p => p.length > 5);
      }
      
      if (items.length <= 1 && /^[A-Za-z]+\d+\s*:/im.test(text)) {
        const parts = text.split(/\s*[A-Za-z]+\d+\s*:\s*/);
        items = parts.map(p => p.trim()).filter(p => p.length > 5);
      }
      
      if (items.length <= 1 && /[-–—•·]/.test(text)) {
        const parts = text.split(/\s*[-–—•·]\s+/);
        items = parts.map(p => p.trim()).filter(p => p.length > 5);
      }
      
      if (items.length <= 1) {
        const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 10);
        if (sentences.length > 1) {
          items = sentences.map(s => s.trim());
        } else {
          items = [text.trim()];
        }
      }
      
      if (items.length <= 1 && candidateLines.length >= 2) {
        const lineItems = candidateLines
          .map(l => cleanOutcomeFragment(l))
          .filter(item => {
            if (!item || item.length < 6) return false;
            if (/^(and|or|the|a|an)$/i.test(item)) return false;
            return true;
          });
        if (lineItems.length >= 2) {
          items = lineItems;
        }
      }
      
      const cleanedItems = items.map(item => cleanOutcomeFragment(item)).filter(item => {
        if (!item || item.length < 10) return false;
        if (/^\d+$/.test(item)) return false;
        if (/^(after|upon|at the end|by the end)$/i.test(item)) return false;
        if (/^(and|or|the|a|an)$/i.test(item)) return false;
        return true;
      });
      
      const seen = new Set();
      return cleanedItems.filter(item => {
        const normalized = item.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
      
    } catch (error) {
      console.error('Error parsing learning outcomes:', error);
      return [];
    }
  };

  const parseReadings = (readingsText) => {
    if (!readingsText || isEmptyText(readingsText)) return [];
    
    try {
      let text = readingsText.trim();
      
      text = text.replace(/\u00a0/g, ' ').replace(/[–—]/g, '-');
      
      text = rejoinWrappedLines(text);
      text = insertMissingSeparators(text);
      
      text = text.replace(/\s*[•●▪▸►·]+\s*/g, '\n');
      
      text = text.replace(/^Required\s+Textbook\s*[:：]?\s*/gim, '');
      text = text.replace(/^Recommended\s+Readings?\s*[:：]?\s*/gim, '');
      text = text.replace(/^(?:Textbook|Reference Books?|Main Textbook|Text ?Books?|References?|Supplementary Books?|Useful Links?|Optional Internet Resources|Other References?|Publications)\s*[:：]?\s*/gim, '');
      
      let items = text.split('\n').map(l => l.trim()).filter(Boolean);
      
      const expandedItems = [];
      for (const item of items) {
        const parenNumMatches = item.match(/\(\d+\)/g) || [];
        const isEnumeration = parenNumMatches.length >= 2 && item.indexOf(')') < item.length - 5;
        
        if (isEnumeration) {
          const parts = item.split(/\s*\(\d+\)\s*/);
          expandedItems.push(...parts.map(s => s.trim()).filter(s => s.length > 5));
        } else {
          expandedItems.push(item);
        }
      }
      
      const cleanedItems = expandedItems.map(item => {
        let cleaned = item.trim();
        
        cleaned = stripLeadingDots(cleaned);
        
        cleaned = cleaned.replace(/^\s*\d{1,2}[\.\)、]\s*/, '');
        cleaned = cleaned.replace(/^[-•·]\s*/, '');
        cleaned = cleaned.replace(/^(?:Module|Week|Topic)\s*\d+[\.:]?\s*/i, '');
        cleaned = cleaned.replace(/^L\d+\s*/i, '');
        cleaned = cleaned.replace(/^[A-Za-z]+\d+\s*:\s*/, '');
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        return cleaned;
      }).filter(item => {
        if (!item || item.length < 5) return false;
        if (/^\d+$/.test(item)) return false;
        if (/^(and|or|the|a|an|for|by|in|on|to|with)$/.test(item)) return false;
        if (/^(Module|Week|Topic)\s*\d*$/i.test(item)) return false;
        if (/^TBA$/i.test(item)) return false;
        return true;
      });
      
      const seen = new Set();
      return cleanedItems.filter(item => {
        const normalized = item.toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[.,;:]+$/, '')
          .replace(/^https?:\/\/|www\./i, '');
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
      
    } catch (error) {
      console.error('Error parsing readings:', error);
      return [];
    }
  };

  const formatReadingItem = (item, index) => {
    if (/^https?:\/\//i.test(item) || /^www\./i.test(item)) {
      const url = item.startsWith('www') ? `https://${item}` : item;
      return (
        <li key={index} className="text-sm md:text-base leading-relaxed">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-cuhk-blue hover:underline break-all">
            {item}
          </a>
        </li>
      );
    }
    
    const hasUrl = /https?:\/\/[^\s)]+|www\.[^\s)]+/i.test(item);
    if (hasUrl) {
      const parts = item.split(/(https?:\/\/[^\s)]+|www\.[^\s)]+)/i);
      return (
        <li key={index} className="text-sm md:text-base leading-relaxed">
          {parts.map((part, i) => {
            if (/^https?:\/\//i.test(part) || /^www\./i.test(part)) {
              const url = part.startsWith('www') ? `https://${part}` : part;
              return (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-cuhk-blue hover:underline break-all">
                  {part}
                </a>
              );
            }
            return part;
          })}
        </li>
      );
    }
    
    return <li key={index} className="text-sm md:text-base leading-relaxed">{item}</li>;
  };

  const groupMeetingsByTypeThenSection = () => {
    const timeOptions = course.time_options || [];
    const allMeetingsWithSection = [];
    
    timeOptions.forEach((opt, optIdx) => {
      if (!opt.meetings?.length) return;
      const sectionLetter = opt.section && opt.section !== 'TBA' 
        ? opt.section 
        : getSectionLetter(opt.meetings[0].session_code);
      const isSelected = isSectionSelected(opt);
      
      opt.meetings.forEach(m => {
        allMeetingsWithSection.push({
          ...m,
          sectionLetter,
          sectionName: getSectionDisplayName(sectionLetter),
          isSelected,
          optIdx
        });
      });
    });
    
    const byType = {};
    allMeetingsWithSection.forEach(m => {
      const type = getSessionType(m.session_code, m.type);
      if (!byType[type]) byType[type] = {};
      if (!byType[type][m.sectionLetter]) {
        byType[type][m.sectionLetter] = {
          name: m.sectionName,
          letter: m.sectionLetter,
          isSelected: false,
          meetings: []
        };
      }
      if (m.isSelected) byType[type][m.sectionLetter].isSelected = true;
      byType[type][m.sectionLetter].meetings.push(m);
    });
    
    const result = [];
    const categoryOrder = [
      'LEC', 'SEM', 'TMC', 'CLW', 'TUT', 'LAB', 'PRJ', 
      'ASB', 'DEB', 'DIS', 'EXR', 'FLD', 'IND', 'PRA', 
      'STD', 'VST', 'WBL', 'WKS'
    ];
    
    for (const type of categoryOrder) {
      if (byType[type]) {
        const sections = Object.values(byType[type]).sort((a, b) => {
          if (a.isSelected && !b.isSelected) return -1;
          if (!a.isSelected && b.isSelected) return 1;
          return a.letter.localeCompare(b.letter);
        });
        result.push({ typeName: getTypeDisplayName(type), typeCode: type, sections });
      }
    }
    
    for (const [type, sections] of Object.entries(byType)) {
      if (!categoryOrder.includes(type)) {
        const sectionList = Object.values(sections).sort((a, b) => {
          if (a.isSelected && !b.isSelected) return -1;
          if (!a.isSelected && b.isSelected) return 1;
          return a.letter.localeCompare(b.letter);
        });
        result.push({ typeName: getTypeDisplayName(type), typeCode: type, sections: sectionList });
      }
    }
    
    return result;
  };

  const getAssessmentList = () => {
    if (!course.assessments || typeof course.assessments !== 'object') return [];
    return Object.entries(course.assessments).filter(([k, v]) => k && v);
  };

  const renderMeeting = (m, mIdx) => {
    const type = getSessionType(m.session_code, m.type);
    const isTBA = m.is_tba || m.day_name === 'TBA' || !m.start || m.start === 'TBA';
    
    return (
      <div key={mIdx} className="ml-3 md:ml-4 text-sm md:text-base text-slate-600 mb-1 md:mb-1.5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-0.5 sm:gap-x-1">
          <span className="flex items-center gap-1 md:gap-1.5 shrink-0">
            <span className="text-sm md:text-base">{typeIcons[type] || '📎'}</span>
            <span className="font-mono text-xs md:text-sm bg-slate-100 px-1 md:px-1.5 py-0.5 rounded">{m.session_code || 'N/A'}</span>
          </span>
          {isTBA ? (
            <span className="text-amber-600 font-medium text-sm md:text-base">TBA (Time/Location to be announced)</span>
          ) : (
            <>
              <span className="text-sm md:text-base">{m.day_name} {formatTime(m.start)} - {formatTime(m.end)}</span>
              <span className="hidden sm:inline text-slate-400"> | </span>
              <span className="text-sm md:text-base">{m.location}</span>
              {m.instructor && (
                <>
                  <span className="hidden sm:inline text-slate-400"> | </span>
                  <span className="text-sm md:text-base">{m.instructor}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  let typeGroups = [];
  let outcomes = [];
  let requiredReadings = [];
  let recommendedReadings = [];
  
  try {
    typeGroups = groupMeetingsByTypeThenSection();
    outcomes = parseLearningOutcomes(course.outcome);
    requiredReadings = parseReadings(course.required_readings);
    recommendedReadings = parseReadings(course.recommended_readings);
  } catch (error) {
    console.error('Error processing course data:', error);
  }

  return (
    <ErrorBoundary onClose={onClose}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-4 animate-overlay-in"
        style={{ backdropFilter: 'blur(5px)' }}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-modal-title"
          className="bg-white rounded-xl md:rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto relative p-4 md:p-8 animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close course details"
            className="absolute top-3 right-3 md:top-4 md:right-4 p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 id="course-modal-title" className="text-xl md:text-2xl font-bold text-cuhk-primary-dark mb-1 pr-8">{course.full_code}: {course.title}</h2>
          <p className="text-slate-500 italic mb-3 md:mb-4 text-sm md:text-base">{course.academic_group}</p>

          <div className="flex gap-1.5 md:gap-2 flex-wrap mb-4 md:mb-6">
            <span className="bg-slate-100 px-3 md:px-4 py-0.5 md:py-1 rounded-lg text-sm md:text-base">Career: <strong>{course.career}</strong></span>
            <span className="bg-slate-100 px-3 md:px-4 py-0.5 md:py-1 rounded-lg text-sm md:text-base">Grading: <strong>{course.grading || 'N/A'}</strong></span>
            <span className="bg-slate-100 px-3 md:px-4 py-0.5 md:py-1 rounded-lg text-sm md:text-base">Units: <strong>{course.units}</strong></span>
          </div>

          <hr className="border-slate-200 mb-4 md:mb-6" />

          {course.requirements_raw && course.requirements_raw !== '-' && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Requirements</h3>
              <div className="bg-slate-50 border-l-4 border-cuhk-primary p-3 md:p-4 rounded text-slate-700 whitespace-pre-wrap text-sm md:text-base">
                {course.requirements_raw}
              </div>
            </div>
          )}

          {course.time_options?.length > 0 && (
            <>
              <hr className="border-slate-200 mb-4 md:mb-6" />
              <div className="mb-4 md:mb-6">
                {typeGroups.map((typeGroup, tIdx) => (
                  <div key={tIdx} className="mb-3 md:mb-4">
                    <h4 className="font-semibold text-slate-700 mb-2 md:mb-3 text-sm md:text-base">{typeGroup.typeName}</h4>
                    {typeGroup.sections.map((section, sIdx) => (
                      <div 
                        key={sIdx} 
                        className={`mb-2 ml-1 md:ml-2 border rounded-lg p-2 md:p-3 ${
                          section.isSelected ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                          <h5 className={`text-sm md:text-base font-semibold ${section.isSelected ? 'text-green-800' : 'text-slate-600'}`}>
                            {section.name}
                          </h5>
                          {section.isSelected && (
                            <span className="bg-green-600 text-white text-xs md:text-sm font-medium px-1.5 md:px-2 py-0.5 rounded-full">
                              ✓ In Your Schedule
                            </span>
                          )}
                        </div>
                        {section.meetings.map((m, mIdx) => renderMeeting(m, mIdx))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <hr className="border-slate-200 mb-4 md:mb-6" />
            </>
          )}

          {outcomes.length > 0 && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Learning Outcomes</h3>
              <div className="bg-cuhk-primary-light border-l-4 border-cuhk-primary p-3 md:p-4 rounded text-slate-700">
                <ul className="list-disc list-inside space-y-1 md:space-y-1.5">
                  {outcomes.map((item, i) => (
                    <li key={i} className="text-sm md:text-base leading-relaxed">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {getAssessmentList().length > 0 && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Assessment</h3>
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 md:p-4 rounded">
                <table className="w-full text-sm md:text-base">
                  <thead>
                    <tr className="text-left text-slate-600 border-b border-amber-200">
                      <th className="py-1 text-sm md:text-base">Type</th>
                      <th className="py-1 w-20 md:w-24 text-right text-sm md:text-base">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAssessmentList().map(([type, weight], i) => (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="py-1 md:py-1.5 text-slate-700 text-sm md:text-base">{type}</td>
                        <td className="py-1 md:py-1.5 text-right font-medium text-slate-800 text-sm md:text-base">{weight}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {requiredReadings.length > 0 && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Required Readings</h3>
              <div className="bg-slate-50 border-l-4 border-slate-500 p-3 md:p-4 rounded text-slate-700">
                <ul className="list-disc list-inside space-y-1 md:space-y-1.5">
                  {requiredReadings.map((item, i) => formatReadingItem(item, i))}
                </ul>
              </div>
            </div>
          )}

          {recommendedReadings.length > 0 && (
            <div className="mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Recommended Readings</h3>
              <div className="bg-slate-50 border-l-4 border-slate-400 p-3 md:p-4 rounded text-slate-700">
                <ul className="list-disc list-inside space-y-1 md:space-y-1.5">
                  {recommendedReadings.map((item, i) => formatReadingItem(item, i))}
                </ul>
              </div>
            </div>
          )}

          {course.description && course.description !== 'No description available.' && (
            <>
              <hr className="border-slate-200 mb-4 md:mb-6" />
              <h3 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Description</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm md:text-base">{course.description}</p>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CourseModal;