import React from 'react';
import {createRoot} from 'react-dom/client';
import Cube3D, {Move} from './Cube3D';
import './styles.css';

const FACES=['U','R','F','D','L','B'] as const;

function App(){
 const [history,setHistory]=React.useState<Move[]>([]);
 const [seconds,setSeconds]=React.useState(0);
 const [busy,setBusy]=React.useState(false);
 const [command,setCommand]=React.useState<{id:number;move?:Move;reset?:boolean;sequence?:Move[]}>({id:0});
 const id=React.useRef(0);
 const started=history.length>0;
 React.useEffect(()=>{if(!started)return;const t=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(t)},[started]);

 const send=(move:Move)=>{id.current++;setCommand({id:id.current,move});setHistory(h=>[...h,move])};
 const reset=()=>{if(busy)return;id.current++;setCommand({id:id.current,reset:true});setHistory([]);setSeconds(0)};
 const scramble=()=>{
  if(busy)return;
  const seq:Move[]=[];let last='';
  for(let i=0;i<20;i++){
   let f=FACES[Math.floor(Math.random()*FACES.length)];
   while(f===last)f=FACES[Math.floor(Math.random()*FACES.length)];
   seq.push(f+(Math.random()<.5?'':"'"));last=f;
  }
  id.current++;setCommand({id:id.current,sequence:seq});setHistory(seq);setSeconds(0);
 };
 const undo=()=>{
  if(busy||!history.length)return;
  const last=history[history.length-1];
  const inverse=last.endsWith("'")?last[0]:last[0]+"'";
  id.current++;setCommand({id:id.current,move:inverse});setHistory(h=>h.slice(0,-1));
 };

 return <main>
  <header>
   <div>
    <span className="eyebrow">CUBE//OS · 3D ENGINE</span>
    <h1>The cube is the interface.</h1>
    <p>Physical cubies. Real layer rotations. Cinematic motion. Swipe a face to turn it; drag the empty space to orbit the cube.</p>
   </div>
   <div className="actions">
    <button onClick={scramble} disabled={busy}>🎲 Scramble</button>
    <button onClick={undo} disabled={busy||!history.length}>↩ Undo</button>
    <button onClick={reset} disabled={busy}>↻ Reset</button>
   </div>
  </header>

  <section className="stage">
   <Cube3D command={command} onMove={send} onBusyChange={setBusy}/>
   <div className="hud">
    <div><b>{history.length}</b><small>MOVES</small></div>
    <div><b>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</b><small>TIME</small></div>
    <div><b>{busy?'LIVE':'READY'}</b><small>ENGINE</small></div>
   </div>
   <div className="hint">Swipe a face · drag outside · watch the layer snap</div>
  </section>

  <section className="controls">
   <div className="move-strip"><span>MOVE STREAM</span><code>{history.length?history.join('  '):'— waiting for your first turn —'}</code></div>
  </section>
 </main>
}

createRoot(document.getElementById('root')!).render(<App/>);
