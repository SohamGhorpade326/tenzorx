import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const globalStyles = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
.ws-landing{font-family:'Mona Sans',-apple-system,BlinkMacSystemFont,sans-serif;background:#010409;color:#e6edf3;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.ws-landing ::-webkit-scrollbar{width:6px}
.ws-landing ::-webkit-scrollbar-track{background:#010409}
.ws-landing ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.marquee-inner{animation:marquee 30s linear infinite;display:flex;align-items:center;gap:80px;width:max-content}
@keyframes floatA{0%,100%{transform:translateY(0)rotate(-4deg)}50%{transform:translateY(-22px)rotate(-4deg)}}
@keyframes floatB{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
@keyframes floatC{0%,100%{transform:translateY(0)rotate(3deg)}50%{transform:translateY(-18px)rotate(3deg)}}
@keyframes twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:.9;transform:scale(1.3)}}
@keyframes glowPulse{0%,100%{opacity:.45}50%{opacity:.75}}
input{font-family:'Mona Sans',sans-serif}
button{font-family:'Mona Sans',sans-serif}
@media (max-width: 1080px){
  .ws-nav-link,.ws-nav-search{display:none !important}
}
@media (max-width: 920px){
  .ws-grid-2{grid-template-columns:1fr !important}
  .ws-grid-3{grid-template-columns:1fr !important}
  .ws-footer-grid{gap:26px !important}
}
`;

const GHLogo = () => (
  <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="26" height="26" rx="8" fill="url(#wsGradHeader)" stroke="#30363d" />
    <path d="M7.5 8.5L11 19.5L14 12.5L17 19.5L20.5 8.5" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="wsGradHeader" x1="4" y1="3" x2="24" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1f6feb" />
        <stop offset="1" stopColor="#2ea043" />
      </linearGradient>
    </defs>
  </svg>
);

const Chevron = ({ s = 14, c = "#7d8590" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill={c} aria-hidden="true">
    <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
  </svg>
);

const SearchIco = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#7d8590" aria-hidden="true">
    <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215zm-1.098-1.098a4.5 4.5 0 10-6.18-6.536 4.5 4.5 0 006.18 6.536z" />
  </svg>
);

const GreenCheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7.5" fill="#238636" stroke="#2ea043" strokeWidth=".5" />
    <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIco = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#7d8590" aria-hidden="true">
    <path d="M7.75 2a.75.75 0 01.75.75V7h4.25a.75.75 0 010 1.5H8.5v4.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z" />
  </svg>
);

const RightArrow = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#388bfd" aria-hidden="true">
    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
  </svg>
);

const Sparkles = () => {
  const pts = useMemo(
    () => [
      [8, 12], [18, 22], [35, 8], [55, 18], [72, 25], [85, 10], [92, 35], [5, 45],
      [28, 40], [62, 38], [78, 50], [14, 55], [44, 60], [88, 65], [48, 15], [82, 30], [60, 70], [20, 68],
    ],
    []
  );
  const plusses = [[12, 28], [70, 42], [60, 20], [32, 55], [46, 38]];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      {pts.map(([l, t], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${l}%`,
            top: `${t}%`,
            width: i % 3 === 0 ? 2.5 : 1.8,
            height: i % 3 === 0 ? 2.5 : 1.8,
            borderRadius: "50%",
            background: "rgba(255,255,255,.8)",
            animation: `twinkle ${2 + ((i * 0.37) % 2)}s ${(i * 0.31) % 2.5}s ease-in-out infinite`,
          }}
        />
      ))}
      {plusses.map(([l, t], i) => (
        <div
          key={`p${i}`}
          style={{
            position: "absolute",
            left: `${l}%`,
            top: `${t}%`,
            color: "rgba(255,255,255,.25)",
            fontSize: 14,
            lineHeight: 1,
            animation: `twinkle ${3 + i * 0.4}s ${i * 0.7}s ease-in-out infinite`,
          }}
        >
          +
        </div>
      ))}
    </div>
  );
};

