import mongoose from 'mongoose';
import config from '../../config';
import logger from '../../config/logger';
import { SearchCache } from './search-cache.model';
import { runWebSearch, scrapePage } from './search-providers';
import { synthesizeAnswer } from './answer-synthesis';
import { WebSearchResponse, SearchResult, ExtractedPageContent } from './web-search.types';
import { recordQuestionInDailyCalendar } from '../calendar/calendar.service';

/**
 * Web search service
 * ------------------
 * Orchestrates: cache lookup -> provider search -> page scraping (as needed)
 * -> optional AI synthesis -> persist to cache -> record in the user's daily
 * calendar so searches appear on the day they were made.
 */

export const webSearchService = {
  /**
   * Search the web for Q&A material. Results are cached per user/query and
   * optionally deepened with scraped page content + AI synthesis.
   */
  async search(params: {
    userId: string;
    query: string;
    limit?: number;
    includeScrapedContent?: boolean;
    noCache?: boolean;
    recordInCalendar?: boolean;
  }): Promise<WebSearchResponse> {
    const {
      userId,
      query,
      limit = config.search.maxResults,
      includeScrapedContent = false,
      noCache = false,
      recordInCalendar = true,
    } = params;

    const normalizedQuery = SearchCache.normalizeQuery(query);

    // 1. Fresh cache hit?
    if (!noCache) {
      const cached = await SearchCache.findFreshForUser(
        new mongoose.Types.ObjectId(userId),
        normalizedQuery,
        config.search.cacheTtlHours
      );
      if (cached) {
        await SearchCache.recordUsage(cached._id);
        logger.info('Search served from cache', { userId, query, cachedAt: cached.fetchedAt });

        return {
          query,
          provider: cached.provider,
          cached: true,
          fetchedAt: cached.fetchedAt,
          results: cached.results as unknown as SearchResult[],
          pages: includeScrapedContent
            ? (cached.pages as unknown as ExtractedPageContent[])
            : [],
          answer: cached.answer as WebSearchResponse['answer'],
        };
      }
    }

    // 2. Run the search across providers
    const { provider, results } = await runWebSearch(query, limit);

    // 3. Scrape top pages when requested
    let pages: ExtractedPageContent[] = [];
    if (includeScrapedContent && provider !== 'none') {
      const targets = results.slice(0, config.search.maxScrapedPages).map((r) => r.url).filter(Boolean);
      const settled = await Promise.allSettled(targets.map((url) => scrapePage(url)));
      pages = settled.map((s, i) =>
        s.status === 'fulfilled'
          ? s.value
          : { url: targets[i], content: '', fetchedAt: new Date(), error: 'Scrape failed' }
      );
    }

    // 4. Synthesize answer (AI when configured, heuristic otherwise)
    const answer = provider === 'none' || results.length === 0
      ? undefined
      : await synthesizeAnswer(query, results, pages);

    // 5. Persist to cache
    const expiresAt = new Date(Date.now() + config.search.cacheTtlHours * 60 * 60 * 1000);
    try {
      await SearchCache.updateOne(
        { userId: new mongoose.Types.ObjectId(userId), normalizedQuery },
        {
          $set: {
            query,
            provider,
            fetchedAt: new Date(),
            expiresAt,
            results,
            pages,
            answer,
          },
        },
        { upsert: true }
      );
    } catch (err) {
      // Cache write failures must not break the search itself
      logger.warn('Failed to persist search cache', { error: (err as Error).message });
    }

    // 6. Record the search in the user's daily calendar record
    if (recordInCalendar) {
      try {
        await recordQuestionInDailyCalendar(userId, {
          type: 'search',
          title: query,
          ...(answer?.summary ? { answer: answer.summary.slice(0, 500) } : {}),
          sourceUrls: results.slice(0, 3).map((r) => r.url).filter(Boolean),
          count: 1,
          metadata: {
            provider,
            resultCount: results.length,
            ...(answer ? { confidence: answer.confidence } : {}),
          },
        });
      } catch (err) {
        logger.warn('Failed to record search in daily calendar', {
          error: (err as Error).message,
        });
      }
    }

    logger.info('Web search completed', {
      userId,
      query,
      provider,
      resultCount: results.length,
      scrapedPages: pages.length,
      synthesized: !!answer,
    });

    return {
      query,
      provider,
      cached: false,
      fetchedAt: new Date(),
      results,
      pages,
      answer,
    };
  },

  /** Recent distinct searches for a user (from the cache collection). */
  async recentSearches(userId: string, limit = 10) {
    const docs = await SearchCache.recentSearches(new mongoose.Types.ObjectId(userId), limit);
    return docs.map((d) => ({
      query: d.query,
      provider: d.provider,
      fetchedAt: d.fetchedAt,
      resultCount: d.results?.length || 0,
      hasAnswer: !!d.answer?.summary,
      usageCount: d.usageCount,
    }));
  },
};

export default webSearchService;
