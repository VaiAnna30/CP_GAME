const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cfApi = require('../services/cfApi');

// @route   GET /api/problems
// @desc    Get problems from CF API (cached)
router.get('/', auth, async (req, res, next) => {
  try {
    const { tags, minRating, maxRating, page = 1, limit = 50 } = req.query;

    const data = await cfApi.getProblems(tags || '');
    let problems = data.problems || [];

    // Filter by rating
    if (minRating || maxRating) {
      problems = problems.filter((p) => {
        if (!p.rating) return false;
        if (minRating && p.rating < parseInt(minRating)) return false;
        if (maxRating && p.rating > parseInt(maxRating)) return false;
        return true;
      });
    }

    // Paginate
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = problems.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      problems: paginated,
      total: problems.length,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
