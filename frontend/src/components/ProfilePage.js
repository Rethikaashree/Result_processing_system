import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./ToastProvider";
import LoadingScreen from "./LoadingScreen";
import { changePassword, getProfile } from "../services/api";
import { clearSessionAuth, getAuthRole, getAuthToken } from "../services/authSession";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const toast = useToast();
  const toastRef = useRef({ error: "", passwordError: "", passwordSuccess: "" });

  useEffect(() => {
    if (error && error !== toastRef.current.error) {
      toast.pushToast("error", error);
      toastRef.current.error = error;
    }
  }, [error, toast]);

  useEffect(() => {
    if (passwordError && passwordError !== toastRef.current.passwordError) {
      toast.pushToast("error", passwordError);
      toastRef.current.passwordError = passwordError;
    }
  }, [passwordError, toast]);

  useEffect(() => {
    if (passwordSuccess && passwordSuccess !== toastRef.current.passwordSuccess) {
      toast.pushToast("success", passwordSuccess);
      toastRef.current.passwordSuccess = passwordSuccess;
    }
  }, [passwordSuccess, toast]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

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
        const me = await getProfile();
        setProfile(me);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate]);

  const role = profile?.role || getAuthRole();
  const isStudent = role === "student";
  const isAdmin = role === "admin";

  const backRoute = useMemo(() => {
    if (role === "staff") return "/staff-dashboard";
    if (role === "admin") return "/staff-dashboard";
    return "/student-dashboard";
  }, [role]);

  const logout = () => {
    clearSessionAuth();
    navigate("/login");
  };

  const onPasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess("Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err?.response?.data?.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading profile..." />;

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="header-title">Profile</h1>
          <p className="header-subtitle">Account details and password management</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => navigate(backRoute)}>Back to Dashboard</button>
          <button className="btn btn-danger" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="campus-banner">
        <div>
          <p className="campus-label">College</p>
          <h2 className="campus-name">Bannari Amman Institute of Technology</h2>
        </div>
        <div className="campus-meta">
          <span className="campus-chip">{isStudent ? "Student Profile" : isAdmin ? "Admin Profile" : "Staff Profile"}</span>
          <span className="campus-chip">{profile?.department || "Department"}</span>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid-2">
        <div className="surface">
          <div className="section-head"><h2 className="section-title">{isStudent ? "Student Profile" : "Staff Profile"}</h2></div>
          <div className="profile-grid profile-grid-wide">
            <div className="profile-item"><p>Full Name</p><strong>{profile?.name || "-"}</strong></div>
            <div className="profile-item"><p>Email</p><strong>{profile?.email || "-"}</strong></div>
            {isStudent ? (
              <>
                <div className="profile-item"><p>Roll No</p><strong className="mono">{profile?.rollNo || "-"}</strong></div>
                <div className="profile-item">
                  <p>Semester</p>
                  <strong>{profile?.semester ? `Sem ${profile.semester} (Year ${yearFromSemester(profile.semester, profile?.department)})` : "-"}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="profile-item"><p>Department</p><strong>{profile?.department || "-"}</strong></div>
                <div className="profile-item"><p>Access Level</p><strong>{isAdmin ? "Administrator" : "Staff"}</strong></div>
              </>
            )}
            <div className="profile-item"><p>Role</p><strong>{profile?.role || (isStudent ? "student" : "staff")}</strong></div>
            <div className="profile-item"><p>College</p><strong>Bannari Amman Institute of Technology</strong></div>
          </div>
        </div>

        <div className="surface">
          <div className="section-head"><h2 className="section-title">Campus Details</h2></div>
          <div className="profile-grid profile-grid-wide">
            <div className="profile-item"><p>Campus</p><strong>Sathyamangalam</strong></div>
            <div className="profile-item"><p>Status</p><strong>Active</strong></div>
            <div className="profile-item"><p>Shift</p><strong>Day</strong></div>
            <div className="profile-item"><p>Office</p><strong>Main Block</strong></div>
            <div className="profile-item"><p>Support</p><strong>Academic Affairs</strong></div>
            <div className="profile-item"><p>Program</p><strong>{isPgDepartment(profile?.department) ? "PG" : "UG"}</strong></div>
          </div>
        </div>

        <div className="surface" style={{ gridColumn: "1 / -1" }}>
          <div className="section-head">
            <h2 className="section-title">Change Password</h2>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              onClick={() => setShowPasswordForm((prev) => !prev)}
            >
              {showPasswordForm ? "Hide" : "Update Password"}
            </button>
          </div>
          {showPasswordForm ? (
            <>
              {passwordError ? <div className="alert alert-error">{passwordError}</div> : null}
              {passwordSuccess ? <div className="alert alert-success">{passwordSuccess}</div> : null}
              <form className="form-layout" onSubmit={submitPasswordChange}>
                <input
                  className="input"
                  name="currentPassword"
                  type="password"
                  placeholder="Current password"
                  value={passwordForm.currentPassword}
                  onChange={onPasswordChange}
                  required
                />
                <input
                  className="input"
                  name="newPassword"
                  type="password"
                  placeholder="New password"
                  value={passwordForm.newPassword}
                  onChange={onPasswordChange}
                  required
                />
                <input
                  className="input"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={onPasswordChange}
                  required
                />
                <div className="form-actions">
                  <button className="btn btn-primary btn-sm" type="submit" disabled={passwordLoading}>
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;
