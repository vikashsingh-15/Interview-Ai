import { normalizeQuestion, questionHash, nearDuplicate, cosine, generatedBatchSchema, matchesQuestionTopic,
  matchesSystemDesignTopic, hasValidProjectGrounding, buildProjectFallbackQuestions } from '../../src/modules/questions/personalized-generator';
import { parseResumeBuffer, extractResumeText, extractedResumeSchema, localExtraction } from '../../src/modules/resume/resume-parser';
import * as structuredAiModule from '../../src/common/services/structured-ai';
import config from '../../src/config';
import { docxResume, pdfResume } from '../helpers/resume-fixtures';
import { buildDailyPlan, planTotal } from '../../src/modules/profile/daily-plan';

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
  test('generic fallback discovers explicit skills from technical-skills and stack sections',()=>{
    const result=localExtraction(`
      SUMMARY
      Data engineer building lakehouse pipelines.
      PROJECTS
      Stack: Azure Databricks · PySpark · Delta Lake · Unity Catalog · Kafka
      TECHNICAL SKILLS
      Languages: Python, PySpark, SQL
      Azure & Databricks: Azure Databricks, ADLS Gen2, Azure Data Factory
      Orchestration: Apache Airflow
      BI & Tools: Tableau, Git
      EDUCATION
      B.Tech
    `);
    expect(result.skills.map(s=>s.name)).toEqual(expect.arrayContaining([
      'Azure Databricks','PySpark','Delta Lake','Unity Catalog','Kafka','Python','SQL',
      'ADLS Gen2','Azure Data Factory','Apache Airflow','Tableau','Git',
    ]));
    expect(result.skills.map(s=>s.name)).toEqual(expect.arrayContaining(['Azure Databricks']));
    expect(result.skills.filter(s=>s.name.toLowerCase()==='azure databricks')).toHaveLength(1);
    const facts=localExtraction(`WORK EXPERIENCE
Jio Platforms Limited — Data Engineer Dec 2023 – Present
PROJECTS
Procurement & Inventory Analytics on Azure Databricks • Jio Telco
Stack: Azure Databricks · PySpark · Delta Lake
Built an inventory analytics fact from SAP tables using Delta MERGE.
EDUCATION
B.Tech`);
    expect(facts.experience[0]).toMatchObject({company:'Jio Platforms Limited',role:'Data Engineer',currentRole:true});
    expect(facts.projects[0]).toMatchObject({name:'Procurement & Inventory Analytics on Azure Databricks',technologies:['Azure Databricks','PySpark','Delta Lake']});
    expect(facts.projects[0].description).toContain('inventory analytics fact');
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
  test('system-design focus areas accept architecture prompts without exact focus wording',()=>{
    expect(matchesSystemDesignTopic('Distributed systems', 'Design a highly available message service',
      'Partition data by conversation, replicate across regions, and reason about consistency and failure recovery.',
      ['availability','replication'], 'DESIGN')).toBe(true);
    expect(matchesSystemDesignTopic('Distributed systems', 'Explain Java generics',
      'Describe type erasure and bounded wildcards.', ['generics'], 'CONCEPTUAL')).toBe(false);
  });
  test('project grounding requires the matching confirmed project, or an explicitly hypothetical prompt',()=>{
    const facts=[{id:0,kind:'project',name:'Cortex',description:'RAG assistant'}];
    expect(hasValidProjectGrounding('Cortex','confirmed_experience',[0],facts)).toBe(true);
    expect(hasValidProjectGrounding('WriteFlow','confirmed_experience',[0],facts)).toBe(false);
    expect(hasValidProjectGrounding('Java project design','hypothetical',[],[])).toBe(true);
    expect(hasValidProjectGrounding('Java project design','confirmed_experience',[],[])).toBe(false);
  });
  test('project fallback questions are grounded or explicitly hypothetical and include study guidance',()=>{
    const grounded=buildProjectFallbackQuestions('Cortex',[{id:0,kind:'project',name:'Cortex',description:'RAG assistant'}],2,'hard');
    expect(grounded).toHaveLength(2);
    expect(grounded[0]).toMatchObject({factIds:[0],framing:'confirmed_experience',difficulty:'HARD'});
    expect(grounded[0].detailedAnswer.length).toBeGreaterThan(350);
    const hypothetical=buildProjectFallbackQuestions('Java',[{id:0,kind:'skill',name:'Java'}],1);
    expect(hypothetical[0]).toMatchObject({factIds:[],framing:'hypothetical'});
    expect(hypothetical[0].question).toContain('hypothetical');
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
  test('every configured section produces a plan section, not just the first',()=>{
    // Regression: the sync used to redistribute counts only among sections that
    // already existed, so three of the four settings did nothing.
    const plan=buildDailyPlan({
      preferences:{dailyQuestions:10,codingCount:2,systemDesignCount:5,projectQuestions:5,systemDesignFocus:[]},
      confirmedSkills:['Java','JavaScript','TypeScript','Python'],
    });
    const byType=(t:string)=>plan.filter(s=>s.type===t).reduce((n,s)=>n+s.count,0);
    expect(byType('technical')).toBe(10);
    expect(byType('coding')).toBe(2);
    expect(byType('system_design')).toBe(5);
    expect(byType('project')).toBe(5);
    expect(planTotal(plan)).toBe(22);
  });
  test('technical questions spread across confirmed skills instead of stacking one topic',()=>{
    const plan=buildDailyPlan({preferences:{dailyQuestions:10,codingCount:0,systemDesignCount:0,projectQuestions:0},
      confirmedSkills:['Java','JavaScript','TypeScript','Python','Node.js']});
    const topics=new Set(plan.filter(s=>s.type==='technical').map(s=>s.topic));
    expect(topics.size).toBeGreaterThan(1);
    expect(plan.filter(s=>s.type==='technical').reduce((n,s)=>n+s.count,0)).toBe(10);
  });
  test('a zeroed setting produces no section at all',()=>{
    const plan=buildDailyPlan({preferences:{dailyQuestions:4,codingCount:1,systemDesignCount:0,projectQuestions:0},
      confirmedSkills:['Java'],confirmedProjects:['Payments API']});
    expect(plan.some(s=>s.type==='system_design')).toBe(false);
    expect(plan.some(s=>s.type==='project')).toBe(false);
    expect(plan.some(s=>s.type==='coding')).toBe(true);
  });
  test('project questions fall back to a portfolio section when none are confirmed',()=>{
    // Honouring the slider matters more than a resume-specific framing that the
    // data cannot support; the generator keeps these hypothetical.
    const plan=buildDailyPlan({preferences:{dailyQuestions:0,codingCount:0,systemDesignCount:0,projectQuestions:3},
      confirmedSkills:['Java'],confirmedProjects:[]});
    expect(plan.filter(s=>s.type==='project')).toHaveLength(1);
    expect(plan[0].count).toBe(3);
  });
  test('confirmed projects get their own sections',()=>{
    const plan=buildDailyPlan({preferences:{dailyQuestions:0,codingCount:0,systemDesignCount:0,projectQuestions:5},
      confirmedSkills:['Java'],confirmedProjects:['Payments API','Search Platform']});
    expect(plan.filter(s=>s.type==='project').map(s=>s.topic).sort())
      .toEqual(['Payments API','Search Platform']);
  });
  test('excluded topics never appear in the plan',()=>{
    const plan=buildDailyPlan({preferences:{dailyQuestions:4,codingCount:0,systemDesignCount:0,projectQuestions:0,
      focusTopics:['Java','Rust'],excludedTopics:['Java']},confirmedSkills:['Java','Python']});
    expect(plan.map(s=>s.topic)).not.toContain('Java');
  });
  test('all settings at zero yields an empty plan rather than throwing',()=>{
    expect(buildDailyPlan({preferences:{dailyQuestions:0,codingCount:0,systemDesignCount:0,projectQuestions:0},
      confirmedSkills:['Java']})).toEqual([]);
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
