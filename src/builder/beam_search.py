# src/builder/beam_search.py
import itertools
import logging
import copy
from collections import defaultdict
from typing import List, Dict, Tuple, Set, Callable, Optional
from src.builder.constraints import can_take_course, meetings_conflict, check_lunch_conflict

def calculate_consecutive_days_off(used_days: Set[int]) -> int:
    if not used_days: return 7
    valid_days = {d for d in used_days if isinstance(d, int) and 0 <= d <= 6}
    if not valid_days: return 7
    days_off = sorted(set(range(7)) - valid_days)
    if not days_off: return 0
    max_consec = current = 1
    for i in range(1, len(days_off)):
        if days_off[i] == days_off[i-1] + 1: current += 1
        else: current = 1
        max_consec = max(max_consec, current)
    if 0 in days_off and 6 in days_off:
        fwd = 0
        while fwd in days_off: fwd += 1
        bwd = 6
        while bwd in days_off: bwd -= 1
        max_consec = max(max_consec, fwd + (6 - bwd))
    return max_consec

def calculate_total_gaps(schedule: List[Tuple[Dict, Dict]]) -> int:
    daily = {d: [] for d in range(7)}
    for _, opt in schedule:
        for m in opt.get('meetings', []):
            if not m.get('is_tba') and m['day'] in daily:
                daily[m['day']].append((m['start_minutes'], m['end_minutes']))
    gap = 0
    for day, mts in daily.items():
        if len(mts) < 2: continue
        mts.sort()
        for i in range(len(mts)-1):
            if mts[i+1][0] - mts[i][1] > 0: gap += mts[i+1][0] - mts[i][1]
    return gap

def calculate_schedule_score(schedule: List[Tuple[Dict, Dict]], max_credits: int, priority_order: Dict[str, int]) -> float:
    if not schedule: return -float('inf')
    total_credits = sum(c.get('units', 0) for c, _ in schedule)
    used_days = {m['day'] for _, opt in schedule for m in opt.get('meetings', []) if not m.get('is_tba')}
    consec_off = calculate_consecutive_days_off(used_days)
    total_gaps = calculate_total_gaps(schedule)
    
    credit_score = min(1.0, total_credits / max_credits) if max_credits > 0 and total_credits > 0 else 0.0
    days_off_score = consec_off / 7.0
    gap_score = max(0.0, 1.0 - (total_gaps / 480.0))
    
    metric_scores = {'max_credits': credit_score, 'consecutive_days_off': days_off_score, 'minimize_gaps': gap_score}
    weights = {1: 100.0, 2: 10.0, 3: 1.0}
    return sum(metric_scores[m] * weights.get(int(r), 1.0) for m, r in priority_order.items())

def expand_sections(course: Dict) -> Dict:
    """
    Expands merged sections (e.g., LEC + multiple TUTs) into distinct time_options.
    Ensures the optimizer picks exactly one tutorial along with its lecture.

    PURE FUNCTION: never mutates the input `course`. Returns a NEW course dict
    (or the original object, untouched, if it has no time options). This makes
    it safe to call directly on LRU-cached course objects from
    load_courses_from_json().
    """
    if not course.get('time_options'):
        return course
    
    new_time_options = []
    for opt in course['time_options']:
        if not opt.get('meetings'):
            continue
        
        # Group meetings by their session_code (e.g., 'A-LEC', 'AT01-TUT')
        groups = defaultdict(list)
        for m in opt['meetings']:
            groups[m.get('session_code', '')].append(m)
        
        if len(groups) <= 1:
            # Share the original option — everything downstream treats opts
            # as read-only, so no copy is needed here.
            new_time_options.append(opt)
            continue
        
        # Separate main components (LEC, SEM, CLW) from secondary (TUT, LAB, PRJ)
        main_meetings = []
        secondary_by_type = defaultdict(list)
        
        for code, meetings in groups.items():
            m_type = meetings[0].get('type', 'OTHER')
            if m_type in ['LEC', 'SEM', 'CLW']:
                main_meetings.extend(meetings)
            else:
                secondary_by_type[m_type].append(meetings)
        
        if not secondary_by_type:
            new_opt = copy.deepcopy(opt)
            new_opt['meetings'] = main_meetings
            new_time_options.append(new_opt)
            continue
        
        # Create cartesian product of all secondary types
        choices = list(secondary_by_type.values())
        for combo in itertools.product(*choices):
            combined_meetings = list(main_meetings)
            for meet_group in combo:
                combined_meetings.extend(meet_group)
            
            new_opt = copy.deepcopy(opt)
            new_opt['meetings'] = combined_meetings
            
            # Update section name to be unique so the optimizer sees them as separate options
            sec_codes = [m.get('session_code', '') for m in combined_meetings if m.get('type') not in ['LEC', 'SEM', 'CLW']]
            if sec_codes:
                tut_id = sec_codes[0].split('-')[0] if '-' in sec_codes[0] else sec_codes[0]
                new_opt['section'] = f"{opt.get('section', '')}+{tut_id}"
                new_opt['section_name'] = f"{opt.get('section', '')} + {tut_id}"
            
            new_time_options.append(new_opt)

    expanded = dict(course)              # shallow copy
    expanded['time_options'] = new_time_options
    return expanded

