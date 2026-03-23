const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ResultLock = require('../models/ResultLock');
const RevaluationRequest = require('../models/RevaluationRequest');
const auth = require('../middleware/auth');

const semesterSubjects = {
  1: ['Mathematics I', 'Physics', 'Programming Fundamentals', 'English Communication', 'Engineering Graphics'],
  2: ['Mathematics II', 'Digital Logic', 'Data Structures', 'Object Oriented Programming', 'Environmental Studies'],
  3: ['Discrete Mathematics', 'Computer Organization', 'Database Systems', 'Operating Systems', 'Probability and Statistics'],
  4: ['Design and Analysis of Algorithms', 'Computer Networks', 'Software Engineering', 'Web Technologies', 'Numerical Methods'],
  5: ['Theory of Computation', 'Machine Learning', 'Compiler Design', 'Microprocessors', 'Data Mining'],
  6: ['Artificial Intelligence', 'Cloud Computing', 'Information Security', 'Mobile Application Development', 'Distributed Systems'],
  7: ['Big Data Analytics', 'DevOps Engineering', 'Internet of Things', 'Human Computer Interaction', 'Project Management'],
  8: ['Deep Learning', 'Blockchain Fundamentals', 'Cyber Forensics', 'Software Testing and Quality Assurance', 'Capstone Project']
};

const normalizeSubjects = (semester, subjects) => {
  if (Array.isArray(subjects) && subjects.length > 0) {
    return subjects.map((s) => String(s).trim()).filter(Boolean);
  }
  return semesterSubjects[semester] || [];
};

const calculatePercentageFromMarks = (marks) => {
  if (!Array.isArray(marks) || marks.length === 0) return null;
  const total = marks.reduce((acc, curr) => acc + Number(curr || 0), 0);
  return Number(((total / (marks.length * 100)) * 100).toFixed(2));
};

const yearFromSemester = (semester) => {
  const sem = Number(semester);
  if (!Number.isFinite(sem) || sem <= 0) return null;
  return Math.ceil(sem / 2);
};

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

const notifyStaff = async (title, message, type) => {
  const staffUsers = await User.find({ role: 'staff' }).select('_id');
  if (!staffUsers.length) return;
  await Notification.insertMany(
    staffUsers.map((staff) => ({
      userId: staff._id,
      title,
      message,
      type
    }))
  );
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
    // audit failures should not block primary flow
  }
};

const isSemesterLocked = async (year, semester) => {
  if (!semester || !year) return false;
  const lock = await ResultLock.findOne({ year: Number(year), semester: Number(semester) });
  return Boolean(lock && lock.isLocked);
};

const hasPendingRevaluation = async (rollNo, semester) => {
  if (!rollNo || !semester) return false;
  const pending = await RevaluationRequest.findOne({
    rollNo: String(rollNo).toUpperCase().trim(),
    semester: Number(semester),
    status: { $in: ['requested', 'assigned', 'updated'] }
  }).select('_id');
  return Boolean(pending);
};

const buildLeaderboard = async (semester) => {
  const filter = semester ? { semester: Number(semester) } : {};
  const results = await Result.find(filter).sort({ percentage: -1, total: -1, createdAt: 1 });

  const ranked = results.map((item, index) => ({
    rank: index + 1,
    roll_no: item.roll_no,
    name: item.name,
    semester: item.semester,
    percentage: Number.isFinite(Number(item.percentage))
      ? Number(item.percentage)
      : calculatePercentageFromMarks(item.marks),
    grade: item.grade,
    total: item.total,
    remark: item.remark || ''
  }));

  const numericPercentages = ranked
    .map((item) => Number(item.percentage))
    .filter((value) => Number.isFinite(value));

  const classAverage = numericPercentages.length
    ? Number((numericPercentages.reduce((sum, value) => sum + value, 0) / numericPercentages.length).toFixed(2))
    : 0;

  return {
    totalStudents: ranked.length,
    classAverage,
    top3: ranked.slice(0, 3),
    leaderboard: ranked
  };
};

