import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from '../../src/config';
import { app } from '../../src/index';
import { docxResume } from '../helpers/resume-fixtures';
import { DailySession } from '../../src/modules/sessions/daily-session.model';
import { Question } from '../../src/modules/questions/question.model';
import { QuestionExposure, buildQuestionPlan } from '../../src/modules/questions/personalized-generator';
import { Session } from '../../src/modules/auth/index.model';
import { createSession, hashToken } from '../../src/common/middleware/auth';
import User from '../../src/modules/auth/user.model';
import { ResumeVersion } from '../../src/modules/resume/resume.model';
import Resume from '../../src/modules/resume/resume.model';
import ResumeProfile from '../../src/modules/resume/resume-profile.model';
import InterviewProfile from '../../src/modules/profile/interview-profile.model';
import { resumeService } from '../../src/modules/resume/resume.service';
import { resumeStorage } from '../../src/common/services/resume-storage';
import { deleteUserData } from '../../src/modules/auth/user-data.service';
import DailyRecord from '../../src/modules/calendar/daily-record.model';
import CodingProblem from '../../src/modules/coding/coding-problem.model';

jest.setTimeout(120000);
let db:MongoMemoryServer;
const a=request.agent(app),b=request.agent(app);
let userId:string,versionId:string,sessionId:string,mappingId:string;
const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
test('account data deletion removes only owned GridFS files and chunks',async()=>{
  const owner=new mongoose.Types.ObjectId();
  const key=String(owner)+'/delete.docx';
  const otherKey='other-owner/preserve.docx';
  const bytes=await docxResume('Stored resume');
  await resumeStorage.put(key,bytes,mime);
  await resumeStorage.put(otherKey,bytes,mime);
  const version=await ResumeVersion.create({userId:owner,versionNumber:1,originalFilename:'delete.docx',
    mimeType:mime,fileSize:bytes.length,storageKey:key,storageProvider:'gridfs',checksum:'fixture'});
  await Resume.create({userId:owner,versions:[version._id]});
  await deleteUserData(String(owner));
  await expect(resumeStorage.get(key)).rejects.toThrow('not found');
  expect(await resumeStorage.get(otherKey)).toEqual(bytes);
  await resumeStorage.delete(otherKey);
});
async function onboard(agent:any,email:string,skill:string,projectName:string) {
  const user=await User.create({email,name:'Candidate',googleId:'fixture-'+email,isEmailVerified:true});
  agent.set('Cookie',config.auth.cookieName+'='+await createSession(String(user._id)));
  const upload=await agent.post('/api/resume/upload').attach('file',await docxResume('Candidate resume with '+skill+' professional experience and real contact details.'),{filename:'resume.docx',contentType:mime});
  expect(upload.status).toBe(201);
  const version=upload.body.data.resumeVersion.id;
  expect((await agent.post('/api/resume/parse/'+version)).status).toBe(200);
  const extracted=await agent.get('/api/resume/profile');expect(extracted.status).toBe(200);
  expect(extracted.body.data.skills.every((s:any)=>!s.isConfirmed)).toBe(true);
  expect((await agent.put('/api/profile/review').send({
    currentRole:'Professional',skills:extracted.body.data.skills.map((s:any)=>({...s,isConfirmed:true,isRemoved:false})),
    experience:[],projects:[{name:projectName,description:'Built a '+projectName+' during onboarding test.',isConfirmed:true,isRemoved:false}],
  })).status).toBe(200);
  expect((await agent.post('/api/profile/onboarding').send({
    targetRole:'',targetLevel:'Senior',actualExperienceMonths:36,targetCompanies:[],
    difficulty:'medium',dailyPlan:[{title:'Skills',topic:skill,type:'technical',count:1}],
  })).status).toBe(200);
  return {userId:String(user._id),version};
}
beforeAll(async()=>{
  db=await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
});
afterAll(async()=>{
  await mongoose.disconnect();if(db)await db.stop();
});
test('Google-session user, genuine upload, review and generic-role onboarding',async()=>{
  const result=await onboard(a,'a@example.test','Python','Payments Platform');userId=result.userId;versionId=result.version;
  await onboard(b,'b@example.test','React','Chat Application');
  // Confirmed resume projects materialize as Project records, isolated per user.
  const projectsA=(await a.get('/api/projects')).body.data;
  const projectsB=(await b.get('/api/projects')).body.data;
  expect(projectsA.map((p:any)=>p.name)).toEqual(['Payments Platform']);
  expect(projectsB.map((p:any)=>p.name)).toEqual(['Chat Application']);
  expect(projectsA[0].isVerifiedFromResume).toBe(true);
  // Re-running onboarding updates in place instead of duplicating.
  expect((await a.post('/api/profile/onboarding').send({
    targetRole:'',targetLevel:'Senior',actualExperienceMonths:36,targetCompanies:[],
    difficulty:'medium',dailyPlan:[{title:'Skills',topic:'Python',type:'technical',count:1}],
  })).status).toBe(200);
  expect((await a.get('/api/projects')).body.data).toHaveLength(1);
  expect((await a.get('/api/resume/files/'+versionId)).status).toBe(200);
  expect((await b.get('/api/resume/files/'+versionId)).status).toBe(404);
  expect((await ResumeVersion.findById(versionId))?.storageProvider).toBe('gridfs');
  expect((await a.get('/api/auth/me')).body.data.id).toBe(userId);
  const profile=(await a.get('/api/profile/onboarding')).body.data.profile;
  expect(profile.targetRole).toBe('Professional');expect(profile.targetLevel).toBe('Senior');
  expect(profile.actualExperienceMonths).toBe(36);expect(profile.targetCompanies).toEqual([]);
  const pa=await buildQuestionPlan(userId,'Python',1);
  const pb=(await b.get('/api/auth/me')).body.data.id;
  const planB=await buildQuestionPlan(pb,'React',1);
  expect(JSON.stringify(pa.confirmedFacts)).toContain('Python');
  expect(JSON.stringify(planB.confirmedFacts)).not.toContain('Python');
});
test('review uses active resume and assigns unique IDs to newly added projects and experience', async()=>{
  const email='resume-review-active@example.test';
  const user=await User.create({email,name:'Candidate',googleId:'fixture-'+email,isEmailVerified:true});
  const agent=request.agent(app);
  agent.set('Cookie',config.auth.cookieName+'='+await createSession(String(user._id)));
  const first=await agent.post('/api/resume/upload').field('name','First').field('createNew','true')
    .attach('file',await docxResume('First resume contains Python and engineering background.'),{filename:'first.docx',contentType:mime});
  const firstVersion=first.body.data.resumeVersion.id;
  expect((await agent.post('/api/resume/parse/'+firstVersion)).status).toBe(200);
  const second=await agent.post('/api/resume/upload').field('name','Second').field('createNew','true')
    .attach('file',await docxResume('Second resume contains React and engineering background.'),{filename:'second.docx',contentType:mime});
  const secondVersion=second.body.data.resumeVersion.id;
  expect((await agent.post('/api/resume/parse/'+secondVersion)).status).toBe(200);
  const firstFacts=await ResumeProfile.findOne({userId:user._id,resumeVersionId:firstVersion});
  const secondFacts=await ResumeProfile.findOne({userId:user._id,resumeVersionId:secondVersion});
  secondFacts!.skills[0].isConfirmed=true;
  await secondFacts!.save();
  const interviewProfile=await InterviewProfile.create({userId:user._id,resumeProfileId:firstFacts!._id,
    onboardingCompleted:true,confirmedSkills:['Python']});
  expect((await agent.post('/api/resume/'+second.body.data.resume.id+'/activate')).status).toBe(200);
  expect((await InterviewProfile.findById(interviewProfile._id))?.onboardingCompleted).toBe(false);
  const regenerated=await resumeService.regenerateInterviewProfile(String(user._id));
  expect(String(regenerated.resumeProfile._id)).toBe(String(secondFacts!._id));
  expect(String(regenerated.interviewProfile.resumeProfileId)).toBe(String(secondFacts!._id));
  expect(regenerated.interviewProfile.confirmedSkills).toEqual(['React']);

  const submitted={currentRole:'Engineer',skills:[],
    experience:[{company:'New Co',role:'Engineer',responsibilities:[],technologies:[],achievements:[],projectReferences:[],technicalClaims:[]}],
    projects:[{name:'New Project',description:'A project I actually built.',technologies:[],responsibilities:[],architectureClaims:[],features:[],performanceClaims:[],metrics:[],securityClaims:[],technicalDecisions:[]}]};
  const reviewed=await agent.put('/api/profile/review').send(submitted);
  expect(reviewed.status).toBe(200);
  expect(reviewed.body.data.resumeVersionId).toBe(secondVersion);
  expect(reviewed.body.data.experience[0]._id).toMatch(/^[a-f\d]{24}$/i);
  expect(reviewed.body.data.projects[0]._id).toMatch(/^[a-f\d]{24}$/i);
  expect(String((await ResumeProfile.findOne({userId:user._id,resumeVersionId:firstVersion}))?.projects.length)).toBe('0');
  const id=reviewed.body.data.projects[0]._id;
  const duplicate=await agent.put('/api/profile/review').send({...submitted,projects:[{...submitted.projects[0],_id:id},{...submitted.projects[0],_id:id}]});
  expect(duplicate.status).toBe(400);
  expect(duplicate.body.error.message).toBe('Resume entry IDs must be unique and belong to this resume');
  const foreign=await agent.put('/api/profile/review').send({...submitted,projects:[{...submitted.projects[0],_id:'000000000000000000000001'}]});
  expect(foreign.status).toBe(400);
  expect(foreign.body.error.message).toBe('Resume entry IDs must be unique and belong to this resume');
});
test('cross-user resume parsing, settings, admin and CSRF are denied',async()=>{
  expect((await b.post('/api/resume/parse/'+versionId)).status).toBe(404);
  expect((await a.get('/api/admin/questions')).status).toBe(403);
  expect((await a.put('/api/profile/review').set('Origin','https://attacker.test').send({})).status).toBe(403);
  expect((await b.get('/api/resume/profile')).body.data.skills.map((s:any)=>s.name)).not.toContain('Python');
});
test('a private question bank is isolated, and daily sessions are concurrent/idempotent',async()=>{
  await Question.create({ownerUserId:userId,question:'In a Python data processing task, how would you prevent accidental mutation of shared state?',
    topic:'Python',subtopic:'State',concepts:['state'],difficulty:'MEDIUM',questionType:'CONCEPTUAL',
    archetype:'CONCEPTUAL',provenance:'USER_CREATED',qualityStatus:'approved'});
  const privateQ=await Question.findOne({ownerUserId:userId});
  const bBank=await b.get('/api/questions');expect(bBank.body.data.map((q:any)=>q._id)).not.toContain(String(privateQ!._id));
  const responses=await Promise.all([a.post('/api/sessions/generate'),a.post('/api/sessions/generate')]);
  expect(responses.some(r=>r.status===200)).toBe(true);
  expect(responses.every(r=>[200,409].includes(r.status))).toBe(true);
  expect(await DailySession.countDocuments({userId})).toBe(1);
  const today=await a.get('/api/sessions/today');expect(today.status).toBe(200);
  sessionId=today.body.data.sessionId;mappingId=today.body.data.sections[0].questions[0].id;
  expect(today.body.data.sections[0].questions[0].question).toContain('Python');
  expect(await QuestionExposure.countDocuments({userId})).toBe(1);
  expect((await a.get('/api/sessions/today')).body.data.sessionId).toBe(sessionId);
  const firstDay = await a.get('/api/sessions/day/1');
  expect(firstDay.status).toBe(200);
  expect(firstDay.body.data.sessionId).toBe(sessionId);
  expect((await b.get('/api/sessions/'+sessionId)).status).not.toBe(200);
  expect((await b.post('/api/sessions/'+sessionId+'/answers/'+mappingId).send({answer:'An unauthorized answer attempt'})).status).toBe(404);
});
test('feedback, real answer history, evaluation and revision work',async()=>{
  expect((await a.post('/api/feedback/'+sessionId+'/'+mappingId).send({kind:'need_revision'})).status).toBe(200);
  const answer=await a.post('/api/sessions/'+sessionId+'/answers/'+mappingId).send({answer:'I am not sure how this state handling works.'});
  expect(answer.status).toBe(200);expect(answer.body.data.evaluationSource).toBe('heuristic');
  expect(await mongoose.model('QuestionHistory').countDocuments({userId})).toBe(1);
  expect(await mongoose.model('Revision').countDocuments({userId})).toBe(1);
  const today=await a.get('/api/sessions/today');expect(today.body.data.completedQuestions).toBe(1);
  const plan=await buildQuestionPlan(userId,'Python',1);expect(plan.recentPerformance[0].feedback).toBe('need_revision');
});
test('fresh day never repeats an assigned question even if the topic/concept repeats',async()=>{
  await Question.create({ownerUserId:userId,question:'For a Python service, explain how you would isolate mutable state across concurrent worker tasks.',
    topic:'Python',subtopic:'Concurrency',concepts:['state'],difficulty:'MEDIUM',questionType:'CONCEPTUAL',
    archetype:'CONCEPTUAL',provenance:'USER_CREATED',qualityStatus:'approved'});
  const next=new Date(Date.now()+86400000).toISOString();
  expect((await a.post('/api/sessions/generate').send({date:next})).status).toBe(200);
  const exposed=await QuestionExposure.find({userId}).lean();
  expect(exposed).toHaveLength(2);expect(new Set(exposed.map(e=>e.normalizedHash)).size).toBe(2);
  const day3=await a.post('/api/sessions/generate').send({date:new Date(Date.now()+2*86400000).toISOString()});
  expect(day3.status).toBe(200);
  expect(await QuestionExposure.countDocuments({userId})).toBe(2);
});
test('skip resolves a question and regenerate replaces only pending questions',async()=>{
  // Fresh user with a seeded bank so refill has fresh questions to draw from.
  const agent=request.agent(app);
  const {userId:cid}=await onboard(agent,'c@example.test','Go','Inventory Service');
  const goScenarios=[
    'When a Go channel buffer fills while producers outpace consumers, how should the pipeline shed load without deadlocking?',
    'How would you detect and fix a goroutine leak in a Go service that spawns workers per request?',
    'In Go, why can an unbuffered channel cause a producer and consumer to deadlock, and how do you break the cycle?',
    'How would you design graceful shutdown for a Go worker pool processing in-flight jobs from a channel?',
    'When should a Go service prefer a mutex over channels for shared rate-counter state across goroutines?',
    'How could you bound memory usage in a Go fan-out pipeline where one slow consumer stalls every shard?',
    'In Go, how would you propagate cancellation from an HTTP handler cancel into a nested worker hierarchy?',
    'How would you make channel-based retries in Go idempotent when the downstream job may already have run?',
  ];
  for(const q of goScenarios){
    await Question.create({ownerUserId:cid,question:q,
      topic:'Go',subtopic:'Concurrency',concepts:['channels'],difficulty:'MEDIUM',questionType:'CONCEPTUAL',
      archetype:'CONCEPTUAL',provenance:'USER_CREATED',qualityStatus:'approved'});
  }
  await agent.post('/api/sessions/generate');
  let today=await agent.get('/api/sessions/today');
  expect(today.body.data.totalQuestions).toBe(1); // plan count is 1
  const first=today.body.data.sections[0].questions[0];

  // Skip the only question; it counts as resolved with no score impact.
  expect((await agent.post('/api/sessions/'+today.body.data.sessionId+'/questions/'+first.id+'/skip')).status).toBe(200);
  today=await agent.get('/api/sessions/today');
  expect(today.body.data.sections[0].questions[0].status).toBe('skipped');
  expect(today.body.data.completedQuestions).toBe(1);
  expect(today.body.data.averageScore).toBe(0);
  // Double-skip is rejected.
  expect((await agent.post('/api/sessions/'+today.body.data.sessionId+'/questions/'+first.id+'/skip')).status).toBe(409);

  // Raise the daily count to 3 and regenerate: the skipped question stays,
  // and the section refills with fresh questions from the bank.
  expect((await agent.put('/api/profile/preferences').send({dailyQuestions:3})).status).toBe(200);
  expect((await agent.post('/api/sessions/today/regenerate')).status).toBe(200);
  today=await agent.get('/api/sessions/today');
  expect(today.body.data.sections.find((s:any)=>s.type==='technical').totalQuestions).toBe(3);
  expect(today.body.data.sections.find((s:any)=>s.type==='technical').questions.some((x:any)=>x.id===first.id && x.status==='skipped')).toBe(true);
  const answeredTarget=today.body.data.sections.find((s:any)=>s.type==='technical').questions.find((x:any)=>x.status==='pending');

  // Answer one question so the next regenerate must preserve it.
  const answerRes=await agent.post('/api/sessions/'+today.body.data.sessionId+'/answers/'+answeredTarget.id).send({answer:'Channels connect goroutines so the worker pool drains jobs without race conditions.'});
  expect(answerRes.status).toBe(200);

  // Regenerate again: only the remaining pending question is replaced.
  expect((await agent.post('/api/sessions/today/regenerate')).status).toBe(200);
  today=await agent.get('/api/sessions/today');
  const section=today.body.data.sections.find((s:any)=>s.type==='technical');
  const statuses=section.questions.map((x:any)=>x.status);
  expect(statuses.filter((s:string)=>s==='answered')).toHaveLength(1);
  expect(statuses.filter((s:string)=>s==='skipped')).toHaveLength(1);
  expect(statuses.filter((s:string)=>s==='pending')).toHaveLength(1);
  expect(today.body.data.completedQuestions).toBe(2); // answered + skipped
  expect(today.body.data.averageScore).toBeGreaterThan(0);
  // No duplicate exposure rows: fresh questions were never served before.
  const exposed=await QuestionExposure.find({userId:cid}).lean();
  const hashes=exposed.map(e=>e.normalizedHash);
  expect(new Set(hashes).size).toBe(hashes.length);
  // Cross-user guard: another user cannot skip this user's question.
  expect((await b.post('/api/sessions/'+today.body.data.sessionId+'/questions/'+answeredTarget.id+'/skip')).status).toBe(404);
});