const Robot = ({ w = 155 }: { w?: number }) => (
  <svg viewBox="0 0 170 215" width={w} style={{ filter: "drop-shadow(0 28px 55px rgba(88,28,220,.55))" }}>
    <defs>
      <radialGradient id="rb" cx="35%" cy="30%"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#4c1d95" /></radialGradient>
      <radialGradient id="rh" cx="35%" cy="25%"><stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#6d28d9" /></radialGradient>
      <linearGradient id="rl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b21b6" /><stop offset="100%" stopColor="#3b0764" /></linearGradient>
      <linearGradient id="ra" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#4c1d95" /></linearGradient>
      <filter id="rglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <ellipse cx="85" cy="210" rx="46" ry="8" fill="rgba(88,28,220,.18)" />
    <rect x="54" y="152" width="24" height="50" rx="12" fill="url(#rl)" />
    <rect x="92" y="152" width="24" height="50" rx="12" fill="url(#rl)" />
    <ellipse cx="66" cy="202" rx="15" ry="7" fill="#1e1065" />
    <ellipse cx="104" cy="202" rx="15" ry="7" fill="#1e1065" />
    <rect x="20" y="70" width="130" height="92" rx="26" fill="url(#rb)" />
    <rect x="55" y="100" width="60" height="34" rx="10" fill="#1e1b4b" opacity=".85" />
    <circle cx="85" cy="117" r="10" fill="#6366f1" filter="url(#rglow)" />
    <circle cx="85" cy="117" r="6" fill="#a5b4fc" />
    <circle cx="87" cy="115" r="2.5" fill="white" />
    <rect x="0" y="80" width="24" height="64" rx="12" fill="url(#ra)" />
    <rect x="146" y="80" width="24" height="64" rx="12" fill="url(#ra)" />
    <ellipse cx="12" cy="145" rx="10" ry="8" fill="#4c1d95" />
    <ellipse cx="158" cy="145" rx="10" ry="8" fill="#4c1d95" />
    <rect x="72" y="54" width="26" height="20" rx="7" fill="#6d28d9" />
    <rect x="26" y="10" width="118" height="52" rx="22" fill="url(#rh)" />
    <rect x="82" y="1" width="6" height="12" rx="3" fill="#a78bfa" />
    <circle cx="85" cy="1" r="5" fill="#ddd6fe" filter="url(#rglow)" />
    <rect x="32" y="24" width="106" height="28" rx="10" fill="#1e1b4b" />
    <rect x="36" y="28" width="44" height="20" rx="8" fill="#0f0f2e" />
    <ellipse cx="58" cy="38" rx="13" ry="8" fill="#2e2a8e" />
    <circle cx="58" cy="38" r="6" fill="#4f46e5" filter="url(#rglow)" />
    <circle cx="60" cy="36" r="2.5" fill="#e0e7ff" />
    <rect x="90" y="28" width="44" height="20" rx="8" fill="#0f0f2e" />
    <ellipse cx="112" cy="38" rx="13" ry="8" fill="#2e2a8e" />
    <circle cx="112" cy="38" r="6" fill="#4f46e5" filter="url(#rglow)" />
    <circle cx="114" cy="36" r="2.5" fill="#e0e7ff" />
    <rect x="80" y="34" width="10" height="8" rx="4" fill="#1e1b4b" />
    <rect x="58" y="52" width="54" height="5" rx="2.5" fill="#1e1b4b" />
    <rect x="62" y="53" width="10" height="3" rx="1.5" fill="#4338ca" />
    <rect x="76" y="53" width="10" height="3" rx="1.5" fill="#4338ca" />
    <rect x="90" y="53" width="10" height="3" rx="1.5" fill="#4338ca" />
  </svg>
);

