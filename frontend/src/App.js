// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import StaffDashboard from './components/StaffDashboard';
import StudentDashboard from './components/StudentDashboard';
import ProfilePage from './components/ProfilePage';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Navigate to="/login" />} />
            <Route path="/admin-dashboard" element={<Navigate to="/staff-dashboard" replace />} />
            <Route path="/admin" element={<Navigate to="/staff-dashboard" replace />} />
            <Route path="/staff" element={<Navigate to="/staff-dashboard" replace />} />
            <Route path="/staff-dashboard" element={<StaffDashboard />} />
            <Route path="/student-dashboard" element={<StudentDashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
