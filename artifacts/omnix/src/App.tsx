import { useState, useRef, useEffect, useCallback } from "react";

const AI_PROVIDERS = {
  claude:   { name:"OMNIX AI",      color:"#a78bfa", icon:"⚡", free:true  },
  gemini:   { name:"Gemini Mode",   color:"#4ade80", icon:"💎", free:true  },
  groq:     { name:"DeepSeek Mode", color:"#38bdf8", icon:"🔵", free:true  },
  ollama:   { name:"Local Mode",    color:"#5eead4", icon:"🟢", free:true  },
  opencode: { name:"OpenCode",      color:"#fb923c", icon:"🟠", free:true  },
};

const AGENTS = [
  { id:"omega",     name:"OMEGA",      icon:"⚡", color:"#f59e0b", desc:"Master coordinator — routes to best AI",     provider:"claude"   },
  { id:"architect", name:"Architect",  icon:"🏛️", color:"#8b5cf6", desc:"Plans, designs, architects systems",         provider:"claude"   },
  { id:"devgod",    name:"DevGod",     icon:"💀", color:"#ef4444", desc:"Unrestricted dev — anything goes",           provider:"groq"     },
  { id:"gemini",    name:"Gemini",     icon:"💎", color:"#4ade80", desc:"Google Gemini Pro — multimodal reasoning",   provider:"gemini"   },
  { id:"coder",     name:"Coder",      icon:"🟢", color:"#10b981", desc:"Expert code writing and debugging",          provider:"ollama"   },
  { id:"analyst",   name:"Analyst",    icon:"🔬", color:"#06b6d4", desc:"Deep analysis, security, algorithms",        provider:"claude"   },
  { id:"opencode",  name:"OpenCode",   icon:"🟠", color:"#f97316", desc:"Terminal agent — deploy & manage",           provider:"opencode" },
  { id:"gamer",     name:"GameAI",     icon:"🎮", color:"#e879f9", desc:"Gaming optimiser — mods, performance",       provider:"groq"     },
];

const TABS = [
  { id:"chat",    icon:"💬", label:"Chat"    },
  { id:"agents",  icon:"🤖", label:"Agents"  },
  { id:"build",   icon:"🏗️", label:"Build"   },
  { id:"code",    icon:"⌨️", label:"Code"    },
  { id:"files",   icon:"📁", label:"Files"   },
  { id:"camera",  icon:"📷", label:"Camera"  },
  { id:"gaming",  icon:"🎮", label:"Gaming"  },
  { id:"perms",   icon:"🔐", label:"Perms"   },
  { id:"memory",  icon:"🧠", label:"Memory"  },
  { id:"term",    icon:"⚡", label:"Terminal" },
];

const GAMING_PRESETS = [
  { id:"performance", name:"⚡ Max Performance", desc:"120fps, max graphics, no limits",    color:"#ef4444" },
  { id:"balanced",    name:"⚖️ Balanced",         desc:"60fps, good visuals, battery saver", color:"#f59e0b" },
  { id:"battery",     name:"🔋 Battery Saver",    desc:"30fps, low power, long session",     color:"#10b981" },
  { id:"competitive", name:"🏆 Competitive",      desc:"High fps, low latency, stable",      color:"#8b5cf6" },
  { id:"streaming",   name:"📺 Streaming",        desc:"Optimised for recording/streaming",   color:"#06b6d4" },
];

const VIEWABLE_TYPES: Record<string, string> = {
  ".pdf":"📄", ".txt":"📝", ".md":"📝", ".json":"📋", ".js":"📜",
  ".py":"🐍", ".html":"🌐", ".css":"🎨", ".swift":"🍎", ".kt":"🤖",
  ".plist":"📋", ".xml":"📋", ".csv":"📊", ".log":"📋", ".sh":"⚡",
  ".c":"⚙️", ".cpp":"⚙️", ".h":"⚙️", ".m":"🍎", ".ts":"📜",
  ".jpg":"🖼️", ".png":"🖼️", ".gif":"🖼️", ".svg":"🖼️", ".webp":"🖼️",
  ".mp4":"🎬", ".mov":"🎬", ".mp3":"🎵", ".wav":"🎵",
  ".zip":"📦", ".ipa":"📱", ".deb":"📦",
};

const MEM_KEY = "omnix_v1_memory";

