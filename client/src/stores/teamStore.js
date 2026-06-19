import { create } from 'zustand';
import api from '../services/api';

const useTeamStore = create((set, get) => ({
  teams: [],
  currentTeam: null,
  loading: false,
  error: null,

  fetchMyTeams: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/teams');
      set({ teams: data.teams, loading: false });
    } catch (error) {
      set({ loading: false, error: error.message });
    }
  },

  fetchTeam: async (teamId) => {
    set({ loading: true });
    try {
      const data = await api.get(`/teams/${teamId}`);
      set({ currentTeam: data.team, loading: false });
      return data.team;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  createTeam: async (name, tag, maxSize) => {
    set({ loading: true, error: null });
    try {
      const data = await api.post('/teams', { name, tag, maxSize });
      set((state) => ({
        teams: [...state.teams, data.team],
        loading: false,
      }));
      return data.team;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  joinTeam: async (inviteCode) => {
    set({ loading: true, error: null });
    try {
      const data = await api.post('/teams/join', { inviteCode });
      set((state) => ({
        teams: [...state.teams, data.team],
        loading: false,
      }));
      return data.team;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  deleteTeam: async (teamId) => {
    try {
      await api.delete(`/teams/${teamId}`);
      set((state) => ({
        teams: state.teams.filter((t) => t._id !== teamId),
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useTeamStore;
