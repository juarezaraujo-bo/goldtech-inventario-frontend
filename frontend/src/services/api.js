import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
export const API_URL = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const storedToken = localStorage.getItem('token');
  const token = storedToken?.replace(/^"|"$/g, '').trim();
  
  // Validar se o token existe e não é uma string de erro comum
  const isInvalid = !token || 
                    token === 'undefined' || 
                    token === 'null' || 
                    token === '[object Object]';

  if (!isInvalid) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Se estiver no localStorage mas for inválido, limpa
    if (storedToken) localStorage.removeItem('token');
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.response = {
        status: 503,
        data: { message: 'Servidor demorou para responder. Tente novamente em instantes.' },
      };
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
