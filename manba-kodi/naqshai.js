/* =============================================================================
   NaqshAI — O'zbek milliy naqshlari studiyasi
   Elektron hisoblash mashinalari (EHM) uchun yaratilgan dastur
   -----------------------------------------------------------------------------
   Dasturlash tili : JavaScript (ECMAScript, ECMA-262 / ISO/IEC 16262 standarti)
   Muallif         : EGAMNAZAROVA SEVARAXON XASANBOY QIZI
   Talabnoma       : DT 202610311/2
   Fayl            : naqshai.js
   Hajmi           : 9 008 qator (ushbu sarlavha bilan birga)
   -----------------------------------------------------------------------------
   IZOH. Ushbu matn — dasturning BOSHLANG'ICH MATNI (source code).
   U hech qanday kompilyator yoki obfuskator tomonidan qayta ishlanmagan:
   o'zgaruvchi va funksiya nomlari to'liq, izohlar (kommentariyalar) saqlangan,
   qator tuzilishi asl holida.

   Ushbu faylga FAQAT muallifning shaxsiy kodi kiritilgan. Dastur tarkibidagi
   uchinchi tomon kutubxonalari — Three.js r128 (MIT litsenziyasi) va
   Supabase JS v2 (MIT litsenziyasi) — muallifning ijodiy mehnati natijasi
   emas, shuning uchun bu yerga KIRITILMAGAN.
   ============================================================================= */

'use strict';
/* ============================================================
   NaqshAI — O'zbek milliy naqshlari studiyasi
   Yagona fayl: naqsh yadrosi, 3D, AR, Chat, Eksport
   ============================================================ */

const TAU = Math.PI * 2;

/* ---------- Global holat ---------- */
const P = {
  type:'girih', sym:8, cmp:4, sw:2.2, ir:0.38,
  spir:0.34, dens:0.55, lay:2, skew:0, rot:0,
  pal:'gold', fill:'dual',
  dvar:0, weave:true,      /* PIC: kontakt burchagi varianti va to'qish */
  _bg:'#f7f1e3'
};
let TESS = { on:false, group:'p4', cell:150, showCell:false, bleed:true, noring:true };
let NORING = 0; /* >0 bo'lsa: markazdagi shu radiusdan katta doiralar (ramkalar) chizilmaydi */
const T3D = { tess:false, group:'p4' };

/* ---------- Palitralar (6 ta, har biri 5 rang) ---------- */
const PAL = {
  gold:      {nm:"Oltin",       bg:'#f7f1e3', c:['#b8912f','#1d3a63','#6e5312','#3f6a95','#efe2bc']},
  turquoise: {nm:"Feruza",      bg:'#f0f7f6', c:['#0f8b8b','#b8912f','#0a5a60','#6cc0b6','#e2f2ee']},
  emerald:   {nm:"Zumrad",      bg:'#eff5ec', c:['#1e7a4c','#b8912f','#0d4227','#5cb886','#d7ecdd']},
  ruby:      {nm:"Yoqut",       bg:'#f9f0ec', c:['#9c2331','#b8912f','#57101a','#cf6572','#f2d9d6']},
  navy:      {nm:"To'q ko'k",   bg:'#eef1f6', c:['#173263','#b8912f','#0c1e40','#5f7cb4','#e6e0cb']},
  earth:     {nm:"Tuproq",      bg:'#f6f0e6', c:['#7a5230','#5f6b4a','#452e14','#b08050','#e6d3af']}
};

/* ---------- Rang helperlari ---------- */
function hex2rgb(h){
  h = (h||'#000').replace('#','');
  if(h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
}
function lerpColor(c1,c2,t){
  const a=hex2rgb(c1), b=hex2rgb(c2);
  const m=i=>Math.round(a[i]+(b[i]-a[i])*t);
  return 'rgb('+m(0)+','+m(1)+','+m(2)+')';
}
/* Qoraytirish — lenta konturlari uchun */
function shade(c,t){ return lerpColor(c,'#201a0c',t); }

/* ---------- Geometriya helperlari ---------- */
function pol(a,r){ return [Math.cos(a)*r, Math.sin(a)*r]; }
function rayX(p,a,q,b){
  const dx=Math.cos(a), dy=Math.sin(a), ex=Math.cos(b), ey=Math.sin(b);
  const den = dx*ey - dy*ex;
  if(Math.abs(den) < 1e-9) return null;
  const t = ((q[0]-p[0])*ey - (q[1]-p[1])*ex) / den;
  return [p[0]+dx*t, p[1]+dy*t];
}
/* Ikki kesma kesishmasi */
function segX(A,B,C,D){
  const d1x=B[0]-A[0], d1y=B[1]-A[1], d2x=D[0]-C[0], d2y=D[1]-C[1];
  const den = d1x*d2y - d1y*d2x;
  if(Math.abs(den)<1e-9) return null;
  const t = ((C[0]-A[0])*d2y - (C[1]-A[1])*d2x)/den;
  return [A[0]+d1x*t, A[1]+d1y*t];
}
/* Doira — 4 kubik Bezier bilan */
function circle(ctx,x,y,r){
  if(NORING && x===0 && y===0 && r >= NORING) return; /* tessellatsiyada doira ramka olib tashlanadi */
  const k = 0.5522847498*r;
  ctx.moveTo(x+r,y);
  ctx.bezierCurveTo(x+r,y+k, x+k,y+r, x,y+r);
  ctx.bezierCurveTo(x-k,y+r, x-r,y+k, x-r,y);
  ctx.bezierCurveTo(x-r,y-k, x-k,y-r, x,y-r);
  ctx.bezierCurveTo(x+k,y-r, x+r,y-k, x+r,y);
  ctx.closePath();
}
/* Yoy — Bezier segmentlar bilan (4/3·tan(Δ/4) formulasi) */
function arcB(ctx,cx,cy,r,a0,a1,noMove){
  let da = a1-a0;
  const segs = Math.max(1, Math.ceil(Math.abs(da)/(Math.PI/2)));
  const step = da/segs;
  const s0 = [cx+Math.cos(a0)*r, cy+Math.sin(a0)*r];
  if(!noMove) ctx.moveTo(s0[0],s0[1]);
  for(let i=0;i<segs;i++){
    const t0=a0+step*i, t1=t0+step;
    const k = 4/3*Math.tan((t1-t0)/4)*r;
    ctx.bezierCurveTo(
      cx+Math.cos(t0)*r - Math.sin(t0)*k, cy+Math.sin(t0)*r + Math.cos(t0)*k,
      cx+Math.cos(t1)*r + Math.sin(t1)*k, cy+Math.sin(t1)*r - Math.cos(t1)*k,
      cx+Math.cos(t1)*r, cy+Math.sin(t1)*r);
  }
}
function ellipsePath(ctx,x,y,rx,ry,rot){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot||0); ctx.scale(rx,ry);
  circle(ctx,0,0,1);
  ctx.restore();
}
/* Catmull-Rom → kubik Bezier */
function smoothPath(ctx,pts,closed){
  const n = pts.length;
  if(n < 2) return;
  const get = i => closed ? pts[((i%n)+n)%n] : pts[Math.max(0,Math.min(n-1,i))];
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n-1;
  for(let i=0;i<last;i++){
    const p0=get(i-1), p1=get(i), p2=get(i+1), p3=get(i+2);
    ctx.bezierCurveTo(
      p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6,
      p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6,
      p2[0], p2[1]);
  }
  if(closed) ctx.closePath();
}
function polyPath(ctx,pts){
  if(!pts.length) return;
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath();
}
function starPath(ctx,n,rOut,rIn,rot0){
  rot0 = rot0||0;
  const pts=[];
  for(let i=0;i<n*2;i++) pts.push(pol(rot0 + Math.PI*i/n, i%2 ? rIn : rOut));
  polyPath(ctx,pts);
}
/* Barg — yopiq tomchi (2 kubik Bezier) */
function leaf(ctx,x,y,ang,len,wid){
  ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
  ctx.moveTo(0,0);
  ctx.bezierCurveTo(len*0.22,-wid, len*0.72,-wid*0.7, len,0);
  ctx.bezierCurveTo(len*0.72, wid*0.7, len*0.22, wid, 0,0);
  ctx.closePath();
  ctx.restore();
}
/* Gulbarg — egri yonli, o'tkir uchli */
function petalPath(ctx,a,rIn,rOut,halfw){
  const bl = pol(a-halfw, rIn), br = pol(a+halfw, rIn), tip = pol(a, rOut);
  const cl1 = pol(a-halfw*1.12, rIn+(rOut-rIn)*0.42), cl2 = pol(a-halfw*0.5, rOut*0.93);
  const cr2 = pol(a+halfw*1.12, rIn+(rOut-rIn)*0.42), cr1 = pol(a+halfw*0.5, rOut*0.93);
  ctx.moveTo(bl[0],bl[1]);
  ctx.bezierCurveTo(cl1[0],cl1[1], cl2[0],cl2[1], tip[0],tip[1]);
  ctx.bezierCurveTo(cr1[0],cr1[1], cr2[0],cr2[1], br[0],br[1]);
  const cb = pol(a, rIn*0.86);
  ctx.bezierCurveTo(cb[0],cb[1], cb[0],cb[1], bl[0],bl[1]);
  ctx.closePath();
}
/* Logarifmik spiral: r(θ)=a·e^(bθ) */
function spiralPts(b,thMax,L,mirror,phase){
  const pts=[], a = L/Math.exp(b*thMax), mir = mirror ? -1 : 1;
  const steps = Math.max(10, Math.round(thMax/0.14));
  for(let i=0;i<=steps;i++){
    const th = thMax*i/steps;
    const r = a*Math.exp(b*th);
    pts.push([Math.cos(mir*th+(phase||0))*r, Math.sin(mir*th+(phase||0))*r]);
  }
  return pts;
}
function cubicAt(p0,p1,p2,p3,t){
  const u=1-t;
  return [
    u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]
  ];
}

/* ---------- Chizish helperlari ---------- */
function st(ctx,col,w){
  ctx.save();
  ctx.strokeStyle=col; ctx.lineWidth=Math.max(0.15,w);
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.stroke();
  ctx.restore();
}
/* Interlacing: pastki chiziq kesishuvda uziladi */
function iStroke(ctx,col,w){
  if(!ctx._svg){
    ctx.save();
    ctx.strokeStyle=P._bg; ctx.lineWidth=Math.max(0.4,w)*2.6;
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.stroke();
    ctx.restore();
  }
  st(ctx,col,w);
}
/* ═══ LENTA (RIBBON) — sanoat sifatidagi tasma: ikki kontur orasida band ═══
   Haqiqiy girih/knotwork ana shunday ko'rinadi */
function ribbon(ctx,band,edge,w){
  ctx.save();
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.strokeStyle = edge;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = band;
  ctx.lineWidth = Math.max(0.6, w - Math.max(1.8, w*0.42));
  ctx.stroke();
  /* glazur yaltirog'i — lenta o'rtasidagi nozik yorug' chiziq */
  ctx.strokeStyle = lerpColor(band, '#ffffff', 0.5);
  ctx.lineWidth = Math.max(0.35, w*0.11);
  ctx.stroke();
  ctx.restore();
}
/* Lenta + interlacing (pastdagi lentani uzadi → ustidan o'tish effekti) */
function ribbonI(ctx,band,edge,w){
  if(!ctx._svg){
    ctx.save();
    ctx.strokeStyle = P._bg;
    ctx.lineWidth = w + Math.max(3, w*0.55);
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.stroke();
    ctx.restore();
  }
  ribbon(ctx,band,edge,w);
}
function fillA(ctx,col,alpha){
  if(P.fill==='line') return;
  ctx.save();
  ctx.globalAlpha = (P.fill==='fill' ? 0.94 : 0.62) * (alpha===undefined?1:alpha);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}
function fillHard(ctx,col,alpha){
  ctx.save();
  ctx.globalAlpha = alpha===undefined?1:alpha;
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}
function dot(ctx,x,y,r,col){
  ctx.beginPath(); circle(ctx,x,y,r);
  ctx.save(); ctx.fillStyle=col; ctx.fill(); ctx.restore();
}

/* ============================================================
   A. O'ZBEK GEOMETRIK NAQSHLARI (8) — kanonik qurilish
   ============================================================ */

/* Rozetta geometriyasi: yulduz o'zagi + kite-gulbarglar (klassik islomiy rozetta) */
function rosetteGeo(n,R,ir){
  const R0 = R*0.92;                       /* gulbarg tashqi radiusi */
  const r2 = R*(0.36 + ir*0.28);           /* yulduz uchlari */
  const r1 = r2*0.55;                      /* yulduz ichki */
  const rm = r2 + (R0-r2)*0.52;            /* gulbarg yelkasi */
  const w  = (Math.PI/n)*0.86;             /* gulbarg yarim eni */
  return {R0,r2,r1,rm,w};
}
/* Kite-gulbarg — biroz bo'rtgan yonlar bilan */
function kitePath(ctx,a,g){
  const A = pol(a, g.r2), L = pol(a-g.w, g.rm), T = pol(a, g.R0), Rr = pol(a+g.w, g.rm);
  const bow = 0.14;
  const q=(P1,P2)=>{ /* biroz tashqariga bo'rtgan Bezier yon */
    const mx=(P1[0]+P2[0])/2, my=(P1[1]+P2[1])/2;
    const d=Math.hypot(mx,my)||1;
    const cx2=mx*(1+bow*40/d), cy2=my*(1+bow*40/d);
    ctx.bezierCurveTo(P1[0]+(cx2-P1[0])*0.6,P1[1]+(cy2-P1[1])*0.6, P2[0]+(cx2-P2[0])*0.6,P2[1]+(cy2-P2[1])*0.6, P2[0],P2[1]);
  };
  ctx.moveTo(A[0],A[1]); q(A,L); q(L,T); q(T,Rr); q(Rr,A);
  ctx.closePath();
}

/* 1. GIRIH — rozetta strapwork: to'qilgan lentali yulduz + kite-gulbarglar */
function drawGirih(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(6, p.sym);
  const g = rosetteGeo(n,R,p.ir);
  g.w *= (0.72 + p.dens*0.55);              /* zichlik → gulbarg eni */
  g.r1 = g.r2*(0.66 - p.spir*0.28);         /* spiral → yulduz o'tkirligi */
  const edge = shade(c0,0.5);
  const bw = sw*2.2 + 1.5;
  /* 1) kite-gulbarglar foni */
  for(let i=0;i<n;i++){
    const a = TAU*i/n - Math.PI/2;
    ctx.beginPath(); kitePath(ctx,a,g);
    fillA(ctx, i%2? c3 : lerpColor(c3,c1,0.25), 0.75);
    st(ctx, shade(c2,0.25), sw*0.45);
    /* o'rta tomir — chizmachi aniqlik chizig'i */
    const v0 = pol(a, g.r2*1.05), v1 = pol(a, g.R0*0.93);
    ctx.beginPath();
    ctx.moveTo(v0[0],v0[1]);
    ctx.bezierCurveTo(v0[0],v0[1], v1[0],v1[1], v1[0],v1[1]);
    st(ctx, shade(c2,0.12), sw*0.3);
  }
  /* 2) yulduz o'zagi to'ldirilgan */
  ctx.beginPath(); starPath(ctx, n, g.r2, g.r1, -Math.PI/2);
  fillA(ctx, c1, 0.9);
  /* 3) LENTALAR: {n/k} vatarlar, ikki o'tishda to'qiladi */
  const k = Math.max(2, Math.min(n-2, Math.floor(n/2)-1));
  const pts=[]; for(let i=0;i<n;i++) pts.push(pol(TAU*i/n - Math.PI/2, g.R0));
  const chord=(i)=>{ const A=pts[i], B=pts[(i+k)%n]; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); };
  for(let pass=0; pass<2; pass++){
    for(let i=pass; i<n; i+=2){ chord(i); ribbonI(ctx, c0, edge, bw); }
  }
  /* 4) markaziy vatarlarning o'rta bo'laklari — to'qishni yakunlash */
  for(let i=0;i<n;i+=2){
    const A=pts[i], B=pts[(i+k)%n];
    ctx.beginPath();
    ctx.moveTo(A[0]+(B[0]-A[0])*0.42, A[1]+(B[1]-A[1])*0.42);
    ctx.lineTo(A[0]+(B[0]-A[0])*0.58, A[1]+(B[1]-A[1])*0.58);
    ribbonI(ctx, c0, edge, bw);
  }
  /* 4b) gulbarglar orasidagi interstitsial nayzalar */
  for(let i=0;i<n;i++){
    const a = TAU*(i+0.5)/n - Math.PI/2;
    ctx.beginPath();
    const A2 = pol(a-g.w*0.5, g.rm), B2 = pol(a+g.w*0.5, g.rm), T2 = pol(a, g.R0*0.995), I2 = pol(a, g.r2*1.12);
    ctx.moveTo(I2[0],I2[1]);
    ctx.bezierCurveTo(A2[0],A2[1], A2[0],A2[1], T2[0],T2[1]);
    ctx.bezierCurveTo(B2[0],B2[1], B2[0],B2[1], I2[0],I2[1]);
    ctx.closePath();
    fillA(ctx, c0, 0.4);
    st(ctx, shade(c2,0.2), sw*0.35);
  }
  /* 5) tashqi halqa lentasi + tugunlarda mini-yulduzlar */
  ctx.beginPath(); circle(ctx,0,0,g.R0); ribbon(ctx, c1, shade(c1,0.45), bw*0.85);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx, c2, sw*0.6);
  for(let i=0;i<n;i++){
    const q = pol(TAU*i/n - Math.PI/2, g.R0);
    ctx.beginPath(); starPath(ctx, 8, bw*1.05, bw*0.5, 0);
    ctx.save(); ctx.translate(q[0],q[1]);
    ctx.beginPath(); starPath(ctx, 8, bw*1.05, bw*0.5, 0);
    fillHard(ctx, c3, 0.95); st(ctx, shade(c0,0.35), sw*0.35);
    ctx.restore();
  }
  dot(ctx,0,0,g.r1*0.35,c0);
  /* murakkablik ≥5 → ichki mini-rozetta halqasi */
  if(p.cmp>=5){
    ctx.save();
    ctx.scale(0.4,0.4);
    ctx.rotate(Math.PI/n);
    const g2 = rosetteGeo(n, R, p.ir);
    for(let i=0;i<n;i++){
      ctx.beginPath(); kitePath(ctx, TAU*i/n - Math.PI/2, g2);
      fillA(ctx, i%2? c1 : c3, 0.65);
      st(ctx, shade(c2,0.25), sw*0.9);
    }
    ctx.beginPath(); starPath(ctx, n, g2.r2, g2.r2*0.5, -Math.PI/2);
    fillA(ctx, c0, 0.85);
    st(ctx, edge, sw*0.8);
    ctx.restore();
  }
}

/* 2. XATAM — 8 qirrali yulduz: ikki to'qilgan kvadrat lenta */
function drawXatam(ctx,R,p,sw,c0,c1,c2,c3){
  const edge = shade(c0,0.5);
  const bw = sw*2.4 + 1.5;
  const levels = 1 + (p.cmp>=5 ? 1 : 0);
  for(let lev=0; lev<levels; lev++){
    const r = R*0.9*Math.pow(0.5, lev);
    const rot = -Math.PI/4 + lev*Math.PI/8;
    const sq = (rr,rt)=>{ const q=[]; for(let i=0;i<4;i++) q.push(pol(rt+TAU*i/4, rr)); return q; };
    const A = sq(r, rot), B = sq(r, rot+Math.PI/4);
    /* 8 qirrali yulduz foni */
    ctx.beginPath(); starPath(ctx, 8, r, r*0.765, rot);
    fillA(ctx, lev? c3 : c1, 0.55);
    /* ichki sakkizburchak */
    ctx.beginPath();
    const oct=[]; for(let i=0;i<8;i++) oct.push(pol(rot+Math.PI/8+TAU*i/8, r*0.545));
    polyPath(ctx,oct);
    fillA(ctx, lev? c1 : c3, 0.8);
    st(ctx, shade(c2,0.25), sw*0.5);
    /* TO'QILGAN kvadratlar: A pastda, B ustida, so'ng A ning 2 qarama-qarshi
       burchagi qayta ustiga — navbatlashgan haqiqiy weave */
    ctx.beginPath(); polyPath(ctx,A); ribbon(ctx, c0, edge, bw);
    ctx.beginPath(); polyPath(ctx,B); ribbonI(ctx, lev? c0 : c1, shade(lev? c0 : c1, 0.5), bw);
    for(const j of [0,2]){
      ctx.beginPath();
      const P1=A[j], P2=A[(j+1)%4];
      ctx.moveTo(P1[0]+(P2[0]-P1[0])*0.28, P1[1]+(P2[1]-P1[1])*0.28);
      ctx.lineTo(P1[0]+(P2[0]-P1[0])*0.72, P1[1]+(P2[1]-P1[1])*0.72);
      const P3=A[(j+2)%4], P4=A[(j+3)%4];
      ctx.moveTo(P3[0]+(P4[0]-P3[0])*0.28, P3[1]+(P4[1]-P3[1])*0.28);
      ctx.lineTo(P3[0]+(P4[0]-P3[0])*0.72, P3[1]+(P4[1]-P3[1])*0.72);
      ribbonI(ctx, c0, edge, bw);
      break;
    }
  }
  /* yulduz uchlaridan tashqi halqaga bog'lovchi nurlar */
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a = -Math.PI/4 + TAU*i/8;
    const A2 = pol(a, R*0.9), B2 = pol(a, R);
    ctx.moveTo(A2[0],A2[1]); ctx.lineTo(B2[0],B2[1]);
  }
  st(ctx, c2, sw*0.6);
  ctx.beginPath(); circle(ctx,0,0,R); ribbon(ctx, c1, shade(c1,0.45), sw*1.6+1);
  dot(ctx,0,0,R*0.05,c0);
}

/* 3. ROZETTA — gulbarg halqalari, konsentrik bandlar (loyqasiz) */
function drawRozetta(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(5,p.sym);
  const w = (Math.PI/n)*(0.55 + p.dens*0.35);
  /* tashqi gulbarg halqasi */
  for(let i=0;i<n;i++){
    const a = TAU*i/n - Math.PI/2;
    ctx.beginPath(); petalPath(ctx, a, R*0.46, R*0.95, w);
    fillA(ctx, i%2? c1 : c3, 0.65);
    st(ctx, shade(c0,0.35), sw*0.7);
    /* o'rta tomir */
    const b0 = pol(a, R*0.5), b1 = pol(a, R*0.86);
    ctx.beginPath(); ctx.moveTo(b0[0],b0[1]);
    ctx.bezierCurveTo(b0[0],b0[1], b1[0],b1[1], b1[0],b1[1]);
    st(ctx, shade(c2,0.15), sw*0.35);
  }
  /* oraliq kichik gulbarglar — o'z bandida */
  for(let i=0;i<n;i++){
    const a = TAU*(i+0.5)/n - Math.PI/2;
    ctx.beginPath(); petalPath(ctx, a, R*0.24, R*0.5, w*0.62);
    fillA(ctx, c0, 0.55);
    st(ctx, shade(c0,0.4), sw*0.5);
  }
  /* markaz: halqa + yulduzcha — ichki radius slayderiga bog'liq */
  const rc = R*(0.13 + p.ir*0.28);
  ctx.beginPath(); circle(ctx,0,0,rc); ribbon(ctx, c1, shade(c1,0.45), sw*1.6+1);
  ctx.beginPath(); starPath(ctx, n, rc*0.72, rc*0.38, -Math.PI/2);
  fillHard(ctx, c0, 0.9); st(ctx, shade(c0,0.4), sw*0.4);
  /* murakkablik → nuqta halqalari */
  const dotRings = Math.max(0, Math.round(p.cmp/2) - 1);
  for(let k=0;k<dotRings;k++){
    const rd = rc + (R*0.46 - rc)*(k+1)/(dotRings+1);
    for(let i=0;i<n*2;i++){
      const q = pol(TAU*(i+0.5)/(n*2) - Math.PI/2, rd);
      dot(ctx, q[0], q[1], sw*0.7, k%2? c2 : c1);
    }
  }
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx, c2, sw*0.55);
  dot(ctx,0,0,rc*0.16,c1);
}

/* 4. YULDUZ — to'qilgan {n/k} lenta yulduz */
function drawYulduz(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(5,p.sym);
  const k = Math.max(2, Math.min(n-2, Math.floor(n/2)-1 + Math.round(p.spir*1.5)));
  const r = R*0.9;
  const edge = shade(c0,0.5);
  const bw = sw*2.4 + 1.5;
  const pts=[]; for(let i=0;i<n;i++) pts.push(pol(TAU*i/n - Math.PI/2, r));
  /* markaziy n-burchak o'zak: vatarlar ichki kesishmalaridan */
  const inner=[];
  for(let i=0;i<n;i++){
    const X = segX(pts[i], pts[(i+k)%n], pts[(i+1)%n], pts[(i+1-k+n)%n]);
    if(X) inner.push(X);
  }
  if(inner.length>=3){
    ctx.beginPath(); polyPath(ctx, inner);
    fillA(ctx, c1, 0.85);
  }
  /* to'qilgan lenta vatarlar — ikki o'tish + o'rta segment ustidan */
  const chord=(i)=>{ const A=pts[i],B=pts[(i+k)%n]; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); };
  for(let pass=0; pass<2; pass++){
    for(let i=pass; i<n; i+=2){ chord(i); ribbonI(ctx, i%2? c1 : c0, shade(i%2? c1 : c0, 0.5), bw); }
  }
  for(let i=0;i<n;i+=2){
    const A=pts[i], B=pts[(i+k)%n];
    ctx.beginPath();
    ctx.moveTo(A[0]+(B[0]-A[0])*0.44, A[1]+(B[1]-A[1])*0.44);
    ctx.lineTo(A[0]+(B[0]-A[0])*0.56, A[1]+(B[1]-A[1])*0.56);
    ribbonI(ctx, c0, edge, bw);
  }
  /* tashqi halqa lentasi + tugun nuqtalar */
  ctx.beginPath(); circle(ctx,0,0,r); ribbon(ctx, c1, shade(c1,0.45), bw*0.8);
  for(const q of pts) dot(ctx,q[0],q[1], bw*0.45, c0);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx, c2, sw*0.5);
  dot(ctx,0,0,R*0.04,c0);
}

/* 5. MUQARNAS — toza pog'onali arkada: ravoq lentalari + tokchalar */
function drawMuqarnas(ctx,R,p,sw,c0,c1,c2,c3){
  const levels = Math.max(2, Math.min(6, 1 + p.cmp));
  for(let l=0;l<levels;l++){
    const r = R*0.94*Math.pow(0.74, l);
    const m = Math.max(6, p.sym + l*2);
    const drop = r*(0.14 + p.ir*0.2);
    const t = l/(levels-1||1);
    const band = lerpColor(c0,c1,t);
    /* tokcha (nisha) fonlari */
    for(let i=0;i<m;i++){
      const a0 = TAU*i/m - Math.PI/2, a1 = TAU*(i+1)/m - Math.PI/2;
      const A = pol(a0,r), B = pol(a1,r), M = pol((a0+a1)/2, r-drop);
      ctx.beginPath();
      ctx.moveTo(A[0],A[1]);
      ctx.bezierCurveTo(A[0]*(1-drop/r*0.5),A[1]*(1-drop/r*0.5), M[0]+(A[0]-B[0])*0.15,M[1]+(A[1]-B[1])*0.15, M[0],M[1]);
      ctx.bezierCurveTo(M[0]+(B[0]-A[0])*0.15,M[1]+(B[1]-A[1])*0.15, B[0]*(1-drop/r*0.5),B[1]*(1-drop/r*0.5), B[0],B[1]);
      arcB(ctx,0,0,r,a1,a0,true);
      ctx.closePath();
      fillA(ctx, i%2? c3 : lerpColor(c3,c1,0.3), 0.4 + t*0.2);
    }
    /* ravoq lentasi */
    ctx.beginPath();
    for(let i=0;i<m;i++){
      const a0 = TAU*i/m - Math.PI/2, a1 = TAU*(i+1)/m - Math.PI/2;
      const A = pol(a0,r), B = pol(a1,r), M = pol((a0+a1)/2, r-drop);
      ctx.moveTo(A[0],A[1]);
      ctx.bezierCurveTo(A[0]*(1-drop/r*0.5),A[1]*(1-drop/r*0.5), M[0]+(A[0]-B[0])*0.15,M[1]+(A[1]-B[1])*0.15, M[0],M[1]);
      ctx.bezierCurveTo(M[0]+(B[0]-A[0])*0.15,M[1]+(B[1]-A[1])*0.15, B[0]*(1-drop/r*0.5),B[1]*(1-drop/r*0.5), B[0],B[1]);
    }
    ribbon(ctx, band, shade(band,0.45), sw*1.5+0.8);
    /* osilgan tomchi nuqtalari */
    for(let i=0;i<m;i++){
      const M = pol(TAU*(i+0.5)/m - Math.PI/2, r-drop);
      dot(ctx, M[0], M[1], sw*0.9+0.6, shade(band,0.3));
    }
  }
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.55);
  const core = R*Math.pow(0.74, levels);
  ctx.beginPath(); starPath(ctx, p.sym, core, core*0.5, -Math.PI/2);
  fillHard(ctx, c0, 0.9);
}

/* 6. KATAK-8 — 4.8.8 Arximed kafeli, aniq hizalangan */
function drawKatak8(ctx,R,p,sw,c0,c1,c2,c3){
  const FIELD = !!p._field;
  const cells = FIELD ? Math.max(2, Math.round(R*1.7/(p._cellpx||150))) : Math.max(2, Math.round(2 + p.dens*2));
  const s = R*1.7/cells;
  const oR = s*0.5/Math.cos(Math.PI/8);          /* sakkizburchak "radiusi" */
  const half = cells*s/2;
  ctx.save();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.98);
    if(!ctx._svg) ctx.clip();
  }
  for(let gy=0; gy<=cells; gy++){
    for(let gx=0; gx<=cells; gx++){
      const x = -half + gx*s, y = -half + gy*s;
      if(Math.hypot(x,y) > R*1.05) continue;
      /* sakkizburchak */
      const oct=[]; for(let i=0;i<8;i++) oct.push([x+Math.cos(Math.PI/8+TAU*i/8)*oR, y+Math.sin(Math.PI/8+TAU*i/8)*oR]);
      ctx.beginPath(); polyPath(ctx,oct);
      fillA(ctx, (gx+gy)%2? c3 : lerpColor(c3,'#ffffff',0.4), 0.8);
      ribbon(ctx, c0, shade(c0,0.45), sw*1.4+0.8);
      /* ichki yulduzcha */
      if(p.cmp>=3){
        ctx.beginPath();
        const sp=[]; for(let i=0;i<16;i++) sp.push([x+Math.cos(Math.PI/8+Math.PI*i/8)*(i%2? oR*0.22 : oR*0.5), y+Math.sin(Math.PI/8+Math.PI*i/8)*(i%2? oR*0.22 : oR*0.5)]);
        polyPath(ctx,sp);
        fillA(ctx, c1, 0.8); st(ctx, shade(c1,0.35), sw*0.4);
      }
    }
  }
  /* kichik kvadratlar — panjara tugunlari */
  const q = s*0.5 - oR*Math.cos(Math.PI/8);
  for(let gy=0; gy<cells; gy++){
    for(let gx=0; gx<cells; gx++){
      const x = -half + gx*s + s/2, y = -half + gy*s + s/2;
      if(Math.hypot(x,y) > R*1.05) continue;
      ctx.beginPath();
      polyPath(ctx,[[x,y-q*1.35],[x+q*1.35,y],[x,y+q*1.35],[x-q*1.35,y]]);
      fillHard(ctx, c0, 0.9);
      st(ctx, shade(c0,0.45), sw*0.5);
    }
  }
  ctx.restore();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.98); ribbon(ctx, c1, shade(c1,0.45), sw*1.8+1);
  }
}

/* 7. OLTI BURCHAK — asal uyasi, toza lenta konturlar */
function drawHexa(ctx,R,p,sw,c0,c1,c2,c3){
  const FIELD = !!p._field;
  const s = FIELD ? Math.max(26,(p._cellpx||150)*0.42) : R/(2.0 + p.dens*2.0);
  const dx = s*Math.sqrt(3), dy = s*1.5;
  ctx.save();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.98);
    if(!ctx._svg) ctx.clip();
  }
  const NN = FIELD ? Math.ceil(R/(s*1.5))+1 : 5;
  for(let gy=-NN; gy<=NN; gy++){
    for(let gx=-NN; gx<=NN; gx++){
      const x = gx*dx + (gy%2 ? dx/2 : 0), y = gy*dy;
      if(Math.hypot(x,y) > R*1.08) continue;
      const pts=[]; for(let i=0;i<6;i++) pts.push([x+Math.cos(Math.PI/6+TAU*i/6)*s, y+Math.sin(Math.PI/6+TAU*i/6)*s]);
      ctx.beginPath(); polyPath(ctx,pts);
      const ci = ((gx%3)+3+(gy%3)*2)%3;
      fillA(ctx, [c3, lerpColor(c3,'#ffffff',0.45), lerpColor(c3,c1,0.25)][ci], 0.7);
      ribbon(ctx, c0, shade(c0,0.45), sw*1.3+0.7);
      if(p.cmp>=4){
        for(let i=0;i<6;i++){
          ctx.beginPath();
          leaf(ctx, x, y, Math.PI/6+TAU*i/6, s*0.52, s*0.14);
          fillA(ctx, c1, 0.75); st(ctx, shade(c1,0.35), sw*0.35);
        }
        dot(ctx,x,y,s*0.1,c0);
      }
    }
  }
  ctx.restore();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.98); ribbon(ctx, c1, shade(c1,0.45), sw*1.8+1);
  }
}

/* 8. ZANJIRA — bir-biriga o'tkazilgan halqalar zanjiri (haqiqiy interlock) */
function drawZanjira(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(6, p.sym);
  const rc = R*0.68;
  const rr = Math.PI*rc/n * (0.92 + p.dens*0.35);   /* qo'shnilar bilan kesishadi */
  const bw = sw*2.2 + 1.5;
  const centers=[]; for(let i=0;i<n;i++) centers.push(pol(TAU*i/n - Math.PI/2, rc));
  /* har halqa — lenta; keyingisi oldingisini kesib o'tadi */
  for(let i=0;i<n;i++){
    const c = centers[i], col = i%2? c1 : c0;
    ctx.beginPath(); circle(ctx, c[0], c[1], rr);
    ribbonI(ctx, col, shade(col,0.5), bw);
  }
  /* birinchi halqaning oxirgi halqa tomonidagi yoyi — zanjirni ulash */
  const a0 = Math.atan2(centers[0][1], centers[0][0]) + Math.PI; /* markazga qaragan */
  const dirLast = Math.atan2(centers[n-1][1]-centers[0][1], centers[n-1][0]-centers[0][0]);
  ctx.beginPath();
  arcB(ctx, centers[0][0], centers[0][1], rr, dirLast-0.7, dirLast+0.7);
  ribbonI(ctx, c0, shade(c0,0.5), bw);
  /* markaziy medalyon */
  const ri = rc - rr - bw;
  if(ri > R*0.1){
    ctx.beginPath(); circle(ctx,0,0,ri*0.9); ribbon(ctx, c2, shade(c2,0.4), sw*1.3+0.7);
    ctx.beginPath(); starPath(ctx, n, ri*0.62, ri*0.34, -Math.PI/2);
    fillA(ctx, c1, 0.8); st(ctx, shade(c1,0.4), sw*0.5);
    dot(ctx,0,0,ri*0.14,c0);
  }
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx, c2, sw*0.5);
}

/* ============================================================
   B. ISLIMIY ORGANIK NAQSHLAR (8) — nafis novda va barglar
   ============================================================ */

/* Nozik torayuvchi novda: 3 o'tishli qalinlik gradatsiyasi */
function stem(ctx,pts,col,w){
  const edge = shade(col,0.35);
  ctx.beginPath(); smoothPath(ctx,pts,false);
  st(ctx, edge, w);
  const half = pts.slice(0, Math.ceil(pts.length*0.6));
  ctx.beginPath(); smoothPath(ctx,half,false);
  st(ctx, edge, w*1.55);
  ctx.beginPath(); smoothPath(ctx,pts,false);
  st(ctx, col, Math.max(0.4,w*0.5));
}
/* Nafis barg: to'ldirish + kontur + o'rta tomir */
function fineLeaf(ctx,x,y,ang,len,wid,fillC,edgeC,sw){
  ctx.beginPath(); leaf(ctx,x,y,ang,len,wid);
  fillA(ctx, fillC, 0.85);
  st(ctx, edgeC, sw);
  ctx.beginPath();
  ctx.save(); ctx.translate(x,y); ctx.rotate(ang);
  ctx.moveTo(len*0.08,0);
  ctx.bezierCurveTo(len*0.3,-wid*0.12, len*0.55,-wid*0.1, len*0.8,0);
  ctx.restore();
  st(ctx, edgeC, sw*0.55);
}
/* Uch bargli palmetta kurtak */
function budAt(ctx,x,y,ang,L,fillC,edgeC,sw){
  for(const [da,f] of [[-0.55,0.72],[0.55,0.72],[0,1]]){
    ctx.beginPath(); leaf(ctx,x,y,ang+da,L*f,L*f*0.3);
    fillA(ctx, f===1? fillC : lerpColor(fillC,edgeC,0.25), 0.9);
    st(ctx, shade(edgeC,0.2), sw*0.5);
  }
}

/* 9. ISLIMIY — nafis spiral novdalar */
function drawIslimiy(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(3, Math.min(10, p.sym));
  const b = 0.1 + p.spir*0.28;
  const thMax = Math.PI*(1.2 + p.cmp*0.18);
  for(let i=0;i<n;i++){
    ctx.save(); ctx.rotate(TAU*i/n);
    const pts = spiralPts(b, thMax, R*0.88, i%2===1, 0);
    stem(ctx, pts, c0, sw*1.1);
    /* barglar — kamroq, kattaroq, uchga qarab o'sadi */
    const every = Math.max(5, 11 - Math.round(p.dens*5));
    for(let j=every; j<pts.length-3; j+=every){
      const t2 = j/pts.length;
      const a = pts[j], b2 = pts[j+1];
      const ang = Math.atan2(b2[1]-a[1], b2[0]-a[0]);
      const side = (Math.floor(j/every)%2)? 1 : -1;
      fineLeaf(ctx, a[0], a[1], ang + side*Math.PI/2.5, R*0.1*(0.5+t2), R*0.03*(0.5+t2), c1, shade(c0,0.25), sw*0.45);
    }
    const e = pts[pts.length-1], e2 = pts[pts.length-3];
    budAt(ctx, e[0], e[1], Math.atan2(e[1]-e2[1],e[0]-e2[0]), R*0.16, c1, c0, sw);
    /* markazdagi kichik qarshi gajak */
    if(p.cmp>=3){
      const pts2 = spiralPts(b*1.35, thMax*0.42, R*0.3, i%2===0, 0.4);
      stem(ctx, pts2, c2, sw*0.7);
      const f = pts2[pts2.length-1], f2 = pts2[pts2.length-2];
      fineLeaf(ctx, f[0], f[1], Math.atan2(f[1]-f2[1],f[0]-f2[0]), R*0.09, R*0.028, c3, shade(c2,0.2), sw*0.4);
    }
    ctx.restore();
  }
  ctx.beginPath(); circle(ctx,0,0,R*0.05+sw); fillHard(ctx,c0,0.95);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* ---------------------------------------------------------------------------
   O'YMA PANEL (kartush) — Xiva/Farg'ona yog'och o'ymakorligi uslubi
   ---------------------------------------------------------------------------
   Ustun qirralaridagi va eshik tabaqalaridagi naqsh radial medalyon EMAS:
   u tik KARTUSH — ramkali panel, ichida o'qqa nisbatan KO'ZGU-SIMMETRIK
   islimiy. Uch xususiyati bu uslubni tanitadi va shu yerda takrorlanadi:

     1) kartush ramkasi — yon tomonlari tik, uchlari siniq (ogee) yoy;
     2) NUQTALI FON ("chizma" / pargori) — o'yilgan pastki qatlam;
     3) RELYEF — har kontur ostiga yorug' va soya nusxasi, shunda naqsh
        yassi chiziq emas, o'yilgan sirt bo'lib ko'rinadi.

   Barcha shakllar oddiy yo'l buyruqlari bilan chiziladi (offscreen kanvas
   yoki filtr ishlatilmaydi), shuning uchun SVG/DXF eksporti ham ishlaydi.
   --------------------------------------------------------------------------- */
function oymaCartouche(ctx, w, h){
  const tip = h*0.22;                       /* uchdagi yoy balandligi */
  ctx.moveTo(-w, -h + tip);
  ctx.lineTo(-w,  h - tip);
  /* yuqori siniq yoy: nazorat nuqtalari cho'qqida qarama-qarshi yo'nalgani
     uchun uchi yumaloq emas, O'TKIR chiqadi */
  ctx.bezierCurveTo(-w, h - tip*0.32, -w*0.13, h*1.02, 0, h);
  ctx.bezierCurveTo( w*0.13, h*1.02,  w, h - tip*0.32, w, h - tip);
  ctx.lineTo( w, -h + tip);
  ctx.bezierCurveTo( w, -h + tip*0.32,  w*0.13, -h*1.02, 0, -h);
  ctx.bezierCurveTo(-w*0.13, -h*1.02, -w, -h + tip*0.32, -w, -h + tip);
  ctx.closePath();
}

function drawOyma(ctx,R,p,sw,c0,c1,c2,c3){
  const hw = R*0.60, hh = R*0.95;
  const fw = R*0.070;                       /* ramka eni */
  const lw = Math.max(0.6, sw*0.85);
  const iw = hw - fw*2.1, ih = hh - fw*2.1; /* ichki maydon */
  const dark = shade(c0, 0.55), light = lerpColor(c1, '#ffffff', 0.72);

  /* --- RELYEF yordamchisi: konturni yorug' va soya nusxasi bilan --- */
  const d = Math.max(0.55, lw*0.55);
  /* Vektor eksportida (SVG/DXF/EPS) yorug'-soya nusxalari CHIZILMAYDI:
     ular ekranda o'yma taassurotini beradi, lekin lazer uchun bu HAR
     CHIZIQNI UCH MARTA kesish degani — material kuyadi va ish vaqti uch
     barobar oshadi. SvgCtx o'zini ctx._svg bilan tanitadi. */
  const vec = !!ctx._svg;
  const relief = (path, wid)=>{
    if(!vec){
      ctx.save(); ctx.translate(-d, -d); ctx.beginPath(); path(); st(ctx, light, wid); ctx.restore();
      ctx.save(); ctx.translate( d,  d); ctx.beginPath(); path(); st(ctx, dark,  wid); ctx.restore();
    }
    ctx.beginPath(); path(); st(ctx, c0, wid);
  };

  /* --- 1) NUQTALI FON — o'yilgan pastki qatlam ---
     Bu SIRT FAKTURASI, kesish konturi emas. Vektor eksportida chizilmaydi:
     aks holda lazerga minglab mayda doira (har biri alohida teshik) ketardi —
     o'lchandi: 180x120 mm o'yma panelda 3019 kontur, 2.5 MB DXF. */
  if(!vec && p.dens > 0.15){
    ctx.save();
    ctx.beginPath(); oymaCartouche(ctx, iw, ih); ctx.clip();
    const step = Math.max(R*0.026, R*0.055*(1.15 - p.dens));
    const rr = Math.max(0.5, step*0.17);
    /* deterministik siljish — Math.random ishlatilmaydi, aks holda har
       chizishda boshqa natija chiqib, eksport takrorlanmas bo'lib qolardi */
    const jit = (i,j)=>{ const s = Math.sin(i*127.1 + j*311.7)*43758.5453; return s - Math.floor(s); };
    for(let j = -Math.ceil(ih/step); j <= Math.ceil(ih/step); j++){
      for(let i = -Math.ceil(iw/step); i <= Math.ceil(iw/step); i++){
        const x = i*step + (j%2 ? step*0.5 : 0) + (jit(i,j)-0.5)*step*0.28;
        const y = j*step + (jit(j,i)-0.5)*step*0.28;
        ctx.beginPath(); circle(ctx, x, y, rr); fillHard(ctx, shade(c2, 0.30), 0.55);
      }
    }
    ctx.restore();
  }

  /* --- 2) MARKAZIY KOMPOZITSIYA — o'qqa nisbatan ko'zgu-simmetrik ---
     Tuzilma: har yon tomonda ILON-IZI NOVDA pastdan tepaga o'tadi, uning
     har burilishida palmetta, oralarida barglar. Novda panel enining
     deyarli hammasini egallagani uchun maydon TEKIS to'ladi.

     (Avvalgi urinishda har tugundan logarifmik spiral chiqarilgandi: katta
     L da spiralning tashqi o'rami yirik halqaga aylanib, panel o'rtasida
     chalkash tugun hosil qilardi, yon tomonlar esa bo'sh qolardi. Ilon-izi
     novda bu muammoni butunlay yo'q qiladi.) */
  const waves = 3 + Math.min(2, Math.max(0, (p.cmp|0) - 3));
  const half = (sgn)=>{
    ctx.save(); ctx.scale(sgn, 1);

    /* --- ilon-izi novda --- */
    const vine = [];
    const N = 120;
    for(let i = 0; i <= N; i++){
      const t = i/N;                                   /* 0 → pastdan tepaga */
      const y = -ih*0.86 + t*ih*1.72;
      /* novda o'qni KESIB O'TMAYDI: aks holda ikki ko'zgu nusxa markazda
         chalkashib, tugun hosil qilardi */
      const x = iw*0.16 + (0.5 + 0.5*Math.sin(t*Math.PI*waves - Math.PI/2))*iw*0.62;
      vine.push([x, y]);
    }
    relief(()=>smoothPath(ctx, vine, false), lw*1.15);

    /* burilish nuqtalari — palmetta va qarshi gajak */
    for(let w = 0; w < waves; w++){
      const t = (w + 0.5)/waves;                       /* to'lqin cho'qqisi */
      const i = Math.round(t*N);
      const a = vine[Math.max(0,i-1)], b2 = vine[Math.min(N,i+1)];
      const ang = Math.atan2(b2[1]-a[1], b2[0]-a[0]);
      const q = vine[i];
      /* palmetta TASHQARIGA qaragan — o'q tomonga emas, aks holda ikki
         ko'zgu nusxaning palmettalari markazda ustma-ust tushadi */
      budAt(ctx, q[0], q[1], 0, iw*0.30, c1, c0, lw*0.9);
    }

    /* novda bo'ylab barglar — ikki tomonga navbatma-navbat */
    const step = Math.max(5, 13 - Math.round(p.dens*7));
    for(let i = step; i < N - step; i += step){
      const a = vine[i-1], b2 = vine[i+1], q = vine[i];
      const ang = Math.atan2(b2[1]-a[1], b2[0]-a[0]);
      const side = (Math.floor(i/step) % 2) ? 1 : -1;
      fineLeaf(ctx, q[0], q[1], ang + side*Math.PI/2.3, iw*0.20, iw*0.068, c1, dark, lw*0.42);
    }
    ctx.restore();
  };
  half(1); half(-1);

  /* o'q bo'ylab ingichka poya — ikki novdani bog'laydi */
  const spine = [];
  for(let i = 0; i <= 24; i++) spine.push([0, -ih*0.88 + (i/24)*ih*1.76]);
  relief(()=>smoothPath(ctx, spine, false), lw*0.8);

  /* uchlardagi kurtaklar va markaziy palmetta */
  budAt(ctx, 0,  ih*0.90, -Math.PI/2, ih*0.13, c1, c0, lw);
  budAt(ctx, 0, -ih*0.90,  Math.PI/2, ih*0.13, c1, c0, lw);
  for(const s2 of [-1, 1]){
    fineLeaf(ctx, 0, 0, s2>0 ? 0 : Math.PI, iw*0.34, iw*0.13, c1, dark, lw*0.55);
    fineLeaf(ctx, 0, 0, s2>0 ? -Math.PI/2 : Math.PI/2, iw*0.22, iw*0.085, c3, dark, lw*0.45);
  }
  ctx.beginPath(); circle(ctx, 0, 0, iw*0.075); fillHard(ctx, c3, 0.95); st(ctx, dark, lw*0.7);

  /* --- 3) KARTUSH RAMKASI — eng ustida, relyef bilan --- */
  relief(()=>oymaCartouche(ctx, iw, ih), lw*0.9);
  relief(()=>oymaCartouche(ctx, hw, hh), lw*1.35);
  /* ramka ichidagi ingichka yo'l */
  ctx.beginPath(); oymaCartouche(ctx, (hw+iw)/2, (hh+ih)/2); st(ctx, c2, lw*0.55);
}

/* Rumi motivi — ilmoqli buralgan barg (klassik "yaprak") */
function rumiLeafPath(ctx,L){
  ctx.moveTo(0,0);
  ctx.bezierCurveTo(L*0.12,-L*0.36, L*0.68,-L*0.42, L*0.94,-L*0.1);
  ctx.bezierCurveTo(L*1.04, L*0.04, L*0.9, L*0.2, L*0.7, L*0.13);
  ctx.bezierCurveTo(L*0.52, L*0.06, L*0.42, L*0.2, L*0.28, L*0.16);
  ctx.bezierCurveTo(L*0.12, L*0.1, L*0.04, L*0.05, 0,0);
  ctx.closePath();
}
/* 10. RUMI — halqa bo'ylab ilmoqli barglar + tok chizig'i */
function drawRumi(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(5, p.sym);
  const rc = R*0.62;
  /* tok halqasi (lenta) */
  ctx.beginPath(); circle(ctx,0,0,rc);
  ribbon(ctx, c2, shade(c2,0.4), sw*1.4+0.8);
  const L = R*0.36*(0.8 + p.dens*0.35);
  for(let i=0;i<n;i++){
    const a = TAU*i/n - Math.PI/2;
    const c = pol(a, rc);
    /* tashqariga qaragan katta rumi barg */
    ctx.save(); ctx.translate(c[0],c[1]); ctx.rotate(a - Math.PI/2 + 0.35 + p.skew*0.4);
    ctx.beginPath(); rumiLeafPath(ctx, L);
    fillA(ctx, i%2? c1 : c0, 0.85);
    st(ctx, shade(i%2? c1 : c0, 0.4), sw*0.7);
    /* ichki ilmoq chizig'i */
    ctx.beginPath();
    ctx.moveTo(L*0.1,-L*0.06);
    ctx.bezierCurveTo(L*0.35,-L*0.22, L*0.62,-L*0.24, L*0.78,-L*0.06);
    st(ctx, shade(c3,0.1), sw*0.4);
    ctx.restore();
    /* ichkariga qaragan kichik barg */
    ctx.save(); ctx.translate(c[0],c[1]); ctx.rotate(a + Math.PI/2 - 0.35 - p.skew*0.4);
    ctx.beginPath(); rumiLeafPath(ctx, L*0.55);
    fillA(ctx, c3, 0.85);
    st(ctx, shade(c2,0.25), sw*0.5);
    ctx.restore();
    dot(ctx, c[0], c[1], sw*1.1+0.6, shade(c0,0.2));
  }
  /* TASHQI BOG'LOVCHI NOVDALAR — katta barglar orasidan chetgacha S-novda:
     tessellatsiyada qo'shni naqsh novdalari bilan tutashib UZLUKSIZ gulchambar hosil qiladi */
  for(let i=0;i<n;i++){
    const a = TAU*(i+0.5)/n - Math.PI/2;
    const sgn = i%2 ? 1 : -1;
    const pts = [];
    for(let j=0;j<=10;j++){
      const t = j/10;
      const rr = rc*0.96 + (R*1.06 - rc*0.96)*t;
      const wob = Math.sin(t*Math.PI)*0.16*sgn; /* yengil S-egri */
      pts.push(pol(a + wob, rr));
    }
    stem(ctx, pts, c2, sw*0.85);
    /* o'rtadagi yon barg */
    const m1 = pts[5], m2 = pts[6];
    const mAng = Math.atan2(m2[1]-m1[1], m2[0]-m1[0]);
    fineLeaf(ctx, m1[0], m1[1], mAng + sgn*Math.PI/2.4, L*0.34, L*0.11, c3, shade(c2,0.2), sw*0.4);
    /* uchidagi barg — plitka chegarasidan o'tib qo'shnisiga yetadi */
    const e = pts[10], e2 = pts[9];
    fineLeaf(ctx, e[0], e[1], Math.atan2(e[1]-e2[1], e[0]-e2[0]), L*0.42, L*0.14, i%2? c1 : c0, shade(c0,0.3), sw*0.5);
  }
  /* markaz rozetkasi */
  const ri = rc - L*0.75;
  if(ri > R*0.08){
    ctx.beginPath(); starPath(ctx, n, ri*0.7, ri*0.4, -Math.PI/2);
    fillA(ctx, c1, 0.8); st(ctx, shade(c1,0.35), sw*0.5);
    dot(ctx,0,0,ri*0.16,c0);
  }
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 11. HATAYI — lotus: 3-segmentli gulbarglar, toza bandlar */
function hatayiPetal(ctx,a,rIn,rOut,w){
  const bl=pol(a-w,rIn), br=pol(a+w,rIn);
  const wl=pol(a-w*0.62, rIn+(rOut-rIn)*0.58), wr=pol(a+w*0.62, rIn+(rOut-rIn)*0.58);
  const tip=pol(a,rOut);
  ctx.moveTo(bl[0],bl[1]);
  const c1p=pol(a-w*1.25, rIn+(rOut-rIn)*0.28);
  ctx.bezierCurveTo(c1p[0],c1p[1], wl[0],wl[1], wl[0],wl[1]);
  const c2p=pol(a-w*0.12, rOut*0.99);
  ctx.bezierCurveTo(wl[0],wl[1], c2p[0],c2p[1], tip[0],tip[1]);
  const c3p=pol(a+w*0.12, rOut*0.99);
  ctx.bezierCurveTo(c3p[0],c3p[1], wr[0],wr[1], wr[0],wr[1]);
  const c4p=pol(a+w*1.25, rIn+(rOut-rIn)*0.28);
  ctx.bezierCurveTo(wr[0],wr[1], c4p[0],c4p[1], br[0],br[1]);
  const cb=pol(a, rIn*0.84);
  ctx.bezierCurveTo(cb[0],cb[1], cb[0],cb[1], bl[0],bl[1]);
  ctx.closePath();
}
function drawHatayi(ctx,R,p,sw,c0,c1,c2,c3){
  const m = 5 + (p.cmp>=5 ? 2 : (p.cmp>=3 ? 1 : 0));
  const w = (Math.PI/m)*(0.62+p.dens*0.25);
  /* tashqi gulbarglar */
  for(let i=0;i<m;i++){
    const a = TAU*i/m - Math.PI/2;
    ctx.beginPath(); hatayiPetal(ctx, a, R*0.36, R*0.94, w);
    fillA(ctx, i%2? c1 : lerpColor(c1,c3,0.4), 0.7);
    st(ctx, shade(c0,0.35), sw*0.7);
    const t0 = pol(a, R*0.42), t1 = pol(a, R*0.82);
    ctx.beginPath(); ctx.moveTo(t0[0],t0[1]);
    ctx.bezierCurveTo(t0[0],t0[1], t1[0],t1[1], t1[0],t1[1]);
    st(ctx, shade(c2,0.15), sw*0.35);
  }
  /* oraliq kichik gulbarglar */
  for(let i=0;i<m;i++){
    ctx.beginPath(); hatayiPetal(ctx, TAU*(i+0.5)/m - Math.PI/2, R*0.2, R*0.46, w*0.66);
    fillA(ctx, c3, 0.8); st(ctx, shade(c2,0.25), sw*0.5);
  }
  /* urug'don halqasi */
  ctx.beginPath(); circle(ctx,0,0,R*0.2); ribbon(ctx, c1, shade(c1,0.4), sw*1.3+0.7);
  const seeds = Math.max(6, m);
  for(let i=0;i<seeds;i++){
    const c = pol(TAU*i/seeds, R*0.13);
    dot(ctx,c[0],c[1],R*0.024,shade(c0,0.15));
  }
  dot(ctx,0,0,R*0.055,c0);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 12. PALAK — nilufar: 3 toza gulbarg halqasi */
function drawPalak(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(6, p.sym);
  const rings = [
    {rIn:R*0.55, rOut:R*0.95, w:(Math.PI/n)*0.8,  off:0,   f:c1, e:c0},
    {rIn:R*0.32, rOut:R*0.6,  w:(Math.PI/n)*0.72, off:0.5, f:c3, e:c2},
    {rIn:R*0.14, rOut:R*0.36, w:(Math.PI/n)*0.62, off:0,   f:lerpColor(c1,'#ffffff',0.3), e:c0}
  ];
  const cnt = 1 + Math.min(2, Math.round(p.cmp/3)+1);
  for(let k=0;k<Math.min(rings.length,cnt+1);k++){
    const rg = rings[k];
    for(let i=0;i<n;i++){
      const a = TAU*(i+rg.off)/n - Math.PI/2;
      ctx.beginPath(); petalPath(ctx, a, rg.rIn, rg.rOut, rg.w);
      fillA(ctx, i%2? rg.f : lerpColor(rg.f, rg.e, 0.18), 0.75);
      st(ctx, shade(rg.e,0.3), sw*0.6*(1-k*0.12));
    }
  }
  ctx.beginPath(); circle(ctx,0,0,R*0.13); ribbon(ctx, c0, shade(c0,0.45), sw*1.2+0.6);
  dot(ctx,0,0,R*0.05,c1);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 13. SHAMSA — quyosh medalyoni: yulduz + nurlar + gulli tashqi band */
function drawShamsa(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(6, p.sym);
  /* tashqi bandlar */
  ctx.beginPath(); circle(ctx,0,0,R*0.98); ribbon(ctx, c1, shade(c1,0.45), sw*1.7+1);
  ctx.beginPath(); circle(ctx,0,0,R*0.8); st(ctx, c2, sw*0.5);
  /* tashqi gulbarg bandi 0.8R–0.97R */
  for(let i=0;i<n*2;i++){
    const a = TAU*(i+0.5)/(n*2) - Math.PI/2;
    ctx.beginPath(); petalPath(ctx, a, R*0.8, R*0.955, (Math.PI/(n*2))*0.8);
    fillA(ctx, i%2? c3 : c1, 0.65);
    st(ctx, shade(c0,0.3), sw*0.4);
  }
  /* nurlar — 0.42R dan 0.76R gacha, uzun/qisqa navbat */
  for(let i=0;i<n*2;i++){
    const a = TAU*i/(n*2) - Math.PI/2;
    const long = i%2===0;
    const r0 = R*0.4, len = R*(long? 0.36 : 0.22);
    const s0 = pol(a,r0);
    ctx.beginPath(); leaf(ctx, s0[0], s0[1], a, len, len*0.14);
    fillA(ctx, long? c0 : c2, 0.9);
    st(ctx, shade(long? c0 : c2, 0.3), sw*0.4);
  }
  /* markaziy yulduz o'zagi */
  ctx.beginPath(); circle(ctx,0,0,R*0.42); ribbon(ctx, c2, shade(c2,0.4), sw*1.2+0.6);
  ctx.beginPath(); starPath(ctx, n, R*0.36, R*0.17, -Math.PI/2);
  fillA(ctx, c0, 0.92);
  st(ctx, shade(c0,0.45), sw*0.7);
  ctx.beginPath(); starPath(ctx, n, R*0.2, R*0.1, -Math.PI/2 + Math.PI/n);
  fillA(ctx, c1, 0.95);
  dot(ctx,0,0,R*0.055,c3);
}

/* 14. ARABESQUE — ogee to'r: S-egri lentalar + palmettalar */
function drawArabesque(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(5, p.sym);
  const rIn = R*0.4, rOut = R*0.88;
  /* ogee to'ri: har ichki tugundan ikki qo'shni tashqi tugunga S-egri */
  const inner=[], outer=[];
  for(let i=0;i<n;i++){
    inner.push(pol(TAU*i/n - Math.PI/2, rIn));
    outer.push(pol(TAU*(i+0.5)/n - Math.PI/2, rOut));
  }
  const sCurve=(A,B,dir)=>{
    const mx=(A[0]+B[0])/2, my=(A[1]+B[1])/2;
    const nx=-(B[1]-A[1]), ny=(B[0]-A[0]);
    const L2=Math.hypot(nx,ny)||1;
    const off = R*0.09*dir*(0.6+p.spir);
    ctx.moveTo(A[0],A[1]);
    ctx.bezierCurveTo(
      A[0]*0.6+mx*0.4 + nx/L2*off, A[1]*0.6+my*0.4 + ny/L2*off,
      B[0]*0.6+mx*0.4 - nx/L2*off, B[1]*0.6+my*0.4 - ny/L2*off,
      B[0],B[1]);
  };
  ctx.beginPath();
  for(let i=0;i<n;i++){ sCurve(inner[i], outer[i], 1); }
  ribbon(ctx, c0, shade(c0,0.45), sw*1.6+0.8);
  ctx.beginPath();
  for(let i=0;i<n;i++){ sCurve(inner[(i+1)%n], outer[i], -1); }
  ribbonI(ctx, c1, shade(c1,0.45), sw*1.6+0.8);
  /* tashqi tugunlarda palmetta */
  for(let i=0;i<n;i++){
    const a = TAU*(i+0.5)/n - Math.PI/2;
    budAt(ctx, outer[i][0], outer[i][1], a, R*0.14, c1, c0, sw);
  }
  /* ichki tugunlarda barg juftligi */
  for(let i=0;i<n;i++){
    const a = TAU*i/n - Math.PI/2;
    fineLeaf(ctx, inner[i][0], inner[i][1], a+Math.PI*0.82, R*0.1, R*0.03, c3, shade(c2,0.2), sw*0.4);
    fineLeaf(ctx, inner[i][0], inner[i][1], a-Math.PI*0.82+Math.PI*2, R*0.1, R*0.03, c3, shade(c2,0.2), sw*0.4);
  }
  /* markaz */
  ctx.beginPath(); circle(ctx,0,0,rIn*0.55); ribbon(ctx, c2, shade(c2,0.4), sw*1.2+0.6);
  ctx.beginPath(); starPath(ctx, n, rIn*0.4, rIn*0.22, -Math.PI/2);
  fillA(ctx,c0,0.9);
  dot(ctx,0,0,rIn*0.12,c1);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 15. SCROLL — bargli novda: S-poya + gajak uchi */
function drawScroll(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(3, Math.min(9, p.sym));
  for(let i=0;i<n;i++){
    ctx.save(); ctx.rotate(TAU*i/n);
    const p0=[R*0.16,0], p1=[R*0.36,-R*0.3*(1+p.skew*0.4)], p2=[R*0.58,R*0.3*(1+p.skew*0.4)], p3=[R*0.8,0];
    /* poya nuqtalari */
    const stemPts=[]; for(let j=0;j<=16;j++) stemPts.push(cubicAt(p0,p1,p2,p3,j/16));
    stem(ctx, stemPts, i%2? c1 : c0, sw*1.05);
    /* gajak uchi — kichik spiral */
    const endAng = Math.atan2(stemPts[16][1]-stemPts[15][1], stemPts[16][0]-stemPts[15][0]);
    const curl = spiralPts(0.22, Math.PI*1.6, R*0.14, i%2===1, 0)
      .map(q=>{
        const ca=Math.cos(endAng), sa=Math.sin(endAng);
        return [p3[0]+q[0]*ca-q[1]*sa, p3[1]+q[0]*sa+q[1]*ca];
      });
    stem(ctx, curl, c2, sw*0.7);
    /* navbatlashgan barglar */
    const leaves = 2 + Math.round(p.dens*3);
    for(let j=1;j<=leaves;j++){
      const t = j/(leaves+1);
      const q = cubicAt(p0,p1,p2,p3,t);
      const q2 = cubicAt(p0,p1,p2,p3,Math.min(1,t+0.02));
      const ang = Math.atan2(q2[1]-q[1], q2[0]-q[0]);
      fineLeaf(ctx, q[0], q[1], ang + (j%2? 1:-1)*Math.PI/2.3, R*0.12*(0.7+t*0.5), R*0.035, j%2? c3:c1, shade(c0,0.25), sw*0.45);
    }
    ctx.restore();
  }
  ctx.beginPath(); circle(ctx,0,0,R*0.1); ribbon(ctx, c0, shade(c0,0.45), sw*1.2+0.6);
  dot(ctx,0,0,R*0.04,c1);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 16. MEDALYON — ko'p bandli markaziy medalyon */
function drawMedallion(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(6, p.sym);
  /* tashqi band + scallop */
  ctx.beginPath(); circle(ctx,0,0,R*0.98); ribbon(ctx, c1, shade(c1,0.45), sw*1.7+1);
  ctx.beginPath();
  for(let i=0;i<n*2;i++){
    const a0 = TAU*i/(n*2)-Math.PI/2, a1 = TAU*(i+1)/(n*2)-Math.PI/2;
    const A=pol(a0,R*0.9), M=pol((a0+a1)/2, R*0.82);
    if(i===0) ctx.moveTo(A[0],A[1]);
    const B=pol(a1,R*0.9);
    ctx.bezierCurveTo(A[0]*0.94,A[1]*0.94, M[0],M[1], M[0],M[1]);
    ctx.bezierCurveTo(M[0],M[1], B[0]*0.94,B[1]*0.94, B[0],B[1]);
  }
  ctx.closePath();
  ribbon(ctx, c2, shade(c2,0.4), sw*1.1+0.5);
  /* gulbarg bandi */
  for(let i=0;i<n;i++){
    const a = TAU*i/n - Math.PI/2;
    ctx.beginPath(); petalPath(ctx, a, R*0.5, R*0.8, (Math.PI/n)*0.7);
    fillA(ctx, i%2? c1 : c3, 0.65);
    st(ctx, shade(c0,0.3), sw*0.5);
  }
  /* girih o'zagi */
  ctx.save(); ctx.scale(0.5,0.5);
  drawGirih(ctx, R*0.95, {...p, sym:n}, sw*1.6, c0, c1, c2, c3);
  ctx.restore();
}

/* ═══ CHINNI HOSHIYA BANDI — Rishton lagani uslubidagi ikki qatorli hoshiya ═══ */
function ceramicBorder(ctx,R,p,pal){
  const sw = p.sw;
  /* tashqi qalin band */
  ctx.beginPath(); circle(ctx,0,0,R*0.985); ribbon(ctx, pal.c[1], shade(pal.c[1],0.45), sw*2.6+2);
  ctx.beginPath(); circle(ctx,0,0,R*0.885); ribbon(ctx, pal.c[0], shade(pal.c[0],0.45), sw*1.4+0.8);
  /* band ichida: mini rozetta + romb navbatlashuvi */
  const m = Math.max(12, p.sym*3);
  const rb = R*0.935;
  for(let i=0;i<m;i++){
    const a = TAU*i/m - Math.PI/2;
    const q = pol(a, rb);
    ctx.save(); ctx.translate(q[0],q[1]); ctx.rotate(a+Math.PI/2);
    if(i%2===0){
      ctx.beginPath(); starPath(ctx, 8, R*0.033, R*0.015, 0);
      fillHard(ctx, pal.c[4], 0.95); st(ctx, shade(pal.c[0],0.35), sw*0.35);
      dot(ctx,0,0,R*0.008, pal.c[0]);
    } else {
      ctx.beginPath();
      polyPath(ctx,[[0,-R*0.028],[R*0.02,0],[0,R*0.028],[-R*0.02,0]]);
      fillHard(ctx, pal.c[3], 0.9); st(ctx, shade(pal.c[2],0.25), sw*0.3);
    }
    ctx.restore();
  }
  /* ichki nozik band: scallop + nuqta zanjiri */
  ctx.beginPath();
  const ms = m;
  for(let i=0;i<ms;i++){
    const a0 = TAU*i/ms - Math.PI/2, a1 = TAU*(i+1)/ms - Math.PI/2;
    const A = pol(a0, R*0.84), M = pol((a0+a1)/2, R*0.8), B = pol(a1, R*0.84);
    if(i===0) ctx.moveTo(A[0],A[1]);
    ctx.bezierCurveTo(A[0]*0.97,A[1]*0.97, M[0],M[1], M[0],M[1]);
    ctx.bezierCurveTo(M[0],M[1], B[0]*0.97,B[1]*0.97, B[0],B[1]);
  }
  ctx.closePath();
  st(ctx, shade(pal.c[2],0.15), sw*0.6);
  for(let i=0;i<ms;i++){
    const q = pol(TAU*(i+0.5)/ms - Math.PI/2, R*0.815);
    dot(ctx, q[0], q[1], sw*0.65, pal.c[1]);
  }
  ctx.beginPath(); circle(ctx,0,0,R*0.72); st(ctx, pal.c[2], sw*0.5);
}
/* Chinni (lagan/piyola) kompozitsiyasi: hoshiya bandlari + markaziy medalyon */
function drawPlateComposition(ctx,S,p){
  const pal = PAL[p.pal] || PAL.gold;
  ctx.save();
  ctx.translate(S/2, S/2);
  ceramicBorder(ctx, S*0.49, p, pal);
  ctx.restore();
  drawPattern(ctx, S/2, S/2, S*0.315, p);
}

/* ============================================================
   HANKIN USULI — "poligonlar aloqasi" (polygons-in-contact)
   Har plitka qirrasining O'RTASIDAN kontakt burchagi ostida ikki nur
   chiqadi; qo'shni nurlar kesishmasi strapwork chizig'ini beradi.
   ============================================================ */
function polyArea(poly){
  let a=0;
  for(let i=0;i<poly.length;i++){
    const A=poly[i], B=poly[(i+1)%poly.length];
    a += A[0]*B[1] - B[0]*A[1];
  }
  return a/2;
}
function hankinStraps(polyIn, ang){
  const poly = polyArea(polyIn) < 0 ? polyIn.slice().reverse() : polyIn;
  const m = poly.length, straps=[];
  const mids=[], dirs=[];
  for(let i=0;i<m;i++){
    const A=poly[i], B=poly[(i+1)%m];
    mids.push([(A[0]+B[0])/2,(A[1]+B[1])/2]);
    dirs.push(Math.atan2(B[1]-A[1], B[0]-A[0]));
  }
  for(let i=0;i<m;i++){
    const j=(i+1)%m;
    const X = rayX(mids[i], dirs[i]+ang, mids[j], dirs[j]+Math.PI-ang);
    if(X) straps.push([mids[i], X, mids[j]]);
  }
  return straps;
}
function strokeStraps(ctx, straps, band, edge, w, weave){
  const draw = (sset)=>{
    for(const sp of sset){
      ctx.beginPath();
      ctx.moveTo(sp[0][0],sp[0][1]);
      ctx.lineTo(sp[1][0],sp[1][1]);
      ctx.lineTo(sp[2][0],sp[2][1]);
      weave ? ribbonI(ctx, band, edge, w) : ribbon(ctx, band, edge, w);
    }
  };
  draw(straps);
}
/* 4.8.8 plitkalash geometriyasi (sakkizburchak + kvadrat) */
function tiles488(R, cells){
  const s = R*1.9/cells;
  const oR = s*0.5/Math.cos(Math.PI/8);
  const octs=[], sqs=[];
  const n2 = Math.ceil(cells/2)+1;
  for(let gy=-n2; gy<=n2; gy++){
    for(let gx=-n2; gx<=n2; gx++){
      const x=gx*s, y=gy*s;
      if(Math.hypot(x,y) < R*1.15){
        const o=[]; for(let i=0;i<8;i++) o.push([x+Math.cos(Math.PI/8+TAU*i/8)*oR, y+Math.sin(Math.PI/8+TAU*i/8)*oR]);
        octs.push(o);
      }
      const qx=x+s/2, qy=y+s/2;
      if(Math.hypot(qx,qy) < R*1.15){
        const q = oR*Math.sin(Math.PI/8)*Math.SQRT2;
        sqs.push([[qx,qy-q],[qx+q,qy],[qx,qy+q],[qx-q,qy]]);
      }
    }
  }
  return {octs, sqs, s, oR};
}
/* GIRIH HANKIN 4.8.8 — yulduz-xoch klassikasi (Registon poli uslubi) */
function drawHankin8(ctx,R,p,sw,c0,c1,c2,c3){
  const FIELD = !!p._field;
  const cells = FIELD ? Math.max(2, Math.round(R*1.9/(p._cellpx||150))) : 2 + Math.round(p.dens*2);
  const T = tiles488(R, cells);
  const ang = Math.PI*(0.2 + p.spir*0.18);     /* kontakt burchagi ≈ 36°–68° */
  const edge = shade(c0, 0.5);
  const bw = sw*2.0 + 1.2;
  ctx.save();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.985);
    if(!ctx._svg) ctx.clip();
  }
  /* plitka fonlari */
  for(let i=0;i<T.octs.length;i++){
    ctx.beginPath(); polyPath(ctx, T.octs[i]);
    fillA(ctx, i%2? c3 : lerpColor(c3,'#ffffff',0.4), 0.6);
  }
  for(const q of T.sqs){
    ctx.beginPath(); polyPath(ctx, q);
    fillA(ctx, c1, 0.55);
  }
  /* Hankin straplari: oq/och lenta — haqiqiy girih ko'rinishi */
  const band = lerpColor(c3,'#ffffff',0.75);
  for(const o of T.octs) strokeStraps(ctx, hankinStraps(o, ang), band, edge, bw, false);
  for(const q of T.sqs)  strokeStraps(ctx, hankinStraps(q, ang), band, edge, bw, true);
  ctx.restore();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.985); ribbon(ctx, c1, shade(c1,0.45), sw*2+1.2);
    ctx.beginPath(); circle(ctx,0,0,R*0.9); st(ctx, c2, sw*0.5);
  }
}
/* GIRIH HANKIN 6.6.6 — geksagonal to'rdan 6-yulduzlar */
function drawHankin6(ctx,R,p,sw,c0,c1,c2,c3){
  const FIELD = !!p._field;
  const s = FIELD ? Math.max(30,(p._cellpx||150)*0.5) : R/(1.5 + p.dens*1.6);
  const dx = s*Math.sqrt(3), dy = s*1.5;
  const ang = Math.PI*(0.24 + p.spir*0.16);
  const edge = shade(c0, 0.5);
  const bw = sw*2.0 + 1.2;
  const band = lerpColor(c3,'#ffffff',0.75);
  ctx.save();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.985);
    if(!ctx._svg) ctx.clip();
  }
  const hexes=[];
  const NN = FIELD ? Math.ceil(R/(s*1.5))+1 : 5;
  for(let gy=-NN; gy<=NN; gy++){
    for(let gx=-NN; gx<=NN; gx++){
      const x = gx*dx + (gy%2 ? dx/2 : 0), y = gy*dy;
      if(Math.hypot(x,y) > R*1.15) continue;
      const h=[]; for(let i=0;i<6;i++) h.push([x+Math.cos(Math.PI/6+TAU*i/6)*s, y+Math.sin(Math.PI/6+TAU*i/6)*s]);
      hexes.push({h, gx, gy});
    }
  }
  for(const {h,gx,gy} of hexes){
    ctx.beginPath(); polyPath(ctx, h);
    fillA(ctx, ((gx+gy*2)%3+3)%3===0 ? c1 : ((gx+gy*2)%3+3)%3===1 ? c3 : lerpColor(c3,'#ffffff',0.4), 0.55);
  }
  for(const {h} of hexes) strokeStraps(ctx, hankinStraps(h, ang), band, edge, bw, false);
  ctx.restore();
  if(!FIELD){
    ctx.beginPath(); circle(ctx,0,0,R*0.985); ribbon(ctx, c1, shade(c1,0.45), sw*2+1.2);
  }
}
/* SAKKIZ QIRRALI GIRIH — klassik kvadrat o'quv paneli
   (markaziy 8-yulduz rozetta + kvadrat ramka, to'liq bo'yalgan) */
function drawPanelGirih(ctx,R,p,sw,c0,c1,c2,c3){
  const H = R*0.94;
  const edge = shade(c0, 0.5);
  const bw = sw*2.4 + 1.6;
  const band = lerpColor(c3,'#ffffff',0.8);
  /* tashqi ramka bandlari */
  ctx.beginPath(); polyPath(ctx,[[-H,-H],[H,-H],[H,H],[-H,H]]);
  ribbon(ctx, c1, shade(c1,0.45), bw*1.1);
  const H2 = H*0.88;
  ctx.beginPath(); polyPath(ctx,[[-H2,-H2],[H2,-H2],[H2,H2],[-H2,H2]]);
  fillA(ctx, c3, 0.45);
  ribbon(ctx, c0, edge, bw*0.7);
  /* ramka orasidagi mini-rozetkalar */
  const mm = 4 + Math.round(p.dens*3);
  const rimR = (H+H2)/2;
  for(let side=0; side<4; side++){
    for(let i=1;i<mm;i++){
      const t = i/mm*2 - 1;
      let x,y;
      if(side===0){ x=t*rimR; y=-rimR; } else if(side===1){ x=rimR; y=t*rimR; }
      else if(side===2){ x=t*rimR; y=rimR; } else { x=-rimR; y=t*rimR; }
      dot(ctx,x,y,(H-H2)*0.22, i%2? c0 : band);
    }
  }
  /* burchak choraklari */
  for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
    ctx.beginPath();
    ctx.moveTo(sx*H2, sy*H2);
    ctx.lineTo(sx*H2, sy*H2*0.55);
    ctx.bezierCurveTo(sx*H2*0.8, sy*H2*0.6, sx*H2*0.6, sy*H2*0.8, sx*H2*0.55, sy*H2);
    ctx.closePath();
    fillA(ctx, c0, 0.6);
    st(ctx, edge, sw*0.5);
  }
  /* MARKAZIY 8-YULDUZ ROZETTA: ikki kvadrat + kite gulbarglar */
  const r = H2*0.66;
  /* kite gulbarglar (yulduz uchlaridan tashqariga) */
  const g = {R0:H2*0.92, r2:r*0.78, rm:r*0.9, w:Math.PI/8*0.8};
  for(let i=0;i<8;i++){
    const a = TAU*i/8 - Math.PI/2;
    ctx.beginPath(); kitePath(ctx, a, g);
    fillA(ctx, i%2? c1 : c3, 0.75);
    st(ctx, shade(c2,0.2), sw*0.4);
  }
  /* yulduz maydoni */
  ctx.beginPath(); starPath(ctx, 8, r, r*0.765, -Math.PI/2);
  fillA(ctx, c1, 0.92);
  /* ikki kvadrat — oq lenta straplar (haqiqiy panel uslubi) */
  const sq=(rot)=>{ const q=[]; for(let i=0;i<4;i++) q.push(pol(rot+TAU*i/4, r)); return q; };
  ctx.beginPath(); polyPath(ctx, sq(-Math.PI/2));
  ribbon(ctx, band, edge, bw);
  ctx.beginPath(); polyPath(ctx, sq(-Math.PI/2+Math.PI/4));
  ribbonI(ctx, band, edge, bw);
  /* birinchi kvadratning ikki qarama-qarshi tomoni qayta ustidan — weave */
  const A = sq(-Math.PI/2);
  for(const j of [0,2]){
    const P1=A[j], P2=A[(j+1)%4];
    ctx.beginPath();
    ctx.moveTo(P1[0]+(P2[0]-P1[0])*0.3, P1[1]+(P2[1]-P1[1])*0.3);
    ctx.lineTo(P1[0]+(P2[0]-P1[0])*0.7, P1[1]+(P2[1]-P1[1])*0.7);
    ribbonI(ctx, band, edge, bw);
  }
  /* markaziy sakkizburchak + gul */
  const oct=[]; for(let i=0;i<8;i++) oct.push(pol(-Math.PI/2+Math.PI/8+TAU*i/8, r*0.545));
  ctx.beginPath(); polyPath(ctx, oct);
  fillA(ctx, c0, 0.9);
  st(ctx, edge, sw*0.5);
  for(let i=0;i<8;i++){
    ctx.beginPath();
    petalPath(ctx, TAU*i/8 - Math.PI/2, r*0.1, r*0.42, Math.PI/8*0.62);
    fillA(ctx, band, 0.9);
    st(ctx, shade(c1,0.3), sw*0.35);
  }
  dot(ctx,0,0,r*0.09,c1);
}
/* STAKAN uchun FRIZ kompozitsiyasi — gorizontal band, chokka mos takror */
function drawFriezeComposition(ctx,S,p){
  const pal = PAL[p.pal] || PAL.gold;
  const line=(y,w,col)=>{
    ctx.beginPath(); ctx.moveTo(-6,y); ctx.lineTo(S+6,y);
    ribbon(ctx, col, shade(col,0.45), w);
  };
  line(S*0.14, p.sw*2.4+1.6, pal.c[1]);
  line(S*0.225, p.sw*1.2+0.6, pal.c[0]);
  line(S*0.775, p.sw*1.2+0.6, pal.c[0]);
  line(S*0.86, p.sw*2.4+1.6, pal.c[1]);
  /* band foni — naqsh tagida yengil tus */
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = pal.c[4];
  ctx.fillRect(0, S*0.27, S, S*0.46);
  ctx.restore();
  /* motif qatori — zichroq, teng qadam: chokda uzilmaydi */
  const m = Math.max(6, Math.min(12, p.sym));
  for(let i=0;i<m;i++){
    drawPattern(ctx, (i+0.5)*S/m, S*0.5, (S/m)*0.42, {...p, lay:1});
  }
  /* ajratkich romblar (chok nuqtasida ham) */
  for(let i=0;i<=m;i++){
    const x = i*S/m;
    ctx.beginPath();
    polyPath(ctx,[[x,S*0.5-S*0.045],[x+S*0.026,S*0.5],[x,S*0.5+S*0.045],[x-S*0.026,S*0.5]]);
    fillHard(ctx, pal.c[1], 0.95);
    st(ctx, shade(pal.c[1],0.4), p.sw*0.4);
  }
  /* yuqori nuqta zanjiri */
  for(let i=0;i<m*3;i++){
    const x = (i+0.5)*S/(m*3);
    dot(ctx, x, S*0.185, p.sw*0.7, pal.c[0]);
    dot(ctx, x, S*0.815, p.sw*0.7, pal.c[0]);
  }
}
/* ============================================================
   C. KOMBINATSIYALAR (4) — tashqi uslub + ichki uslub (0.5R)
   ============================================================ */
function makeCombo(fA,fB){
  return function(ctx,R,p,sw,c0,c1,c2,c3){
    fA(ctx,R,p,sw,c0,c1,c2,c3);
    ctx.save();
    ctx.scale(0.5,0.5);
    ctx.rotate(Math.PI/Math.max(3,p.sym));
    fB(ctx,R,p,sw*1.7,c1,c0,c3,c2);
    ctx.restore();
  };
}
function drawGirihIslimiy(ctx,R,p,sw,c0,c1,c2,c3){ makeCombo(drawGirih,drawIslimiy)(ctx,R,p,sw,c0,c1,c2,c3); }
function drawShamsaGirih(ctx,R,p,sw,c0,c1,c2,c3){ makeCombo(drawShamsa,drawGirih)(ctx,R,p,sw,c0,c1,c2,c3); }
function drawMuqarnasIslimiy(ctx,R,p,sw,c0,c1,c2,c3){ makeCombo(drawMuqarnas,drawIslimiy)(ctx,R,p,sw,c0,c1,c2,c3); }
function drawXatamRumi(ctx,R,p,sw,c0,c1,c2,c3){ makeCombo(drawXatam,drawRumi)(ctx,R,p,sw,c0,c1,c2,c3); }

/* ============================================================
   D. DUNYO NAQSHLARI (8)
   ============================================================ */

/* 21. Celtic — 2 tolali torus o'rmasi: haqiqiy navbatlashgan to'qish */
function drawCeltic(ctx,R,p,sw,c0,c1,c2,c3){
  const k = Math.max(4, p.sym);               /* kesishishlar soni = 2k */
  const rm = R*0.66, a = R*(0.14 + p.dens*0.1);
  const bw = sw*2.6 + 2;
  const strandSeg = (phase, j)=>{             /* j-segment: θ ∈ [jπ/k, (j+1)π/k] */
    const pts=[];
    const steps = 14;
    for(let i=0;i<=steps;i++){
      const th = (j + i/steps)*Math.PI/k;
      pts.push(pol(th - Math.PI/2, rm + a*Math.sin(k*th + phase)));
    }
    ctx.beginPath(); smoothPath(ctx, pts, false);
  };
  /* ikki tola, 2k segment; naqsh navbatlashadi: (tola + j) juft → ostda, toq → ustda */
  for(let pass=0; pass<2; pass++){
    for(let strand=0; strand<2; strand++){
      const phase = strand*Math.PI;
      const col = strand? c1 : c0;
      for(let j=0; j<2*k; j++){
        if(((strand + j) % 2) !== pass) continue;
        strandSeg(phase, j);
        if(pass===0) ribbon(ctx, col, shade(col,0.5), bw);
        else ribbonI(ctx, col, shade(col,0.5), bw);
      }
    }
  }
  /* ichki/tashqi chegara bandlari */
  ctx.beginPath(); circle(ctx,0,0, rm - a - bw*0.9); ribbon(ctx, c2, shade(c2,0.4), sw*1.2+0.6);
  ctx.beginPath(); circle(ctx,0,0, rm + a + bw*0.9); ribbon(ctx, c2, shade(c2,0.4), sw*1.2+0.6);
  /* markaziy tugma */
  if(p.cmp>=3){
    ctx.beginPath(); starPath(ctx, k, (rm-a)*0.5, (rm-a)*0.28, -Math.PI/2);
    fillA(ctx, c3, 0.8); st(ctx, shade(c0,0.35), sw*0.5);
    dot(ctx,0,0,(rm-a)*0.12,c0);
  }
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 22. Mandala — konsentrik halqalar, har halqada boshqa element */
function drawMandala(ctx,R,p,sw,c0,c1,c2,c3){
  const rings = Math.max(6, Math.min(12, 5 + p.cmp + Math.round(p.dens*2)));
  const cols = [c0,c1,c2,c3];
  for(let k=0;k<rings;k++){
    const t = k/(rings-1);
    const r = R*(0.12 + 0.85*t);
    const m = Math.max(6, Math.round(p.sym*(1 + t*1.5)));
    const col = cols[k%4];
    const kind = k%5;
    if(kind===0){
      for(let i=0;i<m;i++){ const c=pol(TAU*i/m, r); dot(ctx,c[0],c[1], R*0.014+sw*0.5, col); }
    } else if(kind===1){
      const step = R*0.85/(rings-1);
      for(let i=0;i<m;i++){
        ctx.beginPath();
        petalPath(ctx, TAU*i/m, r-step*0.5, r+step*0.55, (Math.PI/m)*0.75);
        fillA(ctx,col,0.5); st(ctx, c0, sw*0.5);
      }
    } else if(kind===2){
      ctx.beginPath();
      const pts=[];
      for(let i=0;i<=m*6;i++){
        const a = TAU*i/(m*6);
        pts.push(pol(a, r*(1 + 0.035*Math.sin(a*m + k))));
      }
      smoothPath(ctx,pts,true);
      st(ctx,col,sw*0.7);
    } else if(kind===3){
      const step = R*0.85/(rings-1);
      for(let i=0;i<m;i++){
        const a = TAU*(i+0.5)/m, c = pol(a,r);
        ctx.beginPath(); leaf(ctx, c[0], c[1], a, step*0.9, step*0.28*(1+p.spir));
        fillA(ctx,col,0.7); st(ctx,c0,sw*0.4);
      }
    } else {
      ctx.beginPath(); circle(ctx,0,0,r); st(ctx,col,sw*0.55);
    }
  }
  dot(ctx,0,0,R*0.05,c0);
}

/* 23. Penrose — kite/dart aperiodik subdivide, oltin nisbat */
function drawPenrose(ctx,R,p,sw,c0,c1,c2,c3){
  const PHI = 1.6180339887;
  let tris = [];
  for(let i=0;i<10;i++){
    let B = pol(TAU*(2*i-1)/20 - Math.PI/2, R*0.98);
    let C = pol(TAU*(2*i+1)/20 - Math.PI/2, R*0.98);
    if(i%2===0){ const t=B; B=C; C=t; }
    tris.push([0,[0,0],B,C]);
  }
  const depth = Math.max(1, Math.min(6, p.cmp));
  const div = (x1,x2,f)=>[x1[0]+(x2[0]-x1[0])/f, x1[1]+(x2[1]-x1[1])/f];
  for(let d=0; d<depth; d++){
    const next=[];
    for(const T of tris){
      const [ty,A,B,C] = T;
      if(ty===0){
        const Pp = div(A,B,PHI);
        next.push([0,C,Pp,B],[1,Pp,C,A]);
      } else {
        const Q = div(B,A,PHI), Rr = div(B,C,PHI);
        next.push([1,Rr,C,A],[0,Q,Rr,B],[1,Rr,Q,A]);
      }
    }
    tris = next;
  }
  for(const T of tris){
    const [ty,A,B,C] = T;
    ctx.beginPath(); polyPath(ctx,[A,B,C]);
    fillA(ctx, ty? c1:c3, 0.75);
    st(ctx, c0, sw*0.4);
  }
  ctx.beginPath(); circle(ctx,0,0,R*0.99); st(ctx,c2,sw);
}

/* 24. Zellige — Marokash kafel: egri tomonli romblar, 5 rang */
function drawZellige(ctx,R,p,sw,c0,c1,c2,c3){
  const FIELD = !!p._field;
  const palc = PAL[p.pal] ? PAL[p.pal].c : [c0,c1,c2,c3,c0];
  const s = FIELD ? Math.max(30,(p._cellpx||150)*0.55) : R/(1.6 + p.dens*2.2);
  const bow = s*0.2*(0.4 + p.spir);
  const curvedQuad = (pts)=>{
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=0;i<4;i++){
      const A=pts[i], B=pts[(i+1)%4];
      const mx=(A[0]+B[0])/2, my=(A[1]+B[1])/2;
      const nx=-(B[1]-A[1]), ny=(B[0]-A[0]);
      const L=Math.hypot(nx,ny)||1;
      const sgn = i%2? 1:-1;
      const cx2=mx+nx/L*bow*sgn, cy2=my+ny/L*bow*sgn;
      ctx.bezierCurveTo(
        A[0]+(cx2-A[0])*0.7, A[1]+(cy2-A[1])*0.7,
        B[0]+(cx2-B[0])*0.7, B[1]+(cy2-B[1])*0.7,
        B[0],B[1]);
    }
    ctx.closePath();
  };
  const NZ = FIELD ? Math.ceil(R/(s*0.5))+2 : 4;
  for(let gy=-NZ; gy<=NZ; gy++){
    for(let gx=-NZ; gx<=NZ; gx++){
      const x = (gx+gy)*s*0.5*1.6, y = (gy-gx)*s*0.5;
      if(Math.hypot(x,y) > R*(FIELD?1.5:1.03)) continue;
      const q=[[x,y-s*0.5],[x+s*0.8,y],[x,y+s*0.5],[x-s*0.8,y]];
      ctx.beginPath(); curvedQuad(q);
      const ci = ((gx%5)+(gy*2%5)+10)%5;
      fillA(ctx, palc[ci], 0.85);
      st(ctx, c0, sw*0.6);
      if(p.cmp>=5){ dot(ctx,x,y,s*0.07,palc[(ci+2)%5]); }
    }
  }
  if(!FIELD){ ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c0,sw); }
}

/* 25. Batik — to'lqinli konsentrik halqalar + gul motivlari */
function drawBatik(ctx,R,p,sw,c0,c1,c2,c3){
  const rings = 3 + Math.min(5, p.cmp);
  const n = Math.max(4,p.sym);
  const A = R*0.035*(0.6 + p.dens);
  for(let k=0;k<rings;k++){
    const rk = R*(0.18 + 0.8*k/(rings-1||1));
    const pts=[];
    const steps = Math.max(48, n*10);
    for(let i=0;i<steps;i++){
      const a = TAU*i/steps;
      pts.push(pol(a, rk + A*Math.sin(n*a + k*1.3 + p.skew)));
    }
    ctx.beginPath(); smoothPath(ctx,pts,true);
    st(ctx, k%2? c1:c0, sw*(0.7 + 0.3*(k%2)));
    if(k%2===1 && k<rings-1){
      const m = n + k;
      for(let i=0;i<m;i++){
        const c = pol(TAU*(i+0.3)/m, rk + R*0.35/rings);
        for(let j=0;j<5;j++){
          const q = pol(TAU*j/5, R*0.028*(1+p.spir));
          dot(ctx, c[0]+q[0], c[1]+q[1], R*0.014, c3);
        }
        dot(ctx,c[0],c[1],R*0.012,c2);
      }
    }
  }
  dot(ctx,0,0,R*0.05*p.ir*2+2,c0);
}

/* 26. Paisley — buta/tomchi: 4 Bezier teardrop, ichida spiral */
function drawPaisley(ctx,R,p,sw,c0,c1,c2,c3){
  const n = Math.max(3,p.sym);
  for(let i=0;i<n;i++){
    ctx.save();
    ctx.rotate(TAU*i/n);
    ctx.translate(R*0.52, 0);
    ctx.rotate(Math.PI/2 + p.skew*0.6);
    const L = R*0.42*(0.8+p.dens*0.4), W = L*0.58;
    /* boteh: 4 Bezier — asimmetrik tomchi, uchi bukilgan */
    ctx.beginPath();
    ctx.moveTo(0, L*0.5);
    ctx.bezierCurveTo(-W, L*0.5, -W, -L*0.35, -W*0.25, -L*0.62);
    ctx.bezierCurveTo(-W*0.05, -L*0.75, W*0.3, -L*0.78, W*0.38, -L*0.6);
    ctx.bezierCurveTo(W*0.44, -L*0.46, W*0.1, -L*0.42, W*0.12, -L*0.28);
    ctx.bezierCurveTo(W*0.55, -L*0.05, W*0.62, L*0.32, 0, L*0.5);
    ctx.closePath();
    fillA(ctx, i%2?c1:c3, 0.55);
    ribbonI(ctx, c0, shade(c0,0.5), sw*1.8+1);
    /* ichki hoshiya konturi */
    ctx.save(); ctx.scale(0.82,0.82);
    ctx.beginPath();
    ctx.moveTo(0, L*0.5);
    ctx.bezierCurveTo(-W, L*0.5, -W, -L*0.35, -W*0.25, -L*0.62);
    ctx.bezierCurveTo(-W*0.05, -L*0.75, W*0.3, -L*0.78, W*0.38, -L*0.6);
    ctx.bezierCurveTo(W*0.44, -L*0.46, W*0.1, -L*0.42, W*0.12, -L*0.28);
    ctx.bezierCurveTo(W*0.55, -L*0.05, W*0.62, L*0.32, 0, L*0.5);
    ctx.closePath();
    ctx.restore();
    st(ctx, shade(c2,0.2), sw*0.45);
    /* ichki spiral */
    const sp = spiralPts(0.16+p.spir*0.2, Math.PI*2.1, L*0.42, i%2===1, 0);
    ctx.beginPath(); smoothPath(ctx, sp.map(q=>[q[0], q[1]+L*0.05]), false);
    st(ctx, c2, sw*0.6);
    /* uchidagi 5-barg gul */
    for(let j=0;j<5;j++){
      const q = pol(TAU*j/5, L*0.1);
      dot(ctx, q[0]-W*0.05, q[1]-L*0.7, L*0.055, c1);
    }
    dot(ctx, -W*0.05, -L*0.7, L*0.045, c0);
    /* chekka nuqta bezaklari */
    if(p.cmp>=4){
      for(let j=0;j<7;j++){
        const t = j/6;
        dot(ctx, -W*(1.12), L*0.4 - t*L*0.8, sw*0.8, c2);
      }
    }
    ctx.restore();
  }
  ctx.beginPath(); circle(ctx,0,0,R*p.ir*0.4+2); st(ctx,c0,sw*0.7);
}

/* 27. Greek Key — meander labirint, konsentrik kvadrat ramkalar */
function drawGreek(ctx,R,p,sw,c0,c1,c2,c3){
  const frames = 2 + Math.min(4, Math.round(p.cmp/2));
  const meanderSide = (x0,y0,x1,y1,units,h)=>{
    const dx=(x1-x0)/units, dy=(y1-y0)/units;
    const nx=-dy, ny=dx; /* ichkariga normal */
    const L=Math.hypot(nx,ny)||1;
    const hx=nx/L*h, hy=ny/L*h;
    for(let u=0;u<units;u++){
      const bx=x0+dx*u, by=y0+dy*u;
      const s=[[0,0],[0.72,0],[0.72,0.72],[0.24,0.72],[0.24,0.3],[0.48,0.3],[0.48,0.52],[1,0.52]];
      ctx.moveTo(bx,by);
      for(const q of s){
        ctx.lineTo(bx+dx*q[0]+hx*q[1], by+dy*q[0]+hy*q[1]);
      }
    }
  };
  for(let k=0;k<frames;k++){
    const half = R*0.68*(1 - k*0.24);
    if(half < R*0.1) break;
    const units = Math.max(3, Math.round(p.sym*(0.5+p.dens*0.5)) - k);
    const h = half*0.28;
    const c=[[-half,-half],[half,-half],[half,half],[-half,half]];
    ctx.beginPath();
    for(let e=0;e<4;e++){
      const A=c[e], B=c[(e+1)%4];
      meanderSide(A[0],A[1],B[0],B[1],units,h);
    }
    st(ctx, k%2?c1:c0, sw*(1-k*0.1));
    ctx.beginPath(); polyPath(ctx,c);
    st(ctx, c2, sw*0.5);
  }
  ctx.beginPath(); starPath(ctx, 4, R*p.ir*0.35, R*p.ir*0.15, Math.PI/4);
  fillA(ctx,c3,0.8); st(ctx,c0,sw*0.7);
}

/* 28. Xitoy panjara — fretwork kataklar, T-shakl bo'linmalar */
function drawXitoy(ctx,R,p,sw,c0,c1,c2,c3){
  const FIELD = !!p._field;
  const half = FIELD ? R*1.42 : R*0.92;
  const cells = FIELD ? Math.max(2, Math.round(half*2/(p._cellpx||150))) : Math.max(2, Math.round(2 + p.dens*3));
  const s = half*2/cells;
  ctx.beginPath();
  polyPath(ctx,[[-half,-half],[half,-half],[half,half],[-half,half]]);
  st(ctx,c0,sw*1.4);
  ctx.beginPath();
  for(let i=1;i<cells;i++){
    ctx.moveTo(-half+i*s,-half); ctx.lineTo(-half+i*s,half);
    ctx.moveTo(-half,-half+i*s); ctx.lineTo(half,-half+i*s);
  }
  st(ctx,c0,sw*0.9);
  /* har katakda T-motivlar navbatlashgan yo'nalishda */
  const tLen = s*0.34*(0.6+p.ir), tBar = s*0.24;
  for(let gy=0; gy<cells; gy++){
    for(let gx=0; gx<cells; gx++){
      const cx = -half + gx*s + s/2, cy = -half + gy*s + s/2;
      const rot = ((gx+gy)%4) * Math.PI/2 + p.skew*0.4;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
      ctx.beginPath();
      /* T ning oyog'i katak CHEGARASIGACHA boradi — panjara bilan
         tutashadi. Ilgari u faqat tLen gacha chizilar va motiv katak
         ichida "suzib" qolardi: naqsh uzilgan ko'rinardi, lazerda
         kesilganda esa bunday bo'lak paneldan tushib ketardi. */
      ctx.moveTo(0,-s/2); ctx.lineTo(0,tLen*0.2);
      ctx.moveTo(-tBar,tLen*0.2); ctx.lineTo(tBar,tLen*0.2);
      ctx.moveTo(-tBar,tLen*0.2); ctx.lineTo(-tBar,tLen*0.62);
      ctx.moveTo(tBar,tLen*0.2); ctx.lineTo(tBar,tLen*0.62);
      ctx.restore();
      st(ctx, (gx+gy)%2? c1:c2, sw*0.75);
      /* Burchak qavslari — TO'RTALA burchakda, katakdan biroz ichkarida.
         Ilgari faqat ikki qarama-qarshi burchakda chizilar va ular
         panjara chizig'i ustiga tushib, tasodifiy chiziqchalardek
         ko'rinardi. To'rttasi birgalikda ichki ramka hosil qiladi —
         xitoy fretworkidagi klassik motiv. */
      if(p.cmp>=4){
        ctx.beginPath();
        const q = s*0.15, inn = s*0.06, h2 = s/2 - inn;
        for(const [sx2, sy2] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
          const px = cx + sx2*h2, py = cy + sy2*h2;
          ctx.moveTo(px - sx2*q, py); ctx.lineTo(px, py); ctx.lineTo(px, py - sy2*q);
        }
        st(ctx,c3,sw*0.6);
      }
    }
  }
}

/* ============================================================
   E. MATEMATIK FRAKTALLAR (7)
   ============================================================ */

/* 29. Koch qor parchasi */
function drawKoch(ctx,R,p,sw,c0,c1,c2,c3){
  const depth = Math.max(1, Math.min(5, p.cmp));
  let pts = [];
  for(let i=0;i<3;i++) pts.push(pol(TAU*i/3 - Math.PI/2, R*0.85));
  for(let d=0; d<depth; d++){
    const next=[];
    for(let i=0;i<pts.length;i++){
      const A=pts[i], B=pts[(i+1)%pts.length];
      const dx=(B[0]-A[0])/3, dy=(B[1]-A[1])/3;
      const P1=[A[0]+dx, A[1]+dy], P3=[A[0]+2*dx, A[1]+2*dy];
      const ang = Math.atan2(dy,dx) - Math.PI/3;
      const L = Math.hypot(dx,dy);
      const P2=[P1[0]+Math.cos(ang)*L, P1[1]+Math.sin(ang)*L];
      next.push(A,P1,P2,P3);
    }
    pts = next;
  }
  ctx.beginPath(); polyPath(ctx,pts);
  fillA(ctx,c3,0.35); iStroke(ctx,c0,sw*0.8);
  ctx.beginPath(); circle(ctx,0,0,R*p.ir*0.5);
  st(ctx,c2,sw*0.6);
  dot(ctx,0,0,R*0.03,c1);
}

/* 30. Sierpinski uchburchagi */
function drawSierpinski(ctx,R,p,sw,c0,c1,c2,c3){
  const depth = Math.max(1, Math.min(6, p.cmp));
  const A=pol(-Math.PI/2,R*0.92), B=pol(Math.PI/6,R*0.92), C=pol(Math.PI*5/6,R*0.92);
  const mid=(u,v)=>[(u[0]+v[0])/2,(u[1]+v[1])/2];
  const rec=(a,b,c,d)=>{
    if(d===0){
      ctx.beginPath(); polyPath(ctx,[a,b,c]);
      fillA(ctx, d%2?c1:c3, 0.7); st(ctx,c0,sw*0.35);
      return;
    }
    rec(a,mid(a,b),mid(a,c),d-1);
    rec(mid(a,b),b,mid(b,c),d-1);
    rec(mid(a,c),mid(b,c),c,d-1);
  };
  rec(A,B,C,depth);
  ctx.beginPath(); polyPath(ctx,[A,B,C]); st(ctx,c0,sw);
}

/* 31. Dragon curve — L-sistema: F→F+G, G→F−G */
function drawDragon(ctx,R,p,sw,c0,c1,c2,c3){
  const iters = 8 + Math.min(5, p.cmp);
  let seq = 'F';
  for(let d=0; d<iters; d++){
    let next='';
    for(const ch of seq){
      if(ch==='F') next += 'F+G';
      else if(ch==='G') next += 'F-G';
      else next += ch;
    }
    seq = next;
    if(seq.length > 40000) break;
  }
  let x=0,y=0,ang=0;
  const pts=[[0,0]];
  let minX=0,maxX=0,minY=0,maxY=0;
  for(const ch of seq){
    if(ch==='F' || ch==='G'){
      x += Math.cos(ang); y += Math.sin(ang);
      pts.push([x,y]);
      if(x<minX)minX=x; if(x>maxX)maxX=x;
      if(y<minY)minY=y; if(y>maxY)maxY=y;
    }
    else if(ch==='+') ang += Math.PI/2;
    else if(ch==='-') ang -= Math.PI/2;
  }
  const w=maxX-minX||1, h=maxY-minY||1;
  const sc = R*1.7/Math.max(w,h);
  const ox=(minX+maxX)/2, oy=(minY+maxY)/2;
  ctx.beginPath();
  ctx.moveTo((pts[0][0]-ox)*sc, (pts[0][1]-oy)*sc);
  for(let i=1;i<pts.length;i++) ctx.lineTo((pts[i][0]-ox)*sc, (pts[i][1]-oy)*sc);
  st(ctx, c0, sw*0.6);
  ctx.beginPath(); circle(ctx,0,0,R); st(ctx,c2,sw*0.5);
}

/* 32. Hilbert space-filling curve */
function drawHilbert(ctx,R,p,sw,c0,c1,c2,c3){
  const order = Math.max(2, Math.min(6, 1 + Math.round(p.cmp*0.8)));
  const N = 1<<order;
  const d2xy = (d)=>{
    let rx, ry, t=d, x=0, y=0;
    for(let s=1; s<N; s*=2){
      rx = 1 & (t/2); ry = 1 & (t ^ rx);
      if(ry===0){
        if(rx===1){ x=s-1-x; y=s-1-y; }
        const tmp=x; x=y; y=tmp;
      }
      x += s*rx; y += s*ry;
      t = Math.floor(t/4);
    }
    return [x,y];
  };
  const total = N*N;
  const sc = R*1.7/(N-1);
  ctx.beginPath();
  for(let d=0; d<total; d++){
    const q = d2xy(d);
    const px = (q[0]-(N-1)/2)*sc, py=(q[1]-(N-1)/2)*sc;
    if(d===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  st(ctx, c0, sw*0.55);
  ctx.beginPath();
  polyPath(ctx,[[-R*0.92,-R*0.92],[R*0.92,-R*0.92],[R*0.92,R*0.92],[-R*0.92,R*0.92]]);
  st(ctx,c2,sw*0.6);
}

/* 33. Spirograph — epitrochoid */
function drawSpirograph(ctx,R,p,sw,c0,c1,c2,c3){
  const R0 = R*0.62;
  /* Gipotroxoida: r = R0·a/b (a va b o'zaro tub) → egri b ta cho'qqili
     bo'lib, a ta aylanishdan keyin yopiladi.
     DIQQAT — DEGENERATSIYA: b = 2a bo'lganda (R0−r)/r = 1 va egri
     ELLIPSGA aylanadi; d ≈ r bo'lsa esa TO'G'RI CHIZIQQA siqiladi.
     Eski formulada kNum = sym−2, kDen = sym+cmp edi va standart
     qiymatlarda (sym 8, cmp 4) aynan kDen = 2·kNum chiqib qolardi —
     shuning uchun spirograf o'rniga to'g'ri chiziqlar chizilardi.
     Endi bu holat aniq chetlab o'tiladi. */
  const gcd = (x, y)=>{ x = Math.abs(x); y = Math.abs(y); while(y){ const t = y; y = x % y; x = t; } return x || 1; };
  let b = Math.max(3, p.sym | 0);
  let a = 1 + ((p.cmp | 0) % Math.max(1, b - 1));
  const g0 = gcd(a, b); a = a/g0; b = b/g0;
  if(b === 2*a) b += 1;                     /* ellips/chiziqqa aylanmasin */
  if(a >= b) a = 1;
  const r = R0*a/b;
  const d = r*(0.45 + p.spir*1.1);
  const loops = a;
  const steps = Math.max(480, 180*b);
  const pts=[];
  let maxR=0;
  for(let i=0;i<=steps;i++){
    const t = TAU*loops*i/steps;
    const x=(R0-r)*Math.cos(t) + d*Math.cos((R0-r)*t/r);
    const y=(R0-r)*Math.sin(t) - d*Math.sin((R0-r)*t/r);
    pts.push([x,y]);
    const rr=Math.hypot(x,y); if(rr>maxR)maxR=rr;
  }
  const sc = R*0.95/(maxR||1);
  ctx.beginPath();
  smoothPath(ctx, pts.map(q=>[q[0]*sc,q[1]*sc]), false);
  st(ctx, c0, sw*0.55);
  ctx.beginPath(); circle(ctx,0,0,R*0.98); st(ctx,c2,sw*0.5);
  dot(ctx,0,0,R*0.03,c1);
}

/* 34. Lissajous */
function drawLissajous(ctx,R,p,sw,c0,c1,c2,c3){
  const a = Math.max(1,p.sym-3), b = a + Math.max(1,Math.round(p.cmp/2));
  const del = Math.PI/2 * (1 + p.skew);
  const steps = 400;
  const pts=[];
  for(let i=0;i<=steps;i++){
    const t = TAU*i/steps;
    pts.push([R*0.88*Math.sin(a*t+del), R*0.88*Math.sin(b*t)]);
  }
  ctx.beginPath(); smoothPath(ctx,pts,true);
  st(ctx, c0, sw*0.6);
  if(p.dens>0.5){
    const pts2 = pts.map(q=>[q[0]*0.7, q[1]*0.7]);
    ctx.beginPath(); smoothPath(ctx,pts2,true);
    st(ctx, c1, sw*0.45);
  }
  ctx.beginPath();
  polyPath(ctx,[[-R*0.95,-R*0.95],[R*0.95,-R*0.95],[R*0.95,R*0.95],[-R*0.95,R*0.95]]);
  st(ctx,c2,sw*0.4);
}

/* 35. Voronoi — seed nuqtalardan hujayra mozaika */
function mulberry32(seed){
  let t = seed>>>0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t>>>15), 1 | t);
    x ^= x + Math.imul(x ^ (x>>>7), 61 | x);
    return ((x ^ (x>>>14)) >>> 0) / 4294967296;
  };
}
function clipHalfPlane(poly, px, py, nx, ny){
  /* n·(q - p) <= 0 tomonini saqlaydi */
  const out=[];
  for(let i=0;i<poly.length;i++){
    const A=poly[i], B=poly[(i+1)%poly.length];
    const da=(A[0]-px)*nx + (A[1]-py)*ny;
    const db=(B[0]-px)*nx + (B[1]-py)*ny;
    if(da<=0) out.push(A);
    if((da<0 && db>0) || (da>0 && db<0)){
      const t = da/(da-db);
      out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]);
    }
  }
  return out;
}
function drawVoronoi(ctx,R,p,sw,c0,c1,c2,c3){
  const palc = PAL[p.pal] ? PAL[p.pal].c : [c0,c1,c2,c3,c0];
  const rnd = mulberry32(1000 + p.sym*31 + p.cmp*7 + Math.round(p.dens*100)*13 + Math.round(p.spir*100)*3);
  const m = 8 + p.cmp*4 + Math.round(p.dens*14);
  const seeds=[];
  for(let i=0;i<m;i++){
    const a = rnd()*TAU, rr = Math.sqrt(rnd())*R*0.92;
    seeds.push(pol(a,rr));
  }
  /* boshlang'ich poligon — R ga chizilgan 16-burchak */
  const base=[]; for(let i=0;i<16;i++) base.push(pol(TAU*i/16, R*0.98));
  for(let i=0;i<m;i++){
    let cell = base.slice();
    const S = seeds[i];
    for(let j=0;j<m && cell.length;j++){
      if(j===i) continue;
      const T = seeds[j];
      const mx=(S[0]+T[0])/2, my=(S[1]+T[1])/2;
      const nx=T[0]-S[0], ny=T[1]-S[1];
      cell = clipHalfPlane(cell, mx,my, nx,ny);
    }
    if(cell.length<3) continue;
    ctx.beginPath(); polyPath(ctx,cell);
    fillA(ctx, palc[i%5], 0.75);
    st(ctx, c0, sw*0.55);
    if(p.cmp>=5) dot(ctx, S[0], S[1], sw*0.9, c2);
  }
  ctx.beginPath(); circle(ctx,0,0,R*0.99); st(ctx,c0,sw*0.9);
}

/* ════════════════════════════════════════════════════════════════════════
   NaqshAI — PIC GEOMETRIYA YADROSI  (Polygons-In-Contact / Hankin usuli)
   ------------------------------------------------------------------------
   Klassik girih qurilishi. Bosqichlar:
     1. PLITKALASH  — davriy (yoki radial) plitka to'ri, qat'iy qirra-qirraga
     2. KONTAKT     — har qirra o'rtasidan δ burchagi ostida ikki nur
     3. GLOBAL GRAF — barcha segmentlar bitta grafda, dedup + tugun birlashtirish
     4. IP (STRAND) — kesishishlarda davomiylik bo'yicha uzluksiz ip ajratish
     5. TO'QISH     — har ip bo'ylab ust/ost navbatlashishi
   Chiqishi sof ma'lumot: {tiles, strands, crossings, cores, period}
   Chizish bu ma'lumotdan keyin, alohida bosqichda (picRender).
   ════════════════════════════════════════════════════════════════════════ */
var TAU2 = Math.PI * 2;
var SQ3 = Math.sqrt(3);

/* ---------- kichik vektor yordamchilari ---------- */
function vAdd(a,b){ return [a[0]+b[0], a[1]+b[1]]; }
function vSub(a,b){ return [a[0]-b[0], a[1]-b[1]]; }
function vMul(a,k){ return [a[0]*k, a[1]*k]; }
function vLen(a){ return Math.hypot(a[0],a[1]); }
function vNorm(a){ var l=vLen(a)||1; return [a[0]/l, a[1]/l]; }
function vDot(a,b){ return a[0]*b[0]+a[1]*b[1]; }
function polyCentroid(p){
  var x=0,y=0;
  for(var i=0;i<p.length;i++){ x+=p[i][0]; y+=p[i][1]; }
  return [x/p.length, y/p.length];
}
function ngon(cx,cy,r,n,rot){
  var q=[];
  for(var i=0;i<n;i++){ var a=rot+TAU2*i/n; q.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); }
  return q;
}
/* Ikki nur kesishmasi (nuqta + yo'nalish vektori) */
function rayCross(p,d,q,e){
  var den = d[0]*e[1] - d[1]*e[0];
  if(Math.abs(den) < 1e-12) return null;
  var t = ((q[0]-p[0])*e[1] - (q[1]-p[1])*e[0]) / den;
  return [p[0]+d[0]*t, p[1]+d[1]*t];
}
/* bbox ni qoplaydigan panjara nuqtalari: P = i·v1 + j·v2 */
function latticePoints(v1,v2,bb,margin){
  var det = v1[0]*v2[1] - v1[1]*v2[0];
  if(Math.abs(det) < 1e-9) return [];
  var m = margin||0;
  var x0=bb.x0-m, y0=bb.y0-m, x1=bb.x1+m, y1=bb.y1+m;
  var corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  var iMin=Infinity,iMax=-Infinity,jMin=Infinity,jMax=-Infinity;
  for(var k=0;k<4;k++){
    var c=corners[k];
    var i=( c[0]*v2[1] - c[1]*v2[0])/det;
    var j=(-c[0]*v1[1] + c[1]*v1[0])/det;
    iMin=Math.min(iMin,i); iMax=Math.max(iMax,i);
    jMin=Math.min(jMin,j); jMax=Math.max(jMax,j);
  }
  var out=[];
  for(var jj=Math.floor(jMin)-1; jj<=Math.ceil(jMax)+1; jj++)
    for(var ii=Math.floor(iMin)-1; ii<=Math.ceil(iMax)+1; ii++)
      out.push({i:ii, j:jj, p:[ii*v1[0]+jj*v2[0], ii*v1[1]+jj*v2[1]]});
  return out;
}
function inBB(p,bb,pad){
  var q=pad||0;
  return p[0]>=bb.x0-q && p[0]<=bb.x1+q && p[1]>=bb.y0-q && p[1]<=bb.y1+q;
}

/* ════════════════════════════════════════════════════════════════
   1) PLITKALASHLAR
   Har biri {tiles:[{poly,kind}], period:[w,h]|null, unit:<o'lcham>}
   qaytaradi. `kind` — rang guruhi (0 = asosiy, 1 = ikkilamchi).
   Barchasi QIRRA-QIRRAGA: har ichki qirra aynan ikki plitkaga tegishli,
   shu sabab tugunlar bir-biriga aniq tushadi va iplar uzilmaydi.
   ════════════════════════════════════════════════════════════════ */
var PIC_TILINGS = {

  /* 4.4.4.4 — kvadrat to'r (δ=45° klassik sakkizburchak-xoch beradi) */
  sq: {
    nm: "Kvadrat to'r (4.4.4.4)", deltas:[30,45,60,22.5], sides:4,
    build: function(s, bb){
      var tiles=[], pts=latticePoints([s,0],[0,s], bb, s*1.2);
      for(var k=0;k<pts.length;k++){
        var x=pts[k].p[0], y=pts[k].p[1];
        tiles.push({poly:[[x,y],[x+s,y],[x+s,y+s],[x,y+s]], kind:(pts[k].i+pts[k].j)&1});
      }
      return {tiles:tiles, period:[s,s], unit:s};
    }
  },

  /* 4.8.8 — sakkizburchak + kvadrat: Registon panellarining asosi */
  t488: {
    nm: "Sakkizburchak + kvadrat (4.8.8)", deltas:[45,67.5,22.5], sides:8,
    build: function(s, bb){
      var oR = (s*0.5)/Math.cos(Math.PI/8);          /* sakkizburchak tashqi radiusi */
      var a  = 2*oR*Math.sin(Math.PI/8);             /* qirra uzunligi */
      var qR = a/Math.SQRT2;                         /* kvadrat tashqi radiusi (45° burilgan) */
      var tiles=[], pts=latticePoints([s,0],[0,s], bb, s*1.6);
      for(var k=0;k<pts.length;k++){
        var x=pts[k].p[0], y=pts[k].p[1];
        tiles.push({poly:ngon(x,y,oR,8,Math.PI/8), kind:0});
        tiles.push({poly:ngon(x+s/2,y+s/2,qR,4,-Math.PI/2), kind:1});
      }
      return {tiles:tiles, period:[s,s], unit:s};
    }
  },

  /* 6.6.6 — asal uyasi (p6m) */
  t666: {
    nm: "Olti burchak to'ri (6.6.6)", deltas:[30,60,45,15], sides:6,
    build: function(s, bb){
      var v1=[SQ3*s,0], v2=[SQ3*s/2, 1.5*s];
      var tiles=[], pts=latticePoints(v1,v2, bb, s*2);
      for(var k=0;k<pts.length;k++){
        var c=pts[k].p;
        tiles.push({poly:ngon(c[0],c[1],s,6,Math.PI/6), kind:((pts[k].i+2*pts[k].j)%3+3)%3===0?0:1});
      }
      return {tiles:tiles, period:[SQ3*s, 3*s], unit:s};
    }
  },

  /* 3.6.3.6 — olti burchak + uchburchak (trigeksagonal) */
  t3636: {
    nm: "Olti burchak + uchburchak (3.6.3.6)", deltas:[45,30,60], sides:6,
    build: function(a, bb){
      var d=2*a, v1=[d,0], v2=[d/2, d*SQ3/2];
      var tiles=[], pts=latticePoints(v1,v2, bb, d*2);
      var mid=function(A,B){ return [(A[0]+B[0])/2,(A[1]+B[1])/2]; };
      for(var k=0;k<pts.length;k++){
        var P=pts[k].p;
        tiles.push({poly:ngon(P[0],P[1],a,6,0), kind:0});
        /* bo'shliq uchburchaklari = panjara uchburchagining qirra o'rtalari */
        var A=P, B=vAdd(P,v1), C=vAdd(P,v2), D=vAdd(B,v2);
        tiles.push({poly:[mid(A,B),mid(B,C),mid(A,C)], kind:1});
        tiles.push({poly:[mid(B,D),mid(C,D),mid(B,C)], kind:1});
      }
      return {tiles:tiles, period:[d, d*SQ3], unit:a};
    }
  },

  /* 3.12.12 — o'n ikki burchak + uchburchak: Temuriylar 12-nurli yulduzi */
  t3122: {
    nm: "O'n ikki burchak (3.12.12)", deltas:[45,75,30,60,15], sides:12,
    build: function(a, bb){
      var R12 = a/(2*Math.sin(Math.PI/12));
      var r12 = a/(2*Math.tan(Math.PI/12));
      var d = 2*r12, v1=[d,0], v2=[d/2, d*SQ3/2];
      var tR = a/SQ3;                                /* uchburchak tashqi radiusi */
      var tiles=[], pts=latticePoints(v1,v2, bb, d*1.6);
      for(var k=0;k<pts.length;k++){
        var P=pts[k].p;
        tiles.push({poly:ngon(P[0],P[1],R12,12,Math.PI/12), kind:0});
        var Gu=vAdd(P, vMul(vAdd(v1,v2), 1/3));
        var Gd=vAdd(P, vMul(vAdd(v1,v2), 2/3));
        tiles.push({poly:ngon(Gu[0],Gu[1],tR,3,-Math.PI/2), kind:1});
        tiles.push({poly:ngon(Gd[0],Gd[1],tR,3, Math.PI/2), kind:1});
      }
      return {tiles:tiles, period:[d, d*SQ3], unit:a};
    }
  },

  /* SHAMSA-10 — HAQIQIY GIRIH TILE TO'PLAMI (o'n burchakli medalyon).
     Markazda o'n burchak (ichki burchagi 144°), uning har qirrasiga tashqi
     tomondan muntazam beshburchak (108°) ulanadi. O'n burchak uchida
     burchaklar yig'indisi 144° + 108° + 108° = 360° — ya'ni beshburchaklar
     halqasi BO'SHLIQSIZ yopiladi. Bu Registon va Shohi Zinda panellaridagi
     klassik shamsa qurilishi; barcha qirralar teng (a), barcha burchaklar
     36° ga karrali. Aynan shu sabab PIC lentalari butun medalyon bo'ylab
     uzluksiz oqadi va 10 nurli yulduz markazda aniq yopiladi. */
  shamsa10: {
    nm: "Shamsa — o'n burchak + beshburchak", deltas:[72,54,63,36], sides:10, radial:true,
    build: function(unit, bb, opt){
      opt = opt || {};
      var R = opt.R || unit*4;
      /* R — medalyonning tashqi radiusi. Beshburchak halqasining tashqi
         chegarasi markazdan rOut = rd + 2·rp masofada (rd — o'n burchak
         ichki radiusi, rp — beshburchak ichki radiusi) → a ni shundan topamiz. */
      var rdK = 1/(2*Math.tan(Math.PI/10));      /* o'n burchak ichki radiusi / a */
      var rpK = 1/(2*Math.tan(Math.PI/5));       /* beshburchak ichki radiusi / a */
      var RpK = 1/(2*Math.sin(Math.PI/5));       /* beshburchak tashqi radiusi / a */
      var a = R/(rdK + rpK + RpK);
      var rd = rdK*a, rp = rpK*a, Rp = RpK*a;
      var Rd = a/(2*Math.sin(Math.PI/10));
      var tiles=[], i, j;
      /* markaziy o'n burchak: uchlari 18°+36k, qirra o'rtalari 36k */
      tiles.push({poly:ngon(0,0,Rd,10,Math.PI/10), kind:0});
      for(i=0;i<10;i++){
        var th = TAU2*i/10;                       /* qirra normalining yo'nalishi */
        var C = [Math.cos(th)*(rd+rp), Math.sin(th)*(rd+rp)];
        /* beshburchakning ichki qirrasi o'rtasi C dan (th+180°) tomonda →
           uchlari th + 180° + 36° + 72°j burchaklarda */
        var poly=[];
        for(j=0;j<5;j++){
          var aa = th + Math.PI + Math.PI/5 + TAU2*j/5;
          poly.push([C[0]+Math.cos(aa)*Rp, C[1]+Math.sin(aa)*Rp]);
        }
        tiles.push({poly:poly, kind:1});
      }
      return {tiles:tiles, period:null, unit:a, radius:rd+rp+Rp, radial:true};
    }
  }
};

/* ════════════════════════════════════════════════════════════════
   2) KONTAKT NURLARI + 3) GLOBAL GRAF (dedup, tugun birlashtirish)
   ------------------------------------------------------------------
   Har plitkaning har qirrasi o'rtasidan ikki nur chiqadi:
       d1 = +cosδ·u + sinδ·nIn        d2 = −cosδ·u + sinδ·nIn
   (u — qirra yo'nalishi, nIn — plitka ichiga qaragan normal)
   Qo'shni plitkada u va nIn ikkisi ham teskari bo'ladi, shuning uchun
   uning nurlari −d1, −d2 ga teng → qirra o'rtasida chiziqlar TO'G'RI
   davom etadi. Aynan shu xossa "yamoq" effektini yo'q qiladi.
   ════════════════════════════════════════════════════════════════ */
function picBuild(tg, deltaDeg, opt){
  opt = opt || {};
  var tiles = tg.tiles, unit = tg.unit || 1;
  var EPS = unit * 1e-3;                    /* tugun birlashtirish toleransi */
  var delta = deltaDeg * Math.PI/180;
  var cs = Math.cos(delta), sn = Math.sin(delta);

  var nodes=[], nodeMap={}, edges=[], edgeSet={};
  /* Tugun turi muhim:
       mid — plitka qirrasining o'rtasi (ichkarida 4 darajali KESISHISH,
             patch chegarasida 2 darajali TUGATUVCHI)
       x   — plitka ichidagi uchrashuv nuqtasi (lentaning haqiqiy BURCHAGI) */
  function nodeAt(p, isMid){
    var kx = Math.round(p[0]/EPS), ky = Math.round(p[1]/EPS);
    var key = kx+'|'+ky;
    var id = nodeMap[key];
    if(id === undefined){
      /* qo'shni kataklarni ham tekshiramiz — yaxlitlash chegarasida bo'linib
         ketmasligi uchun (aks holda bir tugun ikkiga ajralib, ip uziladi) */
      for(var dx=-1; dx<=1 && id===undefined; dx++)
        for(var dy=-1; dy<=1 && id===undefined; dy++){
          var alt = nodeMap[(kx+dx)+'|'+(ky+dy)];
          if(alt !== undefined && Math.hypot(nodes[alt].p[0]-p[0], nodes[alt].p[1]-p[1]) < EPS) id = alt;
        }
      if(id === undefined){ id = nodes.length; nodes.push({p:p, e:[], mid:false}); }
      nodeMap[key] = id;
    }
    if(isMid) nodes[id].mid = true;
    return id;
  }
  function addEdge(a,b){
    if(a===b) return;
    var key = a<b ? a+'-'+b : b+'-'+a;
    if(edgeSet[key] !== undefined) return;   /* DEDUP: umumiy qirradagi takror segment */
    edgeSet[key] = edges.length;
    edges.push({a:a, b:b});
    nodes[a].e.push(edges.length-1);
    nodes[b].e.push(edges.length-1);
  }

  /* Konveks plitka ichidaligini tekshirish (yarim tekislik testi) */
  function insideConvex(X, poly, cen, tol){
    for(var i=0;i<poly.length;i++){
      var A=poly[i], B=poly[(i+1)%poly.length];
      var u=vNorm(vSub(B,A));
      var nIn=[-u[1],u[0]];
      if(vDot(nIn, vSub(cen,A)) < 0) nIn=[u[1],-u[0]];
      if(vDot(nIn, vSub(X,A)) < -tol) return false;
    }
    return true;
  }

  var cores = [];
  for(var t=0; t<tiles.length; t++){
    var poly = tiles[t].poly, m = poly.length;
    var cen = polyCentroid(poly);
    /* har qirra o'rtasidan ikki nur — jami 2m nur */
    var rays=[], i, j;
    for(i=0;i<m;i++){
      var A = poly[i], B = poly[(i+1)%m];
      var M = [(A[0]+B[0])/2, (A[1]+B[1])/2];
      var u = vNorm(vSub(B,A));
      var nIn = [-u[1], u[0]];
      if(vDot(nIn, vSub(cen,M)) < 0) nIn = [u[1], -u[0]];   /* ichkariga qaratish */
      rays.push({p:M, d:[ cs*u[0] + sn*nIn[0],  cs*u[1] + sn*nIn[1]], e:i});
      rays.push({p:M, d:[-cs*u[0] + sn*nIn[0], -cs*u[1] + sn*nIn[1]], e:i});
    }
    /* HANKIN QOIDASI + O'ZARO JUFTLASH.
       Har nur plitka ichida boshqa nur bilan uchrashadi. Juftlash O'ZARO
       bo'lishi shart: aks holda nurlar har biri o'z nuqtasida tugab,
       yulduz yopilmaydi va bo'sh uchlar ("tikan") paydo bo'ladi.
       Shu sabab barcha nomzod kesishmalar masofa bo'yicha tartiblanib,
       ochko'z (greedy) usulda o'zaro juftlanadi. */
    var tol = unit*1e-6, minT = unit*1e-4;
    var cand=[];
    for(i=0;i<rays.length;i++){
      for(j=i+1;j<rays.length;j++){
        if(rays[i].e === rays[j].e) continue;              /* bir qirraning nurlari juftlashmaydi */
        var X = rayCross(rays[i].p, rays[i].d, rays[j].p, rays[j].d);
        if(!X) continue;
        var ti = vDot(vSub(X, rays[i].p), rays[i].d);
        var tj = vDot(vSub(X, rays[j].p), rays[j].d);
        if(ti < minT || tj < minT) continue;               /* orqaga qarab yechim */
        if(!insideConvex(X, poly, cen, unit*1e-3)) continue;
        /* t ni KVANTLAB saqlaymiz: "chiroyli" δ larda bir nechta nomzod
           bir xil masofada bo'ladi (teng holat). Xom suzuvchi nuqta bilan
           taqqoslasak, panjaraning turli joyidagi bir xil plitkalar teng
           holatni har xil hal qiladi — natijada naqsh davriyligi buzilib,
           chok-suz tiling chetida chiziqlar mos kelmaydi.
           Kvantlash + indeks bo'yicha uzil-kesil tartib buni yo'q qiladi. */
        cand.push({i:i, j:j, x:X, t:Math.max(ti,tj), tq:Math.round(Math.max(ti,tj)/(unit*1e-7))});
      }
    }
    cand.sort(function(A2,B2){ return (A2.tq - B2.tq) || (A2.i - B2.i) || (A2.j - B2.j); });
    var taken = new Array(rays.length).fill(false);
    var meet  = new Array(rays.length).fill(null);
    for(i=0;i<cand.length;i++){
      var cd=cand[i];
      if(taken[cd.i] || taken[cd.j]) continue;
      taken[cd.i]=taken[cd.j]=true;
      meet[cd.i]=meet[cd.j]=cd.x;
    }
    var cp=[];
    for(i=0;i<rays.length;i++){
      if(!meet[i]) continue;
      addEdge(nodeAt(rays[i].p, true), nodeAt(meet[i], false));
      cp.push(meet[i]);
    }
    /* yulduz o'zagi: uchrashuv nuqtalari markaz atrofida burchak bo'yicha tartiblanadi */
    if(cp.length >= 3){
      var uniq=[], seen={};
      for(i=0;i<cp.length;i++){
        var kk = Math.round(cp[i][0]/(unit*1e-3))+'|'+Math.round(cp[i][1]/(unit*1e-3));
        if(seen[kk]) continue;
        seen[kk]=1; uniq.push(cp[i]);
      }
      if(uniq.length >= 3){
        uniq.sort(function(P,Q){
          return Math.atan2(P[1]-cen[1],P[0]-cen[0]) - Math.atan2(Q[1]-cen[1],Q[0]-cen[0]);
        });
        cores.push({poly:uniq, kind:tiles[t].kind});
      }
    }
  }

  /* ---- 4) IP AJRATISH: tugunda davomiylik = eng qarama-qarshi qirra ---- */
  function dirOf(eIdx, fromNode){
    var e = edges[eIdx];
    var o = e.a === fromNode ? e.b : e.a;
    return vNorm(vSub(nodes[o].p, nodes[fromNode].p));
  }
  function partner(nodeId, eIdx){
    var nd = nodes[nodeId], inc = nd.e;
    if(inc.length < 2) return -1;
    /* Lentaning burchagi (plitka ichidagi uchrashuv nuqtasi): davomiylik
       yagona — burchak qanchalik o'tkir bo'lsa ham ip UZILMAYDI. */
    if(!nd.mid && inc.length === 2) return inc[0] === eIdx ? inc[1] : inc[0];
    /* Patch chegarasidagi qirra o'rtasi: faqat bitta plitka nur bergan →
       ip shu yerda TUGAYDI (aks holda orqaga qaytib, iplar qo'shilib ketadi
       va to'qish paritysi buziladi). */
    if(nd.mid && inc.length < 4) return -1;
    /* Haqiqiy kesishish: chiziq TO'G'RI davom etadi (−dot ≈ 1) */
    var din = dirOf(eIdx, nodeId);
    var best=-1, bestDot=0.55;
    for(var k=0;k<inc.length;k++){
      if(inc[k] === eIdx) continue;
      var sc = -vDot(din, dirOf(inc[k], nodeId));
      if(sc > bestDot){ bestDot = sc; best = inc[k]; }
    }
    return best;
  }
  var used = new Array(edges.length).fill(false);
  var strands=[];
  function walk(startE, startN){
    var pts=[nodes[startN].p], eIdx=startE, cur=startN, guard=0;
    var eList=[];
    while(eIdx >= 0 && !used[eIdx] && guard++ < 20000){
      used[eIdx]=true; eList.push(eIdx);
      var e=edges[eIdx];
      var nxt = e.a===cur ? e.b : e.a;
      pts.push(nodes[nxt].p);
      cur = nxt;
      eIdx = partner(cur, eIdx);
    }
    return {pts:pts, edges:eList, endNode:cur};
  }
  for(var ei=0; ei<edges.length; ei++){
    if(used[ei]) continue;
    /* ikki yo'nalishga yurib, ipni to'liq yig'amiz */
    var fwd = walk(ei, edges[ei].a);
    var backStart = partner(edges[ei].a, ei);
    var pts = fwd.pts;
    if(backStart >= 0 && !used[backStart]){
      var bwd = walk(backStart, edges[ei].a);
      bwd.pts.reverse();
      pts = bwd.pts.slice(0, bwd.pts.length-1).concat(fwd.pts);
    }
    var closed = pts.length>2 && Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1]) < EPS*4;
    strands.push({pts:pts, closed:closed});
  }

  /* ---- 5) KESISHISHLAR + TO'QISH (ust/ost navbatlashishi) ---- */
  var cross=[];
  for(var ni=0; ni<nodes.length; ni++){
    if(nodes[ni].e.length === 4 && nodes[ni].mid) cross.push({node:ni, p:nodes[ni].p, over:-1, on:[]});
  }
  var crossOfNode={};
  for(var ci=0; ci<cross.length; ci++) crossOfNode[cross[ci].node]=ci;
  /* har ipni kuzatib, u kesib o'tgan tugunlarni tartib bilan yozamiz */
  for(var si=0; si<strands.length; si++){
    var sp = strands[si].pts, seq=[];
    for(var pi=0; pi<sp.length; pi++){
      var id = nodeMap[Math.round(sp[pi][0]/EPS)+'|'+Math.round(sp[pi][1]/EPS)];
      if(id === undefined) continue;
      var c = crossOfNode[id];
      if(c !== undefined) seq.push(c);
    }
    strands[si].cross = seq;
    for(var qi=0; qi<seq.length; qi++) cross[seq[qi]].on.push({s:si, k:qi});
  }
  /* ---- TO'QISH: 2-bo'yash (XOR cheklovlar grafi) ----
     Har kesishishda ikki ip uchrashadi. Haqiqiy to'qish shartini
     ip bo'ylab ust/ost QAT'IY almashishi belgilaydi:
         over_s(c1)  XOR  over_s(c2) = 1     (ketma-ket kesishishlar)
     x_c = 1 bo'lsa kichik indeksli ip ustidan o'tadi, deb belgilaymiz.
     over_s(c) = x_c XOR (s ≠ A(c))  bo'lgani uchun cheklov quyidagiga aylanadi:
         x_c1 XOR x_c2 = 1 XOR b1 XOR b2
     Bu — grafni ikki rangga bo'yash masalasi; BFS bilan tarqatib yechiladi.
     (Ochko'z "birinchi kelgan yutadi" usuli navbatlashishni buzadi.) */
  for(ci=0; ci<cross.length; ci++){
    var c3 = cross[ci], sa=-1, sb=-1;
    for(var oi=0; oi<c3.on.length; oi++){
      var sid=c3.on[oi].s;
      if(sa===-1) sa=sid;
      else if(sid!==sa && sb===-1) sb=sid;
    }
    if(sb===-1) sb=sa;
    c3.A = Math.min(sa,sb); c3.B = Math.max(sa,sb);
    c3.x = -1;
  }
  var adj=[];
  for(ci=0; ci<cross.length; ci++) adj.push([]);
  function bOf(c, s){ return (s !== c.A) ? 1 : 0; }
  for(si=0; si<strands.length; si++){
    var seq3 = strands[si].cross || [];
    for(var q3=0; q3+1<seq3.length; q3++){
      var i1=seq3[q3], i2=seq3[q3+1];
      if(i1===i2) continue;
      var C1=cross[i1], C2=cross[i2];
      if(C1.A===C1.B || C2.A===C2.B) continue;      /* o'z-o'zini kesish — cheklovsiz */
      var par = 1 ^ bOf(C1,si) ^ bOf(C2,si);
      adj[i1].push({to:i2, p:par});
      adj[i2].push({to:i1, p:par});
    }
  }
  var conflicts=0;
  for(ci=0; ci<cross.length; ci++){
    if(cross[ci].x !== -1) continue;
    cross[ci].x = 1;
    var queue=[ci];
    while(queue.length){
      var cu=queue.pop();
      for(var ai=0; ai<adj[cu].length; ai++){
        var lnk=adj[cu][ai];
        var want = cross[cu].x ^ lnk.p;
        if(cross[lnk.to].x === -1){ cross[lnk.to].x = want; queue.push(lnk.to); }
        else if(cross[lnk.to].x !== want) conflicts++;
      }
    }
  }
  for(ci=0; ci<cross.length; ci++){
    var c4=cross[ci];
    c4.over = c4.x === 1 ? c4.A : c4.B;
  }

  return {
    tiles: tiles, cores: cores, strands: strands, cross: cross,
    nodes: nodes, edges: edges, period: tg.period, unit: unit, weaveConflicts: conflicts, radial: !!tg.radial,
    radius: tg.radius, delta: deltaDeg
  };
}

/* ════════════════════════════════════════════════════════════════
   6) MODEL YASASH — plitkalash + δ tanlash bitta joyda
   δ ("kontakt burchagi") KVANTLANGAN: girih faqat simmetriyaga bog'langan
   diskret burchaklarda "yopiladi". Erkin slayder oradagi qiymatni bersa,
   yulduz uchlari mos kelmaydi va mayda noto'g'ri uchburchaklar chiqadi —
   shu sabab foydalanuvchiga variant tanlash beriladi, xom burchak emas.
   ════════════════════════════════════════════════════════════════ */
function picDeltas(tileId, n){
  var T = PIC_TILINGS[tileId] || PIC_TILINGS.t488;
  if(T.deltas && T.deltas.length) return T.deltas;   /* plitkalashning kanonik burchaklari */
  if(T.radial){
    var nn = Math.max(5, Math.round(n||10));
    return [90 - 180/nn, 45, 60, 180/nn*1.5].map(function(d){
      return Math.max(8, Math.min(82, Math.round(d*10)/10));
    });
  }
  return T.deltas;
}
function picModel(spec){
  var id = PIC_TILINGS[spec.tile] ? spec.tile : 't488';
  var T = PIC_TILINGS[id];
  var ds = picDeltas(id, spec.n);
  var delta = ds[((spec.dvar|0) % ds.length + ds.length) % ds.length];
  var bb = spec.bb || {x0:-spec.R, y0:-spec.R, x1:spec.R, y1:spec.R};
  var tg = T.build(spec.unit, bb, {n:spec.n, R:spec.R, rings:spec.rings, ir:spec.ir});
  var M = picBuild(tg, delta, spec);
  M.tileId = id; M.tileNm = T.nm; M.deltaList = ds;
  picFaces(M);
  return M;
}

/* ════════════════════════════════════════════════════════════════
   7) RENDER — TEKIS RANG (alfa aralashmasi yo'q)
   Haqiqiy koshinkorlikda ranglar to'liq qoplama, chegarada yupqa to'q
   kontur bo'ladi. Yarim shaffof qatlamlar bir-birining ustiga tushib
   "akvarel" tusini bergani uchun bu yerda globalAlpha ISHLATILMAYDI.
   To'qish: 1-o'tishda barcha iplar, 2-o'tishda kesishishlarda faqat
   USTIDAN o'tuvchi ipning qisqa bo'lagi qayta chiziladi → ost ip uziladi.
   Bu usul SVG eksportida ham aynan ishlaydi (chizish tartibi saqlanadi).
   ════════════════════════════════════════════════════════════════ */
function picPolyPath(ctx, pts, closed){
  if(!pts.length) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if(closed) ctx.closePath();
}
function picFlatFill(ctx, col){
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fill(); ctx.restore();
}
function picStroke(ctx, col, w){
  ctx.save();
  ctx.globalAlpha = 1; ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(0.12, w);
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.miterLimit = 6;
  ctx.stroke(); ctx.restore();
}
/* Bitta lenta: to'q kontur (keng) + ochiq band (tor). Ikki o'tish — chegara
   avtomatik bir tekis qalinlikda chiqadi, alohida offset hisoblash kerak emas. */
function picRibbon(ctx, pts, band, edge, w, closed){
  ctx.beginPath(); picPolyPath(ctx, pts, closed);
  picStroke(ctx, edge, w);
  ctx.beginPath(); picPolyPath(ctx, pts, closed);
  picStroke(ctx, band, Math.max(0.4, w - Math.max(1.1, w*0.34)));
}
/* Kesishish atrofidagi qisqa bo'lak — ust ipni qayta chizish uchun */
function picLocalPiece(pts, idx, reach){
  var out=[pts[idx]], i, acc;
  acc=0;
  for(i=idx-1;i>=0;i--){
    acc += Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]);
    out.unshift(pts[i]);
    if(acc >= reach) break;
  }
  acc=0;
  for(i=idx+1;i<pts.length;i++){
    acc += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
    out.push(pts[i]);
    if(acc >= reach) break;
  }
  return out;
}
function picRender(ctx, M, style){
  var s = style || {};
  var bw    = Math.max(0.8, s.bandW || M.unit*0.16);
  var band  = s.band  || '#fdfaf0';
  var edge  = s.edge  || '#241a08';
  var fills = s.fills || ['#efe2bc','#3f6a95'];
  var core  = s.core  || '#1d3a63';
  var mode  = s.mode  || 'dual';                /* 'dual' | 'fill' | 'line' */
  var weave = s.weave !== false;
  var i, k;

  /* 1) FON + YUZALAR — har shakl o'z rangida (haqiqiy sirlangan koshin) */
  if(mode !== 'line'){
    for(i=0;i<M.tiles.length;i++){
      ctx.beginPath(); picPolyPath(ctx, M.tiles[i].poly, true);
      picFlatFill(ctx, fills[0]);
    }
    var fc = M.faces || [];
    var pl = s.regionPal || [fills[0], core, fills[1] || core, band];
    for(i=0;i<fc.length;i++){
      ctx.beginPath(); picPolyPath(ctx, fc[i].poly, true);
      picFlatFill(ctx, pl[fc[i].rank % pl.length]);
    }
  }

  /* 3) faqat chiziq rejimi — texnik chizma (CNC/lazer uchun) */
  if(mode === 'line'){
    for(i=0;i<M.strands.length;i++){
      ctx.beginPath(); picPolyPath(ctx, M.strands[i].pts, false);
      picStroke(ctx, edge, Math.max(0.3, bw*0.18));
    }
    return;
  }

  /* 4) barcha iplar — asosiy o'tish */
  for(i=0;i<M.strands.length;i++){
    picRibbon(ctx, M.strands[i].pts, band, edge, bw, false);
  }

  /* 5) TO'QISH — kesishishda ustidan o'tuvchi ipni qayta chizish.
        Ost ip shu joyda ust lentaning tagida qolib, uzilgan ko'rinadi. */
  if(weave){
    var reach = bw*1.15;
    for(k=0;k<M.cross.length;k++){
      var c = M.cross[k];
      if(c.over < 0) continue;
      var str = M.strands[c.over];
      if(!str) continue;
      /* ipdagi shu kesishishning o'rnini topamiz */
      var seq = str.cross || [], pos = -1;
      for(i=0;i<seq.length;i++) if(seq[i] === k){ pos = i; break; }
      if(pos < 0) continue;
      /* ip nuqtalari orasidan kesishish koordinatasiga eng yaqinini olamiz */
      var bi=-1, bd=Infinity;
      for(i=0;i<str.pts.length;i++){
        var d = Math.hypot(str.pts[i][0]-c.p[0], str.pts[i][1]-c.p[1]);
        if(d < bd){ bd = d; bi = i; }
      }
      if(bi < 0 || bd > M.unit*0.02) continue;
      picRibbon(ctx, picLocalPiece(str.pts, bi, reach), band, edge, bw, false);
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   8) YUZALARNI AJRATISH (planar faces) — HAQIQIY KOSHIN BO'YASH
   ------------------------------------------------------------------
   Lentalarning o'q chiziqlari tekislikni yopiq yuzalarga bo'ladi:
   yulduzlar, ko'rshapalaklar (bowtie), oltiburchaklar, romblar…
   Chinnisozlikda AYNAN shu yuzalar sirlanadi va bir xil shakl doim
   bir xil rang oladi. Yuzalar yarim qirralar (half-edge) aylanishi
   bilan topiladi: har dartning davomi — tugunda teskari dartdan
   soat yo'nalishi bo'yicha keyingi dart.
   ════════════════════════════════════════════════════════════════ */
function picFaces(M){
  var nodes=M.nodes, edges=M.edges;
  var darts=[], dartAt=[];
  var i, k;
  for(i=0;i<nodes.length;i++) dartAt.push([]);
  for(i=0;i<edges.length;i++){
    darts.push({from:edges[i].a, to:edges[i].b, tw:-1});
    darts.push({from:edges[i].b, to:edges[i].a, tw:-1});
    darts[darts.length-2].tw = darts.length-1;
    darts[darts.length-1].tw = darts.length-2;
    dartAt[edges[i].a].push(darts.length-2);
    dartAt[edges[i].b].push(darts.length-1);
  }
  function ang(d){
    var A=nodes[darts[d].from].p, B=nodes[darts[d].to].p;
    return Math.atan2(B[1]-A[1], B[0]-A[0]);
  }
  var order={};
  for(i=0;i<nodes.length;i++){
    var lst = dartAt[i].slice();
    lst.sort(function(p,q){ return ang(p)-ang(q); });
    dartAt[i]=lst;
    for(k=0;k<lst.length;k++) order[lst[k]] = k;
  }
  /* dart u→v ning davomi: v tugunida (v→u) dartdan soat yo'nalishida keyingisi */
  function nextDart(d){
    var v = darts[d].to, rev = darts[d].tw;
    var lst = dartAt[v], m = lst.length;
    var idx = order[rev];
    if(idx === undefined) return -1;
    return lst[(idx - 1 + m) % m];
  }
  var seen = new Array(darts.length).fill(false);
  var faces=[];
  for(i=0;i<darts.length;i++){
    if(seen[i]) continue;
    var cyc=[], d=i, guard=0;
    while(d>=0 && !seen[d] && guard++ < 100000){
      seen[d]=true; cyc.push(d); d = nextDart(d);
    }
    if(cyc.length < 3) continue;
    var pts = cyc.map(function(q){ return nodes[darts[q].from].p; });
    var a2=0;
    for(k=0;k<pts.length;k++){
      var A=pts[k], B=pts[(k+1)%pts.length];
      a2 += A[0]*B[1] - B[0]*A[1];
    }
    a2 /= 2;
    if(a2 <= 0) continue;                       /* tashqi yuza / teskari aylanish */
    faces.push({poly:pts, area:a2, n:pts.length});
  }
  /* Bir xil shakl → bir xil rang: yuza (area) va qirra soni bo'yicha guruh.
     Kvantlash toleransi hisoblash xatolarini yutadi. */
  var u2 = M.unit*M.unit;
  var groups={}, gList=[];
  /* Radial medalyonda kataklar tashqariga kattalashadi, shuning uchun yuza
     bo'yicha guruhlash ranglarni chalkashtiradi — u holda faqat SHAKL
     (qirra soni) hisobga olinadi va halqalar bo'ylab rang izchil qoladi. */
  var byShapeOnly = !!M.radial;
  for(i=0;i<faces.length;i++){
    var key = byShapeOnly ? String(faces[i].n) : (faces[i].n + ':' + Math.round(faces[i].area/u2*160));
    if(groups[key] === undefined){ groups[key] = gList.length; gList.push({key:key, area:faces[i].area, n:faces[i].n, cnt:0}); }
    faces[i].g = groups[key];
    gList[groups[key]].cnt++;
  }
  /* guruhlarni kattaligi bo'yicha tartiblab, barqaror rang indeksini beramiz
     (eng katta yuza = asosiy yulduz maydoni) */
  var idx = gList.map(function(g,j){ return j; });
  idx.sort(function(p,q){ return gList[q].area - gList[p].area; });
  var rank={};
  for(i=0;i<idx.length;i++) rank[idx[i]] = i;
  for(i=0;i<faces.length;i++) faces[i].rank = rank[faces[i].g];
  M.faces = faces;
  M.faceGroups = gList.length;
  return faces;
}

/* ════════════════════════════════════════════════════════════════
   9) ILOVA KO'PRIGI — PIC yadrosini NaqshAI parametrlariga bog'lash
   ════════════════════════════════════════════════════════════════ */
/* Plitkalash o'lchov koeffitsienti: har to'rda `unit` boshqa ma'noni
   bildiradi (qirra uzunligi yoki katak qadami), shuning uchun ekranda
   taxminan bir xil zichlik chiqishi uchun moslanadi. */
var PIC_USCALE = { sq:1.0, t488:1.0, t666:0.66, t3636:0.52, t3122:0.5, shamsa10:1.0 };
var PIC_LIST = [
  {id:'sq',        nm:'Kvadrat to\'r (4.4.4.4)'},
  {id:'t488',      nm:'Sakkizburchak + kvadrat (4.8.8)'},
  {id:'t666',      nm:'Olti burchak (6.6.6)'},
  {id:'t3636',     nm:'Olti burchak + uchburchak (3.6.3.6)'},
  {id:'t3122',     nm:'O\'n ikki burchak (3.12.12)'},
  {id:'shamsa10',  nm:'Shamsa — o\'n nurli medalyon'}
];
function picIsRadial(tileId){
  var T = PIC_TILINGS[tileId];
  return !!(T && T.radial);
}
/* Naqsh parametrlaridan PIC spetsifikatsiyasi */
function picSpecFrom(p, R, opt){
  opt = opt || {};
  var tile = PIC_TILINGS[p.tile] ? p.tile : 't488';
  var us = PIC_USCALE[tile] || 1;
  var unit;
  if(opt.cellPx){
    unit = opt.cellPx * us;                      /* tessellatsiyada katak slayderi */
  } else {
    unit = R * (0.62 - Math.min(1, Math.max(0, p.dens)) * 0.40) * us;
  }
  unit = Math.max(R*0.06, unit);
  var bb = opt.bb || {x0:-R, y0:-R, x1:R, y1:R};
  return {
    tile: tile, unit: unit, R: R, bb: bb,
    dvar: p.dvar|0,
    n: 10,
    ir: 0.12 + Math.min(0.8, Math.max(0.1, p.ir))*0.3
  };
}
/* Palitradan render uslubi. Alfa yo'q — ranglar to'liq qoplama. */
function picStyleFrom(pal, p, unit){
  var band = lerpColor(pal.c[4], '#ffffff', 0.62);
  var edge = shade(pal.c[2], 0.30);
  var mode = p.fill === 'line' ? 'line' : 'dual';
  /* Yuza ranglari: eng katta yuza (yulduz maydoni) — asosiy urg'u.
     Medalyonda markaz ko'zga tashlanishi kerak, maydonda esa fon ochiq
     bo'lgani ma'qul, shuning uchun tartib turiga qarab o'zgaradi. */
  var regionPal = picIsRadial(p.tile)
    ? [pal.c[1], pal.c[3], pal.c[4], pal.c[0], pal.c[2]]
    : [pal.c[4], pal.c[1], pal.c[3], pal.c[0], pal.c[2]];
  return {
    band: band, edge: edge,
    fills: [pal.c[4], pal.c[3]],
    core: pal.c[1], core2: pal.c[3],
    regionPal: regionPal,
    bandW: Math.max(1.1, unit*0.16*(p.sw/2.2)),
    mode: mode,
    weave: p.weave !== false
  };
}
/* Model keshi — slayder surilganda har kadrda qayta qurmaslik uchun */
var PIC_CACHE = {};
function picGet(spec){
  var key = [spec.tile, Math.round(spec.unit*100), spec.dvar,
             Math.round(spec.bb.x0), Math.round(spec.bb.y0),
             Math.round(spec.bb.x1), Math.round(spec.bb.y1), Math.round(spec.ir*1000)].join('|');
  var hit = PIC_CACHE[key];
  if(hit) return hit;
  var M = picModel(spec);
  var keys = Object.keys(PIC_CACHE);
  if(keys.length > 24) delete PIC_CACHE[keys[0]];
  PIC_CACHE[key] = M;
  return M;
}

/* ---- Yakka naqsh (medalyon) sifatida chizish: PATTERNS registriga ulanadi ---- */
function drawPICPattern(ctx, R, p, sw, c0, c1, c2, c3){
  var pal = PAL[p.pal] || PAL.gold;
  var spec, M;
  if(p._field){
    /* Uzluksiz maydon: butun kanvas bo'ylab yaxlit naqsh (medalyon takrori emas) */
    var Rf = R;
    spec = picSpecFrom(p, Rf, {cellPx: p._cellpx, bb:{x0:-Rf, y0:-Rf, x1:Rf, y1:Rf}});
    M = picGet(spec);
    picRender(ctx, M, picStyleFrom(pal, p, spec.unit));
    return;
  }
  spec = picSpecFrom(p, R);
  M = picGet(spec);
  var style = picStyleFrom(pal, p, spec.unit);
  ctx.save();
  if(!ctx._svg && !picIsRadial(p.tile)){
    /* maydon turlari doira ichida kesiladi — medalyon o'z chegarasiga ega */
    ctx.beginPath(); circle(ctx, 0, 0, R*0.995); ctx.clip();
    ctx.beginPath(); circle(ctx, 0, 0, R*0.995);
    picFlatFill(ctx, pal.c[4]);
  }
  picRender(ctx, M, style);
  ctx.restore();
  if(!picIsRadial(p.tile) && !NORING){
    ctx.beginPath(); circle(ctx, 0, 0, R*0.995);
    picStroke(ctx, style.edge, Math.max(0.6, style.bandW*0.45));
  }
}

/* ════════════════════════════════════════════════════════════════
   10) CHOK-SUZ TESSELLATSIYA — MATEMATIK ANIQ
   ------------------------------------------------------------------
   Avvalgi usul "bleed" (katakdan kattaroq radius) bilan chokni YASHIRAR edi
   — bu taxminiy va eksportda ko'rinib qolardi. To'g'ri yechim:
   naqsh panjaraning ANIQ davriga teng offscreen kanvasga chiziladi, geometriya
   esa 3×3 davr bo'ylab yaratiladi → kanvas chetidan chiqqan lentalar qarama-
   qarshi chetdan aynan davom etadi. So'ng createPattern('repeat') bilan
   istalgan o'lchamga cho'ziladi: chok nolga TENG, taxmin yo'q.
   ════════════════════════════════════════════════════════════════ */
function picSeamlessTile(p, cellPx, dpr){
  var tile = PIC_TILINGS[p.tile] ? p.tile : 't488';
  if(picIsRadial(tile)) return null;              /* medalyon davriy emas */
  var us = PIC_USCALE[tile] || 1;
  var unit = Math.max(12, cellPx*us);
  /* davrni bilish uchun kichik namuna quramiz */
  var probe = PIC_TILINGS[tile].build(unit, {x0:0,y0:0,x1:1,y1:1});
  if(!probe.period) return null;
  var pw = probe.period[0], ph = probe.period[1];
  if(!(pw > 2 && ph > 2)) return null;
  var spec = {
    tile: tile, unit: unit, R: Math.max(pw,ph),
    bb: {x0:-pw, y0:-ph, x1:2*pw, y1:2*ph},
    dvar: p.dvar|0, n:10, ir:0.3
  };
  var M = picGet(spec);
  var cv = document.createElement('canvas');
  cv.width  = Math.max(2, Math.round(pw*dpr));
  cv.height = Math.max(2, Math.round(ph*dpr));
  var c = cv.getContext('2d');
  if(!c) return null;
  var pal = PAL[p.pal] || PAL.gold;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = pal.c[4];
  c.fillRect(0, 0, pw, ph);
  picRender(c, M, picStyleFrom(pal, p, unit));
  return {canvas: cv, w: pw, h: ph};
}

/* ============================================================
   REGISTR + DISPATCHER + TESSELLATSIYA
   ============================================================ */
const CATS = {A:"O'zbek geometrik", B:"Islimiy organik", C:"Kombinatsiyalar", D:"Dunyo naqshlari", E:"Matematik fraktallar"};
const PATTERNS = [
  {id:'girih',    nm:'Girih (4.8.8)', cat:'A', fn:drawPICPattern, pic:'t488',    th:"PIC (polygons-in-contact) yadrosi, 4.8.8 plitkalash: har qirra o'rtasidan δ burchagi ostida ikki nur; nurlar plitka ichida o'zaro uchrashib global lenta to'rini beradi. Lentalar plitka chegarasida UZILMAYDI — qo'shni plitkaning nurlari aynan bir to'g'ri chiziqda davom etadi."},
  {id:'hankin8',  nm:'Girih — kvadrat to\'r', cat:'A', fn:drawPICPattern, pic:'sq',  th:"PIC kvadrat to'rda (4.4.4.4): δ=45° klassik sakkizburchak-xoch naqshini, boshqa variantlar romb to'rlarini beradi."},
  {id:'hankin6',  nm:'Girih — olti burchak', cat:'A', fn:drawPICPattern, pic:'t666',  th:"PIC olti burchakli to'rda (6.6.6): δ olti nurli yulduz o'tkirligini belgilaydi; barcha variantlar geometrik jihatdan yopiladi."},
  {id:'panelgirih',nm:'Girih — 12 nurli', cat:'A', fn:drawPICPattern, pic:'t3122', th:"PIC 3.12.12 plitkalashda: o'n ikki burchak + uchburchak → Temuriylar davri 12 nurli yulduzi (Bibixonim, Go'ri Amir panellari)."},
  {id:'pic3636',  nm:'Girih — 6+3 to\'r', cat:'A', fn:drawPICPattern, pic:'t3636', th:"Hankin PIC 3.6.3.6 to'rida: olti burchak va uchburchak qirralari o'rtasidan δ burchagi ostidagi nurlar 6 nurli yulduzlar va ko'rshapalak yuzalarini beradi."},
  {id:'shamsa10', nm:'Shamsa — 10 nurli', cat:'A', fn:drawPICPattern, pic:'shamsa10', th:"Haqiqiy girih tile to'plami: markazda o'n burchak, atrofida beshburchaklar halqasi. Uchdagi burchaklar 144°+108°+108°=360° — halqa bo'shliqsiz yopiladi (Registon, Shohi Zinda uslubi)."},
  {id:'xatam',    nm:'Xatam',        cat:'A', fn:drawXatam,    th:"8 qirrali yulduz: ikki kvadrat 45° ga buralib ustma-ust qo'yiladi; kvadratlar to'ri bilan davom etadi."},
  {id:'rozetta',  nm:'Rozetta',      cat:'A', fn:drawRozetta,  th:"Markaziy gul: n barg, har barg 2 kubik Bezier yoy bilan, uchi o'tkir."},
  {id:'yulduz',   nm:'Yulduz',       cat:'A', fn:drawYulduz,   th:"{n/k} yulduz poligoni: nuqta_i dan nuqta_(i+k) ga chiziq, k=⌊n/2⌋−1."},
  {id:'muqarnas', nm:'Muqarnas',     cat:'A', fn:drawMuqarnas, th:"Rekursiv pog'onali ravoq: har daraja 0.72 masshtabda, orasida stalaktit yoylar."},
  {id:'katak8',   nm:'Katak-8',      cat:'A', fn:drawKatak8,   th:"4.8.8 Arximed tessellatsiyasi: sakkiz burchak + kvadrat to'ri."},
  {id:'hexa',     nm:'Olti burchak', cat:'A', fn:drawHexa,     th:"Asal uyasi to'ri (p6m simmetriya), har katakda ichki bezak."},
  {id:'zanjira',  nm:'Zanjira',      cat:'A', fn:drawZanjira,  th:"Halqalar zanjiri: Bezier ovallar radial nurlar bo'ylab, o'zaro to'qilgan."},
  {id:'islimiy',  nm:'Islimiy',      cat:'B', fn:drawIslimiy,  th:"Logarifmik spiral: r(θ)=a·e^(bθ), b=0.08+spiral·0.38; har novda uchida barg."},
  {id:'rumi',     nm:'Rumi',         cat:'B', fn:drawRumi,     th:"S-shakl qo'sh spiral: ikki qarama-qarshi log-spiral tutashgan, uchlarida buralgan barglar."},
  {id:'hatayi',   nm:'Hatayi',       cat:'B', fn:drawHatayi,   th:"Stilizatsiyalangan lotus: 5–7 gulbarg, har biri 3 Bezier segment; markazda urug'don doiralari."},
  {id:'palak',    nm:'Palak',        cat:'B', fn:drawPalak,    th:"Nilufar: konsentrik gulbarg halqalari, tashqarida katta, ichkarida kichik barglar."},
  {id:'shamsa',   nm:'Shamsa',       cat:'B', fn:drawShamsa,   th:"Quyosh medalyoni: markaziy yulduz + alanga-nurlar + tashqi gul halqasi (3 qatlam)."},
  {id:'arabesk',  nm:'Arabesque',    cat:'B', fn:drawArabesque,th:"O'zaro to'qilgan spiral novdalar to'ri, har tutashuvda barg."},
  {id:'scroll',   nm:'Bargli novda', cat:'B', fn:drawScroll,   th:"Asosiy S-egri (kubik Bezier) + navbatlashgan yon barglar; B(t)=Σ C(3,i)(1−t)^(3−i)·t^i·P_i."},
  {id:'medallion',nm:'Medalyon',     cat:'B', fn:drawMedallion,th:"Yulduz + gul + halqa kombinatsiyasi — markaziy murakkab medalyon."},
  {id:'oyma',     nm:"O'yma panel",   cat:'B', fn:drawOyma,     th:"Yog'och o'ymakorligi kartushi (Xiva/Farg'ona uslubi). Radial medalyon emas — TIK PANEL: yon tomonlari tik, uchlari siniq (ogee) yoy bilan yopilgan ramka; ichida o'qqa nisbatan ko'zgu-simmetrik islimiy novda. Uslubni tanitadigan uch belgi: kartush ramkasi, nuqtali fon (\"chizma\"/pargori — o'yilgan pastki qatlam) va relyef — har kontur ostiga yorug' va soya nusxasi qo'yiladi, shunda naqsh yassi chiziq emas, o'yilgan sirt bo'lib ko'rinadi. Ustun qirralari va eshik tabaqalari aynan shunday panellardan yig'iladi."},
  {id:'gi',       nm:'Girih+Islimiy',   cat:'C', fn:drawGirihIslimiy,   th:"Tashqi qatlam — girih strapwork, ichki qatlam (0.5R) — islimiy spirallar."},
  {id:'sg',       nm:'Shamsa+Girih',    cat:'C', fn:drawShamsaGirih,    th:"Tashqi shamsa medalyoni ichida girih yulduz-tugun."},
  {id:'mi',       nm:'Muqarnas+Islimiy',cat:'C', fn:drawMuqarnasIslimiy,th:"Muqarnas pog'onalari ichida islimiy novdalar."},
  {id:'xr',       nm:'Xatam+Rumi',      cat:'C', fn:drawXatamRumi,      th:"Xatam yulduzi ichida rumi qo'sh spirallar."},
  {id:'celtic',   nm:'Celtic',       cat:'D', fn:drawCeltic,   th:"Knotwork: aylana bo'ylab kesishgan Bezier lentalar, interlacing (ustma-ust to'qilish)."},
  {id:'mandala',  nm:'Mandala',      cat:'D', fn:drawMandala,  th:"6–12 konsentrik halqa, har halqada boshqa element: nuqta, barg, yoy, gulbarg."},
  {id:'penrose',  nm:'Penrose',      cat:'D', fn:drawPenrose,  th:"Kite/dart aperiodik subdivide, oltin nisbat φ=(1+√5)/2≈1.618; rekursiya darajasi = murakkablik."},
  {id:'zellige',  nm:'Zellige',      cat:'D', fn:drawZellige,  th:"Marokash kafeli: 4 Bezier tomonli egri romblar, 5 rangli davriy almashinuv."},
  {id:'batik',    nm:'Batik',        cat:'D', fn:drawBatik,    th:"To'lqinli halqalar: r(θ)=r₀+A·sin(nθ) modulyatsiyasi, orasida gul motivlari."},
  {id:'paisley',  nm:'Paisley',      cat:'D', fn:drawPaisley,  th:"Buta/tomchi: asimmetrik teardrop (4 Bezier), ichida log-spiral, uchida 5-barg gul."},
  {id:'greek',    nm:'Greek Key',    cat:'D', fn:drawGreek,    th:"Meander: to'g'ri burchakli labirint halqalar, konsentrik kvadrat ramkalarda."},
  {id:'xitoy',    nm:'Xitoy panjara',cat:'D', fn:drawXitoy,    th:"Fretwork: to'g'ri burchakli kataklar + T-shakl ichki bo'linmalar."},
  {id:'koch',     nm:'Koch',         cat:'E', fn:drawKoch,     th:"Qor parchasi: har segment 4 ga bo'linadi; fraktal o'lcham D=log 4/log 3≈1.262."},
  {id:'sierpinski',nm:'Sierpinski',  cat:'E', fn:drawSierpinski,th:"Uchburchak fraktal: D=log 3/log 2≈1.585."},
  {id:'dragon',   nm:'Dragon',       cat:'E', fn:drawDragon,   th:"L-sistema: F→F+G, G→F−G, burchak 90°."},
  {id:'hilbert',  nm:'Hilbert',      cat:'E', fn:drawHilbert,  th:"Fazoni to'ldiruvchi egri: 4^n nuqta, Gray-kod asosida d→(x,y)."},
  {id:'spirograph',nm:'Spirograph',  cat:'E', fn:drawSpirograph,th:"Epitrochoid: x=(R−r)cos t + d·cos((R−r)t/r), y=(R−r)sin t − d·sin((R−r)t/r)."},
  {id:'lissajous',nm:'Lissajous',    cat:'E', fn:drawLissajous,th:"x=A·sin(at+δ), y=B·sin(bt) — chastotalar nisbati figurani belgilaydi."},
  {id:'voronoi',  nm:'Voronoi',      cat:'E', fn:drawVoronoi,  th:"Seed nuqtalardan hujayra mozaika: har hujayra yarim tekisliklar kesishmasi."}
];
function getPattern(t){ return PATTERNS.find(x=>x.id===t) || PATTERNS[0]; }
function getPatternDrawFn(t){ return getPattern(t).fn; }

/* To'r/fraktal turlarida qatlamlash chiziqlarni buzadi — ular yakka qatlamda chiziladi */
/* PIC yadrosi bilan chiziladigan naqshlar (girih oilasi) */
const PIC_PATTERN = {girih:1, hankin8:1, hankin6:1, panelgirih:1, pic3636:1, shamsa10:1};
function picTileOf(type){ const pt = getPattern(type); return (pt && pt.pic) ? pt.pic : 't488'; }
const SINGLE_LAYER = {girih:1, hankin8:1, hankin6:1, panelgirih:1, pic3636:1, shamsa10:1, katak8:1,hexa:1,zellige:1,xitoy:1,penrose:1,voronoi:1,hilbert:1,dragon:1,greek:1,koch:1,sierpinski:1,batik:1,hankin8:1,hankin6:1,panelgirih:1};

/* Umumiy kirish nuqtasi: qatlamlar simmetriyaga mos YARIM QADAM bilan buriladi —
   chiziqlar bir-biriga uyg'un, interlock bo'ladi */
function drawPattern(ctx,cx,cy,R,p){
  const pal = PAL[p.pal] || PAL.gold;
  const fn = getPatternDrawFn(p.type);
  /* PIC (girih oilasi) naqshlari o'z plitka turini p.tile orqali oladi —
     bu yerda o'rnatilmasa, drawPICPattern har doim standart 't488' ga
     tushib qoladi va Girih/Shamsa variantlari bir xil chiqadi. */
  if(PIC_PATTERN[p.type]) p.tile = picTileOf(p.type);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate((p.rot||0)*Math.PI/180);
  if(p.skew) ctx.transform(1, 0, Math.tan(p.skew*0.35), 1, 0, 0);
  /* Qatlamlar = ICHMA-ICH medalyonlar (0.42 masshtab) — ustma-ust loyqa emas,
     har qatlam oldingisining markaziy bo'shlig'ida joylashadi */
  const layers = SINGLE_LAYER[p.type] ? 1 : Math.max(1, p.lay);
  const halfStep = Math.PI/Math.max(3, p.sym);
  for(let l=0; l<layers; l++){
    const s = Math.pow(0.42, l);
    if(R*s < 14) break;
    const t = layers>1 ? l/(layers-1) : 0;
    const c0 = lerpColor(pal.c[0], pal.c[2], t*0.6);
    const c1 = lerpColor(pal.c[1], pal.c[3], t*0.6);
    ctx.save();
    ctx.scale(s,s);
    ctx.rotate((l%2)*halfStep); /* yarim qadam — qatlamlar interlock */
    fn(ctx, R, p, Math.max(0.3, p.sw*(1 - 0.15*l)/Math.sqrt(s)), c0, c1, pal.c[2], pal.c[4]);
    ctx.restore();
  }
  ctx.restore();
}

/* Tashqi halqa bezagi — yakka rejimda naqshni ramkalaydi */
function drawBorderRing(ctx,R,p){
  const pal = PAL[p.pal] || PAL.gold;
  ctx.beginPath(); circle(ctx,0,0,R*1.06); st(ctx, pal.c[0], p.sw*0.8);
  ctx.beginPath(); circle(ctx,0,0,R*1.105); st(ctx, pal.c[2], p.sw*0.45);
  const n = Math.max(12, p.sym*2);
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const a = TAU*i/n;
    const A = pol(a, R*1.06), B = pol(a, R*1.105);
    ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]);
  }
  st(ctx, pal.c[1], p.sw*0.5);
}

/* ============================================================
   TESSELLATSIYA — PATH-BASED SEAMLESS TILING
   T(n,m) = n·v₁ + m·v₂ — Wallpaper guruhlari:
     p4:  v₁=(c,0), v₂=(0,c)
     p4m: p4 + ko'zgu (shaxmat tartibida aks)
     p6:  v₁=(c,0), v₂=(c/2, c·√3/2) — geksagonal panjara
     p6m: p6 + ko'zgu
   drawImage EMAS — har katak to'g'ridan drawPattern bilan chiziladi,
   R_tile > c/2 (bleed) → naqsh qo'shni katakka kiradi → chiziqlar UZILMAYDI
   ============================================================ */
const GRIDS = {
  p4:  {v1:c=>[c,0], v2:c=>[0,c],                     mirror:false, hex:false},
  p4m: {v1:c=>[c,0], v2:c=>[0,c],                     mirror:true,  hex:false},
  p6:  {v1:c=>[c,0], v2:c=>[c/2, c*Math.sqrt(3)/2],   mirror:false, hex:true},
  p6m: {v1:c=>[c,0], v2:c=>[c/2, c*Math.sqrt(3)/2],   mirror:true,  hex:true}
};
/* og'ir fraktallar tessellatsiyada yengillashtiriladi */
const HEAVY_TESS = {dragon:1, hilbert:1, voronoi:1, penrose:1, hankin8:1, hankin6:1};
/* siyrak chiziqli naqshlar — o'z radiusining kichik qismini "siyoh" bilan
   to'ldiradi, shuning uchun tessellatsiyada zichroq joylashtiriladi
   (pastdagi drawTessellation'da SPARSE_TESS izohiga qarang) */
const SPARSE_TESS = {koch:1, sierpinski:1, dragon:1, hilbert:1, voronoi:1, penrose:1, lissajous:1, spirograph:1};
/* Grid-naqshlar tiling rejimida UZLUKSIZ YAXLIT MAYDON sifatida chiziladi —
   medalyon takrori emas, haqiqiy chinnisozlikdagidek chok-suz naqsh */
const FIELD_TESS = {girih:1, hankin8:1, hankin6:1, panelgirih:1, pic3636:1, katak8:1, hexa:1, zellige:1, xitoy:1};
function drawTessellation(ctx,W,H,p){
  /* PIC naqshlari: davriy panjara → MATEMATIK ANIQ chok-suz to'ldirish */
  if(PIC_PATTERN[p.type] && picDrawTessellation(ctx,W,H,p)) return;
  if(FIELD_TESS[p.type]){
    const fp = {...p, _field:true, _cellpx:Math.max(60, TESS.cell||150), lay:1};
    drawPattern(ctx, W/2, H/2, Math.hypot(W,H)/2*1.02, fp);
    if(TESS.showCell){
      ctx.save();
      ctx.strokeStyle='rgba(74,124,89,.4)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      const c2 = fp._cellpx;
      for(let x=W/2 % c2; x<W; x+=c2){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for(let y=H/2 % c2; y<H; y+=c2){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.setLineDash([]); ctx.restore();
    }
    return;
  }
  const g = GRIDS[TESS.group] || GRIDS.p4;
  const cFull = Math.max(60, TESS.cell || Math.round(Math.min(W,H)/3));
  /* SIYRAK naqshlar (fraktal chiziqlar — Koch, Sierpinski, Drakon, Hilbert,
     Voronoi, Penrose, Lissaju, Spirograf): ularning "siyoh"i o'z radiusining
     kichik qismini egallaydi, shuning uchun oddiy bleed ORTIRISH yordam
     bermaydi — bo'sh joy naqsh o'zida, katak orasidagi masofada emas.
     Bunday turlar uchun katak QADAMINI qisqartirib, nusxalarni zich
     joylashtiramiz — shundagina qo'shnilar haqiqatda ustma-ust tushadi. */
  const c = SPARSE_TESS[p.type] ? cFull*0.4 : cFull;
  const v1 = g.v1(c), v2 = g.v2(c);
  /* bleed → seamless: kvadrat to'rda (p4/p4m) eng uzoq "bo'sh nuqta" diagonal
     qo'shnigacha c·√2/2 ≈ 0.707c masofada, olti burchakli to'rda (p6/p6m)
     esa uch qo'shni orasidagi markaz c/√3 ≈ 0.577c da — shu chegaradan
     past bleed diagonal/markaziy uchburchak bo'shliqlarida UZILISH
     (medalyonlar orasida oq bo'shliq) qoldiradi. */
  const Rt = cFull*(TESS.bleed === false ? 0.5 : (g.hex ? 0.64 : 0.76));
  /* tessellatsiyada har katak to'g'ridan chiziladi — samaradorlik uchun
     qatlamlar 2 taga, og'ir fraktallar cmp≤3 ga cheklanadi */
  let tp = {...p, lay:Math.min(2, p.lay)};
  if(HEAVY_TESS[p.type]) tp.cmp = Math.min(3, tp.cmp);
  const mX = W/2 + Rt*1.7, mY = H/2 + Rt*1.7;
  const nMax = Math.min(80, Math.ceil(Math.hypot(W,H)/c) + 2);
  NORING = TESS.noring === false ? 0 : Rt*0.84; /* medalyonlar ramkasiz — tabiiy tutashadi */
  for(let n=-nMax; n<=nMax; n++){
    for(let m=-nMax; m<=nMax; m++){
      const tx = n*v1[0] + m*v2[0], ty = n*v1[1] + m*v2[1];
      if(Math.abs(tx) > mX || Math.abs(ty) > mY) continue;
      const mirror = g.mirror && (((n+m)%2 + 2)%2 !== 0);
      ctx.save();
      ctx.translate(W/2 + tx, H/2 + ty);
      if(mirror) ctx.scale(-1,1); /* p4m/p6m — ko'zgu aksi */
      drawPattern(ctx, 0, 0, Rt, tp);
      ctx.restore();
    }
  }
  NORING = 0;
  if(TESS.showCell){
    ctx.save();
    ctx.strokeStyle = 'rgba(74,124,89,.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    for(let n=-nMax; n<=nMax; n++){
      for(let m=-nMax; m<=nMax; m++){
        const tx = n*v1[0] + m*v2[0], ty = n*v1[1] + m*v2[1];
        if(Math.abs(tx) > mX || Math.abs(ty) > mY) continue;
        const X = W/2 + tx, Y = H/2 + ty;
        ctx.beginPath();
        if(g.hex){
          const hr = c/Math.sqrt(3);
          for(let i=0;i<6;i++){
            const a = Math.PI/6 + TAU*i/6;
            if(i===0) ctx.moveTo(X+Math.cos(a)*hr, Y+Math.sin(a)*hr);
            else ctx.lineTo(X+Math.cos(a)*hr, Y+Math.sin(a)*hr);
          }
          ctx.closePath();
        } else {
          ctx.rect(X-c/2, Y-c/2, c, c);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
}
/* ============================================================
   UI YORDAMCHILARI
   ============================================================ */
function $(id){ return document.getElementById(id); }

/* ════════════════════════════════════════════════════════════════
   PIC — CHOK-SUZ TO'LDIRISH VA BOSHQARUV
   ════════════════════════════════════════════════════════════════ */
var PIC_TILE_CACHE = {};
/* Davriy PIC naqshini butun kanvasga chok-suz yoyish.
   true qaytarsa — chizish bajarildi; false bo'lsa umumiy yo'l ishlaydi. */
function picDrawTessellation(ctx, W, H, p){
  var tile = picTileOf(p.type);
  if(picIsRadial(tile)) return false;                 /* medalyon davriy emas */
  var pp = Object.assign({}, p, {tile:tile});
  /* SVG/DXF eksportida createPattern yo'q → maydonni to'g'ridan chizamiz
     (natija aynan bir xil geometriya, faqat takrorlanish vektor sifatida) */
  if(ctx._svg){
    var Rf = Math.hypot(W,H)/2*1.02;
    var spec = picSpecFrom(pp, Rf, {cellPx:Math.max(40,TESS.cell||150), bb:{x0:-Rf,y0:-Rf,x1:Rf,y1:Rf}});
    var M = picGet(spec);
    ctx.save(); ctx.translate(W/2,H/2);
    ctx.rotate((p.rot||0)*Math.PI/180);
    picRender(ctx, M, picStyleFrom(PAL[p.pal]||PAL.gold, pp, spec.unit));
    ctx.restore();
    return true;
  }
  var dpr = Math.min(2, (typeof window!=='undefined' && window.devicePixelRatio) || 1);
  var cell = Math.max(40, TESS.cell || 150);
  var key = [tile, cell, pp.dvar|0, pp.pal, pp.fill, pp.sw, pp.weave!==false, Math.round(dpr*100)].join('|');
  var T = PIC_TILE_CACHE[key];
  if(T === undefined){
    T = picSeamlessTile(pp, cell, dpr) || null;
    var ks = Object.keys(PIC_TILE_CACHE);
    if(ks.length > 10) delete PIC_TILE_CACHE[ks[0]];
    PIC_TILE_CACHE[key] = T;
  }
  if(!T) return false;
  var pat = ctx.createPattern(T.canvas, 'repeat');
  if(!pat) return false;
  /* Naqsh matritsasi: offscreen kanvas dpr da chizilgani uchun teskari
     masshtab beriladi — shunda ekranda aynan bir davr = T.w × T.h bo'ladi. */
  if(pat.setTransform && typeof DOMMatrix === 'function'){
    try { pat.setTransform(new DOMMatrix([1/dpr,0,0,1/dpr,0,0])); } catch(e){}
  }
  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.rotate((p.rot||0)*Math.PI/180);
  var D = Math.hypot(W,H)*1.1;
  ctx.fillStyle = pat;
  ctx.fillRect(-D, -D, D*2, D*2);
  ctx.restore();
  if(TESS.showCell){
    ctx.save();
    ctx.strokeStyle='rgba(74,124,89,.45)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    for(var x=(W/2)%T.w; x<W; x+=T.w){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(var y=(H/2)%T.h; y<H; y+=T.h){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.restore();
  }
  return true;
}
/* Girih boshqaruvi: kontakt burchagi variantlari + to'qish */
function buildGirihUI(){
  var box = $('acc-girih');
  var isPic = !!PIC_PATTERN[P.type];
  if(box) box.style.display = isPic ? '' : 'none';
  if(!isPic) return;
  var tile = picTileOf(P.type);
  var ds = picDeltas(tile, 10);
  var seg = $('seg-dvar');
  if(seg){
    seg.innerHTML = '';
    var cur = ((P.dvar|0) % ds.length + ds.length) % ds.length;
    ds.forEach(function(d, i){
      var b = document.createElement('button');
      b.textContent = d + '\u00b0';
      if(i === cur) b.className = 'sel';
      b.addEventListener('click', function(){
        P.dvar = i;
        buildGirihUI();
        redraw(true);
      });
      seg.appendChild(b);
    });
    var lab = $('v-dvar');
    if(lab) lab.textContent = '\u03b4 = ' + ds[cur] + '\u00b0';
  }
  var wv = $('chk-weave');
  if(wv) wv.checked = P.weave !== false;
  var nt = $('girih-note');
  if(nt){
    nt.textContent = (PIC_TILINGS[tile] ? PIC_TILINGS[tile].nm : tile) +
      ' \u2014 kontakt burchagi faqat shu diskret qiymatlarda naqshni to\'liq yopadi, ' +
      'shuning uchun erkin slayder emas, variant tanlanadi.';
  }
}
function wireGirihUI(){
  var wv = $('chk-weave');
  if(wv) wv.addEventListener('change', function(){ P.weave = wv.checked; PIC_TILE_CACHE = {}; redraw(); });
}


function ntf(msg, type){
  const wrap = $('toasts');
  if(!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type==='err' ? 'err' : 'ok');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; }, 2600);
  setTimeout(()=>{ if(t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

/* ---------- Studio canvas ---------- */
let cvEl=null, cvCtx=null;
function resizeCanvas(){
  if(!cvEl) return;
  const wrap = $('cv-wrap');
  if(!wrap) return;
  const dpr = Math.min(2, window.devicePixelRatio||1);
  const w = wrap.clientWidth||600, h = wrap.clientHeight||500;
  cvEl.width = Math.max(50, Math.round(w*dpr));
  cvEl.height = Math.max(50, Math.round(h*dpr));
  cvCtx = cvEl.getContext('2d');
  if(cvCtx) cvCtx.setTransform(dpr,0,0,dpr,0,0);
  redraw();
}
const REVEAL = { raf:0 };
/* Naqsh O'ZI CHIZILADI: spiral-sektor ochilish + oltin mo'yqalam uchi */
function startReveal(){
  if(!cvCtx || !cvEl) return;
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(typeof cancelAnimationFrame === 'function') cancelAnimationFrame(REVEAL.raf);
  const snap = document.createElement('canvas');
  snap.width = cvEl.width; snap.height = cvEl.height;
  const sctx = snap.getContext('2d');
  if(!sctx) return;
  sctx.drawImage(cvEl, 0, 0);
  const pal = PAL[P.pal] || PAL.gold;
  const nowFn = ()=> (window.performance ? performance.now() : Date.now());
  const t0 = nowFn(), dur = 800;
  const cx = cvEl.width/2, cy = cvEl.height/2;
  const Rm = Math.hypot(cx, cy)*1.05;
  const step = ()=>{
    const t = Math.min(1, (nowFn()-t0)/dur);
    const e = 1 - Math.pow(1-t, 3);
    cvCtx.save();
    cvCtx.setTransform(1,0,0,1,0,0);
    cvCtx.clearRect(0,0,cvEl.width,cvEl.height);
    cvCtx.fillStyle = pal.bg;
    cvCtx.fillRect(0,0,cvEl.width,cvEl.height);
    const a1 = -Math.PI/2 + e*TAU;
    const rr = Rm*Math.min(1, 0.3 + e*0.85);
    cvCtx.beginPath();
    cvCtx.moveTo(cx,cy);
    cvCtx.arc(cx,cy,rr,-Math.PI/2,a1);
    cvCtx.closePath();
    cvCtx.clip();
    cvCtx.drawImage(snap,0,0);
    cvCtx.restore();
    if(t < 1){
      /* mo'yqalam uchi — porloq oltin nuqta chizish chetida yuradi */
      const br = rr*0.66;
      const bx = cx + Math.cos(a1)*br, by = cy + Math.sin(a1)*br;
      cvCtx.save();
      cvCtx.setTransform(1,0,0,1,0,0);
      cvCtx.shadowColor = 'rgba(224,189,106,.95)';
      cvCtx.shadowBlur = 20;
      cvCtx.fillStyle = '#e0bd6a';
      cvCtx.beginPath(); cvCtx.arc(bx,by,5.5,0,TAU); cvCtx.fill();
      cvCtx.restore();
      REVEAL.raf = requestAnimationFrame(step);
    } else {
      cvCtx.save();
      cvCtx.setTransform(1,0,0,1,0,0);
      cvCtx.clearRect(0,0,cvEl.width,cvEl.height);
      cvCtx.drawImage(snap,0,0);
      cvCtx.restore();
    }
  };
  REVEAL.raf = requestAnimationFrame(step);
}
function redraw(animate){
  if(!cvCtx || !cvEl) return;
  const dpr = Math.min(2, window.devicePixelRatio||1);
  const W = cvEl.width/dpr, H = cvEl.height/dpr;
  const pal = PAL[P.pal] || PAL.gold;
  P._bg = pal.bg;
  cvCtx.save();
  cvCtx.setTransform(dpr,0,0,dpr,0,0);
  cvCtx.clearRect(0,0,W,H);
  cvCtx.fillStyle = pal.bg;
  cvCtx.fillRect(0,0,W,H);
  if(TESS.on){
    drawTessellation(cvCtx, W, H, P);
  } else {
    const grad = cvCtx.createRadialGradient(W/2,H/2,10, W/2,H/2, Math.max(W,H)*0.7);
    grad.addColorStop(0,'rgba(255,255,255,0.35)');
    grad.addColorStop(1,'rgba(0,0,0,0.03)');
    cvCtx.fillStyle = grad;
    cvCtx.fillRect(0,0,W,H);
    const Rb = Math.min(W,H)*0.40;
    cvCtx.save();
    cvCtx.translate(W/2, H/2);
    cvCtx.rotate((P.rot||0)*Math.PI/180);
    drawBorderRing(cvCtx, Rb*1.04, P);
    cvCtx.restore();
    drawPattern(cvCtx, W/2, H/2, Rb, P);
  }
  cvCtx.restore();
  updateInfoBar();
  if(cvEl.classList){
    cvEl.classList.remove('pulse');
    void cvEl.offsetWidth;
    cvEl.classList.add('pulse');
  }
  if(threeReady){
    /* 3D teksturani debounce bilan yangilash — slayder surilganda ortiqcha yuk bo'lmasin */
    if(redraw._t3) clearTimeout(redraw._t3);
    redraw._t3 = setTimeout(()=>{ if(threeReady) update3DTexture(); }, 180);
  }
  arNeedsRedraw = true;
  if(animate) startReveal();
}
function updateInfoBar(){
  const el = $('info-name');
  if(!el) return;
  const pt = getPattern(P.type), pal = PAL[P.pal] || PAL.gold;
  if(PIC_PATTERN[P.type]){
    const tl = picTileOf(P.type);
    const ds = picDeltas(tl, 10);
    const dv = ds[((P.dvar|0) % ds.length + ds.length) % ds.length];
    el.innerHTML = '<b>'+pt.nm+'</b> · PIC yadrosi · kontakt burchagi δ='+dv+'° · '+pal.nm+
      (P.weave===false ? '' : ' · to\'qilgan') +
      (TESS.on ? ' · chok-suz tiling · katak '+TESS.cell+'px' : '');
    return;
  }
  el.innerHTML = '<b>'+pt.nm+'</b> · '+P.sym+' simmetriya · '+pal.nm+' · qatlam: '+P.lay + (TESS.on ? ' · tessellatsiya '+TESS.group+' · katak '+TESS.cell+'px' : '');
}

/* ---------- Slayderlar ---------- */
const SLIDERS = [
  {k:'sym',  nm:'Simmetriya (n)',   min:3,   max:16,  step:1},
  {k:'cmp',  nm:'Murakkablik',      min:1,   max:8,   step:1},
  {k:'sw',   nm:'Chiziq qalinligi', min:0.5, max:6,   step:0.1},
  {k:'ir',   nm:'Ichki radius',     min:0.1, max:0.8, step:0.01},
  {k:'spir', nm:'Spiral kuchi',     min:0,   max:1,   step:0.01},
  {k:'dens', nm:'Zichlik',          min:0,   max:1,   step:0.01},
  {k:'lay',  nm:'Qatlamlar',        min:1,   max:5,   step:1},
  {k:'skew', nm:'Burilish (skew)',  min:-1,  max:1,   step:0.01},
  {k:'rot',  nm:'Aylanish (°)',     min:0,   max:360, step:1}
];
function buildSliders(){
  const box = $('sliders');
  if(!box) return;
  box.innerHTML = '';
  SLIDERS.forEach(s=>{
    const row = document.createElement('div');
    row.className = 'sl-row';
    row.innerHTML = '<label>'+s.nm+' <b id="v-'+s.k+'">'+P[s.k]+'</b></label>'+
      '<input type="range" id="sl-'+s.k+'" min="'+s.min+'" max="'+s.max+'" step="'+s.step+'" value="'+P[s.k]+'">';
    box.appendChild(row);
    const inp = row.querySelector('input');
    if(inp) inp.addEventListener('input', ()=>{
      P[s.k] = parseFloat(inp.value);
      if(s.k==='sw' || s.k==='dens') PIC_TILE_CACHE = {};
      const v = $('v-'+s.k);
      if(v) v.textContent = (s.step<1 ? P[s.k].toFixed(2) : P[s.k]);
      redraw();
    });
  });
}
function syncSliders(){
  SLIDERS.forEach(s=>{
    const inp = $('sl-'+s.k), v = $('v-'+s.k);
    if(inp) inp.value = P[s.k];
    if(v) v.textContent = (s.step<1 ? Number(P[s.k]).toFixed(2) : P[s.k]);
  });
  const fillSel = $('sel-fill'); if(fillSel) fillSel.value = P.fill;
  const curPt = getPattern(P.type);
  if(curPt && curPt.cat !== CUR_CAT){ CUR_CAT = curPt.cat; }
  renderPatGrid();
  document.querySelectorAll('.pal-chip').forEach(b=>{
    b.classList.toggle('sel', b.dataset.pal===P.pal);
  });
  applyParamAvailability();
}

/* ---------- Naqsh ro'yxati: kategoriya tablari + o'ralgan chip to'ri
   (barcha 5 kategoriya — O'zbek, Islimiy, Kombo, DUNYO, Matematik — bir bosishda) ---------- */
const CAT_SHORT = {A:"O'zbek", B:"Islimiy", C:"Kombo", D:"Dunyo", E:"Matematik"};
let CUR_CAT = 'A';
function renderPatGrid(){
  const grid = $('pat-grid-box');
  if(!grid) return;
  grid.innerHTML = '';
  PATTERNS.filter(pt=>pt.cat===CUR_CAT).forEach(pt=>{
    const b = document.createElement('button');
    b.textContent = pt.nm;
    b.dataset.id = pt.id;
    if(pt.id===P.type) b.classList.add('sel');
    b.addEventListener('click', ()=>{
      P.type = pt.id;
      syncSliders();
      redraw(true);
    });
    grid.appendChild(b);
  });
  document.querySelectorAll('#cat-tabs button').forEach(b=>{
    b.classList.toggle('sel', b.dataset.cat===CUR_CAT);
  });
}
function buildPatternList(){
  const box = $('pat-list');
  if(!box) return;
  box.innerHTML = '';
  const cur = getPattern(P.type);
  CUR_CAT = cur ? cur.cat : 'A';
  const tabs = document.createElement('div');
  tabs.className = 'cat-tabs';
  tabs.id = 'cat-tabs';
  Object.keys(CATS).forEach(cat=>{
    const b = document.createElement('button');
    b.textContent = CAT_SHORT[cat] || cat;
    b.title = CATS[cat];
    b.dataset.cat = cat;
    if(cat===CUR_CAT) b.classList.add('sel');
    b.addEventListener('click', ()=>{
      CUR_CAT = cat;
      renderPatGrid();
    });
    tabs.appendChild(b);
  });
  box.appendChild(tabs);
  const grid = document.createElement('div');
  grid.className = 'pat-wrap';
  grid.id = 'pat-grid-box';
  box.appendChild(grid);
  renderPatGrid();
}

/* ---------- Qaysi slayder qaysi naqshda ishlaydi ---------- */
const PARAM_MAP = {
  xatam:['cmp'],
  rozetta:['sym','cmp','ir','dens'], yulduz:['sym','spir'],
  muqarnas:['sym','cmp','ir'], katak8:['cmp','dens'],
  hexa:['cmp','dens'], zanjira:['sym','dens'],
  girih:['dens'], hankin8:['dens'], hankin6:['dens'], panelgirih:['dens'],
  pic3636:['dens'], shamsa10:[],
  islimiy:['sym','cmp','spir','dens'], rumi:['sym','dens'],
  hatayi:['sym','cmp','dens'], palak:['sym','cmp'],
  shamsa:['sym'], arabesk:['sym','cmp','spir'],
  scroll:['sym','dens','spir'], medallion:['sym','cmp','ir','spir','dens'],
  gi:'*', sg:'*', mi:'*', xr:'*',
  celtic:['sym','cmp','dens'], mandala:['sym','cmp','dens','spir'],
  penrose:['cmp'], zellige:['cmp','dens','spir'],
  batik:['sym','cmp','dens','spir'], paisley:['sym','cmp','dens','spir'],
  greek:['sym','cmp','ir','dens'], xitoy:['cmp','ir','dens'],
  koch:['cmp','ir'], sierpinski:['cmp'], dragon:['cmp'], hilbert:['cmp'],
  spirograph:['sym','cmp','spir'], lissajous:['sym','cmp','dens'],
  voronoi:['sym','cmp','dens','spir']
};
function applyParamAvailability(){
  buildGirihUI();
  const spec = PARAM_MAP[P.type];
  const act = (spec==='*' || !spec) ? ['sym','cmp','ir','spir','dens'] : spec;
  ['sym','cmp','ir','spir','dens'].forEach(k=>{
    const inp = $('sl-'+k);
    const row = inp ? inp.parentNode : null;
    if(row && row.classList) row.classList.toggle('off', act.indexOf(k)<0);
  });
  const layInp = $('sl-lay');
  const layRow = layInp ? layInp.parentNode : null;
  if(layRow && layRow.classList) layRow.classList.toggle('off', !!SINGLE_LAYER[P.type]);
}

/* ---------- Palitralar ---------- */
function buildPalettes(){
  const row = $('pal-row');
  if(!row) return;
  row.innerHTML = '';
  Object.keys(PAL).forEach(key=>{
    const b = document.createElement('button');
    b.className = 'pal-chip' + (key===P.pal ? ' sel' : '');
    b.dataset.pal = key;
    b.title = PAL[key].nm;
    b.setAttribute('aria-label', PAL[key].nm);
    PAL[key].c.forEach(c=>{
      const s = document.createElement('span');
      s.style.background = c;
      b.appendChild(s);
    });
    b.addEventListener('click', ()=>{
      P.pal = key;
      PIC_TILE_CACHE = {};
      syncSliders();
      redraw();
    });
    row.appendChild(b);
  });
}

/* ---------- Tasodifiy ---------- */
function randomize(){
  const ids = PATTERNS.map(x=>x.id);
  const pals = Object.keys(PAL);
  P.type = ids[Math.floor(Math.random()*ids.length)];
  P.pal  = pals[Math.floor(Math.random()*pals.length)];
  P.sym  = 3 + Math.floor(Math.random()*14);
  P.cmp  = 1 + Math.floor(Math.random()*8);
  P.sw   = +(0.8 + Math.random()*3.5).toFixed(1);
  P.ir   = +(0.15 + Math.random()*0.6).toFixed(2);
  P.spir = +(Math.random()).toFixed(2);
  P.dens = +(0.2 + Math.random()*0.7).toFixed(2);
  P.lay  = 1 + Math.floor(Math.random()*4);
  P.skew = +((Math.random()-0.5)*0.8).toFixed(2);
  P.rot  = Math.floor(Math.random()*360);
  P.dvar = Math.floor(Math.random()*4);
  syncSliders();
  redraw(true);
  ntf('Tasodifiy naqsh: ' + getPattern(P.type).nm, 'ok');
}

/* ---------- Saqlangan naqshlar galereyasi ---------- */
function lsGet(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){ return false; }
}
/* ===========================================================================
   SAQLANGAN NAQSHLAR — BULUT (Supabase) yoki lokal
   ---------------------------------------------------------------------------
   Supabase rejimida va foydalanuvchi kirgan bo'lsa naqshlar `public.patterns`
   jadvalida saqlanadi: shunda ular BOSHQA QURILMADA ham ochiladi. Aks holda
   (server sozlanmagan yoki mehmon) — localStorage.

   Xavfsizlik serverda: RLS siyosati `user_id = auth.uid() and is_active()`
   shartini qo'yadi, ya'ni har kim faqat O'Z naqshlarini ko'radi va
   o'zgartiradi; bloklangan foydalanuvchi esa hech narsa yoza olmaydi
   (supabase/schema.sql). Mijozdagi tekshiruvlar faqat qulaylik uchun.

   CLOUD.patterns — jadvalning xotiradagi nusxasi. Interfeys sinxron
   getSavedList() ni chaqiradi, shuning uchun ro'yxat kirishda bir marta
   yuklanadi va har o'zgarishdan keyin yangilanadi.
   =========================================================================== */
const CLOUD = { patterns:null, loading:false, err:'' };
function cloudActive(){ return (typeof sbEnabled === 'function') && sbEnabled() && !!AUTH.user; }

function cloudRowToItem(r){
  return { id:r.id, p:r.params || {}, thumb:r.thumb || '', t:Date.parse(r.created_at) || Date.now() };
}
async function cloudLoadPatterns(){
  if(!cloudActive()){ CLOUD.patterns = null; return; }
  CLOUD.loading = true; CLOUD.err = '';
  try{
    const { data, error } = await AUTH.client
      .from('patterns')
      .select('id, params, thumb, created_at')
      .order('created_at', { ascending:false })
      .limit(200);
    if(error) throw error;
    CLOUD.patterns = (data || []).map(cloudRowToItem);
  }catch(e){
    console.error('[cloud] load', e);
    CLOUD.err = (e && e.message) || 'yuklab bo\'lmadi';
    CLOUD.patterns = CLOUD.patterns || [];
  }
  CLOUD.loading = false;
}
async function cloudSavePattern(item){
  const { data, error } = await AUTH.client
    .from('patterns')
    .insert({ user_id: AUTH.user.id, name: (item.p && item.p.type) || null,
              params: item.p, thumb: item.thumb })
    .select('id, params, thumb, created_at')
    .single();
  if(error) throw error;
  CLOUD.patterns = CLOUD.patterns || [];
  CLOUD.patterns.unshift(cloudRowToItem(data));
  return true;
}
async function cloudDeletePattern(id){
  const { error } = await AUTH.client.from('patterns').delete().eq('id', id);
  if(error) throw error;
  CLOUD.patterns = (CLOUD.patterns || []).filter(x=>x.id !== id);
  return true;
}
/* Mehmon sifatida yasalgan naqshlar kirishda YO'QOLMASIN — bir marta
   bulutga ko'chiriladi va lokal ro'yxat tozalanadi. */
async function cloudMigrateGuest(){
  if(!cloudActive()) return 0;
  let guest = [];
  try{ guest = lsGet('naqsh_saved', []) || []; }catch(e){}
  if(!guest.length) return 0;
  let n = 0;
  for(const it of guest.slice(0, 48)){
    try{ await cloudSavePattern(it); n++; }catch(e){ console.error('[cloud] migrate', e); break; }
  }
  if(n){ try{ localStorage.removeItem('naqsh_saved'); }catch(e){} }
  return n;
}

/* Saqlangan naqshlar: kirgan foydalanuvchining hisobida, aks holda mehmon ro'yxatida */
function getSavedList(){
  if(cloudActive()) return CLOUD.patterns || [];
  const u = (typeof currentUser==='function') ? currentUser() : null;
  if(u){ const users = usersGet(); return (users[u.login] && users[u.login].patterns) || []; }
  return lsGet('naqsh_saved', []);
}
function setSavedList(arr){
  const u = (typeof currentUser==='function') ? currentUser() : null;
  if(u){
    const users = usersGet();
    if(users[u.login]){ users[u.login].patterns = arr; return usersSet(users); }
  }
  return lsSet('naqsh_saved', arr);
}
/* Yon paneldagi PROFIL KARTASI — kim kirgan va naqshlar qayerda saqlanmoqda.
   Nomi renderProfileCard: pastda profil OYNASI uchun renderProfile() bor va
   ikkinchi e'lon birinchisini bosib ketardi (funksiya deklaratsiyasi
   ko'tariladi) — shu sababli karta umuman chizilmasdi. */
function renderProfileCard(){
  const box = $('profile-box');
  if(!box) return;
  const u = (typeof currentUser === 'function') ? currentUser() : null;
  if(!u){
    box.innerHTML = '<div class="prof"><div class="prof-av">?</div><div class="prof-i">' +
      '<div class="prof-n">Mehmon</div>' +
      '<div class="prof-m">Naqshlar faqat shu brauzerda saqlanadi</div>' +
      '<span class="prof-b local">lokal</span></div></div>';
    return;
  }
  const cloud = cloudActive();
  const initials = (u.name || u.login || '?').trim().charAt(0).toUpperCase();
  const prov = u.provider === 'google' ? 'Google' : 'Email';
  const n = getSavedList().length;
  const since = u.created ? new Date(u.created).toLocaleDateString('uz-UZ') : '';
  box.innerHTML =
    '<div class="prof">' +
      '<div class="prof-av">' + escHTML(initials) + '</div>' +
      '<div class="prof-i">' +
        '<div class="prof-n">' + escHTML(u.name || u.login) + '</div>' +
        '<div class="prof-m">' + escHTML(u.login) + ' · ' + prov +
          (since ? ' · ' + escHTML(since) : '') + '</div>' +
        '<span class="prof-b ' + (cloud ? 'cloud' : 'local') + '">' +
          (cloud ? '☁️ hisobda saqlanadi' : 'shu qurilmada') +
        '</span> <span class="prof-b">' + n + ' ta naqsh</span>' +
      '</div>' +
    '</div>';
}
function renderGallery(){
  const grid = $('gal-grid'), empty = $('gal-empty');
  if(!grid) return;
  const saved = getSavedList();
  grid.innerHTML = '';
  if(empty) empty.style.display = saved.length ? 'none' : 'block';
  saved.forEach((item, idx)=>{
    const d = document.createElement('div');
    d.className = 'gal-item';
    d.title = 'Yuklash: ' + (getPattern(item.p.type).nm);
    const img = document.createElement('img');
    img.src = item.thumb;
    img.alt = getPattern(item.p.type).nm;
    d.appendChild(img);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.setAttribute('aria-label','O\'chirish');
    del.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(cloudActive() && item.id !== undefined){
        cloudDeletePattern(item.id)
          .then(()=>{ renderGallery(); ntf('Naqsh o\'chirildi', 'ok'); })
          .catch(err=>{
            console.error('[cloud] delete', err);
            ntf('O\'chirib bo\'lmadi: ' + ((err && err.message) || 'noma\'lum'), 'err');
          });
        return;
      }
      const arr = getSavedList();
      arr.splice(idx,1);
      setSavedList(arr);
      renderGallery();
      ntf('Naqsh o\'chirildi', 'ok');
    });
    d.appendChild(del);
    d.addEventListener('click', ()=>{
      Object.assign(P, item.p);
      syncSliders();
      redraw(true);
      ntf('Saqlangan naqsh yuklandi', 'ok');
    });
    grid.appendChild(d);
  });
  renderProfileCard();
}
function saveCurrent(){
  const off = document.createElement('canvas');
  off.width = off.height = 144;
  const octx = off.getContext('2d');
  if(octx){
    const pal = PAL[P.pal] || PAL.gold;
    octx.fillStyle = pal.bg;
    octx.fillRect(0,0,144,144);
    drawPattern(octx, 72, 72, 66, P);
  }
  const snap = {...P}; delete snap._bg;
  /* Ko'rinish rasmi JPEG (0.85) — galereyada farqi bilinmaydi, lekin hajmi
     PNG dan ~3.6 barobar kichik (o'lchandi: 38.9 KB → 10.9 KB). Bulutda bu
     to'g'ridan-to'g'ri sig'imga aylanadi: bepul 500 MB da ~273 o'rniga
     ~975 to'la foydalanuvchi. Fon baribir to'ldirilgani uchun JPEG da
     shaffoflik yo'qligi muammo emas. */
  const item = { p:snap, thumb: off.toDataURL('image/jpeg', 0.85), t:Date.now() };
  if(cloudActive()){
    cloudSavePattern(item)
      .then(()=>{ renderGallery(); ntf('Naqsh hisobingizga saqlandi ☁️', 'ok'); })
      .catch(e=>{
        console.error('[cloud] save', e);
        ntf('Bulutga saqlab bo\'lmadi: ' + ((e && e.message) || 'noma\'lum'), 'err');
      });
    return;
  }
  const arr = getSavedList();
  arr.unshift(item);
  if(arr.length > 48) arr.length = 48;
  if(setSavedList(arr)){
    renderGallery();
    ntf('Naqsh saqlandi 💾', 'ok');
  } else {
    ntf('Saqlab bo\'lmadi (localStorage mavjud emas)', 'err');
  }
}

/* ============================================================
   EKSPORT — Canvas API interceptor (SVG/DXF), PNG
   ============================================================ */
/* 2×3 affin matritsa: [a,b,c,d,e,f] */
function matMul(m,n){
  return [
    m[0]*n[0]+m[2]*n[1],       m[1]*n[0]+m[3]*n[1],
    m[0]*n[2]+m[2]*n[3],       m[1]*n[2]+m[3]*n[3],
    m[0]*n[4]+m[2]*n[5]+m[4],  m[1]*n[4]+m[3]*n[5]+m[5]
  ];
}
function SvgCtx(){
  this._svg = true;
  this.m = [1,0,0,1,0,0];
  this.stack = [];
  this.paths = [];      /* {cmds:[['M',x,y]|['L',x,y]|['C',...]|['Z']], w, op:'stroke'|'fill'} */
  this.cur = [];        /* joriy path buyruqlari */
  this.strokeStyle = '#000'; this.fillStyle = '#000';
  this.lineWidth = 1; this.globalAlpha = 1;
  this.lineCap = 'round'; this.lineJoin = 'round';
  this.font = '10px sans-serif';
}
SvgCtx.prototype.tp = function(x,y){
  const m = this.m;
  return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
};
SvgCtx.prototype.scaleFactor = function(){
  const m = this.m;
  return Math.sqrt(Math.abs(m[0]*m[3] - m[1]*m[2])) || 1;
};
SvgCtx.prototype.save = function(){ this.stack.push(this.m.slice()); };
SvgCtx.prototype.restore = function(){ const m = this.stack.pop(); if(m) this.m = m; };
SvgCtx.prototype.translate = function(x,y){ this.m = matMul(this.m, [1,0,0,1,x,y]); };
SvgCtx.prototype.rotate = function(a){ const c=Math.cos(a), s=Math.sin(a); this.m = matMul(this.m, [c,s,-s,c,0,0]); };
SvgCtx.prototype.scale = function(x,y){ this.m = matMul(this.m, [x,0,0,y,0,0]); };
SvgCtx.prototype.transform = function(a,b,c,d,e,f){ this.m = matMul(this.m, [a,b,c,d,e,f]); };
SvgCtx.prototype.setTransform = function(a,b,c,d,e,f){ this.m = [a,b,c,d,e,f]; };
SvgCtx.prototype.beginPath = function(){ this.cur = []; };
SvgCtx.prototype.moveTo = function(x,y){ const p = this.tp(x,y); this.cur.push(['M',p[0],p[1]]); };
SvgCtx.prototype.lineTo = function(x,y){ const p = this.tp(x,y); this.cur.push(['L',p[0],p[1]]); };
SvgCtx.prototype.bezierCurveTo = function(x1,y1,x2,y2,x,y){
  const a = this.tp(x1,y1), b = this.tp(x2,y2), c = this.tp(x,y);
  this.cur.push(['C',a[0],a[1],b[0],b[1],c[0],c[1]]);
};
SvgCtx.prototype.quadraticCurveTo = function(qx,qy,x,y){
  /* kvadratik → kubik konversiya */
  let sx = 0, sy = 0;
  for(let i=this.cur.length-1; i>=0; i--){
    const c = this.cur[i];
    if(c[0]==='M' || c[0]==='L'){ sx=c[1]; sy=c[2]; break; }
    if(c[0]==='C'){ sx=c[5]; sy=c[6]; break; }
  }
  const q = this.tp(qx,qy), e = this.tp(x,y);
  this.cur.push(['C',
    sx + 2/3*(q[0]-sx), sy + 2/3*(q[1]-sy),
    e[0] + 2/3*(q[0]-e[0]), e[1] + 2/3*(q[1]-e[1]),
    e[0], e[1]]);
};
SvgCtx.prototype.closePath = function(){ this.cur.push(['Z']); };
SvgCtx.prototype.arc = function(x,y,r,a0,a1,ccw){
  /* yoy → 4/3·tan(Δθ/4) Bezier approksimatsiyasi */
  if(ccw){ const t=a0; a0=a1; a1=t + TAU; }
  let da = a1 - a0;
  if(da < 0) da += TAU;
  if(da > TAU) da = TAU;
  const segs = Math.max(1, Math.ceil(da / (Math.PI/2)));
  const step = da/segs;
  let sp = this.tp(x + Math.cos(a0)*r, y + Math.sin(a0)*r);
  this.cur.push([this.cur.length ? 'L' : 'M', sp[0], sp[1]]);
  for(let i=0;i<segs;i++){
    const t0 = a0 + step*i, t1 = t0 + step;
    const k = 4/3*Math.tan((t1-t0)/4)*r;
    const p1 = this.tp(x+Math.cos(t0)*r - Math.sin(t0)*k, y+Math.sin(t0)*r + Math.cos(t0)*k);
    const p2 = this.tp(x+Math.cos(t1)*r + Math.sin(t1)*k, y+Math.sin(t1)*r - Math.cos(t1)*k);
    const p3 = this.tp(x+Math.cos(t1)*r, y+Math.sin(t1)*r);
    this.cur.push(['C',p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]]);
  }
};
SvgCtx.prototype.ellipse = function(x,y,rx,ry,rot,a0,a1,ccw){
  this.save();
  this.translate(x,y); this.rotate(rot||0); this.scale(rx,ry);
  this.arc(0,0,1,a0===undefined?0:a0, a1===undefined?TAU:a1, ccw);
  this.restore();
};
SvgCtx.prototype.rect = function(x,y,w,h){
  this.moveTo(x,y); this.lineTo(x+w,y); this.lineTo(x+w,y+h); this.lineTo(x,y+h); this.closePath();
};
SvgCtx.prototype.stroke = function(){
  if(this.cur.length) this.paths.push({cmds:this.cur.slice(), w:this.lineWidth*this.scaleFactor(), op:'stroke'});
};
SvgCtx.prototype.fill = function(){
  if(this.cur.length) this.paths.push({cmds:this.cur.slice(), w:0.5, op:'fill'});
};
SvgCtx.prototype.clearRect = function(){};
SvgCtx.prototype.fillRect = function(){};
SvgCtx.prototype.strokeRect = function(x,y,w,h){ this.beginPath(); this.rect(x,y,w,h); this.stroke(); };
SvgCtx.prototype.clip = function(){};
SvgCtx.prototype.drawImage = function(){};
SvgCtx.prototype.setLineDash = function(){};
SvgCtx.prototype.fillText = function(){};
SvgCtx.prototype.measureText = function(){ return {width:0}; };
SvgCtx.prototype.createLinearGradient = function(){ return {addColorStop:function(){}}; };
SvgCtx.prototype.createRadialGradient = function(){ return {addColorStop:function(){}}; };

function num(v){ return (Math.round(v*100)/100).toString(); }
function cmdsToD(cmds){
  let d = '';
  for(const c of cmds){
    if(c[0]==='M') d += 'M ' + num(c[1]) + ' ' + num(c[2]) + ' ';
    else if(c[0]==='L') d += 'L ' + num(c[1]) + ' ' + num(c[2]) + ' ';
    else if(c[0]==='C') d += 'C ' + num(c[1]) + ' ' + num(c[2]) + ' ' + num(c[3]) + ' ' + num(c[4]) + ' ' + num(c[5]) + ' ' + num(c[6]) + ' ';
    else if(c[0]==='Z') d += 'Z ';
  }
  return d.trim();
}
/* Naqshni vektor sifatida yozib olish.
   bw × bh — taxta o'lchami ICHKI birlikda (uzun tomon 1000).
   fill:
     'tile'  — naqsh butun yuzani to'ldiradi (tessellatsiya);
     'medal' — markazda doira medalyon (eski xatti-harakat).
   Ilgari faqat 500,500,470 — ya'ni HAR DOIM kvadrat taxtadagi DOIRA edi,
   shuning uchun foydalanuvchi qanday o'lcham tanlasa ham doira chiqardi. */
function recordPattern(bw, bh, fill){
  bw = bw || 1000; bh = bh || bw;
  const fake = new SvgCtx();
  const saveTess = TESS.on;
  if(fill === 'medal'){
    drawPattern(fake, bw/2, bh/2, Math.min(bw, bh)*0.47, P);
  } else {
    TESS.on = true;
    drawTessellation(fake, bw, bh, P);
  }
  TESS.on = saveTess;
  return fake.paths;
}
/* Fizik o'lchamdan ichki taxta o'lchamini chiqarish: uzun tomon 1000
   birlik, kalta tomon nisbatan. Shunday qilinsa naqsh chizish miqyosi
   avvalgidek qoladi (kvadrat 100 mm da aynan 1000×1000), lekin
   to'rtburchak o'lchamlar ham to'g'ri chiqadi. */
function boardFor(wMm, hMm){
  const S = 1000;
  const w = Math.max(1, wMm || 100), h = Math.max(1, hMm || w);
  const mx = Math.max(w, h);
  return { bw: S*w/mx, bh: S*h/mx, k: mx/S };   /* k — birlik → mm */
}
/* Bezier → 32 nuqtali tabaqalash */
function flattenCmds(cmds){
  const polys = [];
  let cur = null, sx = 0, sy = 0;
  for(const c of cmds){
    if(c[0]==='M'){
      if(cur && cur.pts.length>1) polys.push(cur);
      cur = {pts:[[c[1],c[2]]], closed:false};
      sx=c[1]; sy=c[2];
    } else if(c[0]==='L'){
      if(!cur) cur = {pts:[[sx,sy]], closed:false};
      cur.pts.push([c[1],c[2]]);
      sx=c[1]; sy=c[2];
    } else if(c[0]==='C'){
      if(!cur) cur = {pts:[[sx,sy]], closed:false};
      const p0=[sx,sy], p1=[c[1],c[2]], p2=[c[3],c[4]], p3=[c[5],c[6]];
      /* Adaptiv tabaqalash: segmentlar soni egri chiziq uzunligidan
         chiqadi. Ilgari har egri qat'iy 32 bo'lakka bo'linardi — mayda
         egrilarda bu keraksiz nuqtalar (fayl hajmi va ishlov vaqti),
         yirik egrilarda esa aniqlik yetmasligi mumkin edi.
         n ≈ √(2·L) da xato ≈ L/(8n²) ≈ 1/16 birlik = 100 mm detalda
         0.006 mm — lazer aniqligidan ancha mayda. */
      const L = Math.hypot(p1[0]-p0[0], p1[1]-p0[1]) +
                Math.hypot(p2[0]-p1[0], p2[1]-p1[1]) +
                Math.hypot(p3[0]-p2[0], p3[1]-p2[1]);
      const n = Math.max(3, Math.min(32, Math.ceil(Math.sqrt(2*L))));
      for(let i=1;i<=n;i++){
        cur.pts.push(cubicAt(p0,p1,p2,p3,i/n));
      }
      sx=c[5]; sy=c[6];
    } else if(c[0]==='Z'){
      if(cur){ cur.closed = true; polys.push(cur); cur = null; }
    }
  }
  if(cur && cur.pts.length>1) polys.push(cur);
  return polys;
}
/* ---------------------------------------------------------------------------
   LAZER GEOMETRIYASINI TAYYORLASH
   Ikki o'lchangan muammo tuzatiladi:

   1) ISH MAYDONIDAN CHIQISH. Tekislikni to'ldiruvchi naqshlar (girih
      oilasi, katak8, hexa, zellige) berilgan radiusdan tashqariga ham
      chizadi. O'lchov: panelgirih 1000 birlik taxtada -2657…3880 gacha
      chiqib ketgan — ya'ni 100 mm deb e'lon qilingan detal aslida 654 mm.
      Bunday fayl lazerda material chetidan tashqarida kesadi. Shuning
      uchun butun geometriya taxtaga QIRQILADI: yopiq konturlar
      Sutherland–Hodgman bilan (yopiqligicha qoladi, chegara bo'ylab
      yuradi), ochiq chiziqlar Liang–Barsky bilan bo'laklanadi.

   2) TAKRORIY KONTURLAR. Qo'shni plitkalar umumiy qirrani ikki marta
      chizadi (o'lchovda hexa'da 82%, celtic'da 65%). Lazer o'sha chiziqni
      ikki marta kesadi: material kuyadi va ish vaqti bekorga oshadi.
      Bir xil konturlar bitta qoldiriladi.
   --------------------------------------------------------------------------- */
const BOARD = { x0:0, y0:0, x1:1000, y1:1000 };

function _ix(a, b, axis, val){
  const t = (val - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
}
/* yopiq kontur — Sutherland–Hodgman */
function clipClosed(pts, R){
  const edges = [
    [p => p[0] >= R.x0, (a,b)=>_ix(a,b,0,R.x0)],
    [p => p[0] <= R.x1, (a,b)=>_ix(a,b,0,R.x1)],
    [p => p[1] >= R.y0, (a,b)=>_ix(a,b,1,R.y0)],
    [p => p[1] <= R.y1, (a,b)=>_ix(a,b,1,R.y1)]
  ];
  let out = pts;
  for(const [inside, isect] of edges){
    const src = out; out = [];
    const n = src.length;
    if(!n) return null;
    for(let i = 0; i < n; i++){
      const a = src[i], b = src[(i+1) % n];
      const ia = inside(a), ib = inside(b);
      if(ia) out.push(a);
      if(ia !== ib) out.push(isect(a, b));
    }
    if(!out.length) return null;
  }
  return out.length > 2 ? out : null;
}
/* bitta kesma — Liang–Barsky */
function clipSeg(a, b, R){
  let t0 = 0, t1 = 1;
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const P = [-dx, dx, -dy, dy];
  const Q = [a[0]-R.x0, R.x1-a[0], a[1]-R.y0, R.y1-a[1]];
  for(let i = 0; i < 4; i++){
    if(P[i] === 0){ if(Q[i] < 0) return null; continue; }
    const r = Q[i]/P[i];
    if(P[i] < 0){ if(r > t1) return null; if(r > t0) t0 = r; }
    else        { if(r < t0) return null; if(r < t1) t1 = r; }
  }
  return [[a[0]+dx*t0, a[1]+dy*t0], [a[0]+dx*t1, a[1]+dy*t1]];
}
function clipOpen(pts, R){
  const out = []; let cur = null;
  const same = (p,q)=> Math.abs(p[0]-q[0]) < 1e-6 && Math.abs(p[1]-q[1]) < 1e-6;
  for(let i = 1; i < pts.length; i++){
    const seg = clipSeg(pts[i-1], pts[i], R);
    if(!seg){ if(cur && cur.length > 1) out.push(cur); cur = null; continue; }
    if(cur && same(cur[cur.length-1], seg[0])) cur.push(seg[1]);
    else { if(cur && cur.length > 1) out.push(cur); cur = [seg[0], seg[1]]; }
  }
  if(cur && cur.length > 1) out.push(cur);
  return out;
}
function clipPolys(polys, R){
  const out = [];
  for(const pl of polys){
    if(!pl.pts || pl.pts.length < 2) continue;
    let inside = true;
    for(const q of pl.pts){
      if(q[0] < R.x0-1e-9 || q[0] > R.x1+1e-9 || q[1] < R.y0-1e-9 || q[1] > R.y1+1e-9){ inside = false; break; }
    }
    if(inside){ out.push(pl); continue; }
    if(pl.closed){
      const c = clipClosed(pl.pts, R);
      if(c) out.push({ pts:c, closed:true });
    } else {
      for(const seg of clipOpen(pl.pts, R)) out.push({ pts:seg, closed:false });
    }
  }
  return out;
}
/* bir xil konturlarni bittaga tushirish — kalit nuqtalar to'plamidan
   yasaladi, shuning uchun yo'nalish va boshlang'ich nuqtaga bog'liq emas */
function dedupePolys(polys){
  /* Kalit nuqtalar TO'PLAMIdan yasaladi (yig'indi va XOR — ikkalasi ham
     tartibdan mustaqil), shuning uchun yo'nalish va boshlang'ich nuqtaga
     bog'liq emas. Ilgari bu yerda har kontur uchun matn massivi qurilib
     saralanardi — zich naqshlarda eksportning asosiy sekinlik sababi
     shu edi. */
  const seen = new Set(), out = [];
  for(const pl of polys){
    let h1 = 0, h2 = 0;
    for(const q of pl.pts){
      const a = Math.round(q[0]*100) | 0, b = Math.round(q[1]*100) | 0;
      let v = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0;
      v = (v ^ (v >>> 13)) >>> 0;
      h1 = (h1 + v) >>> 0;
      h2 = (h2 ^ v) >>> 0;
    }
    const key = (pl.closed ? 'C' : 'O') + pl.pts.length + '|' + h1 + '|' + h2;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(pl);
  }
  return out;
}
/* USTMA-UST TUSHGAN KESMALARNI BIRLASHTIRISH.
   Qo'shni plitkalar umumiy qirrani ikki marta chizadi. Bir xil KONTURNI
   olib tashlash yetarli emas: ko'pincha ikki HAR XIL kontur bitta qirrani
   baham ko'radi. Lazer uchun bu chiziq ikki marta kesiladi — material
   kuyadi, ish vaqti bekorga oshadi.
   Shuning uchun geometriya kesmalarga ajratiladi, takrorlari tashlanadi,
   qolganlari esa uzluksiz zanjirlarga qayta yig'iladi (kesuvchi bosh
   kamroq sakraydi). Yaxlitlash 0.1 birlik = 100 mm detalda 0.01 mm —
   lazer aniqligidan ancha mayda. */
function mergeOverlaps(polys){
  const nk = p => Math.round(p[0]*10) + ',' + Math.round(p[1]*10);
  const seen = new Set(), segs = [];
  for(const pl of polys){
    const pts = pl.closed ? pl.pts.concat([pl.pts[0]]) : pl.pts;
    for(let i = 1; i < pts.length; i++){
      const a = pts[i-1], b = pts[i];
      const ka = nk(a), kb = nk(b);
      if(ka === kb) continue;                         /* nol uzunlikdagi kesma */
      const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if(seen.has(key)) continue;
      seen.add(key);
      segs.push([a, b]);
    }
  }
  /* zanjirlash */
  const adj = new Map();
  segs.forEach((sg, i)=>{
    for(const p of sg){
      const k = nk(p);
      if(!adj.has(k)) adj.set(k, []);
      adj.get(k).push(i);
    }
  });
  const used = new Uint8Array(segs.length);
  /* Tugundan davom ettirish uchun kesma tanlash.
     Ilgari ro'yxatdan oxirgisi olinardi. Bu o'zini kesib o'tuvchi
     naqshlarda (dragon: 122 947 ta to'rt tarmoqli kesishish) har
     kesishishda boshqa tarmoqqa burilib ketardi va uzluksiz chiziq
     minglab bo'lakka sochilardi — o'lchov: 1 764 kontur → 32 309 bo'lak.
     Lazer uchun har bo'lak — alohida bosh ko'tarish/tushirish.
     Endi kirish yo'nalishini eng yaxshi davom ettiradigan kesma
     tanlanadi, ya'ni chiziq o'z tabiiy yo'lidan yuradi. */
  const takeAt = (k, dx, dy)=>{
    const list = adj.get(k);
    if(!list) return -1;
    let w = 0;
    for(let i = 0; i < list.length; i++) if(!used[list[i]]) list[w++] = list[i];
    list.length = w;
    if(!w) return -1;
    if(w === 1 || (dx === 0 && dy === 0)) return list[0];
    const dl = Math.hypot(dx, dy) || 1;
    let best = list[0], bestC = -Infinity;
    for(let i = 0; i < w; i++){
      const j = list[i], sg = segs[j];
      const head = nk(sg[0]) === k;
      const a = head ? sg[0] : sg[1], b = head ? sg[1] : sg[0];
      const ex = b[0]-a[0], ey = b[1]-a[1];
      const el = Math.hypot(ex, ey) || 1;
      const c = (dx*ex + dy*ey)/(dl*el);
      if(c > bestC){ bestC = c; best = j; }
    }
    return best;
  };
  const out = [];
  for(let i = 0; i < segs.length; i++){
    if(used[i]) continue;
    used[i] = 1;
    const chain = [segs[i][0], segs[i][1]];
    for(;;){
      const n = chain.length, e = chain[n-1], pv = chain[n-2];
      const j = takeAt(nk(e), e[0]-pv[0], e[1]-pv[1]);
      if(j < 0) break;
      used[j] = 1;
      const k = nk(e);
      chain.push(nk(segs[j][0]) === k ? segs[j][1] : segs[j][0]);
    }
    for(;;){
      const e = chain[0], pv = chain[1];
      const j = takeAt(nk(e), e[0]-pv[0], e[1]-pv[1]);
      if(j < 0) break;
      used[j] = 1;
      const k = nk(e);
      chain.unshift(nk(segs[j][0]) === k ? segs[j][1] : segs[j][0]);
    }
    let closed = false;
    if(chain.length > 3 && nk(chain[0]) === nk(chain[chain.length-1])){ chain.pop(); closed = true; }
    if(chain.length > 1) out.push({ pts:chain, closed });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   NUQTALARNI SODDALASHTIRISH (Douglas–Peucker)
   ---------------------------------------------------------------------------
   O'lchov natijasi: 120×90 mm taxtada spirograph naqshi 1 727 016 vertex
   berardi — DXF fayli 89 MB. Lazer apparatlarining import moduli bunday
   faylni ochmaydi yoki soatlab o'ylaydi; ochsa ham kesuvchi bosh har
   mikron uchun to'xtab-to'xtab yuradi. Sabab — egri chiziqlar qat'iy
   qadam bilan tekislanadi, natijada deyarli bir to'g'ri chiziqda yotgan
   o'nlab keraksiz nuqta qoladi.
   Douglas–Peucker aynan shu keraksiz nuqtalarni olib tashlaydi: kontur
   shakli berilgan chegaradan (mm) ko'p og'masa, oraliq nuqta tushiriladi.
   Boshlang'ich chegara 0.02 mm — lazerning o'z pozitsiya xatosidan
   (~0.05 mm) va kerf kengligidan (~0.1–0.2 mm) mayda, ya'ni ko'zga ham,
   materialga ham bilinmaydi.
   Rekursiya emas, o'z stegi ishlatiladi: 1.2 mln nuqtali konturda
   rekursiya chaqiruvlar stegini to'ldirib yuboradi. */
function dpSimplify(pts, eps){
  const n = pts.length;
  if(n < 3 || !(eps > 0)) return pts;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n-1] = 1;
  const e2 = eps*eps;
  const stack = [0, n-1];
  while(stack.length){
    const i1 = stack.pop(), i0 = stack.pop();
    if(i1 <= i0 + 1) continue;
    const ax = pts[i0][0], ay = pts[i0][1];
    const dx = pts[i1][0] - ax, dy = pts[i1][1] - ay;
    const dd = dx*dx + dy*dy;
    let best = -1, bd = e2;
    for(let i = i0 + 1; i < i1; i++){
      const px = pts[i][0] - ax, py = pts[i][1] - ay;
      let d;
      if(dd > 0){
        let t = (px*dx + py*dy)/dd;
        if(t < 0) t = 0; else if(t > 1) t = 1;
        const ex = px - dx*t, ey = py - dy*t;
        d = ex*ex + ey*ey;
      } else d = px*px + py*py;
      if(d > bd){ bd = d; best = i; }
    }
    if(best < 0) continue;
    keep[best] = 1;
    stack.push(i0, best, best, i1);
  }
  const out = [];
  for(let i = 0; i < n; i++) if(keep[i]) out.push(pts[i]);
  return out;
}
function simplifyPolys(polys, eps){
  const out = [];
  for(const pl of polys){
    if(pl.pts.length < 3){ out.push(pl); continue; }
    if(pl.closed){
      /* yopiq konturda oxirgi (yopuvchi) kesma ham soddalashtirilishi
         uchun birinchi nuqta vaqtincha oxiriga qo'shiladi */
      const s = dpSimplify(pl.pts.concat([pl.pts[0]]), eps);
      s.pop();
      out.push(s.length > 2 ? { pts:s, closed:true } : pl);
    } else {
      out.push({ pts: dpSimplify(pl.pts, eps), closed:false });
    }
  }
  return out;
}
function countVerts(polys){
  let n = 0;
  for(const pl of polys) n += pl.pts.length;
  return n;
}
/* ENG QISQA KESMA CHEGARASI.
   Douglas–Peucker faqat "deyarli to'g'ri" joylarni siqadi. Fraktal
   naqshlarda (dragon, koch) esa nuqtalar haqiqatan ham burchak yasaydi,
   lekin ular orasidagi masofa 0.01–0.05 mm — lazer kerfi (0.1–0.2 mm)
   dan mayda, ya'ni apparat baribir chiza olmaydi: o'lchov natijasida
   dragon 32 310 kontur va 22 MB fayl berardi.
   Shuning uchun oldingi saqlangan nuqtadan minSeg dan yaqin nuqtalar
   tushiriladi. Konturning oxirgi nuqtasi doim saqlanadi — shakl uzunligi
   qisqarmasligi uchun. */
function decimatePts(pts, minSeg){
  if(!(minSeg > 0) || pts.length < 3) return pts;
  const m2 = minSeg*minSeg;
  const out = [pts[0]];
  let lx = pts[0][0], ly = pts[0][1];
  for(let i = 1; i < pts.length - 1; i++){
    const dx = pts[i][0]-lx, dy = pts[i][1]-ly;
    if(dx*dx + dy*dy >= m2){ out.push(pts[i]); lx = pts[i][0]; ly = pts[i][1]; }
  }
  out.push(pts[pts.length-1]);
  return out;
}
/* Lazer fayli uchun cheklovlar.
   Zinapoya: avval eng mayda (ko'zga ko'rinmas) chegara sinaladi; fayl
   apparat uchun og'ir bo'lsa, keyingi zinaga o'tiladi. Eng qo'pol zinada
   ham og'ish 0.25 mm — 120 mm detalda 0.2%, kerf kengligidan kichik. */
const LASER_LADDER = [
  { eps:0.02, seg:0    },
  { eps:0.04, seg:0.05 },
  { eps:0.07, seg:0.08 },
  { eps:0.10, seg:0.12 },
  { eps:0.15, seg:0.20 },
  { eps:0.25, seg:0.30 }
];
/* Vertex byudjeti. 190 000 ≈ 11 MB DXF — eski import modullari ham
   bemalol ochadi (muammo 89 MB da boshlangan edi). Undan pastga
   tushirilsa koch kabi fraktal naqshlarda mayda tishlar yo'qoladi
   (o'lchov: byudjet 150 000 da koch kesish uzunligining 11.6% ini
   yo'qotardi), shuning uchun byudjet aynan shu chegarada. */
const LASER_VERT_MAX = 190000;
let LASER_INFO = null;         /* oxirgi eksport statistikasi (konsol uchun) */

/* Lazer eksporti uchun yakuniy geometriya:
   tekislash → taxtaga qirqish → bir xil konturlarni tashlash →
   ustma-ust kesmalarni birlashtirish → mayda parchalarni olib tashlash.
   Oxirgi bosqich: qirqishdan qolgan 0.3 mm dan qisqa parchalar lazerda
   kesma emas, KUYGAN NUQTA beradi (kerf o'zi ~0.1–0.2 mm). */
function laserPolys(wMm, hMm, fill){
  const B = boardFor(wMm, hMm);
  const board = { x0:0, y0:0, x1:B.bw, y1:B.bh };
  const polys = [];
  for(const pth of recordPattern(B.bw, B.bh, fill)){
    for(const pl of flattenCmds(pth.cmds)) if(pl.pts.length > 1) polys.push(pl);
  }
  const minU = 0.3/B.k;                         /* 0.3 mm — birlikda */
  const longEnough = pl=>{
    let L = 0;
    for(let i = 1; i < pl.pts.length; i++)
      L += Math.hypot(pl.pts[i][0]-pl.pts[i-1][0], pl.pts[i][1]-pl.pts[i-1][1]);
    if(pl.closed && pl.pts.length > 1)
      L += Math.hypot(pl.pts[0][0]-pl.pts[pl.pts.length-1][0], pl.pts[0][1]-pl.pts[pl.pts.length-1][1]);
    return L >= minU;
  };
  /* 1-BOSQICH — to'liq aniqlikdagi geometriyada ustma-ustlikni tozalash.
     Bu aynan shu yerda bo'lishi shart: qo'shni plitkalarning umumiy
     qirralari BIR XIL nuqtalar bilan chizilgan, shuning uchun ular
     ishonchli aniqlanadi. Agar avval soddalashtirilsa, ikki nusxada
     turli nuqtalar saqlanib qolib, qirra takrorlanadi (o'lchov: girih
     yo'li 50 509 → 85 760 birlikka, ya'ni 70% ortiqcha kesishga
     ko'tarilgan edi). */
  const merged = mergeOverlaps(dedupePolys(clipPolys(polys, board)));
  /* 2-BOSQICH — keraksiz nuqtalarni tashlash, so'ng USTMA-USTLIKNI
     QAYTA TOZALASH. Soddalashtirish A→B→C ni A→C ga aylantiradi va
     boshqa zanjirda ham xuddi shunday A→C paydo bo'lishi mumkin —
     ya'ni soddalashtirishning O'ZI yangi takror kesma yaratadi
     (o'lchov: girih 4%, panelgirih 8.4%). Ikkinchi birlashtirish
     ularni yo'q qiladi. */
  let res = null, step = LASER_LADDER[0];
  for(let i = 0; i < LASER_LADDER.length; i++){
    step = LASER_LADDER[i];
    const segU = step.seg/B.k, epsU = step.eps/B.k;
    const dec = step.seg > 0
      ? merged.map(pl=>({ pts: decimatePts(pl.pts, segU), closed: pl.closed }))
              .filter(pl=> pl.closed ? pl.pts.length > 2 : pl.pts.length > 1)
      : merged;
    res = mergeOverlaps(simplifyPolys(dec, epsU)).filter(longEnough);
    if(countVerts(res) <= LASER_VERT_MAX) break;
  }
  LASER_INFO = { polys: res.length,
                 verts: countVerts(res),
                 vertsRaw: countVerts(merged),
                 epsMm: step.eps, segMm: step.seg };
  return res;
}

/* DXF AC1015 (AutoCAD 2000), $INSUNITS=4 (mm). sizeMm — chetma-chet o'lcham.
   Konturlar yopiq LWPOLYLINE sifatida chiqadi (lazer uchun shart). */
/* ---------------------------------------------------------------------------
   DXF — R12 (AC1009)
   ---------------------------------------------------------------------------
   Ilgari AC1015 (AutoCAD 2000) va LWPOLYLINE ishlatilardi. Lazer
   apparatlarining import moduli ko'pincha ANCHA ESKI bo'ladi va faqat R12 ni
   to'liq o'qiydi: LWPOLYLINE R14 dan boshlab paydo bo'lgan, handle (5) va
   AcDbEntity sinf belgilari esa R13+ ga tegishli — eski o'qigich ularda
   to'xtaydi yoki bo'sh chizma ochadi.
   R12 — eng past umumiy maxraj: uni R12 dan keyingi HAMMA dastur o'qiydi.
   Shuning uchun bu yerda POLYLINE/VERTEX/SEQEND ishlatiladi, handle va
   sinf belgilari yo'q.
   --------------------------------------------------------------------------- */
function buildDXF(wMm, hMm, fill){
  const B = boardFor(wMm, hMm);
  const polys = laserPolys(wMm, hMm, fill);
  const L = [];
  const push = (...a)=>{ for(const x of a) L.push(x); };
  const MM = B.k;                                   /* ichki birlik → mm */
  const BH = B.bh;
  const W = B.bw*MM, H = BH*MM;

  /* HEADER — o'lchov birligi metrik ekani ikki xil kalit bilan aytiladi:
     $INSUNITS (R13+) va $MEASUREMENT (R12 o'qigichlari shuni qaraydi) */
  push('0','SECTION','2','HEADER',
       '9','$ACADVER','1','AC1009',
       '9','$INSUNITS','70','4',
       '9','$MEASUREMENT','70','1',
       '9','$EXTMIN','10','0.0','20','0.0','30','0.0',
       '9','$EXTMAX','10',num(W),'20',num(H),'30','0.0',
       '0','ENDSEC');

  /* TABLES — R12 shaklida: handle yo'q, sinf belgisi yo'q */
  push('0','SECTION','2','TABLES');
  push('0','TABLE','2','LTYPE','70','1',
       '0','LTYPE','2','CONTINUOUS','70','0','3','Solid line','72','65','73','0','40','0.0',
       '0','ENDTAB');
  push('0','TABLE','2','LAYER','70','2',
       '0','LAYER','2','Naqsh','70','0','62','1','6','CONTINUOUS',
       '0','LAYER','2','Chegara','70','0','62','7','6','CONTINUOUS',
       '0','ENDTAB');
  push('0','ENDSEC');
  push('0','SECTION','2','BLOCKS','0','ENDSEC');

  /* ENTITIES */
  push('0','SECTION','2','ENTITIES');
  const emitPoly = (pts, closed, layer)=>{
    push('0','POLYLINE','8',layer,'66','1','70', closed ? '1' : '0',
         '10','0.0','20','0.0','30','0.0');
    for(const q of pts){
      /* DXF y o'qi yuqoriga qaragan — shuning uchun ag'dariladi */
      push('0','VERTEX','8',layer,
           '10', num(q[0]*MM), '20', num((BH-q[1])*MM), '30','0.0');
    }
    push('0','SEQEND','8',layer);
  };
  emitPoly([[0,0],[B.bw,0],[B.bw,BH],[0,BH]], true, 'Chegara');
  for(const pl of polys){
    if(pl.pts.length > 1) emitPoly(pl.pts, pl.closed, 'Naqsh');
  }
  push('0','ENDSEC','0','EOF');
  return L.join('\r\n') + '\r\n';   /* R12 o'qigichlari CRLF ni kutadi */
}

/* ---------------------------------------------------------------------------
   EPS — Encapsulated PostScript
   ---------------------------------------------------------------------------
   Lazer apparatlarining import ro'yxatida EPS odatda BIRINCHI turadi va eng
   ishonchli format: u oddiy MATN, ichida faqat to'g'ri chiziqlar va
   moveto/lineto buyruqlari bo'ladi.
   Birlik — PostScript punkti (1 pt = 1/72 dyuym = 0.352778 mm), shuning
   uchun mm → pt: ×72/25.4. BoundingBox aynan detal o'lchamiga teng.
   --------------------------------------------------------------------------- */
function buildEPS(wMm, hMm, opts){
  opts = opts || {};
  const B = boardFor(wMm, hMm);
  const polys = laserPolys(wMm, hMm, opts.fill);
  const K = B.k*72/25.4;                 /* ichki birlik → punkt */
  const BH = B.bh;
  const Wp = B.bw*K, Hp = BH*K;
  const kerf = (opts.kerf || 0.1)*72/25.4;
  const n2 = v => (Math.round(v*100)/100).toString();
  const out = [];
  out.push('%!PS-Adobe-3.0 EPSF-3.0');
  out.push('%%Creator: NaqshAI');
  out.push('%%Title: naqsh ' + wMm + 'x' + hMm + ' mm');
  out.push('%%BoundingBox: 0 0 ' + Math.ceil(Wp) + ' ' + Math.ceil(Hp));
  out.push('%%HiResBoundingBox: 0 0 ' + n2(Wp) + ' ' + n2(Hp));
  out.push('%%DocumentData: Clean7Bit');
  out.push('%%LanguageLevel: 2');
  out.push('%%EndComments');
  out.push('%%BeginProlog');
  out.push('/m {moveto} bind def /l {lineto} bind def');
  out.push('/h {closepath} bind def /S {stroke} bind def');
  out.push('%%EndProlog');
  out.push('%%Page: 1 1');
  out.push('gsave');
  out.push('1 0 0 setrgbcolor');          /* qizil = kesish konturi */
  out.push(n2(kerf) + ' setlinewidth');
  out.push('1 setlinecap 1 setlinejoin');
  const emit = (pts, closed)=>{
    if(pts.length < 2) return;
    let line = 'newpath ' + n2(pts[0][0]*K) + ' ' + n2((BH - pts[0][1])*K) + ' m';
    for(let i = 1; i < pts.length; i++)
      line += ' ' + n2(pts[i][0]*K) + ' ' + n2((BH - pts[i][1])*K) + ' l';
    if(closed) line += ' h';
    out.push(line + ' S');
  };
  if(opts.frame) emit([[0,0],[B.bw,0],[B.bw,BH],[0,BH]], true);
  for(const pl of polys) emit(pl.pts, pl.closed);
  out.push('grestore');
  out.push('%%Trailer');
  out.push('%%EOF');
  return out.join('\n') + '\n';
}
/* Yuklab olish helper */
function _dataURLtoBlob(dataURL){
  const comma = dataURL.indexOf(',');
  const meta = dataURL.slice(0, comma), b64 = dataURL.slice(comma+1);
  const mime = (meta.match(/data:([^;]+)/)||[])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], {type:mime});
}
/* claude.ai artifact preview'da <a download> ishlamaydi — mavjud bo'lsa
   "downloads" capability orqali, aks holda (haqiqiy joylashtirishda)
   odatiy brauzer usuli bilan saqlaydi. */
async function _dlBlob(content, mime, filename, successMsg){
  const blob = (content instanceof Blob) ? content : new Blob([content], {type:mime});
  if(window.claude && typeof window.claude.use === 'function'){
    let downloads = null;
    try{ downloads = await window.claude.use('downloads'); }catch(e){}
    if(downloads){
      try{
        await downloads.save({filename, data: blob});
        if(successMsg) ntf(successMsg, 'ok');
        return true;
      }catch(err){
        const code = err && err.code;
        if(code === 'declined') return false;
        if(code === 'rejected_extension' || code === 'extension_not_enabled'){
          /* Claude'ning ko'rish oynasi faqat cheklangan ro'yxatdagi
             kengaytmalarni saqlashga ruxsat beradi (png, jpg, txt, json,
             md, svg, pdf...). Sanoat formatlari — TIFF, BMP, WIF, DXF —
             bu ro'yxatda YO'Q. Bu ilovaning kamchiligi emas, ko'rish
             oynasining cheklovi: haqiqiy saytda hammasi normal yuklanadi.
             DXF va WIF — MATN fayllar, shuning uchun ularni .txt sifatida
             saqlab berish mumkin: foydalanuvchi nomini o'zgartirsa bo'ldi. */
          const ext = (filename.split('.').pop() || '').toLowerCase();
          if(ext === 'dxf' || ext === 'wif' || ext === 'eps'){
            try{
              await downloads.save({ filename: filename + '.txt', data: blob });
              ntf('Ko\'rish oynasi .' + ext + ' ni saqlay olmaydi — fayl «' +
                  filename + '.txt» nomi bilan saqlandi. Nomidagi oxirgi ' +
                  '«.txt» ni o\'chiring, ichidagisi to\'liq to\'g\'ri.', 'ok');
              return true;
            }catch(e2){ if(e2 && e2.code === 'declined') return false; }
          }
          ntf('Bu formatni Claude ko\'rish oynasida saqlab bo\'lmaydi (faqat ' +
              'png/jpg/txt/pdf kabi turlar mumkin). Sanoat fayllari uchun ' +
              'ilovani o\'z saytingizdan oching — u yerda TIFF, BMP, WIF va ' +
              'DXF normal yuklanadi.', 'err');
          return false;
        }
        if(code === 'too_large'){
          ntf('Fayl juda katta (16 MB dan ortiq) — kichikroq rapport yoki ' +
              'past chuqurlik tanlang', 'err');
          return false;
        }
        ntf('Yuklab olishda xato: ' + (err && err.message || code || "noma'lum"), 'err');
        return false;
      }
    }
  }
  try{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      if(a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    if(successMsg) ntf(successMsg, 'ok');
    return true;
  }catch(e){
    ntf('Yuklab olishda xato: ' + e.message, 'err');
    return false;
  }
}
/* PNG ga FIZIK O'LCHAM (pHYs) bo'lagini yozish.
   Canvas.toBlob() PNG ga zichlik ma'lumotini qo'shmaydi. Shu sababli
   fayl nomida "300dpi" yozilgan bo'lsa ham, CorelDraw / Illustrator /
   bosmaxona dasturlari uni 96 dpi deb oladi va 2048 px rasm 17.3 sm
   o'rniga 54 sm bo'lib joylashadi — ya'ni o'lcham 3 barobar xato.
   Quyida IHDR dan keyin standart pHYs bo'lagi qo'shiladi. */
let _crcTab = null;
function crc32(buf){
  if(!_crcTab){
    _crcTab = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTab[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for(let i = 0; i < buf.length; i++) c = _crcTab[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngSetDPI(bytes, dpi){
  const sig = [137,80,78,71,13,10,26,10];
  for(let i = 0; i < 8; i++) if(bytes[i] !== sig[i]) return bytes;
  const dvIn = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  /* allaqachon pHYs bo'lsa — tegmaymiz */
  let off = 8;
  while(off + 8 <= bytes.length){
    const len = dvIn.getUint32(off);
    const type = String.fromCharCode(bytes[off+4], bytes[off+5], bytes[off+6], bytes[off+7]);
    if(type === 'pHYs') return bytes;
    if(type === 'IDAT' || type === 'IEND') break;
    off += 12 + len;
  }
  const ihdrEnd = 8 + 12 + dvIn.getUint32(8);      /* imzo + IHDR */
  const ppu = Math.round((dpi || 300)/0.0254);     /* piksel/metr */
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70,0x48,0x59,0x73], 4);             /* 'pHYs' */
  dv.setUint32(8, ppu); dv.setUint32(12, ppu);
  chunk[16] = 1;                                    /* birlik = metr */
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(bytes.length + 21);
  out.set(bytes.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(bytes.subarray(ihdrEnd), ihdrEnd + 21);
  return out;
}
function exportPNG(w, h, dpi, transparent, cb, fill){
  w = Math.max(16, w|0); h = Math.max(16, h|0) || w;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  if(!octx){ ntf('Canvas yaratib bo\'lmadi', 'err'); return; }
  const pal = PAL[P.pal] || PAL.gold;
  P._bg = pal.bg;
  if(!transparent){
    octx.fillStyle = pal.bg;
    octx.fillRect(0, 0, w, h);
  }
  /* 'tile' — butun yuzani to'ldiradi (to'rtburchakda ham to'g'ri ishlaydi),
     'medal' — markazda doira medalyon. Ilgari bu tanlov yo'q edi va
     tessellatsiya o'chirilgan bo'lsa har doim doira chiqardi. */
  const doTile = (fill === 'medal') ? false : (fill === 'tile' ? true : TESS.on);
  if(doTile){
    const saveTess = TESS.on; TESS.on = true;
    drawTessellation(octx, w, h, P);
    TESS.on = saveTess;
  } else {
    drawPattern(octx, w/2, h/2, Math.min(w, h)*0.46, P);
  }
  if(off.toBlob){
    off.toBlob(async b=>{
      if(!b){ if(cb) cb(); return; }
      let blob = b;
      try{
        const withDpi = pngSetDPI(new Uint8Array(await b.arrayBuffer()), dpi);
        blob = new Blob([withDpi], {type:'image/png'});
      }catch(e){ console.warn('[png] pHYs qo\'shilmadi', e); }
      _dlBlob(blob, 'image/png', 'naqsh_'+P.type+'_'+w+'x'+h+'px_'+dpi+'dpi.png',
              'PNG yuklab olindi 📥 — ' + w + '×' + h + ' px, ' + dpi + ' dpi, ' +
              (w/dpi*25.4).toFixed(0) + '×' + (h/dpi*25.4).toFixed(0) + ' mm');
      if(cb) cb();
    }, 'image/png');
  } else {
    const dataURL = off.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL; a.download = 'naqsh_'+P.type+'.png';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ if(a.parentNode) a.parentNode.removeChild(a); }, 500);
    if(cb) cb();
  }
}

/* ---------- Eksport modal ---------- */
/* ============================================================================
   SANOAT EKSPORTI — Jakkard to'quv dastgohlari va lazer kesish apparatlari
   ----------------------------------------------------------------------------
   Jakkard uchun eng muhim shart: naqsh RAPPORT (repeat) bo'lishi, ya'ni
   chetlari bir-biriga aynan tutashishi kerak. Aks holda mato bo'ylab har
   takrorlanishda UZILISH chizig'i paydo bo'ladi.

   Bu yerdagi yechim uzilishni "yashirmaydi" — matematik jihatdan yo'q qiladi:
   kanvas o'lchami panjaraning ANIQ DAVRIGA (period) teng qilib olinadi va
   naqsh barcha qo'shni panjara tugunlarida chiziladi. Natijada tasvir
   ta'rifi bo'yicha davriy bo'ladi — chetlari kafolatlangan holda tutashadi.

   Simmetriya: p4 / p4m / p6 / p6m (Fyodorov devor guruhlari).
     p4, p4m  → to'g'ri burchakli rapport  c × c
     p6, p6m  → to'g'ri burchakli rapport  c × c√3
   ============================================================================ */

/* Panjara davriga teng, chok-suz rapport kanvasi.
   Qaytadi: {canvas, w, h} — canvas o'zi bitta to'liq rapport. */
/* Rapport asosining o'lchami.
   c JUFT olinadi, geksagonalda H0 — c·√3 ga eng yaqin JUFT son.
   Sababi o'lchangan: H0 toq bo'lsa panjaraning yarim qadami (c/2, H0/2)
   yarim pikselga tushadi va geksagonal yarim-davr simmetriyasi buziladi —
   c=192 (H0=333) da mos kelmaslik 4.3–6.5% edi, H0 juft bo'lgan
   c=128 (222) va c=768 (1330) da esa 0.0–0.2%. Eng yaqin juft songa
   yaxlitlash tomonlar nisbatini atigi ≤0.2% o'zgartiradi, lekin har bir
   ilmoq butun pikselga tushadi — Jakkardda aynan shu muhim. */
function rapportBase(px, hex){
  let c = Math.max(16, px|0);
  if(c & 1) c++;
  let H0 = c;
  if(hex){
    H0 = 2*Math.round(c*Math.sqrt(3)/2);
    if(H0 < 16) H0 = 16;
  }
  return { c, H0 };
}

/* HAQIQIY KO'ZGULI RAPPORT (p4m / p6m).
   Ilgari ko'zgu panjaraning navbatdagi tugunlariga qo'llanardi — natijada
   rapportda aniq ko'zgu o'qi HOSIL BO'LMASDI (o'lchovda eng mos o'q ham
   o'rtacha 12% farq berardi, ya'ni "ko'zguli" yorlig'i haqiqatga mos
   emasdi). To'g'ri usul — asos plitkani o'z chetlariga nisbatan aks
   ettirish:
        R = [ T    Tx  ]        Tx — x bo'yicha akslangan T
            [ Ty   Txy ]        Ty — y bo'yicha akslangan T
   Bunda R ning oxirgi ustuni aynan birinchi ustuniga teng
   (R[2W-1] = T[0] = R[0]), demak chok MATEMATIK jihatdan nol, ko'zgu
   o'qlari esa aniq. To'quvda bu "ko'zguli rapport" deb ataladi va
   uzilishni butunlay yo'q qiladi. */
function mirrorTile(t){
  const W = t.w, H = t.h;
  const cv = document.createElement('canvas');
  cv.width = W*2; cv.height = H*2;
  const c2 = cv.getContext('2d');
  if(!c2) return t;
  c2.imageSmoothingEnabled = false;
  const quad = (a, d, e, f)=>{            /* setTransform(a,0,0,d,e,f) */
    c2.setTransform(a, 0, 0, d, e, f);
    c2.drawImage(t.canvas, 0, 0);
  };
  quad( 1,  1, 0,    0);                  /* T   */
  quad(-1,  1, W*2,  0);                  /* Tx  */
  quad( 1, -1, 0,    H*2);                /* Ty  */
  quad(-1, -1, W*2,  H*2);                /* Txy */
  c2.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: cv, w: W*2, h: H*2 };
}

/* Rapport o'lchamini CHIZMASDAN oldindan hisoblash — interfeys paneli
   foydalanuvchiga aynan fayldagi raqamni ko'rsatishi uchun.
   (Ilgari panel har doim nazariy c×c ni ko'rsatardi, girih oilasida esa
   fayl butunlay boshqa o'lchamda chiqardi — masalan panel "192×333"
   deganda fayl 219×253 bo'lardi. Dastgoh sozlashda bu jiddiy xato.) */
function rapportSize(px, group){
  const g = GRIDS[group] || GRIDS.p4;
  const { c, H0 } = rapportBase(px, g.hex);
  let W = c, H = H0;
  if(typeof PIC_PATTERN !== 'undefined' && PIC_PATTERN[P.type] && !picIsRadial(picTileOf(P.type))){
    try{
      const t0 = picSeamlessTile({ ...P, tile: picTileOf(P.type) }, Math.max(24, Math.round(c/3)), 1);
      if(t0 && t0.w > 2 && t0.h > 2){
        W = Math.round(t0.w*Math.max(1, Math.round(W/t0.w)));
        H = Math.round(t0.h*Math.max(1, Math.round(H/t0.h)));
      }
    }catch(e){ console.warn('[rapport] o\'lcham bashorati', e); }
  }
  if(g.mirror){ W *= 2; H *= 2; }
  return { w:W, h:H };
}

function makeSeamlessRepeatCore(px, group, opts){
  opts = opts || {};
  const g = GRIDS[group] || GRIDS.p4;
  const hex = !!g.hex;
  /* Ko'zgu bu yerda QO'LLANMAYDI: asos plitka har doim sof siljish
     panjarasida chiziladi, ko'zguli rapportni makeSeamlessRepeat()
     mirrorTile() orqali yasaydi — shunda ko'zgu o'qi aniq chiqadi. */
  const base = rapportBase(px, hex);
  const c = base.c;

  /* ---- RAPPORT O'LCHAMI ----------------------------------------------
     Sof siljish (p4/p6): rapport = panjaraning bitta davri.
       p4 → c × c        p6 → c × round(c·√3)
     Ko'zguli guruhlar (p4m/p6m) shu asos plitkani aks ettirish yo'li bilan
     ikki barobar katta rapport beradi — mirrorTile() ga qarang. */
  const H0 = base.H0;
  const W = c, H = H0;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if(!ctx) return null;

  /* Naqsh O'Z rangida chiziladi; 1-bitga aylantirish keyin yorqinlik
     bo'yicha (Otsu) bajariladi. Ilgari bu yerda barcha palitra uyalari
     qora qilingandi — natijada to'ldirishga asoslangan naqshlar
     (Voronoi, Zellige…) butunlay qora blokka aylanib qolardi. */
  const savePalObj = PAL[P.pal] || PAL.gold;
  const pal = PAL[P.pal] || PAL.gold;
  P._bg = pal.bg;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  /* ---- PANJARA VEKTORLARI --------------------------------------------
     Geksagonalda vertikal qadam BUTUN H0/2 dan olinadi (c·√3/2 emas):
     c·√3 kasr son, uni piksel to'riga yaxlitlash davriylikni buzadi va
     chetda ~0.4 piksellik siljish — ko'zga tashlanadigan chiziq beradi.
     H0 dan kelib chiqilsa 2·v2 − v1 = (0, H0) aynan butun bo'ladi. */
  const v1 = [c, 0];
  const v2 = hex ? [c/2, H0/2] : [0, c];

  /* ---- PIC / MAYDON NAQSHLARI ------------------------------------------
     Girih oilasi va boshqa "maydon" turlari har nusxada O'Z ORQA FONINI
     (to'la doira) chizadi. Panjarada nusxalar ustma-ust tushgani uchun
     keyingi doira oldingisining lentalarini O'CHIRIB yuboradi — natijada
     bir tekis rangli blok chiqadi. Shuning uchun ular medalyon nusxalari
     sifatida emas, UZLUKSIZ MAYDON sifatida chiziladi. */
  if(typeof PIC_PATTERN !== 'undefined' && PIC_PATTERN[P.type] && !picIsRadial(picTileOf(P.type))){
    const pp = { ...P, tile: picTileOf(P.type) };
    /* bir davrli aniq plitka — matematik jihatdan chok-suz */
    const unit0 = Math.max(24, Math.round(c/3));
    const t0 = picSeamlessTile(pp, unit0, 1);
    if(t0 && t0.w > 2 && t0.h > 2){
      /* rapportni davrning BUTUN karralisiga yaxlitlaymiz — shundagina
         takrorlash chetlarida siljish bo'lmaydi */
      const nx = Math.max(1, Math.round(W / t0.w));
      const ny = Math.max(1, Math.round(H / t0.h));
      const W2 = Math.round(t0.w*nx), H2 = Math.round(t0.h*ny);
      cv.width = W2; cv.height = H2;
      const c2 = cv.getContext('2d');
      c2.fillStyle = pal.bg; c2.fillRect(0, 0, W2, H2);
      const pat = c2.createPattern(t0.canvas, 'repeat');
      if(pat){ c2.fillStyle = pat; c2.fillRect(0, 0, W2, H2); }
      PAL[P.pal] = savePalObj;
      return { canvas: cv, w: W2, h: H2 };
    }
  }
  /* Maydon turlari uchun uzluksiz-maydon rejimi — LEKIN u har doim ham
     yaxshi natija bermaydi (ba'zilari panjara nusxalari bilan chiroyliroq
     chiqadi). Shuning uchun bu yerda majburlamaymiz: pastdagi
     makeSeamlessRepeat() o'rovchisi ikkala usulni sinab, o'lchab,
     yaxshirog'ini tanlaydi (opts.field bayrog'i orqali). */
  if(opts.field && typeof FIELD_TESS !== 'undefined' && FIELD_TESS[P.type]){
    const nCell = Math.max(1, Math.round(c/128));
    const cellpx = W/nCell;
    const fp = { ...P, _field:true, _cellpx:cellpx, lay:1 };
    ctx.save();
    ctx.translate(W/2, H/2);
    drawPattern(ctx, 0, 0, Math.hypot(W,H)/2*1.02, { ...fp, rot:0 });
    ctx.restore();
    PAL[P.pal] = savePalObj;
    return { canvas: cv, w: W, h: H };
  }

  const Rt = c*(hex ? 0.64 : 0.76);
  const tp = { ...P, lay: Math.min(2, P.lay) };
  if(typeof HEAVY_TESS !== 'undefined' && HEAVY_TESS[P.type]) tp.cmp = Math.min(3, tp.cmp);
  /* Siyrak naqshlar zichroq joylashtiriladi. Qadam 1/BUTUN bo'lishi shart —
     aks holda quyi panjara rapport davriga mos tushmaydi. 1/3 da rapport
     ichiga aynan 3 (ko'zguli holatda 6) qadam sig'adi. */
  const K = (typeof SPARSE_TESS !== 'undefined' && SPARSE_TESS[P.type]) ? 3 : 1;
  const w1 = [v1[0]/K, v1[1]/K], w2 = [v2[0]/K, v2[1]/K];

  const saveNoring = (typeof NORING !== 'undefined') ? NORING : 0;
  NORING = Rt*0.84;

  /* Kanvasni (+ chekka zaxira) qoplaydigan barcha tugunlarni chizamiz.
     Kanvas o'lchami panjara davriga teng bo'lgani uchun natija ta'rifi
     bo'yicha davriy — chetlari kafolatlangan holda tutashadi. */
  const marg = Rt*1.7;
  const span = Math.ceil((Math.max(W, H) + marg*2) / (c/K)) + 3;
  for(let n = -span; n <= span; n++){
    for(let m = -span; m <= span; m++){
      const tx = n*w1[0] + m*w2[0];
      const ty = n*w1[1] + m*w2[1];
      if(tx < -marg || tx > W + marg) continue;
      if(ty < -marg || ty > H + marg) continue;
      ctx.save();
      ctx.translate(tx, ty);
      drawPattern(ctx, 0, 0, Rt, tp);
      ctx.restore();
    }
  }
  NORING = saveNoring;
  PAL[P.pal] = savePalObj;
  return { canvas: cv, w: W, h: H };
}

/* Rapport generatori — o'rovchi.
   Ba'zi naqshlar panjara nusxalari bilan, ba'zilari uzluksiz maydon bilan
   yaxshiroq chiqadi. Taxmin qilish o'rniga ikkalasini ham chizib, natijani
   O'LCHAYMIZ: chok-suzlik va 1-bitdagi to'ldirish darajasi bo'yicha
   yaroqlisini tanlaymiz. Shu bois yangi naqsh turi qo'shilganda ham
   eksport o'z-o'zidan to'g'ri ishlaydi. */
function makeSeamlessRepeat(px, group, opts){
  opts = opts || {};
  const cands = [];
  const tryOne = (o)=>{
    try{
      const t = makeSeamlessRepeatCore(px, group, o);
      if(!t) return;
      const v = verifySeamless(t.canvas);
      const b = canvasToBilevel(t.canvas, null, false);
      let ink = 0;
      for(let i = 0; i < b.grid.length; i++) ink += b.grid[i];
      const pct = 100*ink/b.grid.length;
      /* deyarli bo'sh yoki deyarli to'la = yaroqsiz (naqsh ko'rinmaydi) */
      const degenerate = (pct < 1 || pct > 99);
      cands.push({ t, ok:v.ok, degenerate, pct, score:(v.ok?0:2) + (degenerate?4:0) });
    }catch(e){ console.error('[rapport]', e); }
  };
  tryOne({ ...opts, field:false });
  if(typeof FIELD_TESS !== 'undefined' && FIELD_TESS[P.type]) tryOne({ ...opts, field:true });
  if(!cands.length) return null;
  cands.sort((a,b)=> a.score - b.score);
  const g = GRIDS[group] || GRIDS.p4;
  /* ko'zguli guruhlarda asos plitka aks ettiriladi — chok aynan nol */
  return g.mirror ? mirrorTile(cands[0].t) : cands[0].t;
}

/* Rapportning haqiqatan chok-suz ekanini TEKSHIRISH.
   Chap/o'ng va yuqori/pastki chetlarni bir piksel siljitib solishtiradi:
   davriy tasvirda ular aynan mos tushishi shart. */
function verifySeamless(cv){
  const ctx = cv.getContext('2d');
  if(!ctx) return { ok:false, reason:'context yo\'q' };
  const W = cv.width, H = cv.height;
  const D = ctx.getImageData(0, 0, W, H).data;
  const px = (x,y)=> ((y*W + x) << 2);
  const dPix = (i,j)=> Math.abs(D[i]-D[j]) + Math.abs(D[i+1]-D[j+1]) + Math.abs(D[i+2]-D[j+2]);

  /* Davriy tasvirda x=W ustuni x=0 ga teng. Demak tiling'da x=W-1 va x=0
     QO'SHNI piksellar bo'ladi — ular orasidagi farq tasvirning odatdagi
     qo'shni piksellar farqidan oshmasligi kerak.
     Etalon sifatida BUTUN tasvir bo'yicha o'rtacha qo'shni farq olinadi
     (bitta ustun juftligi tasodifan tekis joyga tushib, noto'g'ri
     "uzilish" xulosasini berishi mumkin). */
  let sumX = 0, sumY = 0, nX = 0, nY = 0;
  for(let y = 0; y < H; y++){
    for(let x = 0; x + 1 < W; x++){ sumX += dPix(px(x,y), px(x+1,y)); nX++; }
  }
  for(let y = 0; y + 1 < H; y++){
    for(let x = 0; x < W; x++){ sumY += dPix(px(x,y), px(x,y+1)); nY++; }
  }
  const baseX = sumX/Math.max(1,nX)/3, baseY = sumY/Math.max(1,nY)/3;

  let eX = 0, eY = 0;
  for(let y = 0; y < H; y++) eX += dPix(px(W-1,y), px(0,y));
  for(let x = 0; x < W; x++) eY += dPix(px(x,H-1), px(x,0));
  const edgeX = eX/H/3, edgeY = eY/W/3;

  /* chet farqi o'rtacha qo'shni farqdan 2 barobardan ko'p oshmasligi kerak */
  const okX = edgeX <= Math.max(4, baseX*2 + 2);
  const okY = edgeY <= Math.max(4, baseY*2 + 2);
  return { ok: okX && okY, edgeX:+edgeX.toFixed(2), edgeY:+edgeY.toFixed(2),
           baseX:+baseX.toFixed(2), baseY:+baseY.toFixed(2) };
}

/* Kanvasni 1-bitli (ko'tarilgan/tushirilgan ip) to'rga aylantirish.
   Jakkardda har piksel = bitta ilmoq: 1 = tanlangan (naqsh), 0 = fon. */
/* Otsu usuli — gistogrammani ikkiga ajratuvchi ENG YAXSHI chegarani
   avtomatik topadi (sinflararo dispersiyani maksimallashtiradi).
   Shu tufayli har qanday palitra va naqsh turida struktura saqlanadi. */
function otsuThreshold(lum){
  const hist = new Uint32Array(256);
  for(let i = 0; i < lum.length; i++) hist[lum[i]]++;
  const total = lum.length;
  let sum = 0;
  for(let t = 0; t < 256; t++) sum += t*hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for(let t = 0; t < 256; t++){
    wB += hist[t];
    if(!wB) continue;
    const wF = total - wB;
    if(!wF) break;
    sumB += t*hist[t];
    const mB = sumB/wB, mF = (sum - sumB)/wF;
    const between = wB*wF*(mB - mF)*(mB - mF);
    if(between > best){ best = between; thr = t; }
  }
  return thr;
}
function canvasToBilevel(cv, threshold, invert){
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const d = ctx.getImageData(0, 0, W, H).data;
  const lum = new Uint8Array(W*H);
  for(let i = 0, p = 0; i < d.length; i += 4, p++){
    lum[p] = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) | 0;
  }
  /* threshold berilmasa — avtomatik (Otsu) */
  const th = (threshold == null || threshold <= 0) ? otsuThreshold(lum) : threshold;
  const grid = new Uint8Array(W*H);
  for(let p = 0; p < lum.length; p++){
    let on = lum[p] < th ? 1 : 0;   /* qorong'i piksel = ip ko'tarilgan */
    if(invert) on = on ? 0 : 1;
    grid[p] = on;
  }
  return { grid, w:W, h:H, threshold:th };
}

/* ---------------------------------------------------------------------------
   TIFF (baseline, siqilmagan) — Jakkard CAD tizimlarining asosiy formati
   1-bit (bilevel), 8-bit kulrang yoki 24-bit RGB
   --------------------------------------------------------------------------- */
function encodeTIFF(w, h, opts){
  opts = opts || {};
  const mode = opts.mode || 'bilevel';   /* bilevel | gray | rgb */
  const dpi  = opts.dpi || 300;
  let spp, bps, photo, raw;

  if(mode === 'rgb'){
    spp = 3; bps = [8,8,8]; photo = 2;
    raw = opts.rgb;                       /* Uint8Array w*h*3 */
  } else if(mode === 'gray'){
    spp = 1; bps = [8]; photo = 1;        /* BlackIsZero */
    raw = opts.gray;                      /* Uint8Array w*h */
  } else {
    spp = 1; bps = [1]; photo = 0;        /* WhiteIsZero: 0=oq, 1=qora */
    const rowBytes = (w + 7) >> 3;
    raw = new Uint8Array(rowBytes*h);
    const g = opts.grid;
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        if(g[y*w + x]) raw[y*rowBytes + (x >> 3)] |= (0x80 >> (x & 7));
      }
    }
  }
  const rowBytes = (mode === 'bilevel') ? ((w + 7) >> 3) : w*spp;
  const stripBytes = rowBytes*h;

  /* teglar (tag raqami bo'yicha o'sish tartibida bo'lishi SHART) */
  const tags = [];
  const T = { SHORT:3, LONG:4, RATIONAL:5 };
  const add = (tag, type, count, value) => tags.push({tag, type, count, value});

  add(256, T.LONG,  1, w);              /* ImageWidth  */
  add(257, T.LONG,  1, h);              /* ImageLength */
  add(258, T.SHORT, spp, bps);          /* BitsPerSample */
  add(259, T.SHORT, 1, 1);              /* Compression = none */
  add(262, T.SHORT, 1, photo);          /* PhotometricInterpretation */
  add(273, T.LONG,  1, 0);              /* StripOffsets — keyin to'ldiriladi */
  add(277, T.SHORT, 1, spp);            /* SamplesPerPixel */
  add(278, T.LONG,  1, h);              /* RowsPerStrip */
  add(279, T.LONG,  1, stripBytes);     /* StripByteCounts */
  add(282, T.RATIONAL, 1, [dpi, 1]);    /* XResolution */
  add(283, T.RATIONAL, 1, [dpi, 1]);    /* YResolution */
  add(296, T.SHORT, 1, 2);              /* ResolutionUnit = inch */

  const n = tags.length;
  const ifdSize = 2 + n*12 + 4;
  let extra = 0;
  const typeSize = t => (t === T.SHORT ? 2 : t === T.RATIONAL ? 8 : 4);
  tags.forEach(t=>{
    const bytes = typeSize(t.type)*t.count;
    if(bytes > 4) extra += bytes + (bytes & 1);
  });
  const ifdOff = 8;
  const extraOff = ifdOff + ifdSize;
  const dataOff = extraOff + extra;
  const buf = new ArrayBuffer(dataOff + stripBytes);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  /* sarlavha: little-endian */
  u8[0] = 0x49; u8[1] = 0x49;
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOff, true);
  dv.setUint16(ifdOff, n, true);

  let ePos = extraOff;
  tags.forEach((t, i)=>{
    const off = ifdOff + 2 + i*12;
    if(t.tag === 273) t.value = dataOff;              /* StripOffsets */
    dv.setUint16(off, t.tag, true);
    dv.setUint16(off+2, t.type, true);
    dv.setUint32(off+4, t.count, true);
    const bytes = typeSize(t.type)*t.count;
    if(bytes <= 4){
      if(t.type === T.SHORT){
        const arr = Array.isArray(t.value) ? t.value : [t.value];
        arr.forEach((v,k)=> dv.setUint16(off+8+k*2, v, true));
      } else {
        dv.setUint32(off+8, t.value, true);
      }
    } else {
      dv.setUint32(off+8, ePos, true);
      if(t.type === T.RATIONAL){
        dv.setUint32(ePos, t.value[0], true);
        dv.setUint32(ePos+4, t.value[1], true);
        ePos += 8;
      } else if(t.type === T.SHORT){
        t.value.forEach((v,k)=> dv.setUint16(ePos+k*2, v, true));
        ePos += bytes + (bytes & 1);
      }
    }
  });
  dv.setUint32(ifdOff + 2 + n*12, 0, true);   /* keyingi IFD yo'q */
  u8.set(raw, dataOff);
  return u8;
}

/* ---------------------------------------------------------------------------
   BMP — 1-bit yoki 24-bit (ko'p Jakkard CAD dasturlari o'qiydi)
   --------------------------------------------------------------------------- */
function encodeBMP(w, h, opts){
  opts = opts || {};
  const mode = opts.mode || 'bilevel';
  const dpi = opts.dpi || 300;
  const ppm = Math.round(dpi/0.0254);
  const bpp = (mode === 'rgb') ? 24 : 1;
  const rowRaw = (mode === 'rgb') ? w*3 : ((w + 7) >> 3);
  const rowPad = (rowRaw + 3) & ~3;              /* qatorlar 4 baytga tekislanadi */
  const palBytes = (bpp === 1) ? 8 : 0;
  const dataOff = 14 + 40 + palBytes;
  const size = dataOff + rowPad*h;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8[0] = 0x42; u8[1] = 0x4D;                    /* 'BM' */
  dv.setUint32(2, size, true);
  dv.setUint32(10, dataOff, true);
  dv.setUint32(14, 40, true);                    /* BITMAPINFOHEADER */
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);                      /* musbat = pastdan yuqoriga */
  dv.setUint16(26, 1, true);
  dv.setUint16(28, bpp, true);
  dv.setUint32(30, 0, true);                     /* siqilmagan */
  dv.setUint32(34, rowPad*h, true);
  dv.setUint32(38, ppm, true);
  dv.setUint32(42, ppm, true);
  if(bpp === 1){
    dv.setUint32(46, 2, true);                   /* palitrada 2 rang */
    /* 0 = oq (fon), 1 = qora (naqsh) — BGRA */
    u8[54]=255; u8[55]=255; u8[56]=255; u8[57]=0;
    u8[58]=0;   u8[59]=0;   u8[60]=0;   u8[61]=0;
  }
  const g = opts.grid, rgb = opts.rgb;
  for(let y = 0; y < h; y++){
    const srcY = h - 1 - y;                      /* BMP teskari tartibda */
    let o = dataOff + y*rowPad;
    if(bpp === 1){
      for(let x = 0; x < w; x++){
        if(g[srcY*w + x]) u8[o + (x >> 3)] |= (0x80 >> (x & 7));
      }
    } else {
      for(let x = 0; x < w; x++){
        const s = (srcY*w + x)*3;
        u8[o++] = rgb[s+2]; u8[o++] = rgb[s+1]; u8[o++] = rgb[s]; /* BGR */
      }
    }
  }
  return u8;
}

/* ---------------------------------------------------------------------------
   WIF — Weaving Information File (dastgoh drafti)
   Piksel to'ridan haqiqiy draft chiqariladi: bir xil ustunlar → bitta ramka
   (shaft), bir xil qatorlar → bitta pedal (treadle), kesishmasi → tie-up.
   Bu ajratish har doim ANIQ: bir xil ustunlar ta'rifi bo'yicha bir xil
   ko'tariladi, shuning uchun tie-up ziddiyatsiz chiqadi.
   --------------------------------------------------------------------------- */
function buildWIF(grid, w, h, meta){
  meta = meta || {};
  const colKey = new Array(w), rowKey = new Array(h);
  for(let x = 0; x < w; x++){
    let s = '';
    for(let y = 0; y < h; y++) s += grid[y*w + x] ? '1' : '0';
    colKey[x] = s;
  }
  for(let y = 0; y < h; y++){
    let s = '';
    for(let x = 0; x < w; x++) s += grid[y*w + x] ? '1' : '0';
    rowKey[y] = s;
  }
  const shafts = [], shaftIx = {}, treadles = [], treadleIx = {};
  colKey.forEach(k=>{ if(!(k in shaftIx)){ shaftIx[k] = shafts.length; shafts.push(k); } });
  rowKey.forEach(k=>{ if(!(k in treadleIx)){ treadleIx[k] = treadles.length; treadles.push(k); } });

  const nS = shafts.length, nT = treadles.length;
  const pad2 = n => (n < 10 ? '0'+n : ''+n);
  const d = new Date();
  const dateStr = pad2(d.getDate())+'.'+pad2(d.getMonth()+1)+'.'+d.getFullYear();

  let s = '';
  s += '[WIF]\n';
  s += 'Version=1.1\n';
  s += 'Date=' + dateStr + '\n';
  s += 'Developers=NaqshAI\n';
  s += 'Source Program=NaqshAI\n';
  s += 'Source Version=27.1\n\n';

  s += '[CONTENTS]\n';
  s += 'COLOR PALETTE=yes\nTEXT=yes\nWEAVING=yes\nWARP=yes\nWEFT=yes\n';
  s += 'COLOR TABLE=yes\nTHREADING=yes\nTIEUP=yes\nTREADLING=yes\n\n';

  s += '[TEXT]\n';
  s += 'Title=' + (meta.title || 'NaqshAI naqsh') + '\n';
  s += 'Author=NaqshAI\n\n';

  s += '[WEAVING]\n';
  s += 'Rising Shed=yes\n';
  s += 'Treadles=' + nT + '\n';
  s += 'Shafts=' + nS + '\n\n';

  s += '[COLOR PALETTE]\nEntries=2\nForm=RGB\nRange=0,255\n\n';
  s += '[COLOR TABLE]\n1=255,255,255\n2=0,0,0\n\n';

  s += '[WARP]\nThreads=' + w + '\nUnits=Decipoints\nColor=2\n\n';
  s += '[WEFT]\nThreads=' + h + '\nUnits=Decipoints\nColor=1\n\n';

  s += '[THREADING]\n';
  for(let x = 0; x < w; x++) s += (x+1) + '=' + (shaftIx[colKey[x]] + 1) + '\n';
  s += '\n[TREADLING]\n';
  for(let y = 0; y < h; y++) s += (y+1) + '=' + (treadleIx[rowKey[y]] + 1) + '\n';

  s += '\n[TIEUP]\n';
  for(let t = 0; t < nT; t++){
    const rk = treadles[t];
    const lifted = [];
    for(let sIdx = 0; sIdx < nS; sIdx++){
      /* shu ramkaga tegishli istalgan ustunni olamiz */
      const x = colKey.indexOf(shafts[sIdx]);
      if(rk[x] === '1') lifted.push(sIdx + 1);
    }
    s += (t+1) + '=' + lifted.join(',') + '\n';
  }
  return { wif: s, shafts: nS, treadles: nT };
}

/* ---------------------------------------------------------------------------
   LAZER: DXF va SVG — haqiqiy mm o'lchamida, yopiq konturlar bilan
   --------------------------------------------------------------------------- */
function buildLaserSVG(wMm, hMm, opts){
  opts = opts || {};
  const B = boardFor(wMm, hMm);
  const kerf = opts.kerf || 0.1;        /* hairline — lazer dasturlari kesish deb tanidi */
  let out = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- NaqshAI — lazer kesish uchun. Qizil = kesish konturi. O\'lcham: ' +
      wMm + '×' + hMm + ' mm -->\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + wMm + 'mm" height="' + hMm + 'mm" ' +
    'viewBox="0 0 ' + num(B.bw) + ' ' + num(B.bh) + '">\n' +
    '<g id="kesish" stroke="#ff0000" stroke-width="' + (kerf/B.k).toFixed(3) + '" fill="none" ' +
    'stroke-linecap="round" stroke-linejoin="round">\n';
  /* Taxta ichidagi yo'llar Bezier ko'rinishida qoladi (CorelDraw'da
     tahrirlash uchun silliqroq), chegaradan chiqadiganlari qirqilgan
     poliliniya sifatida chiqadi — DXF bilan aynan bir xil detal bo'lsin. */
  for(const pl of laserPolys(wMm, hMm, opts.fill)){
    out += '<path d="M' + pl.pts.map(q => num(q[0]) + ' ' + num(q[1])).join(' L') +
           (pl.closed ? ' Z' : '') + '"/>\n';
  }
  if(opts.frame){
    out += '<rect x="0" y="0" width="' + num(B.bw) + '" height="' + num(B.bh) + '"/>\n';
  }
  out += '</g>\n</svg>';
  return out;
}

const EXP = { format:'png', size:2048, dpi:300, trans:false,
              jqsize:512, jqgroup:'p4', jqdepth:1, mm:100, invert:false,
              fill:'tile' };

/* Format tanlanganda qaysi sozlama guruhlari ko'rinishini boshqaradi */
function expSyncGroups(){
  const f = EXP.format;
  const isRaster  = (f === 'png');
  const isJq      = (f === 'tiff' || f === 'bmp' || f === 'wif');
  const isVector  = (f === 'svg' || f === 'dxf' || f === 'eps');
  const show = (id, on) => { const el = $(id); if(el) el.style.display = on ? '' : 'none'; };
  show('grp-size',  isRaster);
  show('grp-trans', isRaster);
  show('grp-jq',    isJq);
  show('grp-mm',    isVector);
  show('grp-fill',  isRaster || isVector);
  /* WIF faqat 1-bit bo'la oladi — draft ip ko'tarilishidan iborat */
  const dep = $('exp-jqdepth');
  if(dep) dep.style.opacity = (f === 'wif') ? '.45' : '1';
  expJqInfo();
}

/* Rapport haqida jonli ma'lumot — nechta ilmoq, taxminiy mato o'lchami */
function expJqInfo(){
  const el = $('jq-info');
  if(!el) return;
  if(!(EXP.format === 'tiff' || EXP.format === 'bmp' || EXP.format === 'wif')){ el.textContent = ''; return; }
  const g = GRIDS[EXP.jqgroup] || GRIDS.p4;
  /* Fayldagi HAQIQIY o'lcham ko'rsatiladi (nazariy c×c emas):
     girih oilasida rapport plitka davriga yaxlitlanadi va nazariy
     qiymatdan farq qiladi. */
  const sz = rapportSize(EXP.jqsize, EXP.jqgroup);
  const W = sz.w, H = sz.h;
  const dens = 100;  /* taxminiy: 100 ilmoq/dyuym */
  el.innerHTML = 'Rapport: <b>' + W + ' × ' + H + '</b> ilmoq' +
    (g.mirror ? ' (ko\'zguli rapport — asos plitka aks ettirilgan, 2× katta)' : '') +
    (g.hex ? ' (geksagonal: balandlik ≈ c·√3)' : '') +
    '<br>~' + (W/dens*25.4).toFixed(0) + ' × ' + (H/dens*25.4).toFixed(0) + ' mm (100 ilmoq/dyuym zichlikda)' +
    (EXP.format === 'wif' ? '<br>WIF — ramka/pedal soni fayl yaratilganda hisoblanadi.' : '');
}

function segWire(id, key, isNum){
  const box = $(id);
  if(!box) return;
  box.addEventListener('click', e=>{
    const b = e.target.closest('button');
    if(!b) return;
    box.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
    EXP[key] = isNum ? parseInt(b.dataset.v,10) : b.dataset.v;
    /* Format ikkita segmentga bo'lingan — biri tanlansa ikkinchisi bo'shatiladi */
    if(key === 'format'){
      const other = (id === 'exp-format') ? $('exp-format2') : $('exp-format');
      if(other) other.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
    }
    expSyncGroups();
  });
}

/* Jakkard eksporti — chok-suz rapport, so'ng tanlangan formatga kodlash */
async function exportJacquard(){
  const inv = $('exp-invert');
  EXP.invert = inv ? inv.checked : false;
  const depth = (EXP.format === 'wif') ? 1 : EXP.jqdepth;
  const tile = makeSeamlessRepeat(EXP.jqsize, EXP.jqgroup, {});
  if(!tile){ ntf('Rapport yaratib bo\'lmadi', 'err'); return; }

  /* Chok-suzlikni HAQIQATAN tekshiramiz — "ishonamiz" emas, o'lchaymiz */
  const chk = verifySeamless(tile.canvas);
  if(!chk.ok){
    console.warn('[jacquard] chetlar mos kelmadi', chk);
    ntf('Diqqat: rapport chetlarida farq aniqlandi — natijani tekshiring', 'err');
  }

  const W = tile.w, H = tile.h;
  /* Interfeys paneli va fayl bir xil raqamni ko'rsatishi shart —
     farq chiqsa bu dasturiy xato, jimgina o'tkazib yubormaymiz. */
  const pred = rapportSize(EXP.jqsize, EXP.jqgroup);
  if(pred.w !== W || pred.h !== H)
    console.error('[jacquard] o\'lcham bashorati mos emas', pred, {W, H});
  const base = 'naqsh_' + P.type + '_' + EXP.jqgroup + '_' + W + 'x' + H;

  if(EXP.format === 'wif'){
    const { grid } = canvasToBilevel(tile.canvas, null, EXP.invert);
    const r = buildWIF(grid, W, H, { title: (getPattern(P.type)||{}).nm });
    _dlBlob(r.wif, 'text/plain', base + '.wif',
            'WIF yuklab olindi 📥 — ' + r.shafts + ' ramka, ' + r.treadles + ' pedal');
    if(r.shafts > 40){
      ntf('Eslatma: ' + r.shafts + ' ramka — bu Jakkard uchun normal, lekin oddiy dastgohda ko\'p', 'err');
    }
    closeExport();
    return;
  }

  const ctx = tile.canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H).data;
  let opts = { dpi: EXP.dpi };
  if(depth === 1){
    opts.mode = 'bilevel';
    const bl = canvasToBilevel(tile.canvas, null, EXP.invert);
    opts.grid = bl.grid;
    /* Sifat nazorati: 1-bit natija butunlay bir rangga aylanib qolmasin */
    let ink = 0;
    for(let i = 0; i < bl.grid.length; i++) ink += bl.grid[i];
    const pct = 100*ink/bl.grid.length;
    if(pct < 0.5 || pct > 99.5){
      ntf('Diqqat: 1-bit natija deyarli bir rangli (' + pct.toFixed(1) + '%) — palitra yoki naqshni o\'zgartiring', 'err');
    }
  } else if(depth === 8){
    opts.mode = 'gray';
    const gray = new Uint8Array(W*H);
    for(let i = 0, p = 0; i < img.length; i += 4, p++){
      gray[p] = Math.round(0.299*img[i] + 0.587*img[i+1] + 0.114*img[i+2]);
    }
    opts.gray = gray;
  } else {
    opts.mode = 'rgb';
    const rgb = new Uint8Array(W*H*3);
    for(let i = 0, p = 0; i < img.length; i += 4, p += 3){
      rgb[p] = img[i]; rgb[p+1] = img[i+1]; rgb[p+2] = img[i+2];
    }
    opts.rgb = rgb;
  }

  const bytes = (EXP.format === 'tiff') ? encodeTIFF(W, H, opts) : encodeBMP(W, H, opts);
  const ext = (EXP.format === 'tiff') ? 'tif' : 'bmp';
  const mime = (EXP.format === 'tiff') ? 'image/tiff' : 'image/bmp';
  _dlBlob(new Blob([bytes], {type:mime}), mime, base + '_' + depth + 'bit.' + ext,
          ext.toUpperCase() + ' yuklab olindi 📥 — chok-suz rapport ' + W + '×' + H);
  closeExport();
}

/* Raqamli maydonlardan o'lchamni o'qish — bo'sh yoki noto'g'ri bo'lsa
   segmentdagi tanlangan qiymatga qaytadi. */
function expDims(){
  const rd = (id, def, lo, hi)=>{
    const el = $(id);
    if(!el) return def;
    const v = parseFloat(el.value);
    if(!isFinite(v)) return def;
    return Math.min(hi, Math.max(lo, Math.round(v)));
  };
  return {
    mmW: rd('exp-mm-w', EXP.mm, 5, 5000),
    mmH: rd('exp-mm-h', EXP.mm, 5, 5000),
    pxW: rd('exp-px-w', EXP.size, 16, 12000),
    pxH: rd('exp-px-h', EXP.size, 16, 12000),
    jqc: rd('exp-jq-c', EXP.jqsize, 32, 4096)
  };
}
function doExport(){
  const chk = $('exp-trans');
  EXP.trans = chk ? chk.checked : false;
  const D = expDims();
  if(EXP.format === 'tiff' || EXP.format === 'bmp' || EXP.format === 'wif'){
    EXP.jqsize = D.jqc;
    exportJacquard();
    return;
  }
  if(EXP.format === 'png'){
    exportPNG(D.pxW, D.pxH, EXP.dpi, EXP.trans, null, EXP.fill);
  } else if(EXP.format === 'svg'){
    const svg = buildLaserSVG(D.mmW, D.mmH, { frame:true, fill:EXP.fill });
    _dlBlob(svg, 'image/svg+xml', 'naqsh_'+P.type+'_'+D.mmW+'x'+D.mmH+'mm.svg',
            'SVG yuklab olindi 📥 — ' + D.mmW + '×' + D.mmH + ' mm');
  } else if(EXP.format === 'eps'){
    const eps = buildEPS(D.mmW, D.mmH, { frame:true, fill:EXP.fill });
    _dlBlob(eps, 'application/postscript', 'naqsh_'+P.type+'_'+D.mmW+'x'+D.mmH+'mm.eps',
            'EPS yuklab olindi 📥 — ' + D.mmW + '×' + D.mmH + ' mm');
  } else {
    const dxf = buildDXF(D.mmW, D.mmH, EXP.fill);
    _dlBlob(dxf, 'application/dxf', 'naqsh_'+P.type+'_'+D.mmW+'x'+D.mmH+'mm.dxf',
            'DXF (CNC/lazer) yuklab olindi 📥 — ' + D.mmW + '×' + D.mmH + ' mm');
  }
  closeExport();
}
/* Raqamli maydonlarni EXP dan to'ldirish — oyna ochilganda ular hech qachon
   tanlangan tugmadan farq qilib qolmasin (ikki manba bo'lsa, qaysi biri
   fayl o'lchamini belgilagani noaniq bo'lib qoladi). */
function expSyncInputs(){
  const set = (id, v)=>{ const el = $(id); if(el && el.value === '') el.value = String(v); };
  const force = (id, v)=>{ const el = $(id); if(el) el.value = String(v); };
  const mmw = $('exp-mm-w'), pxw = $('exp-px-w'), jqc = $('exp-jq-c');
  if(mmw && parseFloat(mmw.value) !== EXP.mm && !mmw.dataset.touched){
    force('exp-mm-w', EXP.mm); force('exp-mm-h', EXP.mm);
  }
  if(pxw && parseFloat(pxw.value) !== EXP.size && !pxw.dataset.touched){
    force('exp-px-w', EXP.size); force('exp-px-h', EXP.size);
  }
  if(jqc && parseFloat(jqc.value) !== EXP.jqsize && !jqc.dataset.touched){
    force('exp-jq-c', EXP.jqsize);
  }
  set('exp-mm-w', EXP.mm); set('exp-mm-h', EXP.mm);
  set('exp-px-w', EXP.size); set('exp-px-h', EXP.size);
  set('exp-jq-c', EXP.jqsize);
}
function openExport(){ expSyncInputs(); expSyncGroups(); const m = $('modal-export'); if(m) m.classList.add('open'); }
function closeExport(){ const m = $('modal-export'); if(m) m.classList.remove('open'); }
/* ============================================================
   3D KO'RISH (Three.js r128)
   ============================================================ */
let threeReady = false;
let T3 = null; /* {scene,camera,renderer,group,mesh,mat,amb,hemi,key,fill,auto,kind} */
const PH = { img:null, shape:'doira', size:45, frame:12, text:'', date:'' };

function latheFromProfile(profile, scale){
  const pts = profile.map(q=>new THREE.Vector2(q[0]*scale, q[1]*scale));
  return new THREE.LatheGeometry(pts, 96);
}
/* PLANAR UV — tepadan proyeksiya: naqsh idish markazida SIMMETRIK yotadi
   (LatheGeometry ning standart UV si teksturani aylana bo'ylab cho'zib yuboradi) */
function planarUV(geo){
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = Math.max(bb.max.x-bb.min.x, bb.max.z-bb.min.z) || 1;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  if(!pos || !uv) return geo;
  for(let i=0;i<pos.count;i++){
    uv.setXY(i, 0.5 + pos.getX(i)/size, 0.5 - pos.getZ(i)/size);
  }
  uv.needsUpdate = true;
  return geo;
}
/* ===========================================================================
   ME'MORIY OB'YEKTLAR — ustun, darvoza, peshtoq
   ---------------------------------------------------------------------------
   Ko'p qismli guruhlar: har qism o'z materiali va o'z naqsh zichligi bilan.

   NAQSH. Tekstura — HAQIQIY RAPPORT (makeSeamlessRepeat, chok-suzligi 160
   holatda o'lchangan) + RepeatWrapping. UV diapazoni geometriya turiga qarab
   har xil (brauzerda o'lchangan):
       Extrude / Shape          → UV = DUNYO koordinatasi  → repeat = 1/plitka
       Box / Cylinder / Lathe   → UV = 0..1                → repeat = plitka SONI
       stripFromOutline         → UV = (yoy uzunligi, chuqurlik)
   Aylanma yuzalarda u BUTUN son bo'lishi shart — aks holda buyum orqasida
   ulanish chizig'i chiqadi.

   MIQYOS. Haqiqiy koshinkorlikda modul mayda: 4 birlik enli peshtoqda
   ~10 ta plitka. Shuning uchun asosiy maydon plitkasi TU = 0.40, bandlar esa
   o'z enidan kelib chiqadi (bandda aynan bitta plitka yotadi) — naqsh nafis
   va me'moriy o'lchamga mos chiqadi.

   O'LCHOV. Har ob'yekt asosi LOKAL y = 0 da quriladi va guruh FLOOR_Y ga
   qo'yiladi, shunda buyum polda turadi.
   =========================================================================== */
const ARCH_KINDS = {ustun:1, darvoza:1, peshtoq:1};
const FLOOR_Y = -1.66;
const TU = 0.40;                     /* asosiy maydon plitkasi (dunyo birligi) */

function archMat(kind, rx, ry, tint){
  let m;
  if(kind === 'stone'){
    m = new THREE.MeshStandardMaterial({color:0xd6c7a4, roughness:0.86, metalness:0.02});
  } else if(kind === 'metal'){
    m = new THREE.MeshStandardMaterial({color:0xa87c34, roughness:0.34, metalness:0.9});
  } else if(kind === 'dark'){
    m = new THREE.MeshStandardMaterial({color:0x2a1d10, roughness:0.85, metalness:0.05});
  } else if(kind === 'wood'){
    m = T3.matWood.clone();
  } else {
    m = T3.mat.clone();
  }
  m.side = THREE.FrontSide;
  if(kind === 'tile' || kind === 'wood'){
    if(tint !== undefined){
      m.color = new THREE.Color(tint);
      /* tinted yuzalar porlab ketmasin — chuqurlik sezilsin */
      if(m.emissive){ m.emissive = new THREE.Color(tint); m.emissiveIntensity = 0.05; }
    }
    m.userData.rep = [rx || 1, (ry === undefined ? rx : ry) || 1];
    T3.archMats.push(m);
  }
  return m;
}

/* TO'RT MARKAZLI (Temuriylar) SINIQ RAVOQ.
   (cx + hw)² = cx² + rise²  →  cx = (rise² − hw²)/(2·hw).
   Ravoq SINIQ bo'lishi uchun rise > hw shart. */
function archOutline(hw, spring, apex, n){
  n = n || 48;
  const rise = apex - spring;
  const cx = (rise*rise - hw*hw)/(2*hw);
  const R = cx + hw;
  const aEnd = Math.atan2(rise, -cx);
  const pts = [];
  for(let i = 0; i <= n; i++){
    const a = Math.PI + (aEnd - Math.PI)*(i/n);
    pts.push([cx + R*Math.cos(a), spring + R*Math.sin(a)]);
  }
  for(let i = n - 1; i >= 0; i--){
    const a = Math.PI + (aEnd - Math.PI)*(i/n);
    pts.push([-(cx + R*Math.cos(a)), spring + R*Math.sin(a)]);
  }
  return pts;
}

/* Ravoq atrofidagi bo'rtma band (archivolt) shakli */
function archBandShape(ow, spring, apex, bw, n){
  n = n || 44;
  const outer = archOutline(ow + bw, spring, apex + bw, n);
  const inner = archOutline(ow, spring, apex, n);
  const sh = new THREE.Shape();
  sh.moveTo(-(ow + bw), 0);
  for(const q of outer) sh.lineTo(q[0], q[1]);
  sh.lineTo(ow + bw, 0);
  sh.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-ow, 0);
  for(const q of inner) hole.lineTo(q[0], q[1]);
  hole.lineTo(ow, 0);
  hole.closePath();
  sh.holes.push(hole);
  return sh;
}

/* Kontur bo'ylab tunnel yuzasi (ravoq soffiti). UV = (yoy uzunligi, chuqurlik) */
function stripFromOutline(pts, depth){
  const g = new THREE.BufferGeometry();
  const n = pts.length;
  const pos = [], uv = [], idx = [];
  let len = 0; const s = [0];
  for(let i = 1; i < n; i++){
    len += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
    s.push(len);
  }
  for(let i = 0; i < n; i++){
    pos.push(pts[i][0], pts[i][1], 0);
    pos.push(pts[i][0], pts[i][1], -depth);
    uv.push(s[i], 0, s[i], depth);
  }
  for(let i = 0; i < n - 1; i++){
    const a = i*2, b = i*2+1, c = (i+1)*2, d = (i+1)*2+1;
    idx.push(a, b, c, b, d, c);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* MUQARNAS KATAGI — botiq chig'anoq (stalaktit).
   Ilgari kataklar oddiy PARALLELEPIPED edi va muqarnas "g'ishtlar uyumi"dek
   ko'rinardi. Haqiqiy muqarnas kataklari — kichik yarim gumbazchalar;
   shuning uchun bu yerda sferaning bir bo'lagi ishlatiladi. */
function muqCellGeo(r){
  return new THREE.SphereGeometry(r, 12, 8, -Math.PI/2, Math.PI, 0, Math.PI*0.62);
}

/* ---------------------------------------------------------------------------
   MUQARNAS TOQCHASI — HAQIQIY KATAK GEOMETRIYASI
   ---------------------------------------------------------------------------
   Sfera bo'lagi tashqaridan qavariq MUNCHOQ bo'lib ko'rinardi — muqarnas esa
   aksincha: har katak ichkariga O'YILGAN toqcha, og'zi siniq ravoq shaklida,
   ichi yarim gumbaz bilan yopiladi. Ustun boshiga qaralganda ko'z aynan
   shu qator-qator botiq toqchalarni va ular orasidagi tik qovurg'alarni
   ko'radi.
   Bu yerda katak parametrik yuza sifatida quriladi:
       c = cos(v·π/2),  s = sin(v·π/2)
       P(u,v) = ( ox(u)·c ,  yf + (oy(u) − yf)·c ,  −d·s )
   v = 0 da yuza aynan og'iz konturi (siniq ravoq), v = 1 da esa u bitta
   nuqtaga — toqcha tubiga yig'iladi. Bo'ylama kesim chorak aylana bo'lgani
   uchun tub silliq gumbaz bo'lib chiqadi, o'tkir burchak qolmaydi.
   UV: u — og'iz bo'ylab yoy uzunligi, v — chuqurlik. Shuning uchun naqsh
   toqcha ichiga oqib kiradi, chetida uzilmaydi. */
function muqNicheGeo(hw, h, depth, uSeg, vSeg){
  uSeg = uSeg || 20; vSeg = vSeg || 6;
  const out = archOutline(hw, 0, h, Math.max(6, uSeg >> 1));
  const n = out.length;
  /* og'iz bo'ylab yoy uzunligi (UV uchun) */
  const sArr = [0];
  let tot = 0;
  for(let i = 1; i < n; i++){
    tot += Math.hypot(out[i][0]-out[i-1][0], out[i][1]-out[i-1][1]);
    sArr.push(tot);
  }
  const yf = h*0.54;                       /* gumbaz markazi */
  const pos = [], uv = [], idx = [];
  for(let j = 0; j <= vSeg; j++){
    const v = j/vSeg;
    const c = Math.cos(v*Math.PI/2), sn = Math.sin(v*Math.PI/2);
    for(let i = 0; i < n; i++){
      pos.push(out[i][0]*c, yf + (out[i][1]-yf)*c, -depth*sn);
      uv.push(sArr[i]/(tot || 1), 1 - v);
    }
  }
  for(let j = 0; j < vSeg; j++){
    for(let i = 0; i < n - 1; i++){
      const a = j*n + i, b = a + 1, c2 = a + n, d2 = c2 + 1;
      idx.push(a, c2, b, b, c2, d2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/* Toqcha og'zini o'rab turuvchi QOVURG'A (ravoq yuzasi).
   Toqchalar yonma-yon terilganda ular orasida ingichka tik qovurg'a
   qoladi — muqarnasning o'sha tanish "asal uyasi" to'ri aynan shu.
   Qovurg'a ravoq bandi shaklida chiqariladi. */
function muqRibGeo(hw, h, bw, depth){
  /* Qovurg'a MAYDA detal — u ko'zga faqat toqchalar orasidagi chiziq
     bo'lib ko'rinadi. Shuning uchun kontur nuqtalari va qiyalik
     bosqichlari kam olinadi: bir qovurg'a ~1500 uchburchakdan ~400 ga
     tushdi, peshtoqda esa 78 ta qovurg'a bor. */
  const sh = archBandShape(hw, 0, h, bw, 10);
  return new THREE.ExtrudeGeometry(sh, {depth:depth, bevelEnabled:true,
    bevelThickness:bw*0.45, bevelSize:bw*0.40, bevelSegments:1, curveSegments:5});
}

/* Ustun boshi uchun muqarnas — aylana bo'ylab yaruslar */
function muqarnasCap(r0, tiers, height, mat){
  const grp = new THREE.Group();
  let r = r0, y = 0;
  const hT = height/tiers;
  for(let t = 0; t < tiers; t++){
    const n = 10 + t*4;
    const cr = Math.min(hT*0.62, TAU*r/n*0.52);
    const geo = muqCellGeo(cr);
    for(let i = 0; i < n; i++){
      const a = TAU*(i + 0.5)/n + (t % 2 ? Math.PI/n : 0);
      const cell = new THREE.Mesh(geo, mat);
      cell.position.set(Math.sin(a)*r, y + hT*0.5, Math.cos(a)*r);
      cell.rotation.y = a;
      cell.rotation.x = -0.12;
      grp.add(cell);
    }
    r += hT*0.48; y += hT;
  }
  return grp;
}

/* USTUN/GULDASTA BOSHI — kengayuvchi KORBEL.
   Kataklarni aylana bo'ylab sochib chiqish bu miqyosda ishlamadi: ular
   bir-biriga tegmay, "to'kilayotgan bo'laklar"dek ko'rinardi. Haqiqiy
   Xiva ustun boshi — ketma-ket kengayuvchi o'yma halqalar; ular yaxlit
   massa hosil qiladi va tepasidagi yostiqni ko'taradi. Eng yuqorida
   bitta zich muqarnas qatori qo'shiladi. */
function corbelCap(r0, tiers, height, matA, matB, matCell){
  const grp = new THREE.Group();
  const hT = height/tiers;
  let rb = r0;
  for(let t = 0; t < tiers; t++){
    const rt = rb + hT*0.72;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hT*0.94, 32),
                                (t % 2) ? matB : matA);
    ring.position.y = t*hT + hT/2;
    grp.add(ring);
    rb = rt;
  }
  if(matCell){
    const n = Math.max(12, Math.round(TAU*rb/(hT*0.62)));
    const cr = Math.min(hT*0.42, TAU*rb/n*0.48);
    const geo = muqCellGeo(cr);
    for(let i = 0; i < n; i++){
      const a = TAU*(i + 0.5)/n;
      const cell = new THREE.Mesh(geo, matCell);
      cell.position.set(Math.sin(a)*(rb - cr*0.5), tiers*hT + cr*0.6, Math.cos(a)*(rb - cr*0.5));
      cell.rotation.y = a;
      cell.rotation.x = Math.PI;
      grp.add(cell);
    }
  }
  return grp;
}

/* ---------------------------------------------------------------------------
   MUQARNAS USTUN BOSHI (haqiqiy o'yma stalaktit kapiteli)
   ---------------------------------------------------------------------------
   Ilgari bu yerda oddiy kengayuvchi halqalar (korbel) turardi: yaxlit massa
   berardi, lekin muqarnasga o'xshamasdi — o'yma emas, tornada aylantirilgan
   detaldek ko'rinardi.
   Haqiqiy muqarnas kapiteli quyidagicha ishlaydi:
     • yaruslar yuqoriga ko'tarilgan sari tashqariga chiqadi (korbel);
     • har yarus aylana bo'ylab bir qator TOQCHAdan iborat;
     • qo'shni yaruslar yarim qadamga surilgan — shuning uchun ustki
       toqchaning tubi pastki ikki toqcha orasidagi qovurg'a ustiga tushadi;
     • yaruslar orasida ingichka javon (polka) bo'ladi — soya chizig'i
       aynan shundan chiqadi va ko'z yaruslarni ajratadi;
     • hamma narsa orqadan yaxlit konus tana bilan yopiladi, teshik qolmaydi.
   Toqchalar soni har yarusda radiusga qarab hisoblanadi, shuning uchun
   katak eni hamma yarusda deyarli bir xil bo'ladi — asl o'ymadagidek. */
function muqarnasCapital(r0, tiers, height, matBody, matA, matB, matShelf){
  const grp = new THREE.Group();
  const hT = height/tiers;
  /* Kengayish TEKIS emas: pastki yaruslar oz, yuqoridagilar ko'p chiqadi.
     Bir xil qadamda kapitel "teskari zinapoya"dek qotib ko'rinardi;
     o'sib boruvchi qadam esa haqiqiy stalaktit korbelning yumshoq
     yoyilishini beradi. Yig'indi kengayish height*0.62 ga teng. */
  const fSum = tiers > 1 ? tiers : 1;
  const flareOf = t => height*0.62/fSum * (0.55 + 0.90*(tiers > 1 ? t/(tiers-1) : 0));
  let rb = r0;
  for(let t = 0; t < tiers; t++){
    const flare = flareOf(t);
    const rt = rb + flare;
    const y0 = t*hT;
    /* 1) TANA — orqadagi yaxlit konus. To'q rangda: toqcha tubi qorong'i
       bo'lsa, o'yma chuqurligi ko'zga aniq bilinadi. */
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(rt*0.98, rb*0.98, hT*1.02, 44, 1, true), matBody);
    body.position.y = y0 + hT/2;
    grp.add(body);
    /* 2) TOQCHALAR — aylana bo'ylab, qo'shni yarus yarim qadamga surilgan.
       Katak eni yarus balandligiga yaqin (haqiqiy muqarnasda ham shunday),
       shuning uchun radius o'sgani sari kataklar SONI ortadi, o'lchami
       emas — naqsh miqyosi hamma yarusda bir xil qoladi. */
    const cellW = hT*1.02;
    const n = Math.max(7, Math.round(TAU*rt/cellW));
    const hw = TAU*rt/n*0.5;            /* katak yarim eni — qo'shnisiga tegib turadi */
    const hCell = hT*0.99;
    const depth = Math.max(hw*0.95, flare*1.25);
    const niche = muqNicheGeo(hw*0.90, hCell, depth);
    const rib   = muqRibGeo(hw*0.90, hCell, hw*0.14, depth*0.26);
    const mN = (t % 2) ? matB : matA;
    const off = (t % 2) ? Math.PI/n : 0;
    for(let i = 0; i < n; i++){
      const a = TAU*i/n + off;
      const ca = Math.cos(a), sa = Math.sin(a);
      const cell = new THREE.Mesh(niche, mN);
      cell.position.set(sa*rt, y0 + hT*0.015, ca*rt);
      cell.rotation.y = a;              /* og'iz tashqariga qaraydi */
      grp.add(cell);
      const rm = new THREE.Mesh(rib, matShelf || matBody);
      rm.position.set(sa*rt, y0 + hT*0.015, ca*rt);
      rm.rotation.y = a;
      grp.add(rm);
    }
    /* 3) JAVON — yarus tagidagi ingichka chiqiq: soya chizig'i beradi va
       ustki qator pastkisiga "tayangan"dek ko'rinadi */
    const shelf = new THREE.Mesh(
      new THREE.CylinderGeometry(rt + hw*0.16, rt - flare*0.35, hT*0.055, 52),
      matShelf || matBody);
    shelf.position.y = y0 + hT*0.012;
    grp.add(shelf);
    rb = rt;
  }
  /* Tepa gardish — kapitelni yopadi va yostiqni ko'taradi */
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(rb + hT*0.18, rb + hT*0.02, hT*0.20, 52), matShelf || matBody);
  top.position.y = tiers*hT + hT*0.09;
  grp.add(top);
  grp.userData.rTop = rb + hT*0.18;
  grp.userData.h = tiers*hT + hT*0.19;
  return grp;
}

/* AYVON RAVOQ BOSHI — ichma-ich chekinuvchi ravoq qovurg'alari.
   Kataklarni ravoq egrisi bo'ylab sochib chiqish yaxshi natija bermadi:
   old tomondan ular alohida munchoqlardek ko'rinardi. Temuriylar
   ayvonlarida ravoq boshi aslida ICHMA-ICH JOYLASHGAN, orqaga chekinuvchi
   ravoq bandlaridan iborat — quyida aynan shu quriladi. Har band oldingisidan
   kichikroq va chuqurroq, ranglari navbatlashadi. */
function archRibs(ow, spring, apex, tiers, z0, dz, matA, matB){
  const grp = new THREE.Group();
  for(let t = 0; t < tiers; t++){
    const k = 1 - t*0.085;
    const bw = 0.13*k;
    const sh = archBandShape(ow*k, spring, spring + (apex - spring)*k, bw);
    const rib = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sh, {depth:Math.abs(dz)*0.9, bevelEnabled:false, curveSegments:18}),
      (t % 2) ? matB : matA);
    rib.position.z = z0 + t*dz;
    grp.add(rib);
  }
  return grp;
}

/* MUQARNAS KORBEL BANDI — gorizontal qator kataklar (ravoq yelkasida yoki
   guldasta boshida). Kataklar zich terilgani uchun yaxlit asal uyasi
   ko'rinishini beradi. */
function muqarnasBand(width, n, tiers, cellR, mat){
  const grp = new THREE.Group();
  const geo = muqCellGeo(cellR);
  for(let t = 0; t < tiers; t++){
    const cnt = n - t*2;
    if(cnt < 2) break;
    const step = width/cnt;
    for(let i = 0; i < cnt; i++){
      const cell = new THREE.Mesh(geo, mat);
      cell.position.set(-width/2 + step*(i + 0.5), t*cellR*1.35, -t*cellR*0.9);
      cell.rotation.x = Math.PI;
      grp.add(cell);
    }
  }
  return grp;
}

/* --------------------------------------------------------------- USTUN
   Xiva Juma masjidi uslubidagi o'yma yog'och ustun. Nisbatlari haqiqiyga
   yaqin: tana diametri ~0.28, balandligi ~2.9 → ingichkalik ~10:1. */
function buildUstun(){
  const g = new THREE.Group();
  const R = 0.145, Hs = 2.75;

  /* sakkiz qirrali tosh poya — Xiva ustunlari aynan shunday poyada turadi */
  const poya = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.46, 0.24, 8), archMat('stone'));
  poya.position.y = 0.12; g.add(poya);
  const poya2 = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.38, 0.14, 8), archMat('stone'));
  poya2.position.y = 0.31; g.add(poya2);

  /* kuza — vazasimon o'yma asos */
  const kuza = new THREE.Mesh(
    latheFromProfile([[0.13,0],[0.22,0.05],[0.27,0.13],[0.25,0.22],[0.19,0.31],[0.155,0.40],[0.145,0.46]], 1),
    archMat('wood', 6, 1));
  kuza.position.y = 0.38; g.add(kuza);

  /* tana — entazis bilan; naqsh aylana bo'ylab 4, balandligi bo'ylab 14 */
  const prof = [];
  for(let i = 0; i <= 20; i++){
    const t = i/20;
    prof.push([R*(1 - 0.16*t + 0.055*Math.sin(Math.PI*t)), t*Hs]);
  }
  /* Naqsh zichligi kamaytirildi (4×14 → 3×9): oldingi zichlikda o'yma
     mato naqshidek mayda chiqib, chuqurligi ko'rinmasdi. */
  const tana = new THREE.Mesh(latheFromProfile(prof, 1), archMat('wood', 3, 9));
  tana.position.y = 0.84; g.add(tana);

  /* o'yma bo'g'inlar — halqa + ingichka bronza gardish */
  for(const [y, rr] of [[1.05, 0.150], [2.05, 0.140], [3.05, 0.131]]){
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rr*1.16, rr*1.16, 0.10, 32),
                                archMat('wood', 5, 1, 0x8a4f22));
    band.position.y = y; g.add(band);
    for(const dy of [-0.055, 0.055]){
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr*1.18, 0.012, 8, 40), archMat('metal'));
      ring.rotation.x = Math.PI/2; ring.position.y = y + dy; g.add(ring);
    }
  }

  /* MUQARNAS BOSH — o'yilgan stalaktit kapitel.
     Toqchalar tanadan kengroq bo'lgani uchun ular ostiga silliq o'tish
     (kova) qo'yiladi, aks holda kapitel poyada "osilib" turgandek
     ko'rinadi. */
  const kova = new THREE.Mesh(
    latheFromProfile([[R*0.99,0],[R*1.02,0.05],[R*1.10,0.09],[R*1.20,0.11]], 1),
    archMat('wood', 5, 1, 0x8a4f22));
  kova.position.y = 3.50; g.add(kova);

  const cap = muqarnasCapital(R*1.18, 4, 0.62,
                              archMat('wood', 8, 1, 0x6b3c17),          /* orqa tana — to'q */
                              archMat('wood', 1, 1, 0xc9975a),          /* toqcha A */
                              archMat('wood', 1, 1, 0xb87a3c),          /* toqcha B */
                              archMat('wood', 6, 1, 0x8a4f22));         /* javon/qovurg'a */
  cap.position.y = 3.61; g.add(cap);
  const capTop = cap.position.y + (cap.userData.h || 0.52);
  const rTop = cap.userData.rTop || R*1.9;

  /* yostiq (bracket) va tosh bosh — kapitel kengligiga moslashadi */
  const yostiq = new THREE.Mesh(new THREE.BoxGeometry(rTop*1.85, 0.09, rTop*0.95), archMat('wood', 3, 1));
  yostiq.position.y = capTop + 0.045; g.add(yostiq);
  const yostiq2 = new THREE.Mesh(new THREE.BoxGeometry(rTop*2.15, 0.06, rTop*1.10), archMat('wood', 4, 1, 0x8a4f22));
  yostiq2.position.y = capTop + 0.120; g.add(yostiq2);
  const bosh = new THREE.Mesh(new THREE.BoxGeometry(rTop*2.40, 0.08, rTop*1.24), archMat('stone'));
  bosh.position.y = capTop + 0.190; g.add(bosh);

  g.userData.h = capTop + 0.24;
  return g;
}

/* ------------------------------------------------------------- DARVOZA
   Koshin ramkadagi ikki tabaqali o'yma yog'och darvoza. Tabaqalar
   haqiqiy duradgorlikdagidek: tik tayanchlar (stil), ko'ndalang
   bog'lamalar (rels) va ular orasida botiq panellar. */
function buildDarvoza(){
  const g = new THREE.Group();
  const W = 3.0, H = 4.0, D = 0.34;
  const ow = 1.02, oh = 2.30, apexY = H - 0.30;

  const ap = archOutline(ow, oh, apexY, 40);
  const opening = new THREE.Path();
  opening.moveTo(-ow, 0);
  for(const q of ap) opening.lineTo(q[0], q[1]);
  opening.lineTo(ow, 0);
  opening.closePath();

  const sh = new THREE.Shape();
  sh.moveTo(-W/2, 0); sh.lineTo(W/2, 0); sh.lineTo(W/2, H); sh.lineTo(-W/2, H); sh.closePath();
  sh.holes.push(opening);
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sh, {depth:D, bevelEnabled:false, curveSegments:24}),
    archMat('tile', 1/TU, 1/TU, 0x24518f));
  frame.position.z = -D; g.add(frame);

  /* archivolt */
  const archv = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archBandShape(ow, oh, apexY, 0.16),
                              {depth:0.06, bevelEnabled:false, curveSegments:20}),
    archMat('tile', 1/0.16, 1/0.16, 0xc99b3f));
  archv.position.z = 0.004; g.add(archv);

  /* soffit — ichkarida yorug'lik kam */
  const soffit = new THREE.Mesh(stripFromOutline(ap, D + 0.10),
                                archMat('tile', 1/TU, 1/TU, 0x8d96a4));
  soffit.material.side = THREE.DoubleSide;
  g.add(soffit);

  /* timpan */
  const tsh = new THREE.Shape();
  tsh.moveTo(-ow, oh);
  for(const q of ap) tsh.lineTo(q[0], q[1]);
  tsh.closePath();
  const timpan = new THREE.Mesh(new THREE.ShapeGeometry(tsh, 24),
                                archMat('tile', 1/(TU*0.7), 1/(TU*0.7), 0x7fc7c0));
  timpan.position.z = -0.10; g.add(timpan);

  /* ---- tabaqalar: stil + rels + botiq panel ---- */
  const lw = ow - 0.02, lh = oh, zL = -0.17;
  const stileW = lw*0.13, railH = lh*0.055;
  for(const sgn of [-1, 1]){
    const cxL = sgn*lw/2;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.06),
                                archMat('wood', 1, 3, 0x6f3d1a));   /* botiq fon */
    leaf.position.set(cxL, lh/2, zL - 0.03); g.add(leaf);

    /* tik tayanchlar */
    for(const sx of [-1, 1]){
      const st2 = new THREE.Mesh(new THREE.BoxGeometry(stileW, lh, 0.075),
                                 archMat('wood', 1, 8, 0x8a4f22));
      st2.position.set(cxL + sx*(lw/2 - stileW/2), lh/2, zL + 0.01); g.add(st2);
    }
    /* ko'ndalang bog'lamalar — 4 ta, orasida 3 panel */
    for(let i = 0; i <= 3; i++){
      const y = lh*(0.04 + i*0.31);
      const rl = new THREE.Mesh(new THREE.BoxGeometry(lw, railH, 0.075),
                                archMat('wood', 3, 1, 0x8a4f22));
      rl.position.set(cxL, y, zL + 0.01); g.add(rl);
    }
    /* botiq panellar — nozik naqsh bilan */
    for(let i = 0; i < 3; i++){
      const y = lh*(0.195 + i*0.31);
      const pnl = new THREE.Mesh(new THREE.BoxGeometry(lw - 2*stileW - 0.02, lh*0.24, 0.05),
                                 archMat('wood', 1, 1, 0xc98a45));
      pnl.position.set(cxL, y, zL); g.add(pnl);
      /* panel atrofidagi ingichka gardish */
      const brd = new THREE.Mesh(new THREE.BoxGeometry(lw - 2*stileW + 0.02, lh*0.26, 0.035),
                                 archMat('dark'));
      brd.position.set(cxL, y, zL - 0.012); g.add(brd);
    }
    /* bronza mixlar — tayanch va bog'lamalar bo'ylab */
    const stud = archMat('metal');
    const studGeo = new THREE.SphereGeometry(0.022, 10, 8);
    for(let i = 0; i <= 3; i++){
      for(const sx of [-1, 1]){
        const s2 = new THREE.Mesh(studGeo, stud);
        s2.position.set(cxL + sx*(lw/2 - stileW/2), lh*(0.04 + i*0.31), zL + 0.05);
        g.add(s2);
      }
    }
    /* halqa tutqich + rozetka */
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16), archMat('metal'));
    plate.rotation.x = Math.PI/2; plate.position.set(sgn*0.26, 1.30, zL + 0.05); g.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.018, 10, 30), archMat('metal'));
    ring.position.set(sgn*0.26, 1.22, zL + 0.055); g.add(ring);
  }

  const ostona = new THREE.Mesh(new THREE.BoxGeometry(W + 0.34, 0.14, D + 0.44), archMat('stone'));
  ostona.position.set(0, 0.07, -D/2); g.add(ostona);
  g.userData.h = H;
  return g;
}

/* ------------------------------------------------------------- PESHTOQ
   Registon uslubidagi darvozaxona. */
function buildPeshtoq(){
  const g = new THREE.Group();
  const W = 4.0, H = 5.0, D = 0.42;
  const ow = 1.15, spring = 2.05, apex = 3.95;
  const nicheD = 1.20;
  const band = 0.38;                       /* hoshiya (kitoba) eni */

  const ap = archOutline(ow, spring, apex, 44);
  const opening = new THREE.Path();
  opening.moveTo(-ow, 0);
  for(const q of ap) opening.lineTo(q[0], q[1]);
  opening.lineTo(ow, 0);
  opening.closePath();

  /* 1) asosiy koshin maydoni */
  const iw = W/2 - band, ih = H - band;
  const inner = new THREE.Shape();
  inner.moveTo(-iw, 0); inner.lineTo(iw, 0); inner.lineTo(iw, ih); inner.lineTo(-iw, ih); inner.closePath();
  inner.holes.push(opening);
  const face = new THREE.Mesh(
    new THREE.ExtrudeGeometry(inner, {depth:D, bevelEnabled:false, curveSegments:24}),
    archMat('tile', 1/TU, 1/TU));
  face.position.z = -D; g.add(face);

  /* 2) HOSHIYA (kitoba) — to'q ko'k, bandda aynan bitta plitka yotadi */
  const outer = new THREE.Shape();
  outer.moveTo(-W/2, 0); outer.lineTo(W/2, 0); outer.lineTo(W/2, H); outer.lineTo(-W/2, H); outer.closePath();
  const cut = new THREE.Path();
  cut.moveTo(-iw, 0); cut.lineTo(iw, 0); cut.lineTo(iw, ih); cut.lineTo(-iw, ih); cut.closePath();
  outer.holes.push(cut);
  const hoshiya = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outer, {depth:D + 0.10, bevelEnabled:false}),
    archMat('tile', 1/band, 1/band, 0x24518f));
  hoshiya.position.z = -D; g.add(hoshiya);
  /* hoshiya chetidagi ingichka oq gardish */
  for(const [w2, h2, z2] of [[W, H, -D + D + 0.105]]){
    const eg = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.05, 0.045, 0.05), archMat('stone'));
    eg.position.set(0, h2 + 0.02, z2); g.add(eg);
  }

  /* 3) archivolt */
  const archv = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archBandShape(ow, spring, apex, 0.20),
                              {depth:0.07, bevelEnabled:false, curveSegments:20}),
    archMat('tile', 1/0.20, 1/0.20, 0xc99b3f));
  archv.position.z = 0.005; g.add(archv);

  /* 4) ayvon ichki yuzalari — yorug'lik kam, to'qroq tus */
  const INNER = 0x93a3b8;
  const soffit = new THREE.Mesh(stripFromOutline(ap, nicheD),
                                archMat('tile', 1/TU, 1/TU, INNER));
  soffit.material.side = THREE.DoubleSide;
  soffit.position.z = -D; g.add(soffit);

  for(const sgn of [-1, 1]){
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(nicheD, spring),
                                archMat('tile', nicheD/TU, spring/TU, INNER));
    wall.material.side = THREE.DoubleSide;
    wall.rotation.y = sgn*Math.PI/2;
    wall.position.set(sgn*ow, spring/2, -D - nicheD/2);
    g.add(wall);
  }

  const backSh = new THREE.Shape();
  backSh.moveTo(-ow, 0);
  for(const q of ap) backSh.lineTo(q[0], q[1]);
  backSh.lineTo(ow, 0); backSh.closePath();
  const back = new THREE.Mesh(new THREE.ShapeGeometry(backSh, 24),
                              archMat('tile', 1/TU, 1/TU, 0x74869c));
  back.position.z = -D - nicheD; g.add(back);

  /* 5) ravoq boshi — ichma-ich chekinuvchi qovurg'alar + yelkada muqarnas */
  const ribs = archRibs(ow*0.99, spring, apex, 5, -D - 0.02, -0.19,
                        archMat('tile', 1/0.13, 1/0.13, 0xbf9648),
                        archMat('tile', 1/0.13, 1/0.13, 0x2f639f));
  g.add(ribs);
  /* Yelka muqarnasi ayvon YON DEVORLARIDA — ilgari u ochiq joyni kesib
     o'tuvchi tokchadek ko'rinardi. */
  for(const sgn of [-1, 1]){
    const corb = muqarnasBand(nicheD*0.8, 6, 2, 0.062, archMat('tile', 1, 1, 0xbf9648));
    corb.rotation.y = sgn*Math.PI/2;
    corb.position.set(sgn*(ow - 0.06), spring - 0.06, -D - nicheD/2);
    g.add(corb);
  }

  /* 6) guldasta — burchak yarim minoralari: poya, tana, muqarnas boshi */
  for(const sgn of [-1, 1]){
    const gx = sgn*(W/2 - 0.06), gz = 0.19;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.30, 0.26, 28), archMat('stone'));
    foot.position.set(gx, 0.13, gz); g.add(foot);
    const gd = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, H - 0.55, 32, 1),
                              archMat('tile', 3, Math.round((H - 0.55)/TU), 0x24518f));
    gd.position.set(gx, 0.26 + (H - 0.55)/2, gz); g.add(gd);
    /* Guldasta boshi ham haqiqiy muqarnas: ilgari bu yerda kengayuvchi
       halqalar turardi va minora boshi "etak"dek ko'rinardi. */
    const gcap = muqarnasCapital(0.20, 3, 0.27,
                           archMat('tile', 8, 1, 0x1e4a7d),          /* orqa tana — to'q ko'k */
                           archMat('tile', 1, 1, 0xbf9648),          /* toqcha A — oltin */
                           archMat('tile', 1, 1, 0x2f639f),          /* toqcha B — ko'k */
                           archMat('tile', 6, 1, 0xbf9648));         /* javon */
    gcap.position.set(gx, H - 0.34, gz); g.add(gcap);
    const gr = gcap.userData.rTop || 0.30;
    const gyTop = H - 0.34 + (gcap.userData.h || 0.27);
    /* muqarnas ustidagi gardish — bosh yaxlit ko'rinsin */
    const gring = new THREE.Mesh(new THREE.CylinderGeometry(gr*0.98, gr, 0.06, 32), archMat('stone'));
    gring.position.set(gx, gyTop + 0.03, gz); g.add(gring);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(gr*0.86, gr*0.98, 0.16, 32), archMat('stone'));
    top.position.set(gx, gyTop + 0.14, gz); g.add(top);
  }

  /* 7) yelka medalyonlari */
  for(const sgn of [-1, 1]){
    const med = new THREE.Mesh(new THREE.CircleGeometry(0.24, 40),
                               archMat('tile', 1/0.24, 1/0.24, 0xd8b45a));
    med.position.set(sgn*(iw - 0.38), ih - 0.46, 0.012); g.add(med);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.018, 8, 40), archMat('metal'));
    rim.position.set(sgn*(iw - 0.38), ih - 0.46, 0.012); g.add(rim);
  }

  /* 8) poydevor va gulband */
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.30, D + nicheD + 0.5), archMat('stone'));
  plinth.position.set(0, 0.15, -D - nicheD/2 + 0.1); g.add(plinth);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(W + 0.30, 0.18, D + 0.34), archMat('stone'));
  cornice.position.set(0, H + 0.09, -D + 0.06); g.add(cornice);

  g.userData.h = H + 0.2;
  return g;
}

function buildArch(kind){
  T3.archMats = [];
  const g = kind === 'ustun'   ? buildUstun()
          : kind === 'darvoza' ? buildDarvoza()
          :                      buildPeshtoq();
  /* KAFOLAT: o'raladigan yuzalarda (Cylinder / Lathe / Sphere / Torus) naqsh
     aylana bo'ylab BUTUN son marta takrorlanishi SHART — aks holda buyum
     orqasida ulanish chizig'i chiqadi. Qism qurayotganda bu oson unutiladi
     (guldasta boshidagi halqalarda 8.33 chiqib qolgandi), shuning uchun
     tekshiruv geometriya turi ma'lum bo'lgan yagona joyda — shu yerda —
     markazlashtirilgan. */
  g.traverse(o=>{
    if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; }
    if(!o.isMesh || !o.material || !o.material.userData || !o.material.userData.rep) return;
    if(!/Cylinder|Lathe|Sphere|Torus/.test((o.geometry && o.geometry.type) || '')) return;
    const r = o.material.userData.rep;
    r[0] = Math.max(1, Math.round(r[0]));
  });
  g.position.y = FLOOR_Y;
  return g;
}

/* Lagan — planar UV (medalyon tepadan); piyola/kosa/tuvak — standart UV (friz aylanaga o'raladi, haqiqiy sopolchilikdagidek) */
const PLATE_KINDS = {lagan:1};
const FRIEZE_KINDS = {piyola:1, kosa:1, tuvak:1, stakan:1, shar:1};
function buildGeometry(kind){
  switch(kind){
    case 'panel':  return new THREE.PlaneGeometry(3,3);
    case 'lagan':  return planarUV(latheFromProfile([[0,0],[0.9,0.02],[1.3,0.12],[1.45,0.22],[1.5,0.3]], 1.15));
    case 'piyola': return latheFromProfile([[0,0],[0.35,0.02],[0.5,0.08],[0.62,0.38],[0.72,0.82],[0.74,1.0]], 1.4);
    case 'kosa':   return latheFromProfile([[0,0],[0.5,0.03],[0.95,0.25],[1.15,0.6],[1.2,0.82]], 1.25);
    case 'tuvak':  return latheFromProfile([[0,0],[0.55,0.02],[0.6,0.1],[0.75,0.9],[0.95,1.05]], 1.3);
    case 'stakan': return latheFromProfile([[0,0],[0.42,0.02],[0.5,0.08],[0.56,0.7],[0.6,1.15],[0.62,1.3]], 1.15); /* friz UV — yon aylanaga o'raladi */
    case 'shar':   return new THREE.SphereGeometry(1.35, 64, 48);
    default:       return new THREE.SphereGeometry(1.3, 48, 32);
  }
}
/* --------------------------------------------------------------------------
   3D TILING
   Naqsh yuza bo'ylab CHOK-SUZ va BIR TEKIS taqsimlanishi kerak.
   Ilgari tekstura 1024 px kanvasga atigi 3 katak qilib chizilar va butun
   buyumga BIR MARTA yopishtirilardi — natijada piyolada 2-3 ta ulkan naqsh
   chiqardi (foydalanuvchi ko'rsatgan holat). Endi:
     · tekstura HAQIQIY RAPPORT (makeSeamlessRepeat — chok-suzligi 160
       holatda o'lchangan),
     · takrorlanish soni buyum o'lchamidan hisoblanadi, shuning uchun naqsh
       har buyumda bir xil FIZIK o'lchamda chiqadi,
     · aylanma yuzalarda u bo'yicha son BUTUN bo'ladi — aks holda buyum
       orqasida ulanish chizig'i paydo bo'lardi.
   -------------------------------------------------------------------------- */
const TILE3D = 0.62;        /* naqsh plitkasining dunyo birligidagi o'lchami */
let TILE_AR = 1;            /* oxirgi rapportning bo'y/en nisbati */

/* Yuzaning v yo'nalishi bo'ylab HAQIQIY uzunligi.
   Lathe va sferada v profil (meridian) bo'ylab boradi va bu uzunlik bbox
   balandligidan sezilarli katta bo'ladi: piyolada profil 2.06, balandlik esa
   atigi 1.4. Bbox dan hisoblansa naqsh vertikal bo'yicha ~60% cho'zilib
   ketadi — buyumda aynan shu ko'rinardi. Shuning uchun uzunlik geometriyaning
   O'ZIDAN o'lchanadi: u≈0 ustunidagi nuqtalar v bo'yicha tartiblanib,
   ketma-ket masofalar yig'iladi. */
function vSpanOf(geo){
  const pos = geo.attributes && geo.attributes.position;
  const uv  = geo.attributes && geo.attributes.uv;
  if(!pos || !uv) return null;
  const col = [];
  for(let i = 0; i < uv.count; i++){
    if(uv.getX(i) < 0.02) col.push([uv.getY(i), pos.getX(i), pos.getY(i), pos.getZ(i)]);
  }
  if(col.length < 3) return null;
  col.sort((a, b)=> a[0] - b[0]);
  let L = 0;
  for(let i = 1; i < col.length; i++)
    L += Math.hypot(col[i][1]-col[i-1][1], col[i][2]-col[i-1][2], col[i][3]-col[i-1][3]);
  return L > 1e-4 ? L : null;
}

function tileRepeatFor(kind, geo){
  if(!geo) return [1, 1];
  if(!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
  const vTile = TILE3D*(TILE_AR || 1);          /* naqsh cho'zilmasligi uchun */
  const iv = v => Math.max(1, Math.round(v));
  if(kind === 'panel')  return [iv(sx/TILE3D), iv(sy/vTile)];
  if(kind === 'lagan')  return [iv(sx/TILE3D), iv(sz/vTile)];
  /* aylanma yuzalar: u — aylana bo'ylab (BUTUN son SHART, aks holda buyum
     orqasida ulanish chizig'i chiqadi), v — profil uzunligi bo'ylab */
  const R = Math.max(sx, sz)/2;
  const vLen = vSpanOf(geo) || sy;
  return [Math.max(3, Math.round(TAU*R/TILE3D)), iv(vLen/vTile)];
}

function makePatternTexture(){
  const S = 1024;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = S;
  const octx = cnv.getContext('2d');
  if(!octx) return cnv;
  const pal = PAL[P.pal] || PAL.gold;
  P._bg = pal.bg;
  octx.fillStyle = pal.bg;
  octx.fillRect(0,0,S,S);
  const kind = T3 ? T3.kind : 'lagan';
  if(T3D.tess){
    let rep = null;
    try{ rep = makeSeamlessRepeat(320, T3D.group || 'p4', {}); }catch(e){ console.warn('[3d] rapport', e); }
    if(rep && rep.canvas && rep.w > 4 && rep.h > 4){
      TILE_AR = rep.h/rep.w;
      cnv.width = rep.w; cnv.height = rep.h;
      const c2 = cnv.getContext('2d');
      c2.drawImage(rep.canvas, 0, 0);
      /* Rasm (foto) bu rejimda qo'shilmaydi: tekstura ko'p marta
         takrorlangani uchun rasm ham takrorlanib ketardi. */
      return cnv;
    }
    /* zaxira yo'l — rapport chiqmasa eski usul */
    TILE_AR = 1;
    const keepG = TESS.group, keepC = TESS.cell, keepB = TESS.showCell;
    TESS.group = T3D.group;
    TESS.cell = Math.round(S/3);
    TESS.showCell = false;
    drawTessellation(octx, S, S, P);
    TESS.group = keepG; TESS.cell = keepC; TESS.showCell = keepB;
  } else if(TESS.on){
    drawTessellation(octx, S, S, P);
  } else if(FRIEZE_KINDS[kind]){
    /* FRIZ: gorizontal bandlar — buyum aylanasiga chok-suz o'raladi
       (haqiqiy piyola/kosa banddagi naqsh bilan bezaladi) */
    drawFriezeComposition(octx, S, P);
  } else if(PLATE_KINDS[kind]){
    /* CHINNI KOMPOZITSIYASI: hoshiya bandlari + markaziy medalyon */
    drawPlateComposition(octx, S, P);
  } else {
    drawPattern(octx, S/2, S/2, S*0.46, P);
  }
  compositePhoto(octx, S);
  return cnv;
}
function photoShapePath(octx, cx, cy, r){
  octx.beginPath();
  if(PH.shape==='doira'){
    circle(octx, cx, cy, r);
  } else if(PH.shape==='sakkiz'){
    const pts=[]; for(let i=0;i<8;i++) pts.push([cx+Math.cos(Math.PI/8+TAU*i/8)*r, cy+Math.sin(Math.PI/8+TAU*i/8)*r]);
    polyPath(octx, pts);
  } else {
    polyPath(octx, [[cx-r,cy-r],[cx+r,cy-r],[cx+r,cy+r],[cx-r,cy+r]]);
  }
}
/* FOTO COMPOSITING: rasm markazda, naqsh — ramka */
function compositePhoto(octx, S){
  if(!PH.img) return;
  const cx = S/2, cy = S/2;
  const r = S*PH.size/200;
  octx.save();
  photoShapePath(octx, cx, cy, r);
  octx.clip();
  const iw = PH.img.naturalWidth || PH.img.width || 1;
  const ih = PH.img.naturalHeight || PH.img.height || 1;
  const box = r*2;
  const sc = Math.max(box/iw, box/ih);
  const dw = iw*sc, dh = ih*sc;
  octx.drawImage(PH.img, cx-dw/2, cy-dh/2, dw, dh);
  octx.restore();
  const pal = PAL[P.pal] || PAL.gold;
  octx.save();
  /* tashqi bezakli ramka: qalin band + mini yulduzlar */
  photoShapePath(octx, cx, cy, r + PH.frame*0.6);
  octx.strokeStyle = pal.c[0];
  octx.lineWidth = PH.frame;
  octx.lineJoin = 'round';
  octx.stroke();
  photoShapePath(octx, cx, cy, r + PH.frame*1.1);
  octx.strokeStyle = pal.c[1];
  octx.lineWidth = Math.max(1.5, PH.frame*0.3);
  octx.stroke();
  photoShapePath(octx, cx, cy, r - PH.frame*0.12);
  octx.strokeStyle = '#ffffff';
  octx.lineWidth = Math.max(1.5, PH.frame*0.22);
  octx.stroke();
  if(PH.shape==='doira'){
    const m = 16;
    for(let i=0;i<m;i++){
      const a = TAU*i/m;
      const q = [cx+Math.cos(a)*(r+PH.frame*0.6), cy+Math.sin(a)*(r+PH.frame*0.6)];
      octx.beginPath(); circle(octx, q[0], q[1], Math.max(1.6, PH.frame*0.16));
      octx.fillStyle = pal.c[4];
      octx.fill();
    }
  }
  octx.restore();
  /* SUVENIR MATNI: rasm tagida SIMMETRIK — doira ramkada yoy bo'ylab */
  const txt = (PH.text||'').trim(), dt = (PH.date||'').trim();
  if(txt || dt){
    octx.save();
    octx.translate(cx, cy);
    const fp = Math.max(22, S*0.05);
    if(txt){
      if(PH.shape==='doira'){
        arcText(octx, txt.toUpperCase(), r + PH.frame*1.3 + fp*0.72, fp, pal.c[0], '#ffffff');
      } else {
        octx.font = '700 '+fp+'px Georgia, "Times New Roman", serif';
        octx.textAlign = 'center'; octx.textBaseline = 'middle';
        const ty = r + PH.frame*1.3 + fp*0.75;
        octx.lineWidth = fp*0.2; octx.strokeStyle = '#ffffff'; octx.lineJoin='round';
        octx.strokeText(txt.toUpperCase(), 0, ty);
        octx.fillStyle = pal.c[0];
        octx.fillText(txt.toUpperCase(), 0, ty);
      }
    }
    if(dt){
      const fp2 = fp*0.66;
      octx.font = 'italic 600 '+fp2+'px Georgia, serif';
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      const ty2 = r + PH.frame*1.3 + (txt ? fp*1.75 : fp*0.75);
      octx.lineWidth = fp2*0.22; octx.strokeStyle = '#ffffff'; octx.lineJoin='round';
      octx.strokeText(dt, 0, ty2);
      octx.fillStyle = pal.c[2];
      octx.fillText(dt, 0, ty2);
      /* ikki yon bezak nuqta */
      const dw = octx.measureText(dt).width;
      dot(octx, -dw/2 - fp2*0.7, ty2, fp2*0.14, pal.c[1]);
      dot(octx,  dw/2 + fp2*0.7, ty2, fp2*0.14, pal.c[1]);
    }
    octx.restore();
  }
}
/* Yoy bo'ylab matn — pastki yoyda, chapdan o'ngga, tik holatda */
function arcText(ctx, text, r, fontPx, fillC, strokeC){
  ctx.save();
  ctx.font = '700 '+fontPx+'px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = text.split('');
  const widths = chars.map(ch => ctx.measureText(ch).width * 1.08);
  const total = widths.reduce((a,b)=>a+b, 0);
  let a = Math.PI/2 + (total/2)/r;   /* chapdan (katta burchak) boshlab */
  for(let i=0;i<chars.length;i++){
    a -= widths[i]/2/r;
    ctx.save();
    ctx.translate(Math.cos(a)*r, Math.sin(a)*r);
    ctx.rotate(a - Math.PI/2);       /* harf tepasi markazga qaraydi — tik o'qiladi */
    ctx.lineWidth = fontPx*0.2; ctx.strokeStyle = strokeC; ctx.lineJoin='round';
    ctx.strokeText(chars[i], 0, 0);
    ctx.fillStyle = fillC;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    a -= widths[i]/2/r;
  }
  ctx.restore();
}
/* Me'moriy yuzalar uchun CHOK-SUZ plitka.
   Oddiy buyumlarda tekstura buyumga moslab chiziladi (medalyon, friz), me'moriy
   yuzada esa naqsh yuza bo'ylab KO'P MARTA takrorlanadi — shuning uchun u
   haqiqiy rapport bo'lishi shart, aks holda har takrorlanishda chok chizig'i
   ko'rinadi. Shu bois bu yerda eksportdagi bir xil makeSeamlessRepeat()
   ishlatiladi: uning chok-suzligi 160 holatda o'lchab tekshirilgan. */
function makeArchTileCanvas(){
  try{
    const t = makeSeamlessRepeat(256, T3D.group || 'p4', {});
    if(t && t.canvas) return t.canvas;
  }catch(e){ console.warn('[3d] rapport', e); }
  return makePatternTexture();
}
/* ---------------------------------------------------------------------------
   O'YMA EFFEKTI — NAQSHDAN NORMAL XARITA
   ---------------------------------------------------------------------------
   Ilgari naqsh ob'yektga faqat RANG (map + emissiveMap) sifatida qo'yilardi.
   Shuning uchun ustun "bo'yalgan" ko'rinardi: yorug'lik naqsh chizig'ida
   sinmaydi, soya tushmaydi — o'yma sezilmaydi.
   Bu yerda naqsh tasviridan balandlik xaritasi olinadi (yorqinlik: och joy
   — ko'tarilgan yuza, to'q joy — o'yilgan chuqurcha), so'ng Sobel bilan
   sirt normali hisoblanadi. Natijada yorug'lik har chiziq qirrasida
   sinadi va yuza haqiqatan o'yilgandek ko'rinadi.
   Balandlik oldindan biroz xiralashtiriladi: aks holda bir piksellik
   chiziqlar o'tkir "tunuka" qirra beradi, o'yma esa yumshoq qirrali. */
function makeNormalCanvas(src, strength){
  const W = src.width, H = src.height;
  const sc = document.createElement('canvas');
  sc.width = W; sc.height = H;
  const sx = sc.getContext('2d');
  if(!sx) return null;
  sx.drawImage(src, 0, 0);
  let d;
  try{ d = sx.getImageData(0, 0, W, H).data; }catch(e){ return null; }
  /* yorqinlik → balandlik */
  const h = new Float32Array(W*H);
  for(let i = 0, n = W*H; i < n; i++){
    const o = i*4;
    h[i] = (0.299*d[o] + 0.587*d[o+1] + 0.114*d[o+2])/255;
  }
  /* 3×3 silliqlash — chekkalar takrorlanuvchi (rapport uzilmasin) */
  const hb = new Float32Array(W*H);
  const at = (x, y)=> h[((y % H) + H) % H * W + (((x % W) + W) % W)];
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    hb[y*W+x] = (at(x-1,y-1) + 2*at(x,y-1) + at(x+1,y-1) +
                 2*at(x-1,y)  + 4*at(x,y)   + 2*at(x+1,y) +
                 at(x-1,y+1) + 2*at(x,y+1) + at(x+1,y+1))/16;
  }
  const bt = (x, y)=> hb[((y % H) + H) % H * W + (((x % W) + W) % W)];
  const out = sx.createImageData(W, H);
  const od = out.data;
  const k = (strength === undefined ? 2.6 : strength);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    /* Sobel */
    const gx = (bt(x+1,y-1) + 2*bt(x+1,y) + bt(x+1,y+1)) -
               (bt(x-1,y-1) + 2*bt(x-1,y) + bt(x-1,y+1));
    const gy = (bt(x-1,y+1) + 2*bt(x,y+1) + bt(x+1,y+1)) -
               (bt(x-1,y-1) + 2*bt(x,y-1) + bt(x+1,y-1));
    let nx = -gx*k, ny = -gy*k, nz = 1;
    const l = Math.sqrt(nx*nx + ny*ny + 1) || 1;
    nx /= l; ny /= l; nz /= l;
    const o = (y*W + x)*4;
    od[o]   = (nx*0.5 + 0.5)*255;
    od[o+1] = (ny*0.5 + 0.5)*255;
    od[o+2] = (nz*0.5 + 0.5)*255;
    od[o+3] = 255;
  }
  sx.putImageData(out, 0, 0);
  return sc;
}
/* O'yilgan joy yaltiramaydi — chuqurchada chang va g'adir-budurlik ko'p.
   Balandlik xaritasidan g'adirlik xaritasi: och (ko'tarilgan) joy
   silliqroq, to'q (o'yilgan) joy g'adirroq. */
function makeRoughCanvas(src, lo, hi){
  const W = src.width, H = src.height;
  const sc = document.createElement('canvas');
  sc.width = W; sc.height = H;
  const sx = sc.getContext('2d');
  if(!sx) return null;
  sx.drawImage(src, 0, 0);
  let img;
  try{ img = sx.getImageData(0, 0, W, H); }catch(e){ return null; }
  const d = img.data;
  const a = (lo === undefined ? 0.34 : lo), b = (hi === undefined ? 0.86 : hi);
  for(let i = 0, n = W*H; i < n; i++){
    const o = i*4;
    const v = (0.299*d[o] + 0.587*d[o+1] + 0.114*d[o+2])/255;
    const r = Math.round((b + (a - b)*v)*255);   /* och → a, to'q → b */
    d[o] = d[o+1] = d[o+2] = r; d[o+3] = 255;
  }
  sx.putImageData(img, 0, 0);
  return sc;
}
function update3DTexture(){
  if(!threeReady || !T3 || !T3.mat) return;
  const tex = new THREE.CanvasTexture(makePatternTexture());
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if(THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  /* Tiling yoqilganda naqsh buyum o'lchamiga qarab ko'p marta takrorlanadi
     (tileRepeatFor izohiga qarang). Yakka naqsh rejimida — bir marta. */
  if(T3D.tess && T3.mesh && T3.mesh.geometry && !ARCH_KINDS[T3.kind]){
    const r = tileRepeatFor(T3.kind, T3.mesh.geometry);
    tex.repeat.set(r[0], r[1]);
    T3._rep = r;
  } else {
    tex.repeat.set(1, 1);
    T3._rep = [1, 1];
  }
  const old = T3.mat.map;
  for(const m of (T3.mats || [T3.mat])){
    m.map = tex;
    if(m.emissive) m.emissiveMap = tex; /* glazur: soyada ham naqsh o'qiladi */
    m.needsUpdate = true;
  }
  if(old && old.dispose) old.dispose();

  /* me'moriy qismlar: bitta rapport kanvasi, lekin har qism o'z zichligi
     bilan — repeat teksturaga tegishli bo'lgani uchun har material o'z
     nusxasini oladi (rasm xotirada baham ko'riladi) */
  const arch = T3.archMats || [];
  if(!arch.length) return;
  const cnv = makeArchTileCanvas();
  const base = new THREE.CanvasTexture(cnv);
  base.wrapS = base.wrapT = THREE.RepeatWrapping;
  base.anisotropy = 8;
  if(THREE.sRGBEncoding !== undefined) base.encoding = THREE.sRGBEncoding;
  /* O'YMA: naqshdan normal va g'adirlik xaritalari. Bitta marta
     hisoblanadi va hamma me'moriy material baham ko'radi (faqat
     repeat har materialda o'ziniki, shuning uchun nusxa olinadi). */
  const nCnv = makeNormalCanvas(cnv, 2.6);
  const rCnv = makeRoughCanvas(cnv, 0.34, 0.88);
  const nBase = nCnv ? new THREE.CanvasTexture(nCnv) : null;
  const rBase = rCnv ? new THREE.CanvasTexture(rCnv) : null;
  for(const t of [nBase, rBase]) if(t){
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;   /* normal/rough — chiziqli fazo, encoding qo'yilmaydi */
  }
  for(const m of arch){
    const rep = m.userData.rep || [1, 1];
    const t2 = base.clone();
    t2.needsUpdate = true;
    t2.wrapS = t2.wrapT = THREE.RepeatWrapping;
    t2.repeat.set(rep[0], rep[1]);
    const prev = m.map, prevN = m.normalMap, prevR = m.roughnessMap;
    m.map = t2;
    if(m.emissive) m.emissiveMap = t2;
    if(nBase){
      const tn = nBase.clone();
      tn.needsUpdate = true;
      tn.wrapS = tn.wrapT = THREE.RepeatWrapping;
      tn.repeat.set(rep[0], rep[1]);
      m.normalMap = tn;
      /* o'yma chuqurligi — yog'ochda chuqurroq, koshinda yuzaroq */
      const dp = m.userData.carve === undefined ? 1 : m.userData.carve;
      m.normalScale = new THREE.Vector2(dp, dp);
    }
    if(rBase){
      const tr = rBase.clone();
      tr.needsUpdate = true;
      tr.wrapS = tr.wrapT = THREE.RepeatWrapping;
      tr.repeat.set(rep[0], rep[1]);
      m.roughnessMap = tr;
    }
    m.needsUpdate = true;
    for(const q of [prev, prevN, prevR]) if(q && q.dispose) q.dispose();
  }
}
const PAINT = { raf:0, active:false };
/* NAQSH BUYUMDA JONLI CHIZILADI: tekstura progressiv ochiladi, buyum sekin aylanadi */
function animatePaint3D(){
  if(!threeReady || !T3){ ntf('Avval 3D sahifasini oching', 'err'); return; }
  if(typeof cancelAnimationFrame === 'function') cancelAnimationFrame(PAINT.raf);
  const full = makePatternTexture();
  /* rapport kvadrat bo'lmasligi mumkin (p6/p6m) — ikkala o'lchamni olamiz */
  const S = full.width || 1024, SH = full.height || S;
  const cnv = document.createElement('canvas');
  cnv.width = S; cnv.height = SH;
  const ctx = cnv.getContext('2d');
  if(!ctx) return;
  const tex = new THREE.CanvasTexture(cnv);
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if(T3._rep) tex.repeat.set(T3._rep[0], T3._rep[1]);
  if(THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  const old = T3.mat.map;
  for(const m of (T3.mats || [T3.mat])){
    m.map = tex;
    if(m.emissive) m.emissiveMap = tex;
    m.needsUpdate = true;
  }
  if(old && old.dispose) old.dispose();
  const pal = PAL[P.pal] || PAL.gold;
  const frieze = !!FRIEZE_KINDS[T3.kind];
  const nowFn = ()=> (window.performance ? performance.now() : Date.now());
  const t0 = nowFn(), dur = 2600;
  PAINT.active = true;
  const step = ()=>{
    const t = Math.min(1, (nowFn()-t0)/dur);
    const e = 1 - Math.pow(1-t, 2.1);
    ctx.clearRect(0,0,S,SH);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0,0,S,SH);
    ctx.save();
    let a1 = 0;
    if(frieze){
      ctx.beginPath(); ctx.rect(0,0,S*e,SH); ctx.clip();
    } else {
      a1 = -Math.PI/2 + e*TAU;
      ctx.beginPath();
      ctx.moveTo(S/2,SH/2);
      ctx.arc(S/2,SH/2, Math.max(S,SH)*0.72*Math.min(1, 0.3+e), -Math.PI/2, a1);
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(full,0,0);
    ctx.restore();
    if(t < 1){
      ctx.save();
      ctx.shadowColor = 'rgba(224,189,106,.95)';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#e0bd6a';
      let bx, by;
      if(frieze){ bx = S*e; by = SH*0.5; }
      else { const br = Math.max(S,SH)*0.35; bx = S/2 + Math.cos(a1)*br; by = SH/2 + Math.sin(a1)*br; }
      ctx.beginPath(); ctx.arc(bx,by,11,0,TAU); ctx.fill();
      ctx.restore();
    }
    tex.needsUpdate = true;
    if(T3.group) T3.group.rotation.y += 0.006; /* chizish davomida ohista aylanish */
    if(t < 1){
      PAINT.raf = requestAnimationFrame(step);
    } else {
      PAINT.active = false;
      ctx.clearRect(0,0,S,SH);
      ctx.drawImage(full,0,0);
      tex.needsUpdate = true;
      ntf('Naqsh buyumga tushirildi 🖌', 'ok');
    }
  };
  step();
}
function setLights(preset){
  if(!T3) return;
  const cfg = {
    warm:  {amb:0x9c8867, ai:0.5, hemi:0.75, key:0xffe2b8, ki:1.25, fill:0xffc890, fi:0.45, bg:0xf0e9da},
    cold:  {amb:0x66788c, ai:0.5, hemi:0.7,  key:0xd6ecff, ki:1.2,  fill:0x9dbdd8, fi:0.45, bg:0xe8eef2},
    studio:{amb:0xffffff, ai:0.45,hemi:0.65, key:0xffffff, ki:1.3,  fill:0xffffff, fi:0.55, bg:0xf3f3ef},
    dark:  {amb:0x24301f, ai:0.2, hemi:0.15, key:0xd8e0c0, ki:0.7,  fill:0x445533, fi:0.2,  bg:0x181e18}
  }[preset] || {amb:0xffffff, ai:0.45, hemi:0.6, key:0xffffff, ki:1.25, fill:0xffffff, fi:0.5, bg:0xf3f3ef};
  T3.amb.color.setHex(cfg.amb);   T3.amb.intensity = cfg.ai;
  T3.hemi.intensity = cfg.hemi;
  T3.key.color.setHex(cfg.key);   T3.key.intensity = cfg.ki;
  T3.fill.color.setHex(cfg.fill); T3.fill.intensity = cfg.fi;
  T3.scene.background = new THREE.Color(cfg.bg);
  if(T3.scene.fog) T3.scene.fog.color.setHex(cfg.bg);
}
function disposeObject3D(obj){
  if(!obj) return;
  if(obj.traverse){
    obj.traverse(o=>{ if(o.isMesh && o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  } else if(obj.geometry && obj.geometry.dispose){
    obj.geometry.dispose();
  }
}
/* Har buyum uchun kamera kadri: me'moriy ob'yektlar baland, shuning uchun
   kamera uzoqroqqa suriladi va nigoh markazi yuqoriroqqa ko'tariladi —
   aks holda ustun yoki peshtoq kadrga sig'maydi. */
/* look — nigoh markazi, eye — kamera balandligi, d — masofa.
   Balandlikning yarmiga qaraymiz va shu balandlikdan bir oz yuqoridan
   turamiz: aks holda kamera tikka pastga qaraydi va bino "yiqilib"
   ko'rinadi. d ≈ balandlik×1.7 — 42° ko'rish burchagida to'liq sig'adi. */
const CAM_FRAME = {
  ustun:   {look: FLOOR_Y + 2.20, eye: FLOOR_Y + 2.55, d: 7.4},
  darvoza: {look: FLOOR_Y + 2.00, eye: FLOOR_Y + 2.30, d: 7.0},
  peshtoq: {look: FLOOR_Y + 2.55, eye: FLOOR_Y + 2.90, d: 9.0}
};
function setObject(kind){
  if(!T3) return;
  if(T3.mesh){
    T3.group.remove(T3.mesh);
    disposeObject3D(T3.mesh);
  }
  T3.kind = kind;
  const cf = CAM_FRAME[kind] || {look:0, eye:1.9, d:4.9};
  T3.camLook = cf.look; T3.camEye = cf.eye; T3.camDist = cf.d;
  T3.camera.position.z = cf.d;
  /* marmar poydevor faqat idishlar uchun — me'moriy ob'yekt polda turadi */
  if(T3.ped) T3.ped.visible = !ARCH_KINDS[kind];
  const obj = ARCH_KINDS[kind] ? buildArch(kind)
                               : new THREE.Mesh(buildGeometry(kind), T3.mat);
  if(!ARCH_KINDS[kind]) T3.archMats = [];
  if(kind==='lagan') obj.rotation.x = 0.5;   /* lagan yuzi tomoshabinga qaragan */
  if(kind==='panel') obj.rotation.x = 0;
  /* Me'moriy ob'yektlar O'ZIGA soya tashlaydi: muqarnas yaruslari,
     ravoq bandlari va o'yma toqchalar chuqurligi aynan shu ichki
     soyadan o'qiladi. Ilgari bu yerda receiveShadow hammaga false
     qilinardi va buildArch qo'ygan qiymatni bekor qilardi — natijada
     kapitel yassi, "bo'yalgan" ko'rinardi.
     Yakka buyumlarda (lagan, ko'za) ichki soya kerak emas — ular yaxlit
     yuza, o'ziga soya tushirsa faqat shovqin chiqadi. */
  const selfShadow = !!ARCH_KINDS[kind];
  obj.traverse ? obj.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.receiveShadow = selfShadow; } })
               : (obj.castShadow = true);
  T3.mesh = obj;
  obj.scale.setScalar(0.01);
  T3.intro = { t:0 };  /* kirish springi — buyum "tug'iladi" */
  T3.group.add(obj);
  update3DTexture(); /* obyektga mos kompozitsiya (chinni/panel) */
}
function init3D(){
  if(threeReady) return; /* renderer faqat bir marta yaratiladi */
  const wrap = $('three-wrap');
  if(!wrap) return;
  if(typeof THREE === 'undefined'){
    ntf("Three.js yuklanmadi — internet aloqasini tekshiring", 'err');
    return;
  }
  const W = wrap.clientWidth || 800, H = wrap.clientHeight || 500;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 100);
  camera.position.set(0, 1.9, 4.9);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  if(THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding; /* to'g'ri rang */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrap.insertBefore(renderer.domElement, wrap.firstChild);
  /* yorug'lik tizimi: hemisfera + kalit (soyali) + to'ldiruvchi */
  const amb = new THREE.AmbientLight(0xffffff, 0.45);
  const hemi = new THREE.HemisphereLight(0xfff6e6, 0x8a7a5c, 0.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  /* Soya xaritasi 2048: 1024 da 8×8 maydonga 128 teksel/birlik tushardi,
     ya'ni bitta muqarnas katagiga ~19 teksel — o'yma ichidagi soya
     "pog'ona-pog'ona" chiqib, chuqurlik o'rniga shovqin berardi.
     bias/normalBias — egri yuzalarda o'z-o'ziga soya tushirish
     artefaktini (shadow acne) yo'qotadi. */
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 1; key.shadow.camera.far = 15;
  key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0005;
  if(key.shadow.normalBias !== undefined) key.shadow.normalBias = 0.015;
  const fillL = new THREE.DirectionalLight(0xffffff, 0.5);
  fillL.position.set(-4, 1.5, -3);
  scene.add(amb, hemi, key, fillL);
  /* ═══ HOVLI MUHITI: naqshli tosh pol + marmar poydevor + tuman ═══ */
  const floorCnv = document.createElement('canvas');
  floorCnv.width = floorCnv.height = 512;
  const fctx = floorCnv.getContext('2d');
  if(fctx){
    fctx.fillStyle = '#e7dfcb';
    fctx.fillRect(0,0,512,512);
    /* och rangdagi Hankin girih poli (3-rasm uslubida) */
    fctx.save();
    fctx.translate(256,256);
    fctx.globalAlpha = 0.5;
    try{
      const fp = {...P, type:'hankin8', pal:'earth', sw:1.6, dens:0.6, spir:0.45, lay:1, rot:0, skew:0};
      const keepBg = P._bg; P._bg = '#e7dfcb';
      drawHankin8(fctx, 300, fp, 1.6, '#b9a377', '#cdbb92', '#a8946a', '#efe7d2');
      P._bg = keepBg;
    }catch(e){}
    fctx.restore();
  }
  const floorTex = new THREE.CanvasTexture(floorCnv);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3,3);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({map:floorTex, roughness:0.92, metalness:0})
  );
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -1.66;
  ground.receiveShadow = true;
  scene.add(ground);
  /* oq marmar 8 qirrali poydevor (Xazrati Imom ustun poydevorlari uslubida) */
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.45, 0.5, 8),
    new THREE.MeshStandardMaterial({color:0xf2eee4, roughness:0.45, metalness:0.02})
  );
  ped.position.y = -1.41;
  ped.castShadow = true;
  ped.receiveShadow = true;
  scene.add(ped);
  scene.fog = new THREE.Fog(0xf0e9da, 9, 20);
  const group = new THREE.Group();
  scene.add(group);
  /* havoda suzuvchi oltin gard zarralari — sahna "nafas oladi" */
  const DUST_N = 130;
  const dPos = new Float32Array(DUST_N*3);
  const dSpd = new Float32Array(DUST_N);
  for(let i=0;i<DUST_N;i++){
    dPos[i*3]   = (Math.random()-0.5)*7;
    dPos[i*3+1] = -1.6 + Math.random()*4.2;
    dPos[i*3+2] = (Math.random()-0.5)*7;
    dSpd[i] = 0.0018 + Math.random()*0.0045;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    color:0xe0bd6a, size:0.05, transparent:true, opacity:0.55,
    depthWrite:false, sizeAttenuation:true
  }));
  scene.add(dust);
  /* SIRLANGAN CHINNI materiali (glazur) */
  const MatClass = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  const mat = new MatClass({side:THREE.DoubleSide, roughness:0.26, metalness:0.03});
  if(mat.clearcoat !== undefined){ mat.clearcoat = 0.7; mat.clearcoatRoughness = 0.22; }
  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveIntensity = 0.22; /* sopol o'z rangida "nafas oladi" — qoraymaydi */
  /* o'yma yog'och: naqsh teksturasi jigarrang tus bilan (ustun/peshtoq uchun) */
  const matWood = new MatClass({side:THREE.DoubleSide, roughness:0.55, metalness:0.02, color:0xb06a2f});
  if(matWood.clearcoat !== undefined){ matWood.clearcoat = 0.3; matWood.clearcoatRoughness = 0.4; }
  matWood.emissive = new THREE.Color(0xb06a2f);
  matWood.emissiveIntensity = 0.12;
  const matStone = new THREE.MeshStandardMaterial({color:0xf1ede2, roughness:0.5, metalness:0.02});
  const matDark = new THREE.MeshStandardMaterial({color:0x151009, roughness:1});
  T3 = {scene, camera, renderer, group, mesh:null, mat, matWood, matStone, matDark, mats:[mat, matWood], archMats:[], amb, hemi, key, fill:fillL, auto:false, kind:'lagan', dust:{pts:dust,pos:dPos,spd:dSpd,n:DUST_N}, parX:0, parY:0, intro:null, ped, camLook:0, camEye:1.9, camDist:4.9};
  threeReady = true;
  const objSel = $('sel-obj');
  setObject(objSel ? objSel.value : 'lagan');
  const lightSel = $('sel-light');
  setLights(lightSel ? lightSel.value : 'warm');
  /* boshqaruv: drag = aylantirish, g'ildirak = zoom */
  let dragging = false, lx = 0, ly = 0;
  const dom = renderer.domElement;
  dom.style.touchAction = 'none';
  dom.addEventListener('pointerdown', e=>{ dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture && dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', e=>{
    /* yumshoq parallaks — kamera kursorga ergashadi */
    const rct = dom.getBoundingClientRect ? dom.getBoundingClientRect() : {left:0,top:0,width:800,height:500};
    T3.parX = ((e.clientX - rct.left)/Math.max(1,rct.width) - 0.5)*0.8;
    T3.parY = -((e.clientY - rct.top)/Math.max(1,rct.height) - 0.5)*0.45;
    if(!dragging) return;
    group.rotation.y += (e.clientX - lx)*0.01;
    group.rotation.x += (e.clientY - ly)*0.008;
    group.rotation.x = Math.max(-1.4, Math.min(1.4, group.rotation.x));
    lx = e.clientX; ly = e.clientY;
  });
  dom.addEventListener('pointerup', ()=>{ dragging = false; });
  dom.addEventListener('pointercancel', ()=>{ dragging = false; });
  dom.addEventListener('wheel', e=>{
    e.preventDefault();
    camera.position.z = Math.max(2, Math.min(12, camera.position.z + e.deltaY*0.004));
  }, {passive:false});
  const animate = ()=>{
    requestAnimationFrame(animate);
    const page = $('page-3d');
    if(!page || !page.classList.contains('active')) return;
    const tNow = (window.performance ? performance.now() : Date.now())*0.001;
    if(T3.auto) group.rotation.y += 0.007;
    /* buyum havoda ohista suzadi */
    if(!dragging) group.position.y = Math.sin(tNow*0.9)*0.045;
    /* kirish springi — easeOutBack */
    if(T3.intro && T3.mesh){
      T3.intro.t = Math.min(1, T3.intro.t + 0.04);
      const k = T3.intro.t;
      const c1 = 1.70158, c3 = c1 + 1;
      const sc = 1 + c3*Math.pow(k-1,3) + c1*Math.pow(k-1,2);
      T3.mesh.scale.setScalar(Math.max(0.01, sc));
      if(k >= 1) T3.intro = null;
    }
    /* oltin gard — yuqoriga suzadi */
    if(T3.dust){
      const p = T3.dust.pos;
      for(let i=0;i<T3.dust.n;i++){
        p[i*3+1] += T3.dust.spd[i];
        p[i*3] += Math.sin(tNow + i)*0.0006;
        if(p[i*3+1] > 2.8) p[i*3+1] = -1.6;
      }
      T3.dust.pts.geometry.attributes.position.needsUpdate = true;
    }
    /* parallaks kamera */
    camera.position.x += (T3.parX - camera.position.x)*0.05;
    const eyeY = (T3.camEye === undefined ? 1.9 : T3.camEye);
    camera.position.y += (eyeY + T3.parY - camera.position.y)*0.05;
    camera.lookAt(0, T3.camLook || 0, 0);
    renderer.render(scene, camera);
  };
  animate();
  window.addEventListener('resize', ()=>{
    const w2 = wrap.clientWidth||800, h2 = wrap.clientHeight||500;
    camera.aspect = w2/h2;
    camera.updateProjectionMatrix();
    renderer.setSize(w2, h2);
  });
}
function screenshot3D(){
  if(!threeReady || !T3){ ntf('Avval 3D sahifasini oching', 'err'); return; }
  try{
    T3.renderer.render(T3.scene, T3.camera);
    const url = T3.renderer.domElement.toDataURL('image/png');
    _dlBlob(_dataURLtoBlob(url), 'image/png', 'naqsh_3d_'+P.type+'.png', '3D surat saqlandi 📸');
  }catch(e){
    ntf('Surat olishda xato: '+e.message, 'err');
  }
}

/* ============================================================
   AR PROYEKSIYA
   ============================================================ */
let arStream = null, arActive = false, arNeedsRedraw = true;
let arPatCanvas = null;
const AR = { surface:'devor', op:0.82, size:0.55, rot:0, x:0, y:0, simMode:false };

/* Kamerasiz Simulyatsiya foni: kamera mavjud bo'lmagan yoki ruxsat
   berilmagan muhitlarda (masalan, ushbu ilova preview sifatida
   ko'rsatilganda) foydalanuvchi baribir naqshni sirt ustida ko'ra oladi. */
function drawArBackdrop(ctx, W, H){
  ctx.save();
  if(AR.surface==='pol'){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#8a6a44'); g.addColorStop(1,'#4a3620');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
    for(let i=-4;i<=4;i++){
      ctx.beginPath(); ctx.moveTo(W/2 + i*W*0.09, H*0.15); ctx.lineTo(W/2 + i*W*0.3, H); ctx.stroke();
    }
  } else if(AR.surface==='gilam'){
    ctx.fillStyle = '#5a2e2e'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    for(let x=0;x<W;x+=18){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(let y=0;y<H;y+=18){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  } else if(AR.surface==='piyola'){
    const g = ctx.createRadialGradient(W/2,H*0.42,H*0.05,W/2,H*0.42,H*0.5);
    g.addColorStop(0,'#e8e0c8'); g.addColorStop(0.7,'#c9bf9e'); g.addColorStop(1,'#8f8365');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  } else { /* devor */
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#efe9d8'); g.addColorStop(1,'#d8cfb2');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  }
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = '600 12px Manrope, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SIMULYATSIYA — kamerasiz ko\'rinish', W/2, H-16);
  ctx.restore();
}
function startARSim(){
  const errBox = $('ar-err'); if(errBox) errBox.textContent = '';
  AR.simMode = true;
  arActive = true;
  arNeedsRedraw = true;
  const video = $('ar-video'); if(video) video.style.display = 'none';
  const card = $('ar-start-card'); if(card) card.style.display = 'none';
  const bar = $('ar-bar'); if(bar){ bar.hidden = false; bar.style.display = 'flex'; }
  arLoop();
  ntf('Simulyatsiya rejimi yoqildi 🖼', 'ok');
}

/* AR uchun ikki xil tasvir kerak:
   · MEDALYON — devor va piyolada bitta naqsh sifatida yotadi;
   · CHOK-SUZ MAYDON — gilam va polda naqsh takrorlanadi, shuning uchun u
     haqiqiy rapportdan yig'iladi. Ilgari bu yerda ham medalyon ishlatilib,
     u 3x3 qilib takrorlanardi — natijada plitkalar orasida UZILISH va
     bo'sh joylar ko'rinardi. */
let arTileCanvas = null, arTileKey = '';
function arTileField(W, H){
  const key = P.type + '|' + P.pal + '|' + P.sym + '|' + P.cmp + '|' + P.dens + '|' +
              P.sw + '|' + P.lay + '|' + (T3D.group || 'p4') + '|' + W + 'x' + H;
  if(arTileCanvas && arTileKey === key) return arTileCanvas;
  let rep = null;
  try{ rep = makeSeamlessRepeat(256, T3D.group || 'p4', {}); }catch(e){ console.warn('[ar] rapport', e); }
  const cnv = document.createElement('canvas');
  cnv.width = W; cnv.height = H;
  const c2 = cnv.getContext('2d');
  if(!c2) return null;
  if(rep && rep.canvas){
    const pat = c2.createPattern(rep.canvas, 'repeat');
    if(pat){ c2.fillStyle = pat; c2.fillRect(0, 0, W, H); }
  } else {
    /* zaxira — rapport chiqmasa medalyon bilan to'ldiramiz */
    const t = Math.min(W, H)/2;
    for(let y = 0; y < H; y += t) for(let x = 0; x < W; x += t)
      drawPattern(c2, x + t/2, y + t/2, t*0.5, P);
  }
  arTileCanvas = cnv; arTileKey = key;
  return cnv;
}
function renderArPattern(){
  if(!arPatCanvas){
    arPatCanvas = document.createElement('canvas');
    arPatCanvas.width = arPatCanvas.height = 512;
  }
  const octx = arPatCanvas.getContext('2d');
  if(!octx) return;
  octx.clearRect(0,0,512,512); /* fon TO'LIQ SHAFFOF — hech qanday fill yo'q */
  drawPattern(octx, 256, 256, 236, P);
  arTileKey = '';               /* maydon ham qayta yig'ilsin */
  arNeedsRedraw = false;
}
function drawArSurface(ctx, W, H){
  const size = Math.min(W,H)*AR.size;
  const cx = W/2 + AR.x, cy = H/2 + AR.y;
  ctx.save();
  ctx.globalAlpha = AR.op;
  if(AR.surface==='devor'){
    ctx.translate(cx,cy);
    ctx.rotate(AR.rot*Math.PI/180);
    ctx.drawImage(arPatCanvas, -size/2, -size/2, size, size);
  } else if(AR.surface==='piyola'){
    /* elliptik deformatsiya: naqsh pastga qarab siqiladi */
    ctx.translate(cx,cy);
    ctx.rotate(AR.rot*Math.PI/180);
    const rows = 36, srcH = 512/rows;
    let dy = -size/2;
    for(let j=0;j<rows;j++){
      const t = j/rows;
      const k = 1 - 0.5*t*t;                 /* pastga qarab siqilish */
      const wRow = size*(0.72 + 0.28*Math.sqrt(Math.max(0,1-t*t)));
      const hRow = (size/rows)*k;
      ctx.drawImage(arPatCanvas, 0, j*srcH, 512, srcH, -wRow/2, dy, wRow, hRow+0.7);
      dy += hRow;
    }
  } else if(AR.surface==='pol'){
    /* perspektiv trapetsiya: uzoqda tor, yaqinida keng.
       Manba CHOK-SUZ maydon — shuning uchun qatorlar orasida uzilish yo'q. */
    ctx.translate(cx,cy);
    const src = arTileField(1024, 1024) || arPatCanvas;
    const SH = src.height, SW = src.width;
    const rows = 36, srcH = SH/rows;
    let dy = -size/2;
    for(let j=0;j<rows;j++){
      const t = j/rows;
      const k = 0.35 + 0.75*t;
      const wRow = size*1.25*k;
      const hRow = (size/rows)*k;
      ctx.save();
      ctx.rotate(AR.rot*Math.PI/180*0.2);
      ctx.drawImage(src, 0, j*srcH, SW, srcH, -wRow/2, dy, wRow, hRow+0.7);
      ctx.restore();
      dy += hRow;
    }
  } else { /* gilam: CHOK-SUZ maydon — rapport takrorlanadi, uzilish yo'q */
    ctx.translate(cx,cy);
    ctx.rotate(AR.rot*Math.PI/180);
    const fld = arTileField(1024, 1024);
    if(fld){
      const pat = ctx.createPattern(fld, 'repeat');
      const half = size*0.85;
      if(pat){
        ctx.save();
        /* naqsh AR.size ga qarab kattalashadi */
        const k = size/512;
        ctx.scale(k, k);
        ctx.fillStyle = pat;
        ctx.fillRect(-half/k, -half/k, 2*half/k, 2*half/k);
        ctx.restore();
      } else {
        ctx.drawImage(fld, -half, -half, 2*half, 2*half);
      }
    }
  }
  ctx.restore();
}
function arLoop(){
  if(!arActive) return;
  const overlay = $('ar-overlay');
  const stage = $('ar-stage');
  if(overlay && stage){
    if(overlay.width !== stage.clientWidth || overlay.height !== stage.clientHeight){
      overlay.width = stage.clientWidth||300;
      overlay.height = stage.clientHeight||300;
    }
    const ctx = overlay.getContext('2d');
    if(ctx){
      if(arNeedsRedraw || !arPatCanvas) renderArPattern();
      ctx.clearRect(0,0,overlay.width,overlay.height);
      if(AR.simMode) drawArBackdrop(ctx, overlay.width, overlay.height);
      drawArSurface(ctx, overlay.width, overlay.height);
    }
  }
  requestAnimationFrame(arLoop);
}
function startAR(){
  const errBox = $('ar-err');
  if(errBox) errBox.textContent = '';
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    /* Brauzer kamerani faqat XAVFSIZ MUHITDA beradi (https yoki localhost).
       Oddiy http:// da navigator.mediaDevices umuman mavjud bo'lmaydi va
       ilgari bu "brauzeringiz qo'llab-quvvatlamaydi" deb ko'rsatilardi —
       sabab noto'g'ri aytilgan bo'lardi. */
    const secure = (typeof isSecureContext !== 'undefined') ? isSecureContext
                 : (location.protocol === 'https:' || location.hostname === 'localhost');
    const msg = secure
      ? 'Brauzeringiz kamerani qo\'llab-quvvatlamaydi.'
      : 'Kamera faqat HTTPS orqali ishlaydi. Saytni https:// bilan oching '
        + '(GitHub Pages allaqachon HTTPS). Hozircha «Simulyatsiya» tugmasidan foydalaning.';
    if(errBox) errBox.textContent = msg;
    ntf(msg, 'err');
    return;
  }
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
    .catch(()=>navigator.mediaDevices.getUserMedia({video:true}))
    .then(stream=>{
      arStream = stream;
      const video = $('ar-video');
      if(video){
        video.srcObject = stream;
        video.style.display = '';          /* simulyatsiyadan keyin qaytariladi */
        /* autoplay atributi bor, lekin ba'zi brauzerlar aniq play() talab
           qiladi — xatosi jimgina yutilmasin */
        const pr = video.play();
        if(pr && pr.catch) pr.catch(e=>{
          console.warn('[ar] video.play', e);
          if(errBox) errBox.textContent = 'Videoni boshlab bo\'lmadi: ' + e.name;
        });
      }
      arActive = true;
      arNeedsRedraw = true;
      const card = $('ar-start-card'); if(card) card.style.display = 'none';
      const bar = $('ar-bar'); if(bar){ bar.hidden = false; bar.style.display = 'flex'; }
      arLoop();
      ntf('AR rejim yoqildi 📷', 'ok');
    })
    .catch(err=>{
      let msg = 'Kamera xatosi: ' + err.name;
      if(err.name === 'NotAllowedError') msg = 'Kameraga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering' + (location.protocol==='file:' ? ' (agar file:// da bloklangan bo\'lsa, HTTPS/GitHub Pages orqali oching)' : '') + '.';
      else if(err.name === 'NotFoundError') msg = 'Kamera topilmadi.';
      else if(err.name === 'NotReadableError') msg = 'Kamera band — boshqa ilova ishlatayotgan bo\'lishi mumkin.';
      if(errBox) errBox.textContent = msg;
      ntf(msg, 'err');
    });
}
function stopAR(){
  arActive = false;
  AR.simMode = false;
  if(arStream){
    arStream.getTracks().forEach(tr=>tr.stop()); /* streamni to'xtatish */
    arStream = null;
  }
  const video = $('ar-video');
  if(video){ video.srcObject = null; video.style.display = ''; }
  const overlay = $('ar-overlay');
  if(overlay){
    /* keyingi safar boshlanguncha eski kadr ko'rinib qolmasin */
    const octx = overlay.getContext('2d');
    if(octx) octx.clearRect(0, 0, overlay.width, overlay.height);
  }
  const card = $('ar-start-card'); if(card) card.style.display = 'flex';
  /* .ar-bar{display:flex} qoidasi [hidden] ustidan ustunlik qiladi —
     shuning uchun inline style bilan ham aniq yashiramiz */
  const bar = $('ar-bar'); if(bar){ bar.hidden = true; bar.style.display = 'none'; }
}
function captureAR(){
  const video = $('ar-video'), overlay = $('ar-overlay');
  if(!overlay || !arActive){ ntf('Avval kamerani yoqing yoki simulyatsiyani boshlang', 'err'); return; }
  const W = (!AR.simMode && video && video.videoWidth) || overlay.width || 640;
  const H = (!AR.simMode && video && video.videoHeight) || overlay.height || 480;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  if(!octx) return;
  if(AR.simMode){
    drawArBackdrop(octx, W, H);
  } else if(video){
    octx.drawImage(video, 0, 0, W, H);
  }
  /* overlay object-fit:cover ga mos masshtabda ustiga chiziladi */
  const sc = Math.max(W/overlay.width, H/overlay.height);
  const dw = overlay.width*sc, dh = overlay.height*sc;
  octx.drawImage(overlay, (W-dw)/2, (H-dh)/2, dw, dh);
  if(off.toBlob){
    off.toBlob(b=>{ if(b) _dlBlob(b, 'image/png', 'naqsh_ar.png', 'AR surat saqlandi 📸'); }, 'image/png');
  }
}

/* ============================================================
   AI CHAT — lokal NLP parser, rasm-natija markazli
   ============================================================ */
const CHAT_TYPES = [
  ['girih','girih'],['xatam','xatam'],['rozetta','rozetta'],['yulduz','yulduz'],
  ['muqarnas','muqarnas'],['katak','katak8'],['olti burchak','hexa'],['asal','hexa'],['zanjira','zanjira'],
  ['hankin 6','hankin6'],['hankin olti','hankin6'],['hankin','hankin8'],['sakkiz qirrali','panelgirih'],['panel','panelgirih'],
  ['islimiy','islimiy'],['rumi','rumi'],['hatayi','hatayi'],['palak','palak'],['shamsa','shamsa'],
  ['arabesk','arabesk'],['arabesque','arabesk'],['novda','scroll'],['scroll','scroll'],['medalyon','medallion'],['medallion','medallion'],
  ['celtic','celtic'],['kelt','celtic'],['mandala','mandala'],['penrose','penrose'],['zellige','zellige'],['zelij','zellige'],
  ['batik','batik'],['paisley','paisley'],['buta','paisley'],['greek','greek'],['meander','greek'],['xitoy','xitoy'],['panjara','xitoy'],
  ['koch','koch'],['qor parcha','koch'],['sierpinski','sierpinski'],['dragon','dragon'],['ajdar','dragon'],
  ['hilbert','hilbert'],['spirograf','spirograph'],['spirograph','spirograph'],['lissajous','lissajous'],['lissaju','lissajous'],['voronoi','voronoi']
];
const CHAT_COLORS = [
  ['oltin','gold'],['tilla','gold'],['feruza','turquoise'],['turkuaz','turquoise'],['registon','turquoise'],
  ['zumrad','emerald'],['yashil','emerald'],['yoqut','ruby'],['qizil','ruby'],
  ["ko'k",'navy'],['kok','navy'],['navy','navy'],['tuproq','earth'],['jigarrang','earth']
];
/* Matn -> barqaror hash (bir xil matn = bir xil naqsh) */
function hashStr(str){
  let h = 5381;
  for(let i=0;i<str.length;i++){ h = (((h<<5)+h) + str.charCodeAt(i)) >>> 0; }
  return h >>> 0;
}
function parseChat(txt){
  const q = (txt||'').toLowerCase();
  const np = {...P}; delete np._bg;
  /* 1) HAR QANDAY MATN naqsh tug'diradi: matn hashi -> deterministik parametrlar
     (nano-banana uslubi: "salom dunyo" ham, ism ham o'z noyob naqshiga ega) */
  const seed = hashStr(q);
  const rnd = mulberry32(seed);
  const ids = PATTERNS.map(x=>x.id);
  const pals = Object.keys(PAL);
  np.type = ids[Math.floor(rnd()*ids.length)];
  np.pal  = pals[Math.floor(rnd()*pals.length)];
  np.sym  = 5 + Math.floor(rnd()*10);
  np.cmp  = 2 + Math.floor(rnd()*6);
  np.sw   = +(1.2 + rnd()*2.6).toFixed(1);
  np.ir   = +(0.2 + rnd()*0.5).toFixed(2);
  np.spir = +(rnd()).toFixed(2);
  np.dens = +(0.3 + rnd()*0.6).toFixed(2);
  np.lay  = 1 + Math.floor(rnd()*3);
  np.skew = 0;
  np.rot  = Math.floor(rnd()*360);
  np._seed = seed % 100000;
  /* 2) Kalit so'zlar seedni ANIQLASHTIRADI (nomi, rangi, soni aytilsa — shu bo'ladi) */
  for(const [kw,id] of CHAT_TYPES){ if(q.indexOf(kw)>=0){ np.type = id; break; } }
  /* rang */
  for(const [kw,id] of CHAT_COLORS){ if(q.indexOf(kw)>=0){ np.pal = id; break; } }
  /* sonlar: "8 simmetriya", "12 ta" */
  const m = q.match(/(\d+)\s*(ta|simmetriya|simmetriyali|burchak|qirra)/);
  if(m){ np.sym = Math.max(3, Math.min(16, parseInt(m[1],10))); }
  else { const m2 = q.match(/\b(\d{1,2})\b/); if(m2){ const v=parseInt(m2[1],10); if(v>=3 && v<=16) np.sym = v; } }
  /* sifatlar */
  if(q.indexOf('zich')>=0)       np.dens = 0.8;
  if(q.indexOf('siyrak')>=0)     np.dens = 0.3;
  if(q.indexOf('murakkab')>=0)   np.cmp  = 6;
  if(q.indexOf('sodda')>=0)      np.cmp  = 2;
  if(q.indexOf('ingichka')>=0)   np.sw   = 1;
  if(q.indexOf('qalin')>=0)      np.sw   = 4;
  if(q.indexOf('spiral')>=0)     np.spir = 0.8;
  if(q.indexOf('qatlam')>=0)     np.lay  = 4;
  if(q.indexOf('tessell')>=0 || q.indexOf('tiling')>=0 || q.indexOf('takror')>=0) np._tess = true;
  if(q.indexOf('p4m')>=0) np._grid='p4m'; else if(q.indexOf('p6m')>=0) np._grid='p6m';
  else if(q.indexOf('p6')>=0) np._grid='p6'; else if(q.indexOf('p4')>=0) np._grid='p4';
  return np;
}
function chatCard(np, query){
  const log = $('chat-log');
  if(!log) return;
  const card = document.createElement('div');
  card.className = 'chat-row';
  const inner = document.createElement('div');
  inner.className = 'ai-card';
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 600; /* 2× — CorelDraw kabi tiniq preview */
  inner.appendChild(cnv);
  const octx = cnv.getContext('2d');
  if(octx){
    const pal = PAL[np.pal] || PAL.gold;
    const keepBg = P._bg;
    P._bg = pal.bg;
    octx.fillStyle = pal.bg;
    octx.fillRect(0,0,600,600);
    if(np._tess){
      const keepG = TESS.group, keepC = TESS.cell, keepS = TESS.showCell;
      TESS.group = np._grid || TESS.group;
      TESS.cell = 200; TESS.showCell = false;
      drawTessellation(octx, 600, 600, np);
      TESS.group = keepG; TESS.cell = keepC; TESS.showCell = keepS;
    } else {
      drawPattern(octx, 300, 300, 276, np);
    }
    P._bg = keepBg;
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  const pt = getPattern(np.type), pal2 = PAL[np.pal] || PAL.gold;
  meta.innerHTML = 'Turi: <b>'+pt.nm+'</b> · Simmetriya: <b>'+np.sym+'</b> · Palitra: <b>'+pal2.nm+'</b> · Murakkablik: <b>'+np.cmp+'</b>' + (np._tess ? ' · <b>Tessellatsiya '+(np._grid||TESS.group)+'</b>' : '') + (np._seed!==undefined ? ' · Seed <b>#'+np._seed+'</b>' : '');
  inner.appendChild(meta);
  const acts = document.createElement('div');
  acts.className = 'acts';
  const bOpen = document.createElement('button');
  bOpen.className = 'btn sm'; bOpen.textContent = 'Studio da ochish';
  bOpen.addEventListener('click', ()=>{
    const clean = {...np}; delete clean._tess; delete clean._grid; delete clean._seed;
    Object.assign(P, clean);
    if(np._tess){
      TESS.on = true;
      if(np._grid) TESS.group = np._grid;
      const chk = $('chk-tess'); if(chk) chk.checked = true;
      const sel = $('sel-tess'); if(sel) sel.value = TESS.group;
    }
    syncSliders(); redraw();
    showPage('studio');
    ntf('Naqsh Studio ga yuklandi', 'ok');
  });
  const bVar = document.createElement('button');
  bVar.className = 'btn sm ghost'; bVar.textContent = 'Yana variant';
  bVar.addEventListener('click', ()=>{
    const v = {...np};
    v.spir = +(Math.random()).toFixed(2);
    v.dens = +(0.2+Math.random()*0.7).toFixed(2);
    v.ir   = +(0.15+Math.random()*0.6).toFixed(2);
    v.cmp  = 1+Math.floor(Math.random()*8);
    v.rot  = Math.floor(Math.random()*360);
    v.lay  = 1+Math.floor(Math.random()*4);
    chatCard(v, query);
    saveChatHistory();
  });
  const bDl = document.createElement('button');
  bDl.className = 'btn sm gold'; bDl.textContent = '⬇ Yuklab olish';
  bDl.addEventListener('click', ()=>{
    if(cnv.toBlob) cnv.toBlob(b=>{ if(b) _dlBlob(b,'image/png','naqsh_chat_'+np.type+'.png', 'Rasm yuklab olindi 📥'); },'image/png');
  });
  acts.appendChild(bOpen); acts.appendChild(bVar); acts.appendChild(bDl);
  inner.appendChild(acts);
  card.appendChild(inner);
  card._np = np;
  log.appendChild(card);
  log.scrollTop = log.scrollHeight;
}
function chatUserMsg(txt){
  const log = $('chat-log');
  if(!log) return;
  const row = document.createElement('div');
  row.className = 'chat-row user';
  const b = document.createElement('div');
  b.className = 'bubble-user';
  b.textContent = txt;
  row.appendChild(b);
  row._q = txt;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}
function saveChatHistory(){
  const log = $('chat-log');
  if(!log) return;
  const hist = [];
  Array.prototype.forEach.call(log.children, ch=>{
    if(ch._q) hist.push({q:ch._q});
    else if(ch._np) hist.push({p:ch._np});
  });
  lsSet('naqsh_chat', hist.slice(-40));
}
function restoreChatHistory(){
  const hist = lsGet('naqsh_chat', []);
  hist.forEach(item=>{
    if(item.q) chatUserMsg(item.q);
    else if(item.p) chatCard(item.p, '');
  });
}
/* ============================================================
   AI ERKIN TASVIR — Nano Banana (Gemini) orqali, Cloudflare Worker
   proksisi bilan. API kalit hech qachon shu faylda saqlanmaydi —
   faqat foydalanuvchi o'zi joylashtirgan Worker manzili + token
   localStorage'da turadi.
   ============================================================ */
let CHAT_MODE = 'exact'; /* 'exact' | 'ai' */
const AI_MODEL_DEFAULT = 'gemini-2.5-flash-image';
const lsGetStr = (k, d) => { try{ return (localStorage.getItem(k) || d || '').trim(); }catch(e){ return d || ''; } };
const lsSetStr = (k, v) => { try{ localStorage.setItem(k, (v||'').trim()); return true; }catch(e){ return false; } };

function getAiConn(){ return lsGetStr('naqsh_ai_conn', 'direct') === 'worker' ? 'worker' : 'direct'; }
function setAiConn(v){ return lsSetStr('naqsh_ai_conn', v === 'worker' ? 'worker' : 'direct'); }
function getAiWorkerUrl(){ return lsGetStr('naqsh_ai_worker', ''); }
function setAiWorkerUrl(v){ return lsSetStr('naqsh_ai_worker', v); }
function getAiAppToken(){ return lsGetStr('naqsh_ai_token', ''); }
function setAiAppToken(v){ return lsSetStr('naqsh_ai_token', v); }
function getAiKey(){ return lsGetStr('naqsh_ai_key', ''); }
function setAiKey(v){ return lsSetStr('naqsh_ai_key', v); }
function getAiModel(){ return lsGetStr('naqsh_ai_model', AI_MODEL_DEFAULT) || AI_MODEL_DEFAULT; }
function setAiModel(v){ return lsSetStr('naqsh_ai_model', v); }
/* AI rasm rejimi ishlashga tayyormi? */
function aiReady(){
  return getAiConn() === 'worker' ? !!getAiWorkerUrl() : !!getAiKey();
}

function aiShowConn(which){
  const w = (which === 'worker');
  const seg = $('ai-conn-seg');
  if(seg) seg.querySelectorAll('button').forEach(b=> b.classList.toggle('sel', (b.dataset.v === (w?'worker':'direct'))));
  const d = $('ai-direct-box'), wb = $('ai-worker-box');
  if(d) d.hidden = w;
  if(wb) wb.hidden = !w;
}
function openAiSetup(){
  const u=$('ai-worker-url'), t=$('ai-app-token'), k=$('ai-key'), m=$('ai-model');
  if(u) u.value = getAiWorkerUrl();
  if(t) t.value = getAiAppToken();
  if(k) k.value = getAiKey();
  if(m) m.value = getAiModel();
  aiShowConn(getAiConn());
  const md=$('modal-ai-setup'); if(md) md.classList.add('open');
}
function closeAiSetup(){ const m=$('modal-ai-setup'); if(m) m.classList.remove('open'); }

function aiLoadingCard(){
  const log = $('chat-log');
  if(!log) return null;
  const card = document.createElement('div');
  card.className = 'ai-card ai-loading';
  card.innerHTML = '<div class="ai-spin"></div><div>🍌 Nano Banana tasvirni chizyapti… (2\u20115 soniya)</div>';
  log.appendChild(card);
  log.scrollTop = log.scrollHeight;
  return card;
}
/* Gemini javobidan birinchi rasmni ajratib olish.
   Worker ham, to'g'ridan-to'g'ri Google ham shu funksiyaga tushadi:
   Worker {image,mime} qaytaradi, Google esa candidates[].content.parts[]
   ichida inlineData beradi. Ikkalasini ham qo'llab-quvvatlaymiz. */
function aiExtractImage(data){
  if(!data) return null;
  if(data.image) return { b64: data.image, mime: data.mime || 'image/png' };
  const cands = data.candidates;
  if(Array.isArray(cands)){
    for(const c of cands){
      const parts = c && c.content && c.content.parts;
      if(!Array.isArray(parts)) continue;
      for(const p of parts){
        const inl = p.inlineData || p.inline_data;
        if(inl && inl.data) return { b64: inl.data, mime: inl.mimeType || inl.mime_type || 'image/png' };
      }
    }
  }
  return null;
}
/* Google xato javobini tushunarli xabarga aylantirish */
function aiApiErr(status, data){
  const msg = (data && data.error && data.error.message) || '';
  console.error('[ai]', status, data);
  const m = msg.toLowerCase();

  if(status === 400 && /api key not valid/.test(m))
    return { short:'API kalit noto\'g\'ri — tekshirib qayta kiriting', detail:msg };
  if(status === 403)
    return { short:'Kalitga ruxsat yo\'q — Google AI Studio\'da kalitni tekshiring', detail:msg };
  if(status === 404)
    return { short:'Model topilmadi — «Model» maydonidagi nomni tekshiring', detail:msg };

  if(status === 429){
    /* Google 429 ni ikki xil holatda qaytaradi va ular butunlay boshqacha:
       1) haqiqiy tezlik chegarasi — kutib qayta urinsa bo'ladi;
       2) bu model bepul rejada UMUMAN yo'q (quota_limit_value: 0) —
          kutish yordam bermaydi, to'lov (billing) yoqilishi kerak.
       Ikkinchisini "birozdan so'ng urining" deb ko'rsatish — chalg'itish. */
    const freeTier = /free[_ ]tier|billing|plan and billing|quota_limit_value.*?0\b/.test(m);
    if(freeTier) return {
      short:'Bu model bepul rejada mavjud emas — Google hisobingizda to\'lov (billing) yoqilishi kerak',
      detail:msg, hint:'billing'
    };
    return { short:'So\'rovlar chegarasi — 1–2 daqiqadan so\'ng qayta urining', detail:msg };
  }
  if(status >= 500)
    return { short:'Google serverida vaqtincha nosozlik — qayta urining', detail:msg };
  return { short: msg ? ('Xato: ' + msg.slice(0,120)) : ('Xato: HTTP ' + status), detail:msg };
}

async function aiGenerate(prompt){
  if(!aiReady()){
    ntf('Avval ⚙ AI sozlash — API kalitini kiriting', 'err');
    openAiSetup();
    return;
  }
  const card = aiLoadingCard();
  /* e — matn yoki {short, detail, hint}. Google'ning O'Z xabari yashirilmaydi:
     aynan o'sha matn muammoning haqiqiy sababini aytadi. */
  const fail = (e)=>{
    const short  = (typeof e === 'string') ? e : e.short;
    const detail = (typeof e === 'string') ? '' : (e.detail || '');
    const hint   = (typeof e === 'string') ? '' : (e.hint || '');
    if(card){
      card.classList.remove('ai-loading');
      let html = '<div class="ai-err">⚠ ' + escHTML(short) + '</div>';
      if(hint === 'billing'){
        html += '<div class="meta" style="line-height:1.6">Nima qilish kerak:<br>' +
                '1. <b>aistudio.google.com/apikey</b> → kalitingiz qaysi loyihaga tegishli ekanini ko\'ring<br>' +
                '2. <b>console.cloud.google.com/billing</b> → o\'sha loyihaga to\'lov usulini ulang<br>' +
                '3. Yoki «⚙ AI sozlash → Model» da bepul rejada mavjud boshqa modelni sinang<br>' +
                '<i>Eslatma: «Aniq naqsh» rejimi bepul va cheksiz ishlaydi.</i></div>';
      }
      if(detail){
        html += '<details class="meta"><summary>Google javobi (texnik)</summary>' +
                '<div style="white-space:pre-wrap;word-break:break-word;margin-top:6px">' +
                escHTML(detail.slice(0, 600)) + '</div></details>';
      }
      card.innerHTML = html;
    }
    ntf(short, 'err');
  };
  try{
    let res, data;
    if(getAiConn() === 'worker'){
      res = await fetch(getAiWorkerUrl(), {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'X-App-Token': getAiAppToken() },
        body: JSON.stringify({ prompt })
      });
      data = await res.json().catch(()=>({}));
      if(!res.ok){
        /* Worker xatoni matn sifatida uzatadi ({error:"..."}), Google esa
           obyekt sifatida ({error:{message}}). Ikkalasini ham aiApiErr
           tushunadigan bitta shaklga keltiramiz — shunda bepul reja/billing
           holati proksi orqali ham to'g'ri aniqlanadi. */
        const e0 = data && data.error;
        fail(aiApiErr(res.status, (typeof e0 === 'string') ? {error:{message:e0}} : data));
        return;
      }
    } else {
      const model = encodeURIComponent(getAiModel());
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
      res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key': getAiKey() },
        body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }] })
      });
      data = await res.json().catch(()=>({}));
      if(!res.ok){ fail(aiApiErr(res.status, data)); return; }
    }

    const img0 = aiExtractImage(data);
    if(!img0){
      /* model matn qaytargan bo'lishi mumkin — uni ko'rsatamiz */
      let txt = '';
      try{
        const parts = data.candidates[0].content.parts;
        txt = parts.map(p=>p.text).filter(Boolean).join(' ');
      }catch(e){}
      fail(txt ? ('Model rasm o\'rniga matn qaytardi: ' + txt.slice(0,160))
               : 'Javobda rasm topilmadi — «Model» nomi rasm chizadigan model ekanini tekshiring');
      return;
    }

    if(card){
      card.classList.remove('ai-loading');
      const img = document.createElement('img');
      img.src = 'data:' + img0.mime + ';base64,' + img0.b64;
      card.innerHTML = '';
      card.appendChild(img);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = '🍌 <b>Nano Banana</b> · "'+escHTML(prompt)+'"';
      card.appendChild(meta);
      const acts = document.createElement('div');
      acts.className = 'acts';
      const bDl = document.createElement('button');
      bDl.className = 'btn sm gold'; bDl.textContent = '⬇ Yuklab olish';
      bDl.addEventListener('click', ()=>{
        _dlBlob(_dataURLtoBlob(img.src), img0.mime, 'naqshai_ai_'+Date.now()+'.png', 'Rasm yuklab olindi 📥');
      });
      acts.appendChild(bDl);
      card.appendChild(acts);
    }
    const log = $('chat-log'); if(log) log.scrollTop = log.scrollHeight;
  }catch(e){
    console.error('[ai]', e);
    fail(/failed to fetch|networkerror/i.test(e.message||'')
      ? 'Serverga ulanib bo\'lmadi — internetni tekshiring'
      : ('Xatolik: ' + e.message));
  }
}
function wireAiSetup(){
  const seg = $('chat-mode-seg');
  if(seg) seg.addEventListener('click', e=>{
    const b = e.target.closest('button');
    if(!b) return;
    CHAT_MODE = b.dataset.v;
    seg.querySelectorAll('button').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel');
    if(CHAT_MODE === 'ai' && !aiReady()){
      ntf('AI rasm rejimi uchun API kalit kerak (bir marta)', 'err');
      openAiSetup();
    }
    const inp = $('chat-input');
    if(inp) inp.placeholder = CHAT_MODE==='ai'
      ? "Masalan: quyosh nurida oltin girih naqshli chinni laganning fotosi"
      : "Masalan: 8 simmetriyali oltin girih chiz";
  });
  const setupBtn = $('btn-ai-setup'); if(setupBtn) setupBtn.addEventListener('click', openAiSetup);
  const cancel = $('ai-setup-cancel'); if(cancel) cancel.addEventListener('click', closeAiSetup);
  const back = $('modal-ai-setup'); if(back) back.addEventListener('click', e=>{ if(e.target===back) closeAiSetup(); });
  const cseg = $('ai-conn-seg');
  if(cseg) cseg.addEventListener('click', e=>{
    const b = e.target.closest('button');
    if(b) aiShowConn(b.dataset.v);
  });
  const save = $('ai-setup-save'); if(save) save.addEventListener('click', ()=>{
    const chosen = ($('ai-worker-box') && !$('ai-worker-box').hidden) ? 'worker' : 'direct';
    setAiConn(chosen);
    const u=$('ai-worker-url'), t=$('ai-app-token'), k=$('ai-key'), m=$('ai-model');
    setAiWorkerUrl(u?u.value:''); setAiAppToken(t?t.value:'');
    setAiKey(k?k.value:'');       setAiModel(m?m.value:'');
    closeAiSetup();
    ntf(aiReady() ? 'Saqlandi ✓ — AI rasm rejimi tayyor' : 'Saqlandi, lekin kalit/manzil bo\'sh', aiReady()?'ok':'err');
  });
}
function sendChat(){
  const inp = $('chat-input');
  if(!inp) return;
  const txt = (inp.value||'').trim();
  if(!txt) return;
  inp.value = '';
  chatUserMsg(txt);
  if(CHAT_MODE === 'ai'){
    aiGenerate(txt);
    return;
  }
  const np = parseChat(txt);
  setTimeout(()=>{ chatCard(np, txt); saveChatHistory(); }, 120);
}
const CHAT_CHIPS = [
  '8 simmetriyali oltin girih chiz',
  'Feruza islimiy, zich',
  'Ismingizni yozing — shaxsiy naqsh',
  '12 ta mandala, murakkab',
  "Ko'k penrose, sodda",
  'Oltin girih tessellatsiya p6m',
  'Samarqand 2026'
];
function buildChips(){
  const box = $('chat-chips');
  if(!box) return;
  box.innerHTML = '';
  CHAT_CHIPS.forEach(txt=>{
    const b = document.createElement('button');
    b.textContent = txt;
    b.addEventListener('click', ()=>{
      const inp = $('chat-input');
      if(txt.indexOf('Ismingizni')===0){
        if(inp){ inp.value=''; inp.placeholder='Ismingizni yozing...'; inp.focus && inp.focus(); }
        return;
      }
      if(inp){ inp.value = txt; }
      sendChat();
    });
    box.appendChild(b);
  });
}

/* ============================================================
   NAZARIYA SAHIFASI — INTERAKTIV DARSLIK
   Har naqsh: jonli preview + model + formulalar + algoritm + kod
   ============================================================ */
function escHTML(t){
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
const THEORY = {
girih:{
 model:`Kanonik islomiy rozetta: {n/k} yulduz o'zagi + kite-gulbarglar halqasi. Chiziqlar lenta (ribbon) sifatida — ikki qoramtir kontur orasidagi band — chiziladi va navbatlashib to'qiladi.`,
 frm:[`P_i = (R·cos θ_i, R·sin θ_i),  θ_i = 2πi/n − π/2`,
      `k = ⌊n/2⌋ − 1  (vatar qadami: P_i → P_{i+k})`,
      `r₂ = R(0.36 + ir·0.28) — yulduz uchlari;  r₁ = r₂(0.66 − spir·0.28)`,
      `Kite: A(θ, r₂) → L(θ−w, r_m) → T(θ, R₀) → Rr(θ+w, r_m),  w = (π/n)·0.86·(0.72+dens·0.55)`],
 algo:[`Aylanada n ta nuqta hisoblanadi`,
       `Har yo'nalishda kite-gulbarg to'ldiriladi (4 bo'rtgan Bezier yon)`,
       `starPath(n, r₂, r₁) — yulduz o'zagi to'ldiriladi`,
       `{n/k} vatarlar IKKI O'TISHDA lenta qilib chiziladi: juftlari ostda, toqlari fon-uzilish (ribbonI) bilan ustida → to'qish`,
       `Juft vatarlarning markaziy 42–58% segmenti yana ustidan — weave yakunlanadi`,
       `Tashqi halqa lentasi + tugunlarda mini 8-yulduzlar`],
 code:`const pts=[]; for(let i=0;i<n;i++) pts.push(pol(TAU*i/n-Math.PI/2, R0));
const chord=(i)=>{ const A=pts[i], B=pts[(i+k)%n];
  ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); };
for(let pass=0; pass<2; pass++)
  for(let i=pass; i<n; i+=2){ chord(i); ribbonI(ctx,c0,edge,bw); }`,
 par:`<b>sym</b>→n, <b>ir</b>→r₂ (yulduz o'lchami), <b>dens</b>→gulbarg eni w, <b>spir</b>→yulduz o'tkirligi r₁, <b>cmp≥5</b>→ichki mini-rozetta`},
hankin8:{
 model:`Hankin usuli (polygons-in-contact): tekislik 4.8.8 Arximed plitkalashi (sakkizburchak + kvadrat) bilan qoplanadi; strapwork plitkalardan avtomatik "tug'iladi" — hech bir chiziq qo'lda joylanmaydi.`,
 frm:[`oR = s/2 / cos(π/8) — oktagon radiusi (s — panjara qadami)`,
      `Qirra o'rtasi M_i dan ikki nur: yo'nalish d_i ± δ,  δ = π(0.2 + spir·0.18)`,
      `Kesishma: M_i + t·(cos(d_i+δ), sin(d_i+δ)) = M_{i+1} + u·(cos(d_{i+1}+π−δ), ...)`,
      `Kvadrat uchlari = 4 qo'shni oktagonning eng yaqin burchaklari`],
 algo:[`Panjara bo'ylab oktagon va oraliq kvadrat plitkalar quriladi`,
       `Har plitkada: qirralar o'rtalari M_i va yo'nalishlari d_i topiladi`,
       `Qo'shni nurlar juftlari kesishtiriladi (rayX) → [M_i, X, M_{i+1}] strap`,
       `Plitka fonlari navbat rangda to'ldiriladi`,
       `Oktagon straplari oddiy lenta, kvadratniki ribbonI (to'qish) bilan ustidan`],
 code:`function hankinStraps(poly, ang){
  const m=poly.length, mids=[], dirs=[], straps=[];
  for(let i=0;i<m;i++){ const A=poly[i],B=poly[(i+1)%m];
    mids.push([(A[0]+B[0])/2,(A[1]+B[1])/2]);
    dirs.push(Math.atan2(B[1]-A[1],B[0]-A[0])); }
  for(let i=0;i<m;i++){ const j=(i+1)%m;
    const X=rayX(mids[i],dirs[i]+ang, mids[j],dirs[j]+Math.PI-ang);
    if(X) straps.push([mids[i],X,mids[j]]); }
  return straps; }`,
 par:`<b>dens</b>→panjara zichligi (katak soni), <b>spir</b>→kontakt burchagi δ (yulduz o'tkirligi)`},
hankin6:{
 model:`Hankin usuli geksagonal 6.6.6 panjarada: har muntazam olti burchakdan kontakt burchagiga qarab 6 qirrali yulduz hosil bo'ladi.`,
 frm:[`Markazlar: x = g_x·√3·s + (g_y mod 2)·√3·s/2,  y = g_y·1.5·s`,
      `Hex uchlari: C + s·(cos(π/6 + 2πi/6), sin(π/6 + 2πi/6))`,
      `δ = π(0.24 + spir·0.16)`],
 algo:[`Asal uyasi panjarasi quriladi (qatorlar yarim qadam siljigan)`,
       `Har hexga hankinStraps(δ) qo'llanadi`,
       `Fonlar (g_x + 2g_y) mod 3 bo'yicha 3 rangda almashadi`],
 code:`for(let gy=-N;gy<=N;gy++) for(let gx=-N;gx<=N;gx++){
  const x=gx*dx+(gy%2?dx/2:0), y=gy*dy;
  const h=[]; for(let i=0;i<6;i++)
    h.push([x+Math.cos(Math.PI/6+TAU*i/6)*s, y+Math.sin(...)*s]);
  strokeStraps(ctx, hankinStraps(h,ang), band, edge, bw); }`,
 par:`<b>dens</b>→hex o'lchami s, <b>spir</b>→δ burchagi`},
panelgirih:{
 model:`Klassik kvadrat o'quv paneli: ikki kvadrat 45° buralib 8 qirrali yulduz beradi; oq lenta straplar, ramka bandlari va burchak choraklari — o'zbek naqqoshlik maktabining "sakkiz qirrali girih" darsligi.`,
 frm:[`Yulduz: kvadrat₁(θ₀=−π/2) ∪ kvadrat₂(θ₀=−π/4),  uchlari radiusi r`,
      `Ichki oktagon radiusi ≈ 0.545r (kvadratlar kesishmasi)`,
      `starPath(8, r, 0.765r) — {8} yulduz maydoni`],
 algo:[`Tashqi ramka: 2 kvadrat lenta band + orasida mini-rozetka nuqtalari`,
       `Burchak choraklari Bezier bilan to'ldiriladi`,
       `8 kite-gulbarg + yulduz maydoni fill`,
       `Kvadrat₁ ostda, kvadrat₂ ribbonI ustida, keyin kvadrat₁ ning 2 qarama-qarshi tomoni yana ustidan → haqiqiy weave`],
 code:`const sq=(rot)=>{const q=[];for(let i=0;i<4;i++)q.push(pol(rot+TAU*i/4,r));return q;};
ctx.beginPath(); polyPath(ctx, sq(-Math.PI/2));      ribbon(ctx,band,edge,bw);
ctx.beginPath(); polyPath(ctx, sq(-Math.PI/2+Math.PI/4)); ribbonI(ctx,band,edge,bw);`,
 par:`<b>dens</b>→ramka mini-rozetkalar soni`},
xatam:{
 model:`Xatam yulduzi: ikki kvadrat 45° ustma-ust — 8 qirrali yulduz; to'ldirilgan yulduz maydoni, oktagon o'zak va to'qilgan lenta kvadratlar.`,
 frm:[`Kvadrat uchlari: pol(θ₀ + 2πi/4, r), θ₀ ∈ {−π/4, 0}`,
      `Yulduz ichki nisbat: r_in/r_out = 0.765 ≈ cos(π/8)²`],
 algo:[`8-yulduz maydoni fill → ichki oktagon fill`,
       `Kvadrat A lenta, kvadrat B ribbonI, A ning 28–72% segmentlari qayta ustidan`,
       `Uchlardan tashqi halqaga nurlar + halqa band`],
 code:`ctx.beginPath(); starPath(ctx, 8, r, r*0.765, rot); fillA(ctx,c1,0.55);
ctx.beginPath(); polyPath(ctx,A); ribbon(ctx,c0,edge,bw);
ctx.beginPath(); polyPath(ctx,B); ribbonI(ctx,c1,shade(c1,.5),bw);`,
 par:`<b>cmp≥5</b>→ikkinchi ichki daraja (0.5 masshtab, 22.5° burilgan)`},
rozetta:{
 model:`Gulbarg halqalari: har barg ikki kubik Bezier yon + o'tkir uch; bandlar konsentrik — tashqi katta barglar, oraliqda kichiklari, markazda halqa+yulduzcha.`,
 frm:[`Barg asosi: (θ∓w, r_in), uchi: (θ, r_out)`,
      `Yon nazorat nuqtalari: (θ∓1.12w, r_in+0.42Δr) va (θ∓0.5w, 0.93r_out)`,
      `w = (π/n)(0.55 + dens·0.35)`],
 algo:[`n ta tashqi barg: petalPath fill + kontur + o'rta tomir`,
       `n ta oraliq kichik barg (yarim qadam siljigan)`,
       `Markaz: lenta halqa (radius ir ga bog'liq) + n-yulduzcha + cmp bo'yicha nuqta halqalari`],
 code:`function petalPath(ctx,a,rIn,rOut,hw){
  const bl=pol(a-hw,rIn), tip=pol(a,rOut), br=pol(a+hw,rIn);
  ctx.moveTo(bl[0],bl[1]);
  ctx.bezierCurveTo(...cl1,...cl2, tip[0],tip[1]);   // chap yon
  ctx.bezierCurveTo(...cr1,...cr2, br[0],br[1]);     // o'ng yon
  ctx.closePath(); }`,
 par:`<b>sym</b>→barglar n, <b>dens</b>→barg eni, <b>ir</b>→markaz halqasi, <b>cmp</b>→nuqta halqalari`},
yulduz:{
 model:`{n/k} yulduz poligoni to'qilgan lentalarda: har uch P_i dan P_{i+k} ga vatar; qo'shni vatarlar kesishmasi markaziy n-burchakni beradi va u to'ldiriladi.`,
 frm:[`Vatar: P_i → P_{(i+k) mod n},  k = ⌊n/2⌋−1 + ⌊spir·1.5⌉`,
      `Ichki uch: X = segX(P_i P_{i+k},  P_{i+1} P_{i+1−k})`],
 algo:[`Vatarlarning ketma-ket kesishmalari hisoblanib ichki poligon fill qilinadi`,
       `Vatarlar 2 o'tishda ribbonI bilan to'qiladi`,
       `Juftlarning o'rta segmenti ustidan; halqa band + tugun nuqtalar`],
 code:`const inner=[];
for(let i=0;i<n;i++){
  const X = segX(pts[i], pts[(i+k)%n],
                 pts[(i+1)%n], pts[(i+1-k+n)%n]);
  if(X) inner.push(X); }
ctx.beginPath(); polyPath(ctx, inner); fillA(ctx,c1,0.85);`,
 par:`<b>sym</b>→n, <b>spir</b>→k qadami (yulduz "o'ramliligi")`},
muqarnas:{
 model:`Pog'onali arkada modeli: har daraja radiusi geometrik kamayadi (0.74 koeffitsiyent), darajada m ta tokcha (nisha) — har biri ikki kubik Bezier ravoq, uchida osilgan tomchi.`,
 frm:[`r_l = 0.94R · 0.74^l,  l = 0…(cmp+1)`,
      `m_l = n + 2l tokcha;  osilish: M = pol(θ_mid, r_l − drop),  drop = r_l(0.14+0.2·ir)`],
 algo:[`Har darajada tokcha fonlari (ravoq + yoy bilan yopiq) navbat rangda`,
       `Ravoq chizig'i yaxlit lenta sifatida`,
       `Osilgan tomchi nuqtalari; rang darajalar bo'ylab lerpColor bilan o'tadi`,
       `Markazda yulduz o'zak`],
 code:`for(let l=0;l<levels;l++){
  const r=R*0.94*Math.pow(0.74,l), m=n+l*2, drop=r*(0.14+ir*0.2);
  for(let i=0;i<m;i++){
    const A=pol(a0,r), B=pol(a1,r), M=pol((a0+a1)/2, r-drop);
    ctx.bezierCurveTo(...,-M...);  // ikki Bezier ravoq A→M→B
  } ribbon(ctx, lerpColor(c0,c1,l/levels), ...); }`,
 par:`<b>sym</b>→bazaviy tokcha soni, <b>cmp</b>→darajalar, <b>ir</b>→osilish chuqurligi`},
katak8:{
 model:`4.8.8 Arximed tessellatsiyasi: har uchda bitta kvadrat + ikki oktagon uchrashadi. Kvadrat uchlari oktagon burchaklaridan olinadi — plitkalar matematik zich yopishadi.`,
 frm:[`s — qadam; oR = s/2/cos(π/8)`,
      `Kvadrat yarim dioganali q ≈ 1.35·(s/2 − oR·cos(π/8))`],
 algo:[`Panjara bo'ylab oktagonlar (fill + lenta kontur, ichida 8-yulduzcha)`,
       `Oraliq nuqtalarda 45° kvadratlar fill`,
       `Doira clip + tashqi halqa (yakka rejimda)`],
 code:`for(let gy=0;gy<=cells;gy++) for(let gx=0;gx<=cells;gx++){
  const x=-half+gx*s, y=-half+gy*s;
  const oct=[]; for(let i=0;i<8;i++)
    oct.push([x+Math.cos(Math.PI/8+TAU*i/8)*oR, y+Math.sin(...)*oR]);
  ctx.beginPath(); polyPath(ctx,oct); fillA(...); ribbon(...); }`,
 par:`<b>dens</b>→katak soni, <b>cmp≥3</b>→ichki yulduzchalar`},
hexa:{
 model:`Asal uyasi (p6m panjara): qatorlar dx/2 siljigan hex to'r; har katak ichida 6 barg rozetkasi.`,
 frm:[`dx = √3·s, dy = 1.5·s;  x = g_x·dx + (g_y mod 2)·dx/2`],
 algo:[`Hex panjara quriladi, kataklar 3 rangda davriy bo'yaladi`,
       `Lenta konturlar; cmp≥4 da har katakka 6 ta barg + markaz nuqta`],
 code:`const pts=[]; for(let i=0;i<6;i++)
  pts.push([x+Math.cos(Math.PI/6+TAU*i/6)*s, y+Math.sin(...)*s]);
polyPath(ctx,pts); fillA(...); ribbon(ctx,c0,edge,bw);`,
 par:`<b>dens</b>→katak o'lchami, <b>cmp≥4</b>→ichki barglar`},
zanjira:{
 model:`Interlock halqalar zanjiri: n ta halqa aylana bo'ylab, radiusi qo'shnilar kesishadigan qilib tanlanadi; har keyingi halqa ribbonI bilan oldingisini "kesib" o'tadi, oxirida bitta yoy zanjirni yopadi.`,
 frm:[`r_r = (π·r_c/n)(0.92 + dens·0.35) — halqa radiusi`,
      `Markazlar: pol(2πi/n − π/2, r_c),  r_c = 0.68R`],
 algo:[`Halqalar ketma-ket ribbonI bilan chiziladi — har biri oldingisining ustidan`,
       `1-halqaning oxirgi halqa tomonidagi yoyi (arcB) qayta ustidan → zanjir yopiladi`,
       `Markazda medalyon: lenta halqa + yulduz`],
 code:`for(let i=0;i<n;i++){
  const c=centers[i];
  ctx.beginPath(); circle(ctx,c[0],c[1],rr);
  ribbonI(ctx, i%2?c1:c0, shade(col,.5), bw); }
arcB(ctx, centers[0][0], centers[0][1], rr, dir-0.7, dir+0.7);
ribbonI(ctx, c0, edge, bw); // zanjirni yopish`,
 par:`<b>sym</b>→halqalar soni, <b>dens</b>→halqa kesishuvi`},
islimiy:{
 model:`Logarifmik spiral novdalar: o'sish qonuni r(θ)=a·e^{bθ}; poya torayuvchi (3 o'tishli qalinlik), barglar tangens burchagida navbatma-navbat, uchida uch bargli palmetta kurtak.`,
 frm:[`r(θ) = a·e^{bθ},  b = 0.1 + spir·0.28,  a = L·e^{−b·θ_max}`,
      `θ_max = π(1.2 + cmp·0.18);  barg burchagi = atan2(Δy,Δx) ± π/2.5`],
 algo:[`spiralPts: θ bo'ylab namuna nuqtalar → Catmull-Rom → kubik Bezier`,
       `stem(): bir yo'l 3 marta kamayuvchi qalinlikda — taper illyuziyasi`,
       `Har k-nuqtada fineLeaf (fill + kontur + o'rta tomir), o'lcham uchga qarab o'sadi`,
       `Oxirida budAt — 3 barg fan; cmp≥3 da qarshi kichik gajak`],
 code:`function spiralPts(b,thMax,L,mir){
  const a=L/Math.exp(b*thMax), pts=[];
  for(let i=0;i<=steps;i++){
    const th=thMax*i/steps, r=a*Math.exp(b*th);
    pts.push([Math.cos(mir*th)*r, Math.sin(mir*th)*r]); }
  return pts; }`,
 par:`<b>sym</b>→novdalar, <b>spir</b>→b (o'ralish), <b>cmp</b>→θ_max, <b>dens</b>→barg zichligi`},
rumi:{
 model:`Klassik rumi (buralgan barg) motivi: 4 kubik Bezierdan iborat ilmoqli yopiq shakl, tok halqasi bo'ylab tashqi-katta / ichki-kichik juftlikda; barglar orasidan chetga S-novdalar chiqadi — tessellatsiyada qo'shnilar bilan tutashadi.`,
 frm:[`Motiv: (0,0)→(0.94L,−0.1L) yuqori yon, ilmoq uchi (0.7L, 0.13L), ichki qaytish → yopiq`,
      `Bog'lovchi novda: r(t)=0.96r_c+(1.06R−0.96r_c)t, θ(t)=θ₀+0.16·sin(πt)·(±1)`],
 algo:[`Tok halqasi lenta bilan`,
       `Har pozitsiyada katta rumi barg (tashqariga) + kichigi (ichkariga), ichida ilmoq chizig'i`,
       `Barglar orasidan chetga S-novda + o'rta va uch barglar`,
       `Markazda yulduz rozetkasi`],
 code:`function rumiLeafPath(ctx,L){
  ctx.moveTo(0,0);
  ctx.bezierCurveTo(L*.12,-L*.36, L*.68,-L*.42, L*.94,-L*.1);
  ctx.bezierCurveTo(L*1.04,L*.04, L*.9,L*.2,  L*.7,L*.13); // ilmoq
  ctx.bezierCurveTo(L*.52,L*.06, L*.42,L*.2,  L*.28,L*.16);
  ctx.bezierCurveTo(L*.12,L*.1,  L*.04,L*.05, 0,0);
  ctx.closePath(); }`,
 par:`<b>sym</b>→motivlar soni, <b>dens</b>→barg o'lchami L, <b>skew</b>→burilish`},
hatayi:{
 model:`Stilizatsiyalangan lotus: har gulbarg 3 Bezier bosqich — keng asos → bel (58% balandlikda) → o'tkir uch; ikki band + urug'don halqasi.`,
 frm:[`Bel nuqtalari: (θ∓0.62w, r_in + 0.58Δr); uch: (θ, r_out)`,
      `m = 5 + [cmp≥3] + [cmp≥5] gulbarg`],
 algo:[`Tashqi m gulbarg (3-segment yo'l) + o'rta tomirlar`,
       `Oraliq kichik gulbarglar (yarim qadam)`,
       `Urug'don: lenta halqa + nuqtalar doirasi + markaz`],
 code:`ctx.moveTo(bl...); // asos chap
ctx.bezierCurveTo(c1..., wl..., wl...);  // asos→bel
ctx.bezierCurveTo(wl..., c2..., tip...); // bel→uch
ctx.bezierCurveTo(c3..., wr..., wr...);  // uch→bel (o'ng)
ctx.bezierCurveTo(wr..., c4..., br...);  // bel→asos`,
 par:`<b>cmp</b>→gulbarg soni, <b>dens</b>→barg eni, <b>sym</b>→urug'don nuqtalari`},
palak:{
 model:`Nilufar: 3 konsentrik gulbarg halqasi jadval bilan beriladi — har halqaning (r_in, r_out, en, siljish, rang) parametrlari; halqalar yarim qadam navbatlashadi.`,
 frm:[`Halqa₁: 0.55R→0.95R;  Halqa₂: 0.32R→0.6R (siljish ½);  Halqa₃: 0.14R→0.36R`],
 algo:[`Har halqada n barg petalPath bilan, fill ranglari navbat`,
       `cmp halqalar sonini boshqaradi; markaz lenta + nuqta`],
 code:`const rings=[{rIn:.55*R,rOut:.95*R,off:0},
             {rIn:.32*R,rOut:.6*R, off:.5},
             {rIn:.14*R,rOut:.36*R,off:0}];
for(const rg of rings) for(let i=0;i<n;i++)
  petalPath(ctx, TAU*(i+rg.off)/n - Math.PI/2, rg.rIn, rg.rOut, rg.w);`,
 par:`<b>sym</b>→barglar, <b>cmp</b>→halqalar soni`},
shamsa:{
 model:`Quyosh medalyoni — 3 band kompozitsiya: markaziy to'ldirilgan yulduz, 2n alanga-nur (uzun/qisqa navbat, tomchi-barg shaklida), tashqi scallop-gulbarg bandi.`,
 frm:[`Nurlar: boshi (θ, 0.4R), uzunligi R·{0.36, 0.22} navbat`,
      `Tashqi band: 2n gulbarg 0.8R→0.955R`],
 algo:[`Tashqi halqa lentasi + gulbarg bandi`,
       `2n nur-barg (leaf, 2 Bezier) — juftlari uzun`,
       `Markaz: lenta halqa + katta yulduz fill + ichki qarama-qarshi yulduzcha`],
 code:`for(let i=0;i<n*2;i++){
  const a=TAU*i/(n*2)-Math.PI/2, long=i%2===0;
  const s0=pol(a, R*0.4), len=R*(long?0.36:0.22);
  ctx.beginPath(); leaf(ctx,s0[0],s0[1],a,len,len*0.14);
  fillA(ctx, long?c0:c2, 0.9); }`,
 par:`<b>sym</b>→n (nurlar = 2n)`},
arabesk:{
 model:`Ogee (S-egri) to'ri: ichki n tugundan tashqi (yarim qadam siljigan) n tugunga ikki oila S-egri — nazorat nuqtalari o'rta chiziqning normali bo'ylab ±offset siljitiladi; tutashuvlarda palmetta.`,
 frm:[`S-egri nazorat: 0.6A+0.4M ± n̂·off,  off = 0.09R(0.6+spir)`,
      `Tugunlar: ichki (θ_i, 0.4R), tashqi (θ_i+π/n, 0.88R)`],
 algo:[`Birinchi oila (+off) lenta, ikkinchi oila (−off) ribbonI — kesishuvda to'qiladi`,
       `Tashqi tugunlarda budAt palmetta, ichkilarida barg juftligi`,
       `Markaz halqa + yulduz`],
 code:`ctx.moveTo(A[0],A[1]);
ctx.bezierCurveTo(
  A[0]*.6+mx*.4 + nx/L*off, A[1]*.6+my*.4 + ny/L*off,
  B[0]*.6+mx*.4 - nx/L*off, B[1]*.6+my*.4 - ny/L*off,
  B[0], B[1]);`,
 par:`<b>sym</b>→tugunlar, <b>spir</b>→S-egri chuqurligi`},
scroll:{
 model:`Bargli novda: asosiy S-poya bitta kubik Bezier; barglar egri bo'ylab B(t) formulasidan namuna olinib, tangens burchagiga ±π/2.3 da navbatlashadi; uchida log-spiral gajak.`,
 frm:[`B(t) = (1−t)³P₀ + 3(1−t)²tP₁ + 3(1−t)t²P₂ + t³P₃`,
      `Barg burchagi: atan2(B(t+ε)−B(t)) ± π/2.3`],
 algo:[`P₀…P₃ nazorat nuqtalari (S-shakl) → stem taper bilan`,
       `t_j = j/(m+1) da cubicAt namunalar, fineLeaf navbat tomonlarda, o'lcham t bilan o'sadi`,
       `Uchida spiralPts gajak`],
 code:`function cubicAt(p0,p1,p2,p3,t){ const u=1-t;
 return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],
         u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]; }`,
 par:`<b>sym</b>→novdalar, <b>dens</b>→barg soni, <b>spir</b>→barg o'lchami, <b>skew</b>→S chuqurligi`},
medallion:{
 model:`Ko'p bandli medalyon — kompozitsion model: tashqi lenta halqa → scallop (chig'anoq) band → gulbarg band → markazda 0.5 masshtabda to'liq girih rozetta chaqiriladi.`,
 frm:[`Scallop: har segment A→M(0.82R)→B ikki Bezier;  gulbarglar 0.5R→0.8R`],
 algo:[`4 band tashqaridan ichkariga ketma-ket`,
       `drawGirih(ctx, R·0.95, …) 0.5 masshtabli kontekstda qayta ishlatiladi — kod kompozitsiyasi`],
 code:`ctx.save(); ctx.scale(0.5,0.5);
drawGirih(ctx, R*0.95, {...p, sym:n}, sw*1.6, c0,c1,c2,c3);
ctx.restore();`,
 par:`girih parametrlarining barchasi ichki o'zakka o'tadi`},
gi:{model:`Yuqori tartibli funksiya kompozitsiyasi: makeCombo(fA,fB) — tashqi uslub to'liq R da, ichki uslub 0.5 masshtab + yarim qadam burilish bilan chiziladi. Bu yerda: Girih (tashqi) + Islimiy (ichki).`,
 frm:[`f(ctx) = fA(ctx,R) ∘ [scale(0.5)·rot(π/n)] fB(ctx,R)`],
 algo:[`fA chaqiriladi`,`Kontekst 0.5 ga masshtablanadi, π/n ga buriladi`,`fB rang juftlari almashgan holda chaqiriladi`],
 code:`function makeCombo(fA,fB){
 return function(ctx,R,p,sw,c0,c1,c2,c3){
   fA(ctx,R,p,sw,c0,c1,c2,c3);
   ctx.save(); ctx.scale(0.5,0.5); ctx.rotate(Math.PI/p.sym);
   fB(ctx,R,p,sw*1.7, c1,c0,c3,c2);
   ctx.restore(); }; }`,
 par:`ikkala uslubning parametrlari birga ishlaydi`},
sg:{model:`makeCombo(Shamsa, Girih): tashqi quyosh medalyoni ichida 0.5 masshtabda girih yulduz-tugun.`,frm:[`f = Shamsa ∘ scale(0.5)·Girih`],algo:[`Shamsa to'liq R da`,`Girih 0.5R da yarim qadam burilib`],code:`makeCombo(drawShamsa, drawGirih)`,par:`ikkala uslub parametrlari`},
mi:{model:`makeCombo(Muqarnas, Islimiy): pog'onali arkada ichida spiral novdalar.`,frm:[`f = Muqarnas ∘ scale(0.5)·Islimiy`],algo:[`Muqarnas darajalari`,`Islimiy spirallari markazda`],code:`makeCombo(drawMuqarnas, drawIslimiy)`,par:`ikkala uslub parametrlari`},
xr:{model:`makeCombo(Xatam, Rumi): xatam yulduzi ichida rumi barglari halqasi.`,frm:[`f = Xatam ∘ scale(0.5)·Rumi`],algo:[`Xatam ramkasi`,`Rumi halqasi markazda`],code:`makeCombo(drawXatam, drawRumi)`,par:`ikkala uslub parametrlari`},
celtic:{
 model:`Ikki tolali torus o'rmasi (plait): tolalar r(θ)=r_m + a·sin(kθ+φ) sinusoid halqalar, φ∈{0,π}; kesishishlar sin=0 nuqtalarida; har tola 2k segmentga bo'linib, (tola+j) juftligi bo'yicha ost/ust tartibida chiziladi — matematik aniq navbatlashgan to'qish.`,
 frm:[`r_A(θ)=r_m+a·sin(kθ), r_B(θ)=r_m+a·sin(kθ+π)`,
      `Kesishishlar: θ_j = jπ/k,  j = 0…2k−1`,
      `Ust/ost: (strand + j) mod 2`],
 algo:[`Har tola θ∈[jπ/k,(j+1)π/k] segmentlarga bo'linadi (smoothPath)`,
       `1-o'tish: juft paritetli segmentlar oddiy lenta (ostda)`,
       `2-o'tish: toq paritetlilar ribbonI (fon-uzilish) bilan ustida`,
       `Ichki/tashqi chegara bandlari`],
 code:`for(let pass=0; pass<2; pass++)
 for(let strand=0; strand<2; strand++)
  for(let j=0; j<2*k; j++){
    if(((strand+j)%2)!==pass) continue;
    strandSeg(strand*Math.PI, j);
    pass ? ribbonI(ctx,col,edge,bw) : ribbon(ctx,col,edge,bw); }`,
 par:`<b>sym</b>→k (kesishishlar), <b>dens</b>→amplituda a va band eni`},
mandala:{
 model:`Konsentrik halqalar generatori: halqa indeksi k bo'yicha element turi kind = k mod 5 davriy almashadi — nuqtalar, gulbarglar, to'lqinli kontur, barglar, doira.`,
 frm:[`r_k = R(0.12 + 0.85·k/(K−1));  m_k = n(1 + 1.5k/K)`,
      `To'lqin: r(θ) = r_k(1 + 0.035·sin(mθ + k))`],
 algo:[`K = 6…12 halqa (cmp+dens dan)`,`Har halqada kind bo'yicha element chiziladi`,`Ranglar 4 lik siklda`],
 code:`for(let k=0;k<rings;k++){
  const r=R*(0.12+0.85*k/(rings-1)), kind=k%5;
  if(kind===1) /* gulbarglar */ petalPath(...);
  else if(kind===2) /* to'lqin */ smoothPath(ctx, wavePts, true);
  ... }`,
 par:`<b>sym</b>→bazaviy m, <b>cmp,dens</b>→halqalar soni, <b>spir</b>→barg o'lchami`},
penrose:{
 model:`P2 aperiodik qoplama — Robinson uchburchaklari subdividesi: har "qizil" uchburchak 2 ga, har "ko'k" 3 ga bo'linadi, bo'lish nuqtalari oltin nisbat φ bilan; boshlanish — 10 uchburchakli g'ildirak.`,
 frm:[`φ = (1+√5)/2 ≈ 1.618;  P = A + (B−A)/φ`,
      `Qizil → {(C,P,B), ko'k(P,C,A)};  Ko'k → {ko'k(R,C,A), qizil(Q,R,B), ko'k(R,Q,A)}`],
 algo:[`10 ta yarim-uchburchak g'ildiragi (har ikkinchisi aks)`,
       `depth = cmp marta subdivide`,
       `Turi bo'yicha 2 rangda fill + ingichka kontur`],
 code:`for(const [ty,A,B,C] of tris){
  if(ty===0){ const P=div(A,B,PHI);
    next.push([0,C,P,B],[1,P,C,A]); }
  else { const Q=div(B,A,PHI), R2=div(B,C,PHI);
    next.push([1,R2,C,A],[0,Q,R2,B],[1,R2,Q,A]); } }`,
 par:`<b>cmp</b>→rekursiya chuqurligi (uchburchaklar ~ 3.6^cmp)`},
zellige:{
 model:`Marokash kafeli: romb panjara, har rombning 4 tomoni navbatma-navbat ichkari/tashqariga bo'rtgan Bezier; 5 rang (g_x + 2g_y) mod 5 davriyligida.`,
 frm:[`Markazlar: x=(g_x+g_y)·0.8s, y=(g_y−g_x)·0.5s`,
      `Bo'rtish: nazorat = o'rta + n̂·bow·(−1)^i,  bow = 0.2s(0.4+spir)`],
 algo:[`Romb panjara quriladi`,`curvedQuad: 4 Bezier tomon, ishorasi almashib`,`5 rangli fill + kontur`],
 code:`for(let i=0;i<4;i++){ const A=q[i], B=q[(i+1)%4];
  const sgn = i%2 ? 1 : -1;
  const cx2 = mx + nx/L*bow*sgn, cy2 = my + ny/L*bow*sgn;
  ctx.bezierCurveTo(A+0.7(c-A)..., B+0.7(c-B)..., B[0],B[1]); }`,
 par:`<b>dens</b>→panjara zichligi, <b>spir</b>→bo'rtish, <b>cmp≥5</b>→markaz nuqtalari`},
batik:{
 model:`To'lqin modulyatsiyali konsentrik halqalar: r(θ) = r_k + A·sin(nθ + φ_k); nuqtalar Catmull-Rom orqali kubik Bezierga aylantiriladi; oraliqlarda 5-nuqtali gul motivlari.`,
 frm:[`r(θ) = r_k + A·sin(nθ + 1.3k + skew),  A = 0.035R(0.6+dens)`],
 algo:[`K = 3+cmp halqa, har biri ≥48 namunali smoothPath`,`Toq halqalar orasida gul-nuqtalar`,`Ranglar navbat`],
 code:`const pts=[];
for(let i=0;i<steps;i++){ const a=TAU*i/steps;
  pts.push(pol(a, rk + A*Math.sin(n*a + k*1.3))); }
ctx.beginPath(); smoothPath(ctx, pts, true); st(ctx,col,w);`,
 par:`<b>sym</b>→to'lqin chastotasi n, <b>cmp</b>→halqalar, <b>dens</b>→amplituda, <b>skew</b>→faza`},
paisley:{
 model:`Boteh (buta): 4 kubik Bezierdan asimmetrik, uchi ilmoqli tomchi; ichida log-spiral, ichki hoshiya konturi (0.82 masshtab), uchida 5-nuqta gul, chetida nuqta bezaklar.`,
 frm:[`Kontur: (0, .5L)→(−W,−.35L)→ilmoq(.38W,−.6L)→(.12W,−.28L)→yopiq`,
      `Ichki spiral: r=a·e^{(0.16+0.2spir)θ}`],
 algo:[`n pozitsiyaga buriladi/siljiydi`,`Boteh fill + ribbonI + 0.82 masshtabli ichki kontur`,`Spiral, uch guli, cmp≥4 da chet nuqtalari`],
 code:`ctx.moveTo(0, L*0.5);
ctx.bezierCurveTo(-W, L*.5, -W, -L*.35, -W*.25, -L*.62);
ctx.bezierCurveTo(-W*.05,-L*.75, W*.3,-L*.78, W*.38,-L*.6);
ctx.bezierCurveTo(W*.44,-L*.46, W*.1,-L*.42, W*.12,-L*.28);
ctx.bezierCurveTo(W*.55,-L*.05, W*.62, L*.32, 0, L*.5);`,
 par:`<b>sym</b>→butalar, <b>dens</b>→o'lcham, <b>spir</b>→ichki spiral, <b>cmp≥4</b>→chet nuqtalari`},
greek:{
 model:`Meander (labirint): birlik "kalit" yo'li 8 nuqtali lokal koordinatalarda beriladi va affin almashtirish bilan har tomonga u marta takrorlanadi; ramkalar konsentrik.`,
 frm:[`Birlik: [(0,0),(.72,0),(.72,.72),(.24,.72),(.24,.3),(.48,.3),(.48,.52),(1,.52)]`,
      `Nuqta = B + d̂·x + n̂·h·y  (d̂ — tomon yo'nalishi, n̂ — ichki normal)`],
 algo:[`K ramka, har birida 4 tomon`,`Har tomonda u birlik meander affin ko'chiriladi`,`Markazda 4-yulduz`],
 code:`for(const q of unit){
  ctx.lineTo(bx + dx*q[0] + hx*q[1],
             by + dy*q[0] + hy*q[1]); }`,
 par:`<b>sym,dens</b>→birliklar soni, <b>cmp</b>→ramkalar, <b>ir</b>→markaz yulduzi`},
xitoy:{
 model:`Fretwork panjara: kvadrat kataklar to'ri, har katakda T-motiv (gx+gy) mod 4 · 90° buralgan; burchak qavslar bilan boyitiladi.`,
 frm:[`T: tik (0,−t)→(0,.2t), gorizontal (∓b,.2t), oyoqlar (∓b,.2t)→(∓b,.62t)`],
 algo:[`Tashqi ramka + panjara chiziqlari`,`Har katak markazida buralgan T`,`cmp≥4 da burchak qavslar`],
 code:`ctx.save(); ctx.translate(cx,cy);
ctx.rotate(((gx+gy)%4)*Math.PI/2);
ctx.moveTo(0,-tLen); ctx.lineTo(0,tLen*0.2);
ctx.moveTo(-tBar,tLen*0.2); ctx.lineTo(tBar,tLen*0.2); ...`,
 par:`<b>dens</b>→kataklar, <b>ir</b>→T o'lchami, <b>skew</b>→burilish, <b>cmp≥4</b>→qavslar`},
koch:{
 model:`Koch qor parchasi — IFS/rekursiv almashtirish: har segment 4 ga bo'linadi, o'rtadagi ikkitasi 60° uchburchak yasaydi. Fraktal o'lcham D = log4/log3.`,
 frm:[`P₂ = P₁ + Rot(−60°)·(B−A)/3;  D = log 4 / log 3 ≈ 1.262`],
 algo:[`Teng tomonli uchburchakdan boshlanadi`,`depth marta: har segment → 4 segment`,`Yopiq kontur fill + lenta`],
 code:`const ang = Math.atan2(dy,dx) - Math.PI/3;
const P2 = [P1[0]+Math.cos(ang)*L, P1[1]+Math.sin(ang)*L];
next.push(A, P1, P2, P3);`,
 par:`<b>cmp</b>→rekursiya (segmentlar 3·4^cmp)`},
sierpinski:{
 model:`Sierpinski uchburchagi: o'rta nuqtalar orqali 3 kichik uchburchakka rekursiv bo'linish; D = log3/log2.`,
 frm:[`mid(U,V) = (U+V)/2;  D = log 3 / log 2 ≈ 1.585`],
 algo:[`depth=0 da uchburchak fill`,`Aks holda 3 burchak uchburchagiga rekursiya`],
 code:`const rec=(a,b,c,d)=>{
  if(d===0){ polyPath(ctx,[a,b,c]); fillA(...); return; }
  rec(a, mid(a,b), mid(a,c), d-1);
  rec(mid(a,b), b, mid(b,c), d-1);
  rec(mid(a,c), mid(b,c), c, d-1); };`,
 par:`<b>cmp</b>→chuqurlik (3^cmp uchburchak)`},
dragon:{
 model:`Heighway ajdar egri — L-sistema: F→F+G, G→F−G, burilish ±90°; satr iteratsiyadan keyin chelakdek yig'ilib, chegara qutisiga masshtablanadi.`,
 frm:[`Uzunlik: 2^N segment;  burchak ±π/2`,
      `Fit: masshtab = 1.7R / max(Δx, Δy)`],
 algo:[`Satr N marta qayta yoziladi`,`Toshbaqa-yurish: F/G oldinga, +/− burilish`,`Bounding box → markazlash va masshtab`],
 code:`for(const ch of seq){
  if(ch==='F'||ch==='G'){ x+=Math.cos(ang); y+=Math.sin(ang);
    pts.push([x,y]); }
  else if(ch==='+') ang += Math.PI/2;
  else if(ch==='-') ang -= Math.PI/2; }`,
 par:`<b>cmp</b>→iteratsiyalar (8+cmp)`},
hilbert:{
 model:`Hilbert fazoni to'ldiruvchi egri: d-indeksdan (x,y) ga Gray-kod asosidagi iterativ almashtirish (kvadrant aniqlash + aks/burish); 4^order nuqta ketma-ket ulanadi.`,
 frm:[`N = 2^order;  d ∈ [0, N²)`,
      `Har bosqichda: r_x=1&(t/2), r_y=1&(t⊕r_x); r_y=0 bo'lsa aks+almashtirish`],
 algo:[`d = 0…N²−1 uchun d2xy hisoblanadi`,`Nuqtalar polyline bilan ulanadi`,`Markazlash va masshtab`],
 code:`const d2xy=(d)=>{ let rx,ry,t=d,x=0,y=0;
 for(let s=1;s<N;s*=2){
   rx=1&(t/2); ry=1&(t^rx);
   if(ry===0){ if(rx===1){x=s-1-x;y=s-1-y;}
     const tmp=x; x=y; y=tmp; }
   x+=s*rx; y+=s*ry; t=Math.floor(t/4); }
 return [x,y]; };`,
 par:`<b>cmp</b>→order (nuqtalar 4^order)`},
spirograph:{
 model:`Epitrochoid — g'ildirak ichida g'ildirak: R₀ radiusli halqa ichida r g'ildirak dumalaydi, qalam d masofada; kNum/kDen nisbat necha aylanishda yopilishini belgilaydi.`,
 frm:[`x = (R₀−r)cos t + d·cos((R₀−r)t/r)`,
      `y = (R₀−r)sin t − d·sin((R₀−r)t/r)`,
      `r = R₀·kNum/kDen;  yopilish: t ∈ [0, 2π·kDen]`],
 algo:[`t bo'ylab zich namunalar`,`Max radiusga qarab masshtab`,`smoothPath (Catmull→Bezier) bilan silliq chiziladi`],
 code:`for(let i=0;i<=steps;i++){
  const t=TAU*loops*i/steps;
  pts.push([(R0-r)*Math.cos(t)+d*Math.cos((R0-r)*t/r),
            (R0-r)*Math.sin(t)-d*Math.sin((R0-r)*t/r)]); }`,
 par:`<b>sym,cmp</b>→kNum/kDen nisbati, <b>spir</b>→d (qalam masofasi)`},
lissajous:{
 model:`Lissaju figurasi: ikki perpendikulyar garmonik tebranish superpozitsiyasi; a:b chastota nisbati figura turini, δ faza siljishi shaklini belgilaydi.`,
 frm:[`x = A·sin(a·t + δ),  y = B·sin(b·t)`,
      `δ = (π/2)(1 + skew)`],
 algo:[`400 namunali yopiq smoothPath`,`dens>0.5 da 0.7 masshtabli ikkinchi kontur`],
 code:`for(let i=0;i<=steps;i++){ const t=TAU*i/steps;
  pts.push([R*Math.sin(a*t+del), R*Math.sin(b*t)]); }
smoothPath(ctx, pts, true);`,
 par:`<b>sym</b>→a, <b>cmp</b>→b−a, <b>skew</b>→δ, <b>dens</b>→ikkinchi kontur`},
voronoi:{
 model:`Voronoi diagrammasi yarim-tekislik kesish usulida: har seed hujayrasi boshlang'ich 16-burchakdan boshlab, boshqa har bir seed bilan o'rta perpendikulyar bo'ylab Sutherland–Hodgman kesish orqali olinadi. Seedlar deterministik PRNG (mulberry32) dan — bir xil parametrlar = bir xil mozaika.`,
 frm:[`Hujayra(S) = ∩_T { q : (q−M)·(T−S) ≤ 0 },  M=(S+T)/2`,
      `PRNG urug'i: 1000 + 31·sym + 7·cmp + 13·⌊100·dens⌉ + …`],
 algo:[`m = 8+4cmp+14dens seed doira ichida (√ taqsimot)`,
       `Har seed uchun poligon barcha bisektorlar bilan kesiladi`,
       `5 palitra rangida fill + kontur`],
 code:`function clipHalfPlane(poly, px,py, nx,ny){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const A=poly[i], B=poly[(i+1)%poly.length];
    const da=(A[0]-px)*nx+(A[1]-py)*ny;
    const db=(B[0]-px)*nx+(B[1]-py)*ny;
    if(da<=0) out.push(A);
    if(da*db<0){ const t=da/(da-db);
      out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); } }
  return out; }`,
 par:`<b>sym,cmp,dens,spir</b>→PRNG urug'i va seedlar soni`}
};
function buildTheory(){
  const wrap = $('theory-wrap');
  if(!wrap) return;
  let html = '<h1>Naqsh matematikasi va algoritmlari</h1>' +
    '<p class="lead">Har bir naqshni oching: qaysi <b>model</b>, qaysi <b>formulalar</b> va qanday <b>kod</b> uni hosil qilayotganini jonli preview bilan birga ko\'rasiz. Barcha kod parchalari platformaning haqiqiy manbasidan olingan.</p>';
  /* ===== Umumiy qurilish bloklari ===== */
  html += '<div class="th-card"><h3>Umumiy qurilish bloklari — barcha naqshlar shulardan quriladi</h3>' +
    '<div class="th-item"><b>Qutb koordinatalari:</b> <span class="formula">pol(θ, r) = (r·cos θ, r·sin θ)</span> — n-karra simmetriya θ_i = 2πi/n burchaklarida takrorlash orqali olinadi.</div>' +
    '<div class="th-item"><b>Kubik Bezier:</b> <span class="formula">B(t) = (1−t)³P₀ + 3(1−t)²tP₁ + 3(1−t)t²P₂ + t³P₃</span> — barcha organik egri chiziqlarning yagona asosi; hatto doiralar ham 4 Bezier segment (k = 0.5523·r nazorat masofasi) bilan chiziladi, shuning uchun SVG eksportda faqat C buyruqlari chiqadi.</div>' +
    '<div class="th-item"><b>Catmull-Rom → Bezier:</b> nuqtalar orqali silliq egri: nazorat nuqtalari <span class="formula">C₁ = P₁ + (P₂−P₀)/6, C₂ = P₂ − (P₃−P₁)/6</span> — spiral, to\'lqin va epitrochoidlarda ishlatiladi (smoothPath).</div>' +
    '<div class="th-item"><b>Lenta (ribbon):</b> bitta yo\'l 3 marta chiziladi — qora hoshiya (w), band rangi (w−max(1.8, 0.42w)), glazur yaltirog\'i (0.14w) — haqiqiy strapwork ko\'rinishi.</div>' +
    '<div class="th-item"><b>Interlacing (to\'qish):</b> ribbonI avval fon rangida kengroq (w+0.55w) chizadi — ostidagi lenta kesishuvda "uziladi", ustidan o\'tish effekti tug\'iladi. Chizish tartibi (2 o\'tish, paritet bo\'yicha) navbatlashgan weave beradi.</div>' +
    '<div class="th-item"><b>Nur kesishmasi:</b> <span class="formula">rayX: P+t·d̂ = Q+u·ê → t = ((Q−P)×ê)/(d̂×ê)</span> — girih va Hankin straplarining yuragi.</div>' +
    '<div class="th-item"><b>Qatlamlash:</b> qatlamlar ichma-ich medalyonlar: masshtab 0.42^l, burilish (l mod 2)·π/n — yarim qadam qatlamlarni interlock qiladi, ustma-ust loyqa bo\'lmaydi.</div>' +
    '<div class="th-item"><b>Tessellatsiya:</b> <span class="formula">T(n,m) = n·v₁ + m·v₂</span>; p4: v₁=(c,0), v₂=(0,c); p6: v₂=(c/2, c√3/2); p4m/p6m — shaxmat ko\'zgusi. Panjara-naqshlar (Hankin, Katak-8, Zellige…) uzluksiz yaxlit maydon sifatida, medalyonlar bleed (R_tile = 0.62c &gt; c/2) bilan chiziladi.</div>' +
    '<div class="th-item"><b>SVG/DXF eksport:</b> soxta kontekst (SvgCtx) har bezierCurveTo ni 2×3 affin matritsa steki orqali kuzatib SVG C buyrug\'iga yozadi; arc() 4/3·tan(Δθ/4) formulasi bilan Bezierga aylanadi; DXF uchun Bezier 32 nuqtali LWPOLYLINE ga tabaqalanadi.</div>' +
    '</div>';
  Object.keys(CATS).forEach(cat=>{
    html += '<h2 class="th-cat">' + CATS[cat] + '</h2>';
    PATTERNS.filter(pt=>pt.cat===cat).forEach(pt=>{
      const T = THEORY[pt.id] || {};
      const modelTxt = T.model || pt.th;
      html += '<details class="th-pat" data-id="'+pt.id+'"><summary>' +
        '<canvas data-pt="'+pt.id+'" width="200" height="200"></canvas>' +
        '<span class="th-head"><b>'+pt.nm+'</b><em>'+modelTxt+'</em></span>' +
        '<span class="th-open">＋</span></summary><div class="th-body">';
      if(T.frm && T.frm.length){
        html += '<h5>Matematik formulalar</h5>';
        T.frm.forEach(f=>{ html += '<div class="frm">'+escHTML(f)+'</div>'; });
      }
      if(T.algo && T.algo.length){
        html += '<h5>Algoritm</h5><ol class="algo">';
        T.algo.forEach(a=>{ html += '<li>'+a+'</li>'; });
        html += '</ol>';
      }
      if(T.code){
        html += '<h5>Kod (platforma manbasidan)</h5><pre class="code">'+escHTML(T.code)+'</pre>';
      }
      if(T.par){
        html += '<div class="th-par">🎛 <b>Slayderlar:</b> '+T.par+'</div>';
      }
      html += '<button class="btn sm gold th-studio" data-id="'+pt.id+'" style="margin-top:12px">✦ Studio da sinab ko\'rish</button>';
      html += '</div></details>';
    });
  });
  wrap.innerHTML = html;
  renderTheoryCanvases(wrap);
  wrap.addEventListener('click', e=>{
    const b = e.target && e.target.closest ? e.target.closest('.th-studio') : null;
    if(!b) return;
    P.type = b.dataset.id;
    syncSliders();
    redraw(true);
    showPage('studio');
    ntf(getPattern(P.type).nm + ' — Studio da ochildi', 'ok');
  });
}
function renderTheoryCanvases(wrap){
  const list = wrap.querySelectorAll ? wrap.querySelectorAll('canvas[data-pt]') : [];
  const keepBg = P._bg;
  Array.prototype.forEach.call(list, cnv=>{
    const octx = cnv.getContext ? cnv.getContext('2d') : null;
    if(!octx) return;
    const id = cnv.dataset ? cnv.dataset.pt : null;
    const pal = PAL.gold;
    P._bg = pal.bg;
    octx.fillStyle = pal.bg;
    octx.fillRect(0,0,200,200);
    try{
      drawPattern(octx, 100, 100, 92, {
        type:id, sym:8, cmp:4, sw:1.7, ir:0.38, spir:0.4,
        dens:0.55, lay:1, skew:0, rot:0, pal:'gold', fill:'dual'
      });
    }catch(e){}
  });
  P._bg = keepBg;
}

/* ============================================================
   NAVIGATSIYA + INIT
   ============================================================ */
function showPage(name){
  document.querySelectorAll('.page').forEach(pg=>{
    pg.classList.toggle('active', pg.id === 'page-'+name);
  });
  document.querySelectorAll('nav.tabs button').forEach(b=>{
    b.classList.toggle('active', b.dataset.page === name);
  });
  if(name !== 'ar' && arActive) stopAR(); /* sahifadan chiqilganda kamera o'chadi */
  if(name === '3d'){ init3D(); if(threeReady) update3DTexture(); }
  if(name === 'studio') setTimeout(resizeCanvas, 30);
}
function wireUI(){
  const tabs = $('tabs');
  if(tabs) tabs.addEventListener('click', e=>{
    const b = e.target.closest('button');
    if(b && b.dataset.page) showPage(b.dataset.page);
  });
  /* accordion */
  document.querySelectorAll('.acc > .acc-h').forEach(h=>{
    h.addEventListener('click', ()=>{
      const acc = h.parentNode;
      if(acc) acc.classList.toggle('open');
    });
  });
  /* mobil sheet */
  const sideT = $('side-toggle'), side = $('side');
  if(sideT && side) sideT.addEventListener('click', ()=> side.classList.toggle('open'));
  /* studio boshqaruvlari */
  const rndB = $('btn-random'); if(rndB) rndB.addEventListener('click', randomize);
  const saveB = $('btn-save'); if(saveB) saveB.addEventListener('click', saveCurrent);
  const fillSel = $('sel-fill'); if(fillSel) fillSel.addEventListener('change', ()=>{ P.fill = fillSel.value; PIC_TILE_CACHE = {}; redraw(); });
  const tessChk = $('chk-tess'); if(tessChk) tessChk.addEventListener('change', ()=>{ TESS.on = tessChk.checked; redraw(); });
  const tessSel = $('sel-tess'); if(tessSel) tessSel.addEventListener('change', ()=>{ TESS.group = tessSel.value; if(TESS.on) redraw(); });
  const cellSl = $('sl-cell'); if(cellSl) cellSl.addEventListener('input', ()=>{
    TESS.cell = parseInt(cellSl.value,10);
    const v = $('v-cell'); if(v) v.textContent = TESS.cell+'px';
    if(TESS.on) redraw();
  });
  const cellB = $('chk-cellb'); if(cellB) cellB.addEventListener('change', ()=>{ TESS.showCell = cellB.checked; if(TESS.on) redraw(); });
  const bleedB = $('chk-bleed'); if(bleedB) bleedB.addEventListener('change', ()=>{ TESS.bleed = bleedB.checked; if(TESS.on) redraw(); });
  const nrB = $('chk-noring'); if(nrB) nrB.addEventListener('change', ()=>{ TESS.noring = nrB.checked; if(TESS.on) redraw(); });
  const g3 = $('sel-3dgrid'); if(g3) g3.addEventListener('change', ()=>{
    if(g3.value === 'off'){ T3D.tess = false; }
    else { T3D.tess = true; T3D.group = g3.value; }
    if(threeReady) update3DTexture();
  });
  /* eksport modal */
  const expB = $('btn-export'); if(expB) expB.addEventListener('click', openExport);
  const expC = $('exp-cancel'); if(expC) expC.addEventListener('click', closeExport);
  const expG = $('exp-go'); if(expG) expG.addEventListener('click', doExport);
  const back = $('modal-export'); if(back) back.addEventListener('click', e=>{ if(e.target===back) closeExport(); });
  segWire('exp-format','format',false);
  segWire('exp-format2','format',false);
  segWire('exp-size','size',true);
  segWire('exp-dpi','dpi',true);
  segWire('exp-jqsize','jqsize',true);
  segWire('exp-jqgroup','jqgroup',false);
  segWire('exp-jqdepth','jqdepth',true);
  segWire('exp-mm','mm',true);
  segWire('exp-fill','fill',false);
  /* Tayyor o'lchamni bosganda raqamli maydonlar ham yangilanadi —
     shunda foydalanuvchi qaysi qiymat ketayotganini har doim ko'radi. */
  const linkSeg = (segId, aId, bId)=>{
    const box = $(segId); if(!box) return;
    box.addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      const v = b.dataset.v;
      const a = $(aId), c = $(bId);
      if(a){ a.value = v; delete a.dataset.touched; }
      if(c){ c.value = v; delete c.dataset.touched; }
    });
  };
  linkSeg('exp-mm',     'exp-mm-w', 'exp-mm-h');
  linkSeg('exp-size',   'exp-px-w', 'exp-px-h');
  linkSeg('exp-jqsize', 'exp-jq-c', null);
  /* Raqam qo'lda o'zgartirilsa — tayyor tugmalardan tanlovni olib tashlaymiz,
     chunki endi qiymat ularnikiga mos kelmasligi mumkin. */
  const unsel = (inputIds, segId)=>{
    for(const id of inputIds){
      const el = $(id); if(!el) continue;
      el.addEventListener('input', ()=>{
        el.dataset.touched = '1';
        const box = $(segId); if(!box) return;
        const a = $(inputIds[0]), b = inputIds[1] ? $(inputIds[1]) : null;
        const same = a && (!b || a.value === b.value) ? a.value : null;
        box.querySelectorAll('button').forEach(x=>{
          x.classList.toggle('sel', same !== null && x.dataset.v === same);
        });
        if(segId === 'exp-jqsize'){
          const v = parseInt(el.value, 10);
          if(isFinite(v)){ EXP.jqsize = Math.min(4096, Math.max(32, v)); expJqInfo(); }
        }
      });
    }
  };
  unsel(['exp-mm-w','exp-mm-h'], 'exp-mm');
  unsel(['exp-px-w','exp-px-h'], 'exp-size');
  unsel(['exp-jq-c'], 'exp-jqsize');
  /* 3D */
  const objSel = $('sel-obj'); if(objSel) objSel.addEventListener('change', ()=>{ if(threeReady) setObject(objSel.value); });
  const lightSel = $('sel-light'); if(lightSel) lightSel.addEventListener('change', ()=>{ if(threeReady) setLights(lightSel.value); });
  const rotB = $('btn-rotate'); if(rotB) rotB.addEventListener('click', ()=>{
    if(!threeReady){ ntf('3D hali yuklanmadi', 'err'); return; }
    T3.auto = !T3.auto;
    rotB.textContent = T3.auto ? '⏸ To\'xtatish' : '⟳ Avto-aylanish';
  });
  const shotB = $('btn-shot'); if(shotB) shotB.addEventListener('click', screenshot3D);
  const paintB = $('btn-paint'); if(paintB) paintB.addEventListener('click', animatePaint3D);
  const photoB = $('btn-photo'), photoF = $('photo-file');
  if(photoB && photoF) photoB.addEventListener('click', ()=> photoF.click());
  if(photoF) photoF.addEventListener('change', ()=>{
    const f = photoF.files && photoF.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        PH.img = img;
        const panel = $('photo-panel'); if(panel) panel.hidden = false;
        if(threeReady) update3DTexture();
        ntf('Rasm ramkaga joylandi 🖼', 'ok');
      };
      img.onerror = ()=> ntf('Rasm ochilmadi', 'err');
      img.src = reader.result;
    };
    reader.onerror = ()=> ntf('Fayl o\'qilmadi', 'err');
    reader.readAsDataURL(f);
    photoF.value = '';
  });
  const frameSel = $('sel-frame'); if(frameSel) frameSel.addEventListener('change', ()=>{ PH.shape = frameSel.value; if(threeReady) update3DTexture(); });
  const psize = $('sl-psize'); if(psize) psize.addEventListener('input', ()=>{
    PH.size = parseInt(psize.value,10);
    const v = $('v-psize'); if(v) v.textContent = PH.size+'%';
    if(threeReady) update3DTexture();
  });
  const pframe = $('sl-pframe'); if(pframe) pframe.addEventListener('input', ()=>{
    PH.frame = parseInt(pframe.value,10);
    const v = $('v-pframe'); if(v) v.textContent = PH.frame;
    if(threeReady) update3DTexture();
  });
  const ptext = $('inp-ptext'); if(ptext) ptext.addEventListener('input', ()=>{
    PH.text = ptext.value;
    if(threeReady) update3DTexture();
  });
  const pdate = $('inp-pdate'); if(pdate) pdate.addEventListener('input', ()=>{
    PH.date = pdate.value;
    if(threeReady) update3DTexture();
  });
  const photoDel = $('btn-photo-del'); if(photoDel) photoDel.addEventListener('click', ()=>{
    PH.img = null;
    const panel = $('photo-panel'); if(panel) panel.hidden = true;
    if(threeReady) update3DTexture();
    ntf('Rasm o\'chirildi', 'ok');
  });
  /* AR */
  const arStart = $('btn-ar-start'); if(arStart) arStart.addEventListener('click', startAR);
  const arSim = $('btn-ar-sim'); if(arSim) arSim.addEventListener('click', startARSim);
  const arStop = $('btn-ar-stop'); if(arStop) arStop.addEventListener('click', stopAR);
  const arCap = $('btn-ar-capture'); if(arCap) arCap.addEventListener('click', captureAR);
  const arSurf = $('ar-surface'); if(arSurf) arSurf.addEventListener('change', ()=>{ AR.surface = arSurf.value; });
  const arOp = $('ar-op'); if(arOp) arOp.addEventListener('input', ()=>{ AR.op = parseInt(arOp.value,10)/100; });
  const arSize = $('ar-size'); if(arSize) arSize.addEventListener('input', ()=>{ AR.size = parseInt(arSize.value,10)/100; });
  const arRot = $('ar-rot'); if(arRot) arRot.addEventListener('input', ()=>{ AR.rot = parseInt(arRot.value,10); });
  const overlay = $('ar-overlay');
  if(overlay){
    let dragging = false, lx = 0, ly = 0;
    overlay.addEventListener('pointerdown', e=>{ dragging = true; lx = e.clientX; ly = e.clientY; overlay.setPointerCapture && overlay.setPointerCapture(e.pointerId); });
    overlay.addEventListener('pointermove', e=>{
      if(!dragging) return;
      AR.x += e.clientX - lx; AR.y += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    overlay.addEventListener('pointerup', ()=>{ dragging = false; });
    overlay.addEventListener('pointercancel', ()=>{ dragging = false; });
  }
  window.addEventListener('pagehide', stopAR);
  /* Chat */
  const sendB = $('btn-chat-send'); if(sendB) sendB.addEventListener('click', sendChat);
  const inp = $('chat-input'); if(inp) inp.addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });
  window.addEventListener('resize', ()=>{
    const pg = $('page-studio');
    if(pg && pg.classList.contains('active')) resizeCanvas();
  });
}
/* ============================================================
   AUTENTIFIKATSIYA — ikki rejimli
   ------------------------------------------------------------
   1) SUPABASE rejimi (production): haqiqiy PostgreSQL database,
      bcrypt parol xeshi (Supabase auth.users ichida), Google OAuth,
      rollar, status, parol tiklash, email tasdiqlash, audit log.
      Yoqish: quyidagi SUPABASE_URL/SUPABASE_ANON_KEY ni to'ldiring
      yoki ilovadan "⚙ Server sozlash" orqali kiriting.
   2) LOKAL rejim (zaxira): server sozlanmaganda ilova baribir
      ishlaydi — hisoblar shu qurilmada localStorage'da qoladi.
      Demo/oflayn uchun. Bunda admin panel va parol tiklash yo'q.

   anon key MAXFIY EMAS — u brauzerga chiqarilishi Supabase
   arxitekturasida normal; haqiqiy himoya Row Level Security (RLS)
   orqali serverda amalga oshiriladi (supabase/schema.sql ga qarang).
   service_role kalitini esa BU YERGA HECH QACHON yozmang.
   ============================================================ */
const SUPABASE_URL = '';       /* masalan: https://abcdefgh.supabase.co */
const SUPABASE_ANON_KEY = '';  /* "anon public" kaliti */

const AUTH = { mode:'local', client:null, user:null, profile:null, ready:false };

function sbCfg(){
  let url = SUPABASE_URL, key = SUPABASE_ANON_KEY;
  try{
    url = (localStorage.getItem('naqsh_sb_url') || url || '').trim();
    key = (localStorage.getItem('naqsh_sb_key') || key || '').trim();
  }catch(e){}
  return { url, key };
}
function sbCfgSet(url, key){
  try{
    localStorage.setItem('naqsh_sb_url', (url||'').trim());
    localStorage.setItem('naqsh_sb_key', (key||'').trim());
    return true;
  }catch(e){ return false; }
}
function sbEnabled(){ return AUTH.mode === 'supabase' && !!AUTH.client; }

/* Texnik xatoni foydalanuvchiga tushunarli o'zbekcha xabarga aylantiradi.
   Batafsil xato faqat konsolga (developer uchun) yoziladi. */
function authErrMsg(err){
  const raw = (err && (err.message || err.error_description || '')) || '';
  console.error('[auth]', err);
  const m = raw.toLowerCase();
  if(m.includes('invalid login credentials')) return 'Email yoki parol noto\'g\'ri';
  if(m.includes('email not confirmed'))       return 'Email tasdiqlanmagan — pochtangizdagi havolani bosing';
  if(m.includes('user already registered') || m.includes('already been registered'))
                                              return 'Bu email allaqachon ro\'yxatdan o\'tgan';
  if(m.includes('password should be'))        return 'Parol kamida 6 belgi bo\'lishi kerak';
  if(m.includes('rate limit') || m.includes('too many'))
                                              return 'Juda ko\'p urinish — bir necha daqiqadan so\'ng qayta urining';
  if(m.includes('failed to fetch') || m.includes('networkerror'))
                                              return 'Serverga ulanib bo\'lmadi — internetni tekshiring';
  return 'Xatolik yuz berdi — birozdan so\'ng qayta urining';
}

async function authLogEvent(event, meta){
  if(!sbEnabled()) return;
  try{
    await AUTH.client.from('auth_events').insert({
      user_id: AUTH.user ? AUTH.user.id : null,
      email: AUTH.user ? AUTH.user.email : null,
      event, meta: meta || null
    });
  }catch(e){ console.error('[auth] log', e); }
}

async function authLoadProfile(){
  if(!sbEnabled() || !AUTH.user){ AUTH.profile = null; return null; }
  try{
    const { data, error } = await AUTH.client.from('profiles').select('*').eq('id', AUTH.user.id).single();
    if(error) throw error;
    AUTH.profile = data;
    return data;
  }catch(e){ console.error('[auth] profile', e); AUTH.profile = null; return null; }
}

/* Bloklangan hisob kira olmasligi kerak. Supabase auth.users status'ni
   bilmaydi, shuning uchun kirgandan keyin profil status'ini tekshiramiz. */
async function authEnforceStatus(){
  if(!sbEnabled() || !AUTH.profile) return true;
  const st = AUTH.profile.status;
  if(st === 'blocked' || st === 'deactivated'){
    const msg = st === 'blocked' ? 'Hisob bloklangan — administrator bilan bog\'laning'
                                 : 'Hisob faolsizlantirilgan';
    await AUTH.client.auth.signOut();
    AUTH.user = null; AUTH.profile = null;
    ntf(msg, 'err');
    return false;
  }
  return true;
}

async function authBootstrap(){
  const { url, key } = sbCfg();
  if(url && key && typeof supabase !== 'undefined' && supabase.createClient){
    try{
      AUTH.client = supabase.createClient(url, key, {
        auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });
      AUTH.mode = 'supabase';
      const { data } = await AUTH.client.auth.getSession();
      AUTH.user = data && data.session ? data.session.user : null;
      if(AUTH.user){ await authLoadProfile(); await authEnforceStatus(); await cloudLoadPatterns(); }
      AUTH.client.auth.onAuthStateChange(async (evt, session)=>{
        const wasUser = AUTH.user;
        AUTH.user = session ? session.user : null;
        if(AUTH.user){
          await authLoadProfile();
          /* yangi kirish bo'lsa — mehmon naqshlarini ko'chiramiz, so'ng yuklaymiz */
          if(!wasUser){
            const moved = await cloudMigrateGuest();
            if(moved) ntf(moved + ' ta naqsh hisobingizga ko\'chirildi ☁️', 'ok');
          }
          await cloudLoadPatterns();
        } else {
          AUTH.profile = null; CLOUD.patterns = null;
        }
        updateUserBtn(); renderGallery(); renderProfileCard();
        if(evt === 'PASSWORD_RECOVERY') openNewPassword();
      });
    }catch(e){
      console.error('[auth] init', e);
      AUTH.mode = 'local'; AUTH.client = null;
    }
  }
  AUTH.ready = true;
  updateUserBtn();
}

/* ---------- LOKAL rejim (zaxira) ---------- */
function usersGet(){ return lsGet('naqsh_users', {}); }
function usersSet(u){ return lsSet('naqsh_users', u); }
function sessionGet(){ return lsGet('naqsh_session', null); }
function sessionSet(v){
  try{
    if(v===null) localStorage.removeItem('naqsh_session');
    else localStorage.setItem('naqsh_session', JSON.stringify(v));
  }catch(e){}
}
async function hashPass(pass, salt){
  try{
    const data = new TextEncoder().encode(salt + '::naqshai::' + pass);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    return 'f' + hashStr(salt + '::naqshai::' + pass).toString(16); /* zaxira yo'l */
  }
}
function randSalt(){
  let s = '';
  for(let i=0;i<16;i++) s += Math.floor(Math.random()*36).toString(36);
  return s + Date.now().toString(36);
}

/* ---------- Umumiy API (UI shu nomlarni chaqiradi) ---------- */
function currentUser(){
  if(sbEnabled()){
    if(!AUTH.user) return null;
    const p = AUTH.profile || {};
    const nm = [p.first_name, p.last_name].filter(Boolean).join(' ')
            || (AUTH.user.email||'').split('@')[0];
    return {
      login: AUTH.user.email, name: nm,
      created: p.created_at ? Date.parse(p.created_at) : Date.now(),
      role: p.role || 'user', status: p.status || 'active',
      provider: p.provider || 'email', verified: !!p.email_verified
    };
  }
  const s = sessionGet();
  if(!s) return null;
  const u = usersGet();
  return u[s] ? {login:s, name:u[s].name, created:u[s].created, role:'user', status:'active', provider:'email', verified:true} : null;
}
function isAdmin(){
  const u = currentUser();
  return !!u && (u.role === 'admin' || u.role === 'super_admin');
}

async function registerUser(name, login, pass, pass2, lastName){
  name = (name||'').trim(); login = (login||'').trim().toLowerCase();
  lastName = (lastName||'').trim();
  if(!name || !login){ ntf('Ism va email kiritilishi shart', 'err'); return false; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(login)){ ntf('Email formati noto\'g\'ri', 'err'); return false; }
  if((pass||'').length < 6){ ntf('Parol kamida 6 belgi', 'err'); return false; }
  if(pass !== pass2){ ntf('Parollar mos emas', 'err'); return false; }

  if(sbEnabled()){
    try{
      const { data, error } = await AUTH.client.auth.signUp({
        email: login, password: pass,
        options:{ data:{ first_name:name, last_name:lastName }, emailRedirectTo: location.href.split('#')[0] }
      });
      if(error){ ntf(authErrMsg(error), 'err'); return false; }
      if(data && data.user && !data.session){
        ntf('Email manzilingizni tasdiqlang — pochtangizga havola yuborildi 📧', 'ok');
        return true;
      }
      AUTH.user = data.session ? data.session.user : null;
      await authLoadProfile();
      return true;
    }catch(e){ ntf(authErrMsg(e), 'err'); return false; }
  }

  const users = usersGet();
  if(users[login]){ ntf('Bu email allaqachon ro\'yxatdan o\'tgan', 'err'); return false; }
  const salt = randSalt();
  const hash = await hashPass(pass, salt);
  const guest = lsGet('naqsh_saved', []);
  const full = [name, lastName].filter(Boolean).join(' ');
  users[login] = { name: full, salt, hash, created:Date.now(), patterns:guest.slice(0,48) };
  if(!usersSet(users)){ ntf('Saqlashda xato (localStorage)', 'err'); return false; }
  sessionSet(login);
  return true;
}

async function loginUser(login, pass){
  login = (login||'').trim().toLowerCase();
  if(sbEnabled()){
    try{
      const { data, error } = await AUTH.client.auth.signInWithPassword({ email: login, password: pass||'' });
      if(error){
        /* xavfsizlik: hisob bor-yo'qligini oshkor qilmaymiz */
        ntf(authErrMsg(error), 'err');
        try{ await AUTH.client.from('auth_events').insert({ email: login, event:'failed_login' }); }catch(_){}
        return false;
      }
      AUTH.user = data.user;
      await authLoadProfile();
      if(!(await authEnforceStatus())) return false;
      try{ await AUTH.client.rpc('touch_last_login'); }catch(_){}
      await authLogEvent('login');
      return true;
    }catch(e){ ntf(authErrMsg(e), 'err'); return false; }
  }

  const users = usersGet();
  const rec = users[login];
  if(!rec){ ntf('Email yoki parol noto\'g\'ri', 'err'); return false; }
  const hash = await hashPass(pass||'', rec.salt);
  if(hash !== rec.hash){ ntf('Email yoki parol noto\'g\'ri', 'err'); return false; }
  sessionSet(login);
  return true;
}

async function logoutUser(){
  if(sbEnabled()){
    await authLogEvent('logout');
    try{ await AUTH.client.auth.signOut(); }catch(e){}
    AUTH.user = null; AUTH.profile = null;
  } else {
    sessionSet(null);
  }
  updateUserBtn();
  renderGallery();
  closeProfile();
  ntf('Hisobdan chiqildi', 'ok');
}

async function changePassword(oldP, newP, newP2){
  if((newP||'').length < 6){ ntf('Yangi parol kamida 6 belgi', 'err'); return false; }
  if(newP !== newP2){ ntf('Yangi parollar mos emas', 'err'); return false; }

  if(sbEnabled()){
    try{
      /* joriy parolni tekshirish uchun qayta kirishga urinamiz */
      const email = AUTH.user && AUTH.user.email;
      const { error: e1 } = await AUTH.client.auth.signInWithPassword({ email, password: oldP||'' });
      if(e1){ ntf('Joriy parol noto\'g\'ri', 'err'); return false; }
      const { error: e2 } = await AUTH.client.auth.updateUser({ password: newP });
      if(e2){ ntf(authErrMsg(e2), 'err'); return false; }
      await authLogEvent('password_changed');
      ntf('Parol muvaffaqiyatli o\'zgartirildi 🔒', 'ok');
      return true;
    }catch(e){ ntf(authErrMsg(e), 'err'); return false; }
  }

  const u = currentUser();
  if(!u){ ntf('Avval hisobga kiring', 'err'); return false; }
  const users = usersGet();
  const rec = users[u.login];
  const oldHash = await hashPass(oldP||'', rec.salt);
  if(oldHash !== rec.hash){ ntf('Joriy parol noto\'g\'ri', 'err'); return false; }
  rec.salt = randSalt();
  rec.hash = await hashPass(newP, rec.salt);
  usersSet(users);
  ntf('Parol muvaffaqiyatli o\'zgartirildi 🔒', 'ok');
  return true;
}

/* ---------- Parolni tiklash ---------- */
async function requestPasswordReset(email){
  email = (email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ ntf('Email formati noto\'g\'ri', 'err'); return false; }
  if(!sbEnabled()){
    ntf('Parolni tiklash uchun server (Supabase) sozlanishi kerak', 'err');
    return false;
  }
  try{
    const { error } = await AUTH.client.auth.resetPasswordForEmail(email, {
      redirectTo: location.href.split('#')[0]
    });
    if(error){ ntf(authErrMsg(error), 'err'); return false; }
    /* xavfsizlik: email ro'yxatda bor-yo'qligini oshkor qilmaymiz */
    ntf('Agar bunday hisob mavjud bo\'lsa, tiklash havolasi yuborildi 📧', 'ok');
    return true;
  }catch(e){ ntf(authErrMsg(e), 'err'); return false; }
}
async function applyNewPassword(newP, newP2){
  if((newP||'').length < 6){ ntf('Parol kamida 6 belgi', 'err'); return false; }
  if(newP !== newP2){ ntf('Parollar mos emas', 'err'); return false; }
  if(!sbEnabled()){ ntf('Server sozlanmagan', 'err'); return false; }
  try{
    const { error } = await AUTH.client.auth.updateUser({ password: newP });
    if(error){ ntf(authErrMsg(error), 'err'); return false; }
    await authLogEvent('password_reset');
    ntf('Parol yangilandi — endi kirishingiz mumkin ✓', 'ok');
    return true;
  }catch(e){ ntf(authErrMsg(e), 'err'); return false; }
}

/* ---------- Google orqali kirish (Supabase OAuth) ---------- */
async function googleSignIn(){
  if(!sbEnabled()){
    ntf('Google orqali kirish uchun avval ⚙ Server sozlash (Supabase) ni bajaring', 'err');
    const box = $('gcid-box'); if(box) box.hidden = false;
    return;
  }
  try{
    const { error } = await AUTH.client.auth.signInWithOAuth({
      provider: 'google',
      options:{ redirectTo: location.href.split('#')[0] }
    });
    if(error) ntf(authErrMsg(error), 'err');
  }catch(e){ ntf(authErrMsg(e), 'err'); }
}
/* ============================================================
   ADMIN PANEL — foydalanuvchilarni boshqarish
   Diqqat: bu yerdagi tekshiruvlar faqat KO'RINISH uchun. Haqiqiy
   ruxsat serverda — Supabase RLS siyosatlari va protect_privileged_columns
   triggeri bilan ta'minlanadi (supabase/schema.sql). Oddiy foydalanuvchi
   so'rov yuborsa ham server rad etadi.
   ============================================================ */
const ADM = { rows: [], q:'', status:'', role:'' };

function openAdmin(){
  if(!sbEnabled()){ ntf('Admin panel uchun server (Supabase) sozlanishi kerak', 'err'); return; }
  if(!isAdmin()){ ntf('Ruxsat yo\'q', 'err'); return; }
  const m=$('modal-admin'); if(m) m.classList.add('open');
  admLoad();
}
function closeAdmin(){ const m=$('modal-admin'); if(m) m.classList.remove('open'); }

async function admLoad(){
  if(!sbEnabled() || !isAdmin()) return;
  try{
    const [{ data: rows, error: e1 }, { data: stats }] = await Promise.all([
      AUTH.client.from('profiles').select('*').order('created_at', { ascending:false }).limit(500),
      AUTH.client.rpc('admin_stats')
    ]);
    if(e1) throw e1;
    ADM.rows = rows || [];
    admRenderStats(stats);
    admRender();
  }catch(e){ ntf(authErrMsg(e), 'err'); }
}

function admRenderStats(st){
  const box = $('adm-stats'); if(!box) return;
  if(!st){ box.innerHTML = ''; return; }
  const cell = (v,l)=> '<div class="adm-stat"><b>'+(v==null?'—':v)+'</b><span>'+escHTML(l)+'</span></div>';
  box.innerHTML =
    cell(st.total,'Jami foydalanuvchi') + cell(st.active,'Faol') +
    cell(st.today,'Bugun qo\'shilgan') + cell(st.blocked,'Bloklangan') +
    cell(st.via_google,'Google orqali') + cell(st.via_email,'Email orqali');
}

function admRender(){
  const t = $('adm-table'); if(!t) return;
  const q = ADM.q.trim().toLowerCase();
  const list = ADM.rows.filter(r=>{
    if(ADM.status && r.status !== ADM.status) return false;
    if(ADM.role && r.role !== ADM.role) return false;
    if(q){
      const hay = ((r.email||'')+' '+(r.first_name||'')+' '+(r.last_name||'')).toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  const me = currentUser();
  const superA = me && me.role === 'super_admin';
  const ROLES = ['user','researcher','teacher','admin','super_admin'];
  const fmt = d => d ? new Date(d).toLocaleString('uz-UZ',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';

  let html = '<thead><tr><th>Email</th><th>Ism</th><th>Rol</th><th>Status</th><th>Provider</th>'
           + '<th>Ro\'yxatdan o\'tgan</th><th>Oxirgi kirish</th><th>Amal</th></tr></thead><tbody>';
  if(!list.length){
    html += '<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text-soft)">Hech narsa topilmadi</td></tr>';
  }
  list.forEach(r=>{
    const nm = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
    const canEdit = superA || r.role !== 'super_admin';
    const roleSel = '<select data-act="role" data-id="'+r.id+'"'+(canEdit?'':' disabled')+'>' +
      ROLES.filter(x => superA || x !== 'super_admin' || r.role === 'super_admin')
           .map(x=>'<option value="'+x+'"'+(x===r.role?' selected':'')+'>'+x+'</option>').join('') +
      '</select>';
    const blocked = r.status === 'blocked';
    const btn = canEdit
      ? '<button class="btn sm '+(blocked?'':'danger')+'" data-act="'+(blocked?'unblock':'block')+'" data-id="'+r.id+'">'
        + (blocked ? 'Blokdan chiqar' : 'Bloklash') + '</button>'
        + ' <button class="btn sm ghost" data-act="deact" data-id="'+r.id+'"'+(r.status==='deactivated'?' disabled':'')+'>Faolsizlantirish</button>'
      : '<span style="color:var(--text-soft);font-size:12px">—</span>';
    html += '<tr>'
      + '<td>'+escHTML(r.email||'')+(r.email_verified?' <span title="Email tasdiqlangan">✓</span>':'')+'</td>'
      + '<td>'+escHTML(nm)+'</td>'
      + '<td>'+roleSel+'</td>'
      + '<td><span class="adm-badge '+escHTML(r.status)+'">'+escHTML(r.status)+'</span></td>'
      + '<td>'+escHTML(r.provider||'email')+'</td>'
      + '<td>'+fmt(r.created_at)+'</td>'
      + '<td>'+fmt(r.last_login)+'</td>'
      + '<td>'+btn+'</td>'
      + '</tr>';
  });
  html += '</tbody>';
  t.innerHTML = html;
}

async function admSetStatus(id, status){
  try{
    const { error } = await AUTH.client.from('profiles').update({ status }).eq('id', id);
    if(error) throw error;
    ntf('Status yangilandi: ' + status, 'ok');
    await admLoad();
  }catch(e){ ntf(authErrMsg(e), 'err'); }
}
async function admSetRole(id, role){
  try{
    const { error } = await AUTH.client.from('profiles').update({ role }).eq('id', id);
    if(error) throw error;
    ntf('Rol yangilandi: ' + role, 'ok');
    await admLoad();
  }catch(e){ ntf(authErrMsg(e), 'err'); await admLoad(); }
}

function wireAdmin(){
  const t = $('adm-table');
  if(t){
    t.addEventListener('click', e=>{
      const b = e.target.closest('button[data-act]');
      if(!b) return;
      const id = b.dataset.id;
      if(b.dataset.act === 'block')   admSetStatus(id, 'blocked');
      if(b.dataset.act === 'unblock') admSetStatus(id, 'active');
      if(b.dataset.act === 'deact')   admSetStatus(id, 'deactivated');
    });
    t.addEventListener('change', e=>{
      const sel = e.target.closest('select[data-act="role"]');
      if(sel) admSetRole(sel.dataset.id, sel.value);
    });
  }
  const q=$('adm-q');      if(q) q.addEventListener('input', ()=>{ ADM.q = q.value; admRender(); });
  const st=$('adm-status');if(st) st.addEventListener('change', ()=>{ ADM.status = st.value; admRender(); });
  const rl=$('adm-role');  if(rl) rl.addEventListener('change', ()=>{ ADM.role = rl.value; admRender(); });
  const rf=$('adm-refresh');if(rf) rf.addEventListener('click', admLoad);
  const cl=$('adm-close'); if(cl) cl.addEventListener('click', closeAdmin);
  const bk=$('modal-admin');if(bk) bk.addEventListener('click', e=>{ if(e.target===bk) closeAdmin(); });
}

/* ---------- Parolni tiklash oynalari ---------- */
function openForgot(){ closeAuth(); const m=$('modal-forgot'); if(m) m.classList.add('open'); }
function closeForgot(){ const m=$('modal-forgot'); if(m) m.classList.remove('open'); }
function openNewPassword(){ const m=$('modal-newpass'); if(m) m.classList.add('open'); }
function closeNewPassword(){ const m=$('modal-newpass'); if(m) m.classList.remove('open'); }

function wireResetUI(){
  const f=$('btn-forgot'); if(f) f.addEventListener('click', openForgot);
  const fc=$('fg-cancel'); if(fc) fc.addEventListener('click', closeForgot);
  const fb=$('modal-forgot'); if(fb) fb.addEventListener('click', e=>{ if(e.target===fb) closeForgot(); });
  const fs=$('fg-send');
  if(fs) fs.addEventListener('click', async ()=>{
    const el=$('fg-email');
    if(await requestPasswordReset(el?el.value:'')) closeForgot();
  });
  const nc=$('np-cancel'); if(nc) nc.addEventListener('click', closeNewPassword);
  const ns=$('np-save');
  if(ns) ns.addEventListener('click', async ()=>{
    const a=$('np-1'), b=$('np-2');
    if(await applyNewPassword(a?a.value:'', b?b.value:'')){
      if(a) a.value=''; if(b) b.value='';
      closeNewPassword();
    }
  });
}

/* Auth modalidagi rejim izohi — foydalanuvchi qaysi rejimda ekanini bilsin */
function updateAuthNote(){
  const n = $('auth-mode-note');
  if(!n) return;
  n.innerHTML = sbEnabled()
    ? '🔒 Hisoblar serverda (Supabase) saqlanadi; parol bcrypt bilan xeshlanadi va bizga ko\'rinmaydi.'
    : '⚠️ Server sozlanmagan — hisob faqat SHU QURILMADA saqlanadi (demo rejimi). Haqiqiy hisoblar, Google kirish va parol tiklash uchun yuqoridagi «⚙ Server sozlash» ni bajaring.';
}

/* ---------- Auth UI ---------- */
/* Modal har safar KIRISH tabida ochiladi. Aks holda foydalanuvchi bir marta
   "Ro'yxatdan o'tish" tabiga o'tsa, tab holati saqlanib qolar va keyingi
   ochilishlarda kirish formasi (#auth-login-box) yashirin qolardi —
   tashqaridan bu "login umuman ishlamayapti" bo'lib ko'rinadi. */
function authShowTab(which){
  const seg = $('auth-seg');
  if(seg) seg.querySelectorAll('button').forEach(b=>{
    b.classList.toggle('sel', b.dataset.v === which);
  });
  const lb=$('auth-login-box'), rb=$('auth-reg-box');
  if(lb) lb.hidden = which !== 'login';
  if(rb) rb.hidden = which !== 'reg';
  const err=$('gcid-box'); if(err) err.hidden = true;
}
function openAuth(tab){
  authShowTab(tab === 'reg' ? 'reg' : 'login');
  updateAuthNote();
  const m=$('modal-auth'); if(m) m.classList.add('open');
}
function closeAuth(){ const m=$('modal-auth'); if(m) m.classList.remove('open'); }
function openProfile(){ renderProfile(); const m=$('modal-profile'); if(m) m.classList.add('open'); }
function closeProfile(){ const m=$('modal-profile'); if(m) m.classList.remove('open'); }
function updateUserBtn(){
  const b = $('btn-user');
  if(!b) return;
  const u = currentUser();
  b.textContent = u ? ('👤 ' + u.name) : '👤 Kirish';
}
function renderProfile(){
  const body = $('profile-body');
  if(!body) return;
  const u = currentUser();
  if(!u){ body.innerHTML = '<p>Hisobga kirilmagan.</p>'; return; }
  const pats = getSavedList();
  const d = new Date(u.created);
  const dateStr = d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear();
  const cloud = (typeof cloudActive === 'function') && cloudActive();
  let html = '<div class="prof-row"><span>Ism</span><b>'+escHTML(u.name)+'</b></div>' +
    '<div class="prof-row"><span>Email</span><b>'+escHTML(u.login)+'</b></div>' +
    '<div class="prof-row"><span>Ro\'yxatdan o\'tish usuli</span><b>' +
      (u.provider === 'google' ? 'Google' : 'Email va parol') + '</b></div>' +
    '<div class="prof-row"><span>A\'zo bo\'lgan sana</span><b>'+dateStr+'</b></div>' +
    '<div class="prof-row"><span>Yaratilgan naqshlar</span><b>'+pats.length+' ta</b></div>' +
    '<div class="prof-row"><span>Naqshlar qayerda</span><b>' +
      (cloud ? '☁️ Hisobingizda — boshqa qurilmada ham ochiladi'
             : '📱 Faqat shu qurilmada') + '</b></div>';
  html += '<div class="prof-sec"><h4>Mening naqshlarim</h4><div class="gal-grid" id="prof-gal">';
  html += '</div>' + (pats.length ? '' : '<div class="gal-empty">Studio da «💾 Saqlash» bosing — naqshlar shu yerda to\'planadi.</div>') + '</div>';
  html += '<div class="prof-sec"><h4>Sozlamalar — parolni o\'zgartirish</h4>' +
    '<div class="fld"><label>Joriy parol</label><input id="cp-old" type="password" autocomplete="current-password"></div>' +
    '<div class="fld"><label>Yangi parol</label><input id="cp-new" type="password" autocomplete="new-password"></div>' +
    '<div class="fld"><label>Yangi parolni tasdiqlang</label><input id="cp-new2" type="password" autocomplete="new-password"></div>' +
    '<button class="btn sm" id="btn-cp">🔒 Parolni o\'zgartirish</button></div>';
  if(isAdmin()){
    html += '<div class="prof-sec"><h4>Administrator</h4>' +
      '<button class="btn sm gold" id="btn-admin">🛡 Foydalanuvchilarni boshqarish</button></div>';
  }
  html += '<div class="prof-sec"><button class="btn sm danger" id="btn-logout">⎋ Hisobdan chiqish</button></div>';
  body.innerHTML = html;
  /* naqsh thumb lari */
  const grid = $('prof-gal');
  if(grid){
    pats.forEach(item=>{
      const dv = document.createElement('div');
      dv.className = 'gal-item';
      const img = document.createElement('img');
      img.src = item.thumb;
      img.alt = 'naqsh';
      dv.appendChild(img);
      dv.addEventListener('click', ()=>{
        Object.assign(P, item.p);
        syncSliders(); redraw();
        closeProfile();
        showPage('studio');
        ntf('Naqsh yuklandi', 'ok');
      });
      grid.appendChild(dv);
    });
  }
  const cpBtn = $('btn-cp');
  if(cpBtn) cpBtn.addEventListener('click', async ()=>{
    const o=$('cp-old'), n=$('cp-new'), n2=$('cp-new2');
    const ok = await changePassword(o?o.value:'', n?n.value:'', n2?n2.value:'');
    if(ok){ if(o)o.value=''; if(n)n.value=''; if(n2)n2.value=''; }
  });
  const lo = $('btn-logout');
  if(lo) lo.addEventListener('click', logoutUser);
  const ab = $('btn-admin');
  if(ab) ab.addEventListener('click', ()=>{ closeProfile(); openAdmin(); });
}
function wireAuth(){
  const ub = $('btn-user');
  if(ub) ub.addEventListener('click', ()=>{ currentUser() ? openProfile() : openAuth(); });
  const seg = $('auth-seg');
  if(seg) seg.addEventListener('click', e=>{
    const b = e.target.closest('button');
    if(!b) return;
    authShowTab(b.dataset.v);
  });
  const c1=$('auth-cancel'); if(c1) c1.addEventListener('click', closeAuth);
  const c2=$('auth-cancel2'); if(c2) c2.addEventListener('click', closeAuth);
  const back=$('modal-auth'); if(back) back.addEventListener('click', e=>{ if(e.target===back) closeAuth(); });
  const pback=$('modal-profile'); if(pback) pback.addEventListener('click', e=>{ if(e.target===pback) closeProfile(); });
  const pc=$('profile-close'); if(pc) pc.addEventListener('click', closeProfile);
  const doL=$('btn-do-login');
  if(doL) doL.addEventListener('click', async ()=>{
    const l=$('al-login'), p=$('al-pass');
    if(await loginUser(l?l.value:'', p?p.value:'')){
      closeAuth(); updateUserBtn(); renderGallery();
      ntf('Xush kelibsiz, ' + currentUser().name + '! ✦', 'ok');
      if(p) p.value='';
    }
  });
  const doR=$('btn-do-register');
  if(doR) doR.addEventListener('click', async ()=>{
    const n=$('au-name'), ln=$('au-last'), l=$('au-login'), p=$('au-pass'), p2=$('au-pass2');
    if(await registerUser(n?n.value:'', l?l.value:'', p?p.value:'', p2?p2.value:'', ln?ln.value:'')){
      closeAuth(); updateUserBtn(); renderGallery();
      ntf('Hisob yaratildi — xush kelibsiz! 🎉', 'ok');
      if(p) p.value=''; if(p2) p2.value='';
    }
  });
  const alp=$('al-pass');
  if(alp) alp.addEventListener('keydown', e=>{ if(e.key==='Enter' && doL) doL.click(); });
  const g1=$('btn-google-login'); if(g1) g1.addEventListener('click', googleSignIn);
  const g2=$('btn-google-reg'); if(g2) g2.addEventListener('click', googleSignIn);
  const gb=$('btn-gcid'); if(gb) gb.addEventListener('click', ()=>{
    const box=$('gcid-box');
    if(box){
      box.hidden = !box.hidden;
      if(!box.hidden){
        const cfg = sbCfg();
        const u=$('inp-sburl'), k=$('inp-sbkey');
        if(u) u.value = cfg.url; if(k) k.value = cfg.key;
      }
    }
  });
  const gs=$('btn-gcid-save'); if(gs) gs.addEventListener('click', ()=>{
    const u=$('inp-sburl'), k=$('inp-sbkey');
    const url = u ? u.value.trim() : '', key = k ? k.value.trim() : '';
    if(url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)){
      ntf('Project URL odatda https://xxxx.supabase.co ko\'rinishida bo\'ladi', 'err');
    }
    if(sbCfgSet(url, key)){
      ntf(url && key ? 'Saqlandi ✓ — server ulanmoqda…' : 'Server sozlamalari tozalandi', 'ok');
      const box=$('gcid-box'); if(box) box.hidden = true;
      authBootstrap().then(()=>{
        updateAuthNote();
        ntf(sbEnabled() ? 'Serverga ulandi ✓' : 'Lokal (demo) rejimga qaytildi', sbEnabled()?'ok':'err');
      });
    } else {
      ntf('Saqlab bo\'lmadi (localStorage)', 'err');
    }
  });
  const gc=$('btn-gcid-close'); if(gc) gc.addEventListener('click', ()=>{
    const box=$('gcid-box'); if(box) box.hidden = true;
  });
}

/* ═══ JONLI KURSOR: yumshoq ergashuvchi halqa + bosishda to'lqin ═══ */
function initCursor(){
  try{
    if(!window.matchMedia || !matchMedia('(pointer:fine)').matches) return;
    if(!document.body) return;
    const dotEl = document.createElement('div'); dotEl.id = 'cur-dot';
    const ringEl = document.createElement('div'); ringEl.id = 'cur-ring';
    document.body.appendChild(ringEl);
    document.body.appendChild(dotEl);
    let mx=-100, my=-100, rx=-100, ry=-100;
    document.addEventListener('pointermove', e=>{
      mx = e.clientX; my = e.clientY;
      dotEl.style.left = mx+'px';
      dotEl.style.top = my+'px';
      const hot = e.target && e.target.closest ? e.target.closest('button,select,input,a,.pal-chip,.gal-item,canvas') : null;
      if(ringEl.classList) ringEl.classList.toggle('hot', !!hot);
    });
    const loop = ()=>{
      rx += (mx-rx)*0.16; ry += (my-ry)*0.16;
      ringEl.style.left = rx+'px';
      ringEl.style.top = ry+'px';
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('pointerdown', e=>{
      const rp = document.createElement('div');
      rp.className = 'cur-ripple';
      rp.style.left = e.clientX+'px';
      rp.style.top = e.clientY+'px';
      document.body.appendChild(rp);
      setTimeout(()=>{ if(rp.parentNode) rp.parentNode.removeChild(rp); }, 560);
    });
  }catch(e){}
}
/* ═══ INTRO VIDEO ═══
   Videoni HTML fayl YONIGA "intro.mp4" nomi bilan qo'ying — avtomatik ijro etiladi.
   Boshqa nom/URL uchun quyidagi konstantani o'zgartiring. Bo'sh '' = intro o'chiq. */
const INTRO_VIDEO_SRC = 'intro.mp4';
function initIntro(after){
  const ov = $('intro-ov'), v = $('intro-video');
  let seen = false;
  try{ seen = sessionStorage.getItem('naqsh_intro') === '1'; }catch(e){}
  if(!ov || !v || !INTRO_VIDEO_SRC || seen){ after(); return; }
  let done = false;
  const finish = ()=>{
    if(done) return;
    done = true;
    try{ sessionStorage.setItem('naqsh_intro','1'); }catch(e){}
    try{ if(v.pause) v.pause(); }catch(e){}
    if(ov.classList) ov.classList.add('done');
    setTimeout(()=>{ if(ov.parentNode) ov.parentNode.removeChild(ov); }, 650);
    after();
  };
  v.addEventListener('ended', finish);
  v.addEventListener('error', finish);          /* video topilmasa — darhol o'tib ketadi */
  const skip = $('intro-skip');
  if(skip) skip.addEventListener('click', finish);
  const mute = $('intro-mute');
  if(mute) mute.addEventListener('click', ()=>{
    v.muted = !v.muted;
    mute.textContent = v.muted ? '🔊 Ovozni yoqish' : '🔇 Ovozni o\'chirish';
  });
  ov.hidden = false;
  v.src = INTRO_VIDEO_SRC;
  try{
    const pr = v.play ? v.play() : null;
    if(pr && pr.catch) pr.catch(finish);
  }catch(e){ finish(); }
  /* fayl yo'q va error kelmasa ham 2s da davom etamiz */
  setTimeout(()=>{ if(v.readyState === 0 || v.readyState === undefined) finish(); }, 2000);
}
function initSplash(){
  try{
    const sp = $('splash');
    if(!sp) return;
    /* yulduz chizilish animatsiyasini qayta boshlash */
    try{
      const paths = sp.querySelectorAll ? sp.querySelectorAll('path') : [];
      Array.prototype.forEach.call(paths, p=>{
        p.style.animation = 'none';
        void p.getBoundingClientRect();
        p.style.animation = '';
      });
    }catch(e){}
    let seen = false;
    try{ seen = sessionStorage.getItem('naqsh_splash') === '1'; }catch(e){}
    const delay = seen ? 350 : 1900; /* birinchi tashrif — to'liq sahna, keyin qisqa */
    setTimeout(()=>{
      if(sp.classList) sp.classList.add('done');
      setTimeout(()=>{ if(sp.parentNode) sp.parentNode.removeChild(sp); }, 700);
    }, delay);
    sp.addEventListener('click', ()=>{
      if(sp.classList) sp.classList.add('done');
      setTimeout(()=>{ if(sp.parentNode) sp.parentNode.removeChild(sp); }, 700);
    });
    try{ sessionStorage.setItem('naqsh_splash','1'); }catch(e){}
  }catch(e){}
}
function init(){
  initIntro(initSplash);
  cvEl = $('cv');
  buildPatternList();
  buildSliders();
  buildPalettes();
  buildGirihUI();
  wireGirihUI();
  buildTheory();
  buildChips();
  renderGallery();
  restoreChatHistory();
  wireUI();
  wireAuth();
  wireAdmin();
  wireResetUI();
  wireAiSetup();
  updateUserBtn();
  authBootstrap();   /* Supabase sessiyasini tiklash (sozlangan bo'lsa) */
  initCursor();
  resizeCanvas();
  ntf('NaqshAI tayyor — ijodga marhamat! ✦', 'ok');
}
/* Initialization — try-catch bilan himoyalangan */
document.addEventListener('DOMContentLoaded', function(){
  try{
    init();
  }catch(e){
    console.error('NaqshAI init xatosi:', e);
    try{ ntf('Ishga tushirishda xato: ' + e.message, 'err'); }catch(_e){}
  }
});
