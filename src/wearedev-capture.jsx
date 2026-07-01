import React, { useState, useRef, useEffect } from "react";
import qrCode from "./assets/qr-code.png";

// ─────────────────────────────────────────────
// PERSONALIZE THIS — the only block you need to edit
// ─────────────────────────────────────────────
const USER_CONFIG = {
  name: "Athar",
  brand: "Atharux",
  role: "Developer Advocate & UX Engineer",
  event: "WeAreDevelopers World Congress",
  eventLocation: "Berlin",
  eventYear: "2026",
  website: "atharux.com",
  hiringUrl: "hire.atharux.com",
  githubRepo: "https://github.com/atharux/conf-capture",
  appUrl: "https://conf-capture.pages.dev/",
  writingStyle: `direct, specific, no fluff, problem-reasoning-outcome narrative structure.
No cringe opener lines. No "Excited to share". No bullet-point lists.
No em-dashes. No hashtag spam — max 3 hashtags if any.
150–220 words. Punchy and human. Sharp practitioner tone, not content marketer.`,
};
// ─────────────────────────────────────────────

// ── Design tokens ──────────────────────────────────────────────
const COLORS = {
  bg: "#0a0a0a",
  card: "#111111",
  cardBorder: "#222222",
  textPrimary: "#f5f5f5",
  textMuted: "#888888",
  purple: "#8b5cf6",
  teal: "#06b6d4",
  orange: "#f97316",
  red: "#ef4444",
};
const FONT_MONO = "'Space Mono', monospace";
const FONT_DISPLAY = "'Syne', sans-serif";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1000;
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// Anthropic has full multimodal support (image + audio) on one key.
// OpenRouter's free tier covers text + card scanning only — no free model
// reliably handles raw audio, so voice notes stay Anthropic-only.
const PROVIDER_INFO = {
  anthropic: {
    label: "Anthropic",
    keyPlaceholder: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com",
    capabilities: [
      { ok: true, text: "Card scanning" },
      { ok: true, text: "Voice notes" },
      { ok: true, text: "Post generation" },
    ],
  },
  openrouter: {
    label: "OpenRouter (Free)",
    keyPlaceholder: "sk-or-...",
    getKeyUrl: "https://openrouter.ai/keys",
    capabilities: [
      { ok: true, text: "Card scanning" },
      { ok: false, text: "Voice notes — type your notes instead" },
      { ok: true, text: "Post generation" },
    ],
  },
};

// ── Prompts ─────────────────────────────────────────────────────
const CARD_PARSE_SYSTEM_PROMPT =
  "You are a business card parser. Extract the following fields from the business card image. Return ONLY a JSON object with no preamble, no markdown, no backticks. Fields: name (string), title (string), company (string), email (string), linkedin (string, if visible), phone (string, if visible). If a field is not visible, return an empty string for that field.";

const SESSION_PARSE_PROMPT =
  'The user has recorded a voice note about a conference session they just attended. Extract and return ONLY a JSON object with no preamble, no markdown, no backticks. Fields: sessionTitle (string), speaker (string), day (string — one of: "Wed", "Thu", "Fri", or empty string), timeSlot (string), keyInsight (string — the most useful thing they mentioned), quoteStat (string — any quote or statistic mentioned), actionItem (string — anything they said they\'d do next), rating (number 1-5, infer from sentiment if not stated explicitly, default 3).';

const CONTACT_VOICE_PARSE_PROMPT =
  'The user has recorded a voice note about someone they just met at a conference. Extract and return ONLY a JSON object with no preamble, no markdown, no backticks. Fields: additionalNotes (string — any new context about this person), followUp (string — any follow-up action mentioned), connectionStrength (string — one of: "strong", "medium", "light", infer from tone).';

const POST_IDEA_PROMPT =
  'The user has recorded a rough idea for a LinkedIn post. Extract and return ONLY a JSON object with no preamble, no markdown, no backticks. Fields: rawIdea (string — their core point or observation, cleaned up but not polished), suggestedPostType (string — one of: "Met someone interesting", "Workshop takeaway", "Hot take / observation", "Day recap").';

function buildPostGenerationPrompt(contextJSON, postType) {
  return `You are writing a LinkedIn post for ${USER_CONFIG.name}, a ${USER_CONFIG.role} currently at ${USER_CONFIG.event} in ${USER_CONFIG.eventLocation} (${USER_CONFIG.eventYear}). Their brand is ${USER_CONFIG.brand}. Writing style: ${USER_CONFIG.writingStyle}. Write in first person. Return only the post text. No preamble. No explanation.

Context: ${contextJSON}
Post type: ${postType}`;
}

const TABS = [
  { key: "scan", label: "Scan", icon: "📷" },
  { key: "sessions", label: "Sessions", icon: "📝" },
  { key: "contacts", label: "Contacts", icon: "👤" },
  { key: "posts", label: "Posts", icon: "⚡" },
  { key: "about", label: "About", icon: "ℹ️" },
];

const POST_TYPES = ["Met someone interesting", "Workshop takeaway", "Hot take / observation", "Day recap"];

// ── Shared style helpers ───────────────────────────────────────
const headerTextStyle = { color: COLORS.purple, fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 800, marginTop: 4 };
const smallLabelStyle = { color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 };
const selectStyle = {
  width: "100%",
  marginTop: 8,
  backgroundColor: COLORS.card,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 4,
  color: COLORS.textPrimary,
  fontFamily: FONT_MONO,
  fontSize: 13,
  padding: "10px 12px",
  boxSizing: "border-box",
};

