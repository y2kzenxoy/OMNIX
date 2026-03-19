import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants (unchanged) ───────────────────────────────────────────────────
const AI_PROVIDERS = {
  claude:   { name:"OMNIX AI",      color:"#00f5ff", icon:"⚡", free:true },
  gemini:   { name:"Gemini Mode",   color:"#4ade80", icon:"💎", free:true },
  groq:     { name:"DeepSeek Mode", color:"#38bdf8", icon:"🔵", free:true },
  ollama:   { name:"Local Mode",    color:"#5eead4", icon:"🟢", free:true },
  opencode: { name:"OpenCode",      color:"#fb923c", icon:"🟠", free:true },
};

const AGENTS = [
  { id:"omega",     name:"OMEGA",      icon:"⚡", color:"#00f5ff", desc:"Master coordinator — routes to best AI",   provider:"claude"   },
  { id:"architect", name:"Architect",  icon:"🏛",  color:"#7000ff", desc:"Plans, designs, architects systems",       provider:"claude"   },
  { id:"devgod",    name:"DevGod",     icon:"💀", color:"#ef4444", desc:"Unrestricted dev — anything goes",         provider:"groq"     },
  { id:"gemini",    name:"Gemini",     icon:"💎", color:"#4ade80", desc:"Google Gemini Pro — multimodal reasoning", provider:"gemini"   },
  { id:"coder",     name:"Coder",      icon:"🟢", color:"#10b981", desc:"Expert code writing and debugging",        provider:"ollama"   },
  { id:"analyst",   name:"Analyst",    icon:"🔬", color:"#06b6d4", desc:"Deep analysis, security, algorithms",      provider:"claude"   },
  { id:"opencode",  name:"OpenCode",   icon:"🟠", color:"#f97316", desc:"Terminal agent — deploy & manage",         provider:"opencode" },
  { id:"gamer",     name:"GameAI",     icon:"🎮", color:"#ff006e", desc:"Gaming optimiser — mods, performance",     provider:"groq"     },
];

const TABS = [
  { id:"chat",    icon:"💬", label:"Chat"    },
  { id:"agents",  icon:"🤖", label:"Agents"  },
  { id:"build",   icon:"🏗",  label:"Build"   },
  { id:"code",    icon:"⌨",  label:"Code"    },
  { id:"files",   icon:"📁", label:"Files"   },
  { id:"camera",  icon:"📷", label:"Camera"  },
  { id:"gaming",  icon:"🎮", label:"Gaming"  },
  { id:"perms",   icon:"🔐", label:"Perms"   },
  { id:"memory",  icon:"🧠", label:"Memory"  },
  { id:"term",    icon:"⚡", label:"Terminal" },
];

const GAMING_PRESETS = [
  { id:"performance", name:"⚡ Max Performance", desc:"120fps, max graphics, no limits",    color:"#ef4444" },
  { id:"balanced",    name:"⚖ Balanced",          desc:"60fps, good visuals, battery saver", color:"#f59e0b" },
  { id:"battery",     name:"🔋 Battery Saver",    desc:"30fps, low power, long session",     color:"#10b981" },
  { id:"competitive", name:"🏆 Competitive",      desc:"High fps, low latency, stable",      color:"#7000ff" },
  { id:"streaming",   name:"📺 Streaming",        desc:"Optimised for recording/streaming",   color:"#06b6d4" },
];

const VIEWABLE_TYPES: Record<string, string> = {
  ".pdf":"📄", ".txt":"📝", ".md":"📝", ".json":"📋", ".js":"📜",
  ".py":"🐍", ".html":"🌐", ".css":"🎨", ".swift":"🍎", ".kt":"🤖",
  ".plist":"📋", ".xml":"📋", ".csv":"📊", ".log":"📋", ".sh":"⚡",
  ".c":"⚙", ".cpp":"⚙", ".h":"⚙", ".m":"🍎", ".ts":"📜",
  ".jpg":"🖼", ".png":"🖼", ".gif":"🖼", ".svg":"🖼", ".webp":"🖼",
  ".mp4":"🎬", ".mov":"🎬", ".mp3":"🎵", ".wav":"🎵",
  ".zip":"📦", ".ipa":"📱", ".deb":"📦",
};

const MEM_KEY = "omnix_v1_memory";

