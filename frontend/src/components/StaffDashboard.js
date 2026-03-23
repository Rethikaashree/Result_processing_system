import React, { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "./ToastProvider";
import LoadingScreen from "./LoadingScreen";
import { useNavigate } from "react-router-dom";
import {
  addResult,
  approveRevaluation,
  assignRevaluation,
  createStaff,
  createStudent,
  deleteResult,
  deleteStudent,
  deleteStaff,
  getAuditLogs,
  getAllUsers,
  getAssignments,
  getDepartmentPerformance,
  getNotifications,
  getPasswordRegistry,
  getProfile,
  getResultLocks,
  getResults,
  getRevaluationRequests,
  getStaffs,
  markNotificationRead,
  getStudents,
  lockSemester,
  rejectRevaluation,
  createAssignment,
  deleteAssignment,
  seedExtraStudents,
  unlockSemester,
  updateRevaluation,
  updateResult,
  updateStaff,
  updateStudent,
  subscribeLiveUpdates
} from "../services/api";
import { clearSessionAuth, getAuthRole, getAuthToken } from "../services/authSession";

const defaultSubjectsBySemester = {
  1: "Mathematics I, Physics, Programming Fundamentals, English Communication, Engineering Graphics",
  2: "Mathematics II, Digital Logic, Data Structures, Object Oriented Programming, Environmental Studies",
  3: "Discrete Mathematics, Computer Organization, Database Systems, Operating Systems, Probability and Statistics",
  4: "Design and Analysis of Algorithms, Computer Networks, Software Engineering, Web Technologies, Numerical Methods",
  5: "Theory of Computation, Machine Learning, Compiler Design, Microprocessors, Data Mining",
  6: "Artificial Intelligence, Cloud Computing, Information Security, Mobile Application Development, Distributed Systems",
  7: "Big Data Analytics, DevOps Engineering, Internet of Things, Human Computer Interaction, Project Management",
  8: "Deep Learning, Blockchain Fundamentals, Cyber Forensics, Software Testing and Quality Assurance, Capstone Project"
};

const defaultPasswordFromName = (name) => `${String(name || "").replace(/\s+/g, "")}123`;
const resultPercentage = (result) => {
  const pct = Number(result?.percentage);
  if (Number.isFinite(pct)) return pct;
  const marks = Array.isArray(result?.marks) ? result.marks : [];
  if (!marks.length) return 0;
  const total = marks.reduce((sum, m) => sum + Number(m || 0), 0);
  return Number(((total / (marks.length * 100)) * 100).toFixed(2));
};
const deriveGradeFromMarks = (marks) => {
  const numeric = Array.isArray(marks) ? marks.map((m) => Number(m || 0)) : [];
  if (!numeric.length) return "F";
  const total = numeric.reduce((sum, m) => sum + m, 0);
  const percentage = Number(((total / (numeric.length * 100)) * 100).toFixed(2));
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  return "F";
};
const derivePercentageFromMarks = (marks) => {
  const numeric = Array.isArray(marks) ? marks.map((m) => Number(m || 0)) : [];
  if (!numeric.length) return 0;
  const total = numeric.reduce((sum, m) => sum + m, 0);
  return Number(((total / (numeric.length * 100)) * 100).toFixed(2));
};
const gradeForResult = (result) => result?.grade || deriveGradeFromMarks(result?.marks);
const gradeFromMark = (mark) => {
  const value = Number(mark || 0);
  if (value >= 90) return "A+";
  if (value >= 80) return "A";
  if (value >= 70) return "B+";
  if (value >= 60) return "B";
  if (value >= 50) return "C";
  return "F";
};
const isPgDepartment = (department) => {
  const value = String(department || "").toLowerCase();
  if (!value) return false;
  if (value.includes("mba") || value.includes("mca") || value.includes("m.tech") || value.includes("mtech")) return true;
  if (value.includes("m.sc") || value.includes("msc")) return true;
  return false;
};
const programLabelFromDepartment = (department) => (isPgDepartment(department) ? "PG" : "UG");

const yearFromSemester = (semester, department) => {
  const sem = Number(semester);
  if (!Number.isFinite(sem) || sem <= 0) return null;
  const maxYear = isPgDepartment(department) ? 2 : 4;
  return Math.min(Math.ceil(sem / 2), maxYear);
};

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [passwordRegistry, setPasswordRegistry] = useState([]);
  const [results, setResults] = useState([]);
  const [resultLocks, setResultLocks] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [departmentPerformance, setDepartmentPerformance] = useState([]);
  const [revaluationQueue, setRevaluationQueue] = useState([]);
  const [staffNotifications, setStaffNotifications] = useState([]);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [reviewerEmails, setReviewerEmails] = useState({});
  const [revaluationMarks, setRevaluationMarks] = useState({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [lockYearFilter, setLockYearFilter] = useState("1");
  const lockSemesters = useMemo(() => {
    const year = Number(lockYearFilter);
    if (year === 1) return [1, 2];
    if (year === 2) return [1, 2, 3, 4];
    if (year === 3) return [1, 2, 3, 4, 5, 6];
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [lockYearFilter]);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [studentForm, setStudentForm] = useState({ id: "", name: "", email: "", rollNo: "", semester: "", department: "", password: "" });
  const [resultForm, setResultForm] = useState({ roll_no: "", marks: "", semester: "", remark: "" });
  const [staffForm, setStaffForm] = useState({ id: "", name: "", email: "", department: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("registry");
  const [resultSearch, setResultSearch] = useState("");
  const [resultSemesterFilter, setResultSemesterFilter] = useState("all");
  const [resultLockFilter, setResultLockFilter] = useState("all");
  const [resultProgramFilter, setResultProgramFilter] = useState("all");
  const [resultGradeFilter, setResultGradeFilter] = useState("all");
  const [resultSubjectFilter, setResultSubjectFilter] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentDeptFilter, setStudentDeptFilter] = useState("all");
  const [studentListLimit, setStudentListLimit] = useState(20);
  const [statsProgramFocus, setStatsProgramFocus] = useState("all");
  const [statsYearFocus, setStatsYearFocus] = useState("all");
  const [statsDeptFocus, setStatsDeptFocus] = useState("all");
  const [statsSemesterFocus, setStatsSemesterFocus] = useState("all");
  const [statsGradeFocus, setStatsGradeFocus] = useState("all");
  const [statsChartMode, setStatsChartMode] = useState("semester");
  const [statsChartFocusLabel, setStatsChartFocusLabel] = useState("Semester Pulse");
  const toast = useToast();
  const toastRef = useRef({ error: "", success: "" });

  useEffect(() => {
    if (error && error !== toastRef.current.error) {
      toast.pushToast("error", error);
      toastRef.current.error = error;
    }
  }, [error, toast]);

  useEffect(() => {
    if (success && success !== toastRef.current.success) {
      toast.pushToast("success", success);
      toastRef.current.success = success;
    }
  }, [success, toast]);
  const [bulkYear, setBulkYear] = useState("1");
  const [bulkSemester, setBulkSemester] = useState("1");
  const [bulkProgram, setBulkProgram] = useState("all");
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [bulkMarks, setBulkMarks] = useState("");
  const [bulkRemark, setBulkRemark] = useState("");
  const [bulkSubjectMode, setBulkSubjectMode] = useState("all");
  const [bulkSubjectSingle, setBulkSubjectSingle] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    staffId: "",
    program: "all",
    year: "1",
    semester: "all",
    rollNos: []
  });
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [storyRunning, setStoryRunning] = useState(false);
  const [storySemester, setStorySemester] = useState(1);
  const [inlineEdits, setInlineEdits] = useState({});
  const [pendingUndo, setPendingUndo] = useState({});
  const [recentChanges, setRecentChanges] = useState([]);
  const [hoverPreview, setHoverPreview] = useState(null);
  const [selectedResultForGrades, setSelectedResultForGrades] = useState(null);
  const [selectedStudentRoll, setSelectedStudentRoll] = useState("");
  const studentYearByRoll = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const roll = String(s.rollNo || "").toUpperCase();
      const year = yearFromSemester(s.semester, s.department);
      if (roll) map.set(roll, year);
    });
    return map;
  }, [students]);
  const studentNameByRoll = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const roll = String(s.rollNo || "").toUpperCase();
      const name = String(s.name || "").trim();
      if (roll && name) map.set(roll, name);
    });
    return map;
  }, [students]);
  const studentDeptByRoll = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const roll = String(s.rollNo || "").toUpperCase();
      const dept = String(s.department || "").trim();
      if (roll) map.set(roll, dept);
    });
    return map;
  }, [students]);
  const defaultGuidanceRemarks = [
    "Focus on weak subjects and schedule weekly revision slots.",
    "Attend extra sessions for low-score subjects and practice past papers.",
    "Maintain consistency and target +5 to +10 marks improvement in each subject.",
    "Excellent progress. Keep strengthening core concepts and stay consistent."
  ];
  const logout = () => {
    clearSessionAuth();
    navigate("/login");
  };
  const loadAdminData = async () => {
    setAdminLoading(true);
    setAdminError("");
    try {
      const [locks, logs, depts, revals, staffs, groups] = await Promise.all([
        getResultLocks(),
        getAuditLogs({ limit: 120 }),
        getDepartmentPerformance(),
        getRevaluationRequests(),
        getStaffs(),
        getAssignments()
      ]);
      setResultLocks(locks);
      setAuditLogs(logs);
      setDepartmentPerformance(depts);
      setRevaluationQueue(revals);
      setStaffDirectory(staffs);
      setAssignmentGroups(groups);
    } catch (err) {
      setAdminError(err?.response?.data?.message || "Failed to load admin controls");
    } finally {
      setAdminLoading(false);
    }
  };

  const seedExtraStudentsAction = async () => {
    setError("");
    setSuccess("");
    setSeedLoading(true);
    try {
      const result = await seedExtraStudents();
      setSuccess(`Seeded ${result.addedStudents || 0} students and ${result.addedResults || 0} results.`);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to seed extra students");
    } finally {
      setSeedLoading(false);
    }
  };

  const loadAll = async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const [studentData, resultData, allUsers, me, groups] = await Promise.all([
        getStudents(),
        getResults(),
        getAllUsers(),
        getProfile(),
        getAssignments()
      ]);
      setStudents(studentData);
      setResults(resultData);
      setStaffAccounts(allUsers.filter((user) => user.role === "staff"));
      setProfile(me);
      setAssignmentGroups(groups);
      const revals = await getRevaluationRequests();
      setRevaluationQueue(revals);

      if (me?.role === "admin") {
        const registry = await getPasswordRegistry();
        setPasswordRegistry(registry);
        await loadAdminData();
        setStaffNotifications([]);
      } else {
        setPasswordRegistry([]);
        setResultLocks([]);
        setAuditLogs([]);
        setDepartmentPerformance([]);
        setStaffDirectory([]);
        const [locks, notifications] = await Promise.all([
          getResultLocks(),
          getNotifications()
        ]);
        setResultLocks(locks);
        setStaffNotifications(notifications);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard data");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    const role = getAuthRole();
    if (!token || (role !== "staff" && role !== "admin")) {
      navigate("/login");
      return;
    }
    loadAll();
  }, [navigate]);

  useEffect(() => {
    if (profile?.role === "admin" && (activeTab === "manage" || activeTab === "registry")) {
      setActiveTab("monitor");
    }
  }, [profile, activeTab]);

  useEffect(() => {
    const unsubscribe = subscribeLiveUpdates(() => {
      loadAll({ silent: true });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const onStudentChange = (e) => {
    const { name, value } = e.target;
    setStudentForm((prev) => ({ ...prev, [name]: value }));
  };

  const onStaffChange = (e) => {
    const { name, value } = e.target;
    setStaffForm((prev) => ({ ...prev, [name]: value }));
  };

  const onResultChange = (e) => {
    const { name, value } = e.target;
    setResultForm((prev) => {
      if (name === "semester") {
        return { ...prev, semester: value };
      }
      return { ...prev, [name]: value };
    });
  };

  const resetStudentForm = () => {
    setStudentForm({ id: "", name: "", email: "", rollNo: "", semester: "", department: "", password: "" });
  };

  const resetStaffForm = () => {
    setStaffForm({ id: "", name: "", email: "", department: "", password: "" });
  };

  const resetResultForm = () => {
    setResultForm({ roll_no: "", marks: "", semester: "", remark: "" });
  };

  const parseList = (value) => value.split(",").map((x) => x.trim()).filter(Boolean);

  const parseMarks = (value) =>
    value
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => !Number.isNaN(x));

  const saveStudent = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = {
        name: studentForm.name,
        email: studentForm.email,
        rollNo: studentForm.rollNo,
        semester: studentForm.semester ? Number(studentForm.semester) : undefined,
        department: studentForm.department || undefined,
        ...(studentForm.password ? { password: studentForm.password } : {})
      };

      if (studentForm.id) {
        await updateStudent(studentForm.id, payload);
        setSuccess("Student updated");
      } else {
        await createStudent({ ...payload, password: studentForm.password || defaultPasswordFromName(studentForm.name) });
        setSuccess("Student added");
      }

      resetStudentForm();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save student");
    }
  };

  const saveStaff = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = {
        name: staffForm.name,
        email: staffForm.email,
        department: staffForm.department || undefined,
        ...(staffForm.password ? { password: staffForm.password } : {})
      };

      if (staffForm.id) {
        await updateStaff(staffForm.id, payload);
        setSuccess("Staff updated");
      } else {
        await createStaff({ ...payload, password: staffForm.password || defaultPasswordFromName(staffForm.name) });
        setSuccess("Staff added");
      }

      resetStaffForm();
      await loadAdminData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save staff");
    }
  };

  const editStudent = (student) => {
    setStudentForm({
      id: student._id,
      name: student.name || "",
      email: student.email || "",
      rollNo: student.rollNo || "",
      semester: student.semester || "",
      department: student.department || "",
      password: ""
    });
    setActiveTab("manage");
  };

  const editStaff = (staff) => {
    setStaffForm({
      id: staff._id,
      name: staff.name || "",
      email: staff.email || "",
      department: staff.department || "",
      password: ""
    });
  };

  const removeStudent = async (id) => {
    if (!window.confirm("Delete this student and all related results?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteStudent(id);
      setSuccess("Student deleted");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete student");
    }
  };

  const removeStaff = async (id) => {
    if (!window.confirm("Delete this staff account?")) return;
    setError("");
    setSuccess("");
    try {
      await deleteStaff(id);
      setSuccess("Staff deleted");
      await loadAdminData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete staff");
    }
  };

  const markStaffNotificationRead = async (id) => {
    try {
      await markNotificationRead(id);
      setStaffNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update notification");
    }
  };

  const saveResult = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const semValue = Number(resultForm.semester);
    const rollValue = String(resultForm.roll_no || "").toUpperCase();
    const locked = resultLocks.find((lock) => Number(lock.semester) === semValue && lock.isLocked);
    if (locked && profile?.role !== "admin") {
      setError("Semester is locked by admin. Editing results is disabled.");
      return;
    }

    const marks = parseMarks(resultForm.marks);
    const remark = String(resultForm.remark || "").trim();
    const semesterSubjects = parseList(defaultSubjectsBySemester[semValue] || "");

    if (!resultForm.roll_no || marks.length === 0 || !resultForm.semester) {
      setError("roll number, marks and semester are required");
      return;
    }

    try {
      const existing = results.find(
        (item) =>
          item.roll_no === resultForm.roll_no.toUpperCase() &&
          Number(item.semester) === Number(resultForm.semester)
      );

      if (existing) {
        const latestSemester = getLatestSemesterForRoll(rollValue);
        if (profile?.role !== "admin" && latestSemester && Number(existing.semester) !== Number(latestSemester)) {
          setError("Only the latest semester marks can be modified.");
          return;
        }
        const existingSubjects =
          Array.isArray(existing.subjects) && existing.subjects.length
            ? [...existing.subjects]
            : [...semesterSubjects];
        if (!existingSubjects.length) {
          setError("invalid semester subjects");
          return;
        }
        if (marks.length !== existingSubjects.length) {
          setError(`enter ${existingSubjects.length} marks in semester subject order to update`);
          return;
        }
        await updateResult(resultForm.roll_no, Number(resultForm.semester), {
          marks,
          subjects: existingSubjects,
          remark
        });
        setSuccess(`Updated Semester ${resultForm.semester} marks`);
      } else {
        if (semValue > 1) {
          const prevExists = results.some(
            (r) => String(r.roll_no || "").toUpperCase() === rollValue && Number(r.semester) === semValue - 1
          );
          if (!prevExists) {
            setError(`Semester ${semValue - 1} must be added before Semester ${semValue}.`);
            return;
          }
        }
        if (!semesterSubjects.length) {
          setError("invalid semester subjects");
          return;
        }
        if (marks.length !== semesterSubjects.length) {
          setError(`enter ${semesterSubjects.length} marks in semester subject order for new result`);
          return;
        }
        const payload = {
          roll_no: resultForm.roll_no,
          marks,
          subjects: semesterSubjects,
          semester: Number(resultForm.semester),
          remark
        };
        await addResult(payload);
        setSuccess(`Semester ${resultForm.semester} result added and notification sent`);
      }

      setActiveTab("registry");
      setResultSearch(rollValue);
      setResultSemesterFilter(String(semValue));
      resetResultForm();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save result");
    }
  };

  const editResult = (item) => {
    setResultForm({
      roll_no: item.roll_no,
      marks: "",
      semester: String(item.semester),
      remark: item.remark || ""
    });
    setActiveTab("manage");
  };

  const removeResult = async (rollNo, semester) => {
    if (!window.confirm(`Delete result for ${rollNo} semester ${semester}?`)) return;
    setError("");
    setSuccess("");
    try {
      await deleteResult(rollNo, semester);
      setSuccess("Result deleted");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete result");
    }
  };

  const lockSemesterAction = async (year, semester) => {
    setSuccess("");
    setError("");
    try {
      await lockSemester(year, semester);
      await loadAdminData();
      setSuccess(`Year ${year} Semester ${semester} locked`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to lock semester");
    }
  };

  const unlockSemesterAction = async (year, semester) => {
    setSuccess("");
    setError("");
    try {
      await unlockSemester(year, semester);
      await loadAdminData();
      setSuccess(`Year ${year} Semester ${semester} unlocked`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to unlock semester");
    }
  };

  const lockVisibleSemesters = async () => {
    setSuccess("");
    setError("");
    try {
      await Promise.all(lockSemesters.map((sem) => lockSemester(Number(lockYearFilter), sem)));
      await loadAdminData();
      setSuccess(`Locked semesters: ${lockSemesters.join(", ")}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to lock semesters");
    }
  };

  const unlockVisibleSemesters = async () => {
    setSuccess("");
    setError("");
    try {
      await Promise.all(lockSemesters.map((sem) => unlockSemester(Number(lockYearFilter), sem)));
      await loadAdminData();
      setSuccess(`Unlocked semesters: ${lockSemesters.join(", ")}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to unlock semesters");
    }
  };

  const onReviewerChange = (id, value) => {
    setReviewerEmails((prev) => ({ ...prev, [id]: value }));
  };

  const onRevaluationMarkChange = (id, value) => {
    setRevaluationMarks((prev) => ({ ...prev, [id]: value }));
  };

  const assignReviewer = async (id) => {
    setSuccess("");
    setError("");
    try {
      const reviewerEmail = reviewerEmails[id];
      if (!reviewerEmail) {
        setError("Reviewer email is required");
        return;
      }
      await assignRevaluation(id, { reviewerEmail });
      await loadAdminData();
      setSuccess("Reviewer assigned");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to assign reviewer");
    }
  };

  const approveRequest = async (id) => {
    setSuccess("");
    setError("");
    try {
      await approveRevaluation(id);
      await loadAdminData();      
      setSuccess("Revaluation approved");
    } catch (err) {34
      .
      setError(err?.response?.data?.message || "Failed to approve request");
    }
  };

  const rejectRequest = async (id) => {
    setSuccess("");
    setError("");
    try {
      await rejectRevaluation(id);
      await loadAdminData();
      setSuccess("Revaluation rejected");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reject request");
    } 
  };

  const submitRevaluationMark = async (id) => {
    setSuccess("");
    setError("");
    try {
      const raw = revaluationMarks[id];
      const newMark = Number(raw);
      if (Number.isNaN(newMark)) {
        setError("Valid revaluation mark is required");
        return;
      }
      await updateRevaluation(id, { newMark });
      await loadAll();
      setSuccess("Revaluation mark submitted");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to submit revaluation mark");
    }
  };

  const studentCount = students.length;
  const resultCount = results.length;

  const averagePercentage = useMemo(() => {
    const numericRows = results.map((r) => resultPercentage(r));
    if (!numericRows.length) return "0.00";
    return (numericRows.reduce((sum, value) => sum + value, 0) / numericRows.length).toFixed(2);
  }, [results]);

  const uniqueSubjects = useMemo(() => {
    const set = new Set();
    results.forEach((r) => (r.subjects || []).forEach((sub) => set.add(sub)));
    return Array.from(set).sort();
  }, [results]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [students]);

  const statsBaseResults = useMemo(() => {
    return results.filter((row) => {
      const rollKey = String(row.roll_no || "").toUpperCase();
      const department = studentDeptByRoll.get(rollKey) || "";
      const program = isPgDepartment(department) ? "pg" : "ug";
      const year = yearFromSemester(row.semester, department);
      const deptMatch =
        statsDeptFocus === "all" ||
        String(department || "").toLowerCase() === String(statsDeptFocus || "").toLowerCase();
      const programMatch =
        statsProgramFocus === "all" ||
        (statsProgramFocus === "ug" && program === "ug") ||
        (statsProgramFocus === "pg" && program === "pg");
      const yearMatch =
        statsYearFocus === "all" ||
        Number(row.semester) <= Number(statsYearFocus) * 2;
      return deptMatch && programMatch && yearMatch;
    });
  }, [results, statsDeptFocus, statsProgramFocus, statsYearFocus, studentDeptByRoll]);

  const statsMaxSemester = useMemo(() => {
    if (statsYearFocus === "all") return 8;
    const numeric = Number(statsYearFocus);
    if (!Number.isFinite(numeric) || numeric <= 0) return 8;
    return Math.min(numeric * 2, 8);
  }, [statsYearFocus]);

  useEffect(() => {
    setStorySemester((prev) => {
      if (!statsMaxSemester) return prev;
      return Math.min(prev, statsMaxSemester);
    });
  }, [statsMaxSemester]);

  const filteredResults = useMemo(() => {
    const isLockedForRow = (semester, rollNo) => {
      const rollKey = String(rollNo || "").toUpperCase();
      const dept = studentDeptByRoll.get(rollKey) || "";
      const year = studentYearByRoll.get(rollKey) || yearFromSemester(semester, dept);
      if (!year) return false;
      return Boolean(
        resultLocks.find(
          (lock) => Number(lock.semester) === Number(semester) && Number(lock.year) === Number(year)
        )?.isLocked
      );
    };

    return results.filter((r) => {
      const rollKey = String(r.roll_no || "").toUpperCase();
      const displayName = studentNameByRoll.get(rollKey) || r.name || "";
      const department = studentDeptByRoll.get(rollKey) || "";
      const program = isPgDepartment(department) ? "pg" : "ug";
      const query = resultSearch.trim().toLowerCase();
      const searchMatch =
        !query ||
        displayName.toLowerCase().includes(query) ||
        r.roll_no.toLowerCase().includes(query);

      const semesterMatch =
        resultSemesterFilter === "all" ||
        Number(r.semester) === Number(resultSemesterFilter);

      const effectiveGrade = gradeForResult(r);
      const gradeMatch = resultGradeFilter === "all" || effectiveGrade === resultGradeFilter;

      const subjectMatch =
        resultSubjectFilter === "all" ||
        (r.subjects || []).some((s) => s === resultSubjectFilter);

      const locked = isLockedForRow(r.semester, r.roll_no);
      const lockMatch =
        resultLockFilter === "all" ||
        (resultLockFilter === "locked" && locked) ||
        (resultLockFilter === "unlocked" && !locked);

      const programMatch =
        resultProgramFilter === "all" ||
        (resultProgramFilter === "ug" && program === "ug") ||
        (resultProgramFilter === "pg" && program === "pg");

      return searchMatch && semesterMatch && gradeMatch && subjectMatch && lockMatch && programMatch;
    });
  }, [
    results,
    resultSearch,
    resultSemesterFilter,
    resultGradeFilter,
    resultSubjectFilter,
    resultLockFilter,
    resultProgramFilter,
    resultLocks,
    studentYearByRoll,
    studentNameByRoll,
    studentDeptByRoll
  ]);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) =>
      s.name.toLowerCase().includes(query) ||
      String(s.rollNo || "").toLowerCase().includes(query) ||
      String(s.email || "").toLowerCase().includes(query)
    );
  }, [students, studentSearch]);

  const filteredStudentsWithDept = useMemo(() => {
    if (studentDeptFilter === "all") return filteredStudents;
    return filteredStudents.filter((s) => s.department === studentDeptFilter);
  }, [filteredStudents, studentDeptFilter]);

  const visibleStudents = useMemo(() => {
    if (!studentListLimit || studentListLimit >= filteredStudentsWithDept.length) return filteredStudentsWithDept;
    return filteredStudentsWithDept.slice(0, studentListLimit);
  }, [filteredStudentsWithDept, studentListLimit]);

  const selectedStudent = useMemo(
    () => students.find((s) => String(s.rollNo || "") === String(selectedStudentRoll)),
    [students, selectedStudentRoll]
  );
  const resultStudent = useMemo(() => {
    const roll = String(resultForm.roll_no || "").toUpperCase();
    if (!roll) return null;
    return students.find((s) => String(s.rollNo || "").toUpperCase() === roll) || null;
  }, [students, resultForm.roll_no]);

  const selectedStudentResults = useMemo(() => {
    if (!selectedStudent?.rollNo) return [];
    return results.filter((r) => r.roll_no === selectedStudent.rollNo);
  }, [results, selectedStudent]);

  const resultTrendsByRoll = useMemo(() => {
    const map = {};
    results.forEach((r) => {
      const roll = String(r.roll_no || "").toUpperCase();
      if (!map[roll]) map[roll] = [];
      map[roll].push({ semester: Number(r.semester), percentage: resultPercentage(r), grade: gradeForResult(r) });
    });
    Object.keys(map).forEach((roll) => {
      map[roll] = map[roll].sort((a, b) => a.semester - b.semester);
    });
    return map;
  }, [results]);

  const stats = useMemo(() => {
    const semesterBuckets = Array.from({ length: statsMaxSemester }, (_, i) => i + 1).map((sem) => {
      const rows = statsBaseResults.filter((r) => Number(r.semester) === sem);
      const numericRows = rows.map((r) => resultPercentage(r));
      const avg = rows.length
        ? Number((numericRows.reduce((sum, value) => sum + value, 0) / (numericRows.length || 1)).toFixed(2))
        : 0;
      return { semester: sem, students: rows.length, average: avg };
    });

    const gradeCounts = statsBaseResults.reduce((acc, r) => {
      const key = gradeForResult(r) || "Unrated";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const subjectMap = {};
    statsBaseResults.forEach((r) => {
      (r.subjects || []).forEach((sub, idx) => {
        if (!subjectMap[sub]) subjectMap[sub] = { total: 0, count: 0 };
        subjectMap[sub].total += r.marks[idx] || 0;
        subjectMap[sub].count += 1;
      });
    });

    const subjectAverages = Object.entries(subjectMap)
      .map(([subject, value]) => ({
        subject,
        average: Number((value.total / value.count).toFixed(2))
      }))
      .sort((a, b) => b.average - a.average);

    const topStudents = [...statsBaseResults]
      .sort((a, b) => resultPercentage(b) - resultPercentage(a))
      .slice(0, 10);

    return { semesterBuckets, gradeCounts, subjectAverages, topStudents };
  }, [statsBaseResults, statsMaxSemester]);

  const statsScopedResults = useMemo(() => {
    return statsBaseResults.filter((row) => {
      const semesterMatch =
        statsSemesterFocus === "all" || Number(row.semester) === Number(statsSemesterFocus);
      const gradeMatch = statsGradeFocus === "all" || gradeForResult(row) === statsGradeFocus;
      return semesterMatch && gradeMatch;
    });
  }, [statsBaseResults, statsSemesterFocus, statsGradeFocus]);

  const statsScopedSubjectAverages = useMemo(() => {
    const subjectMap = {};
    statsScopedResults.forEach((r) => {
      (r.subjects || []).forEach((sub, idx) => {
        if (!subjectMap[sub]) subjectMap[sub] = { total: 0, count: 0 };
        subjectMap[sub].total += r.marks[idx] || 0;
        subjectMap[sub].count += 1;
      });
    });
    return Object.entries(subjectMap)
      .map(([subject, value]) => ({
        subject,
        average: Number((value.total / value.count).toFixed(2))
      }))
      .sort((a, b) => b.average - a.average);
  }, [statsScopedResults]);

  const statsScopedTopStudents = useMemo(
    () => [...statsScopedResults].sort((a, b) => resultPercentage(b) - resultPercentage(a)).slice(0, 10),
    [statsScopedResults]
  );

  const statsScopedGradeCounts = useMemo(() => {
    return statsScopedResults.reduce((acc, r) => {
      const key = gradeForResult(r) || "Unrated";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [statsScopedResults]);

  const semesterStory = useMemo(() => {
    return Array.from({ length: statsMaxSemester }, (_, i) => i + 1).map((sem) => {
      const rows = statsBaseResults.filter((r) => Number(r.semester) === sem);
      const percentages = rows.map((r) => resultPercentage(r));
      const avg = percentages.length
        ? Number((percentages.reduce((s, v) => s + v, 0) / percentages.length).toFixed(2))
        : 0;
      const top = [...rows].sort((a, b) => resultPercentage(b) - resultPercentage(a))[0] || null;
      const failCount = rows.filter((r) => (gradeForResult(r) || "") === "F").length;
      const passRate = rows.length ? Number((((rows.length - failCount) / rows.length) * 100).toFixed(0)) : 0;
      return {
        semester: sem,
        average: avg,
        topGrade: top ? gradeForResult(top) : "-",
        topRoll: top?.roll_no || "-",
        failCount,
        passRate,
        count: rows.length
      };
    });
  }, [statsBaseResults, statsMaxSemester]);

  const statsChart = useMemo(() => {
    const clampValue = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    if (statsChartMode === "grade") {
      const entries = Object.entries(statsScopedGradeCounts).sort((a, b) => b[1] - a[1]);
      const maxValue = entries.length ? Math.max(...entries.map(([, value]) => value)) : 0;
      return {
        title: "Grade Mix",
        subtitle: "The distribution reshapes as you switch focus.",
        kind: "counts",
        unit: "results",
        maxValue,
        rows: entries.map(([label, value]) => ({
          key: label,
          label,
          value: clampValue(value),
          display: `${value} results`
        }))
      };
    }

    if (statsChartMode === "subject") {
      const rows = statsScopedSubjectAverages.slice(0, 8);
      const maxValue = rows.length ? Math.max(...rows.map((row) => row.average)) : 0;
      return {
        title: "Subject Lift",
        subtitle: "Top subject averages from the current filter set.",
        kind: "marks",
        unit: "%",
        maxValue,
        rows: rows.map((row) => ({
          key: row.subject,
          label: row.subject,
          value: clampValue(row.average),
          display: `${row.average}%`
        }))
      };
    }

    if (statsChartMode === "performance") {
      const rows = statsScopedTopStudents.slice(0, 8).map((row) => {
        const rollKey = String(row.roll_no || row.rollNo || "").toUpperCase();
        const displayName = studentNameByRoll.get(rollKey) || row.name || rollKey || "Student";
        return {
          key: `${row.roll_no}-${row.semester}`,
          label: displayName,
          value: clampValue(resultPercentage(row)),
          display: `${resultPercentage(row)}%`
        };
      });
      const maxValue = rows.length ? Math.max(...rows.map((row) => row.value)) : 0;
      return {
        title: "Top Performers",
        subtitle: "A quick look at the current leaders in the room.",
        kind: "marks",
        unit: "%",
        maxValue,
        rows
      };
    }

    if (statsChartMode === "failure") {
      const rows = semesterStory.map((row) => ({
        key: row.semester,
        label: `Sem ${row.semester}`,
        value: clampValue(row.failCount),
        display: `${row.failCount} fails`,
        highlight: row.failCount >= 10 && row.failCount <= 15
      }));
      const maxValue = rows.length ? Math.max(...rows.map((row) => row.value)) : 0;
      return {
        title: "Fail Band",
        subtitle: "Semesters with 10-15 failed students are highlighted.",
        kind: "counts",
        unit: "fails",
        maxValue,
        rows
      };
    }

    const rows = stats.semesterBuckets.map((row) => ({
      key: row.semester,
      label: `Sem ${row.semester}`,
      value: clampValue(row.average),
      display: `${row.average}%`
    }));
    const maxValue = rows.length ? Math.max(...rows.map((row) => row.value)) : 0;
    return {
      title: "Semester Pulse",
      subtitle: "Tap any stat to remap the graph in real time.",
      kind: "marks",
      unit: "%",
      maxValue,
      rows
    };
  }, [semesterStory, statsChartMode, stats.semesterBuckets, statsScopedGradeCounts, statsScopedSubjectAverages, statsScopedTopStudents, studentNameByRoll]);

  useEffect(() => {
    if (!storyRunning) return undefined;
    const timer = window.setInterval(() => {
      setStorySemester((prev) => {
        if (prev >= 8) {
          setStoryRunning(false);
          return 8;
        }
        return prev + 1;
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, [storyRunning]);

  const lowestPassSemester = useMemo(() => {
    return semesterStory.reduce((worst, row) => (row.passRate < worst.passRate ? row : worst), semesterStory[0] || { semester: "-", passRate: 0 });
  }, [semesterStory]);
  const topRiskCluster = useMemo(() => {
    return semesterStory.reduce((worst, row) => (row.failCount > worst.failCount ? row : worst), semesterStory[0] || { semester: "-", failCount: 0 });
  }, [semesterStory]);
  const strongestSemester = useMemo(() => {
    return semesterStory.reduce((best, row) => (row.average > best.average ? row : best), semesterStory[0] || { semester: "-", average: 0 });
  }, [semesterStory]);
  const tourSteps = useMemo(
    () => [
      {
        key: "lowest-pass",
        title: "Warm-Up Round",
        text: `Semester ${lowestPassSemester.semester}: smooth start, clean ${lowestPassSemester.passRate}% pass, zero drama.`
      },
      {
        key: "risk-cluster",
        title: "Top Risk Cluster",
        text: `Semester ${topRiskCluster.semester} has the highest F count (${topRiskCluster.failCount}).`
      },
      {
        key: "strongest",
        title: "Strongest Semester",
        text: `Semester ${strongestSemester.semester} leads with ${strongestSemester.average}% class average.`
      }
    ],
    [lowestPassSemester, topRiskCluster, strongestSemester]
  );

  const selectedLock = useMemo(() => {
    const sem = Number(resultForm.semester);
    if (!sem) return null;
    const year = yearFromSemester(resultStudent?.semester || sem, resultStudent?.department);
    if (!year) return null;
    return resultLocks.find((lock) => Number(lock.semester) === sem && Number(lock.year) === Number(year)) || null;
  }, [resultForm.semester, resultLocks, resultStudent]);
  const isSemesterLocked = Boolean(selectedLock?.isLocked);
  const isRowLocked = (semester, rollNo) => {
    const rollKey = String(rollNo || "").toUpperCase();
    const dept = studentDeptByRoll.get(rollKey) || "";
    const year = studentYearByRoll.get(rollKey) || yearFromSemester(semester, dept);
    if (!year) return false;
    return Boolean(resultLocks.find((lock) => Number(lock.semester) === Number(semester) && Number(lock.year) === Number(year))?.isLocked);
  };
  const subjectOrder = parseList(defaultSubjectsBySemester[Number(resultForm.semester)] || "");
  const getLatestSemesterForRoll = (rollNo) => {
    const roll = String(rollNo || "").toUpperCase();
    const sems = results
      .filter((r) => String(r.roll_no || "").toUpperCase() === roll)
      .map((r) => Number(r.semester))
      .filter((s) => Number.isFinite(s));
    if (!sems.length) return null;
    return Math.max(...sems);
  };

  const bulkYearMax = bulkProgram === "pg" ? 2 : 4;
  const bulkYearOptions = Array.from({ length: bulkYearMax }, (_, i) => i + 1);
  const bulkMaxSemester = Math.min(Number(bulkYear || 1) * 2, bulkProgram === "pg" ? 4 : 8);
  const bulkSemesterOptions = Array.from({ length: bulkMaxSemester }, (_, i) => i + 1);
  const bulkCandidates = useMemo(() => {
    const year = Number(bulkYear);
    const semester = Number(bulkSemester);
    return students.filter((s) => {
      const program = isPgDepartment(s.department) ? "pg" : "ug";
      if (bulkProgram !== "all" && program !== bulkProgram) return false;
      if (yearFromSemester(s.semester, s.department) !== year) return false;
      if (Number(s.semester) < semester) return false;
      return true;
    });
  }, [students, bulkProgram, bulkYear, bulkSemester]);
  const bulkCurrent = bulkCandidates[bulkIndex] || null;
  const bulkSubjectOrder = parseList(defaultSubjectsBySemester[Number(bulkSemester)] || "");
  const bulkLock = resultLocks.find(
    (lock) => Number(lock.year) === Number(bulkYear) && Number(lock.semester) === Number(bulkSemester)
  );
  const bulkLocked = Boolean(bulkLock?.isLocked);

  useEffect(() => {
    setBulkIndex(0);
  }, [bulkProgram, bulkYear, bulkSemester]);

  useEffect(() => {
    if (Number(bulkYear) > bulkYearMax) {
      setBulkYear(String(bulkYearMax));
    }
  }, [bulkYear, bulkYearMax]);

  useEffect(() => {
    if (Number(bulkSemester) > bulkMaxSemester) {
      setBulkSemester(String(bulkMaxSemester));
    }
  }, [bulkSemester, bulkMaxSemester]);

  const startBulkEntry = () => {
    if (bulkLocked) {
      setError("Selected semester is locked. Bulk entry is disabled.");
      return;
    }
    setBulkActive(true);
    setBulkIndex(0);
    setBulkMarks("");
    setBulkRemark("");
    setBulkSubjectMode("all");
    setBulkSubjectSingle("");
  };

  const exitBulkEntry = () => {
    setBulkActive(false);
    setBulkIndex(0);
    setBulkMarks("");
    setBulkRemark("");
    setBulkSubjectMode("all");
    setBulkSubjectSingle("");
  };

  const saveBulkMarks = async () => {
    if (!bulkCurrent) return;
    if (bulkLocked) {
      setError("Selected semester is locked. Bulk entry is disabled.");
      return;
    }
    if (bulkSubjectMode === "single") {
      if (!bulkSubjectSingle) {
        setError("Select a subject to enter marks.");
        return;
      }
      const markValue = Number(String(bulkMarks).trim());
      if (!Number.isFinite(markValue)) {
        setError("Enter a valid mark.");
        return;
      }
      const existing = results.find(
        (r) => String(r.roll_no || "").toUpperCase() === String(bulkCurrent.rollNo || "").toUpperCase()
          && Number(r.semester) === Number(bulkSemester)
      );
      if (!existing) {
        setError("Full marks must be added first before updating a single subject.");
        return;
      }
      const subjectIndex = (existing.subjects || bulkSubjectOrder).findIndex((s) => s === bulkSubjectSingle);
      if (subjectIndex < 0) {
        setError("Selected subject not found for this semester.");
        return;
      }
      const nextMarks = Array.isArray(existing.marks) ? [...existing.marks] : [];
      nextMarks[subjectIndex] = markValue;
      try {
        setError("");
        await updateResult(bulkCurrent.rollNo, Number(bulkSemester), {
          marks: nextMarks,
          subjects: existing.subjects || bulkSubjectOrder,
          remark: bulkRemark
        });
        await loadAll({ silent: true });
        setSuccess(`Saved ${bulkCurrent.rollNo} • ${bulkSubjectSingle}`);
        setBulkMarks("");
        setBulkRemark("");
        if (bulkIndex + 1 >= bulkCandidates.length) {
          setBulkActive(false);
        } else {
          setBulkIndex((prev) => prev + 1);
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to save marks");
      }
      return;
    }

    const marks = bulkMarks
      .split(",")
      .map((v) => Number(String(v).trim()))
      .filter((v) => Number.isFinite(v));
    if (!marks.length || marks.length !== bulkSubjectOrder.length) {
      setError("Marks must match subject count for the selected semester.");
      return;
    }
    try {
      setError("");
      const payload = {
        roll_no: bulkCurrent.rollNo,
        semester: Number(bulkSemester),
        marks,
        subjects: bulkSubjectOrder,
        remark: bulkRemark
      };
      const existing = results.find(
        (r) => String(r.roll_no || "").toUpperCase() === String(bulkCurrent.rollNo || "").toUpperCase()
          && Number(r.semester) === Number(bulkSemester)
      );
      if (existing) {
        await updateResult(bulkCurrent.rollNo, Number(bulkSemester), payload);
      } else {
        await addResult(payload);
      }
      await loadAll({ silent: true });
      setSuccess(`Saved ${bulkCurrent.rollNo} • Sem ${bulkSemester}`);
      setBulkMarks("");
      setBulkRemark("");
      if (bulkIndex + 1 >= bulkCandidates.length) {
        setBulkActive(false);
      } else {
        setBulkIndex((prev) => prev + 1);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save marks");
    }
  };

  const toggleAssignmentRoll = (rollNo) => {
    const roll = String(rollNo || "").toUpperCase();
    setAssignmentForm((prev) => {
      const exists = prev.rollNos.includes(roll);
      return {
        ...prev,
        rollNos: exists ? prev.rollNos.filter((r) => r !== roll) : [...prev.rollNos, roll]
      };
    });
  };

  const assignmentYear = Number(assignmentForm.year || 1);
  const assignmentProgram = assignmentForm.program;
  const assignmentYearMax = assignmentProgram === "pg" ? 2 : 4;
  const assignmentMaxSemester = Math.min(assignmentYear * 2, assignmentProgram === "pg" ? 4 : 8);
  const assignmentSemesterOptions = Array.from({ length: assignmentMaxSemester }, (_, i) => i + 1);
  const assignmentEligibleStudents = useMemo(() => {
    const year = Number(assignmentForm.year || 1);
    const semester = assignmentForm.semester === "all" ? null : Number(assignmentForm.semester);
    return students.filter((s) => {
      const program = isPgDepartment(s.department) ? "pg" : "ug";
      if (assignmentProgram !== "all" && program !== assignmentProgram) return false;
      if (yearFromSemester(s.semester, s.department) !== year) return false;
      if (semester && Number(s.semester) !== semester) return false;
      return true;
    });
  }, [students, assignmentForm, assignmentProgram]);

  useEffect(() => {
    if (Number(assignmentForm.year) > assignmentYearMax) {
      setAssignmentForm((prev) => ({ ...prev, year: String(assignmentYearMax) }));
    }
  }, [assignmentForm.year, assignmentYearMax]);

  useEffect(() => {
    if (assignmentForm.semester !== "all" && Number(assignmentForm.semester) > assignmentMaxSemester) {
      setAssignmentForm((prev) => ({ ...prev, semester: String(assignmentMaxSemester) }));
    }
  }, [assignmentForm.semester, assignmentMaxSemester]);

  const submitAssignmentGroup = async (event) => {
    event.preventDefault();
    if (!assignmentForm.staffId) {
      setError("Staff is required.");
      return;
    }
    if (!assignmentForm.rollNos.length) {
      setError("Select at least one student for the group.");
      return;
    }
    try {
      setError("");
      const generatedName = `${assignmentForm.program.toUpperCase()} Year ${assignmentForm.year}` +
        `${assignmentForm.semester === "all" ? "" : ` Sem ${assignmentForm.semester}`}`;
      await createAssignment({
        name: generatedName,
        staffId: assignmentForm.staffId,
        program: assignmentForm.program,
        year: Number(assignmentForm.year),
        semester: assignmentForm.semester === "all" ? undefined : Number(assignmentForm.semester),
        rollNos: assignmentForm.rollNos
      });
      setSuccess("Assignment group created.");
      setAssignmentForm({ staffId: "", program: "all", year: "1", semester: "all", rollNos: [] });
      await loadAll({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create assignment group");
    }
  };

  const removeAssignmentGroup = async (id) => {
    try {
      await deleteAssignment(id);
      await loadAll({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete group");
    }
  };

  if (loading) return <LoadingScreen label="Loading dashboard..." />;

  const isAdmin = profile?.role === "admin";
  const bestSemester = stats.semesterBuckets.reduce((best, row) => (row.average > best.average ? row : best), stats.semesterBuckets[0] || { semester: "-", average: 0 });
  const firstSemAvg = stats.semesterBuckets[0]?.average ?? 0;
  const lastSemAvg = stats.semesterBuckets[stats.semesterBuckets.length - 1]?.average ?? 0;
  const momentumDelta = Number((lastSemAvg - firstSemAvg).toFixed(2));
  const momentumLabel = momentumDelta >= 0 ? "Upward Momentum" : "Needs Attention";
  const semAverages = stats.semesterBuckets.map((row) => Number(row.average || 0));
  const maxAverage = semAverages.length ? Math.max(...semAverages) : 0;
  const minAverage = semAverages.length ? Math.min(...semAverages) : 0;
  const avgAverage = semAverages.length ? Number((semAverages.reduce((s, v) => s + v, 0) / semAverages.length).toFixed(2)) : 0;
  const variance = semAverages.length
    ? semAverages.reduce((s, v) => s + Math.pow(v - avgAverage, 2), 0) / semAverages.length
    : 0;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));
  const scopedTopResult = statsScopedTopStudents[0] || null;
  const scopedFailCount = statsScopedGradeCounts.F || 0;
  const scopedPassRate = statsScopedResults.length
    ? `${Math.round(((statsScopedResults.length - scopedFailCount) / statsScopedResults.length) * 100)}%`
    : "0%";
  const scopedDominantGrade = Object.entries(statsScopedGradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const scopedUniqueGrades = Object.keys(statsScopedGradeCounts).length;
  const toggleSemesterFocus = (semester) => {
    const key = String(semester);
    setStatsChartMode("semester");
    setStatsChartFocusLabel(`Semester ${key}`);
    setStatsSemesterFocus((prev) => (prev === key ? "all" : key));
  };
  const toggleGradeFocus = (grade) => {
    setStatsChartMode("grade");
    setStatsChartFocusLabel(grade === "all" ? "Grade Mix" : `Grade ${grade}`);
    setStatsGradeFocus((prev) => (prev === grade ? "all" : grade));
  };
  const toggleFailBandFocus = () => {
    setStatsChartMode("failure");
    setStatsChartFocusLabel("Fail Band 10-15");
  };
  const clearStatsFocus = () => {
    setStatsSemesterFocus("all");
    setStatsGradeFocus("all");
    setStatsYearFocus("all");
    setStatsProgramFocus("all");
  };
  const lockDepartmentLabel = profile?.department || "All Departments";
  const beginInlineEdit = (row) => {
    const key = `${row.roll_no}-${row.semester}`;
    setInlineEdits((prev) => ({
      ...prev,
      [key]: { marksCsv: (row.marks || []).join(", "), subjects: row.subjects || [] }
    }));
  };

  const cancelInlineEdit = (row) => {
    const key = `${row.roll_no}-${row.semester}`;
    setInlineEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const saveInlineEdit = async (row) => {
    const key = `${row.roll_no}-${row.semester}`;
    const edit = inlineEdits[key];
    if (!edit) return;
    const nextMarks = String(edit.marksCsv || "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
    if (nextMarks.length !== (row.subjects || []).length) {
      setError(`Enter exactly ${(row.subjects || []).length} marks.`);
      return;
    }

    const beforeMarks = Array.isArray(row.marks) ? [...row.marks] : [];
    const beforeGrade = gradeForResult(row);
    const beforePercentage = resultPercentage(row);
    const afterGrade = deriveGradeFromMarks(nextMarks);
    const afterPercentage = derivePercentageFromMarks(nextMarks);

    setResults((prev) =>
      prev.map((r) =>
        r.roll_no === row.roll_no && Number(r.semester) === Number(row.semester)
          ? { ...r, marks: nextMarks, grade: afterGrade, percentage: afterPercentage }
          : r
      )
    );
    cancelInlineEdit(row);

    try {
      await updateResult(row.roll_no, Number(row.semester), {
        marks: nextMarks,
        subjects: row.subjects || []
      });

      const undoTimer = window.setTimeout(() => {
        setPendingUndo((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 10000);

      setPendingUndo((prev) => ({
        ...prev,
        [key]: {
          rollNo: row.roll_no,
          semester: row.semester,
          oldMarks: beforeMarks,
          newMarks: nextMarks,
          oldGrade: beforeGrade,
          newGrade: afterGrade,
          timer: undoTimer
        }
      }));

      setRecentChanges((prev) => [
        {
          id: `${Date.now()}-${key}`,
          rollNo: row.roll_no,
          semester: row.semester,
          actor: profile?.name || profile?.email || "staff",
          oldMarks: beforeMarks,
          newMarks: nextMarks,
          oldGrade: beforeGrade,
          newGrade: afterGrade,
          oldPercentage: beforePercentage,
          newPercentage: afterPercentage,
          time: new Date().toLocaleTimeString()
        },
        ...prev
      ].slice(0, 12));
      setSuccess(`Updated ${row.roll_no} semester ${row.semester}. Undo available for 10 seconds.`);
    } catch (err) {
      setResults((prev) =>
        prev.map((r) =>
          r.roll_no === row.roll_no && Number(r.semester) === Number(row.semester)
            ? { ...r, marks: beforeMarks, grade: beforeGrade, percentage: beforePercentage }
            : r
        )
      );
      setError(err?.response?.data?.message || "Inline update failed");
    }
  };

  const undoInlineEdit = async (rollNo, semester) => {
    const key = `${rollNo}-${semester}`;
    const pending = pendingUndo[key];
    if (!pending) return;
    window.clearTimeout(pending.timer);

    setResults((prev) =>
      prev.map((r) =>
        r.roll_no === rollNo && Number(r.semester) === Number(semester)
          ? {
              ...r,
              marks: pending.oldMarks,
              grade: pending.oldGrade,
              percentage: derivePercentageFromMarks(pending.oldMarks)
            }
          : r
      )
    );

    setPendingUndo((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      await updateResult(rollNo, Number(semester), {
        marks: pending.oldMarks,
        subjects: results.find((r) => r.roll_no === rollNo && Number(r.semester) === Number(semester))?.subjects || []
      });
      setSuccess(`Undo applied for ${rollNo} semester ${semester}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Undo failed");
    }
  };

  const onHoverRow = (event, row, subject) => {
    const roll = String(row.roll_no || "").toUpperCase();
    const trend = resultTrendsByRoll[roll] || [];
    const fallbackTrend = trend.length
      ? trend
      : [{
          semester: Number(row.semester) || 0,
          percentage: resultPercentage(row),
          grade: gradeForResult(row)
        }];
    const tooltipWidth = 280;
    const tooltipHeight = 190;
    const padding = 12;
    const maxX = window.innerWidth - tooltipWidth - padding;
    const maxY = window.innerHeight - tooltipHeight - padding;
    const nextX = Math.min(event.clientX + 14, Math.max(padding, maxX));
    const nextY = Math.min(event.clientY + 14, Math.max(padding, maxY));
    setHoverPreview({
      x: nextX,
      y: nextY,
      roll,
      subject: subject || "",
      trend: fallbackTrend,
      recent: recentChanges.filter((c) => c.rollNo === roll).slice(0, 3)
    });
  };

  const closeHover = () => setHoverPreview(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="header-title">Staff Console</h1>
          <p className="header-subtitle">
            Academic result management and performance intelligence
            {profile?.name ? ` • ${profile.name}` : ""}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => navigate("/profile")}>Profile</button>
          <button className="btn btn-danger" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="campus-banner">
        <div>
          <p className="campus-label">College</p>
          <h2 className="campus-name">Bannari Amman Institute of Technology</h2>
        </div>
        <div className="campus-meta">
          <span className="campus-chip">{isAdmin ? "Admin Console" : "Staff Dashboard"}</span>
          <span className="campus-chip">{profile?.department || "Department"}</span>
          {isAdmin ? <span className="campus-chip">Superuser Access</span> : null}
          {profile?.name ? <span className="campus-chip">Signed in: {profile.name}</span> : null}
        </div>
      </div>

      {error && error !== "Staff access required" ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <section className="metrics-row">
        <button
          type="button"
          className={`metric metric-action ${activeTab === (isAdmin ? "monitor" : "registry") ? "active" : ""}`}
          onClick={() => setActiveTab(isAdmin ? "monitor" : "registry")}
        >
          <p className="metric-label">Students</p>
          <p className="metric-value">{studentCount}</p>
        </button>
        <button
          type="button"
          className={`metric metric-action ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          <p className="metric-label">Published Results</p>
          <p className="metric-value">{resultCount}</p>
        </button>
        <button
          type="button"
          className={`metric metric-action ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          <p className="metric-label">Class Average</p>
          <p className="metric-value">{averagePercentage}%</p>
        </button>
      </section>

      <section className="tabs-row">
        {isAdmin ? (
          <>
            <button className={`tab-btn ${activeTab === "monitor" ? "active" : ""}`} onClick={() => setActiveTab("monitor")}>Student Monitor</button>
            <button className={`tab-btn ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>Statistics</button>
            <button className={`tab-btn ${activeTab === "revaluation" ? "active" : ""}`} onClick={() => setActiveTab("revaluation")}>Revaluation</button>
            <button className={`tab-btn ${activeTab === "admin" ? "active" : ""}`} onClick={() => setActiveTab("admin")}>Admin Controls</button>
          </>
        ) : (
          <>
            <button className={`tab-btn ${activeTab === "manage" ? "active" : ""}`} onClick={() => setActiveTab("manage")}>Add & Update</button>
            <button className={`tab-btn ${activeTab === "registry" ? "active" : ""}`} onClick={() => setActiveTab("registry")}>View & Filter</button>
            <button className={`tab-btn ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>Statistics</button>
            <button className={`tab-btn ${activeTab === "revaluation" ? "active" : ""}`} onClick={() => setActiveTab("revaluation")}>Revaluation</button>
            <button className={`tab-btn ${activeTab === "notifications" ? "active" : ""}`} onClick={() => setActiveTab("notifications")}>
              Notifications
              {staffNotifications.some((n) => !n.isRead) ? ` (${staffNotifications.filter((n) => !n.isRead).length})` : ""}
            </button>
          </>
        )}
      </section>
      {!isAdmin && activeTab === "manage" && (
        <>
          <section className="grid-2">
            <div className="surface">
              <div className="section-head">
                <h2 className="section-title">{studentForm.id ? "Edit Student" : "Add Student"}</h2>
              </div>
              <form className="form-layout" onSubmit={saveStudent}>
                <input className="input" name="name" placeholder="Full Name" value={studentForm.name} onChange={onStudentChange} required />
                <input className="input" name="email" type="email" placeholder="Email" value={studentForm.email} onChange={onStudentChange} required />
                <input className="input mono" name="rollNo" placeholder="Roll No" value={studentForm.rollNo} onChange={onStudentChange} required />
                <input className="input" name="semester" type="number" min="1" max="8" placeholder="Semester" value={studentForm.semester} onChange={onStudentChange} />
                <input className="input" name="department" placeholder="Department" value={studentForm.department} onChange={onStudentChange} />
                <input className="input" name="password" type="password" placeholder={studentForm.id ? "New Password (optional)" : "Password"} value={studentForm.password} onChange={onStudentChange} />
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit">{studentForm.id ? "Update" : "Create"}</button>
                  {studentForm.id ? <button className="btn btn-ghost" type="button" onClick={resetStudentForm}>Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="surface">
              <div className="section-head">
                <h2 className="section-title">Add or Update Result</h2>
              </div>
              <form className="form-layout" onSubmit={saveResult}>
                <input className="input mono" name="roll_no" placeholder="Roll No" value={resultForm.roll_no} onChange={onResultChange} required />
                <input
                  className="input"
                  name="department"
                  placeholder="Department"
                  value={resultStudent?.department || ""}
                  readOnly
                />
                <input className="input" name="semester" type="number" min="1" max="8" placeholder="Semester" value={resultForm.semester} onChange={onResultChange} required />
                <small className="auth-subtitle" style={{ marginTop: -4 }}>
                  {subjectOrder.length
                    ? `Subject order for Semester ${resultForm.semester}: ${subjectOrder.join(", ")}.`
                    : "Select a semester to see subject order for marks."}
                </small>
                <input className="input" name="marks" placeholder="Marks CSV in subject order (e.g., 78, 85, 69...)" value={resultForm.marks} onChange={onResultChange} required />
                <div className="surface" style={{ padding: 12, borderStyle: "dashed" }}>
                  <div className="section-head" style={{ marginBottom: 8 }}>
                    <h3 className="section-title" style={{ fontSize: "1rem" }}>Guidance</h3>
                  </div>
                  <select
                    className="select"
                    value=""
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        setResultForm((prev) => ({ ...prev, remark: selected }));
                      }
                    }}
                    style={{ minHeight: 42 }}
                  >
                    <option value="">Select guidance comment</option>
                    {defaultGuidanceRemarks.map((remark) => (
                      <option key={remark} value={remark}>{remark}</option>
                    ))}
                  </select>
                  <textarea
                    className="input"
                    name="remark"
                    rows={3}
                    placeholder="Manual guidance (optional)"
                    value={resultForm.remark}
                    onChange={onResultChange}
                    style={{ marginTop: 10 }}
                  />
                  <small className="auth-subtitle" style={{ display: "block", marginTop: 6 }}>
                    This guidance will be visible in the student guidance section.
                  </small>
                </div>
                {isSemesterLocked ? (
                  <div className="alert alert-error">Semester is locked by admin. Result updates are disabled.</div>
                ) : null}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={isSemesterLocked}>Save Result</button>
                  <button className="btn btn-ghost" type="button" onClick={resetResultForm}>Reset</button>
                </div>
              </form>
            </div>
          </section>

          <section className="surface">
            <div className="section-head">
              <h2 className="section-title">Bulk Marks Entry</h2>
              <div className="inline-actions">
                {bulkLocked ? <span className="tag tag-read">Locked</span> : <span className="tag tag-read">Unlocked</span>}
                {bulkActive ? (
                  <button className="btn btn-sm btn-ghost" onClick={exitBulkEntry}>Exit</button>
                ) : null}
              </div>
            </div>
            <div className="filter-row">
              <select className="select" value={bulkProgram} onChange={(e) => setBulkProgram(e.target.value)}>
                <option value="all">All Programs</option>
                <option value="ug">UG Only</option>
                <option value="pg">PG Only</option>
              </select>
              <select className="select" value={bulkYear} onChange={(e) => setBulkYear(e.target.value)}>
                {bulkYearOptions.map((year) => (
                  <option key={`bulk-year-${year}`} value={year}>Year {year}</option>
                ))}
              </select>
              <select className="select" value={bulkSemester} onChange={(e) => setBulkSemester(e.target.value)}>
                {bulkSemesterOptions.map((sem) => (
                  <option key={`bulk-sem-${sem}`} value={sem}>Semester {sem}</option>
                ))}
              </select>
              {!bulkActive ? (
                <button className="btn btn-primary" onClick={startBulkEntry} disabled={bulkLocked || !bulkCandidates.length}>
                  Start
                </button>
              ) : null}
              <span className="muted">{bulkCandidates.length} students</span>
            </div>
            <small className="auth-subtitle" style={{ display: "block", marginTop: -6 }}>
              Subject order: {bulkSubjectOrder.length ? bulkSubjectOrder.join(", ") : "Select a semester to see subject order."}
            </small>
            {bulkActive ? (
              <form
                className="form-layout"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveBulkMarks();
                }}
                style={{ marginTop: 12 }}
              >
                <div className="profile-grid profile-grid-wide">
                  <div className="profile-item">
                    <p>Current Student</p>
                    <strong>{bulkCurrent ? bulkCurrent.name : "-"}</strong>
                    <span className="muted">{bulkCurrent ? bulkCurrent.rollNo : ""}</span>
                  </div>
                  <div className="profile-item">
                    <p>Department</p>
                    <strong>{bulkCurrent ? bulkCurrent.department : "-"}</strong>
                  </div>
                  <div className="profile-item">
                    <p>Program</p>
                    <strong>{bulkCurrent ? programLabelFromDepartment(bulkCurrent.department) : "-"}</strong>
                  </div>
                  <div className="profile-item">
                    <p>Semester</p>
                    <strong>Sem {bulkSemester} (Year {bulkYear})</strong>
                  </div>
                </div>
                <div className="filter-row">
                  <select
                    className="select"
                    value={bulkSubjectMode}
                    onChange={(e) => {
                      setBulkSubjectMode(e.target.value);
                      setBulkMarks("");
                    }}
                  >
                    <option value="all">All Subjects</option>
                    <option value="single">Particular Subject</option>
                  </select>
                  {bulkSubjectMode === "single" ? (
                    <select
                      className="select"
                      value={bulkSubjectSingle}
                      onChange={(e) => setBulkSubjectSingle(e.target.value)}
                    >
                      <option value="">Select subject</option>
                      {bulkSubjectOrder.map((subj) => (
                        <option key={`bulk-sub-${subj}`} value={subj}>{subj}</option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <input
                  className="input"
                  placeholder={bulkSubjectMode === "single" ? "Enter mark for selected subject" : "Marks CSV in subject order (e.g., 78, 85, 69...)"}
                  value={bulkMarks}
                  onChange={(e) => setBulkMarks(e.target.value)}
                  required
                />
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Guidance (optional)"
                  value={bulkRemark}
                  onChange={(e) => setBulkRemark(e.target.value)}
                />
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit">Save & Next</button>
                  <button className="btn btn-ghost" type="button" onClick={() => {
                    if (bulkIndex + 1 >= bulkCandidates.length) {
                      exitBulkEntry();
                    } else {
                      setBulkIndex((prev) => prev + 1);
                      setBulkMarks("");
                      setBulkRemark("");
                      setBulkSubjectMode("all");
                      setBulkSubjectSingle("");
                    }
                  }}>Skip</button>
                </div>
              </form>
            ) : (
              <p className="auth-subtitle" style={{ marginTop: 12 }}>
                Choose program, year, and semester to start bulk entry. The next roll number loads automatically after save.
              </p>
            )}
          </section>

          <section className="surface">
            <div className="section-head">
              <h2 className="section-title">Student Directory</h2>
              <div className="inline-actions">
                <span className="muted">{filteredStudentsWithDept.length} students</span>
                {studentListLimit && studentListLimit < filteredStudentsWithDept.length ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => setStudentListLimit(0)}>Show All</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setStudentListLimit(20)}>Show Recent</button>
                )}
              </div>
            </div>
            <div className="filter-row" style={{ marginBottom: 10 }}>
              <input
                className="input"
                placeholder="Search by name, roll number, or email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <select className="select" value={studentDeptFilter} onChange={(e) => setStudentDeptFilter(e.target.value)}>
                <option value="all">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={`dir-${dept}`} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Roll No</th><th>Program</th><th>Semester</th><th>Dept</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleStudents.map((s) => (
                    <tr key={s._id}>
                      <td>{s.name}</td><td>{s.email}</td><td className="mono">{s.rollNo}</td>
                      <td>{programLabelFromDepartment(s.department)}</td>
                      <td className="semester-cell">{s.semester ? `Sem ${s.semester} (Year ${yearFromSemester(s.semester, s.department)})` : "-"}</td>
                      <td>{s.department || "-"}</td>
                      <td>
                        <span className="inline-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => editStudent(s)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => removeStudent(s._id)}>Delete</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface" style={{ marginTop: 12 }}>
            <div className="section-head">
              <h2 className="section-title">My Evaluation Groups</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Group</th><th>Program</th><th>Year</th><th>Semester</th><th>Students</th></tr></thead>
                <tbody>
                  {assignmentGroups.length === 0 ? (
                    <tr><td colSpan="5">No groups assigned yet.</td></tr>
                  ) : assignmentGroups.map((group) => (
                    <tr key={`staff-group-${group._id}`}>
                      <td>{group.name}</td>
                      <td>{group.program ? group.program.toUpperCase() : "-"}</td>
                      <td>{group.year || "-"}</td>
                      <td>{group.semester || "All"}</td>
                      <td>{group.rollNos?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {!isAdmin && activeTab === "registry" && (
        <section className="surface">
            <div className="section-head">
              <h2 className="section-title">Results Registry</h2>
              {recentChanges.length ? <span className="tag tag-read">{recentChanges.length} changes tracked</span> : null}
            </div>

          <div className="filter-row">
            <input className="input" placeholder="Search by name or roll number" value={resultSearch} onChange={(e) => setResultSearch(e.target.value)} />
            <select className="select" value={resultSemesterFilter} onChange={(e) => setResultSemesterFilter(e.target.value)}>
              <option value="all">All Semesters</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => <option key={sem} value={sem}>Semester {sem}</option>)}
            </select>
            <select className="select" value={resultLockFilter} onChange={(e) => setResultLockFilter(e.target.value)}>
              <option value="all">All Locks</option>
              <option value="locked">Locked Only</option>
              <option value="unlocked">Unlocked Only</option>
            </select>
            <select className="select" value={resultProgramFilter} onChange={(e) => setResultProgramFilter(e.target.value)}>
              <option value="all">All Programs</option>
              <option value="ug">UG Only</option>
              <option value="pg">PG Only</option>
            </select>
            <select className="select" value={resultGradeFilter} onChange={(e) => setResultGradeFilter(e.target.value)}>
              <option value="all">All Grades</option>
              {['A+', 'A', 'B+', 'B', 'C', 'F'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className="select" value={resultSubjectFilter} onChange={(e) => setResultSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {uniqueSubjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={() => { setResultSearch(""); setResultSemesterFilter("all"); setResultLockFilter("all"); setResultProgramFilter("all"); setResultGradeFilter("all"); setResultSubjectFilter("all"); }}>Clear</button>
          </div>

            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Roll No</th><th>Name</th><th>Program</th><th>Semester</th><th>Subjects & Marks</th><th>Percentage</th><th>Grade</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredResults.map((r) => (
                    <tr key={`${r.roll_no}-${r.semester}`} onClick={() => setSelectedResultForGrades(r)}>
                      <td className="mono">
                        <span
                          className="hover-link"
                          onMouseEnter={(e) => onHoverRow(e, r)}
                          onMouseMove={(e) => onHoverRow(e, r)}
                          onMouseLeave={closeHover}
                        >
                          {r.roll_no}
                        </span>
                      </td>
                      <td>{studentNameByRoll.get(String(r.roll_no || "").toUpperCase()) || r.name}</td>
                      <td>{programLabelFromDepartment(studentDeptByRoll.get(String(r.roll_no || "").toUpperCase()))}</td>
                    <td className="semester-cell">
                      {`Sem ${r.semester} (Year ${yearFromSemester(r.semester, studentDeptByRoll.get(String(r.roll_no || "").toUpperCase()))})`}
                      {isRowLocked(r.semester, r.roll_no) ? " • Locked" : ""}
                    </td>
                      <td>
                        {inlineEdits[`${r.roll_no}-${r.semester}`] ? (
                          <input
                            className="input"
                            value={inlineEdits[`${r.roll_no}-${r.semester}`].marksCsv}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setInlineEdits((prev) => ({
                                ...prev,
                                [`${r.roll_no}-${r.semester}`]: {
                                  ...prev[`${r.roll_no}-${r.semester}`],
                                  marksCsv: e.target.value
                                }
                              }))
                            }
                            placeholder="CSV marks"
                          />
                        ) : (
                          <div className="subjects-wrap">
                            {(r.subjects || []).map((s, i) => (
                              <span
                                key={`${r.roll_no}-${r.semester}-${s}`}
                                className="subject-pill"
                                onMouseEnter={(e) => onHoverRow(e, r, s)}
                                onMouseMove={(e) => onHoverRow(e, r, s)}
                                onMouseLeave={closeHover}
                              >
                                {s}: {r.marks[i] ?? "-"}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{resultPercentage(r)}%</td>
                      <td>{gradeForResult(r)}</td>
                    <td>
                        {(() => {
                          const rowLocked = isRowLocked(r.semester, r.roll_no);
                          const latestSemester = getLatestSemesterForRoll(r.roll_no);
                          const isLatest = Number(r.semester) === Number(latestSemester);
                          return (
                        <span className="inline-actions">
                          {inlineEdits[`${r.roll_no}-${r.semester}`] ? (
                            <>
                              {rowLocked ? null : (
                                <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); saveInlineEdit(r); }}>Save</button>
                              )}
                              <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); cancelInlineEdit(r); }}>Cancel</button>
                            </>
                          ) : (
                            rowLocked ? (
                              <span className="muted">Locked</span>
                            ) : (
                              <>
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={(e) => { e.stopPropagation(); beginInlineEdit(r); }}
                                  disabled={!isLatest}
                                >
                                  Inline Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={(e) => { e.stopPropagation(); editResult(r); }}
                                  disabled={!isLatest}
                                >
                                  Edit
                                </button>
                              </>
                            )
                          )}
                          {pendingUndo[`${r.roll_no}-${r.semester}`] ? (
                            <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); undoInlineEdit(r.roll_no, r.semester); }}>Undo</button>
                          ) : null}
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={(e) => { e.stopPropagation(); removeResult(r.roll_no, r.semester); }}
                            disabled={rowLocked}
                          >
                            Delete
                          </button>
                        </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {recentChanges.length ? (
              <div className="diff-panel" style={{ marginTop: 12 }}>
                <div className="section-head"><h3 className="section-title">What Changed</h3></div>
                <div className="diff-list">
                  {recentChanges.map((diff) => (
                    <article key={diff.id} className="diff-item">
                      <p className="muted" style={{ margin: 0 }}>
                        {diff.time} - {diff.actor} updated {diff.rollNo} Sem {diff.semester}
                      </p>
                      <p style={{ margin: "6px 0 0" }}>
                        Grade: <strong>{diff.oldGrade}</strong> -> <strong>{diff.newGrade}</strong>
                        {" | "}
                        Percentage: <strong>{diff.oldPercentage}%</strong> -> <strong>{diff.newPercentage}%</strong>
                      </p>
                      <p className="mono" style={{ margin: "6px 0 0" }}>
                        Marks: [{diff.oldMarks.join(", ")}] -> [{diff.newMarks.join(", ")}]
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
        </section>
      )}

      {isAdmin && activeTab === "monitor" && (
        <section className="grid-2">
          <div className="surface">
            <div className="section-head"><h2 className="section-title">Student Directory</h2></div>
            <input
              className="input"
              placeholder="Search by name, roll number, or email"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <select
              className="select"
              value={studentDeptFilter}
              onChange={(e) => setStudentDeptFilter(e.target.value)}
              style={{ marginBottom: 12 }}
            >
              <option value="all">All Departments</option>
              {uniqueDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Roll No</th><th>Program</th><th>Dept</th><th>Semester</th></tr></thead>
                <tbody>
                  {filteredStudentsWithDept.map((s) => (
                    <tr
                      key={s._id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedStudentRoll(s.rollNo)}
                    >
                      <td>{s.name}</td>
                      <td className="mono">{s.rollNo}</td>
                      <td>{programLabelFromDepartment(s.department)}</td>
                      <td>{s.department || "-"}</td>
                      <td className="semester-cell">{s.semester ? `Sem ${s.semester} (Year ${yearFromSemester(s.semester, s.department)})` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface">
            <div className="section-head"><h2 className="section-title">Student Overview</h2></div>
            {!selectedStudent ? (
              <p className="auth-subtitle">Select a student to view profile and results.</p>
            ) : (
              <>
                <div className="profile-grid profile-grid-wide" style={{ marginBottom: 12 }}>
                  <div className="profile-item"><p>Name</p><strong>{selectedStudent.name}</strong></div>
                  <div className="profile-item"><p>Email</p><strong>{selectedStudent.email}</strong></div>
                  <div className="profile-item"><p>Roll No</p><strong className="mono">{selectedStudent.rollNo}</strong></div>
                  <div className="profile-item">
                    <p>Semester</p>
                    <strong>{selectedStudent.semester ? `Sem ${selectedStudent.semester} (Year ${yearFromSemester(selectedStudent.semester, selectedStudent.department)})` : "-"}</strong>
                  </div>
                  <div className="profile-item"><p>Department</p><strong>{selectedStudent.department || "-"}</strong></div>
                  <div className="profile-item"><p>Program</p><strong>{programLabelFromDepartment(selectedStudent.department)}</strong></div>
                  <div className="profile-item"><p>Status</p><strong>Active</strong></div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Semester</th><th>Subjects</th><th>Percentage</th><th>Grade</th></tr></thead>
                    <tbody>
                      {selectedStudentResults.length === 0 ? (
                        <tr><td colSpan="4">No results found</td></tr>
                      ) : (
                        selectedStudentResults.map((r) => (
                          <tr key={`${r.roll_no}-${r.semester}`} onClick={() => setSelectedResultForGrades(r)} style={{ cursor: "pointer" }}>
                            <td className="semester-cell">{`Sem ${r.semester} (Year ${yearFromSemester(r.semester, selectedStudent.department)})`}</td>
                            <td>{(r.subjects || []).join(", ")}</td>
                            <td>{resultPercentage(r)}%</td>
                            <td>{gradeForResult(r)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {selectedResultForGrades ? (
                  <div className="surface" style={{ marginTop: 12 }}>
                    <div className="section-head"><h3 className="section-title">Subject Grades</h3></div>
                    <p className="muted" style={{ margin: 0 }}>
                      {selectedResultForGrades.roll_no} • Sem {selectedResultForGrades.semester}
                    </p>
                    <div className="table-wrap" style={{ marginTop: 10 }}>
                      <table className="table">
                        <thead><tr><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead>
                        <tbody>
                          {(selectedResultForGrades.subjects || []).map((subject, idx) => {
                            const mark = selectedResultForGrades.marks?.[idx] ?? "-";
                            return (
                              <tr key={`${selectedResultForGrades.roll_no}-${subject}-admin`}>
                                <td>{subject}</td>
                                <td>{mark}</td>
                                <td>{mark === "-" ? "-" : gradeFromMark(mark)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      )}

      {activeTab === "stats" && (
        <section className="grid-2">
          <div className="surface">
          <div className="section-head">
            <h2 className="section-title">Semester Performance</h2>
            <div className="inline-actions">
              {statsSemesterFocus !== "all" ? <span className="tag tag-read">Focused: Sem {statsSemesterFocus}</span> : null}
              {statsYearFocus !== "all" ? <span className="tag tag-read">Year {statsYearFocus}</span> : null}
              {statsProgramFocus !== "all" ? <span className="tag tag-read">{statsProgramFocus.toUpperCase()}</span> : null}
              {statsDeptFocus !== "all" ? <span className="tag tag-read">Dept: {statsDeptFocus}</span> : null}
              <button className="btn btn-sm btn-ghost" onClick={() => { setTourOpen(true); setTourStep(0); }}>Guided Insight Tour</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setStoryRunning((prev) => !prev)}>
                {storyRunning ? "Pause Insights" : "Play Insights"}
              </button>
            </div>
          </div>
          <div className="filter-row" style={{ marginBottom: 10 }}>
            <select className="select" value={statsDeptFocus} onChange={(e) => setStatsDeptFocus(e.target.value)}>
              <option value="all">All Departments</option>
              {uniqueDepartments.map((dept) => (
                <option key={`stats-dept-${dept}`} value={dept}>{dept}</option>
              ))}
            </select>
            <select className="select" value={statsProgramFocus} onChange={(e) => setStatsProgramFocus(e.target.value)}>
              <option value="all">All Programs</option>
              <option value="ug">UG Only</option>
              <option value="pg">PG Only</option>
            </select>
            <select className="select" value={statsYearFocus} onChange={(e) => setStatsYearFocus(e.target.value)}>
              <option value="all">All Years</option>
              {[1, 2, 3, 4].map((year) => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
            <button className="btn btn-ghost" onClick={() => { setStatsDeptFocus("all"); setStatsProgramFocus("all"); setStatsYearFocus("all"); }}>
              Clear
            </button>
          </div>
            {tourOpen ? (
              <div className="tour-card">
                <div className="tour-card-head">
                  <span className="tour-card-badge">Insight {String(tourStep + 1).padStart(2, "0")}</span>
                  <span className="tour-card-count">Step {tourStep + 1} / {tourSteps.length}</span>
                </div>
                <strong className="tour-card-title">{tourSteps[tourStep]?.title}</strong>
                <p className="tour-card-text">{tourSteps[tourStep]?.text}</p>
                <div className="tour-card-rail" aria-hidden="true">
                  <span />
                </div>
                <div className="tour-card-actions inline-actions">
                  <button className="btn btn-sm btn-ghost" onClick={() => setTourStep((prev) => Math.max(0, prev - 1))} disabled={tourStep === 0}>Back</button>
                  <button className="btn btn-sm btn-primary" onClick={() => setTourStep((prev) => Math.min(tourSteps.length - 1, prev + 1))} disabled={tourStep === tourSteps.length - 1}>Next</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setTourOpen(false)}>Done</button>
                </div>
              </div>
            ) : null}
            <div className="select-inline" style={{ marginBottom: 10 }}>
              <label htmlFor="storySemesterSelect">Semester</label>
              <select
                id="storySemesterSelect"
                className="select"
                value={storySemester}
                onChange={(e) => {
                  setStorySemester(Number(e.target.value));
                  setStoryRunning(false);
                }}
              >
                {semesterStory.map((row) => (
                  <option key={`story-${row.semester}`} value={row.semester}>
                    Sem {row.semester} - Avg {row.average}%
                  </option>
                ))}
              </select>
            </div>
            <div className="story-metrics">
              {(() => {
                const current = semesterStory.find((row) => row.semester === storySemester) || semesterStory[0];
                if (!current) return null;
                return (
                  <>
                    <div className="story-card"><p>Semester</p><strong>{current.semester}</strong></div>
                    <div className="story-card"><p>Average</p><strong>{current.average}%</strong></div>
                    <div className="story-card"><p>Top Grade</p><strong>{current.topGrade}</strong></div>
                    <div className="story-card"><p>Fail Count</p><strong>{current.failCount}</strong></div>
                  </>
                );
              })()}
            </div>
            <div className="grade-bars" style={{ marginBottom: 14 }}>
              {stats.semesterBuckets.map((row) => (
                <button
                  key={`sem-bar-${row.semester}`}
                  type="button"
                  className={`grade-bar-row grade-bar-btn ${String(statsSemesterFocus) === String(row.semester) ? "active" : ""}`}
                  onClick={() => toggleSemesterFocus(row.semester)}
                >
                  <div className="grade-bar-meta">
                    <strong>Semester {row.semester}</strong>
                    <span>{row.average}%</span>
                  </div>
                  <div className="grade-bar-track">
                    <div className="grade-bar-fill" style={{ width: `${Math.max(0, Math.min(100, row.average))}%` }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Semester</th><th>Students</th><th>Average %</th></tr></thead>
                <tbody>
                  {stats.semesterBuckets.map((row) => (
                    <tr
                      key={row.semester}
                      className={String(statsSemesterFocus) === String(row.semester) ? "table-row-focus" : ""}
                    >
                      <td>Semester {row.semester}</td>
                      <td>{row.students}</td>
                      <td>{row.average}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface">
            <div className="section-head">
              <h2 className="section-title">Grade Distribution</h2>
              <div className="inline-actions">
                {statsGradeFocus !== "all" ? <span className="tag tag-read">Grade: {statsGradeFocus}</span> : null}
                {(statsGradeFocus !== "all" || statsSemesterFocus !== "all") ? (
                  <button className="btn btn-sm btn-ghost" onClick={clearStatsFocus}>Reset Focus</button>
                ) : null}
              </div>
            </div>
            <div className="grade-bars">
              {Object.entries(stats.gradeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([grade, count]) => {
                  const maxCount = Math.max(...Object.values(stats.gradeCounts));
                  const width = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                  return (
                    <button
                      key={grade}
                      type="button"
                      className={`grade-bar-row grade-bar-btn ${statsGradeFocus === grade ? "active" : ""}`}
                      onClick={() => toggleGradeFocus(grade)}
                    >
                      <div className="grade-bar-meta">
                        <strong>{grade}</strong>
                        <span>{count} results</span>
                      </div>
                      <div className="grade-bar-track">
                        <div className="grade-bar-fill" style={{ width: `${width}%` }} />
                      </div>
                    </button>
                  );
                })}
            </div>
            <div className="grade-stats">
              <button type="button" className="stat-card stat-card-action" onClick={() => {
                setStatsChartMode("performance");
                setStatsChartFocusLabel("Top Performers");
                toggleGradeFocus(scopedTopResult ? gradeForResult(scopedTopResult) : "all");
              }}>
                <p>Highest Grade</p>
                <strong>{scopedTopResult ? gradeForResult(scopedTopResult) : "-"}</strong>
              </button>
              <button type="button" className="stat-card stat-card-action" onClick={() => {
                setStatsChartMode("performance");
                setStatsChartFocusLabel("Top Performers");
                toggleGradeFocus(scopedTopResult ? gradeForResult(scopedTopResult) : "all");
              }}>
                <p>Top Percentage</p>
                <strong>{scopedTopResult ? `${resultPercentage(scopedTopResult)}%` : "-"}</strong>
              </button>
              <button type="button" className="stat-card stat-card-action" onClick={() => {
                setStatsChartMode("grade");
                setStatsChartFocusLabel("Grade Mix");
                toggleGradeFocus("F");
              }}>
                <p>Low Grade Count</p>
                <strong>{scopedFailCount}</strong>
              </button>
              <button type="button" className="stat-card stat-card-action" onClick={toggleFailBandFocus}>
                <p>Fail Band</p>
                <strong>{semesterStory.filter((row) => row.failCount >= 10 && row.failCount <= 15).length}</strong>
              </button>
              <button type="button" className="stat-card stat-card-action" onClick={() => {
                setStatsChartMode("semester");
                setStatsChartFocusLabel("Semester Pulse");
                clearStatsFocus();
              }}>
                <p>Pass Rate</p>
                <strong>{scopedPassRate}</strong>
              </button>
              <button type="button" className="stat-card stat-card-action" onClick={() => {
                setStatsChartMode("grade");
                setStatsChartFocusLabel("Grade Mix");
                toggleGradeFocus(scopedDominantGrade === "-" ? "all" : scopedDominantGrade);
              }}>
                <p>Most Common Grade</p>
                <strong>{scopedDominantGrade}</strong>
              </button>
              <button type="button" className="stat-card stat-card-action" onClick={() => {
                clearStatsFocus();
                setStatsChartMode("grade");
                setStatsChartFocusLabel("Grade Mix");
              }}>
                <p>Unique Grades</p>
                <strong>{scopedUniqueGrades}</strong>
              </button>
            </div>
            <div className="grade-foot">
              <div className="grade-foot-card grade-hero">
                <div className="section-head">
                  <h3 className="section-title">Performance Narrative</h3>
                </div>
                <div className="hero-grid">
                  <div className="hero-block">
                    <p className="hero-label">Best Semester</p>
                    <strong className="hero-value">Sem {bestSemester.semester}</strong>
                    <span className="hero-sub">{bestSemester.average}% average</span>
                  </div>
                  <div className="hero-block">
                    <p className="hero-label">Momentum</p>
                    <strong className="hero-value">{momentumDelta >= 0 ? "+" : ""}{momentumDelta}%</strong>
                    <span className="hero-sub">{momentumLabel}</span>
                  </div>
                  <div className="hero-block">
                    <p className="hero-label">Pass Rate</p>
                    <strong className="hero-value">{scopedPassRate}</strong>
                    <span className="hero-sub">Overall consistency</span>
                  </div>
                </div>
                <div className="hero-note">
                  Peak grade: {scopedTopResult ? gradeForResult(scopedTopResult) : "-"} at {scopedTopResult ? `${resultPercentage(scopedTopResult)}%` : "-"}.
                  Dominant grade: {scopedDominantGrade}.
                </div>
              </div>
              <div className={`grade-foot-card grade-spark chart-mode-${statsChartMode}`}>
                <div className="section-head">
                  <div>
                    <div className="chart-lens">{statsChartFocusLabel}</div>
                    <h3 className="section-title">{statsChart.title}</h3>
                    <p className="hero-sub" style={{ marginTop: 2 }}>{statsChart.subtitle}</p>
                  </div>
                  <div className="inline-actions">
                    <button type="button" className={`btn btn-sm ${statsChartMode === "semester" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setStatsChartMode("semester"); setStatsChartFocusLabel("Semester Pulse"); }}>Semester</button>
                    <button type="button" className={`btn btn-sm ${statsChartMode === "grade" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setStatsChartMode("grade"); setStatsChartFocusLabel("Grade Mix"); }}>Grades</button>
                    <button type="button" className={`btn btn-sm ${statsChartMode === "subject" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setStatsChartMode("subject"); setStatsChartFocusLabel("Subject Lift"); }}>Subjects</button>
                    <button type="button" className={`btn btn-sm ${statsChartMode === "performance" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setStatsChartMode("performance"); setStatsChartFocusLabel("Top Performers"); }}>Leaders</button>
                    <button type="button" className={`btn btn-sm ${statsChartMode === "failure" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setStatsChartMode("failure"); setStatsChartFocusLabel("Fail Band 10-15"); }}>Fails</button>
                  </div>
                </div>
                <div className="sparkline">
                  {statsChart.rows.map((row) => {
                    const height = statsChart.maxValue ? Math.max(18, Math.round((row.value / statsChart.maxValue) * 120)) : 18;
                    return (
                      <div key={`spark-${row.key}`} className={`spark-bar ${row.highlight ? "spark-bar-highlight" : ""}`}>
                        <div className="spark-fill" style={{ height: `${height}px` }} />
                        <span>{row.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="spark-meta">
                  <div><strong>Peak</strong> {statsChart.maxValue} {statsChart.unit}</div>
                  <div><strong>Points</strong> {statsChart.rows.length}</div>
                  <div><strong>Range</strong> {Number((statsChart.maxValue - Math.min(...statsChart.rows.map((row) => row.value), statsChart.maxValue || 0)).toFixed(2))} {statsChart.unit}</div>
                  <div><strong>Mode</strong> {statsChartMode}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="surface">
            <div className="section-head">
              <h2 className="section-title">Top Subject Averages</h2>
              <div className="inline-actions">
                <select className="select" value={statsProgramFocus} onChange={(e) => setStatsProgramFocus(e.target.value)}>
                  <option value="all">All Programs</option>
                  <option value="ug">UG Only</option>
                  <option value="pg">PG Only</option>
                </select>
                <select className="select" value={statsYearFocus} onChange={(e) => setStatsYearFocus(e.target.value)}>
                  <option value="all">All Years</option>
                  {[1, 2, 3, 4].map((year) => (
                    <option key={`avg-year-${year}`} value={year}>Year {year}</option>
                  ))}
                </select>
                <select className="select" value={statsSemesterFocus} onChange={(e) => setStatsSemesterFocus(e.target.value)}>
                  <option value="all">All Semesters</option>
                  {Array.from({ length: statsMaxSemester }, (_, i) => i + 1).map((sem) => (
                    <option key={`avg-sem-${sem}`} value={sem}>Sem {sem}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Subject</th><th>Average Mark</th></tr></thead>
                <tbody>
                  {statsScopedSubjectAverages.slice(0, 12).length === 0 ? (
                    <tr><td colSpan="2">No subjects for selected filters</td></tr>
                  ) : statsScopedSubjectAverages.slice(0, 12).map((row) => (
                    <tr key={row.subject}><td>{row.subject}</td><td>{row.average}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface">
            <div className="section-head">
              <h2 className="section-title">Top 10 Performances</h2>
              <div className="inline-actions">
                <select className="select" value={statsProgramFocus} onChange={(e) => setStatsProgramFocus(e.target.value)}>
                  <option value="all">All Programs</option>
                  <option value="ug">UG Only</option>
                  <option value="pg">PG Only</option>
                </select>
                <select className="select" value={statsYearFocus} onChange={(e) => setStatsYearFocus(e.target.value)}>
                  <option value="all">All Years</option>
                  {[1, 2, 3, 4].map((year) => (
                    <option key={`top-year-${year}`} value={year}>Year {year}</option>
                  ))}
                </select>
                <select className="select" value={statsSemesterFocus} onChange={(e) => setStatsSemesterFocus(e.target.value)}>
                  <option value="all">All Semesters</option>
                  {Array.from({ length: statsMaxSemester }, (_, i) => i + 1).map((sem) => (
                    <option key={`top-sem-${sem}`} value={sem}>Sem {sem}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Roll No</th><th>Program</th><th>Semester</th><th>Percentage</th></tr></thead>
                <tbody>
                  {statsScopedTopStudents.length === 0 ? (
                    <tr><td colSpan="5">No performances for selected filters</td></tr>
                  ) : statsScopedTopStudents.map((row, idx) => {
                    const rollKey = String(row.roll_no || row.rollNo || "").toUpperCase();
                    const displayName = studentNameByRoll.get(rollKey) || row.name;
                    const department = studentDeptByRoll.get(rollKey) || "";
                    return (
                    <tr key={`${row.roll_no}-${row.semester}-${idx}`}>
                      <td>{displayName}</td>
                      <td className="mono">{row.roll_no}</td>
                      <td>{programLabelFromDepartment(department)}</td>
                      <td className="semester-cell">{`Sem ${row.semester} (Year ${yearFromSemester(row.semester, department)})`}</td>
                      <td>{resultPercentage(row)}%</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      )}

      {!isAdmin && activeTab === "notifications" && (
        <section className="surface">
          <div className="section-head"><h2 className="section-title">Notifications</h2></div>
          {staffNotifications.length === 0 ? (
            <p className="auth-subtitle">No notifications available.</p>
          ) : (
            <div className="notification-list">
              {staffNotifications.map((n) => (
                <article key={n._id} className={`notification-item ${n.isRead ? "" : "unread"}`}>
                  <div className="section-head" style={{ marginBottom: 6 }}>
                    <p className="notification-title">{n.title}</p>
                    <span className={`tag ${n.isRead ? "tag-read" : "tag-unread"}`}>{n.isRead ? "Read" : "Unread"}</span>
                  </div>
                  <p className="notification-text">?? {n.message}</p>
                  {!n.isRead ? (
                    <div style={{ marginTop: 8 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => markStaffNotificationRead(n._id)}>Mark Read</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "revaluation" && (
        <section className="surface">
          <div className="section-head">
            <h2 className="section-title">Revaluation Queue</h2>
            <button className="btn btn-ghost btn-sm" onClick={loadAll}>Refresh</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                {isAdmin ? (
                  <tr><th>Student</th><th>Semester</th><th>Subject</th><th>Old Mark</th><th>New Mark</th><th>Status</th><th>Reviewer</th><th>Actions</th></tr>
                ) : (
                  <tr><th>Student</th><th>Semester</th><th>Subject</th><th>Old Mark</th><th>New Mark</th><th>Status</th><th>Actions</th></tr>
                )}
              </thead>
              <tbody>
                {isAdmin ? (
                  revaluationQueue.map((req) => (
                    <tr key={req._id}>
                      <td className="mono">{req.rollNo}</td>
                      <td className="semester-cell">{`Sem ${req.semester} (Year ${yearFromSemester(req.semester, studentDeptByRoll.get(String(req.rollNo || "").toUpperCase()))})`}</td>
                      <td>{req.subject}</td>
                      <td>{req.oldMark ?? "-"}</td>
                      <td>{req.newMark ?? "-"}</td>
                      <td>{req.status}</td>
                      <td>
                        <select
                          className="select"
                          value={reviewerEmails[req._id] ?? req.assignedTo ?? ""}
                          onChange={(e) => onReviewerChange(req._id, e.target.value)}
                        >
                          <option value="">Select Staff</option>
                          {staffDirectory.map((staff) => (
                            <option key={staff._id} value={staff.email}>
                              {staff.name} ({staff.email})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="inline-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => assignReviewer(req._id)}>Assign</button>
                          <button className="btn btn-sm btn-primary" onClick={() => approveRequest(req._id)}>Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => rejectRequest(req._id)}>Reject</button>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  revaluationQueue
                    .filter((req) => !req.assignedTo || String(req.assignedTo).toLowerCase() === String(profile?.email || "").toLowerCase())
                    .map((req) => (
                      <tr key={req._id}>
                        <td className="mono">{req.rollNo}</td>
                        <td className="semester-cell">{`Sem ${req.semester} (Year ${yearFromSemester(req.semester, studentDeptByRoll.get(String(req.rollNo || "").toUpperCase()))})`}</td>
                        <td>{req.subject}</td>
                        <td>{req.oldMark}</td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max="100"
                            placeholder={req.newMark ?? "Enter mark"}
                            value={revaluationMarks[req._id] ?? ""}
                            onChange={(e) => onRevaluationMarkChange(req._id, e.target.value)}
                          />
                        </td>
                        <td>{req.status}</td>
                        <td>
                          <button className="btn btn-sm btn-primary" onClick={() => submitRevaluationMark(req._id)}>
                            Submit Mark
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isAdmin && activeTab === "admin" && (
        <section className="surface">
          <div className="section-head">
            <h2 className="section-title">Admin Controls</h2>
            <div className="inline-actions">
              <button className="btn btn-ghost btn-sm" onClick={loadAdminData} disabled={adminLoading}>
                {adminLoading ? "Refreshing..." : "Refresh"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={seedExtraStudentsAction} disabled={seedLoading}>
                {seedLoading ? "Seeding..." : "Seed Extra Students"}
              </button>
            </div>
          </div>
          {adminError ? <div className="alert alert-error">{adminError}</div> : null}

          <section className="grid-2">
            <div className="surface">
              <div className="section-head">
                <h3 className="section-title">Result Lock System</h3>
                <div className="inline-actions">
                  <button className="btn btn-ghost btn-sm" onClick={unlockVisibleSemesters}>Unlock Shown</button>
                  <button className="btn btn-primary btn-sm" onClick={lockVisibleSemesters}>Lock Shown</button>
                  <div className="select-inline">
                    <label htmlFor="lockYearSelect">Year</label>
                    <select
                      id="lockYearSelect"
                      className="select"
                      value={lockYearFilter}
                      onChange={(e) => setLockYearFilter(e.target.value)}
                    >
                      <option value="1">Year 1</option>
                      <option value="2">Year 2</option>
                      <option value="3">Year 3</option>
                      <option value="4">Year 4</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="lock-grid">
                {lockSemesters.map((sem) => {
                  const lock = resultLocks.find(
                    (l) => Number(l.semester) === sem && Number(l.year) === Number(lockYearFilter)
                  );
                  const locked = Boolean(lock?.isLocked);
                  return (
                    <div key={`lock-${sem}`} className={`lock-card ${locked ? "locked" : ""}`}>
                      <div>
                        <strong>Semester {sem}</strong>
                        <p className="muted">{locked ? `Locked by ${lock?.lockedBy || "admin"}` : "Unlocked"}</p>
                      </div>
                      <div className="inline-actions">
                        {locked ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => unlockSemesterAction(Number(lockYearFilter), sem)}>Unlock</button>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => lockSemesterAction(Number(lockYearFilter), sem)}>Lock</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="surface">
              <div className="section-head"><h3 className="section-title">Department Performance</h3></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Department</th><th>Program</th><th>Average %</th><th>Results</th></tr></thead>
                  <tbody>
                    {departmentPerformance.map((row) => (
                      <tr key={row.department}>
                        <td>{row.department}</td>
                        <td>{programLabelFromDepartment(row.department)}</td>
                        <td>{row.average}%</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="surface" style={{ marginTop: 12 }}>
            <div className="section-head"><h3 className="section-title">Evaluation Group Assignment</h3></div>
            <form className="form-layout" onSubmit={submitAssignmentGroup}>
              <select
                className="select"
                value={assignmentForm.staffId}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, staffId: e.target.value }))}
                required
              >
                <option value="">Select Staff</option>
                {staffDirectory.map((staff) => (
                  <option key={staff._id} value={staff._id}>
                    {staff.name} ({staff.email})
                  </option>
                ))}
              </select>
              <div className="filter-row">
                <select
                  className="select"
                  value={assignmentForm.program}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, program: e.target.value }))}
                >
                  <option value="all">All Programs</option>
                  <option value="ug">UG Only</option>
                  <option value="pg">PG Only</option>
                </select>
                <select
                  className="select"
                  value={assignmentForm.year}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, year: e.target.value }))}
                >
                  {Array.from({ length: assignmentYearMax }, (_, i) => i + 1).map((year) => (
                    <option key={`assign-year-${year}`} value={year}>Year {year}</option>
                  ))}
                </select>
                <select
                  className="select"
                  value={assignmentForm.semester}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, semester: e.target.value }))}
                >
                  <option value="all">All Semesters</option>
                  {assignmentSemesterOptions.map((sem) => (
                    <option key={`assign-sem-${sem}`} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>
              <div className="table-wrap" style={{ maxHeight: 220, overflow: "auto" }}>
                <table className="table">
                  <thead><tr><th>Select</th><th>Name</th><th>Roll</th><th>Program</th><th>Dept</th><th>Semester</th></tr></thead>
                  <tbody>
                    {assignmentEligibleStudents.length === 0 ? (
                      <tr><td colSpan="6">No students match the filter</td></tr>
                    ) : assignmentEligibleStudents.map((s) => (
                      <tr key={`assign-${s._id}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={assignmentForm.rollNos.includes(String(s.rollNo || "").toUpperCase())}
                            onChange={() => toggleAssignmentRoll(s.rollNo)}
                          />
                        </td>
                        <td>{s.name}</td>
                        <td className="mono">{s.rollNo}</td>
                        <td>{programLabelFromDepartment(s.department)}</td>
                        <td>{s.department || "-"}</td>
                        <td className="semester-cell">{s.semester ? `Sem ${s.semester} (Year ${yearFromSemester(s.semester, s.department)})` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">Create Group</button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setAssignmentForm({ staffId: "", program: "all", year: "1", semester: "all", rollNos: [] })}
                >
                  Reset
                </button>
              </div>
            </form>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>Group</th><th>Staff</th><th>Program</th><th>Year</th><th>Semester</th><th>Students</th><th>Actions</th></tr></thead>
                <tbody>
                  {assignmentGroups.length === 0 ? (
                    <tr><td colSpan="7">No groups assigned yet.</td></tr>
                  ) : assignmentGroups.map((group) => (
                    <tr key={group._id}>
                      <td>{group.name}</td>
                      <td>{group.staffEmail || "-"}</td>
                      <td>{group.program ? group.program.toUpperCase() : "-"}</td>
                      <td>{group.year || "-"}</td>
                      <td>{group.semester || "All"}</td>
                      <td>{group.rollNos?.length || 0}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => removeAssignmentGroup(group._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface" style={{ marginTop: 12 }}>
            <div className="section-head"><h3 className="section-title">Staff Management (Admin Only)</h3></div>
            <form className="form-layout" onSubmit={saveStaff}>
              <input className="input" name="name" placeholder="Full Name" value={staffForm.name} onChange={onStaffChange} required />
              <input className="input" name="email" type="email" placeholder="Email" value={staffForm.email} onChange={onStaffChange} required />
              <input className="input" name="department" placeholder="Department" value={staffForm.department} onChange={onStaffChange} />
              <input className="input" name="password" type="password" placeholder={staffForm.id ? "New Password (optional)" : "Password"} value={staffForm.password} onChange={onStaffChange} />
              <div className="form-actions">
                <button className="btn btn-primary" type="submit">{staffForm.id ? "Update Staff" : "Add Staff"}</button>
                {staffForm.id ? <button className="btn btn-ghost" type="button" onClick={resetStaffForm}>Cancel</button> : null}
              </div>
            </form>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Actions</th></tr></thead>
                <tbody>
                  {staffDirectory.map((staff) => (
                    <tr key={staff._id}>
                      <td>{staff.name}</td>
                      <td>{staff.email}</td>
                      <td>{staff.department || "-"}</td>
                      <td>
                        <span className="inline-actions">
                          <button className="btn btn-sm btn-ghost" onClick={() => editStaff(staff)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => removeStaff(staff._id)}>Delete</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface" style={{ marginTop: 12 }}>
            <div className="section-head"><h3 className="section-title">Password Registry (Admin Only)</h3></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Roll No</th><th>Password</th></tr></thead>
                <tbody>
                  {passwordRegistry.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td className="mono">{user.rollNo || "-"}</td>
                      <td className="mono">{user.passwordHint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface" style={{ marginTop: 12 }}>
            <div className="section-head"><h3 className="section-title">Audit Logs</h3></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Old ? New</th><th>Time</th></tr></thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id}>
                      <td>{log.action}</td>
                      <td>{log.actorEmail}</td>
                      <td className="mono">{log.target?.rollNo || "-"} {log.target?.semester ? `S${log.target.semester}` : ""}</td>
                      <td className="mono">{log.oldValue ? "Updated" : "-"} ? {log.newValue ? "Updated" : "-"}</td>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {hoverPreview ? (
        <div className="hover-preview" style={{ left: hoverPreview.x, top: hoverPreview.y }}>
          <p className="muted" style={{ margin: 0 }}>{hoverPreview.roll}{hoverPreview.subject ? ` - ${hoverPreview.subject}` : ""}</p>
          <div className="mini-spark">
            {(hoverPreview.trend || []).map((point) => (
              <div key={`hover-${hoverPreview.roll}-${point.semester}`} className="mini-spark-col">
                <div className="mini-spark-fill" style={{ height: `${Math.max(10, Math.round(point.percentage))}px` }} />
                <span>S{point.semester}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ margin: "6px 0 0" }}>Quick links: Inline Edit | View Diff</p>
        </div>
      ) : null}

      {selectedResultForGrades ? (
        <div className="modal-backdrop" onClick={() => setSelectedResultForGrades(null)}>
          <div className="modal-panel surface" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <h2 className="section-title">Subject Grades</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedResultForGrades(null)}>Close</button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {selectedResultForGrades.roll_no} • Sem {selectedResultForGrades.semester}
            </p>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>Subject</th><th>Marks</th><th>Grade</th></tr></thead>
                <tbody>
                  {(selectedResultForGrades.subjects || []).map((subject, idx) => {
                    const mark = selectedResultForGrades.marks?.[idx] ?? "-";
                    return (
                      <tr key={`${selectedResultForGrades.roll_no}-${subject}-modal`}>
                        <td>{subject}</td>
                        <td>{mark}</td>
                        <td>{mark === "-" ? "-" : gradeFromMark(mark)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div> 
  );
};

export default StaffDashboard;
