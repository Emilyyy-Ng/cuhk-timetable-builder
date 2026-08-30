// frontend/src/components/TimetableView.jsx
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { formatTime, timeToMinutes } from '../utils/time';
import { getLocationShortForm } from '../utils/locations';
import { ChevronLeft, ChevronRight, MapPin, CalendarDays, CalendarX, Filter, Download, Maximize2, Minus, Plus, X, RotateCcw } from 'lucide-react';
import CourseModal from './CourseModal';
import Button from './ui/Button';
import { useToast } from './ui/Toast';
import html2canvas from 'html2canvas-pro';

// ───────────── module scope (outside the component) ─────────────

const typeColors = {
  LEC: { bg: '#CDE6FA', border: '#4a90d9' },
  CLW: { bg: '#CDE6FA', border: '#4a90d9' },
  TUT: { bg: '#DCE8C8', border: '#5a8f3c' },
  LAB: { bg: '#FAD4E4', border: '#c0397a' },
  PRJ: { bg: '#FFDAB4', border: '#d4880f' },
  SEM: { bg: '#E8D5F5', border: '#8e44ad' },
  TMC: { bg: '#E8D5F5', border: '#8e44ad' },
  ASB: { bg: '#CDE6FA', border: '#4a90d9' },
  DEB: { bg: '#D4E8F5', border: '#2980b9' },
  DIS: { bg: '#E8D5F5', border: '#8e44ad' },
  EXR: { bg: '#DCE8C8', border: '#5a8f3c' },
  FLD: { bg: '#C8E6C9', border: '#2e7d32' },
  IND: { bg: '#B3E5FC', border: '#0277bd' },
  PRA: { bg: '#FAD4E4', border: '#c0397a' },
  STD: { bg: '#FFE0B2', border: '#e65100' },
  VST: { bg: '#D1C4E9', border: '#5e35b1' },
  WBL: { bg: '#B2EBF2', border: '#00838f' },
  WKS: { bg: '#FFDAB4', border: '#d4880f' },
  OTHER: { bg: '#FFEEC5', border: '#8a7a5a' },
  TBA: { bg: '#F1F5F9', border: '#94A3B8' }
};

const daysToShow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const startHour = 8;
const startMinute = 30;
const DEFAULT_END_HOUR = 18;
const DEFAULT_END_MINUTE = 30;

const SELECT_CLASS =
  'h-8 md:h-9 px-2 md:px-2.5 border border-slate-300 rounded-lg bg-white cursor-pointer text-xs md:text-sm ' +
  'outline-none focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary';

const CHECKBOX_CLASS = 'h-3.5 w-3.5 md:h-4 md:w-4 cursor-pointer accent-cuhk-primary';

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
    LEC: 'Lectures', CLW: 'Classwork', TUT: 'Tutorials', LAB: 'Laboratories',
    PRJ: 'Projects', SEM: 'Seminars', TMC: 'Thesis Research', ASB: 'Assemblies',
    DEB: 'Debates', DIS: 'Discussions', EXR: 'Exercises', FLD: 'Field Studies',
    IND: 'Independent Study', PRA: 'Practicum', STD: 'Studio', VST: 'Visits',
    WBL: 'Web-enhanced', WKS: 'Workshops', OTHER: 'Other Sessions', TBA: 'TBA / No Schedule'
  };
  return names[type] || 'Other Sessions';
};

const getTotalCredits = (schedule) =>
  schedule.reduce((sum, { course }) => sum + course.units, 0);

const getDaysOff = (schedule) => {
  const usedDays = new Set();
  schedule.forEach(({ time_option }) => {
    (time_option.meetings || []).forEach(m => {
      if (!m.is_tba && m.day >= 0 && m.day <= 5) usedDays.add(m.day);
    });
  });
  return 7 - usedDays.size;
};

// ─────────────────────────────────────────────────────────────────

