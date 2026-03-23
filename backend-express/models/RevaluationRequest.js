const mongoose = require('mongoose');

const RevaluationRequestSchema = new mongoose.Schema({
  rollNo: { type: String, required: true, uppercase: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  subjectIndex: { type: Number, required: true },
  subject: { type: String, required: true, trim: true },
  reason: { type: String, trim: true },
  oldMark: { type: Number, required: true },
  newMark: { type: Number },
  status: { type: String, enum: ['requested', 'assigned', 'updated', 'approved', 'rejected'], default: 'requested' },
  requestedBy: { type: String, required: true },
  assignedTo: { type: String },
  approvedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

RevaluationRequestSchema.index({ rollNo: 1, semester: 1, subjectIndex: 1, status: 1 });

module.exports = mongoose.model('RevaluationRequest', RevaluationRequestSchema);
