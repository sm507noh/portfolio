function createFloatingCircleMask(overlay) {
  const root = document.documentElement;
  const radius = 42;
  const circleCount = 32;

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
    balls = Array.from({ length: circleCount }, makeBall);
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
  // Each activation uses a different soft, asymmetric cluster outline.
  let clusterPhase = Math.random() * Math.PI * 2;
  function compactSlot(n) {
    if (n === 0) return { x: 0, y: 0 };
    const angle = n * Math.PI * (3 - Math.sqrt(5)) + clusterPhase;
    const distance = radius * 0.68 * Math.sqrt(n);
    const outline = 1 + 0.2 * Math.sin(angle * 2 + time * 0.32)
      + 0.13 * Math.cos(angle * 3 - clusterPhase + time * 0.21);
    const x = Math.cos(angle) * distance * outline;
    const y = Math.sin(angle) * distance * outline;
    return {
      x: x + radius * 0.3 * Math.sin(y / (radius * 2) + time * 0.27),
      y: y + radius * 0.24 * Math.sin(x / (radius * 2) - time * 0.23),
    };
  }
  function frame(now){
   const dt=Math.min((now-last)/16.67,2);last=now;time+=.012*dt;
   mouse.vx=mouse.active?(mouse.x-mouse.px)*.38+mouse.vx*.62:mouse.vx*.75;
   mouse.vy=mouse.active?(mouse.y-mouse.py)*.38+mouse.vy*.62:mouse.vy*.75;
   mouse.px=mouse.x;mouse.py=mouse.y;
   const power=.78;
   const clusterRadius=balls.reduce((extent,ball)=>ball.captured?Math.max(extent,ball.slotRadius||0):extent,0);
   // Nearby circles can join the growing outer edge without crossing its center.
   const captureDistance=clusterRadius+radius+70;
   const reach=captureDistance+240;
   // Capture only the nearest eligible circle first; build the cluster outward.
   const candidates=mouse.active?balls.filter(b=>!b.captured).map(b=>({b,d:Math.hypot(mouse.x-b.x,mouse.y-b.y)})).filter(v=>v.d<reach).sort((a,b)=>a.d-b.d):[];
   const nearest=new Set(candidates.slice(0,3).map(candidate=>candidate.b));
   // Repack after a circle drops away, so abandoned slots never leave holes.
   const attached=balls.filter(b=>b.captured).sort((a,b)=>a.captureOrder-b.captureOrder);
   attached.forEach((b,i)=>{const slot=compactSlot(i);b.slotX=slot.x;b.slotY=slot.y;b.slotRadius=Math.hypot(slot.x,slot.y)});
   const captureBudget=3;
   let newCaptures=0;
   for(let i=0;i<balls.length;i++){
    const b=balls[i],dx=mouse.x-b.x,dy=mouse.y-b.y,dist=Math.hypot(dx,dy);
    // Stronger field at the cursor, weaker at the edge; outer circles approach before attaching.
    if(mouse.active&&!b.captured&&dist<reach){
     const near=1-dist/reach;
     const force=(1.2+power*1.4)*(.2+.8*near*near);
     b.vx+=(dx/(dist||1))*force*dt;
     b.vy+=(dy/(dist||1))*force*dt;
     // The closest circle is attached first, rather than random distant circles.
     if(nearest.has(b)&&newCaptures<captureBudget&&dist<captureDistance){
      b.captured=true;newCaptures++;
      // Append the next overlapping slot to the cluster.
      const n=attached.length+newCaptures-1;
      b.captureOrder=n;
      const slot=compactSlot(n);
      b.slotX=slot.x;b.slotY=slot.y;
      b.slotRadius=Math.hypot(slot.x,slot.y);
      // New arrivals can join an already solid silhouette; no visible hole required.
  
     }
    }
    if(b.captured){
     // Gentle independent movement softens the outline while circles overlap.
     const tx=mouse.x+b.slotX+Math.sin(time*.8+b.phase)*3;
     const ty=mouse.y+b.slotY+Math.cos(time*.8+b.phase)*3;
     const pull=.12+power*.14;
     b.vx+=(tx-b.x)*pull*dt;b.vy+=(ty-b.y)*pull*dt;
     b.vx*=Math.pow(.82,dt);b.vy*=Math.pow(.82,dt);
     b.x+=b.vx*dt;b.y+=b.vy*dt;
     const targetLag=Math.hypot(b.x-tx,b.y-ty);
     if(!mouse.active||targetLag>radius*5){
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
    const restitution=.35;
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
     const a=balls[i],b=balls[j];
     if(a.captured&&b.captured)continue;
     // Attraction takes priority over collisions throughout the cursor's field.
     if(mouse.active && (Math.hypot(a.x-mouse.x,a.y-mouse.y)<reach ||
       Math.hypot(b.x-mouse.x,b.y-mouse.y)<reach))continue;
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
    const holes = balls.map(ball =>
      '<circle cx="' + ball.x.toFixed(1) + '" cy="' + ball.y.toFixed(1) + '" r="' + radius + '" fill="black"/>'
    ).join('');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<defs><mask id="holes" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '" style="mask-type:luminance">' +
      '<rect width="100%" height="100%" fill="white"/>' + holes +
      '</mask></defs><rect width="100%" height="100%" fill="white" mask="url(#holes)"/></svg>';
    const maskImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    overlay.style.maskImage = maskImage;
    overlay.style.webkitMaskImage = maskImage;
    animationId = requestAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(resize);
  const pointerEvents = ['pointermove', 'pointerdown'];
  function releaseTouch(event) {
    if (event.pointerType !== 'mouse') releasePointer();
  }

  return {
    start() {
      clusterPhase = Math.random() * Math.PI * 2;
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
