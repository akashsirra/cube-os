import React from 'react';
import * as THREE from 'three';

export type Move = string;
type Coord={x:number;y:number;z:number};

const COLORS=[0xf7f7f7,0xffd500,0xe53935,0xff8c42,0x31a85b,0x2f80ed];
const NORMALS:Record<string,Coord>={U:{x:0,y:1,z:0},D:{x:0,y:-1,z:0},R:{x:1,y:0,z:0},L:{x:-1,y:0,z:0},F:{x:0,y:0,z:1},B:{x:0,y:0,z:-1}};
const rotateCoord=(p:Coord,a:Coord):Coord=>{
 if(a.x)return{x:p.x,y:a.x*p.z,z:-a.x*p.y};
 if(a.y)return{x:-a.y*p.z,y:p.y,z:a.y*p.x};
 return{x:a.z*p.y,y:-a.z*p.x,z:p.z};
};
const moveInfo=(move:Move)=>{
 const face=move[0],axis=NORMALS[face];
 const base=axis.y?Math.PI/2:-Math.PI/2;
 return{face,axis,angle:(move.endsWith("'")?-base:base)};
};
const faceFromNormal=(n:THREE.Vector3)=>{
 const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
 if(ax>=ay&&ax>=az)return n.x>0?'R':'L';
 if(ay>=ax&&ay>=az)return n.y>0?'U':'D';
 return n.z>0?'F':'B';
};

type Props={
 command:{id:number;move?:Move;reset?:boolean;sequence?:Move[]}|null;
 onMove:(move:Move)=>void;
 onBusyChange?:(busy:boolean)=>void;
};