function primaryButtonStyle(bgColor) {
  return {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 4,
    border: "none",
    backgroundColor: bgColor,
    color: "#0a0a0a",
    fontFamily: FONT_MONO,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };
}

const secondaryButtonStyle = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 4,
  border: `1px solid ${COLORS.cardBorder}`,
  backgroundColor: "transparent",
  color: COLORS.textPrimary,
  fontFamily: FONT_MONO,
  fontSize: 13,
  cursor: "pointer",
};

// ── API helpers ─────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      resolve(String(result).split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callAnthropic(apiKey, body) {
  if (!apiKey) throw new Error("No API key set.");
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error("Check your connection and try again.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const errJson = await response.json();
      detail = (errJson && errJson.error && errJson.error.message) || "";
    } catch (e) {
      // no-op — fall through to generic status message
    }
    throw new Error(detail || `API error (${response.status})`);
  }
  return response.json();
}

function extractResponseText(result) {
  const block = (result && result.content && result.content.find((c) => c.type === "text")) || null;
  return block ? block.text : "";
}

// Works for both Anthropic (input_tokens/output_tokens) and OpenAI-style
// (prompt_tokens/completion_tokens) response shapes.
function extractMeta(result) {
  const usage = result && result.usage;
  return {
    model: (result && result.model) || "",
    inputTokens: usage ? (usage.input_tokens != null ? usage.input_tokens : usage.prompt_tokens) : null,
    outputTokens: usage ? (usage.output_tokens != null ? usage.output_tokens : usage.completion_tokens) : null,
  };
}

// Live-fetches OpenRouter's current free models rather than hardcoding IDs —
// free models get deprecated/renamed often, hardcoded IDs go stale.
async function fetchFreeOpenRouterModels() {
  try {
    const response = await fetch(OPENROUTER_MODELS_URL);
    if (!response.ok) return { text: [], vision: [] };
    const data = await response.json();
    const all = (data && data.data) || [];
    const free = all.filter((m) => m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0");
    const hasModality = (m, mod) => m.architecture && Array.isArray(m.architecture.input_modalities) && m.architecture.input_modalities.includes(mod);
    const vision = free.filter((m) => hasModality(m, "image")).map((m) => m.id).slice(0, 6);
    const text = free.filter((m) => hasModality(m, "text") && !hasModality(m, "image")).map((m) => m.id).slice(0, 6);
    return { text, vision };
  } catch (err) {
    return { text: [], vision: [] };
  }
}

// Tries each free model in order and moves to the next on failure, so a single
// deprecated/rate-limited model never surfaces as a user-facing error.
async function callOpenRouterWithFallback(apiKey, modelList, { systemPrompt, userContent }) {
  if (!apiKey) throw new Error("No API key set.");
  if (!modelList || modelList.length === 0) {
    throw new Error("No free models available right now. Try again shortly.");
  }
  for (const modelId of modelList) {
    let response;
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userContent });
      response = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
          "X-Title": USER_CONFIG.brand,
        },
        body: JSON.stringify({ model: modelId, max_tokens: MAX_TOKENS, messages }),
      });
    } catch (networkErr) {
      continue; // transient network hiccup — try the next model
    }
    // A bad key fails identically on every model — no point burning through
    // the whole list before telling the user what's actually wrong.
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid OpenRouter API key — check it and try again.");
    }
    if (!response.ok) continue;
    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      continue;
    }
    const text = result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
    if (!text) continue;
    return { text, meta: extractMeta(result) };
  }
  throw new Error("All free models are unavailable right now — try again shortly, or switch to an Anthropic key.");
}

async function generateFromImage({ provider, apiKey, openrouterModels, systemPrompt, imageBase64, mediaType }) {
  if (provider === "openrouter") {
    let models = openrouterModels && openrouterModels.vision;
    if (!models || models.length === 0) models = (await fetchFreeOpenRouterModels()).vision;
    const userContent = [
      { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
      { type: "text", text: "Extract the fields now." },
    ];
    return callOpenRouterWithFallback(apiKey, models, { systemPrompt, userContent });
  }
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } }] }],
  };
  const result = await callAnthropic(apiKey, body);
  return { text: extractResponseText(result), meta: extractMeta(result) };
}

async function generateFromText({ provider, apiKey, openrouterModels, systemPrompt, userText }) {
  if (provider === "openrouter") {
    let models = openrouterModels && openrouterModels.text;
    if (!models || models.length === 0) models = (await fetchFreeOpenRouterModels()).text;
    return callOpenRouterWithFallback(apiKey, models, { systemPrompt, userContent: userText });
  }
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userText }],
  };
  const result = await callAnthropic(apiKey, body);
  return { text: extractResponseText(result), meta: extractMeta(result) };
}

function tryParseJSON(text) {
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    return { ok: true, data: JSON.parse(cleaned) };
  } catch (e) {
    return { ok: false, raw: text };
  }
}

function injectGlobalAssets() {
  if (!document.getElementById("wearedev-fonts")) {
    const fontLink = document.createElement("link");
    fontLink.id = "wearedev-fonts";
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap";
    document.head.appendChild(fontLink);
  }
  if (!document.getElementById("wearedev-tailwind")) {
    const script = document.createElement("script");
    script.id = "wearedev-tailwind";
    script.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(script);
  }
  if (!document.getElementById("wearedev-keyframes")) {
    const style = document.createElement("style");
    style.id = "wearedev-keyframes";
    style.textContent = `
      @keyframes mic-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.03); }
      }
      body { margin: 0; background: ${COLORS.bg}; }
    `;
    document.head.appendChild(style);
  }
}

