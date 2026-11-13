/* Dashboard Manajemen LSI · logika UI (dibangun dari app_v2.js).
   Data TIDAK disematkan: window.LSIApp.start(D) dipanggil oleh loader.js setelah snapshot diambil dari Supabase. */
(function(){'use strict';
window.LSIApp={start:function(D){


const MN=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MNL=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const DBS=['LSI DB LAMA','PT LSI'];
const COL={lama:'#9FB3D1',pt:'#1E3A6E',g:'#2E9E6A',g2:'#A9DCC2',red:'#D64545',gold:'#E3A21A',grid:'#E8EDF3',txt:'#14213D',mut:'#6B7A90',pur:'#7C3AED'};
const GRP=['Cookies','Pasta','Noodles','Tepung'];
const GCOL={Cookies:'#1F7A52',Pasta:'#E3A21A',Noodles:'#1E3A6E',Tepung:'#7C3AED',Premix:'#7C3AED',Mocaf:'#C4B5FD'};
const FGCAT=new Set(['Cookies','Noodle','Pasta','Premix','Cassava Flour']);
// ---------- format
function idn(x,dec=0){if(!isFinite(x))return '–';const s=Math.abs(x).toFixed(dec);let[i,f]=s.split('.');i=i.replace(/\B(?=(\d{3})+(?!\d))/g,'.');return(x<0&&+s!==0?'−':'')+i+(f?','+f:'')}
function rp(x){const a=Math.abs(x);if(a>=1e9)return(x<0?'−':'')+'Rp'+idn(a/1e9,2)+' M';if(a>=1e6)return(x<0?'−':'')+'Rp'+idn(a/1e6,a>=1e8?0:1)+' jt';if(a>=1e3)return(x<0?'−':'')+'Rp'+idn(a/1e3,0)+' rb';return 'Rp'+idn(x)}
function rpFull(x){return 'Rp'+idn(x)}
function pct(x,dec=2){return isFinite(x)?idn(x*100,dec)+'%':'–'}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// Tooltip content is an array of plain-text lines (line 0 = bold header). It is never HTML:
// tipAttr() escapes it for the data-tip attribute and showTip() renders it with text nodes.
const tipAttr=a=>a&&a.length?esc(a.join('\n')):'';
const KEEP=new Set(['PT','CV','TBK','UD','PD','II','III']);
function nice(s){s=String(s);if(s!==s.toUpperCase())return s;return s.toLowerCase().replace(/[a-z0-9]+/g,w=>KEEP.has(w.toUpperCase())?w.toUpperCase():w[0].toUpperCase()+w.slice(1))}
const cust=i=>typeof i==='number'?(D.customers[i]??'?'):String(i);
const enc=encodeURIComponent,dec=s=>{try{return decodeURIComponent(s)}catch(e){return s}};
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
function groupBy(a,kf){const m=new Map();for(const x of a){const k=kf(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return m}
// ---------- dates (day index 0 = 1 Jan 2026; 273 = 1 Okt, 303 = 31 Okt)
const DAY0=Date.UTC(2026,0,1),MIND=273,MAXD=303; // scope: 1–31 Oktober 2026
const dDate=d=>new Date(DAY0+d*864e5);
const dIdx=(y,m,dd)=>Math.round((Date.UTC(y,m-1,dd)-DAY0)/864e5);
const monOf=d=>dDate(d).getUTCMonth()+1;
const fmtD=(d,y)=>{const t=dDate(d);return t.getUTCDate()+' '+MN[t.getUTCMonth()]+(y?' 2026':'')};
const fmtDL=d=>{const t=dDate(d);return String(t.getUTCDate()).padStart(2,'0')+'/'+String(t.getUTCMonth()+1).padStart(2,'0')+'/2026'};
const mStart=m=>dIdx(2026,m,1),mEnd=m=>Math.min(dIdx(2026,m+1,1)-1,MAXD);
const wOf=d=>Math.floor((d+3)/7)+1;const NW=wOf(MAXD),W0=wOf(MIND);
const wStart=w=>Math.max(MIND,-3+7*(w-1)),wEnd=w=>Math.min(-3+7*(w-1)+6,MAXD);
const isoD=d=>dDate(d).toISOString().slice(0,10);
// ---------- filter
const F={g:'M',d:MAXD,w:NW,m:10};
function range(){switch(F.g){case'D':return[F.d,F.d];case'W':return[wStart(F.w),wEnd(F.w)];default:return[MIND,MAXD]}}
const GNAME={D:'Harian',W:'Mingguan',M:'Bulanan',Y:'Tahunan'};
function plabel(){const[a,b]=range();switch(F.g){case'D':return `${HARI[dDate(F.d).getUTCDay()]}, ${fmtD(F.d,1)}`;case'W':return `Minggu ke-${F.w} (ISO) · ${fmtD(a)} – ${fmtD(b,1)}`;case'M':return 'Oktober 2026 (1 – 31 Okt)';default:return '2026 · dibatasi Oktober (1 – 31 Okt)'}}
const isYTD=()=>F.g==='M'||F.g==='Y'; // full October selected
const inR=(d,R)=>d>=R[0]&&d<=R[1];
function buckets(){const out=[];
 if(F.g==='W'||F.g==='Y'){for(let w=W0;w<=NW;w++)out.push({a:wStart(w),b:wEnd(w),lab:'W'+w,full:`Minggu ${w} · ${fmtD(wStart(w))} – ${fmtD(wEnd(w),1)}`,sel:F.g==='W'&&w===F.w,spec:'p:W:'+w})}
 else{for(let d=MIND;d<=MAXD;d++)out.push({a:d,b:d,lab:String(dDate(d).getUTCDate()),full:`${HARI[dDate(d).getUTCDay()]}, ${fmtD(d,1)}`,sel:F.g==='D'&&d===F.d,spec:'p:D:'+d})}
 return out}
function bucketTitle(){return{Y:'per minggu · Tahunan dibatasi Oktober 2026 (W40–W44)',M:'per hari · Oktober 2026',W:'per minggu ISO (W40–W44, dipotong ke Oktober) · minggu terpilih disorot',D:'per hari · Oktober 2026, hari terpilih disorot'}[F.g]}
function daySeries(arr,dayf,valf,filt){const s=new Float64Array(MAXD+1);for(const r of arr){if(filt&&!filt(r))continue;const d=dayf(r);if(d>=0&&d<=MAXD)s[d]+=valf(r)}return s}
function bsum(series,bks){return bks.map(b=>{let t=0;for(let d=b.a;d<=b.b;d++)t+=series[d];return t})}
function setPeriod(g,v){F.g=g;if(g==='D')F.d=+v;if(g==='W')F.w=+v;if(g==='M')F.m=+v;syncPicker();render();if(!ov.hidden&&stack.length)go(stack[stack.length-1],false)}
// ---------- icons
const IC={cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',ret:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',tag:'<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
 factory:'<path d="M3 21V10l6 4V10l6 4V6h6v15z"/>',trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',down:'<path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/>',
 in:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',out:'<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 19h16"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',exit:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',wheat:'<path d="M12 21V8M12 8c-3 0-4-2-4-5 3 0 4 2 4 5zm0 0c3 0 4-2 4-5-3 0-4 2-4 5zM12 14c-3 0-4-2-4-5 3 0 4 2 4 5zm0 0c3 0 4-2 4-5-3 0-4 2-4 5z"/>'};
const ic=(n,s=17)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
// ---------- tables (search / sort / csv)
const TBL={};
function table(id,cols,rows,o={}){TBL[id]={cols,rows,o,q:'',sort:o.sort||null,all:false};
 let h='';if(o.search||o.csv){h+=`<div class="srch">${o.search?`<input type="search" data-search="${id}" placeholder="${esc(o.search===true?'Cari…':o.search)}" aria-label="Cari di tabel">`:''}<span class="cnt" id="cnt-${id}"></span>${o.csv?`<button class="btn2" style="height:34px" type="button" data-csv="${id}">Unduh CSV</button>`:''}</div>`}
 return h+`<div class="tbl-wrap" id="tw-${id}">${renderTable(id)}</div>`}
function renderTable(id){const t=TBL[id],{cols,o}=t;let rows=t.rows;
 if(t.q){const q=t.q.toLowerCase();rows=rows.filter(r=>cols.some(c=>String(c.k(r)).toLowerCase().includes(q)))}
 if(t.sort){const[ci,dir]=t.sort,k=cols[ci].k;rows=rows.slice().sort((a,b)=>{const x=k(a),y=k(b);return(typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'id'))*dir})}
 const n=rows.length;const lim=o.limit&&!t.all?o.limit:Infinity;const shown=rows.slice(0,lim);
 setTimeout(()=>{const c=document.getElementById('cnt-'+id);if(c)c.textContent=n+' baris'},0);
 if(!n)return `<div class="def" style="margin-top:4px">${o.empty||'Tidak ada data untuk periode ini.'}</div>`;
 let h='<table class="tbl"><thead><tr>'+cols.map((c,i)=>{const s=t.sort&&t.sort[0]===i;const so=o.nosort?'':` class="sortable${c.num?' num':''}" data-sort="${id}:${i}" tabindex="0" role="button" aria-sort="${s?(t.sort[1]>0?'ascending':'descending'):'none'}"`;return `<th${so||(c.num?' class="num"':'')}>${c.l}${s?`<span class="ar">${t.sort[1]>0?'▲':'▼'}</span>`:''}</th>`}).join('')+'</tr></thead><tbody>';
 shown.forEach((r,ri)=>{const g=o.go?o.go(r):null;const sel=o.sel&&o.sel(r);
  h+=`<tr${g?` class="go${sel?' selrow':''}" data-go="${esc(g)}" tabindex="0" title="Klik untuk detail"`:(sel?' class="selrow"':'')}>`+cols.map((c,i)=>{let v=c.f?c.f(c.k(r),r):esc(c.k(r));if(i===0&&o.rank)v=`<span class="nmw"><span class="rk">${ri+1}</span><span>${v}</span></span>`;return `<td class="${c.num?'num':'nm'}">${v}</td>`}).join('')+'</tr>'});
 h+='</tbody>';if(o.total&&!t.q){h+='<tfoot><tr>'+o.total(rows).map((v,i)=>`<td class="${cols[i]&&cols[i].num?'num':''}">${v}</td>`).join('')+'</tr></tfoot>'}
 h+='</table>';if(n>lim)h+=`<button class="link" style="margin-top:6px" data-more="${id}">Tampilkan semua (${n}) ›</button>`;return h}
function rerender(id){const w=document.getElementById('tw-'+id);if(w)w.innerHTML=renderTable(id)}
function csv(id){const t=TBL[id];const L=[t.cols.map(c=>c.l.replace(/<[^>]+>/g,'')).join(';')];for(const r of t.rows)L.push(t.cols.map(c=>{let v=c.k(r);if(typeof v==='number')v=String(Math.round(v*100)/100).replace('.',',');v=String(v).replace(/"/g,'""');return /[;"\n]/.test(v)?`"${v}"`:v}).join(';'));
 const b=new Blob(['\ufeff'+L.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(t.o.csv||id)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
const C={txt:(l,k,o={})=>({l,k,...o}),num:(l,k,f=v=>idn(v),o={})=>({l,k,f,num:true,...o})};
// ---------- charts
function niceStep(ym){let step=Math.pow(10,Math.floor(Math.log10(ym/4)));for(const k of[1,2,2.5,5,10]){if(ym/(k*step)<=5){return k*step}}return step*10}
function barChart(el,opt){if(!el)return;el._opt=opt;(opt.draw||drawBar)(el);if(!el._ro&&window.ResizeObserver){let w=el.clientWidth;el._ro=new ResizeObserver(()=>{if(Math.abs(el.clientWidth-w)>2){w=el.clientWidth;(el._opt.draw||drawBar)(el)}});el._ro.observe(el)}}
function drawBar(el){const o=el._opt;const W=Math.max(260,el.clientWidth||600);const small=W<520;const H=o.H?(small?Math.round(o.H*0.9):o.H):(small?230:268);
 const n=o.labels.length;const tot=o.labels.map((_,i)=>o.series.reduce((s,se)=>s+Math.max(0,se.v[i]),0));
 const pl=small?44:58,pr=o.line?(small?34:48):10,pt=18,pb=28;const iw=W-pl-pr,ih=H-pt-pb;
 let ym=Math.max(...tot,...(o.plan?o.plan.v:[0]))*(o.line?1.75:1.14)||1;const step=niceStep(ym);ym=Math.ceil(ym/step)*step;
 const fs=small?9.5:11;let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.aria||'')}" font-family="Plus Jakarta Sans,Inter,Segoe UI,sans-serif">`;
 for(let v=0;v<=ym+1e-9;v+=step){const y=pt+ih-ih*v/ym;s+=`<line x1="${pl}" x2="${W-pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COL.grid}"/><text x="${pl-6}" y="${(y+4).toFixed(1)}" font-size="${fs}" fill="${COL.mut}" text-anchor="end">${o.yfmt(v)}</text>`}
 const cw=iw/n,bw=cw*(small?0.62:0.56);const showVal=cw>=(small?30:40)&&o.vfmt;const lstep=Math.max(1,Math.ceil((small?26:30)/cw));const anySel=o.sel&&o.labels.some((_,i)=>o.sel(i));
 for(let i=0;i<n;i++){const cx=pl+cw*(i+.5);let y0=pt+ih;const sel=o.sel&&o.sel(i);
  const tp=o.tip?o.tip(i):null;const g=o.go?o.go(i):'';
  s+=`<g class="col${sel?' sel':''}"${g?` tabindex="0" role="button" data-go="${g}"`:''} data-tip="${tipAttr(tp)}" aria-label="${esc(o.ariaCol?o.ariaCol(i):o.labels[i])}"><rect class="hit" x="${(cx-cw/2+.5).toFixed(1)}" y="${pt}" width="${Math.max(1,cw-1).toFixed(1)}" height="${ih}" rx="${cw>8?5:1}"/>`;
  o.series.forEach(se=>{const h=ih*Math.max(0,se.v[i])/ym;if(h>0){s+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${(y0-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${se.c}" rx="${bw>6?3:1}" opacity="${anySel&&!sel?0.45:1}"/>`;y0-=h}});
  if(showVal&&tot[i]>0)s+=`<text x="${cx.toFixed(1)}" y="${(pt+ih-ih*tot[i]/ym-6).toFixed(1)}" font-size="${small?9:10.5}" font-weight="600" fill="${COL.txt}" text-anchor="middle">${o.vfmt(tot[i])}</text>`;
  if(i%lstep===0||sel)s+=`<text x="${cx.toFixed(1)}" y="${H-9}" font-size="${small?9.5:11}" fill="${sel?COL.txt:COL.mut}" font-weight="${sel?800:400}" text-anchor="middle">${o.labels[i]}${o.star&&i===n-1?'*':''}</text>`;
  s+='</g>'}
 if(o.plan){const pts=o.plan.v.map((v,i)=>[pl+cw*(i+.5),pt+ih-ih*v/ym]);s+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${COL.gold}" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/>`}
 if(o.line){const lm=Math.max(...o.line.v)*1.1||1;const band=ih*.36,base=pt+band+6;const pts=o.line.v.map((v,i)=>[pl+cw*(i+.5),base-band*v/lm]);
  s+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${COL.red}" stroke-width="2" stroke-linejoin="round" pointer-events="none"/>`;
  if(cw>=12)pts.forEach((p,i)=>{s+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#fff" stroke="${COL.red}" stroke-width="2" pointer-events="none"/>`;if(showVal&&o.line.v[i]>0)s+=`<text x="${p[0].toFixed(1)}" y="${(p[1]-8).toFixed(1)}" font-size="${small?8.5:10}" fill="${COL.red}" font-weight="700" text-anchor="middle" pointer-events="none">${o.line.fmt(o.line.v[i])}</text>`});
  for(let k=0;k<3;k++){const vv=lm*k/2,y=base-band*k/2;s+=`<text x="${W-pr+6}" y="${(y+4).toFixed(1)}" font-size="${small?9:10.5}" fill="${COL.red}">${o.line.fmt(vv)}</text>`}}
 el.innerHTML=s+'</svg>'}
function mini(vals,selArr,color){const n=vals.length;const mx=Math.max(...vals,0)||1;const W=240,H=46,cw=W/n,bw=Math.max(1,cw*.66);let s=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
 vals.forEach((v,i)=>{const h=v>0?Math.max(1.5,(H-4)*v/mx):0;s+=`<rect x="${(cw*i+(cw-bw)/2).toFixed(1)}" y="${(H-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${color}" opacity="${selArr.some(Boolean)&&!selArr[i]?0.35:1}"/>`});return s+`<line x1="0" x2="${W}" y1="${H-.5}" y2="${H-.5}" stroke="#E8EDF3"/></svg>`}
function yfmtRp(v){return v<=0?'0':v>=1e9?idn(v/1e9,v%1e9===0?0:1)+' M':v>=1e6?idn(v/1e6,0)+' jt':idn(v/1e3,0)+' rb'}
function vfmtRp(v){return v>=1e9?idn(v/1e9,2):v>=1e6?idn(v/1e6,0)+'jt':v>0?idn(v/1e3,0)+'rb':''}
function yfmtN(v){return v<=0?'0':v>=1e6?idn(v/1e6,1)+' jt':v>=1e3?idn(v/1e3,0)+' rb':idn(v)}
function vfmtN(v){return v>=1e3?idn(v/1e3,v>=1e5?0:1)+'rb':v>0?idn(v):''}
// ---------- aggregates
const INVd=[daySeries(D.inv,r=>r[0],r=>r[3],r=>r[1]===0),daySeries(D.inv,r=>r[0],r=>r[3],r=>r[1]===1)];
const RETd=daySeries(D.ret,r=>r[0],r=>r[3]);
const isPcs=r=>r[5]!=='SACK';
function salesAgg(R=range()){const inv=D.inv.filter(r=>inR(r[0],R)),ret=D.ret.filter(r=>inR(r[0],R));
 return{R,inv,ret,dpp:sum(inv,r=>r[3]),tot:sum(inv,r=>r[4]),nInv:inv.filter(r=>r[4]>0).length,rdpp:sum(ret,r=>r[3]),rtot:sum(ret,r=>r[4]),nRet:ret.filter(r=>r[4]>0).length,byDb:[0,1].map(d=>sum(inv.filter(r=>r[1]===d),r=>r[3]))}}
const HASDINV=!!(D.dinv&&D.dinv.length);
function dinvAgg(R=range()){const L=(D.dinv||[]).filter(r=>inR(r[0],R));const gross=sum(L,r=>r[3]),di=sum(L,r=>r[4]),dl=sum(L,r=>r[5]);const W=L.filter(r=>r[4]+r[5]>0.5);
 return{L,W,gross,di,dl,disc:di+dl,w:gross?(di+dl)/gross:NaN,avgW:W.length?sum(W,r=>(r[4]+r[5])/(r[3]||1))/W.length:NaN}}
function discAgg(R=range(),excl=false){const L=D.disc.filter(r=>inR(r[0],R)&&(!excl||r[4]!=='Penjualan e-Commerce'));const gross=sum(L,r=>r[5]*r[6]),disc=sum(L,r=>r[8]);
 return{L,gross,disc,w:gross?disc/gross:NaN,avg:L.length?sum(L,r=>r[8]/(r[5]*r[6]))/L.length:NaN,nInv:new Set(L.map(r=>r[1])).size}}
function prodAgg(grp,R=range()){const wo=D.wo.filter(r=>(!grp||r[3]===grp)&&inR(r[0],R));const pc=wo.filter(isPcs);
 return{wo,out:sum(pc,r=>r[7]),plan:sum(pc,r=>r[6]),n:wo.length,sack:sum(wo.filter(r=>!isPcs(r)),r=>r[7]),sub:s=>sum(pc.filter(r=>r[4]===s),r=>r[7])}}
const NC=D.nc;const NCQ=sum(NC,r=>r[2]),NCV=sum(NC,r=>r[5]);
function ncAgg(grp){const L=NC.filter(r=>!grp||r[8]===grp);return{L,qty:sum(L,r=>r[2]),val:sum(L,r=>r[5])}}
function topCust(inv,ret){const m=new Map();for(const r of inv){const o=m.get(r[2])||{ci:r[2],dpp:0,n:0,r:0,rn:0};o.dpp+=r[3];if(r[4]>0)o.n++;m.set(r[2],o)}for(const r of ret){const o=m.get(r[2])||{ci:r[2],dpp:0,n:0,r:0,rn:0};o.r+=r[3];if(r[4]>0)o.rn++;m.set(r[2],o)}return[...m.values()]}
function retItems(retd){return[...groupBy(retd,r=>r[1])].map(([k,a])=>({item:k,qty:sum(a,r=>r[2]),val:sum(a,r=>r[3]),n:a[0][4]===''?a.length:new Set(a.map(r=>r[4])).size})).sort((a,b)=>b.val-a.val)}
function byProduct(wo){return[...groupBy(wo,r=>r[2]+'|'+r[5])].map(([k,a])=>({item:a[0][2],unit:a[0][5],sub:a[0][4],plan:sum(a,r=>r[6]),out:sum(a,r=>r[7]),n:a.length})).sort((a,b)=>b.out-a.out)}
const LUMP=n=>/^penjualan e-?commerce$/i.test(n);   // item non-inventory: omzet e-commerce gabungan, bukan barang fisik
const HASITL=!!(D.itl&&D.itl.length);
function itemsAgg(R=range()){
 if(!HASITL){const L=(D.items||[]).map(r=>({name:r[0],unit:r[1],cat:'',q:r[2]+r[3],v:r[4]+r[5],n:0,lump:false})).sort((a,b)=>b.q-a.q);return{L,phys:L,q:sum(L,r=>r.q),v:sum(L,r=>r.v),lumpV:0,free:0}}
 const m=new Map();let free=0;for(const r of D.itl){if(!inR(r[0],R))continue;const k=(r[6]||r[1])+'|'+r[2];const o=m.get(k)||{name:r[1],code:r[6]||'',unit:r[2],cat:r[5],q:0,v:0,n:0,lump:LUMP(r[1])};o.q+=r[3];o.v+=r[4];o.n++;if(!r[4])free++;m.set(k,o)}
 const L=[...m.values()].sort((a,b)=>b.q-a.q),phys=L.filter(r=>!r.lump);
 return{L,phys,q:sum(phys,r=>r.q),v:sum(L,r=>r.v),lumpV:sum(L.filter(r=>r.lump),r=>r.v),free}}
const FIN=D.fin,BS=D.bsv;
const AGE=['Belum jatuh tempo','1–30 hari','31–60 hari','61–90 hari','91–120 hari','> 120 hari'];
const AGS=['Belum JT','1–30','31–60','61–90','91–120','>120'];
const APT=D.ap_tot?D.ap_tot.slice(1):null,ART=D.ar_tot;
const WH=[...groupBy(D.stock||[],r=>r[0])].map(([k,a])=>({wh:k,n:a.length,q:sum(a,r=>r[4]),v:sum(a,r=>r[5]||0),fg:sum(a.filter(r=>FGCAT.has(r[3])),r=>r[4]),site:/- SUB$/.test(k)?'SUB':/- PSN$/.test(k)?'PSN':'',mod:/(- SUB|- PSN)$/.test(k)?'sur':k==='Branch - Jakarta'?'jkt':k==='Branch - Bali'?'bali':''})).sort((a,b)=>b.q-a.q);
const WMOD={sur:{t:'Stock Gudang Surabaya',f:w=>w.mod==='sur'},jkt:{t:'Stock Gudang Ecommerce Jakarta',f:w=>w.mod==='jkt'},bali:{t:'Gudang Ecommerce Bali',f:w=>w.mod==='bali'}};
const EMP=D.emp;const NONPERSON=['Divisi Research and Development (RND)','E-Commerce','EPM','EVENT','Petty Cash Content','Pusat Sablon Plastik Kebumen','sablon express surabaya','Vacant'];
// ---------- module card
function mod(o){if(o.empty)return `<div class="mod empty" role="note" aria-label="${esc(o.label)}: data tidak tersedia"><div class="kpi-top"><span class="kicon" style="background:#EEF2F7;color:#94A3B8">${ic(o.icon)}</span><span class="klabel">${o.label}</span></div><div class="kval">Data tidak tersedia di Accurate</div><div class="ksub">${o.sub}</div><span class="scope e">Modul kosong · tidak ada sumber data</span></div>`;
 return `<button class="mod" type="button" data-go="${o.go}" aria-label="${esc(o.label.replace(/&amp;/g,'&'))} – buka detail"><span class="more" aria-hidden="true">›</span><div class="kpi-top"><span class="kicon" style="background:${o.bg};color:${o.col}">${ic(o.icon)}</span><span class="klabel">${o.label}</span></div><div class="kval">${o.val}</div><div class="ksub">${o.sub}</div>${o.extra||''}${o.mini?`<div class="mini">${o.mini}</div>`:''}${o.foot?`<div class="kfoot">${o.foot}</div>`:''}<span class="scope ${o.scope[0]}">${o.scope[1]}</span></button>`}
const SC={f:()=>['f','Terfilter: '+plabel()],fin:()=>[isYTD()?'s':'y',isYTD()?'Total 1 – 31 Okt 2026':'Data hanya total Oktober · filter tidak berlaku'],pos:()=>[isYTD()?'s':'y',isYTD()?'Posisi per 31 Okt 2026':'Data hanya per 31 Okt · filter tidak berlaku']};
function waitMod(o){return `<div class="mod empty wait" role="note" aria-label="${esc(o.label)}: data belum tersedia"><div class="kpi-top"><span class="kicon" style="background:#FFF4DB;color:#8A6100">${ic(o.icon)}</span><span class="klabel">${o.label}</span></div><div class="kval">Data belum tersedia</div><div class="ksub">${o.sub}</div><span class="scope y">Belum tersedia</span></div>`}
function drawAging(el){if(!ART||!APT){el.innerHTML='<div class="def">Data belum tersedia (umur piutang &amp; hutang per 31 Okt 2026).</div>';return}const W=Math.max(260,el.clientWidth||600),small=W<520,H=small?220:250,pl=small?44:58,pr=10,pt=18,pb=28,iw=W-pl-pr,ih=H-pt-pb;const A=ART.slice(1),P=APT.slice(1);
 let ym=Math.max(...A,...P)*1.14;const step=niceStep(ym);ym=Math.ceil(ym/step)*step;let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Umur piutang vs hutang" font-family="Plus Jakarta Sans,Inter,Segoe UI,sans-serif">`;
 for(let v=0;v<=ym+1e-9;v+=step){const y=pt+ih-ih*v/ym;s+=`<line x1="${pl}" x2="${W-pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COL.grid}"/><text x="${pl-6}" y="${(y+4).toFixed(1)}" font-size="${small?9.5:11}" fill="${COL.mut}" text-anchor="end">${yfmtRp(v)}</text>`}
 const cw=iw/6,bw=cw*.32;AGS.forEach((l,i)=>{const cx=pl+cw*(i+.5);[[A[i],COL.pt,'ar',-1],[P[i],COL.gold,'ap',1]].forEach(([v,c,g,sd])=>{const h=ih*v/ym;const x=cx+(sd<0?-bw-1:1);s+=`<g class="col" tabindex="0" role="button" data-go="${g}" data-tip="${tipAttr([AGE[i],`${g==='ar'?'Piutang':'Hutang'}: ${rp(v)}`])}" aria-label="${AGE[i]} ${g==='ar'?'piutang':'hutang'} ${rp(v)}"><rect class="hit" x="${x.toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}"/><rect x="${x.toFixed(1)}" y="${(pt+ih-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h,v>0?1:0).toFixed(1)}" fill="${c}" rx="3"/></g>`;if(!small&&v>0)s+=`<text x="${(x+bw/2).toFixed(1)}" y="${(pt+ih-h-5).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="${COL.txt}" font-weight="600" pointer-events="none">${vfmtRp(v)}</text>`});
  s+=`<text x="${cx.toFixed(1)}" y="${H-9}" font-size="${small?9.5:11}" fill="${COL.mut}" text-anchor="middle">${l}</text>`});
 el.innerHTML=s+'</svg>'}
// ---------- render
let MENU='penjualan';
const MENUS={penjualan:'Total Penjualan',produksi:'Total Hasil Produksi',finansial:'Neraca Finansial',wms:'Warehouse Management System',umum:'Informasi Umum'};
const $=id=>document.getElementById(id);
const WAITTXT=w=>`<div class="def">Data belum tersedia di Accurate untuk periode ini (${w}).</div>`;
function render(){const R=range(),bks=buckets(),selA=bks.map(b=>b.sel);
 $('plabel').innerHTML=`Periode aktif: <b>${plabel()}</b>`;
 // ---- penjualan
 const S=salesAgg(R),DA=discAgg(R),DI=dinvAgg(R),IT=itemsAgg(R),RI=retItems(D.retd.filter(r=>inR(r[0],R)));const omz=[bsum(INVd[0],bks),bsum(INVd[1],bks)];const omzT=omz[0].map((v,i)=>v+omz[1][i]);const retB=bsum(RETd,bks);
 $('m-penjualan').innerHTML=[
  (HASITL||IT.L.length)?mod({go:'items',icon:'box',col:'#1E3A6E',bg:'#E6ECF6',label:'Barang Laku Terjual',val:idn(IT.q)+'<small> unit</small>',sub:`${IT.phys.length} barang · nilai ${rp(IT.v)}${IT.lumpV?` <span style="white-space:nowrap">(incl. e-commerce gabungan ${rp(IT.lumpV)})</span>`:''}`,foot:IT.phys.length?IT.phys.slice(0,3).map((r,i)=>`#${i+1} ${esc(r.name)} · ${idn(r.q)} ${esc(r.unit)}`).join('<br>'):'Tidak ada penjualan barang pada periode ini',scope:HASITL?SC.f():[isYTD()?'s':'y',isYTD()?'Total 1 – 31 Okt 2026':'Total Oktober · tidak terfilter harian/mingguan']})
   :waitMod({icon:'box',label:'Barang Laku Terjual',sub:'Data belum tersedia di Accurate untuk periode ini.'}),
  mod({go:'retur',icon:'ret',col:COL.red,bg:'#FCEBEB',label:'Barang Retur',val:rp(S.rdpp),sub:`Retur rate <b class="neg">${S.dpp?pct(S.rdpp/S.dpp):'–'}</b> · ${idn(S.nRet)} dokumen`,mini:mini(retB,selA,COL.red),foot:RI.length?'Terbanyak: '+RI.slice(0,2).map(r=>`${esc(r.item)} ${rp(r.val)}`).join(' · '):'Tidak ada baris barang retur pada periode ini',scope:SC.f()}),
  HASDINV?mod({go:'diskon',icon:'tag',col:'#8A6100',bg:'#FFF4DB',label:'Rata-rata Diskon',val:DI.gross?pct(DI.w,2):'–',sub:`Diskon ${rp(DI.disc)} ÷ penjualan kotor ${rp(DI.gross)} · ${idn(DI.W.length)} dari ${idn(DI.L.length)} faktur berdiskon`,foot:`Diskon faktur ${rp(DI.di)} · diskon per barang ${rp(DI.dl)}${DI.W.length?` · rata-rata per faktur berdiskon ${pct(DI.avgW,1)}`:''}`,scope:SC.f()}):mod({go:'diskon',icon:'tag',col:'#8A6100',bg:'#FFF4DB',label:'Rata-rata Diskon',val:DA.L.length?pct(DA.w):FIN?pct(-FIN.sdisc/FIN.sales,2):'–',sub:DA.L.length?`Total diskon barang ${rp(DA.disc)} · ${DA.L.length} baris / ${DA.nInv} faktur`:FIN?`Sales Discount ${rp(-FIN.sdisc)} ÷ penjualan kotor ${rp(FIN.sales)}`:'Tidak ada baris faktur dengan diskon per barang pada periode ini',foot:DA.L.length?(FIN?`Sales Discount Laba Rugi Okt: ${rp(-FIN.sdisc)} (${pct(-FIN.sdisc/FIN.sales,2)} dari sales)`:''):'Tidak ada diskon per barang di Oktober; nilai dari akun Sales Discount Laba Rugi Okt 2026',scope:DA.L.length?SC.f():SC.fin()}),
  mod({go:'omzet',icon:'cash',col:'#1E3A6E',bg:'#E6ECF6',label:'Total Omzet (excl. PPN)',val:rp(S.dpp),sub:`${idn(S.nInv)} faktur · incl. PPN ${rp(S.tot)}`,mini:mini(omzT,selA,COL.pt),foot:D.sales_src&&D.sales_src.source==='accurate-api'?'Sumber: API Accurate · faktur penjualan PT LSI, setelah diskon':'Sumber: Sales Invoice List PT LSI',scope:SC.f()})].join('');
 $('chSalesSub').textContent='Omzet '+bucketTitle();
 const rate=omzT.map((v,i)=>v?retB[i]/v:0);
 barChart($('chSales'),{labels:bks.map(b=>b.lab),series:[{c:COL.pt,v:omzT}],line:{v:rate,fmt:v=>idn(v*100,1)+'%'},sel:i=>bks[i].sel,go:i=>bks[i].spec,yfmt:yfmtRp,vfmt:vfmtRp,aria:'Tren omzet',ariaCol:i=>`${bks[i].full}: omzet ${rp(omzT[i])}. Pilih periode`,tip:i=>[bks[i].full,`Omzet: ${rp(omzT[i])}`,`Retur: ${rp(retB[i])} (${pct(rate[i])})`,'Klik untuk memilih periode']});
 const TI=IT.phys,mx=TI.length?TI[0].q:1;$('topItems').innerHTML=TI.length?TI.slice(0,10).map((p,i)=>`<button type="button" data-go="items" title="${esc(p.name)}"><span class="n">${esc(p.name)}</span><span class="t"><i style="width:${(p.q/mx*100).toFixed(1)}%;background:${COL.pt};opacity:${(1-.055*i).toFixed(2)}"></i></span><span class="v">${idn(p.q)}</span></button>`).join(''):(HASITL?'<div class="def">Tidak ada penjualan barang pada periode ini.</div>':WAITTXT('Sales per Item 1 – 31 Okt 2026'));
 // ---- produksi
 const ncNone=`<div class="wbox none"><b>Waste:</b> tidak ada data Oktober <span style="display:block;font-size:10.8px">Snapshot stok Non-Conformity terakhir 31 Mei 2026; tidak ada penyesuaian stok di Oktober.</span></div>`;
 $('m-produksi').innerHTML=GRP.map(g=>{const P=prodAgg(g,R);const N=ncAgg(g);const ser=bsum(daySeries(D.wo,r=>r[0],r=>r[7],r=>r[3]===g&&isPcs(r)),bks);
  const split=g==='Tepung'?`<div class="split"><span><span class="dot" style="background:${GCOL.Premix}"></span>Premix ${idn(P.sub('Premix'))} pcs</span><span><span class="dot" style="background:${GCOL.Mocaf}"></span>Mocaf ${idn(P.sub('Mocaf'))} pcs</span>${P.sack?`<span>+ ${idn(P.sack)} sak Mocaf 25 Kg</span>`:''}</div>`:'';
  const w=N.L.length?`<div class="wbox"><b>Waste</b>: <b>${idn(N.qty)} pcs</b> · ${rp(N.val)}</div>`:ncNone;
  return mod({go:'cat:'+g,icon:g==='Tepung'?'wheat':'factory',col:GCOL[g],bg:'#F3F6FA',label:`Hasil Produksi &amp; Waste ${g}${g==='Tepung'?' (Premix + Mocaf)':''}`,val:idn(P.out)+'<small> pcs</small>',sub:P.n?`${idn(P.n)} WO · rencana ${idn(P.plan)} · capaian ${P.plan?pct(P.out/P.plan,1):'–'}`:'Tidak ada WO selesai pada periode ini',extra:split+w,mini:mini(ser,selA,GCOL[g]),scope:SC.f()})}).join('');
 $('chProdSub').textContent='Hasil barang jadi (pcs) '+bucketTitle();
 $('prodLeg').innerHTML=GRP.map(g=>`<span><i style="background:${GCOL[g]}"></i>${g}</span>`).join('');
 const ps=GRP.map(g=>bsum(daySeries(D.wo,r=>r[0],r=>r[7],r=>r[3]===g&&isPcs(r)),bks));
 barChart($('chProd'),{labels:bks.map(b=>b.lab),series:GRP.map((g,i)=>({c:GCOL[g],v:ps[i]})),sel:i=>bks[i].sel,go:i=>bks[i].spec,yfmt:yfmtN,vfmt:vfmtN,aria:'Hasil produksi per kategori',ariaCol:i=>bks[i].full,tip:i=>[bks[i].full,...GRP.map((g,k)=>`${g}: ${idn(ps[k][i])} pcs`),'Klik untuk memilih periode']});
 $('wasteCat').innerHTML=NC.length?'':GRP.map(g=>`<button type="button" data-go="cat:${g}"><span class="n">${g}</span><span class="t"></span><span class="v" style="color:var(--mut);font-weight:600">tidak ada data Oktober</span></button>`).join('');
 $('wasteDef').innerHTML=`Tidak ada data waste untuk Oktober 2026. Satu-satunya sumber waste di Accurate adalah snapshot stok gudang Non Conformity 31 Mei 2026 (${D.nc_all_n} baris, ${idn(D.nc_all_qty)} pcs, PT LSI), dan Inventory Adjustment tidak punya baris di Oktober. Reject juga tidak tersedia.`;
 // ---- finansial
 const grp1=rows=>rows.filter(r=>r[2]===1&&r[1]!=null);const WF='Data belum tersedia di Accurate untuk periode ini.';
 $('m-finansial').innerHTML=(FIN?[
  mod({go:'fin:rev',icon:'cash',col:'#1E3A6E',bg:'#E6ECF6',label:'Revenue / Omzet',val:rp(FIN.rev),sub:`Penjualan ${rp(FIN.sales)} − diskon ${rp(-FIN.sdisc)} − retur ${rp(-FIN.sret)}`,foot:'Laba Rugi (Standard) PT LSI · Oktober 2026',scope:SC.fin()}),
  mod({go:'fin:cogs',icon:'factory',col:'#8A6100',bg:'#FFF4DB',label:'COGS / HPP',val:rp(FIN.cogs),sub:`${pct(FIN.cogs/FIN.rev,1)} dari revenue`,foot:grp1(FIN.cogs_rows).map(r=>`${esc(r[0].replace(' Expenses',''))} ${rp(r[1])}`).join(' · '),scope:SC.fin()}),
  mod({go:'fin:opex',icon:'down',col:COL.red,bg:'#FCEBEB',label:'Biaya / OPEX',val:rp(FIN.opex),sub:`${pct(FIN.opex/FIN.rev,1)} dari revenue`,foot:'Terbesar: '+grp1(FIN.opex_rows).sort((a,b)=>b[1]-a[1]).slice(0,2).map(r=>`${esc(r[0].replace(' Expenses',''))} ${rp(r[1])}`).join(' · '),scope:SC.fin()})]
  :[waitMod({icon:'cash',label:'Revenue / Omzet',sub:WF}),waitMod({icon:'factory',label:'COGS / HPP',sub:WF}),waitMod({icon:'down',label:'Biaya / OPEX',sub:WF})]).concat([
  APT?mod({go:'ap',icon:'out',col:'#8A6100',bg:'#FFF4DB',label:'Hutang (Umur Hutang Pemasok)',val:rp(APT[0]),sub:`${D.ap.length} pemasok · belum jatuh tempo ${rp(APT[1])} · lewat > 30 hari ${rp(sum(APT.slice(3),v=>v))}`,foot:BS&&BS.ap!=null?`Saldo neraca Account Payable: ${rp(BS.ap)}`:'Neraca 31 Okt: data belum tersedia',scope:SC.pos()}):waitMod({icon:'out',label:'Hutang (Umur Hutang Pemasok)',sub:'Data belum tersedia di Accurate untuk periode ini.'}),
  ART?mod({go:'ar',icon:'in',col:'#1E3A6E',bg:'#E6ECF6',label:'Piutang (Umur Piutang)',val:rp(ART[0]),sub:`${new Set(D.ar.map(r=>r[0])).size} pelanggan · ${D.ar.length} faktur · lewat > 30 hari ${rp(sum(ART.slice(3),v=>v))}`,foot:BS&&BS.ar!=null?`Saldo neraca Account Receivable: ${rp(BS.ar)}`:'Neraca 31 Okt: data belum tersedia',scope:SC.pos()}):waitMod({icon:'in',label:'Piutang (Umur Piutang)',sub:'Data belum tersedia di Accurate untuk periode ini.'}),
  FIN?mod({go:'fin:profit',icon:'trend',col:COL.g,bg:'#E5F5EC',label:'Profit (Laba Bersih)',val:rp(FIN.net),sub:`Net margin ${pct(FIN.net/FIN.rev,1)} · laba kotor ${rp(FIN.gross)} (${pct(FIN.gross/FIN.rev,1)})`,foot:`Laba operasi ${rp(FIN.oper)} · lain-lain bersih ${rp(FIN.oth_net)}`,scope:SC.fin()}):waitMod({icon:'trend',label:'Profit (Laba Bersih)',sub:WF})]).join('');
 if(FIN){const wfRows=[['Revenue',FIN.rev,COL.pt,'fin:rev'],['COGS / HPP',-FIN.cogs,COL.gold,'fin:cogs'],['Laba Kotor',FIN.gross,COL.g,'fin:profit'],['OPEX',-FIN.opex,COL.red,'fin:opex'],['Laba Operasi',FIN.oper,COL.g,'fin:profit'],['Lain-lain (bersih)',FIN.oth_net,'#94A3B8','fin:profit'],['Laba Bersih',FIN.net,'#1F7A52','fin:profit']];
  $('plWf').innerHTML=wfRows.map(r=>`<button type="button" data-go="${r[3]}"><span class="n">${r[0]}</span><span class="t"><i style="left:0;width:${Math.max(.5,Math.min(100,Math.abs(r[1])/Math.abs(FIN.rev||1)*100)).toFixed(1)}%;background:${r[2]}"></i></span><span class="v${r[1]<0?' neg':''}">${rp(r[1])}</span></button>`).join('')}
 else $('plWf').innerHTML=WAITTXT('Laba Rugi 1 – 31 Okt 2026');
 barChart($('chAging'),{draw:drawAging});
 // ---- wms
 const WW='Data belum tersedia di Accurate untuk periode ini.';
 $('m-wms').innerHTML=Object.entries(WMOD).map(([k,m])=>{if(!D.stock)return waitMod({icon:'box',label:m.t,sub:WW});const ws=WH.filter(m.f);const q=sum(ws,w=>w.q),fg=sum(ws,w=>w.fg),n=sum(ws,w=>w.n),vv=sum(ws,w=>w.v);
  let extra='';if(k==='sur'){const fgw=ws.filter(w=>/^Finished Goods/.test(w.wh));extra=`<div class="wbox" style="background:#E5F5EC;border-color:#BFE6D1"><b style="color:#1F7A52">Finished Goods: ${idn(sum(fgw,w=>w.q))}</b> · ${fgw.map(w=>`${esc(w.wh.replace('Finished Goods - ','FG '))} ${idn(w.q)}`).join(' · ')}</div>`}
  else extra=`<div class="split">${ws.map(w=>`<span>${esc(w.wh)}</span>`).join('')||'<span>gudang tidak ditemukan</span>'}</div>`;
  return mod({go:'wh:'+k,icon:'box',col:'#8A6100',bg:'#FFF4DB',label:m.t,val:idn(q)+'<small> qty</small>',sub:`${n} baris barang · ${ws.length} gudang · barang jadi ${idn(fg)}${vv?' · nilai '+rp(vv):''}`,extra,foot:'Kuantitas satuan campuran (pcs, kg, dll.)'+(vv?' · nilai = Total Cost Accurate':''),scope:SC.pos()})}).join('');
 if(D.stock){const wqm=Math.max(...WH.map(w=>w.q));
  $('whList').innerHTML=WH.map(w=>`<button type="button" data-go="${w.mod?'wh:'+w.mod+':'+enc(w.wh):'whx:'+enc(w.wh)}"><span class="n" title="${esc(w.wh)}">${esc(w.wh)} ${w.mod?`<span class="tag2 ${w.site==='PSN'?'psn':'sub'}">${{sur:'Surabaya',jkt:'Jakarta',bali:'Bali'}[w.mod]}</span>`:'<span class="tag2 no">tidak dipetakan</span>'}</span><span class="t"><i style="left:0;width:${Math.max(.5,w.q/wqm*100).toFixed(1)}%;background:${w.mod?'#E3A21A':'#CBD5E1'}"></i></span><span class="v">${idn(w.q)}</span></button>`).join('');
  const fgw=['Finished Goods - SUB','Finished Goods - PSN','Branch - Bali','Branch - Jakarta'];const cats=['Cookies','Noodle','Pasta','Premix','Cassava Flour'];
  $('whFg').innerHTML=`<table class="tbl"><thead><tr><th>Kategori</th>${fgw.map(w=>`<th class="num">${esc(w.replace('Finished Goods - ','FG ').replace('Branch - ',''))}</th>`).join('')}</tr></thead><tbody>${cats.map(c=>`<tr><td>${c==='Cassava Flour'?'Mocaf (Cassava Flour)':c}</td>${fgw.map(w=>{const v=sum(D.stock.filter(r=>r[0]===w&&r[3]===c),r=>r[4]);return `<td class="num">${v?idn(v):'–'}</td>`}).join('')}</tr>`).join('')}</tbody></table>`}
 else{$('whList').innerHTML=WAITTXT('stok per gudang per 31 Okt 2026');$('whFg').innerHTML=WAITTXT('stok per gudang per 31 Okt 2026')}
 $('whDef').innerHTML=`<b>Pemetaan (asumsi):</b> Surabaya = semua gudang berakhiran "- SUB" dan "- PSN" (PSN kemungkinan Pasuruan; digabung sesuai permintaan, dipisah di detail). Ecommerce Jakarta = "Branch - Jakarta"; Ecommerce Bali = "Branch - Bali". Gudang lain (Maintenance, Marketing tools, Transit, Scrap, Head Quarter, Intransit) tidak masuk modul.`;
 // ---- umum
 const st=[...groupBy(EMP,r=>r[4]||'(kosong)')].map(([k,a])=>({k,n:a.length})).sort((a,b)=>b.n-a.n);const nSales=EMP.filter(r=>r[5]==='YES').length;const nNP=EMP.filter(r=>NONPERSON.includes(r[0])).length;
 $('m-umum').innerHTML=[
  mod({go:'emp',icon:'users',col:COL.pur,bg:'#F1EAFE',label:'Jumlah Karyawan',val:idn(EMP.length)+'<small> tercatat</small>',sub:st.map(s=>`${esc(s.k.replace(/_/g,' ').toLowerCase())} ${s.n}`).join(' · '),foot:`${nSales} ditandai Salesman · semua di Kantor Pusat · kolom Department kosong<br>${nNP} entri tampak bukan perorangan (mis. "EPM", "EVENT", "Vacant")`,scope:['s','Data master (diekspor 13 Nov 2026) · tidak bertanggal']}),
  mod({empty:1,icon:'cal',label:'Jumlah Karyawan Cuti Bulanan',sub:'Tidak ada data cuti di Accurate (Daftar Karyawan tidak menyimpan cuti).'}),
  mod({empty:1,icon:'exit',label:'Jumlah Karyawan Resign',sub:'Daftar Karyawan tidak punya kolom status keluar / tanggal resign, jadi resign tidak bisa dihitung.'})].join('');
 const smx=Math.max(...st.map(s=>s.n));
 $('empStat').innerHTML=st.map(s=>`<button type="button" data-go="emp"><span class="n">${esc(s.k)}</span><span class="t"><i style="left:0;width:${(s.n/smx*100).toFixed(1)}%;background:${COL.pur}"></i></span><span class="v">${s.n}</span></button>`).join('');
 $('empDef').innerHTML=`Sumber: Daftar Karyawan Accurate (${EMP.length} baris, data master tanpa tanggal per Oktober). Kolom <b>Department</b> kosong di semua baris, jadi rincian memakai kolom <b>Position</b>. Angka = jumlah baris master, bukan headcount payroll.`;
 const yrs=[...groupBy(EMP,r=>r[3].slice(-4))].map(([k,a])=>({k,n:a.length})).sort((a,b)=>a.k.localeCompare(b.k));
 barChart($('chEmp'),{labels:yrs.map(y=>y.k),series:[{c:COL.pur,v:yrs.map(y=>y.n)}],yfmt:v=>idn(v),vfmt:v=>idn(v),go:()=>'emp',H:220,aria:'Karyawan per tahun bergabung',tip:i=>[`Bergabung ${yrs[i].k}`,`${yrs[i].n} baris`],ariaCol:i=>yrs[i].k});
 // ---- period note
 const notes={penjualan:'Omzet, retur, dan diskon mengikuti periode terpilih di dalam Oktober 2026.',produksi:'Hasil produksi mengikuti periode terpilih di dalam Oktober 2026. Waste: tidak ada data Oktober.',finansial:FIN||APT||ART?'Laba Rugi = total 1 – 31 Okt 2026; Neraca, umur hutang &amp; piutang = posisi 31 Okt 2026. Filter harian/mingguan tidak berlaku.':'<b>Data belum tersedia di Accurate untuk periode ini.</b>',wms:D.stock?'Stok = posisi 31 Okt 2026. Filter harian/mingguan tidak berlaku.':'<b>Data belum tersedia di Accurate untuk periode ini.</b>',umum:'Daftar karyawan adalah data master tanpa tanggal, jadi filter waktu tidak berlaku.'};
 const pre=F.g==='Y'?'<b>Tahunan dibatasi Oktober 2026:</b> dashboard ini hanya memuat data 1 – 31 Okt 2026. ':F.g==='M'?'':`Filter <b>${GNAME[F.g]}</b> · ${plabel()}. `;
 const pn=$('pnote');pn.classList.add('on');pn.innerHTML=pre+notes[MENU];
}
// ---------- notes
function notesHtml(){const s3=D.src3||{};const src=Object.keys(s3).length?Object.entries(s3).map(([k,v])=>`${k}: ${esc(v.file)} (${v.accepted?'dipakai':'ditolak – bukan periode Oktober'})`).join('; '):'belum ada laporan';
 // Angka di catatan dihitung dari snapshot yang baru dimuat (setelah login), bukan literal di aset publik.
 const dA=HASDINV?dinvAgg():null, omz=FIN?FIN.rev:sum(D.inv,r=>r[3]), ret=FIN?-FIN.sret:sum(D.ret,r=>r[3]);
 const discTxt=dA&&dA.gross?`${rp(dA.disc)} ÷ ${rp(dA.gross)} = ${pct(dA.w,2)}, ${dA.dl>0.5?'sebagian':'seluruhnya'} diskon faktur (${idn(dA.W.length)} faktur)`:FIN?`${rp(-FIN.sdisc)} ÷ ${rp(FIN.sales)} = ${pct(-FIN.sdisc/FIN.sales,2)} dari Laba Rugi`:'';
 const arTxt=ART&&BS&&BS.ar!=null?` Piutang: total umur piutang (${rp(ART[0])}) sedikit beda dari saldo Account Receivable di Neraca (${rp(BS.ar)}).`:'';
 return `<p><b>Cakupan:</b> dashboard ini hanya memuat data <b>Oktober 2026 (1 – 31 Okt)</b>. Penjualan, retur, diskon, dan produksi Oktober seluruhnya dari database PT LSI (LSI DB LAMA hanya dipakai s.d. Mei).</p>
<p><b>Filter waktu:</b> Harian = satu tanggal di Oktober; Mingguan = minggu ISO W40 – W44 (Senin–Minggu, dipotong ke 1 – 31 Okt); Bulanan = Oktober 2026; Tahunan = dibatasi Oktober 2026. Grafik: Harian & Bulanan per hari, Mingguan & Tahunan per minggu.</p>
<p><b>Penjualan (API Accurate):</b> faktur & retur penjualan PT LSI 1 – 31 Okt 2026 ditarik langsung lewat API Accurate (hanya baca). Faktur uang muka (SID.*) tidak dihitung sebagai penjualan.</p>
<p><b>Omzet</b> = nilai penjualan setelah diskon, excl. PPN, dalam Rupiah (termasuk 2 faktur ekspor USD ke Walkin International yang DPP-nya 0 karena tanpa PPN).${omz>0?` Total Oktober ${rp(omz)} = Sales − Sales Discount di Laba Rugi.`:''} <b>Retur</b> = DPP baris retur${ret>0?` (${rp(ret)} = akun Sales Return)`:''}.</p>
<p><b>Barang Laku Terjual</b> = rincian barang faktur (kode barang Accurate), qty pada satuan baris faktur. "Penjualan e-Commerce" (100175) adalah item non-inventory berisi omzet e-commerce gabungan, tidak dihitung di ranking qty.</p>
<p><b>Rata-rata Diskon</b> = (diskon faktur + diskon per barang) ÷ penjualan kotor sebelum diskon.${discTxt?` Oktober: ${discTxt}.`:''}</p>
<p><b>Produksi:</b> per Work Order unik, tanggal = Finished Good Slip terakhir, rencana = qty WO. Kategori dari kategori barang Accurate: Cookies → Cookies; Pasta → Pasta; Noodle → Noodles; Premix → Tepung/Premix; Cassava Flour (Tepung Ladang Lima, Cassava Flour JANS) → Tepung/Mocaf. Produk tanpa kategori di WO list (${D.cat_defaulted.map(esc).join(', ')}) masuk Cookies. PCS/PACK/PAKET dihitung pcs; Tepung Ladang Lima 25 Kg (SACK) dipisah dalam sak.</p>
<p><b>Waste:</b> tidak ada data Oktober. Sumber waste satu-satunya adalah snapshot stok Non Conformity 31 Mei 2026; Inventory Adjustment tidak punya baris Oktober. Reject tidak tersedia di Accurate.</p>
<p><b>Neraca Finansial & WMS:</b> memakai laporan Accurate khusus Oktober (Laba Rugi 1 – 31 Okt; Neraca, umur hutang/piutang, stok per 31 Okt). File hanya dipakai bila judul laporannya menunjukkan periode Oktober. Status: ${src}.</p>
<p><b>Warehouse:</b> pemetaan Surabaya = gudang "- SUB" + "- PSN", Jakarta = "Branch - Jakarta", Bali = "Branch - Bali" adalah asumsi. Kuantitas satuan campuran; nilai = Total Cost Accurate. Kode &amp; kategori barang tidak ada di export 31 Okt, jadi diambil dari master barang export stok 12 Nov (hanya pemetaan, angka tetap dari 31 Okt); barang tanpa padanan tampil "(tanpa kategori)".${arTxt}</p>
<p><b>Informasi Umum:</b> Daftar Karyawan (${EMP.length} baris, data master). Cuti bulanan dan resign tidak tersedia di Accurate, modul dibiarkan kosong.</p>`}
// ---------- views (drawer)
const V={};
function kg(items){return `<div class="kgrid">${items.map(([l,v,e])=>`<div><small>${l}</small><b>${v}</b>${e?`<em>${e}</em>`:''}</div>`).join('')}</div>`}
function card(t,p,body){return `<div class="card"><div class="ch"><div><h3>${t}</h3>${p?`<p>${p}</p>`:''}</div></div>${body}</div>`}
const bkName=()=>F.g==='W'||F.g==='Y'?'Minggu':'Hari';
V.omzet=()=>{const S=salesAgg();const after=[];const bks=buckets();
 let h=kg([['Omzet',rp(S.dpp)],['Omzet incl. PPN',rp(S.tot)],['Faktur bernilai',idn(S.nInv)],['Rata-rata / faktur',S.nInv?rp(S.dpp/S.nInv):'–'],['Retur DPP',rp(S.rdpp),S.dpp?pct(S.rdpp/S.dpp)+' dari omzet':''],['Omzet bersih',rp(S.dpp-S.rdpp)]]);
 const o=bsum(INVd[1],bks).map((v,i)=>v+bsum(INVd[0],bks)[i]);h+=card('Tren Omzet','Omzet '+bucketTitle()+' · klik batang untuk memilih periode','<div class="chart" id="dCh"></div>');
 after.push(()=>barChart($('dCh'),{labels:bks.map(b=>b.lab),series:[{c:COL.pt,v:o}],sel:i=>bks[i].sel,go:i=>bks[i].spec,yfmt:yfmtRp,vfmt:vfmtRp,H:220,ariaCol:i=>bks[i].full,tip:i=>[bks[i].full,rp(o[i])]}));
 const rows=bks.map(b=>{const a=salesAgg([b.a,b.b]);return{...b,n:a.nInv,dpp:a.dpp,tot:a.tot,r:a.rdpp}});
 h+=card('Omzet per '+bkName(),'Klik baris untuk memilih periode',table('dM',[C.txt(bkName(),r=>r.full,{k:r=>r.a,f:(v,r)=>esc(r.full)}),C.num('Faktur',r=>r.n),C.num('Omzet',r=>r.dpp,v=>'<b>'+rp(v)+'</b>'),C.num('Incl. PPN',r=>r.tot,rp),C.num('Retur',r=>r.r,rp),C.num('Bersih',r=>r.dpp-r.r,rp)],rows,{go:r=>r.spec,sel:r=>r.sel,csv:'omzet_oktober',total:rs=>['<b>Total</b>',idn(sum(rs,r=>r.n)),rp(sum(rs,r=>r.dpp)),rp(sum(rs,r=>r.tot)),rp(sum(rs,r=>r.r)),rp(sum(rs,r=>r.dpp-r.r))]}));
 const tc=topCust(S.inv,S.ret).filter(r=>r.dpp>0).sort((a,b)=>b.dpp-a.dpp);
 h+=card('Pelanggan · '+plabel(),'Omzet per pelanggan · klik untuk riwayat',table('dC',[C.txt('Pelanggan',r=>nice(cust(r.ci))),C.num('Faktur',r=>r.n),C.num('Omzet',r=>r.dpp,v=>'<b>'+rp(v)+'</b>'),C.num('% Omzet',r=>r.dpp/S.dpp,v=>pct(v,1)),C.num('Retur',r=>r.r,v=>v?rp(v):'–')],tc,{rank:true,limit:10,search:'Cari pelanggan…',go:r=>'cust:'+r.ci,csv:'pelanggan_omzet'}));
 h+=card('Daftar Faktur · '+plabel(),'Faktur penjualan PT LSI (excl. faktur uang muka)',table('dF',[C.txt('No. Faktur',r=>r[5]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.txt('Pelanggan',r=>nice(cust(r[2]))),C.num('Omzet',r=>r[3],rpFull),C.num('Total',r=>r[4],rpFull)],S.inv.slice().sort((a,b)=>b[3]-a[3]),{limit:15,search:'Cari no. faktur / pelanggan…',csv:'faktur_oktober'}));
 return{t:'Total Omzet · '+plabel(),s:'Excl. PPN, setelah diskon · faktur penjualan PT LSI',h,after}};
V.retur=()=>{const S=salesAgg();const after=[];const bks=buckets();
 let h=kg([['Retur DPP',rp(S.rdpp)],['Retur rate',S.dpp?pct(S.rdpp/S.dpp):'–','dari omzet '+rp(S.dpp)],['Dokumen bernilai',idn(S.nRet)],['Retur incl. PPN',rp(S.rtot)]]);
 const rb=bsum(RETd,bks);h+=card('Tren Retur','Retur DPP '+bucketTitle(),'<div class="chart" id="dCh"></div>');
 after.push(()=>barChart($('dCh'),{labels:bks.map(b=>b.lab),series:[{c:COL.red,v:rb}],sel:i=>bks[i].sel,go:i=>bks[i].spec,yfmt:yfmtRp,vfmt:vfmtRp,H:210,ariaCol:i=>bks[i].full,tip:i=>[bks[i].full,`Retur ${rp(rb[i])}`]}));
 const RI=retItems(D.retd.filter(r=>inR(r[0],S.R)));h+=card('Barang Diretur','Rincian barang retur penjualan · nilai DPP',table('dRI',[C.txt('Barang',r=>r.item),C.num('Qty',r=>r.qty,v=>idn(v)),C.num('Nilai',r=>r.val,v=>'<b>'+rp(v)+'</b>'),C.num('% Retur',r=>r.val/(sum(RI,x=>x.val)||1),v=>pct(v,1)),C.num('Dok.',r=>r.n)],RI,{rank:true,csv:'barang_retur',empty:'Tidak ada barang retur pada periode ini.'}));
 const rc=topCust([],S.ret).filter(r=>r.r>0||r.rn>0).sort((a,b)=>b.r-a.r);
 h+=card('Pelanggan Retur','Klik untuk riwayat pelanggan',table('dRC',[C.txt('Pelanggan',r=>nice(cust(r.ci))),C.num('Dok.',r=>r.rn),C.num('Nilai DPP',r=>r.r,v=>'<b>'+rp(v)+'</b>'),C.num('% Retur',r=>S.rdpp?r.r/S.rdpp:0,v=>pct(v,1))],rc,{rank:true,go:r=>'cust:'+r.ci,csv:'retur_pelanggan',empty:'Tidak ada retur pada periode ini.'}));
 h+=card('Dokumen Retur','Sales Return List',table('dRD',[C.txt('No. Dokumen',r=>r[5]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.txt('Pelanggan',r=>nice(cust(r[2]))),C.num('DPP',r=>r[3],v=>v?rpFull(v):'<span class="pill gry">0</span>'),C.num('Total',r=>r[4],rpFull)],S.ret.slice().sort((a,b)=>b[3]-a[3]),{search:'Cari no. dokumen / pelanggan…',csv:'dokumen_retur',empty:'Tidak ada retur pada periode ini.'}));
 return{t:'Barang Retur · '+plabel(),s:'Nilai DPP retur penjualan',h,after}};
V.diskon=()=>{if(!HASDINV)return V.diskon0();const A=dinvAgg();const after=[];
 let h=`<div class="warn">Sumber: API Accurate, rincian faktur penjualan PT LSI. Penjualan kotor = nilai barang sebelum diskon (excl. PPN, Rupiah). Di periode ini diskon per barang ${A.dl?rp(A.dl):'tidak ada'}; diskon diberikan di tingkat faktur.${FIN?` Total Oktober cocok dengan akun Sales Discount Laba Rugi (${rp(-FIN.sdisc)}).`:''}</div>`;
 h+=kg([['Diskon tertimbang',A.gross?pct(A.w,2):'–','diskon ÷ penjualan kotor'],['Rata-rata per faktur berdiskon',A.W.length?pct(A.avgW,1):'–'],['Total diskon',rp(A.disc)],['Diskon faktur',rp(A.di)],['Diskon per barang',rp(A.dl)],['Faktur berdiskon',idn(A.W.length)+' / '+idn(A.L.length)]]);
 const g=[...groupBy(A.L,r=>r[2])].map(([k,a])=>({ci:k,n:a.filter(r=>r[4]+r[5]>0.5).length,gross:sum(a,r=>r[3]),disc:sum(a,r=>r[4]+r[5])})).filter(r=>r.disc>0.5).map(r=>({...r,p:r.gross?r.disc/r.gross:0})).sort((a,b)=>b.disc-a.disc);
 h+=card('Diskon per Pelanggan','Klik untuk riwayat pelanggan',table('dDC',[C.txt('Pelanggan',r=>nice(cust(r.ci))),C.num('Faktur berdiskon',r=>r.n),C.num('Penjualan kotor',r=>r.gross,rp),C.num('Diskon',r=>r.disc,v=>'<b>'+rp(v)+'</b>'),C.num('Diskon %',r=>r.p,v=>pct(v,1))],g,{rank:true,go:r=>'cust:'+r.ci,csv:'diskon_per_pelanggan',empty:'Tidak ada diskon pada periode ini.'}));
 h+=card('Faktur Berdiskon','',table('dDF',[C.txt('No. Faktur',r=>r[1]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.txt('Pelanggan',r=>nice(cust(r[2]))),C.num('Kotor',r=>r[3],rp),C.num('Diskon',r=>r[4]+r[5],v=>'<b>'+rp(v)+'</b>'),C.num('%',r=>r[3]?(r[4]+r[5])/r[3]:0,v=>pct(v,1))],A.W.slice().sort((a,b)=>(b[4]+b[5])-(a[4]+a[5])),{limit:15,search:'Cari no. faktur / pelanggan…',csv:'faktur_berdiskon',empty:'Tidak ada faktur berdiskon pada periode ini.'}));
 return{t:'Rata-rata Diskon · '+plabel(),s:'Diskon faktur + diskon per barang · API Accurate',h,after}};
V.diskon0=()=>{const A=discAgg();const after=[];const bks=buckets();
 let h=`<div class="warn">Sumber: Rincian Faktur Penjualan PT LSI berfilter <b>Diskon</b> (diskon per barang). ${D.disc.length?'':'<b>Tidak ada baris berdiskon per barang di Oktober 2026</b> (baris berdiskon ada di Jun, Jul, Agu, Sep, dan Nov). '}Diskon tingkat faktur tercatat di akun Sales Discount${FIN?` Laba Rugi Oktober: <b>${rp(-FIN.sdisc)}</b> = <b>${pct(-FIN.sdisc/FIN.sales,2)}</b> dari penjualan kotor ${rp(FIN.sales)} (angka total Oktober, tidak terfilter harian/mingguan).`:'.'}</div>`;
 h+=kg([['Diskon tertimbang',A.L.length?pct(A.w):'–','diskon ÷ (qty × harga)'],['Rata-rata per baris',A.L.length?pct(A.avg):'–'],['Total diskon barang',rp(A.disc)],['Baris / faktur',A.L.length+' / '+A.nInv],...(FIN?[['Sales Discount (Laba Rugi Okt)',rp(-FIN.sdisc),pct(-FIN.sdisc/FIN.sales,2)+' dari sales']]:[])]);
 const agg=kf=>[...groupBy(A.L,kf)].map(([k,a])=>({k,qty:sum(a,r=>r[5]),gross:sum(a,r=>r[5]*r[6]),disc:sum(a,r=>r[8]),n:a.length})).map(r=>({...r,p:r.gross?r.disc/r.gross:0})).sort((a,b)=>b.disc-a.disc);
 const cols=l=>[C.txt(l,r=>r.k),C.num('Baris',r=>r.n),C.num('Qty',r=>r.qty),C.num('Nilai kotor',r=>r.gross,rp),C.num('Diskon',r=>r.disc,v=>'<b>'+rp(v)+'</b>'),C.num('Diskon %',r=>r.p,v=>pct(v,1))];
 h+=card('Diskon per Barang','',table('dDI',cols('Barang'),agg(r=>r[4]),{rank:true,csv:'diskon_per_barang',empty:'Tidak ada diskon per barang pada periode ini.'}));
 h+=card('Diskon per Pelanggan','',table('dDC',cols('Pelanggan'),agg(r=>nice(r[2])),{rank:true,csv:'diskon_per_pelanggan',empty:'Tidak ada diskon per barang pada periode ini.'}));
 return{t:'Rata-rata Diskon · '+plabel(),s:'Diskon per barang · faktur penjualan PT LSI',h,after}};
V.items=()=>{const I=itemsAgg();if(!HASITL&&!I.L.length)return{t:'Barang Laku Terjual',s:'Data belum tersedia',h:WAITTXT('Sales per Item 1 – 31 Okt 2026')};
 const byV=I.L.slice().sort((a,b)=>b.v-a.v);
 let h=(HASITL?'':(isYTD()?'':'<div class="warn">Data per barang hanya total Oktober; filter harian/mingguan tidak berlaku.</div>'))+kg([['Total qty barang',idn(I.q)+' unit','satuan campuran (PCS, PACK, SACK, KG)'],['Jumlah barang',idn(I.phys.length)],['Nilai penjualan',rp(I.v),'excl. PPN, setelah diskon'],...(I.lumpV?[['E-commerce gabungan',rp(I.lumpV),'item non-inventory, tanpa rincian barang']]:[]),['Baris bernilai Rp0',idn(I.free),'qty tetap dihitung · mis. Mini Store Karyawan, E-Commerce (Ladang Lima), sampel']]);
 const cols=[C.txt('Kode',r=>r.code),C.txt('Barang',r=>r.name+(r.lump?' *':'')),C.txt('Kategori',r=>r.cat),C.txt('Satuan',r=>r.unit),C.num('Qty',r=>r.q,v=>'<b>'+idn(v)+'</b>'),C.num('% qty',r=>r.lump?0:r.q/(I.q||1),v=>v?pct(v,2):'–'),C.num('Penjualan',r=>r.v,rp),C.num('% nilai',r=>r.v/(I.v||1),v=>pct(v,1))];
 h+=card('Ranking Barang Laku Terjual · '+plabel(),'Urut qty · barang fisik saja',table('dI',cols,I.phys,{rank:true,limit:25,search:'Cari barang…',csv:'ranking_barang_qty',empty:'Tidak ada penjualan barang pada periode ini.'}));
 h+=card('Ranking per Nilai Penjualan · '+plabel(),'Urut nilai (sebelum PPN)'+(I.lumpV?' · * "Penjualan e-Commerce" = omzet e-commerce gabungan (item non-inventory)':''),table('dIV',cols,byV,{rank:true,limit:25,search:'Cari barang…',csv:'ranking_barang_nilai',empty:'Tidak ada penjualan barang pada periode ini.'}));
 return{t:'Barang Laku Terjual · '+plabel(),s:(D.sales_src&&D.sales_src.source==='accurate-api'?'API Accurate · rincian barang faktur penjualan PT LSI':'Laporan Penjualan per Barang PT LSI · baris Sales Invoice'),h}};
V.cust=ci=>{ci=+ci;const R=range();const inv=D.inv.filter(r=>r[2]===ci),ret=D.ret.filter(r=>r[2]===ci);const iR=inv.filter(r=>inR(r[0],R)),rR=ret.filter(r=>inR(r[0],R));const after=[];const bks=buckets();
 let h=kg([['Omzet · periode',rp(sum(iR,r=>r[3])),plabel()],['Omzet · Oktober',rp(sum(inv,r=>r[3]))],['Faktur Oktober',idn(inv.filter(r=>r[4]>0).length)],['Retur DPP Oktober',rp(sum(ret,r=>r[3]))]]);
 const s=bsum(daySeries(inv,r=>r[0],r=>r[3]),bks);h+=card('Omzet Pelanggan','Omzet '+bucketTitle(),'<div class="chart" id="dCh"></div>');
 after.push(()=>barChart($('dCh'),{labels:bks.map(b=>b.lab),series:[{c:COL.pt,v:s}],sel:i=>bks[i].sel,go:i=>bks[i].spec,yfmt:yfmtRp,vfmt:vfmtRp,H:200,ariaCol:i=>bks[i].full,tip:i=>[bks[i].full,rp(s[i])]}));
 h+=card('Faktur · '+plabel(),'',table('dCF',[C.txt('No. Faktur',r=>r[5]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.num('Omzet',r=>r[3],rpFull)],iR,{limit:10,csv:'faktur_pelanggan'}));
 if(rR.length)h+=card('Dokumen Retur · '+plabel(),'',table('dCR',[C.txt('No. Dokumen',r=>r[5]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.num('DPP',r=>r[3],rpFull)],rR));
 return{t:nice(cust(ci)),s:'Pelanggan · '+plabel(),h,after}};
V.cat=g=>{if(!GRP.includes(g))return{t:'Kategori tidak dikenal',s:'',h:`<div class="def">Kategori <b>${esc(g)}</b> tidak tersedia di dashboard ini.</div>`};const R=range();const P=prodAgg(g,R);const N=ncAgg(g);const after=[];const bks=buckets();
 let h=kg([['Hasil',idn(P.out)+' pcs'],['Rencana (qty WO)',idn(P.plan)+' pcs'],['Capaian',P.plan?pct(P.out/P.plan,1):'–'],['Work order',idn(P.n)],...(P.sack?[['Mocaf 25 Kg',idn(P.sack)+' sak','di luar pcs']]:[]),['Waste',N.L.length?idn(N.qty)+' pcs':'tidak ada data Oktober',N.L.length?rp(N.val):'snapshot NC terakhir 31 Mei']]);
 if(g==='Tepung'){const rows=['Premix','Mocaf'].map(s=>{const wo=P.wo.filter(r=>r[4]===s);const pc=wo.filter(isPcs);return{s,n:wo.length,plan:sum(pc,r=>r[6]),out:sum(pc,r=>r[7]),sack:sum(wo.filter(r=>!isPcs(r)),r=>r[7])}});
  h+=card('Split Premix vs Mocaf','Mocaf = kategori Accurate "Cassava Flour" (Tepung Ladang Lima, Cassava Flour JANS)',table('dTS',[C.txt('Sub-kategori',r=>r.s),C.num('WO',r=>r.n),C.num('Rencana',r=>r.plan),C.num('Hasil (pcs)',r=>r.out,v=>'<b>'+idn(v)+'</b>'),C.num('Sak 25 Kg',r=>r.sack,v=>v?idn(v):'–'),C.txt('Waste',r=>'tidak ada data Oktober')],rows,{nosort:true}))}
 const subs=g==='Tepung'?['Premix','Mocaf']:[''];const ser=subs.map(s=>bsum(daySeries(D.wo,r=>r[0],r=>r[7],r=>r[3]===g&&r[4]===s&&isPcs(r)),bks));const pls=bsum(daySeries(D.wo,r=>r[0],r=>r[6],r=>r[3]===g&&isPcs(r)),bks);
 h+=card('Hasil vs Rencana','Hasil (pcs) '+bucketTitle()+' · garis putus-putus = rencana','<div class="chart" id="dCh"></div>');
 after.push(()=>barChart($('dCh'),{labels:bks.map(b=>b.lab),series:subs.map((s,i)=>({c:s?GCOL[s]:GCOL[g],v:ser[i]})),plan:{v:pls},sel:i=>bks[i].sel,go:i=>bks[i].spec,yfmt:yfmtN,vfmt:vfmtN,H:220,ariaCol:i=>bks[i].full,tip:i=>[bks[i].full,...subs.map((s,k)=>`${s||g}: ${idn(ser[k][i])}`),`Rencana: ${idn(pls[i])}`]}));
 h+=card('Produk · '+plabel(),'Klik produk untuk daftar WO',table('dCP',[C.txt('Produk',r=>r.item),...(g==='Tepung'?[C.txt('Sub',r=>r.sub)]:[]),C.txt('Satuan',r=>r.unit),C.num('WO',r=>r.n),C.num('Rencana',r=>r.plan),C.num('Hasil',r=>r.out,v=>'<b>'+idn(v)+'</b>'),C.num('Capaian',r=>r.plan?r.out/r.plan:0,v=>pct(v,1))],byProduct(P.wo),{rank:true,limit:12,search:'Cari produk…',go:r=>'pitem:'+enc(r.item),csv:'produksi_'+g,empty:'Tidak ada WO selesai pada periode ini.'}));
 h+=card('Waste','',N.L.length?'':`<div class="def">Tidak ada data Oktober. Sumber waste satu-satunya adalah snapshot stok gudang Non Conformity 31 Mei 2026 (PT LSI); tidak ada penyesuaian stok di Oktober.</div>`);
 h+=card('Work Order · '+plabel(),'Tanggal = Finished Good Slip terakhir',table('dCWO',[C.txt('No. WO',r=>r[8]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.txt('Produk',r=>r[2]),C.num('Rencana',r=>r[6]),C.num('Hasil',r=>r[7],v=>'<b>'+idn(v)+'</b>'),C.txt('Satuan',r=>r[5])],P.wo.slice().sort((a,b)=>b[0]-a[0]),{limit:12,search:'Cari WO / produk…',csv:'wo_'+g,empty:'Tidak ada WO pada periode ini.'}));
 return{t:`Hasil Produksi & Waste · ${g}${g==='Tepung'?' (Premix + Mocaf)':''}`,s:plabel()+' · barang jadi',h,after}};
V.pitem=n=>{n=dec(n);const R=range();const all=D.wo.filter(r=>r[2]===n),wo=all.filter(r=>inR(r[0],R));
 let h=kg([['Hasil · periode',idn(sum(wo,r=>r[7]))],['Rencana · periode',idn(sum(wo,r=>r[6]))],['WO · periode',idn(wo.length)],['Hasil · Oktober',idn(sum(all,r=>r[7]))]]);
 h+=card('Work Order · '+plabel(),'',table('dPW',[C.txt('No. WO',r=>r[8]),C.txt('Tanggal',r=>r[0],{f:v=>fmtDL(v)}),C.num('Rencana',r=>r[6]),C.num('Hasil',r=>r[7],v=>'<b>'+idn(v)+'</b>')],wo.slice().sort((a,b)=>b[0]-a[0]),{limit:15,csv:'wo_produk'}));
 return{t:n,s:'Produk · '+(all[0]?all[0][3]+(all[0][4]?' / '+all[0][4]:''):''),h}};
V.waste=()=>({t:'Waste · Oktober 2026',s:'Stok Non-Conformity',h:`<div class="def">Tidak ada data Oktober. Sumber waste satu-satunya adalah snapshot stok Non Conformity 31 Mei 2026 (${D.nc_all_n} baris, ${idn(D.nc_all_qty)} pcs, PT LSI); Inventory Adjustment tidak punya baris di Oktober.</div>`});
function plTable(id,rows,base){return table(id,[C.txt('Akun',r=>r[0],{f:(v,r)=>`<span style="padding-left:${Math.max(0,r[2]-1)*14}px;${r[2]<=1?'font-weight:800':''}">${esc(v)}</span>`}),C.num('Nilai (Rp)',r=>r[1]??0,(v,r)=>r[1]==null?'':rpFull(Math.round(v))),C.num('% Revenue',r=>(r[1]??0)/base,(v,r)=>r[1]==null?'':pct(v,1))],rows,{nosort:true,csv:id})}
V.fin=k=>{if(!FIN)return{t:'Neraca Finansial',s:'Data belum tersedia',h:WAITTXT('Laba Rugi 1 – 31 Okt 2026')};
 const note=isYTD()?'':`<div class="warn"><b>Data hanya total Oktober.</b> Filter ${GNAME[F.g]} (${plabel()}) tidak berlaku; angka = total 1 – 31 Okt 2026.</div>`;
 const scope='<div class="def" style="margin:0 0 14px">Sumber: Laba Rugi (Standard) database PT LSI, 1 – 31 Okt 2026, semua cabang.</div>';
 const grp=rows=>rows.filter(r=>r[2]===1&&r[1]!=null);
 if(k==='rev'){let h=note+scope+kg([['Revenue',rp(FIN.rev)],['Sales (kotor)',rp(FIN.sales)],['Sales Discount',rp(FIN.sdisc)],['Sales Return',rp(FIN.sret)],['Omzet faktur Okt',rp(sum(D.inv,r=>r[3])),'Sales Invoice List']]);h+=card('Akun Revenue','',plTable('pRev',FIN.rev_rows,FIN.rev));return{t:'Revenue / Omzet · Oktober 2026',s:'Laba Rugi PT LSI',h}}
 if(k==='cogs'){let h=note+scope+kg([['COGS / HPP',rp(FIN.cogs),pct(FIN.cogs/FIN.rev,1)+' dari revenue'],...grp(FIN.cogs_rows).map(r=>[esc(r[0]),rp(r[1]),pct(r[1]/FIN.cogs,1)+' dari HPP'])]);h+=card('Akun HPP','',plTable('pCogs',FIN.cogs_rows,FIN.rev));return{t:'COGS / HPP · Oktober 2026',s:'Laba Rugi PT LSI',h}}
 if(k==='opex'){const g=grp(FIN.opex_rows).sort((a,b)=>b[1]-a[1]);const m=g.length?g[0][1]:1;let h=note+scope+kg([['Total OPEX',rp(FIN.opex),pct(FIN.opex/FIN.rev,1)+' dari revenue']]);
  h+=card('Per Kelompok Biaya','',`<div class="wf">${g.map(r=>`<div style="display:grid;grid-template-columns:minmax(0,150px) minmax(40px,1fr) auto;gap:10px;align-items:center;font-size:12px;padding:4px"><span class="n">${esc(r[0].replace(' Expenses',''))}</span><span class="t" style="height:16px;background:#F1F5F9;border-radius:4px;position:relative;overflow:hidden"><i style="position:absolute;top:0;bottom:0;left:0;width:${Math.max(0,r[1]/m*100).toFixed(1)}%;background:${COL.red};border-radius:4px"></i></span><span style="font-weight:800">${rp(r[1])}</span></div>`).join('')}</div>`);
  h+=card('Akun Biaya Operasional','',plTable('pOpex',FIN.opex_rows,FIN.rev));return{t:'Biaya / OPEX · Oktober 2026',s:'Laba Rugi PT LSI',h}}
 let h=note+scope+kg([['Laba kotor',rp(FIN.gross),pct(FIN.gross/FIN.rev,1)+' gross margin'],['Laba operasi',rp(FIN.oper),pct(FIN.oper/FIN.rev,1)],['Pendapatan/biaya lain bersih',rp(FIN.oth_net)],['Laba bersih',rp(FIN.net),pct(FIN.net/FIN.rev,1)+' net margin']]);
 const rows=[['Revenue',FIN.rev],['− COGS / HPP',-FIN.cogs],['= Laba Kotor',FIN.gross],['− OPEX',-FIN.opex],['= Laba Operasi',FIN.oper],['± Lain-lain (bersih)',FIN.oth_net],['= Laba Bersih',FIN.net]];
 h+=card('Alur Laba','',table('pPr',[C.txt('Pos',r=>r[0],{f:v=>v.startsWith('=')?'<b>'+esc(v)+'</b>':esc(v)}),C.num('Nilai',r=>r[1],v=>rpFull(Math.round(v))),C.num('% Revenue',r=>r[1]/FIN.rev,v=>pct(v,1))],rows,{nosort:true,csv:'alur_laba'}));
 h+=card('Akun Pendapatan & Biaya Lain','',plTable('pOth',FIN.oth_rows,FIN.rev));return{t:'Profit · Oktober 2026',s:'Laba Rugi PT LSI',h}};
function agingView(kind){const isAR=kind==='ar';const T=isAR?ART:APT;if(!T)return{t:isAR?'Piutang':'Hutang',s:'Data belum tersedia',h:WAITTXT(isAR?'Umur Piutang per 31 Okt 2026':'Umur Hutang per 31 Okt 2026')};const after=[];
 const note=isYTD()?'':`<div class="warn"><b>Data hanya per 31 Okt.</b> Filter ${GNAME[F.g]} tidak berlaku.</div>`;const nb=BS&&(isAR?BS.ar:BS.ap)!=null;
 let h=note+kg([[isAR?'Total piutang':'Total hutang',rp(T[0])],...AGE.map((a,i)=>[a,rp(T[i+1]),T[0]?pct(T[i+1]/T[0],1):'']),[isAR?'Saldo neraca AR':'Saldo neraca AP',nb?rp(isAR?BS.ar:BS.ap):'data belum tersedia']]);
 h+=card('Per Kelompok Umur','','<div class="chart" id="dCh"></div>');
 after.push(()=>barChart($('dCh'),{labels:AGS,series:[{c:isAR?COL.pt:COL.gold,v:T.slice(1)}],yfmt:yfmtRp,vfmt:vfmtRp,H:200,ariaCol:i=>AGE[i],tip:i=>[AGE[i],rp(T[i+1])]}));
 const cols=[C.txt(isAR?'Pelanggan':'Pemasok',r=>r.k),C.num('Total',r=>r.t,v=>'<b>'+rp(v)+'</b>'),C.num('Belum JT',r=>r.b[0],rp),C.num('1–30',r=>r.b[1],rp),C.num('31–60',r=>r.b[2],rp),C.num('> 60',r=>r.b[3]+r.b[4]+r.b[5],rp)];
 const rows=isAR?[...groupBy(D.ar,r=>r[0])].map(([k,a])=>({k:nice(k),t:sum(a,r=>r[4]),b:[5,6,7,8,9,10].map(i=>sum(a,r=>r[i]))})):D.ap.map(r=>({k:r[0],t:r[1],b:r.slice(2)}));
 h+=card(isAR?'Piutang per Pelanggan':'Hutang per Pemasok','',table('dAG',cols,rows.sort((a,b)=>b.t-a.t),{rank:true,limit:15,search:'Cari…',csv:isAR?'umur_piutang':'umur_hutang'}));
 return{t:isAR?'Piutang · Umur Piutang':'Hutang · Umur Hutang Pemasok',s:'Posisi per 31 Okt 2026 · PT LSI',h,after}}
V.ar=()=>agingView('ar');V.ap=()=>agingView('ap');
V.wh=(k,sel)=>{const m=WMOD[k];if(!m)return{t:'Gudang tidak dikenal',s:'',h:`<div class="def">Modul gudang <b>${esc(k)}</b> tidak tersedia di dashboard ini.</div>`};if(!D.stock)return{t:m.t,s:'Data belum tersedia',h:WAITTXT('stok per gudang per 31 Okt 2026')};const ws=WH.filter(m.f);if(!ws.length)return{t:m.t,s:'',h:'<div class="def">Gudang yang dipetakan tidak ada di export.</div>'};
 sel=sel?dec(sel):(k==='sur'?'FG':ws[0].wh);const pick=sel==='FG'?ws.filter(w=>/^Finished Goods/.test(w.wh)).map(w=>w.wh):sel==='ALL'?ws.map(w=>w.wh):[sel];const L=D.stock.filter(r=>pick.includes(r[0]));
 let h=(isYTD()?'':`<div class="warn"><b>Data hanya per 31 Okt.</b> Filter ${GNAME[F.g]} tidak berlaku.</div>`)+`<div class="def" style="margin:0 0 14px">Pemetaan gudang ke modul adalah <b>asumsi</b>${k==='sur'?': gudang berakhiran "- SUB" (Surabaya) dan "- PSN" (kemungkinan Pasuruan) digabung':': "'+esc(ws.map(w=>w.wh).join(', '))+'"'}. Kuantitas satuan campuran (pcs, kg, dll.); nilai = Total Cost dari Accurate.</div>`;
 h+=kg([['Total kuantitas',idn(sum(ws,w=>w.q))],['Gudang',idn(ws.length)],['Barang jadi',idn(sum(ws,w=>w.fg))],['Nilai persediaan',rp(sum(ws,w=>w.v))],['Pilihan: '+(sel==='FG'?'Finished Goods':sel==='ALL'?'Semua gudang':esc(sel)),idn(sum(L,r=>r[4])),L.length+' baris barang']]);
 if(ws.length>1)h+=`<div class="mtabs" role="group" aria-label="Pilih gudang">${k==='sur'?`<button type="button" data-go="wh:${k}:FG" aria-pressed="${sel==='FG'}">Finished Goods (SUB + PSN)</button>`:''}<button type="button" data-go="wh:${k}:ALL" aria-pressed="${sel==='ALL'}">Semua</button>${ws.map(w=>`<button type="button" data-go="wh:${k}:${enc(w.wh)}" aria-pressed="${sel===w.wh}">${esc(w.wh)}</button>`).join('')}</div>`;
 h+=card('Per Gudang','Klik baris untuk isi gudang',table('dWH',[C.txt('Gudang',r=>r.wh,{f:v=>esc(v)+(/^Finished Goods/.test(v)?' <span class="pill grn">FG</span>':'')}),C.txt('Lokasi',r=>r.site==='SUB'?'Surabaya (SUB)':r.site==='PSN'?'PSN (Pasuruan?)':r.wh.replace('Branch - ','')),C.num('Baris',r=>r.n),C.num('Kuantitas',r=>r.q,v=>'<b>'+idn(v)+'</b>'),C.num('Nilai',r=>r.v,rp)],ws,{go:r=>'wh:'+k+':'+enc(r.wh),sel:r=>pick.includes(r.wh)}));
 h+=card('Per Kategori Barang','',table('dWC',[C.txt('Kategori',r=>r.c),C.num('Baris',r=>r.n),C.num('Kuantitas',r=>r.q,v=>'<b>'+idn(v)+'</b>'),C.num('Nilai',r=>r.v,rp)],[...groupBy(L,r=>r[3]||'(tanpa kategori)')].map(([c,a])=>({c,n:a.length,q:sum(a,r=>r[4]),v:sum(a,r=>r[5]||0)})).sort((a,b)=>b.q-a.q),{csv:'stok_kategori'}));
 h+=card('Daftar Barang','',table('dWL',[C.txt('Kode',r=>r[1]),C.txt('Barang',r=>r[2]),C.txt('Kategori',r=>r[3]),...(pick.length>1?[C.txt('Gudang',r=>r[0])]:[]),C.num('Kuantitas',r=>r[4],v=>'<b>'+idn(v,v%1?2:0)+'</b>'),C.num('Nilai',r=>r[5]||0,rp)],L.slice().sort((a,b)=>b[4]-a[4]),{limit:20,search:'Cari kode / barang…',csv:'stok_barang'}));
 return{t:m.t,s:'Item Quantity per Warehouse · per 31 Okt 2026',h}};
V.whx=w=>{w=dec(w);const L=(D.stock||[]).filter(r=>r[0]===w);let h=`<div class="def" style="margin:0 0 14px">Gudang ini tidak dipetakan ke modul Surabaya / Jakarta / Bali.</div>`+kg([['Kuantitas',idn(sum(L,r=>r[4]))],['Nilai',rp(sum(L,r=>r[5]||0))],['Baris barang',L.length]]);
 h+=card('Daftar Barang','',table('dWX',[C.txt('Kode',r=>r[1]),C.txt('Barang',r=>r[2]),C.txt('Kategori',r=>r[3]),C.num('Kuantitas',r=>r[4],v=>idn(v,v%1?2:0)),C.num('Nilai',r=>r[5]||0,rp)],L.slice().sort((a,b)=>b[4]-a[4]),{limit:20,search:'Cari…'}));return{t:w,s:'Gudang lain',h}};
V.emp=()=>{const st=[...groupBy(EMP,r=>r[4]||'(kosong)')].map(([k,a])=>({k,n:a.length})).sort((a,b)=>b.n-a.n);const pos=[...groupBy(EMP,r=>r[1]||'(kosong)')].map(([k,a])=>({k,n:a.length})).sort((a,b)=>b.n-a.n||a.k.localeCompare(b.k));
 let h='<div class="warn">Daftar karyawan adalah data master (diekspor 13 Nov 2026) tanpa tanggal; tidak bisa dipotong per Oktober dan filter waktu tidak berlaku.</div>'+kg([['Baris tercatat',idn(EMP.length)],...st.map(s=>[esc(s.k.replace(/_/g,' ')),idn(s.n)]),['Ditandai Salesman',idn(EMP.filter(r=>r[5]==='YES').length)]]);
 h+=`<div class="def" style="margin:0 0 14px">${NONPERSON.length} entri tampak bukan karyawan perorangan: ${NONPERSON.map(esc).join(', ')}. Jumlah di atas tetap menghitung semua baris sesuai Accurate; tanpa entri ini menjadi ${EMP.length-EMP.filter(r=>NONPERSON.includes(r[0])).length} baris.</div>`;
 h+=card('Per Jabatan (Position)','Kolom Department kosong di Accurate',table('dEP',[C.txt('Jabatan',r=>r.k),C.num('Jumlah',r=>r.n)],pos,{limit:15,csv:'karyawan_per_jabatan'}));
 h+=card('Daftar Karyawan','',table('dEL',[C.txt('Nama',r=>r[0],{f:v=>esc(v)+(NONPERSON.includes(v)?' <span class="pill gry">bukan perorangan?</span>':'')}),C.txt('ID',r=>r[2]),C.txt('Jabatan',r=>r[1]||'–'),C.txt('Bergabung',r=>r[3].split('/').reverse().join(''),{f:(v,r)=>esc(r[3])}),C.txt('Status kerja',r=>r[4]||'–'),C.txt('Salesman',r=>r[5])],EMP,{limit:15,search:'Cari nama / jabatan…',csv:'daftar_karyawan'}));
 return{t:'Jumlah Karyawan',s:'Daftar Karyawan Accurate · PT LSI',h}};
V.notes=()=>({t:'Catatan Data & Metodologi',s:'Sumber: Accurate Online · Oktober 2026',h:`<div class="card" style="font-size:12.5px;line-height:1.65;color:#3D4B61">${notesHtml().replace(/<p>/g,'<p style="margin-bottom:8px">')}</div>`});
// ---------- dialog / router
const ov=$('ov'),dlgB=$('dlgB');let stack=[],lastFocus=null;
function go(spec,push=true){if(!spec)return;const[k,...a]=spec.split(':');if(k==='p'){setPeriod(a[0],a[1]);return}const v=V[k];if(!v)return;const r=v(...a);
 if(ov.hidden){lastFocus=document.activeElement;ov.hidden=false;document.body.style.overflow='hidden';requestAnimationFrame(()=>ov.classList.add('on'));stack=[]}
 if(push)stack.push(spec);$('dlgT').textContent=r.t;$('dlgS').textContent=r.s||'';const st=push?0:dlgB.scrollTop;dlgB.innerHTML=r.h;dlgB.scrollTop=st;(r.after||[]).forEach(f=>f());
 $('dlgBack').hidden=stack.length<2;if(push)dlgB.focus({preventScroll:true})}
function back(){if(stack.length>1){stack.pop();go(stack[stack.length-1],false)}}
function closeDlg(){if(ov.hidden)return;ov.classList.remove('on');setTimeout(()=>{ov.hidden=true;dlgB.innerHTML=''},150);document.body.style.overflow='';stack=[];if(lastFocus&&lastFocus.focus)lastFocus.focus()}
$('dlgX').onclick=closeDlg;$('dlgBack').onclick=back;
ov.addEventListener('click',e=>{if(e.target===ov)closeDlg()});
// ---------- sidebar & menus
const side=$('side'),sideOv=$('sideOv'),burger=$('burger');
function sideToggle(o){side.classList.toggle('open',o);sideOv.hidden=!o;burger.setAttribute('aria-expanded',o)}
burger.onclick=()=>sideToggle(!side.classList.contains('open'));sideOv.onclick=()=>sideToggle(false);
function showMenu(m){if(!MENUS[m])m='penjualan';MENU=m;document.querySelectorAll('[data-menu]').forEach(a=>{a.classList.toggle('on',a.dataset.menu===m);if(a.dataset.menu===m)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+m));$('pageT').textContent=MENUS[m];render();window.scrollTo(0,0)}
document.querySelectorAll('[data-menu]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#'+a.dataset.menu);showMenu(a.dataset.menu);sideToggle(false)}));
// ---------- delegation
const tip=$('tip');
document.addEventListener('click',e=>{const s=e.target.closest('[data-sort]');if(s){const[id,i]=s.dataset.sort.split(':');const t=TBL[id];t.sort=t.sort&&t.sort[0]==+i?[+i,-t.sort[1]]:[+i,TBL[id].cols[+i].num?-1:1];rerender(id);return}
 const mo=e.target.closest('[data-more]');if(mo){TBL[mo.dataset.more].all=true;rerender(mo.dataset.more);return}
 const cv=e.target.closest('[data-csv]');if(cv){csv(cv.dataset.csv);return}
 const g=e.target.closest('[data-go]');if(g){e.preventDefault();tip.classList.remove('on');if(g.closest('.side'))sideToggle(false);go(g.dataset.go,true);return}});
document.addEventListener('input',e=>{const s=e.target.dataset&&e.target.dataset.search;if(s){TBL[s].q=e.target.value.trim();TBL[s].all=!!TBL[s].q;rerender(s)}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(!ov.hidden){e.preventDefault();closeDlg()}else if(side.classList.contains('open'))sideToggle(false);return}
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-go]:not(button):not(a),[data-sort]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return}
 if(e.key==='Tab'&&!ov.hidden){const f=[...$('dlg').querySelectorAll('button:not([hidden]),[tabindex="0"],input,select,a[href]')].filter(x=>x.offsetParent!==null||x.closest('svg'));if(!f.length)return;const a=f[0],z=f[f.length-1];if(e.shiftKey&&(document.activeElement===a||document.activeElement===dlgB)){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}});
function showTip(el,x,y){const t=el.getAttribute('data-tip');if(!t){tip.classList.remove('on');return}
 const[h,...ls]=t.split('\n');const b=document.createElement('b');b.textContent=h;tip.replaceChildren(b);
 for(const l of ls)tip.append(document.createElement('br'),l);
 tip.classList.add('on');const r=tip.getBoundingClientRect();let L=x+14,T=y+14;if(L+r.width>innerWidth-8)L=x-r.width-14;if(T+r.height>innerHeight-8)T=y-r.height-14;tip.style.left=Math.max(8,L)+'px';tip.style.top=Math.max(8,T)+'px'}
document.addEventListener('mousemove',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el)showTip(el,e.clientX,e.clientY);else tip.classList.remove('on')});
document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('[data-tip]');if(el&&el.getAttribute('data-tip')){const r=el.getBoundingClientRect();showTip(el,r.left+r.width/2,r.top)}else tip.classList.remove('on')});
document.addEventListener('scroll',()=>tip.classList.remove('on'),true);
// ---------- filter controls (scope Oktober 2026)
const seg=$('seg'),pick=$('pick'),pickL=$('pickL');
function syncPicker(){seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===F.g));
 if(F.g==='D'){pickL.textContent='Tanggal';pick.innerHTML=`<input type="date" id="pD" min="${isoD(MIND)}" max="${isoD(MAXD)}" value="${isoD(F.d)}" aria-label="Pilih tanggal (Oktober 2026)">`;$('pD').onchange=e=>{const v=e.target.value;if(!v)return;const[y,m,d]=v.split('-').map(Number);let x=dIdx(y,m,d);x=Math.max(MIND,Math.min(MAXD,x));setPeriod('D',x)}}
 else if(F.g==='W'){pickL.textContent='Minggu';pick.innerHTML=`<select id="pW" aria-label="Pilih minggu">${Array.from({length:NW-W0+1},(_,i)=>i+W0).map(w=>`<option value="${w}"${w===F.w?' selected':''}>W${w} · ${fmtD(wStart(w))} – ${fmtD(wEnd(w))}</option>`).join('')}</select>`;$('pW').onchange=e=>setPeriod('W',e.target.value)}
 else if(F.g==='M'){pickL.textContent='Bulan';pick.innerHTML=`<select id="pM" aria-label="Pilih bulan"><option value="10" selected>Oktober 2026</option></select>`}
 else{pickL.textContent='Tahun';pick.innerHTML=`<select id="pY" aria-label="Pilih tahun"><option value="2026" selected>2026 (hanya Oktober)</option></select>`}}
seg.addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;const g=b.dataset.g;
 if(g==='W'&&F.g==='D')F.w=wOf(F.d);if(g==='D'&&F.g==='W')F.d=wEnd(F.w);
 setPeriod(g,g==='D'?F.d:g==='W'?F.w:10)});
// ---------- init
syncPicker();
const h0=location.hash.replace('#','');showMenu(MENUS[h0]?h0:'penjualan');
function fromHash(){const m=location.hash.match(/^#detail=(.+)$/);if(m)go(dec(m[1]))}
fromHash();window.addEventListener('hashchange',()=>{const h=location.hash.replace('#','');if(MENUS[h])showMenu(h);else fromHash()});
window.go=go;window.setPeriod=setPeriod;window.showMenu=showMenu;

}};
})();
