import { generatePersonalizedQuestions } from './personalized-generator';
import { BadRequestError } from '../../common/filters/error-filter';

// Compatibility adapter. Sample questions have been removed; identity is required.
export const aiQuestionGenerator = {
  async generateQuestion(topic:string, subtopic:string, difficulty:string, pattern:string,
    options:{ userId?:string; targetRole?:string; candidateLevel?:string; weakConcepts?:string[]; resumeSkills?:string[] } = {}) {
    if (!options.userId) throw new BadRequestError('Authenticated user identity is required for personalized generation');
    const questions = await generatePersonalizedQuestions(options.userId,topic,1);
    if (!questions.length) throw new BadRequestError('No new validated question available');
    return questions[0];
  },
};
export default aiQuestionGenerator;