const PinkBird = ({ w = 112 }: { w?: number }) => (
  <svg viewBox="0 0 135 165" width={w} style={{ filter: "drop-shadow(0 22px 44px rgba(236,72,153,.4))" }}>
    <defs>
      <radialGradient id="pb" cx="35%" cy="30%"><stop offset="0%" stopColor="#fce7f3" /><stop offset="100%" stopColor="#be185d" /></radialGradient>
      <radialGradient id="ph" cx="35%" cy="25%"><stop offset="0%" stopColor="#fdf4fb" /><stop offset="100%" stopColor="#db2777" /></radialGradient>
      <radialGradient id="pch" cx="50%" cy="50%"><stop offset="0%" stopColor="#fda4af" stopOpacity=".65" /><stop offset="100%" stopColor="#fda4af" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="67" cy="159" rx="38" ry="7" fill="rgba(190,24,93,.18)" />
    <ellipse cx="67" cy="104" rx="50" ry="52" fill="url(#pb)" />
    <ellipse cx="67" cy="53" rx="44" ry="42" fill="url(#ph)" />
    <ellipse cx="38" cy="22" rx="11" ry="17" fill="#f472b6" transform="rotate(-18 38 22)" />
    <ellipse cx="96" cy="22" rx="11" ry="17" fill="#f472b6" transform="rotate(18 96 22)" />
    <ellipse cx="38" cy="20" rx="7" ry="12" fill="#fce7f3" transform="rotate(-18 38 20)" />
    <ellipse cx="96" cy="20" rx="7" ry="12" fill="#fce7f3" transform="rotate(18 96 20)" />
    <circle cx="49" cy="53" r="14" fill="#1a0a1e" />
    <circle cx="85" cy="53" r="14" fill="#1a0a1e" />
    <circle cx="52" cy="50" r="6" fill="white" />
    <circle cx="88" cy="50" r="6" fill="white" />
    <circle cx="53" cy="51" r="3" fill="#ddd6fe" />
    <circle cx="89" cy="51" r="3" fill="#ddd6fe" />
    <ellipse cx="36" cy="64" rx="12" ry="8" fill="url(#pch)" />
    <ellipse cx="98" cy="64" rx="12" ry="8" fill="url(#pch)" />
    <path d="M58 70 Q67 79 76 70 Q67 74.5 58 70Z" fill="#fbbf24" />
    <ellipse cx="17" cy="104" rx="16" ry="30" fill="#ec4899" transform="rotate(-8 17 104)" />
    <ellipse cx="117" cy="104" rx="16" ry="30" fill="#ec4899" transform="rotate(8 117 104)" />
    <path d="M51 152L44 163 M51 152L51 164 M51 152L58 163" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
    <path d="M83 152L76 163 M83 152L83 164 M83 152L90 163" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Duck = ({ w = 122 }: { w?: number }) => (
  <svg viewBox="0 0 148 178" width={w} style={{ filter: "drop-shadow(0 22px 44px rgba(234,179,8,.32))" }}>
    <defs>
      <radialGradient id="db" cx="30%" cy="25%"><stop offset="0%" stopColor="#fef08a" /><stop offset="100%" stopColor="#b45309" /></radialGradient>
      <radialGradient id="dh" cx="30%" cy="25%"><stop offset="0%" stopColor="#fefce8" /><stop offset="100%" stopColor="#d97706" /></radialGradient>
      <radialGradient id="dch" cx="50%" cy="50%"><stop offset="0%" stopColor="#fca5a5" stopOpacity=".55" /><stop offset="100%" stopColor="#fca5a5" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="74" cy="173" rx="42" ry="7" fill="rgba(202,138,4,.18)" />
    <ellipse cx="74" cy="116" rx="58" ry="55" fill="url(#db)" />
    <ellipse cx="126" cy="112" rx="18" ry="11" fill="#d97706" transform="rotate(-22 126 112)" />
    <ellipse cx="65" cy="58" rx="46" ry="44" fill="url(#dh)" />
    <circle cx="50" cy="52" r="13" fill="#1c1917" />
    <circle cx="80" cy="52" r="13" fill="#1c1917" />
    <circle cx="53" cy="49" r="5.5" fill="white" />
    <circle cx="83" cy="49" r="5.5" fill="white" />
    <circle cx="54" cy="50" r="2.5" fill="#d1fae5" />
    <circle cx="84" cy="50" r="2.5" fill="#d1fae5" />
    <ellipse cx="37" cy="63" rx="11" ry="7" fill="url(#dch)" />
    <ellipse cx="93" cy="63" rx="11" ry="7" fill="url(#dch)" />
    <path d="M84 57 Q106 50 110 61 Q106 70 84 67 Z" fill="#f97316" />
    <path d="M86 61 Q100 59 108 62" stroke="#ea580c" strokeWidth="1.2" fill="none" />
    <ellipse cx="18" cy="118" rx="15" ry="28" fill="#b45309" transform="rotate(-10 18 118)" />
    <ellipse cx="130" cy="118" rx="13" ry="24" fill="#b45309" transform="rotate(10 130 118)" />
    <path d="M52 164L41 175 M52 164L52 176 M52 164L63 175" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M96 164L85 175 M96 164L96 176 M96 164L107 175" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

const Nav = ({ onAuth }: { onAuth: () => void }) => {
  const links = ["Platform", "Solutions", "Resources", "Open Source", "Enterprise"];
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "14px 20px",
        background: "rgba(1,4,9,.88)",
        backdropFilter: "blur(12px) saturate(1.4)",
        borderBottom: "1px solid rgba(48,54,61,.65)",
      }}
    >
      <div style={{ marginRight: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <GHLogo />
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.4, color: "#e6edf3" }}>WORKSTREAM AI</span>
      </div>
      {links.map((l) => (
        <button
          key={l}
          className="ws-nav-link"
          style={{
            background: "none",
            border: "none",
            color: "#e6edf3",
            fontSize: 14,
            fontWeight: 500,
            padding: "6px 10px",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 3,
            transition: "background .15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
        >
          {l}<Chevron />
        </button>
      ))}
      <button
        className="ws-nav-link"
        style={{
          background: "none",
          border: "none",
          color: "#e6edf3",
          fontSize: 14,
          fontWeight: 500,
          padding: "6px 10px",
          borderRadius: 6,
          cursor: "pointer",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        Pricing
      </button>
      <div
        className="ws-nav-search"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginLeft: 6,
          background: "rgba(22,27,34,.9)",
          border: "1px solid #30363d",
          borderRadius: 6,
          padding: "5px 10px",
          width: 256,
          cursor: "text",
        }}
      >
        <SearchIco />
        <span style={{ color: "#7d8590", fontSize: 13, flex: 1 }}>Search workflows or jump to...</span>
        <kbd style={{ background: "rgba(255,255,255,.07)", border: "1px solid #30363d", borderRadius: 4, padding: "1px 6px", fontSize: 11, color: "#7d8590" }}>/</kbd>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        <button
          onClick={onAuth}
          style={{ background: "none", border: "none", color: "#e6edf3", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "5px 12px" }}
        >
          Sign in
        </button>
        <button
          onClick={onAuth}
          style={{
            background: "none",
            border: "1px solid #30363d",
            borderRadius: 6,
            color: "#e6edf3",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            padding: "5px 16px",
            transition: "border-color .15s,background .15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#8b949e";
            e.currentTarget.style.background = "rgba(255,255,255,.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#30363d";
            e.currentTarget.style.background = "none";
          }}
        >
          Sign up
        </button>
      </div>
    </nav>
  );
};

const Hero = ({ onAuth }: { onAuth: () => void }) => {
  const [sy, setSy] = useState(0);
  useEffect(() => {
    const h = () => setSy(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const p = Math.min(sy / 380, 1);

  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "100px 24px 0",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(ellipse 100% 60% at 50% -10%,#12162b 0%,#070c1a 40%,#010409 100%)" }} />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1000,
          height: 480,
          zIndex: 1,
          background: "radial-gradient(ellipse 65% 55% at 50% 100%, rgba(76,29,149,.62) 0%, rgba(30,10,80,.25) 55%, transparent 80%)",
          animation: "glowPulse 4.5s ease-in-out infinite",
        }}
      />
      <Sparkles />
      <div
        style={{
          position: "relative",
          zIndex: 3,
          maxWidth: 820,
          opacity: Math.max(1 - p * 0.9, 0.05),
          transform: `scale(${1 - p * 0.035}) translateY(${-p * 18}px)`,
          willChange: "transform,opacity",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(42px,6.2vw,78px)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-2.5px",
            color: "#f0f6fc",
            marginBottom: 24,
          }}
        >
          The future of workflow execution
          <br />
          happens together
        </h1>
        <p
          style={{
            fontSize: "clamp(16px,2vw,20px)",
            color: "#7d8590",
            lineHeight: 1.65,
            maxWidth: 640,
            margin: "0 auto 36px",
          }}
        >
          Workstream AI brings agents, operations, and teams together in one platform to capture decisions,
          validate ownership, create tasks, and drive execution from meeting to outcome.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
            <input
              type="email"
              placeholder="Enter your work email"
              style={{
                background: "rgba(255,255,255,.07)",
                border: "none",
                outline: "none",
                color: "#e6edf3",
                fontSize: 14,
                padding: "10px 16px",
                width: 228,
              }}
            />
            <button
              onClick={onAuth}
              style={{
                background: "#238636",
                border: "none",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 20px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#2ea043"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#238636"; }}
            >
              Login / Sign up
            </button>
          </div>
          <button
            onClick={onAuth}
            style={{
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 6,
              color: "#e6edf3",
              fontSize: 14,
              fontWeight: 600,
              padding: "10px 20px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.07)"; }}
          >
            Open Workstream dashboard
          </button>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 3,
          marginTop: 52,
          height: 320,
          width: "100%",
          maxWidth: 700,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", left: "50%", marginLeft: -260, bottom: 0, animation: "floatA 4.8s ease-in-out infinite" }}><Robot w={158} /></div>
        <div style={{ position: "absolute", left: "50%", marginLeft: -55, bottom: 55, animation: "floatB 5.5s ease-in-out infinite" }}><PinkBird w={106} /></div>
        <div style={{ position: "absolute", left: "50%", marginLeft: 58, bottom: 4, animation: "floatC 5.2s ease-in-out infinite" }}><Duck w={116} /></div>
        <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 640, height: 110, background: "radial-gradient(ellipse at 50% 100%,rgba(100,45,220,.48) 0%,transparent 68%)", zIndex: -1 }} />
      </div>
    </section>
  );
};

const IDE = () => {
  const FILE_TABS = [
    { label: "Operations Overview", color: "#3b82f6", letter: "OV", active: true },
    { label: "SLA Risk Queue", color: "#8957e5", letter: "RQ", active: false },
    { label: "Escalation Review", color: "#3b82f6", letter: "ER", active: false },
  ];

  return (
    <div
      style={{
        display: "flex",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #21262d",
        boxShadow: "0 40px 100px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.04)",
        background: "#0d1117",
      }}
    >
      <div style={{ width: 44, background: "#010409", borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 56, gap: 20 }}>
        {[
          "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z",
          "M11.5 6.5a2 2 0 11-4 0 2 2 0 014 0zM13.432 12.5H2.568a5.5 5.5 0 0110.864 0z",
          "M1 5.25A2.25 2.25 0 013.25 3h9.5A2.25 2.25 0 0115 5.25v5.5A2.25 2.25 0 0112.75 13h-9.5A2.25 2.25 0 011 10.75V5.25z",
          "M7.75 2a.75.75 0 01.75.75v1.5h3.75a.75.75 0 010 1.5H8.5v1.5H13a.75.75 0 010 1.5H8.5v1.5h3.75a.75.75 0 010 1.5H8.5v1.5a.75.75 0 01-1.5 0v-1.5H3.25a.75.75 0 010-1.5H7v-1.5H3.5a.75.75 0 010-1.5H7V5.75H3.5a.75.75 0 010-1.5H7V2.75A.75.75 0 017.75 2z",
        ].map((d, i) => (
          <svg key={i} width="16" height="16" viewBox="0 0 16 16" fill={i === 0 ? "#e6edf3" : "#7d8590"} style={{ cursor: "pointer" }} aria-hidden="true">
            <path d={d} />
          </svg>
        ))}
        <div style={{ marginTop: "auto", marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#7d8590" aria-hidden="true">
            <path d="M14 1H2a1 1 0 00-1 1v9a1 1 0 001 1h2v2.5l3.5-2.5H14a1 1 0 001-1V2a1 1 0 00-1-1z" />
          </svg>
        </div>
      </div>

      <div style={{ width: 236, borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", background: "#0d1117" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #21262d", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#7d8590", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
          <GHLogo /><span style={{ fontSize: 9 }}>WORKSTREAM COPILOT: CHAT</span>
        </div>
        <div style={{ padding: "14px 12px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#6e40c9,#1a7f37)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
              WS
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Workstream Copilot</span>
          </div>
          <p style={{ fontSize: 13, color: "#e6edf3", marginBottom: 12, lineHeight: 1.5 }}>Run summary ready. I found 11 actionable decisions and 2 overdue dependencies.</p>
          <p style={{ fontSize: 12, color: "#7d8590", lineHeight: 1.65 }}>Review escalations before sending. You can ask me to assign owners, rebalance deadlines, or open procurement follow-ups.</p>
        </div>
        <div style={{ margin: "0 10px 10px", background: "rgba(255,255,255,.04)", border: "1px solid #30363d", borderRadius: 6, padding: "7px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#7d8590" aria-hidden="true"><path d="M8 1a3 3 0 00-3 3v4a3 3 0 006 0V4a3 3 0 00-3-3zm0 1.5a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-3 0V4A1.5 1.5 0 018 2.5zM4.5 9a.75.75 0 01.75.75 2.75 2.75 0 005.5 0 .75.75 0 011.5 0 4.25 4.25 0 01-3.5 4.2V15.25a.75.75 0 01-1.5 0V13.95A4.25 4.25 0 013.75 9.75.75.75 0 014.5 9z" /></svg>
          <span style={{ fontSize: 12, color: "#484f58", flex: 1 }}>Ask about meeting run #1042</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#388bfd" aria-hidden="true"><path d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zm.75 4.75a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" /></svg>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #21262d", background: "#010409", paddingLeft: 4 }}>
          {FILE_TABS.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", fontSize: 12, cursor: "pointer", color: t.active ? "#e6edf3" : "#7d8590", borderBottom: t.active ? "2px solid #388bfd" : "2px solid transparent", borderRight: "1px solid #21262d" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6.5, color: "white", fontWeight: 700, flexShrink: 0 }}>{t.letter}</div>
              {t.label}
              <span style={{ color: "#484f58", fontSize: 10, marginLeft: 1 }}>x</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: "16px", display: "grid", gap: 12, alignContent: "start" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Active Runs", value: "18", color: "#58a6ff" },
              { label: "At Risk", value: "6", color: "#d29922" },
              { label: "Escalations", value: "2", color: "#f85149" },
            ].map((m) => (
              <div key={m.label} style={{ border: "1px solid #21262d", borderRadius: 8, background: "#010409", padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#7d8590", marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{ border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "#010409", borderBottom: "1px solid #21262d", fontSize: 12, color: "#8b949e", fontWeight: 600 }}>
              Workflow Queue
            </div>
            {[
              ["Vendor onboarding", "Procurement", "AT RISK"],
              ["Q2 contract renewals", "Contract", "IN REVIEW"],
              ["Leadership sync actions", "Meeting", "IN PROGRESS"],
              ["New hire setup", "Onboarding", "DONE"],
            ].map((r, i) => (
              <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 12px", fontSize: 12, borderTop: i === 0 ? "none" : "1px solid #21262d", color: "#c9d1d9" }}>
                <span>{r[0]}</span>
                <span style={{ color: "#7d8590" }}>{r[1]}</span>
                <span style={{ color: r[2] === "AT RISK" ? "#d29922" : r[2] === "DONE" ? "#2ea043" : "#58a6ff", fontWeight: 600 }}>{r[2]}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ border: "1px solid #21262d", borderRadius: 8, background: "#010409", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#7d8590", marginBottom: 8 }}>Upcoming Deadlines</div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Mar 30 • Procurement report</div>
                <div>Apr 01 • Contract sign-off</div>
                <div>Apr 02 • Onboarding checklist</div>
              </div>
            </div>
            <div style={{ border: "1px solid #21262d", borderRadius: 8, background: "#010409", padding: 12 }}>
              <div style={{ fontSize: 11, color: "#7d8590", marginBottom: 8 }}>Owner Balance</div>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                <div>Priya: 7 tasks</div>
                <div>Arjun: 5 tasks</div>
                <div>Meera: 4 tasks</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 14px", borderTop: "1px solid #21262d" }}>
          <button style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(56,139,253,.12)", border: "1px solid rgba(56,139,253,.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="10" height="11" viewBox="0 0 10 12" fill="#388bfd" aria-hidden="true"><polygon points="0,0 10,6 0,12" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const RevealSection = ({ children, style = {} as React.CSSProperties }: { children: React.ReactNode; style?: React.CSSProperties }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.85, ease: "power3.out", scrollTrigger: { trigger: ref.current, start: "top 86%", once: true } });
  }, []);

  return <div ref={ref} style={style}>{children}</div>;
};

const TABS = ["Overview", "Plan", "Collaborate", "Automate", "Secure"];

const TabsSection = () => {
  const [act, setAct] = useState(0);

  return (
    <RevealSection style={{ padding: "0 24px 80px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,.03)", border: "1px solid #21262d", borderRadius: 40, padding: 4 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setAct(i)}
              style={{
                padding: "8px 22px",
                borderRadius: 40,
                border: act === i ? "1px solid #30363d" : "1px solid transparent",
                background: act === i ? "#161b22" : "transparent",
                color: act === i ? "#e6edf3" : "#7d8590",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all .2s",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p style={{ textAlign: "center", color: "#7d8590", fontSize: 15, maxWidth: 680, margin: "0 auto 48px" }}>
        Capture transcript decisions, validate accountability, and orchestrate task execution with AI agents in a single continuous flow.
      </p>
      <IDE />
    </RevealSection>
  );
};

const Logos = () => {
  const items = ["Operations", "People", "Finance", "Legal", "Procurement", "Program Office", "Customer Success"];
  return (
    <div style={{ overflow: "hidden", padding: "44px 0", borderTop: "1px solid #21262d", borderBottom: "1px solid #21262d", background: "rgba(255,255,255,.012)" }}>
      <div className="marquee-inner">
        {[...items, ...items, ...items].map((l, i) => (
          <span key={i} style={{ fontSize: 18, fontWeight: 600, color: "#484f58", whiteSpace: "nowrap", fontFamily: "inherit" }}>{l}</span>
        ))}
      </div>
    </div>
  );
};

const AgentCard = () => (
  <RevealSection style={{ padding: "80px 24px", maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
    <div style={{ width: 72, height: 72, margin: "0 auto 24px", borderRadius: "50%", background: "linear-gradient(135deg,#6e40c9 0%,#1a7f37 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 48px rgba(110,64,201,.5)" }}>
      <GHLogo />
    </div>
    <h2 style={{ fontSize: "clamp(30px,4vw,52px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16 }}>Accelerate your entire workstream</h2>
    <p style={{ color: "#7d8590", fontSize: 16, maxWidth: 620, margin: "0 auto 56px", lineHeight: 1.7 }}>
      From meeting input to SLA-managed delivery, Workstream AI keeps teams moving with traceable orchestration and human-in-the-loop control.
    </p>
    <div style={{ maxWidth: 660, margin: "0 auto", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden", background: "rgba(13,17,23,.97)", boxShadow: "0 0 0 1px rgba(255,255,255,.04),0 32px 80px rgba(0,0,0,.65)", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, background: "radial-gradient(ellipse 80% 60% at 50% -20%,rgba(110,64,201,.35) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ padding: "24px 24px 16px" }}>
          <p style={{ fontSize: 14, color: "#e6edf3", marginBottom: 16, fontWeight: 500, textAlign: "left" }}>Your run completed successfully. Teams can now:</p>
          <ol style={{ paddingLeft: 20, fontSize: 14, color: "#e6edf3", lineHeight: 2.2, textAlign: "left" }}>
            {[
              "View extracted decisions with owners and deadlines",
              "Review and approve flagged escalations",
              "Track at-risk tasks before SLA breach",
              "Preserve a complete audit trail per workflow run",
            ].map((t, i) => <li key={i}>{t}</li>)}
          </ol>
          <p style={{ fontSize: 14, color: "#7d8590", marginTop: 16, textAlign: "left" }}>Would you like to inspect the run details or open the review queue next?</p>
          <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
            {["R", "+", "-"] .map((icon, i) => (
              <button key={i} style={{ background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 14, padding: "2px 4px", borderRadius: 4, transition: "color .15s" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#e6edf3"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#7d8590"; }}>{icon}</button>
            ))}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,.02)", borderTop: "1px solid #21262d", padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#7d8590" }}>3 files changed</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ background: "#1f6feb", border: "none", borderRadius: 6, color: "white", fontSize: 12, fontWeight: 600, padding: "4px 14px", cursor: "pointer" }}>Keep</button>
              <button style={{ background: "none", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", fontSize: 12, fontWeight: 600, padding: "4px 14px", cursor: "pointer" }}>Undo</button>
            </div>
          </div>
          {[
            { c: "#3b82f6", l: "TS", n: "workflow-router.ts", p: "orchestrator-service/services" },
            { c: "#3b82f6", l: "TS", n: "task_manager.py", p: "task-sla-service/services" },
            { c: "#ff4444", l: "JS", n: "meeting-dashboard.tsx", p: "frontend/src/pages" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 13, textAlign: "left" }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, background: f.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6.5, color: "white", fontWeight: 700, flexShrink: 0 }}>{f.l}</div>
              <span style={{ color: "#e6edf3" }}>{f.n}</span>
              <span style={{ color: "#484f58" }}>{f.p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </RevealSection>
);

const RUNS = [
  "Validate onboarding compliance pack",
  "Refresh procurement risk scorecards",
  "Update contract obligation reminders",
  "Reprocess meeting action extraction",
  "Apply escalation policy update",
];

const AutomateSection = () => (
  <RevealSection style={{ padding: "80px 24px", borderTop: "1px solid #21262d", borderBottom: "1px solid #21262d", background: "rgba(255,255,255,.008)" }}>
    <div className="ws-grid-2" style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "start" }}>
      <div>
        <h2 style={{ fontSize: "clamp(26px,3vw,40px)", fontWeight: 800, marginBottom: 12, letterSpacing: "-1px", lineHeight: 1.15 }}>Automate your path to outcomes</h2>
        <p style={{ color: "#7d8590", fontSize: 15, marginBottom: 20, lineHeight: 1.7 }}>Run reliable, secure workflow pipelines with fewer manual handoffs.</p>
        <a style={{ color: "#388bfd", textDecoration: "none", fontSize: 14, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 32 }}>
          Explore orchestration features <RightArrow />
        </a>
        <div>
          {["Standardize cross-team execution", "Keep momentum with live run states", "Shape policies without custom code"].map((item, i) => (
            <div key={i} style={{ borderTop: "1px solid #21262d", padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7d8590", fontSize: 15, cursor: "pointer", transition: "color .15s" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#e6edf3"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#7d8590"; }}>
              {item}<PlusIco />
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>45,167 workflow runs</span>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#7d8590" }}>
            {["Event", "Status", "Workflow", "Actor"].map((f) => (
              <span key={f} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>{f}<Chevron s={10} /></span>
            ))}
          </div>
        </div>
        {RUNS.map((run, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderBottom: i < RUNS.length - 1 ? "1px solid rgba(33,38,45,.7)" : "none", cursor: "pointer", transition: "background .15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.03)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <div style={{ marginTop: 1, flexShrink: 0 }}><GreenCheck /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{run}</div>
              <div style={{ fontSize: 12, color: "#7d8590", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Run #15078 completed by orchestrator with SLA monitor sync</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "#7d8590", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>1 hour ago</span>
              <span style={{ fontSize: 11, color: "#7d8590", display: "flex", alignItems: "center", gap: 3 }}>5m 40s</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </RevealSection>
);

const SecureSection = () => (
  <RevealSection style={{ padding: "80px 24px", maxWidth: 1080, margin: "0 auto" }}>
    <div className="ws-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 24 }}>
      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}><strong>SLA debt, solved.</strong> <span style={{ color: "#7d8590" }}>Use campaign views and AI recommendations to reduce overdue work quickly.</span></p>
        <a style={{ color: "#388bfd", fontSize: 13, textDecoration: "none", fontWeight: 500, marginBottom: 16 }}>Learn about SLA campaigns</a>
        <div style={{ background: "#010409", border: "1px solid #21262d", borderRadius: 8, padding: 14, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Quarter-end close readiness campaign</div>
          <div style={{ fontSize: 11, color: "#7d8590", marginBottom: 4 }}>Campaign progress</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}><span>97% (701 items)</span><span style={{ color: "#7d8590" }}>23 items left</span></div>
          <div style={{ background: "#21262d", borderRadius: 4, height: 5, marginBottom: 8 }}><div style={{ width: "97%", height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#8957e5,#2ea043)" }} /></div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#7d8590", marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8957e5", display: "inline-block" }} />701 resolved</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ea043", display: "inline-block" }} />13 in progress</span>
          </div>
          <div style={{ fontSize: 10, color: "#7d8590" }}>Status</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>7 days left</div>
          <div style={{ color: "#484f58", fontSize: 10, marginTop: 2 }}>Due date is November 15, 2026</div>
        </div>
      </div>

      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}><strong>Dependencies you can trust.</strong> <span style={{ color: "#7d8590" }}>Detect blocked tasks and prioritize supported next steps before delays spread.</span></p>
        <a style={{ color: "#388bfd", fontSize: 13, textDecoration: "none", fontWeight: 500, marginBottom: 16 }}>Learn about dependency intelligence</a>
        <div style={{ background: "#010409", border: "1px solid #21262d", borderRadius: 8, padding: 14, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#7d8590" }}>Dependencies detected in</span>
            <span style={{ background: "rgba(255,255,255,.08)", padding: "1px 6px", borderRadius: 4, color: "#e6edf3", fontSize: 11 }}>workflow/backlog.json</span>
            <span style={{ background: "#1f6feb", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>13</span>
          </div>
          {[
            { bg: "#8957e5", i: "OP", n: "Operations / Monthly close review" },
            { bg: "#1f6feb", i: "HR", n: "People Ops / Onboarding docs" },
            { bg: "#2ea043", i: "PR", n: "Procurement / Vendor contract update" },
            { bg: "#da3633", i: "LG", n: "Legal / Approval pending" },
            { bg: "#8957e5", i: "EN", n: "Engineering / API dependency" },
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 4 ? "1px solid rgba(33,38,45,.5)" : "none" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: d.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "white", fontWeight: 700, flexShrink: 0 }}>{d.i}</div>
              <span style={{ fontSize: 12, color: "#7d8590", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{d.n}</span>
              <RightArrow />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}><strong>Your data, your control.</strong> <span style={{ color: "#7d8590" }}>Detect sensitive payloads and enforce protections across workflow events.</span></p>
        <a style={{ color: "#388bfd", fontSize: 13, textDecoration: "none", fontWeight: 500, marginBottom: 16 }}>Learn about data protection</a>
        <div style={{ background: "#010409", border: "1px solid #21262d", borderRadius: 8, padding: 12, flex: 1, fontFamily: "'SF Mono',Consolas,monospace", fontSize: 11 }}>
          <div style={{ color: "#7d8590" }}>- workflow-agent git:(feature/pipeline-hardening)</div>
          <div style={{ color: "#ff7b72", marginTop: 4 }}>warning: sensitive token pattern detected in payload</div>
          <div style={{ color: "#7d8590" }}>security gate blocked message dispatch</div>
          <div style={{ marginTop: 12, background: "rgba(218,54,51,.09)", border: "1px solid rgba(218,54,51,.28)", borderRadius: 6, padding: 10 }}>
            <div style={{ color: "#ff7b72", fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Active secret</div>
            <div style={{ color: "#7d8590", fontSize: 11 }}>A potentially active credential was detected and quarantined.</div>
            <div style={{ marginTop: 8, background: "rgba(255,255,255,.04)", border: "1px solid #30363d", borderRadius: 4, padding: "5px 8px", color: "#7d8590", fontSize: 10, wordBreak: "break-all" }}>
              ws_token_82hVf8T... (masked)
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="ws-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #21262d", borderRadius: 12, overflow: "hidden" }}>
      {[{ n: "70%", l: "MTTR reduction", s: "with automated escalation and routing" }, { n: "8.3M", l: "events processed", s: "in the past 12 months across workflows" }].map((s, i) => (
        <div key={i} style={{ padding: "40px", textAlign: "center", borderRight: i === 0 ? "1px solid #21262d" : "none" }}>
          <div style={{ fontSize: "clamp(40px,5vw,64px)", fontWeight: 800, letterSpacing: "-3px", lineHeight: 1, marginBottom: 8 }}>{s.n}</div>
          <p style={{ fontSize: 14, color: "#7d8590", lineHeight: 1.6 }}>{s.l}<br />{s.s}</p>
        </div>
      ))}
    </div>
  </RevealSection>
);

const ScalesSection = () => {
  const [f, setF] = useState(0);
  const stories = [
    { bg: "linear-gradient(135deg,#1a1a2e,#16213e)", logo: <span style={{ fontSize: 26, fontWeight: 300, letterSpacing: 2, color: "rgba(255,255,255,.8)" }}>Ops Cloud</span>, tag: "Technology", title: "Global ops teams standardized delivery playbooks" },
    { bg: "linear-gradient(135deg,#1a2236,#2d3a52)", logo: <div style={{ color: "rgba(255,255,255,.75)", fontSize: 14 }}>Manufacturing Group</div>, tag: "Automotive", title: "Manufacturing teams unified vendor approvals and task tracking", link: "Read customer story" },
    { bg: "linear-gradient(135deg,#0d2137,#1a3a5c)", logo: <div style={{ color: "rgba(255,255,255,.75)", fontSize: 14 }}>FinServ Collective</div>, tag: "Financial services", title: "Finance teams cut manual follow-up loops by 50%" },
  ];

  return (
    <RevealSection style={{ padding: "80px 24px", textAlign: "center" }}>
      <h2 style={{ fontSize: "clamp(30px,4vw,52px)", fontWeight: 800, letterSpacing: "-1.5px", maxWidth: 760, margin: "0 auto 48px" }}>
        From startups to enterprises, <span style={{ color: "#7d8590" }}>Workstream AI scales with teams of any size in any industry.</span>
      </h2>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,.03)", border: "1px solid #21262d", borderRadius: 40, padding: 4 }}>
          {["By industry", "By size", "By use case"].map((label, i) => (
            <button key={label} onClick={() => setF(i)} style={{ padding: "8px 20px", borderRadius: 40, border: f === i ? "1px solid #30363d" : "1px solid transparent", background: f === i ? "#161b22" : "transparent", color: f === i ? "#e6edf3" : "#7d8590", fontSize: 14, cursor: "pointer", transition: "all .2s" }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="ws-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, maxWidth: 1080, margin: "0 auto" }}>
        {stories.map((s, i) => (
          <div key={i} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, overflow: "hidden", textAlign: "left", cursor: "pointer", transition: "border-color .2s,transform .2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#388bfd"; e.currentTarget.style.transform = "translateY(-3px)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#21262d"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ height: 200, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.logo}</div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: "#7d8590", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{s.tag}</div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{s.title}</div>
              {s.link && <a style={{ color: "#388bfd", textDecoration: "none", fontSize: 13, fontWeight: 500, display: "block", marginTop: 12 }}>{s.link}</a>}
            </div>
          </div>
        ))}
      </div>
    </RevealSection>
  );
};

const FinalCTA = ({ onAuth }: { onAuth: () => void }) => (
  <RevealSection style={{ padding: "80px 24px", textAlign: "center", borderTop: "1px solid #21262d", background: "#010409" }}>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 280, position: "relative", marginBottom: 48 }}>
      <div style={{ animation: "floatA 4.8s ease-in-out infinite", marginRight: -28, zIndex: 2 }}><Robot w={198} /></div>
      <div style={{ animation: "floatB 5.4s ease-in-out infinite", marginBottom: 32, zIndex: 3 }}><PinkBird w={158} /></div>
      <div style={{ animation: "floatC 5.8s ease-in-out infinite", marginLeft: -28, zIndex: 2 }}><Duck w={168} /></div>
      <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 650, height: 100, background: "radial-gradient(ellipse at 50% 100%,rgba(88,28,220,.42) 0%,transparent 70%)", zIndex: 1, pointerEvents: "none" }} />
    </div>
    <h2 style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 800, letterSpacing: "-2px", maxWidth: 780, margin: "0 auto 20px", lineHeight: 1.1 }}>
      Teams building reliable operations
      <br />
      run on Workstream AI
    </h2>
    <p style={{ color: "#7d8590", fontSize: 16, maxWidth: 680, margin: "0 auto 36px", lineHeight: 1.7 }}>
      Whether you are scaling procurement, onboarding, contracts, or meeting execution, Workstream AI helps your teams coordinate with speed, clarity, and accountability.
    </p>
    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
        <input type="email" placeholder="Enter your email" style={{ background: "rgba(255,255,255,.07)", border: "none", outline: "none", color: "#e6edf3", fontSize: 14, padding: "10px 16px", width: 216 }} />
        <button onClick={onAuth} style={{ background: "#238636", border: "none", color: "white", fontSize: 14, fontWeight: 600, padding: "10px 20px", cursor: "pointer", whiteSpace: "nowrap", transition: "background .15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#2ea043"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#238636"; }}>Go to Login</button>
      </div>
      <button onClick={onAuth} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 6, color: "#e6edf3", fontSize: 14, fontWeight: 600, padding: "10px 20px", cursor: "pointer", whiteSpace: "nowrap", transition: "background .15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.07)"; }}>Create account</button>
    </div>
  </RevealSection>
);

const FOOTER = [
  { h: "Product", ls: ["Features", "Enterprise", "Workflow AI", "Security", "Pricing", "Resources", "Roadmap", "Compare"] },
  { h: "Platform", ls: ["Developer API", "Integrations", "Desktop", "Status"] },
  { h: "Support", ls: ["Docs", "Community", "Professional Services", "Premium Support", "Training", "Contact"] },
  { h: "Company", ls: ["About", "Customer stories", "Blog", "Careers", "Press", "Inclusion"] },
];

const Footer = () => (
  <footer style={{ borderTop: "1px solid #21262d", padding: "48px 24px 32px" }}>
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="ws-footer-grid" style={{ display: "flex", gap: 52, flexWrap: "wrap", marginBottom: 40 }}>
        <div><div style={{ marginBottom: 12, opacity: 0.45 }}><GHLogo /></div></div>
        {FOOTER.map((col) => (
          <div key={col.h}>
            <h5 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#7d8590", marginBottom: 12 }}>{col.h}</h5>
            {col.ls.map((l) => (
              <a key={l} href="#" style={{ display: "block", fontSize: 13, color: "#484f58", textDecoration: "none", marginBottom: 8, transition: "color .15s" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#e6edf3"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#484f58"; }}>{l}</a>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #21262d", paddingTop: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#484f58" }}>
        <div style={{ opacity: 0.4 }}><GHLogo /></div>
        <span>© 2026 Workstream AI, Inc.</span>
        {["Terms", "Privacy", "Sitemap", "Manage cookies", "Do not share my personal information"].map((l) => (
          <a key={l} href="#" style={{ color: "#484f58", textDecoration: "none" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#e6edf3"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#484f58"; }}>{l}</a>
        ))}
      </div>
    </div>
  </footer>
);

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  const goAuth = () => navigate("/login");

  return (
    <div className="ws-landing">
      <style>{globalStyles}</style>
      <Nav onAuth={goAuth} />
      <Hero onAuth={goAuth} />
      <TabsSection />
      <Logos />
      <AgentCard />
      <AutomateSection />
      <SecureSection />
      <ScalesSection />
      <FinalCTA onAuth={goAuth} />
      <Footer />
    </div>
  );
}