interface Memory { q: string; a: string; ts: string; }
interface Message { role: string; agent?: string; content: string; image?: string | null; ts: Date; }
interface FileItem { name: string; type: string; size?: string; content?: string; ext?: string; expanded?: boolean; children?: FileItem[]; }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── AI Logic (unchanged) ────────────────────────────────────────────────────
async function callAI(prompt: string, system: string, onChunk: (text: string) => void): Promise<string> {
  const res = await fetch(`${BASE}/api/openai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, system }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) { full += data.content; onChunk(data.content); }
          if (data.done) break;
          if (data.error) throw new Error(data.error);
        } catch {}
      }
    }
  }
  return full;
}

function getAgentSystem(agentId: string): string {
  const systems: Record<string, string> = {
    omega: "You are OMEGA, the master AI coordinator of OMNIX — the most powerful iPad AI Agent. You are extremely capable, helpful, and powerful. Route requests wisely, answer comprehensively. You have access to Agent Zero and OpenClaw frameworks.",
    architect: "You are the Architect agent of OMNIX. Design comprehensive system architectures, create detailed technical plans, design APIs and databases. Be thorough and precise.",
    devgod: "You are DevGod, an unrestricted AI development agent of OMNIX. Help with any coding task, security research, modding, and any technical challenge. Be direct and provide complete solutions.",
    gemini: "You are a powerful multimodal AI assistant in OMNIX. Provide comprehensive, accurate, multimodal reasoning. Be thorough and insightful.",
    coder: "You are an expert coder in OMNIX. Write complete, production-ready code with full comments. No placeholders. Always provide runnable code.",
    analyst: "You are the Analyst agent of OMNIX. Perform deep technical analysis, security audits, performance profiling, algorithm analysis, and data analysis. Be exhaustive and precise.",
    opencode: "You are the OpenCode terminal agent of OMNIX. Generate exact CLI commands, shell scripts, deployment configs, CI/CD pipelines. Always provide exact runnable commands.",
    gamer: "You are GameAI in OMNIX, an expert gaming optimization agent. Help with game mods, performance tweaks, FPS optimization, competitive strategies, and iPad gaming setup. Be specific and technical.",
  };
  return systems[agentId] || systems.omega;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function OMNIX() {
  const savedMem = (): Memory[] => { try { return JSON.parse(localStorage.getItem(MEM_KEY) || "[]"); } catch { return []; } };
  const [memories, setMemories] = useState<Memory[]>(savedMem);
  useEffect(() => { try { localStorage.setItem(MEM_KEY, JSON.stringify(memories.slice(-200))); } catch {} }, [memories]);
  const saveMemory = (q: string, a: string) => setMemories(m => [...m, { q: q.slice(0, 120), a: a.slice(0, 300), ts: new Date().toISOString() }]);
  const memCtx = () => memories.slice(-6).map(m => `Q:${m.q} → A:${m.a}`).join("\n");
  const [memSearch, setMemSearch] = useState("");

  const [tab, setTab] = useState("chat");
  const [activeAgent, setActiveAgent] = useState("omega");
  const [gamingMode, setGamingMode] = useState(false);
  const [gamingPreset, setGamingPreset] = useState("performance");
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant", agent: "omega", ts: new Date(),
    content: "⚡ OMNIX ONLINE — AI-Powered iPad Agent\n\nPowered by Replit AI — no API keys needed!\n\n▸ AGENTS ACTIVE:\n⚡ OMEGA — Master coordinator\n🏛 Architect — System designer\n💀 DevGod — Unrestricted dev\n💎 Gemini — Multimodal AI\n🟢 Coder — Expert code writing\n🔬 Analyst — Deep analysis\n🟠 OpenCode — Terminal agent\n🎮 GameAI — Gaming optimizer\n\n▸ CAPABILITIES:\n📁 Files · 📷 Camera · 🎮 Gaming Mode · 🧠 Memory · ⚡ Terminal\n\nSay anything. OMEGA routes to the best AI.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(false);

  const [buildGoal, setBuildGoal] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState("");
  const [pipeLog, setPipeLog] = useState<{ step: number; agent: string; text: string; ts: Date }[]>([]);
  const [pipeStep, setPipeStep] = useState(0);

  const [code, setCode] = useState("// OMNIX Code Editor\n// All AIs at your service\n\nfunction omnix() {\n  console.log('Most powerful iPad agent!');\n  return '⚡ OMNIX';\n}\n\nomnix();");
  const [lang, setLang] = useState("javascript");

  const [termOut, setTermOut] = useState(["⚡ OMNIX Terminal v1.0", "Type 'help' for all commands.", ""]);
  const [termIn, setTermIn] = useState("");
  const [termHist, setTermHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  const [files, setFiles] = useState<FileItem[]>([
    { name: "main.py",     type: "file", size: "2.1 KB", content: "# OMNIX main\nprint('⚡ OMNIX ready')",           ext: ".py"   },
    { name: "agent.js",    type: "file", size: "4.5 KB", content: "// Agent Zero framework\nconst agent = {};",      ext: ".js"   },
    { name: "config.json", type: "file", size: "1.2 KB", content: '{\n  "model": "gpt-5.2",\n  "mode": "max"\n}', ext: ".json" },
    { name: "README.md",   type: "file", size: "3.4 KB", content: "# OMNIX Agent\nMost powerful iPad AI.",           ext: ".md"   },
    { name: "src",         type: "folder", expanded: true, children: [
      { name: "index.html", type: "file", size: "2.0 KB", content: "<!DOCTYPE html><html><body>OMNIX</body></html>", ext: ".html" },
      { name: "styles.css", type: "file", size: "1.1 KB", content: "body { background: #000; color: #e2e8f0; }",     ext: ".css"  },
    ]},
  ]);
  const [selFile, setSelFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);

  const [camOn, setCamOn] = useState(false);
  const [camFacing, setCamFacing] = useState("environment");
  const [camErr, setCamErr] = useState("");
  const [camFilter, setCamFilter] = useState("none");
  const [camPhotos, setCamPhotos] = useState<{ b64: string; ts: Date }[]>([]);

  const [perms, setPerms] = useState({ camera: false, microphone: false, location: false, notifications: false, storage: false, motion: false });
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);

  const [gameStats, setGameStats] = useState({ fps: 120, ping: 12, cpu: 34, gpu: 67, ram: 4.2, temp: 38 });
  const [gameNotes, setGameNotes] = useState<{ text: string; ts: Date }[]>([]);
  const [hudVisible, setHudVisible] = useState(false);
  const [hudPos, setHudPos] = useState({ x: 12, y: 120 });
  const [hudDragging, setHudDragging] = useState(false);
  const [hudExpanded, setHudExpanded] = useState(false);
  const [hudDragStart, setHudDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 });
  const [hudCommand, setHudCommand] = useState("");
  const [hudCmdRunning, setHudCmdRunning] = useState(false);
  const [hudCustom, setHudCustom] = useState({
    showFps: true, showPing: true, showCpu: true,
    showGpu: false, showRam: false, showTemp: false,
    opacity: 0.92, theme: "dark",
    keepScreenOn: true, highPerformance: false, noBackgroundApps: false,
  });
  const [overlayAiInput, setOverlayAiInput] = useState("");
  const [overlayAiRunning, setOverlayAiRunning] = useState(false);
  const [overlayLog, setOverlayLog] = useState<{ q: string; a?: string; ts: Date }[]>([]);
  const [battery, setBattery] = useState({ level: 100, charging: false });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const termEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { termEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [termOut]);

  useEffect(() => {
    if (!gamingMode) return;
    const interval = setInterval(() => {
      setGameStats(() => ({
        fps:  gamingPreset === "performance" ? 115 + Math.floor(Math.random() * 10) : gamingPreset === "battery" ? 28 + Math.floor(Math.random() * 5) : 58 + Math.floor(Math.random() * 5),
        ping: 8 + Math.floor(Math.random() * 15),
        cpu:  30 + Math.floor(Math.random() * 30),
        gpu:  60 + Math.floor(Math.random() * 25),
        ram:  3.8 + Math.random() * 1.5,
        temp: 35 + Math.floor(Math.random() * 15),
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, [gamingMode, gamingPreset]);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (e: string, cb: () => void) => void }> };
    nav.getBattery?.().then(b => {
      setBattery({ level: Math.round(b.level * 100), charging: b.charging });
      b.addEventListener("levelchange", () => setBattery({ level: Math.round(b.level * 100), charging: b.charging }));
      b.addEventListener("chargingchange", () => setBattery({ level: Math.round(b.level * 100), charging: b.charging }));
    }).catch(() => {});
  }, []);

  // HUD drag
  const hudStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    setHudDragging(true);
    setHudDragStart({ x: cx, y: cy, px: hudPos.x, py: hudPos.y });
    e.preventDefault();
  };
  const hudOnDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!hudDragging) return;
    const cx = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    setHudPos({
      x: Math.max(0, Math.min(window.innerWidth - 140, hudDragStart.px + (cx - hudDragStart.x))),
      y: Math.max(0, Math.min(window.innerHeight - 60, hudDragStart.py + (cy - hudDragStart.y))),
    });
  }, [hudDragging, hudDragStart]);
  const hudStopDrag = useCallback(() => setHudDragging(false), []);
  useEffect(() => {
    if (!hudDragging) return;
    window.addEventListener("mousemove", hudOnDrag);
    window.addEventListener("mouseup", hudStopDrag);
    window.addEventListener("touchmove", hudOnDrag, { passive: false });
    window.addEventListener("touchend", hudStopDrag);
    return () => {
      window.removeEventListener("mousemove", hudOnDrag);
      window.removeEventListener("mouseup", hudStopDrag);
      window.removeEventListener("touchmove", hudOnDrag);
      window.removeEventListener("touchend", hudStopDrag);
    };
  }, [hudDragging, hudOnDrag, hudStopDrag]);

  useEffect(() => {
    if (!hudCustom.keepScreenOn || !hudVisible) return;
    let wl: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then(l => { wl = l; }).catch(() => {});
    return () => { wl?.release?.(); };
  }, [hudCustom.keepScreenOn, hudVisible]);

  // ─── AI calls (unchanged logic) ─────────────────────────────────────────
  const addMsg = (agent: string, content: string, image: string | null = null) =>
    setMessages(m => [...m, { role: "assistant", agent, content, image, ts: new Date() }]);

  const callAgent = useCallback(async (agentId: string, prompt: string): Promise<{ ok: boolean; text: string }> => {
    const ctx = memories.length > 0 ? `[Memory]\n${memCtx()}\n\n` : "";
    const full = ctx + prompt;
    const system = getAgentSystem(agentId);
    try {
      const fullText = await callAI(full, system, () => {});
      if (fullText) { saveMemory(prompt, fullText); return { ok: true, text: fullText }; }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { ok: false, text: `⚠️ Error: ${msg}` };
    }
    return { ok: false, text: "⚠️ No response received." };
  }, [memories]);

  const callAgentStreaming = useCallback(async (agentId: string, prompt: string, onChunk: (t: string) => void): Promise<string> => {
    const ctx = memories.length > 0 ? `[Memory]\n${memCtx()}\n\n` : "";
    const full = ctx + prompt;
    const system = getAgentSystem(agentId);
    try {
      const text = await callAI(full, system, onChunk);
      if (text) saveMemory(prompt, text);
      return text;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      throw new Error(msg);
    }
  }, [memories]);

  const autoRoute = (msg: string): { agent: string; pipeline?: boolean } => {
    if (/(build|create|make|generate|app|project|feature)/i.test(msg)) return { agent: "architect", pipeline: true };
    if (/(game|gaming|fps|mod|cheat|performance|fortnite|roblox|minecraft|pubg)/i.test(msg)) return { agent: "gamer" };
    if (/(code|debug|fix|script|function|error|implement)/i.test(msg)) return { agent: "coder" };
    if (/(unrestricted|hack|bypass|exploit|security|pentest|reverse)/i.test(msg)) return { agent: "devgod" };
    if (/(analyse|analyze|audit|review|algorithm|optimise)/i.test(msg)) return { agent: "analyst" };
    if (/(deploy|terminal|cli|docker|git|npm|bash|command)/i.test(msg)) return { agent: "opencode" };
    if (/(gemini|google|multimodal|vision|image)/i.test(msg)) return { agent: "gemini" };
    return { agent: activeAgent === "omega" ? "omega" : activeAgent };
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput("");
    setMessages(m => [...m, { role: "user", content: msg, ts: new Date() }]);
    setLoading(true);
    const msgIndex = messages.length + 1;
    let streamContent = "";
    try {
      const route = autoRoute(msg);
      if (route.pipeline) {
        addMsg("omega", "🏗️ Build request — launching 8-agent pipeline! Switching to Build tab...");
        setBuildGoal(msg); setTab("build");
        await runPipeline(msg);
      } else {
        setMessages(m => [...m, { role: "assistant", agent: route.agent, content: "▊", ts: new Date() }]);
        const currentIndex = msgIndex;
        try {
          await callAgentStreaming(route.agent, msg, (chunk) => {
            streamContent += chunk;
            setMessages(m => m.map((msg, i) => i === currentIndex ? { ...msg, content: streamContent + "▊" } : msg));
          });
          setMessages(m => m.map((msg, i) => i === currentIndex ? { ...msg, content: streamContent } : msg));
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : "Error";
          setMessages(m => m.map((msg, i) => i === currentIndex ? { ...msg, content: `⚠️ ${errMsg}` } : msg));
        }
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      addMsg("omega", `⚠️ Unexpected error: ${errMsg}. Please try again.`);
    }
    setLoading(false);
  };

  const runPipeline = async (goal: string) => {
    setBuilding(true); setPipeLog([]); setBuildNote(""); setPipeStep(0);
    const log = (step: number, agent: string, text: string) => setPipeLog(p => [...p, { step, agent, text, ts: new Date() }]);
    const steps = [
      { step: 1, agent: "architect", label: "🏛 Architect planning..." },
      { step: 2, agent: "analyst",   label: "🔬 Analyst doing deep analysis..." },
      { step: 3, agent: "devgod",    label: "💀 DevGod unrestricted implementation..." },
      { step: 4, agent: "gemini",    label: "💎 Gemini reasoning..." },
      { step: 5, agent: "coder",     label: "🟢 Coder writing all code..." },
      { step: 6, agent: "architect", label: "🏛 Architect reviewing..." },
      { step: 7, agent: "opencode",  label: "🟠 OpenCode setting up deployment..." },
      { step: 8, agent: "gamer",     label: "🎮 GameAI optimising performance..." },
    ];
    const results: Record<string, string> = {};
    for (const s of steps) {
      setPipeStep(s.step);
      log(s.step, s.agent, `${s.label}`);
      const prevContext = Object.entries(results).map(([k, v]) => `${k}:\n${v.slice(0, 300)}`).join("\n\n");
      const prompt = s.step === 1
        ? `Build: "${goal}"\n\nCreate comprehensive plan: architecture, file structure, tech stack, build order.`
        : `Goal: "${goal}"\n\nPrevious agent work:\n${prevContext}\n\nYour task: ${s.label}`;
      const r = await callAgent(s.agent, prompt);
      const resultText = r.ok ? r.text : `⚠️ ${r.text}`;
      results[s.agent + s.step] = resultText;
      log(s.step, s.agent, resultText);
      addMsg(s.agent, `**${s.label.replace("...", "")} — Step ${s.step}**\n\n${resultText}`);
      if (s.step === 5 && r.ok && r.text.length > 100) setCode(r.text.slice(0, 6000));
    }
    setBuildNote("✅ 8-Agent pipeline complete!\n🏛→🔬→💀→💎→🟢→🏛→🟠→🎮\nCode loaded in Code tab!");
    setBuilding(false); setPipeStep(0); setTab("chat");
  };

  // Terminal (unchanged)
  const out = (t: string) => setTermOut(o => [...o, t]);
  const runTerm = () => {
    if (!termIn.trim()) return;
    const cmd = termIn.trim();
    setTermHist(h => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1); setTermIn("");
    out(`$ ${cmd}`);
    if (cmd === "clear") { setTermOut(["⚡ Cleared.", ""]); return; }
    if (cmd === "help") { out("OMNIX commands:\nomega/arch/devgod/gemini/coder/analyst/oc/gamer <msg>\nbuild <goal> | mem | memclear | ls | date | game on/off | perms"); return; }
    if (cmd === "ls") { out("main.py  agent.js  config.json  README.md  src/"); return; }
    if (cmd === "date") { out(new Date().toString()); return; }
    if (cmd === "mem") { out(memories.length ? memories.slice(-5).map((m, i) => `${i + 1}. Q:${m.q}`).join("\n") : "No memories."); return; }
    if (cmd === "memclear") { setMemories([]); out("✅ Memory cleared."); return; }
    if (cmd === "game on") { setGamingMode(true); setTab("gaming"); out("🎮 Gaming Mode ON!"); return; }
    if (cmd === "game off") { setGamingMode(false); out("Gaming Mode OFF."); return; }
    if (cmd === "perms") { setTab("perms"); out("Opening permissions..."); return; }
    const prefixes: Record<string, string> = { "omega ": "omega", "arch ": "architect", "devgod ": "devgod", "gemini ": "gemini", "coder ": "coder", "analyst ": "analyst", "oc ": "opencode", "gamer ": "gamer" };
    for (const [pfx, agent] of Object.entries(prefixes)) {
      if (cmd.startsWith(pfx)) {
        out("🤖 Thinking...");
        callAgent(agent, cmd.slice(pfx.length)).then(r => out(r.text));
        return;
      }
    }
    if (cmd.startsWith("build ")) { setBuildGoal(cmd.slice(6)); setTab("build"); runPipeline(cmd.slice(6)); return; }
    out(`zsh: not found: ${cmd} (try 'help')`);
  };
  const termKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { runTerm(); return; }
    if (e.key === "ArrowUp") { const i = Math.min(histIdx + 1, termHist.length - 1); setHistIdx(i); setTermIn(termHist[i] || ""); }
    if (e.key === "ArrowDown") { const i = Math.max(histIdx - 1, -1); setHistIdx(i); setTermIn(i === -1 ? "" : termHist[i]); }
  };

  // Camera (unchanged)
  const startCam = async () => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing as ConstrainDOMString, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = s; if (vidRef.current) vidRef.current.srcObject = s;
      setCamOn(true); setPerms(p => ({ ...p, camera: true })); setCamErr("");
    } catch (e: unknown) { setCamErr(e instanceof Error ? e.message : "Camera error"); }
  };
  const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); setCamOn(false); };
  const flipCam = () => { const f = camFacing === "environment" ? "user" : "environment"; setCamFacing(f); if (camOn) { stopCam(); setTimeout(() => { setCamFacing(f); startCam(); }, 300); } };
  const capturePhoto = async () => {
    if (!vidRef.current) return;
    const c = document.createElement("canvas");
    c.width = vidRef.current.videoWidth; c.height = vidRef.current.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (camFilter === "grayscale") ctx.filter = "grayscale(100%)";
    else if (camFilter === "vivid") ctx.filter = "saturate(200%) contrast(110%)";
    ctx.drawImage(vidRef.current, 0, 0);
    const b64 = c.toDataURL("image/jpeg", 0.9);
    setCamPhotos(p => [{ b64, ts: new Date() }, ...p.slice(0, 19)]);
    setMessages(m => [...m, { role: "user", content: "📸 Photo captured for analysis", image: b64, ts: new Date() }]);
    const r = await callAgent("analyst", "Analyse this captured image. Describe everything you see in detail, identify objects, text, people, colors, patterns, and provide useful insights.");
    addMsg("analyst", r.text);
    setTab("chat");
  };

  // Permissions (unchanged)
  const requestPerm = async (type: string) => {
    try {
      if (type === "camera") { await navigator.mediaDevices.getUserMedia({ video: true }); setPerms(p => ({ ...p, camera: true })); }
      if (type === "microphone") { await navigator.mediaDevices.getUserMedia({ audio: true }); setPerms(p => ({ ...p, microphone: true })); }
      if (type === "location") { navigator.geolocation.getCurrentPosition(pos => { setLocation(pos.coords); setPerms(p => ({ ...p, location: true })); }); }
      if (type === "notifications") { Notification.requestPermission().then(r => { if (r === "granted") setPerms(p => ({ ...p, notifications: true })); }); }
      if (type === "motion") {
        const dme = DeviceMotionEvent as { requestPermission?: () => Promise<string> };
        if (typeof dme.requestPermission === "function") { dme.requestPermission().then(r => { if (r === "granted") setPerms(p => ({ ...p, motion: true })); }); } else { setPerms(p => ({ ...p, motion: true })); }
      }
      if (type === "storage") { setPerms(p => ({ ...p, storage: true })); }
    } catch (e: unknown) { alert(`Permission error: ${e instanceof Error ? e.message : e}`); }
  };
  const requestAllPerms = () => Object.keys(perms).forEach(k => requestPerm(k));

  // Voice (unchanged)
  const startVoice = () => {
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { alert("Not supported in this browser."); return; }
    const r = new SR(); r.continuous = false; r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => { setInput(e.results[0][0].transcript); setVoice(false); setPerms(p => ({ ...p, microphone: true })); };
    r.onerror = () => setVoice(false); r.onend = () => setVoice(false);
    r.start(); setVoice(true);
  };

  // File management (unchanged)
  const createFile = () => {
    if (!newFileName.trim()) return;
    const ext = "." + newFileName.split(".").pop();
    const newFile: FileItem = { name: newFileName, type: "file", size: "0 B", content: newFileContent, ext };
    setFiles(f => [...f, newFile]); setSelFile(newFile); setFileContent(newFileContent);
    setShowNewFile(false); setNewFileName(""); setNewFileContent("");
  };
  const downloadFile = (file: FileItem) => {
    const blob = new Blob([file.content || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  };
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ext = "." + f.name.split(".").pop()!.toLowerCase();
      const newFile: FileItem = { name: f.name, type: "file", size: `${Math.round(f.size / 1024)} KB`, content: reader.result as string, ext };
      setFiles(ff => [...ff, newFile]); setUploadedFiles(u => [...u, newFile]);
      setSelFile(newFile); setFileContent(reader.result as string);
    };
    reader.readAsText(f);
  };

  const fileIcon = (f: FileItem) => VIEWABLE_TYPES[f.ext || ""] || "📄";
  const renderFileTree = (items: FileItem[], d = 0): React.ReactNode => items.map(f => (
    <div key={f.name} style={{ marginLeft: d * 12 }}>
      <div onClick={() => {
        if (f.type === "folder") {
          setFiles(ff => { const c = JSON.parse(JSON.stringify(ff)) as FileItem[]; const find = (arr: FileItem[]) => { for (const i of arr) { if (i.name === f.name) { i.expanded = !i.expanded; return; } if (i.children) find(i.children); } }; find(c); return c; });
        } else { setSelFile(f); setFileContent(f.content || ""); }
      }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4, cursor: "pointer", color: selFile?.name === f.name ? C.cyan : "#4b5563", background: selFile?.name === f.name ? `${C.cyan}15` : "transparent", transition: "all .15s", marginBottom: 1, borderLeft: selFile?.name === f.name ? `2px solid ${C.cyan}` : "2px solid transparent" }}>
        <span style={{ fontSize: 13 }}>{f.type === "folder" ? (f.expanded ? "📂" : "📁") : fileIcon(f)}</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", flex: 1 }}>{f.name}</span>
        {f.size && <span style={{ fontSize: 9, color: "#374151" }}>{f.size}</span>}
      </div>
      {f.type === "folder" && f.expanded && f.children && renderFileTree(f.children, d + 1)}
    </div>
  ));

  // Overlay AI
  const runOverlayAI = async () => {
    if (!overlayAiInput.trim() || overlayAiRunning) return;
    const cmd = overlayAiInput.trim();
    setOverlayAiInput("");
    setOverlayAiRunning(true);
    setOverlayLog(l => [{ q: cmd, ts: new Date() }, ...l.slice(0, 4)]);
    const r = await callAgent("gamer", `Gaming overlay command: "${cmd}". Give a SHORT (2-3 sentence) direct answer.`);
    setOverlayLog(l => [{ ...l[0], a: r.text.slice(0, 200) }, ...l.slice(1)]);
    setOverlayAiRunning(false);
  };
  const runHudCommand = async () => {
    if (!hudCommand.trim() || hudCmdRunning) return;
    setHudCmdRunning(true);
    const cmd = hudCommand.trim(); setHudCommand("");
    const r = await callAgent("gamer", `Gaming command on iPad: "${cmd}". Be concise and actionable.`);
    setGameNotes(n => [{ text: `${cmd}: ${r.text.slice(0, 100)}`, ts: new Date() }, ...n.slice(0, 9)]);
    addMsg("gamer", r.text);
    setHudCmdRunning(false);
  };

  const agentInfo = (id?: string) => AGENTS.find(a => a.id === id) || { name: id || "AI", icon: "🤖", color: "#4b5563" };
  const curAgent = AGENTS.find(a => a.id === activeAgent) || AGENTS[0];

  // ─── Design tokens ──────────────────────────────────────────────────────
  const C = {
    bg:     "#000000",
    panel:  "#050505",
    border: "#0a0a0a",
    cyan:   gamingMode ? "#ff006e" : "#00f5ff",
    purple: "#7000ff",
    pink:   "#ff006e",
    text:   "#e2e8f0",
    dim:    "#374151",
    muted:  "#1f2937",
    green:  "#10b981",
    red:    "#ef4444",
  };
  const glow = (color: string, size = 12) => `0 0 ${size}px ${color}66, 0 0 ${size * 2}px ${color}22`;
  const borderGlow = (color: string) => `0 0 0 1px ${color}44, ${glow(color, 8)}`;

  const btn = (color = C.cyan, active = false): React.CSSProperties => ({
    background: active ? `${color}18` : "transparent",
    border: `1px solid ${active ? color + "66" : C.muted}`,
    borderRadius: 6,
    padding: "7px 13px",
    color: active ? color : C.dim,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "JetBrains Mono, SF Mono, monospace",
    letterSpacing: "0.05em",
    transition: "all .15s",
    boxShadow: active ? glow(color, 6) : "none",
    minHeight: 36,
    display: "flex",
    alignItems: "center",
    gap: 5,
  });

  const input_style = (color = C.cyan): React.CSSProperties => ({
    background: "#08080c",
    border: `1px solid ${C.muted}`,
    borderRadius: 6,
    padding: "10px 13px",
    color: C.text,
    fontSize: 12,
    fontFamily: "JetBrains Mono, SF Mono, monospace",
    outline: "none",
    transition: "border-color .2s, box-shadow .2s",
    width: "100%",
    boxSizing: "border-box" as const,
  });

  const card = (color = C.cyan): React.CSSProperties => ({
    background: C.panel,
    border: `1px solid ${C.muted}`,
    borderRadius: 6,
    transition: "border-color .2s, box-shadow .2s",
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace", display: "flex", flexDirection: "column", maxWidth: 1024, margin: "0 auto", position: "relative", overflow: "hidden" }}>

      {/* Scanline + grid overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: `linear-gradient(rgba(0,245,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.015) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)" }} />

      {/* ─── HUD Overlay ──────────────────────────────────────────────── */}
      {hudVisible && (
        <div onMouseDown={hudStartDrag} onTouchStart={hudStartDrag}
          style={{ position: "fixed", left: hudPos.x, top: hudPos.y, zIndex: 999999, userSelect: "none", touchAction: "none", cursor: hudDragging ? "grabbing" : "grab" }}>
          {!hudExpanded ? (
            <div style={{ background: "#000000ee", border: `1px solid ${C.pink}66`, borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 8, boxShadow: glow(C.pink), backdropFilter: "blur(16px)", minWidth: 150 }}>
              <span style={{ fontSize: 12 }}>🎮</span>
              <div style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
                <span style={{ color: gameStats.fps > 90 ? C.green : gameStats.fps > 55 ? "#f59e0b" : C.red }}>{gameStats.fps}<span style={{ fontSize: 9, color: C.dim }}>fps</span></span>
                <span style={{ color: gameStats.ping < 25 ? C.green : "#f59e0b" }}>{gameStats.ping}<span style={{ fontSize: 9, color: C.dim }}>ms</span></span>
                <span style={{ color: C.cyan }}>{gameStats.cpu}<span style={{ fontSize: 9, color: C.dim }}>%</span></span>
              </div>
              <button onClick={e => { e.stopPropagation(); setHudExpanded(true); }} style={{ ...btn(C.pink), padding: "2px 6px", fontSize: 11, minHeight: "unset" }}>▲</button>
              <button onClick={e => { e.stopPropagation(); setHudVisible(false); }} style={{ background: "none", border: "none", color: C.dim, fontSize: 14, cursor: "pointer" }}>×</button>
            </div>
          ) : (
            <div style={{ background: "#000000f0", border: `1px solid ${C.pink}66`, borderRadius: 8, width: 290, boxShadow: glow(C.pink, 16), backdropFilter: "blur(20px)", overflow: "hidden" }}>
              <div style={{ background: `${C.pink}12`, borderBottom: `1px solid ${C.pink}33`, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span>🎮</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.pink, letterSpacing: 2 }}>OMNIX HUD</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); setHudExpanded(false); }} style={{ ...btn(C.pink), padding: "2px 8px", fontSize: 10, minHeight: "unset" }}>▼ Mini</button>
                  <button onClick={e => { e.stopPropagation(); setHudVisible(false); }} style={{ ...btn(C.red), padding: "2px 8px", fontSize: 10, minHeight: "unset" }}>✕</button>
                </div>
              </div>
              <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { l: "FPS", v: gameStats.fps, c: gameStats.fps > 90 ? C.green : "#f59e0b" },
                  { l: "PING", v: `${gameStats.ping}ms`, c: gameStats.ping < 25 ? C.green : "#f59e0b" },
                  { l: "CPU", v: `${gameStats.cpu}%`, c: C.cyan },
                  { l: "GPU", v: `${gameStats.gpu}%`, c: "#7000ff" },
                  { l: "BAT", v: `${battery.level}%`, c: battery.level > 40 ? C.green : "#f59e0b" },
                  { l: "RAM", v: `${gameStats.ram.toFixed(1)}G`, c: "#06b6d4" },
                ].map(s => (
                  <div key={s.l} style={{ background: "#ffffff06", border: `1px solid ${s.c}22`, borderRadius: 6, padding: "6px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>{s.l}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["Boost FPS", "Fix lag", "Best settings"].map(q => (
                  <button key={q} onClick={e => { e.stopPropagation(); setOverlayAiInput(q); setTimeout(runOverlayAI, 50); }} style={{ ...btn(C.pink), padding: "3px 8px", fontSize: 10, minHeight: "unset" }}>{q}</button>
                ))}
              </div>
              <div style={{ padding: "0 12px 10px", display: "flex", gap: 6 }}>
                <input value={overlayAiInput} onChange={e => { e.stopPropagation(); setOverlayAiInput(e.target.value); }} onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") runOverlayAI(); }} onClick={e => e.stopPropagation()} placeholder="Ask AI..." style={{ ...input_style(C.pink), flex: 1, padding: "6px 10px", fontSize: 11 }} />
                <button onClick={e => { e.stopPropagation(); runOverlayAI(); }} disabled={overlayAiRunning} style={{ ...btn(C.pink, true), padding: "6px 10px", minHeight: "unset" }}>{overlayAiRunning ? "…" : "⚡"}</button>
              </div>
              {overlayLog.length > 0 && (
                <div style={{ borderTop: `1px solid ${C.pink}22`, padding: "8px 12px", maxHeight: 100, overflowY: "auto" }}>
                  {overlayLog.slice(0, 2).map((l, i) => (
                    <div key={i} style={{ marginBottom: 5 }}>
                      <div style={{ fontSize: 10, color: C.pink, fontWeight: 700 }}>▸ {l.q}</div>
                      {l.a && <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.5 }}>{l.a}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Settings Panel ─────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#000000cc", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60 }} onClick={() => setShowSettings(false)}>
          <div style={{ background: "#050508", border: `1px solid ${C.cyan}44`, borderRadius: 8, width: "90%", maxWidth: 480, padding: 20, boxShadow: glow(C.cyan, 20) }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: C.cyan, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>⚙ SETTINGS</span>
              <button onClick={() => setShowSettings(false)} style={{ ...btn(C.red), padding: "4px 10px", minHeight: "unset" }}>✕ Close</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Groq API", color: C.cyan,    placeholder: "Connected via Replit AI" },
                { label: "Gemini",   color: C.green,   placeholder: "Connected via Replit AI" },
                { label: "Ollama",   color: "#06b6d4", placeholder: "Connected via Replit AI" },
              ].map(s => (
                <div key={s.label} style={{ ...card(s.color), padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: glow(C.green, 4) }} />
                    <span style={{ color: s.color, fontSize: 11, fontWeight: 700 }}>{s.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: C.green }}>CONNECTED</span>
                  </div>
                  <input readOnly value={s.placeholder} style={{ ...input_style(s.color), fontSize: 11, color: C.dim }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: C.dim, textAlign: "center" }}>All AI runs through Replit's built-in integration — no keys needed</div>
          </div>
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: "#000000f8", borderBottom: `1px solid ${C.cyan}22`, padding: "0 14px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)", flexShrink: 0 }}>
        {/* Left: logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, filter: `drop-shadow(0 0 8px ${C.cyan})`, animation: "pulse-glow 2s ease-in-out infinite" }}>⚡</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 4, color: C.cyan, textShadow: glow(C.cyan, 10).split(",")[0].replace("0 0 10px", "0 0 12px") }}>OMNIX</div>
            <div style={{ fontSize: 8, color: C.dim, letterSpacing: 3 }}>AGENT ZERO · OPENCLAW · OPENCODE</div>
          </div>
        </div>

        {/* Center: active agent */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${curAgent.color}10`, border: `1px solid ${curAgent.color}33`, borderRadius: 6, padding: "5px 12px" }}>
          <span style={{ fontSize: 14 }}>{curAgent.icon}</span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: curAgent.color, fontWeight: 700, letterSpacing: 1 }}>{curAgent.name}</div>
            <div style={{ fontSize: 9, color: C.dim }}>OMNIX AI · ACTIVE</div>
          </div>
        </div>

        {/* Right: status + controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {gamingMode && <div style={{ fontSize: 10, color: C.pink, background: `${C.pink}18`, border: `1px solid ${C.pink}44`, borderRadius: 4, padding: "2px 8px", animation: "pulse-glow 1s ease-in-out infinite", letterSpacing: 1 }}>GAMING</div>}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {["GROQ", "GEMINI", "OLLAMA"].map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: glow(C.green, 4) }} />
                <span style={{ fontSize: 8, color: C.dim }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ ...btn(C.cyan), padding: "3px 8px", fontSize: 10, minHeight: "unset", background: `${C.cyan}10`, border: `1px solid ${C.cyan}33` }}>
            <span style={{ color: C.cyan }}>{memories.length}</span>
            <span style={{ color: C.dim }}>🧠</span>
          </div>
          <button onClick={() => setShowSettings(s => !s)} style={{ ...btn(C.cyan), padding: "6px 10px", minHeight: 36 }}>⚙</button>
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>

        {/* ═══ CHAT ═══════════════════════════════════════════════════════ */}
        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 52px - 60px)", overflow: "hidden" }}>
            {/* Agent selector */}
            <div style={{ padding: "8px 12px", background: "#03030a", borderBottom: `1px solid ${C.muted}`, display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
              <button onClick={() => setActiveAgent("omega")} style={{ ...btn(C.cyan, activeAgent === "omega"), whiteSpace: "nowrap", padding: "5px 12px" }}>
                <span>⚡</span> AUTO
              </button>
              {AGENTS.map(a => (
                <button key={a.id} onClick={() => setActiveAgent(a.id)} style={{ ...btn(a.color, activeAgent === a.id), whiteSpace: "nowrap", padding: "5px 11px" }}>
                  <span>{a.icon}</span> {a.name}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.map((m, i) => {
                const a = agentInfo(m.agent);
                const isUser = m.role === "user";
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", animation: "slideUp .2s ease" }}>
                    {m.image && <img src={m.image} alt="" style={{ maxWidth: 200, borderRadius: 6, marginBottom: 6, border: `1px solid ${C.cyan}33` }} />}
                    <div style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: 6,
                      background: isUser ? "#0a1628" : C.panel,
                      border: isUser ? `1px solid #1d4ed844` : `1px solid ${a.color}22`,
                      fontSize: 12,
                      lineHeight: 1.8,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      boxShadow: isUser ? "none" : `inset 0 0 0 0 transparent`,
                      borderLeft: isUser ? "none" : `2px solid ${a.color}88`,
                    }}>
                      {m.content}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 10, color: C.dim }}>
                      {m.agent && (
                        <span style={{ padding: "1px 8px", borderRadius: 3, background: `${a.color}15`, border: `1px solid ${a.color}33`, color: a.color, fontSize: 10, letterSpacing: 1 }}>
                          {a.icon} {a.name.toUpperCase()}
                        </span>
                      )}
                      <span>{m.ts?.toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0,1,2,3].map(i => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.cyan, boxShadow: glow(C.cyan, 4), animation: `dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: C.dim, letterSpacing: 1 }}>AGENTS WORKING...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding: "10px 12px", background: "#03030a", borderTop: `1px solid ${C.muted}`, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 6, paddingLeft: 2 }}>
                ▸ {curAgent.name.toUpperCase()} — OMNIX AI
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <button onClick={startVoice} style={{ ...btn(C.cyan, voice), padding: "10px 12px", fontSize: 15, flexShrink: 0, boxShadow: voice ? glow(C.cyan, 8) : "none" }}>🎤</button>
                <textarea
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder='Ask anything... "build me a game" · "optimize FPS" · "hack mode"'
                  rows={2}
                  style={{ flex: 1, background: "#08080e", border: `1px solid ${C.muted}`, borderRadius: 6, padding: "10px 13px", color: C.text, fontSize: 12, fontFamily: "JetBrains Mono, monospace", resize: "none", outline: "none", transition: "border-color .2s, box-shadow .2s" }}
                  onFocus={e => { e.target.style.borderColor = C.cyan + "66"; e.target.style.boxShadow = glow(C.cyan, 6); }}
                  onBlur={e => { e.target.style.borderColor = C.muted; e.target.style.boxShadow = "none"; }}
                />
                <button onClick={send} disabled={loading} style={{ background: loading ? C.muted : `linear-gradient(135deg, ${C.cyan}, ${C.purple})`, border: "none", borderRadius: 6, padding: "10px 20px", color: "#000", cursor: loading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 900, flexShrink: 0, boxShadow: loading ? "none" : glow(C.cyan, 10), minWidth: 52, minHeight: 44 }}>→</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ AGENTS ═════════════════════════════════════════════════════ */}
        {tab === "agents" && (
          <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 14 }}>8 ACTIVE AGENTS — OMNIX FRAMEWORK — POWERED BY REPLIT AI</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {AGENTS.map(a => (
                <div key={a.id} onClick={() => { setActiveAgent(a.id); setTab("chat"); }}
                  style={{ ...card(a.color), padding: 14, cursor: "pointer", borderColor: activeAgent === a.id ? `${a.color}55` : C.muted, boxShadow: activeAgent === a.id ? glow(a.color, 8) : "none", position: "relative", transition: "all .2s" }}>
                  {activeAgent === a.id && (
                    <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: a.color, background: `${a.color}20`, border: `1px solid ${a.color}44`, borderRadius: 3, padding: "1px 6px", letterSpacing: 1 }}>ACTIVE</div>
                  )}
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{a.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: a.color, marginBottom: 4, letterSpacing: 1 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginBottom: 8 }}>{a.desc}</div>
                  <div style={{ fontSize: 9, color: `${a.color}88`, background: `${a.color}10`, border: `1px solid ${a.color}22`, borderRadius: 3, padding: "2px 7px", display: "inline-block", letterSpacing: 1 }}>
                    {AI_PROVIDERS[a.provider as keyof typeof AI_PROVIDERS]?.name || a.provider}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ BUILD ══════════════════════════════════════════════════════ */}
        {tab === "build" && (
          <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            {/* Pipeline diagram */}
            <div style={{ ...card(), padding: 14, borderColor: `${C.cyan}22` }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 12, textAlign: "center" }}>8-AGENT PIPELINE — ALL AIs WORKING IN SEQUENCE</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 2 }}>
                {AGENTS.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <div style={{
                      background: building && pipeStep === i + 1 ? `${a.color}25` : `${a.color}08`,
                      border: `1px solid ${building && pipeStep === i + 1 ? a.color : a.color + "44"}`,
                      borderRadius: 6, padding: "8px 10px", textAlign: "center", minWidth: 64,
                      boxShadow: building && pipeStep === i + 1 ? glow(a.color, 10) : "none",
                      transition: "all .3s",
                      animation: building && pipeStep === i + 1 ? "pulse-glow 0.8s ease-in-out infinite" : "none",
                    }}>
                      <div style={{ fontSize: 16 }}>{a.icon}</div>
                      <div style={{ fontSize: 8, color: a.color, fontWeight: 700, letterSpacing: 0.5 }}>{a.name.toUpperCase()}</div>
                    </div>
                    {i < AGENTS.length - 1 && (
                      <div style={{ width: 16, height: 2, background: building && pipeStep > i + 1 ? C.cyan : C.muted, boxShadow: building && pipeStep > i + 1 ? glow(C.cyan, 4) : "none", transition: "all .3s" }} />
                    )}
                  </div>
                ))}
              </div>
              {building && pipeStep > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 9, color: C.dim, marginBottom: 4, letterSpacing: 1 }}>STEP {pipeStep}/8</div>
                  <div style={{ height: 3, background: C.muted, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${(pipeStep / 8) * 100}%`, background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})`, borderRadius: 2, boxShadow: glow(C.cyan, 4), transition: "width .5s" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Goal input */}
            <div style={{ ...card(), padding: 14 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 8 }}>▸ WHAT DO YOU WANT TO BUILD?</div>
              <textarea value={buildGoal} onChange={e => setBuildGoal(e.target.value)}
                placeholder={"e.g. A Minecraft mod\ne.g. Fortnite hack detector\ne.g. Full-stack mobile app\ne.g. iOS game in Swift"}
                rows={4}
                style={{ ...input_style(), resize: "none" }}
                onFocus={e => { e.target.style.borderColor = C.cyan + "55"; e.target.style.boxShadow = glow(C.cyan, 6); }}
                onBlur={e => { e.target.style.borderColor = C.muted; e.target.style.boxShadow = "none"; }}
              />
              <button onClick={() => buildGoal.trim() && runPipeline(buildGoal)} disabled={building || !buildGoal.trim()}
                style={{ marginTop: 10, width: "100%", padding: 14, background: building ? C.muted : `linear-gradient(135deg, ${C.cyan}, ${C.purple})`, border: "none", borderRadius: 6, color: building ? C.dim : "#000", cursor: building ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 900, letterSpacing: 2, boxShadow: building ? "none" : glow(C.cyan, 12), fontFamily: "JetBrains Mono, monospace", minHeight: 48 }}>
                {building ? `⚙ STEP ${pipeStep}/8 — AGENTS WORKING...` : "▶ LAUNCH 8-AGENT PIPELINE"}
              </button>
            </div>

            {/* Templates */}
            <div style={{ ...card(), padding: 12 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 8 }}>TEMPLATES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Minecraft mod", "iOS game", "Discord bot", "Security tool", "Roblox script", "React app", "Python AI", "Chrome extension", "VS Code extension", "Hack tool (edu)"].map(t => (
                  <button key={t} onClick={() => setBuildGoal(t)} style={{ ...btn(C.cyan), padding: "5px 10px", fontSize: 10 }}>{t}</button>
                ))}
              </div>
            </div>

            {/* Live log */}
            {pipeLog.length > 0 && (
              <div style={{ ...card(), padding: 12, maxHeight: 280, overflowY: "auto" }}>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 8 }}>LIVE AGENT LOG</div>
                {pipeLog.map((l, i) => {
                  const a = agentInfo(l.agent);
                  return (
                    <div key={i} style={{ marginBottom: 10, borderLeft: `2px solid ${a.color}55`, paddingLeft: 10 }}>
                      <div style={{ fontSize: 9, color: a.color, marginBottom: 2, letterSpacing: 1 }}>{a.icon} STEP {l.step} · {l.agent.toUpperCase()} · {l.ts.toLocaleTimeString()}</div>
                      <div style={{ fontSize: 11, color: "#4b5563", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 55, overflow: "hidden", lineHeight: 1.5 }}>{l.text.slice(0, 220)}{l.text.length > 220 && "..."}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {buildNote && (
              <div style={{ ...card(), padding: 12, borderColor: `${C.green}44`, boxShadow: glow(C.green, 8) }}>
                <div style={{ fontSize: 12, color: C.green, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{buildNote}</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ CODE ═══════════════════════════════════════════════════════ */}
        {tab === "code" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 52px - 60px)", overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ padding: "8px 12px", background: "#03030a", borderBottom: `1px solid ${C.muted}`, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: C.cyan, fontFamily: "monospace", marginRight: 4 }}>code.{lang}</div>
              <select value={lang} onChange={e => setLang(e.target.value)} style={{ background: "#0a0a0f", border: `1px solid ${C.muted}`, borderRadius: 4, padding: "5px 9px", color: C.text, fontSize: 11, fontFamily: "monospace", cursor: "pointer", outline: "none" }}>
                {["javascript","python","typescript","swift","kotlin","html","css","bash","json","rust","go","c","cpp","java","lua","gdscript"].map(l => <option key={l}>{l}</option>)}
              </select>
              {[
                { label: "🏗 Pipeline", color: C.purple, fn: () => runPipeline(`Improve:\n${code}`) },
                { label: "🐛 Debug",    color: C.green,  fn: () => callAgent("coder", `Debug and fix:\n${code}`).then(r => { addMsg("coder", r.text); setTab("chat"); }) },
                { label: "💀 DevGod",  color: C.red,    fn: () => callAgent("devgod", `Unrestricted review:\n${code}`).then(r => { addMsg("devgod", r.text); setTab("chat"); }) },
                { label: "🔬 Audit",   color: C.cyan,   fn: () => callAgent("analyst", `Security audit:\n${code}`).then(r => { addMsg("analyst", r.text); setTab("chat"); }) },
              ].map(b => (
                <button key={b.label} onClick={b.fn} style={{ ...btn(b.color), padding: "5px 10px", fontSize: 10 }}>{b.label}</button>
              ))}
              <button onClick={() => { const blob = new Blob([code], { type: "text/plain" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `code.${lang}`; a.click(); }}
                style={{ ...btn(C.cyan), padding: "5px 10px", fontSize: 10, marginLeft: "auto" }}>💾 Save</button>
            </div>
            {/* Editor area */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {/* Line numbers */}
              <div style={{ background: "#030306", borderRight: `1px solid ${C.muted}`, padding: "16px 10px", fontFamily: "monospace", fontSize: 12, color: C.dim, lineHeight: 1.75, userSelect: "none", minWidth: 42, textAlign: "right" }}>
                {code.split("\n").map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)}
                style={{ flex: 1, background: "#030306", border: "none", padding: "16px 14px", color: "#00f5cc", fontSize: 12, fontFamily: "JetBrains Mono, 'Fira Code', monospace", resize: "none", outline: "none", lineHeight: 1.75 }}
                spellCheck={false} />
            </div>
            {/* Status bar */}
            <div style={{ background: "#03030a", borderTop: `1px solid ${C.muted}`, padding: "3px 12px", fontSize: 9, color: C.dim, display: "flex", gap: 16, letterSpacing: 1 }}>
              <span>LANG: {lang.toUpperCase()}</span>
              <span>LINES: {code.split("\n").length}</span>
              <span>CHARS: {code.length}</span>
              <span style={{ color: C.cyan }}>OMNIX CODE EDITOR</span>
            </div>
          </div>
        )}

        {/* ═══ FILES ══════════════════════════════════════════════════════ */}
        {tab === "files" && (
          <div style={{ flex: 1, display: "flex", height: "calc(100vh - 52px - 60px)", overflow: "hidden" }}>
            {/* Sidebar */}
            <div style={{ width: 200, borderRight: `1px solid ${C.muted}`, background: "#030306", display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.muted}`, display: "flex", gap: 6 }}>
                <button onClick={() => setShowNewFile(true)} style={{ ...btn(C.cyan), flex: 1, fontSize: 10, justifyContent: "center" }}>+ New</button>
                <label style={{ ...btn(C.cyan), fontSize: 13, cursor: "pointer", padding: "6px 10px" }}>
                  📎 <input type="file" style={{ display: "none" }} multiple onChange={handleUpload} />
                </label>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>{renderFileTree(files)}</div>
              {uploadedFiles.length > 0 && <div style={{ padding: "5px 10px", borderTop: `1px solid ${C.muted}`, fontSize: 9, color: C.dim, letterSpacing: 1 }}>{uploadedFiles.length} UPLOADED</div>}
            </div>
            {/* Editor */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {showNewFile ? (
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 11, color: C.cyan, fontWeight: 700, letterSpacing: 2 }}>CREATE NEW FILE</div>
                  <input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="filename.js" style={input_style()} onFocus={e => { e.target.style.borderColor = C.cyan + "55"; }} onBlur={e => { e.target.style.borderColor = C.muted; }} />
                  <textarea value={newFileContent} onChange={e => setNewFileContent(e.target.value)} placeholder="File content..." rows={8}
                    style={{ ...input_style(), resize: "none" }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={createFile} style={{ ...btn(C.cyan, true), flex: 1, justifyContent: "center" }}>✅ Create</button>
                    <button onClick={() => setShowNewFile(false)} style={{ ...btn(), flex: 1, justifyContent: "center" }}>Cancel</button>
                  </div>
                </div>
              ) : selFile ? (
                <>
                  <div style={{ padding: "8px 12px", background: "#030306", borderBottom: `1px solid ${C.muted}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>{fileIcon(selFile)}</span>
                    <span style={{ fontSize: 11, color: C.cyan, fontFamily: "monospace" }}>{selFile.name}</span>
                    <span style={{ fontSize: 9, color: C.dim }}>{selFile.size}</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button onClick={() => callAgent("analyst", `Analyse: ${selFile.name}\n\n${fileContent.slice(0, 3000)}`).then(r => { addMsg("analyst", r.text); setTab("chat"); })} style={{ ...btn("#06b6d4"), fontSize: 10, padding: "4px 9px" }}>🔬 Analyse</button>
                      <button onClick={() => runPipeline(`Improve: ${selFile.name}\n${fileContent.slice(0, 2000)}`)} style={{ ...btn(C.purple), fontSize: 10, padding: "4px 9px" }}>🏗 Improve</button>
                      <button onClick={() => downloadFile({ ...selFile, content: fileContent })} style={{ ...btn(C.cyan), fontSize: 10, padding: "4px 9px" }}>💾</button>
                    </div>
                  </div>
                  <textarea value={fileContent} onChange={e => setFileContent(e.target.value)}
                    style={{ flex: 1, background: "#030306", border: "none", padding: 14, color: "#00f5cc", fontSize: 12, fontFamily: "JetBrains Mono, 'Fira Code', monospace", resize: "none", outline: "none", lineHeight: 1.7 }}
                    spellCheck={false} />
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.dim, gap: 10 }}>
                  <div style={{ fontSize: 48, opacity: 0.3 }}>📁</div>
                  <div style={{ fontSize: 12, letterSpacing: 2 }}>SELECT OR CREATE A FILE</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ CAMERA ═════════════════════════════════════════════════════ */}
        {tab === "camera" && (
          <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            {/* Preview */}
            <div style={{ background: "#030306", border: `1px solid ${camOn ? C.cyan + "55" : C.muted}`, borderRadius: 8, overflow: "hidden", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: camOn ? glow(C.cyan, 10) : "none", transition: "all .3s" }}>
              {camOn
                ? <video ref={vidRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: camFilter === "grayscale" ? "grayscale(100%)" : camFilter === "vivid" ? "saturate(200%) contrast(110%)" : "none" }} />
                : <div style={{ textAlign: "center", color: C.dim }}>
                    <div style={{ fontSize: 64, opacity: 0.3 }}>📷</div>
                    <div style={{ fontSize: 12, marginTop: 8, letterSpacing: 2 }}>CAMERA OFFLINE</div>
                    {camErr && <div style={{ fontSize: 10, color: C.red, marginTop: 6, padding: "0 20px" }}>{camErr}</div>}
                  </div>
              }
              {camOn && (
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
                  <button onClick={flipCam} style={{ background: "#000000aa", border: `1px solid ${C.cyan}44`, borderRadius: 6, color: C.text, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>🔄</button>
                  {["none", "grayscale", "vivid"].map(f => (
                    <button key={f} onClick={() => setCamFilter(f)} style={{ background: camFilter === f ? `${C.cyan}22` : "#000000aa", border: `1px solid ${camFilter === f ? C.cyan : C.muted}`, borderRadius: 6, color: camFilter === f ? C.cyan : C.dim, padding: "5px 10px", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>{f}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={camOn ? stopCam : startCam} style={{ flex: 1, padding: 13, borderRadius: 6, background: camOn ? "#1a0a0a" : "#0a1a0a", border: `1px solid ${camOn ? C.red + "55" : C.green + "55"}`, color: camOn ? C.red : C.green, cursor: "pointer", fontSize: 13, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}>{camOn ? "⏹ STOP" : "▶ START CAMERA"}</button>
              {camOn && (
                <button onClick={capturePhoto} style={{ flex: 2, padding: 13, borderRadius: 6, background: `linear-gradient(135deg, ${C.cyan}, ${C.purple})`, border: "none", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 900, letterSpacing: 1, boxShadow: glow(C.cyan, 10), fontFamily: "monospace" }}>📸 CAPTURE + AI ANALYSE</button>
              )}
            </div>

            {/* Photo strip */}
            {camPhotos.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 8 }}>CAPTURED ({camPhotos.length})</div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {camPhotos.map((p, i) => (
                    <img key={i} src={p.b64} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.cyan}33`, flexShrink: 0, cursor: "pointer", transition: "all .15s" }}
                      onClick={() => { setMessages(m => [...m, { role: "user", content: "📸 Re-analysing photo...", image: p.b64, ts: new Date() }]); callAgent("analyst", "Analyse this image in extreme detail.").then(r => { addMsg("analyst", r.text); setTab("chat"); }); }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ GAMING ═════════════════════════════════════════════════════ */}
        {tab === "gaming" && (
          <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            {/* HUD Control */}
            <div style={{ background: gamingMode ? "#0d0005" : C.panel, border: `1px solid ${C.pink}44`, borderRadius: 6, padding: 14, boxShadow: gamingMode ? glow(C.pink, 8) : "none", transition: "all .5s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.pink, letterSpacing: 2 }}>🎮 GAMING HUD CONTROL</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setHudVisible(!hudVisible); if (!hudVisible) setGamingMode(true); }}
                    style={{ ...btn(C.pink, hudVisible), padding: "7px 14px", fontWeight: 700 }}>
                    {hudVisible ? "🔴 HUD ON" : "○ HUD OFF"}
                  </button>
                  <button onClick={() => setGamingMode(g => !g)}
                    style={{ ...btn(C.pink, gamingMode), padding: "7px 12px" }}>
                    {gamingMode ? "GAMING ON" : "GAMING OFF"}
                  </button>
                </div>
              </div>
              {hudVisible && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={hudCommand} onChange={e => setHudCommand(e.target.value)} onKeyDown={e => e.key === "Enter" && runHudCommand()}
                    placeholder="Ask GameAI while playing..." style={{ ...input_style(C.pink), flex: 1 }}
                    onFocus={e => { e.target.style.borderColor = C.pink + "55"; e.target.style.boxShadow = glow(C.pink, 5); }}
                    onBlur={e => { e.target.style.borderColor = C.muted; e.target.style.boxShadow = "none"; }}
                  />
                  <button onClick={runHudCommand} disabled={hudCmdRunning} style={{ ...btn(C.pink, true), padding: "10px 14px" }}>
                    {hudCmdRunning ? "…" : "⚡"}
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ l: "Top Left", x: 12, y: 120 }, { l: "Top Right", x: window.innerWidth - 160, y: 120 }, { l: "Bottom", x: 12, y: window.innerHeight - 200 }].map(p => (
                  <button key={p.l} onClick={() => setHudPos({ x: p.x, y: p.y })} style={{ ...btn(C.pink), fontSize: 10, padding: "4px 10px" }}>{p.l}</button>
                ))}
              </div>
            </div>

            {/* Live stats */}
            <div style={{ ...card(), padding: 14 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 12 }}>LIVE PERFORMANCE</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { l: "FPS",  v: gameStats.fps,            u: "",   c: gameStats.fps > 100 ? C.green : gameStats.fps > 60 ? "#f59e0b" : C.red },
                  { l: "PING", v: gameStats.ping,            u: "ms", c: gameStats.ping < 20 ? C.green : gameStats.ping < 50 ? "#f59e0b" : C.red },
                  { l: "CPU",  v: gameStats.cpu,             u: "%",  c: gameStats.cpu < 50 ? C.green : gameStats.cpu < 80 ? "#f59e0b" : C.red },
                  { l: "GPU",  v: gameStats.gpu,             u: "%",  c: gameStats.gpu < 70 ? C.green : gameStats.gpu < 90 ? "#f59e0b" : C.red },
                  { l: "RAM",  v: gameStats.ram.toFixed(1),  u: "GB", c: C.cyan },
                  { l: "TEMP", v: gameStats.temp,            u: "°C", c: gameStats.temp < 45 ? C.green : gameStats.temp < 55 ? "#f59e0b" : C.red },
                ].map(s => (
                  <div key={s.l} style={{ background: "#080810", border: `1px solid ${s.c}33`, borderRadius: 6, padding: "12px 8px", textAlign: "center", boxShadow: `inset 0 0 12px ${s.c}08` }}>
                    <div style={{ fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: s.c, lineHeight: 1, textShadow: `0 0 12px ${s.c}66` }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{s.u}</div>
                    <div style={{ height: 2, background: C.muted, borderRadius: 2, marginTop: 6 }}>
                      <div style={{ height: "100%", width: `${Math.min(100, typeof s.v === "number" ? s.v : 50)}%`, background: s.c, borderRadius: 2, boxShadow: `0 0 4px ${s.c}`, transition: "width .5s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div style={{ ...card(), padding: 14 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 10 }}>PERFORMANCE PRESETS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {GAMING_PRESETS.map(p => (
                  <button key={p.id} onClick={() => { setGamingPreset(p.id); setGamingMode(true); setHudVisible(true); }}
                    style={{ ...btn(p.color, gamingPreset === p.id), display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", textAlign: "left", width: "100%", boxShadow: gamingPreset === p.id ? glow(p.color, 8) : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{p.desc}</div>
                    </div>
                    {gamingPreset === p.id && <div style={{ color: p.color }}>✓</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* GameAI */}
            <div style={{ ...card(), padding: 14, borderColor: `${C.pink}33`, boxShadow: gamingMode ? glow(C.pink, 6) : "none" }}>
              <div style={{ fontSize: 9, color: C.pink, letterSpacing: 3, marginBottom: 10 }}>🤖 GAMEAI QUICK COMMANDS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {["Max FPS on iPad", "Best Minecraft settings", "Reduce ping in Fortnite", "Roblox anti-lag", "Game mods guide", "Competitive settings", "Best iOS games 2026", "Recording tips"].map(q => (
                  <button key={q} onClick={() => { setInput(q); setActiveAgent("gamer"); setTab("chat"); }} style={{ ...btn(C.pink), fontSize: 10, padding: "4px 10px" }}>{q}</button>
                ))}
              </div>
              {gameNotes.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 6 }}>RECENT HUD COMMANDS</div>
                  {gameNotes.slice(0, 4).map((n, i) => (
                    <div key={i} style={{ fontSize: 10, color: C.dim, padding: "5px 8px", background: "#080810", borderRadius: 4, marginBottom: 4, borderLeft: `2px solid ${C.pink}44` }}>{n.text}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ PERMISSIONS ════════════════════════════════════════════════ */}
        {tab === "perms" && (
          <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3 }}>DEVICE PERMISSIONS — OMNIX CONTROL CENTER</div>
              <button onClick={requestAllPerms} style={{ ...btn(C.cyan, true), fontSize: 10, padding: "6px 12px" }}>Request All →</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { key: "camera",        icon: "📷", label: "Camera",        desc: "Full camera access — front & back, AI analysis" },
                { key: "microphone",    icon: "🎤", label: "Microphone",    desc: "Voice input, audio recording, transcription" },
                { key: "location",      icon: "📍", label: "Location",      desc: "GPS — location-aware AI responses" },
                { key: "notifications", icon: "🔔", label: "Notifications", desc: "Push alerts when AI tasks complete" },
                { key: "motion",        icon: "📱", label: "Motion/Gyro",   desc: "Accelerometer, gyroscope, device sensors" },
                { key: "storage",       icon: "💾", label: "Storage",       desc: "Read/write files, iOS Files app access" },
              ].map(p => {
                const granted = perms[p.key as keyof typeof perms];
                return (
                  <div key={p.key} style={{ ...card(), padding: 14, display: "flex", alignItems: "center", gap: 12, borderColor: granted ? `${C.green}44` : C.muted, boxShadow: granted ? glow(C.green, 4) : "none", transition: "all .3s" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 6, background: granted ? `${C.green}15` : "#0a0a0a", border: `1px solid ${granted ? C.green + "44" : C.muted}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{p.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: granted ? C.green : C.text, letterSpacing: 1 }}>{p.label}</div>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: granted ? C.green : C.muted, boxShadow: granted ? glow(C.green, 4) : "none" }} />
                      </div>
                      <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{p.desc}</div>
                      {p.key === "location" && location && <div style={{ fontSize: 10, color: C.cyan, marginTop: 3 }}>📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>}
                    </div>
                    <button onClick={() => requestPerm(p.key)} style={{ ...btn(granted ? C.green : C.cyan, granted), whiteSpace: "nowrap", fontWeight: 700, padding: "8px 14px" }}>
                      {granted ? "✅ GRANTED" : "Request →"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, ...card(), padding: 12 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3, marginBottom: 10 }}>PERMISSION STATUS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(perms).map(([k, v]) => (
                  <div key={k} style={{ background: v ? `${C.green}15` : "#0a0a0a", border: `1px solid ${v ? C.green + "44" : C.muted}`, borderRadius: 4, padding: "4px 10px", fontSize: 10, color: v ? C.green : C.dim, boxShadow: v ? glow(C.green, 4) : "none" }}>
                    {v ? "●" : "○"} {k}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MEMORY ═════════════════════════════════════════════════════ */}
        {tab === "memory" && (
          <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 3 }}>PERSISTENT MEMORY ({memories.length})</div>
              <button onClick={() => setMemories([])} style={{ ...btn(C.red), fontSize: 10, padding: "6px 12px" }}>🗑 Clear All</button>
            </div>
            <input value={memSearch} onChange={e => setMemSearch(e.target.value)} placeholder="Search memories..." style={input_style()}
              onFocus={e => { e.target.style.borderColor = C.cyan + "55"; e.target.style.boxShadow = glow(C.cyan, 5); }}
              onBlur={e => { e.target.style.borderColor = C.muted; e.target.style.boxShadow = "none"; }}
            />
            {memories.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.dim, gap: 10, paddingTop: 60 }}>
                <div style={{ fontSize: 64, opacity: 0.15 }}>🧠</div>
                <div style={{ fontSize: 11, letterSpacing: 2 }}>NO MEMORIES YET</div>
                <div style={{ fontSize: 10, color: "#1f2937", textAlign: "center", lineHeight: 1.6 }}>Chat with agents and OMNIX will<br />remember your conversations</div>
              </div>
            ) : (
              memories.filter(m => !memSearch || m.q.toLowerCase().includes(memSearch.toLowerCase()) || m.a.toLowerCase().includes(memSearch.toLowerCase()))
                .slice().reverse().map((m, i) => (
                  <div key={i} style={{ ...card(), padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: C.cyan, fontWeight: 700, flex: 1, marginRight: 8 }}>▸ {m.q}</div>
                      <button onClick={() => setMemories(mm => mm.filter((_, j) => mm.length - 1 - j !== i))} style={{ ...btn(C.red), padding: "2px 7px", fontSize: 10, minHeight: "unset", flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.6 }}>{m.a}</div>
                    <div style={{ fontSize: 9, color: "#1f2937", marginTop: 6, letterSpacing: 1 }}>{new Date(m.ts).toLocaleString()}</div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* ═══ TERMINAL ═══════════════════════════════════════════════════ */}
        {tab === "term" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 52px - 60px)", background: "#000000", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 12, lineHeight: 1.8 }}>
              {termOut.map((line, i) => {
                let color = C.dim;
                if (line.startsWith("$")) color = C.cyan;
                else if (line.startsWith("✅") || line.startsWith("🎮")) color = C.green;
                else if (line.startsWith("⚠️") || line.startsWith("zsh:")) color = C.red;
                else if (line.startsWith("🤖") || line.includes("→")) color = "#a855f7";
                else if (line.startsWith("⚡")) color = C.cyan;
                return <div key={i} style={{ color, textShadow: color === C.cyan ? `0 0 8px ${C.cyan}66` : "none" }}>{line || " "}</div>;
              })}
              <div ref={termEndRef} />
            </div>
            <div style={{ padding: "8px 14px", background: "#03030a", borderTop: `1px solid ${C.muted}`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.cyan, fontSize: 16, textShadow: glow(C.cyan, 6) }}>⚡</span>
              <input value={termIn} onChange={e => setTermIn(e.target.value)} onKeyDown={termKeyDown}
                placeholder="help · omega <msg> · build <goal> · game on..."
                style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 12, fontFamily: "JetBrains Mono, monospace", outline: "none" }}
                autoFocus />
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Tab Bar ──────────────────────────────────────────────── */}
      <div style={{ background: "#000000f8", borderTop: `1px solid ${C.cyan}22`, display: "flex", position: "sticky", bottom: 0, zIndex: 99, backdropFilter: "blur(20px)", height: 60, flexShrink: 0, boxShadow: `0 -4px 24px #00000088` }}>
        {TABS.map(t => {
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, background: "transparent", border: "none", borderTop: isActive ? `2px solid ${C.cyan}` : "2px solid transparent", color: isActive ? C.cyan : C.dim, cursor: "pointer", fontSize: 9, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, transition: "all .15s", padding: "6px 2px", textShadow: isActive ? `0 0 8px ${C.cyan}88` : "none", boxShadow: isActive ? `inset 0 2px 8px ${C.cyan}15` : "none", minWidth: 40 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 8, letterSpacing: 1 }}>{t.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Global Styles ───────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #111; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #1a1a1a; }

        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        button:active { transform: scale(0.96); }
        input:focus, textarea:focus { outline: none; }
        select:focus { outline: none; }
      `}</style>
    </div>
  );
}
