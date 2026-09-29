import mongoose from 'mongoose';
import crypto from 'crypto';
import config from '../config';
import { ResumeVersion } from '../modules/resume/resume.model';
import { resumeStorage } from '../common/services/resume-storage';

const checksum=(bytes:Buffer)=>crypto.createHash('sha256').update(bytes).digest('hex');
// Explicit, non-destructive migration. Original local files are never removed.
export async function migrateResumeStorage() {
  let migrated=0;
  for await(const version of ResumeVersion.find({storageProvider:{$ne:'gridfs'}}).cursor()) {
    const provider=version.storageProvider || 'local';
    if(provider!=='local') throw new Error('Legacy cloud resumes require export and re-upload before migration');
    const bytes=await resumeStorage.get(version.storageKey,'local');
    if(bytes.length!==version.fileSize || checksum(bytes)!==version.checksum) throw new Error('Local resume checksum/size mismatch: '+version._id);
    // A rerun after interrupted metadata update replaces only this version's copy.
    await resumeStorage.delete(version.storageKey,'gridfs');
    await resumeStorage.put(version.storageKey,bytes,version.mimeType);
    const stored=await resumeStorage.get(version.storageKey,'gridfs');
    if(stored.length!==bytes.length || checksum(stored)!==version.checksum) {
      await resumeStorage.delete(version.storageKey,'gridfs');
      throw new Error('GridFS verification failed: '+version._id);
    }
    await ResumeVersion.updateOne({_id:version._id,storageProvider:{$ne:'gridfs'}},{$set:{storageProvider:'gridfs',storagePath:version.storageKey},$unset:{filePath:1}});
    migrated++;
  }
  return migrated;
}
if(require.main===module) {
  (async()=>{
    try {
      await mongoose.connect(config.database.uri);
      console.log('Resume versions migrated:',await migrateResumeStorage());
    } catch(error) {
      console.error(error instanceof Error?error.message:'Resume migration failed');
      process.exitCode=1;
    } finally {await mongoose.disconnect();}
  })();
}