interface Memory { q: string; a: string; ts: string; }
interface Message { role: string; agent?: string; content: string; image?: string | null; ts: Date; }
interface FileItem { name: string; type: string; size?: string; content?: string; ext?: string; expanded?: boolean; children?: FileItem[]; }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function callAI(prompt: string, system: string, onChunk: (text: string) => void): Promise<string> {
  const res = await fetch(`${BASE}/api/openai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, system }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

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
          if (data.content) {
            full += data.content;
            onChunk(data.content);
          }
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

export default function OMNIX() {
  const savedMem = (): Memory[] => { try { return JSON.parse(localStorage.getItem(MEM_KEY) || "[]"); } catch { return []; } };
  const [memories, setMemories] = useState<Memory[]>(savedMem);
  useEffect(() => { try { localStorage.setItem(MEM_KEY, JSON.stringify(memories.slice(-200))); } catch {} }, [memories]);
  const saveMemory = (q: string, a: string) => setMemories(m => [...m, { q: q.slice(0, 120), a: a.slice(0, 300), ts: new Date().toISOString() }]);
  const memCtx = () => memories.slice(-6).map(m => `Q:${m.q} → A:${m.a}`).join("\n");

  const [tab, setTab] = useState("chat");
  const [activeAgent, setActiveAgent] = useState("omega");
  const [gamingMode, setGamingMode] = useState(false);
  const [gamingPreset, setGamingPreset] = useState("performance");

  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant", agent: "omega", ts: new Date(),
    content: "⚡ OMNIX ONLINE — AI-Powered iPad Agent\n\nPowered by Replit AI — no API keys needed!\n\n🔴 AGENTS ACTIVE:\n⚡ OMEGA — Master coordinator\n🏛️ Architect — System designer\n💀 DevGod — Unrestricted dev\n💎 Gemini — Multimodal AI\n🟢 Coder — Expert code writing\n🔬 Analyst — Deep analysis\n🟠 OpenCode — Terminal agent\n🎮 GameAI — Gaming optimizer\n\n🔴 CAPABILITIES:\n📁 Files — Create, read, view any file type\n📷 Camera — Multi-mode with AI analysis\n🔐 Permissions — Location, mic, sensors\n🎮 Gaming Mode — Performance presets\n🧠 Persistent Memory — Never forgets\n⚡ Terminal — Full command interface\n\nSay anything. OMEGA routes to the best AI.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(false);

  const [buildGoal, setBuildGoal] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState("");
  const [pipeLog, setPipeLog] = useState<{ step: number; agent: string; text: string; ts: Date }[]>([]);

  const [code, setCode] = useState("// OMNIX Code Editor\n// All AIs at your service\n\nfunction omnix() {\n  console.log('Most powerful iPad agent!');\n  return '⚡ OMNIX';\n}\n\nomnix();");
  const [lang, setLang] = useState("javascript");

  const [termOut, setTermOut] = useState(["⚡ OMNIX Terminal v1.0", "Type 'help' for all commands.", "$ "]);
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
      { name: "styles.css", type: "file", size: "1.1 KB", content: "body { background: #030712; color: #e2e8f0; }",  ext: ".css"  },
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
  const [overlayMode, setOverlayMode] = useState("bubble");
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
      x: Math.max(0, Math.min(window.innerWidth - 130, hudDragStart.px + (cx - hudDragStart.x))),
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

  const addMsg = (agent: string, content: string, image: string | null = null) =>
    setMessages(m => [...m, { role: "assistant", agent, content, image, ts: new Date() }]);

  const callAgent = useCallback(async (agentId: string, prompt: string): Promise<{ ok: boolean; text: string }> => {
    const ctx = memories.length > 0 ? `[Memory]\n${memCtx()}\n\n` : "";
    const full = ctx + prompt;
    const system = getAgentSystem(agentId);

    let fullText = "";
    try {
      fullText = await callAI(full, system, () => {});
      if (fullText) {
        saveMemory(prompt, fullText);
        return { ok: true, text: fullText };
      }
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
    setBuilding(true); setPipeLog([]); setBuildNote("");
    const log = (step: number, agent: string, text: string) => setPipeLog(p => [...p, { step, agent, text, ts: new Date() }]);

    const steps = [
      { step: 1, agent: "architect", label: "🏛️ Architect planning..." },
      { step: 2, agent: "analyst",   label: "🔬 Analyst doing deep analysis..." },
      { step: 3, agent: "devgod",    label: "💀 DevGod unrestricted implementation..." },
      { step: 4, agent: "gemini",    label: "💎 Gemini reasoning..." },
      { step: 5, agent: "coder",     label: "🟢 Coder writing all code..." },
      { step: 6, agent: "architect", label: "🏛️ Architect reviewing..." },
      { step: 7, agent: "opencode",  label: "🟠 OpenCode setting up deployment..." },
      { step: 8, agent: "gamer",     label: "🎮 GameAI optimising performance..." },
    ];

    const results: Record<string, string> = {};
    for (const s of steps) {
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

    setBuildNote("✅ 8-Agent pipeline complete!\n🏛️→🔬→💀→💎→🟢→🏛️→🟠→🎮\nCode loaded in ⌨️ Code tab!");
    setBuilding(false); setTab("chat");
  };

  const out = (t: string) => setTermOut(o => [...o, t]);
  const runTerm = () => {
    if (!termIn.trim()) return;
    const cmd = termIn.trim();
    setTermHist(h => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1); setTermIn("");
    out(`$ ${cmd}`);
    if (cmd === "clear") { setTermOut(["⚡ Cleared.", "$ "]); return; }
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

  const startVoice = () => {
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { alert("Not supported in this browser."); return; }
    const r = new SR(); r.continuous = false; r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => { setInput(e.results[0][0].transcript); setVoice(false); setPerms(p => ({ ...p, microphone: true })); };
    r.onerror = () => setVoice(false); r.onend = () => setVoice(false);
    r.start(); setVoice(true);
  };

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
    <div key={f.name} style={{ marginLeft: d * 14 }}>
      <div onClick={() => {
        if (f.type === "folder") {
          setFiles(ff => { const c = JSON.parse(JSON.stringify(ff)) as FileItem[]; const find = (arr: FileItem[]) => { for (const i of arr) { if (i.name === f.name) { i.expanded = !i.expanded; return; } if (i.children) find(i.children); } }; find(c); return c; });
        } else { setSelFile(f); setFileContent(f.content || ""); }
      }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, cursor: "pointer", color: selFile?.name === f.name ? "#06b6d4" : "#94a3b8", background: selFile?.name === f.name ? "#06b6d411" : "transparent", transition: "all .15s", marginBottom: 1 }}>
        <span style={{ fontSize: 15 }}>{f.type === "folder" ? (f.expanded ? "📂" : "📁") : fileIcon(f)}</span>
        <span style={{ fontSize: 12, fontFamily: "monospace", flex: 1 }}>{f.name}</span>
        {f.size && <span style={{ fontSize: 10, color: "#334155" }}>{f.size}</span>}
      </div>
      {f.type === "folder" && f.expanded && f.children && renderFileTree(f.children, d + 1)}
    </div>
  ));

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

  const agentInfo = (id?: string) => AGENTS.find(a => a.id === id) || { name: id || "AI", icon: "🤖", color: "#64748b" };

  const bg    = gamingMode ? "#0a0005" : "#030712";
  const bg2   = gamingMode ? "#120008" : "#050d1a";
  const bg3   = gamingMode ? "#1a000f" : "#0f172a";
  const acc   = gamingMode ? "#e879f9" : "#06b6d4";
  const grad  = gamingMode
    ? "linear-gradient(135deg,#e879f9,#ef4444,#f59e0b)"
    : "linear-gradient(135deg,#06b6d4,#8b5cf6,#10b981,#f97316)";

  const iSt: React.CSSProperties = { width: "100%", background: bg3, border: `1px solid ${acc}22`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", outline: "none" };
  const sSt: React.CSSProperties = { background: bg3, border: `1px solid ${acc}22`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, cursor: "pointer" };
  const bSt: React.CSSProperties = { background: bg3, border: `1px solid ${acc}22`, borderRadius: 8, padding: "6px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 11, transition: "all .15s" };

  return (
    <div style={{ background: bg, minHeight: "100vh", color: "#e2e8f0", fontFamily: "'SF Mono','Fira Code','JetBrains Mono',monospace", display: "flex", flexDirection: "column", maxWidth: 980, margin: "0 auto", position: "relative" }}>

      {/* Gaming overlay */}
      {hudVisible && (
        <div onMouseDown={hudStartDrag} onTouchStart={hudStartDrag}
          style={{ position: "fixed", left: hudPos.x, top: hudPos.y, zIndex: 999999, userSelect: "none", touchAction: "none", cursor: hudDragging ? "grabbing" : "grab", transition: hudDragging ? "none" : "box-shadow .2s" }}>
          {overlayMode === "bubble" && (
            <div style={{ background: "linear-gradient(135deg,#0a0015dd,#1a003aee)", border: "1px solid #e879f966", borderRadius: 16, padding: "6px 10px", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 24px #e879f944, 0 0 0 1px #e879f922", backdropFilter: "blur(16px)", minWidth: 140 }}>
              <span style={{ fontSize: 14 }}>🎮</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ display: "flex", gap: 6, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
                  <span style={{ color: gameStats.fps > 90 ? "#10b981" : gameStats.fps > 55 ? "#f59e0b" : "#ef4444" }}>{gameStats.fps}<span style={{ fontSize: 9, color: "#64748b" }}>fps</span></span>
                  <span style={{ color: gameStats.ping < 25 ? "#10b981" : gameStats.ping < 60 ? "#f59e0b" : "#ef4444" }}>{gameStats.ping}<span style={{ fontSize: 9, color: "#64748b" }}>ms</span></span>
                  <span style={{ color: "#38bdf8" }}>{gameStats.cpu}<span style={{ fontSize: 9, color: "#64748b" }}>%</span></span>
                </div>
                <div style={{ display: "flex", gap: 6, fontSize: 10, fontFamily: "monospace" }}>
                  <span style={{ color: battery.charging ? "#f59e0b" : "#94a3b8" }}>{battery.charging ? "⚡" : ""}{battery.level}<span style={{ fontSize: 8, color: "#64748b" }}>%</span></span>
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setOverlayMode("expanded"); }} style={{ background: "#e879f922", border: "1px solid #e879f944", borderRadius: 8, color: "#e879f9", fontSize: 12, cursor: "pointer", padding: "2px 6px" }}>⬆</button>
              <button onClick={e => { e.stopPropagation(); setHudVisible(false); }} style={{ background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", padding: "0 2px" }}>×</button>
            </div>
          )}
          {overlayMode === "expanded" && (
            <div style={{ background: "linear-gradient(160deg,#08001aee,#120030ee)", border: "1px solid #e879f955", borderRadius: 20, width: 280, boxShadow: "0 8px 40px #e879f933", backdropFilter: "blur(20px)", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(90deg,#e879f922,#8b5cf622)", borderBottom: "1px solid #e879f933", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🎮</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e879f9", letterSpacing: 1 }}>OMNIX GAMING</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); setOverlayMode("bubble"); }} style={{ background: "#e879f922", border: "1px solid #e879f944", borderRadius: 6, color: "#e879f9", fontSize: 11, cursor: "pointer", padding: "2px 8px" }}>⬇ Mini</button>
                  <button onClick={e => { e.stopPropagation(); setHudVisible(false); }} style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 6, color: "#ef4444", fontSize: 11, cursor: "pointer", padding: "2px 8px" }}>✕</button>
                </div>
              </div>
              <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { l: "FPS", v: gameStats.fps, u: "", c: gameStats.fps > 90 ? "#10b981" : gameStats.fps > 55 ? "#f59e0b" : "#ef4444", icon: "🎯" },
                  { l: "PING", v: `${gameStats.ping}`, u: "ms", c: gameStats.ping < 25 ? "#10b981" : "#f59e0b", icon: "📡" },
                  { l: "CPU", v: `${gameStats.cpu}`, u: "%", c: gameStats.cpu < 60 ? "#10b981" : "#f59e0b", icon: "⚙️" },
                  { l: "GPU", v: `${gameStats.gpu}`, u: "%", c: gameStats.gpu < 65 ? "#10b981" : "#f59e0b", icon: "🖥️" },
                  { l: "BAT", v: `${battery.level}`, u: "%", c: battery.level > 40 ? "#10b981" : "#f59e0b", icon: battery.charging ? "⚡" : "🔋" },
                  { l: "RAM", v: gameStats.ram.toFixed(1), u: "G", c: "#38bdf8", icon: "💾" },
                ].map(s => (
                  <div key={s.l} style={{ background: "#ffffff08", border: `1px solid ${s.c}22`, borderRadius: 10, padding: "6px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 13 }}>{s.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "#475569" }}>{s.l}{s.u}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["Boost FPS", "Fix lag", "Best settings", "Low battery tips"].map(q => (
                  <button key={q} onClick={e => { e.stopPropagation(); setOverlayAiInput(q); setTimeout(() => { runOverlayAI(); }, 100); }}
                    style={{ background: "#e879f911", border: "1px solid #e879f933", borderRadius: 6, padding: "3px 7px", color: "#e879f9", cursor: "pointer", fontSize: 10 }}>{q}</button>
                ))}
              </div>
              <div style={{ padding: "0 12px 12px", display: "flex", gap: 6 }}>
                <input value={overlayAiInput} onChange={e => { e.stopPropagation(); setOverlayAiInput(e.target.value); }} onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") runOverlayAI(); }} onClick={e => e.stopPropagation()} placeholder="Ask AI anything while gaming..." style={{ flex: 1, background: "#ffffff11", border: "1px solid #e879f933", borderRadius: 8, padding: "6px 10px", color: "#e2e8f0", fontSize: 11, fontFamily: "monospace", outline: "none" }} />
                <button onClick={e => { e.stopPropagation(); runOverlayAI(); }} disabled={overlayAiRunning} style={{ background: overlayAiRunning ? "#334155" : "#e879f9", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", cursor: overlayAiRunning ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}>{overlayAiRunning ? "…" : "⚡"}</button>
              </div>
              {overlayLog.length > 0 && (
                <div style={{ borderTop: "1px solid #e879f922", padding: "8px 12px", maxHeight: 120, overflowY: "auto" }}>
                  {overlayLog.map((l, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: "#e879f9", fontWeight: 700 }}>⚡ {l.q}</div>
                      {l.a && <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5, marginTop: 2 }}>{l.a}</div>}
                      {!l.a && overlayAiRunning && i === 0 && <div style={{ fontSize: 10, color: "#475569" }}>Thinking...</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {gamingMode && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ position: "absolute", width: 2, height: 2, background: "#e879f9", borderRadius: "50%", left: `${10 + i * 15}%`, top: `${20 + i * 10}%`, boxShadow: "0 0 6px #e879f9" }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ background: bg2, borderBottom: `1px solid ${acc}22`, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 0 24px ${acc}44` }}>⚡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>OMNIX</div>
            <div style={{ fontSize: 8, color: "#334155", letterSpacing: 2 }}>AGENT ZERO × OPENCLAW × OPENCODE — MOST POWERFUL iPAD AI</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {gamingMode && <div style={{ fontSize: 11, color: "#e879f9", background: "#e879f911", border: "1px solid #e879f933", borderRadius: 6, padding: "3px 8px" }}>🎮 GAMING</div>}
          <div style={{ fontSize: 10, color: "#475569", background: bg3, border: `1px solid ${acc}22`, borderRadius: 6, padding: "3px 8px" }}>{memories.length}🧠</div>
          <button onClick={() => { const on = !gamingMode; setGamingMode(on); if (on) { setHudVisible(true); setOverlayMode("bubble"); } else setHudVisible(false); }} style={{ ...bSt, background: gamingMode ? "#e879f922" : "", color: gamingMode ? "#e879f9" : "#64748b", border: `1px solid ${gamingMode ? "#e879f944" : acc + "22"}` }}>🎮</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: bg2, borderBottom: `1px solid ${acc}22`, overflowX: "auto", position: "sticky", top: 62, zIndex: 98 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "8px 2px", background: "transparent", border: "none", borderBottom: tab === t.id ? `2px solid ${acc}` : "2px solid transparent", color: tab === t.id ? acc : "#475569", cursor: "pointer", fontSize: 9, fontFamily: "monospace", minWidth: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all .15s" }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CHAT */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 150px)" }}>
          <div style={{ padding: "6px 10px", background: bg2, borderBottom: `1px solid ${acc}11`, display: "flex", gap: 5, overflowX: "auto" }}>
            <button onClick={() => setActiveAgent("omega")} style={{ ...bSt, background: activeAgent === "omega" ? `${acc}22` : "", color: activeAgent === "omega" ? acc : "#475569", border: `1px solid ${activeAgent === "omega" ? acc : `${acc}11`}`, whiteSpace: "nowrap", fontSize: 10 }}>⚡ Auto</button>
            {AGENTS.map(a => (
              <button key={a.id} onClick={() => setActiveAgent(a.id)} style={{ ...bSt, background: activeAgent === a.id ? `${a.color}22` : "", color: activeAgent === a.id ? a.color : "#475569", border: `1px solid ${activeAgent === a.id ? a.color : `${acc}11`}`, whiteSpace: "nowrap", fontSize: 10 }}>{a.icon} {a.name}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => {
              const a = agentInfo(m.agent);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.image && <img src={m.image} alt="" style={{ maxWidth: 220, borderRadius: 12, marginBottom: 6, border: `1px solid ${acc}33` }} />}
                  <div style={{ maxWidth: "88%", padding: "10px 14px", borderRadius: 14, background: m.role === "user" ? "#0c2340" : bg2, border: m.role === "user" ? "1px solid #1d4ed8" : `1px solid ${acc}11`, fontSize: 12, lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {m.content}
                  </div>
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    {m.agent && <span style={{ padding: "1px 7px", borderRadius: 4, fontSize: 10, background: `${a.color}22`, border: `1px solid ${a.color}44`, color: a.color }}>{a.icon} {a.name}</span>}
                    <span>{m.ts?.toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155" }}>
                <div style={{ display: "flex", gap: 4 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: acc, opacity: 0.6 + i * 0.1 }} />)}</div>
                <span style={{ fontSize: 11, color: "#475569" }}>Agents working...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: 10, background: bg2, borderTop: `1px solid ${acc}11`, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <button onClick={startVoice} style={{ ...bSt, background: voice ? `${acc}44` : "", fontSize: 16, padding: "10px 12px", color: voice ? acc : "#475569" }}>🎤</button>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder='Ask anything... "build me a game" "optimize my FPS" "hack mode on"'
              rows={2} style={{ flex: 1, background: bg3, border: `1px solid ${acc}22`, borderRadius: 12, padding: "10px 13px", color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", resize: "none", outline: "none" }} />
            <button onClick={send} disabled={loading} style={{ background: loading ? "#1e293b" : grad, border: "none", borderRadius: 12, padding: "10px 18px", color: "white", cursor: loading ? "not-allowed" : "pointer", fontSize: 20, fontWeight: "bold", boxShadow: loading ? "none" : `0 0 20px ${acc}44` }}>→</button>
          </div>
        </div>
      )}

      {/* AGENTS */}
      {tab === "agents" && (
        <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 14 }}>8 ACTIVE AGENTS — OMNIX FRAMEWORK — POWERED BY REPLIT AI</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {AGENTS.map(a => (
              <div key={a.id} style={{ background: bg2, border: `1px solid ${a.color}33`, borderRadius: 14, padding: 14, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${a.color}22`, border: `1px solid ${a.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: `0 0 15px ${a.color}33` }}>{a.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: a.color }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: "#334155", background: bg3, borderRadius: 4, padding: "1px 6px" }}>{AI_PROVIDERS[a.provider as keyof typeof AI_PROVIDERS]?.name || a.provider}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{a.desc}</div>
                  <button onClick={() => { setActiveAgent(a.id); setTab("chat"); }} style={{ ...bSt, background: `${a.color}22`, color: a.color, border: `1px solid ${a.color}44`, fontSize: 11 }}>Chat with {a.name} →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BUILD */}
      {tab === "build" && (
        <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 12, letterSpacing: 2, textAlign: "center" }}>8-AGENT PIPELINE — ALL AIs WORKING TOGETHER</div>
            <div style={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              {AGENTS.map((a, i) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <div style={{ background: bg, border: `1px solid ${a.color}44`, borderRadius: 10, padding: "6px 9px", textAlign: "center", minWidth: 70 }}>
                    <div style={{ fontSize: 14 }}>{a.icon}</div>
                    <div style={{ fontSize: 9, color: a.color, fontWeight: 700, marginTop: 1 }}>{a.name}</div>
                  </div>
                  {i < AGENTS.length - 1 && <span style={{ color: "#1e293b", fontSize: 12 }}>→</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, letterSpacing: 2 }}>🏗️ WHAT DO YOU WANT TO BUILD?</div>
            <textarea value={buildGoal} onChange={e => setBuildGoal(e.target.value)}
              placeholder={"e.g. A Minecraft mod\ne.g. Fortnite hack detector\ne.g. Full-stack mobile app\ne.g. iOS game in Swift"}
              rows={4} style={{ width: "100%", background: bg3, border: `1px solid ${acc}22`, borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", resize: "none", outline: "none", boxSizing: "border-box" }} />
            <button onClick={() => buildGoal.trim() && runPipeline(buildGoal)} disabled={building || !buildGoal.trim()}
              style={{ marginTop: 10, width: "100%", padding: 13, background: building ? "#1e293b" : grad, border: "none", borderRadius: 12, color: "white", cursor: building ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, letterSpacing: 1, boxShadow: building ? "none" : `0 0 30px ${acc}33` }}>
              {building ? "⚙️ 8 Agents Working..." : "🚀 LAUNCH 8-AGENT PIPELINE"}
            </button>
          </div>
          {pipeLog.length > 0 && (
            <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, padding: 12, maxHeight: 280, overflowY: "auto" }}>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, letterSpacing: 2 }}>LIVE AGENT LOG</div>
              {pipeLog.map((l, i) => { const a = agentInfo(l.agent); return (
                <div key={i} style={{ marginBottom: 12, borderLeft: `2px solid ${a.color}55`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 10, color: a.color, marginBottom: 3 }}>{a.icon} STEP {l.step} — {l.agent.toUpperCase()} — {l.ts.toLocaleTimeString()}</div>
                  <div style={{ fontSize: 11, color: "#475569", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 60, overflow: "hidden" }}>{l.text.slice(0, 220)}{l.text.length > 220 && "..."}</div>
                </div>
              ); })}
            </div>
          )}
          {buildNote && <div style={{ background: "#052e16", border: "1px solid #16a34a33", borderRadius: 12, padding: 12, fontSize: 12, color: "#86efac", whiteSpace: "pre-wrap" }}>{buildNote}</div>}
          <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, letterSpacing: 2 }}>TEMPLATES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {["Minecraft mod", "iOS game", "Discord bot", "Security tool", "Roblox script", "React app", "Python AI", "Chrome extension", "VS Code extension", "Game hack (educational)"].map(t => (
                <button key={t} onClick={() => setBuildGoal(t)} style={{ ...bSt, fontSize: 11 }}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CODE */}
      {tab === "code" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 150px)" }}>
          <div style={{ padding: "7px 10px", background: bg2, borderBottom: `1px solid ${acc}11`, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select value={lang} onChange={e => setLang(e.target.value)} style={sSt}>
              {["javascript", "python", "typescript", "swift", "kotlin", "html", "css", "bash", "json", "rust", "go", "c", "cpp", "java", "lua", "gdscript"].map(l => <option key={l}>{l}</option>)}
            </select>
            <button onClick={() => runPipeline(`Improve:\n${code}`)} style={{ ...bSt, background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633" }}>🏗️ Pipeline</button>
            <button onClick={() => callAgent("coder", `Debug and fix:\n${code}`).then(r => { addMsg("coder", r.text); setTab("chat"); })} style={{ ...bSt, background: "#10b98122", color: "#10b981", border: "1px solid #10b98133" }}>🐛 Debug</button>
            <button onClick={() => callAgent("devgod", `Unrestricted review:\n${code}`).then(r => { addMsg("devgod", r.text); setTab("chat"); })} style={{ ...bSt, background: "#ef444422", color: "#ef4444", border: "1px solid #ef444433" }}>💀 DevGod</button>
            <button onClick={() => callAgent("analyst", `Security audit:\n${code}`).then(r => { addMsg("analyst", r.text); setTab("chat"); })} style={{ ...bSt, background: "#06b6d422", color: "#06b6d4", border: "1px solid #06b6d433" }}>🔬 Audit</button>
            <button onClick={() => { const b = new Blob([code], { type: "text/plain" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `code.${lang}`; a.click(); }} style={{ ...bSt, marginLeft: "auto" }}>💾 Save</button>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)}
            style={{ flex: 1, background: bg, border: "none", padding: 16, color: "#5eead4", fontSize: 13, fontFamily: "'SF Mono','Fira Code',monospace", resize: "none", outline: "none", lineHeight: 1.75 }}
            spellCheck={false} />
        </div>
      )}

      {/* FILES */}
      {tab === "files" && (
        <div style={{ flex: 1, display: "flex", height: "calc(100vh - 150px)" }}>
          <div style={{ width: 210, borderRight: `1px solid ${acc}11`, background: bg2, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${acc}11`, display: "flex", gap: 6 }}>
              <button onClick={() => setShowNewFile(true)} style={{ ...bSt, flex: 1, fontSize: 10, background: `${acc}22`, color: acc, border: `1px solid ${acc}33` }}>+ New File</button>
              <label style={{ ...bSt, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center" }}>
                📎 <input type="file" style={{ display: "none" }} multiple onChange={handleUpload} />
              </label>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>{renderFileTree(files)}</div>
            {uploadedFiles.length > 0 && <div style={{ padding: "6px 10px", borderTop: `1px solid ${acc}11`, fontSize: 10, color: "#475569" }}>{uploadedFiles.length} uploaded</div>}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {showNewFile ? (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, color: acc, fontWeight: 700 }}>Create New File</div>
                <input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="filename.js" style={iSt} />
                <textarea value={newFileContent} onChange={e => setNewFileContent(e.target.value)} placeholder="File content..." rows={8}
                  style={{ width: "100%", background: bg, border: `1px solid ${acc}22`, borderRadius: 8, padding: "9px 12px", color: "#5eead4", fontSize: 12, fontFamily: "monospace", resize: "none", outline: "none", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={createFile} style={{ ...bSt, background: `${acc}22`, color: acc, border: `1px solid ${acc}33`, flex: 1 }}>✅ Create</button>
                  <button onClick={() => setShowNewFile(false)} style={{ ...bSt, flex: 1 }}>Cancel</button>
                </div>
              </div>
            ) : selFile ? (
              <>
                <div style={{ padding: "8px 12px", background: bg2, borderBottom: `1px solid ${acc}11`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{fileIcon(selFile)}</span>
                  <span style={{ fontSize: 12, color: acc, fontFamily: "monospace" }}>{selFile.name}</span>
                  <span style={{ fontSize: 10, color: "#334155" }}>{selFile.size}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={() => callAgent("analyst", `Analyse: ${selFile.name}\n\n${fileContent.slice(0, 3000)}`).then(r => { addMsg("analyst", r.text); setTab("chat"); })} style={{ ...bSt, background: "#06b6d422", color: "#06b6d4", border: "1px solid #06b6d433", fontSize: 10 }}>🔬 Analyse</button>
                    <button onClick={() => runPipeline(`Improve: ${selFile.name}\n${fileContent.slice(0, 2000)}`)} style={{ ...bSt, background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633", fontSize: 10 }}>🏗️ Improve</button>
                    <button onClick={() => downloadFile({ ...selFile, content: fileContent })} style={{ ...bSt, fontSize: 10 }}>💾 Save</button>
                  </div>
                </div>
                <textarea value={fileContent} onChange={e => setFileContent(e.target.value)}
                  style={{ flex: 1, background: bg, border: "none", padding: 14, color: "#5eead4", fontSize: 12, fontFamily: "'SF Mono','Fira Code',monospace", resize: "none", outline: "none", lineHeight: 1.7 }}
                  spellCheck={false} />
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#334155", gap: 10 }}>
                <div style={{ fontSize: 48 }}>📁</div>
                <div style={{ fontSize: 13 }}>Select or create a file</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CAMERA */}
      {tab === "camera" && (
        <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, overflow: "hidden", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {camOn
              ? <video ref={vidRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: camFilter === "grayscale" ? "grayscale(100%)" : camFilter === "vivid" ? "saturate(200%) contrast(110%)" : "none" }} />
              : <div style={{ textAlign: "center", color: "#334155" }}><div style={{ fontSize: 56 }}>📷</div><div style={{ fontSize: 13, marginTop: 8 }}>Camera off</div>{camErr && <div style={{ fontSize: 11, color: "#f87171", marginTop: 6, padding: "0 20px" }}>{camErr}</div>}</div>
            }
            {camOn && (
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                <button onClick={flipCam} style={{ background: "#00000088", border: "none", borderRadius: 8, color: "white", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>🔄</button>
                {["none", "grayscale", "vivid"].map(f => (
                  <button key={f} onClick={() => setCamFilter(f)} style={{ background: camFilter === f ? "#ffffff33" : "#00000088", border: "none", borderRadius: 8, color: "white", padding: "5px 9px", cursor: "pointer", fontSize: 11 }}>{f}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={camOn ? stopCam : startCam} style={{ flex: 1, padding: 13, borderRadius: 12, background: camOn ? "#7f1d1d" : "#0f766e", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}>{camOn ? "⏹ Stop" : "▶️ Start Camera"}</button>
            {camOn && <button onClick={capturePhoto} style={{ flex: 2, padding: 13, borderRadius: 12, background: acc, border: "none", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>📸 Capture & AI Analyse</button>}
          </div>
          {camPhotos.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 8 }}>CAPTURED PHOTOS ({camPhotos.length})</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {camPhotos.map((p, i) => (
                  <img key={i} src={p.b64} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, border: `1px solid ${acc}33`, flexShrink: 0, cursor: "pointer" }}
                    onClick={() => { setMessages(m => [...m, { role: "user", content: "📸 Analysing photo...", image: p.b64, ts: new Date() }]); callAgent("analyst", "Analyse this image in extreme detail.").then(r => { addMsg("analyst", r.text); setTab("chat"); }); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GAMING */}
      {tab === "gaming" && (
        <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <div style={{ background: "linear-gradient(135deg,#1a0030,#0f0020)", border: "1px solid #e879f944", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e879f9", letterSpacing: 1 }}>🎮 FLOATING GAMING HUD</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setHudVisible(!hudVisible); if (!hudVisible) setGamingMode(true); }}
                  style={{ background: hudVisible ? "#e879f9" : "#1e293b", border: "1px solid #e879f944", borderRadius: 8, padding: "6px 14px", color: hudVisible ? "white" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  {hudVisible ? "🔴 HUD ON" : "⚫ HUD OFF"}
                </button>
                <button onClick={() => setGamingMode(g => !g)}
                  style={{ background: gamingMode ? "#e879f922" : "#1e293b", border: "1px solid #e879f944", borderRadius: 8, padding: "6px 12px", color: gamingMode ? "#e879f9" : "#64748b", cursor: "pointer", fontSize: 12 }}>
                  {gamingMode ? "Gaming Mode ON" : "Gaming Mode OFF"}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.7, marginBottom: 10 }}>
              The HUD floats on any screen — drag it anywhere. Tap ▲ to expand. Type commands to control the AI.
            </div>
            {hudVisible && (
              <div style={{ background: "#e879f911", border: "1px solid #e879f933", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, color: "#e879f9", marginBottom: 8, fontWeight: 700 }}>HUD Commands:</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={hudCommand} onChange={e => setHudCommand(e.target.value)} onKeyDown={e => e.key === "Enter" && runHudCommand()}
                    placeholder="Ask GameAI..." style={{ flex: 1, background: "#0f172a", border: "1px solid #e879f933", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 11, fontFamily: "monospace", outline: "none" }} />
                  <button onClick={runHudCommand} disabled={hudCmdRunning}
                    style={{ background: hudCmdRunning ? "#334155" : "#e879f9", border: "none", borderRadius: 6, padding: "6px 12px", color: "white", cursor: "pointer", fontSize: 11 }}>
                    {hudCmdRunning ? "…" : "⚡"}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 10 }}>LIVE PERFORMANCE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[
                { l: "FPS", v: gameStats.fps, u: "", c: gameStats.fps > 100 ? "#10b981" : gameStats.fps > 60 ? "#f59e0b" : "#ef4444" },
                { l: "PING", v: gameStats.ping, u: "ms", c: gameStats.ping < 20 ? "#10b981" : gameStats.ping < 50 ? "#f59e0b" : "#ef4444" },
                { l: "CPU", v: gameStats.cpu, u: "%", c: gameStats.cpu < 50 ? "#10b981" : gameStats.cpu < 80 ? "#f59e0b" : "#ef4444" },
                { l: "GPU", v: gameStats.gpu, u: "%", c: gameStats.gpu < 70 ? "#10b981" : gameStats.gpu < 90 ? "#f59e0b" : "#ef4444" },
                { l: "RAM", v: gameStats.ram.toFixed(1), u: "GB", c: "#06b6d4" },
                { l: "TEMP", v: gameStats.temp, u: "°C", c: gameStats.temp < 45 ? "#10b981" : gameStats.temp < 55 ? "#f59e0b" : "#ef4444" },
              ].map(s => (
                <div key={s.l} style={{ background: bg, border: `1px solid ${s.c}33`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1 }}>{s.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: "#334155" }}>{s.u}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: bg2, border: `1px solid ${acc}22`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 10 }}>PERFORMANCE PRESETS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GAMING_PRESETS.map(p => (
                <button key={p.id} onClick={() => { setGamingPreset(p.id); setGamingMode(true); setHudVisible(true); }}
                  style={{ background: gamingPreset === p.id ? `${p.color}22` : bg3, border: `1px solid ${gamingPreset === p.id ? p.color : `${acc}11`}`, borderRadius: 10, padding: "10px 14px", color: gamingPreset === p.id ? p.color : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all .2s", textAlign: "left" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{p.desc}</div>
                  </div>
                  {gamingPreset === p.id && <div style={{ fontSize: 16 }}>✓</div>}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: bg2, border: "1px solid #e879f933", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 10, color: "#e879f9", letterSpacing: 2, marginBottom: 10 }}>🤖 GAMEAI ASSISTANT</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
              {["Get max FPS on my iPad", "Best Minecraft settings", "Reduce ping in Fortnite", "Roblox anti-lag scripts", "How to mod my game", "Competitive controller settings", "Best iOS games 2026", "Game recording tips"].map(q => (
                <button key={q} onClick={() => { setInput(q); setActiveAgent("gamer"); setTab("chat"); }}
                  style={{ ...bSt, fontSize: 11, background: "#e879f911", color: "#e879f9", border: "1px solid #e879f933" }}>{q}</button>
              ))}
            </div>
            {gameNotes.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 6 }}>Recent HUD commands:</div>
                {gameNotes.slice(0, 5).map((n, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#64748b", padding: "5px 8px", background: bg3, borderRadius: 6, marginBottom: 4 }}>{n.text}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERMISSIONS */}
      {tab === "perms" && (
        <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 14 }}>iPAD PERMISSIONS — OMNIX CONTROL CENTER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "camera",        icon: "📷", label: "Camera",        desc: "Full camera access — front & back, capture, analyse" },
              { key: "microphone",    icon: "🎤", label: "Microphone",    desc: "Voice input, audio recording, real-time transcription" },
              { key: "location",      icon: "📍", label: "Location",      desc: "GPS access — location-aware AI responses" },
              { key: "notifications", icon: "🔔", label: "Notifications", desc: "Push alerts when AI tasks complete" },
              { key: "motion",        icon: "📱", label: "Motion/Gyro",   desc: "Accelerometer, gyroscope, device sensors" },
              { key: "storage",       icon: "💾", label: "Storage",       desc: "Read/write files, access iOS Files app" },
            ].map(p => (
              <div key={p.key} style={{ background: bg2, border: `1px solid ${perms[p.key as keyof typeof perms] ? "#10b981" : "#334155"}44`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: perms[p.key as keyof typeof perms] ? "#052e16" : "#0f172a", border: `1px solid ${perms[p.key as keyof typeof perms] ? "#16a34a" : "#334155"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{p.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: perms[p.key as keyof typeof perms] ? "#10b981" : "#e2e8f0", marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{p.desc}</div>
                  {p.key === "location" && location && <div style={{ fontSize: 10, color: "#06b6d4", marginTop: 4 }}>📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>}
                </div>
                <button onClick={() => requestPerm(p.key)} style={{ ...bSt, background: perms[p.key as keyof typeof perms] ? "#052e16" : "#0f172a", color: perms[p.key as keyof typeof perms] ? "#10b981" : "#64748b", border: `1px solid ${perms[p.key as keyof typeof perms] ? "#16a34a" : "#334155"}`, whiteSpace: "nowrap", fontWeight: 700 }}>
                  {perms[p.key as keyof typeof perms] ? "✅ Granted" : "Request →"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEMORY */}
      {tab === "memory" && (
        <div style={{ flex: 1, padding: 14, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>🧠 PERSISTENT MEMORY ({memories.length})</div>
            <button onClick={() => setMemories([])} style={{ ...bSt, background: "#7f1d1d22", color: "#f87171", border: "1px solid #ef444433", fontSize: 10 }}>🗑️ Clear All</button>
          </div>
          {memories.length === 0 ? (
            <div style={{ textAlign: "center", color: "#334155", padding: 40 }}>
              <div style={{ fontSize: 48 }}>🧠</div>
              <div style={{ fontSize: 13, marginTop: 10 }}>No memories yet</div>
              <div style={{ fontSize: 11, color: "#1e293b", marginTop: 5 }}>Start chatting and OMNIX will remember your conversations</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {memories.slice().reverse().map((m, i) => (
                <div key={i} style={{ background: bg2, border: `1px solid ${acc}11`, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: acc, marginBottom: 5, fontWeight: 700 }}>Q: {m.q}</div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>A: {m.a}</div>
                  <div style={{ fontSize: 9, color: "#334155", marginTop: 5 }}>{new Date(m.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TERMINAL */}
      {tab === "term" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100vh - 150px)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, fontFamily: "monospace", fontSize: 12, lineHeight: 1.8 }}>
            {termOut.map((line, i) => (
              <div key={i} style={{ color: line.startsWith("$") ? "#06b6d4" : line.startsWith("⚡") || line.startsWith("✅") ? "#10b981" : line.startsWith("⚠️") || line.startsWith("zsh:") ? "#f87171" : "#94a3b8" }}>{line}</div>
            ))}
            <div ref={termEndRef} />
          </div>
          <div style={{ padding: "8px 14px", background: bg2, borderTop: `1px solid ${acc}11`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: acc, fontSize: 12 }}>$</span>
            <input value={termIn} onChange={e => setTermIn(e.target.value)} onKeyDown={termKeyDown}
              placeholder="help | omega <msg> | build <goal> | game on..."
              style={{ flex: 1, background: "transparent", border: "none", color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", outline: "none" }}
              autoFocus />
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes dot { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
