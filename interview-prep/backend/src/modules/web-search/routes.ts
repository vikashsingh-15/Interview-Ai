import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../common/middleware/auth';
import { asyncHandler, ValidationError } from '../../common/filters/error-filter';
import { aiRateLimiter } from '../../common/middleware/rate-limit';
import { webSearchService } from './web-search.service';

const router = Router();

// POST /api/search — run a web search for Q&A material
router.post(
  '/',
  authenticate,
  aiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const { query, limit, includeScrapedContent, noCache, recordInCalendar } = req.body || {};

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      throw new ValidationError('query must be a string of at least 3 characters');
    }
    if (query.length > 512) {
      throw new ValidationError('query must be at most 512 characters');
    }

    const result = await webSearchService.search({
      userId: req.user.id,
      query: query.trim(),
      limit: typeof limit === 'number' ? limit : undefined,
      includeScrapedContent: includeScrapedContent === true,
      noCache: noCache === true,
      recordInCalendar: recordInCalendar !== false,
    });

    res.json({ success: true, data: result });
  })
);

// GET /api/search/recent — recent distinct searches for the current user
router.get(
  '/recent',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.user) throw new ValidationError('Authentication required');

    const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 50);
    const searches = await webSearchService.recentSearches(req.user.id, limit);

    res.json({ success: true, data: searches });
  })
);

export default router;
