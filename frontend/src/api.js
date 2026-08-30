// frontend/src/api.js
import axios from 'axios';

/**
 * Base URL resolution:
 *  • Dev:      Vite proxies /api → http://localhost:8000 (see vite.config.js)
 *  • Netlify:  _redirects proxies /api → your backend (see netlify.toml)
 * So in BOTH cases we just use relative URLs. If you'd rather call the
 * backend directly, set VITE_API_BASE_URL in the build environment.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const fetchCourses = async (term) => {
  const response = await axios.get(`${API_BASE_URL}/api/courses`, { params: { term } });
  return response.data.data;
};

export const optimizeSchedule = async (payload) => {
  const response = await axios.post(`${API_BASE_URL}/api/optimize`, payload);
  return response.data.schedules;
};

export const uploadTranscript = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_BASE_URL}/api/upload-transcript`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.completed_courses;
};