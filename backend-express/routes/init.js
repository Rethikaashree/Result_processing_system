const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
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

const noisePattern = [-4, -2, 0, 2, 4];

const baseStudentProfiles = [
  { name: 'Virat Kohli', email: 'virat.kohli@bitsathy.ac.in', rollNo: 'S001', department: 'Computer Science', base: 76, growth: 1.6 },
  { name: 'Lionel Messi', email: 'lionel.messi@bitsathy.ac.in', rollNo: 'S002', department: 'Computer Science', base: 84, growth: 1.2 },
  { name: 'Cristiano Ronaldo', email: 'cristiano.ronaldo@bitsathy.ac.in', rollNo: 'S003', department: 'Information Technology', base: 82, growth: 1.0 },
  { name: 'MS Dhoni', email: 'ms.dhoni@bitsathy.ac.in', rollNo: 'S004', department: 'Information Technology', base: 78, growth: 1.4 },
  { name: 'Rohit Sharma', email: 'rohit.sharma@bitsathy.ac.in', rollNo: 'S005', department: 'Electronics', base: 72, growth: 1.5 },
  { name: 'Kylian Mbappe', email: 'kylian.mbappe@bitsathy.ac.in', rollNo: 'S006', department: 'Computer Science', base: 79, growth: 1.4 },
  { name: 'Rethika Ashree', email: 'rethika.ashree@bitsathy.ac.in', rollNo: 'S007', department: 'Computer Science', base: 74, growth: 1.8 },
  { name: 'Harmanpreet Kaur', email: 'harmanpreet.kaur@bitsathy.ac.in', rollNo: 'S008', department: 'Electronics', base: 77, growth: 1.3 }
];

const ugDepartments = [
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'AI & DS'
];

const pgDepartments = [
  'MBA',
  'MCA',
  'M.Tech CSE',
  'M.Tech ECE',
  'M.Sc Data Science',
  'M.Sc AI'
];

const extraDepartments = [...ugDepartments, ...pgDepartments];

const additionalFirstNames = [
  'Aarav', 'Aditi', 'Akash', 'Aishwarya', 'Ajay', 'Akshara', 'Ananya', 'Anirudh',
  'Arjun', 'Avani', 'Bhavya', 'Chaitra', 'Deepak', 'Divya', 'Eshan', 'Gauri',
  'Harish', 'Isha', 'Jai', 'Janani', 'Karthik', 'Keerthi', 'Kiran', 'Lakshmi',
  'Madhav', 'Meera', 'Naveen', 'Nisha', 'Omkar', 'Pooja', 'Pranav', 'Priya',
  'Rahul', 'Riya', 'Rohan', 'Sahana', 'Sandeep', 'Sanjana', 'Shreya', 'Siddharth',
  'Sneha', 'Suresh', 'Tanvi', 'Tejas', 'Uday', 'Varsha', 'Vikram', 'Vishal',
  'Yash', 'Zoya', 'Aravind', 'Bhavana', 'Darshan', 'Evelyn', 'Farhan', 'Gayathri',
  'Hitesh', 'Ishaan', 'Kabir', 'Latha', 'Manoj', 'Neha', 'Pavithra', 'Rithika',
  'Saif', 'Tharun', 'Uma', 'Vasudha', 'Yamini', 'Zubin'
];

const additionalLastNames = [
  'Agarwal', 'Bhat', 'Chandran', 'Desai', 'Ganesan', 'Gupta', 'Iyer', 'Jain',
  'Kannan', 'Kulkarni', 'Mahajan', 'Mehta', 'Menon', 'Nair', 'Natarajan', 'Patel',
  'Prasad', 'Rao', 'Reddy', 'Saxena', 'Shah', 'Sharma', 'Shetty', 'Srinivasan',
  'Sundaram', 'Varma', 'Acharya', 'Bose', 'Chopra', 'Dixit', 'Gowda', 'Kaushik',
  'Mishra', 'Naidu', 'Pandey', 'Shekhar', 'Trivedi', 'Yadav'
];

const additionalStudentProfiles = Array.from({ length: 200 }, (_, index) => {
  const id = index + 9;
  const rollNo = `S${String(id).padStart(3, '0')}`;
  const department = extraDepartments[index % extraDepartments.length];
  const maxSemester = pgDepartments.includes(department) ? 4 : 8;
  const semester = (index % maxSemester) + 1;
  const firstName = additionalFirstNames[index % additionalFirstNames.length];
  const lastName = additionalLastNames[index % additionalLastNames.length];
  const name = `${firstName} ${lastName}`;
  const emailHandle = `${firstName}.${lastName}.${rollNo}`.toLowerCase();
  return {
    name,
    email: `${emailHandle}@bitsathy.ac.in`,
    rollNo,
    department,
    semester,
    base: 66 + (index % 8) * 2,
    growth: 1.0 + (index % 6) * 0.2
  };
});

