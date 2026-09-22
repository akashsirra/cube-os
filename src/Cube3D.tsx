import React from 'react';
import * as THREE from 'three';

export type Move = string;
type Coord = {x:number;y:number;z:number};

const COLORS=[0xf7f7f7,0xffd500,0xe53935,0xff8c42,0x31a85b,0x2f80ed];
const FACE_NORMALS:Record<string,Coord>={
 U:{x:0,y:1,z:0},D:{x:0,y:-1,z:0},R:{x:1,y:0,z:0},L:{x:-1,y:0,z:0},F:{x:0,y:0,z:1},B:{x:0,y:0,z:-1}
};
const faceFromNormal=(n:THREE.Vector3)=>{
 const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
 if(ax>=ay&&ax>=az)return n.x>0?'R':'L';
 if(ay>=ax&&ay>=az)return n.y>0?'U':'D';
 return n.z>0?'F':'B';
};
const rotateCoord=(p:Coord,axis:Coord):Coord=>{
 if(axis.x)return {x:p.x,y:axis.x*p.z,z:-axis.x*p.y};
 if(axis.y)return {x:-axis.y*p.z,y:p.y,z:axis.y*p.x};
 return {x:axis.z*p.y,y:-axis.z*p.x,z:p.z};
};
const moveInfo=(move:Move)=>{
 const face=move[0], axis=FACE_NORMALS[face];
 return {face,axis,angle:(move.endsWith("'")?1:-1)*Math.PI/2};
};

type Props={
 command:{id:number;move?:Move;reset?:boolean;sequence?:Move[]}|null;
 onMove:(move:Move)=>void;
 onBusyChange?:(busy:boolean)=>void;
};

