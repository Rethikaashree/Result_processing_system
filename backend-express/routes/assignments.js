const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const AssignmentGroup = require('../models/AssignmentGroup');

const staffOnly = (req, res) => {
  if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Staff access required' });
    return true;
  }
  return false;
};

const adminOnly = (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return true;
  }
  return false;
};

router.get('/', auth, async (req, res) => {
  try {
    if (staffOnly(req, res)) return;

    if (req.user.role === 'admin') {
      const groups = await AssignmentGroup.find().sort({ createdAt: -1 });
      return res.json(groups);
    }

    const groups = await AssignmentGroup.find({
      $or: [
        { staffId: req.user.id },
        { staffEmail: req.user.email }
      ]
    }).sort({ createdAt: -1 });

    return res.json(groups);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;

    const { name, staffId, rollNos = [], program = 'all', year, semester } = req.body;
    if (!name || !staffId) {
      return res.status(400).json({ message: 'name and staffId are required' });
    }

    const staff = await User.findById(staffId).select('email role');
    if (!staff || staff.role !== 'staff') {
      return res.status(400).json({ message: 'Valid staff member is required' });
    }

    const normalizedRolls = Array.from(new Set(
      (Array.isArray(rollNos) ? rollNos : [])
        .map((r) => String(r).toUpperCase().trim())
        .filter(Boolean)
    ));

    const group = await AssignmentGroup.create({
      name: String(name).trim(),
      staffId,
      staffEmail: staff.email,
      rollNos: normalizedRolls,
      program,
      year: year ? Number(year) : undefined,
      semester: semester ? Number(semester) : undefined,
      createdBy: req.user.email
    });

    return res.json({ message: 'Group created', group });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;

    const { name, staffId, rollNos, program, year, semester } = req.body;
    const group = await AssignmentGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (name !== undefined) group.name = String(name).trim();
    if (program !== undefined) group.program = program;
    if (year !== undefined) group.year = Number(year);
    if (semester !== undefined) group.semester = Number(semester);

    if (Array.isArray(rollNos)) {
      group.rollNos = Array.from(new Set(
        rollNos.map((r) => String(r).toUpperCase().trim()).filter(Boolean)
      ));
    }

    if (staffId !== undefined) {
      const staff = await User.findById(staffId).select('email role');
      if (!staff || staff.role !== 'staff') {
        return res.status(400).json({ message: 'Valid staff member is required' });
      }
      group.staffId = staffId;
      group.staffEmail = staff.email;
    }

    await group.save();
    return res.json({ message: 'Group updated', group });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (adminOnly(req, res)) return;
    const group = await AssignmentGroup.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    return res.json({ message: 'Group deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