router.post('/add', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const { roll_no, marks, semester, subjects, remark } = req.body;

    if (!roll_no || !Array.isArray(marks) || marks.length === 0 || !semester) {
      return res.status(400).json({ message: 'roll_no, marks array and semester are required' });
    }

    const sem = Number(semester);
    const rollNo = String(roll_no).toUpperCase().trim();
    const student = await User.findOne({ role: 'student', rollNo });
    if (!student) {
      return res.status(404).json({ message: 'Student not found for roll number' });
    }
    const year = yearFromSemester(student.semester) || yearFromSemester(sem);
    if (req.user.role !== 'admin' && await isSemesterLocked(year, sem)) {
      return res.status(423).json({ message: 'Semester is locked by admin' });
    }
    const resolvedSubjects = normalizeSubjects(sem, subjects);

    if (!resolvedSubjects.length) {
      return res.status(400).json({ message: 'subjects are required for this semester' });
    }

    if (resolvedSubjects.length !== marks.length) {
      return res.status(400).json({ message: 'subjects and marks length must match' });
    }

    const existing = await Result.findOne({ roll_no: rollNo, semester: sem });
    if (existing) {
      return res.status(400).json({ message: `Result already exists for semester ${semester}` });
    }

    if (sem > 1) {
      const prev = await Result.findOne({ roll_no: rollNo, semester: sem - 1 }).select('_id');
      if (!prev) {
        return res.status(400).json({ message: `Semester ${sem - 1} must be added before semester ${sem}.` });
      }
    }

      const result = new Result({
      roll_no: rollNo,
      name: student.name,
      subjects: resolvedSubjects,
      marks,
      semester: sem,
      remark: remark ? String(remark).trim() : undefined,
      createdBy: req.user.email
    });

    await result.save();
    await logAudit(req, 'RESULT_CREATED', { rollNo: rollNo, semester: sem }, null, result.toObject());

    await Notification.create({
      userId: student._id,
      title: 'Result Published',
      message: `Your Semester ${semester} results have been published!`,
      type: 'result_published'
    });

    return res.status(201).json({ message: 'Result added successfully', result });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    if (['staff', 'admin'].includes(req.user.role)) {
      const results = await Result.find().sort({ semester: 1, percentage: -1, createdAt: -1 });
      return res.json(results);
    }

    const student = await User.findById(req.user.id);
    if (!student || !student.rollNo) return res.json([]);

    const results = await Result.find({ roll_no: student.rollNo }).sort({ semester: 1 });
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/leaderboard/:semester', auth, async (req, res) => {
  try {
    const semester = Number(req.params.semester);
    if (!semester || semester < 1 || semester > 8) {
      return res.status(400).json({ message: 'Valid semester is required' });
    }

    const data = await buildLeaderboard(semester);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const semester = req.query.semester ? Number(req.query.semester) : undefined;
    const data = await buildLeaderboard(semester);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/update/:roll_no/:semester', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const rollNo = String(req.params.roll_no).toUpperCase().trim();
    const semester = Number(req.params.semester);
    const { marks, subjects, remark } = req.body;

    const student = await User.findOne({ role: 'student', rollNo }).select('semester');
    const year = yearFromSemester(student?.semester) || yearFromSemester(semester);
    if (req.user.role !== 'admin' && await isSemesterLocked(year, semester)) {
      return res.status(423).json({ message: 'Semester is locked by admin' });
    }

    if (req.user.role !== 'admin' && await hasPendingRevaluation(rollNo, semester)) {
      return res.status(423).json({ message: 'Revaluation pending. Admin approval required.' });
    }

    const result = await Result.findOne({ roll_no: rollNo, semester });
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    if (req.user.role !== 'admin') {
      const latest = await Result.find({ roll_no: rollNo })
        .sort({ semester: -1 })
        .limit(1)
        .select('semester');
      const latestSemester = latest?.[0]?.semester;
      if (latestSemester && Number(semester) !== Number(latestSemester)) {
        return res.status(423).json({ message: 'Only the latest semester marks can be modified.' });
      }
    }

    const before = result.toObject();

    if (marks !== undefined) {
      if (!Array.isArray(marks) || marks.length === 0) {
        return res.status(400).json({ message: 'marks must be a non-empty array' });
      }
      result.marks = marks;
    }

    if (subjects !== undefined) {
      const normalized = normalizeSubjects(semester, subjects);
      if (!normalized.length) {
        return res.status(400).json({ message: 'subjects must be a non-empty array' });
      }
      result.subjects = normalized;
    }

    if (remark !== undefined) {
      result.remark = String(remark).trim();
    }

    if (result.subjects.length !== result.marks.length) {
      return res.status(400).json({ message: 'subjects and marks length must match' });
    }

    result.updatedAt = new Date();
    await result.save();

    await logAudit(req, 'RESULT_UPDATED', { rollNo, semester }, before, result.toObject());
    const studentUser = await User.findOne({ role: 'student', rollNo }).select('_id');
    if (studentUser) {
      await Notification.create({
        userId: studentUser._id,
        title: 'Result Updated',
        message: `Your Semester ${semester} result has been updated.`,
        type: 'result_updated'
      });
    }

    return res.json({ message: 'Result updated successfully', result });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/delete/:roll_no/:semester', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const rollNo = String(req.params.roll_no).toUpperCase().trim();
    const semester = Number(req.params.semester);

    const student = await User.findOne({ role: 'student', rollNo }).select('semester');
    const year = yearFromSemester(student?.semester) || yearFromSemester(semester);
    if (req.user.role !== 'admin' && await isSemesterLocked(year, semester)) {
      return res.status(423).json({ message: 'Semester is locked by admin' });
    }

    const result = await Result.findOneAndDelete({ roll_no: rollNo, semester });
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    await logAudit(req, 'RESULT_DELETED', { rollNo, semester }, result.toObject(), null);

    return res.json({ message: 'Result deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/locks', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;
    const locks = await ResultLock.find().sort({ semester: 1 });
    return res.json(locks);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/lock/:year/:semester', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const year = Number(req.params.year);
    const semester = Number(req.params.semester);
    if (!year || year < 1 || year > 4) {
      return res.status(400).json({ message: 'Valid year is required' });
    }
    if (!semester || semester < 1 || semester > 8) {
      return res.status(400).json({ message: 'Valid semester is required' });
    }

    const lock = await ResultLock.findOneAndUpdate(
      { year, semester },
      { year, semester, isLocked: true, lockedBy: req.user.email, lockedAt: new Date(), updatedAt: new Date() },
      { upsert: true, new: true }
    );

    await logAudit(req, 'SEMESTER_LOCKED', { rollNo: null, semester, year }, null, lock.toObject());
    await notifyStaff(
      'Semester Locked',
      `Semester ${semester} has been locked by admin. Editing results is disabled.`,
      'semester_lock'
    );
    return res.json({ message: 'Semester locked', lock });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/unlock/:year/:semester', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const year = Number(req.params.year);
    const semester = Number(req.params.semester);
    if (!year || year < 1 || year > 4) {
      return res.status(400).json({ message: 'Valid year is required' });
    }
    if (!semester || semester < 1 || semester > 8) {
      return res.status(400).json({ message: 'Valid semester is required' });
    }

    const lock = await ResultLock.findOneAndUpdate(
      { year, semester },
      { year, semester, isLocked: false, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    await logAudit(req, 'SEMESTER_UNLOCKED', { rollNo: null, semester, year }, null, lock.toObject());
    await notifyStaff(
      'Semester Unlocked',
      `Semester ${semester} has been unlocked by admin. Editing results is enabled.`,
      'semester_unlock'
    );
    return res.json({ message: 'Semester unlocked', lock });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/audit', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const { rollNo, semester, limit } = req.query;
    const query = {};
    if (rollNo) query['target.rollNo'] = String(rollNo).toUpperCase().trim();
    if (semester) query['target.semester'] = Number(semester);
    const size = Math.min(Number(limit || 200), 500);
    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(size);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/department-performance', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;
    const users = await User.find({ role: 'student' }).select('rollNo department');
    const results = await Result.find().select('roll_no percentage');

    const rollToDept = new Map();
    users.forEach((u) => rollToDept.set(String(u.rollNo).toUpperCase(), u.department || 'Unknown'));

    const buckets = {};
    results.forEach((r) => {
      const dept = rollToDept.get(String(r.roll_no).toUpperCase()) || 'Unknown';
      if (!buckets[dept]) buckets[dept] = { total: 0, count: 0 };
      buckets[dept].total += Number(r.percentage || 0);
      buckets[dept].count += 1;
    });

    const payload = Object.entries(buckets).map(([department, stats]) => ({
      department,
      average: stats.count ? Number((stats.total / stats.count).toFixed(2)) : 0,
      count: stats.count
    })).sort((a, b) => b.average - a.average);

    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:roll_no', auth, async (req, res) => {
  try {
    const rollNo = String(req.params.roll_no).toUpperCase().trim();
    const semester = req.query.semester ? Number(req.query.semester) : undefined;

    if (req.user.role === 'student') {
      const student = await User.findById(req.user.id);
      if (!student || student.rollNo !== rollNo) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const query = semester ? { roll_no: rollNo, semester } : { roll_no: rollNo };
    const result = await Result.find(query).sort({ semester: 1 });

    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Result not found' });
    }

    return res.json(semester ? result[0] : result);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
