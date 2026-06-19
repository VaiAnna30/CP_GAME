import { create } from 'zustand';
import api from '../services/api';

const useMatchStore = create((set, get) => ({
  currentMatch: null,
  matches: [],
  activityFeed: [],
  loading: false,
  error: null,

  // Fetch open lobbies
  fetchMatches: async (status) => {
    set({ loading: true });
    try {
      const params = status ? `?status=${status}` : '';
      const data = await api.get(`/matches${params}`);
      set({ matches: data.matches, loading: false });
    } catch (error) {
      set({ loading: false, error: error.message });
    }
  },

  // Get single match
  fetchMatch: async (matchId) => {
    set({ loading: true });
    try {
      const data = await api.get(`/matches/${matchId}`);
      set({ currentMatch: data.match, loading: false });
      return data.match;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  // Create match
  createMatch: async (teamId, gridSize, settings) => {
    set({ loading: true, error: null });
    try {
      const data = await api.post('/matches', { teamId, gridSize, settings });
      set({ currentMatch: data.match, loading: false });
      return data.match;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  // Join match
  joinMatch: async (matchId, teamId) => {
    set({ loading: true });
    try {
      const data = await api.post(`/matches/${matchId}/join`, { teamId });
      set({ currentMatch: data.match, loading: false });
      return data.match;
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  // Ready toggle
  toggleReady: async (matchId) => {
    try {
      const data = await api.post(`/matches/${matchId}/ready`);
      set({ currentMatch: data.match });
      return data.match;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Forfeit
  forfeitMatch: async (matchId) => {
    try {
      await api.post(`/matches/${matchId}/forfeit`);
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Update match state (from socket events)
  updateMatchState: (match) => {
    set({ currentMatch: match });
  },

  // Update a single cell
  updateCell: (cellData) => {
    const match = get().currentMatch;
    if (!match) return;

    const updatedBoard = match.board.map((cell) => {
      if (cell.row === cellData.row && cell.col === cellData.col) {
        return {
          ...cell,
          claimedBy: cellData.color,
          claimedByUser: cellData.userId,
          claimTime: cellData.claimTime,
          submissionId: cellData.submissionId,
        };
      }
      return cell;
    });

    // Update team cell counts
    const updatedTeams = match.teams.map((team) => ({
      ...team,
      cellsClaimed: updatedBoard.filter((c) => c.claimedBy === team.color).length,
    }));

    set({
      currentMatch: {
        ...match,
        board: updatedBoard,
        teams: updatedTeams,
      },
    });
  },

  // Add activity feed entry
  addActivityEntry: (entry) => {
    set((state) => ({
      activityFeed: [entry, ...state.activityFeed].slice(0, 50),
    }));
  },

  // End match
  endMatch: (result) => {
    const match = get().currentMatch;
    if (!match) return;

    set({
      currentMatch: {
        ...match,
        status: 'completed',
        winner: result.winner,
        winCondition: result.condition,
      },
    });
  },

  clearMatch: () => {
    set({ currentMatch: null, activityFeed: [] });
  },

  clearError: () => set({ error: null }),
}));

export default useMatchStore;
