function createFloatingCircleMask(overlay) {
  const root = document.documentElement;
  const cutouts = overlay.querySelector('mask g');
  const radius = 121.6;
  const circles = Array.from({ length: 32 }, () => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', radius);
    return circle;
  });
  cutouts.replaceChildren(...circles);

  const mouse = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, active: false };
  let W = 0;
  let H = 0;
  let balls = [];
  let time = 0;
  let last = 0;
  let animationId = 0;

  function resize() {
    const { width, height } = overlay.getBoundingClientRect();
    if (width === W && height === H && balls.length) return;
    W = width;
    H = height;
    balls = circles.map(makeBall);
  }

  function updatePointer(event) {
    const bounds = overlay.getBoundingClientRect();
    mouse.x = event.clientX - bounds.left;
    mouse.y = event.clientY - bounds.top;
    if (!mouse.active) {
      mouse.px = mouse.x;
      mouse.py = mouse.y;
      mouse.vx = mouse.vy = 0;
    }
    mouse.active = true;
  }

  function releasePointer() {
    mouse.active = false;
  }

  function makeBall(){
   const edge=Math.floor(Math.random()*4),pad=8+Math.random()*85;
   let x=edge===0?pad:edge===1?W-pad:Math.random()*W;
   let y=edge===2?pad:edge===3?H-pad:Math.random()*H;
   const ang=Math.random()*Math.PI*2, speed=1.05+Math.random()*2.05;
   return {x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,
    driftAngle:ang,driftSpeed:speed,phase:Math.random()*Math.PI*2,
    captured:false};
  }
  // Overlapping hexagonal rings let every captured circle expand the cluster.
  function compactSlot(n){
   if(n===0)return {x:0,y:0};
   let remaining=n-1,ring=1;
   while(remaining>=6*ring){remaining-=6*ring;ring++}
   let q=ring,r=0;
   const dirs=[[-1,1],[-1,0],[0,-1],[1,-1],[1,0],[0,1]];
   let side=Math.floor(remaining/ring),step=remaining%ring;
   for(let i=0;i<side;i++){q+=dirs[i][0]*ring;r+=dirs[i][1]*ring}
   q+=dirs[side][0]*step;r+=dirs[side][1]*step;
   const spacing=radius*1.25; // Overlap keeps adjacent rings connected.
   return {x:spacing*(q+r/2),y:spacing*Math.sqrt(3)/2*r};
  }
  function frame(now){
   const dt=Math.min((now-last)/16.67,2);last=now;time+=.012*dt;
   mouse.vx=mouse.active?(mouse.x-mouse.px)*.38+mouse.vx*.62:mouse.vx*.75;
   mouse.vy=mouse.active?(mouse.y-mouse.py)*.38+mouse.vy*.62:mouse.vy*.75;
   mouse.px=mouse.x;mouse.py=mouse.y;
   const cursorSpeed=Math.hypot(mouse.vx,mouse.vy),power=.78;
   const clusterRadius=balls.reduce((extent,ball)=>ball.captured?Math.max(extent,ball.slotRadius||0):extent,0);
   // Nearby circles can join the growing outer edge without crossing its center.
   const captureDistance=clusterRadius+radius+70;
   const reach=captureDistance+240;
   // Capture only the nearest eligible circle first; build the cluster outward.
   const candidates=mouse.active?balls.filter(b=>!b.captured).map(b=>({b,d:Math.hypot(mouse.x-b.x,mouse.y-b.y)})).filter(v=>v.d<reach).sort((a,b)=>a.d-b.d):[];
   const nearest=candidates.length?candidates[0].b:null;
   // Repack after a circle drops away, so abandoned slots never leave holes.
   const attached=balls.filter(b=>b.captured).sort((a,b)=>a.captureOrder-b.captureOrder);
   attached.forEach((b,i)=>{const slot=compactSlot(i);b.slotX=slot.x;b.slotY=slot.y;b.slotRadius=Math.hypot(slot.x,slot.y)});
   const captureBudget=1;
   let newCaptures=0;
   for(let i=0;i<balls.length;i++){
    const b=balls[i],dx=mouse.x-b.x,dy=mouse.y-b.y,dist=Math.hypot(dx,dy);
    // Stronger field at the cursor, weaker at the edge; outer circles approach before attaching.
    if(mouse.active&&!b.captured&&dist<reach){
     const near=1-dist/reach;
     const force=(.3+power*.7)*near*near;
     b.vx+=(dx/(dist||1))*force*dt;
     b.vy+=(dy/(dist||1))*force*dt;
     // The closest circle is attached first, rather than random distant circles.
     if(b===nearest&&newCaptures<captureBudget&&dist<captureDistance){
      b.captured=true;newCaptures++;
      // Append the next overlapping slot to the cluster.
      const n=attached.length;
      b.captureOrder=n;
      const slot=compactSlot(n);
      b.slotX=slot.x;b.slotY=slot.y;
      b.slotRadius=Math.hypot(slot.x,slot.y);
      // New arrivals can join an already solid silhouette; no visible hole required.
  
     }
    }
    if(b.captured){
     // Tiny collective breathing, never enough to break the overlapping coverage.
     const tx=mouse.x+b.slotX+Math.sin(time*.8+b.phase)*.65;
     const ty=mouse.y+b.slotY+Math.cos(time*.8+b.phase)*.65;
     const pull=.075+power*.105;
     b.vx+=(tx-b.x)*pull*dt;b.vy+=(ty-b.y)*pull*dt;
     b.vx*=Math.pow(.82,dt);b.vy*=Math.pow(.82,dt);
     b.x+=b.vx*dt;b.y+=b.vy*dt;
     const lag=Math.hypot(b.x-mouse.x,b.y-mouse.y),tolerance=b.slotRadius+145+power*140;
     const strain=Math.max(0,lag-tolerance)/110+Math.max(0,cursorSpeed-(14+power*26))/75;
     if(!mouse.active||lag>tolerance+195||(strain>0&&Math.random()<strain*.035*dt)){
      b.captured=false;
      b.driftAngle=Math.atan2(b.vy,b.vx)+(Math.random()-.5)*.5;
      b.driftSpeed=1.05+Math.random()*2.05;
     }
    }else{
     // Independent drifting with slow heading changes, rather than fixed-position oscillation.
     b.driftAngle+=Math.sin(time*.8+b.phase)*.0035*dt;
     let targetVx=Math.cos(b.driftAngle)*b.driftSpeed;
     let targetVy=Math.sin(b.driftAngle)*b.driftSpeed;
     // Soft boundary steering keeps the middle open more often, as in the reference.
     const margin=Math.min(85,Math.min(W,H)*.18);
     if(b.x<margin)targetVx+=.28;if(b.x>W-margin)targetVx-=.28;
     if(b.y<margin)targetVy+=.28;if(b.y>H-margin)targetVy-=.28;
     b.vx+=(targetVx-b.vx)*.032*dt;b.vy+=(targetVy-b.vy)*.032*dt;
     b.x+=b.vx*dt;b.y+=b.vy*dt;
     if(b.x<-radius){b.x=-radius;b.vx=Math.abs(b.vx);b.driftAngle=Math.atan2(b.vy,b.vx)}
     if(b.x>W+radius){b.x=W+radius;b.vx=-Math.abs(b.vx);b.driftAngle=Math.atan2(b.vy,b.vx)}
     if(b.y<-radius){b.y=-radius;b.vy=Math.abs(b.vy);b.driftAngle=Math.atan2(b.vy,b.vx)}
     if(b.y>H+radius){b.y=H+radius;b.vy=-Math.abs(b.vy);b.driftAngle=Math.atan2(b.vy,b.vx)}
    }
    }
   // Weak mutual magnetic attraction between FREE circles only. Short range and
   // extremely small force so collision/bounce and independent drift dominate.
   const mutual=.35;
   if(mutual>0){
    const range=175, strength=.024*mutual;
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
     const a=balls[i],b=balls[j];
     if(a.captured||b.captured)continue;
     const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
     if(d<=radius*2||d>=range)continue;
     const proximity=(range-d)/(range-radius*2);
     const f=strength*proximity*proximity*dt;
     const fx=dx/d*f,fy=dy/d*f;
     a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;
    }
   }
   // Physical circles: equal masses, elastic impulse, and overlap correction.
    // Captured circles may overlap each other to preserve the continuous image mask.
    const restitution=.88;
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
     const a=balls[i],b=balls[j];
     if(a.captured&&b.captured)continue;
     // A circle being pulled toward the cursor should not be bounced away by the cluster.
     if(mouse.active && ((a.captured&&!b.captured&&Math.hypot(b.x-mouse.x,b.y-mouse.y)<reach)||(b.captured&&!a.captured&&Math.hypot(a.x-mouse.x,a.y-mouse.y)<reach)))continue;
     let dx=b.x-a.x,dy=b.y-a.y,dist2=dx*dx+dy*dy;
     const minDist=radius*2;
     if(dist2>=minDist*minDist)continue;
     let dist=Math.sqrt(dist2),nx,ny;
     if(dist<.0001){const angle=(i*2.399+j*.71);nx=Math.cos(angle);ny=Math.sin(angle);dist=.0001}
     else{nx=dx/dist;ny=dy/dist}
     const overlap=minDist-dist;
     // A magnet-captured circle behaves as a heavier body; a free circle is deflected.
     const invA=a.captured?0:1,invB=b.captured?0:1,sum=invA+invB;
     a.x-=nx*overlap*invA/sum;b.x+=nx*overlap*invB/sum;
     a.y-=ny*overlap*invA/sum;b.y+=ny*overlap*invB/sum;
     const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
     if(relative<0){const impulse=-(1+restitution)*relative/sum;
      a.vx-=impulse*invA*nx;a.vy-=impulse*invA*ny;
      b.vx+=impulse*invB*nx;b.vy+=impulse*invB*ny;
      // Reorient drift so free circles continue in their new bounce direction.
      if(!a.captured){a.driftAngle=Math.atan2(a.vy,a.vx);a.driftSpeed=Math.max(1.05,Math.min(3.1,Math.hypot(a.vx,a.vy)))}
      if(!b.captured){b.driftAngle=Math.atan2(b.vy,b.vx);b.driftSpeed=Math.max(1.05,Math.min(3.1,Math.hypot(b.vx,b.vy)))}
     }
    }
    balls.forEach((ball, index) => {
      circles[index].setAttribute('cx', ball.x);
      circles[index].setAttribute('cy', ball.y);
    });
    animationId = requestAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(resize);
  const pointerEvents = ['pointermove', 'pointerdown'];
  function releaseTouch(event) {
    if (event.pointerType !== 'mouse') releasePointer();
  }

  return {
    start() {
      root.classList.add('mask-active');
      resize();
      resizeObserver.observe(overlay);
      pointerEvents.forEach(type => window.addEventListener(type, updatePointer));
      root.addEventListener('pointerleave', releasePointer);
      window.addEventListener('pointercancel', releasePointer);
      window.addEventListener('pointerup', releaseTouch);
      window.addEventListener('blur', releasePointer);
      last = performance.now();
      animationId = requestAnimationFrame(frame);
    },
    stop() {
      root.classList.remove('mask-active');
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      pointerEvents.forEach(type => window.removeEventListener(type, updatePointer));
      root.removeEventListener('pointerleave', releasePointer);
      window.removeEventListener('pointercancel', releasePointer);
      window.removeEventListener('pointerup', releaseTouch);
      window.removeEventListener('blur', releasePointer);
      releasePointer();
      balls = [];
      time = 0;
    },
  };
}
