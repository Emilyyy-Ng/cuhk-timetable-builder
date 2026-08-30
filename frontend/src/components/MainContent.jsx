// frontend/src/components/MainContent.jsx
import React, { useState, useMemo, useId } from 'react';
import { Search, Star, Rocket, X, ArrowLeft, TriangleAlert as AlertTriangle } from 'lucide-react';
import { optimizeSchedule } from '../api';
import TimetableView from './TimetableView';
import CourseModal from './CourseModal';
import Button, { IconButton } from './ui/Button';
import { useToast } from './ui/Toast';

// ──────────────────────────────────────────────────────────────
// Shared control styling — responsive font sizes for mobile
// ──────────────────────────────────────────────────────────────
const FILTER_CONTROL_CLASS =
  'w-full h-10 md:h-11 px-3 border border-slate-300 rounded-lg bg-white cursor-pointer text-sm md:text-base ' +
  'outline-none focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary';

const TEXT_INPUT_CLASS =
  'w-full p-2 border border-slate-300 rounded-lg text-sm md:text-base ' +
  'outline-none focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary';

// ──────────────────────────────────────────────────────────────
// Reusable combobox
// ──────────────────────────────────────────────────────────────
function AutocompleteInput({ items, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const listboxId = useId();

  const filtered = useMemo(() => {
    if (!value) return items.slice(0, 50);
    const v = value.toLowerCase();
    return items.filter(i => i.toLowerCase().includes(v)).slice(0, 50);
  }, [items, value]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setHighlighted(-1);
  };

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && highlighted >= 0 ? `${listboxId}-opt-${highlighted}` : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); handleSelect(filtered[highlighted]); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        className={FILTER_CONTROL_CLASS}
      />
      {open && filtered.length > 0 && (
        <div
          role="listbox"
          id={listboxId}
          className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg
                     shadow-lg ring-1 ring-black/5 max-h-60 overflow-y-auto divide-y divide-slate-100"
        >
          {filtered.map((item, i) => (
            <div
              key={item}
              role="option"
              id={`${listboxId}-opt-${i}`}
              aria-selected={i === highlighted}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm md:text-base cursor-pointer transition-colors duration-100 ${
                i === highlighted ? 'bg-cuhk-primary/10 text-cuhk-primary-dark' : 'hover:bg-slate-50'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// "Must Take" toggle chip
// ──────────────────────────────────────────────────────────────
function MustToggle({ active, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title="Mark as Must Take"
      className={`inline-flex items-center justify-center gap-1 text-xs md:text-sm px-1.5 md:px-2 py-1 rounded-lg border cursor-pointer
        transition-all duration-150 active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2
        ${active
          ? 'bg-cuhk-primary/10 border-cuhk-primary/50 text-cuhk-primary-dark/90 font-semibold'
          : 'bg-white border-slate-300 text-slate-500 hover:bg-cuhk-primary/5 hover:border-cuhk-primary/40 hover:text-cuhk-primary'}
        ${className}`}
    >
      <Star className="h-3 w-3 md:h-3.5 md:w-3.5" fill={active ? 'currentColor' : 'none'} />
      <span className="hidden sm:inline">Must</span>
    </button>
  );
}

const timeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const MainContent = ({
  viewMode, setViewMode,
  allCourses, selectedCourses, setSelectedCourses,
  mustTakeCourses, setMustTakeCourses,
  favourites, setFavourites,
  config, completedCourses,
  optimizationResults, setOptimizationResults
}) => {
  const toast = useToast();
  // ── ALL useState hooks ──
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedModalCourse, setSelectedModalCourse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [advSearch, setAdvSearch] = useState('');
  const [advInstructor, setAdvInstructor] = useState('');
  const [advSubject, setAdvSubject] = useState('');
  const [advDept, setAdvDept] = useState('');
  const [advLevel, setAdvLevel] = useState('');

  // ── Credit-range validation (gates the Optimize CTA) ──
  const minCredits = parseInt(config.minCredits) || 0;
  const maxCredits = parseInt(config.maxCredits) || 0;
  const creditsInvalid = minCredits > maxCredits;

  // ── ALL useMemo hooks ──
  const visibleCourses = useMemo(() => {
    if (!allCourses) return [];
    return allCourses.filter(c => {
      const numStr = c.code.replace(/\D/g, '');
      const level = parseInt(numStr.charAt(0)) || 0;
      if (config.courseLevel === 'Undergraduate only') return level >= 1 && level <= 4;
      if (config.courseLevel === 'Postgraduate only') return level >= 5;
      return true;
    });
  }, [allCourses, config.courseLevel]);

  const allInstructors = useMemo(() => {
    const set = new Set();
    visibleCourses.forEach(c => { (c.all_instructors || []).forEach(name => set.add(name)); });
    return Array.from(set).sort();
  }, [visibleCourses]);

  const allSubjects = useMemo(
    () => [...new Set(visibleCourses.map(c => c.department).filter(Boolean))].sort(),
    [visibleCourses]
  );

  const allDepts = useMemo(
    () => [...new Set(visibleCourses.map(c => c.academic_group).filter(Boolean))].sort(),
    [visibleCourses]
  );

  const isCourseEligible = (course) => {
    if (config.ignorePrereqs) return true;
    const completedSet = new Set((completedCourses || []).map(c => c.toUpperCase()));
    if (course.excluded_courses) {
      for (const exc of course.excluded_courses) {
        if (completedSet.has(exc.toUpperCase())) return false;
      }
    }
    const prereq = course.prerequisites;
    if (!prereq) return true;
    if (prereq.type === 'any') return prereq.courses.some(c => completedSet.has(c.toUpperCase()));
    if (prereq.type === 'all') return prereq.courses.every(c => completedSet.has(c.toUpperCase()));
    if (prereq.type === 'mixed') return prereq.groups.every(group => group.some(c => completedSet.has(c.toUpperCase())));
    return true;
  };

  const selectedCourseObjects = useMemo(() => {
    return allCourses
      .filter(c => selectedCourses.includes(c.full_code))
      .sort((a, b) => a.full_code.localeCompare(b.full_code));
  }, [allCourses, selectedCourses]);

  const allFilteredCourses = useMemo(() => {
    return visibleCourses.filter(c =>
      c.full_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [visibleCourses, searchTerm]);

  const filteredCourses = allFilteredCourses.slice(0, 50);
  const totalFilteredCount = allFilteredCourses.length;

  const advFilteredCourses = useMemo(() => {
    return visibleCourses.filter(c => {
      let match = true;
      if (advSearch) {
        const term = advSearch.toLowerCase();
        match = match && (c.full_code.toLowerCase().includes(term) || c.title.toLowerCase().includes(term));
      }
      if (advInstructor) {
        const term = advInstructor.toLowerCase().trim();
        match = match && (c.all_instructors || []).some(i => i.toLowerCase().includes(term));
      }
      if (advSubject) match = match && c.department === advSubject;
      if (advDept) match = match && c.academic_group === advDept;
      if (advLevel) {
        const num = parseInt(c.code.replace(/\D/g, ''));
        match = match && num >= parseInt(advLevel) && num < (parseInt(advLevel) + 1000);
      }
      return match;
    }).slice(0, 100);
  }, [visibleCourses, advSearch, advInstructor, advSubject, advDept, advLevel]);

  const getLevels = () => ['1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000'];

  const handleOptimize = async () => {
    if (creditsInvalid) return;
    setIsOptimizing(true);
    try {
      const results = await optimizeSchedule({
        term: config.term,
        selected_codes: selectedCourses,
        must_take_codes: Array.from(mustTakeCourses),
        completed_courses: Array.from(completedCourses),
        max_credits: config.maxCredits,
        min_credits: config.minCredits,
        min_courses: 1,
        max_courses: 10,
        beam_width: 30,
        priorities: config.priorities,
        ignore_prereqs: config.ignorePrereqs,
        lunch_start: config.lunchEnabled ? timeToMinutes(config.lunchStart) : null,
        lunch_end: config.lunchEnabled ? timeToMinutes(config.lunchEnd) : null,
      });
      setOptimizationResults(results);
      setViewMode('results');
      toast.success('Optimization complete — showing your best schedules');
    } catch (err) {
      console.error("Optimization error:", err);
      toast.error(err.response?.data?.detail || "Optimization failed.");
    }
    setIsOptimizing(false);
  };

  // ── EARLY RETURN ──
  if (viewMode === 'results' && optimizationResults) {
    return (
      <div>
        <Button variant="link" onClick={() => setViewMode('main')} className="px-0! mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Course Selection
        </Button>
        <TimetableView schedules={optimizationResults} allCourses={allCourses} />
      </div>
    );
  }

  // ── Component render ──
  return (
    <div>
      {/* ── Top navigation ── */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-6 md:mb-8">
        <Button variant="secondary" size="lg" className="w-full sm:flex-1" onClick={() => setViewMode('search')}>
          <Search className="h-4 w-4 md:h-5 md:w-5" /> Advanced Search
        </Button>
        <Button variant="secondary" size="lg" className="w-full sm:flex-1" onClick={() => setViewMode('favorites')}>
          <Star className="h-4 w-4 md:h-5 md:w-5" /> Favourites ({favourites.length})
        </Button>
      </div>

      {viewMode === 'main' && (
        <>
          {/* ── Selected Courses Summary Panel ── */}
          {selectedCourseObjects.length > 0 && (
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 mb-6 md:mb-8">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <h2 className="text-lg md:text-2xl font-bold">Selected ({selectedCourseObjects.length})</h2>
                <Button
                  variant="dangerGhost"
                  size="sm"
                  onClick={() => { setSelectedCourses([]); setMustTakeCourses([]); }}
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2">
                {selectedCourseObjects.map(course => {
                  const isMustTake = mustTakeCourses.includes(course.full_code);
                  const isEligible = isCourseEligible(course);

                  return (
                    <div
                      key={course.full_code}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedModalCourse(course)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedModalCourse(course); } }}
                      className="flex items-center justify-between p-2 border border-slate-200 rounded-lg bg-slate-50
                        cursor-pointer hover:bg-slate-100 transition-colors duration-100
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                    >
                      <div className="flex flex-col overflow-hidden mr-2 min-w-0">
                        <span className="font-medium text-slate-800 text-sm md:text-base">{course.full_code}</span>
                        <span className="text-xs md:text-sm text-slate-500 truncate">{course.title}</span>
                        {!isEligible && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-0.5">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            Prereqs not met
                          </span>
                        )}
                      </div>
                      <div
                        className="flex gap-1 items-center flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MustToggle
                          active={isMustTake}
                          onClick={() => {
                            if (isMustTake) setMustTakeCourses(mustTakeCourses.filter(c => c !== course.full_code));
                            else setMustTakeCourses([...mustTakeCourses, course.full_code]);
                          }}
                        />
                        <IconButton
                          label={`Remove ${course.full_code}`}
                          onClick={() => {
                            setSelectedCourses(selectedCourses.filter(c => c !== course.full_code));
                            if (isMustTake) setMustTakeCourses(mustTakeCourses.filter(c => c !== course.full_code));
                          }}
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Search & Add Courses Panel ── */}
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg md:text-2xl font-bold mb-3 md:mb-4">Add Courses</h2>
            <input
              type="text"
              placeholder="Search course code or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${TEXT_INPUT_CLASS} mb-1.5 md:mb-2`}
            />
            {totalFilteredCount > 0 && (
              <div className="text-xs md:text-sm text-slate-500 mb-1.5 md:mb-2">
                {totalFilteredCount > 50
                  ? `Showing 50 of ${totalFilteredCount}`
                  : `${totalFilteredCount} result${totalFilteredCount !== 1 ? 's' : ''}`}
              </div>
            )}
            <div className="max-h-60 md:max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-1.5 md:p-2 mb-3 md:mb-4">
              {filteredCourses.length > 0 ? (
                filteredCourses.map(course => {
                  const isSelected = selectedCourses.includes(course.full_code);
                  const isFav = favourites.includes(course.full_code);

                  return (
                    <div key={course.full_code} className="flex items-center justify-between p-1.5 md:p-2 hover:bg-slate-50 rounded transition-colors duration-100">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCourses([...selectedCourses, course.full_code]);
                            else {
                              setSelectedCourses(selectedCourses.filter(c => c !== course.full_code));
                              setMustTakeCourses(mustTakeCourses.filter(c => c !== course.full_code));
                            }
                          }}
                          className="w-4 h-4 cursor-pointer accent-cuhk-primary shrink-0"
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-slate-800 text-sm md:text-base shrink-0">{course.full_code}</span>
                          <span className="text-xs md:text-sm text-slate-500 truncate hidden sm:inline">{course.title}</span>
                        </div>
                      </label>
                      <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFavourites(isFav ? favourites.filter(f => f !== course.full_code) : [...favourites, course.full_code]);
                          }}
                          aria-label={isFav ? `Remove ${course.full_code} from favourites` : `Add ${course.full_code} to favourites`}
                          className="p-1 rounded cursor-pointer transition-all duration-150 active:scale-90
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
                        >
                          <Star
                            className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isFav ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`}
                            fill={isFav ? 'currentColor' : 'none'}
                          />
                        </button>
                        <Button variant="link" size="sm" onClick={() => setSelectedModalCourse(course)}>
                          Details
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : <p className="text-center text-slate-500 py-4 text-sm md:text-base">No courses found.</p>}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleOptimize}
              loading={isOptimizing}
              disabled={selectedCourses.length === 0 || creditsInvalid}
            >
              {isOptimizing
                ? 'Optimizing...'
                : (<><Rocket className="h-4 w-4 md:h-5 md:w-5" /> <span>Optimize ({selectedCourses.length}<span className="hidden sm:inline"> selected</span>)</span></>)}
            </Button>
            {creditsInvalid && (
              <p className="text-xs text-red-600 mt-2 text-center">
                Fix your credit limits in Configuration — Min must be less than or equal to Max.
              </p>
            )}
          </div>
        </>
      )}

      {viewMode === 'search' && (
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-bold">Advanced Search</h2>
            <Button variant="link" onClick={() => setViewMode('main')} className="px-0!">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>

          <div className="mb-3 md:mb-4">
            <input
              type="text"
              placeholder="Search course code or title..."
              value={advSearch}
              onChange={(e) => setAdvSearch(e.target.value)}
              className={TEXT_INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
            <div>
              <AutocompleteInput
                items={allInstructors}
                value={advInstructor}
                onChange={setAdvInstructor}
                placeholder="Instructor..."
              />
            </div>
            <div>
              <AutocompleteInput
                items={allDepts}
                value={advDept}
                onChange={setAdvDept}
                placeholder="Department..."
              />
            </div>
            <div className="flex flex-wrap gap-3 min-w-0">
              <div className="flex-[1.5] min-w-[100px]">
                <AutocompleteInput
                  items={allSubjects}
                  value={advSubject}
                  onChange={setAdvSubject}
                  placeholder="Subject..."
                />
              </div>
              <div className="flex-1 min-w-[80px]">
                <select
                  value={advLevel}
                  onChange={(e) => setAdvLevel(e.target.value)}
                  className={FILTER_CONTROL_CLASS}
                >
                  <option value="">All Levels</option>
                  {getLevels().map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {advFilteredCourses.map(course => {
              const isSelected = selectedCourses.includes(course.full_code);
              const isMustTake = mustTakeCourses.includes(course.full_code);
              const isEligible = isCourseEligible(course);
              const isFav = favourites.includes(course.full_code);

              return (
                <div
                  key={course.full_code}
                  className={`border rounded-xl p-3 md:p-4 transition-all duration-150 ${
                    isSelected
                      ? 'border-cuhk-primary bg-cuhk-primary/5 shadow-sm'
                      : 'border-slate-200 hover:border-cuhk-primary/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5 md:mb-2">
                    <h3
                      className="font-bold text-slate-900 text-sm md:text-base cursor-pointer hover:text-cuhk-primary"
                      onClick={() => setSelectedModalCourse(course)}
                    >
                      {course.full_code}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setFavourites(isFav ? favourites.filter(f => f !== course.full_code) : [...favourites, course.full_code])}
                      aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
                      aria-pressed={isFav}
                      className="p-1 rounded-md cursor-pointer transition-all duration-150 active:scale-90
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
                    >
                      <Star
                        className={`h-4 w-4 md:h-5 md:w-5 ${isFav ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`}
                        fill={isFav ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>
                  <p
                    className="text-xs md:text-sm text-slate-600 line-clamp-2 min-h-[2rem] md:min-h-[2.5rem] mb-1.5 md:mb-2 cursor-pointer hover:text-slate-800"
                    onClick={() => setSelectedModalCourse(course)}
                  >
                    {course.title}
                  </p>
                  <div className="flex gap-2 text-xs md:text-sm text-slate-500 mb-2 md:mb-3">
                    <span>{course.units} {course.units === 1 ? 'Unit' : 'Units'}</span>
                    <span>•</span>
                    <span className="truncate">{course.career}</span>
                  </div>

                  <div className="flex gap-1.5 md:gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 bg-white text-slate-700"
                      onClick={() => setSelectedModalCourse(course)}
                    >
                      Details
                    </Button>

                    {isSelected && (
                      <MustToggle
                        active={isMustTake}
                        className="flex-1"
                        onClick={() => {
                          if (isMustTake) setMustTakeCourses(mustTakeCourses.filter(c => c !== course.full_code));
                          else setMustTakeCourses([...mustTakeCourses, course.full_code]);
                        }}
                      />
                    )}

                    {isSelected ? (
                      <Button
                        variant="dangerGhost"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedCourses(selectedCourses.filter(c => c !== course.full_code));
                          if (isMustTake) setMustTakeCourses(mustTakeCourses.filter(c => c !== course.full_code));
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        variant="soft"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedCourses([...selectedCourses, course.full_code])}
                      >
                        Add
                      </Button>
                    )}
                  </div>

                  {!isEligible && (
                    <div className="mt-2 md:mt-3 flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      Prerequisites not met
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'favorites' && (
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h2 className="text-lg md:text-2xl font-bold flex items-center gap-2">
              My Favourites
            </h2>
            <Button variant="link" onClick={() => setViewMode('main')} className="px-0!">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
          {favourites.length > 0 ? (
            <>
              <Button
                variant="secondary"
                className="w-full mb-3 md:mb-4"
                onClick={() => { setSelectedCourses([...new Set([...selectedCourses, ...favourites])]); setViewMode('main'); }}
              >
                Load All to Selection
              </Button>
              <div className="max-h-80 md:max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-1.5 md:p-2">
                {favourites.map(code => {
                  const course = allCourses.find(c => c.full_code === code);
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between p-1.5 md:p-2 hover:bg-slate-50 rounded transition-colors duration-100"
                    >
                      <div
                        className="min-w-0 cursor-pointer"
                        onClick={() => course && setSelectedModalCourse(course)}
                      >
                        <span className="font-medium text-slate-800 text-sm md:text-base">{code}</span>
                        <span className="text-xs md:text-sm text-slate-500 ml-2 truncate">{course ? course.title : '[Not available this term]'}</span>
                      </div>
                      <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                        {course && (
                          <Button variant="link" size="sm" onClick={() => setSelectedModalCourse(course)}>
                            Details
                          </Button>
                        )}
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          onClick={() => setFavourites(favourites.filter(f => f !== code))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <p className="text-center text-slate-500 py-4 text-sm md:text-base">No favourites yet.</p>}
        </div>
      )}

      {selectedModalCourse && <CourseModal course={selectedModalCourse} onClose={() => setSelectedModalCourse(null)} />}
    </div>
  );
};

export default MainContent;