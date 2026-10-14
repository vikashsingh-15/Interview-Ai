import mongoose, { Schema } from 'mongoose';

export const QuestionFeedback = mongoose.models.QuestionFeedback || mongoose.model('QuestionFeedback', new Schema({
  userId: Schema.Types.ObjectId,
  sessionId: Schema.Types.ObjectId,
  questionId: Schema.Types.ObjectId,
  kind: String,
  notes: String,
}, { timestamps: true }));

