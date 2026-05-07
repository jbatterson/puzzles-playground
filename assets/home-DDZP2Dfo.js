import{r as n,R as Z,j as e}from"./client-CF9XUsNj.js";import{m as T,F as $,M as Y,f as x,k as A,E as P,D as B,I as F,J as O,K as q,h as N,L as J,b as L,x as V,o as X,s as Q,q as ee,j as te,N as M,T as se,c as ie,O as H,P as ne,C as ae,t as re,H as _,w as R,i as oe}from"./PlaygroundLinksModal-Bfs6yGQ-.js";import{I as le}from"./ProductilesIcon-DfpVzgaf.js";import{I as ce}from"./SumTilesIcon-DvKDOj4P.js";import{a as de}from"./SwipeIcon-on27eVfe.js";const pe={display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:"1px solid rgba(26, 61, 91, 0.12)"},he="#6b9b3b",W=s=>({width:"44px",height:"26px",borderRadius:"999px",border:"none",padding:0,cursor:"pointer",background:s?x:N,position:"relative",flexShrink:0,transition:"background 0.2s"}),ue=s=>({...W(s),background:s?he:N}),D=s=>({position:"absolute",top:"3px",left:s?"22px":"3px",width:"20px",height:"20px",borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}),U={width:"32px",height:"32px",borderRadius:"6px",border:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s, color 0.2s"};function fe(s,c){return s?{...U,cursor:"pointer",background:c?x:N,color:c?"#fff":x}:{...U,cursor:"default",background:J,color:F}}function me({show:s,onClose:c,games:E,onSaved:r}){const[h,z]=n.useState(()=>T()),g=n.useCallback(()=>{const i=T();z(i),r?.()},[r]);Z.useEffect(()=>{s&&z(T())},[s]);const j=(i,o)=>{O({puzzleOn:{[i]:!!o}}),g()},b=(i,o)=>{const y=!P(i,h)[o];q(i,o,y,h)&&g()},u=h.timerOn!==!1,d=()=>{O({timerOn:!u}),g()};return e.jsxs($,{show:s,onClose:c,intent:Y.SETTINGS,contentClassName:"suite-settings-shell",children:[e.jsx("h2",{className:"suite-settings-title",style:{margin:"0 0 8px",fontSize:"1.35rem",fontWeight:900,letterSpacing:"0.06em",textAlign:"center",color:x},children:"SETTINGS"}),e.jsxs("div",{style:{marginBottom:"18px"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:x,marginBottom:"6px"},children:"MY PUZZLES"}),e.jsx("p",{style:{margin:0,fontSize:"0.95rem",lineHeight:1.45,color:"var(--puzzle-ink-soft, #4a5f72)"},children:"Choose which puzzles appear on your dashboard."})]}),e.jsx("div",{style:{margin:"0 -4px",padding:"0 4px"},children:E.map(({key:i,title:o,Icon:f})=>{const l=h.puzzleOn[i]!==!1,y=A(i)?P(i,h):null,I="108px";return e.jsxs("div",{style:pe,children:[e.jsx("div",{style:{width:"40px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"},"aria-hidden":!0,children:f?e.jsx(f,{size:32}):null}),e.jsx("div",{style:{flex:1,minWidth:0,fontWeight:800,fontSize:"0.95rem",color:x},children:o}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",flexShrink:0},children:[e.jsx("button",{type:"button","aria-label":l?`Turn off ${o}`:`Turn on ${o}`,onClick:()=>j(i,!l),style:W(l),children:e.jsx("span",{style:D(l)})}),y?e.jsx("div",{style:{display:"flex",gap:"6px",width:I,justifyContent:"flex-end"},children:[0,1,2].map(S=>{const v=y[S],t=y.filter(Boolean).length===1&&v,a=l&&!(t&&v),p=l?v?"#fff":void 0:F;return e.jsx("button",{type:"button",disabled:!a,title:["Easy","Medium","Hard"][S],"aria-label":`${["Easy","Medium","Hard"][S]} ${v?"on":"off"}`,onClick:()=>a&&b(i,S),style:{...fe(l,v),cursor:a?"pointer":"default"},children:e.jsx(B,{count:S+1,size:18,color:p})},S)})}):e.jsx("div",{style:{width:I,flexShrink:0},"aria-hidden":!0})]})]},i)})}),e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)",display:"flex",justifyContent:"center",alignItems:"center",gap:"12px",flexWrap:"wrap"},children:[e.jsx("button",{type:"button","aria-label":u?"Turn timer off":"Turn timer on",onClick:d,style:ue(u),children:e.jsx("span",{style:D(u)})}),e.jsx("i",{className:"fa-solid fa-clock",style:{fontSize:"1.15rem",lineHeight:1,color:x},"aria-hidden":!0}),e.jsx("span",{style:{fontWeight:900,fontSize:"0.72rem",letterSpacing:"0.12em",color:x},children:u?"TIMER ON":"TIMER OFF"})]})]})}const C="/puzzles-playground/",xe=365;function ge(s,c){return A(s)?oe(s,c):!1}function be({gameKey:s,completions:c,perfects:E,moveCounts:r,tierSlots:h}){const z=re(s),g=c??[!1,!1,!1],j=E??[!1,!1,!1],b=r??[null,null,null],u=h??[0,1,2];return e.jsx("div",{style:{display:"flex",gap:"6px",marginTop:"8px"},children:u.map(d=>{const i=g[d],o=j[d],f=b[d]!=null?b[d]:null,l=i?z?o?e.jsx(_,{}):f!=null?String(Math.min(f,99)):e.jsx(R,{}):o?e.jsx(_,{}):e.jsx(R,{}):e.jsx(B,{count:d+1,size:20});return e.jsx("div",{style:{width:"28px",height:"28px",borderRadius:"6px",background:i?"#6b9b3b":N,color:i?"#fff":x,fontWeight:900,fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s"},children:l},d)})})}const w=[{key:"sumtiles",href:`${C}puzzlegames/sumtiles/`,Icon:ce,title:"Sum Tiles",desc:"Slide tiles so every row and column hits its sum."},{key:"productiles",href:`${C}puzzlegames/productiles/`,Icon:le,title:"Productiles",desc:"Slide tiles so every row and column hits its product."},{key:"swipe",href:`${C}puzzlegames/swipe/`,Icon:de,title:"Roly Poly",desc:"Swipe to roll every bug onto a yellow target."}];function ze(){const[s,c]=n.useState(L),E=V(s),[r,h]=n.useState(()=>T()),[z,g]=n.useState(!1),j=n.useCallback(()=>h(T()),[]),b=n.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,X(t.key,s)])),[s]),u=n.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,Q(t.key,s)])),[s]),d=n.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,ee(t.key,s)])),[s]),[i,o]=n.useState(0),f=n.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,te(a=>ge(t.key,a),xe)])),[i,r]),l=n.useMemo(()=>w.filter(t=>M(t.key,r)),[r]),y=n.useMemo(()=>w.filter(t=>!M(t.key,r)),[r]),I=n.useMemo(()=>w.map(({key:t,title:a,Icon:p})=>({key:t,title:a,Icon:p})),[]),[S,v]=n.useState(!1);return Z.useEffect(()=>{const t=()=>{c(L()),o(m=>m+1)},a=()=>{document.visibilityState==="visible"&&t()},p=m=>{m.persisted&&t()};document.addEventListener("visibilitychange",a),window.addEventListener("pageshow",p);const k=m=>{t(),m.key===ae&&j()};return window.addEventListener("storage",k),()=>{document.removeEventListener("visibilitychange",a),window.removeEventListener("pageshow",p),window.removeEventListener("storage",k)}},[j]),e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap');

                :root {
                    --bg: #ffffff;
                    --text: var(--puzzle-ink);
                    --muted: var(--puzzle-ink-muted);
                    --hairline: #e7e7e7;
                    --tile: #f4f4f4;
                    --tileHover: #eeeeee;
                    --shadow: 0 1px 0 rgba(26, 61, 91, 0.06);
                    --hp-card-bg: #f7f8f9;
                    --hp-card-hover: #f1f3f5;
                    --hp-card-shadow: 0 1px 0 rgba(26, 61, 91, 0.04);
                    --hp-card-focus: rgba(26, 61, 91, 0.26);
                    --radius: 10px;
                }

                * { box-sizing: border-box; }

                #root {
                    max-width: none;
                    width: 100%;
                }

                body {
                    margin: 0;
                    background: var(--bg);
                    color: var(--text);
                    font-family: 'Outfit', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
                    -webkit-font-smoothing: antialiased;
                }

                .hp-shell {
                    min-height: 100dvh;
                    display: flex;
                    flex-direction: column;
                }

                .hp-page {
                    flex: 1;
                    width: min(95vw, 500px);
                    max-width: min(95vw, 500px);
                    margin: 0 auto;
                    box-sizing: border-box;
                    padding: 18px 20px 48px;
                }

                .hp-intro {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 18px;
                }

                .hp-tagline {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 600;
                    line-height: 1.4;
                    color: var(--puzzle-ink-soft);
                    max-width: 52ch;
                }

                .hp-date {
                    font-size: 13px;
                    color: var(--puzzle-ink-muted);
                    letter-spacing: 0.02em;
                }

                .hp-divider {
                    height: 2px;
                    background: var(--puzzle-grid-line);
                    margin: 18px 0;
                }

                .hp-list {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                }

                a.hp-card {
                    display: flex;
                    gap: 16px;
                    text-decoration: none;
                    color: inherit;
                    padding: 12px;
                    border-radius: var(--radius);
                    background: var(--hp-card-bg);
                    box-shadow: var(--hp-card-shadow);
                    transition: background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
                }

                a.hp-card:hover {
                    background: var(--hp-card-hover);
                    box-shadow: 0 1px 0 rgba(26, 61, 91, 0.055);
                    transform: translateY(-1px);
                }

                a.hp-card:active {
                    transform: translateY(0px);
                    box-shadow: var(--hp-card-shadow);
                }

                .hp-iconTile {
                    width: 96px;
                    height: 96px;
                    border-radius: var(--radius);
                    display: grid;
                    place-items: center;
                    flex: 0 0 auto;
                }

                .hp-meta {
                    min-width: 0;
                    padding-top: 4px;
                }

                .hp-cardTitle {
                    font-size: 16px;
                    font-weight: 900;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }

                .hp-desc {
                    font-size: 14px;
                    line-height: 1.35;
                    color: var(--puzzle-ink-soft);
                    max-width: 52ch;
                }

                @media (max-width: 420px) {
                    .hp-iconTile { width: 84px; height: 84px; }
                }

                a.hp-card:focus-visible {
                    outline: 3px solid var(--hp-card-focus);
                    outline-offset: 3px;
                }

                .hp-tiles-section { margin-top: 22px; }
                .hp-section-label {
                    font-size: 0.72rem;
                    font-weight: 900;
                    letter-spacing: 0.12em;
                    color: var(--puzzle-ink-muted);
                    margin-bottom: 10px;
                }
                .hp-tile-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
                    gap: 10px;
                }
                a.hp-tile {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px 6px;
                    border-radius: var(--radius);
                    text-decoration: none;
                    color: inherit;
                    background: var(--tile);
                    box-shadow: var(--shadow);
                    min-height: 88px;
                    transition: background 140ms ease, transform 140ms ease;
                }
                a.hp-tile:hover {
                    background: var(--tileHover);
                    transform: translateY(-1px);
                }
                .hp-tile-title {
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.06em;
                    text-align: center;
                    line-height: 1.2;
                    color: var(--puzzle-ink-soft);
                }
            `}),e.jsxs("div",{className:"hp-shell",children:[e.jsx("div",{style:{flexShrink:0,width:"100%"},children:e.jsx(se,{title:"PUZZLES",showHome:!1,showStats:!1,titleOpensLinks:!0,hubBaLinksMenu:!0,onSettings:()=>g(!0),onCube:()=>v(!0)})}),e.jsxs("main",{className:"hp-page",children:[e.jsxs("header",{className:"hp-intro",children:[e.jsx("p",{className:"hp-tagline",children:"Daily puzzles for the breakfast table, the car ride, or the classroom warm-up."}),e.jsx("div",{className:"hp-date",children:E})]}),e.jsx("div",{className:"hp-divider"}),e.jsx("div",{className:"hp-section-label",children:"MY PUZZLES"}),e.jsx("section",{className:"hp-list",children:l.map(({key:t,href:a,Icon:p,title:k,desc:m})=>{const G=ie(t,r),K=H(a,b[t],r);return e.jsxs("a",{className:"hp-card",href:K,children:[e.jsx("div",{className:"hp-iconTile",children:e.jsx(p,{size:56})}),e.jsxs("div",{className:"hp-meta",children:[e.jsx("div",{className:"hp-cardTitle",children:k}),e.jsx("div",{className:"hp-desc",children:m}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"},children:[e.jsx(be,{gameKey:t,completions:b[t],perfects:u[t],moveCounts:d[t],tierSlots:G}),f[t]>0&&e.jsxs("span",{style:{fontSize:"14px",color:"var(--muted)",lineHeight:1.35},children:["Streak: ",f[t]]})]})]})]},t)})}),y.length>0?e.jsxs("section",{className:"hp-tiles-section","aria-label":"Other puzzles",children:[e.jsx("div",{className:"hp-section-label",children:"OTHER PUZZLES"}),e.jsx("div",{className:"hp-tile-grid",children:y.map(({key:t,href:a,Icon:p,title:k})=>{const m=H(a,b[t],r);return e.jsxs("a",{className:"hp-tile",href:m,children:[e.jsx(p,{size:40}),e.jsx("span",{className:"hp-tile-title",children:k.toUpperCase()})]},t)})})]}):null]})]}),e.jsx(me,{show:z,onClose:()=>g(!1),games:I,onSaved:j}),e.jsx(ne,{show:S,onClose:()=>v(!1)})]})}export{ze as default};
