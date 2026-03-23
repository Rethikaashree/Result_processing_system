const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const createToken = (user) => jwt.sign(
  {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    rollNo: user.rollNo || null
  },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, rollNo, semester, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    let user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const normalizedRole = role === 'admin' ? 'admin' : role === 'staff' ? 'staff' : 'student';

    if (normalizedRole === 'student' && !rollNo) {
      return res.status(400).json({ message: 'rollNo is required for student accounts' });
    }

    if (rollNo) {
      const existingRoll = await User.findOne({ rollNo: String(rollNo).toUpperCase().trim() });
      if (existingRoll) {
        return res.status(400).json({ message: 'Roll number already exists' });
      }
    }

    const normalizedName = String(name).trim();
    const plainPassword = String(password);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    user = new User({
      name: normalizedName,
      email: String(email).toLowerCase().trim(),
      password: hashedPassword,
      passwordHint: plainPassword,
      role: normalizedRole,
      rollNo: rollNo ? String(rollNo).toUpperCase().trim() : undefined,
      semester,
      department
    });

    await user.save();

    const token = createToken(user);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo || null,
        semester: user.semester || null,
        department: user.department || null
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (role && role !== user.role) {
      return res.status(403).json({ message: `Use ${user.role} login for this account` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo || null,
        semester: user.semester || null,
        department: user.department || null
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -passwordHint');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id).select('+passwordHint');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(String(currentPassword), user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(String(newPassword), await bcrypt.genSalt(10));
    user.passwordHint = String(newPassword);
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
