import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Debug: Log API URL on app load
console.log('🌐 API Base URL:', API_URL);
console.log('🔧 Environment:', process.env.NODE_ENV);
console.log('📦 REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  getLeaderboard: (limit) => api.get(`/users/leaderboard/top?limit=${limit}`),
  delete: (id) => api.delete(`/users/${id}`),
};

// Tests API
export const testsAPI = {
  getAll: (params) => api.get('/tests', { params }),
  getById: (id) => api.get(`/tests/${id}`),
  getFull: (id, review) => api.get(`/tests/${id}/full${review ? '?review=true' : ''}`),
  create: (data) => api.post('/tests', data),
  update: (id, data) => api.put(`/tests/${id}`, data),
  publish: (id, publish) => api.patch(`/tests/${id}/publish`, { publish }),
  delete: (id) => api.delete(`/tests/${id}`),
  getStatistics: (id) => api.get(`/tests/${id}/statistics`),
};

// Questions API
export const questionsAPI = {
  getByTestId: (testId) => api.get(`/questions/test/${testId}`),
  getById: (id) => api.get(`/questions/${id}`),
  create: (data) => api.post('/questions', data),
  bulkCreate: (data) => api.post('/questions/bulk', data),
  update: (id, data) => api.put(`/questions/${id}`, data),
  delete: (id) => api.delete(`/questions/${id}`),
  reorder: (data) => api.post('/questions/reorder', data),
};

// Results API
export const resultsAPI = {
  submit: (data) => api.post('/results/submit', data),
  getUserResults: (userId) => api.get(`/results/user/${userId}`),
  getById: (id) => api.get(`/results/${id}`),
  getTestResults: (testId) => api.get(`/results/test/${testId}`),
};

// Portfolio API
export const portfolioAPI = {
  getByUserId: (userId) => api.get(`/portfolio/${userId}`),
  getItem: (id) => api.get(`/portfolio/item/${id}`),
  create: (data) => api.post('/portfolio', data),
  update: (id, data) => api.put(`/portfolio/${id}`, data),
  delete: (id) => api.delete(`/portfolio/${id}`),
};

// Statistics API
export const statisticsAPI = {
  getUserStats: (userId) => api.get(`/statistics/user/${userId}`),
  getLeaderboard: (limit) => api.get(`/statistics/leaderboard?limit=${limit}`),
  getOverall: () => api.get('/statistics/overall'),
  getProgress: (userId) => api.get(`/statistics/progress/${userId}`),
};

// AI Analytics API
export const aiAnalyticsAPI = {
  getData: () => api.get('/ai-analytics/data'),
  analyze: () => api.post('/ai-analytics/analyze'),
  ask: (data) => api.post('/ai-analytics/ask', data),
};

// Forum API
export const forumAPI = {
  getCategories: () => api.get('/forum/categories'),
  getPosts: (params) => api.get('/forum/posts', { params }),
  getPost: (id) => api.get(`/forum/posts/${id}`),
  createPost: (data) => api.post('/forum/posts', data),
  updatePost: (id, data) => api.put(`/forum/posts/${id}`, data),
  deletePost: (id) => api.delete(`/forum/posts/${id}`),
  pinPost: (id) => api.patch(`/forum/posts/${id}/pin`),
  createComment: (postId, data) => api.post(`/forum/posts/${postId}/comments`, data),
  deleteComment: (id) => api.delete(`/forum/comments/${id}`),
  markBestAnswer: (id) => api.patch(`/forum/comments/${id}/best`),
  vote: (data) => api.post('/forum/vote', data),
  getMyVotes: (postId) => api.get(`/forum/my-votes?post_id=${postId}`),
  aiAnswer: (postId) => api.post(`/forum/posts/${postId}/ai-answer`),
  getTopHelpers: () => api.get('/forum/top-helpers'),
  getStats: () => api.get('/forum/stats'),
};

export default api;
