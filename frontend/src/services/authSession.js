const AUTH_KEYS = ["token", "userRole", "userEmail", "userName", "rollNo"];

const safeGet = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch (err) {
    return null;
  }
};

const safeSet = (storage, key, value) => {
  try {
    if (value == null || value === "") storage.removeItem(key);
    else storage.setItem(key, value);
  } catch (err) {
    // no-op
  }
};

const safeRemove = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch (err) {
    // no-op
  }
};

export const getAuthToken = () => safeGet(sessionStorage, "token");
export const getAuthRole = () => safeGet(sessionStorage, "userRole");
export const getAuthEmail = () => safeGet(sessionStorage, "userEmail");
export const getAuthName = () => safeGet(sessionStorage, "userName");
export const getAuthRollNo = () => safeGet(sessionStorage, "rollNo");

export const setSessionAuth = ({ token, user }) => {
  safeSet(sessionStorage, "token", token || "");
  safeSet(sessionStorage, "userRole", user?.role || "");
  safeSet(sessionStorage, "userEmail", user?.email || "");
  safeSet(sessionStorage, "userName", user?.name || "");
  safeSet(sessionStorage, "rollNo", user?.rollNo || "");
};

export const clearSessionAuth = () => {
  AUTH_KEYS.forEach((key) => safeRemove(sessionStorage, key));
};

export const clearLegacyAuth = () => {
  AUTH_KEYS.forEach((key) => safeRemove(localStorage, key));
};
