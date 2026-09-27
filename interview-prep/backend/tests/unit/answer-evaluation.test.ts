import {
  evaluateWithHeuristic,
  toRevisionEvaluation,
} from '../../src/modules/evaluation/answer-evaluation';

const referenceInput = {
  question: 'What is a database index and how does it work?',
  expectedAnswer:
    'A database index is a data structure that improves the speed of data retrieval operations ' +
    'on a database table at the cost of additional writes and storage space. Indexes are used to ' +
    'quickly locate data without searching every row. B-tree indexes keep keys sorted for fast ' +
    'lookups; hash indexes map keys directly. Composite indexes cover multiple columns in order. ' +
    'Over-indexing slows writes and wastes storage.',
  topic: 'Databases',
  concepts: ['indexing', 'b-tree', 'write amplification'],
};

const weakAnswer =
  'It makes the database faster I think. You add an index on a column and searches go quick.';

const strongAnswer =
  'An index is a data structure that speeds up data retrieval at the cost of extra writes and ' +
  'storage. Most engines use B-tree indexes that keep keys sorted, so lookups are O(log n) ' +
  'instead of scanning every row; hash indexes map keys directly but do not support range ' +
  'queries. Composite indexes cover multiple columns in the order they are declared, which ' +
  'matters for multi-column predicates. Therefore over-indexing is a real trade-off: every ' +
  'index slows inserts and updates because each write must maintain every index, so you monitor ' +
  'write latency and drop unused indexes in production.';

describe('evaluateWithHeuristic', () => {
  it('scores a strong, complete answer higher than a weak one', () => {
    const strong = evaluateWithHeuristic({ ...referenceInput, userAnswer: strongAnswer });
    const weak = evaluateWithHeuristic({ ...referenceInput, userAnswer: weakAnswer });

    expect(strong.overallScore).toBeGreaterThan(weak.overallScore);
    expect(strong.overallScore).toBeGreaterThan(0.5);
    expect(weak.overallScore).toBeLessThan(0.6);
  });

  it('never returns out-of-range scores and always includes a summary', () => {
    const result = evaluateWithHeuristic({ ...referenceInput, userAnswer: 'idk' });

    for (const key of ['overallScore', 'technicalCorrectness', 'completeness', 'depth', 'clarity'] as const) {
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(1);
    }
    expect(result.summary).toBeTruthy();
  });

  it('reports missing reference concepts for a weak answer', () => {
    const result = evaluateWithHeuristic({ ...referenceInput, userAnswer: weakAnswer });

    expect(result.missingPoints.length).toBeGreaterThan(0);
    expect(result.technicalGaps?.length).toBeGreaterThan(0);
  });

  it('flags concepts the answer never touched as concepts-to-revise', () => {
    const result = evaluateWithHeuristic({
      ...referenceInput,
      userAnswer: 'B-trees keep keys sorted for fast lookups.',
    });

    expect(result.keyConceptsToRevise).toContain('write amplification');
    expect(result.keyConceptsToRevise).not.toContain('b-tree');
  });

  it('handles answers when no reference is available without crashing', () => {
    const result = evaluateWithHeuristic({
      question: 'Explain eventual consistency.',
      userAnswer: 'Replicas converge eventually because updates propagate asynchronously.',
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1);
    expect(result.summary).toContain('no reference');
  });

  it('marks source as heuristic', () => {
    const result = evaluateWithHeuristic({ ...referenceInput, userAnswer: strongAnswer });
    expect(result.source).toBe('heuristic');
  });
});

describe('toRevisionEvaluation', () => {
  const baseEvaluation = {
    source: 'ai' as const,
    overallScore: 0.85,
    technicalCorrectness: 0.9,
    completeness: 0.8,
    depth: 0.8,
    clarity: 0.9,
    summary: 'Much better answer.',
    strengths: ['clear structure'],
    weaknesses: ['could mention monitoring'],
    missingPoints: [],
    followUpSuggestions: [],
    improvementSuggestions: [],
    keyConceptsToRevise: [],
  };

  it('computes delta and improved flag against the original score', () => {
    const result = toRevisionEvaluation(baseEvaluation, 0.4, ['monitoring gap']);

    expect(result.overallScore).toBe(0.85);
    expect(result.improved).toBe(true);
    expect(result.delta).toBeCloseTo(0.45);
    // "could mention monitoring" overlaps "monitoring gap" -> still present,
    // so it is neither new nor addressed
    expect(result.newWeaknesses).toHaveLength(0);
    expect(result.previousWeaknessesAddressed).toHaveLength(0);
  });

  it('recognises genuinely addressed weaknesses', () => {
    // "could mention monitoring" overlaps "monitoring gap" (still present);
    // "unclear on hashing" is no longer reported -> addressed
    const fixed = { ...baseEvaluation, weaknesses: ['could mention monitoring'] };
    const result = toRevisionEvaluation(fixed, 0.4, ['monitoring gap', 'unclear on hashing']);

    expect(result.previousWeaknessesAddressed).toContain('unclear on hashing');
    expect(result.previousWeaknessesAddressed).not.toContain('monitoring gap');
    expect(result.newWeaknesses).toHaveLength(0);
  });

  it('reports genuinely new weaknesses', () => {
    const worse = { ...baseEvaluation, weaknesses: ['ignores connection pooling'] };
    const result = toRevisionEvaluation(worse, 0.4, ['monitoring gap']);

    expect(result.newWeaknesses).toContain('ignores connection pooling');
    // the old weakness is no longer reported, so it counts as addressed
    expect(result.previousWeaknessesAddressed).toContain('monitoring gap');
  });

  it('marks regressions and carries forward new weaknesses', () => {
    const worse = { ...baseEvaluation, overallScore: 0.2, weaknesses: ['wrong about b-trees'] };
    const result = toRevisionEvaluation(worse, 0.6, ['old gap']);

    expect(result.improved).toBe(false);
    expect(result.delta).toBeCloseTo(-0.4);
    expect(result.newWeaknesses).toContain('wrong about b-trees');
    expect(result.previousWeaknessesAddressed).toContain('old gap');
  });

  it('treats a missing original score as improved', () => {
    const result = toRevisionEvaluation(baseEvaluation);
    expect(result.improved).toBe(true);
    expect(result.delta).toBe(0);
  });
});
