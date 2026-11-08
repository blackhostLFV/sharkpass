(() => {
 const rgb=s=>{const m=s.match(/[\d.]+/g);return m?[+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]:[0,0,0,0]};
 const mix=(a,b)=>[...a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),1];
 const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const results=[],checked=[];
 for(const e of document.querySelectorAll('#message,p,h1,h2,h3,h4,a,button,label,span,dt,dd,summary,small,strong,li,legend')){
  const text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
  if(!text||!e||e.closest('script,style,.sr-only,[hidden]'))continue;
  const style=getComputedStyle(e),r=e.getBoundingClientRect();
  if(!r.width||!r.height||style.visibility==='hidden'||style.display==='none')continue;
  let chain=[],opacity=1,images=false;
  for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);chain.push(rgb(s.backgroundColor));opacity*=+s.opacity;if(s.backgroundImage!=='none')images=true;}
  let bg=[255,255,255,1];for(const layer of chain.reverse())bg=mix(layer,bg);
  const fg=rgb(style.color);fg[3]*=opacity;
  const value=ratio(mix(fg,bg),bg),large=(+style.fontSize.replace('px',''))>=24||((+style.fontSize.replace('px',''))>=18.66&&+style.fontWeight>=700),required=large?3:4.5;
  const row={text:text.slice(0,80),tag:e.tagName,cls:String(e.className).slice(0,80),foreground:style.color,background:bg.slice(0,3).map(Math.round),ratio:+value.toFixed(2),required};
  if(images)continue;
  checked.push(row);if(value+.001<required)results.push(row);
 }
 return {url:location.pathname+location.search,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,checked:checked.length,failures:results};
})()
