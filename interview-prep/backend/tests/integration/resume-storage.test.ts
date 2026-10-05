import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { resumeStorage } from '../../src/common/services/resume-storage';
import { docxResume, pdfResume } from '../helpers/resume-fixtures';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import config from '../../src/config';
import Resume, { ResumeVersion } from '../../src/modules/resume/resume.model';
import { ensureMultiResumeIndexes } from '../../src/modules/resume/resume-indexes';
import { migrateResumeStorage } from '../../src/scripts/migrate-resume-storage';
import { resumeService } from '../../src/modules/resume/resume.service';
import request from 'supertest';
import { app } from '../../src/index';
import User from '../../src/modules/auth/user.model';
import { createSession } from '../../src/common/middleware/auth';
import InterviewProfile from '../../src/modules/profile/interview-profile.model';
import { ensureInterviewProfileIndexes } from '../../src/modules/resume/resume-indexes';

jest.setTimeout(120000);
let db:MongoMemoryServer;
beforeAll(async()=>{db=await MongoMemoryServer.create({instance:{launchTimeout:60000}});await mongoose.connect(db.getUri());});
afterAll(async()=>{
  await mongoose.disconnect();
  await expect(resumeStorage.get('owner/disconnected.pdf')).rejects.toThrow('connected MongoDB');
  if(db)await db.stop();
});
test('legacy interview profile constraint permits multiple resumes after migration',async()=>{
  await InterviewProfile.init();
  // All records here belong to this suite's isolated MongoMemoryServer.
  await InterviewProfile.deleteMany({});
  await InterviewProfile.collection.dropIndex('userId_1');
  await InterviewProfile.collection.createIndex({userId:1},{unique:true});
  const userId=new mongoose.Types.ObjectId();
  const first=await InterviewProfile.create({userId,resumeProfileId:new mongoose.Types.ObjectId()});
  await ensureInterviewProfileIndexes();
  const second=await InterviewProfile.create({userId,resumeProfileId:new mongoose.Types.ObjectId()});
  expect(String(first._id)).not.toBe(String(second._id));
  await expect(InterviewProfile.create({userId,resumeProfileId:first.resumeProfileId})).rejects.toMatchObject({code:11000});
  await ensureInterviewProfileIndexes();
  expect(await InterviewProfile.countDocuments({userId})).toBe(2);
});
test('PDF and DOCX bytes and MIME metadata live in MongoDB, not disk',async()=>{
  for(const [key,bytes,mime] of [
    ['owner/a.pdf',pdfResume('Real resume'),'application/pdf'],
    ['owner/a.docx',await docxResume('Real resume'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ] as const){
    await resumeStorage.put(key,bytes,mime);
    expect(await resumeStorage.get(key,'gridfs')).toEqual(bytes);
    const file=await mongoose.connection.db!.collection('resumeFiles.files').findOne({filename:key});
    expect(file?.metadata.contentType).toBe(mime);
    await resumeStorage.delete(key,'gridfs');
    expect(await mongoose.connection.db!.collection('resumeFiles.chunks').countDocuments({files_id:file!._id})).toBe(0);
    await expect(resumeStorage.get(key,'gridfs')).rejects.toThrow();
    await expect(resumeStorage.delete(key,'gridfs')).resolves.toBeUndefined();
  }
});
test('legacy cloud references are rejected, never silently read as GridFS',async()=>{
  await expect(resumeStorage.get('owner/legacy.pdf','s3')).rejects.toThrow('export');
});
test('legacy local keys cannot escape the uploads directory',async()=>{
  await expect(resumeStorage.get('../escape','local')).rejects.toThrow('Invalid storage key');
});
test('local migration verifies bytes, preserves originals and is idempotent',async()=>{
  const bytes=pdfResume('Legacy real resume');
  const key='legacy-'+crypto.randomUUID()+'.pdf';
  const filename=path.join(config.upload.storagePath,key);
  await fs.mkdir(config.upload.storagePath,{recursive:true});
  await fs.writeFile(filename,bytes);
  const version=await ResumeVersion.create({userId:new mongoose.Types.ObjectId(),versionNumber:1,storageProvider:'local',
    storageKey:key,originalFilename:key,mimeType:'application/pdf',fileSize:bytes.length,
    checksum:crypto.createHash('sha256').update(bytes).digest('hex')});
  try {
    expect(await migrateResumeStorage()).toBe(1);
    expect(await resumeStorage.get(key)).toEqual(bytes);
    expect(await fs.readFile(filename)).toEqual(bytes);
    expect((await ResumeVersion.findById(version._id))?.storageProvider).toBe('gridfs');
    expect(await migrateResumeStorage()).toBe(0);
  } finally {await fs.unlink(filename);await resumeStorage.delete(key);await ResumeVersion.deleteOne({_id:version._id});}
});
test('metadata creation failure removes the newly uploaded GridFS file',async()=>{
  const bytes=pdfResume('Test resume');
  const spy=jest.spyOn(ResumeVersion,'create').mockRejectedValueOnce(new Error('fixture metadata failure'));
  const userId=String(new mongoose.Types.ObjectId());
  try {
    await expect(resumeService.uploadResume(userId,{
      buffer:bytes,size:bytes.length,originalname:'cleanup.pdf',mimetype:'application/pdf',
    } as Express.Multer.File)).rejects.toThrow('fixture metadata failure');
    expect(await mongoose.connection.db!.collection('resumeFiles.files').countDocuments()).toBe(0);
    expect(await mongoose.connection.db!.collection('resumeFiles.chunks').countDocuments()).toBe(0);
    expect(await Resume.countDocuments({userId})).toBe(0);
  } finally {spy.mockRestore();}
});
test('corrupt local migration keeps metadata local and never removes the original',async()=>{
  const key='corrupt-'+crypto.randomUUID()+'.pdf';
  const filename=path.join(config.upload.storagePath,key);
  const bytes=pdfResume('Original retained');
  await fs.mkdir(config.upload.storagePath,{recursive:true});await fs.writeFile(filename,bytes);
  const version=await ResumeVersion.create({userId:new mongoose.Types.ObjectId(),versionNumber:1,storageProvider:'local',
    storageKey:key,originalFilename:key,mimeType:'application/pdf',fileSize:bytes.length,checksum:'wrong'});
  try {
    await expect(migrateResumeStorage()).rejects.toThrow('checksum/size mismatch');
    expect((await ResumeVersion.findById(version._id))?.storageProvider).toBe('local');
    expect(await fs.readFile(filename)).toEqual(bytes);
  } finally {await fs.unlink(filename);await ResumeVersion.deleteOne({_id:version._id});}
});
test('failed upload stream leaves no GridFS files or chunks',async()=>{
  const spy=jest.spyOn(mongoose.mongo.GridFSBucketWriteStream.prototype,'_write').mockImplementationOnce(function(_chunk,_encoding,callback){
    callback(new Error('fixture stream failure'));
  });
  try {
    await expect(resumeStorage.put('owner/failed.pdf',pdfResume('Failure'),'application/pdf')).rejects.toThrow('fixture stream failure');
    expect(await mongoose.connection.db!.collection('resumeFiles.files').countDocuments()).toBe(0);
    expect(await mongoose.connection.db!.collection('resumeFiles.chunks').countDocuments()).toBe(0);
  } finally {spy.mockRestore();}
});

test('a user can upload two named resumes without replacing the first', async()=>{
  const userId=String(new mongoose.Types.ObjectId());
  const makeFile=(name:string)=>{const bytes=pdfResume(name);return {buffer:bytes,size:bytes.length,originalname:`${name}.pdf`,mimetype:'application/pdf'} as Express.Multer.File;};
  const first=await resumeService.uploadResume(userId,makeFile('SDE'),{name:'SDE',createNew:true});
  const second=await resumeService.uploadResume(userId,makeFile('DataEngineer'),{name:'Data Engineer',createNew:true});
  expect(String(second.resume._id)).not.toBe(String(first.resume._id));
  expect(String((await Resume.findById(first.resume._id))?.currentVersionId)).toBe(String(first.resumeVersion._id));
  expect((await resumeService.listResumes(userId)).map(r=>r.name)).toEqual(['SDE','Data Engineer']);
  await resumeService.activateResume(userId,String(second.resume._id));
  expect(await Resume.countDocuments({userId,isActive:true,isDeleted:false})).toBe(1);
  expect((await resumeService.getResume(userId))?.resume.id.toString()).toBe(String(second.resume._id));
});

test('legacy unique user index is removed without touching other indexes',async()=>{
  // This suite uses an isolated in-memory database; clear its earlier fixtures
  // so the old single-resume constraint can be recreated faithfully.
  await Resume.deleteMany({});
  await Resume.collection.createIndex({userId:1},{unique:true,name:'legacy_single_resume_user'});
  await ensureMultiResumeIndexes();
  const indexes=await Resume.collection.indexes();
  expect(indexes.some(i=>i.name==='legacy_single_resume_user')).toBe(false);
  expect(indexes.some(i=>i.unique && i.partialFilterExpression?.isActive===true)).toBe(true);
});

test('Settings upload endpoint creates a second resume for the same signed-in user', async()=>{
  const user=await User.create({email:'two-resumes@example.test',name:'Candidate',googleId:'two-resumes-fixture',isEmailVerified:true});
  const agent=request.agent(app);
  agent.set('Cookie',config.auth.cookieName+'='+await createSession(String(user._id)));
  for(const name of ['SDE','Data Engineer']) {
    const response=await agent.post('/api/resume/upload').field('name',name).field('createNew','true')
      .attach('file',await docxResume(`Candidate knows ${name} and Python.`),{filename:`${name}.docx`,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    expect(response.status).toBe(201);
  }
  const list=await agent.get('/api/resume/list');
  expect(list.status).toBe(200);
  expect(list.body.data.map((r:any)=>r.name).sort()).toEqual(['Data Engineer','SDE']);
  expect((await Resume.find({userId:user._id,isDeleted:false})).length).toBe(2);
});
