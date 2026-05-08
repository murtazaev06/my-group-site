import { useState, useEffect, useRef, useCallback } from "react";

const SB_URL = "https://vimucytjdrnfsczufkfm.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbXVjeXRqZHJuZnNjenVma2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzEzNjEsImV4cCI6MjA5Mzc0NzM2MX0.hhKmz9k19YvnkxJ7okyNELMUeG6-HbWyNz9b9xmtNJk";
const BUCKET = "group-files";
const ADMIN_PASSWORD = "starosta2024";

const CAT = {
  "Расписание": { color: "#e8789f", bg: "rgba(232,120,159,0.08)", dot: "#e8789f" },
  "Лекции":     { color: "#e8956d", bg: "rgba(232,149,109,0.08)", dot: "#e8956d" },
  "Задания":    { color: "#7ab87a", bg: "rgba(122,184,122,0.08)", dot: "#7ab87a" },
  "Другое":     { color: "#9b87c8", bg: "rgba(155,135,200,0.08)", dot: "#9b87c8" },
};
const CATS = Object.keys(CAT);

const api = {
  h: () => ({ "Content-Type":"application/json", apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }),
  async getAnns() {
    const r = await fetch(`${SB_URL}/rest/v1/announcements?order=pinned.desc,created_at.desc`, { headers:api.h() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async addAnn(d) {
    const r = await fetch(`${SB_URL}/rest/v1/announcements`, { method:"POST", headers:{...api.h(),Prefer:"return=representation"}, body:JSON.stringify(d) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json())[0];
  },
  async updateAnn(id, d) {
    const r = await fetch(`${SB_URL}/rest/v1/announcements?id=eq.${id}`, { method:"PATCH", headers:{...api.h(),Prefer:"return=representation"}, body:JSON.stringify(d) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json())[0];
  },
  async deleteAnn(id) {
    await fetch(`${SB_URL}/rest/v1/announcements?id=eq.${id}`, { method:"DELETE", headers:api.h() });
  },
  async getFiles() {
    const r = await fetch(`${SB_URL}/rest/v1/files?order=created_at.desc`, { headers:api.h() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async uploadFile(file, path) {
    const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method:"POST", headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":file.type||"application/octet-stream" }, body:file,
    });
    if (!r.ok) throw new Error(await r.text());
    return `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  },
  async deleteStorage(path) {
    await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, { method:"DELETE", headers:api.h(), body:JSON.stringify({prefixes:[path]}) });
  },
  async addFile(d) {
    const r = await fetch(`${SB_URL}/rest/v1/files`, { method:"POST", headers:{...api.h(),Prefer:"return=representation"}, body:JSON.stringify(d) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json())[0];
  },
  async updateFile(id, d) {
    const r = await fetch(`${SB_URL}/rest/v1/files?id=eq.${id}`, { method:"PATCH", headers:{...api.h(),Prefer:"return=representation"}, body:JSON.stringify(d) });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json())[0];
  },
  async deleteFile(id) {
    await fetch(`${SB_URL}/rest/v1/files?id=eq.${id}`, { method:"DELETE", headers:api.h() });
  },
};

export default function App() {
  const [tab, setTab]             = useState("dashboard");
  const [files, setFiles]         = useState([]);
  const [anns, setAnns]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast]         = useState(null);
  const [filterCat, setFilterCat] = useState("Все");
  const [isMobile, setIsMobile]   = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const showToast = useCallback((msg, type="ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [f, a] = await Promise.all([api.getFiles(), api.getAnns()]);
      setFiles(f); setAnns(a);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goTab = (id) => {
    if (id === "admin" && !isAdmin) { setShowLogin(true); return; }
    setTab(id); window.scrollTo(0,0);
  };

  const schedFiles    = files.filter(f => f.category === "Расписание");
  const filteredFiles = filterCat === "Все" ? files : files.filter(f => f.category === filterCat);

  const TABS = [
    { id:"dashboard", label:"Главная" },
    { id:"schedule",  label:"Расписание" },
    { id:"files",     label:"Файлы" },
    { id:"news",      label:"Объявления" },
    { id:"admin",     label: isAdmin ? "Панель" : "Войти" },
  ];

  const shared = { tab, isAdmin, setIsAdmin, setTab:goTab, isMobile, loading, error, files, anns, schedFiles, filteredFiles, filterCat, setFilterCat, showToast, load, setFiles, setAnns };

  return (
    <div style={{ minHeight:"100vh", background:"#faf8f6", fontFamily:"'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#faf8f6; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#e8c4d0; border-radius:4px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastSlide { from{opacity:0;transform:translateX(-50%) translateY(-10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        input,textarea,select { font-family:'Montserrat',sans-serif; }
        input:focus,textarea:focus,select:focus { outline:none; border-color:#e8789f !important; }
        button { cursor:pointer; -webkit-tap-highlight-color:transparent; font-family:'Montserrat',sans-serif; }
        a { -webkit-tap-highlight-color:transparent; }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", top:20, left:"50%", zIndex:9999,
          animation:"toastSlide .25s ease",
          transform:"translateX(-50%)",
          background: toast.type==="err" ? "#fff0f3" : "#fff",
          border:`1px solid ${toast.type==="err"?"#f5c0cc":"#f0e0e8"}`,
          color: toast.type==="err" ? "#c0364f" : "#2d1f27",
          padding:"10px 22px", borderRadius:40, fontSize:13, fontWeight:600,
          boxShadow:"0 4px 20px rgba(0,0,0,.08)", whiteSpace:"nowrap",
        }}>{toast.msg}</div>
      )}

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(250,248,246,.9)", backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:900, padding:20 }}
          onClick={() => setShowLogin(false)}>
          <LoginBox onSuccess={() => { setIsAdmin(true); setShowLogin(false); goTab("admin"); showToast("Добро пожаловать, Огабек"); }} />
        </div>
      )}

      {isMobile
        ? <MobileLayout TABS={TABS} goTab={goTab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} {...shared} />
        : <DesktopLayout TABS={TABS} goTab={goTab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} {...shared} />
      }
    </div>
  );
}

/* ─────────────────────────── DESKTOP ─────────────────────────── */
function DesktopLayout({ TABS, goTab, tab, isAdmin, setIsAdmin, setTab, ...rest }) {
  return (
    <div style={{ display:"flex", minHeight:"100vh" }}>
      {/* Sidebar */}
      <aside style={{ width:260, background:"#fff", borderRight:"1px solid #f0e8ec", display:"flex", flexDirection:"column", padding:"36px 24px", position:"sticky", top:0, height:"100vh", flexShrink:0, justifyContent:"space-between" }}>
        <div>
          {/* Logo */}
          <div style={{ marginBottom:48 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#c8a0b0", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>Университет</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#1a1015", lineHeight:1.2 }}>Менеджмент</div>
            <div style={{ fontSize:12, fontWeight:500, color:"#b09aa8", marginTop:4 }}>Экономический факультет</div>
          </div>

          {/* Nav */}
          <nav style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => goTab(t.id)} style={{
                display:"block", padding:"11px 16px", borderRadius:12, border:"none",
                background: tab===t.id ? "linear-gradient(135deg,#fde8ef,#fdeee6)" : "transparent",
                color: tab===t.id ? "#d95b7e" : "#a08090",
                fontSize:14, fontWeight: tab===t.id ? 700 : 500,
                textAlign:"left", transition:"all .15s",
              }}>{t.label}</button>
            ))}
          </nav>
        </div>

        {/* Bottom card */}
        <div style={{ background:"linear-gradient(135deg,#fde8ef,#fdeee6)", borderRadius:18, padding:"18px 16px" }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#e8789f,#e8956d)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#fff", fontSize:15, marginBottom:10 }}>О</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#1a1015" }}>Огабек</div>
          <div style={{ fontSize:11, fontWeight:500, color:"#b09aa8", marginTop:2 }}>Дежурный группы</div>
          {isAdmin && (
            <button onClick={() => { setIsAdmin(false); setTab("dashboard"); }} style={{ marginTop:12, width:"100%", padding:"8px", borderRadius:10, border:"1px solid rgba(217,91,126,.2)", background:"transparent", color:"#d95b7e", fontSize:12, fontWeight:600 }}>
              Выйти из панели
            </button>
          )}
          {!isAdmin && (
            <button onClick={() => goTab("admin")} style={{ marginTop:12, width:"100%", padding:"8px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#e8789f,#e8956d)", color:"#fff", fontSize:12, fontWeight:700 }}>
              Войти как Огабек
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflowY:"auto" }}>
        <Pages tab={tab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} setTab={setTab} isMobile={false} {...rest} />
      </main>
    </div>
  );
}

/* ─────────────────────────── MOBILE ──────────────────────────── */
function MobileLayout({ TABS, goTab, tab, isAdmin, setIsAdmin, setTab, showToast, ...rest }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", paddingBottom:68 }}>
      {/* Header */}
      <header style={{ background:"#fff", borderBottom:"1px solid #f0e8ec", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#c8a0b0", letterSpacing:"0.1em", textTransform:"uppercase" }}>Экон. факультет</div>
          <div style={{ fontSize:17, fontWeight:800, color:"#1a1015", marginTop:1 }}>Менеджмент</div>
        </div>
        <button onClick={() => isAdmin ? (setIsAdmin(false), setTab("dashboard")) : goTab("admin")}
          style={{ padding:"7px 16px", borderRadius:20, border:"none", background: isAdmin ? "#fff0f3" : "linear-gradient(135deg,#e8789f,#e8956d)", color: isAdmin ? "#c0364f" : "#fff", fontSize:12, fontWeight:700 }}>
          {isAdmin ? "Выйти" : "Войти"}
        </button>
      </header>

      <main style={{ flex:1 }}>
        <Pages tab={tab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} setTab={setTab} isMobile={true} showToast={showToast} {...rest} />
      </main>

      {/* Bottom nav */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"#1a1015", display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom,0px)", borderRadius:"16px 16px 0 0" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => goTab(t.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 4px 10px", border:"none", background:"transparent", color: tab===t.id ? "#e8789f" : "rgba(255,255,255,.35)", fontSize:10, fontWeight: tab===t.id ? 700 : 500, gap:4, transition:"all .15s" }}>
            <NavDot active={tab===t.id} id={t.id} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function NavDot({ active, id }) {
  const icons = { dashboard:"⌂", schedule:"◫", files:"▤", news:"◈", admin:"◉" };
  return <span style={{ fontSize:17, lineHeight:1, opacity: active?1:.5 }}>{icons[id]||"·"}</span>;
}

/* ─────────────────────────── PAGES ───────────────────────────── */
function Pages({ tab, isAdmin, setIsAdmin, setTab, isMobile, loading, error, files, anns, schedFiles, filteredFiles, filterCat, setFilterCat, showToast, load, setFiles, setAnns }) {
  const pad = { padding: isMobile ? "24px 20px" : "40px 44px", maxWidth:1000, margin:"0 auto", animation:"fadeUp .3s ease" };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap:16 }}>
      <div style={{ width:36, height:36, border:"3px solid #f0e0e8", borderTopColor:"#e8789f", borderRadius:"50%", animation:"spin .7s linear infinite" }} />
      <div style={{ fontSize:13, fontWeight:500, color:"#b09aa8" }}>Загрузка…</div>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap:16, padding:24, textAlign:"center" }}>
      <div style={{ fontSize:13, fontWeight:600, color:"#c0364f" }}>Ошибка подключения к Supabase</div>
      <div style={{ background:"#1a1015", borderRadius:14, padding:"16px 20px", color:"#f0d0d8", fontSize:11, fontFamily:"monospace", maxWidth:480, textAlign:"left", lineHeight:2, width:"100%", overflowX:"auto" }}>
        {"CREATE TABLE announcements (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text, body text, emoji text DEFAULT '📌', pinned boolean DEFAULT false, created_at timestamptz DEFAULT now());\n\nCREATE TABLE files (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text, category text, file_name text, file_url text, storage_path text, size_bytes bigint DEFAULT 0, created_at timestamptz DEFAULT now());\n\nALTER TABLE announcements ENABLE ROW LEVEL SECURITY;\nALTER TABLE files ENABLE ROW LEVEL SECURITY;\nCREATE POLICY \"all\" ON announcements FOR ALL USING (true);\nCREATE POLICY \"all\" ON files FOR ALL USING (true);"}
      </div>
      <button onClick={load} style={{ padding:"10px 24px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#e8789f,#e8956d)", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"'Montserrat',sans-serif" }}>Попробовать снова</button>
    </div>
  );

  /* ── DASHBOARD ── */
  if (tab === "dashboard") return (
    <div style={pad}>
      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#fce8ef 0%,#fdeee6 50%,#fce8f5 100%)", borderRadius:24, padding: isMobile?"24px 20px":"36px 40px", marginBottom:24, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:"rgba(232,120,159,.08)" }} />
        <div style={{ position:"absolute", bottom:-60, right:60, width:150, height:150, borderRadius:"50%", background:"rgba(232,149,109,.06)" }} />
        <div style={{ fontSize:11, fontWeight:700, color:"#e8789f", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10, position:"relative" }}>
          {new Date().toLocaleDateString("ru",{weekday:"long",day:"numeric",month:"long"})}
        </div>
        <div style={{ fontSize: isMobile?28:42, fontWeight:800, color:"#1a1015", lineHeight:1.15, position:"relative" }}>
          Добро<br />пожаловать
        </div>
        <div style={{ fontSize:13, fontWeight:500, color:"#b09aa8", marginTop:8, position:"relative" }}>Портал группы Менеджмент</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Файлов загружено", value:files.length, color:"#e8789f", bg:"linear-gradient(135deg,#fce8ef,#fdf4f7)" },
          { label:"Расписаний",       value:schedFiles.length, color:"#e8956d", bg:"linear-gradient(135deg,#fdeee6,#fdf7f4)" },
          { label:"Объявлений",       value:anns.length, color:"#9b87c8", bg:"linear-gradient(135deg,#f0ecf8,#f7f4fc)" },
          { label:"Категорий",        value:CATS.length, color:"#7ab87a", bg:"linear-gradient(135deg,#ecf5ec,#f4faf4)" },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:20, padding:isMobile?"16px":"20px 22px" }}>
            <div style={{ fontSize: isMobile?30:36, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, fontWeight:600, color:"#b09aa8", marginTop:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent files */}
      <Section title="Последние файлы" action="Все →" onAction={() => setTab("files")}>
        {files.length === 0
          ? <Blank text="Файлов пока нет" />
          : files.slice(0, isMobile?3:5).map(f => <FileRow key={f.id} file={f} />)
        }
      </Section>

      {/* Announcements */}
      <Section title="Объявления" action="Все →" onAction={() => setTab("news")} mt>
        {anns.length === 0
          ? <Blank text="Объявлений пока нет" />
          : anns.slice(0,3).map(a => (
            <div key={a.id} style={{ padding:"12px 0", borderBottom:"1px solid #f5edf0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                {a.pinned && <span style={{ fontSize:10, fontWeight:700, color:"#e8956d", letterSpacing:"0.06em", textTransform:"uppercase" }}>Закреплено</span>}
                <span style={{ fontSize:10, color:"#c8a8b8", fontWeight:500 }}>{new Date(a.created_at).toLocaleDateString("ru")}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:"#1a1015" }}>{a.title}</div>
            </div>
          ))
        }
      </Section>

      {/* Schedule */}
      <Section title="Расписание" action="Открыть →" onAction={() => setTab("schedule")} mt>
        {schedFiles.length === 0
          ? <Blank text="Расписание не загружено" sub="Огабек загрузит — появится здесь" />
          : <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"repeat(3,1fr)", gap:10, marginTop:4 }}>
              {schedFiles.slice(0,3).map(f => <FileCard key={f.id} file={f} isAdmin={isAdmin} setFiles={setFiles} showToast={showToast} />)}
            </div>
        }
      </Section>
    </div>
  );

  /* ── SCHEDULE ── */
  if (tab === "schedule") return (
    <div style={pad}>
      <PageHeader title="Расписание" count={schedFiles.length} isMobile={isMobile} onRefresh={load} />
      {schedFiles.length === 0
        ? <Blank text="Расписание не загружено" sub="Войдите как Огабек и загрузите файл" large />
        : <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
            {schedFiles.map(f => <FileCard key={f.id} file={f} isAdmin={isAdmin} setFiles={setFiles} showToast={showToast} />)}
          </div>
      }
    </div>
  );

  /* ── FILES ── */
  if (tab === "files") return (
    <div style={pad}>
      <PageHeader title="Файлы" count={files.length} isMobile={isMobile} onRefresh={load} />
      <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap" }}>
        {["Все",...CATS].map(c => (
          <button key={c} onClick={() => setFilterCat(c)} style={{ padding:"7px 16px", borderRadius:20, border:`1px solid ${filterCat===c?"#e8789f":"#f0e0e8"}`, background: filterCat===c?"linear-gradient(135deg,#fce8ef,#fdeee6)":"#fff", color: filterCat===c?"#d95b7e":"#b09aa8", fontSize:12, fontWeight: filterCat===c?700:500 }}>
            {c}
          </button>
        ))}
      </div>
      {filteredFiles.length === 0
        ? <Blank text="Файлов нет" large />
        : <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(auto-fill,minmax(210px,1fr))", gap:14 }}>
            {filteredFiles.map(f => <FileCard key={f.id} file={f} isAdmin={isAdmin} setFiles={setFiles} showToast={showToast} />)}
          </div>
      }
    </div>
  );

  /* ── NEWS ── */
  if (tab === "news") return (
    <div style={pad}>
      <PageHeader title="Объявления" count={anns.length} isMobile={isMobile} onRefresh={load} />
      {anns.length === 0
        ? <Blank text="Объявлений пока нет" large />
        : <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {anns.map(a => (
              <AnnCard key={a.id} ann={a} isAdmin={isAdmin} isMobile={isMobile}
                onDelete={async () => { try{await api.deleteAnn(a.id);setAnns(p=>p.filter(x=>x.id!==a.id));showToast("Удалено");}catch{showToast("Ошибка","err");} }}
                onEdit={async d => { try{const u=await api.updateAnn(a.id,d);setAnns(p=>p.map(x=>x.id===a.id?u:x));showToast("Сохранено");}catch{showToast("Ошибка","err");} }}
              />
            ))}
          </div>
      }
    </div>
  );

  /* ── ADMIN ── */
  if (tab === "admin" && isAdmin) return (
    <AdminPanel isMobile={isMobile} files={files} anns={anns} setFiles={setFiles} setAnns={setAnns} showToast={showToast} setIsAdmin={setIsAdmin} setTab={setTab} load={load} />
  );

  return null;
}

/* ─────────────────────────── ADMIN ───────────────────────────── */
function AdminPanel({ isMobile, files, anns, setFiles, setAnns, showToast, setIsAdmin, setTab, load }) {
  const [aTab, setATab]           = useState("upload");
  const [uName, setUName]         = useState("");
  const [uCat, setUCat]           = useState("Расписание");
  const [uFile, setUFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct]             = useState(0);
  const [dragging, setDragging]   = useState(false);
  const [aTitle, setATitle]       = useState("");
  const [aBody, setABody]         = useState("");
  const [aPinned, setAPinned]     = useState(false);
  const [posting, setPosting]     = useState(false);
  const fileRef = useRef();
  const pad = { padding: isMobile?"24px 20px":"40px 44px", maxWidth:1000, margin:"0 auto", animation:"fadeUp .3s ease" };

  const pick = f => { if(!f)return; setUFile(f); if(!uName) setUName(f.name.replace(/\.[^.]+$/,"")); };

  const upload = async () => {
    if (!uName.trim()||!uFile) return showToast("Выберите файл и введите название","err");
    setUploading(true); setPct(15);
    try {
      const ext  = uFile.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      setPct(40);
      const url  = await api.uploadFile(uFile, path); setPct(75);
      const rec  = await api.addFile({ name:uName.trim(), category:uCat, file_name:uFile.name, file_url:url, storage_path:path, size_bytes:uFile.size }); setPct(100);
      setFiles(prev => [rec,...prev]);
      setUName(""); setUFile(null); if(fileRef.current) fileRef.current.value="";
      showToast("Файл загружен в облако");
    } catch(e) { showToast("Ошибка: "+e.message,"err"); }
    finally { setUploading(false); setPct(0); }
  };

  const postAnn = async () => {
    if (!aTitle.trim()||!aBody.trim()) return showToast("Заполните заголовок и текст","err");
    setPosting(true);
    try {
      const a = await api.addAnn({ title:aTitle.trim(), body:aBody.trim(), emoji:"·", pinned:aPinned });
      setAnns(prev => [a,...prev]);
      setATitle(""); setABody(""); setAPinned(false);
      showToast("Объявление опубликовано");
    } catch(e) { showToast("Ошибка: "+e.message,"err"); }
    finally { setPosting(false); }
  };

  const subTabs = ["upload","announce","manage"];
  const subLabels = { upload:"Загрузить файл", announce:"Объявление", manage:"Управление" };

  return (
    <div style={pad}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#e8789f", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Администратор</div>
          <h1 style={{ fontSize: isMobile?24:32, fontWeight:800, color:"#1a1015" }}>Панель старосты</h1>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={load} style={T.btnGhost}>Обновить</button>
          {!isMobile && <button onClick={()=>{setIsAdmin(false);setTab("dashboard");}} style={T.btnGhost}>Выйти</button>}
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:28, borderBottom:"2px solid #f0e8ec" }}>
        {subTabs.map(t => (
          <button key={t} onClick={() => setATab(t)} style={{ padding:"10px 20px", border:"none", background:"transparent", fontSize:13, fontWeight: aTab===t?700:500, color: aTab===t?"#d95b7e":"#b09aa8", borderBottom:`2px solid ${aTab===t?"#e8789f":"transparent"}`, marginBottom:-2, transition:"all .15s" }}>
            {subLabels[t]}
          </button>
        ))}
      </div>

      {/* UPLOAD */}
      {aTab==="upload" && (
        <div style={{ maxWidth:560 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={T.label}>Название файла</label>
              <input style={T.input} placeholder="например: Расписание — Май 2026" value={uName} onChange={e=>setUName(e.target.value)} />
            </div>
            <div>
              <label style={T.label}>Категория</label>
              <select style={T.input} value={uCat} onChange={e=>setUCat(e.target.value)}>
                {CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={T.label}>Файл</label>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={e=>{e.preventDefault();setDragging(true);}}
                onDragLeave={()=>setDragging(false)}
                onDrop={e=>{e.preventDefault();setDragging(false);pick(e.dataTransfer.files[0]);}}
                style={{ border:`1.5px dashed ${dragging?"#e8789f":uFile?"#7ab87a":"#f0d8e0"}`, borderRadius:16, padding:"32px 20px", textAlign:"center", cursor:"pointer", background: dragging?"#fce8ef":uFile?"#ecf5ec":"#fdfafb", transition:"all .2s" }}>
                <div style={{ fontSize:13, fontWeight:600, color: uFile?"#5a9a5a":"#b09aa8" }}>
                  {uFile ? uFile.name : "Нажмите или перетащите файл"}
                </div>
                {uFile && <div style={{ fontSize:11, color:"#a0b8a0", marginTop:4 }}>{(uFile.size/1024/1024).toFixed(2)} МБ</div>}
                {!uFile && <div style={{ fontSize:11, color:"#c8b0b8", marginTop:6 }}>PDF, Word, Excel, изображения и другие</div>}
              </div>
              <input ref={fileRef} type="file" style={{ display:"none" }} onChange={e=>pick(e.target.files[0])} />
            </div>
            {uploading && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#b09aa8", marginBottom:6 }}>
                  <span>Загрузка в облако…</span><span>{pct}%</span>
                </div>
                <div style={{ height:4, background:"#f0e0e8", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#e8789f,#e8956d)", borderRadius:4, transition:"width .4s" }} />
                </div>
              </div>
            )}
            <button style={{ ...T.btnPrimary, opacity:uploading?.7:1 }} onClick={upload} disabled={uploading}>
              {uploading ? "Загружается…" : "Загрузить в облако"}
            </button>
          </div>
        </div>
      )}

      {/* ANNOUNCE */}
      {aTab==="announce" && (
        <div style={{ maxWidth:560 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={T.label}>Заголовок</label>
              <input style={T.input} placeholder="Заголовок объявления" value={aTitle} onChange={e=>setATitle(e.target.value)} />
            </div>
            <div>
              <label style={T.label}>Текст</label>
              <textarea style={{ ...T.input, height:140, resize:"vertical" }} placeholder="Текст объявления..." value={aBody} onChange={e=>setABody(e.target.value)} />
            </div>
            <div onClick={()=>setAPinned(v=>!v)} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", userSelect:"none" }}>
              <div style={{ width:40, height:22, borderRadius:11, background: aPinned?"linear-gradient(135deg,#e8789f,#e8956d)":"#f0e0e8", position:"relative", transition:"all .2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:2, left: aPinned?19:2, width:18, height:18, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,.15)", transition:"left .2s" }} />
              </div>
              <span style={{ fontSize:13, fontWeight:500, color:"#7a6070" }}>Закрепить объявление</span>
            </div>
            <button style={{ ...T.btnPrimary, opacity:posting?.7:1 }} onClick={postAnn} disabled={posting}>
              {posting ? "Публикуется…" : "Опубликовать"}
            </button>
          </div>
        </div>
      )}

      {/* MANAGE */}
      {aTab==="manage" && (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1a1015", marginBottom:14 }}>Файлы в облаке ({files.length})</div>
            {files.length===0 ? <Blank text="Файлов нет" /> : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {files.map(f => (
                  <ManageRow key={f.id} file={f}
                    onDelete={async()=>{ try{await api.deleteStorage(f.storage_path);await api.deleteFile(f.id);setFiles(p=>p.filter(x=>x.id!==f.id));showToast("Файл удалён");}catch(e){showToast("Ошибка","err");} }}
                    onSave={async(name,cat)=>{ try{const u=await api.updateFile(f.id,{name,category:cat});setFiles(p=>p.map(x=>x.id===f.id?u:x));showToast("Сохранено");}catch{showToast("Ошибка","err");} }}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1a1015", marginBottom:14 }}>Объявления ({anns.length})</div>
            {anns.length===0 ? <Blank text="Нет объявлений" /> : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {anns.map(a => (
                  <div key={a.id} style={{ display:"flex", alignItems:"center", gap:12, background:"#fff", border:"1px solid #f0e8ec", borderRadius:14, padding:"12px 16px" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#1a1015", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.title}</div>
                      <div style={{ fontSize:11, color:"#b09aa8", marginTop:2 }}>{new Date(a.created_at).toLocaleDateString("ru")}{a.pinned?" · Закреплено":""}</div>
                    </div>
                    <button onClick={async()=>{ try{await api.deleteAnn(a.id);setAnns(p=>p.filter(x=>x.id!==a.id));showToast("Удалено");}catch{showToast("Ошибка","err");} }}
                      style={{ padding:"6px 12px", borderRadius:10, border:"1px solid #f5c0cc", background:"#fff0f3", color:"#c0364f", fontSize:12, fontWeight:600 }}>Удалить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── COMPONENTS ──────────────────────── */
function LoginBox({ onSuccess }) {
  const [pw, setPw]   = useState("");
  const [err, setErr] = useState("");
  const check = () => pw===ADMIN_PASSWORD ? onSuccess() : setErr("Неверный пароль");
  return (
    <div style={{ background:"#fff", borderRadius:28, padding:"44px 36px", width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,.08)", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
      <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,#e8789f,#e8956d)", margin:"0 auto 20px", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:22, color:"#fff" }}>✦</span>
      </div>
      <div style={{ fontSize:20, fontWeight:800, color:"#1a1015", marginBottom:6 }}>Вход для старосты</div>
      <div style={{ fontSize:13, color:"#b09aa8", marginBottom:24, fontWeight:500 }}>Только Огабек может управлять сайтом</div>
      <input style={{ ...T.input, textAlign:"center", marginBottom:12 }} type="password" placeholder="Пароль" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} autoFocus />
      {err && <div style={{ color:"#c0364f", fontSize:12, fontWeight:600, marginBottom:12 }}>{err}</div>}
      <button style={{ ...T.btnPrimary, width:"100%" }} onClick={check}>Войти</button>
    </div>
  );
}

function FileCard({ file, isAdmin, setFiles, showToast }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(file.name);
  const [cat, setCat]         = useState(file.category);
  const ext  = file.file_name?.split(".").pop()?.toUpperCase()||"FILE";
  const isImg = ["JPG","JPEG","PNG","GIF","WEBP","SVG"].includes(ext);
  const meta  = CAT[file.category]||{ color:"#a8a0b0", bg:"rgba(168,160,176,.08)", dot:"#a8a0b0" };

  const save = async () => {
    try { const u=await api.updateFile(file.id,{name,category:cat}); setFiles(p=>p.map(x=>x.id===file.id?u:x)); setEditing(false); showToast("Сохранено"); }
    catch { showToast("Ошибка","err"); }
  };
  const del = async () => {
    try { await api.deleteStorage(file.storage_path); await api.deleteFile(file.id); setFiles(p=>p.filter(x=>x.id!==file.id)); showToast("Файл удалён"); }
    catch { showToast("Ошибка","err"); }
  };

  return (
    <div style={{ background:"#fff", border:"1px solid #f0e8ec", borderRadius:20, padding:16, display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ background:meta.bg, color:meta.color, fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, textTransform:"uppercase", letterSpacing:"0.06em" }}>{file.category}</div>
        <div style={{ fontSize:10, color:"#c8b0b8", fontFamily:"monospace" }}>{ext}</div>
      </div>
      {isImg
        ? <img src={file.file_url} alt={file.name} style={{ width:"100%", borderRadius:12, maxHeight:100, objectFit:"cover" }} />
        : <div style={{ height:60, background:meta.bg, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:4, height:32, borderRadius:2, background:meta.dot, opacity:.4 }} />
            <div style={{ width:4, height:44, borderRadius:2, background:meta.dot, margin:"0 4px" }} />
            <div style={{ width:4, height:24, borderRadius:2, background:meta.dot, opacity:.6 }} />
            <div style={{ width:4, height:38, borderRadius:2, background:meta.dot, margin:"0 4px" }} />
            <div style={{ width:4, height:28, borderRadius:2, background:meta.dot, opacity:.4 }} />
          </div>
      }
      {editing ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <input style={{ ...T.input, fontSize:12 }} value={name} onChange={e=>setName(e.target.value)} />
          <select style={{ ...T.input, fontSize:12 }} value={cat} onChange={e=>setCat(e.target.value)}>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          <div style={{ display:"flex", gap:6 }}>
            <button style={{ ...T.btnPrimary, flex:1, padding:"8px", fontSize:12 }} onClick={save}>Сохранить</button>
            <button style={{ ...T.btnGhost, padding:"8px 12px", fontSize:12 }} onClick={()=>setEditing(false)}>✕</button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1a1015", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</div>
            <div style={{ fontSize:11, color:"#c8b0b8", marginTop:2 }}>{new Date(file.created_at).toLocaleDateString("ru")} · {(file.size_bytes/1024).toFixed(0)} КБ</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <a href={file.file_url} target="_blank" rel="noreferrer" download={file.file_name}
              style={{ flex:1, textAlign:"center", padding:"9px 4px", borderRadius:12, background:`linear-gradient(135deg,${meta.bg},${meta.bg})`, color:meta.color, fontWeight:700, fontSize:12, textDecoration:"none", border:`1px solid ${meta.color}30` }}>
              Скачать
            </a>
            {isAdmin && <>
              <button onClick={()=>setEditing(true)} style={{ padding:"9px 10px", borderRadius:12, background:"#fdeee6", border:"none", color:"#e8956d", fontSize:13, fontWeight:600 }}>✎</button>
              <button onClick={del}                  style={{ padding:"9px 10px", borderRadius:12, background:"#fff0f3", border:"none", color:"#c0364f", fontSize:13, fontWeight:600 }}>✕</button>
            </>}
          </div>
        </>
      )}
    </div>
  );
}

function AnnCard({ ann, isAdmin, isMobile, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(ann.title);
  const [b, setB] = useState(ann.body);
  return (
    <div style={{ background:"#fff", border:"1px solid #f0e8ec", borderRadius:20, padding: isMobile?"18px":"22px 26px" }}>
      {editing ? (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input style={T.input} value={t} onChange={e=>setT(e.target.value)} />
          <textarea style={{ ...T.input, height:100, resize:"vertical" }} value={b} onChange={e=>setB(e.target.value)} />
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...T.btnPrimary, flex:1, padding:"10px" }} onClick={()=>{onEdit({title:t,body:b,emoji:"·"});setEditing(false);}}>Сохранить</button>
            <button style={{ ...T.btnGhost, padding:"10px 16px" }} onClick={()=>setEditing(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
          <div style={{ width:4, borderRadius:2, alignSelf:"stretch", background: ann.pinned?"linear-gradient(180deg,#e8789f,#e8956d)":"#f0e0e8", flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              {ann.pinned && <span style={{ fontSize:10, fontWeight:700, color:"#e8956d", textTransform:"uppercase", letterSpacing:"0.06em" }}>Закреплено</span>}
              <span style={{ fontSize:11, color:"#c8b0b8", fontWeight:500 }}>{new Date(ann.created_at).toLocaleDateString("ru",{day:"numeric",month:"long",year:"numeric"})}</span>
            </div>
            <div style={{ fontSize: isMobile?15:17, fontWeight:700, color:"#1a1015", marginBottom:8 }}>{ann.title}</div>
            <div style={{ fontSize: isMobile?13:14, color:"#7a6070", lineHeight:1.7, fontWeight:400 }}>{ann.body}</div>
          </div>
          {isAdmin && (
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button onClick={()=>setEditing(true)} style={{ padding:"7px 12px", borderRadius:10, border:"1px solid #f0dde6", background:"#fff", color:"#b09aa8", fontSize:12, fontWeight:600 }}>✎</button>
              {!ann.pinned && <button onClick={onDelete} style={{ padding:"7px 12px", borderRadius:10, border:"1px solid #f5c0cc", background:"#fff0f3", color:"#c0364f", fontSize:12, fontWeight:600 }}>✕</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManageRow({ file, onDelete, onSave }) {
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(file.name);
  const [c, setC] = useState(file.category);
  const meta = CAT[file.category]||{ color:"#a8a0b0", dot:"#a8a0b0" };
  return (
    <div style={{ background:"#fff", border:"1px solid #f0e8ec", borderRadius:14, padding:"12px 16px" }}>
      {editing ? (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <input style={{ ...T.input, fontSize:13 }} value={n} onChange={e=>setN(e.target.value)} />
          <select style={{ ...T.input, fontSize:13 }} value={c} onChange={e=>setC(e.target.value)}>
            {CATS.map(x=><option key={x}>{x}</option>)}
          </select>
          <div style={{ display:"flex", gap:6 }}>
            <button style={{ ...T.btnPrimary, flex:1, padding:"8px", fontSize:12 }} onClick={()=>{onSave(n,c);setEditing(false);}}>Сохранить</button>
            <button style={{ ...T.btnGhost, padding:"8px 12px", fontSize:12 }} onClick={()=>setEditing(false)}>✕</button>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:3, height:32, borderRadius:2, background:meta.dot, flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#1a1015", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</div>
            <div style={{ fontSize:11, color:"#b09aa8" }}>{file.category} · {new Date(file.created_at).toLocaleDateString("ru")} · {(file.size_bytes/1024).toFixed(0)} КБ</div>
          </div>
          <a href={file.file_url} target="_blank" rel="noreferrer" style={{ padding:"6px 12px", borderRadius:10, border:"1px solid #d8f0d8", background:"#ecf5ec", color:"#5a9a5a", fontSize:12, fontWeight:600, textDecoration:"none" }}>Просмотр</a>
          <button onClick={()=>setEditing(true)} style={{ padding:"6px 12px", borderRadius:10, border:"1px solid #f0dde6", background:"#fff", color:"#b09aa8", fontSize:12, fontWeight:600 }}>Изм.</button>
          <button onClick={onDelete}             style={{ padding:"6px 12px", borderRadius:10, border:"1px solid #f5c0cc", background:"#fff0f3", color:"#c0364f", fontSize:12, fontWeight:600 }}>Удал.</button>
        </div>
      )}
    </div>
  );
}

function FileRow({ file }) {
  const meta = CAT[file.category]||{ color:"#a8a0b0", dot:"#a8a0b0" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:14, padding:"11px 0", borderBottom:"1px solid #f5edf0" }}>
      <div style={{ width:3, height:36, borderRadius:2, background:meta.dot, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#1a1015", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</div>
        <div style={{ fontSize:11, color:"#c8b0b8", marginTop:2 }}>{file.category} · {new Date(file.created_at).toLocaleDateString("ru")}</div>
      </div>
      <a href={file.file_url} target="_blank" rel="noreferrer" download={file.file_name}
        style={{ fontSize:12, fontWeight:700, color:meta.color, textDecoration:"none", flexShrink:0 }}>↓ Скачать</a>
    </div>
  );
}

function Section({ title, action, onAction, children, mt }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #f0e8ec", borderRadius:20, padding:"20px 22px", ...(mt?{marginTop:14}:{}) }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#1a1015" }}>{title}</div>
        {action && <button onClick={onAction} style={{ background:"none", border:"none", fontSize:12, fontWeight:600, color:"#e8789f" }}>{action}</button>}
      </div>
      {children}
    </div>
  );
}

function PageHeader({ title, count, isMobile, onRefresh }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28, flexWrap:"wrap", gap:12 }}>
      <div>
        <h1 style={{ fontSize: isMobile?26:34, fontWeight:800, color:"#1a1015" }}>{title}</h1>
        {count!==undefined && <div style={{ fontSize:12, color:"#b09aa8", fontWeight:500, marginTop:4 }}>{count} {count===1?"элемент":"элементов"}</div>}
      </div>
      <button onClick={onRefresh} style={T.btnGhost}>Обновить</button>
    </div>
  );
}

function Blank({ text, sub, large }) {
  return (
    <div style={{ textAlign:"center", padding: large?"60px 0":"32px 0" }}>
      <div style={{ width: large?48:36, height: large?48:36, borderRadius:"50%", border:`2px solid #f0e0e8`, margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width: large?16:12, height: large?16:12, borderRadius:"50%", background:"#f0e0e8" }} />
      </div>
      <div style={{ fontSize: large?15:13, fontWeight:600, color:"#c8a8b8" }}>{text}</div>
      {sub && <div style={{ fontSize:12, color:"#d8c0c8", marginTop:4, fontWeight:400 }}>{sub}</div>}
    </div>
  );
}

/* ─────────────────────────── TOKENS ──────────────────────────── */
const T = {
  input:      { width:"100%", padding:"12px 16px", borderRadius:12, border:"1px solid #f0e0e8", background:"#fdfafb", fontSize:14, color:"#1a1015", fontWeight:500, transition:"border .15s" },
  label:      { display:"block", fontSize:11, fontWeight:700, color:"#b09aa8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 },
  btnPrimary: { padding:"13px 24px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e8789f,#e8956d)", color:"#fff", fontWeight:700, fontSize:14, fontFamily:"'Montserrat',sans-serif", letterSpacing:"0.02em" },
  btnGhost:   { padding:"10px 20px", borderRadius:12, border:"1px solid #f0e0e8", background:"#fff", color:"#b09aa8", fontWeight:600, fontSize:13, fontFamily:"'Montserrat',sans-serif" },
};