// ── Small shared inputs ────────────────────────────────────────
function LabeledInput({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <div style={smallLabelStyle}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 4,
          color: COLORS.textPrimary,
          fontFamily: FONT_MONO,
          fontSize: 14,
          padding: "10px 12px",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, rows = 3 }) {
  return (
    <div>
      <div style={smallLabelStyle}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        style={{
          width: "100%",
          backgroundColor: COLORS.card,
          border: `1px solid ${COLORS.cardBorder}`,
          borderRadius: 4,
          color: COLORS.textPrimary,
          fontFamily: FONT_MONO,
          fontSize: 14,
          padding: "10px 12px",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 10, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: COLORS.textPrimary, fontFamily: FONT_MONO, fontSize: 13 }}>{value}</div>
    </div>
  );
}

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: n <= value ? COLORS.purple : COLORS.cardBorder, padding: 0 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: COLORS.cardBorder, margin: "16px 0" }} />;
}

function ModelMeta({ meta }) {
  if (!meta || !meta.model) return null;
  const shortModel = meta.model.split("/").pop();
  const hasTokens = meta.inputTokens != null && meta.outputTokens != null;
  return (
    <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 10, marginTop: 6 }}>
      via {shortModel}
      {hasTokens ? ` · ${meta.inputTokens}→${meta.outputTokens} tok` : ""}
    </div>
  );
}

// ── MicCapture — shared across Sessions, Contacts, Posts ───────
// Anthropic-only: no free OpenRouter model reliably handles raw audio, and we'd
// rather not offer a feature likely to fail than offer it with a shaky fallback.
function MicCapture({ apiKey, provider, label, parsePrompt, onTranscript }) {
  const [status, setStatus] = useState("idle"); // idle | recording | transcribing | denied | error | done
  const [rawText, setRawText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Release the mic if the component unmounts mid-recording (tab switch, form
  // close, switching which contact's voice note is open) — otherwise the
  // stream stays open and the browser's recording indicator never clears.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          // no-op — recorder already stopped
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  if (provider === "openrouter") {
    return (
      <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13 }}>
        Voice notes need an Anthropic key — type your note below.
      </div>
    );
  }

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleStop = async (mimeType) => {
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const base64Data = await blobToBase64(blob);
      const body = {
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: mimeType, data: base64Data },
              },
              { type: "text", text: parsePrompt },
            ],
          },
        ],
      };
      const result = await callAnthropic(apiKey, body);
      const text = extractResponseText(result);
      const parsed = tryParseJSON(text);
      if (parsed.ok) {
        onTranscript(parsed.data);
        setRawText("");
      } else {
        setRawText(parsed.raw);
      }
      setMeta(extractMeta(result));
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong while transcribing.");
      setStatus("error");
    }
  };

  const startRecording = async () => {
    setErrorMsg("");
    setRawText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const cleanMime = ((recorder.mimeType || "audio/webm").split(";")[0]) || "audio/webm";
        handleStop(cleanMime);
      };
      recorder.start();
      setStatus("recording");
    } catch (err) {
      setStatus("denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      cleanupStream();
      setStatus("transcribing");
    }
  };

  const handleClick = () => {
    if (status === "recording") stopRecording();
    else startRecording();
  };

  const reset = () => {
    setStatus("idle");
    setRawText("");
    setErrorMsg("");
    setMeta(null);
  };

  if (status === "denied") {
    return <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13 }}>Mic unavailable — fill in manually.</div>;
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={handleClick}
        disabled={status === "transcribing"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderRadius: 4,
          fontFamily: FONT_MONO,
          fontSize: 13,
          cursor: status === "transcribing" ? "default" : "pointer",
          backgroundColor: status === "recording" ? COLORS.red : COLORS.card,
          color: COLORS.textPrimary,
          border: `1px solid ${status === "recording" ? COLORS.red : COLORS.cardBorder}`,
          animation: status === "recording" ? "mic-pulse 1.2s infinite" : "none",
          width: "100%",
          justifyContent: "center",
        }}
      >
        <span>{status === "recording" ? "●" : "🎙"}</span>
        <span>
          {status === "recording" ? "Recording... tap to stop" : status === "transcribing" ? "Transcribing..." : label}
        </span>
      </button>

      {errorMsg && <div style={{ color: COLORS.red, fontFamily: FONT_MONO, fontSize: 12, marginTop: 6 }}>{errorMsg}</div>}

      {rawText && (
        <div style={{ marginTop: 8, padding: 10, backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 4 }}>
          <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 11, marginBottom: 4 }}>
            Couldn't parse structured data — raw transcript:
          </div>
          <div style={{ color: COLORS.textPrimary, fontFamily: FONT_MONO, fontSize: 13, whiteSpace: "pre-wrap" }}>{rawText}</div>
        </div>
      )}

      {status === "done" && (
        <>
          <ModelMeta meta={meta} />
          <button
            onClick={reset}
            style={{ background: "none", border: "none", color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 12, marginTop: 6, cursor: "pointer", padding: 0 }}
          >
            Re-record
          </button>
        </>
      )}
    </div>
  );
}

