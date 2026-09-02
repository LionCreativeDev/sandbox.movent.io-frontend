import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url: string = error.config?.url ?? '';

      // Login/Google-exchange/resume-payment endpoints return 401 for wrong
      // credentials — that's a normal validation failure the calling page
      // already shows via toast + field errors, not an expired session.
      // Redirecting here wiped the error off the login screen before the
      // user could read it.
      const isAuthEndpoint = /\/(login|auth\/google\/exchange|resume-payment)(\?|$)/.test(url);
      if (isAuthEndpoint) return Promise.reject(error);

      const authType = Cookies.get('auth_type');
      // Sub users legitimately get 401 on /admin/* endpoints — don't log them out.
      // Only clear session when the user's own endpoint (e.g. /user/me) returns 401,
      // which means their token has expired or is invalid.
      const isAdminEndpoint = url.startsWith('/admin/') || url.startsWith('/super-admin/');
      if (!(authType === 'user' && isAdminEndpoint)) {
        Cookies.remove('auth_token');
        Cookies.remove('auth_user');
        Cookies.remove('auth_type');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
