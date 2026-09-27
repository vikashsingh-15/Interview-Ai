'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import api, { ApiResponse } from '@/lib/api';
import { WebSearchResponse, RecentSearch } from '@/types';
import { formatDate } from '@/lib/utils';

const SUGGESTED_QUERIES = [
  'how does HashMap handle collisions internally',
  'design a rate limiter for a high traffic API',
  'SQL vs NoSQL trade-offs for a social feed',
  'two sum problem optimal solution explained',
];

export default function SearchPage() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [includeScrapedContent, setIncludeScrapedContent] = useState(true);
  const [result, setResult] = useState<WebSearchResponse | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = async () => {
    try {
      const res = await api.get<ApiResponse<RecentSearch[]>>('/search/recent');
      setRecent(res.data.data || []);
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadRecent();
    }
  }, [isAuthenticated]);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<ApiResponse<WebSearchResponse>>('/search', {
        query: q.trim(),
        includeScrapedContent,
      });
      setResult(res.data.data || null);
      loadRecent();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          'Search failed. Check backend configuration and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <div className="min-h-screen bg-brand-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-brand-primary">Search the Web</h1>
        <p className="mt-2 text-brand-textSecondary">
          Find interview questions and answers across the web — Stack Overflow,
          engineering blogs and more. Searches are logged in your day calendar.
        </p>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. explain the CAP theorem with an example"
              className="flex-1 px-4 py-3 rounded-lg border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            />
            <Button type="submit" disabled={isLoading || !query.trim()}>
              {isLoading ? 'Searching…' : 'Search'}
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm text-brand-textSecondary">
            <input
              type="checkbox"
              checked={includeScrapedContent}
              onChange={(e) => setIncludeScrapedContent(e.target.checked)}
              className="rounded border-brand-border"
            />
            Read full pages for a better AI answer (slower)
          </label>
        </form>

        {/* Suggested queries */}
        {!result && !isLoading && recent.length === 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuery(q);
                  runSearch(q);
                }}
                className="px-3 py-1.5 text-sm rounded-full border border-brand-border bg-white text-brand-textSecondary hover:border-brand-secondary hover:text-brand-secondary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="mt-8 border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <Card className="mt-8">
            <CardContent className="p-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-secondary" />
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-2 text-sm text-brand-textSecondary">
              <Badge variant={result.cached ? 'neutral' : 'primary'}>
                {result.cached ? 'cached' : 'fresh'}
              </Badge>
              <Badge variant="neutral">{result.provider}</Badge>
              <span>{result.results.length} results</span>
            </div>

            {/* Synthesized answer */}
            {result.answer && (
              <Card className="border-brand-secondary/30 bg-brand-secondary/5">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Answer</span>
                    <span className="text-sm font-normal text-brand-textSecondary">
                      {result.answer.generatedBy === 'ai' ? 'AI synthesized' : 'extract-based'} ·{' '}
                      {Math.round(result.answer.confidence * 100)}% confidence
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-brand-text whitespace-pre-line">{result.answer.summary}</p>

                  {result.answer.keyPoints.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {result.answer.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-brand-text">
                          <span className="text-brand-secondary">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}

                  {result.answer.caveats.length > 0 && (
                    <div className="mt-4 text-xs text-brand-textSecondary">
                      {result.answer.caveats.map((c, i) => (
                        <p key={i}>⚠ {c}</p>
                      ))}
                    </div>
                  )}

                  {result.answer.basedOn.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.answer.basedOn.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-secondary hover:underline max-w-xs truncate"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Raw results */}
            {result.results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Web results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {result.results.map((r, i) => (
                      <div key={i} className="border-b border-brand-border last:border-0 pb-4 last:pb-0">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-secondary hover:underline"
                        >
                          {r.title || r.url}
                        </a>
                        <p className="text-xs text-brand-textSecondary mt-0.5">{r.source}</p>
                        {r.snippet && (
                          <p className="text-sm text-brand-text mt-1">{r.snippet}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Recent searches */}
        {recent.length > 0 && !isLoading && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold text-brand-primary mb-3">Recent searches</h2>
            <div className="flex flex-wrap gap-2">
              {recent.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(s.query);
                    runSearch(s.query);
                  }}
                  className="px-3 py-1.5 text-sm rounded-full border border-brand-border bg-white text-brand-textSecondary hover:border-brand-secondary hover:text-brand-secondary transition-colors"
                  title={`${s.resultCount} results · ${formatDate(s.fetchedAt)}`}
                >
                  {s.query}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
