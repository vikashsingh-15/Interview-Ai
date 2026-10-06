import config from '../../config';
import logger from '../../config/logger';
import {
  SearchProviderName,
  SearchResult,
  ExtractedPageContent,
} from './web-search.types';

/**
 * Search providers
 * ----------------
 * - SerpApi: best quality, requires SERPAPI_KEY
 * - DuckDuckGo HTML: free fallback, no key required
 * - StackExchange API: free, great for Q&A-style queries
 *
 * All implementations are dependency-free (Node 18+ global fetch) and fail
 * soft: an error inside one provider surfaces as an empty result list rather
 * than an exception.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(init?.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---- SerpApi ---------------------------------------------------------------

async function searchWithSerpApi(query: string, limit: number): Promise<SearchResult[]> {
  const key = config.search.serpApiKey;
  if (!key) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=google&hl=en&num=${Math.min(
      Math.max(limit, 1),
      20
    )}&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`;

    const res = await fetchWithTimeout(url, config.search.scrapeTimeoutMs);
    if (!res.ok) {
      logger.warn('SerpApi request failed', { module: 'search', provider: 'serpapi', status: res.status });
      return [];
    }

    const data: any = await res.json();
    const organic: any[] = Array.isArray(data.organic_results) ? data.organic_results : [];
    const answerBox = data.answer_box && (data.answer_box.answer || data.answer_box.snippet);

    const results: SearchResult[] = [];
    if (answerBox) {
      results.push({
        title: (data.answer_box.title as string) || 'Direct answer',
        url: (data.answer_box.link as string) || '',
        snippet: String(answerBox),
        source: 'serpapi-answer-box',
        score: 100,
      });
    }
    for (const r of organic) {
      results.push({
        title: r.title || '',
        url: r.link || '',
        snippet: r.snippet || '',
        source: r.displayed_link || (r.link ? new URL(r.link).hostname : 'web'),
        score: typeof r.position === 'number' ? 50 - r.position : undefined,
        metadata: r.sitelinks ? { sitelinks: r.sitelinks } : undefined,
      });
    }
    return results.filter((r) => r.url || r.snippet);
  } catch (err) {
    logger.warn('SerpApi search error', { module: 'search', provider: 'serpapi', error: (err as Error).message });
    return [];
  }
}

// ---- DuckDuckGo (free HTML) ------------------------------------------------

interface DdgResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseDuckDuckGoHtml(html: string): DdgResult[] {
  const results: DdgResult[] = [];

  // Classic HTML endpoint links look like: <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=<encoded-url>">
  const linkRegex =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex =
    /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const links: Array<{ url: string; title: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.includes('uddg=')) {
      try {
        href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
      } catch {
        logger.debug('Skipping result with undecodable redirect URL', { module: 'search', provider: 'duckduckgo' });
        continue;
      }
    } else if (href.startsWith('//')) {
      href = `https:${href}`;
    }
    links.push({ url: href, title: stripTags(match[2]) });
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripTags(match[1]));
  }

  for (let i = 0; i < links.length; i++) {
    try {
      const u = new URL(links[i].url);
      if (!/^https?:$/.test(u.protocol)) continue;
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || '',
        source: u.hostname,
      });
    } catch {
      // Malformed result URL: skip it, but keep the skip visible at debug level.
      logger.debug('Skipping malformed search result URL', { module: 'search', provider: 'duckduckgo' });
    }
  }
  return results;
}

async function searchWithDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const res = await fetchWithTimeout(
      'https://html.duckduckgo.com/html/',
      config.search.scrapeTimeoutMs,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `q=${encodeURIComponent(query)}&kl=wt-wt`,
      }
    );
    if (!res.ok) {
      logger.warn('DuckDuckGo request failed', { module: 'search', provider: 'duckduckgo', status: res.status });
      return [];
    }
    const html = await res.text();
    return parseDuckDuckGoHtml(html)
      .slice(0, limit)
      .map((r, i) => ({ ...r, score: 50 - i }));
  } catch (err) {
    logger.warn('DuckDuckGo search error', { module: 'search', provider: 'duckduckgo', error: (err as Error).message });
    return [];
  }
}

// ---- StackExchange API -------------------------------------------------------

async function searchWithStackExchange(query: string, limit: number): Promise<SearchResult[]> {
  if (!config.search.stackExchange.enabled) return [];

  try {
    const params = new URLSearchParams({
      order: 'relevance',
      sort: 'relevance',
      site: config.search.stackExchange.site,
      pagesize: String(Math.min(Math.max(limit, 1), 30)),
      q: query,
      filter: 'withbody',
    });
    if (config.search.stackExchange.key) {
      params.set('key', config.search.stackExchange.key);
    }

    const searchRes = await fetchWithTimeout(
      `https://api.stackexchange.com/2.3/search/advanced?${params.toString()}`,
      config.search.scrapeTimeoutMs
    );
    if (!searchRes.ok) {
      logger.warn('StackExchange search failed', { module: 'search', provider: 'stackexchange', status: searchRes.status });
      return [];
    }
    const data: any = await searchRes.json();
    const items: any[] = Array.isArray(data.items) ? data.items : [];

    // Fetch accepted/answer bodies for the questions that have them
    const acceptedAnswers: Record<string, any> = {};
    const answerIds = items.map((i) => i.accepted_answer_id).filter(Boolean);
    if (answerIds.length > 0) {
      try {
        const answerParams = new URLSearchParams({
          site: config.search.stackExchange.site,
          filter: 'withbody',
        });
        if (config.search.stackExchange.key) {
          answerParams.set('key', config.search.stackExchange.key);
        }
        answerIds.forEach((id: number) => answerParams.append('ids', String(id)));
        const answerRes = await fetchWithTimeout(
          `https://api.stackexchange.com/2.3/answers/${answerIds.join(';')}?${answerParams.toString()}`,
          config.search.scrapeTimeoutMs
        );
        if (answerRes.ok) {
          const answerData: any = await answerRes.json();
          for (const a of answerData.items || []) {
            acceptedAnswers[a.answer_id] = a;
          }
        }
      } catch (error) {
        // Answer bodies are optional enrichment; log the external API failure
        // but keep the questions themselves.
        logger.warn('StackExchange answer fetch failed', {
          module: 'search', provider: 'stackexchange', answerCount: answerIds.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return items.map((item) => {
      const accepted = item.accepted_answer_id ? acceptedAnswers[item.accepted_answer_id] : null;
      const snippetParts: string[] = [stripTags(item.body || '')];
      if (accepted?.body) {
        snippetParts.push(stripTags(accepted.body).slice(0, 600));
      }
      return {
        title: item.title || '',
        url: item.link || '',
        snippet: snippetParts.join(' — ').slice(0, 1200),
        source: config.search.stackExchange.site,
        score: 40 - (item.rank || 0),
        metadata: {
          questionId: item.question_id,
          score: item.score,
          answerCount: item.answer_count,
          isAnswered: item.is_answered,
          tags: item.tags,
          votes: accepted?.score,
        },
      };
    });
  } catch (err) {
    logger.warn('StackExchange search error', { module: 'search', provider: 'stackexchange', error: (err as Error).message });
    return [];
  }
}

// ---- Dispatcher ---------------------------------------------------------------

export interface SearchDispatcherResult {
  provider: SearchProviderName;
  results: SearchResult[];
}

/**
 * Run a web search. With provider=auto:
 *   1. SerpApi when a key is configured
 *   2. StackExchange (free, great for Q&A)
 *   3. DuckDuckGo HTML scraping (free fallback)
 * Results from providers are merged with SerpApi/StackExchange taking priority.
 */
