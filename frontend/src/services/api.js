import axios from "axios";
import { getAuthToken } from "./authSession";

const getApiBaseUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    return isLocalhost ? `${protocol}//${hostname}:5000/api` : `${origin}/api`;
  }

  return "http://localhost:5000/api";
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const LIVE_UPDATE_KEY = "intelgrade-live-update";
let liveChannel = null;

const getLiveChannel = () => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!liveChannel) liveChannel = new BroadcastChannel("intelgrade_live_sync");
  return liveChannel;
};

export const emitLiveUpdate = (type, payload = {}) => {
  const message = { type, payload, ts: Date.now() };
  try {
    const channel = getLiveChannel();
    if (channel) channel.postMessage(message);
  } catch (err) {
    // no-op
  }

  try {
    localStorage.setItem(LIVE_UPDATE_KEY, JSON.stringify(message));
  } catch (err) {
    // no-op
  }
};

export const subscribeLiveUpdates = (handler) => {
  const onStorage = (event) => {
    if (event.key !== LIVE_UPDATE_KEY || !event.newValue) return;
    try {
      handler(JSON.parse(event.newValue));
    } catch (err) {
      // no-op
    }
  };

  const channel = getLiveChannel();
  const onChannel = (event) => handler(event.data);
  window.addEventListener("storage", onStorage);
  if (channel) channel.addEventListener("message", onChannel);

  return () => {
    window.removeEventListener("storage", onStorage);
    if (channel) channel.removeEventListener("message", onChannel);
  };
};

export const registerUser = async (userData) => {
  const { data } = await api.post("/auth/register", userData);
  return data;
};

export const loginUser = async (credentials) => {
  const { data } = await api.post("/auth/login", credentials);
  return data;
};

export const getProfile = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const initDatabase = async () => {
  const { data } = await api.get("/init");
  return data;
};

export const seedExtraStudents = async () => {
  const { data } = await api.post("/init/extra");
  return data;
};

export const getStudents = async () => {
  const { data } = await api.get("/students");
  return data;
};

export const getAllUsers = async () => {
  const { data } = await api.get("/students/all");
  return data;
};

export const getPasswordRegistry = async () => {
  const { data } = await api.get("/students/passwords");
  return data;
};

export const getStaffs = async () => {
  const { data } = await api.get("/students/staffs");
  return data;
};

export const createStaff = async (payload) => {
  const { data } = await api.post("/students/staffs", payload);
  emitLiveUpdate("STAFF_CREATED");
  return data;
};

export const updateStaff = async (id, payload) => {
  const { data } = await api.put(`/students/staffs/${id}`, payload);
  emitLiveUpdate("STAFF_UPDATED");
  return data;
};

export const deleteStaff = async (id) => {
  const { data } = await api.delete(`/students/staffs/${id}`);
  emitLiveUpdate("STAFF_DELETED");
  return data;
};

export const createStudent = async (payload) => {
  const { data } = await api.post("/students", payload);
  emitLiveUpdate("STUDENT_CREATED");
  return data;
};

export const updateStudent = async (id, payload) => {
  const { data } = await api.put(`/students/${id}`, payload);
  emitLiveUpdate("STUDENT_UPDATED");
  return data;
};

export const deleteStudent = async (id) => {
  const { data } = await api.delete(`/students/${id}`);
  emitLiveUpdate("STUDENT_DELETED");
  return data;
};

export const getResults = async () => {
  const { data } = await api.get("/results");
  return data;
};

export const getResultByRollNo = async (rollNo, semester) => {
  const query = semester ? `?semester=${semester}` : "";
  const { data } = await api.get(`/results/${rollNo}${query}`);
  return data;
};

export const addResult = async (payload) => {
  const { data } = await api.post("/results/add", payload);
  emitLiveUpdate("RESULT_ADDED");
  return data;
};

export const updateResult = async (rollNo, semester, payload) => {
  const { data } = await api.put(`/results/update/${rollNo}/${semester}`, payload);
  emitLiveUpdate("RESULT_UPDATED", { rollNo, semester });
  return data;
};

export const deleteResult = async (rollNo, semester) => {
  const { data } = await api.delete(`/results/delete/${rollNo}/${semester}`);
  emitLiveUpdate("RESULT_DELETED", { rollNo, semester });
  return data;
};

export const getLeaderboard = async (semester) => {
  const { data } = await api.get(`/results/leaderboard/${semester}`);
  return data;
};

export const getNotifications = async () => {
  const { data } = await api.get("/notifications");
  return data;
};

export const markNotificationRead = async (notificationId) => {
  const { data } = await api.patch(`/notifications/${notificationId}/read`);
  emitLiveUpdate("NOTIFICATION_READ", { notificationId });
  return data;
};

export const getResultLocks = async () => {
  const { data } = await api.get("/results/locks");
  return data;
};

export const lockSemester = async (year, semester) => {
  const { data } = await api.post(`/results/lock/${year}/${semester}`);
  emitLiveUpdate("SEMESTER_LOCKED", { year, semester });
  return data;
};

export const unlockSemester = async (year, semester) => {
  const { data } = await api.post(`/results/unlock/${year}/${semester}`);
  emitLiveUpdate("SEMESTER_UNLOCKED", { year, semester });
  return data;
};

export const getAuditLogs = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const { data } = await api.get(`/results/audit${query ? `?${query}` : ""}`);
  return data;
};

export const getDepartmentPerformance = async () => {
  const { data } = await api.get("/results/department-performance");
  return data;
};

export const getAssignments = async () => {
  const { data } = await api.get("/assignments");
  return data;
};

export const createAssignment = async (payload) => {
  const { data } = await api.post("/assignments", payload);
  return data;
};

export const updateAssignment = async (id, payload) => {
  const { data } = await api.put(`/assignments/${id}`, payload);
  return data;
};

export const deleteAssignment = async (id) => {
  const { data } = await api.delete(`/assignments/${id}`);
  return data;
};

export const getRevaluationRequests = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const { data } = await api.get(`/revaluation${query ? `?${query}` : ""}`);
  return data;
};

export const assignRevaluation = async (id, payload) => {
  const { data } = await api.post(`/revaluation/assign/${id}`, payload);
  emitLiveUpdate("REVAL_ASSIGNED", { id });
  return data;
};

export const updateRevaluation = async (id, payload) => {
  const { data } = await api.post(`/revaluation/update/${id}`, payload);
  emitLiveUpdate("REVAL_UPDATED", { id });
  return data;
};

export const approveRevaluation = async (id) => {
  const { data } = await api.post(`/revaluation/approve/${id}`);
  emitLiveUpdate("REVAL_APPROVED", { id });
  return data;
};

export const rejectRevaluation = async (id) => {
  const { data } = await api.post(`/revaluation/reject/${id}`);
  emitLiveUpdate("REVAL_REJECTED", { id });
  return data;
};

export const requestRevaluation = async (payload) => {
  const { data } = await api.post("/revaluation/request", payload);
  emitLiveUpdate("REVAL_REQUESTED");
  return data;
};

export const changePassword = async (payload) => {
  const { data } = await api.put("/auth/change-password", payload);
  return data;
};

export default api;
