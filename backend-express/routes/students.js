const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

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

router.post('/', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const { name, email, password, rollNo, semester, department } = req.body;

    if (!name || !email || !password || !rollNo) {
      return res.status(400).json({ message: 'name, email, password and rollNo are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedRollNo = String(rollNo).toUpperCase().trim();

    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const existingByRollNo = await User.findOne({ rollNo: normalizedRollNo });
    if (existingByRollNo) {
      return res.status(400).json({ message: 'Roll number already exists' });
    }

    const plainPassword = String(password);
    const hashedPassword = await bcrypt.hash(plainPassword, await bcrypt.genSalt(10));

    const student = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      passwordHint: plainPassword,
      role: 'student',
      rollNo: normalizedRollNo,
      semester,
      department
    });

    await student.save();

    return res.status(201).json({
      message: 'Student created successfully',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNo: student.rollNo,
        semester: student.semester || null,
        department: student.department || null,
        role: student.role
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const students = await User.find({ role: 'student' })
      .select('-password -passwordHint')
      .sort({ createdAt: -1 });

    return res.json(students);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const users = await User.find({ role: { $in: ['student', 'staff', 'admin'] } })
      .select('-password -passwordHint')
      .sort({ role: 1, name: 1 });

    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/passwords', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;

    const users = await User.find({ role: { $in: ['student', 'staff', 'admin'] } })
      .select('name email role rollNo passwordHint')
      .sort({ role: 1, name: 1 });

    return res.json(users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      rollNo: u.rollNo || null,
      passwordHint: u.passwordHint || 'Not available'
    })));
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/staffs', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const staffs = await User.find({ role: 'staff' })
      .select('-password -passwordHint')
      .sort({ createdAt: -1 });
    return res.json(staffs);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/staffs', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;

    const { name, email, password, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const plainPassword = String(password);
    const hashedPassword = await bcrypt.hash(plainPassword, await bcrypt.genSalt(10));

    const staff = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      passwordHint: plainPassword,
      role: 'staff',
      department
    });

    await staff.save();

    return res.status(201).json({
      message: 'Staff created successfully',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        department: staff.department || null,
        role: staff.role
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/staffs/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const { name, email, department, password } = req.body;
    const staff = await User.findOne({ _id: req.params.id, role: 'staff' });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    if (email) {
      const normalizedEmail = String(email).toLowerCase().trim();
      const existingByEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: staff._id } });
      if (existingByEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      staff.email = normalizedEmail;
    }

    if (name !== undefined) staff.name = String(name).trim();
    if (department !== undefined) staff.department = department;

    if (password) {
      const plainPassword = String(password);
      staff.password = await bcrypt.hash(plainPassword, await bcrypt.genSalt(10));
      staff.passwordHint = plainPassword;
    }

    await staff.save();

    return res.json({
      message: 'Staff updated successfully',
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        department: staff.department || null,
        role: staff.role
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/staffs/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const staff = await User.findOneAndDelete({ _id: req.params.id, role: 'staff' });
    if (!staff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    return res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const student = await User.findOne({ _id: req.params.id, role: 'student' }).select('-password -passwordHint');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.json(student);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const { name, email, semester, department, rollNo, password } = req.body;
    const student = await User.findOne({ _id: req.params.id, role: 'student' });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const oldRollNo = student.rollNo;

    if (email) {
      const normalizedEmail = String(email).toLowerCase().trim();
      const existingByEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: student._id } });
      if (existingByEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      student.email = normalizedEmail;
    }

    if (rollNo) {
      const normalizedRollNo = String(rollNo).toUpperCase().trim();
      const existingByRollNo = await User.findOne({ rollNo: normalizedRollNo, _id: { $ne: student._id } });
      if (existingByRollNo) {
        return res.status(400).json({ message: 'Roll number already exists' });
      }
      student.rollNo = normalizedRollNo;
    }

    if (name !== undefined) student.name = String(name).trim();
    if (semester !== undefined) student.semester = semester;
    if (department !== undefined) student.department = department;

    if (password) {
      const plainPassword = String(password);
      student.password = await bcrypt.hash(plainPassword, await bcrypt.genSalt(10));
      student.passwordHint = plainPassword;
    }

    await student.save();

    if (student.rollNo !== oldRollNo || name !== undefined) {
      await Result.updateMany(
        { roll_no: oldRollNo },
        {
          $set: {
            roll_no: student.rollNo,
            name: student.name,
            updatedAt: new Date()
          }
        }
      );
    }

    return res.json({
      message: 'Student updated successfully',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNo: student.rollNo,
        semester: student.semester || null,
        department: student.department || null,
        role: student.role
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    const student = await User.findOneAndDelete({ _id: req.params.id, role: 'student' });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await Result.deleteMany({ roll_no: student.rollNo });
    await Notification.deleteMany({ userId: student._id });

    return res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
