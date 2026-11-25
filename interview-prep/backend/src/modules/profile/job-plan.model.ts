import mongoose, { Schema } from 'mongoose';

const requirementSchema = new Schema({
  requirement:{type:String,required:true}, jobQuote:{type:String,required:true},
  resumeEvidence:String, topic:{type:String,required:true}, suggestion:String,
  completed:{type:Boolean,default:false},
}, {_id:false});
const schema = new Schema({
  userId:{type:Schema.Types.ObjectId,required:true,index:true},
  title:{type:String,required:true,maxlength:150}, description:{type:String,required:true,maxlength:12000},
  requirements:{type:[requirementSchema],default:[]},
}, {timestamps:true});
export default mongoose.model('JobPlan',schema);
