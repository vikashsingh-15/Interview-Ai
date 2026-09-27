import config from '../../config';
import logger from '../../config/logger';
import { Question } from './question.model';
import { AIProviderError } from '../../common/filters/error-filter';
import { z } from 'zod';

// AI Question Generator Service
export const aiQuestionGenerator = {
  // Generate a single question using AI
  async generateQuestion(
    topic: string,
    subtopic: string,
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT',
    pattern: string,
    options: {
      candidateLevel?: string;
      targetRole?: string;
      weakConcepts?: string[];
      resumeSkills?: string[];
    } = {}
  ): Promise<{
    question: string;
    concepts: string[];
    questionType: string;
    archetype: string;
    interviewPriority: string;
    expectedAnswerDepth: string;
    estimatedAnswerTimeSeconds: number;
  }> {
    const systemPrompt = `You are a Senior Technical Interviewer specializing in ${topic} interviews for ${options.targetRole || 'SDE-2'} positions.

Your task is to generate ONE high-quality interview question for the following:

Topic: ${topic}
Subtopic: ${subtopic}
Difficulty: ${difficulty}
Pattern: ${pattern}

Candidate Level: ${options.candidateLevel || 'intermediate'}
Target Role: ${options.targetRole || 'SDE-2'}

${options.weakConcepts?.length ? `Weak Concepts to focus on: ${options.weakConcepts.join(', ')}` : ''}
${options.resumeSkills?.length ? `Candidate Skills: ${options.resumeSkills.join(', ')}` : ''}

Requirements:
1. Generate a SINGLE, focused question
2. The question should test understanding of ${subtopic}
3. Difficulty must match the specified level
4. Include concepts that would be tested
5. Return ONLY valid JSON (no markdown, no explanations outside JSON)

Return format:
{
  "question": "string - the interview question",
  "concepts": ["string"],
  "questionType": "CONCEPTUAL | INTERNAL_WORKING | CODE_REASONING | DEBUGGING | PRODUCTION_SCENARIO | PERFORMANCE | CONCURRENCY | SECURITY | FAILURE_SCENARIO | DESIGN | TRADE_OFF | WHY | WHY_NOT | WHAT_HAPPENS_IF | SCALABILITY | OBSERVABILITY",
  "archetype": "FOUNDATIONAL | CONCEPTUAL | INTERNAL_WORKING | IMPLEMENTATION | CODE_REASONING | DEBUGGING | PRODUCTION_SCENARIO | CONCURRENCY | SECURITY | FAILURE_SCENARIO | TRADE_OFF | DESIGN | SCALABILITY | DEEP_DIVE",
  "interviewPriority": "LOW | MEDIUM | HIGH | VERY_HIGH",
  "expectedAnswerDepth": "SHORT | MODERATE | DEEP",
  "estimatedAnswerTimeSeconds": number
}`;

    try {
      // This is a placeholder - in production, use actual AI provider
      // For now, return structured sample questions based on topic/pattern
      return this.generateSampleQuestion(topic, subtopic, difficulty, pattern, options);
    } catch (error) {
      logger.error('AI question generation failed', { error });
      throw new AIProviderError(
        'Failed to generate question',
        config.ai.defaultProvider,
        error as Error
      );
    }
  },

  // Generate sample questions based on topic (for when AI is not available)
  generateSampleQuestion(
    topic: string,
    subtopic: string,
    difficulty: string,
    pattern: string,
    options: any
  ): any {
    // Generate relevant questions based on topic and subtopic
    const questionLibrary: Record<string, any> = {
      'Java': {
        'Collections Framework': {
          EASY: {
            question: 'What is the difference between ArrayList and LinkedList in Java?',
            concepts: ['arraylist', 'linkedlist', 'collections', 'list'],
            questionType: 'CONCEPTUAL',
            archetype: 'FOUNDATIONAL',
            interviewPriority: 'MEDIUM',
            expectedAnswerDepth: 'MODERATE',
            estimatedAnswerTimeSeconds: 120,
          },
          MEDIUM: {
            question: 'Explain how HashMap works internally in Java. How does it handle collisions?',
            concepts: ['hashmap', 'hashing', 'collision resolution', 'equals', 'hashcode', 'buckets'],
            questionType: 'INTERNAL_WORKING',
            archetype: 'DEEP_DIVE',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 180,
          },
          HARD: {
            question: 'What changes were made to HashMap in Java 8? How does the treeification of buckets work and when does it trigger?',
            concepts: ['hashmap', 'treeification', 'red-black tree', 'collisions', 'java 8'],
            questionType: 'INTERNAL_WORKING',
            archetype: 'DEEP_DIVE',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 240,
          },
        },
        'Concurrency': {
          EASY: {
            question: 'What is the difference between implementing Runnable and extending Thread in Java?',
            concepts: ['threads', 'runnable', 'thread', 'concurrency'],
            questionType: 'CONCEPTUAL',
            archetype: 'FOUNDATIONAL',
            interviewPriority: 'MEDIUM',
            expectedAnswerDepth: 'SHORT',
            estimatedAnswerTimeSeconds: 60,
          },
          MEDIUM: {
            question: 'Explain the Java Memory Model. What guarantees does volatile provide?',
            concepts: ['java memory model', 'volatile', 'happens-before', 'visibility', 'memory consistency'],
            questionType: 'INTERNAL_WORKING',
            archetype: 'CONCURRENCY',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 180,
          },
          HARD: {
            question: 'How would you implement a thread-safe cache using ConcurrentHashMap? What are the benefits over synchronized HashMap?',
            concepts: ['concurrenthashmap', 'thread-safety', 'concurrent collections', 'locking', 'performance'],
            questionType: 'IMPLEMENTATION',
            archetype: 'TRADE_OFF',
            interviewPriority: 'VERY_HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 240,
          },
        },
      },
      'JavaScript': {
        'Event Loop': {
          EASY: {
            question: 'What is the event loop in JavaScript?',
            concepts: ['event loop', 'call stack', 'task queue', 'runtime'],
            questionType: 'CONCEPTUAL',
            archetype: 'FOUNDATIONAL',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'MODERATE',
            estimatedAnswerTimeSeconds: 120,
          },
          MEDIUM: {
            question: 'Explain the difference between microtasks and macrotasks in the JavaScript event loop. How does Promise.resolve().then() differ from setTimeout(fn, 0)?',
            concepts: ['microtasks', 'macrotasks', 'promises', 'event loop', 'promise resolution', 'settimeout'],
            questionType: 'INTERNAL_WORKING',
            archetype: 'DEEP_DIVE',
            interviewPriority: 'VERY_HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 180,
          },
          HARD: {
            question: 'Analyze this code and predict the output. Explain the order of execution considering the event loop, microtask queue, and macrotask queue.',
            concepts: ['event loop', 'microtasks', 'macrotasks', 'promises', 'async', 'execution order'],
            questionType: 'CODE_REASONING',
            archetype: 'DEEP_DIVE',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 240,
          },
        },
        'Closures': {
          EASY: {
            question: 'What is a closure in JavaScript?',
            concepts: ['closures', 'lexical scope', 'scope chain'],
            questionType: 'CONCEPTUAL',
            archetype: 'FOUNDATIONAL',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'SHORT',
            estimatedAnswerTimeSeconds: 60,
          },
          MEDIUM: {
            question: 'Explain how closures work in JavaScript. How does a closure capture variables from its outer scope?',
            concepts: ['closures', 'lexical scope', 'scope chain', 'function scope', 'variable capture'],
            questionType: 'CONCEPTUAL',
            archetype: 'DEEP_DIVE',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'MODERATE',
            estimatedAnswerTimeSeconds: 120,
          },
          HARD: {
            question: 'What is the output of this code? Explain why setTimeout in a for loop with var behaves differently than with let.',
            concepts: ['closures', 'var vs let', 'scope', 'event loop', 'asynchronous', 'closure pitfalls'],
            questionType: 'CODE_REASONING',
            archetype: 'DEBUGGING',
            interviewPriority: 'HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 180,
          },
        },
      },
      'System Design': {
        'Scalability': {
          EASY: {
            question: 'What is the difference between horizontal and vertical scaling?',
            concepts: ['scaling', 'horizontal scaling', 'vertical scaling', 'capacity'],
            questionType: 'CONCEPTUAL',
            archetype: 'FOUNDATIONAL',
            interviewPriority: 'MEDIUM',
            expectedAnswerDepth: 'SHORT',
            estimatedAnswerTimeSeconds: 60,
          },
          MEDIUM: {
            question: 'How would you design a URL shortening service like bit.ly? Consider scalability requirements.',
            concepts: ['url shortening', 'id generation', 'redirect', 'caching', 'database design', 'scalability'],
            questionType: 'DESIGN',
            archetype: 'SCALABILITY',
            interviewPriority: 'VERY_HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 600,
          },
          HARD: {
            question: 'Design a rate limiter for a high-traffic API. How would you handle distributed rate limiting across multiple servers?',
            concepts: ['rate limiting', 'token bucket', 'leaky bucket', 'distributed systems', 'redis', 'consistency'],
            questionType: 'DESIGN',
            archetype: 'SCALABILITY',
            interviewPriority: 'VERY_HIGH',
            expectedAnswerDepth: 'DEEP',
            estimatedAnswerTimeSeconds: 600,
          },
        },
      },
    };

    // Try to find a matching question
    const topicQuestions = questionLibrary[topic];
    if (topicQuestions) {
      const subtopicQuestions = topicQuestions[subtopic];
      if (subtopicQuestions) {
        const difficultyQuestion = subtopicQuestions[difficulty];
        if (difficultyQuestion) {
          return difficultyQuestion;
        }
      }
    }

    // Fallback: generate a generic question based on topic
    return {
      question: `Explain key concepts in ${subtopic} within ${topic}. What are the important considerations for production applications?`,
      concepts: [subtopic.toLowerCase(), topic.toLowerCase(), 'production', 'best practices'],
      questionType: 'CONCEPTUAL',
      archetype: 'FOUNDATIONAL',
      interviewPriority: 'MEDIUM',
      expectedAnswerDepth: 'MODERATE',
      estimatedAnswerTimeSeconds: 120,
    };
  },

  // Generate multiple questions for a session
  async generateSessionQuestions(
    topic: string,
    subtopics: string[],
    difficultyDistribution: { EASY: number; MEDIUM: number; HARD: number },
    patterns: string[],
    options: any = {}
  ): Promise<any[]> {
    const questions: any[] = [];

    for (const subtopic of subtopics) {
      // Generate questions according to difficulty distribution
      const difficulties = [
        ...Array(difficultyDistribution.EASY).fill('EASY'),
        ...Array(difficultyDistribution.MEDIUM).fill('MEDIUM'),
        ...Array(difficultyDistribution.HARD).fill('HARD'),
      ];

      for (const difficulty of difficulties) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const question = await this.generateQuestion(
          topic,
          subtopic,
          difficulty as any,
          pattern,
          options
        );

        questions.push({
          ...question,
          topic,
          subtopic,
          difficulty,
          pattern,
          provenance: 'AI_GENERATED',
          qualityStatus: 'pending' as const,
          isHidden: false,
          isDeprecated: false,
          tags: [topic.toLowerCase(), subtopic.toLowerCase(), pattern.toLowerCase()],
          followUpConcepts: question.concepts,
          createdAt: new Date(),
          version: 1,
        });
      }
    }

    return questions;
  },

  // Generate questions from your pattern list
  async generateFromPatternList(
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    pattern: string,
    count: number,
    options: any = {}
  ): Promise<any[]> {
    const questions: any[] = [];
    const patternTypes: Record<string, { topic: string; subtopic: string; patterns: string[] }> = {
      'two_pointer': { topic: 'JavaScript', subtopic: 'Arrays & Strings', patterns: ['two_pointers', 'arrays', 'strings'] },
      'array_matrix': { topic: 'JavaScript', subtopic: 'Arrays & Matrix', patterns: ['arrays', 'matrix', 'two_pointers'] },
      'linked_list': { topic: 'JavaScript', subtopic: 'Linked Lists', patterns: ['linked_lists', 'two_pointers'] },
      'tree_traversal': { topic: 'JavaScript', subtopic: 'Trees', patterns: ['trees', 'recursion', 'dfs', 'bfs'] },
    };

    const patternConfig = patternTypes[pattern] || { topic: 'General', subtopic: 'Problem Solving', patterns: ['problem_solving'] };

    for (let i = 0; i < count; i++) {
      const question = await this.generateQuestion(
        patternConfig.topic,
        patternConfig.subtopic,
        difficulty,
        patternConfig.patterns[i % patternConfig.patterns.length],
        options
      );

      questions.push({
        ...question,
        topic: patternConfig.topic,
        subtopic: patternConfig.subtopic,
        difficulty,
        archetype: difficulty === 'EASY' ? 'FOUNDATIONAL' : difficulty === 'MEDIUM' ? 'CONCEPTUAL' : 'DEEP_DIVE',
        provenance: 'AI_GENERATED',
        qualityStatus: 'pending',
        isHidden: false,
        isDeprecated: false,
        tags: [pattern, patternConfig.topic.toLowerCase(), patternConfig.subtopic.toLowerCase()],
        followUpConcepts: question.concepts,
        createdAt: new Date(),
        version: 1,
      });
    }

    return questions;
  },

  // Validate generated question
  validateQuestion(question: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!question.question || question.question.length < 10) {
      errors.push('Question text is too short');
    }

    if (!question.concepts || question.concepts.length === 0) {
      errors.push('No concepts specified');
    }

    if (!question.questionType) {
      errors.push('Question type is missing');
    }

    if (!question.difficulty) {
      errors.push('Difficulty is missing');
    }

    if (!question.estimatedAnswerTimeSeconds || question.estimatedAnswerTimeSeconds < 30) {
      errors.push('Estimated time is too short');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

export default aiQuestionGenerator;
