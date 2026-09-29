import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { resumeStorage } from '../../src/common/services/resume-storage';
import { docxResume, pdfResume } from '../helpers/resume-fixtures';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import config from '../../src/config';
import { ResumeVersion } from '../../src/modules/resume/resume.model';
import { migrateResumeStorage } from '../../src/scripts/migrate-resume-storage';
import { resumeService } from '../../src/modules/resume/resume.service';

jest.setTimeout(120000);
let db:MongoMemoryServer;
beforeAll(async()=>{db=await MongoMemoryServer.create({instance:{launchTimeout:60000}});await mongoose.connect(db.getUri());});
afterAll(async()=>{
  await mongoose.disconnect();
  await expect(resumeStorage.get('owner/disconnected.pdf')).rejects.toThrow('connected MongoDB');
  if(db)await db.stop();
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
  try {
    await expect(resumeService.uploadResume(String(new mongoose.Types.ObjectId()),{
      buffer:bytes,size:bytes.length,originalname:'cleanup.pdf',mimetype:'application/pdf',
    } as Express.Multer.File)).rejects.toThrow('fixture metadata failure');
    expect(await mongoose.connection.db!.collection('resumeFiles.files').countDocuments()).toBe(0);
    expect(await mongoose.connection.db!.collection('resumeFiles.chunks').countDocuments()).toBe(0);
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
