import { useState, useEffect, useRef, useCallback } from "react";

const SB_URL = "https://vimucytjdrnfsczufkfm.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpbXVjeXRqZHJuZnNjenVma2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzEzNjEsImV4cCI6MjA5Mzc0NzM2MX0.hhKmz9k19YvnkxJ7okyNELMUeG6-HbWyNz9b9xmtNJk";
const BUCKET = "group-files";
const ADMIN_PASSWORD = "starosta2024";

// Цвета категорий
const CAT = {
  "Расписание": { color:"#7c5cbf", bg:"rgba(124,92,191,0.10)", dot:"#7c5cbf", grad:"linear-gradient(135deg,#ede8f8,#e8e0f5)", light:"#f5f0fc" },
  "Лекции":     { color:"#e8956d", bg:"rgba(232,149,109,0.10)", dot:"#e8956d", grad:"linear-gradient(135deg,#fdeee6,#fdf6e8)", light:"#fff7f2" },
  "Задания":    { color:"#5aaa72", bg:"rgba(90,170,114,0.10)",  dot:"#5aaa72", grad:"linear-gradient(135deg,#e8f5ed,#dff2e5)", light:"#f2fbf5" },
  "Другое":     { color:"#e8789f", bg:"rgba(232,120,159,0.10)", dot:"#e8789f", grad:"linear-gradient(135deg,#fce8ef,#fde8f5)", light:"#fff0f5" },
};
const CATS = Object.keys(CAT);

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
const TIMES = ["08:00–09:20","09:30–10:50","11:00–12:20","13:30–14:50","15:00–16:20","16:30–18:00"];
const DEFAULT_SUBJECTS = ["Менеджмент организации","Экономическая теория","Маркетинг","Бухгалтерский учёт","Статистика","Иностранный язык"];

function getFileType(fn) {
  const e = (fn||"").split(".").pop().toLowerCase();
  if (e==="pdf") return "pdf";
  if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(e)) return "image";
  if (["doc","docx"].includes(e)) return "word";
  if (["xls","xlsx"].includes(e)) return "excel";
  if (["ppt","pptx"].includes(e)) return "ppt";
  if (["mp4","webm","mov"].includes(e)) return "video";
  if (["mp3","wav","m4a"].includes(e)) return "audio";
  return "other";
}

// Открывает файл локально — через прямую ссылку
// Браузер сам предложит открыть в приложении
function openFile(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  // Не ставим download — браузер попробует открыть, иначе скачает
  a.click();
}

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
  async deleteAnn(id) { await fetch(`${SB_URL}/rest/v1/announcements?id=eq.${id}`, { method:"DELETE", headers:api.h() }); },
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
  async deleteStorage(path) { await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, { method:"DELETE", headers:api.h(), body:JSON.stringify({prefixes:[path]}) }); },
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
  async deleteFile(id) { await fetch(`${SB_URL}/rest/v1/files?id=eq.${id}`, { method:"DELETE", headers:api.h() }); },
  // Расписание хранится в отдельной таблице
  async getSchedule() {
    const r = await fetch(`${SB_URL}/rest/v1/schedule?order=id.desc&limit=1`, { headers:api.h() });
    if (!r.ok) return null;
    const d = await r.json();
    return d[0]||null;
  },
  async saveSchedule(data) {
    // Upsert с id=1
    const r = await fetch(`${SB_URL}/rest/v1/schedule`, {
      method:"POST",
      headers:{...api.h(),Prefer:"return=representation,resolution=merge-duplicates"},
      body:JSON.stringify({id:1,...data}),
    });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json())[0];
  },
};

