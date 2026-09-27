export { default as webSearchRoutes } from './routes';
export { webSearchService } from './web-search.service';
export { SearchCache } from './search-cache.model';
export type { ISearchCache, ISearchCacheDocument } from './search-cache.model';
export type {
  SearchProviderName,
  SearchResult,
  ExtractedPageContent,
  SynthesizedAnswer,
  WebSearchResponse,
} from './web-search.types';
export { runWebSearch, scrapePage, extractMainText } from './search-providers';
export { synthesizeAnswer } from './answer-synthesis';