def separate_tba_options(course: Dict) -> Tuple[Optional[Dict], bool]:
    """
    Extract all non-TBA time options from a course.
    Each time_option represents a distinct section (e.g., CA-LEC, CB-LEC).

    Does not mutate the input. The returned course's time_options are private
    deep copies, so nothing that flows out of the optimizer aliases the
    (possibly LRU-cached) input objects.
    """
    scheduled = []
    has_tba = course.get('has_tba_warning', False)
    
    # Filter out time_options that are entirely TBA
    for opt in course.get('time_options', []):
        if not opt.get('meetings'): 
            continue
        # Check if ALL meetings in this option are TBA
        if all(m.get('is_tba') for m in opt['meetings']):
            has_tba = True
        else:
            scheduled.append(opt)
    
    if scheduled:
        # Shallow-copy the course shell, deep-copy ONLY the options we keep.
        # (The old `copy.deepcopy(course)` deep-copied every option and then
        # threw those copies away when overwriting `time_options` — and it
        # still left the kept options as shared refs into the cached objects.
        # This version is both cheaper and fully isolated.)
        c_copy = dict(course)
        c_copy['time_options'] = [copy.deepcopy(o) for o in scheduled]
        c_copy['has_tba_warning'] = has_tba
        return c_copy, has_tba
    return None, True

