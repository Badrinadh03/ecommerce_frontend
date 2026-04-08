import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const API = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,   // ← Sends httpOnly cookie automatically on every request
});

// ── No token logic needed — cookie is sent automatically by browser ──

function shouldIgnore401(url = '') {
  return (
    url.includes('/api/auth/me')         ||   // verifySession handles this gracefully
    url.includes('/api/auth/login')      ||
    url.includes('/api/auth/register')   ||
    url.includes('/api/auth/send-otp')   ||
    url.includes('/api/auth/verify-otp') ||
    url.includes('/api/auth/google')     ||
    url.includes('/api/admin/login')     ||
    url.includes('/api/admin/seed')
  );
}

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !shouldIgnore401(err.config?.url)) {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        // Clear any leftover admin data from localStorage
        localStorage.removeItem('shopnest_admin');
        window.location.href = '/admin/login';
      } else {
        // Clear any leftover user data from localStorage
        localStorage.removeItem('shopnest_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────
export const authAPI = {
  register:      (data) => API.post('/api/auth/register', data),
  login:         (data) => API.post('/api/auth/login', data),
  sendOTP:       (identifier, type = 'email') => API.post('/api/auth/send-otp', { identifier, type }),
  verifyOTP:     (identifier, otp, purpose = 'login') => API.post('/api/auth/verify-otp', { identifier, otp, purpose }),
  googleToken:   (id_token) => API.post('/api/auth/google/token', { id_token }),
  getMe:         () => API.get('/api/auth/me'),
  updateProfile: (data) => API.put('/api/auth/profile', data),
  logout:        () => API.post('/api/auth/logout'),
};

// ── Orders ───────────────────────────────
export const orderAPI = {
  placeOrder:        (data)   => API.post('/api/orders/', data),
  getOrders:         (params) => API.get('/api/orders/', { params }),
  getOrder:          (id)     => API.get(`/api/orders/${id}`),
  cancelOrder:       (id)     => API.patch(`/api/orders/${id}/cancel`),
  requestPaymentOTP: (amount) => API.post('/api/orders/request-payment-otp', { amount }),
};

// ── Notifications ─────────────────────────
export const notificationAPI = {
  getAll:        (limit = 20) => API.get('/api/notifications/', { params: { limit } }),
  getUnreadCount: ()          => API.get('/api/notifications/unread-count'),
  markAllRead:   ()           => API.post('/api/notifications/mark-read'),
  markOneRead:   (id)         => API.post(`/api/notifications/${id}/read`),
};

// ── Cart (DB sync) ────────────────────────
export const cartAPI = {
  getCart:    ()              => API.get('/api/cart/'),
  saveCart:   (items)         => API.post('/api/cart/', { items }),
  addItem:    (item)          => API.post('/api/cart/items', { item }),
  updateItem: (itemId, qty)   => API.put(`/api/cart/items/${itemId}`, { qty }),
  removeItem: (itemId)        => API.delete(`/api/cart/items/${itemId}`),
  clearCart:  ()              => API.delete('/api/cart/'),
};

// ── Admin ────────────────────────────────
export const adminAPI = {
  login:         (data) => API.post('/api/admin/login', data),
  seed:          (data) => API.post('/api/admin/seed', data),
  logout:        ()     => API.post('/api/admin/logout'),
  getStats:      ()     => API.get('/api/admin/stats'),
  getProducts:   ()     => API.get('/api/admin/products'),
  addProduct:    (data) => API.post('/api/admin/products', data),
  updateProduct: (id, data) => API.put(`/api/admin/products/${id}`, data),
  deleteProduct: (id)   => API.delete(`/api/admin/products/${id}`),

  // ── PySpark Analytics — read results ──────────────────────────────
  getAnalytics:   (days = 7)  => API.get('/api/admin/analytics/sales', { params: { days } }),
  getFunnel:      ()           => API.get('/api/admin/analytics/funnel'),
  getKafkaEvents: (limit = 50) => API.get('/api/admin/analytics/kafka-events', { params: { limit } }),

  // ── Analytics job triggers — run on server ─────────────────────────
  runSalesReport:      (days = 7) => API.post('/api/admin/analytics/run-sales', { days }),
  runRecommendations:  ()          => API.post('/api/admin/analytics/run-recommendations'),
  runFunnel:           ()          => API.post('/api/admin/analytics/run-funnel'),
  runAllJobs:          (days = 7) => API.post('/api/admin/analytics/run-all', { days }),
  setupCollections:    ()          => API.post('/api/admin/analytics/setup-collections'),
  backfillEvents:      ()          => API.post('/api/admin/analytics/backfill'),
  getJobStatus:        (jobName)   => API.get(`/api/admin/analytics/job-status/${jobName}`),
  getAllJobStatuses:    ()          => API.get('/api/admin/analytics/job-status'),
};

// ── Recommendations (PySpark) ─────────────
export const recommendationsAPI = {
  getForProduct: (productId) => API.get(`/api/products/recommendations/${productId}`),
};

// ── Products (public) ────────────────────
export const productAPI = {
  getAll:       (params) => API.get('/api/products/', { params }),
  getOne:       (id)     => API.get(`/api/products/${id}`),
  getCategories: ()      => API.get('/api/products/meta/categories'),
  getFeatured:   ()      => API.get('/api/products/meta/featured'),
};

export const getImageUrl = (path) => {
  if (!path) return 'https://placehold.co/300x300?text=No+Image';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
};

export default API;
