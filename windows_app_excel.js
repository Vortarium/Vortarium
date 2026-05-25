// ===== MICROSOFT EXCEL =====
AppLauncher.register('excel', {
  title: 'Microsoft Excel', icon: '📗',
  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('excel')) {
      _showInstallGate('Microsoft Excel', '📗', 'excel'); return;
    }
    const id = WM.create({ title:'Microsoft Excel', icon:'📗', width:1200, height:800, appId:'excel' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;background:#fff;color:#000;font-family:"Segoe UI",sans-serif;';

    const saved = (typeof OS !== 'undefined' && OS.getAppData('excel')) || {};
    const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const NC = 26, NR = 50;

    const state = {
      wb: saved.wb || { sheets: [{ name:'Sheet1', cells:{}, styles:{} }] },
      si: 0,
      sel: 'A1',
      selStart: null, selEnd: null,
      fbar: '',
      clip: null,
      zoom: 100,
      activeMenu: null,
    };
    const save = () => { if (typeof OS !== 'undefined') OS.setAppData('excel', { wb: state.wb }); };
    const sheet = () => state.wb.sheets[state.si];
    const addr = (c,r) => COLS[c]+(r+1);
    const parse = a => { const m=a.match(/^([A-Z]+)(\d+)$/); if(!m) return {c:0,r:0}; return {c:COLS.indexOf(m[1]),r:parseInt(m[2])-1}; };

    const evalFormula = (f, cells) => {
      if (!f || !String(f).startsWith('=')) return f;
      try {
        let e = String(f).slice(1).toUpperCase();
        const fns = {
          SUM:v=>v.reduce((a,x)=>a+(parseFloat(x)||0),0),
          AVERAGE:v=>{const n=v.filter(x=>x!==''&&!isNaN(x));return n.length?n.reduce((a,x)=>a+parseFloat(x),0)/n.length:0;},
          COUNT:v=>v.filter(x=>x!==''&&!isNaN(x)).length,
          MAX:v=>{const n=v.filter(x=>!isNaN(x)&&x!=='').map(parseFloat);return n.length?Math.max(...n):0;},
          MIN:v=>{const n=v.filter(x=>!isNaN(x)&&x!=='').map(parseFloat);return n.length?Math.min(...n):0;},
          ABS:v=>Math.abs(parseFloat(v[0])),
          SQRT:v=>Math.sqrt(parseFloat(v[0])),
          ROUND:v=>Math.round(parseFloat(v[0])*(10**parseInt(v[1]||0)))/(10**parseInt(v[1]||0)),
          IF:v=>parseFloat(v[0])?v[1]:v[2],
          LEN:v=>String(v[0]||'').length,
          UPPER:v=>String(v[0]||'').toUpperCase(),
          LOWER:v=>String(v[0]||'').toLowerCase(),
          CONCATENATE:v=>v.join(''),
          NOW:()=>new Date().toLocaleString(),
          TODAY:()=>new Date().toLocaleDateString(),
        };
        e = e.replace(/([A-Z]+)\(([^)]*)\)/g,(m,fn,args)=>{
          if(!fns[fn]) return m;
          const vals = args.split(',').flatMap(a=>{
            a=a.trim();
            if(a.includes(':')) {
              const [s,en]=a.split(':');
              const sc=s.match(/[A-Z]+/)[0],sr=parseInt(s.match(/\d+/)[0]);
              const ec=en.match(/[A-Z]+/)[0],er=parseInt(en.match(/\d+/)[0]);
              const si=COLS.indexOf(sc),ei=COLS.indexOf(ec),res=[];
              for(let r=sr;r<=er;r++) for(let c=si;c<=ei;c++) res.push(cells[COLS[c]+r]||'');
              return res;
            }
            return [cells[a]!==undefined?cells[a]:a.replace(/^"|"$/g,'')];
          });
          return fns[fn](vals);
        });
        e = e.replace(/\b([A-Z]+\d+)\b/g,ref=>{
          const v=cells[ref];
          if(v===undefined||v==='') return '0';
          if(String(v).startsWith('=')) return evalFormula(v,cells);
          return isNaN(v)?`"${v}"`:v;
        });
        const res = Function('"use strict";return('+e+')')();
        return isNaN(res)?res:+parseFloat(res).toFixed(10);
      } catch(e){ return '#ERR'; }
    };

    const inSel = a => {
      if(!state.selStart||!state.selEnd) return a===state.sel;
      const s=parse(state.selStart),e=parse(state.selEnd),p=parse(a);
      return p.c>=Math.min(s.c,e.c)&&p.c<=Math.max(s.c,e.c)&&p.r>=Math.min(s.r,e.r)&&p.r<=Math.max(s.r,e.r);
    };

    const getRange = () => {
      if(!state.selStart||!state.selEnd) return [state.sel];
      const s=parse(state.selStart),e=parse(state.selEnd),res=[];
      for(let r=Math.min(s.r,e.r);r<=Math.max(s.r,e.r);r++)
        for(let c=Math.min(s.c,e.c);c<=Math.max(s.c,e.c);c++) res.push(addr(c,r));
      return res;
    };

    const MENUS = {
      File:[{label:'New',action:'new'},{sep:true},{label:'Save',action:'save'},{sep:true},{label:'Close',action:'close'}],
      Home:[
        {label:'Bold',action:'bold',icon:'B'},
        {label:'Italic',action:'italic',icon:'I'},
        {sep:true},
        {label:'Align Left',action:'align-left',icon:'⬅'},
        {label:'Center',action:'align-center',icon:'⬌'},
        {label:'Align Right',action:'align-right',icon:'➡'},
        {sep:true},
        {label:'Fill Color',action:'fill-color',icon:'🎨'},
        {label:'Text Color',action:'text-color',icon:'A'},
        {sep:true},
        {label:'Borders',action:'borders',icon:'▦'},
        {sep:true},
        {label:'Merge Cells',action:'merge',icon:'⊞'},
        {label:'Wrap Text',action:'wrap',icon:'↩'},
      ],
      Insert:[{label:'Insert Chart',action:'chart'},{sep:true},{label:'Add Sheet',action:'addsheet'}],
      Formulas:[{label:'AutoSum',action:'autosum'},{label:'Average',action:'autoavg'},{label:'Count',action:'autocount'},{label:'Max',action:'automax'},{label:'Min',action:'automin'}],
      Data:[{label:'Sort A→Z',action:'sort-asc'},{label:'Sort Z→A',action:'sort-desc'}],
      View:[{label:'Zoom In',action:'zoom-in'},{label:'Zoom Out',action:'zoom-out'}],
    };

    const showMenuDrop = () => {
      document.querySelectorAll('.xl-drop').forEach(d=>d.remove());
      if(!state.activeMenu||!MENUS[state.activeMenu]) return;
      const btn=document.getElementById(`xl-m-${state.activeMenu}-${id}`);
      if(!btn) return;
      const r=btn.getBoundingClientRect();
      const d=document.createElement('div');
      d.className='xl-drop';
      d.style.cssText=`position:fixed;left:${r.left}px;top:${r.bottom}px;background:#fff;border:1px solid #d1d1d1;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:9999;min-width:160px;border-radius:2px;padding:4px 0;`;
      d.innerHTML=MENUS[state.activeMenu].map(it=>it.sep?'<div style="height:1px;background:#e1dfdd;margin:4px 0;"></div>':`<div data-a="${it.action}" style="padding:7px 16px;cursor:pointer;font-size:13px;color:#323130;" onmouseover="this.style.background='#f3f2f1'" onmouseout="this.style.background=''">${it.label}</div>`).join('');
      document.body.appendChild(d);
      d.querySelectorAll('[data-a]').forEach(el=>el.addEventListener('click',()=>doAction(el.dataset.a)));
      setTimeout(()=>{const dm=e=>{if(!d.contains(e.target)&&!btn.contains(e.target)){d.remove();state.activeMenu=null;document.removeEventListener('click',dm);}};document.addEventListener('click',dm);},10);
    };

    const insertFn = fn => {
      const sh=sheet(); const {c,r}=parse(state.sel);
      let sr=r-1; while(sr>=0&&sh.cells[addr(c,sr)]) sr--;
      sr++;
      const formula=sr<r?`=${fn}(${addr(c,sr)}:${addr(c,r-1)})`:`=${fn}(A1:A1)`;
      sh.cells[state.sel]=formula; state.fbar=formula; save(); render();
    };

    const showChart = () => {
      const sh=sheet();
      const ov=document.createElement('div');
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      ov.innerHTML=`<div style="background:#fff;border-radius:8px;padding:24px;width:380px;">
        <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#217346;">Insert Chart</div>
        <label style="font-size:12px;color:#666;">Range (e.g. A1:B5)</label>
        <input id="xl-cr-${id}" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;margin:4px 0 12px;font-size:13px;box-sizing:border-box;" value="A1:A5" />
        <label style="font-size:12px;color:#666;">Type</label>
        <select id="xl-ct-${id}" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;margin:4px 0 16px;font-size:13px;">
          <option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option>
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="xl-cc-${id}" style="padding:8px 16px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;cursor:pointer;">Cancel</button>
          <button id="xl-co-${id}" style="padding:8px 16px;background:#217346;border:none;border-radius:4px;color:#fff;cursor:pointer;">Insert</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      document.getElementById(`xl-cc-${id}`).onclick=()=>ov.remove();
      document.getElementById(`xl-co-${id}`).onclick=()=>{
        const range=document.getElementById(`xl-cr-${id}`).value.toUpperCase();
        const type=document.getElementById(`xl-ct-${id}`).value;
        ov.remove(); renderChart(range,type,sh);
      };
    };

    const renderChart = (range,type,sh) => {
      const [s,e]=range.split(':');
      const sc=s.match(/[A-Z]+/)[0],sr=parseInt(s.match(/\d+/)[0]);
      const ec=e.match(/[A-Z]+/)[0],er=parseInt(e.match(/\d+/)[0]);
      const si=COLS.indexOf(sc),ei=COLS.indexOf(ec);
      const vals=[];
      for(let r=sr;r<=er;r++) for(let c=si;c<=ei;c++) vals.push(parseFloat(sh.cells[COLS[c]+r])||0);
      if(!vals.length) return;
      const max=Math.max(...vals,1);
      const colors=['#217346','#0078d4','#e74c3c','#f0b232','#9b59b6','#1abc9c','#e67e22','#3498db'];
      let html='';
      if(type==='bar'){
        html=`<div style="display:flex;align-items:flex-end;gap:4px;height:150px;padding:8px;border:1px solid #eee;border-radius:4px;">${vals.map((v,i)=>`<div style="flex:1;background:${colors[i%8]};height:${(v/max)*130}px;border-radius:2px 2px 0 0;position:relative;" title="${v}"><div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:9px;">${v}</div></div>`).join('')}</div>`;
      } else if(type==='line'){
        const w=360,h=130,pts=vals.map((v,i)=>`${(i/(vals.length-1||1))*w},${h-(v/max)*h}`).join(' ');
        html=`<svg width="${w}" height="${h+20}" style="border:1px solid #eee;border-radius:4px;"><polyline points="${pts}" fill="none" stroke="#217346" stroke-width="2"/>${vals.map((v,i)=>`<circle cx="${(i/(vals.length-1||1))*w}" cy="${h-(v/max)*h}" r="3" fill="#217346"/>`).join('')}</svg>`;
      } else {
        const total=vals.reduce((a,b)=>a+b,0)||1; let angle=0;
        const slices=vals.map((v,i)=>{const pct=v/total,a1=angle,a2=angle+pct*2*Math.PI;angle=a2;const x1=80+70*Math.cos(a1),y1=80+70*Math.sin(a1),x2=80+70*Math.cos(a2),y2=80+70*Math.sin(a2);return `<path d="M80,80 L${x1},${y1} A70,70 0 ${pct>.5?1:0},1 ${x2},${y2} Z" fill="${colors[i%8]}" stroke="#fff" stroke-width="1"><title>${v}</title></path>`;}).join('');
        html=`<svg width="160" height="160">${slices}</svg>`;
      }
      const win=document.createElement('div');
      win.style.cssText='position:fixed;top:80px;left:180px;width:400px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9998;';
      win.innerHTML=`<div style="padding:10px 14px;background:#217346;color:#fff;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;cursor:move;"><span style="font-size:13px;font-weight:600;">Chart — ${range}</span><button id="xl-cclose-${id}" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button></div><div style="padding:16px;">${html}</div>`;
      document.body.appendChild(win);
      document.getElementById(`xl-cclose-${id}`).onclick=()=>win.remove();
      const hdr=win.querySelector('div');
      let mx=0,my=0;
      hdr.addEventListener('mousedown',e=>{mx=e.clientX-win.offsetLeft;my=e.clientY-win.offsetTop;const mm=ev=>{win.style.left=(ev.clientX-mx)+'px';win.style.top=(ev.clientY-my)+'px';};const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);});
    };

    const doAction = a => {
      state.activeMenu=null; document.querySelectorAll('.xl-drop').forEach(d=>d.remove());
      const sh=sheet();
      if(a==='new'){if(confirm('New workbook?')){state.wb={sheets:[{name:'Sheet1',cells:{},styles:{}}]};state.si=0;save();render();}}
      else if(a==='save'){save();if(typeof Notifications!=='undefined')Notifications.send('Excel','Saved!','💾');}
      else if(a==='close'){if(typeof WM!=='undefined')WM.close(id);}
      else if(a==='addsheet'){state.wb.sheets.push({name:'Sheet'+(state.wb.sheets.length+1),cells:{},styles:{}});state.si=state.wb.sheets.length-1;save();render();}
      else if(a==='autosum') insertFn('SUM');
      else if(a==='autoavg') insertFn('AVERAGE');
      else if(a==='autocount') insertFn('COUNT');
      else if(a==='automax') insertFn('MAX');
      else if(a==='automin') insertFn('MIN');
      else if(a==='chart') showChart();
      else if(a==='zoom-in'){state.zoom=Math.min(200,state.zoom+10);render();}
      else if(a==='zoom-out'){state.zoom=Math.max(50,state.zoom-10);render();}
      else if(a==='bold') applyStyle('bold',!((sh.styles||{})[state.sel]||{}).bold);
      else if(a==='italic') applyStyle('italic',!((sh.styles||{})[state.sel]||{}).italic);
      else if(a==='align-left') applyStyle('align','left');
      else if(a==='align-center') applyStyle('align','center');
      else if(a==='align-right') applyStyle('align','right');
      else if(a==='fill-color') applyStyle('fill',prompt('Fill color (hex):','#ffffff')||'#ffffff');
      else if(a==='text-color') applyStyle('color',prompt('Text color (hex):','#000000')||'#000000');
      else if(a==='borders') applyStyle('border',!((sh.styles||{})[state.sel]||{}).border);
      else if(a==='merge') if(typeof Notifications!=='undefined')Notifications.send('Excel','Merge cells feature','⊞');
      else if(a==='wrap') applyStyle('wrap',!((sh.styles||{})[state.sel]||{}).wrap);
      else if(a==='sort-asc'||a==='sort-desc'){
        const {c}=parse(state.sel);
        const rows=[];
        for(let r=0;r<NR;r++){const v=sh.cells[addr(c,r)];if(v!==undefined&&v!=='')rows.push({r,v});}
        rows.sort((a,b)=>a==='sort-asc'?String(a.v).localeCompare(String(b.v)):String(b.v).localeCompare(String(a.v)));
        rows.forEach((row,i)=>{sh.cells[addr(c,i)]=row.v;});
        save();render();
      }
    };

    const applyStyle = (key,val) => {
      const sh=sheet();
      if(!sh.styles) sh.styles={};
      if(!sh.styles[state.sel]) sh.styles[state.sel]={};
      sh.styles[state.sel][key]=val;
      save(); render();
      setTimeout(()=>{const inp=content.querySelector(`[data-inp="${state.sel}"]`);if(inp)inp.focus();},10);
    };

    const render = () => {
      const sh = sheet();
      const z = state.zoom / 100;
      const cw = Math.round(80 * z);
      const ch = Math.round(22 * z);
      const fs = Math.round(11 * z);

      content.innerHTML = `
        <div style="display:flex;align-items:center;background:#f3f2f1;border-bottom:1px solid #d1d1d1;padding:0 8px;flex-shrink:0;">
          ${Object.keys(MENUS).map(m=>`<button id="xl-m-${m}-${id}" style="padding:6px 10px;background:transparent;border:none;color:#323130;cursor:pointer;font-size:12px;" onmouseover="this.style.background='#e1dfdd'" onmouseout="this.style.background='transparent'">${m}</button>`).join('')}
        </div>
        <div style="background:#f3f2f1;border-bottom:2px solid #217346;padding:4px 10px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
            <button id="xl-copy-${id}" title="Copy" style="padding:3px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">📄</button>
            <button id="xl-cut-${id}" title="Cut" style="padding:3px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">✂️</button>
            <button id="xl-paste-${id}" title="Paste" style="padding:3px 7px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">📋</button>
            <div style="width:1px;height:20px;background:#d1d1d1;"></div>
            <button id="xl-bold-${id}" title="Bold" style="padding:3px 7px;background:${(sh.styles||{})[state.sel]?.bold?'#deecf9':'#fff'};border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-weight:bold;font-size:12px;">B</button>
            <button id="xl-italic-${id}" title="Italic" style="padding:3px 7px;background:${(sh.styles||{})[state.sel]?.italic?'#deecf9':'#fff'};border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-style:italic;font-size:12px;">I</button>
            <button id="xl-uline-${id}" title="Underline" style="padding:3px 7px;background:${(sh.styles||{})[state.sel]?.underline?'#deecf9':'#fff'};border:1px solid #8a8886;border-radius:2px;cursor:pointer;text-decoration:underline;font-size:12px;">U</button>
            <div style="width:1px;height:20px;background:#d1d1d1;"></div>
            <button id="xl-al-${id}" title="Left" style="padding:3px 6px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">⬅</button>
            <button id="xl-ac-${id}" title="Center" style="padding:3px 6px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">↔</button>
            <button id="xl-ar-${id}" title="Right" style="padding:3px 6px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">➡</button>
            <div style="width:1px;height:20px;background:#d1d1d1;"></div>
            <label style="font-size:10px;color:#605e5c;display:flex;align-items:center;gap:2px;">Fill<input type="color" id="xl-fill-${id}" value="${(sh.styles||{})[state.sel]?.fill||'#ffffff'}" style="width:20px;height:20px;border:none;cursor:pointer;padding:0;"/></label>
            <label style="font-size:10px;color:#605e5c;display:flex;align-items:center;gap:2px;">Text<input type="color" id="xl-color-${id}" value="${(sh.styles||{})[state.sel]?.color||'#000000'}" style="width:20px;height:20px;border:none;cursor:pointer;padding:0;"/></label>
            <div style="width:1px;height:20px;background:#d1d1d1;"></div>
            <button id="xl-sum-${id}" style="padding:3px 8px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">Σ Sum</button>
            <button id="xl-chart-btn-${id}" style="padding:3px 8px;background:#fff;border:1px solid #8a8886;border-radius:2px;cursor:pointer;font-size:11px;">📊 Chart</button>
            <span style="font-size:10px;color:#888;margin-left:4px;">${state.zoom}%</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;padding:2px 8px;background:#f8f8f8;border-bottom:1px solid #d1d1d1;flex-shrink:0;gap:6px;">
          <input id="xl-nb-${id}" value="${state.sel}" style="width:60px;padding:2px 6px;border:1px solid #8a8886;font-size:12px;text-align:center;" />
          <span style="font-size:13px;color:#666;">fx</span>
          <input id="xl-fb-${id}" value="${state.fbar}" placeholder="Enter value or =formula" style="flex:1;padding:2px 8px;border:1px solid #8a8886;font-size:12px;" />
        </div>
        <div style="flex:1;overflow:auto;">
          <table style="border-collapse:collapse;table-layout:fixed;font-size:${fs}px;font-family:Calibri,sans-serif;">
            <thead><tr>
              <th style="width:40px;min-width:40px;height:${ch}px;background:#e1dfdd;border:1px solid #d1d1d1;position:sticky;top:0;left:0;z-index:3;cursor:pointer;" id="xl-selall-${id}" title="Select All"></th>
              ${Array.from({length:NC},(_,c)=>`<th data-col="${c}" style="width:${cw}px;min-width:${cw}px;height:${ch}px;background:#e1dfdd;border:1px solid #d1d1d1;font-size:${fs}px;font-weight:600;color:#444;text-align:center;position:sticky;top:0;z-index:2;cursor:pointer;user-select:none;">${COLS[c]}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${Array.from({length:NR},(_,row)=>`<tr>
                <td data-row="${row}" style="width:40px;min-width:40px;height:${ch}px;background:#f8f8f8;border:1px solid #d1d1d1;font-size:${fs}px;color:#666;text-align:center;position:sticky;left:0;z-index:1;cursor:pointer;user-select:none;">${row+1}</td>
                ${Array.from({length:NC},(_,col)=>{
                  const a=addr(col,row);
                  const raw=sh.cells[a]||'';
                  const disp=String(raw).startsWith('=')?String(evalFormula(raw,sh.cells)):raw;
                  const sty=(sh.styles||{})[a]||{};
                  const sel=inSel(a)&&a!==state.sel;
                  return `<td style="width:${cw}px;min-width:${cw}px;height:${ch}px;border:1px solid #d1d1d1;padding:0;position:relative;background:${sel?'#c6efce':sty.fill||'#fff'};"><input data-inp="${a}" value="${disp.toString().replace(/"/g,'&quot;')}" style="width:100%;height:100%;border:none;outline:none;padding:0 3px;font-size:${sty.fontSize||fs}px;font-family:${sty.font||'Calibri'},sans-serif;font-weight:${sty.bold?'bold':'normal'};font-style:${sty.italic?'italic':'normal'};text-decoration:${sty.underline?'underline':'none'};text-align:${sty.align||'left'};background:transparent;color:${sty.color||'#000'};cursor:cell;" /></td>`;
                }).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="display:flex;align-items:center;padding:2px 8px;background:#f8f8f8;border-top:1px solid #d1d1d1;flex-shrink:0;">
          <div style="display:flex;gap:2px;">
            ${state.wb.sheets.map((sh,i)=>`<div data-sh="${i}" style="padding:2px 12px;background:${i===state.si?'#fff':'#f0f0f0'};border:1px solid #d1d1d1;border-bottom:none;cursor:pointer;font-size:11px;${i===state.si?'border-top:2px solid #217346;':''}">${sh.name}</div>`).join('')}
            <button id="xl-addsh-${id}" style="padding:2px 8px;background:#f0f0f0;border:1px solid #d1d1d1;cursor:pointer;font-size:11px;">+</button>
          </div>
          <div style="flex:1;"></div>
          <span style="font-size:11px;color:#666;">Ready | ${state.sel}</span>
        </div>
      `;
      bindEvents();
    };

    const bindEvents = () => {
      const sh = sheet();

      // Menu bar
      Object.keys(MENUS).forEach(m => {
        const btn = document.getElementById(`xl-m-${m}-${id}`);
        if (btn) btn.addEventListener('click', e => { e.stopPropagation(); state.activeMenu = state.activeMenu===m?null:m; showMenuDrop(); });
      });

      // Cell inputs
      content.querySelectorAll('[data-inp]').forEach(inp => {
        const a = inp.dataset.inp;
        inp.addEventListener('focus', () => {
          state.sel = a; state.selStart = a; state.selEnd = a;
          inp.value = sh.cells[a] || '';
          const fb = document.getElementById(`xl-fb-${id}`);
          const nb = document.getElementById(`xl-nb-${id}`);
          if (fb) fb.value = sh.cells[a] || '';
          if (nb) nb.value = a;
          // Highlight active cell with outline (doesn't shift layout)
          content.querySelectorAll('[data-inp]').forEach(i => {
            i.parentElement.style.outline = i.dataset.inp === a ? '2px solid #217346' : 'none';
            i.parentElement.style.zIndex = i.dataset.inp === a ? '2' : '';
          });
          // Update toolbar button states for this cell
          const sty = (sh.styles||{})[a]||{};
          const boldBtn = document.getElementById(`xl-bold-${id}`);
          const italicBtn = document.getElementById(`xl-italic-${id}`);
          const ulineBtn = document.getElementById(`xl-uline-${id}`);
          if (boldBtn) boldBtn.style.background = sty.bold ? '#deecf9' : '#fff';
          if (italicBtn) italicBtn.style.background = sty.italic ? '#deecf9' : '#fff';
          if (ulineBtn) ulineBtn.style.background = sty.underline ? '#deecf9' : '#fff';
        });

        inp.addEventListener('blur', () => {
          const val = inp.value;
          if (val !== (sh.cells[a]||'')) {
            sh.cells[a] = val; state.fbar = val; save();
          }
          // Show display value (formula result)
          const raw = sh.cells[a]||'';
          inp.value = String(raw).startsWith('=') ? String(evalFormula(raw, sh.cells)) : raw;
          // Live-update all formula cells that may depend on this one
          content.querySelectorAll('[data-inp]').forEach(i => {
            const ia = i.dataset.inp;
            if (ia !== a && String(sh.cells[ia]||'').startsWith('=')) {
              i.value = String(evalFormula(sh.cells[ia], sh.cells));
            }
          });
        });

        inp.addEventListener('input', () => {
          // Live preview: update formula bar
          const fb = document.getElementById(`xl-fb-${id}`);
          if (fb) fb.value = inp.value;
        });

        inp.addEventListener('keydown', e => {
          const {c,r} = parse(a);
          // Backspace on empty cell or Delete key — clear entire selection range
          if ((e.key === 'Backspace' && inp.value === '') || e.key === 'Delete') {
            e.preventDefault();
            getRange().forEach(ra => { delete sh.cells[ra]; });
            save();
            // Re-render display values
            content.querySelectorAll('[data-inp]').forEach(i => {
              const ia = i.dataset.inp;
              const raw = sh.cells[ia]||'';
              i.value = String(raw).startsWith('=') ? String(evalFormula(raw, sh.cells)) : raw;
            });
            inp.value = '';
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault(); sh.cells[a] = inp.value; save();
            // Update dependent formulas
            content.querySelectorAll('[data-inp]').forEach(i => {
              if (i.dataset.inp !== a && String(sh.cells[i.dataset.inp]||'').startsWith('='))
                i.value = String(evalFormula(sh.cells[i.dataset.inp], sh.cells));
            });
            const next = content.querySelector(`[data-inp="${addr(c, Math.min(NR-1, r+1))}"]`);
            if (next) next.focus();
          } else if (e.key === 'Tab') {
            e.preventDefault(); sh.cells[a] = inp.value; save();
            const next = content.querySelector(`[data-inp="${addr(Math.min(NC-1, c+1), r)}"]`);
            if (next) next.focus();
          } else if (e.key === 'Escape') {
            const raw = sh.cells[a]||'';
            inp.value = String(raw).startsWith('=') ? String(evalFormula(raw, sh.cells)) : raw;
            inp.blur();
          } else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && inp.value === (sh.cells[a]||'')) {
            e.preventDefault(); sh.cells[a] = inp.value; save();
            let nc=c, nr=r;
            if (e.key==='ArrowUp') nr=Math.max(0,r-1);
            else if (e.key==='ArrowDown') nr=Math.min(NR-1,r+1);
            else if (e.key==='ArrowLeft') nc=Math.max(0,c-1);
            else if (e.key==='ArrowRight') nc=Math.min(NC-1,c+1);
            const next = content.querySelector(`[data-inp="${addr(nc,nr)}"]`);
            if (next) next.focus();
          }
        });

        // Multi-select drag
        inp.addEventListener('mousedown', () => { state.selStart = a; state.selEnd = a; });
        inp.addEventListener('mouseover', e => {
          if (e.buttons === 1 && state.selStart) {
            state.selEnd = a;
            content.querySelectorAll('[data-inp]').forEach(i => {
              const ia = i.dataset.inp;
              const sel = inSel(ia) && ia !== state.sel;
              i.parentElement.style.background = sel ? '#c6efce' : ((sh.styles||{})[ia]?.fill || '#fff');
            });
          }
        });
      });

      // Formula bar
      const fb = document.getElementById(`xl-fb-${id}`);
      if (fb) {
        fb.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            sh.cells[state.sel] = fb.value; state.fbar = fb.value; save(); render();
            setTimeout(() => { const inp = content.querySelector(`[data-inp="${state.sel}"]`); if (inp) inp.focus(); }, 10);
          }
        });
      }

      // Name box navigation
      const nb = document.getElementById(`xl-nb-${id}`);
      if (nb) {
        nb.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            const a = nb.value.toUpperCase().trim();
            if (/^[A-Z]+\d+$/.test(a)) {
              state.sel = a;
              const inp = content.querySelector(`[data-inp="${a}"]`);
              if (inp) inp.focus();
            }
          }
        });
      }

      // Toolbar buttons
      const tb = (eid, fn) => { const el = document.getElementById(eid); if (el) el.addEventListener('click', fn); };

      tb(`xl-bold-${id}`, () => applyStyle('bold', !(sh.styles||{})[state.sel]?.bold));
      tb(`xl-italic-${id}`, () => applyStyle('italic', !(sh.styles||{})[state.sel]?.italic));
      tb(`xl-uline-${id}`, () => applyStyle('underline', !(sh.styles||{})[state.sel]?.underline));
      tb(`xl-al-${id}`, () => applyStyle('align','left'));
      tb(`xl-ac-${id}`, () => applyStyle('align','center'));
      tb(`xl-ar-${id}`, () => applyStyle('align','right'));
      tb(`xl-sum-${id}`, () => insertFn('SUM'));
      tb(`xl-chart-btn-${id}`, () => showChart());

      const fillPicker = document.getElementById(`xl-fill-${id}`);
      if (fillPicker) fillPicker.addEventListener('input', e => applyStyle('fill', e.target.value));
      const colorPicker = document.getElementById(`xl-color-${id}`);
      if (colorPicker) colorPicker.addEventListener('input', e => applyStyle('color', e.target.value));

      // Copy/Cut/Paste
      tb(`xl-copy-${id}`, () => {
        state.clip = {}; getRange().forEach(a => { state.clip[a] = sh.cells[a]; });
        if (typeof Notifications !== 'undefined') Notifications.send('Excel','Copied','📄');
      });
      tb(`xl-cut-${id}`, () => {
        state.clip = {}; getRange().forEach(a => { state.clip[a] = sh.cells[a]; delete sh.cells[a]; });
        save(); render();
      });
      tb(`xl-paste-${id}`, () => {
        if (!state.clip) return;
        const srcs = Object.keys(state.clip); if (!srcs.length) return;
        const base = parse(srcs[0]); const dst = parse(state.sel);
        srcs.forEach(a => {
          const s = parse(a);
          const dc = dst.c + (s.c - base.c), dr = dst.r + (s.r - base.r);
          if (dc >= 0 && dc < NC && dr >= 0 && dr < NR) sh.cells[addr(dc,dr)] = state.clip[a];
        });
        save(); render();
      });

      // Sheet tabs
      content.querySelectorAll('[data-sh]').forEach(tab => {
        tab.addEventListener('click', () => { state.si = parseInt(tab.dataset.sh); render(); });
      });
      tb(`xl-addsh-${id}`, () => doAction('addsheet'));
    };

    render();
  }
});
