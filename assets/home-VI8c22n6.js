import{r as n,m as C,R as A,j as e,f as G,u as D,w as M,v as te,x as se,h as N,l as _,B as H,y as ne,z as ie,A as re,C as L,c as oe,e as ae,D as B,S as le,k as ce,i as de}from"./client-_24godSS.js";import{F as K,M as Y,c as a,D as V,x as X,d as R,y as pe,z as ue,A as he,B as fe,S as me,t as xe,a as U,s as ge,m as be,T as ye,P as Se,H as Z,n as $}from"./PlaygroundLinksModal-C5yUNiVS.js";import{I as ve}from"./ProductilesIcon-BfpvVg6U.js";import{I as je}from"./SumTilesIcon-BvJyG9k6.js";import{R as ze}from"./RolyPolyIcon-DqTdy9FJ.js";import{D as we}from"./DungBeetleIcon-DShJepYK.js";import{S as Te}from"./ScuttlebugIcon-cThXb4on.js";import"./dungBeetleSvg-E87dmFmb.js";function ke(){if(typeof navigator>"u")return!1;const s=navigator.userAgent||"";return!!(/iPad|iPhone|iPod/.test(s)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}function Ee(){if(typeof window>"u"||typeof navigator>"u"||!ke()||navigator.standalone===!0)return!1;const s=navigator.userAgent||"";return!/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/\d/.test(s)}const Oe={display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:"1px solid rgba(26, 61, 91, 0.12)"},Pe="#6b9b3b",q=s=>({width:"44px",height:"26px",borderRadius:"999px",border:"none",padding:0,cursor:"pointer",background:s?a:R,position:"relative",flexShrink:0,transition:"background 0.2s"}),Ce=s=>({...q(s),background:s?Pe:R}),F=s=>({position:"absolute",top:"3px",left:s?"22px":"3px",width:"20px",height:"20px",borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}),W={width:"32px",height:"32px",borderRadius:"6px",border:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s, color 0.2s"};function Ie(s,p){return s?{...W,cursor:"pointer",background:p?a:R,color:p?"#fff":a}:{...W,cursor:"default",background:pe,color:X}}function Ne({show:s,onClose:p,games:g,onSaved:c,onOpenAddToHomeGuide:m}){const[r,b]=n.useState(()=>C()),[z,v]=n.useState(!1),l=n.useCallback(()=>{const o=C();b(o),c?.()},[c]);A.useEffect(()=>{s&&b(C())},[s]),A.useEffect(()=>{v(Ee())},[]);const h=(o,f)=>{M({puzzleOn:{[o]:!!f}}),l()},O=(o,f)=>{const k=!D(o,r)[f];te(o,f,k,r)&&l()},u=r.timerOn!==!1,w=()=>{M({timerOn:!u}),l()};return e.jsxs(K,{show:s,onClose:p,intent:Y.SETTINGS,contentClassName:"suite-settings-shell",children:[e.jsx("h2",{className:"suite-settings-title",style:{margin:"0 0 8px",fontSize:"1.35rem",fontWeight:900,letterSpacing:"0.06em",textAlign:"center",color:a},children:"SETTINGS"}),e.jsxs("div",{style:{marginBottom:"18px"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:a,marginBottom:"6px"},children:"MY PUZZLES"}),e.jsx("p",{style:{margin:0,fontSize:"0.95rem",lineHeight:1.45,color:"var(--puzzle-ink-soft, #4a5f72)"},children:"Choose which puzzles appear on your dashboard."})]}),e.jsx("div",{style:{margin:"0 -4px",padding:"0 4px"},children:g.map(({key:o,title:f,Icon:T})=>{const x=r.puzzleOn[o]!==!1,k=G(o)?D(o,r):null,I="108px";return e.jsxs("div",{style:Oe,children:[e.jsx("div",{style:{width:"40px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"},"aria-hidden":!0,children:T?e.jsx(T,{size:32}):null}),e.jsx("div",{style:{flex:1,minWidth:0,fontWeight:800,fontSize:"0.95rem",color:a},children:f}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",flexShrink:0},children:[e.jsx("button",{type:"button","aria-label":x?`Turn off ${f}`:`Turn on ${f}`,onClick:()=>h(o,!x),style:q(x),children:e.jsx("span",{style:F(x)})}),k?e.jsx("div",{style:{display:"flex",gap:"6px",width:I,justifyContent:"flex-end"},children:[0,1,2].map(y=>{const t=k[y],i=k.filter(Boolean).length===1&&t,d=x&&!(i&&t),j=x?t?"#fff":void 0:X;return e.jsx("button",{type:"button",disabled:!d,title:["Easy","Medium","Hard"][y],"aria-label":`${["Easy","Medium","Hard"][y]} ${t?"on":"off"}`,onClick:()=>d&&O(o,y),style:{...Ie(x,t),cursor:d?"pointer":"default"},children:e.jsx(V,{count:y+1,size:18,color:j})},y)})}):e.jsx("div",{style:{width:I,flexShrink:0},"aria-hidden":!0})]})]},o)})}),e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)",display:"flex",justifyContent:"center",alignItems:"center",gap:"12px",flexWrap:"wrap"},children:[e.jsx("button",{type:"button","aria-label":u?"Turn timer off":"Turn timer on",onClick:w,style:Ce(u),children:e.jsx("span",{style:F(u)})}),e.jsx("i",{className:"fa-solid fa-clock",style:{fontSize:"1.15rem",lineHeight:1,color:a},"aria-hidden":!0}),e.jsx("span",{style:{fontWeight:900,fontSize:"0.72rem",letterSpacing:"0.12em",color:a},children:u?"TIMER ON":"TIMER OFF"})]}),z&&typeof m=="function"?e.jsxs("div",{style:{marginTop:"18px",paddingTop:"18px",borderTop:"1px solid rgba(26, 61, 91, 0.12)"},children:[e.jsx("div",{style:{fontSize:"0.78rem",fontWeight:900,letterSpacing:"0.14em",color:a,marginBottom:"10px"},children:"HOME SCREEN"}),e.jsx("button",{type:"button",onClick:()=>m(),style:{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:"10px",border:`2px solid ${a}`,background:"#fff",color:a,fontWeight:900,fontSize:"0.88rem",letterSpacing:"0.08em",cursor:"pointer",fontFamily:"inherit"},children:"ADD TO HOME SCREEN"})]}):null]})}const He="/puzzles-playground/assets/apple-touch-icon-D9KrrZvg.png";function Re({show:s,onClose:p}){return e.jsxs(K,{show:s,onClose:p,intent:Y.ADD_TO_HOME_SCREEN,contentClassName:"add-to-home-screen-shell",children:[e.jsx("div",{style:{display:"flex",justifyContent:"center",marginBottom:"18px"},children:e.jsx("img",{src:He,alt:"BA Puzzles home screen icon preview",width:120,height:120,style:{width:"120px",height:"120px",borderRadius:"26px",boxShadow:"0 2px 12px rgba(26, 61, 91, 0.15), 0 1px 4px rgba(15, 10, 8, 0.08)",display:"block"}})}),e.jsx("p",{style:{margin:"0 0 14px",fontSize:"0.95rem",fontWeight:800,lineHeight:1.45,color:a,textAlign:"center"},children:"To add an app icon to your home screen:"}),e.jsxs("ol",{style:{margin:0,paddingLeft:"1.35rem",fontSize:"0.92rem",lineHeight:1.55,color:ue},children:[e.jsxs("li",{style:{marginBottom:"12px"},children:["Find and click ",e.jsx("strong",{style:{color:a},children:"SHARE"})," in the Safari toolbar or menu."]}),e.jsxs("li",{style:{marginBottom:"12px"},children:["Find and click ",e.jsx("strong",{style:{color:a},children:"ADD TO HOME SCREEN"})," in the share menu. It may be tucked away in a"," ",e.jsx("strong",{style:{color:a},children:"VIEW MORE"})," menu."]}),e.jsxs("li",{children:["Click the ",e.jsx("strong",{style:{color:a},children:"ADD"})," button and you can play"," ",e.jsx("strong",{style:{color:a},children:"BA Puzzles"})," just like an app."]})]})]})}function Ae({dateKey:s}){const p="/puzzles-playground/",g=he(s),[c,m]=n.useState(null),r=n.useRef(null),b=n.useRef(null);n.useEffect(()=>()=>{r.current&&clearTimeout(r.current)},[]);const z=n.useCallback(()=>{r.current&&(clearTimeout(r.current),r.current=null),m(null)},[]),v=n.useCallback(async()=>{if(!g)return;const l=fe(s,p);if(l)try{await navigator.clipboard.writeText(l),r.current&&clearTimeout(r.current),m({fadeOut:!1}),r.current=setTimeout(()=>{m(h=>h?{...h,fadeOut:!0}:null),r.current=null},me)}catch{}},[g,s,p]);return e.jsxs("div",{ref:b,className:"game-nav-share-wrap hp-section-share",style:{position:"relative"},children:[e.jsx("button",{type:"button",className:"game-nav-share-btn",disabled:!g,onClick:v,"aria-label":g?"Share all results":"Share all results (no progress yet)",children:e.jsx("i",{className:"fa-solid fa-share-nodes","aria-hidden":"true"})}),c!=null&&e.jsx(xe,{short:!0,fadeOut:c.fadeOut,align:"end",onDismiss:z,onTransitionEnd:l=>{l.target!==l.currentTarget||l.propertyName!=="opacity"||m(h=>h?.fadeOut?null:h)}})]})}const P="/puzzles-playground/",De=365;function Me(s,p){return G(s)?de(s,p):!1}function _e({gameKey:s,completions:p,perfects:g,moveCounts:c,tierSlots:m,bonusUnlocked:r}){const b=ce(s),z=p??[!1,!1,!1],v=g??[!1,!1,!1],l=c??[null,null,null],h=m??[0,1,2],O=r?[...h,H]:h;return e.jsx("div",{style:{display:"flex",gap:"6px",marginTop:"8px"},children:O.map(u=>{const w=z[u],o=v[u],f=l[u]!=null?l[u]:null,T=w?b?o?e.jsx(Z,{}):f!=null?String(Math.min(f,99)):e.jsx($,{}):o?e.jsx(Z,{}):e.jsx($,{}):u===H?"!":e.jsx(V,{count:u+1,size:20});return e.jsx("div",{style:{width:"28px",height:"28px",borderRadius:"6px",background:w?"#6b9b3b":R,color:w?"#fff":a,fontWeight:900,fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s"},children:T},u)})})}const E=[{key:"sumtiles",href:`${P}puzzlegames/sumtiles/`,Icon:je,title:"Sum Tiles",desc:"Slide tiles so every row and column hits its sum."},{key:"productiles",href:`${P}puzzlegames/productiles/`,Icon:ve,title:"Productiles",desc:"Slide tiles so every row and column hits its product."},{key:"rolypoly",href:`${P}puzzlegames/rolypoly/`,Icon:ze,title:"Roly Poly",desc:"Swipe to roll every bug onto a yellow target."},{key:"dungbeetle",href:`${P}puzzlegames/dungbeetle/`,Icon:we,title:"Dung Beetle",desc:"Push tetrominoes and roll the ball into the hole."},{key:"scuttlebug",href:`${P}puzzlegames/scuttlebug/`,Icon:Te,title:"Scuttlebug",desc:"Push tetrominoes and scuttle the beetle into the hole."}];function Ke(){const[s,p]=n.useState(U),g=ge(s),[c,m]=n.useState(()=>C()),[r,b]=n.useState(!1),[z,v]=n.useState(!1),l=n.useCallback(()=>m(C()),[]),h=n.useMemo(()=>Object.fromEntries(E.map(t=>{const i=se(t.key,s);if(!N(t.key))return[t.key,i];const d=["1","2"].includes(_(`${t.key}:${s}:${H}`));return[t.key,[...i,d]]})),[s]),O=n.useMemo(()=>Object.fromEntries(E.map(t=>{const i=ne(t.key,s);if(!N(t.key))return[t.key,i];const d=_(`${t.key}:${s}:${H}`)==="2";return[t.key,[...i,d]]})),[s]),u=n.useMemo(()=>Object.fromEntries(E.map(t=>{const i=ie(t.key,s);return N(t.key)?[t.key,[...i,re(t.key,s)]]:[t.key,i]})),[s]),[w,o]=n.useState(0),f=n.useMemo(()=>Object.fromEntries(E.map(t=>[t.key,be(i=>Me(t.key,i),De)])),[w,c]),T=n.useMemo(()=>E.filter(t=>L(t.key,c)),[c]),x=n.useMemo(()=>E.filter(t=>!L(t.key,c)),[c]),k=n.useMemo(()=>E.map(({key:t,title:i,Icon:d})=>({key:t,title:i,Icon:d})),[]),[I,y]=n.useState(!1);return A.useEffect(()=>{const t=()=>{p(U()),o(S=>S+1)},i=()=>{document.visibilityState==="visible"&&t()},d=S=>{S.persisted&&t()};document.addEventListener("visibilitychange",i),window.addEventListener("pageshow",d);const j=S=>{t(),S.key===le&&l()};return window.addEventListener("storage",j),()=>{document.removeEventListener("visibilitychange",i),window.removeEventListener("pageshow",d),window.removeEventListener("storage",j)}},[l]),e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
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
            `}),e.jsxs("div",{className:"hp-shell",children:[e.jsx("div",{style:{flexShrink:0,width:"100%"},children:e.jsx(ye,{title:"PUZZLES",showHome:!1,showStats:!1,titleOpensLinks:!0,hubBaLinksMenu:!0,onSettings:()=>b(!0),onCube:()=>y(!0)})}),e.jsxs("main",{className:"hp-page",children:[e.jsxs("header",{className:"hp-intro",children:[e.jsx("p",{className:"hp-tagline",children:"Daily puzzles for the breakfast table, the car ride, or the classroom warm-up."}),e.jsx("div",{className:"hp-date",children:g})]}),e.jsx("div",{className:"hp-divider"}),e.jsxs("div",{className:"hp-section-heading",children:[e.jsx("div",{className:"hp-section-label",children:"MY PUZZLES"}),e.jsx(Ae,{dateKey:s})]}),e.jsx("section",{className:"hp-list",children:T.map(({key:t,href:i,Icon:d,title:j,desc:S})=>{const J=oe(t,c),Q=N(t)&&ae(t,s),ee=B(i,h[t],c,s);return e.jsxs("a",{className:"hp-card",href:ee,children:[e.jsx("div",{className:"hp-iconTile",children:e.jsx(d,{size:56})}),e.jsxs("div",{className:"hp-meta",children:[e.jsx("div",{className:"hp-cardTitle",children:j}),e.jsx("div",{className:"hp-desc",children:S}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"},children:[e.jsx(_e,{gameKey:t,completions:h[t],perfects:O[t],moveCounts:u[t],tierSlots:J,bonusUnlocked:Q}),f[t]>0&&e.jsxs("span",{style:{fontSize:"14px",color:"var(--muted)",lineHeight:1.35},children:["Streak: ",f[t]]})]})]})]},t)})}),x.length>0?e.jsxs("section",{className:"hp-tiles-section","aria-label":"Other puzzles",children:[e.jsx("div",{className:"hp-section-label",children:"OTHER PUZZLES"}),e.jsx("div",{className:"hp-tile-grid",children:x.map(({key:t,href:i,Icon:d,title:j})=>{const S=B(i,h[t],c,s);return e.jsxs("a",{className:"hp-tile",href:S,children:[e.jsx(d,{size:40}),e.jsx("span",{className:"hp-tile-title",children:j.toUpperCase()})]},t)})})]}):null]})]}),e.jsx(Ne,{show:r,onClose:()=>b(!1),games:k,onSaved:l,onOpenAddToHomeGuide:()=>{b(!1),v(!0)}}),e.jsx(Re,{show:z,onClose:()=>v(!1)}),e.jsx(Se,{show:I,onClose:()=>y(!1)})]})}export{Ke as default};
