import mongoose from 'mongoose';
import Resume from './resume.model';
import InterviewProfile from '../profile/interview-profile.model';

/** Remove only the obsolete single-resume constraint left by older deployments. */
export async function ensureMultiResumeIndexes(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB is not connected');
  const collection = database.collection(Resume.collection.name);
  const exists = await database.listCollections({ name: Resume.collection.name }).hasNext();
  if (!exists) {
    await ensureInterviewProfileIndexes();
    return;
  }
  const indexes = await collection.indexes();
  for (const index of indexes) {
    if (index.unique && Object.keys(index.key).length === 1 && index.key.userId === 1) {
      await collection.dropIndex(index.name!);
    }
  }
  await Resume.createIndexes();
  await ensureInterviewProfileIndexes();
}

/** Old deployments retained userId_1 unique even after the schema changed. */
export async function ensureInterviewProfileIndexes(): Promise<void> {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB is not connected');
  const collection = database.collection(InterviewProfile.collection.name);
  if (!(await database.listCollections({ name: collection.collectionName }).hasNext())) {
    await InterviewProfile.createIndexes();
    return;
  }
  // Establish the replacement guard before removing the obsolete constraint.
  await collection.createIndex({ userId: 1, resumeProfileId: 1 }, { unique: true });
  for (const index of await collection.indexes()) {
    if (index.unique && Object.keys(index.key).length === 1 && index.key.userId === 1) {
      await collection.dropIndex(index.name!);
    }
  }
  await InterviewProfile.createIndexes();
}
