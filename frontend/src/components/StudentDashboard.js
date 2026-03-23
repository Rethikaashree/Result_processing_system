import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./ToastProvider";
import LoadingScreen from "./LoadingScreen";
import {
  getLeaderboard,
  getNotifications,
  getProfile,
  getResults,
  markNotificationRead,
  requestRevaluation,
  subscribeLiveUpdates
} from "../services/api";
import { clearSessionAuth, getAuthRole, getAuthToken } from "../services/authSession";

const getHeatColor = (mark) => {
  if (mark >= 80) return "#1c4f86";
  if (mark >= 50) return "#2f7fc4";
  return "#4d93d9";
};

const resultPercentage = (result) => {
  const pct = Number(result?.percentage);
  if (Number.isFinite(pct)) return pct;
  const marks = Array.isArray(result?.marks) ? result.marks : [];
  if (!marks.length) return 0;
  const total = marks.reduce((sum, m) => sum + Number(m || 0), 0);
  return Number(((total / (marks.length * 100)) * 100).toFixed(2));
};
const isPgDepartment = (department) => {
  const value = String(department || "").toLowerCase();
  if (!value) return false;
  if (value.includes("mba") || value.includes("mca") || value.includes("m.tech") || value.includes("mtech")) return true;
  if (value.includes("m.sc") || value.includes("msc")) return true;
  return false;
};

