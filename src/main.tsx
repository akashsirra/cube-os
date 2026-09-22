import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Vec = { x:number; y:number; z:number };
type Sticker = { color:number; pos:Vec; normal:Vec };

const FACE_COLORS = ['#f7f7f7','#ffd500','#e53935','#ff8c42','#31a85b','#2f80ed'];
const FACES = ['U','R','F','D','L','B'] as const;
type Face = typeof FACES[number];

const normals:Record<Face,Vec> = {
  U:{x:0,y:1,z:0}, D:{x:0,y:-1,z:0},
  R:{x:1,y:0,z:0}, L:{x:-1,y:0,z:0},
  F:{x:0,y:0,z:1}, B:{x:0,y:0,z:-1},
};

function facePosition(face:Face,row:number,col:number):Vec {
  const c=col-1, r=row-1;
  switch(face){
    case 'F': return {x:c,y:-r,z:1};
    case 'B': return {x:-c,y:-r,z:-1};
    case 'U': return {x:c,y:1,z:r};
    case 'D': return {x:c,y:-1,z:-r};
    case 'R': return {x:1,y:-r,z:-c};
    case 'L': return {x:-1,y:-r,z:c};
  }
}

function makeSolved():Sticker[]{
  return FACES.flatMap((face,color)=>Array.from({length:9},(_,i)=>({
    color,
    pos:facePosition(face,Math.floor(i/3),i%3),
    normal:{...normals[face]}
  })));
}

function rotate(v:Vec,axis:Vec):Vec {
  // clockwise when looking directly at the selected face from outside
  if(axis.x) return {x:v.x,y:axis.x*v.z,z:-axis.x*v.y};
  if(axis.y) return {x:-axis.y*v.z,y:v.y,z:axis.y*v.x};
  return {x:axis.z*v.y,y:-axis.z*v.x,z:v.z};
}

function moveCube(stickers:Sticker[], move:string):Sticker[] {
  const face=move[0] as Face;
  const axis=normals[face];
  const turns=move.endsWith("'") ? 3 : move.endsWith('2') ? 2 : 1;
  const out=stickers.map(s=>({color:s.color,pos:{...s.pos},normal:{...s.normal}}));
  for(let t=0;t<turns;t++){
    for(const s of out){
      const onLayer =
        (axis.x && s.pos.x===axis.x) ||
        (axis.y && s.pos.y===axis.y) ||
        (axis.z && s.pos.z===axis.z);
      if(onLayer){
        s.pos=rotate(s.pos,axis);
        s.normal=rotate(s.normal,axis);
      }
    }
  }
  return out;
}

function key(v:Vec){return v.x+','+v.y+','+v.z}
function getColor(stickers:Sticker[],face:Face,row:number,col:number){
  const p=facePosition(face,row,col), n=normals[face];
  const s=stickers.find(x=>key(x.pos)===key(p)&&key(x.normal)===key(n));
  return s ? FACE_COLORS[s.color] : '#777';
}

function App(){
  const [stickers,setStickers]=React.useState(makeSolved);
  const [history,setHistory]=React.useState<string[]>([]);
  const [scramble,setScramble]=React.useState<string[]>([]);
  const [seconds,setSeconds]=React.useState(0);
  const started=history.length>0;
  React.useEffect(()=>{if(!started)return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id)},[started]);

  const apply=(m:string)=>{
    setStickers(s=>moveCube(s,m));
    setHistory(h=>[...h,m]);
  };
  const reset=()=>{setStickers(makeSolved());setHistory([]);setScramble([]);setSeconds(0)};
  const doScramble=()=>{
    const pool=[...FACES];
    const seq:string[]=[]; let last='';
    for(let i=0;i<20;i++){
      let f=pool[Math.floor(Math.random()*pool.length)];
      while(f===last) f=pool[Math.floor(Math.random()*pool.length)];
      const suffix=Math.random()<.5?"": "'";
      seq.push(f+suffix); last=f;
    }
    let next=makeSolved();
    for(const m of seq) next=moveCube(next,m);
    setStickers(next);setScramble(seq);setHistory(seq);setSeconds(0);
  };
  const undo=()=>{
    const last=history.at(-1); if(!last)return;
    const inverse=last.endsWith("'")?last[0]:last[0]+"'";
    setStickers(s=>moveCube(s,inverse));
    setHistory(h=>h.slice(0,-1));
  };

  const gestureRef=React.useRef<{x:number;y:number;face:Face}|null>(null);
  const faceFromTarget=(target:EventTarget|null):Face|null=>{
    const el=target instanceof Element ? target.closest('.cube-face') : null;
    if(!el)return null;
    if(el.classList.contains('front'))return 'F';
    if(el.classList.contains('right'))return 'R';
    if(el.classList.contains('top'))return 'U';
    return null;
  };
  const onPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    const face=faceFromTarget(e.target); if(!face)return;
    gestureRef.current={x:e.clientX,y:e.clientY,face};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp=(e:React.PointerEvent<HTMLDivElement>)=>{
    const g=gestureRef.current; gestureRef.current=null;
    if(!g)return;
    const dx=e.clientX-g.x, dy=e.clientY-g.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
    const positive=Math.abs(dx)>=Math.abs(dy)?dx>0:dy>0;
    apply(g.face+(positive?'':"'"));
  };
  React.useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)return;
      const k=e.key.toUpperCase();
      if(FACES.includes(k as Face)) apply(e.shiftKey?k+"'":k);
      if(e.key==='z') undo();
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  });

  const renderFace=(face:Face)=> <div className="face-grid">{Array.from({length:9},(_,i)=><span key={i} style={{background:getColor(stickers,face,Math.floor(i/3),i%3)}} />)}</div>;

  return <main>
    <header>
      <div><span className="eyebrow">CUBE//OS · BUILD 01</span><h1>The cube is the interface.</h1><p>A real cube state now drives the visual. Every turn changes the stickers instead of faking the animation.</p></div>
      <div className="actions"><button onClick={doScramble}>🎲 Scramble</button><button onClick={undo} disabled={!history.length}>↩ Undo</button><button onClick={reset}>↻ Reset</button></div>
    </header>
    <section className="stage">
      <div className="cube3d" onPointerDown={onPointerDown} onPointerUp={onPointerUp} aria-label="Interactive Rubik's Cube">
        <div className="cube-face front">{renderFace('F')}</div>
        <div className="cube-face right">{renderFace('R')}</div>
        <div className="cube-face top">{renderFace('U')}</div>
      </div>
      <div className="hud"><div><b>{history.length}</b><small>MOVES</small></div><div><b>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</b><small>TIME</small></div></div>
    </section>
    <section className="controls">
      <div className="gesture-hint"><span>↔</span><div><b>Swipe a face to turn it</b><small>Swipe right/down = turn · left/up = reverse</small></div></div>
      <div className="history">{history.length?history.join('  '):'Solved state · swipe the cube to begin.'}</div>
      {scramble.length>0&&<div className="scramble">SCRAMBLE · {scramble.join(' ')}</div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
