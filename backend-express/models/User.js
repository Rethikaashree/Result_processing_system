const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  passwordHint: { type: String, select: false },
  role: { type: String, enum: ['student', 'staff', 'admin'], default: 'student' },
  rollNo: { type: String, uppercase: true, trim: true, sparse: true, unique: true },
  semester: { type: Number, min: 1, max: 8 },
  department: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