export default function Cube3D({command,onMove,onBusyChange}:Props){
 const mount=React.useRef<HTMLDivElement>(null);
 const engineRef=React.useRef<any>(null);
 const moveRef=React.useRef(onMove);const busyRef=React.useRef(onBusyChange);
 React.useEffect(()=>{moveRef.current=onMove},[onMove]);
 React.useEffect(()=>{busyRef.current=onBusyChange},[onBusyChange]);

 React.useEffect(()=>{
  const el=mount.current;if(!el)return;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(30,1,.1,100);
  camera.position.set(5.5,4.8,7.3);camera.lookAt(0,0,0);

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(el.clientWidth,el.clientHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff,0x11131a,2.2));
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(4,7,6);scene.add(key);
  const rim=new THREE.PointLight(0x7285ff,12,12);rim.position.set(-4,1,-3);scene.add(rim);

  const root=new THREE.Group();
  root.rotation.set(-.24,-.58,.03);
  scene.add(root);

  const cubies:THREE.Mesh[]=[];
  const geometry=new THREE.BoxGeometry(.92,.92,.92);

  const makeCubie=(x:number,y:number,z:number)=>{
   const mats=[
    new THREE.MeshStandardMaterial({color:x===1?COLORS[1]:0x08090c,roughness:.25,metalness:.08}),
    new THREE.MeshStandardMaterial({color:x===-1?COLORS[4]:0x08090c,roughness:.25,metalness:.08}),
    new THREE.MeshStandardMaterial({color:y===1?COLORS[0]:0x08090c,roughness:.25,metalness:.08}),
    new THREE.MeshStandardMaterial({color:y===-1?COLORS[3]:0x08090c,roughness:.25,metalness:.08}),
    new THREE.MeshStandardMaterial({color:z===1?COLORS[2]:0x08090c,roughness:.25,metalness:.08}),
    new THREE.MeshStandardMaterial({color:z===-1?COLORS[5]:0x08090c,roughness:.25,metalness:.08})
   ];
   const mesh=new THREE.Mesh(geometry,mats);
   mesh.position.set(x,y,z);mesh.userData.coord={x,y,z};mesh.userData.cubie=true;
   root.add(mesh);cubies.push(mesh);
  };
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)makeCubie(x,y,z);

  const glow=new THREE.Mesh(
   new THREE.TorusGeometry(1.74,.028,8,64),
   new THREE.MeshBasicMaterial({color:0x91a5ff,transparent:true,opacity:0})
  );
  root.add(glow);

  let busy=false,queue:Move[]=[];
  let destroyed=false;

  const setBusy=(v:boolean)=>{busy=v;busyRef.current?.(v)};

  const reset=()=>{
   queue=[];
   root.rotation.set(-.24,-.58,.03);
   for(const c of cubies){
    const p=c.userData.coord as Coord;
    c.position.set(p.x,p.y,p.z);
    root.add(c);
   }
  };

  const animateMove=(move:Move)=>{
   if(destroyed)return;
   const {axis,angle}=moveInfo(move);
   const selected=cubies.filter(c=>{
    const p=c.userData.coord as Coord;
    return (axis.x&&p.x===axis.x)||(axis.y&&p.y===axis.y)||(axis.z&&p.z===axis.z);
   });
   if(!selected.length)return;

   setBusy(true);
   const pivot=new THREE.Group();root.add(pivot);
   selected.forEach(c=>pivot.attach(c));

   const axisV=new THREE.Vector3(axis.x,axis.y,axis.z);
   const start=performance.now(),duration=320;

   const tick=(now:number)=>{
    if(destroyed)return;
    const t=Math.min(1,(now-start)/duration);
    const e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    pivot.setRotationFromAxisAngle(axisV,angle*e);
    glow.material.opacity=.28*Math.sin(Math.PI*t);

    if(t<1){requestAnimationFrame(tick);return}

    selected.forEach(c=>{
     const p=c.userData.coord as Coord;
     const np=rotateCoord(p,axis);
     c.userData.coord=np;
     root.attach(c);
     c.position.set(np.x,np.y,np.z);
    });

    root.remove(pivot);
    glow.material.opacity=0;
    root.scale.set(1.035,1.035,1.035);
    setTimeout(()=>root.scale.set(1,1,1),70);

    setBusy(false);
    const next=queue.shift();
    if(next)animateMove(next);
   };
   requestAnimationFrame(tick);
  };

  const enqueue=(moves:Move[])=>{
   queue.push(...moves);
   if(!busy){const next=queue.shift();if(next)animateMove(next)}
  };

  type GestureStart={x:number;y:number;face?:string};
  let down:GestureStart|null=null;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

  const hitAt=(e:PointerEvent)=>{
   const r=renderer.domElement.getBoundingClientRect();
   pointer.x=((e.clientX-r.left)/r.width)*2-1;
   pointer.y=-((e.clientY-r.top)/r.height)*2+1;
   raycaster.setFromCamera(pointer,camera);
   return raycaster.intersectObjects(cubies,false)[0];
  };

  const projectDirection=(dir:THREE.Vector3)=>{
   const origin=new THREE.Vector3(0,0,0);
   const a=origin.clone().project(camera);
   const b=dir.clone().project(camera);
   return new THREE.Vector2(b.x-a.x,b.y-a.y).normalize();
  };

  // These are the "screen right" and "screen up" directions of each
  // face in cube-local coordinates. We project them through the actual
  // camera/root orientation, so a swipe follows what the user sees.
  const FACE_BASIS:Record<string,{right:Coord;up:Coord}>={
   F:{right:{x:1,y:0,z:0},up:{x:0,y:1,z:0}},
   B:{right:{x:-1,y:0,z:0},up:{x:0,y:1,z:0}},
   R:{right:{x:0,y:0,z:-1},up:{x:0,y:1,z:0}},
   L:{right:{x:0,y:0,z:1},up:{x:0,y:1,z:0}},
   U:{right:{x:1,y:0,z:0},up:{x:0,y:0,z:-1}},
   D:{right:{x:1,y:0,z:0},up:{x:0,y:0,z:1}}
  };

  const screenBasis=(face:string)=>{
   const b=FACE_BASIS[face];
   if(!b)return null;
   const right=projectDirection(new THREE.Vector3(b.right.x,b.right.y,b.right.z).applyQuaternion(root.quaternion));
   const up=projectDirection(new THREE.Vector3(b.up.x,b.up.y,b.up.z).applyQuaternion(root.quaternion));
   return {right,up};
  };

  const pointerDown=(e:PointerEvent)=>{
   if(busy)return;
   const hit=hitAt(e);
   let face:string|undefined;
   if(hit?.face){
    // Raycaster gives the hit in world space; transform the face normal
    // with the cubie's world matrix before deciding which layer was touched.
    const normal=hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    face=faceFromNormal(normal);
   }
   down={x:e.clientX,y:e.clientY,face};
   renderer.domElement.setPointerCapture(e.pointerId);
  };

  const pointerMove=(e:PointerEvent)=>{
   if(!down||busy||down.face)return;
   const dx=e.clientX-down.x,dy=e.clientY-down.y;
   root.rotation.y+=dx*.0009;
   root.rotation.x+=dy*.0009;
   down.x=e.clientX;down.y=e.clientY;
  };

  const pointerUp=(e:PointerEvent)=>{
   if(!down||busy)return;
   const d=down;down=null;
   if(!d.face)return;

   const dx=e.clientX-d.x,dy=e.clientY-d.y;
   if(Math.hypot(dx,dy)<18)return;

   const basis=screenBasis(d.face);
   if(!basis)return;

   // Screen Y is positive downward, while our projected basis uses
   // mathematical Y. Flip the gesture Y before comparing directions.
   const swipe=new THREE.Vector2(dx,-dy).normalize();
   const horizontal=Math.abs(swipe.dot(basis.right));
   const vertical=Math.abs(swipe.dot(basis.up));

   // IMPORTANT: the sign is intentionally tied to the visual face
   // orientation, not to a generic clockwise test. This means:
   // swipe right => visually clockwise face turn,
   // swipe left  => its inverse,
   // swipe up/down => the corresponding quarter turn.
   const clockwise=horizontal>=vertical
    ?swipe.dot(basis.right)>0
    :swipe.dot(basis.up)<0;

   moveRef.current?.(d.face+(clockwise?'':"'"));
  };

  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointermove',pointerMove);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  renderer.domElement.addEventListener('pointercancel',()=>{down=null});

  const resize=()=>{
   const w=el.clientWidth,h=Math.max(1,el.clientHeight);
   camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
  };
  const ro=new ResizeObserver(resize);ro.observe(el);resize();

  const clock=new THREE.Clock();
  renderer.setAnimationLoop(()=>{
   const t=clock.getElapsedTime();
   if(!busy){
    root.position.y=Math.sin(t*1.5)*.035;
    root.rotation.z=.03+Math.sin(t*.7)*.012;
   }
   renderer.render(scene,camera);
  });

  (engineRef as any).current={enqueue,reset};
  return()=>{
   destroyed=true;renderer.setAnimationLoop(null);ro.disconnect();
   renderer.domElement.removeEventListener('pointerdown',pointerDown);
   renderer.domElement.removeEventListener('pointermove',pointerMove);
   renderer.domElement.removeEventListener('pointerup',pointerUp);
   renderer.dispose();geometry.dispose();
   cubies.forEach(c=>(c.material as THREE.Material[]).forEach(m=>m.dispose()));
   el.removeChild(renderer.domElement);
  };
 },[]);

 React.useEffect(()=>{
  const e=engineRef.current;if(!e||!command)return;
  if(command.reset){e.reset();return}
  if(command.sequence){e.reset();e.enqueue(command.sequence);return}
  if(command.move)e.enqueue([command.move]);
 },[command]);

 return <div ref={mount} className="three-cube" aria-label="Interactive 3D Rubik's Cube"/>;
}
