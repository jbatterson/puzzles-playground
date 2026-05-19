import{r as o,f as I,R as H,j as e,e as F,m as M,w as A,t as X,o as R,c as J,q as D,S as Q,h as ee,i as te}from"./client-i26RU0zT.js";import{F as W,M as G,c as i,D as K,p as $,d as C,q as se,t as ie,a as L,k as ne,f as oe,i as re,h as ae,e as le,T as de,P as ce,H as _,j as U}from"./PlaygroundLinksModal-BabBUeAN.js";import{I as pe}from"./ProductilesIcon-wfaE4lXp.js";import{I as he}from"./SumTilesIcon-DbfIrey4.js";import{R as ue}from"./RolyPolyIcon-Ph0lKIry.js";function fe(){if(typeof navigator>"u")return!1;const s=navigator.userAgent||"";return!!(/iPad|iPhone|iPod/.test(s)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}function xe(){if(typeof window>"u"||typeof navigator>"u"||!fe()||navigator.standalone===!0)return!1;const s=navigator.userAgent||"";return!/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/\d/.test(s)}const me={display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:"1px solid rgba(26, 61, 91, 0.12)"},ge="#6b9b3b",Y=s=>({width:"44px",height:"26px",borderRadius:"999px",border:"none",padding:0,cursor:"pointer",background:s?i:C,position:"relative",flexShrink:0,transition:"background 0.2s"}),be=s=>({...Y(s),background:s?ge:C}),B=s=>({position:"absolute",top:"3px",left:s?"22px":"3px",width:"20px",height:"20px",borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}),Z={width:"32px",height:"32px",borderRadius:"6px",border:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s, color 0.2s"};function ye(s,a){return s?{...Z,cursor:"pointer",background:a?i:C,color:a?"#fff":i}:{...Z,cursor:"default",background:se,color:$}}function Se({show:s,onClose:a,games:T,onSaved:r,onOpenAddToHomeGuide:z}){const[f,b]=o.useState(()=>I()),[k,S]=o.useState(!1),x=o.useCallback(()=>{const n=I();b(n),r?.()},[r]);H.useEffect(()=>{s&&b(I())},[s]),H.useEffect(()=>{S(xe())},[]);const l=(n,p)=>{A({puzzleOn:{[n]:!!p}}),x()},v=(n,p)=>{const j=!M(n,f)[p];X(n,p,j,f)&&x()},u=f.timerOn!==!1,E=()=>{A({timerOn:!u}),x()};return e.jsxs(W,{show:s,onClose:a,intent:G.SETTINGS,contentClassName:"suite-settings-shell",children:[e.jsx("h2",{className:"suite-settings-title",style:{margin:"0 0 8px",fontSize:"1.35rem",fontWeight:900,letterSpacing:"0.06em",textAlign:"center",color:i},children:"SETTINGS"}),e.jsxs("div",{style:{marginBottom:"18px"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:i,marginBottom:"6px"},children:"MY PUZZLES"}),e.jsx("p",{style:{margin:0,fontSize:"0.95rem",lineHeight:1.45,color:"var(--puzzle-ink-soft, #4a5f72)"},children:"Choose which puzzles appear on your dashboard."})]}),e.jsx("div",{style:{margin:"0 -4px",padding:"0 4px"},children:T.map(({key:n,title:p,Icon:O})=>{const h=f.puzzleOn[n]!==!1,j=F(n)?M(n,f):null,P="108px";return e.jsxs("div",{style:me,children:[e.jsx("div",{style:{width:"40px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"},"aria-hidden":!0,children:O?e.jsx(O,{size:32}):null}),e.jsx("div",{style:{flex:1,minWidth:0,fontWeight:800,fontSize:"0.95rem",color:i},children:p}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",flexShrink:0},children:[e.jsx("button",{type:"button","aria-label":h?`Turn off ${p}`:`Turn on ${p}`,onClick:()=>l(n,!h),style:Y(h),children:e.jsx("span",{style:B(h)})}),j?e.jsx("div",{style:{display:"flex",gap:"6px",width:P,justifyContent:"flex-end"},children:[0,1,2].map(m=>{const t=j[m],d=j.filter(Boolean).length===1&&t,c=h&&!(d&&t),y=h?t?"#fff":void 0:$;return e.jsx("button",{type:"button",disabled:!c,title:["Easy","Medium","Hard"][m],"aria-label":`${["Easy","Medium","Hard"][m]} ${t?"on":"off"}`,onClick:()=>c&&v(n,m),style:{...ye(h,t),cursor:c?"pointer":"default"},children:e.jsx(K,{count:m+1,size:18,color:y})},m)})}):e.jsx("div",{style:{width:P,flexShrink:0},"aria-hidden":!0})]})]},n)})}),e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)",display:"flex",justifyContent:"center",alignItems:"center",gap:"12px",flexWrap:"wrap"},children:[e.jsx("button",{type:"button","aria-label":u?"Turn timer off":"Turn timer on",onClick:E,style:be(u),children:e.jsx("span",{style:B(u)})}),e.jsx("i",{className:"fa-solid fa-clock",style:{fontSize:"1.15rem",lineHeight:1,color:i},"aria-hidden":!0}),e.jsx("span",{style:{fontWeight:900,fontSize:"0.72rem",letterSpacing:"0.12em",color:i},children:u?"TIMER ON":"TIMER OFF"})]}),k&&typeof z=="function"?e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:i,marginBottom:"10px"},children:"HOME SCREEN"}),e.jsx("button",{type:"button",onClick:()=>z(),style:{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:"10px",border:`2px solid ${i}`,background:"#fff",color:i,fontWeight:900,fontSize:"0.88rem",letterSpacing:"0.08em",cursor:"pointer",fontFamily:"inherit"},children:"ADD TO HOME SCREEN"})]}):null]})}const ve="/puzzles-playground/assets/apple-touch-icon-D9KrrZvg.png";function je({show:s,onClose:a}){return e.jsxs(W,{show:s,onClose:a,intent:G.ADD_TO_HOME_SCREEN,contentClassName:"add-to-home-screen-shell",children:[e.jsx("div",{style:{display:"flex",justifyContent:"center",marginBottom:"18px"},children:e.jsx("img",{src:ve,alt:"BA Puzzles home screen icon preview",width:120,height:120,style:{width:"120px",height:"120px",borderRadius:"26px",boxShadow:"0 2px 12px rgba(26, 61, 91, 0.15), 0 1px 4px rgba(15, 10, 8, 0.08)",display:"block"}})}),e.jsx("p",{style:{margin:"0 0 14px",fontSize:"0.95rem",fontWeight:800,lineHeight:1.45,color:i,textAlign:"center"},children:"To add an app icon to your home screen:"}),e.jsxs("ol",{style:{margin:0,paddingLeft:"1.35rem",fontSize:"0.92rem",lineHeight:1.55,color:ie},children:[e.jsxs("li",{style:{marginBottom:"12px"},children:["Find and click ",e.jsx("strong",{style:{color:i},children:"SHARE"})," in the Safari toolbar or menu."]}),e.jsxs("li",{style:{marginBottom:"12px"},children:["Find and click ",e.jsx("strong",{style:{color:i},children:"ADD TO HOME SCREEN"})," in the share menu. It may be tucked away in a"," ",e.jsx("strong",{style:{color:i},children:"VIEW MORE"})," menu."]}),e.jsxs("li",{children:["Click the ",e.jsx("strong",{style:{color:i},children:"ADD"})," button and you can play"," ",e.jsx("strong",{style:{color:i},children:"BA Puzzles"})," just like an app."]})]})]})}const N="/puzzles-playground/",we=365;function ze(s,a){return F(s)?te(s,a):!1}function Ee({gameKey:s,completions:a,perfects:T,moveCounts:r,tierSlots:z}){const f=ee(s),b=a??[!1,!1,!1],k=T??[!1,!1,!1],S=r??[null,null,null],x=z??[0,1,2];return e.jsx("div",{style:{display:"flex",gap:"6px",marginTop:"8px"},children:x.map(l=>{const v=b[l],u=k[l],E=S[l]!=null?S[l]:null,n=v?f?u?e.jsx(_,{}):E!=null?String(Math.min(E,99)):e.jsx(U,{}):u?e.jsx(_,{}):e.jsx(U,{}):e.jsx(K,{count:l+1,size:20});return e.jsx("div",{style:{width:"28px",height:"28px",borderRadius:"6px",background:v?"#6b9b3b":C,color:v?"#fff":i,fontWeight:900,fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s"},children:n},l)})})}const w=[{key:"sumtiles",href:`${N}puzzlegames/sumtiles/`,Icon:he,title:"Sum Tiles",desc:"Slide tiles so every row and column hits its sum."},{key:"productiles",href:`${N}puzzlegames/productiles/`,Icon:pe,title:"Productiles",desc:"Slide tiles so every row and column hits its product."},{key:"rolypoly",href:`${N}puzzlegames/rolypoly/`,Icon:ue,title:"Roly Poly",desc:"Swipe to roll every bug onto a yellow target."}];function Ce(){const[s,a]=o.useState(L),T=ne(s),[r,z]=o.useState(()=>I()),[f,b]=o.useState(!1),[k,S]=o.useState(!1),x=o.useCallback(()=>z(I()),[]),l=o.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,oe(t.key,s)])),[s]),v=o.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,re(t.key,s)])),[s]),u=o.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,ae(t.key,s)])),[s]),[E,n]=o.useState(0),p=o.useMemo(()=>Object.fromEntries(w.map(t=>[t.key,le(d=>ze(t.key,d),we)])),[E,r]),O=o.useMemo(()=>w.filter(t=>R(t.key,r)),[r]),h=o.useMemo(()=>w.filter(t=>!R(t.key,r)),[r]),j=o.useMemo(()=>w.map(({key:t,title:d,Icon:c})=>({key:t,title:d,Icon:c})),[]),[P,m]=o.useState(!1);return H.useEffect(()=>{const t=()=>{a(L()),n(g=>g+1)},d=()=>{document.visibilityState==="visible"&&t()},c=g=>{g.persisted&&t()};document.addEventListener("visibilitychange",d),window.addEventListener("pageshow",c);const y=g=>{t(),g.key===Q&&x()};return window.addEventListener("storage",y),()=>{document.removeEventListener("visibilitychange",d),window.removeEventListener("pageshow",c),window.removeEventListener("storage",y)}},[x]),e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
            `}),e.jsxs("div",{className:"hp-shell",children:[e.jsx("div",{style:{flexShrink:0,width:"100%"},children:e.jsx(de,{title:"PUZZLES",showHome:!1,showStats:!1,titleOpensLinks:!0,hubBaLinksMenu:!0,onSettings:()=>b(!0),onCube:()=>m(!0)})}),e.jsxs("main",{className:"hp-page",children:[e.jsxs("header",{className:"hp-intro",children:[e.jsx("p",{className:"hp-tagline",children:"Daily puzzles for the breakfast table, the car ride, or the classroom warm-up."}),e.jsx("div",{className:"hp-date",children:T})]}),e.jsx("div",{className:"hp-divider"}),e.jsx("div",{className:"hp-section-label",children:"MY PUZZLES"}),e.jsx("section",{className:"hp-list",children:O.map(({key:t,href:d,Icon:c,title:y,desc:g})=>{const q=J(t,r),V=D(d,l[t],r);return e.jsxs("a",{className:"hp-card",href:V,children:[e.jsx("div",{className:"hp-iconTile",children:e.jsx(c,{size:56})}),e.jsxs("div",{className:"hp-meta",children:[e.jsx("div",{className:"hp-cardTitle",children:y}),e.jsx("div",{className:"hp-desc",children:g}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"},children:[e.jsx(Ee,{gameKey:t,completions:l[t],perfects:v[t],moveCounts:u[t],tierSlots:q}),p[t]>0&&e.jsxs("span",{style:{fontSize:"14px",color:"var(--muted)",lineHeight:1.35},children:["Streak: ",p[t]]})]})]})]},t)})}),h.length>0?e.jsxs("section",{className:"hp-tiles-section","aria-label":"Other puzzles",children:[e.jsx("div",{className:"hp-section-label",children:"OTHER PUZZLES"}),e.jsx("div",{className:"hp-tile-grid",children:h.map(({key:t,href:d,Icon:c,title:y})=>{const g=D(d,l[t],r);return e.jsxs("a",{className:"hp-tile",href:g,children:[e.jsx(c,{size:40}),e.jsx("span",{className:"hp-tile-title",children:y.toUpperCase()})]},t)})})]}):null]})]}),e.jsx(Se,{show:f,onClose:()=>b(!1),games:j,onSaved:x,onOpenAddToHomeGuide:()=>{b(!1),S(!0)}}),e.jsx(je,{show:k,onClose:()=>S(!1)}),e.jsx(ce,{show:P,onClose:()=>m(!1)})]})}export{Ce as default};