const TimetableView = ({ schedules, allCourses }) => {
  const toast = useToast();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTimeOption, setSelectedTimeOption] = useState(null);
  const gridRef = useRef(null);
  const gridContainerRef = useRef(null);
  const captureRef = useRef(null);
  const fullscreenScrollRef = useRef(null);

  // Fullscreen zoom state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Grid width state for dynamic row height
  const [gridWidth, setGridWidth] = useState(800);

  // Toggles
  const [showType, setShowType] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const [showTime, setShowTime] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [locFormat, setLocFormat] = useState('Short');

  // Filters
  const [creditsFilter, setCreditsFilter] = useState('All');
  const [daysOffFilter, setDaysOffFilter] = useState('All');

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── ALL hooks before early return ──

  const availableCredits = useMemo(() => {
    const credits = new Set((schedules || []).map(s => getTotalCredits(s.schedule)));
    return Array.from(credits).sort((a, b) => b - a);
  }, [schedules]);

  const availableDaysOff = useMemo(() => {
    const creditFiltered = (schedules || []).filter(s => {
      const credits = getTotalCredits(s.schedule);
      if (creditsFilter !== 'All' && credits !== parseInt(creditsFilter)) return false;
      return true;
    });
    
    const days = new Set(creditFiltered.map(s => getDaysOff(s.schedule)));
    return Array.from(days).sort((a, b) => b - a);
  }, [schedules, creditsFilter]);

  const filteredSchedules = useMemo(() => {
    const creditFiltered = (schedules || []).filter(s => {
      const credits = getTotalCredits(s.schedule);
      if (creditsFilter !== 'All' && credits !== parseInt(creditsFilter)) return false;
      return true;
    });
    
    return creditFiltered.filter(s => {
      const daysOff = getDaysOff(s.schedule);
      if (daysOffFilter !== 'All') {
        const requiredDays = parseInt(daysOffFilter);
        if (daysOff !== requiredDays) return false;
      }
      return true;
    });
  }, [schedules, creditsFilter, daysOffFilter]);

  const safeIdx = Math.min(currentIdx, Math.max(filteredSchedules.length - 1, 0));
  const currentSchedule = filteredSchedules[safeIdx]?.schedule || [];

  const { scheduledItems, tbaItems } = useMemo(() => {
    const scheduled = [];
    const tba = [];
    currentSchedule.forEach(({ course, time_option }) => {
      const meetings = time_option.meetings || [];
      const visibleMeetings = meetings.filter(m => !m.is_tba && m.day >= 0 && m.day_name);
      const tbaMeetings = meetings.filter(m => m.is_tba || m.day < 0 || !m.day_name);
      if (visibleMeetings.length > 0) scheduled.push({ course, time_option });
      if (tbaMeetings.length > 0) {
        tba.push({ course, time_option, tbaMeetings, isFullyTBA: visibleMeetings.length === 0 });
      }
    });
    return { scheduledItems: scheduled, tbaItems: tba };
  }, [currentSchedule]);

  const meetingsByDay = useMemo(() => {
    const byDay = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
    scheduledItems.forEach(({ course, time_option }) => {
      (time_option.meetings || []).forEach(m => {
        if (m.is_tba) return;
        if (byDay[m.day_name]) {
          byDay[m.day_name].push({
            course,
            meeting: m,
            sessionType: getSessionType(m.session_code, m.type),
            startMin: timeToMinutes(m.start),
            endMin: timeToMinutes(m.end),
          });
        }
      });
    });
    Object.values(byDay).forEach(list => list.sort((a, b) => a.startMin - b.startMin));
    return byDay;
  }, [scheduledItems]);

  const presentTypes = useMemo(() => {
    const types = new Set();
    Object.values(meetingsByDay).forEach(meetings =>
      meetings.forEach(m => types.add(m.sessionType))
    );
    if (tbaItems.length > 0) types.add('TBA');
    const categoryOrder = [
      'LEC', 'CLW', 'SEM', 'TMC', 'TUT', 'LAB', 'PRJ',
      'ASB', 'DEB', 'DIS', 'EXR', 'FLD', 'IND', 'PRA',
      'STD', 'VST', 'WBL', 'WKS', 'OTHER', 'TBA'
    ];
    return Array.from(types).sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [meetingsByDay, tbaItems]);

  // Track grid width for dynamic row height
  useEffect(() => {
    if (!gridContainerRef.current) return;
    
    const updateWidth = () => {
      if (gridContainerRef.current) {
        setGridWidth(gridContainerRef.current.offsetWidth);
      }
    };
    
    // Initial measurement
    updateWidth();
    
    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    
    resizeObserver.observe(gridContainerRef.current);
    
    // Also update on window resize as fallback
    window.addEventListener('resize', updateWidth);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Keyboard nav
  useEffect(() => {
    const maxIdx = filteredSchedules.length - 1;
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (selectedCourse) return;
      if (e.key === 'ArrowLeft') setCurrentIdx(i => Math.max(0, Math.min(i, maxIdx) - 1));
      if (e.key === 'ArrowRight') setCurrentIdx(i => Math.min(maxIdx, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredSchedules.length, selectedCourse]);

  // Escape to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setIsFullscreen(false); setZoomLevel(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  // Filter reset when options disappear
  useEffect(() => {
    if (creditsFilter !== 'All' && !availableCredits.includes(parseInt(creditsFilter))) setCreditsFilter('All');
  }, [availableCredits, creditsFilter]);
  useEffect(() => {
    if (daysOffFilter !== 'All' && !availableDaysOff.includes(parseInt(daysOffFilter))) setDaysOffFilter('All');
  }, [availableDaysOff, daysOffFilter]);

  // ── Early returns ──
  if (!schedules || schedules.length === 0) {
    return (
      <div className="bg-white p-6 sm:p-10 rounded-xl shadow-sm border border-slate-200 text-center">
        <CalendarX className="h-8 w-8 md:h-10 md:w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm md:text-base">No schedules found. Try adjusting constraints.</p>
      </div>
    );
  }

  // ── Derived values ──
  const hasResults = filteredSchedules.length > 0;
  const totalCredits = getTotalCredits(currentSchedule);
  const scheduledCredits = scheduledItems.reduce((sum, { course }) => sum + course.units, 0);
  const tbaCredits = tbaItems.reduce(
    (sum, { course, isFullyTBA }) => sum + (isFullyTBA ? course.units : 0), 0
  );

  const hasSaturday = (meetingsByDay.Sat || []).length > 0;
  const activeDays = hasSaturday ? daysToShow : daysToShow.slice(0, 5);

  let latestEndMin = 0;
  Object.values(meetingsByDay).forEach(ms =>
    ms.forEach(({ endMin }) => { if (endMin > 0 && endMin > latestEndMin) latestEndMin = endMin; })
  );

  // Calculate required end time, rounding up to the next 15-minute increment
  let requiredEndHour = Math.floor(latestEndMin / 60);
  let requiredEndMinute = 0;

  if (latestEndMin > 0) {
    const minRemainder = latestEndMin % 60;
    if (minRemainder === 0) {
      requiredEndMinute = 0;
    } else if (minRemainder <= 15) {
      requiredEndMinute = 15;
    } else if (minRemainder <= 30) {
      requiredEndMinute = 30;
    } else if (minRemainder <= 45) {
      requiredEndMinute = 45;
    } else {
      requiredEndHour += 1;
      requiredEndMinute = 0;
    }
  }

  // Compare with default end time (18:30)
  const defaultEndTotalMinutes = DEFAULT_END_HOUR * 60 + DEFAULT_END_MINUTE;
  const requiredEndTotalMinutes = requiredEndHour * 60 + requiredEndMinute;
  const endTotalMinutes = Math.max(defaultEndTotalMinutes, requiredEndTotalMinutes);

  const endHour = Math.floor(endTotalMinutes / 60);
  const endMinute = endTotalMinutes % 60;

  // Each hour has 4 rows (for :00, :15, :30, :45), starting from 08:30
  // Calculate total rows based on end time
  const totalRows = (endHour - startHour) * 4;

  // Helper: convert minutes to grid row (4 rows per hour, starting from row 2)
  const getRowForTime = (minutes) => {
    if (minutes < 0) return 2;
    
    // Calculate offset from 08:30
    const startTotalMinutes = startHour * 60 + startMinute;
    const diffMinutes = minutes - startTotalMinutes;
    
    // Each row is 15 minutes
    let rowOffset = Math.floor(diffMinutes / 15);
    
    // Clamp to valid range
    if (rowOffset < 0) rowOffset = 0;
    if (rowOffset >= totalRows) rowOffset = totalRows - 1;
    
    return 2 + rowOffset;
  };

  const getRowSpan = (startMin, endMin) => {
    if (startMin < 0 || endMin < 0) return { start: 2, span: 1 };
    const startRow = getRowForTime(startMin);
    let endRow = getRowForTime(endMin);
    // Ensure end row is at least start row + 1
    if (endRow <= startRow) endRow = startRow + 1;
    return { start: startRow, span: Math.max(1, endRow - startRow) };
  };

  const openCourseModal = (course, meeting) => {
    setSelectedCourse(course);
    setSelectedTimeOption(meeting);
  };

  // ── Grid renderer ──
  const renderGrid = useCallback((mode, hideLocationIcon = false) => {
    const isFs = mode === 'fullscreen';
    const isMob = mode === 'mobile';
    const isDesktop = mode === 'desktop';

    // Calculate dynamic minRowHeight based on gridWidth
    let minRowHeight;
    if (isMob) {
      minRowHeight = Math.max(12, gridWidth * 0.02) + 'px'; // 2% of width on mobile
    } else if (isFs) {
      minRowHeight = Math.max(16, gridWidth * 0.015) + 'px'; // 1.5% of width on fullscreen
    } else {
      minRowHeight = Math.max(18, gridWidth * 0.018) + 'px'; // 1.8% of width on desktop
    }

    // Consistent sizing across modes
    const sz = {
      timeCol: isMob ? 32 : 60,
      headerH: isMob ? 24 : 40,
      header: isMob ? 'text-[8px]' : isFs ? 'text-sm font-semibold' : 'text-base',
      time: isMob ? 'text-[7px]' : isFs ? 'text-xs font-medium' : 'text-base text-slate-500',
      code: isMob ? 'text-[7px] font-bold' : isFs ? 'text-lg font-bold' : 'text-lg font-bold',
      type: isMob ? 'text-[7px] font-semibold' : isFs ? 'text-xs font-semibold uppercase' : 'text-base font-semibold uppercase',
      title: isMob ? 'text-[7px]' : isFs ? 'text-xs' : 'text-base',
      timeDetail: isMob ? 'text-[7px]' : isFs ? 'text-xs' : 'text-base',
      loc: isMob ? 'text-[7px]' : isFs ? 'text-xs' : 'text-base',
      cellPad: isMob ? 'px-1 py-1 m-px' : isFs ? 'px-2 py-3 m-0.5' : 'px-2 py-5 m-0.5',
      borderW: isMob ? 2 : isFs ? 3 : 4,
      gap: isMob ? 'gap-px' : 'gap-[1px]',
      minRowHeight: minRowHeight,
    };

    return (
      <div
        className="bg-white"
        style={{
          display: 'grid',
          gridTemplateColumns: `${sz.timeCol}px repeat(${activeDays.length}, ${isMob && activeDays.length > 5 ? 'minmax(55px, 1fr)' : 'minmax(0, 1fr)'})`,
          gridTemplateRows: `${sz.headerH}px repeat(${totalRows}, minmax(${sz.minRowHeight}, auto))`,
          ...(isFs ? { minWidth: 900 } : isMob && activeDays.length > 5 ? { minWidth: '200px' } : isMob ? {} : { minWidth: 800 }),
          border: '1px solid #cbd5e1',
          position: 'relative',
        }}
      >
        {/* Header row - Time column */}
        <div 
          className="bg-slate-100 flex items-center justify-center font-semibold"
          style={{ 
            borderRight: '1px solid #cbd5e1',
            borderBottom: '1px solid #cbd5e1',
          }}
        >
          <span className={sz.header}>Time</span>
        </div>
        
        {/* Header row - Day columns */}
        {activeDays.map((day, index) => (
          <div 
            key={day} 
            className="bg-slate-100 flex items-center justify-center font-semibold"
            style={{ 
              borderBottom: '1px solid #cbd5e1',
              borderRight: index < activeDays.length - 1 ? '1px solid #cbd5e1' : 'none',
            }}
          >
            <span className={sz.header}>{day}</span>
          </div>
        ))}

        {/* Time labels - show only at :30 */}
        {Array.from({ length: totalRows }).map((_, rowIdx) => {
          const totalMinutes = (startHour * 60 + startMinute) + (rowIdx * 15);
          const hour = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          
          // Show label only at :30
          const showLabel = minutes === 30;

          // Determine font size based on mode
          let timeLabelSize = 'text-[7px] md:text-sm';
          if (isFs) timeLabelSize = 'text-xs md:text-sm font-medium';
          if (isMob) timeLabelSize = 'text-[7px]';

          return (
            <div 
              key={rowIdx} 
              className={`text-slate-500 flex items-start justify-end pr-2 ${timeLabelSize} font-mono`}
              style={{ 
                gridColumn: 1, 
                gridRow: rowIdx + 2,
                borderBottom: minutes === 15 ? '1px solid #cbd5e1' : 'none',
                borderRight: '1px solid #cbd5e1',
                height: '100%',
                minHeight: sz.minRowHeight,
                paddingRight: '4px',
                paddingTop: '2px',
              }}
            >
              {showLabel ? timeStr : ''}
            </div>
          );
        })}

        {/* Grid cells - only horizontal lines for a unified look */}
        {activeDays.map((day, dayIdx) => {
          const dayMeetings = meetingsByDay[day] || [];
          return (
            <React.Fragment key={day}>
              {/* Background cells for each row */}
              {Array.from({ length: totalRows }).map((_, rowIdx) => {
                const totalMinutes = (startHour * 60 + startMinute) + (rowIdx * 15);
                const minutes = totalMinutes % 60;
                const isHourStart = minutes === 15;  
                const isQuarterHour = minutes === 0; 
                const isHalfHour = minutes === 30;   
                const isThreeQuarter = minutes === 45; 
                
                let borderStyle = '1px solid #f1f5f9';
                if (isHourStart) borderStyle = '1px solid #cbd5e1';
                else if (isQuarterHour || isThreeQuarter || isHalfHour) borderStyle = 'none';
                
                return (
                  <div 
                    key={rowIdx} 
                    className="bg-white"
                    style={{ 
                      gridColumn: dayIdx + 2, 
                      gridRow: rowIdx + 2,
                      minHeight: sz.minRowHeight,
                      borderBottom: borderStyle,
                      borderRight: dayIdx < activeDays.length - 1 ? '1px solid #e2e8f0' : 'none',
                    }}
                  />
                );
              })}

              {/* Course blocks */}
              {dayMeetings.map((m, mIdx) => {
                const { start, span } = getRowSpan(m.startMin, m.endMin);
                const colors = typeColors[m.sessionType] || typeColors.OTHER;
                const locText = locFormat === 'Short' ? getLocationShortForm(m.meeting.location) : m.meeting.location;

                return (
                  <div
                    key={mIdx}
                    role="button"
                    tabIndex={isFs ? -1 : 0}
                    aria-label={`${m.course.full_code} ${m.sessionType}, ${formatTime(m.meeting.start)} to ${formatTime(m.meeting.end)}, ${locText}`}
                    onClick={() => !isFs && openCourseModal(m.course, m.meeting)}
                    onKeyDown={(e) => {
                      if (isFs) return;
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCourseModal(m.course, m.meeting); }
                    }}
                    className={`${isMob ? 'rounded-sm' : 'rounded-lg'} ${sz.cellPad} text-slate-800 cursor-pointer overflow-hidden
                      flex flex-col justify-center ${isMob ? 'gap-0' : isFs ? 'gap-0.5' : 'gap-1'}
                      transition-shadow duration-200 hover:z-20 hover:shadow-xl hover:scale-[1.01] hover:brightness-105
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary focus-visible:z-20`}
                    style={{
                      gridColumn: dayIdx + 2,
                      gridRow: `${start} / span ${span}`,
                      backgroundColor: colors.bg,
                      borderLeft: `${sz.borderW}px solid ${colors.border}`,
                      margin: isMob ? '1px 2px' : '3px 4px',
                      minHeight: `calc(${sz.minRowHeight} * ${span} - 2px)`,
                      zIndex: 1,
                      position: 'relative',
                    }}
                  >
                    <div className={`${sz.code} text-center opacity-85 leading-tight`}>{m.course.full_code}</div>
                    {showType && (
                      <div className={`${sz.type} text-center opacity-70 leading-tight`}>
                        {m.sessionType}
                      </div>
                    )}
                    {showTitle && (
                      <div className={`${sz.title} text-center opacity-80 break-words line-clamp-3 leading-tight`}>
                        {m.course.title}
                      </div>
                    )}
                    {showTime && (
                      <div className={`${sz.timeDetail} text-center opacity-80 tabular-nums leading-tight`}>
                        {formatTime(m.meeting.start)} – {formatTime(m.meeting.end)}
                      </div>
                    )}
                    {showLocation && (
                      <div className={`${sz.loc} opacity-80 leading-tight text-center`}>
                        <span className="break-words">
                          {!isMob && !hideLocationIcon && (
                            <MapPin
                              size={isFs ? 12 : 14}
                              strokeWidth={2.5}
                              color="#334155"
                              className="inline-block align-top mr-1 mt-[1px] opacity-80"
                            />
                          )}
                          <span>{locText}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  }, [activeDays, totalRows, endHour, meetingsByDay, showType, showTitle, showTime, showLocation, locFormat, gridWidth]);

  // ── Fullscreen wheel zoom ──
  const handleFullscreenWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(z => Math.max(0.5, Math.min(3, +(z + delta).toFixed(2))));
    }
  }, []);

  useEffect(() => {
    const el = fullscreenScrollRef.current;
    if (!el || !isFullscreen) return;
    el.addEventListener('wheel', handleFullscreenWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleFullscreenWheel);
  }, [isFullscreen, handleFullscreenWheel]);

  // ── PNG download ──
  const handleDownloadPng = async () => {
    if (!captureRef.current) return;
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: true,
        onclone: (doc, el) => {
          el.style.position = 'fixed';
          el.style.left = '0';
          el.style.top = '0';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          el.style.zIndex = '9999';
          el.style.pointerEvents = 'none';
        },
      });
      const link = document.createElement('a');
      link.download = `schedule_${safeIdx + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Schedule saved to Downloads');
    } catch (err) {
      console.error('PNG export failed:', err);
      toast.error('Failed to export PNG: ' + err.message);
    }
  };

  // ── Hidden desktop-sized grid for PNG capture ──
  const captureGrid = (
    <div
      ref={captureRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '1060px',
        visibility: 'hidden',
        pointerEvents: 'none',
        zIndex: -1,
        padding: '30px',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        {renderGrid('desktop', true)}
        {tbaItems.length > 0 && (
          <div className="mt-4 p-4 bg-slate-50 border-2 border-slate-300 rounded-lg" style={{ width: '100%', boxSizing: 'border-box' }}>
            <h4 className="font-semibold text-slate-600 mb-3 flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              <span>TBA {tbaCredits > 0 && `(${tbaCredits} Credits)`}</span>
            </h4>
            <div className="grid grid-cols-5 gap-3">
              {tbaItems.map(({ course, time_option, tbaMeetings }) => (
                <div
                  key={course.full_code}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-3"
                  style={{ borderLeft: `4px solid ${typeColors.TBA.border}` }}
                >
                  <div className="font-bold text-sm text-slate-800">{course.full_code}</div>
                  {showTitle && (
                    <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{course.title}</div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {course.units} {course.units === 1 ? 'Unit' : 'Units'}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      {time_option.section || 'TBA'}
                    </span>
                  </div>
                  {tbaMeetings?.length > 0 && (
                    <div className="text-xs text-slate-500 mt-2">
                      {tbaMeetings.map((m, i) => (
                        <div key={i}>
                          {m.session_code && <span>{m.session_code}</span>}
                          {m.instructor && m.instructor !== 'TBA' && m.instructor !== 'No Room Required' && (
                            <span className="block mt-0.5 whitespace-nowrap">{m.instructor.replace(/^Professor\s+/, 'Prof. ')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white px-2 py-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
      {captureGrid}

      {/* Top Row */}
      <div className="flex justify-between items-center mb-3 md:mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 md:gap-4">
          {hasResults ? (
            <>
              <h3 className="text-lg md:text-xl font-bold text-slate-800" aria-live="polite">
                Schedule {safeIdx + 1} of {filteredSchedules.length}
              </h3>
              <span className="bg-cuhk-primary/10 text-cuhk-primary-dark text-xs md:text-base font-medium px-2 md:px-3 py-0.5 md:py-1 rounded-full">
                {totalCredits} Credits
              </span>
              {tbaCredits > 0 && (
                <span className="text-xs text-slate-500 hidden sm:inline">
                  ({scheduledCredits} scheduled + {tbaCredits} TBA)
                </span>
              )}
            </>
          ) : (
            <h3 className="text-lg md:text-xl font-bold text-slate-800">No matching schedules</h3>
          )}
        </div>
        <div className="flex gap-1.5 md:gap-2 items-center">
          <Button 
            variant="secondary" 
            size="sm"
            className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-2.5"
            onClick={handleDownloadPng} 
            disabled={!hasResults}
          >
            <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Download PNG</span>
            <span className="sm:hidden">PNG</span>
          </Button>
          <select value={creditsFilter} onChange={(e) => { setCreditsFilter(e.target.value); setCurrentIdx(0); }} className={SELECT_CLASS} aria-label="Filter by credits">
            <option value="All">All Credits</option>
            {availableCredits.map(c => <option key={c} value={c}>{c} Cr</option>)}
          </select>
          <select value={daysOffFilter} onChange={(e) => { setDaysOffFilter(e.target.value); setCurrentIdx(0); }} className={SELECT_CLASS} aria-label="Filter by days off">
            <option value="All">Any Days Off</option>
            {availableDaysOff.map(d => <option key={d} value={d}>{d} {d === 1 ? 'Day' : 'Days'} Off</option>)}
          </select>
        </div>
      </div>

      {/* Middle Row — Timetable */}
      {hasResults ? (
        <div className="flex items-stretch gap-0 md:gap-2 -mx-3 md:mx-0">
          {/* Prev */}
          <button
            onClick={() => setCurrentIdx(Math.max(0, safeIdx - 1))}
            disabled={safeIdx === 0}
            aria-label="Previous schedule"
            title="Previous schedule (←)"
            className="self-center flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center
              text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer
              transition-all duration-150 active:scale-90
              disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
          >
            <ChevronLeft className="h-4 w-4 md:h-6 md:w-6" />
          </button>

          <div className="flex-1 relative min-w-0">
            {/* Expand button */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="absolute top-0.5 right-0.5 z-10 p-1 md:p-2 bg-white/90 backdrop-blur-sm rounded-sm md:rounded-md shadow-sm
                text-slate-500 hover:text-slate-900 hover:bg-white
                cursor-pointer transition-all duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
              aria-label="View full screen"
              title="Expand to full screen"
            >
              <Maximize2 className="h-3 w-3 md:h-4 md:w-4" />
            </button>

            <div 
              ref={gridContainerRef} 
              className="overflow-x-auto"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {renderGrid(isMobile ? 'mobile' : 'desktop')}
            </div>

            {/* TBA Section */}
            {tbaItems.length > 0 && (  
              <div className="mt-3 md:mt-4 p-3 md:p-4 bg-slate-50 border-2 border-slate-300 rounded-lg">
                <h4 className="font-semibold text-slate-600 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                  <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span>TBA {tbaCredits > 0 && `(${tbaCredits} Credits)`}</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                  {tbaItems.map(({ course, time_option, tbaMeetings }) => (
                    <div
                      key={course.full_code}
                      role="button"
                      tabIndex={0}
                      aria-label={`${course.full_code} details`}
                      onClick={() => openCourseModal(course, tbaMeetings?.[0] || null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCourseModal(course, tbaMeetings?.[0] || null); }
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2 md:px-3 py-2 md:py-3 cursor-pointer
                        hover:bg-slate-50 hover:border-slate-300 hover:shadow-md transition-all duration-150
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                      style={{ borderLeft: `4px solid ${typeColors.TBA.border}` }}
                    >
                      <div className="font-bold text-sm md:text-base text-slate-800">{course.full_code}</div>
                      {showTitle && (
                        <div className="text-xs md:text-sm text-slate-600 mt-0.5 md:mt-1 line-clamp-2">{course.title}</div>
                      )}
                      <div className="flex items-center justify-between mt-1 md:mt-2">
                        <span className="text-xs md:text-sm font-medium text-slate-600 bg-slate-100 px-1.5 md:px-2 py-0.5 rounded">
                          {course.units} {course.units === 1 ? 'Unit' : 'Units'}
                        </span>
                        <span className="text-xs md:text-sm text-slate-500 font-semibold">
                          {time_option.section || 'TBA'}
                        </span>
                      </div>
                      {tbaMeetings?.length > 0 && (
                        <div className="text-xs text-slate-500 mt-2 hidden sm:block">
                          {tbaMeetings.map((m, i) => (
                            <div key={i}>
                              {m.session_code && <span>{m.session_code}</span>}
                              {m.instructor && m.instructor !== 'TBA' && m.instructor !== 'No Room Required' && (
                                <span className="block mt-0.5">{m.instructor.replace(/^Professor\s+/, 'Prof. ')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Next */}
          <button
            onClick={() => setCurrentIdx(Math.min(filteredSchedules.length - 1, safeIdx + 1))}
            disabled={safeIdx >= filteredSchedules.length - 1}
            aria-label="Next schedule"
            title="Next schedule (→)"
            className="self-center flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center
              text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer
              transition-all duration-150 active:scale-90
              disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
          >
            <ChevronRight className="h-4 w-4 md:h-6 md:w-6" />
          </button>
        </div>
      ) : (
        <div className="text-center py-8 md:py-10 text-slate-500 border border-dashed border-slate-300 rounded-lg">
          <Filter className="h-6 w-6 md:h-8 md:w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm md:text-base">No schedules match the current filters.</p>
          <p className="text-xs md:text-sm text-slate-400 mt-1">Try selecting "All Credits" and "All Days".</p>
        </div>
      )}

      {/* Bottom: Legends & Actions */}
      <div className="mt-4 md:mt-6 border-b border-slate-200 pb-3 md:pb-4 flex justify-between items-center flex-wrap gap-2 md:gap-4">
        <div className="flex gap-3 md:gap-4 flex-wrap">
          {presentTypes.map(type => (
            <div key={type} className="flex items-center gap-1.5 md:gap-2 text-xs md:text-base text-slate-600">
              <div
                className="w-3.5 h-3.5 md:w-5 md:h-5 rounded"
                style={{
                  backgroundColor: (typeColors[type] || typeColors.OTHER).bg,
                  borderColor: (typeColors[type] || typeColors.OTHER).border,
                  borderWidth: 1
                }}
              ></div>
              {getTypeDisplayName(type)}
            </div>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="mt-3 md:mt-4 flex justify-between items-center flex-wrap gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-4 text-xs md:text-base flex-wrap">
          <span className="font-medium text-slate-600">Show:</span>
          <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showType} onChange={(e) => setShowType(e.target.checked)} className={CHECKBOX_CLASS} /> Type
          </label>
          <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} className={CHECKBOX_CLASS} /> Title
          </label>
          <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showTime} onChange={(e) => setShowTime(e.target.checked)} className={CHECKBOX_CLASS} /> Time
          </label>
          <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} className={CHECKBOX_CLASS} /> Loc
          </label>
        </div>
        <div className="flex items-center gap-2 md:gap-3 text-xs md:text-base">
          <span className="font-medium text-slate-600">Loc:</span>
          <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer">
            <input type="radio" value="Short" checked={locFormat === 'Short'} onChange={(e) => setLocFormat(e.target.value)} className={CHECKBOX_CLASS} /> Short
          </label>
          <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer">
            <input type="radio" value="Long" checked={locFormat === 'Long'} onChange={(e) => setLocFormat(e.target.value)} className={CHECKBOX_CLASS} /> Long
          </label>
        </div>
      </div>

      {/* ── Fullscreen overlay ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white flex-shrink-0 gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={() => setCurrentIdx(Math.max(0, safeIdx - 1))}
                disabled={safeIdx === 0}
                aria-label="Previous schedule"
                title="Previous schedule (←)"
                className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 cursor-pointer flex-shrink-0
                  disabled:opacity-30 disabled:cursor-not-allowed
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentIdx(Math.min(filteredSchedules.length - 1, safeIdx + 1))}
                disabled={safeIdx >= filteredSchedules.length - 1}
                aria-label="Next schedule"
                title="Next schedule (→)"
                className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 cursor-pointer flex-shrink-0
                  disabled:opacity-30 disabled:cursor-not-allowed
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 truncate" aria-live="polite">
                Schedule {safeIdx + 1} of {filteredSchedules.length} · {totalCredits} Credits
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg px-0.5">
                <button
                  onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                  aria-label="Zoom out"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium w-10 text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
                <button
                  onClick={() => setZoomLevel(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200 cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                  aria-label="Zoom in"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                aria-label="Reset zoom"
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setIsFullscreen(false); setZoomLevel(1); }}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                aria-label="Close full screen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable + zoomable grid area */}
          <div
            ref={fullscreenScrollRef}
            className="flex-1 overflow-auto bg-slate-50"
            onDoubleClick={() => setZoomLevel(1)}
          >
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top left',
                display: 'inline-block',
                minWidth: 900,
                padding: '20px',
              }}
            >
              {renderGrid('fullscreen')}
            </div>
          </div>
        </div>
      )}

      {selectedCourse && (
        <CourseModal
          course={selectedCourse}
          selectedMeeting={selectedTimeOption}
          onClose={() => { setSelectedCourse(null); setSelectedTimeOption(null); }}
        />
      )}
    </div>
  );
};

export default TimetableView;
