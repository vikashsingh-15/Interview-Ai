import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import config from '../../config';
import logger from '../../config/logger';
import { NotFoundError } from '../filters/error-filter';

function localPath(key:string):string {
  const root=path.resolve(config.upload.storagePath);
  const resolved=path.resolve(root,key);
  if(!key || resolved===root || !resolved.startsWith(root+path.sep)) throw new Error('Invalid storage key');
  return resolved;
}
function bucket() {
  if(mongoose.connection.readyState!==1 || !mongoose.connection.db) throw new Error('Resume storage requires a connected MongoDB database');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db,{bucketName:'resumeFiles'});
}
function checkProvider(provider:string) {
  if(provider!=='gridfs' && provider!=='local') throw new Error('Legacy cloud resume: export the original file and re-upload it to MongoDB');
}
export const resumeStorage={
  async put(key:string,buffer:Buffer,contentType:string):Promise<void> {
    if(!key || !buffer.length || buffer.length>config.upload.maxSizeMB*1024*1024) throw new Error('Invalid resume file size or key');
    const store=bucket();
    const upload=store.openUploadStream(key,{metadata:{contentType}});
    try {await pipeline(Readable.from([buffer]),upload);}
    catch(error) {
      // Best-effort cleanup of a half-written upload; never mask the original
      // failure, but surface a failed cleanup instead of swallowing it.
      await store.delete(upload.id).catch((cleanupError)=>{
        logger.warn('Failed to remove partially uploaded resume file', {
          module: 'storage', byteLength: buffer.length,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      });
      throw error;
    }
  },
  async get(key:string,provider:string='gridfs'):Promise<Buffer> {
    checkProvider(provider);
    if(provider==='local') return fs.readFile(localPath(key));
    const store=bucket();
    const file=await store.find({filename:key}).sort({uploadDate:-1}).limit(1).next();
    if(!file) throw new NotFoundError('Stored resume not found');
    const chunks:Buffer[]=[];
    for await(const chunk of store.openDownloadStream(file._id)) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  },
  async delete(key:string,provider:string='gridfs'):Promise<void> {
    checkProvider(provider);
    if(provider==='local') {
      await fs.unlink(localPath(key)).catch(error=>{if(error.code!=='ENOENT')throw error;});
      return;
    }
    const store=bucket();
    for await(const file of store.find({filename:key})) await store.delete(file._id);
  },
};
