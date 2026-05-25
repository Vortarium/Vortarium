// ===== VS CODE CLONE =====
AppLauncher.register("vscode", {
  title: "VS Code", icon: "🖥️",
  launch() {
    if (typeof StoreManager !== 'undefined' && !StoreManager.isInstalled('vscode')) {
      _showInstallGate('VS Code', '🖥️', 'vscode'); return;
    }
    const id = WM.create({ title:"VS Code", icon:"🖥️", width:1100, height:700, appId:"vscode" });
    const content = WM.getContent(id);
    content.style.cssText = "display:flex;flex-direction:column;overflow:hidden;background:#1e1e1e;color:#d4d4d4;font-family:'Cascadia Code','Consolas',monospace;";

    // Load persisted open files from OS.appData
    const savedState = OS.getAppData("vscode") || {};
    const state = {
      cwd: savedState.cwd || "C:/Users/User/Documents",
      openFiles: savedState.openFiles || {},
      activeFile: savedState.activeFile || null,
      tabs: savedState.tabs || [],
    };

    // Sync open file content from VFS on load
    state.tabs.forEach(path => {
      if (!state.openFiles[path]) {
        const txt = FS.readFile(path);
        if (txt !== null) state.openFiles[path] = txt;
        else state.tabs = state.tabs.filter(t=>t!==path);
      }
    });

    const saveState = () => {
      OS.setAppData("vscode", { cwd:state.cwd, openFiles:state.openFiles, activeFile:state.activeFile, tabs:state.tabs });
    };

    const langColor = ext => {
      const m = {js:"#dcdcaa",ts:"#4ec9b0",html:"#f44747",css:"#569cd6",json:"#9cdcfe",py:"#4ec9b0",md:"#d4d4d4",txt:"#d4d4d4"};
      return m[ext]||"#d4d4d4";
    };

    const render = () => {
      content.innerHTML = `
        <div style="display:flex;flex:1;overflow:hidden;">
          <!-- Sidebar -->
          <div style="width:220px;background:#252526;border-right:1px solid #3c3c3c;display:flex;flex-direction:column;flex-shrink:0;">
            <div style="padding:8px 12px;font-size:11px;color:#bbb;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #3c3c3c;display:flex;align-items:center;justify-content:space-between;">
              <span>Explorer</span>
            </div>
            <div id="vsc-tree-${id}" style="flex:1;overflow-y:auto;padding:4px 0;font-size:13px;"></div>
            <div style="padding:8px;border-top:1px solid #3c3c3c;display:flex;flex-direction:column;gap:4px;">
              <div style="display:flex;gap:4px;">
                <button id="vsc-newhtml-${id}" style="flex:1;padding:4px;background:#c0392b;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:10px;">+ HTML</button>
                <button id="vsc-newcss-${id}" style="flex:1;padding:4px;background:#2980b9;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:10px;">+ CSS</button>
                <button id="vsc-newjs-${id}" style="flex:1;padding:4px;background:#f39c12;border:none;border-radius:3px;color:#000;cursor:pointer;font-size:10px;">+ JS</button>
              </div>
              <div style="display:flex;gap:4px;">
                <button id="vsc-newfile-${id}" style="flex:1;padding:4px;background:#0e639c;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:10px;">+ File</button>
                <button id="vsc-newfolder-${id}" style="flex:1;padding:4px;background:#3c3c3c;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:10px;">+ Folder</button>
              </div>
            </div>
          </div>
          <!-- Editor area -->
          <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
            <div id="vsc-tabs-${id}" style="display:flex;background:#2d2d2d;border-bottom:1px solid #3c3c3c;overflow-x:auto;flex-shrink:0;min-height:35px;"></div>
            <div id="vsc-editor-${id}" style="flex:1;overflow:hidden;display:flex;flex-direction:column;"></div>
          </div>
        </div>
        <div style="height:22px;background:#007acc;display:flex;align-items:center;padding:0 12px;gap:16px;font-size:11px;flex-shrink:0;">
          <span>🖥️ VS Code</span>
          <span id="vsc-status-${id}" style="margin-left:auto;">Ready — ${state.cwd}</span>
        </div>`;
      renderTree(); renderTabs(); renderEditor();
      bindSidebar();
    };

    const renderTree = () => {
      const el = document.getElementById(`vsc-tree-${id}`);
      if (!el) return;
      const renderDir = (path, depth) => {
        const items = FS.ls(path) || {};
        return Object.entries(items).sort(([,a],[,b])=>{
          if((a.type==="folder")&&(b.type!=="folder")) return -1;
          if((a.type!=="folder")&&(b.type==="folder")) return 1;
          return 0;
        }).map(([name, node]) => {
          const fullPath = path+"/"+name;
          const isDir = node.type==="folder"||node.type==="drive";
          const ext = name.split(".").pop().toLowerCase();
          const color = isDir ? "#e8c07d" : langColor(ext);
          return `<div data-path="${fullPath}" data-isdir="${isDir}" style="padding:3px 8px 3px ${8+depth*14}px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background 0.1s;color:${color};" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background=''">
            ${isDir?"📁":"📄"} ${name}
          </div>` + (isDir ? renderDir(fullPath, depth+1) : "");
        }).join("");
      };
      el.innerHTML = renderDir("C:", 0);
      el.querySelectorAll("[data-path]").forEach(item => {
        item.addEventListener("click", () => {
          if (item.dataset.isdir==="true") { state.cwd=item.dataset.path; saveState(); return; }
          openFile(item.dataset.path);
        });
      });
    };

    const openFile = path => {
      if (!state.tabs.includes(path)) {
        const txt = FS.readFile(path) || "";
        state.openFiles[path] = txt;
        state.tabs.push(path);
      }
      state.activeFile = path;
      saveState();
      renderTabs(); renderEditor();
    };

    const renderTabs = () => {
      const el = document.getElementById(`vsc-tabs-${id}`);
      if (!el) return;
      el.innerHTML = state.tabs.map(path => {
        const name = path.split("/").pop();
        const isActive = path===state.activeFile;
        const ext = name.split(".").pop().toLowerCase();
        const dot = langColor(ext);
        return `<div data-tabpath="${path}" style="display:flex;align-items:center;gap:6px;padding:0 12px;height:35px;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;
          background:${isActive?"#1e1e1e":"#2d2d2d"};border-right:1px solid #3c3c3c;
          border-top:${isActive?"2px solid #007acc":"2px solid transparent"};">
          <span style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;"></span>
          <span>${name}</span>
          <span data-closetab="${path}" style="opacity:0.5;font-size:10px;padding:1px 3px;border-radius:2px;margin-left:2px;">✕</span>
        </div>`;
      }).join("");
      el.querySelectorAll("[data-tabpath]").forEach(tab => {
        tab.addEventListener("click", e => {
          if (e.target.dataset.closetab) {
            const p=e.target.dataset.closetab;
            state.tabs=state.tabs.filter(t=>t!==p);
            delete state.openFiles[p];
            if (state.activeFile===p) state.activeFile=state.tabs[state.tabs.length-1]||null;
            saveState(); renderTabs(); renderEditor(); return;
          }
          state.activeFile=tab.dataset.tabpath;
          saveState(); renderTabs(); renderEditor();
        });
      });
    };

    const renderEditor = () => {
      const el = document.getElementById(`vsc-editor-${id}`);
      if (!el) return;
      if (!state.activeFile) {
        el.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;color:#555;">
          <div style="font-size:56px;">🖥️</div>
          <div style="font-size:18px;color:#666;">VS Code</div>
          <div style="font-size:13px;color:#444;">Open or create a file to start editing</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button id="vsc-quick-html-${id}" style="padding:8px 16px;background:#c0392b;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px;">New HTML</button>
            <button id="vsc-quick-css-${id}" style="padding:8px 16px;background:#2980b9;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px;">New CSS</button>
            <button id="vsc-quick-js-${id}" style="padding:8px 16px;background:#f39c12;border:none;border-radius:6px;color:#000;cursor:pointer;font-size:12px;">New JS</button>
          </div>
        </div>`;
        const qh=document.getElementById(`vsc-quick-html-${id}`);
        const qc=document.getElementById(`vsc-quick-css-${id}`);
        const qj=document.getElementById(`vsc-quick-js-${id}`);
        if(qh) qh.addEventListener("click",()=>createFile("html"));
        if(qc) qc.addEventListener("click",()=>createFile("css"));
        if(qj) qj.addEventListener("click",()=>createFile("js"));
        return;
      }
      const fname = state.activeFile.split("/").pop();
      const ext = fname.split(".").pop().toLowerCase();
      const isHtml = ext==="html";
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 12px;background:#252526;border-bottom:1px solid #3c3c3c;font-size:11px;color:#888;flex-shrink:0;">
          <span style="color:#aaa;">${state.activeFile}</span>
          <div style="display:flex;gap:6px;">
            ${isHtml?`<button id="vsc-preview-${id}" style="padding:3px 10px;background:#27ae60;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">👁 Preview</button>`:""}
            <button id="vsc-save-${id}" style="padding:3px 10px;background:#0e639c;border:none;border-radius:3px;color:#fff;cursor:pointer;font-size:11px;">💾 Save (Ctrl+S)</button>
          </div>
        </div>
        <div style="flex:1;display:flex;overflow:hidden;">
          <div style="flex-shrink:0;background:#1e1e1e;padding:12px 6px 12px 0;text-align:right;color:#555;font-size:13px;line-height:1.6;user-select:none;min-width:36px;border-right:1px solid #3c3c3c;" id="vsc-gutter-${id}"></div>
          <textarea id="vsc-textarea-${id}" spellcheck="false" style="flex:1;background:#1e1e1e;color:#d4d4d4;border:none;outline:none;padding:12px;font-family:'Cascadia Code','Consolas',monospace;font-size:13px;line-height:1.6;resize:none;tab-size:2;white-space:pre;overflow-wrap:normal;overflow-x:auto;">${escHtml(state.openFiles[state.activeFile]||"")}</textarea>
        </div>`;

      const ta = document.getElementById(`vsc-textarea-${id}`);
      const statusEl = document.getElementById(`vsc-status-${id}`);
      const gutter = document.getElementById(`vsc-gutter-${id}`);

      const updateGutter = () => {
        const lines = (ta.value||"").split("\n").length;
        if (gutter) gutter.innerHTML = Array.from({length:lines},(_,i)=>`<div style="padding:0 8px;font-size:12px;">${i+1}</div>`).join("");
      };
      updateGutter();

      ta.addEventListener("input", () => {
        state.openFiles[state.activeFile] = ta.value;
        saveState();
        updateGutter();
        if (statusEl) statusEl.textContent = `${fname} — Modified`;
      });
      ta.addEventListener("keydown", e => {
        if (e.ctrlKey && e.key==="s") { e.preventDefault(); saveFile(); }
        if (e.key==="Tab") {
          e.preventDefault();
          const s=ta.selectionStart, en=ta.selectionEnd;
          ta.value=ta.value.substring(0,s)+"  "+ta.value.substring(en);
          ta.selectionStart=ta.selectionEnd=s+2;
          state.openFiles[state.activeFile]=ta.value; saveState();
        }
      });
      ta.addEventListener("keyup", () => {
        const lines=ta.value.substring(0,ta.selectionStart).split("\n");
        if (statusEl) statusEl.textContent=`${fname} — Ln ${lines.length}, Col ${lines[lines.length-1].length+1} — ${ext.toUpperCase()}`;
        updateGutter();
      });
      ta.addEventListener("scroll", () => { if(gutter) gutter.scrollTop=ta.scrollTop; });

      const saveBtn = document.getElementById(`vsc-save-${id}`);
      if (saveBtn) saveBtn.addEventListener("click", saveFile);

      const previewBtn = document.getElementById(`vsc-preview-${id}`);
      if (previewBtn) previewBtn.addEventListener("click", () => {
        const html = state.openFiles[state.activeFile]||"";
        const pw = WM.create({ title:"Preview — "+fname, icon:"🌐", width:800, height:600, appId:"preview" });
        const pc = WM.getContent(pw);
        pc.style.cssText="display:flex;flex-direction:column;overflow:hidden;";
        const iframe = document.createElement("iframe");
        iframe.style.cssText="flex:1;border:none;width:100%;height:100%;";
        iframe.srcdoc = html;
        pc.appendChild(iframe);
      });
    };

    const escHtml = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    const saveFile = () => {
      if (!state.activeFile) return;
      FS.writeFile(state.activeFile, state.openFiles[state.activeFile]||"");
      saveState();
      Notifications.send("VS Code","Saved: "+state.activeFile.split("/").pop(),"💾");
      const statusEl=document.getElementById(`vsc-status-${id}`);
      if (statusEl) statusEl.textContent="Saved ✓";
    };

    const createFile = (ext) => {
      const defaults = { html:"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>My Page</title>\n  <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src=\"script.js\"><\/script>\n</body>\n</html>", css:"/* Styles */\nbody {\n  margin: 0;\n  font-family: sans-serif;\n  background: #1a1a2e;\n  color: white;\n}\n", js:"// JavaScript\nconsole.log('Hello World');\n" };
      const name = prompt(`File name:`, `untitled.${ext}`);
      if (!name) return;
      const path = state.cwd+"/"+name;
      FS.writeFile(path, defaults[ext]||"");
      openFile(path);
      renderTree();
    };

    const bindSidebar = () => {
      const nh=document.getElementById(`vsc-newhtml-${id}`);
      const nc=document.getElementById(`vsc-newcss-${id}`);
      const nj=document.getElementById(`vsc-newjs-${id}`);
      const nf=document.getElementById(`vsc-newfile-${id}`);
      const nd=document.getElementById(`vsc-newfolder-${id}`);
      if(nh) nh.addEventListener("click",()=>createFile("html"));
      if(nc) nc.addEventListener("click",()=>createFile("css"));
      if(nj) nj.addEventListener("click",()=>createFile("js"));
      if(nf) nf.addEventListener("click",()=>{
        const name=prompt("File name:","untitled.txt");
        if(name){FS.writeFile(state.cwd+"/"+name,"");renderTree();openFile(state.cwd+"/"+name);}
      });
      if(nd) nd.addEventListener("click",()=>{
        const name=prompt("Folder name:","new-folder");
        if(name){FS.mkdir(state.cwd+"/"+name);renderTree();}
      });
    };

    render();
  }
});
