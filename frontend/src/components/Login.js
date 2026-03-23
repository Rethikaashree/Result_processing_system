import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { clearLegacyAuth, clearSessionAuth, setSessionAuth } from "../services/authSession";
import { useToast } from "./ToastProvider";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", role: "student" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const toastRef = useRef("");
  const sampleCredentials = [
    { role: "student", email: "rethika.ashree@bitsathy.ac.in", password: "RethikaAshree123" },
    { role: "staff", email: "staff@bitsathy.ac.in", password: "StaffAdmin123" },
    { role: "admin", email: "admin@bitsathy.ac.in", password: "Admin123" }
  ];

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const selectRole = (role) => setForm((prev) => ({ ...prev, role }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser({ email: form.email, password: form.password });
      clearSessionAuth();
      clearLegacyAuth();
      setSessionAuth({ token: data.token, user: data.user });

      navigate(data.user.role === "student" ? "/student-dashboard" : "/staff-dashboard");
    } catch (err) {
      if (!err?.response) {
        setError("Backend is not reachable on http://localhost:5000. Start backend-express server and try again.");
        return;
      }
      const message = err?.response?.data?.message || "Login failed";
      if (message === "Invalid credentials") {
        setError("Invalid credentials. Check email/password and selected portal role.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error && error !== toastRef.current) {
      toast.pushToast("error", error);
      toastRef.current = error;
    }
  }, [error, toast]);

  return (
    <div className="auth-page auth-page-rich">
      <div className="auth-shell auth-shell-rich">
        <aside className="auth-brand auth-brand-rich">
          <div>
            <p className="brand-wordmark mono">INTELGRADE</p>
            <h1 className="brand-subtitle">Control Center</h1>
            <p>
              Interactive academic workspace with role-based command panels,
              semester intelligence, and real-time publication workflows.
            </p>
          </div>
          <div className="brand-panel" aria-hidden="true">
            <div className="brand-panel-head">Platform Capabilities</div>
            <div className="brand-panel-grid">
              <div className="brand-panel-card">
                <strong>Role-Based Access</strong>
                <span>Student, Staff, and Admin boundaries.</span>
              </div>
              <div className="brand-panel-card">
                <strong>Governed Workflows</strong>
                <span>Controlled publish, lock, and approval flows.</span>
              </div>
              <div className="brand-panel-card">
                <strong>Audit Visibility</strong>
                <span>Traceable actions and accountability trail.</span>
              </div>
              <div className="brand-panel-card">
                <strong>Performance Insights</strong>
                <span>Semester trends and subject analytics.</span>
              </div>
            </div>
            <div className="brand-panel-line" />
          </div>
        </aside>

        <section className="auth-panel auth-panel-rich">
          <h2 className="auth-title">Sign In</h2>
          <p className="auth-subtitle">Choose your portal and continue securely.</p>

          <div className="role-grid">
            <button type="button" className={`role-card ${form.role === "student" ? "active" : ""}`} onClick={() => selectRole("student")}>
              <strong>Student Portal</strong>
              <span>Track results, rank, and growth</span>
            </button>
            <button type="button" className={`role-card ${form.role === "staff" ? "active" : ""}`} onClick={() => selectRole("staff")}>
              <strong>Staff Console</strong>
              <span>Publish, manage, analyze</span>
            </button>
            <button type="button" className={`role-card ${form.role === "admin" ? "active" : ""}`} onClick={() => selectRole("admin")}>
              <strong>Admin Control</strong>
              <span>Locks, audits, approvals</span>
            </button>
          </div>

          <div className="surface" style={{ padding: 12, marginBottom: 12 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <h3 className="section-title" style={{ fontSize: "1rem" }}>Sample Credentials</h3>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {sampleCredentials
                .filter((sample) => sample.role === form.role)
                .map((sample) => (
                <div key={sample.role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <strong style={{ textTransform: "capitalize" }}>{sample.role}</strong>
                    <p className="auth-subtitle" style={{ margin: 0 }}>{sample.email} / {sample.password}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <form onSubmit={onSubmit} className="form-grid">
            <input type="hidden" name="role" value={form.role} />

            <div className="form-row">
              <label>Email</label>
              <input className="input" name="email" type="email" required value={form.email} onChange={onChange} placeholder="you@bitsathy.ac.in" />
            </div>

            <div className="form-row">
              <label>Password</label>
              <input className="input" name="password" type="password" required value={form.password} onChange={onChange} placeholder="Enter password" />
            </div>

            <button className="btn btn-primary btn-loading" disabled={loading} type="submit">
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  Authenticating...
                </>
              ) : "Login"}
            </button>
          </form>

          {/* Registration message removed per request */}
        </section>
      </div>
    </div>
  );
};

export default Login;

