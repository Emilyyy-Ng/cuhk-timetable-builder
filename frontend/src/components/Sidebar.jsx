// frontend/src/components/Sidebar.jsx
import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw, ChevronsLeft, ChevronUp, ChevronDown, GripVertical, Upload, Lock, X, Loader2 } from 'lucide-react';
import { uploadTranscript } from '../api';
import Button from './ui/Button';
import { useToast } from './ui/Toast';

// Accessible toggle switch
function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <span className="text-base text-slate-700">{label}</span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className="relative w-10 h-6 rounded-full bg-slate-300 transition-colors duration-150
                   peer-checked:bg-cuhk-primary
                   peer-focus-visible:ring-2 peer-focus-visible:ring-cuhk-primary peer-focus-visible:ring-offset-2
                   after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4
                   after:rounded-full after:bg-white after:shadow-sm
                   after:transition-transform after:duration-150
                   peer-checked:after:translate-x-4"
      />
    </label>
  );
}

const Sidebar = ({
  config,
  setConfig,
  completedCourses,
  setCompletedCourses,
  manualCoursesText,
  setManualCoursesText,
  onReset,
  onCollapse
}) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleConfigChange = (key, value) => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };

      if (key === 'term') {
        const isSummer = value.includes('Summer');
        newConfig.isSummer = isSummer;
        if (isSummer) {
          newConfig.minCredits = 0;
          newConfig.maxCredits = 6;
        } else {
          newConfig.minCredits = 9;
          newConfig.maxCredits = 18;
        }
      }

      return newConfig;
    });
  };

  const handleReset = () => {
    if (onReset) onReset();
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const movePriority = (key, direction) => {
    const currentRank = config.priorities[key];
    const newRank = currentRank + direction;
    if (newRank < 1 || newRank > 3) return;

    const swapKey = Object.keys(config.priorities).find(k => config.priorities[k] === newRank);

    setConfig(prev => ({
      ...prev,
      priorities: {
        ...prev.priorities,
        [key]: newRank,
        [swapKey]: currentRank
      }
    }));
  };

  const handleDragStart = (key) => {
    setDraggedItem(key);
  };

  const handleDrop = (targetKey) => {
    if (draggedItem === targetKey || !draggedItem) return;

    const newOrder = [
      ...[{ key: 'max_credits' }, { key: 'consecutive_days_off' }, { key: 'minimize_gaps' }]
        .sort((a, b) => config.priorities[a.key] - config.priorities[b.key])
        .map(item => item.key)
    ];

    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(targetKey);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    const newPriorities = {};
    newOrder.forEach((k, index) => {
      newPriorities[k] = index + 1;
    });

    setConfig(prev => ({ ...prev, priorities: newPriorities }));
    setDraggedItem(null);
  };

  const processFile = async (file) => {
    if (!file || isUploading) return;
    setIsUploading(true);
    try {
      const codes = await uploadTranscript(file);
      setCompletedCourses(codes);
      setFileName(file.name);
      toast.success('Transcript parsed successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to parse transcript.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    await processFile(file);
  };

  const handleDropzoneDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const manualCourses = useMemo(() => {
    if (!manualCoursesText || !manualCoursesText.trim()) return [];
    return manualCoursesText
      .split(/[,;\s]+/)
      .map(code => code.trim().toUpperCase())
      .filter(Boolean);
  }, [manualCoursesText]);

  const { transcriptCourses, manualCoursesList } = useMemo(() => {
    const transcriptSet = new Set();
    const manualSet = new Set();

    (completedCourses || []).forEach(code => {
      const normalized = String(code).trim().toUpperCase();
      if (normalized) transcriptSet.add(normalized);
    });

    manualCourses.forEach(code => {
      const normalized = String(code).trim().toUpperCase();
      if (normalized && !transcriptSet.has(normalized)) manualSet.add(normalized);
    });

    return {
      transcriptCourses: Array.from(transcriptSet).sort(),
      manualCoursesList: Array.from(manualSet).sort()
    };
  }, [completedCourses, manualCourses]);

  const allCoursesCount = transcriptCourses.length + manualCoursesList.length;

  const handleRemoveCourse = (code) => {
    setCompletedCourses(prev => prev.filter(c => String(c).trim().toUpperCase() !== code));
    setManualCoursesText(prev => {
      if (!prev) return prev;
      const remaining = prev.split(/[,;\s]+/).filter(c => c.trim() && c.trim().toUpperCase() !== code);
      return remaining.join(', ');
    });
  };

  const handleClearAllCourses = () => {
    setCompletedCourses([]);
    setManualCoursesText('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const priorityList = [
    { key: 'max_credits', label: 'Maximize Credits' },
    { key: 'consecutive_days_off', label: 'Consecutive Days Off' },
    { key: 'minimize_gaps', label: 'Minimize Gaps' }
  ].sort((a, b) => config.priorities[a.key] - config.priorities[b.key]);

  const minCredits = parseInt(config.minCredits) || 0;
  const maxCredits = parseInt(config.maxCredits) || 0;
  const invalidMinMax = minCredits > maxCredits;
  const showRegularWarning = !config.isSummer && (minCredits < 9 || maxCredits > 18);
  const showSummerWarning = config.isSummer && maxCredits > 6;
  const showCreditWarning = invalidMinMax || showRegularWarning || showSummerWarning;
  const warningLink = "https://www.res.cuhk.edu.hk/applications/current-full-time-undergraduate-students/exceeding-course-load/information-on-online-application-for-exceeding-course-load/";

  const levelOptions = [
    { value: 'Undergraduate only', label: 'Undergraduate', width: 'flex-1' },
    { value: 'Postgraduate only', label: 'Postgraduate', width: 'flex-1' },
    { value: 'Both', label: 'Both', width: 'w-16' },
  ];

  return (
    <aside className="w-full lg:w-96 bg-white border-r border-slate-200 p-6 pb-0 overflow-y-auto h-full flex-shrink-0">
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Configuration</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <button
            type="button"
            onClick={() => onCollapse?.()}
            aria-label="Hide configuration panel"
            title="Hide configuration panel"
            className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-cuhk-primary rounded-md
              cursor-pointer transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
          >
            <ChevronsLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ─── Card 1: Term & Scope ─── */}
      <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Term &amp; Scope</h3>
        <div className="relative mb-4">
          <select
            value={config.term}
            onChange={(e) => handleConfigChange('term', e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white outline-none cursor-pointer
                       text-base font-medium text-slate-700 appearance-none pr-10
                       focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary"
          >
            <option>2026-27 Term 1</option>
            <option>2026-27 Term 2</option>
            <option>2026-27 Summer Session</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {levelOptions.map(opt => {
            const active = config.courseLevel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, courseLevel: opt.value }))}
                aria-pressed={active}
                className={`${opt.width} py-1.5 px-2 rounded-md text-sm font-medium cursor-pointer
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary
                  ${active
                    ? 'bg-white text-cuhk-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Card 2: Schedule Rules ─── */}
      <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Credit Limits</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-slate-600">Min Credits</label>
            <input
              type="number"
              min="0"
              value={config.minCredits}
              onChange={(e) => handleConfigChange('minCredits', e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none
                         focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary text-base"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-600">Max Credits</label>
            <input
              type="number"
              min="0"
              value={config.maxCredits}
              onChange={(e) => handleConfigChange('maxCredits', e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none
                         focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary text-base"
            />
          </div>
        </div>

        {showCreditWarning && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg leading-relaxed">
            {invalidMinMax ? "Min credits must be less than or equal to Max credits." :
              (showSummerWarning ? (
                <>
                  A student shall take no more than 6 units in summer term. <a href={warningLink} target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-red-700">Learn more</a>.
                </>
              ) : (
                <>
                  A student shall take at least 9 units and no more than 18 units of courses in any term within the normative study period, unless on first or extended academic probation. <a href={warningLink} target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-red-700">Learn more</a>.
                </>
              ))
            }
          </div>
        )}
      </div>

      {/* ─── Card 3: Advanced Optimization ─── */}
      <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Advanced Optimization</h3>
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-sm mb-2 text-slate-600">Priorities (drag &amp; drop to reorder)</label>
            <div className="space-y-2">
              {priorityList.map((item, index) => (
                <div
                  key={item.key}
                  draggable={true}
                  onDragStart={() => handleDragStart(item.key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(item.key)}
                  className={`flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200
                    cursor-grab active:cursor-grabbing transition-all duration-150
                    ${draggedItem === item.key ? 'opacity-50 border-cuhk-primary' : 'hover:border-cuhk-primary'}`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-slate-300" />
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cuhk-primary text-white text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-base text-slate-700">{item.label}</span>
                  </div>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => movePriority(item.key, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${item.label} up`}
                      className="p-0.5 rounded cursor-pointer text-slate-400 hover:text-cuhk-primary hover:bg-slate-100
                        disabled:opacity-20 disabled:cursor-not-allowed
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePriority(item.key, 1)}
                      disabled={index === priorityList.length - 1}
                      aria-label={`Move ${item.label} down`}
                      className="p-0.5 rounded cursor-pointer text-slate-400 hover:text-cuhk-primary hover:bg-slate-100
                        disabled:opacity-20 disabled:cursor-not-allowed
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-3">
            <Toggle
              label="Block Lunch"
              checked={config.lunchEnabled}
              onChange={(v) => setConfig(prev => ({ ...prev, lunchEnabled: v }))}
            />

            {config.lunchEnabled && (
              <div className="grid grid-cols-2 gap-2 pl-1">
                <div>
                  <label className="text-sm text-slate-500 block mb-1">Start</label>
                  <input
                    type="time"
                    value={config.lunchStart || '12:15'}
                    onChange={(e) => setConfig(prev => ({ ...prev, lunchStart: e.target.value }))}
                    className="w-full p-1.5 border border-slate-300 rounded-lg text-base bg-white outline-none
                               focus:ring-2 focus:ring-cuhk-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">End</label>
                  <input
                    type="time"
                    value={config.lunchEnd || '13:00'}
                    onChange={(e) => setConfig(prev => ({ ...prev, lunchEnd: e.target.value }))}
                    className="w-full p-1.5 border border-slate-300 rounded-lg text-base bg-white outline-none
                               focus:ring-2 focus:ring-cuhk-primary"
                  />
                </div>
              </div>
            )}

            <Toggle
              label="Ignore Prereqs"
              checked={config.ignorePrereqs}
              onChange={(v) => setConfig(prev => ({ ...prev, ignorePrereqs: v }))}
            />
          </div>
        </div>
      </div>

      {/* ─── Card 4: Transcript & Completed Courses ─── */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Completed Courses</h3>

        <div
          role="button"
          tabIndex={isUploading ? -1 : 0}
          onClick={() => { if (!isUploading) fileInputRef.current?.click(); }}
          onKeyDown={(e) => {
            if (isUploading) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={isUploading ? undefined : handleDropzoneDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`border-2 border-dashed border-slate-300 rounded-lg p-4 text-center
                     transition-colors duration-150 mb-2
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary
                     ${isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-cuhk-primary hover:bg-cuhk-primary/5'}`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 text-cuhk-primary mx-auto mb-1 animate-spin" />
              <div className="text-cuhk-primary-dark font-medium text-base">Processing transcript…</div>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-cuhk-primary mx-auto mb-1" />
              <div className="text-cuhk-primary-dark font-medium text-base">Drop transcript PDF or click to browse</div>
              {fileName && (
                <div className="text-sm text-slate-500 truncate mt-1 font-medium">{fileName}</div>
              )}
            </>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-3">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Your PDF is processed in memory on our server and is never stored.</span>
        </p>

        <textarea
          value={manualCoursesText}
          onChange={(e) => setManualCoursesText(e.target.value)}
          placeholder="Or enter completed courses manually (e.g., CSCI1550, FINA2010)"
          className="w-full p-2 border border-slate-300 rounded-lg text-sm h-20 mb-3 outline-none resize-none
                     focus:ring-2 focus:ring-cuhk-primary focus:border-cuhk-primary"
        />

        {allCoursesCount > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-cuhk-primary-dark font-bold">
                {allCoursesCount} completed course{allCoursesCount !== 1 ? 's' : ''} recorded
              </span>
              <button
                type="button"
                onClick={handleClearAllCourses}
                className="text-sm text-slate-500 hover:text-red-500 font-medium cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded px-1"
              >
                Clear all
              </button>
            </div>

            {transcriptCourses.length > 0 && (
              <div className="mb-2">
                <div className="text-sm font-medium text-slate-500 mb-1">From transcript:</div>
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                  {transcriptCourses.map(code => (
                    <span key={code} className="flex items-center justify-between px-2 py-1 rounded-md text-sm font-medium border bg-cuhk-primary/10 text-cuhk-primary-dark border-cuhk-primary/20 w-full">
                      <span className="truncate">{code}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCourse(code)}
                        aria-label={`Remove ${code}`}
                        title={`Remove ${code}`}
                        className="ml-1 p-0.5 rounded cursor-pointer text-slate-400 hover:text-red-500 flex-shrink-0
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {manualCoursesList.length > 0 && (
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">Entered manually:</div>
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-white border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                  {manualCoursesList.map(code => (
                    <span key={code} className="flex items-center justify-between px-2 py-1 rounded-md text-sm font-medium border bg-amber-50 text-amber-700 border-amber-200 w-full">
                      <span className="truncate">{code}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCourse(code)}
                        aria-label={`Remove ${code}`}
                        title={`Remove ${code}`}
                        className="ml-1 p-0.5 rounded cursor-pointer text-slate-400 hover:text-red-500 flex-shrink-0
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-500 text-center border border-dashed border-slate-200 rounded-lg p-2 bg-white">
            No completed courses recorded yet
          </div>
        )}
      </div>

      {/* ── Sticky "Done" bar ── */}
      <div className="sticky bottom-0 -mx-6 mt-4 px-6 pt-3 pb-6 bg-white/95 backdrop-blur border-t border-slate-200">
        <Button
          variant="soft"
          size="lg"
          className="w-full"
          onClick={() => onCollapse?.()}
        >
          Done
        </Button>
        <p className="text-center text-xs text-slate-400 mt-2">Changes apply instantly</p>
      </div>
    </aside>
  );
};

export default Sidebar;