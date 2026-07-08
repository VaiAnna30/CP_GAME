/**
 * Match Engine — Pure game logic for Tic-Tac-Toe win/draw/tiebreak detection.
 * Handles the logic independently of the database or real-time sockets.
 */
const matchEngine = {
  /**
   * Check if a specific team (color) has won the game.
   * A win is N cells in a continuous row, column, or diagonal.
   * 
   * @param {Array} board - Array of cell objects {row, col, claimedBy}
   * @param {number} gridSize - The N size of the N x N grid
   * @param {string} color - The team color ('red' or 'blue')
   * @returns {boolean} True if the team has won
   */
  checkWin(board, gridSize, color) {
    const grid = this._buildGrid(board, gridSize);

    // Check all rows for a win
    for (let r = 0; r < gridSize; r++) {
      if (grid[r].every(cellColor => cellColor === color)) return true;
    }

    // Check all columns for a win
    for (let c = 0; c < gridSize; c++) {
      let colWin = true;
      for (let r = 0; r < gridSize; r++) {
        if (grid[r][c] !== color) {
          colWin = false;
          break;
        }
      }
      if (colWin) return true;
    }

    // Check main diagonal (top-left to bottom-right)
    let mainDiagWin = true;
    for (let i = 0; i < gridSize; i++) {
      if (grid[i][i] !== color) {
        mainDiagWin = false;
        break;
      }
    }
    if (mainDiagWin) return true;

    // Check anti-diagonal (top-right to bottom-left)
    let antiDiagWin = true;
    for (let i = 0; i < gridSize; i++) {
      if (grid[i][gridSize - 1 - i] !== color) {
        antiDiagWin = false;
        break;
      }
    }
    if (antiDiagWin) return true;

    return false;
  },

  /**
   * Check if all cells on the board have been claimed.
   * 
   * @param {Array} board - Array of cell objects
   * @returns {boolean} True if board is completely filled
   */
  isBoardFull(board) {
    return board.every(cell => cell.claimedBy !== null);
  },

  /**
   * Get the exact coordinates of the winning line for frontend highlighting.
   * 
   * @param {Array} board - Array of cell objects
   * @param {number} gridSize - Grid dimension
   * @param {string} color - The winning team color
   * @returns {Array<{row, col}> | null} Array of coordinates or null if no win
   */
  getWinningLine(board, gridSize, color) {
    const grid = this._buildGrid(board, gridSize);

    // Rows
    for (let r = 0; r < gridSize; r++) {
      if (grid[r].every(cell => cell === color)) {
        return Array.from({ length: gridSize }, (_, c) => ({ row: r, col: c }));
      }
    }

    // Columns
    for (let c = 0; c < gridSize; c++) {
      let colWin = true;
      for (let r = 0; r < gridSize; r++) {
        if (grid[r][c] !== color) {
          colWin = false;
          break;
        }
      }
      if (colWin) {
        return Array.from({ length: gridSize }, (_, r) => ({ row: r, col: c }));
      }
    }

    // Main Diagonal
    let diagWin = true;
    for (let i = 0; i < gridSize; i++) {
      if (grid[i][i] !== color) {
        diagWin = false;
        break;
      }
    }
    if (diagWin) {
      return Array.from({ length: gridSize }, (_, i) => ({ row: i, col: i }));
    }

    // Anti-Diagonal
    let antiDiagWin = true;
    for (let i = 0; i < gridSize; i++) {
      if (grid[i][gridSize - 1 - i] !== color) {
        antiDiagWin = false;
        break;
      }
    }
    if (antiDiagWin) {
      return Array.from({ length: gridSize }, (_, i) => ({ row: i, col: gridSize - 1 - i }));
    }

    return null;
  },

  /**
   * Resolve a tiebreak when the board is full but no one has a Tic-Tac-Toe line.
   * Rules:
   * 1. Team with the most cells claimed wins.
   * 2. If tied on cells, team with the lowest total solve time wins.
   * 
   * @param {Array} board - Array of cell objects
   * @param {Date} matchStartedAt - Start time of the match
   * @returns {Object} { winner: 'red'|'blue'|'draw', condition: string }
   */
  resolveTiebreak(board, matchStartedAt) {
    const redCells = board.filter(c => c.claimedBy === 'red');
    const blueCells = board.filter(c => c.claimedBy === 'blue');

    // Rule 1: Most cells claimed wins
    if (redCells.length > blueCells.length) {
      return { winner: 'red', condition: 'tiebreak_cells' };
    }
    if (blueCells.length > redCells.length) {
      return { winner: 'blue', condition: 'tiebreak_cells' };
    }

    // Rule 2: Same number of cells — compare cumulative total solve time
    const startTime = new Date(matchStartedAt).getTime();

    const calculateTotalTime = (cells) => {
      return cells.reduce((total, cell) => {
        return total + (new Date(cell.claimTime).getTime() - startTime);
      }, 0);
    };

    const redTotalTime = calculateTotalTime(redCells);
    const blueTotalTime = calculateTotalTime(blueCells);

    if (redTotalTime < blueTotalTime) {
      return { winner: 'red', condition: 'tiebreak_time' };
    }
    if (blueTotalTime < redTotalTime) {
      return { winner: 'blue', condition: 'tiebreak_time' };
    }

    // Absolutely equal performance (very rare)
    return { winner: 'draw', condition: 'tiebreak_time' };
  },

  /**
   * Determine the current status of the match (ongoing, won, or drawn).
   * 
   * @param {Array} board - Array of cell objects
   * @param {number} gridSize - Grid dimension
   * @param {Date} matchStartedAt - Start time of the match
   * @returns {Object} Match evaluation result
   */
  evaluateMatch(board, gridSize, matchStartedAt) {
    // 1. Check if 'red' has a winning line
    if (this.checkWin(board, gridSize, 'red')) {
      return {
        finished: true,
        winner: 'red',
        condition: 'line',
        winningLine: this.getWinningLine(board, gridSize, 'red'),
      };
    }

    // 2. Check if 'blue' has a winning line
    if (this.checkWin(board, gridSize, 'blue')) {
      return {
        finished: true,
        winner: 'blue',
        condition: 'line',
        winningLine: this.getWinningLine(board, gridSize, 'blue'),
      };
    }

    // 3. If no line, check if the board is completely full (trigger tiebreaker)
    if (this.isBoardFull(board)) {
      const tiebreak = this.resolveTiebreak(board, matchStartedAt);
      return {
        finished: true,
        winner: tiebreak.winner,
        condition: tiebreak.condition,
        winningLine: null,
      };
    }

    // Match is still ongoing
    return { finished: false, winner: null, condition: null, winningLine: null };
  },

  _buildGrid(board, gridSize) {
    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    for (const cell of board) {
      grid[cell.row][cell.col] = cell.claimedBy;
    }
    return grid;
  }
};

module.exports = matchEngine;