export async function runWebSearch(query: string, limit: number): Promise<SearchDispatcherResult> {
  const max = limit > 0 ? Math.min(limit, config.search.maxResults) : config.search.maxResults;
  const provider: any = config.search.provider;

  if (provider === 'none') {
    return { provider: 'none', results: [] };
  }

  const useSerpApi = provider === 'serpapi' || (provider === 'auto' && !!config.search.serpApiKey);
  const useStackExchange =
    provider === 'auto'
      ? config.search.stackExchange.enabled
      : provider === 'stackexchange';
  const useDuckDuckGo = provider === 'auto' || provider === 'duckduckgo';

  const tasks: Array<{ name: SearchProviderName; run: () => Promise<SearchResult[]> }> = [];
  if (useSerpApi) tasks.push({ name: 'serpapi', run: () => searchWithSerpApi(query, max) });
  if (useStackExchange) tasks.push({ name: 'stackexchange', run: () => searchWithStackExchange(query, max) });
  if (useDuckDuckGo) tasks.push({ name: 'duckduckgo', run: () => searchWithDuckDuckGo(query, max) });

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));

  const byProvider = new Map<SearchProviderName, SearchResult[]>();
  settled.forEach((res, idx) => {
    if (res.status === 'fulfilled' && res.value.length > 0) {
      byProvider.set(tasks[idx].name, res.value);
    }
  });

  // Priority order: SerpApi > StackExchange > DuckDuckGo
  const ordered: SearchProviderName[] = ['serpapi', 'stackexchange', 'duckduckgo'];
  for (const name of ordered) {
    const results = byProvider.get(name);
    if (results && results.length > 0) {
      return { provider: name, results: dedupeResults(results).slice(0, max) };
    }
  }

  return { provider: 'none', results: [] };
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ---- Page scraping ---------------------------------------------------------------

