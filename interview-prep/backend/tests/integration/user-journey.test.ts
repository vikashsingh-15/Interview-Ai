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
import { resumeStorage } from '../../src/common/services/resume-storage';
import { deleteUserData } from '../../src/modules/auth/user-data.service';

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
async function onboard(agent:any,email:string,skill:string) {
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
    experience:[],projects:[],
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
  const result=await onboard(a,'a@example.test','Python');userId=result.userId;versionId=result.version;
  await onboard(b,'b@example.test','React');
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
