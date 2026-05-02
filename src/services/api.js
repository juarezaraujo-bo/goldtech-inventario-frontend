import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  // Validar se o token existe e não é uma string de erro comum
  const isInvalid = !token || 
                    token === 'undefined' || 
                    token === 'null' || 
                    token === '[object Object]';

  if (!isInvalid) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Se estiver no localStorage mas for inválido, limpa
    if (token) localStorage.removeItem('token');
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
