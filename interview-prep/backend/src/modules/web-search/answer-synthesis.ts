import OpenAI from 'openai';
import { createAIClient, hasAI } from '../../common/services/ai-provider';
import config from '../../config';
import logger from '../../config/logger';
import { SearchResult, SynthesizedAnswer } from './web-search.types';

/**
 * Optional AI synthesis
 * ---------------------
 * When SEARCH_AI_SYNTHESIS != 'false' and an OpenAI-compatible key exists,
 * the scraped pages + snippets are distilled into a concise answer with
 * citations. Falls back to a heuristic (extract-based) answer when no key is
 * available.
 */

function getClient(): OpenAI | null {
  return hasAI() ? createAIClient() : null;
}

const MAX_CONTEXT_CHARS = 8000;

export async function synthesizeAnswer(
  query: string,
  results: SearchResult[],
  pages: ExtractedPageLike[]
): Promise<SynthesizedAnswer> {
  const generatedAt = new Date();
  const basedOn = [...new Set([...results.map((r) => r.url), ...pages.map((p) => p.url)])].filter(Boolean).slice(0, 10);

  const client = config.search.synthesizeWithAI ? getClient() : null;

  if (client) {
    try {
      const context = buildContext(query, results, pages);

      const completion = await client.chat.completions.create({
        model: config.ai.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'You are a technical research assistant for interview preparation. ' +
              'Answer strictly from the provided search context. If the context is insufficient, say so and lower confidence. ' +
              'Return ONLY JSON with keys: summary (string), keyPoints (string[]), caveats (string[]), confidence (number 0..1).',
          },
          {
            role: 'user',
            content: `Question: ${query}\n\nSearch context:\n${context}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);

      return {
        summary: String(parsed.summary || '').trim() || 'No answer could be synthesized.',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String).slice(0, 8) : [],
        caveats: Array.isArray(parsed.caveats) ? parsed.caveats.map(String).slice(0, 5) : [],
        confidence: clamp01(parsed.confidence ?? 0.6),
        basedOn,
        generatedBy: 'ai',
        generatedAt,
      };
    } catch (err) {
      logger.warn('AI answer synthesis failed, falling back to heuristic', {
        error: (err as Error).message,
      });
    }
  }

  return heuristicAnswer(query, results, pages, basedOn, generatedAt);
}

// ---- Helpers -----------------------------------------------------------------

interface ExtractedPageLike {
  url: string;
  title?: string;
  content: string;
}

function buildContext(query: string, results: SearchResult[], pages: ExtractedPageLike[]): string {
  const chunks: string[] = [];

  for (const r of results.slice(0, 8)) {
    if (r.snippet) {
      chunks.push(`[SNIPPET] ${r.source} — ${r.title}\n${r.snippet}`);
    }
  }

  for (const p of pages.slice(0, 4)) {
    if (p.content) {
      chunks.push(`[PAGE] ${p.url} — ${p.title || ''}\n${p.content.slice(0, 2500)}`);
    }
  }

  return chunks.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
}

/** Extract-based fallback: pick the sentences that best overlap the query. */
function heuristicAnswer(
  query: string,
  results: SearchResult[],
  pages: ExtractedPageLike[],
  basedOn: string[],
  generatedAt: Date
): SynthesizedAnswer {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const sentences: string[] = [];
  const pushSentences = (text: string, source: string) => {
    for (const s of text.split(/(?<=[.!?])\s+/)) {
      const clean = s.trim();
      if (clean.length >= 40 && clean.length <= 320) {
        sentences.push(`${clean} (${source})`);
      }
    }
  };

  for (const r of results.slice(0, 8)) {
    if (r.snippet) pushSentences(r.snippet, r.source);
  }
  for (const p of pages.slice(0, 4)) {
    if (p.content) pushSentences(p.content.slice(0, 2000), p.url);
  }

  const scored = sentences
    .map((s) => ({
      s,
      score: queryTerms.reduce((acc, t) => acc + (s.toLowerCase().includes(t) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  const keyPoints = scored.slice(0, 5).map((x) => x.s);
  const summary =
    keyPoints.length > 0
      ? `Extract-based answer for "${query}" — most relevant passages found online:\n\n${keyPoints
          .map((p) => `• ${p}`)
          .join('\n')}`
      : `No usable web content found for "${query}". Try a more specific query.`;

  return {
    summary,
    keyPoints: keyPoints.map((p) => p.replace(/\s*\([^)]*\)$/, '')),
    caveats: clientlessNote(),
    confidence: keyPoints.length >= 3 ? 0.4 : 0.2,
    basedOn,
    generatedBy: 'heuristic',
    generatedAt,
  };
}

function clientlessNote(): string[] {
  return config.ai.apiKey
    ? ['Answer synthesized by an AI model; verify critical details against the linked sources.']
    : ['Heuristic extract-based answer (no AI key configured). Set AI_API_KEY for cleaner summaries.'];
}

function clamp01(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}
