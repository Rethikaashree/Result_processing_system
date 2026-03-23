import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import { useToast } from "./ToastProvider";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
    rollNo: "",
    semester: "",
    department: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const toastRef = useRef("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const selectRole = (role) => setForm((prev) => ({ ...prev, role }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.role === "student" && !form.rollNo) {
      setError("Roll number is required for student accounts");
      return;
    }

    setLoading(true);

    try {
      await registerUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        rollNo: form.role === "student" ? form.rollNo : undefined,
        semester: form.role === "student" && form.semester ? Number(form.semester) : undefined,
        department: form.department || undefined
      });
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Registration failed");
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
            <span className="brand-badge mono">ONBOARD</span>
            <h1>Create Access Profile</h1>
            <p>
              Register staff and student identities with role-aware fields.
              Student accounts are mapped to roll numbers for semester tracking.
            </p>
          </div>
          <div className="pulse-orb-wrap">
            <div className="pulse-orb" />
            <div className="pulse-orb pulse-orb-2" />
          </div>
        </aside>

        <section className="auth-panel auth-panel-rich">
          <h2 className="auth-title">Register</h2>
          <p className="auth-subtitle">Choose role and complete profile setup.</p>

          <div className="role-grid">
            <button type="button" className={`role-card ${form.role === "student" ? "active" : ""}`} onClick={() => selectRole("student")}>
              <strong>Student</strong>
              <span>Roll number required</span>
            </button>
            <button type="button" className={`role-card ${form.role === "staff" ? "active" : ""}`} onClick={() => selectRole("staff")}>
              <strong>Staff</strong>
              <span>Administrative access</span>
            </button>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <form onSubmit={onSubmit} className="form-grid">
            <div className="form-row">
              <label>Full Name</label>
              <input className="input" name="name" required value={form.name} onChange={onChange} />
            </div>

            <div className="form-row">
              <label>Email</label>
              <input className="input" name="email" type="email" required value={form.email} onChange={onChange} />
            </div>

            {form.role === "student" ? (
              <>
                <div className="form-row">
                  <label>Roll Number</label>
                  <input className="input mono" name="rollNo" required value={form.rollNo} onChange={onChange} />
                </div>
                <div className="form-row">
                  <label>Semester</label>
                  <input className="input" name="semester" type="number" min="1" max="8" value={form.semester} onChange={onChange} />
                </div>
              </>
            ) : null}

            <div className="form-row">
              <label>Department</label>
              <input className="input" name="department" value={form.department} onChange={onChange} />
            </div>

            <div className="form-row">
              <label>Password</label>
              <input className="input" name="password" type="password" required value={form.password} onChange={onChange} />
            </div>

            <div className="form-row">
              <label>Confirm Password</label>
              <input className="input" name="confirmPassword" type="password" required value={form.confirmPassword} onChange={onChange} />
            </div>

            <button className="btn btn-primary btn-loading" disabled={loading} type="submit">
              {loading ? (<><span className="btn-spinner" />Creating account...</>) : "Register"}
            </button>
          </form>

          <p className="auth-link">Already registered? <Link to="/login">Go to login</Link></p>
        </section>
      </div>
    </div>
  );
};

export default Register;
