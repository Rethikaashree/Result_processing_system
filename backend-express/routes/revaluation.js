const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Result = require('../models/Result');
const RevaluationRequest = require('../models/RevaluationRequest');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Notification = require('../models/Notification');

const staffOnly = (req, res) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Staff access required' });
    return true;
  }
  return false;
};

const adminOnly = (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return true;
  }
  return false;
};

const logAudit = async (req, action, target, oldValue, newValue) => {
  try {
    await AuditLog.create({
      action,
      actorId: String(req.user.id),
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target,
      oldValue,
      newValue
    });
  } catch (err) {
    // ignore audit failures
  }
};

const notifyUsers = async (query, title, message, type = 'revaluation') => {
  const users = await User.find(query).select('_id');
  if (!users.length) return;
  await Notification.insertMany(
    users.map((user) => ({
      userId: user._id,
      title,
      message,
      type
    }))
  );
};

router.post('/request', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Student access required' });
    }

    const { semester, subjectIndex, reason } = req.body;
    const sem = Number(semester);
    const idx = Number(subjectIndex);

    if (!sem || sem < 1 || sem > 8 || Number.isNaN(idx)) {
      return res.status(400).json({ message: 'Valid semester and subjectIndex are required' });
    }

    const result = await Result.findOne({ roll_no: req.user.rollNo, semester: sem });
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    if (!result.subjects[idx]) {
      return res.status(400).json({ message: 'Invalid subject index' });
    }

    const existing = await RevaluationRequest.findOne({
      rollNo: req.user.rollNo,
      semester: sem,
      subjectIndex: idx,
      status: { $in: ['requested', 'assigned', 'updated'] }
    });
    if (existing) {
      return res.status(409).json({ message: 'Revaluation already in progress for this subject' });
    }

    const request = await RevaluationRequest.create({
      rollNo: req.user.rollNo,
      semester: sem,
      subjectIndex: idx,
      subject: result.subjects[idx],
      reason: reason ? String(reason).trim() : undefined,
      oldMark: Number(result.marks[idx]),
      requestedBy: req.user.email
    });

    await logAudit(req, 'REVALUATION_REQUESTED', { rollNo: req.user.rollNo, semester: sem, subject: result.subjects[idx] }, null, request.toObject());
    await notifyUsers(
      { role: 'admin' },
      'Revaluation Request Received',
      `Student ${req.user.rollNo} requested revaluation for Semester ${sem} - ${result.subjects[idx]}.`,
      'revaluation_requested'
    );
    return res.status(201).json({ message: 'Revaluation requested', request });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const rows = await RevaluationRequest.find(filter).sort({ createdAt: -1 });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/assign/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const { reviewerEmail } = req.body;
    if (!reviewerEmail) {
      return res.status(400).json({ message: 'reviewerEmail is required' });
    }
    const request = await RevaluationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Revaluation request not found' });

    request.assignedTo = String(reviewerEmail).toLowerCase().trim();
    request.status = 'assigned';
    request.updatedAt = new Date();
    await request.save();

    await logAudit(req, 'REVALUATION_ASSIGNED', { rollNo: request.rollNo, semester: request.semester, subject: request.subject }, null, request.toObject());
    await notifyUsers(
      { role: 'staff', email: request.assignedTo },
      'Revaluation Assigned',
      `You have been assigned to revaluate ${request.rollNo} Semester ${request.semester} - ${request.subject}.`,
      'revaluation_assigned'
    );
    return res.json({ message: 'Reviewer assigned', request });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/update/:id', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;
    const { newMark } = req.body;
    const request = await RevaluationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Revaluation request not found' });

    if (!['assigned', 'requested', 'updated'].includes(request.status)) {
      return res.status(400).json({ message: 'Revaluation is not editable' });
    }

    if (request.assignedTo && req.user.role !== 'admin' && request.assignedTo !== req.user.email) {
      return res.status(403).json({ message: 'Only assigned reviewer can update' });
    }

    request.newMark = Number(newMark);
    request.status = 'updated';
    request.updatedAt = new Date();
    await request.save();

    await logAudit(req, 'REVALUATION_UPDATED', { rollNo: request.rollNo, semester: request.semester, subject: request.subject }, null, request.toObject());
    return res.json({ message: 'Revaluation updated', request });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/approve/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const request = await RevaluationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Revaluation request not found' });
    if (request.status !== 'updated') {
      return res.status(400).json({ message: 'Revaluation must be updated before approval' });
    }

    const result = await Result.findOne({ roll_no: request.rollNo, semester: request.semester });
    if (!result) return res.status(404).json({ message: 'Result not found' });

    const before = result.toObject();
    result.marks[request.subjectIndex] = Number(request.newMark);
    result.updatedAt = new Date();
    await result.save();

    request.status = 'approved';
    request.approvedBy = req.user.email;
    request.updatedAt = new Date();
    await request.save();

    await notifyUsers(
      { role: 'student', rollNo: request.rollNo },
      'Revaluation Approved',
      `Your revaluation for Semester ${request.semester} - ${request.subject} has been approved and marks were updated.`,
      'revaluation_approved'
    );

    await logAudit(req, 'REVALUATION_APPROVED', { rollNo: request.rollNo, semester: request.semester, subject: request.subject }, before, result.toObject());
    return res.json({ message: 'Revaluation approved and result recalculated', result, request });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reject/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const request = await RevaluationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Revaluation request not found' });

    request.status = 'rejected';
    request.updatedAt = new Date();
    await request.save();

    await logAudit(req, 'REVALUATION_REJECTED', { rollNo: request.rollNo, semester: request.semester, subject: request.subject }, null, request.toObject());
    return res.json({ message: 'Revaluation rejected', request });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