// ── TAB 1 — Scan ─────────────────────────────────────────────
function ScanTab({ apiKey, provider, openrouterModels, onSaveContact }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false); // guards against a second capture/upload racing an in-flight scan
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | parsing | error
  const [errorMsg, setErrorMsg] = useState("");
  const [rawText, setRawText] = useState("");
  const [meta, setMeta] = useState(null);
  const [saveError, setSaveError] = useState("");
  const emptyForm = { name: "", title: "", company: "", email: "", linkedin: "", phone: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraError(false);
    } catch (err) {
      setCameraError(true);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const updateField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const processImage = async (blob) => {
    if (busyRef.current) return; // ignore a second capture/upload while one is still in flight
    busyRef.current = true;
    setThumbnail(URL.createObjectURL(blob));
    setStatus("parsing");
    setErrorMsg("");
    setRawText("");
    try {
      const base64Data = await blobToBase64(blob);
      const { text, meta: responseMeta } = await generateFromImage({
        provider,
        apiKey,
        openrouterModels,
        systemPrompt: CARD_PARSE_SYSTEM_PROMPT,
        imageBase64: base64Data,
        mediaType: blob.type || "image/jpeg",
      });
      setMeta(responseMeta);
      const parsed = tryParseJSON(text);
      if (parsed.ok) {
        setForm({
          name: parsed.data.name || "",
          title: parsed.data.title || "",
          company: parsed.data.company || "",
          email: parsed.data.email || "",
          linkedin: parsed.data.linkedin || "",
          phone: parsed.data.phone || "",
          notes: "",
        });
      } else {
        setRawText(parsed.raw);
        setForm(emptyForm);
      }
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
      setStatus("error");
    } finally {
      busyRef.current = false;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file && !busyRef.current) processImage(file);
    e.target.value = "";
  };

  const captureFrame = () => {
    if (busyRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) processImage(blob);
    }, "image/jpeg", 0.9);
  };

  const resetScan = () => {
    setThumbnail(null);
    setForm(emptyForm);
    setRawText("");
    setErrorMsg("");
    setSaveError("");
    setMeta(null);
    setStatus("idle");
  };

  const saveContact = () => {
    if (!form.name.trim() && !form.email.trim()) {
      setSaveError("Add at least a name or email before saving.");
      return;
    }
    setSaveError("");
    onSaveContact({ ...form, id: Date.now() });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    resetScan();
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={headerTextStyle}>SCAN CARD</h1>

      {!thumbnail && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 4",
            backgroundColor: COLORS.card,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 4,
            overflow: "hidden",
            marginTop: 16,
          }}
        >
          {cameraActive && !cameraError ? (
            <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: COLORS.textMuted,
                fontFamily: FONT_MONO,
                fontSize: 13,
                padding: 16,
                textAlign: "center",
              }}
            >
              Camera unavailable
            </div>
          )}
          {cameraActive && !cameraError && (
            <button
              onClick={captureFrame}
              aria-label="Capture"
              style={{
                position: "absolute",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: COLORS.purple,
                border: "none",
                cursor: "pointer",
              }}
            />
          )}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          style={{ background: "none", border: "none", color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          Upload photo instead
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
      </div>

      {thumbnail && (
        <div style={{ marginTop: 16 }}>
          <img src={thumbnail} alt="Captured card" style={{ width: "100%", borderRadius: 4, border: `1px solid ${COLORS.cardBorder}` }} />
          {status === "parsing" && <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13, marginTop: 8 }}>Parsing card...</div>}
          {status !== "parsing" && <ModelMeta meta={meta} />}
        </div>
      )}

      {errorMsg && <div style={{ color: COLORS.red, fontFamily: FONT_MONO, fontSize: 13, marginTop: 8 }}>{errorMsg}</div>}

      {rawText && (
        <div style={{ marginTop: 12, padding: 10, backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 4 }}>
          <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 11, marginBottom: 4 }}>Couldn't parse card — raw response:</div>
          <div style={{ color: COLORS.textPrimary, fontFamily: FONT_MONO, fontSize: 12, whiteSpace: "pre-wrap" }}>{rawText}</div>
        </div>
      )}

      {thumbnail && status !== "parsing" && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <LabeledInput label="Name" value={form.name} onChange={(v) => updateField("name", v)} />
          <LabeledInput label="Title" value={form.title} onChange={(v) => updateField("title", v)} />
          <LabeledInput label="Company" value={form.company} onChange={(v) => updateField("company", v)} />
          <LabeledInput label="Email" value={form.email} onChange={(v) => updateField("email", v)} />
          <LabeledInput label="LinkedIn" value={form.linkedin} onChange={(v) => updateField("linkedin", v)} />
          <LabeledInput label="Phone" value={form.phone} onChange={(v) => updateField("phone", v)} />
          <LabeledTextarea label="Notes" value={form.notes} onChange={(v) => updateField("notes", v)} />

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={saveContact} style={primaryButtonStyle(COLORS.teal)}>Save Contact</button>
            <button onClick={resetScan} style={secondaryButtonStyle}>Scan Another</button>
          </div>
          {saveError && <div style={{ color: COLORS.red, fontFamily: FONT_MONO, fontSize: 12 }}>{saveError}</div>}
          {savedFlash && <div style={{ color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 12 }}>Saved.</div>}
        </div>
      )}
    </div>
  );
}

