import { create } from 'zustand';
import api from '../services/api';
import socketService from '../services/socket';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('cf_user')) || null,
  token: localStorage.getItem('cf_token') || null,
  isAuthenticated: !!localStorage.getItem('cf_token'),
  loading: false,
  error: null,

  register: async (username, email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.post('/auth/register', { username, email, password });
      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      socketService.connect();
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        loading: false,
      });
      return data;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      socketService.connect();
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        loading: false,
      });
      return data;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user');
    socketService.disconnect();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  fetchCurrentUser: async () => {
    try {
      const data = await api.get('/auth/me');
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      set({ user: data.user });
    } catch (error) {
      // Token might be invalid
      get().logout();
    }
  },

  updateUser: (userData) => {
    const updated = { ...get().user, ...userData };
    localStorage.setItem('cf_user', JSON.stringify(updated));
    set({ user: updated });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