def beam_search_optimizer(
    courses: List[Dict], completed_courses: Set[str], max_credits: int = 18, min_credits: int = 9,
    min_courses: int = 3, max_courses: int = 8, beam_width: int = 20,
    priority_order: Optional[Dict[str, int]] = None, ignore_prereqs: bool = False,
    lunch_start: Optional[int] = None, lunch_end: Optional[int] = None,
    progress_callback: Optional[Callable] = None, required_courses: Optional[Set[str]] = None
) -> List[Tuple[float, List[Tuple[Dict, Dict]]]]:
    if not courses: return []
    if priority_order is None: priority_order = {'max_credits': 1, 'consecutive_days_off': 2, 'minimize_gaps': 3}

    # Expand merged sections so tutorials and lectures are properly paired.
    # expand_sections() is now pure — it returns new course dicts and never
    # mutates its inputs, so it's safe to feed it courses straight from the
    # LRU cache (though the API's deepcopy remains fine as extra insurance).
    courses = [expand_sections(c) for c in courses]

    scheduled_courses = []
    tba_only_courses = []
    for c in courses:
        proc, _ = separate_tba_options(c)
        if proc and proc.get('time_options'): 
            scheduled_courses.append(proc)
        elif c.get('time_options'): 
            # Filter out TBA-only courses if prerequisites are not met
            if not ignore_prereqs:
                can_take, _ = can_take_course(c, completed_courses, set())
                if not can_take: continue
            tba_only_courses.append(c)

    if not scheduled_courses and not tba_only_courses: return []

    tba_credits = sum(c.get('units', 0) for c in tba_only_courses if c.get('units', 0) > 0)
    
    # If must-take TBA courses exceed limits, fail fast!
    required_courses = required_courses or set()
    required_tba_credits = sum(c.get('units', 0) for c in tba_only_courses if c.get('full_code') in required_courses and c.get('units', 0) > 0)
    if required_tba_credits > max_credits:
        raise ValueError(f"Required TBA courses exceed maximum credit limit ({required_tba_credits} > {max_credits})")

    effective_max_credits = max_credits - tba_credits
    must_take_list = [c for c in scheduled_courses if c.get('full_code') in required_courses]
    
    missing_req = required_courses - {c.get('full_code') for c in scheduled_courses + tba_only_courses}
    if missing_req:
        raise ValueError(f"Required courses not available, fully TBA, or prerequisites not met: {missing_req}")

    def is_within_limits(sched, include_tba=False, check_min=False):
        tot = sum(c.get('units', 0) for c, _ in sched if c.get('units', 0) > 0)
        if include_tba: tot += tba_credits
        if tot > max_credits: return False
        if check_min and tot < min_credits: return False
        return True

    def get_section_signature(opt: Dict) -> str:
        """Get a unique signature for a section based on its section code or meeting pattern."""
        if opt.get('meetings') and len(opt['meetings']) > 0:
            session_code = opt['meetings'][0].get('session_code', '')
            if session_code:
                return session_code
            days = sorted(set(m.get('day', -1) for m in opt['meetings'] if not m.get('is_tba')))
            times = sorted(set((m.get('start', ''), m.get('end', '')) for m in opt['meetings'] if not m.get('is_tba')))
            return f"{days}-{times}"
        return "unknown"

    def get_schedule_signature(sched: List[Tuple[Dict, Dict]]) -> frozenset:
        """Get a hashable signature for a schedule to detect duplicates."""
        sig_parts = []
        for c, opt in sched:
            section_id = get_section_signature(opt)
            sig_parts.append((c['full_code'], section_id))
        return frozenset(sig_parts)

    beam = []
    entry_id = 0
    seen_sigs = set()

    if must_take_list:
        for r in range(1, len(must_take_list) + 1):
            for combo in itertools.combinations(must_take_list, r):
                # Check prerequisites for required courses
                if not ignore_prereqs:
                    combo_valid = True
                    for c in combo:
                        can_take, _ = can_take_course(c, completed_courses, set())
                        if not can_take:
                            combo_valid = False
                            break
                    if not combo_valid: continue

                valid_combo = [c for c in combo if c.get('time_options')]
                if not valid_combo: continue
                for time_opts in itertools.product(*[c['time_options'] for c in valid_combo]):
                    sched = list(zip(valid_combo, time_opts))
                    course_codes = [c['full_code'] for c, _ in sched]
                    if len(course_codes) != len(set(course_codes)):
                        continue  # Duplicate course found - skip
                    
                    if not any(meetings_conflict(o1.get('meetings',[]), o2.get('meetings',[])) for _, o1 in sched for _, o2 in sched if o1 is not o2):
                        if is_within_limits(sched, include_tba=True):
                            sig = get_schedule_signature(sched)
                            if sig not in seen_sigs:
                                seen_sigs.add(sig)
                                beam.append((calculate_schedule_score(sched, max_credits, priority_order), entry_id, sched))
                                entry_id += 1
    else:
        # Sort courses by code for consistent initial ordering
        for c in sorted(scheduled_courses, key=lambda x: x['full_code']):
            # Check prerequisites for initial beam courses
            if not ignore_prereqs:
                can_take, _ = can_take_course(c, completed_courses, set())
                if not can_take: continue

            for opt in c.get('time_options', []):
                if lunch_start and lunch_end and check_lunch_conflict(opt['meetings'], lunch_start, lunch_end): continue
                sched = [(c, opt)]
                if is_within_limits(sched, include_tba=True):
                    sig = get_schedule_signature(sched)
                    if sig not in seen_sigs:
                        seen_sigs.add(sig)
                        beam.append((calculate_schedule_score(sched, max_credits, priority_order), entry_id, sched))
                        entry_id += 1

    # If user marked courses as "Must Take" but they all failed prereqs, raise an explicit error
    if must_take_list and not beam:
        if not ignore_prereqs:
            failed_reqs = []
            for c in must_take_list:
                can_take, reason = can_take_course(c, completed_courses, set())
                if not can_take:
                    failed_reqs.append(c.get('full_code'))
            if failed_reqs:
                raise ValueError(f"Required courses have unmet prerequisites: {', '.join(failed_reqs)}")
        raise ValueError("Required courses have time conflicts with each other or exceed credit limits.")

    beam.sort(key=lambda x: (-x[0], x[1]))
    beam = beam[:beam_width]

    all_valid = [(s, sch) for s, _, sch in beam if is_within_limits(sch, include_tba=True, check_min=True) and len(sch) >= min_courses]
    
    start_depth = len(must_take_list) if must_take_list else 1
    for depth in range(start_depth + 1, max_courses + 1):
        candidates = []
        for _, _, sched in beam:
            curr_codes = {c['full_code'] for c, _ in sched}
            curr_credits = sum(c.get('units', 0) for c, _ in sched if c.get('units', 0) > 0)
            
            for c in scheduled_courses:
                if c['full_code'] in curr_codes: continue
                if c.get('units', 0) <= 0 or curr_credits + c['units'] > effective_max_credits: continue
                if not ignore_prereqs:
                    can_take, _ = can_take_course(c, completed_courses, curr_codes)
                    if not can_take: continue
                
                for opt in c.get('time_options', []):
                    new_m = opt.get('meetings', [])
                    if any(meetings_conflict(new_m, o.get('meetings', [])) for _, o in sched): continue
                    if lunch_start and lunch_end and check_lunch_conflict(new_m, lunch_start, lunch_end): continue
                    
                    new_sched = sched + [(c, opt)]
                    course_codes = [c2['full_code'] for c2, _ in new_sched]
                    if len(course_codes) != len(set(course_codes)):
                        continue
                    
                    if is_within_limits(new_sched, include_tba=True):
                        sig = get_schedule_signature(new_sched)
                        if sig not in seen_sigs:
                            seen_sigs.add(sig)
                            candidates.append((calculate_schedule_score(new_sched, max_credits, priority_order), entry_id, new_sched))
                            entry_id += 1
                        
        if not candidates: break
        candidates.sort(key=lambda x: (-x[0], x[1]))
        beam = candidates[:beam_width]
        for s, _, sch in beam:
            if is_within_limits(sch, include_tba=True, check_min=True) and len(sch) >= min_courses:
                all_valid.append((s, sch))

    unique = []
    seen = set()
    sched_req = required_courses - {c.get('full_code') for c in tba_only_courses}

    for s, sch in sorted(all_valid, key=lambda x: x[0], reverse=True):
        sig_parts = []
        for c, opt in sch:
            section_id = get_section_signature(opt)
            sig_parts.append((c['full_code'], section_id))
        sig = frozenset(sig_parts)
        
        if sig not in seen and sched_req.issubset({c['full_code'] for c, _ in sch}):
            seen.add(sig)
            unique.append((s, sch))

    # If no scheduled courses are valid, but TBA courses exist, create a TBA-only schedule
    if not unique and tba_only_courses:
        tba_sched = [(c, {'meetings': [], 'section': 'TBA'}) for c in tba_only_courses]
        s = calculate_schedule_score(tba_sched, max_credits, priority_order)
        return [(s, tba_sched)]

    if tba_only_courses:
        final = []
        for s, sch in unique:
            new_sch = list(sch) + [(c, {'meetings': [], 'section': 'TBA'}) for c in tba_only_courses]
            final.append((s, new_sch))
        return final

    return unique 