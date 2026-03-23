import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getResults, getStudents } from "../services/api";
import { clearSessionAuth, getAuthRole, getAuthToken } from "../services/authSession";
import { useToast } from "./ToastProvider";
import LoadingScreen from "./LoadingScreen";

const PortalNavigator = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();
  const toastRef = useRef("");
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

  useEffect(() => {
    const token = getAuthToken();
    const role = getAuthRole();
    if (!token || !role) {
      navigate("/login");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [studentsData, resultsData] = await Promise.all([getStudents(), getResults()]);
        setStudents(studentsData);
        setResults(resultsData);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load navigator data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  useEffect(() => {
    if (error && error !== toastRef.current) {
      toast.pushToast("error", error);
      toastRef.current = error;
    }
  }, [error, toast]);

  const role = getAuthRole();
  const backRoute = role === "staff" || role === "admin" ? "/staff-dashboard" : "/student-dashboard";

  const semesterSummary = useMemo(() => {
    const summary = [];
    for (let semester = 1; semester <= 8; semester += 1) {
      const rows = results.filter((r) => Number(r.semester) === semester);
      const avg = rows.length
        ? (rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length).toFixed(2)
        : "0.00";
      summary.push({ semester, count: rows.length, average: avg });
    }
    return summary;
  }, [results]);

  if (loading) return <LoadingScreen label="Loading navigator..." />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="header-title">Portal Navigator</h1>
          <p className="header-subtitle">Navigate across dataset, semesters, and quick actions</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => navigate(backRoute)}>Back to Dashboard</button>
          <button className="btn btn-danger" onClick={() => { clearSessionAuth(); navigate("/login"); }}>Logout</button>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="metrics-row">
        <article className="metric"><p className="metric-label">Students</p><p className="metric-value">{students.length}</p></article>
        <article className="metric"><p className="metric-label">Result Rows</p><p className="metric-value">{results.length}</p></article>
        <article className="metric"><p className="metric-label">Active Semesters</p><p className="metric-value">8</p></article>
      </section>

      <section className="grid-2">
        <div className="surface">
          <div className="section-head">
            <h2 className="section-title">Semester Coverage</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>Year</th>
                  <th>Students</th>
                  <th>Average %</th>
                </tr>
              </thead>
              <tbody>
                {semesterSummary.map((item) => {
                  const ugYear = yearFromSemester(item.semester, "Computer Science");
                  const pgYear = item.semester <= 4 ? yearFromSemester(item.semester, "MBA") : null;
                  const yearLabel = pgYear ? `UG Year ${ugYear} • PG Year ${pgYear}` : `UG Year ${ugYear}`;
                  return (
                  <tr key={item.semester}>
                    <td>Semester {item.semester}</td>
                    <td>{yearLabel}</td>
                    <td>{item.count}</td>
                    <td>{item.average}%</td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface">
          <div className="section-head">
            <h2 className="section-title">Student Roster Snapshot</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Program</th>
                  <th>Dept</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {students.slice(0, 10).map((s) => (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td className="mono">{s.rollNo}</td>
                    <td>{isPgDepartment(s.department) ? "PG" : "UG"}</td>
                    <td>{s.department || "-"}</td>
                    <td>{s.semester ? `Year ${yearFromSemester(s.semester, s.department)}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PortalNavigator;

