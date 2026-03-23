const mongoose = require('mongoose');

const AssignmentGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    staffEmail: { type: String, trim: true },
    rollNos: [{ type: String, trim: true, uppercase: true }],
    program: { type: String, enum: ['all', 'ug', 'pg'], default: 'all' },
    year: { type: Number },
    semester: { type: Number },
    createdBy: { type: String, trim: true }
  },
  { timestamps: true }
);

AssignmentGroupSchema.index({ staffId: 1 });

module.exports = mongoose.model('AssignmentGroup', AssignmentGroupSchema);