export default function Cube3D({command,onMove,onBusyChange}:Props){
 const mount=React.useRef<HTMLDivElement>(null);
 const engine=React.useRef<{
  scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;root:THREE.Group;
  cubies:THREE.Mesh[];busy:boolean;queue:Move[];down:{x:number;y:number;face?:string}|null;lastCommand:number;
  animateMove:(move:Move)=>void;reset:()=>void
 }|null>(null);

 React.useEffect(()=>{
  const el=mount.current;if(!el)return;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(30,1,.1,100);
  camera.position.set(5.4,4.7,7.2);camera.lookAt(0,0,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setSize(el.clientWidth,el.clientHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff,0x10131a,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,7,6);scene.add(key);
  const rim=new THREE.PointLight(0x6c7cff,9,12);rim.position.set(-4,1,-3);scene.add(rim);

  const root=new THREE.Group();root.rotation.set(-.24,-.58,.03);scene.add(root);
  const cubies:THREE.Mesh[]=[];
  const geo=new THREE.BoxGeometry(.92,.92,.92);
  const dark=new THREE.MeshStandardMaterial({color:0x08090c,roughness:.32,metalness:.12});

  const makeCubie=(x:number,y:number,z:number)=>{
   const mats=[
    new THREE.MeshStandardMaterial({color:x===1?COLORS[1]:0x08090c,roughness:.28,metalness:.05}),
    new THREE.MeshStandardMaterial({color:x===-1?COLORS[4]:0x08090c,roughness:.28,metalness:.05}),
    new THREE.MeshStandardMaterial({color:y===1?COLORS[0]:0x08090c,roughness:.28,metalness:.05}),
    new THREE.MeshStandardMaterial({color:y===-1?COLORS[3]:0x08090c,roughness:.28,metalness:.05}),
    new THREE.MeshStandardMaterial({color:z===1?COLORS[2]:0x08090c,roughness:.28,metalness:.05}),
    new THREE.MeshStandardMaterial({color:z===-1?COLORS[5]:0x08090c,roughness:.28,metalness:.05})
   ];
   const m=new THREE.Mesh(geo,mats);m.position.set(x,y,z);m.userData.coord={x,y,z};m.userData.cubie=true;
   root.add(m);cubies.push(m);
  };
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)makeCubie(x,y,z);

  const glowGeo=new THREE.TorusGeometry(1.72,.025,8,64);
  const glowMat=new THREE.MeshBasicMaterial({color:0x8aa2ff,transparent:true,opacity:0});
  const glow=new THREE.Mesh(glowGeo,glowMat);root.add(glow);

  let destroyed=false;
  const resize=()=>{if(!el||destroyed)return;const w=el.clientWidth,h=el.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
  const ro=new ResizeObserver(resize);ro.observe(el);resize();

  const ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

  const reset=()=>{
   for(const c of cubies){const p=c.userData.coord as Coord;c.position.set(p.x,p.y,p.z);c.rotation.set(0,0,0);root.add(c)}
   root.rotation.set(-.24,-.58,.03);
  };

  const animateMove=(move:Move)=>{
   if(destroyed)return;
   const {axis,angle}=moveInfo(move);
   const selected=cubies.filter(c=>{const p=c.userData.coord as Coord;return (axis.x&&p.x===axis.x)||(axis.y&&p.y===axis.y)||(axis.z&&p.z===axis.z)});
   if(!selected.length)return;
   engine.current!.busy=true;onBusyChange?.(true);
   const pivot=new THREE.Group();root.add(pivot);
   for(const c of selected)pivot.attach(c);
   glow.rotation.set(0,0,0);glow.material.opacity=.55;glow.scale.set(1.02,1.02,1.02);
   const start=performance.now(),duration=300;
   const tick=(now:number)=>{
    if(destroyed)return;
    const t=Math.min(1,(now-start)/duration);
    pivot.rotation.set(0,0,0); 
    const a=angle*ease(t);
    pivot.rotateOnAxis(new THREE.Vector3(axis.x,axis.y,axis.z),a);
    glow.material.opacity=.55*(1-t);
    if(t<1){requestAnimationFrame(tick);return}
    for(const c of selected){
      const p=c.userData.coord as Coord;
      const np=rotateCoord(p,axis);
      c.userData.coord=np;c.position.set(np.x,np.y,np.z);
      root.attach(c);
      c.position.set(np.x,np.y,np.z);
    }
    root.remove(pivot);glow.material.opacity=0;
    engine.current!.busy=false;onBusyChange?.(false);
    onMove(move);
    const next=engine.current!.queue.shift();if(next)animateMove(next);
   };
   requestAnimationFrame(tick);
  };

  const enqueue=(moves:Move[])=>{
   if(!moves.length)return;
   engine.current!.queue.push(...moves);
   if(!engine.current!.busy){const next=engine.current!.queue.shift();if(next)animateMove(next)}
  };

  engine.current={scene,camera,renderer,root,cubies,busy:false,queue:[],down:null,lastCommand:0,animateMove,reset};

  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const point=(e:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(cubies,false)};
  const down=(e:PointerEvent)=>{if(engine.current?.busy)return;const hit=point(e)[0];const face=hit?.face?.normal?faceFromNormal(hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))):undefined;engine.current!.down={x:e.clientX,y:e.clientY,face};renderer.domElement.setPointerCapture(e.pointerId)};
  const up=(e:PointerEvent)=>{const d=engine.current?.down;if(!d||engine.current?.busy)return;engine.current!.down=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;if(!d.face)return;const horizontal=Math.abs(dx)>=Math.abs(dy);const positive=horizontal?dx>0:dy>0;onMove(d.face+(positive?'':"'"));};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
  renderer.domElement.addEventListener('pointercancel',()=>{if(engine.current)engine.current.down=null});

  const clock=new THREE.Clock();
  renderer.setAnimationLoop(()=>{
   const t=clock.getElapsedTime();
   if(!engine.current?.busy){root.position.y=Math.sin(t*1.5)*.035;root.rotation.z=Math.sin(t*.7)*.012}
   renderer.render(scene,camera);
  });
  return()=>{destroyed=true;renderer.setAnimationLoop(null);ro.disconnect();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.dispose();geo.dispose();for(const c of cubies)(c.material as THREE.Material[]).forEach(m=>m.dispose());el.removeChild(renderer.domElement)};
 },[onBusyChange,onMove]);

 React.useEffect(()=>{
  const e=engine.current;if(!e||!command||command.id===e.lastCommand)return;e.lastCommand=command.id;
  if(command.reset){e.queue=[];e.reset();return}
  if(command.sequence){e.queue=[];e.reset();e.queue.push(...command.sequence);if(!e.busy){const n=e.queue.shift();if(n)e.animateMove(n)};return}
  if(command.move){e.queue.push(command.move);if(!e.busy){const n=e.queue.shift();if(n)e.animateMove(n)}}
 },[command]);

 return <div ref={mount} className="three-cube" aria-label="Interactive 3D Rubik's Cube"/>;
}
