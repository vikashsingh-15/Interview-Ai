import mongoose from 'mongoose';
import config from '../config';
import { Question } from '../modules/questions/question.model';

async function migrate() {
  await mongoose.connect(config.database.uri, {...config.database.options,autoIndex:false});
  const collection=Question.collection;
  await collection.createIndex({ownerUserId:1,normalizedHash:1},{unique:true,partialFilterExpression:{normalizedHash:{$type:'string'}},name:'owner_question_hash'});
  const indexes=await collection.indexes();
  const old=indexes.find(index=>index.unique && Object.keys(index.key).length===1 && index.key.normalizedHash===1);
  if(old?.name) await collection.dropIndex(old.name);
  console.log('Question index migration complete.');
}
migrate().catch(error=>{console.error('Question index migration failed:',error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
