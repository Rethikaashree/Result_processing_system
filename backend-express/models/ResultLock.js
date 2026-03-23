const mongoose = require('mongoose');

const ResultLockSchema = new mongoose.Schema({
  year: { type: Number, required: true, min: 1, max: 4 },
  semester: { type: Number, required: true, min: 1, max: 8 },
  isLocked: { type: Boolean, default: false },
  lockedBy: { type: String },
  lockedAt: { type: Date },
  updatedAt: { type: Date }
});

ResultLockSchema.index({ year: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('ResultLock', ResultLockSchema);