// ── TAB 2 — Sessions ─────────────────────────────────────────
function SessionCard({ session, expanded, onToggle }) {
  return (
    <div onClick={onToggle} style={{ padding: 14, backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 4, cursor: "pointer" }}>
      <div style={{ color: COLORS.textPrimary, fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700 }}>{session.sessionTitle || "Untitled session"}</div>
      <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12, marginTop: 2 }}>
        {[session.speaker, session.day, session.timeSlot].filter(Boolean).join(" · ")}
      </div>
      <div style={{ marginTop: 4, fontSize: 13 }}>
        <span style={{ color: COLORS.purple }}>{"★".repeat(session.rating || 0)}</span>
        <span style={{ color: COLORS.cardBorder }}>{"★".repeat(5 - (session.rating || 0))}</span>
      </div>
      {!expanded && session.keyInsight && (
        <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.keyInsight}
        </div>
      )}
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {session.keyInsight && <DetailRow label="Key insight" value={session.keyInsight} />}
          {session.quoteStat && <DetailRow label="Quote / stat" value={session.quoteStat} />}
          {session.actionItem && <DetailRow label="Action item" value={session.actionItem} />}
        </div>
      )}
    </div>
  );
}

function SessionsTab({ apiKey, provider, sessions, onSaveSession }) {
  const [formOpen, setFormOpen] = useState(false);
  const emptyForm = { sessionTitle: "", speaker: "", day: "", timeSlot: "", keyInsight: "", quoteStat: "", actionItem: "", rating: 3 };
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);
  const [formError, setFormError] = useState("");

  const updateField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleTranscript = (data) => {
    setForm((prev) => ({
      sessionTitle: data.sessionTitle || prev.sessionTitle,
      speaker: data.speaker || prev.speaker,
      day: data.day || prev.day,
      timeSlot: data.timeSlot || prev.timeSlot,
      keyInsight: data.keyInsight || prev.keyInsight,
      quoteStat: data.quoteStat || prev.quoteStat,
      actionItem: data.actionItem || prev.actionItem,
      rating: data.rating || prev.rating || 3,
    }));
  };

  const saveSession = () => {
    if (!form.sessionTitle.trim()) {
      setFormError("Session title is required.");
      return;
    }
    setFormError("");
    onSaveSession({ ...form, id: Date.now() });
    setForm(emptyForm);
    setFormOpen(false);
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={headerTextStyle}>SESSIONS</h1>
        <button
          onClick={() => {
            setFormOpen((v) => !v);
            setFormError("");
          }}
          style={{ ...primaryButtonStyle(COLORS.orange), flex: "none", padding: "8px 14px" }}
        >
          {formOpen ? "Close" : "Log Session"}
        </button>
      </div>

      {formOpen && (
        <div style={{ marginTop: 16, padding: 14, backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 4, display: "flex", flexDirection: "column", gap: 12 }}>
          <MicCapture apiKey={apiKey} provider={provider} label="Record Session Note" parsePrompt={SESSION_PARSE_PROMPT} onTranscript={handleTranscript} />

          <LabeledInput label="Session title" value={form.sessionTitle} onChange={(v) => updateField("sessionTitle", v)} />
          <LabeledInput label="Speaker" value={form.speaker} onChange={(v) => updateField("speaker", v)} />

          <div>
            <div style={smallLabelStyle}>Day</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Wed", "Thu", "Fri"].map((d) => (
                <button
                  key={d}
                  onClick={() => updateField("day", d)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 4,
                    border: `1px solid ${form.day === d ? COLORS.purple : COLORS.cardBorder}`,
                    backgroundColor: form.day === d ? COLORS.purple : "transparent",
                    color: form.day === d ? "#0a0a0a" : COLORS.textPrimary,
                    fontFamily: FONT_MONO,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <LabeledInput label="Time slot" value={form.timeSlot} onChange={(v) => updateField("timeSlot", v)} />
          <LabeledTextarea label="Key insight" value={form.keyInsight} onChange={(v) => updateField("keyInsight", v)} />
          <LabeledTextarea label="Quote or stat" value={form.quoteStat} onChange={(v) => updateField("quoteStat", v)} />
          <LabeledTextarea label="Action item" value={form.actionItem} onChange={(v) => updateField("actionItem", v)} />

          <div>
            <div style={smallLabelStyle}>Rating</div>
            <StarRating value={form.rating} onChange={(v) => updateField("rating", v)} />
          </div>

          {formError && <div style={{ color: COLORS.red, fontFamily: FONT_MONO, fontSize: 12 }}>{formError}</div>}
          <button onClick={saveSession} style={primaryButtonStyle(COLORS.teal)}>Save Session</button>
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {sessions.slice().reverse().map((s) => (
          <SessionCard key={s.id} session={s} expanded={expandedId === s.id} onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)} />
        ))}
        {sessions.length === 0 && <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13 }}>No sessions logged yet.</div>}
      </div>
    </div>
  );
}