const studentProfiles = [...baseStudentProfiles, ...additionalStudentProfiles];

const staffProfiles = [
  { name: 'Staff 1', email: 'staff1@bitsathy.ac.in', department: 'Administration' },
  { name: 'Staff 2', email: 'staff2@bitsathy.ac.in', department: 'Administration' },
  { name: 'Staff 3', email: 'staff3@bitsathy.ac.in', department: 'Examinations' },
  { name: 'Staff 4', email: 'staff4@bitsathy.ac.in', department: 'Examinations' },
  { name: 'Staff 5', email: 'staff5@bitsathy.ac.in', department: 'Academic Affairs' },
  { name: 'Staff 6', email: 'staff6@bitsathy.ac.in', department: 'Academic Affairs' }
];

const rethikaSemesterPlan = {
  1: { target: 72, remark: 'Settling into first-semester pace. Good fundamentals.' },
  2: { target: 79, remark: 'Strong jump after adapting to coursework.' },
  3: { target: 74, remark: 'Temporary dip; attendance recovery needed.' },
  4: { target: 82, remark: 'Excellent comeback with consistent preparation.' },
  5: { target: 77, remark: 'Slight drop due to high-load subjects.' },
  6: { target: 86, remark: 'Major improvement after focused revision.' },
  7: { target: 81, remark: 'Minor decline; project workload impacted scores.' },
  8: { target: 89, remark: 'Strong final-semester finish.' }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toDefaultPassword = (name) => `${String(name).replace(/\s+/g, '')}123`;

const buildMarks = (profileIndex, semester, base, growth) => {
  return Array.from({ length: 5 }, (_, subjectIndex) => {
    const directional = base + (growth * semester) + (subjectIndex * 1.8);
    const noise = noisePattern[(profileIndex + semester + subjectIndex) % noisePattern.length];
    return clamp(Math.round(directional + noise), 38, 99);
  });
};

const buildTargetMarks = (target) => {
  const seed = [target - 6, target - 2, target + 1, target + 3, target + 4];
  return seed.map((m) => clamp(Math.round(m), 38, 99));
};

const autoRemark = (percentage) => {
  if (percentage >= 90) return 'Outstanding and consistent performance.';
  if (percentage >= 80) return 'Strong academic performance with good consistency.';
  if (percentage >= 70) return 'Steady progress. Keep improving core subjects.';
  if (percentage >= 60) return 'Moderate performance. Needs additional practice.';
  return 'At-risk performance. Academic support recommended.';
};

const seedDatabase = async ({ reset = false, onlyIfEmpty = false } = {}) => {
  if (onlyIfEmpty) {
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return {
        skipped: true,
        reason: 'Database already has users',
        users: existingUsers
      };
    }
  }

  if (reset) {
    await Notification.deleteMany({});
    await Result.deleteMany({});
    await User.deleteMany({});

    await Result.collection.dropIndexes().catch(() => {});
    await Result.syncIndexes();
  }

  const rawUsers = [
    {
      name: 'System Admin',
      email: 'admin@bitsathy.ac.in',
      role: 'admin',
      department: 'Administration',
      defaultPassword: 'Admin123'
    },
    {
      name: 'Staff Admin',
      email: 'staff@bitsathy.ac.in',
      role: 'staff',
      department: 'Administration',
      defaultPassword: 'StaffAdmin123'
    },
    ...staffProfiles.map((staff) => ({
      name: staff.name,
      email: staff.email,
      role: 'staff',
      department: staff.department,
      defaultPassword: toDefaultPassword(staff.name)
    })),
    ...studentProfiles.map((profile) => ({
      name: profile.name,
      email: profile.email,
      role: 'student',
      rollNo: profile.rollNo,
      semester: profile.semester ?? 8,
      department: profile.department,
      defaultPassword: toDefaultPassword(profile.name)
    }))
  ];

  const users = await User.insertMany(
    await Promise.all(
      rawUsers.map(async (user) => ({
        ...user,
        passwordHint: user.defaultPassword,
        password: await bcrypt.hash(user.defaultPassword, await bcrypt.genSalt(10))
      }))
    )
  );

  const resultsPayload = [];
  studentProfiles.forEach((profile, profileIndex) => {
    const maxSemester = profile.semester ?? 8;
    for (let semester = 1; semester <= maxSemester; semester += 1) {
      const isRethika = profile.rollNo === 'S007';
      const rethikaConfig = isRethika ? rethikaSemesterPlan[semester] : null;
      const marks = isRethika
        ? buildTargetMarks(rethikaConfig.target)
        : buildMarks(profileIndex, semester, profile.base, profile.growth);

      const percentage = Number(((marks.reduce((sum, mark) => sum + mark, 0) / (marks.length * 100)) * 100).toFixed(2));

      resultsPayload.push({
        roll_no: profile.rollNo,
        name: profile.name,
        subjects: semesterSubjects[semester],
        marks,
        semester,
        remark: isRethika ? rethikaConfig.remark : autoRemark(percentage),
        createdBy: 'admin@bitsathy.ac.in'
      });
    }
  });

  await Result.create(resultsPayload);

  const studentUsers = users.filter((u) => u.role === 'student');
  const staffUsers = users.filter((u) => ['staff', 'admin'].includes(u.role));

  await Notification.insertMany(
    studentUsers.map((student) => ({
      userId: student._id,
      title: 'Result Published',
      message: 'Your Semester 8 results have been published!',
      type: 'result_published'
    }))
  );

  return {
    message: 'Database initialized!',
    users: users.length,
    students: studentUsers.length,
    staffs: staffUsers.length,
    results: resultsPayload.length,
    semesters: 8,
    subjectsPerSemester: 5
  };
};

