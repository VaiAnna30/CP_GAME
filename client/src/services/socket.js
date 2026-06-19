import { io } from 'socket.io-client';

const isProd = import.meta.env.PROD;
const defaultSocketUrl = isProd ? window.location.origin : 'http://localhost:5000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultSocketUrl;

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    const token = localStorage.getItem('cf_token');
    if (!token) return;

    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // Re-register all listeners
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        this.socket.on(event, cb);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }

    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event).filter((cb) => cb !== callback);
      if (callbacks.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, callbacks);
      }
    }
  }

  joinMatch(matchId) {
    this.emit('join_match', matchId);
  }

  leaveMatch(matchId) {
    this.emit('leave_match', matchId);
  }

  spectateMatch(matchId) {
    this.emit('spectate_match', matchId);
  }
}

const socketService = new SocketService();
export default socketService;
