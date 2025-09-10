// ------- Elementos -------
const $ = (id)=>document.getElementById(id);
const csvText = $('csvText'), csvFile = $('csvFile'), parseBtn = $('parseBtn'), sampleBtn = $('sampleBtn');
const alerts = $('alerts');
const tbl = $('tbl'), thead = tbl.querySelector('thead'), tbody = tbl.querySelector('tbody');
const xSel = $('xSel'), ySel = $('ySel'), aggSel = $('aggSel'), drawBtn = $('drawBtn');
const canvas = $('chart'), ctx = canvas.getContext('2d'), chartAlt = $('chartAlt');
const themeBtn = $('themeBtn');

// ------- Estado -------
let headers = [];
let rows = []; // [{col: val, ...}]

// ------- Utilidades -------
const alertMsg = (msg)=> {
  const d = document.createElement('div');
  d.className = 'alert'; d.textContent = msg; alerts.appendChild(d);
  setTimeout(()=>d.remove(), 5000);
};

const isNum = (v)=> v !== '' && !isNaN(Number(v));

/* Split por comas fuera de comillas: simple y corto */
function splitCSVLine(line){
  return line.match(/("([^"]|"")*"|[^,]*)/g)
             .filter(s=>s!==undefined && s!=='')
             .map(s=>{
               s=s.trim();
               if(s.startsWith('"') && s.endsWith('"')) s = s.slice(1,-1).replace(/""/g,'"');
               return s;
             });
}

/* Parser sencillo (maneja comillas y comas dentro de comillas) */
function parseCSV(text){
  const lines = text.replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim()!=='');
  if(lines.length===0) return {headers:[], rows:[], issues:['CSV vacío']};
  const h = splitCSVLine(lines[0]);
  const issues = [];
  const width = h.length;
  const data = lines.slice(1).map((ln,i)=>{
    const cols = splitCSVLine(ln);
    if(cols.length !== width) issues.push(`Fila ${i+2}: ${cols.length} columnas, esperado ${width}.`);
    const obj = {};
    h.forEach((k,idx)=> obj[k||`col_${idx+1}`]= cols[idx] ?? '');
    return obj;
  });
  return {headers:h, rows:data, issues};
}

/* Render tabla mínima */
function renderTable(){
  thead.innerHTML = ''; tbody.innerHTML = '';
  if(headers.length===0 || rows.length===0) return;
  const trh = document.createElement('tr');
  headers.forEach(h=>{
    const th = document.createElement('th'); th.textContent = h || '(sin nombre)'; trh.appendChild(th);
  });
  thead.appendChild(trh);

  rows.forEach(r=>{
    const tr = document.createElement('tr');
    headers.forEach(h=>{
      const td = document.createElement('td'); td.textContent = r[h] ?? ''; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/* Llenar selects de gráfica */
function fillChartControls(){
  xSel.innerHTML = ''; ySel.innerHTML = '';
  headers.forEach(h=>{ xSel.add(new Option(h,h)); ySel.add(new Option(h,h)); });
  xSel.selectedIndex = 0;
  const firstNum = headers.findIndex(h=> rows.some(r=> isNum(r[h])) );
  ySel.selectedIndex = firstNum >= 0 ? firstNum : 0;
}

/* Agregación simple */
function aggregate(xKey, yKey, agg){
  const map = new Map(); // cat -> array vals
  rows.forEach(r=>{
    const cat = String(r[xKey] ?? '');
    const val = (agg==='count') ? 1 : Number(r[yKey]);
    if(agg==='count' || isNum(r[yKey])){
      if(!map.has(cat)) map.set(cat, []);
      map.get(cat).push(val);
    }
  });
  const out = [];
  for(const [cat, arr] of map){
    let v = 0;
    if(agg==='sum' || agg==='count') v = arr.reduce((a,b)=>a+b,0);
    if(agg==='avg') v = arr.reduce((a,b)=>a+b,0) / (arr.length||1);
    out.push({category:cat, value:v});
  }
  return out.sort((a,b)=> a.category.localeCompare(b.category,'es',{numeric:true}));
}

/* Dibujo de barras (vertical) muy simple */
function drawBars(data){
  // dimensiones (un poco responsive)
  const cssW = Math.max(400, Math.min(900, data.length * 70));
  const cssH = 420, dpi = window.devicePixelRatio||1;
  canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpi); canvas.height = Math.floor(cssH * dpi);
  ctx.setTransform(dpi,0,0,dpi,0,0);
  ctx.clearRect(0,0,cssW,cssH);

  const styles = getComputedStyle(document.documentElement);
  const color = styles.getPropertyValue('--text').trim() || '#111';
  ctx.fillStyle = color; ctx.strokeStyle = '#9993'; ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  const margin = {top:20,right:20,bottom:80,left:60};
  const W = cssW - margin.left - margin.right;
  const H = cssH - margin.top - margin.bottom;
  const maxV = Math.max(1, ...data.map(d=>d.value));

  // grid
  ctx.save(); ctx.translate(margin.left, margin.top);
  for(let i=0;i<=5;i++){
    const y = H - (i/5)*H;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    const val = Math.round((i/5)*maxV*100)/100;
    ctx.fillText(String(val), -10, y);
  }

  const barW = W / Math.max(1,data.length);
  data.forEach((d,i)=>{
    const h = (d.value/maxV)*H;
    const x = i*barW + barW*0.1, y = H - h, w = barW*0.8;
    ctx.fillRect(x,y,w,h);
    // etiqueta categoría
    ctx.save(); ctx.translate(x+w/2, H+15); ctx.rotate(-Math.PI/4);
    ctx.textAlign='left'; ctx.fillText(d.category, 0, 0); ctx.restore();
    // valor
    ctx.textAlign='center'; ctx.fillText(String(Math.round(d.value*100)/100), x+w/2, y-10);
  });
  ctx.restore();

  chartAlt.textContent = `Barras: ${data.length} categorías. Máx=${Math.round(maxV*100)/100}.`;
}

// ------- Eventos -------
sampleBtn.addEventListener('click', ()=>{
  csvText.value = `Producto,Mes,Ventas
A,Jan,120
A,Feb,90
A,Mar,150
B,Jan,200
B,Feb,160
B,Mar,220
C,Jan,80
C,Feb,110
C,Mar,95`;
});

csvFile.addEventListener('change', async e=>{
  const f = e.target.files?.[0]; if(!f) return;
  csvText.value = await f.text();
  alertMsg(`Archivo “${f.name}” cargado. Presiona Procesar.`);
});

parseBtn.addEventListener('click', ()=>{
  alerts.innerHTML = '';
  const out = parseCSV(csvText.value);
  if(out.issues.length) out.issues.forEach(m=>alertMsg(m));
  if(out.headers.length===0 || out.rows.length===0){ alertMsg('No hay datos para mostrar.'); return; }
  headers = out.headers; rows = out.rows;
  renderTable(); fillChartControls();
});

drawBtn.addEventListener('click', ()=>{
  if(!headers.length) return alertMsg('Primero procesa un CSV.');
  const data = aggregate(xSel.value, ySel.value, aggSel.value);
  if(data.length===0) return alertMsg('No hay datos numéricos para graficar.');
  drawBars(data);
});

// Tema claro/oscuro simple
(function(){
  const saved = localStorage.getItem('theme'); if(saved) document.documentElement.setAttribute('data-theme', saved);
})();
themeBtn.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme')||'system';
  const next = cur==='dark' ? 'light' : (cur==='light' ? 'system' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
  themeBtn.setAttribute('aria-pressed', String(next==='dark'));
  localStorage.setItem('theme', next);
});
