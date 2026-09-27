import mongoose from 'mongoose';
import { Question, IQuestion } from './question.model';
import { QuestionHistory } from './question-history.model';
import { BadRequestError, NotFoundError } from '../../common/filters/error-filter';

// Question service
export const questionService = {
  // Get question by ID
  async getById(questionId: string): Promise<IQuestion | null> {
    const question = await Question.findById(questionId).lean();
    return (question as any) as IQuestion || null;
  },

  // Get questions by topic
  async getByTopic(
    topic: string,
    options: {
      subtopic?: string;
      difficulty?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<IQuestion[]> {
    const filter: any = {
      topic,
      isHidden: false,
      isDeprecated: false,
      qualityStatus: 'approved',
    };

    if (options.subtopic) {
      filter.subtopic = options.subtopic;
    }

    if (options.difficulty) {
      filter.difficulty = options.difficulty;
    }

    return Question.find(filter)
      .sort({ interviewPriority: -1, createdAt: -1 })
      .limit(options.limit || 20)
      .skip(options.offset || 0)
      .lean();
  },

  // Search questions
  async search(
    query: string,
    options: {
      topic?: string;
      difficulty?: string;
      limit?: number;
    } = {}
  ): Promise<IQuestion[]> {
    const filter: any = {
      isHidden: false,
      isDeprecated: false,
      qualityStatus: 'approved',
      $text: { $search: query },
    };

    if (options.topic) {
      filter.topic = options.topic;
    }

    if (options.difficulty) {
      filter.difficulty = options.difficulty;
    }

    return Question.find(filter)
      .select('question topic subtopic difficulty questionType interviewPriority')
      .limit(options.limit || 20)
      .lean();
  },

  // Get user's question history
  async getUserHistory(
    userId: string,
    options: {
      questionId?: string;
      topic?: string;
      subtopic?: string;
      status?: string;
      isRevision?: boolean;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const filter: any = { userId };

    if (options.questionId) {
      filter.questionId = options.questionId;
    }

    if (options.topic) {
      filter['questionSnapshot.topic'] = options.topic;
    }

    if (options.subtopic) {
      filter['questionSnapshot.subtopic'] = options.subtopic;
    }

    if (options.status) {
      filter.status = options.status;
    }

    if (options.isRevision !== undefined) {
      filter.isRevision = options.isRevision;
    }

    return QuestionHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .lean();
  },

  // Check if user has seen question
  async hasUserSeenQuestion(userId: string, questionId: string): Promise<boolean> {
    const history = await QuestionHistory.findOne({
      userId,
      questionId: new mongoose.Types.ObjectId(questionId),
    }).lean();

    return !!history;
  },

  // Create question
  async create(questionData: Partial<IQuestion>): Promise<IQuestion> {
    // Validate required fields
    if (!questionData.question || !questionData.topic) {
      throw new BadRequestError('Question and topic are required');
    }

    // Calculate normalized hash if not provided
    if (!questionData.normalizedHash) {
      const normalized = questionData.question
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }

      questionData.normalizedHash = `hash_${Math.abs(hash).toString(36)}`;
    }

    const question = await Question.create(questionData);
    return (question as any) as IQuestion;
  },

  // Find duplicates
  async findDuplicates(questionText: string, excludeId?: string): Promise<IQuestion[]> {
    const normalized = questionText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const hashStr = `hash_${Math.abs(hash).toString(36)}`;

    const filter: any = {
      normalizedHash: hashStr,
      isHidden: false,
      isDeprecated: false,
    };

    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    return Question.find(filter).lean();
  },

  // Increment view count
  async incrementViewCount(questionId: string): Promise<void> {
    await Question.findByIdAndUpdate(questionId, {
      $inc: { viewCount: 1 },
    });
  },

  // Increment usage count
  async incrementUsageCount(questionId: string): Promise<void> {
    await Question.findByIdAndUpdate(questionId, {
      $inc: { usageCount: 1 },
    });
  },

  // Flag question for review
  async flagQuestion(
    questionId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await Question.findByIdAndUpdate(questionId, {
      flagged: true,
      flaggedReason: reason,
      flaggedAt: new Date(),
      flaggedBy: new mongoose.Types.ObjectId(userId),
      qualityStatus: 'flagged',
    });
  },

  // Approve question
  async approveQuestion(questionId: string): Promise<void> {
    await Question.findByIdAndUpdate(questionId, {
      qualityStatus: 'approved',
      reviewedCount: { $inc: 1 },
    });
  },

  // Reject question
  async rejectQuestion(questionId: string, reason: string): Promise<void> {
    await Question.findByIdAndUpdate(questionId, {
      qualityStatus: 'rejected',
      flaggedReason: reason,
      flaggedAt: new Date(),
      isHidden: true,
    });
  },

  // Get question statistics
  async getStats(): Promise<any> {
    return Question.aggregate([
      {
        $match: { isHidden: false, isDeprecated: false },
      },
      {
        $group: {
          _id: '$provenance',
          count: { $sum: 1 },
          averageDifficulty: { $avg: { $cond: [{ $eq: ['$difficulty', 'EASY'] }, 1, { $eq: ['$difficulty', 'MEDIUM'] }, 2, { $eq: ['$difficulty', 'HARD'] }, 3, 2] } },
        },
      },
      { $sort: { count: -1 } },
    ]);
  },

  // Get topics with question counts
  async getTopicsWithCounts(): Promise<any[]> {
    return Question.aggregate([
      {
        $match: { isHidden: false, isDeprecated: false, qualityStatus: 'approved' },
      },
      {
        $group: {
          _id: '$topic',
          count: { $sum: 1 },
          questions: { $push: '$question' },
        },
      },
      {
        $project: {
          _id: 0,
          topic: '$_id',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
  },

  // Create from AI generation
  async createFromAI(
    questionData: Omit<IQuestion, '_id' | 'createdAt' | 'updatedAt' | 'version'> & { _id?: mongoose.Types.ObjectId }
  ): Promise<IQuestion> {
    // Check for duplicates
    const duplicates = await this.findDuplicates(questionData.question);
    if (duplicates.length > 0) {
      throw new BadRequestError('Similar question already exists');
    }

    // Validate concepts
    if (!questionData.concepts || questionData.concepts.length === 0) {
      throw new BadRequestError('Question must have at least one concept');
    }

    // Set defaults
    const question = await this.create({
      ...questionData,
      provenance: 'AI_GENERATED',
      qualityStatus: 'pending',
      version: 1,
      viewCount: 0,
      usageCount: 0,
    });

    return question;
  },
};
