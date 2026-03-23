const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  actorId: { type: String, required: true },
  actorEmail: { type: String, required: true },
  actorRole: { type: String, required: true },
  target: {
    rollNo: { type: String },
    semester: { type: Number },
    subject: { type: String }
  },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