test('all four configured sections generate, and regenerated questions reach the calendar',async()=>{
  // Regression: only the first configured section used to be planned, so coding,
  // system design and project settings were silently ignored.
  const agent=request.agent(app);
  const {userId:tid}=await onboard(agent,'d@example.test','Rust','Ledger Service');
  // Seed bank questions per section type so no AI is required in tests. These
  // must be genuinely distinct: near-duplicate wording is (correctly) deduped.
  const bank:[string,string,boolean,string[]][] = [
    ['Rust','technical',false,[
      'How does the borrow checker decide that a mutable reference can no longer outlive its owner?',
      'Explain when a boxed closure beats capturing variables by move in a Rust API.',
      'A worker thread deadlocks only under load. Walk through how you would isolate the cause.',
      'Why can a recursive async function in Rust deadlock, and how do you restructure it?',
      'Compare zero-cost abstraction against a hand-written equivalent for a hot parsing loop.',
      'How would you make a large immutable collection cheap to share across threads?',
      'Explain trait object dispatch and when a generic would be measurably faster.',
      'What breaks when you hold a Mutex guard across an await point, and what is the fix?',
    ]],
    ['System design','system_design',true,[
      'Design a rate limiter that stays accurate while several regions can each add capacity.',
      'How would you shard a write-heavy ledger without losing ordering guarantees per account?',
      'Explain how you make an idempotent payment endpoint safe under client retries.',
      'Choose a consistency model for a leaderboard read by millions but written rarely.',
      'How do you drain connections without dropping in-flight requests during a deploy?',
      'Describe how you detect and break a split brain between two database nodes.',
      'How would you backfill a schema change on a live high-traffic table with no downtime?',
      'Explain backpressure in a queue-based pipeline when one consumer falls behind.',
    ]],
    ['Algorithms','coding',false,[]],
    ['Ledger Service','project',false,[
      'Describe how the ledger records a reversal without mutating historical entries.',
      'Explain how you would reconcile ledger totals against the payment processor daily.',
      'Walk through migrating the ledger schema while preserving audit history.',
      'How would you guarantee exactly-once effects when a ledger write is retried?',
      'Explain the trade-off between storing a running balance and deriving it on read.',
      'How would you design an audit trail that reconstructs every balance change?',
      'Describe how you would handle a correction that spans multiple accounts atomically.',
      'Explain how the ledger supports partial refunds while keeping entries append-only.',
    ]],
  ];
  for (const [topic,type,isFlag,questions] of bank) {
    for (const question of questions) {
      await Question.create({ownerUserId:tid,question,topic,subtopic:type,concepts:[topic],
        difficulty:'MEDIUM',questionType:type==='coding'?'CODING':'CONCEPTUAL',archetype:'CONCEPTUAL',
        provenance:'USER_CREATED',qualityStatus:'approved',isSystemDesign:isFlag});
    }
  }
  // Coding sections draw from the curated CodingProblem bank, not Question.
  for (const [i,title] of ['Longest substring without repeats','Merge k sorted streams',
    'Lowest common ancestor in a tree','Merge overlapping intervals'].entries()) {
    await CodingProblem.create({title,slug:'journey-d-'+i,description:'Solve '+title+' and explain the complexity.',
      difficulty:'medium',pattern:['arrays'],platform:'custom',examples:[{input:'a',output:'a'}],
      isInterviewRelevant:true});
  }
  expect((await agent.put('/api/profile/preferences').send({
    dailyQuestions:4,codingCount:2,systemDesignCount:2,projectQuestions:2 })).status).toBe(200);

  const profile=(await agent.get('/api/profile/preferences')).body.data.preferences;
  expect(profile.dailyQuestions).toBe(4);
  expect((await agent.post('/api/sessions/generate')).status).toBe(200);
  const today=(await agent.get('/api/sessions/today')).body.data;
  const totals=(type:string)=>today.sections.filter((s:any)=>s.type===type)
    .reduce((n:number,s:any)=>n+s.totalQuestions,0);
  expect(totals('technical')).toBe(4);
  expect(totals('coding')).toBe(2);
  expect(totals('system_design')).toBe(2);
  expect(totals('project')).toBe(2);

  // Every generated question is attached to the daily calendar exactly once.
  const dayKey=new Date().toISOString().slice(0,10);
  const record=await DailyRecord.findOne({userId:new mongoose.Types.ObjectId(tid),dateKey:dayKey}).lean();
  expect(record).toBeTruthy();
  const titles=(record as any).entries.map((e:any)=>e.title.trim().toLowerCase());
  expect(titles).toHaveLength(today.totalQuestions);
  expect(new Set(titles).size).toBe(titles.length);

  // Regeneration must also reach the calendar, and must not duplicate entries.
  expect((await agent.put('/api/profile/preferences').send({dailyQuestions:6})).status).toBe(200);
  expect((await agent.post('/api/sessions/today/regenerate')).status).toBe(200);
  const after=(await agent.get('/api/sessions/today')).body.data;
  const regenerated=(await DailyRecord.findOne({userId:new mongoose.Types.ObjectId(tid),dateKey:dayKey}).lean()) as any;
  const regeneratedTitles=regenerated.entries.map((e:any)=>e.title.trim().toLowerCase());
  expect(new Set(regeneratedTitles).size).toBe(regeneratedTitles.length);
  // Replaced questions stay on the calendar as history (per the user's choice) and
  // newly generated ones are appended, so the day accumulates every question
  // ever shown. The initial 10 are all still there, plus the 8 that were new.
  expect(regeneratedTitles.length).toBeGreaterThan(titles.length);
  expect(regeneratedTitles.length).toBe(18);
  for (const q of after.sections.flatMap((s:any)=>s.questions))
    expect(regeneratedTitles).toContain(String(q.question).trim().toLowerCase());
});