const seedExtraStudents = async () => {
  const rollNos = additionalStudentProfiles.map((p) => p.rollNo);
  const existing = await User.find({ rollNo: { $in: rollNos } }).select('rollNo name email department semester');
  const existingMap = new Map(existing.map((u) => [String(u.rollNo).toUpperCase(), u]));
  const toInsert = additionalStudentProfiles.filter(
    (profile) => !existingMap.has(String(profile.rollNo).toUpperCase())
  );

  const toUpdate = additionalStudentProfiles.filter((profile) =>
    existingMap.has(String(profile.rollNo).toUpperCase())
  );

  if (!toInsert.length && !toUpdate.length) {
    return { addedStudents: 0, addedResults: 0, updatedStudents: 0 };
  }

  const newUsers = await User.insertMany(
    await Promise.all(
      toInsert.map(async (profile) => {
        const defaultPassword = toDefaultPassword(profile.name);
        return {
          name: profile.name,
          email: profile.email,
          role: 'student',
          rollNo: profile.rollNo,
          semester: profile.semester ?? 8,
          department: profile.department,
          passwordHint: defaultPassword,
          password: await bcrypt.hash(defaultPassword, await bcrypt.genSalt(10))
        };
      })
    )
  );

  if (toUpdate.length) {
    await Promise.all(
      toUpdate.map((profile) => {
        return User.updateOne(
          { rollNo: profile.rollNo },
          {
            $set: {
              name: profile.name,
              email: profile.email,
              department: profile.department,
              semester: profile.semester ?? 8
            }
          }
        );
      })
    );
    await Promise.all(
      toUpdate.map((profile) =>
        Result.updateMany({ roll_no: profile.rollNo }, { $set: { name: profile.name } })
      )
    );
  }

  const existingResults = await Result.aggregate([
    { $match: { roll_no: { $in: rollNos } } },
    { $group: { _id: '$roll_no', maxSemester: { $max: '$semester' } } }
  ]);
  const maxSemesterMap = new Map(existingResults.map((row) => [String(row._id), row.maxSemester]));

  const resultsPayload = [];
  const profilesForResults = [...toInsert, ...toUpdate];
  profilesForResults.forEach((profile) => {
    const profileIndex = additionalStudentProfiles.findIndex((p) => p.rollNo === profile.rollNo);
    const maxSemester = profile.semester ?? 8;
    const existingMax = maxSemesterMap.get(String(profile.rollNo)) || 0;
    for (let semester = existingMax + 1; semester <= maxSemester; semester += 1) {
      const marks = buildMarks(profileIndex, semester, profile.base, profile.growth);
      const percentage = Number(((marks.reduce((sum, mark) => sum + mark, 0) / (marks.length * 100)) * 100).toFixed(2));
      resultsPayload.push({
        roll_no: profile.rollNo,
        name: profile.name,
        subjects: semesterSubjects[semester],
        marks,
        semester,
        remark: autoRemark(percentage),
        createdBy: 'admin@bitsathy.ac.in'
      });
    }
  });

  if (resultsPayload.length) {
    await Result.insertMany(resultsPayload, { ordered: false });
  }

  await Notification.insertMany(
    newUsers.map((student) => ({
      userId: student._id,
      title: 'Result Published',
      message: `Your Semester ${student.semester || 1} results have been published!`,
      type: 'result_published'
    }))
  );

  return {
    addedStudents: newUsers.length,
    addedResults: resultsPayload.length,
    updatedStudents: toUpdate.length
  };
};

router.get('/', async (req, res) => {
  try {
    const result = await seedDatabase({ reset: true });
    return res.json({
      ...result,
      reset: true
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/extra', auth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const result = await seedExtraStudents();
    return res.json({ message: 'Extra students seeded', ...result });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.seedDatabase = seedDatabase;
module.exports.seedExtraStudents = seedExtraStudents;
