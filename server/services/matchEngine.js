/**
 * Match Engine — Pure game logic for win/draw/tiebreak detection
 */
const matchEngine = {
  /**
   * Check if a team has won (N in a row/column/diagonal)
   * @param {Array} board - array of cell objects
   * @param {number} gridSize
   * @param {string} color - 'red' or 'blue'
   * @returns {boolean}
   */
  checkWin(board, gridSize, color) {
    const grid = this._buildGrid(board, gridSize);

    // Check rows
    for (let r = 0; r < gridSize; r++) {
      if (grid[r].every((cell) => cell === color)) return true;
    }

    // Check columns
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

    // Check main diagonal
    let diagWin = true;
    for (let i = 0; i < gridSize; i++) {
      if (grid[i][i] !== color) {
        diagWin = false;
        break;
      }
    }
    if (diagWin) return true;

    // Check anti-diagonal
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
   * Check if the board is full (draw condition)
   */
  isBoardFull(board) {
    return board.every((cell) => cell.claimedBy !== null);
  },

  /**
   * Get the winning line cells (for highlighting)
   * Returns array of { row, col } or null if no winner
   */
  getWinningLine(board, gridSize, color) {
    const grid = this._buildGrid(board, gridSize);

    // Check rows
    for (let r = 0; r < gridSize; r++) {
      if (grid[r].every((cell) => cell === color)) {
        return Array.from({ length: gridSize }, (_, c) => ({ row: r, col: c }));
      }
    }

    // Check columns
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

    // Check main diagonal
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

    // Check anti-diagonal
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
   * Resolve tiebreak when board is full with no line
   * 1. Most cells claimed wins
   * 2. If tied, lowest total solve time wins
   */
  resolveTiebreak(board, matchStartedAt) {
    const redCells = board.filter((c) => c.claimedBy === 'red');
    const blueCells = board.filter((c) => c.claimedBy === 'blue');

    // Most cells
    if (redCells.length > blueCells.length) {
      return { winner: 'red', condition: 'tiebreak_cells' };
    }
    if (blueCells.length > redCells.length) {
      return { winner: 'blue', condition: 'tiebreak_cells' };
    }

    // Same number of cells — compare total solve time
    const startTime = new Date(matchStartedAt).getTime();

    const redTotalTime = redCells.reduce((sum, c) => {
      return sum + (new Date(c.claimTime).getTime() - startTime);
    }, 0);

    const blueTotalTime = blueCells.reduce((sum, c) => {
      return sum + (new Date(c.claimTime).getTime() - startTime);
    }, 0);

    if (redTotalTime < blueTotalTime) {
      return { winner: 'red', condition: 'tiebreak_time' };
    }
    if (blueTotalTime < redTotalTime) {
      return { winner: 'blue', condition: 'tiebreak_time' };
    }

    return { winner: 'draw', condition: 'tiebreak_time' };
  },

  /**
   * Determine match result after a cell claim
   */
  evaluateMatch(board, gridSize, matchStartedAt) {
    // Check if either team won by line
    if (this.checkWin(board, gridSize, 'red')) {
      return {
        finished: true,
        winner: 'red',
        condition: 'line',
        winningLine: this.getWinningLine(board, gridSize, 'red'),
      };
    }
    if (this.checkWin(board, gridSize, 'blue')) {
      return {
        finished: true,
        winner: 'blue',
        condition: 'line',
        winningLine: this.getWinningLine(board, gridSize, 'blue'),
      };
    }

    // Check if board is full
    if (this.isBoardFull(board)) {
      const tiebreak = this.resolveTiebreak(board, matchStartedAt);
      return {
        finished: true,
        winner: tiebreak.winner,
        condition: tiebreak.condition,
        winningLine: null,
      };
    }

    return { finished: false, winner: null, condition: null, winningLine: null };
  },

  /**
   * Build a 2D grid from flat board array
   */
  _buildGrid(board, gridSize) {
    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    for (const cell of board) {
      grid[cell.row][cell.col] = cell.claimedBy;
    }
    return grid;
  },
};

module.exports = matchEngine;