test('a coding section that cannot reach its quota reports why instead of dropping it silently',async()=>{
  // Regression: the coding section drew only from the curated CodingProblem
  // bank. With that bank unseeded it produced zero questions and the day just
  // looked short, which is how questions appeared to be "cut for some reason".
  const agent=request.agent(app);
  await onboard(agent,'e@example.test','Go','Queue Service');
  // Fewer curated problems exist than requested, and AI is disabled in tests, so
  // the shortfall is real and must be explained through the API.
  expect((await agent.put('/api/profile/preferences')
    .send({dailyQuestions:1,codingCount:10,systemDesignCount:0,projectQuestions:0})).status).toBe(200);
  expect((await agent.post('/api/sessions/generate')).status).toBe(200);
  const today=(await agent.get('/api/sessions/today')).body.data;
  const detail=(await agent.get('/api/sessions/'+today.sessionId)).body.data;
  const coding=detail.sections.find((s:any)=>s.type==='coding');
  expect(coding).toBeTruthy();
  expect(coding.totalQuestions).toBeGreaterThan(0);
  expect(coding.totalQuestions).toBeLessThan(10);
  // The reason travels with the session so the UI can show it.
  expect(String(coding.notes)).toMatch(/could be generated|No unused coding problems/i);
});

test('sessions expire, bearer tokens cannot authenticate, and logout revokes the cookie',async()=>{
  const token=await createSession(userId);
  expect((await request(app).get('/api/auth/me').set('Authorization','Bearer '+token)).status).toBe(401);
  expect((await request(app).get('/api/auth/me').set('Cookie',config.auth.cookieName+'='+token)).status).toBe(200);
  await Session.updateOne({token:hashToken(token)},{$set:{expiresAt:new Date(Date.now()-1000)}});
  expect((await request(app).get('/api/auth/me').set('Cookie',config.auth.cookieName+'='+token)).status).toBe(401);
  await a.post('/api/auth/logout');
  expect((await a.get('/api/auth/me')).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({email:'a@example.test',password:'irrelevant'})).status).toBe(404);
});
