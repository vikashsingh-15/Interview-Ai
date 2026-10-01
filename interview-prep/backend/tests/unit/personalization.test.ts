import { normalizeQuestion, questionHash, nearDuplicate, cosine, generatedBatchSchema, matchesQuestionTopic } from '../../src/modules/questions/personalized-generator';
import { parseResumeBuffer, extractResumeText } from '../../src/modules/resume/resume-parser';
import { docxResume, pdfResume } from '../helpers/resume-fixtures';

describe('resume extraction and question identity',()=>{
  test('fallback practice category does not require its literal label in the answer',()=>{
    expect(matchesQuestionTopic('Professional experience', 'Explain how you would prioritize competing stakeholder requirements.')).toBe(true);
    expect(matchesQuestionTopic('Redis', 'Explain Redis cache eviction.')).toBe(true);
    expect(matchesQuestionTopic('Java', 'Explain JavaScript closures.')).toBe(false);
    expect(matchesQuestionTopic('Redis', 'Explain a SQL join.')).toBe(false);
  });
  test('DOCX parsing extracts actual content without sample employers or projects',async()=>{
    const result=await parseResumeBuffer(await docxResume('A real candidate knows Python and React. Contact real@example.test.'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document','test');
    expect(result.skills.map(s=>s.name)).toEqual(expect.arrayContaining(['Python','React']));
    expect(result.skills.map(s=>s.name)).not.toContain('Java');
    expect(result.experience).toEqual([]);expect(result.projects).toEqual([]);
    expect(result.email).toBe('real@example.test');
  });
  test('PDF parsing reads actual text',async()=>{
    const text=await extractResumeText(pdfResume('Candidate resume with Python React and PostgreSQL experience.'),'application/pdf');
    expect(text).toContain('PostgreSQL');
  });
  test('invalid files and unreadable content are rejected',async()=>{
    await expect(extractResumeText(Buffer.from('not a PDF'),'application/pdf')).rejects.toThrow('Invalid PDF');
    await expect(extractResumeText(await docxResume('tiny'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).rejects.toThrow('No readable text');
  });
  test('normalization excludes punctuation, case and spacing repeats',()=>{
    expect(normalizeQuestion('  Why Redis? ')).toBe('why redis');
    expect(questionHash('WHY Redis?')).toBe(questionHash('why   redis.'));
    expect(nearDuplicate('How would you invalidate stale Redis cache entries?', 'How would you invalidate stale Redis cache entries.')).toBe(true);
  });
  test('same concept with a different reasoning problem is allowed',()=>{
    expect(nearDuplicate('How would you invalidate stale Redis cache entries?', 'In Redis, explain memory eviction when the configured limit is reached.')).toBe(false);
  });
  test('semantic cosine handles equal vectors and dimension mismatch',()=>{
    expect(cosine([1,0],[1,0])).toBe(1);expect(cosine([1],[1,0])).toBe(0);
  });
  test('malformed and short questions fail schema validation',()=>{
    expect(generatedBatchSchema.safeParse({questions:[{question:'What is Python?'}]}).success).toBe(false);
  });
});
