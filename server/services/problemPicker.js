const cfApi = require('./cfApi');
const cache = require('./cache');

const problemPicker = {
  /**
   * Generate a board of problems for a match
   * @param {number} gridSize - e.g., 3 for 3x3
   * @param {object} settings - { difficultyRange: { min, max }, allowedTags }
   * @returns {Array} board cells with problems assigned
   */
  async generateBoard(gridSize, settings = {}) {
    const { difficultyRange = { min: 800, max: 1800 }, allowedTags = [] } = settings;

    // Fetch problems from CF (cached)
    const tags = allowedTags.join(';');
    const data = await cfApi.getProblems(tags);
    const allProblems = data.problems || [];

    // Filter problems with ratings in the desired range
    const ratedProblems = allProblems.filter(
      (p) => p.rating && p.rating >= difficultyRange.min && p.rating <= difficultyRange.max
    );

    if (ratedProblems.length < gridSize * gridSize) {
      throw new Error(
        `Not enough problems found (${ratedProblems.length}) for a ${gridSize}x${gridSize} board. Try widening the difficulty range.`
      );
    }

    // Create difficulty buckets
    const totalCells = gridSize * gridSize;
    const range = difficultyRange.max - difficultyRange.min;
    const easyThreshold = difficultyRange.min + range * 0.33;
    const mediumThreshold = difficultyRange.min + range * 0.66;

    const easy = ratedProblems.filter((p) => p.rating <= easyThreshold);
    const medium = ratedProblems.filter((p) => p.rating > easyThreshold && p.rating <= mediumThreshold);
    const hard = ratedProblems.filter((p) => p.rating > mediumThreshold);

    // Build difficulty map for each cell position
    const board = [];
    const usedProblems = new Set();

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const difficulty = this._getCellDifficulty(row, col, gridSize);
        let pool;

        if (difficulty === 'easy') {
          pool = easy.length > 0 ? easy : medium.length > 0 ? medium : hard;
        } else if (difficulty === 'medium') {
          pool = medium.length > 0 ? medium : easy.length > 0 ? easy : hard;
        } else {
          pool = hard.length > 0 ? hard : medium.length > 0 ? medium : easy;
        }

        // Pick a random problem not already used
        let problem = null;
        let attempts = 0;
        while (!problem && attempts < 100) {
          const candidate = pool[Math.floor(Math.random() * pool.length)];
          const key = `${candidate.contestId}-${candidate.index}`;
          if (!usedProblems.has(key)) {
            problem = candidate;
            usedProblems.add(key);
          }
          attempts++;
        }

        // Fallback: pick from all rated problems
        if (!problem) {
          for (const p of ratedProblems) {
            const key = `${p.contestId}-${p.index}`;
            if (!usedProblems.has(key)) {
              problem = p;
              usedProblems.add(key);
              break;
            }
          }
        }

        if (!problem) {
          throw new Error('Unable to find enough unique problems for the board');
        }

        board.push({
          row,
          col,
          problem: {
            contestId: problem.contestId,
            index: problem.index,
            name: problem.name,
            rating: problem.rating,
            tags: problem.tags || [],
            url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
          },
          claimedBy: null,
          claimedByUser: null,
          claimTime: null,
          submissionId: null,
        });
      }
    }

    return board;
  },

  /**
   * Determine difficulty level for a cell position
   * Center/edges = easier, corners = harder (strategic positions are harder)
   */
  _getCellDifficulty(row, col, gridSize) {
    const center = Math.floor(gridSize / 2);
    const isCorner =
      (row === 0 || row === gridSize - 1) && (col === 0 || col === gridSize - 1);
    const isCenter = row === center && col === center;

    if (isCorner) return 'hard';
    if (isCenter) return 'easy';
    return 'medium';
  },
};

module.exports = problemPicker;
