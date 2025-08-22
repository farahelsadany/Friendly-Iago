/* global chrome */
(function () {
  const STYLE_ID = "friendly-lago-style";
  const BTN_CLASS = "lago-check-btn";
  const PANEL_CLASS = "lago-panel";
  const WRAP_CLASS = "lago-wrap";
  const DATA_KEY = "data-lago-attached";

  // Dynamic humor lines by severity
  const HUMOR = {
    none: [
      "This one’s sunny already — looking great, friend!",
      "Smooth sailing here, nothing to tweak.",
      "Loving the vibe — let’s send it!"
    ],
    low: [
      "Wohoo, careful with those words — let’s make ’em sparkle.",
      "A bit sharp around the edges — I can help soften it up.",
      "Easy there, friend — a little sugar will do wonders."
    ],
    medium: [
      "Hold up! This might ruffle some feathers — let’s keep it cool.",
      "Whoa, this has some bite — want me to tame it?",
      "Yikes! Breezy rewrite coming right up."
    ],
    high: [
      "Careful — this could land harshly. I’ve got a kinder rewrite for you.",
      "Let’s take a breath — I’ll help you say this in a way that lands well.",
      "This is pretty spicy — here’s a warmer version with the same point."
    ]
  };

  function injectGlobalStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes lago-flap {
        0% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-2px) rotate(-2deg); }
        100% { transform: translateY(0) rotate(0deg); }
      }
      .${WRAP_CLASS} { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
      .${BTN_CLASS} {
        font: 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 999px;
        background: linear-gradient(90deg, #f43f5e, #f59e0b, #3b82f6);
        color: #fff; cursor: pointer; width: fit-content;
        box-shadow: 0 6px 18px rgba(0,0,0,0.08);
      }
      .${BTN_CLASS}:hover { filter: brightness(1.05); transform: translateY(-1px); }
      .${PANEL_CLASS} {
        border: 1px solid #e5e7eb; border-radius: 14px; padding: 10px; background: #fff;
        max-width: 600px; box-shadow: 0 10px 24px rgba(0,0,0,0.10);
        font: 13px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        position: relative;
      }
      .lago-header { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
      .lago-avatar { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #f59e0b, #f43f5e 60%, #3b82f6); animation: lago-flap 2s ease-in-out infinite; }
      .lago-title { font-weight: 700; }
      .lago-muted { color:#6b7280; font-size:12px; }
      .lago-badge { display:inline-block; padding:3px 8px; border-radius:999px; font-size:11px; margin-top:4px; }
      .lago-good { background:#e7f8ec; color:#116d3e; }
      .lago-bad { background:#fff2f0; color:#a12819; }
      .lago-reaction { margin: 6px 0; color:#334155; }
      .lago-row { display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
      .lago-controls { display:flex; gap:8px; align-items:center; flex-wrap: wrap; margin: 6px 0; }
      .lago-panel textarea, .lago-panel input[type="text"], .lago-panel select {
        border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; width: 100%;
      }
      .lago-actions { display:flex; gap:8px; margin-top: 8px; flex-wrap: wrap; }
      .lago-btn { padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 10px; background:#f9fafb; cursor:pointer; }
      .lago-btn.primary { background:#111; color:#fff; }
      .lago-hidden { display:none; }
      .lago-welcome { padding:8px; border-radius:10px; background:#fff7ed; color:#7c2d12; border:1px solid #fed7aa; }
    `;
    document.documentElement.appendChild(style);
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    const t = el.tagName?.toLowerCase();
    if (t === "textarea") return true;
    if (t === "input" && (el.type === "text" || el.type === "search")) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function getText(el) {
    if (!el) return "";
    const t = el.tagName?.toLowerCase();
    if (t === "textarea" || (t === "input" && (el.type === "text" || el.type === "search"))) return el.value || "";
    if (el.isContentEditable) return el.innerText || el.textContent || "";
    return "";
  }
  function setText(el, text) {
    if (!el) return;
    const t = el.tagName?.toLowerCase();
    if (t === "textarea" || (t === "input" && (el.type === "text" || el.type === "search"))) {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.isContentEditable) {
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
  }

  function collectContext(input) {
    const ctx = { site: location.hostname, url: location.href };
    // climb up a few levels to find a likely post container
    let node = input;
    for (let i=0; i<8 && node && node.parentElement; i++) {
      node = node.parentElement;
      if (!node) break;
      const role = node.getAttribute?.("role");
      const hasPostMarkers =
        role === "article" ||
        node.dataset?.testid?.includes?.("post") ||
        (node.className && /post|comment|status|tweet/i.test(String(node.className)));
      if (hasPostMarkers) { ctx.postHTML = node.innerText?.slice(0, 2000) || ""; break; }
    }
    // Nearby comments
    const comments = [];
    const commentNodes = document.querySelectorAll('[data-testid*="comment"], [aria-label*="Comment"], .comment, .comments');
    for (const c of Array.from(commentNodes).slice(0, 6)) {
      const txt = c.innerText?.trim();
      if (txt) comments.push(txt.slice(0, 400));
      if (comments.length >= 6) break;
    }
    ctx.nearbyComments = comments;
    // Images (alt + src)
    const imgs = [];
    const scope = node && node.querySelectorAll ? node : document;
    for (const im of Array.from(scope.querySelectorAll("img")).slice(0, 3)) {
      const alt = (im.getAttribute("alt") || "").slice(0, 300);
      const src = im.currentSrc || im.src || "";
      imgs.push({ alt, src });
    }
    ctx.images = imgs;
    // Author if detectable
    const author = document.querySelector('[data-testid*="author"], [aria-label*="author"], a[rel*="author"]');
    ctx.author = author?.innerText?.slice(0, 120) || null;

    return ctx;
  }

  function randomLine(list) { return list[Math.floor(Math.random() * list.length)]; }

  function buildPanel() {
    const panel = document.createElement("div");
    panel.className = PANEL_CLASS;
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="lago-header">
        <div class="lago-avatar" title="Friendly Lago"></div>
        <div>
          <div class="lago-title">Friendly Lago</div>
          <div class="lago-muted" id="lago-sub">Lago’s here to help your words shine bright, friend!</div>
        </div>
      </div>

      <div class="lago-welcome lago-hidden" id="lago-welcome">
        🦜 Squawk! Lago’s here to help you sound sunny and smart, friend!
      </div>

      <div class="lago-reaction" id="lago-reaction"></div>
      <div>
        <span class="lago-badge lago-good" id="lago-badge">Ready</span>
      </div>

      <div class="lago-controls">
        <label class="lago-muted">Tone</label>
        <select id="lago-tone">
          <option value="match-writer">Match my tone</option>
          <option value="supportive">Supportive</option>
          <option value="polite">Polite</option>
          <option value="professional">Professional</option>
          <option value="firm-but-kind">Firm but kind</option>
          <option value="concise">Concise</option>
        </select>
        <label class="lago-muted">Length</label>
        <select id="lago-length">
          <option value="one-liner">One-liner</option>
          <option value="short">Short (<=40 words)</option>
          <option value="medium">Medium (<=80 words)</option>
        </select>
        <label class="lago-muted"><input type="checkbox" id="lago-keep-slang"/> Keep my slang</label>
      </div>

      <div class="lago-row">
        <input id="lago-instruction" type="text" placeholder="Tell Lago how to phrase it (e.g., 'more supportive', 'ask a clarifying question', 'mention the deadline')." />
      </div>

      <div class="lago-row lago-hidden" id="lago-clarify-row">
        <input id="lago-clarify-answer" type="text" placeholder="Answer Lago’s question here..." />
      </div>

      <textarea id="lago-suggestion" placeholder="Suggestion will appear here..." readonly></textarea>

      <div class="lago-actions">
        <button type="button" id="lago-analyze" class="lago-btn">Check with Friendly Lago</button>
        <button type="button" id="lago-rewrite" class="lago-btn">Rewrite</button>
        <button type="button" id="lago-apply" class="lago-btn primary">Apply</button>
        <button type="button" id="lago-close" class="lago-btn">Dismiss</button>
      </div>
    `;
    return panel;
  }

  function attachToInput(input) {
    if (!input || input.getAttribute(DATA_KEY) === "1") return;
    input.setAttribute(DATA_KEY, "1");

    const wrap = document.createElement("div");
    wrap.className = WRAP_CLASS;
    input.insertAdjacentElement("afterend", wrap);

    const button = document.createElement("button");
    button.className = BTN_CLASS;
    button.type = "button";
    button.textContent = "Check with Friendly Lago";
    wrap.appendChild(button);

    const panel = buildPanel();
    wrap.appendChild(panel);

    const badge = panel.querySelector("#lago-badge");
    const reaction = panel.querySelector("#lago-reaction");
    const welcome = panel.querySelector("#lago-welcome");
    const toneSel = panel.querySelector("#lago-tone");
    const lenSel = panel.querySelector("#lago-length");
    const keepSlang = panel.querySelector("#lago-keep-slang");
    const suggestion = panel.querySelector("#lago-suggestion");
    const analyzeBtn = panel.querySelector("#lago-analyze");
    const rewriteBtn = panel.querySelector("#lago-rewrite");
    const applyBtn = panel.querySelector("#lago-apply");
    const closeBtn = panel.querySelector("#lago-close");
    const instruction = panel.querySelector("#lago-instruction");
    const clarifyRow = panel.querySelector("#lago-clarify-row");
    const clarifyAnswer = panel.querySelector("#lago-clarify-answer");

    // Show welcome once
    chrome.storage.sync.get({ lago_welcomed: false }, (v) => {
      if (!v.lago_welcomed) {
        welcome.classList.remove("lago-hidden");
        chrome.storage.sync.set({ lago_welcomed: true });
      }
    });

    async function doAnalyze(kind="first") {
      const text = getText(input).trim();
      if (!text) {
        reaction.textContent = "Type a comment first.";
        panel.style.display = "block";
        return;
      }
      const ctx = collectContext(input);
      const prefs = {
        tone: toneSel.value,
        length: lenSel.value,
        keepSlang: keepSlang.checked,
        strictness: await getStrictness()
      };
      const payload = {
        type: "ANALYZE_WITH_CONTEXT",
        text, context: ctx, prefs,
        userStyle: {},
        instruction: instruction.value.trim() || "",
        clarifyingAnswer: clarifyAnswer.value.trim() || ""
      };
      const res = await chrome.runtime.sendMessage(payload);
      panel.style.display = "block";

      if (!res?.ok) {
        badge.textContent = "Error";
        badge.className = "lago-badge lago-bad";
        reaction.textContent = "Hmm, I couldn’t reach the nest. Try again.";
        return;
      }
      const r = res.data || {};
      const sev = (r.classification?.severity || "none").toLowerCase();
      const isOff = !!r.classification?.is_offensive;

      badge.textContent = isOff ? "Needs friendlier tone" : "Looks friendly";
      badge.className = "lago-badge " + (isOff ? "lago-bad" : "lago-good");
      reaction.textContent = (HUMOR[sev] && HUMOR[sev].length) ? randomLine(HUMOR[sev]) : "Let’s make this land with a smile.";

      suggestion.value = r.final_suggestion || (r.suggestions?.[0]?.text || "");

      // Clarifying question flow
      if (r.needs_clarification && r.clarifying_question) {
        clarifyRow.classList.remove("lago-hidden");
        clarifyAnswer.placeholder = r.clarifying_question;
      } else {
        clarifyRow.classList.add("lago-hidden");
      }
    }

    function guardSubmit(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        // Soft guard: analyze first if strictness high/medium
        getStrictness().then((s) => {
          if (s === "low") return; // skip guard
          e.preventDefault();
          doAnalyze("guard");
        });
      }
    }

    button.addEventListener("click", () => { panel.style.display = "block"; doAnalyze("first"); });
    analyzeBtn.addEventListener("click", () => doAnalyze("first"));
    rewriteBtn.addEventListener("click", () => doAnalyze("rewrite"));
    applyBtn.addEventListener("click", () => setText(input, suggestion.value));
    closeBtn.addEventListener("click", () => (panel.style.display = "none"));
    input.addEventListener("keydown", guardSubmit);
  }

  function scanAll() {
    const nodes = document.querySelectorAll("textarea, input[type='text'], input[type='search'], [contenteditable=''], [contenteditable='true']");
    nodes.forEach(n => attachToInput(n));
  }

  function startObserver() {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        (m.addedNodes || []).forEach(node => {
          if (isEditable(node)) attachToInput(node);
          if (node.querySelectorAll) {
            node.querySelectorAll("textarea, input[type='text'], input[type='search'], [contenteditable=''], [contenteditable='true']").forEach(n => {
              attachToInput(n);
            });
          }
        });
      }
    });
    mo.observe(document.documentElement, { subtree: true, childList: true });
  }

  function getStrictness() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ lago_strictness: "medium" }, (v) => resolve(v.lago_strictness));
    });
  }

  // init
  injectGlobalStyles();
  scanAll();
  startObserver();
  console.debug("[Friendly Lago] content ready on", location.hostname);
})();