import React from "react";

const LoadingScreen = ({ label = "Loading..." }) => {
  return (
    <div className="app-shell">
      <div className="loading-screen surface">
        <div className="spinner" aria-hidden="true" />
        <p className="auth-subtitle" style={{ margin: 0 }}>{label}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
