import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('shopnest_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — clear token and redirect
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('shopnest_token');
      localStorage.removeItem('shopnest_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => API.post('/api/auth/register', data),
  login: (data) => API.post('/api/auth/login', data),
  sendOTP: (identifier, type = 'email') => API.post('/api/auth/send-otp', { identifier, type }),
  verifyOTP: (identifier, otp, purpose = 'login') => API.post('/api/auth/verify-otp', { identifier, otp, purpose }),
  googleToken: (id_token) => API.post('/api/auth/google/token', { id_token }),
  getMe: () => API.get('/api/auth/me'),
  logout: () => API.post('/api/auth/logout'),
};

export default API;
