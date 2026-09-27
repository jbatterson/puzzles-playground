import{r as n,h as P,R as H,j as e,e as F,m as R,w as A,t as X,o as M,c as J,q as D,S as Q,f as ee,i as te}from"./client-DO0ZMx_n.js";import{F as W,M as G,c as o,D as $,u as K,d as C,v as se,w as ne,x as ie,y as re,S as oe,p as ae,a as _,o as le,z as ce,A as de,B as pe,j as ue,T as he,P as fe,H as L,k as B}from"./PlaygroundLinksModal-Cru8JWkX.js";import{I as me}from"./ProductilesIcon-C45uJjjO.js";import{I as xe}from"./SumTilesIcon-CMSaYUOx.js";import{R as ge}from"./RolyPolyIcon-CECyfIyI.js";import{D as be}from"./DungBeetleIcon-BRVGchde.js";import{S as ye}from"./ScuttlebugIcon-DbDKJmwU.js";import"./dungBeetleSvg-E87dmFmb.js";function Se(){if(typeof navigator>"u")return!1;const s=navigator.userAgent||"";return!!(/iPad|iPhone|iPod/.test(s)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}function ve(){if(typeof window>"u"||typeof navigator>"u"||!Se()||navigator.standalone===!0)return!1;const s=navigator.userAgent||"";return!/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/\d/.test(s)}const je={display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:"1px solid rgba(26, 61, 91, 0.12)"},we="#6b9b3b",Y=s=>({width:"44px",height:"26px",borderRadius:"999px",border:"none",padding:0,cursor:"pointer",background:s?o:C,position:"relative",flexShrink:0,transition:"background 0.2s"}),ze=s=>({...Y(s),background:s?we:C}),U=s=>({position:"absolute",top:"3px",left:s?"22px":"3px",width:"20px",height:"20px",borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}),Z={width:"32px",height:"32px",borderRadius:"6px",border:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s, color 0.2s"};function Te(s,d){return s?{...Z,cursor:"pointer",background:d?o:C,color:d?"#fff":o}:{...Z,cursor:"default",background:se,color:K}}function Ee({show:s,onClose:d,games:x,onSaved:l,onOpenAddToHomeGuide:h}){const[i,g]=n.useState(()=>P()),[w,y]=n.useState(!1),c=n.useCallback(()=>{const a=P();g(a),l?.()},[l]);H.useEffect(()=>{s&&g(P())},[s]),H.useEffect(()=>{y(ve())},[]);const r=(a,f)=>{A({puzzleOn:{[a]:!!f}}),c()},z=(a,f)=>{const T=!R(a,i)[f];X(a,f,T,i)&&c()},b=i.timerOn!==!1,k=()=>{A({timerOn:!b}),c()};return e.jsxs(W,{show:s,onClose:d,intent:G.SETTINGS,contentClassName:"suite-settings-shell",children:[e.jsx("h2",{className:"suite-settings-title",style:{margin:"0 0 8px",fontSize:"1.35rem",fontWeight:900,letterSpacing:"0.06em",textAlign:"center",color:o},children:"SETTINGS"}),e.jsxs("div",{style:{marginBottom:"18px"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:o,marginBottom:"6px"},children:"MY PUZZLES"}),e.jsx("p",{style:{margin:0,fontSize:"0.95rem",lineHeight:1.45,color:"var(--puzzle-ink-soft, #4a5f72)"},children:"Choose which puzzles appear on your dashboard."})]}),e.jsx("div",{style:{margin:"0 -4px",padding:"0 4px"},children:x.map(({key:a,title:f,Icon:O})=>{const m=i.puzzleOn[a]!==!1,T=F(a)?R(a,i):null,N="108px";return e.jsxs("div",{style:je,children:[e.jsx("div",{style:{width:"40px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"},"aria-hidden":!0,children:O?e.jsx(O,{size:32}):null}),e.jsx("div",{style:{flex:1,minWidth:0,fontWeight:800,fontSize:"0.95rem",color:o},children:f}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",flexShrink:0},children:[e.jsx("button",{type:"button","aria-label":m?`Turn off ${f}`:`Turn on ${f}`,onClick:()=>r(a,!m),style:Y(m),children:e.jsx("span",{style:U(m)})}),T?e.jsx("div",{style:{display:"flex",gap:"6px",width:N,justifyContent:"flex-end"},children:[0,1,2].map(S=>{const t=T[S],p=T.filter(Boolean).length===1&&t,u=m&&!(p&&t),j=m?t?"#fff":void 0:K;return e.jsx("button",{type:"button",disabled:!u,title:["Easy","Medium","Hard"][S],"aria-label":`${["Easy","Medium","Hard"][S]} ${t?"on":"off"}`,onClick:()=>u&&z(a,S),style:{...Te(m,t),cursor:u?"pointer":"default"},children:e.jsx($,{count:S+1,size:18,color:j})},S)})}):e.jsx("div",{style:{width:N,flexShrink:0},"aria-hidden":!0})]})]},a)})}),e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)",display:"flex",justifyContent:"center",alignItems:"center",gap:"12px",flexWrap:"wrap"},children:[e.jsx("button",{type:"button","aria-label":b?"Turn timer off":"Turn timer on",onClick:k,style:ze(b),children:e.jsx("span",{style:U(b)})}),e.jsx("i",{className:"fa-solid fa-clock",style:{fontSize:"1.15rem",lineHeight:1,color:o},"aria-hidden":!0}),e.jsx("span",{style:{fontWeight:900,fontSize:"0.72rem",letterSpacing:"0.12em",color:o},children:b?"TIMER ON":"TIMER OFF"})]}),w&&typeof h=="function"?e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:o,marginBottom:"10px"},children:"HOME SCREEN"}),e.jsx("button",{type:"button",onClick:()=>h(),style:{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:"10px",border:`2px solid ${o}`,background:"#fff",color:o,fontWeight:900,fontSize:"0.88rem",letterSpacing:"0.08em",cursor:"pointer",fontFamily:"inherit"},children:"ADD TO HOME SCREEN"})]}):null]})}const ke="/puzzles-playground/assets/apple-touch-icon-D9KrrZvg.png";function Oe({show:s,onClose:d}){return e.jsxs(W,{show:s,onClose:d,intent:G.ADD_TO_HOME_SCREEN,contentClassName:"add-to-home-screen-shell",children:[e.jsx("div",{style:{display:"flex",justifyContent:"center",marginBottom:"18px"},children:e.jsx("img",{src:ke,alt:"BA Puzzles home screen icon preview",width:120,height:120,style:{width:"120px",height:"120px",borderRadius:"26px",boxShadow:"0 2px 12px rgba(26, 61, 91, 0.15), 0 1px 4px rgba(15, 10, 8, 0.08)",display:"block"}})}),e.jsx("p",{style:{margin:"0 0 14px",fontSize:"0.95rem",fontWeight:800,lineHeight:1.45,color:o,textAlign:"center"},children:"To add an app icon to your home screen:"}),e.jsxs("ol",{style:{margin:0,paddingLeft:"1.35rem",fontSize:"0.92rem",lineHeight:1.55,color:ne},children:[e.jsxs("li",{style:{marginBottom:"12px"},children:["Find and click ",e.jsx("strong",{style:{color:o},children:"SHARE"})," in the Safari toolbar or menu."]}),e.jsxs("li",{style:{marginBottom:"12px"},children:["Find and click ",e.jsx("strong",{style:{color:o},children:"ADD TO HOME SCREEN"})," in the share menu. It may be tucked away in a"," ",e.jsx("strong",{style:{color:o},children:"VIEW MORE"})," menu."]}),e.jsxs("li",{children:["Click the ",e.jsx("strong",{style:{color:o},children:"ADD"})," button and you can play"," ",e.jsx("strong",{style:{color:o},children:"BA Puzzles"})," just like an app."]})]})]})}function Ie({dateKey:s}){const d="/puzzles-playground/",x=ie(s),[l,h]=n.useState(null),i=n.useRef(null),g=n.useRef(null);n.useEffect(()=>()=>{i.current&&clearTimeout(i.current)},[]);const w=n.useCallback(()=>{i.current&&(clearTimeout(i.current),i.current=null),h(null)},[]),y=n.useCallback(async()=>{if(!x)return;const c=re(s,d);if(c)try{await navigator.clipboard.writeText(c),i.current&&clearTimeout(i.current),h({fadeOut:!1}),i.current=setTimeout(()=>{h(r=>r?{...r,fadeOut:!0}:null),i.current=null},oe)}catch{}},[x,s,d]);return e.jsxs("div",{ref:g,className:"game-nav-share-wrap hp-section-share",style:{position:"relative"},children:[e.jsx("button",{type:"button",className:"game-nav-share-btn",disabled:!x,onClick:y,"aria-label":x?"Share all results":"Share all results (no progress yet)",children:e.jsx("i",{className:"fa-solid fa-share-nodes","aria-hidden":"true"})}),l!=null&&e.jsx(ae,{short:!0,fadeOut:l.fadeOut,align:"end",onDismiss:w,onTransitionEnd:c=>{c.target!==c.currentTarget||c.propertyName!=="opacity"||h(r=>r?.fadeOut?null:r)}})]})}const I="/puzzles-playground/",Pe=365;function Ne(s,d){return F(s)?te(s,d):!1}function Ce({gameKey:s,completions:d,perfects:x,moveCounts:l,tierSlots:h}){const i=ee(s),g=d??[!1,!1,!1],w=x??[!1,!1,!1],y=l??[null,null,null],c=h??[0,1,2];return e.jsx("div",{style:{display:"flex",gap:"6px",marginTop:"8px"},children:c.map(r=>{const z=g[r],b=w[r],k=y[r]!=null?y[r]:null,a=z?i?b?e.jsx(L,{}):k!=null?String(Math.min(k,99)):e.jsx(B,{}):b?e.jsx(L,{}):e.jsx(B,{}):e.jsx($,{count:r+1,size:20});return e.jsx("div",{style:{width:"28px",height:"28px",borderRadius:"6px",background:z?"#6b9b3b":C,color:z?"#fff":o,fontWeight:900,fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s"},children:a},r)})})}const E=[{key:"sumtiles",href:`${I}puzzlegames/sumtiles/`,Icon:xe,title:"Sum Tiles",desc:"Slide tiles so every row and column hits its sum."},{key:"productiles",href:`${I}puzzlegames/productiles/`,Icon:me,title:"Productiles",desc:"Slide tiles so every row and column hits its product."},{key:"rolypoly",href:`${I}puzzlegames/rolypoly/`,Icon:ge,title:"Roly Poly",desc:"Swipe to roll every bug onto a yellow target."},{key:"dungbeetle",href:`${I}puzzlegames/dungbeetle/`,Icon:be,title:"Dung Beetle",desc:"Push tetrominoes and roll the ball into the hole."},{key:"scuttlebug",href:`${I}puzzlegames/scuttlebug/`,Icon:ye,title:"Scuttlebug",desc:"Push tetrominoes and scuttle the beetle into the hole."}];function Ue(){const[s,d]=n.useState(_),x=le(s),[l,h]=n.useState(()=>P()),[i,g]=n.useState(!1),[w,y]=n.useState(!1),c=n.useCallback(()=>h(P()),[]),r=n.useMemo(()=>Object.fromEntries(E.map(t=>[t.key,ce(t.key,s)])),[s]),z=n.useMemo(()=>Object.fromEntries(E.map(t=>[t.key,de(t.key,s)])),[s]),b=n.useMemo(()=>Object.fromEntries(E.map(t=>[t.key,pe(t.key,s)])),[s]),[k,a]=n.useState(0),f=n.useMemo(()=>Object.fromEntries(E.map(t=>[t.key,ue(p=>Ne(t.key,p),Pe)])),[k,l]),O=n.useMemo(()=>E.filter(t=>M(t.key,l)),[l]),m=n.useMemo(()=>E.filter(t=>!M(t.key,l)),[l]),T=n.useMemo(()=>E.map(({key:t,title:p,Icon:u})=>({key:t,title:p,Icon:u})),[]),[N,S]=n.useState(!1);return H.useEffect(()=>{const t=()=>{d(_()),a(v=>v+1)},p=()=>{document.visibilityState==="visible"&&t()},u=v=>{v.persisted&&t()};document.addEventListener("visibilitychange",p),window.addEventListener("pageshow",u);const j=v=>{t(),v.key===Q&&c()};return window.addEventListener("storage",j),()=>{document.removeEventListener("visibilitychange",p),window.removeEventListener("pageshow",u),window.removeEventListener("storage",j)}},[c]),e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
                .hp-section-heading {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 10px;
                }
                .hp-section-label {
                    font-size: 0.72rem;
                    font-weight: 900;
                    letter-spacing: 0.12em;
                    color: var(--puzzle-ink-muted);
                    margin-bottom: 10px;
                }
                .hp-section-heading .hp-section-label {
                    margin-bottom: 0;
                }
                .hp-section-share {
                    position: relative;
                    flex-shrink: 0;
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
            `}),e.jsxs("div",{className:"hp-shell",children:[e.jsx("div",{style:{flexShrink:0,width:"100%"},children:e.jsx(he,{title:"PUZZLES",showHome:!1,showStats:!1,titleOpensLinks:!0,hubBaLinksMenu:!0,onSettings:()=>g(!0),onCube:()=>S(!0)})}),e.jsxs("main",{className:"hp-page",children:[e.jsxs("header",{className:"hp-intro",children:[e.jsx("p",{className:"hp-tagline",children:"Daily puzzles for the breakfast table, the car ride, or the classroom warm-up."}),e.jsx("div",{className:"hp-date",children:x})]}),e.jsx("div",{className:"hp-divider"}),e.jsxs("div",{className:"hp-section-heading",children:[e.jsx("div",{className:"hp-section-label",children:"MY PUZZLES"}),e.jsx(Ie,{dateKey:s})]}),e.jsx("section",{className:"hp-list",children:O.map(({key:t,href:p,Icon:u,title:j,desc:v})=>{const V=J(t,l),q=D(p,r[t],l);return e.jsxs("a",{className:"hp-card",href:q,children:[e.jsx("div",{className:"hp-iconTile",children:e.jsx(u,{size:56})}),e.jsxs("div",{className:"hp-meta",children:[e.jsx("div",{className:"hp-cardTitle",children:j}),e.jsx("div",{className:"hp-desc",children:v}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"},children:[e.jsx(Ce,{gameKey:t,completions:r[t],perfects:z[t],moveCounts:b[t],tierSlots:V}),f[t]>0&&e.jsxs("span",{style:{fontSize:"14px",color:"var(--muted)",lineHeight:1.35},children:["Streak: ",f[t]]})]})]})]},t)})}),m.length>0?e.jsxs("section",{className:"hp-tiles-section","aria-label":"Other puzzles",children:[e.jsx("div",{className:"hp-section-label",children:"OTHER PUZZLES"}),e.jsx("div",{className:"hp-tile-grid",children:m.map(({key:t,href:p,Icon:u,title:j})=>{const v=D(p,r[t],l);return e.jsxs("a",{className:"hp-tile",href:v,children:[e.jsx(u,{size:40}),e.jsx("span",{className:"hp-tile-title",children:j.toUpperCase()})]},t)})})]}):null]})]}),e.jsx(Ee,{show:i,onClose:()=>g(!1),games:T,onSaved:c,onOpenAddToHomeGuide:()=>{g(!1),y(!0)}}),e.jsx(Oe,{show:w,onClose:()=>y(!1)}),e.jsx(fe,{show:N,onClose:()=>S(!1)})]})}export{Ue as default};
