import axios from 'axios';

export const API_BASE_URL = 'https://bouncy-ember-enlisted.ngrok-free.dev/api/v1';
export const SOCKET_URL = 'http://localhost:5000';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 15000,
});

// Request interceptor to attach admin authorization token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('readygo_admin_token') || 'dev_admin_token';
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error handling
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    console.error('[API Error]:', message, error.response?.data);
    return Promise.reject(error);
  }
);

export default axiosClient;

