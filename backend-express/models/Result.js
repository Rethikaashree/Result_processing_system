const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  roll_no: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  subjects: { type: [String], required: true },
  marks: { type: [Number], required: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  total: { type: Number },
  percentage: { type: Number },
  grade: { type: String },
  remark: { type: String, trim: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

ResultSchema.index({ roll_no: 1, semester: 1 }, { unique: true });

ResultSchema.pre('save', function(next) {
  if (!Array.isArray(this.subjects) || this.subjects.length === 0) {
    return next(new Error('subjects must be a non-empty array'));
  }

  if (!Array.isArray(this.marks) || this.marks.length === 0) {
    return next(new Error('marks must be a non-empty array'));
  }

  if (this.subjects.length !== this.marks.length) {
    return next(new Error('subjects and marks length must match'));
  }

  this.total = this.marks.reduce((acc, curr) => acc + curr, 0);
  const maxMarks = this.marks.length * 100;
  this.percentage = Number(((this.total / maxMarks) * 100).toFixed(2));

  if (this.percentage >= 90) this.grade = 'A+';
  else if (this.percentage >= 80) this.grade = 'A';
  else if (this.percentage >= 70) this.grade = 'B+';
  else if (this.percentage >= 60) this.grade = 'B';
  else if (this.percentage >= 50) this.grade = 'C';
  else this.grade = 'F';

  next();
});

module.exports = mongoose.model('Result', ResultSchema);