// ── TAB 3 — Contacts ─────────────────────────────────────────
function ContactsTab({ apiKey, provider, contacts, onUpdateContact, onGeneratePost }) {
  const [expandedId, setExpandedId] = useState(null);
  const [voiceOpenId, setVoiceOpenId] = useState(null);

  const handleVoiceTranscript = (contact, data) => {
    const updated = {
      ...contact,
      notes: [contact.notes, data.additionalNotes].filter(Boolean).join("\n"),
      followUp: [contact.followUp, data.followUp].filter(Boolean).join("\n"),
      connectionStrength: data.connectionStrength || contact.connectionStrength,
    };
    onUpdateContact(updated);
    setVoiceOpenId(null);
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={headerTextStyle}>CONTACTS</h1>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {contacts.slice().reverse().map((c) => (
          <div key={c.id} style={{ padding: 14, backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 4 }}>
            <div onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} style={{ cursor: "pointer" }}>
              <div style={{ color: COLORS.textPrimary, fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700 }}>{c.name || "Unnamed"}</div>
              <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12, marginTop: 2 }}>{[c.title, c.company].filter(Boolean).join(" · ")}</div>
              {c.email && <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>{c.email}</div>}
              {expandedId !== c.id && c.notes && (
                <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.notes}
                </div>
              )}
            </div>

            {expandedId === c.id && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {c.linkedin && <DetailRow label="LinkedIn" value={c.linkedin} />}
                {c.phone && <DetailRow label="Phone" value={c.phone} />}
                {c.notes && <DetailRow label="Notes" value={c.notes} />}
                {c.followUp && <DetailRow label="Follow up" value={c.followUp} />}
                {c.connectionStrength && <DetailRow label="Connection" value={c.connectionStrength} />}

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={() => onGeneratePost(c)} style={{ ...primaryButtonStyle(COLORS.orange), padding: "8px 14px", flex: "none" }}>
                    Generate Post
                  </button>
                  <button
                    onClick={() => setVoiceOpenId(voiceOpenId === c.id ? null : c.id)}
                    style={{ ...primaryButtonStyle(COLORS.teal), padding: "8px 14px", flex: "none" }}
                  >
                    Add Voice Note
                  </button>
                </div>

                {voiceOpenId === c.id && (
                  <div style={{ marginTop: 10 }}>
                    <MicCapture
                      apiKey={apiKey}
                      provider={provider}
                      label="Record Voice Note"
                      parsePrompt={CONTACT_VOICE_PARSE_PROMPT}
                      onTranscript={(data) => handleVoiceTranscript(c, data)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {contacts.length === 0 && <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13 }}>No contacts yet — scan a card to get started.</div>}
      </div>
    </div>
  );
}

// ── TAB 4 — Posts ─────────────────────────────────────────────
function PostsTab({ apiKey, provider, openrouterModels, contacts, sessions, posts, onAddPost, presetContact, clearPreset }) {
  const [contextType, setContextType] = useState("general"); // contact | session | general
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [postType, setPostType] = useState(POST_TYPES[0]);
  const [rawIdea, setRawIdea] = useState("");
  const [generated, setGenerated] = useState("");
  const [status, setStatus] = useState("idle"); // idle | generating | error
  const [errorMsg, setErrorMsg] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (presetContact) {
      setContextType("contact");
      setSelectedContactId(String(presetContact.id));
      setPostType("Met someone interesting");
      setGenerated("");
      setMeta(null);
      setErrorMsg("");
      clearPreset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetContact]);

  const handleIdeaTranscript = (data) => {
    if (data.rawIdea) setRawIdea(data.rawIdea);
    if (data.suggestedPostType) setPostType(data.suggestedPostType);
  };

  const buildContextJSON = () => {
    if (contextType === "contact") {
      const c = contacts.find((c) => String(c.id) === selectedContactId);
      return c ? JSON.stringify(c) : "{}";
    }
    if (contextType === "session") {
      const s = sessions.find((s) => String(s.id) === selectedSessionId);
      return s ? JSON.stringify(s) : "{}";
    }
    return JSON.stringify({ rawIdea });
  };

  const generatePost = async () => {
    if (status === "generating") return; // ignore overlapping taps (e.g. rapid Regenerate)
    if (contextType === "contact" && !selectedContactId) {
      setErrorMsg("Select a contact first.");
      return;
    }
    if (contextType === "session" && !selectedSessionId) {
      setErrorMsg("Select a session first.");
      return;
    }
    setStatus("generating");
    setErrorMsg("");
    try {
      const systemPrompt = buildPostGenerationPrompt(buildContextJSON(), postType);
      const userText = rawIdea ? `My rough idea: ${rawIdea}` : "Generate the post now.";
      const { text: raw, meta: responseMeta } = await generateFromText({ provider, apiKey, openrouterModels, systemPrompt, userText });
      const text = raw.trim();
      setGenerated(text);
      setMeta(responseMeta);
      onAddPost({ id: Date.now(), text, postType, contextType });
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
      setStatus("error");
    }
  };

  const copyToClipboard = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(generated);
    setCopyFlash(true);
    setTimeout(() => setCopyFlash(false), 1500);
  };

  return (
    <div style={{ padding: 16 }}>
      <h1 style={headerTextStyle}>POSTS</h1>

      <div style={{ marginTop: 16 }}>
        <MicCapture apiKey={apiKey} provider={provider} label="Record Post Idea" parsePrompt={POST_IDEA_PROMPT} onTranscript={handleIdeaTranscript} />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={smallLabelStyle}>Context</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "contact", label: "From contact" },
            { key: "session", label: "From session" },
            { key: "general", label: "General reflection" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setContextType(opt.key)}
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: 4,
                border: `1px solid ${contextType === opt.key ? COLORS.purple : COLORS.cardBorder}`,
                backgroundColor: contextType === opt.key ? COLORS.purple : "transparent",
                color: contextType === opt.key ? "#0a0a0a" : COLORS.textPrimary,
                fontFamily: FONT_MONO,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {contextType === "contact" && (
        <select value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)} style={selectStyle}>
          <option value="">Select a contact...</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "Unnamed"}
            </option>
          ))}
        </select>
      )}

      {contextType === "session" && (
        <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)} style={selectStyle}>
          <option value="">Select a session...</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sessionTitle || "Untitled"}
            </option>
          ))}
        </select>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={smallLabelStyle}>Post type</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POST_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setPostType(t)}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                border: `1px solid ${postType === t ? COLORS.orange : COLORS.cardBorder}`,
                backgroundColor: postType === t ? COLORS.orange : "transparent",
                color: postType === t ? "#0a0a0a" : COLORS.textPrimary,
                fontFamily: FONT_MONO,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <LabeledTextarea label="Your rough idea or talking point" value={rawIdea} onChange={setRawIdea} rows={4} />
      </div>

      <button onClick={generatePost} disabled={status === "generating"} style={{ ...primaryButtonStyle(COLORS.orange), marginTop: 12, opacity: status === "generating" ? 0.6 : 1 }}>
        {status === "generating" ? "Generating..." : "Generate Post"}
      </button>

      {errorMsg && <div style={{ color: COLORS.red, fontFamily: FONT_MONO, fontSize: 13, marginTop: 8 }}>{errorMsg}</div>}

      {generated && (
        <div style={{ marginTop: 16 }}>
          <textarea
            value={generated}
            onChange={(e) => setGenerated(e.target.value)}
            rows={8}
            style={{
              width: "100%",
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 4,
              color: COLORS.textPrimary,
              fontFamily: FONT_MONO,
              fontSize: 14,
              padding: 12,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={copyToClipboard} style={primaryButtonStyle(COLORS.teal)}>Copy to clipboard</button>
            <button onClick={generatePost} disabled={status === "generating"} style={{ ...primaryButtonStyle(COLORS.purple), opacity: status === "generating" ? 0.6 : 1 }}>
              {status === "generating" ? "Generating..." : "Regenerate"}
            </button>
          </div>
          {copyFlash && <div style={{ color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 12, marginTop: 6 }}>Copied.</div>}
          <ModelMeta meta={meta} />
        </div>
      )}

      {posts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={smallLabelStyle}>Post history</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {posts.slice().reverse().slice(0, 5).map((p) => (
              <div
                key={p.id}
                style={{
                  padding: 10,
                  backgroundColor: COLORS.card,
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 4,
                  color: COLORS.textMuted,
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TAB 5 — About ────────────────────────────────────────────
function AboutTab() {
  const [setupOpen, setSetupOpen] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: COLORS.purple, fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800 }}>CONF CAPTURE</div>
      <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13, marginTop: 4 }}>
        Scan cards. Log sessions. Record notes. Post while it's fresh.
      </div>

      <Divider />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: COLORS.purple, fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700 }}>{USER_CONFIG.brand}</div>
        <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 13 }}>{USER_CONFIG.role}</div>
        <a href={`https://${USER_CONFIG.website}`} target="_blank" rel="noreferrer" style={{ color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 13, textDecoration: "none" }}>
          {USER_CONFIG.website}
        </a>
        <a href={`https://${USER_CONFIG.hiringUrl}`} target="_blank" rel="noreferrer" style={{ color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 13, textDecoration: "none" }}>
          Available for roles → {USER_CONFIG.hiringUrl}
        </a>
      </div>

      <Divider />

      <div>
        <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>
          Open-source. Fork it, edit the config block, use it at your next conference.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <a
            href={USER_CONFIG.githubRepo}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 4,
              border: `1px solid ${COLORS.teal}`,
              color: COLORS.teal,
              fontFamily: FONT_MONO,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ⭐ Star on GitHub
          </a>
          <a
            href={`${USER_CONFIG.githubRepo}/issues/new`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 4,
              border: `1px solid ${COLORS.orange}`,
              color: COLORS.orange,
              fontFamily: FONT_MONO,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            💬 Send Feedback
          </a>
        </div>

        <a
          href={USER_CONFIG.appUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex",
            width: 160,
            height: 160,
            backgroundColor: "#1a1a1a",
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 4,
            marginTop: 16,
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
            boxSizing: "border-box",
          }}
        >
          <img src={qrCode} alt="QR code to the live app" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </a>
      </div>

      <Divider />

      <div>
        <button
          onClick={() => setSetupOpen((v) => !v)}
          style={{ background: "none", border: "none", color: COLORS.textPrimary, fontFamily: FONT_MONO, fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          SETUP {setupOpen ? "↓" : "→"}
        </button>
        {setupOpen && (
          <pre
            style={{
              marginTop: 10,
              color: COLORS.textMuted,
              fontFamily: FONT_MONO,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.cardBorder}`,
              borderRadius: 4,
              padding: 12,
            }}
          >
{`1. clone ${USER_CONFIG.githubRepo}
2. edit USER_CONFIG at top of wearedev-capture.jsx
3. open in browser or deploy to Vercel / Netlify
4. on first load, pick Anthropic (full features) or OpenRouter (free — no voice notes)
5. bring to your next conference`}
          </pre>
        )}
      </div>

      <Divider />

      <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 10, textAlign: "center" }}>
        v1.0 · Built in one day · MIT License
      </div>
    </div>
  );
}

// ── API key modal ────────────────────────────────────────────
function ApiKeyModal({ provider, onProviderChange, onSave, onClose, canClose }) {
  const [value, setValue] = useState("");
  const info = PROVIDER_INFO[provider];

  const selectProvider = (key) => {
    onProviderChange(key);
    setValue("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: 4, padding: 20, width: "100%", maxWidth: 340 }}>
        <div style={smallLabelStyle}>Choose a provider</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.keys(PROVIDER_INFO).map((key) => (
            <button
              key={key}
              onClick={() => selectProvider(key)}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 4,
                border: `1px solid ${provider === key ? COLORS.purple : COLORS.cardBorder}`,
                backgroundColor: provider === key ? COLORS.purple : "transparent",
                color: provider === key ? "#0a0a0a" : COLORS.textPrimary,
                fontFamily: FONT_MONO,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {PROVIDER_INFO[key].label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          {info.capabilities.map((c) => (
            <div key={c.text} style={{ color: c.ok ? COLORS.textMuted : COLORS.red, fontFamily: FONT_MONO, fontSize: 11 }}>
              {c.ok ? "✓" : "✕"} {c.text}
            </div>
          ))}
        </div>

        <div style={{ color: COLORS.textPrimary, fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, marginTop: 16 }}>
          {info.label.toUpperCase()} API KEY
        </div>
        <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12, marginTop: 8 }}>
          Stored in session memory only — never saved.
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={info.keyPlaceholder}
          style={{
            width: "100%",
            marginTop: 14,
            backgroundColor: COLORS.bg,
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 4,
            color: COLORS.textPrimary,
            fontFamily: FONT_MONO,
            fontSize: 13,
            padding: "10px 12px",
            boxSizing: "border-box",
          }}
        />
        <button onClick={() => value.trim() && onSave(value.trim())} style={{ ...primaryButtonStyle(COLORS.purple), width: "100%", marginTop: 12 }}>
          Save for session
        </button>
        <a
          href={info.getKeyUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: "block", textAlign: "center", marginTop: 12, color: COLORS.teal, fontFamily: FONT_MONO, fontSize: 12, textDecoration: "none" }}
        >
          Get a key →
        </a>
        {canClose && (
          <button
            onClick={onClose}
            style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12, cursor: "pointer" }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ── Global header + tab bar ──────────────────────────────────
function GlobalHeader({ hasKey, provider, onKeyTap }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: "0 auto",
        height: 52,
        backgroundColor: COLORS.bg,
        borderBottom: `1px solid ${COLORS.cardBorder}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        zIndex: 50,
        boxSizing: "border-box",
      }}
    >
      <div style={{ color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>{USER_CONFIG.brand}</div>
      <div style={{ color: COLORS.purple, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700 }}>
        {USER_CONFIG.event} '{USER_CONFIG.eventYear.slice(-2)}
      </div>
      <button
        onClick={onKeyTap}
        style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 10 }}
      >
        <span style={{ fontSize: 16 }}>{hasKey ? "🔑" : "⚠️"}</span>
        {hasKey && <span>{PROVIDER_INFO[provider].label}</span>}
      </button>
    </div>
  );
}

function TabBar({ active, onChange }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: "0 auto",
        height: 62,
        backgroundColor: COLORS.card,
        borderTop: `1px solid ${COLORS.cardBorder}`,
        display: "flex",
        zIndex: 50,
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            cursor: "pointer",
            color: active === tab.key ? COLORS.purple : COLORS.textMuted,
          }}
        >
          <span style={{ fontSize: 18 }}>{tab.icon}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Root app ──────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    injectGlobalAssets();
  }, []);

  const [activeTab, setActiveTab] = useState("scan");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [openrouterModels, setOpenrouterModels] = useState({ text: [], vision: [] });
  const [keyModalOpen, setKeyModalOpen] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [presetContact, setPresetContact] = useState(null);

  useEffect(() => {
    if (provider !== "openrouter") return;
    if (openrouterModels.text.length > 0 || openrouterModels.vision.length > 0) return;
    fetchFreeOpenRouterModels().then(setOpenrouterModels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const addContact = (contact) => setContacts((prev) => [...prev, contact]);
  const updateContact = (updated) => setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  const addSession = (session) => setSessions((prev) => [...prev, session]);
  const addPost = (post) => setPosts((prev) => [...prev, post]);

  const goToPostsWithContact = (contact) => {
    setPresetContact(contact);
    setActiveTab("posts");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: FONT_MONO,
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
        paddingTop: 52,
        paddingBottom: 70,
      }}
    >
      <GlobalHeader hasKey={!!apiKey} provider={provider} onKeyTap={() => setKeyModalOpen(true)} />

      {activeTab === "scan" && <ScanTab apiKey={apiKey} provider={provider} openrouterModels={openrouterModels} onSaveContact={addContact} />}
      {activeTab === "sessions" && <SessionsTab apiKey={apiKey} provider={provider} sessions={sessions} onSaveSession={addSession} />}
      {activeTab === "contacts" && (
        <ContactsTab apiKey={apiKey} provider={provider} contacts={contacts} onUpdateContact={updateContact} onGeneratePost={goToPostsWithContact} />
      )}
      {activeTab === "posts" && (
        <PostsTab
          apiKey={apiKey}
          provider={provider}
          openrouterModels={openrouterModels}
          contacts={contacts}
          sessions={sessions}
          posts={posts}
          onAddPost={addPost}
          presetContact={presetContact}
          clearPreset={() => setPresetContact(null)}
        />
      )}
      {activeTab === "about" && <AboutTab />}

      <TabBar active={activeTab} onChange={setActiveTab} />

      {keyModalOpen && (
        <ApiKeyModal
          provider={provider}
          onProviderChange={setProvider}
          canClose={!!apiKey}
          onSave={(key) => {
            setApiKey(key);
            setKeyModalOpen(false);
          }}
          onClose={() => setKeyModalOpen(false)}
        />
      )}
    </div>
  );
}
