import { getBackendURL } from "./config.js";

async function callBackend(route, payload) {
  const url = await getBackendURL();
  try {
    const res = await fetch(`${url}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Backend error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[Friendly Lago] backend error:", e);
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "ANALYZE_WITH_CONTEXT") {
      const { text, context, prefs, userStyle, instruction, clarifyingAnswer } = msg;
      const result = await callBackend("/analyze", { text, context, prefs, userStyle, instruction, clarifyingAnswer });
      sendResponse(result);
      return;
    }
  })();
  return true; // async
});