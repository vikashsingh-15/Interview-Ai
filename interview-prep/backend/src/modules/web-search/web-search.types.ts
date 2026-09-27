// ---- Web search providers ------------------------------------------------

export type SearchProviderName = 'serpapi' | 'duckduckgo' | 'stackexchange' | 'none';

export interface SearchResult {
  title: string;
  url: string;
  /** Search-engine snippet / answer extract */
  snippet: string;
  /** Human-readable source name, e.g. "stackoverflow.com" */
  source: string;
  /** Ranking score from the provider (higher is better) when available */
  score?: number;
  /** Provider specific extras (votes, tags, answer counts, ...) */
  metadata?: Record<string, any>;
}

export interface ExtractedPageContent {
  url: string;
  title?: string;
  /** Cleaned text extracted from the page */
  content: string;
  publishedDate?: string;
  fetchedAt: Date;
  error?: string;
}

export interface SynthesizedAnswer {
  summary: string;
  keyPoints: string[];
  caveats: string[];
  /** Confidence in the synthesized answer, 0..1 */
  confidence: number;
  /** URLs the answer was derived from */
  basedOn: string[];
  /** 'ai' when an LLM synthesized it, 'heuristic' for the extract-based fallback */
  generatedBy: string;
  generatedAt: Date;
}

export interface WebSearchResponse {
  query: string;
  provider: SearchProviderName;
  cached: boolean;
  fetchedAt: Date;
  results: SearchResult[];
  pages: ExtractedPageContent[];
  answer?: SynthesizedAnswer;
}
