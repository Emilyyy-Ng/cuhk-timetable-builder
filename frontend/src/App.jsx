// frontend/src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronsRight, XCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import Button from './components/ui/Button';
import { ToastProvider } from './components/ui/Toast';
import { fetchCourses } from './api';

const DEFAULT_CONFIG = {
  term: '2026-27 Term 1',
  courseLevel: 'Undergraduate only',
  minCredits: 9,
  maxCredits: 18,
  isSummer: false,
  priorities: { max_credits: 1, consecutive_days_off: 2, minimize_gaps: 3 },
  lunchEnabled: false,
  lunchStart: '12:00',
  lunchEnd: '13:00',
  ignorePrereqs: false,
};

const loadFavourites = () => {
  try {
    const saved = localStorage.getItem('cuhk_favourites');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [completedCourses, setCompletedCourses] = useState([]);
  const [manualCoursesText, setManualCoursesText] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [mustTakeCourses, setMustTakeCourses] = useState([]);
  const [favourites, setFavourites] = useState(loadFavourites);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [viewMode, setViewMode] = useState('main');
  const [allCourses, setAllCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [coursesError, setCoursesError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const bannerRef = useRef(null);
  const [chevronOnBanner, setChevronOnBanner] = useState(false);

  // Detect whether the chevron button overlaps the banner
  useEffect(() => {
    // Only relevant when sidebar is closed (button is visible)
    if (sidebarOpen) {
      setChevronOnBanner(false);
      return;
    }

    const button = document.querySelector('[aria-label="Show configuration panel"]');
    if (!button || !bannerRef.current) return;

    const checkOverlap = () => {
      const banner = bannerRef.current;
      const btn = document.querySelector('[aria-label="Show configuration panel"]');
      if (!banner || !btn) return;

      const br = banner.getBoundingClientRect();
      const btr = btn.getBoundingClientRect();

      const overlaps =
        btr.bottom > br.top &&
        btr.top < br.bottom &&
        btr.right > br.left &&
        btr.left < br.right;

      setChevronOnBanner(overlaps);
    };

    // Initial check (after a tick so layout is settled)
    const raf = requestAnimationFrame(checkOverlap);

    const scrollContainer = document.querySelector('main');
    const scrollTarget = scrollContainer || window;
    scrollTarget.addEventListener('scroll', checkOverlap, { passive: true });
    window.addEventListener('resize', checkOverlap, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      scrollTarget.removeEventListener('scroll', checkOverlap);
      window.removeEventListener('resize', checkOverlap);
    };
  }, [sidebarOpen, isLoading]); // re-check when sidebar toggles or loading state changes (banner height)

  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setCoursesError(null);
    try {
      const data = await fetchCourses(config.term);
      setAllCourses(data);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCoursesError(error);
    } finally {
      setIsLoading(false);
    }
  }, [config.term]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    try { localStorage.setItem('cuhk_favourites', JSON.stringify(favourites)); }
    catch (e) { console.warn("Could not save favourites", e); }
  }, [favourites]);

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG });
    setSelectedCourses([]);
    setMustTakeCourses([]);
    setCompletedCourses([]);
    setManualCoursesText('');
    setOptimizationResults(null);
    setViewMode('main');
  };

  const sidebarProps = {
    config, setConfig,
    completedCourses, setCompletedCourses,
    manualCoursesText, setManualCoursesText,
    onReset: handleReset,
    onCollapse: () => setSidebarOpen(false),
  };

  return (
    <ToastProvider>
      <div className="relative flex h-screen bg-slate-50 text-slate-800 overflow-hidden">

        {/* ── Mobile sidebar overlay (< lg) ── */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/50 transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative z-10 h-full w-full max-w-[24rem] bg-white overflow-y-auto shadow-2xl">
              <Sidebar {...sidebarProps} />
            </aside>
          </div>
        )}

        {/* ── Desktop sidebar (≥ lg, in flex flow) ── */}
        <div
          className={`hidden lg:block flex-shrink-0 overflow-hidden transition-all duration-300 ${
            sidebarOpen ? 'w-96' : 'w-0'
          }`}
        >
          <div className="w-96 h-full">
            <Sidebar {...sidebarProps} />
          </div>
        </div>

        {/* ── Show-config button (visible when sidebar is closed) ── */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Show configuration panel"
            title="Show configuration panel"
            className={
              `absolute top-6 left-2 z-40 p-1.5 rounded-md cursor-pointer transition-colors duration-150 ` +
              `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary ` +
              (chevronOnBanner
                ? 'text-white hover:bg-white/20 hover:text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-cuhk-primary')
            }
          >
            <ChevronsRight className="h-5 w-5" />
          </button>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-8">
            <div
              ref={bannerRef}
              className="bg-gradient-to-r from-cuhk-primary to-cuhk-accent rounded-2xl p-5 sm:p-8 text-center text-white mb-6 sm:mb-8 shadow-lg"
            >
              <h1 className="text-xl sm:text-4xl font-bold mb-1 sm:mb-2">CUHK Schedule Builder</h1>
              <p className="text-sm sm:text-lg text-white/85 hidden md:block">Intelligent scheduling • Beam search optimization • Zero conflicts</p>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-40 w-full"></div>)}
              </div>
            ) : coursesError ? (
              <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
                <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" aria-hidden="true" />
                <h2 className="text-lg font-bold text-slate-800 mb-1">Couldn't load the course catalogue</h2>
                <p className="text-sm text-slate-500 mb-4">Please check your connection and try again.</p>
                <Button onClick={loadCourses}>Retry</Button>
              </div>
            ) : (
              <MainContent
                viewMode={viewMode} setViewMode={setViewMode}
                allCourses={allCourses}
                selectedCourses={selectedCourses} setSelectedCourses={setSelectedCourses}
                mustTakeCourses={mustTakeCourses} setMustTakeCourses={setMustTakeCourses}
                favourites={favourites} setFavourites={setFavourites}
                config={config} completedCourses={completedCourses}
                optimizationResults={optimizationResults} setOptimizationResults={setOptimizationResults}
              />
            )}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;