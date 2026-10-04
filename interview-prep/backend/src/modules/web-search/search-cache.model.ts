import mongoose, { Schema, Model, Document } from 'mongoose';
import { SearchProviderName, SynthesizedAnswer } from './web-search.types';

/**
 * SearchCache
 * -----------
 * Stores the outcome of a user's web search (SERP results, scraped page
 * content and the synthesized answer) so repeated/similar queries are cheap
 * and we can show recent searches per user.
 *
 * Document = one query for one user. `results` holds the SERP hits,
 * `pages` the fetched page contents, `answer` the synthesized answer.
 */

export interface ISearchCache {
  _id: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;
  query: string;
  normalizedQuery: string;

  provider: SearchProviderName;
  fetchedAt: Date;
  expiresAt: Date;

  results: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    score?: number;
    metadata?: Record<string, any>;
  }>;

  pages: Array<{
    url: string;
    title?: string;
    content: string;
    publishedDate?: string;
    fetchedAt: Date;
    error?: string;
  }>;

  answer?: SynthesizedAnswer;

  usageCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISearchCacheDocument extends ISearchCache, Document {}

// Statics interface so mongoose exposes the custom helpers on the model type
export interface ISearchCacheModel extends Model<ISearchCacheDocument> {
  normalizeQuery(query: string): string;
  findFreshForUser(
    userId: mongoose.Types.ObjectId,
    normalizedQuery: string,
    ttlHours: number
  ): Promise<ISearchCacheDocument | null>;
  recordUsage(cacheId: mongoose.Types.ObjectId): Promise<any>;
  recentSearches(
    userId: mongoose.Types.ObjectId,
    limit?: number
  ): Promise<ISearchCacheDocument[]>;
}

const searchCacheSchema = new Schema<ISearchCache>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    query: { type: String, required: true },
    normalizedQuery: { type: String, required: true, index: true },

    provider: {
      type: String,
      enum: ['serpapi', 'duckduckgo', 'stackexchange', 'none'],
      required: true,
    },
    fetchedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },

    results: [
      {
        _id: false,
        title: String,
        url: String,
        snippet: String,
        source: String,
        score: Number,
        metadata: Schema.Types.Mixed,
      },
    ],

    pages: [
      {
        _id: false,
        url: String,
        title: String,
        content: String,
        publishedDate: String,
        fetchedAt: Date,
        error: String,
      },
    ],

    answer: {
      summary: String,
      keyPoints: [String],
      caveats: [String],
      confidence: Number,
      basedOn: [String],
      generatedBy: String,
      generatedAt: Date,
    },

    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// A user's cached answer for a given query
searchCacheSchema.index({ userId: 1, normalizedQuery: 1 }, { unique: true });
searchCacheSchema.index({ userId: 1, fetchedAt: -1 });
// TTL index so stale cache rows are cleaned up by MongoDB automatically
searchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

searchCacheSchema.statics.normalizeQuery = function (query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

searchCacheSchema.statics.findFreshForUser = function (
  userId: mongoose.Types.ObjectId,
  normalizedQuery: string,
  ttlHours: number
) {
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
  return this.findOne({
    userId,
    normalizedQuery,
    fetchedAt: { $gte: cutoff },
  });
};

searchCacheSchema.statics.recordUsage = async function (
  cacheId: mongoose.Types.ObjectId
) {
  return this.updateOne(
    { _id: cacheId },
    { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
  );
};

searchCacheSchema.statics.recentSearches = function (
  userId: mongoose.Types.ObjectId,
  limit = 10
) {
  return this.find({ userId })
    .sort({ lastUsedAt: -1 })
    .limit(limit)
    .select('query provider fetchedAt results answer usageCount lastUsedAt');
};

const SearchCache: ISearchCacheModel = mongoose.model<ISearchCacheDocument, ISearchCacheModel>(
  'SearchCache',
  searchCacheSchema as any
);

export { SearchCache };
export default SearchCache;
