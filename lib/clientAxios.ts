import axios from 'axios';
import Cookies from 'js-cookie';

const clientApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

clientApi.interceptors.request.use((config) => {
  const token = Cookies.get('client_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 normally means the portal session has expired, and the right response
// is to clear it and send the client back to sign in.
//
// EXCEPT on the endpoints where a 401 is the normal answer to a normal mistake.
// Api\Client\AuthController::login() returns 401 "Invalid credentials" for a
// wrong password or an address that isn't a portal account — a validation
// failure, not an expired session. Redirecting on it reloaded the page the
// instant the login form set its error, so the message was wiped before it
// could be read and the typed email was lost with it.
//
// Same guard, same reasoning as the staff instance in lib/axios.ts.
const AUTH_ENDPOINTS = /\/client\/(login|forgot-password|reset-password)(\?|$)/;

clientApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? '';

    if (error.response?.status === 401 && !AUTH_ENDPOINTS.test(url)) {
      Cookies.remove('client_token');
      Cookies.remove('client_user');
      Cookies.remove('client_info');
      if (typeof window !== 'undefined') window.location.href = '/client/login';
    }
    return Promise.reject(error);
  }
);

export default clientApi;
