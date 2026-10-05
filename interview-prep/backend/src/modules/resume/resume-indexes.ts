import mongoose from 'mongoose';
import Resume from './resume.model';

/** Remove only the obsolete single-resume constraint left by older deployments. */
export async function ensureMultiResumeIndexes(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB is not connected');
  const collection = database.collection(Resume.collection.name);
  const exists = await database.listCollections({ name: Resume.collection.name }).hasNext();
  if (!exists) return;
  const indexes = await collection.indexes();
  for (const index of indexes) {
    if (index.unique && Object.keys(index.key).length === 1 && index.key.userId === 1) {
      await collection.dropIndex(index.name!);
    }
  }
  await Resume.createIndexes();
}
