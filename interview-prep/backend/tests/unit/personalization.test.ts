import { normalizeQuestion, questionHash, nearDuplicate, cosine, generatedBatchSchema, matchesQuestionTopic } from '../../src/modules/questions/personalized-generator';
import { parseResumeBuffer, extractResumeText, extractedResumeSchema } from '../../src/modules/resume/resume-parser';
import * as structuredAiModule from '../../src/common/services/structured-ai';
import config from '../../src/config';
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
  test('schema tolerates quoted numbers and human dates from the model',()=>{
    const parsed=extractedResumeSchema.parse({
      totalExperienceMonths:'54',
      skills:[{name:'React',category:'framework',confidence:'0.85'},{name:'Python',confidence:'0.9'}],
      experience:[{company:'Acme',role:'SDE',startDate:'January 2022',endDate:'Present',responsibilities:null}],
      projects:[{name:'P',description:'d',startDate:'Jan 15, 2022',endDate:'2023/06'}],
    });
    expect(parsed.totalExperienceMonths).toBe(54);
    expect(parsed.skills[0].confidence).toBe(0.85);
    expect(parsed.skills[1].category).toBe('other');
    expect(parsed.experience[0].startDate).toBe('2022-01-01');
    expect(parsed.experience[0].endDate).toBeUndefined();
    expect(parsed.experience[0].responsibilities).toEqual([]);
    expect(parsed.projects[0].startDate).toBe('2022-01-15');
    expect(parsed.projects[0].endDate).toBe('2023-06-01');
  });
  test('out-of-range numbers fall back to defaults instead of rejecting',()=>{
    const parsed=extractedResumeSchema.parse({
      skills:[{name:'Go',confidence:'85'}],
      experience:[{company:'Acme',role:'SDE',startDate:'14/2022',endDate:'12/2099'}],
    });
    expect(parsed.skills[0].confidence).toBe(0.5);
    expect(parsed.experience[0].startDate).toBeUndefined();
    expect(parsed.experience[0].endDate).toBeUndefined(); // year 2099 outside sane bound
  });
  test('hollow entries are dropped and lists default to empty',()=>{
    const parsed=extractedResumeSchema.parse({
      skills:[{confidence:'0.9'},null,{name:'Docker'}],
      experience:[{company:'   ',role:'SDE'},{company:'Acme',role:''},{company:'Acme',role:'SDE'}],
      projects:[{name:'P'},{name:'P',description:'d'}],
      certifications:[{issuer:'X'}],
    });
    expect(parsed.skills.map((s)=>s.name)).toEqual(['Docker']);
    expect(parsed.experience.map((e)=>e.company)).toEqual(['Acme']);
    expect(parsed.projects.map((p)=>p.description)).toEqual(['d']);
    expect(parsed.certifications).toEqual([]);
  });
  test('AI failure falls back to local extraction instead of failing the upload',async()=>{
    const structuredAISpy=jest.spyOn(structuredAiModule,'structuredAI')
      .mockRejectedValue(new Error('schema validation failed: confidence expected number'));
    const originalKey=config.ai.apiKey;
    config.ai.apiKey='fixture';
    try {
      const result=await parseResumeBuffer(
        await docxResume('Candidate knows Rust and Kubernetes. Email rust.dev@example.test.'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document','test');
      expect(structuredAISpy).toHaveBeenCalled();
      expect(result.skills.map((s)=>s.name)).toEqual(expect.arrayContaining(['Rust','Kubernetes']));
      expect(result.email).toBe('rust.dev@example.test');
      expect(result.experience).toEqual([]);
    } finally {
      structuredAISpy.mockRestore();
      config.ai.apiKey=originalKey;
    }
  });
});
