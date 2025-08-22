/** Set your backend URL (Node/Express server). */
export const DEFAULT_BACKEND_URL = "http://localhost:8787";

export async function getBackendURL() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ lago_backend: DEFAULT_BACKEND_URL }, (v) => resolve(v.lago_backend));
  });
}