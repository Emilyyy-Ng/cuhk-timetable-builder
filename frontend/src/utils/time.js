// frontend/src/utils/time.js
export const formatTime = (timeValue) => {
  if (timeValue === null || timeValue === undefined) return "TBA";
  if (typeof timeValue === 'number' && timeValue < 0) return "TBA";
  if (typeof timeValue === 'number') {
    const h = Math.floor(timeValue / 60);
    const m = timeValue % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  if (typeof timeValue === 'string') {
    if (timeValue === 'TBA') return 'TBA';
    if (timeValue.length === 4 && !isNaN(timeValue)) return `${timeValue.slice(0,2)}:${timeValue.slice(2)}`;
    return timeValue;
  }
  return String(timeValue);
};

export const timeToMinutes = (str) => {
  if (!str || str === 'TBA') return -1;
  const [h, m] = str.split(':').map(Number);
  return (h * 60) + m;
};