/* ─── FILE VIEWER — только для PDF и изображений ─── */
function FileViewer({ file, onClose }) {
  const type = getFileType(file.file_name);
  useEffect(() => {
    const h = e => e.key==="Escape"&&onClose();
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[onClose]);

  if (!["pdf","image","video","audio"].includes(type)) return null;

  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(10,5,8,.88)",backdropFilter:"blur(8px)",display:"flex",flexDirection:"column"}} onClick={onClose}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",flexShrink:0}} onClick={e=>e.stopPropagation()}>
        <span style={{fontSize:14,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</span>
        <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:12}}>
          <a href={file.file_url} download={file.file_name} style={{padding:"8px 16px",borderRadius:10,background:"rgba(255,255,255,.1)",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>Скачать</a>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,.1)",border:"none",color:"#fff",fontSize:18}}>✕</button>
        </div>
      </div>
      <div style={{flex:1,padding:"0 20px 20px",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.stopPropagation()}>
        {type==="pdf"&&<iframe src={file.file_url} style={{width:"100%",height:"100%",border:"none",borderRadius:16,background:"#fff"}} title={file.name}/>}
        {type==="image"&&<img src={file.file_url} alt={file.name} style={{maxWidth:"100%",maxHeight:"100%",borderRadius:16,objectFit:"contain",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}/>}
        {type==="video"&&<video src={file.file_url} controls style={{maxWidth:"100%",maxHeight:"100%",borderRadius:16}}/>}
        {type==="audio"&&(
          <div style={{background:"rgba(255,255,255,.06)",borderRadius:24,padding:"40px 48px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
            <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{file.name}</div>
            <audio src={file.file_url} controls style={{width:300,maxWidth:"100%"}}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── APP ─── */
export default function App() {
  const [tab,setTab]             = useState("dashboard");
  const [history,setHistory]     = useState(["dashboard"]);
  const [files,setFiles]         = useState([]);
  const [anns,setAnns]           = useState([]);
  const [loading,setLoading]     = useState(true);
  const [isAdmin,setIsAdmin]     = useState(false);
  const [showLogin,setShowLogin] = useState(false);
  const [toast,setToast]         = useState(null);
  const [filterCat,setFilterCat] = useState("Все");
  const [isMobile,setIsMobile]   = useState(window.innerWidth<768);
  const [viewer,setViewer]       = useState(null);
  const [schedule,setSchedule]   = useState(null);

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<768); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  useEffect(()=>{
    window.history.pushState({app:true},"");
    const onPop=()=>{
      window.history.pushState({app:true},"");
      if(viewer){setViewer(null);return;}
      if(showLogin){setShowLogin(false);return;}
      setHistory(prev=>{ if(prev.length<=1)return prev; const next=prev.slice(0,-1); setTab(next[next.length-1]); return next; });
    };
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[showLogin,viewer]);

  const showToast=useCallback((msg,type="ok")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); },[]);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const[f,a,s]=await Promise.all([api.getFiles(),api.getAnns(),api.getSchedule()]);
      setFiles(f); setAnns(a); setSchedule(s);
    }catch{}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{ load(); },[load]);

  const goTab=useCallback((id)=>{
    if(id==="admin"&&!isAdmin){setShowLogin(true);return;}
    setTab(id); setHistory(prev=>[...prev,id]); window.scrollTo(0,0);
  },[isAdmin]);

  const schedFiles    = files.filter(f=>f.category==="Расписание");
  const filteredFiles = filterCat==="Все"?files:files.filter(f=>f.category===filterCat);

  const TABS=[
    {id:"dashboard",label:"Главная",   icon:"⌂"},
    {id:"schedule", label:"Расписание",icon:"◫"},
    {id:"files",    label:"Файлы",     icon:"▤"},
    {id:"news",     label:"Объявления",icon:"◈"},
    {id:"admin",    label:"Панель",    icon:"◉"},
  ];

  const shared={tab,isAdmin,setIsAdmin,setTab:goTab,isMobile,loading,files,anns,schedFiles,filteredFiles,filterCat,setFilterCat,showToast,load,setFiles,setAnns,setViewer,schedule,setSchedule};

  return (
    <div style={{minHeight:"100vh",background:"#faf8f6",fontFamily:"'Montserrat',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Montserrat',sans-serif !important;}
        body{background:#faf8f6;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#e8c4d0;border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes modalIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#e8789f!important;}
        button{cursor:pointer;-webkit-tap-highlight-color:transparent;}
        a{-webkit-tap-highlight-color:transparent;}
      `}</style>

      {viewer&&<FileViewer file={viewer} onClose={()=>setViewer(null)}/>}

      {toast&&(
        <div style={{position:"fixed",top:20,left:"50%",zIndex:9999,animation:"toastIn .25s ease",transform:"translateX(-50%)",background:toast.type==="err"?"#fff0f3":"#fff",border:`1px solid ${toast.type==="err"?"#f5c0cc":"#f0e0e8"}`,color:toast.type==="err"?"#c0364f":"#2d1f27",padding:"10px 22px",borderRadius:40,fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,.08)",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}

      {showLogin&&(
        <div style={{position:"fixed",inset:0,background:"rgba(250,248,246,.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:20}} onClick={()=>setShowLogin(false)}>
          <LoginBox onSuccess={()=>{setIsAdmin(true);setShowLogin(false);setTab("admin");setHistory(p=>[...p,"admin"]);showToast("Добро пожаловать, Шох ака!");}} onClose={()=>setShowLogin(false)}/>
        </div>
      )}

      {isMobile
        ?<MobileLayout TABS={TABS} goTab={goTab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} {...shared}/>
        :<DesktopLayout TABS={TABS} goTab={goTab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} {...shared}/>
      }
    </div>
  );
}

/* ─── DESKTOP ─── */
function DesktopLayout({TABS,goTab,tab,isAdmin,setIsAdmin,setTab,...rest}){
  return(
    <div style={{display:"flex",minHeight:"100vh"}}>
      <aside style={{width:260,background:"#fff",borderRight:"1px solid #f0e8ec",display:"flex",flexDirection:"column",padding:"36px 24px",position:"sticky",top:0,height:"100vh",flexShrink:0,justifyContent:"space-between"}}>
        <div>
          <div style={{marginBottom:48}}>
            <div style={{fontSize:11,fontWeight:700,color:"#c8a0b0",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Университет</div>
            <div style={{fontSize:22,fontWeight:800,color:"#1a1015",lineHeight:1.2}}>Менеджмент</div>
            <div style={{fontSize:12,fontWeight:500,color:"#b09aa8",marginTop:4}}>Экономический факультет</div>
          </div>
          <nav style={{display:"flex",flexDirection:"column",gap:2}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>goTab(t.id)} style={{display:"block",padding:"11px 16px",borderRadius:12,border:"none",background:tab===t.id?"linear-gradient(135deg,#fde8ef,#fdeee6)":"transparent",color:tab===t.id?"#d95b7e":"#a08090",fontSize:14,fontWeight:tab===t.id?700:500,textAlign:"left",transition:"all .15s"}}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{background:"linear-gradient(135deg,#fde8ef,#fdeee6)",borderRadius:18,padding:"18px 16px"}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#e8789f,#e8956d)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:15,marginBottom:10}}>Ш</div>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1015"}}>Шох ака</div>
          <div style={{fontSize:11,fontWeight:500,color:"#b09aa8",marginTop:2}}>Дежурный группы</div>
          {isAdmin
            ?<button onClick={()=>{setIsAdmin(false);goTab("dashboard");}} style={{marginTop:12,width:"100%",padding:"8px",borderRadius:10,border:"1px solid rgba(217,91,126,.2)",background:"transparent",color:"#d95b7e",fontSize:12,fontWeight:600}}>Выйти из панели</button>
            :<button onClick={()=>goTab("admin")} style={{marginTop:12,width:"100%",padding:"8px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#e8789f,#e8956d)",color:"#fff",fontSize:12,fontWeight:700}}>Войти как Шох ака</button>
          }
        </div>
      </aside>
      <main style={{flex:1,overflowY:"auto"}}>
        <Pages tab={tab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} setTab={setTab} isMobile={false} {...rest}/>
      </main>
    </div>
  );
}

/* ─── MOBILE ─── */
function MobileLayout({TABS,goTab,tab,isAdmin,setIsAdmin,setTab,showToast,...rest}){
  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",paddingBottom:72}}>
      <header style={{background:"#fff",borderBottom:"1px solid #f0e8ec",padding:"16px 20px",position:"sticky",top:0,zIndex:50}}>
        <div style={{fontSize:11,fontWeight:700,color:"#c8a0b0",letterSpacing:"0.1em",textTransform:"uppercase"}}>Экон. факультет</div>
        <div style={{fontSize:19,fontWeight:800,color:"#1a1015",marginTop:2}}>Менеджмент</div>
      </header>
      <main style={{flex:1}}>
        <Pages tab={tab} isAdmin={isAdmin} setIsAdmin={setIsAdmin} setTab={setTab} isMobile={true} showToast={showToast} {...rest}/>
      </main>
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1.5px solid #f0e0e8",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0px)",boxShadow:"0 -4px 24px rgba(232,120,159,.13)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>goTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px 8px",border:"none",background:"transparent",color:tab===t.id?"#e8789f":"#c4aab8",fontSize:10,fontWeight:tab===t.id?700:500,gap:4,transition:"all .15s"}}>
            <div style={{width:38,height:28,borderRadius:10,background:tab===t.id?"linear-gradient(135deg,#fde8ef,#fdeee6)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
              <span style={{fontSize:18,lineHeight:1,color:tab===t.id?"#e8789f":"#c4aab8"}}>{t.icon}</span>
            </div>
            <span style={{fontSize:11,fontWeight:tab===t.id?700:500}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ─── PAGES ─── */
function Pages({tab,isAdmin,setIsAdmin,setTab,isMobile,loading,files,anns,schedFiles,filteredFiles,filterCat,setFilterCat,showToast,load,setFiles,setAnns,setViewer,schedule,setSchedule}){
  const pad={padding:isMobile?"20px 16px":"40px 44px",maxWidth:1000,margin:"0 auto",animation:"fadeUp .3s ease"};

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",flexDirection:"column",gap:16}}>
      <div style={{width:36,height:36,border:"3px solid #f0e0e8",borderTopColor:"#e8789f",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
      <div style={{fontSize:isMobile?15:13,fontWeight:500,color:"#b09aa8"}}>Загрузка…</div>
    </div>
  );

  /* DASHBOARD */
  if(tab==="dashboard") return(
    <div style={pad}>
      <div style={{background:"linear-gradient(135deg,#fce8ef 0%,#fdeee6 50%,#fce8f5 100%)",borderRadius:24,padding:isMobile?"28px 24px":"36px 40px",marginBottom:20,position:"relative",overflow:"hidden",textAlign:isMobile?"center":"left"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:"rgba(232,120,159,.08)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-40,left:-40,width:140,height:140,borderRadius:"50%",background:"rgba(232,149,109,.06)",pointerEvents:"none"}}/>
        <div style={{fontSize:isMobile?12:11,fontWeight:700,color:"#e8789f",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,position:"relative"}}>
          {new Date().toLocaleDateString("ru",{weekday:"long",day:"numeric",month:"long"})}
        </div>
        <div style={{fontSize:isMobile?34:42,fontWeight:800,color:"#1a1015",lineHeight:1.15,position:"relative"}}>Добро<br/>пожаловать</div>
        <div style={{fontSize:isMobile?15:13,fontWeight:500,color:"#b09aa8",marginTop:10,position:"relative"}}>Портал группы Менеджмент</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
        {[
          {l:"Файлов",    v:files.length,      c:"#e8789f",bg:"linear-gradient(135deg,#fce8ef,#fdf4f7)"},
          {l:"Расписаний",v:schedFiles.length, c:"#7c5cbf",bg:"linear-gradient(135deg,#ede8f8,#f5f0fc)"},
          {l:"Объявлений",v:anns.length,       c:"#5aaa72",bg:"linear-gradient(135deg,#e8f5ed,#f2fbf5)"},
          {l:"Категорий", v:CATS.length,       c:"#e8956d",bg:"linear-gradient(135deg,#fdeee6,#fff7f2)"},
        ].map(s=>(
          <div key={s.l} style={{background:s.bg,borderRadius:18,padding:isMobile?"16px":"20px 22px",textAlign:isMobile?"center":"left"}}>
            <div style={{fontSize:isMobile?34:36,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:isMobile?12:11,fontWeight:600,color:"#b09aa8",marginTop:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</div>
          </div>
        ))}
      </div>

      <Sec title="Последние файлы" action="Все →" onAction={()=>setTab("files")} isMobile={isMobile}>
        {files.length===0?<Blank text="Файлов пока нет" isMobile={isMobile}/>:files.slice(0,isMobile?3:5).map(f=><FileRow key={f.id} file={f} onView={()=>{ const t=getFileType(f.file_name); if(["pdf","image","video","audio"].includes(t)) setViewer(f); else openFile(f.file_url,f.file_name); }} isMobile={isMobile}/>)}
      </Sec>

      <Sec title="Объявления" action="Все →" onAction={()=>setTab("news")} mt isMobile={isMobile}>
        {anns.length===0?<Blank text="Объявлений пока нет" isMobile={isMobile}/>:anns.slice(0,3).map(a=>(
          <div key={a.id} style={{padding:"12px 0",borderBottom:"1px solid #f5edf0",display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{width:3,minHeight:32,borderRadius:2,background:"linear-gradient(180deg,#e8789f,#e8956d)",flexShrink:0,alignSelf:"stretch"}}/>
            <div style={{flex:1,minWidth:0}}>
              {a.pinned&&<span style={{fontSize:isMobile?11:10,fontWeight:700,color:"#e8956d",textTransform:"uppercase",display:"block",marginBottom:2}}>Закреплено</span>}
              <div style={{fontSize:isMobile?15:14,fontWeight:700,color:"#1a1015",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>
              <div style={{fontSize:isMobile?12:11,color:"#c8a8b8",marginTop:2}}>{new Date(a.created_at).toLocaleDateString("ru")}</div>
            </div>
          </div>
        ))}
      </Sec>
    </div>
  );

  /* SCHEDULE */
  if(tab==="schedule") return(
    <SchedulePage schedule={schedule} setSchedule={setSchedule} isAdmin={isAdmin} isMobile={isMobile} showToast={showToast} schedFiles={schedFiles} setViewer={setViewer} setFiles={setFiles} files={files}/>
  );

  /* FILES */
  if(tab==="files") return(
    <div style={pad}>
      <PHead title="Файлы" count={files.length} isMobile={isMobile} onRefresh={load}/>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {["Все",...CATS].map(c=>(
          <button key={c} onClick={()=>setFilterCat(c)} style={{padding:isMobile?"8px 16px":"7px 14px",borderRadius:20,border:`1px solid ${filterCat===c?(CAT[c]?.color||"#e8789f"):"#f0e0e8"}`,background:filterCat===c?(CAT[c]?.light||"#fff0f5"):"#fff",color:filterCat===c?(CAT[c]?.color||"#d95b7e"):"#b09aa8",fontSize:isMobile?13:12,fontWeight:filterCat===c?700:500}}>
            {c}
          </button>
        ))}
      </div>
      {filteredFiles.length===0?<Blank text="Файлов нет" large isMobile={isMobile}/>:(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(210px,1fr))",gap:14}}>
          {filteredFiles.map(f=><FileCard key={f.id} file={f} isAdmin={isAdmin} setFiles={setFiles} showToast={showToast}
            onView={()=>{ const t=getFileType(f.file_name); if(["pdf","image","video","audio"].includes(t)) setViewer(f); else openFile(f.file_url,f.file_name); }}
            isMobile={isMobile}/>)}
        </div>
      )}
    </div>
  );

  /* NEWS */
  if(tab==="news") return(
    <div style={pad}>
      <PHead title="Объявления" count={anns.length} isMobile={isMobile} onRefresh={load}/>
      {anns.length===0?<Blank text="Объявлений пока нет" large isMobile={isMobile}/>:(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {anns.map(a=>(
            <AnnCard key={a.id} ann={a} isAdmin={isAdmin} isMobile={isMobile}
              onDelete={async()=>{try{await api.deleteAnn(a.id);setAnns(p=>p.filter(x=>x.id!==a.id));showToast("Удалено");}catch{showToast("Ошибка","err");}}}
              onEdit={async d=>{try{const u=await api.updateAnn(a.id,d);setAnns(p=>p.map(x=>x.id===a.id?u:x));showToast("Сохранено");}catch{showToast("Ошибка","err");}}}
            />
          ))}
        </div>
      )}
    </div>
  );

  /* ADMIN */
  if(tab==="admin"&&isAdmin) return(
    <AdminPanel isMobile={isMobile} files={files} anns={anns} setFiles={setFiles} setAnns={setAnns} showToast={showToast} setIsAdmin={setIsAdmin} setTab={setTab} load={load} setViewer={setViewer} schedule={schedule} setSchedule={setSchedule}/>
  );

  return null;
}

/* ─── SCHEDULE PAGE ─── */
function SchedulePage({schedule,setSchedule,isAdmin,isMobile,showToast,schedFiles,setViewer,setFiles,files}){
  const pad={padding:isMobile?"20px 16px":"40px 44px",maxWidth:1000,margin:"0 auto",animation:"fadeUp .3s ease"};
  const grid = schedule?.grid || {};
  const subjects = schedule?.subjects || DEFAULT_SUBJECTS;
  const weekLabel = schedule?.week_label || "";

  return(
    <div style={pad}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:isMobile?28:34,fontWeight:800,color:"#1a1015"}}>Расписание</h1>
          {weekLabel&&<div style={{fontSize:isMobile?13:12,color:"#b09aa8",marginTop:3}}>{weekLabel}</div>}
        </div>
      </div>

      {!schedule||Object.keys(grid).length===0?(
        <Blank text="Расписание ещё не заполнено" sub={isAdmin?"Зайдите в панель и заполните расписание":"Шох ака скоро добавит расписание"} large isMobile={isMobile}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {DAYS.map(day=>{
            const daySlots = grid[day]||{};
            const hasPairs = Object.values(daySlots).some(v=>v&&v!=="");
            if(!hasPairs) return null;
            return(
              <div key={day} style={{background:"#fff",border:"1px solid #f0e8ec",borderRadius:20,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(135deg,#fde8ef,#fdeee6)",padding:"10px 18px"}}>
                  <div style={{fontSize:isMobile?14:13,fontWeight:700,color:"#d95b7e"}}>{day}</div>
                </div>
                <div style={{padding:"8px 0"}}>
                  {TIMES.map(time=>{
                    const subj=daySlots[time];
                    if(!subj) return null;
                    return(
                      <div key={time} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderBottom:"1px solid #faf0f4"}}>
                        <div style={{fontSize:isMobile?12:11,fontWeight:700,color:"#b09aa8",minWidth:isMobile?90:100,flexShrink:0}}>{time}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:isMobile?15:14,fontWeight:700,color:"#1a1015"}}>{subj}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Прикреплённые файлы расписания */}
      {schedFiles.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontSize:isMobile?15:13,fontWeight:700,color:"#1a1015",marginBottom:12}}>Прикреплённые файлы</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(210px,1fr))",gap:12}}>
            {schedFiles.map(f=><FileCard key={f.id} file={f} isAdmin={isAdmin} setFiles={setFiles} showToast={showToast}
              onView={()=>{ const t=getFileType(f.file_name); if(["pdf","image","video","audio"].includes(t)) setViewer(f); else openFile(f.file_url,f.file_name); }}
              isMobile={isMobile}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── FILE CARD — единый стиль ─── */
function FileCard({file,isAdmin,setFiles,showToast,onView,isMobile}){
  const[editing,setEditing]=useState(false);
  const[name,setName]=useState(file.name);
  const[cat,setCat]=useState(file.category);
  const type=getFileType(file.file_name);
  const ext=(file.file_name||"").split(".").pop().toUpperCase();
  const isImg=type==="image";
  const meta=CAT[file.category]||{color:"#e8789f",bg:"rgba(232,120,159,.10)",dot:"#e8789f",light:"#fff0f5"};

  const save=async()=>{try{const u=await api.updateFile(file.id,{name,category:cat});setFiles(p=>p.map(x=>x.id===file.id?u:x));setEditing(false);showToast("Сохранено");}catch{showToast("Ошибка","err");}};
  const del=async()=>{try{await api.deleteStorage(file.storage_path);await api.deleteFile(file.id);setFiles(p=>p.filter(x=>x.id!==file.id));showToast("Файл удалён");}catch{showToast("Ошибка","err");}};

  return(
    <div style={{background:"#fff",border:`1px solid ${meta.color}25`,borderRadius:20,overflow:"hidden",display:"flex",flexDirection:"column"}}>
      {/* Превью */}
      <div onClick={onView} style={{cursor:"pointer",position:"relative",height:90,flexShrink:0,overflow:"hidden",background:meta.bg}}>
        {isImg
          ?<img src={file.file_url} alt={file.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            {[24,38,18,32,22,30].map((h,i)=>(
              <div key={i} style={{width:4,height:h,borderRadius:2,background:meta.dot,opacity:.25+i*.1}}/>
            ))}
          </div>
        }
        {/* Тип в левом углу */}
        <div style={{position:"absolute",top:8,left:8,background:meta.light,color:meta.color,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,textTransform:"uppercase",letterSpacing:"0.08em"}}>{file.category}</div>
        {/* Расширение в правом углу */}
        <div style={{position:"absolute",top:8,right:8,background:"rgba(255,255,255,.9)",color:"#b09aa8",fontSize:9,fontFamily:"monospace",padding:"2px 7px",borderRadius:8}}>{ext}</div>
      </div>

      {/* Контент */}
      <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10,flex:1}}>
        {editing?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <input style={{...T.input,fontSize:isMobile?14:12,padding:"8px 12px"}} value={name} onChange={e=>setName(e.target.value)}/>
            <select style={{...T.input,fontSize:isMobile?14:12,padding:"8px 12px"}} value={cat} onChange={e=>setCat(e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
            <div style={{display:"flex",gap:6}}>
              <button style={{...T.primary,flex:1,padding:"8px",fontSize:isMobile?14:12}} onClick={save}>Сохранить</button>
              <button style={{...T.ghost,padding:"8px 10px",fontSize:isMobile?14:12}} onClick={()=>setEditing(false)}>✕</button>
            </div>
          </div>
        ):(
          <>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:isMobile?15:14,fontWeight:700,color:"#1a1015",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",lineHeight:1.4}}>{file.name}</div>
              <div style={{fontSize:isMobile?12:11,color:"#c8b0b8",marginTop:4}}>{new Date(file.created_at).toLocaleDateString("ru")} · {(file.size_bytes/1024).toFixed(0)} КБ</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={onView} style={{flex:1,padding:isMobile?"10px":"9px",borderRadius:12,background:`linear-gradient(135deg,${meta.dot},${meta.dot}cc)`,border:"none",color:"#fff",fontWeight:700,fontSize:isMobile?13:12}}>Открыть</button>
              <a href={file.file_url} download={file.file_name} style={{padding:isMobile?"10px 12px":"9px 11px",borderRadius:12,background:meta.bg,color:meta.color,fontWeight:700,fontSize:14,textDecoration:"none",border:`1px solid ${meta.color}25`,flexShrink:0}}>↓</a>
              {isAdmin&&<>
                <button onClick={()=>setEditing(true)} style={{padding:isMobile?"10px 11px":"9px 10px",borderRadius:12,background:"#fdeee6",border:"none",color:"#e8956d",fontSize:14,flexShrink:0}}>✎</button>
                <button onClick={del} style={{padding:isMobile?"10px 11px":"9px 10px",borderRadius:12,background:"#fff0f3",border:"none",color:"#c0364f",fontSize:14,flexShrink:0}}>✕</button>
              </>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── ANN CARD — единый стиль ─── */
function AnnCard({ann,isAdmin,isMobile,onDelete,onEdit}){
  const[editing,setEditing]=useState(false);
  const[t,setT]=useState(ann.title);
  const[b,setB]=useState(ann.body);
  const titleSize=isMobile?17:15;
  const bodySize=isMobile?15:13;
  const metaSize=isMobile?12:11;
  return(
    <div style={{background:"#fff",border:"1px solid #f0e8ec",borderRadius:20,padding:isMobile?"18px":"20px 24px"}}>
      {editing?(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input style={T.input} value={t} onChange={e=>setT(e.target.value)}/>
          <textarea style={{...T.input,height:100,resize:"vertical"}} value={b} onChange={e=>setB(e.target.value)}/>
          <div style={{display:"flex",gap:8}}>
            <button style={{...T.primary,flex:1,padding:"10px"}} onClick={()=>{onEdit({title:t,body:b,emoji:"·"});setEditing(false);}}>Сохранить</button>
            <button style={{...T.ghost,padding:"10px 16px"}} onClick={()=>setEditing(false)}>Отмена</button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:4,borderRadius:2,alignSelf:"stretch",minHeight:40,background:ann.pinned?"linear-gradient(180deg,#e8789f,#e8956d)":"linear-gradient(180deg,#e8789f88,#e8956d88)",flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            {ann.pinned&&<div style={{fontSize:metaSize,fontWeight:700,color:"#e8956d",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>Закреплено</div>}
            <div style={{fontSize:metaSize,color:"#c8b0b8",marginBottom:6}}>{new Date(ann.created_at).toLocaleDateString("ru",{day:"numeric",month:"long",year:"numeric"})}</div>
            <div style={{fontSize:titleSize,fontWeight:700,color:"#1a1015",marginBottom:8}}>{ann.title}</div>
            <div style={{fontSize:bodySize,color:"#7a6070",lineHeight:1.7}}>{ann.body}</div>
          </div>
          {isAdmin&&(
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>setEditing(true)} style={{padding:"7px 10px",borderRadius:10,border:"1px solid #f0dde6",background:"#fff",color:"#b09aa8",fontSize:13,fontWeight:600}}>✎</button>
              {!ann.pinned&&<button onClick={onDelete} style={{padding:"7px 10px",borderRadius:10,border:"1px solid #f5c0cc",background:"#fff0f3",color:"#c0364f",fontSize:13,fontWeight:600}}>✕</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── SCHEDULE EDITOR ─── */
function ScheduleEditor({schedule,setSchedule,showToast,isMobile}){
  const initGrid=()=>{
    const g={};
    DAYS.forEach(d=>{ g[d]={}; TIMES.forEach(t=>{ g[d][t]=""; }); });
    return g;
  };
  const[grid,setGrid]=useState(()=>{ const s=schedule?.grid; if(s){ const g=initGrid(); Object.keys(g).forEach(d=>{ if(s[d]) Object.keys(g[d]).forEach(t=>{ g[d][t]=s[d][t]||""; }); }); return g; } return initGrid(); });
  const[subjects,setSubjects]=useState(schedule?.subjects||[...DEFAULT_SUBJECTS]);
  const[weekLabel,setWeekLabel]=useState(schedule?.week_label||"");
  const[saving,setSaving]=useState(false);
  const[editSubjects,setEditSubjects]=useState(false);

  const setSlot=(day,time,val)=>setGrid(prev=>({...prev,[day]:{...prev[day],[time]:val}}));

  const save=async()=>{
    setSaving(true);
    try{
      const s=await api.saveSchedule({grid,subjects,week_label:weekLabel});
      setSchedule(s);
      showToast("Расписание сохранено!");
    }catch(e){showToast("Ошибка: "+e.message,"err");}
    finally{setSaving(false);}
  };

  const clear=()=>{ setGrid(initGrid()); };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Неделя */}
      <div>
        <label style={{...T.label,fontSize:isMobile?12:11}}>Неделя (например: 12–18 мая 2026)</label>
        <input style={{...T.input,fontSize:isMobile?15:14}} placeholder="12–18 мая 2026" value={weekLabel} onChange={e=>setWeekLabel(e.target.value)}/>
      </div>

      {/* Редактор предметов */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <label style={{...T.label,fontSize:isMobile?12:11,marginBottom:0}}>Предметы (6 штук)</label>
          <button onClick={()=>setEditSubjects(v=>!v)} style={{...T.ghost,padding:"5px 12px",fontSize:12}}>{editSubjects?"Готово":"Редактировать"}</button>
        </div>
        {editSubjects?(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {subjects.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#fde8ef,#fdeee6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#e8789f",flexShrink:0}}>{i+1}</div>
                <input style={{...T.input,fontSize:isMobile?14:13,padding:"8px 12px"}} value={s} onChange={e=>{const n=[...subjects];n[i]=e.target.value;setSubjects(n);}}/>
              </div>
            ))}
          </div>
        ):(
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {subjects.map((s,i)=>(
              <div key={i} style={{background:"linear-gradient(135deg,#fde8ef,#fdeee6)",borderRadius:20,padding:"6px 14px",fontSize:isMobile?13:12,fontWeight:600,color:"#d95b7e"}}>{s}</div>
            ))}
          </div>
        )}
      </div>

      {/* Сетка расписания */}
      <div>
        <label style={{...T.label,fontSize:isMobile?12:11}}>Расписание по дням</label>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:8}}>
          {DAYS.map(day=>(
            <div key={day} style={{background:"#fff",border:"1px solid #f0e8ec",borderRadius:18,overflow:"hidden"}}>
              <div style={{background:"linear-gradient(135deg,#fde8ef,#fdeee6)",padding:"10px 16px"}}>
                <div style={{fontSize:isMobile?14:13,fontWeight:700,color:"#d95b7e"}}>{day}</div>
              </div>
              <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                {TIMES.map(time=>(
                  <div key={time} style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{fontSize:isMobile?11:10,fontWeight:700,color:"#c8b0b8",minWidth:isMobile?95:105,flexShrink:0}}>{time}</div>
                    <div style={{flex:1,display:"flex",gap:6}}>
                      <select
                        style={{...T.input,fontSize:isMobile?13:12,padding:"7px 10px",flex:1,color:grid[day][time]?"#1a1015":"#c8b0b8"}}
                        value={grid[day][time]||""}
                        onChange={e=>setSlot(day,time,e.target.value)}
                      >
                        <option value="">— нет пары —</option>
                        {subjects.filter(s=>s).map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      {grid[day][time]&&(
                        <button onClick={()=>setSlot(day,time,"")} style={{padding:"7px 10px",borderRadius:10,background:"#fff0f3",border:"none",color:"#c0364f",fontSize:13,flexShrink:0}}>✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:10}}>
        <button style={{...T.primary,flex:1,opacity:saving?.7:1,fontSize:isMobile?15:14}} onClick={save} disabled={saving}>{saving?"Сохраняется…":"Сохранить расписание"}</button>
        <button style={{...T.ghost,padding:"13px 16px",fontSize:isMobile?14:13}} onClick={clear}>Очистить</button>
      </div>
    </div>
  );
}

/* ─── ADMIN PANEL ─── */
function AdminPanel({isMobile,files,anns,setFiles,setAnns,showToast,setIsAdmin,setTab,load,setViewer,schedule,setSchedule}){
  const[aTab,setATab]=useState("schedule");
  const[uName,setUName]=useState("");
  const[uCat,setUCat]=useState("Расписание");
  const[uFile,setUFile]=useState(null);
  const[uploading,setUploading]=useState(false);
  const[pct,setPct]=useState(0);
  const[dragging,setDragging]=useState(false);
  const[aTitle,setATitle]=useState("");
  const[aBody,setABody]=useState("");
  const[aPinned,setAPinned]=useState(false);
  const[posting,setPosting]=useState(false);
  const fileRef=useRef();
  const pad={padding:isMobile?"20px 16px":"40px 44px",maxWidth:1000,margin:"0 auto",animation:"fadeUp .3s ease"};
  const fs=isMobile?15:14;

  const pick=f=>{if(!f)return;setUFile(f);if(!uName)setUName(f.name.replace(/\.[^.]+$/,""));};

  const upload=async()=>{
    if(!uName.trim()||!uFile)return showToast("Выберите файл и введите название","err");
    setUploading(true);setPct(15);
    try{
      const ext=uFile.name.split(".").pop();
      const path=`${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      setPct(40); const url=await api.uploadFile(uFile,path); setPct(75);
      const rec=await api.addFile({name:uName.trim(),category:uCat,file_name:uFile.name,file_url:url,storage_path:path,size_bytes:uFile.size}); setPct(100);
      setFiles(prev=>[rec,...prev]); setUName(""); setUFile(null); if(fileRef.current)fileRef.current.value="";
      showToast("Файл загружен в облако");
    }catch(e){showToast("Ошибка: "+e.message,"err");}
    finally{setUploading(false);setPct(0);}
  };

  const postAnn=async()=>{
    if(!aTitle.trim()||!aBody.trim())return showToast("Заполните заголовок и текст","err");
    setPosting(true);
    try{
      const a=await api.addAnn({title:aTitle.trim(),body:aBody.trim(),emoji:"·",pinned:aPinned});
      setAnns(prev=>[a,...prev]); setATitle(""); setABody(""); setAPinned(false);
      showToast("Объявление опубликовано");
    }catch(e){showToast("Ошибка: "+e.message,"err");}
    finally{setPosting(false);}
  };

  return(
    <div style={pad}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:isMobile?12:11,fontWeight:700,color:"#e8789f",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Администратор</div>
          <h1 style={{fontSize:isMobile?24:32,fontWeight:800,color:"#1a1015"}}>Панель старосты</h1>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={load} style={{...T.ghost,fontSize:isMobile?14:13}}>Обновить</button>
          <button onClick={()=>{setIsAdmin(false);setTab("dashboard");}} style={{...T.ghost,fontSize:isMobile?14:13}}>Выйти</button>
        </div>
      </div>

      <div style={{display:"flex",marginBottom:24,borderBottom:"2px solid #f0e8ec",overflowX:"auto"}}>
        {[["schedule","Расписание"],["upload","Загрузить файл"],["announce","Объявление"],["manage","Управление"]].map(([id,label])=>(
          <button key={id} onClick={()=>setATab(id)} style={{padding:isMobile?"11px 14px":"10px 18px",border:"none",background:"transparent",fontSize:isMobile?13:13,fontWeight:aTab===id?700:500,color:aTab===id?"#d95b7e":"#b09aa8",borderBottom:`2px solid ${aTab===id?"#e8789f":"transparent"}`,marginBottom:-2,transition:"all .15s",whiteSpace:"nowrap"}}>
            {label}
          </button>
        ))}
      </div>

      {/* SCHEDULE EDITOR */}
      {aTab==="schedule"&&(
        <ScheduleEditor schedule={schedule} setSchedule={setSchedule} showToast={showToast} isMobile={isMobile}/>
      )}

      {/* UPLOAD */}
      {aTab==="upload"&&(
        <div style={{maxWidth:520}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={{...T.label,fontSize:isMobile?12:11}}>Название файла</label><input style={{...T.input,fontSize:fs}} placeholder="например: Лекция №3 — Маркетинг" value={uName} onChange={e=>setUName(e.target.value)}/></div>
            <div>
              <label style={{...T.label,fontSize:isMobile?12:11}}>Категория</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {CATS.map(c=>(
                  <button key={c} onClick={()=>setUCat(c)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${uCat===c?CAT[c].color:"#f0e0e8"}`,background:uCat===c?CAT[c].light:"#fff",color:uCat===c?CAT[c].color:"#b09aa8",fontSize:13,fontWeight:uCat===c?700:500}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{...T.label,fontSize:isMobile?12:11}}>Файл</label>
              <div onClick={()=>!uploading&&fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);pick(e.dataTransfer.files[0]);}}
                style={{border:`1.5px dashed ${dragging?"#e8789f":uFile?"#5aaa72":"#f0d8e0"}`,borderRadius:16,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:dragging?"#fce8ef":uFile?"#e8f5ed":"#fdfafb",transition:"all .2s"}}>
                <div style={{fontSize:isMobile?15:13,fontWeight:600,color:uFile?"#3a8a52":"#b09aa8"}}>{uFile?uFile.name:"Нажмите или перетащите файл"}</div>
                {uFile&&<div style={{fontSize:isMobile?13:11,color:"#6ab87a",marginTop:4}}>{(uFile.size/1024/1024).toFixed(2)} МБ</div>}
                {!uFile&&<div style={{fontSize:isMobile?13:11,color:"#c8b0b8",marginTop:6}}>PDF, Word, Excel, изображения, видео и другие</div>}
              </div>
              <input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>pick(e.target.files[0])}/>
            </div>
            {uploading&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:isMobile?13:11,color:"#b09aa8",marginBottom:6}}><span>Загрузка…</span><span>{pct}%</span></div>
                <div style={{height:4,background:"#f0e0e8",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#e8789f,#e8956d)",borderRadius:4,transition:"width .4s"}}/>
                </div>
              </div>
            )}
            <button style={{...T.primary,opacity:uploading?.7:1,fontSize:isMobile?15:14}} onClick={upload} disabled={uploading}>{uploading?"Загружается…":"Загрузить в облако"}</button>
          </div>
        </div>
      )}

      {/* ANNOUNCE */}
      {aTab==="announce"&&(
        <div style={{maxWidth:520}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={{...T.label,fontSize:isMobile?12:11}}>Заголовок</label><input style={{...T.input,fontSize:fs}} placeholder="Заголовок объявления" value={aTitle} onChange={e=>setATitle(e.target.value)}/></div>
            <div><label style={{...T.label,fontSize:isMobile?12:11}}>Текст</label><textarea style={{...T.input,height:140,resize:"vertical",fontSize:fs}} placeholder="Текст объявления..." value={aBody} onChange={e=>setABody(e.target.value)}/></div>
            <div onClick={()=>setAPinned(v=>!v)} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
              <div style={{width:40,height:22,borderRadius:11,background:aPinned?"linear-gradient(135deg,#e8789f,#e8956d)":"#f0e0e8",position:"relative",transition:"all .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:aPinned?19:2,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,.15)",transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:isMobile?15:13,fontWeight:500,color:"#7a6070"}}>Закрепить объявление</span>
            </div>
            <button style={{...T.primary,opacity:posting?.7:1,fontSize:isMobile?15:14}} onClick={postAnn} disabled={posting}>{posting?"Публикуется…":"Опубликовать"}</button>
          </div>
        </div>
      )}

      {/* MANAGE */}
      {aTab==="manage"&&(
        <div style={{display:"flex",flexDirection:"column",gap:24}}>
          <div>
            <div style={{fontSize:isMobile?15:13,fontWeight:700,color:"#1a1015",marginBottom:14}}>Файлы ({files.length})</div>
            {files.length===0?<Blank text="Файлов нет" isMobile={isMobile}/>:(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {files.map(f=>(
                  <ManageRow key={f.id} file={f} isMobile={isMobile}
                    onView={()=>{ const t=getFileType(f.file_name); if(["pdf","image","video","audio"].includes(t)) setViewer(f); else openFile(f.file_url,f.file_name); }}
                    onDelete={async()=>{try{await api.deleteStorage(f.storage_path);await api.deleteFile(f.id);setFiles(p=>p.filter(x=>x.id!==f.id));showToast("Файл удалён");}catch(e){showToast("Ошибка","err");}}}
                    onSave={async(name,cat)=>{try{const u=await api.updateFile(f.id,{name,category:cat});setFiles(p=>p.map(x=>x.id===f.id?u:x));showToast("Сохранено");}catch{showToast("Ошибка","err");}}}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{fontSize:isMobile?15:13,fontWeight:700,color:"#1a1015",marginBottom:14}}>Объявления ({anns.length})</div>
            {anns.length===0?<Blank text="Нет объявлений" isMobile={isMobile}/>:(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {anns.map(a=>(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",border:"1px solid #f0e8ec",borderRadius:14,padding:"14px"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:isMobile?15:13,fontWeight:700,color:"#1a1015",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>
                      <div style={{fontSize:isMobile?12:11,color:"#b09aa8",marginTop:2}}>{new Date(a.created_at).toLocaleDateString("ru")}{a.pinned?" · Закреплено":""}</div>
                    </div>
                    <button onClick={async()=>{try{await api.deleteAnn(a.id);setAnns(p=>p.filter(x=>x.id!==a.id));showToast("Удалено");}catch{showToast("Ошибка","err");}}}
                      style={{padding:"8px 14px",borderRadius:10,border:"1px solid #f5c0cc",background:"#fff0f3",color:"#c0364f",fontSize:isMobile?13:12,fontWeight:600,flexShrink:0}}>Удалить</button>
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

/* ─── КОМПОНЕНТЫ ─── */
function LoginBox({onSuccess,onClose}){
  const[pw,setPw]=useState("");
  const[err,setErr]=useState("");
  const check=()=>pw===ADMIN_PASSWORD?onSuccess():setErr("Неверный пароль");
  return(
    <div style={{background:"#fff",borderRadius:28,padding:"44px 36px",width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,.08)",textAlign:"center",animation:"modalIn .2s ease"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#e8789f,#e8956d)",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:22,color:"#fff",fontWeight:700}}>✦</span>
      </div>
      <div style={{fontSize:20,fontWeight:800,color:"#1a1015",marginBottom:6}}>Вход для старосты</div>
      <div style={{fontSize:14,color:"#b09aa8",marginBottom:24,fontWeight:500}}>Только Шох ака может управлять сайтом</div>
      <input style={{...T.input,textAlign:"center",marginBottom:err?8:16,fontSize:15}} type="password" placeholder="Пароль" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&check()} autoFocus/>
      {err&&<div style={{color:"#c0364f",fontSize:13,fontWeight:600,marginBottom:14}}>{err}</div>}
      <button style={{...T.primary,width:"100%",fontSize:15}} onClick={check}>Войти</button>
      <button onClick={onClose} style={{marginTop:12,background:"none",border:"none",color:"#c8a8b8",fontSize:13,fontWeight:500,width:"100%"}}>Отмена</button>
    </div>
  );
}

function ManageRow({file,onDelete,onSave,onView,isMobile}){
  const[editing,setEditing]=useState(false);
  const[n,setN]=useState(file.name);
  const[c,setC]=useState(file.category);
  const meta=CAT[file.category]||{dot:"#e8789f"};
  return(
    <div style={{background:"#fff",border:"1px solid #f0e8ec",borderRadius:14,padding:"12px 14px"}}>
      {editing?(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <input style={{...T.input,fontSize:isMobile?14:13}} value={n} onChange={e=>setN(e.target.value)}/>
          <select style={{...T.input,fontSize:isMobile?14:13}} value={c} onChange={e=>setC(e.target.value)}>{CATS.map(x=><option key={x}>{x}</option>)}</select>
          <div style={{display:"flex",gap:6}}>
            <button style={{...T.primary,flex:1,padding:"8px",fontSize:isMobile?14:12}} onClick={()=>{onSave(n,c);setEditing(false);}}>Сохранить</button>
            <button style={{...T.ghost,padding:"8px 12px",fontSize:isMobile?14:12}} onClick={()=>setEditing(false)}>Отмена</button>
          </div>
        </div>
      ):(
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:3,height:32,borderRadius:2,background:meta.dot,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:isMobile?14:13,fontWeight:700,color:"#1a1015",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</div>
            <div style={{fontSize:isMobile?12:11,color:"#b09aa8"}}>{file.category} · {new Date(file.created_at).toLocaleDateString("ru")} · {(file.size_bytes/1024).toFixed(0)} КБ</div>
          </div>
          <button onClick={onView} style={{padding:"6px 10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#e8789f,#e8956d)",color:"#fff",fontSize:isMobile?13:12,fontWeight:600,flexShrink:0}}>Открыть</button>
          <button onClick={()=>setEditing(true)} style={{padding:"6px 10px",borderRadius:10,border:"1px solid #f0dde6",background:"#fff",color:"#b09aa8",fontSize:isMobile?13:12,fontWeight:600,flexShrink:0}}>Изм.</button>
          <button onClick={onDelete} style={{padding:"6px 10px",borderRadius:10,border:"1px solid #f5c0cc",background:"#fff0f3",color:"#c0364f",fontSize:isMobile?13:12,fontWeight:600,flexShrink:0}}>Удал.</button>
        </div>
      )}
    </div>
  );
}

function FileRow({file,onView,isMobile}){
  const meta=CAT[file.category]||{color:"#e8789f",dot:"#e8789f"};
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #f5edf0"}}>
      <div style={{width:3,height:34,borderRadius:2,background:meta.dot,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:isMobile?15:13,fontWeight:700,color:"#1a1015",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</div>
        <div style={{fontSize:isMobile?12:11,color:"#c8b0b8",marginTop:2}}>{file.category} · {new Date(file.created_at).toLocaleDateString("ru")}</div>
      </div>
      <button onClick={onView} style={{fontSize:isMobile?14:12,fontWeight:700,color:meta.color,background:"none",border:"none",flexShrink:0}}>Открыть</button>
    </div>
  );
}

function Sec({title,action,onAction,children,mt,isMobile}){
  return(
    <div style={{background:"#fff",border:"1px solid #f0e8ec",borderRadius:20,padding:"18px 20px",...(mt?{marginTop:12}:{})}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:isMobile?16:14,fontWeight:700,color:"#1a1015"}}>{title}</div>
        {action&&<button onClick={onAction} style={{background:"none",border:"none",fontSize:isMobile?14:12,fontWeight:600,color:"#e8789f"}}>{action}</button>}
      </div>
      {children}
    </div>
  );
}

function PHead({title,count,isMobile,onRefresh}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24,flexWrap:"wrap",gap:10}}>
      <div>
        <h1 style={{fontSize:isMobile?28:34,fontWeight:800,color:"#1a1015"}}>{title}</h1>
        {count!==undefined&&<div style={{fontSize:isMobile?13:12,color:"#b09aa8",marginTop:3}}>{count} файлов</div>}
      </div>
      <button onClick={onRefresh} style={{...T.ghost,fontSize:isMobile?14:13}}>Обновить</button>
    </div>
  );
}

function Blank({text,sub,large,isMobile}){
  return(
    <div style={{textAlign:"center",padding:large?"56px 0":"28px 0"}}>
      <div style={{width:large?40:30,height:large?40:30,borderRadius:"50%",border:"2px solid #f0e0e8",margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:large?14:10,height:large?14:10,borderRadius:"50%",background:"#f0e0e8"}}/>
      </div>
      <div style={{fontSize:isMobile?(large?17:15):(large?15:13),fontWeight:600,color:"#c8a8b8"}}>{text}</div>
      {sub&&<div style={{fontSize:isMobile?13:12,color:"#d8c0c8",marginTop:4}}>{sub}</div>}
    </div>
  );
}

const T={
  input:{width:"100%",padding:"12px 16px",borderRadius:12,border:"1px solid #f0e0e8",background:"#fdfafb",fontSize:14,color:"#1a1015",fontWeight:500,transition:"border .15s"},
  label:{display:"block",fontSize:11,fontWeight:700,color:"#b09aa8",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8},
  primary:{padding:"13px 24px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#e8789f,#e8956d)",color:"#fff",fontWeight:700,fontSize:14},
  ghost:{padding:"10px 20px",borderRadius:12,border:"1px solid #f0e0e8",background:"#fff",color:"#b09aa8",fontWeight:600,fontSize:13},
};