/**
 * Fetch a page and extract readable text. Dependency-free best-effort HTML to
 * text conversion with a hard byte cap, blocking of non-HTML content types and
 * private addresses (SSRF protection).
 */
export async function scrapePage(url: string): Promise<ExtractedPageContent> {
  const fetchedAt = new Date();

  if (!isSafeHttpUrl(url)) {
    return { url, content: '', fetchedAt, error: 'Unsupported or unsafe URL' };
  }

  try {
    const res = await fetchWithTimeout(url, config.search.scrapeTimeoutMs, {
      headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
    });
    if (!res.ok) {
      return { url, content: '', fetchedAt, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      return { url, content: '', fetchedAt, error: `Unsupported content type: ${contentType}` };
    }

    // Read at most maxPageBytes
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8');
      let received = 0;
      while (received < config.search.maxPageBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      try {
        await reader.cancel();
      } catch (error) {
        logger.debug('Could not cancel page stream after byte cap', {
          module: 'search', error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      html = await res.text();
      if (html.length > config.search.maxPageBytes) {
        html = html.slice(0, config.search.maxPageBytes);
      }
    }

    return {
      url,
      title: extractTitle(html),
      content: extractMainText(html).slice(0, config.search.maxContentChars),
      publishedDate: extractPublishedDate(html),
      fetchedAt,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Scrape failed';
    logger.warn('Page scrape failed', { module: 'search', provider: 'scrape', url, error });
    return {
      url,
      content: '',
      fetchedAt,
      error,
    };
  }
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    const blocked =
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host === '::1' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    return !blocked;
  } catch {
    return false;
  }
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).slice(0, 200) : undefined;
}

function extractPublishedDate(html: string): string | undefined {
  const m =
    html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}

/** Best-effort main-content extraction: drop script/style/nav boilerplate. */
export function extractMainText(html: string): string {
  let text = html
    // Remove non-content blocks
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
    // Prefer <main>/<article> if present
    .split(/<main[\s>]/i)[1]?.split(/<\/main>/i)[0] || html;

  const articleMatch = text.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch && articleMatch[0].length > 200) {
    text = articleMatch[0];
  }

  return stripTags(text)
    .replace(/\s{2,}/g, ' ')
    .trim();
}