const yearFromSemester = (semester, department) => {
  const sem = Number(semester);
  if (!Number.isFinite(sem) || sem <= 0) return null;
  const maxYear = isPgDepartment(department) ? 2 : 4;
  return Math.min(Math.ceil(sem / 2), maxYear);
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [results, setResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const toast = useToast();
  const toastRef = useRef({ error: "", success: "" });

  const [activeTab, setActiveTab] = useState("overview");
  const [activeMetricKey, setActiveMetricKey] = useState("overall");
  const [revaluationSubmittingKey, setRevaluationSubmittingKey] = useState("");
  const [activeRevaluationKey, setActiveRevaluationKey] = useState("");
  const [revaluationReasons, setRevaluationReasons] = useState({});
  const [activeSubject, setActiveSubject] = useState("");
  const [subjectFilterMode, setSubjectFilterMode] = useState("all");

  const logout = () => {
    clearSessionAuth();
    navigate("/login");
  };

  useEffect(() => {
    const token = getAuthToken();
    const role = getAuthRole();
    if (!token || role !== "student") {
      navigate("/login");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const [me, myResults, myNotifications] = await Promise.all([
          getProfile(),
          getResults(),
          getNotifications()
        ]);

        if (me?.role !== "student") {
          clearSessionAuth();
          navigate("/login");
          return;
        }

        const sortedResults = [...myResults].sort((a, b) => a.semester - b.semester);
        setProfile(me);
        setResults(sortedResults);
        setNotifications(myNotifications);

        const latestSemester = sortedResults.length
          ? sortedResults[sortedResults.length - 1].semester
          : null;

        if (latestSemester) {
          setSelectedSemester(String(latestSemester));
          const lb = await getLeaderboard(latestSemester);
          setLeaderboard(lb);
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load student dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  useEffect(() => {
    const pullLive = async () => {
      try {
        const [myResults, myNotifications] = await Promise.all([getResults(), getNotifications()]);
        const sortedResults = [...myResults].sort((a, b) => a.semester - b.semester);
        setResults(sortedResults);
        setNotifications(myNotifications);
        const targetSemester = selectedSemester
          ? Number(selectedSemester)
          : Number(sortedResults[sortedResults.length - 1]?.semester || 0);
        if (targetSemester) {
          const lb = await getLeaderboard(targetSemester);
          setLeaderboard(lb);
        }
      } catch (err) {
        // ignore transient background sync failures
      }
    };

    const unsubscribe = subscribeLiveUpdates(() => {
      pullLive();
    });
    return () => {
      unsubscribe();
    };
  }, [selectedSemester]);

  const onSemesterChange = async (e) => {
    const semester = Number(e.target.value);
    setSelectedSemester(String(semester));
    try {
      const lb = await getLeaderboard(semester);
      setLeaderboard(lb);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load leaderboard");
    }
  };

  const markRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update notification");
    }
  };

  const requestSubjectRevaluation = async (result, subjectIndex, subjectName) => {
    if (profile?.role !== "student") {
      setError("Student access required");
      setSuccess("");
      return;
    }

    if (latestSemesterResult && Number(result.semester) !== Number(latestSemesterResult.semester)) {
      setError("Revaluation is allowed only for the most recent semester.");
      setSuccess("");
      return;
    }

    const actionKey = `${result.roll_no}-${result.semester}-${subjectIndex}`;
    const reasonInput = String(revaluationReasons[actionKey] || "").trim();

    setError("");
    setSuccess("");
    setRevaluationSubmittingKey(actionKey);

    try {
      await requestRevaluation({
        semester: Number(result.semester),
        subjectIndex: Number(subjectIndex),
        reason: reasonInput || undefined
      });
      setSuccess(`Revaluation requested: Semester ${result.semester} - ${subjectName}`);
      setActiveRevaluationKey("");
      setRevaluationReasons((prev) => ({ ...prev, [actionKey]: "" }));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to request revaluation");
    } finally {
      setRevaluationSubmittingKey("");
    }
  };

  const refreshStudentResults = async () => {
    setError("");
    setSuccess("");
    try {
      const myResults = await getResults();
      const sortedResults = [...myResults].sort((a, b) => a.semester - b.semester);
      setResults(sortedResults);

      if (sortedResults.length) {
        const targetSemester = selectedSemester
          ? Number(selectedSemester)
          : Number(sortedResults[sortedResults.length - 1].semester);
        setSelectedSemester(String(targetSemester));
        const lb = await getLeaderboard(targetSemester);
        setLeaderboard(lb);
      }

      setSuccess("Results refreshed");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to refresh results");
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const map = { "1": "overview", "2": "results", "3": "analytics", "4": "notifications" };
      const nextTab = map[String(event.key || "")];
      if (!nextTab) return;
      event.preventDefault();
      setActiveTab(nextTab);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const summary = useMemo(() => {
    if (!results.length) {
      return { overallPercentage: 0, bestGrade: "-", totalSemesters: 0, arrearCount: 0 };
    }

    const overallPercentage = (
      results.reduce((sum, item) => sum + resultPercentage(item), 0) / results.length
    ).toFixed(2);

    const gradeOrder = ["F", "C", "B", "B+", "A", "A+"];
    const bestGrade = results
      .map((r) => r.grade)
      .sort((a, b) => gradeOrder.indexOf(b) - gradeOrder.indexOf(a))[0];

    const arrearCount = results.reduce((sum, r) => {
      const marks = Array.isArray(r.marks) ? r.marks : [];
      return sum + marks.filter((m) => Number(m) < 50).length;
    }, 0);

    return {
      overallPercentage,
      bestGrade,
      totalSemesters: results.length,
      arrearCount
    };
  }, [results]);

  const trendInsight = useMemo(() => {
    if (results.length < 2) {
      return {
        prediction: null,
        trendText: "Not enough semester data to predict next performance.",
        risk: "low"
      };
    }

    const percentages = results.map((r) => resultPercentage(r));
    const deltas = [];
    for (let i = 1; i < percentages.length; i += 1) {
      deltas.push(percentages[i] - percentages[i - 1]);
    }

    const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const predicted = Number((percentages[percentages.length - 1] + avgDelta).toFixed(2));

    let risk = "low";
    let trendText = "Stable academic trend.";

    const last3Declining = deltas.length >= 3 && deltas.slice(-3).every((d) => d < 0);
    if (last3Declining) {
      risk = "high";
      trendText = "Performance declining. Consider academic support.";
    } else if (avgDelta < 0) {
      risk = "medium";
      trendText = "Slight downward trend detected. Monitor upcoming semester.";
    } else if (avgDelta > 0) {
      trendText = "Positive improvement trend.";
    }

    return { prediction: predicted, trendText, risk };
  }, [results]);


  const downloadBlob = (content, fileName, type = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const downloadSingleResult = (r) => {
    const subjects = Array.isArray(r.subjects) ? r.subjects : [];
    const marks = Array.isArray(r.marks) ? r.marks : [];
    const rows = subjects
      .map(
        (subject, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(subject)}</td>
            <td>${escapeHtml(marks[i] ?? "-")}</td>
          </tr>
        `
      )
      .join("");

    const totalMarks = marks.reduce((sum, m) => sum + Number(m || 0), 0);
    const printableTitle = `Semester ${r.semester} Marksheet`;
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(printableTitle)}</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; background: #f2f8ff; color: #1f2937; }
          .sheet { width: 900px; margin: 24px auto; background: #fff; border: 1px solid #cfe0f5; border-radius: 16px; overflow: hidden; }
          .head { padding: 22px 28px; background: linear-gradient(120deg, #eaf4ff, #d8ebff); border-bottom: 1px solid #bddcff; }
          .head h1 { margin: 0; font-size: 24px; color: #1c4f86; }
          .head p { margin: 6px 0 0; color: #0f2f57; }
          .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 18px 28px; }
          .card { border: 1px solid #cfe0f5; border-radius: 10px; padding: 10px 12px; background: #f2f8ff; }
          .card p { margin: 0; font-size: 12px; color: #4f74a1; }
          .card strong { display: block; margin-top: 6px; font-size: 15px; }
          .tbl-wrap { padding: 6px 28px 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #cfe0f5; padding: 10px; text-align: left; font-size: 14px; }
          th { background: #eaf4ff; color: #1c4f86; font-size: 12px; text-transform: uppercase; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 10px 28px 24px; }
          .footer { padding: 14px 28px 24px; font-size: 12px; color: #4f74a1; border-top: 1px dashed #cfe0f5; }
          @media print {
            body { background: #fff; }
            .sheet { width: auto; margin: 0; border: 0; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="head">
            <h1>Bannari Amman Institute of Technology</h1>
            <p>${escapeHtml(printableTitle)} • IntelGrade Academic Portal</p>
          </div>

          <div class="meta">
            <div class="card"><p>Student Name</p><strong>${escapeHtml(profile?.name || r.name || "-")}</strong></div>
            <div class="card"><p>Roll Number</p><strong>${escapeHtml(r.roll_no || profile?.rollNo || "-")}</strong></div>
            <div class="card"><p>Email</p><strong>${escapeHtml(profile?.email || "-")}</strong></div>
          </div>

          <div class="tbl-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Subject</th><th>Marks (100)</th></tr>
              </thead>
              <tbody>${rows || '<tr><td colspan="3">No subject marks available.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="summary">
            <div class="card"><p>Semester</p><strong>${escapeHtml(`${r.semester} (Year ${yearFromSemester(r.semester, profile?.department)})`)}</strong></div>
            <div class="card"><p>Total Marks</p><strong>${escapeHtml(totalMarks)}</strong></div>
            <div class="card"><p>Percentage</p><strong>${escapeHtml(resultPercentage(r))}%</strong></div>
            <div class="card"><p>Grade</p><strong>${escapeHtml(r.grade || "-")}</strong></div>
          </div>

          <div class="footer">
            Generated on ${escapeHtml(new Date().toLocaleString())}. Use browser Save as PDF in the print dialog.
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1020,height=760");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to download marksheet PDF.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const downloadAllResultsPdf = () => {
    if (!results.length) return;

    const sections = results
      .map((r, idx) => {
        const subjects = Array.isArray(r.subjects) ? r.subjects : [];
        const marks = Array.isArray(r.marks) ? r.marks : [];
        const rows = subjects
          .map(
            (subject, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(subject)}</td>
                <td>${escapeHtml(marks[i] ?? "-")}</td>
              </tr>
            `
          )
          .join("");
        const totalMarks = marks.reduce((sum, m) => sum + Number(m || 0), 0);

        return `
          <section class="sheet ${idx > 0 ? "page-break" : ""}">
            <div class="head">
              <h1>Bannari Amman Institute of Technology</h1>
              <p>Semester ${escapeHtml(r.semester)} Marksheet • IntelGrade Academic Portal</p>
            </div>
            <div class="meta">
              <div class="card"><p>Student Name</p><strong>${escapeHtml(profile?.name || r.name || "-")}</strong></div>
              <div class="card"><p>Roll Number</p><strong>${escapeHtml(r.roll_no || profile?.rollNo || "-")}</strong></div>
              <div class="card"><p>Email</p><strong>${escapeHtml(profile?.email || "-")}</strong></div>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>#</th><th>Subject</th><th>Marks (100)</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3">No subject marks available.</td></tr>'}</tbody>
              </table>
            </div>
            <div class="summary">
              <div class="card"><p>Semester</p><strong>${escapeHtml(`${r.semester} (Year ${yearFromSemester(r.semester, profile?.department)})`)}</strong></div>
              <div class="card"><p>Total Marks</p><strong>${escapeHtml(totalMarks)}</strong></div>
              <div class="card"><p>Percentage</p><strong>${escapeHtml(resultPercentage(r))}%</strong></div>
              <div class="card"><p>Grade</p><strong>${escapeHtml(r.grade || "-")}</strong></div>
            </div>
          </section>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(`All Results - ${profile?.rollNo || "student"}`)}</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; background: #f2f8ff; color: #1f2937; }
          .sheet { width: 900px; margin: 24px auto; background: #fff; border: 1px solid #cfe0f5; border-radius: 16px; overflow: hidden; }
          .head { padding: 22px 28px; background: linear-gradient(120deg, #eaf4ff, #d8ebff); border-bottom: 1px solid #bddcff; }
          .head h1 { margin: 0; font-size: 24px; color: #1c4f86; }
          .head p { margin: 6px 0 0; color: #0f2f57; }
          .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 18px 28px; }
          .card { border: 1px solid #cfe0f5; border-radius: 10px; padding: 10px 12px; background: #f2f8ff; }
          .card p { margin: 0; font-size: 12px; color: #4f74a1; }
          .card strong { display: block; margin-top: 6px; font-size: 15px; }
          .tbl-wrap { padding: 6px 28px 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #cfe0f5; padding: 10px; text-align: left; font-size: 14px; }
          th { background: #eaf4ff; color: #1c4f86; font-size: 12px; text-transform: uppercase; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 10px 28px 24px; }
          .footer { width: 900px; margin: 0 auto 24px; padding: 14px 4px; font-size: 12px; color: #4f74a1; text-align: right; }
          @media print {
            body { background: #fff; }
            .sheet { width: auto; margin: 0; border: 0; border-radius: 0; }
            .page-break { page-break-before: always; }
            .footer { width: auto; margin: 0; padding: 10px 0; }
          }
        </style>
      </head>
      <body>
        ${sections}
        <div class="footer">Generated on ${escapeHtml(new Date().toLocaleString())}. Use Save as PDF in print dialog.</div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to download all marksheets as PDF.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const myRank = useMemo(() => {
    if (!leaderboard || !profile?.rollNo) return null;
    return leaderboard.leaderboard.find((row) => row.roll_no === profile.rollNo) || null;
  }, [leaderboard, profile]);

  const semesters = useMemo(() => [...new Set(results.map((r) => r.semester))], [results]);
  const latestSemesterResult = useMemo(() => {
    if (!results.length) return null;
    return [...results].sort((a, b) => b.semester - a.semester)[0];
  }, [results]);
  const staffGuidance = useMemo(() => {
    const remark = String(latestSemesterResult?.remark || "").trim();
    return remark;
  }, [latestSemesterResult]);

  const subjectProgress = useMemo(() => {
    if (!latestSemesterResult) return [];
    const subjects = Array.isArray(latestSemesterResult.subjects) ? latestSemesterResult.subjects : [];
    const marks = Array.isArray(latestSemesterResult.marks) ? latestSemesterResult.marks : [];
    return subjects.map((subject, index) => ({
      subject,
      mark: Number(marks[index] || 0)
    }));
  }, [latestSemesterResult]);

  useEffect(() => {
    if (!subjectProgress.length) {
      setActiveSubject("");
      return;
    }
    setActiveSubject((prev) => {
      if (prev && subjectProgress.some((item) => item.subject === prev)) return prev;
      return subjectProgress[0].subject;
    });
  }, [subjectProgress]);

  const focusedSubject = useMemo(() => {
    if (!subjectProgress.length || !activeSubject) return null;
    return subjectProgress.find((row) => row.subject === activeSubject) || null;
  }, [subjectProgress, activeSubject]);

  const filteredSubjectProgress = useMemo(() => {
    if (subjectFilterMode === "strong") {
      return subjectProgress.filter((row) => row.mark >= 70);
    }
    if (subjectFilterMode === "focus") {
      return subjectProgress.filter((row) => row.mark < 70);
    }
    return subjectProgress;
  }, [subjectProgress, subjectFilterMode]);

  const subjectInsights = useMemo(() => {
    if (!subjectProgress.length) {
      return {
        avgMark: 0,
        best: null,
        weak: null,
        spread: 0,
        deltaFromPrevious: null
      };
    }

    const sortedByMark = [...subjectProgress].sort((a, b) => b.mark - a.mark);
    const best = sortedByMark[0];
    const weak = sortedByMark[sortedByMark.length - 1];
    const avgMark = Number(
      (subjectProgress.reduce((sum, row) => sum + row.mark, 0) / subjectProgress.length).toFixed(2)
    );
    const spread = best.mark - weak.mark;

    const currentPct = latestSemesterResult ? resultPercentage(latestSemesterResult) : null;
    const previous = latestSemesterResult
      ? results
          .filter((r) => Number(r.semester) < Number(latestSemesterResult.semester))
          .sort((a, b) => b.semester - a.semester)[0]
      : null;
    const previousPct = previous ? resultPercentage(previous) : null;
    const deltaFromPrevious =
      currentPct != null && previousPct != null
        ? Number((currentPct - previousPct).toFixed(2))
        : null;

    return { avgMark, best, weak, spread, deltaFromPrevious };
  }, [subjectProgress, latestSemesterResult, results]);

  const timelineChart = useMemo(() => {
    if (!results.length) return null;

    const values = results.map((r) => resultPercentage(r));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    let min = Math.max(0, Math.floor((rawMin - 8) / 5) * 5);
    let max = Math.min(100, Math.ceil((rawMax + 6) / 5) * 5);
    if (max - min < 20) {
      min = Math.max(0, min - 10);
      max = Math.min(100, max + 10);
    }

    const width = Math.max(560, results.length * 110);
    const height = 280;
    const padLeft = 44;
    const padRight = 24;
    const padTop = 20;
    const padBottom = 58;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const xStep = results.length > 1 ? plotWidth / (results.length - 1) : 0;
    const yFor = (value) => {
      const ratio = (value - min) / Math.max(1, max - min);
      return padTop + (1 - ratio) * plotHeight;
    };

    const points = results.map((row, idx) => {
      const percentage = resultPercentage(row);
      return {
        semester: row.semester,
        percentage,
        x: padLeft + idx * xStep,
        y: yFor(percentage)
      };
    });

    const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
    const areaPath = `${padLeft},${height - padBottom} ${linePath} ${padLeft + plotWidth},${height - padBottom}`;
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const value = max - ((max - min) / 4) * i;
      return {
        value: Number(value.toFixed(0)),
        y: yFor(value)
      };
    });

    return { width, height, padLeft, padRight, padTop, padBottom, points, areaPath, linePath, ticks };
  }, [results]);


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

  if (loading) return <LoadingScreen label="Loading student dashboard..." />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="header-title">Student Workspace</h1>
          <p className="header-subtitle">Academic growth, ranking, and personal performance insights</p>
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
          <span className="campus-chip">Student Dashboard</span>
          <span className="campus-chip">{profile?.department || "Department"}</span>
          <span className="campus-chip">{isPgDepartment(profile?.department) ? "PG" : "UG"}</span>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <section className="metrics-row">
        <button
          type="button"
          className={`metric metric-action ${activeMetricKey === "semesters" ? "active" : ""}`}
          onClick={() => {
            setActiveMetricKey("semesters");
            setActiveTab("overview");
          }}
        >
          <p className="metric-label">Tracked Semesters</p>
          <p className="metric-value">{summary.totalSemesters}</p>
        </button>
        <button
          type="button"
          className={`metric metric-action ${activeMetricKey === "overall" ? "active" : ""}`}
          onClick={() => {
            setActiveMetricKey("overall");
            setActiveTab("analytics");
          }}
        >
          <p className="metric-label">Overall Percentage</p>
          <p className="metric-value">{summary.overallPercentage}%</p>
        </button>
        <button
          type="button"
          className={`metric metric-action ${activeMetricKey === "arrears" ? "active" : ""}`}
          onClick={() => {
            setActiveMetricKey("arrears");
            setActiveTab("results");
          }}
        >
          <p className="metric-label">Arrear Count</p>
          <p className="metric-value">{summary.arrearCount}</p>
        </button>
      </section>

      <section className="tabs-row">
        <button className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>Overview</button>
        <button className={`tab-btn ${activeTab === "results" ? "active" : ""}`} onClick={() => setActiveTab("results")}>Results</button>
        <button className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>Analytics</button>
        <button className={`tab-btn ${activeTab === "notifications" ? "active" : ""}`} onClick={() => setActiveTab("notifications")}>Notifications</button>
      </section>

      {activeTab === "overview" && (
        <>
          <section className="surface">
            <div className="section-head"><h2 className="section-title">Academic Growth Timeline</h2></div>
            {timelineChart ? (
              <div className="timeline-chart-wrap">
                <svg
                  className="timeline-chart-svg"
                  viewBox={`0 0 ${timelineChart.width} ${timelineChart.height}`}
                  role="img"
                  aria-label="Semester-wise percentage trend"
                >
                  {timelineChart.ticks.map((tick, idx) => (
                    <g key={`tick-${idx}`}>
                      <line
                        x1={timelineChart.padLeft}
                        y1={tick.y}
                        x2={timelineChart.width - timelineChart.padRight}
                        y2={tick.y}
                        className="timeline-grid-line"
                      />
                      <text x={timelineChart.padLeft - 10} y={tick.y + 4} className="timeline-axis-label">
                        {tick.value}%
                      </text>
                    </g>
                  ))}

                  <polygon points={timelineChart.areaPath} className="timeline-area-fill" />
                  <polyline points={timelineChart.linePath} className="timeline-trend-line" />

                  {timelineChart.points.map((point) => (
                    <g key={`point-${point.semester}`}>
                      <circle cx={point.x} cy={point.y} r="5.5" className="timeline-point" />
                      <text x={point.x} y={point.y - 12} textAnchor="middle" className="timeline-point-label mono">
                        {point.percentage}%
                      </text>
                      <text
                        x={point.x}
                        y={timelineChart.height - 22}
                        textAnchor="middle"
                        className="timeline-sem-label"
                      >
                        Sem {point.semester}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <p className="auth-subtitle">No semester data available.</p>
            )}
          </section>
        </>
      )}

      {activeTab === "analytics" && (
        <section className="grid-2">
          <div className="surface">
            <div className="section-head"><h2 className="section-title">Smart Performance Predictor</h2></div>
            <p><strong>Risk:</strong> {trendInsight.risk.toUpperCase()}</p>
            <p><strong>Trend:</strong> {trendInsight.trendText}</p>
            <p><strong>Guidance:</strong> {staffGuidance || "No staff guidance yet."}</p>
          </div>

          <div className="surface">
            <div className="section-head">
              <h2 className="section-title">Class Rank and Leaderboard</h2>
              <div className="select-inline">
                <label htmlFor="semSelect">Semester</label>
                <select id="semSelect" className="select" value={selectedSemester} onChange={onSemesterChange}>
                  {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <p><strong>Class Average:</strong> {leaderboard?.classAverage ?? 0}%</p>
            <p><strong>Your Rank:</strong> {myRank ? `#${myRank.rank}` : "N/A"}</p>
            <div className="leaderboard-top">
              {(leaderboard?.top3 || []).map((row, idx) => (
                <div className="trophy" key={row.roll_no}>
                  <strong>{idx === 0 ? "??" : idx === 1 ? "??" : "??"} {row.name}</strong>
                  <p className="auth-subtitle" style={{ margin: "6px 0 0" }}>{row.percentage}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface">
            <div className="section-head">
              <h2 className="section-title">Subject Performance</h2>
              <div className="inline-actions">
                <button
                  type="button"
                  className={`btn btn-sm ${subjectFilterMode === "all" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSubjectFilterMode("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${subjectFilterMode === "strong" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSubjectFilterMode("strong")}
                >
                  Strong (>=70)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${subjectFilterMode === "focus" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSubjectFilterMode("focus")}
                >
                  Needs Focus (&lt;70)
                </button>
              </div>
            </div>
            {filteredSubjectProgress.length ? (
              <div className="grade-bars">
                {filteredSubjectProgress.map((row) => (
                  <button
                    key={`subject-${row.subject}`}
                    type="button"
                    className={`grade-bar-row grade-bar-btn ${activeSubject === row.subject ? "active" : ""}`}
                    onClick={() => setActiveSubject(row.subject)}
                  >
                    <div className="grade-bar-meta">
                      <strong>{row.subject}</strong>
                      <span>{row.mark}/100</span>
                    </div>
                    <div className="grade-bar-track">
                      <div className="grade-bar-fill" style={{ width: `${Math.max(0, Math.min(100, row.mark))}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="auth-subtitle">No subjects in this filter.</p>
            )}
          </div>

          <div className="surface">
            <div className="section-head">
              <h2 className="section-title">Subject Insights</h2>
              <span className="auth-subtitle" style={{ margin: 0 }}>
                {latestSemesterResult
                  ? `Based on Semester ${latestSemesterResult.semester} (Year ${yearFromSemester(latestSemesterResult.semester, profile?.department)})`
                  : "No data"}
              </span>
            </div>
            {subjectProgress.length ? (
              <>
                <div className="profile-grid profile-grid-wide">
                  <div className="profile-item">
                    <p>Subject Average</p>
                    <strong>{subjectInsights.avgMark}/100</strong>
                  </div>
                  <div className="profile-item">
                    <p>Score Spread</p>
                    <strong>{subjectInsights.spread} marks</strong>
                  </div>
                  <div className="profile-item">
                    <p>Top Subject</p>
                    <strong>{subjectInsights.best?.subject || "-"}</strong>
                    <span className="muted">{subjectInsights.best ? `${subjectInsights.best.mark}/100` : ""}</span>
                  </div>
                  <div className="profile-item">
                    <p>Needs Focus</p>
                    <strong>{subjectInsights.weak?.subject || "-"}</strong>
                    <span className="muted">{subjectInsights.weak ? `${subjectInsights.weak.mark}/100` : ""}</span>
                  </div>
                </div>
                <div className="grade-foot" style={{ marginTop: 10 }}>
                  <div className="grade-foot-card">
                    <p className="muted" style={{ margin: 0 }}>
                      Semester Momentum
                    </p>
                    <strong style={{ display: "block", marginTop: 6 }}>
                      {subjectInsights.deltaFromPrevious == null
                        ? "No previous semester to compare"
                        : `${subjectInsights.deltaFromPrevious >= 0 ? "+" : ""}${subjectInsights.deltaFromPrevious}% vs previous semester`}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <p className="auth-subtitle">No subject data available.</p>
            )}
          </div>

          <div className="surface" style={{ gridColumn: "1 / -1" }}>
            <div className="section-head"><h2 className="section-title">Performance Heatmap</h2></div>
            {results.map((r) => (
              <div className="heat-row" key={`heat-${r.semester}`}>
                <strong>Semester {r.semester} (Year {yearFromSemester(r.semester, profile?.department)})</strong>
                <div className="heat-cells">
                  {(r.subjects || []).map((subject, i) => (
                    <button
                      type="button"
                      className={`heat-cell heat-cell-action ${activeSubject === subject ? "active" : ""}`}
                      key={`${r.semester}-${i}`}
                      title={`${subject}: ${r.marks[i]}`}
                      onClick={() => setActiveSubject(subject)}
                      style={{ background: getHeatColor(r.marks[i]) }}
                    >
                      {r.marks[i]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "results" && (
        <section className="surface">
          <div className="section-head">
            <h2 className="section-title">Result Ledger</h2>
            <div className="inline-actions">
              <button className="btn btn-sm btn-ghost" onClick={refreshStudentResults}>
                Refresh
              </button>
              <button className="btn btn-sm btn-ghost" onClick={downloadAllResultsPdf} disabled={!results.length}>
                Download All (PDF)
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Roll No</th><th>Semester</th><th>Year</th><th>Subjects & Marks</th><th>Total</th><th>Percentage</th><th>Grade</th><th>Marksheet</th></tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.roll_no}-${r.semester}`}>
                    <td className="mono">{r.roll_no}</td>
                    <td>{r.semester}</td>
                    <td>{`Year ${yearFromSemester(r.semester, profile?.department)}`}</td>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        {(r.subjects || []).map((s, i) => {
                          const actionKey = `${r.roll_no}-${r.semester}-${i}`;
                          const isSubmitting = revaluationSubmittingKey === actionKey;
                          const canRequestRevaluation =
                            profile?.role === "student" &&
                            latestSemesterResult &&
                            Number(r.semester) === Number(latestSemesterResult.semester);
                          return (
                            <div key={actionKey} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                              <span>{`${s}: ${r.marks[i]}`}</span>
                              {canRequestRevaluation ? (
                                activeRevaluationKey === actionKey ? (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <input
                                      className="input"
                                      placeholder="Reason (optional)"
                                      value={revaluationReasons[actionKey] ?? ""}
                                      onChange={(e) =>
                                        setRevaluationReasons((prev) => ({ ...prev, [actionKey]: e.target.value }))
                                      }
                                    />
                                    <div className="inline-actions">
                                      <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() => requestSubjectRevaluation(r, i, s)}
                                        disabled={isSubmitting}
                                      >
                                        {isSubmitting ? "Requesting..." : "Send Request"}
                                      </button>
                                      <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => setActiveRevaluationKey("")}
                                        disabled={isSubmitting}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => setActiveRevaluationKey(actionKey)}
                                  >
                                    Request Revaluation
                                  </button>
                                )
                              ) : (
                                <span className="tag tag-read">Past Semester</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td>{r.total}</td>
                    <td>{resultPercentage(r)}%</td>
                    <td>{r.grade}</td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={() => downloadSingleResult(r)}>
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "notifications" && (
        <section className="surface">
          <div className="section-head"><h2 className="section-title">Notifications</h2></div>
          {notifications.length === 0 ? (
            <p className="auth-subtitle">No notifications.</p>
          ) : (
            <div className="notification-list">
              {notifications.map((n) => (
                <article key={n._id} className={`notification-item ${n.isRead ? "" : "unread"}`}>
                  <div className="section-head" style={{ marginBottom: 6 }}>
                    <p className="notification-title">{n.title}</p>
                    <span className={`tag ${n.isRead ? "tag-read" : "tag-unread"}`}>{n.isRead ? "Read" : "Unread"}</span>
                  </div>
                  <p className="notification-text">?? {n.message}</p>
                  {!n.isRead ? (
                    <div style={{ marginTop: 8 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => markRead(n._id)}>Mark Read</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default StudentDashboard;


