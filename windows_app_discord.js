// ===== DISCORD =====
AppLauncher.register('discord', {
  title: 'Discord', icon: '💬',
  launch() {
    const id = WM.create({ title: 'Discord', icon: '💬', width: 1200, height: 750, appId: 'discord' });
    const content = WM.getContent(id);
    content.style.cssText = 'display:flex;overflow:hidden;height:100%;width:100%;position:relative;';

    // ── STYLES ────────────────────────────────────────────────────────────
    const styleId = `dc-styles-${id}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
@import url('https://fonts.googleapis.com/css2?family=gg+sans:wght@400;500;600;700&display=swap');
.dc${id}{--bg-p:#313338;--bg-s:#2b2d31;--bg-sa:#232428;--bg-t:#1e1f22;--bg-f:#111214;
--bg-h:rgba(255,255,255,0.06);--bg-a:rgba(255,255,255,0.12);--bg-mh:rgba(2,2,2,0.06);
--tx:#dbdee1;--txm:#949ba4;--txl:#00a8fc;--hp:#f2f3f5;--hs:#b5bac1;
--in:#b5bac1;--ih:#dbdee1;--ia:#fff;--br:#5865F2;--brh:#4752C4;
--dv:rgba(255,255,255,0.06);--dng:#da373c;--wrn:#f0b232;--ok:#23a55a;
--nit:#ff73fa;--gld:#f0b232;
display:flex;height:100%;width:100%;overflow:hidden;background:var(--bg-p);
color:var(--tx);font-family:'gg sans','Segoe UI',sans-serif;user-select:none;
position:relative;font-size:14px;}
.dc${id} *{box-sizing:border-box;}
.dc${id} *::-webkit-scrollbar{width:8px;height:8px;}
.dc${id} *::-webkit-scrollbar-track{background:transparent;}
.dc${id} *::-webkit-scrollbar-thumb{background:#1a1b1e;border-radius:4px;}
.dc${id} *::-webkit-scrollbar-thumb:hover{background:#111214;}

/* SERVERS */
.dcs-servers{width:72px;background:var(--bg-t);display:flex;flex-direction:column;
align-items:center;padding:12px 0;gap:8px;overflow-y:scroll;scrollbar-width:none;flex-shrink:0;}
.dcs-servers::-webkit-scrollbar{display:none;}
.dcs-svwrap{position:relative;display:flex;justify-content:center;width:100%;cursor:pointer;}
.dcs-pill{position:absolute;left:0;top:50%;transform:translateY(-50%);width:4px;
background:var(--hp);border-radius:0 4px 4px 0;transition:height .2s;height:0;}
.dcs-svicon{width:48px;height:48px;border-radius:24px;background:var(--bg-p);
display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;
transition:all .2s cubic-bezier(.175,.885,.32,1.275);color:var(--tx);position:relative;overflow:hidden;}
.dcs-svwrap:hover .dcs-svicon{border-radius:16px;background:var(--br);color:#fff;}
.dcs-svwrap:hover .dcs-pill{height:20px;}
.dcs-svwrap.active .dcs-svicon{border-radius:16px;background:var(--br);color:#fff;}
.dcs-svwrap.active .dcs-pill{height:40px;}
.dcs-svbadge{position:absolute;top:-4px;right:-4px;background:var(--dng);color:#fff;
font-size:10px;font-weight:700;border-radius:8px;padding:1px 4px;
border:2px solid var(--bg-t);min-width:16px;text-align:center;}

/* SIDEBAR */
.dcs-sidebar{width:240px;background:var(--bg-s);display:flex;flex-direction:column;flex-shrink:0;}
.dcs-svheader{height:48px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;
font-weight:700;color:var(--hp);border-bottom:1px solid var(--bg-t);cursor:pointer;
transition:background .2s;font-size:15px;flex-shrink:0;}
.dcs-svheader:hover{background:var(--bg-h);}
.dcs-channels{flex:1;overflow-y:auto;padding:8px;}
.dcs-cat{display:flex;align-items:center;gap:4px;padding:16px 8px 4px;
font-size:11px;font-weight:700;color:var(--txm);text-transform:uppercase;
cursor:pointer;letter-spacing:.5px;}
.dcs-cat:hover{color:var(--ih);}
.dcs-ch{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;
cursor:pointer;color:var(--txm);font-weight:500;margin-bottom:1px;position:relative;}
.dcs-ch:hover{background:var(--bg-h);color:var(--ih);}
.dcs-ch.active{background:var(--bg-a);color:var(--ia);}
.dcs-ch-badge{margin-left:auto;background:var(--dng);color:#fff;font-size:10px;
font-weight:700;border-radius:8px;padding:1px 5px;min-width:16px;text-align:center;}
.dcs-ch-acts{margin-left:auto;display:none;gap:2px;}
.dcs-ch:hover .dcs-ch-acts{display:flex;}
.dcs-ch-act{width:16px;height:16px;display:flex;align-items:center;justify-content:center;
border-radius:3px;font-size:12px;color:var(--ih);}
.dcs-ch-act:hover{background:var(--bg-a);}

/* PROFILE BAR */
.dcs-profile{height:52px;background:var(--bg-sa);padding:0 8px;
display:flex;align-items:center;gap:8px;flex-shrink:0;}
.dcs-av{width:32px;height:32px;border-radius:50%;background:var(--br);
display:flex;align-items:center;justify-content:center;font-size:16px;
position:relative;cursor:pointer;overflow:hidden;flex-shrink:0;}
.dcs-av img{width:100%;height:100%;object-fit:cover;}
.dcs-dot{position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;
border-radius:50%;border:3px solid var(--bg-sa);}
.dcs-uinfo{flex:1;min-width:0;cursor:pointer;padding:4px;border-radius:4px;}
.dcs-uinfo:hover{background:var(--bg-h);}
.dcs-uname{font-size:14px;font-weight:600;color:var(--hp);white-space:nowrap;
overflow:hidden;text-overflow:ellipsis;}
.dcs-utag{font-size:11px;color:var(--txm);}
.dcs-ibtn{width:32px;height:32px;border-radius:4px;color:var(--in);
display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
.dcs-ibtn:hover{background:var(--bg-h);color:var(--ih);}
.dcs-ibtn.active{color:var(--ia);}

/* CHAT */
.dcs-chat{flex:1;display:flex;flex-direction:column;background:var(--bg-p);min-width:0;position:relative;}
.dcs-chatheader{height:48px;padding:0 16px;display:flex;align-items:center;
border-bottom:1px solid var(--bg-t);flex-shrink:0;gap:8px;}
.dcs-chtitle{font-size:16px;font-weight:600;color:var(--hp);}
.dcs-chtopic{font-size:14px;color:var(--txm);margin-left:8px;padding-left:8px;
border-left:1px solid var(--bg-t);white-space:nowrap;overflow:hidden;
text-overflow:ellipsis;max-width:280px;}
.dcs-hacts{margin-left:auto;display:flex;gap:2px;}

/* MESSAGES */
.dcs-msgs{flex:1;overflow-y:scroll;padding:16px 0;display:flex;flex-direction:column;}
.dcs-msg{display:flex;padding:2px 16px 2px 72px;position:relative;min-height:22px;}
.dcs-msg:hover{background:var(--bg-mh);}
.dcs-msg.cozy{padding-top:16px;padding-left:16px;margin-top:4px;}
.dcs-msgav{width:40px;height:40px;border-radius:50%;background:var(--br);
display:flex;align-items:center;justify-content:center;cursor:pointer;
flex-shrink:0;overflow:hidden;position:absolute;left:16px;top:16px;font-size:20px;}
.dcs-msgav img{width:100%;height:100%;object-fit:cover;}
.dcs-msgbody{flex:1;min-width:0;}
.dcs-msghdr{display:flex;align-items:baseline;gap:8px;margin-bottom:2px;}
.dcs-msgauthor{font-size:16px;font-weight:500;color:var(--hp);cursor:pointer;}
.dcs-msgauthor:hover{text-decoration:underline;}
.dcs-rolebadge{font-size:10px;padding:1px 5px;border-radius:3px;font-weight:600;margin-left:2px;vertical-align:middle;}
.dcs-msgtime{font-size:11px;color:var(--txm);}
.dcs-msgtxt{font-size:16px;line-height:1.5;color:var(--tx);word-wrap:break-word;user-select:text;}
.dcs-msgtxt img{max-width:400px;max-height:300px;border-radius:8px;margin-top:8px;cursor:pointer;display:block;}
.dcs-msgtxt code{background:var(--bg-t);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:14px;}
.dcs-msgtxt pre{background:var(--bg-t);padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;}
.dcs-msgtxt pre code{background:none;padding:0;}
.dcs-msgtxt strong{color:var(--hp);}
.dcs-msgtxt em{font-style:italic;}
.dcs-msgtxt del{text-decoration:line-through;opacity:.6;}
.dcs-msgtxt blockquote{border-left:4px solid var(--in);padding-left:12px;margin:4px 0;color:var(--txm);}
.dcs-msgtxt a{color:var(--txl);text-decoration:none;}
.dcs-msgtxt a:hover{text-decoration:underline;}
.dcs-spoiler{background:var(--bg-t);border-radius:4px;padding:0 4px;cursor:pointer;color:transparent;transition:color .2s;}
.dcs-spoiler.open{color:var(--tx);}
.dcs-embed{border-left:4px solid var(--br);background:var(--bg-s);border-radius:4px;
padding:12px;margin-top:8px;max-width:520px;}
.dcs-embed-title{font-weight:600;color:var(--hp);margin-bottom:4px;}
.dcs-embed-desc{font-size:14px;color:var(--tx);}
.dcs-embed-img{max-width:100%;border-radius:4px;margin-top:8px;}
.dcs-linkprev{background:var(--bg-s);border-radius:8px;padding:12px;
margin-top:8px;max-width:400px;border:1px solid var(--dv);}
.dcs-reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;}
.dcs-reaction{background:var(--bg-s);border:1px solid var(--dv);border-radius:8px;
padding:2px 8px;cursor:pointer;font-size:14px;display:flex;align-items:center;gap:4px;}
.dcs-reaction:hover{background:var(--bg-a);}
.dcs-reaction.mine{background:rgba(88,101,242,.3);border-color:var(--br);}
.dcs-msgacts{position:absolute;right:16px;top:-16px;background:var(--bg-p);
border:1px solid var(--bg-t);border-radius:4px;display:none;padding:2px;
box-shadow:0 2px 8px rgba(0,0,0,.3);z-index:10;}
.dcs-msg:hover .dcs-msgacts{display:flex;}
.dcs-actbtn{padding:4px 8px;cursor:pointer;border-radius:4px;color:var(--in);font-size:16px;}
.dcs-actbtn:hover{background:var(--bg-h);color:var(--ih);}
.dcs-readreceipt{font-size:10px;color:var(--txm);text-align:right;margin-top:2px;}
.dcs-typing{padding:4px 16px 8px;font-size:13px;color:var(--txm);
display:flex;align-items:center;gap:6px;min-height:24px;}
.dcs-tdots{display:flex;gap:3px;}
.dcs-tdot{width:6px;height:6px;border-radius:50%;background:var(--txm);animation:dcBounce 1.2s infinite;}
.dcs-tdot:nth-child(2){animation-delay:.2s;}
.dcs-tdot:nth-child(3){animation-delay:.4s;}
@keyframes dcBounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-4px);}}

/* INPUT */
.dcs-inputarea{padding:0 16px 24px;}
.dcs-inputwrap{background:var(--bg-t);border-radius:8px;display:flex;
align-items:flex-end;padding:0 16px;gap:8px;}
.dcs-input{flex:1;background:transparent;border:none;color:var(--tx);font-size:16px;
padding:12px 0;outline:none;resize:none;max-height:200px;font-family:inherit;line-height:1.5;}
.dcs-input::placeholder{color:var(--txm);}
.dcs-attachbtn{width:24px;height:24px;border-radius:50%;background:var(--hs);
color:var(--bg-p);display:flex;align-items:center;justify-content:center;
cursor:pointer;font-size:18px;font-weight:bold;flex-shrink:0;margin-bottom:12px;}
.dcs-attachbtn:hover{background:var(--ih);}
.dcs-inputicon{color:var(--in);cursor:pointer;flex-shrink:0;margin-bottom:12px;font-size:20px;}
.dcs-inputicon:hover{color:var(--ih);}

/* MEMBERS */
.dcs-members{width:240px;background:var(--bg-s);flex-shrink:0;overflow-y:auto;padding:16px 8px;}
.dcs-memcat{font-size:11px;font-weight:700;color:var(--txm);text-transform:uppercase;
padding:16px 8px 4px;letter-spacing:.5px;}
.dcs-member{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;}
.dcs-member:hover{background:var(--bg-h);}
.dcs-memname{font-size:14px;font-weight:500;color:var(--txm);}
.dcs-member:hover .dcs-memname{color:var(--ih);}

/* VOICE */
.dcs-voicebar{background:var(--bg-sa);padding:8px;border-top:1px solid var(--bg-t);}
.dcs-voicestatus{font-size:12px;color:var(--ok);font-weight:600;margin-bottom:4px;}
.dcs-voiceacts{display:flex;gap:4px;}
.dcs-voiceuser{display:flex;align-items:center;gap:6px;padding:4px 8px;
border-radius:4px;font-size:13px;color:var(--txm);}
.dcs-voiceuser.speaking{color:var(--ok);}

/* CALL OVERLAY */
.dcs-calloverlay{position:absolute;inset:0;background:rgba(0,0,0,.88);
z-index:150;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.dcs-callgrid{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-bottom:32px;max-width:900px;}
.dcs-calltile{width:200px;height:150px;background:var(--bg-s);border-radius:12px;
display:flex;flex-direction:column;align-items:center;justify-content:center;
position:relative;overflow:hidden;border:2px solid transparent;transition:border-color .3s;}
.dcs-calltile.speaking{border-color:var(--ok);}
.dcs-calltile.screen{width:420px;height:280px;}
.dcs-callcontrols{display:flex;gap:16px;}
.dcs-callbtn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;
justify-content:center;cursor:pointer;font-size:24px;transition:transform .1s,background .2s;}
.dcs-callbtn:hover{transform:scale(1.1);}
.dcs-callbtn.muted,.dcs-callbtn.end{background:var(--dng);}
.dcs-callbtn.normal{background:var(--bg-s);}

/* MODALS */
.dcs-overlay{position:absolute;inset:0;background:rgba(0,0,0,.7);
backdrop-filter:blur(2px);z-index:100;display:flex;align-items:center;justify-content:center;}
.dcs-modal{background:var(--bg-p);border-radius:12px;width:440px;
box-shadow:0 8px 24px rgba(0,0,0,.4);overflow:hidden;display:flex;flex-direction:column;}
.dcs-modal-hdr{padding:24px 24px 0;font-size:20px;font-weight:700;color:var(--hp);}
.dcs-modal-body{padding:16px 24px;}
.dcs-modal-ftr{padding:16px 24px;background:var(--bg-s);display:flex;justify-content:flex-end;gap:8px;}

/* SETTINGS */
.dcs-settings{background:var(--bg-p);width:100%;height:100%;display:flex;
z-index:200;position:absolute;inset:0;}
.dcs-setnav{width:220px;background:var(--bg-s);padding:60px 8px 20px;
display:flex;flex-direction:column;align-items:flex-end;overflow-y:auto;}
.dcs-setnav-inner{width:192px;}
.dcs-setsec{font-size:11px;font-weight:700;color:var(--txm);text-transform:uppercase;
padding:6px 10px;letter-spacing:.5px;margin-top:8px;}
.dcs-setitem{padding:6px 10px;border-radius:4px;font-size:15px;cursor:pointer;
color:var(--in);margin-bottom:1px;}
.dcs-setitem:hover{background:var(--bg-h);color:var(--ih);}
.dcs-setitem.active{background:var(--bg-a);color:var(--ia);}
.dcs-setcontent{flex:1;padding:60px 40px;overflow-y:auto;position:relative;}
.dcs-setclose{position:absolute;top:20px;right:20px;cursor:pointer;
color:var(--hs);text-align:center;}

/* POPOUT / CONTEXT */
.dcs-popout{position:fixed;background:var(--bg-f);border-radius:8px;
box-shadow:0 8px 16px rgba(0,0,0,.5);border:1px solid var(--bg-t);z-index:500;overflow:hidden;width:340px;}
.dcs-ctx{position:fixed;background:var(--bg-f);border-radius:6px;
box-shadow:0 8px 16px rgba(0,0,0,.5);z-index:600;padding:6px;min-width:180px;}
.dcs-ctxitem{padding:6px 8px;border-radius:4px;cursor:pointer;font-size:14px;
color:var(--tx);display:flex;align-items:center;gap:8px;}
.dcs-ctxitem:hover{background:var(--br);color:#fff;}
.dcs-ctxitem.danger{color:var(--dng);}
.dcs-ctxitem.danger:hover{background:var(--dng);color:#fff;}
.dcs-ctxdiv{height:1px;background:var(--dv);margin:4px 0;}

/* EMOJI PICKER */
.dcs-emojipicker{position:absolute;bottom:80px;right:16px;background:var(--bg-f);
border-radius:8px;box-shadow:0 8px 16px rgba(0,0,0,.5);z-index:50;
width:360px;height:420px;display:flex;flex-direction:column;overflow:hidden;}
.dcs-emojitabs{display:flex;border-bottom:1px solid var(--dv);padding:8px;gap:4px;}
.dcs-emojitab{padding:6px 10px;border-radius:4px;cursor:pointer;font-size:18px;}
.dcs-emojitab:hover{background:var(--bg-h);}
.dcs-emojitab.active{background:var(--bg-a);}
.dcs-emojisearch{padding:8px;border-bottom:1px solid var(--dv);}
.dcs-emojisearch input{width:100%;background:var(--bg-t);border:none;
border-radius:4px;padding:6px 10px;color:var(--tx);outline:none;font-size:14px;}
.dcs-emojigrid{flex:1;overflow-y:auto;padding:8px;display:flex;flex-wrap:wrap;gap:2px;}
.dcs-emojiitem{width:36px;height:36px;display:flex;align-items:center;
justify-content:center;font-size:22px;border-radius:4px;cursor:pointer;}
.dcs-emojiitem:hover{background:var(--bg-h);}

/* SEARCH */
.dcs-searchpanel{position:absolute;top:48px;right:0;width:440px;background:var(--bg-f);
border-radius:0 0 8px 8px;box-shadow:0 8px 16px rgba(0,0,0,.4);z-index:50;
border:1px solid var(--bg-t);border-top:none;max-height:500px;overflow-y:auto;}
.dcs-searchinput{width:100%;background:var(--bg-t);border:none;padding:12px 16px;
color:var(--tx);font-size:16px;outline:none;font-family:inherit;}
.dcs-searchresult{padding:8px 16px;cursor:pointer;border-bottom:1px solid var(--dv);}
.dcs-searchresult:hover{background:var(--bg-h);}

/* PINNED */
.dcs-pinnedpanel{position:absolute;top:48px;right:0;width:360px;background:var(--bg-f);
border-radius:0 0 8px 8px;box-shadow:0 8px 16px rgba(0,0,0,.4);z-index:50;
border:1px solid var(--bg-t);border-top:none;max-height:500px;overflow-y:auto;}
.dcs-pinnedmsg{padding:12px 16px;border-bottom:1px solid var(--dv);cursor:pointer;}
.dcs-pinnedmsg:hover{background:var(--bg-h);}

/* TOAST */
.dcs-toast{position:fixed;bottom:20px;right:20px;background:var(--bg-f);
border-radius:8px;padding:12px 16px;box-shadow:0 4px 12px rgba(0,0,0,.5);
z-index:9999;display:flex;align-items:center;gap:12px;max-width:320px;
animation:dcToastIn .3s ease;border:1px solid var(--dv);}
@keyframes dcToastIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}

/* FRIENDS */
.dcs-friendstab{padding:4px 8px;border-radius:4px;cursor:pointer;font-size:15px;font-weight:500;color:var(--in);}
.dcs-friendstab:hover{background:var(--bg-h);color:var(--ih);}
.dcs-friendstab.active{background:var(--bg-a);color:var(--ia);}
.dcs-friendrow{display:flex;align-items:center;gap:12px;padding:8px 16px;
border-bottom:1px solid var(--dv);cursor:pointer;}
.dcs-friendrow:hover{background:var(--bg-h);}

/* BUTTONS */
.dcbtn{padding:8px 16px;border-radius:4px;font-weight:500;cursor:pointer;
border:none;transition:background .2s;font-size:14px;font-family:inherit;}
.dcbtn-p{background:var(--br);color:#fff;}
.dcbtn-p:hover{background:var(--brh);}
.dcbtn-s{background:var(--bg-t);color:var(--tx);}
.dcbtn-s:hover{background:var(--bg-h);}
.dcbtn-d{background:var(--dng);color:#fff;}
.dcbtn-d:hover{background:#a12d31;}
.dcinput{background:var(--bg-t);border:none;border-radius:4px;padding:10px;
color:var(--tx);width:100%;outline:none;margin-top:8px;font-family:inherit;font-size:14px;}
.dcinput:focus{box-shadow:0 0 0 2px var(--br);}
.dclabel{font-size:12px;font-weight:700;color:var(--hs);text-transform:uppercase;letter-spacing:.5px;}

/* NITRO / XP */
.dcs-nitrobadge{background:linear-gradient(135deg,#ff73fa,#5865f2);color:#fff;
font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;}
.dcs-xpbar{height:6px;background:var(--bg-t);border-radius:3px;overflow:hidden;margin-top:4px;}
.dcs-xpfill{height:100%;background:linear-gradient(90deg,var(--br),#7289da);
border-radius:3px;transition:width .5s ease;}
.dcs-badge{display:inline-flex;align-items:center;justify-content:center;
width:20px;height:20px;border-radius:4px;font-size:12px;cursor:pointer;title:attr(title);}
.dcs-achievement{background:var(--bg-s);border-radius:8px;padding:12px;
display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.dcs-achievement.locked{opacity:.4;filter:grayscale(1);}

/* RICH PRESENCE */
.dcs-presence{background:var(--bg-t);border-radius:8px;padding:10px;margin-top:8px;font-size:13px;}
.dcs-presence-title{font-weight:600;color:var(--hp);margin-bottom:2px;}
.dcs-presence-sub{color:var(--txm);}

/* ANIMATED STATUS */
@keyframes dcPulse{0%,100%{opacity:1;}50%{opacity:.4;}}
@keyframes dcSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes dcRainbow{0%{color:#f00;}16%{color:#f80;}33%{color:#ff0;}
50%{color:#0f0;}66%{color:#08f;}83%{color:#80f;}100%{color:#f00;}}
.dcs-status-pulse{animation:dcPulse 2s infinite;}
.dcs-status-spin{animation:dcSpin 3s linear infinite;}
.dcs-status-rainbow{animation:dcRainbow 3s linear infinite;}

/* TOGGLE */
.dcs-toggle{width:40px;height:22px;border-radius:11px;background:var(--bg-t);
cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
.dcs-toggle.on{background:var(--ok);}
.dcs-toggle::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;
border-radius:50%;background:#fff;transition:transform .2s;}
.dcs-toggle.on::after{transform:translateX(18px);}

/* DIVIDER */
.dcs-divider{height:1px;background:var(--dv);margin:16px 0;}

/* BOOST */
.dcs-boost{background:linear-gradient(135deg,#ff73fa22,#5865f222);border:1px solid #ff73fa44;
border-radius:8px;padding:12px;margin-bottom:8px;}
.dcs-boost-bar{height:8px;background:var(--bg-t);border-radius:4px;overflow:hidden;margin-top:6px;}
.dcs-boost-fill{height:100%;background:linear-gradient(90deg,#ff73fa,#5865f2);border-radius:4px;}

/* MODLOG */
.dcs-modlog{padding:8px 12px;border-radius:6px;margin-bottom:6px;font-size:13px;
border-left:3px solid var(--dng);}
.dcs-modlog.warn{border-color:var(--wrn);}
.dcs-modlog.ok{border-color:var(--ok);}

/* STICKER */
.dcs-sticker{width:160px;height:160px;display:flex;align-items:center;
justify-content:center;font-size:80px;background:var(--bg-s);
border-radius:12px;margin-top:8px;cursor:pointer;}
.dcs-sticker:hover{background:var(--bg-a);}

/* SCREEN SHARE */
.dcs-screenshare{width:100%;height:100%;background:#000;border-radius:8px;
display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
.dcs-screenshare-label{position:absolute;top:8px;left:8px;background:var(--dng);
color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;}

/* SCROLL TO BOTTOM */
.dcs-scrollbtn{position:absolute;bottom:90px;right:24px;background:var(--bg-f);
border:1px solid var(--dv);border-radius:50%;width:36px;height:36px;
display:flex;align-items:center;justify-content:center;cursor:pointer;
box-shadow:0 2px 8px rgba(0,0,0,.4);z-index:10;font-size:18px;}
.dcs-scrollbtn:hover{background:var(--bg-h);}

/* WELCOME BANNER */
.dcs-welcome{padding:32px 16px 16px;border-bottom:1px solid var(--dv);margin-bottom:8px;}
.dcs-welcome-icon{width:68px;height:68px;border-radius:50%;background:var(--br);
display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:12px;}

/* NITRO UPSELL */
.dcs-nitroupsell{background:linear-gradient(135deg,#23252d,#1a1b22);
border:1px solid #5865f244;border-radius:12px;padding:16px;margin:8px 0;}

/* THEME PREVIEW */
.dcs-themepreview{width:100%;height:80px;border-radius:8px;margin-top:8px;
display:flex;overflow:hidden;border:2px solid transparent;}
.dcs-themepreview.selected{border-color:var(--br);}
`;
      document.head.appendChild(style);
    }

    // ── ICONS ─────────────────────────────────────────────────────────────
    const I = {
      hash: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M5.887 21a.5.5 0 0 1-.493-.587L6 17H2.595a.5.5 0 0 1-.493-.587l.175-1a.5.5 0 0 1 .493-.413H6.35l1.06-6H4.005a.5.5 0 0 1-.493-.587l.175-1A.5.5 0 0 1 4.18 7H7.76l.637-3.587A.5.5 0 0 1 8.889 3h.984a.5.5 0 0 1 .493.587L9.76 7h6l.637-3.587A.5.5 0 0 1 16.889 3h.984a.5.5 0 0 1 .493.587L17.76 7h3.405a.5.5 0 0 1 .493.587l-.175 1A.5.5 0 0 1 20.99 9H17.41l-1.06 6h3.405a.5.5 0 0 1 .493.587l-.175 1a.5.5 0 0 1-.493.413H16l-.637 3.587a.5.5 0 0 1-.493.413h-.984a.5.5 0 0 1-.493-.587L14 17H8l-.637 3.587a.5.5 0 0 1-.493.413H5.887ZM9.41 9l-1.06 6h6l1.06-6H9.41Z"/></svg>`,
      voice: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 0 1 9 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 9-9Zm0 2a7 7 0 0 0-7 7v7h14v-7a7 7 0 0 0-7-7Zm-1 3h2v2h2v2h-2v2h-2v-2H9v-2h2V8Z"/></svg>`,
      mic: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Zm0 13c3.314 0 6-2.686 6-6h-2a4 4 0 0 1-8 0H6c0 3.314 2.686 6 6 6Zm-1 2h2v3h-2v-3Z"/></svg>`,
      micoff: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2l20 20-1.41 1.41-3.15-3.15A5.97 5.97 0 0 1 12 22c-3.314 0-6-2.686-6-6h2a4 4 0 0 0 6.93 2.72L13 16.83A3 3 0 0 1 9 14V8.83L4.41 4.24 2 2Zm10-2a3 3 0 0 1 3 3v6c0 .35-.06.68-.17 1L9 4.17V5a3 3 0 0 1 3-3Zm6 9h-2a4 4 0 0 1-.08.8l1.52 1.52c.36-.71.56-1.5.56-2.32Z"/></svg>`,
      settings: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19.738 10H21v4h-1.261a8.02 8.02 0 0 1-1.174 2.564l.891.891-2.828 2.828-.891-.891A8.02 8.02 0 0 1 13 20.738V22H9v-1.262a8.02 8.02 0 0 1-2.564-1.174l-.891.891-2.828-2.828.891-.891A8.02 8.02 0 0 1 2.262 14H1v-4h1.262A8.02 8.02 0 0 1 3.436 7.436l-.891-.891 2.828-2.828.891.891A8.02 8.02 0 0 1 9 3.262V2h4v1.262a8.02 8.02 0 0 1 2.564 1.174l.891-.891 2.828 2.828-.891.891A8.02 8.02 0 0 1 19.738 10ZM11 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>`,
      dm: `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2Zm5.293 12.707L12 9.414l-5.293 5.293-1.414-1.414L12 6.586l6.707 6.707-1.414 1.414Z"/></svg>`,
      close: `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M18.4 4 12 10.4 5.6 4 4 5.6 10.4 12 4 18.4 5.6 20 12 13.6l6.4 6.4 1.6-1.6L13.6 12 20 5.6 18.4 4Z"/></svg>`,
      pin: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="m15 2 7 7-1 1-2-1-4 4 1 3-1 1-4-4-4 4H5v-2l4-4-4-4 1-1 3 1 4-4-1-2 1-1Z"/></svg>`,
      search: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M21.707 20.293 16.314 14.9a8 8 0 1 0-1.414 1.414l5.393 5.393 1.414-1.414ZM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z"/></svg>`,
      members: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 8H22V10H20V12H18V10H16V8H18V6H20V8ZM20 19.006C20 17.831 19.5 16.706 18.566 15.806C19.077 15.706 19.528 15.606 20 15.606C22.757 15.606 24 17.156 24 19.006V20.006H20V19.006Z"/></svg>`,
      add: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M20 11.0007H13V4.00073H11V11.0007H4V13.0007H11V20.0007H13V13.0007H20V11.0007Z"/></svg>`,
      bell: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z"/></svg>`,
      boost: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M7 2l10 10H12l5 10H7L12 12H7L7 2Z"/></svg>`,
      gift: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M20 7h-2.586A2 2 0 0 0 18 5.5C18 4.12 16.88 3 15.5 3c-.93 0-1.74.53-2.16 1.3L12 6.4l-1.34-2.1A2.49 2.49 0 0 0 8.5 3C7.12 3 6 4.12 6 5.5c0 .55.18 1.05.49 1.45L4 7a2 2 0 0 0-2 2v2h20V9a2 2 0 0 0-2-2Zm-4.5-2c.28 0 .5.22.5.5s-.22.5-.5.5H13l1.04-1.63c.1-.23.33-.37.46-.37ZM8.5 6c-.28 0-.5-.22-.5-.5s.22-.5.5-.5c.13 0 .36.14.46.38L9.99 7H8.5c-.28 0-.5-.22-.5-.5ZM2 20a2 2 0 0 0 2 2h7v-9H2v7Zm13 2a2 2 0 0 0 2-2v-7h-9v9h7Z"/></svg>`,
      screen: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M2 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8v2H8v2h8v-2h-2v-2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H2Zm0 2h20v10H2V6Z"/></svg>`,
      invite: `<svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"/></svg>`,
    };

    // ── DATA & STATE ──────────────────────────────────────────────────────
    const saved = (typeof OS !== 'undefined' && OS.getAppData('discord')) || {};

    const ROLES = {
      owner:  { name: 'Owner',     color: '#f0b232', perms: ['all'] },
      admin:  { name: 'Admin',     color: '#e74c3c', perms: ['kick','ban','manage'] },
      mod:    { name: 'Moderator', color: '#2ecc71', perms: ['kick','manage'] },
      member: { name: 'Member',    color: '#5865F2', perms: ['send','read'] },
      muted:  { name: 'Muted',     color: '#949ba4', perms: ['read'] },
    };

    const ACHIEVEMENTS = [
      { id:'first_msg',  icon:'💬', name:'First Words',      desc:'Send your first message',           xp:50  },
      { id:'ten_msgs',   icon:'🗣️', name:'Chatterbox',       desc:'Send 10 messages',                  xp:100 },
      { id:'hundred',    icon:'💯', name:'Century',          desc:'Send 100 messages',                 xp:500 },
      { id:'first_sv',   icon:'🏠', name:'Home Owner',       desc:'Create your first server',          xp:150 },
      { id:'first_call', icon:'📞', name:'Hello?',           desc:'Join a voice channel',              xp:75  },
      { id:'nitro',      icon:'💎', name:'Nitro Subscriber', desc:'Subscribe to Nitro',                xp:200 },
      { id:'boosted',    icon:'🚀', name:'Booster',          desc:'Boost a server',                    xp:300 },
      { id:'friend10',   icon:'👥', name:'Social Butterfly', desc:'Add 10 friends',                    xp:200 },
      { id:'streamer',   icon:'📺', name:'Going Live',       desc:'Start a stream',                    xp:100 },
      { id:'night_owl',  icon:'🦉', name:'Night Owl',        desc:'Send a message after midnight',     xp:75  },
    ];

    const AUTO_COMMUNITIES = [
      { name:'Minecraft Builders', icon:'⛏️', members:12847, desc:'Build, survive, thrive.' },
      { name:'Anime Central',      icon:'🌸', members:34201, desc:'All things anime & manga.' },
      { name:'Indie Dev Hub',      icon:'🎮', members:8934,  desc:'Indie game developers unite.' },
      { name:'Lo-Fi Lounge',       icon:'🎵', members:21033, desc:'Chill beats and good vibes.' },
      { name:'Crypto Talk',        icon:'📈', members:45678, desc:'Discuss markets and DeFi.' },
      { name:'Art & Design',       icon:'🎨', members:17290, desc:'Share your creative work.' },
      { name:'Study Together',     icon:'📚', members:9812,  desc:'Pomodoro sessions daily.' },
      { name:'Meme Factory',       icon:'😂', members:88321, desc:'Freshest memes daily.' },
    ];

    const STICKERS = ['🐱','🐶','🦊','🐸','🐼','🦄','🐲','👾','🤖','👻','💀','🎃','🌈','⚡','🔥','💎','🚀','🎮','🎵','🍕'];
    const GIFS = ['https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif','https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif','https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif'];

    const defaultServers = [
      {
        id:'s1', name:'Vortarium Dev', icon:'V', color:'#5865F2',
        banner:'linear-gradient(135deg,#5865F2,#7289da)',
        boosts:7, boostLevel:2,
        categories:[
          { id:'cat1', name:'Information', channels:[
            { id:'c1', name:'rules',        type:'text',  topic:'Read before chatting.' },
            { id:'c2', name:'announcements',type:'text',  topic:'Server updates here.' },
          ]},
          { id:'cat2', name:'General', channels:[
            { id:'c3', name:'general',      type:'text',  topic:'Chat about anything!' },
            { id:'c4', name:'code-snippets',type:'text',  topic:'Share your code.' },
            { id:'c5', name:'off-topic',    type:'text',  topic:'Anything goes.' },
          ]},
          { id:'cat3', name:'Voice', channels:[
            { id:'vc1', name:'General VC',  type:'voice', users:[] },
            { id:'vc2', name:'Gaming',      type:'voice', users:[] },
          ]},
        ],
        roles:{ Logan:'owner', Alice:'admin', BotGuy:'member', Dave:'mod', Eve:'member' },
        members:['Logan','Alice','BotGuy','Dave','Eve'],
        pinnedMessages:{ c3:[] },
        modLog:[],
      },
      {
        id:'s2', name:'Gaming Zone', icon:'🎮', color:'#e74c3c',
        banner:'linear-gradient(135deg,#e74c3c,#c0392b)',
        boosts:2, boostLevel:1,
        categories:[
          { id:'cat4', name:'Gaming', channels:[
            { id:'c6', name:'mc-server',  type:'text', topic:'Minecraft discussion.' },
            { id:'c7', name:'lfg',        type:'text', topic:'Looking for group.' },
            { id:'c8', name:'clips',      type:'text', topic:'Share your clips.' },
          ]},
          { id:'cat5', name:'Voice', channels:[
            { id:'vc3', name:'Squad VC',  type:'voice', users:[] },
          ]},
        ],
        roles:{ Logan:'owner', Dave:'member', Eve:'member' },
        members:['Logan','Dave','Eve'],
        pinnedMessages:{},
        modLog:[],
      },
    ];

    const state = {
      profile: saved.profile || {
        username:'Logan', tag:Math.floor(1000+Math.random()*9000),
        avatar:'💻', status:'online', bio:'Game Dev / Code / Geometry Dash',
        banner:'#5865F2', nitro:true, xp:340, level:4,
        badges:['🏆','💎','🚀'], achievements:['first_msg','first_sv'],
        customStatus:'Building something cool 🔨',
        effect:'none', theme:'dark',
      },
      servers:    saved.servers    || defaultServers,
      dms:        saved.dms        || [
        { id:'dm1', name:'Alice',   avatar:'👩', status:'online', bio:'Designer & artist 🎨', banner:'#e74c3c', messages:[], presence:{ game:'Figma', since:'2h ago' } },
        { id:'dm2', name:'BotGuy',  avatar:'🤖', status:'online', bio:'I am definitely not a bot.', banner:'#2ecc71', messages:[], presence:null },
        { id:'dm3', name:'Dave',    avatar:'🧔', status:'idle',   bio:'Gamer. Sleeper. Eater.', banner:'#f0b232', messages:[], presence:{ game:'Minecraft', since:'45m ago' } },
        { id:'dm4', name:'Eve',     avatar:'👩‍💻', status:'dnd',   bio:'Do not disturb. Coding.', banner:'#9b59b6', messages:[], presence:{ game:'VS Code', since:'3h ago' } },
      ],
      groupDMs:   saved.groupDMs   || [
        { id:'gdm1', name:'The Squad', avatar:'👥', members:['Alice','Dave','Eve'], messages:[] },
      ],
      messages:   saved.messages   || {},
      friends:    saved.friends    || ['Alice','Dave','Eve','BotGuy'],
      friendReqs: saved.friendReqs || ['Charlie','Zara'],
      blocked:    saved.blocked    || [],
      activeServer:  saved.activeServer  || 's1',
      activeChannel: saved.activeChannel || 'c3',
      view:          saved.view          || 'server',
      showMembers:   saved.showMembers   !== false,
      typingUsers:   {},
      unread:        saved.unread        || {},
      notifications: saved.notifications || [],
      inCall:        false,
      callChannel:   null,
      callMuted:     false,
      callDeafened:  false,
      streaming:     false,
      screenShare:   false,
      friendsTab:    'online',
      settingsTab:   'account',
      emojiTab:      'emoji',
      searchOpen:    false,
      pinnedOpen:    false,
      membersOpen:   true,
      collapsedCats: {},
      reactions:     saved.reactions || {},
      soundEnabled:  saved.soundEnabled !== false,
      theme:         saved.theme || 'dark',
      fontSize:      saved.fontSize || 16,
      messageDisplay: saved.messageDisplay || 'cozy',
      reducedMotion: saved.reducedMotion || false,
    };

    const save = () => {
      if (typeof OS !== 'undefined') {
        OS.setAppData('discord', {
          profile:state.profile, servers:state.servers, dms:state.dms,
          groupDMs:state.groupDMs, messages:state.messages, friends:state.friends,
          friendReqs:state.friendReqs, blocked:state.blocked,
          activeServer:state.activeServer, activeChannel:state.activeChannel,
          view:state.view, showMembers:state.showMembers, unread:state.unread,
          reactions:state.reactions, soundEnabled:state.soundEnabled,
          theme:state.theme, fontSize:state.fontSize,
          messageDisplay:state.messageDisplay, reducedMotion:state.reducedMotion,
        });
      }
    };

    const SC = { online:'#23a55a', idle:'#f0b232', dnd:'#da373c', offline:'#80848e' };
    const fakeUsers = [
      { name:'Alice',   av:'👩',  status:'online', color:'#e74c3c' },
      { name:'Dave',    av:'🧔',  status:'idle',   color:'#f0b232' },
      { name:'Eve',     av:'👩‍💻', status:'dnd',    color:'#9b59b6' },
      { name:'BotGuy',  av:'🤖',  status:'online', color:'#2ecc71' },
      { name:'Charlie', av:'🧑',  status:'offline',color:'#3498db' },
      { name:'Zara',    av:'👩‍🎤', status:'online', color:'#e91e63' },
    ];

    // ── HELPERS ───────────────────────────────────────────────────────────
    const getEl   = s => document.getElementById(s);
    const qsa     = s => content.querySelectorAll(s);
    const qs      = s => content.querySelector(s);
    const getMsgs = ch => state.messages[ch] || [];
    const getServer = () => state.servers.find(s => s.id === state.activeServer);
    const getAllChannels = sv => sv ? sv.categories.flatMap(c => c.channels) : [];
    const getChannel = () => {
      const sv = getServer();
      return getAllChannels(sv).find(c => c.id === state.activeChannel);
    };
    const getDM = () => state.dms.find(d => d.id === state.activeChannel)
                     || state.groupDMs.find(d => d.id === state.activeChannel);

    const getUserColor = (name) => {
      const sv = getServer();
      if (sv) {
        const role = sv.roles[name] || 'member';
        return ROLES[role]?.color || '#b5bac1';
      }
      return fakeUsers.find(u => u.name === name)?.color || '#b5bac1';
    };

    const getUserRole = (name) => {
      const sv = getServer();
      if (!sv) return null;
      return sv.roles[name] || 'member';
    };

    const hasPermission = (perm) => {
      const sv = getServer();
      if (!sv) return true;
      const role = sv.roles[state.profile.username] || 'member';
      const perms = ROLES[role]?.perms || [];
      return perms.includes('all') || perms.includes(perm);
    };

    const markdownToHtml = (text) => {
      // Code blocks
      text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      // Bold, italic, strikethrough
      text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
      text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
      text = text.replace(/_(.+?)_/g, '<em>$1</em>');
      text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
      // Spoiler
      text = text.replace(/\|\|(.+?)\|\|/g, '<span class="dcs-spoiler" onclick="this.classList.toggle(\'open\')">$1</span>');
      // Blockquote
      text = text.replace(/^&gt; (.+)/gm, '<blockquote>$1</blockquote>');
            // Links
      text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
      text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
      // Mentions
      text = text.replace(/@(\w+)/g, '<span style="color:var(--br);background:rgba(88,101,242,.2);border-radius:3px;padding:0 2px;">@$1</span>');
      // Channel mentions
      text = text.replace(/#(\w[\w-]*)/g, '<span style="color:var(--br);cursor:pointer;">##$1</span>');
      return text;
    };

    const detectLinkPreview = (text) => {
      const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
      if (!urlMatch) return '';
      const url = urlMatch[1];
      const domain = url.replace(/https?:\/\//,'').split('/')[0];
      const previews = {
        'youtube.com':  { title:'YouTube Video',    desc:'Watch on YouTube',           color:'#ff0000', icon:'▶️' },
        'youtu.be':     { title:'YouTube Video',    desc:'Watch on YouTube',           color:'#ff0000', icon:'▶️' },
        'github.com':   { title:'GitHub Repository',desc:'View source on GitHub',      color:'#333',    icon:'🐙' },
        'twitter.com':  { title:'Twitter / X Post', desc:'View on Twitter',            color:'#1da1f2', icon:'🐦' },
        'x.com':        { title:'X Post',           desc:'View on X',                  color:'#000',    icon:'✖️' },
        'twitch.tv':    { title:'Twitch Stream',    desc:'Watch live on Twitch',       color:'#9146ff', icon:'🎮' },
        'spotify.com':  { title:'Spotify Track',    desc:'Listen on Spotify',          color:'#1db954', icon:'🎵' },
        'reddit.com':   { title:'Reddit Post',      desc:'View on Reddit',             color:'#ff4500', icon:'🤖' },
        'imgur.com':    { title:'Imgur Image',      desc:'View image on Imgur',        color:'#1bb76e', icon:'🖼️' },
      };
      const found = Object.entries(previews).find(([k]) => domain.includes(k));
      if (!found) return '';
      const [,p] = found;
      return `<div class="dcs-linkprev">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:20px;">${p.icon}</span>
          <div>
            <div style="font-weight:600;color:var(--hp);font-size:14px;">${p.title}</div>
            <div style="font-size:12px;color:var(--txm);">${domain}</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--tx);">${p.desc}</div>
        <div style="margin-top:6px;font-size:12px;color:var(--txl);word-break:break-all;">${url}</div>
      </div>`;
    };

    const addMessage = (chId, author, text, avatar='', isImage=false, isSticker=false, isFile=false) => {
      if (!state.messages[chId]) state.messages[chId] = [];
      const msg = {
        id: Date.now() + Math.random(),
        author, avatar,
        text: isImage   ? `<img src="${text}" alt="uploaded image" />`
            : isSticker ? `<div class="dcs-sticker">${text}</div>`
            : isFile    ? `<div style="background:var(--bg-s);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;margin-top:4px;max-width:300px;"><span style="font-size:28px;">📄</span><div><div style="font-weight:600;color:var(--hp);font-size:14px;">${text}</div><div style="font-size:12px;color:var(--txm);">File attachment</div></div><span style="margin-left:auto;color:var(--br);cursor:pointer;font-size:12px;">Download</span></div>`
            : text,
        ts: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
        reactions: {},
        pinned: false,
        readBy: [author],
        linkPreview: (!isImage && !isSticker && !isFile) ? detectLinkPreview(text) : '',
      };
      state.messages[chId].push(msg);
      // XP gain
      if (author === state.profile.username) {
        state.profile.xp = (state.profile.xp || 0) + 5;
        const newLevel = Math.floor(state.profile.xp / 200) + 1;
        if (newLevel > (state.profile.level || 1)) {
          state.profile.level = newLevel;
          showToast(`🎉 Level Up! You're now level ${newLevel}!`, 'var(--ok)');
        }
        checkAchievements();
      }
      // Mark unread for others
      if (author !== state.profile.username) {
        if (chId !== state.activeChannel) {
          state.unread[chId] = (state.unread[chId] || 0) + 1;
        }
      }
      save();
      return msg;
    };

    const checkAchievements = () => {
      const msgs = Object.values(state.messages).flat().filter(m => m.author === state.profile.username);
      const earned = state.profile.achievements || [];
      const unlock = (id) => {
        if (!earned.includes(id)) {
          earned.push(id);
          state.profile.achievements = earned;
          const ach = ACHIEVEMENTS.find(a => a.id === id);
          if (ach) {
            state.profile.xp += ach.xp;
            showToast(`${ach.icon} Achievement Unlocked: ${ach.name} (+${ach.xp} XP)`, 'var(--gld)');
          }
        }
      };
      if (msgs.length >= 1)   unlock('first_msg');
      if (msgs.length >= 10)  unlock('ten_msgs');
      if (msgs.length >= 100) unlock('hundred');
      if (state.servers.length > 2) unlock('first_sv');
      if (state.friends.length >= 10) unlock('friend10');
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 5) unlock('night_owl');
    };

    const fetchAIResponse = async (context='') => {
      const fallbacks = [
        "fr fr 💀","that's actually wild","bro what 😭","W","L + ratio","no way","real talk",
        "send the repo link","I fw that","ngl that's kinda fire","okay but hear me out",
        "this is giving me anxiety","I'm not even surprised anymore","based","cope",
        "skill issue tbh","let him cook","we are so back","it's joever","gigachad move",
        "I was literally just thinking about this","no thoughts head empty","certified moment",
        "the audacity","this ain't it chief","lowkey though","unironically yes",
        "wsg","sup","hey","yo","what's good","hii","heyy","yo what's up",
        "nm u?","chilling","just vibing","working on some code","playing games",
        "what game you playing?","I'm on Valorant","playing Minecraft rn","some indie game",
        "Fortnite actually","Apex Legends","CS2","League","Rocket League",
        "wanna play?","sure","maybe later","I'm down","not right now",
        "that sounds fun","let's go","bet","say less","bet let's do it",
        "brb","afk a sec","back","I'm here","what did I miss",
        "lol","lmao","😭","💀","dead","I'm dead","this is hilarious",
        "fr","for real","no cap","cap","facts","big facts","true",
        "ngl","tbh","honestly","lowkey","highkey","unironically",
        "based","cringe","based and redpilled","cringe and bluepilled",
        "skill issue","get good","git gud","practice more","you'll get there",
        "let him cook","chef's kiss","👨‍🍳","cooking","he's cooking",
        "we are so back","it's over","it's joever","we're back boys",
        "gigachad move","sigma grindset","based","alpha","omega",
        "I forgor 💀","I forgot","my brain is smooth","brain empty",
        "send help","I need help","pls help","someone help",
        "anyone else?","just me?","am I the only one","is it just me",
        "this update is insane","this update sucks","new update dropped",
        "the new season is fire","season is trash","can't wait for next season",
        "who's online rn","who's here","anyone online","hello?",
        "good morning everyone","gm","good night everyone","gn","afternoon",
        "just woke up","about to sleep","taking a nap","coffee time",
        "I need coffee","caffeine pls","energy drink needed","I'm tired",
        "bro I've been coding for 6 hours straight","coding all night","debugging hell",
        "this bug is killing me","finally fixed it","it works now","ship it",
        "just pushed a new commit 🔥","merged to main","deployed","production",
        "github copilot is crazy","AI is taking over","skynet soon","robot uprising",
        "learn to code","python is best","javascript sucks","rust is cool",
        "typescript is better","use linux","windows 12 when","mac vs pc",
        "my code is spaghetti","spaghetti code","tech debt","refactor time",
        "clean code","solid principles","design patterns","architecture",
        "just ate and I'm ready to grind","time to grind","grindset","hustle",
        "this is the best server ngl","this server is dead","server is active",
        "y'all see that new meme going around","that meme is fire","dank meme",
        "I'm so cooked for this deadline","deadline tomorrow","panic mode",
        "stressed out","overwhelmed","burning out","need a break",
        "taking a break","back to work","focus mode","deep work",
        "listening to music","music recs","what should I listen to","spotify",
        "watching youtube","youtube recommendations","video is long","shorts",
        "on tiktok","tiktok is addicting","doomscrolling","infinite scroll",
        "twitter is wild","x is weird","elon musk","blue checkmark",
        "reddit is down","reddit moment","r/programmerhumor","askreddit",
        "anyone wanna vc?","hop in vc","voice chat","call me",
        "streaming rn","watch my stream","twitch","live stream",
        "I'm live","going live","stream starting soon","raid me",
        "sub to me","follow me","like and subscribe","smash that button",
        "content creator","influencer","clout chasing","internet famous",
        "viral moment","trending","fyp","for you page",
        "this is giving me anxiety","anxiety attack","panic","stressed",
        "mental health matters","take care of yourself","self care","wellness",
        "therapy session","therapy is good","talk to someone","you're not alone",
        "I'm depressed","feeling down","sad hours","emo hours",
        "happy vibes","positive energy","good vibes only","spread love",
        "be kind","nice things","compliment","you're awesome",
        "you got this","keep going","don't give up","persist",
        "motivation","inspiration","wisdom","life advice",
        "life hack","pro tip","life pro tip","LPT",
        "did you know","fun fact","actually","technically",
        "interesting","that's cool","wow","amazing","incredible",
        "unbelievable","insane","crazy","wild","mind blown",
        "my mind is blown","🤯","shook","shaking","I can't even",
        "I can't even right now","literally can't","can't breathe","dying",
        "I'm dying","dead","💀","skull emoji","rip","rest in peace",
        "F","press F to pay respects","F in chat","🇫",
        "moment of silence","silence","🤫","shh","quiet",
        "loud","noise","chaos","mayhem","pandemonium",
        "this is chaos","absolute chaos","pure chaos","organized chaos",
        "everything is fine","it's fine","totally fine","nothing to worry about",
        "don't worry","it'll be okay","everything will be fine","trust me",
        "I promise","cross my heart","pinkie promise","scout's honor",
        "no cap","for real","serious","dead serious","100%",
        "I swear","swear to god","on my life","on my mom",
        "bet","wager","you're on","you're on","challenge accepted",
        "challenge","dare","double dare","triple dog dare",
        "truth or dare","spin the bottle","never have I ever","party games",
        "game night","board games","video games","online games",
        "multiplayer","co-op","pvp","competitive","casual",
        "ranked","unranked","placement matches","climbing the ladder",
        "elo hell","smurf","hacker","cheater","suspicious",
        "report","ban","kick","mute","silence",
        "mod abuse","admin abuse","power trip","corruption",
        "free speech","censorship","rules","guidelines","terms of service",
        "read the rules","follow the rules","break the rules","rule breaker",
        "rebel","anarchist","chaos agent","agent of chaos",
        "peace","love","harmony","unity","together",
        "community","family","friends","besties","squad",
        "gang","crew","team","group","collective",
        "we","us","our","together","united",
        "divide and conquer","split up","go solo","lone wolf",
        "introvert","extrovert","ambivert","shy","outgoing",
        "social butterfly","social anxiety","social battery","recharge",
        "I'm drained","I'm exhausted","I'm tired","I'm sleepy",
        "goodnight","sweet dreams","sleep tight","don't let the bed bugs bite",
        "morning person","night owl","early bird","night shift",
        "insomnia","can't sleep","counting sheep","sleep deprivation",
        "coffee addict","caffeine junkie","energy drink fiend","soda lover",
        "water is life","stay hydrated","drink water","hydration",
        "healthy","health","wellness","fitness","exercise",
        "gym","workout","lifting","cardio","training",
        "diet","nutrition","food","eating","hungry",
        "starving","famished","hangry","food coma","full",
        "stuffed","bloated","satisfied","delicious","yummy",
        "tasty","good food","bad food","cooking","baking",
        "chef","cook","recipe","ingredients","meal prep",
        "breakfast","lunch","dinner","snack","dessert",
        "sweet tooth","sugar rush","sugar crash","healthy snack",
        "fast food","junk food","clean eating","whole foods","organic",
        "vegan","vegetarian","carnivore","omnivore","dietary restrictions",
        "allergies","gluten free","dairy free","nut free","safe food",
        "food poisoning","stomach ache","nausea","vomiting","sick",
        "illness","disease","virus","bacteria","infection",
        "health is wealth","health first","take care of yourself","self care",
        "mental health","physical health","emotional health","spiritual health",
        "holistic health","wellness","wellbeing","balance","harmony",
        "peace of mind","inner peace","zen","meditation","mindfulness",
        "yoga","stretching","breathing","relaxation","stress relief",
        "calm","serene","tranquil","peaceful","quiet",
        "silence is golden","speak softly","whisper","shout","scream",
        "yell","cry","tears","emotional","feelings",
        "emotions","sentiments","heart","soul","spirit",
        "love","hate","like","dislike","indifferent",
        "passionate","intense","mild","moderate","extreme",
        "middle ground","compromise","meet halfway","agree to disagree",
        "disagree","argument","debate","discussion","conversation",
        "talk","chat","communicate","express","articulate",
        "listen","hear","understand","comprehend","grasp",
        "learn","teach","share","exchange","collaborate",
        "cooperate","work together","teamwork","synergy","collaboration",
        "partnership","alliance","coalition","union","merger",
        "business","work","job","career","profession",
        "office","remote","hybrid","WFH","work from home",
        "commute","traffic","road rage","public transit","car",
        "drive","walk","bike","cycle","run",
        "exercise","fitness","active","sedentary","couch potato",
        "lazy","productive","efficient","effective","successful",
        "failure","success","win","lose","draw",
        "tie","game over","victory","defeat","champion",
        "winner","loser","participant","competitor","player",
        "sport","athlete","team","coach","manager",
        "fan","supporter","hater","critic","analyst",
        "commentator","announcer","host","guest","audience",
        "viewer","watcher","listener","reader","consumer",
        "creator","maker","builder","developer","designer",
        "artist","writer","musician","actor","performer",
        "entertainment","media","content","platform","channel",
        "youtube","twitch","tiktok","instagram","twitter",
        "facebook","linkedin","reddit","discord","snapchat",
        "social media","social network","community","platform","app",
        "software","hardware","tech","technology","innovation",
        "future","past","present","history","tomorrow",
        "yesterday","today","tonight","now","later",
        "soon","eventually","never","always","forever",
        "eternity","infinity","time","space","universe",
        "galaxy","star","planet","moon","sun",
        "earth","world","global","international","local",
        "city","town","village","country","nation",
        "government","politics","election","vote","democracy",
        "freedom","liberty","justice","equality","rights",
        "human rights","civil rights","equal rights","women's rights","LGBTQ+",
        "pride","love is love","acceptance","tolerance","diversity",
        "inclusion","belonging","community","together","united",
        "stand together","rise up","speak out","make change","be the change",
        "activism","advocacy","protest","march","demonstration",
        "movement","cause","mission","purpose","meaning",
        "life","death","birth","growth","change",
        "evolution","revolution","progress","regression","stagnation",
        "growth","development","improvement","betterment","enhancement",
        "upgrade","update","version 2.0","new and improved","refreshed",
        "reboot","restart","reset","fresh start","clean slate",
        "beginning","end","journey","adventure","quest",
        "story","narrative","tale","legend","myth",
        "truth","fiction","reality","fantasy","dream",
        "nightmare","vision","imagination","creativity","innovation",
        "art","science","math","history","literature",
        "philosophy","psychology","sociology","anthropology","biology",
        "chemistry","physics","astronomy","geology","geography",
        "politics","economics","business","law","medicine",
        "education","learning","teaching","school","college",
        "university","student","teacher","professor","mentor",
        "guidance","advice","wisdom","knowledge","intelligence",
        "smart","clever","wise","brilliant","genius",
        "stupid","dumb","foolish","idiotic","moronic",
        "ignorant","uninformed","misinformed","educated","learned",
        "expert","professional","amateur","novice","beginner",
        "master","grandmaster","legend","icon","hero",
        "villain","antagonist","protagonist","character","persona",
        "identity","self","ego","superego","id",
        "conscious","subconscious","unconscious","dream","reality",
        "perception","perspective","viewpoint","opinion","belief",
        "faith","religion","spirituality","god","gods",
        "atheist","agnostic","believer","skeptic","cynic",
        "optimist","pessimist","realist","idealist","pragmatist",
        "hope","despair","joy","sorrow","happiness",
        "sadness","anger","fear","courage","bravery",
        "cowardice","strength","weakness","power","powerless",
        "control","chaos","order","disorder","structure",
        "freedom","constraint","limit","boundless","infinite",
        "finite","temporary","permanent","eternal","momentary",
        "instant","gradual","sudden","slow","fast",
        "quick","rapid","swift","speedy","hasty",
        "rushed","patient","impatient","calm","anxious",
        "worried","concerned","relaxed","tense","stressed",
        "chill","cool","hot","cold","warm",
        "temperature","weather","climate","season","environment",
        "nature","natural","artificial","synthetic","fake",
        "real","authentic","genuine","original","copy",
        "replica","duplicate","clone","imitation","simulation",
        "virtual","digital","analog","physical","material",
        "abstract","concrete","tangible","intangible","visible",
        "invisible","hidden","secret","revealed","exposed",
        "covered","uncovered","open","closed","shut",
        "locked","unlocked","key","password","security",
        "safe","dangerous","risky","hazardous","harmful",
        "helpful","useful","useless","valuable","worthless",
        "priceless","cheap","expensive","costly","free",
        "paid","bought","sold","traded","exchanged",
        "money","cash","currency","wealth","rich",
        "poor","middle class","economy","market","business",
        "company","corporation","enterprise","startup","small business",
        "entrepreneur","founder","CEO","boss","leader",
        "manager","employee","worker","staff","team",
        "organization","institution","establishment","facility","building",
        "home","house","apartment","condo","room",
        "space","place","location","destination","journey",
        "travel","trip","vacation","holiday","getaway",
        "adventure","explore","discover","find","search",
        "seek","look","hunt","chase","pursue",
        "catch","capture","grab","hold","keep",
        "lose","misplace","forget","remember","recall",
        "memory","nostalgia","past","future","present",
        "moment","instant","second","minute","hour",
        "day","week","month","year","decade",
        "century","millennium","era","age","epoch",
        "time","clock","watch","calendar","schedule",
        "plan","agenda","routine","habit","ritual",
        "tradition","custom","culture","society","civilization",
        "humanity","mankind","people","person","individual",
        "self","other","us","them","we",
        "they","he","she","it","one",
        "everyone","someone","anyone","no one","nobody",
        "everywhere","somewhere","anywhere","nowhere","space",
        "everything","something","anything","nothing","void",
        "empty","full","complete","incomplete","finished",
        "done","over","ended","started","begun",
        "beginning","middle","end","start","finish",
        "conclusion","introduction","body","structure","form",
        "shape","size","color","texture","pattern",
        "design","style","fashion","trend","vogue",
        "classic","modern","contemporary","retro","vintage",
        "old","new","young","aged","ancient",
        "future","past","present","now","then",
        "before","after","during","while","until",
        "since","because","why","how","what",
        "where","when","who","which","that",
        "this","these","those","it","they",
        "question","answer","problem","solution","mystery",
        "puzzle","riddle","enigma","secret","hidden",
        "revealed","discovered","found","lost","search",
        "seek","find","look","see","observe",
        "watch","notice","perceive","sense","feel",
        "touch","taste","smell","hear","listen",
        "speak","talk","say","tell","ask",
        "answer","respond","reply","react","act",
        "do","make","create","build","construct",
        "destroy","break","damage","fix","repair",
        "heal","cure","treat","help","support",
        "assist","aid","serve","give","take",
        "receive","get","have","own","possess",
        "belong","share","keep","hold","let",
        "go","stay","come","leave","return",
        "arrive","depart","travel","move","stay",
        "still","moving","dynamic","static","constant",
        "changing","evolving","growing","shrinking","expanding",
        "contracting","rising","falling","up","down",
        "left","right","forward","backward","sideways",
        "direction","path","way","route","road",
        "street","highway","freeway","lane","alley",
        "corner","edge","side","center","middle",
        "top","bottom","front","back","inside",
        "outside","within","without","beyond","between",
        "among","through","across","over","under",
        "above","below","high","low","deep",
        "shallow","wide","narrow","broad","thin",
        "thick","fat","skinny","large","small",
        "big","little","huge","tiny","giant",
        "dwarf","micro","macro","mega","giga",
        "tera","peta","exa","zetta","yotta",
        "scale","magnitude","size","dimension","measurement",
        "quantity","quality","value","worth","price",
        "cost","expense","budget","finance","money",
        "wealth","rich","poor","income","salary",
        "wage","pay","earn","spend","save",
        "invest","profit","loss","gain","return",
        "interest","rate","percentage","fraction","decimal",
        "number","count","amount","sum","total",
        "average","mean","median","mode","range",
        "statistics","data","information","knowledge","wisdom",
        "intelligence","smart","clever","bright","sharp",
        "dull","dim","dark","light","bright",
        "color","hue","shade","tone","tint",
        "red","orange","yellow","green","blue",
        "indigo","violet","purple","pink","brown",
        "black","white","gray","grey","silver",
        "gold","metallic","shiny","dull","matte",
        "glossy","reflective","transparent","opaque","clear",
        "cloudy","foggy","misty","hazy","blurry",
        "sharp","crisp","clear","vivid","bright",
        "beautiful","ugly","pretty","handsome","attractive",
        "gorgeous","stunning","amazing","wonderful","awesome",
        "terrible","horrible","awful","bad","good",
        "great","excellent","fantastic","superb","outstanding",
        "mediocre","average","ordinary","normal","typical",
        "unusual","strange","weird","odd","bizarre",
        "crazy","insane","mad","sane","rational",
        "logical","illogical","reasonable","unreasonable","fair",
        "unfair","just","unjust","right","wrong",
        "true","false","fact","fiction","lie",
        "truth","honesty","dishonesty","trust","distrust",
        "believe","doubt","faith","skepticism","certainty",
        "uncertainty","probability","possibility","impossibility",
        "chance","luck","fortune","destiny","fate",
        "choice","decision","option","alternative","possibility",
        "freedom","liberty","constraint","restriction","limit",
        "boundary","border","edge","margin","perimeter",
        "center","core","heart","soul","essence",
        "spirit","mind","body","physical","mental",
        "emotional","spiritual","psychological","biological","social",
        "cultural","political","economic","historical","geographical",
        "environmental","ecological","global","local","personal",
        "private","public","secret","open","closed",
        "hidden","revealed","known","unknown","mysterious",
        "puzzle","riddle","enigma","paradox","contradiction",
        "conflict","dispute","argument","debate","discussion",
        "agreement","disagreement","consensus","compromise","settlement",
        "resolution","solution","answer","result","outcome",
        "consequence","effect","cause","reason","purpose",
        "meaning","significance","importance","value","worth",
        "price","cost","expense","investment","return",
        "profit","loss","gain","benefit","advantage",
        "disadvantage","pro","con","positive","negative","neutral",
        "objective","subjective","biased","unbiased","fair",
        "balanced","equal","unequal","same","different",
        "similar","alike","distinct","unique","original",
        "copy","replica","duplicate","clone","imitation",
        "fake","real","authentic","genuine","legitimate",
        "illegal","legal","lawful","unlawful","criminal",
        "innocent","guilty","justice","injustice","fairness",
        "equality","inequality","equity","fairness","justice",
        "rights","freedom","liberty","democracy","dictatorship",
        "monarchy","republic","government","politics","power",
        "authority","control","influence","impact","effect",
        "change","transformation","evolution","revolution","progress",
        "development","growth","improvement","decline","decay",
        "rise","fall","success","failure","victory",
        "defeat","win","lose","draw","tie",
        "competition","contest","game","sport","match",
        "player","team","coach","fan","audience",
        "spectator","viewer","listener","reader","consumer",
        "creator","maker","artist","writer","musician",
        "performer","actor","actress","celebrity","star",
        "icon","legend","hero","villain","character",
        "personality","identity","self","ego","soul",
        "spirit","ghost","angel","demon","god",
        "divine","holy","sacred","profane","secular",
        "religious","spiritual","atheist","agnostic","believer",
        "faith","hope","love","charity","kindness",
        "compassion","empathy","sympathy","pity","mercy",
        "forgiveness","redemption","salvation","damnation","hell",
        "heaven","paradise","utopia","dystopia","apocalypse",
        "end","beginning","start","finish","complete",
        "done","over","finished","through","with",
        "without","within","inside","outside","beyond",
      ];
      try {
        const res = await fetch('https://dummyjson.com/comments/random');
        const data = await res.json();
        return data.body || fallbacks[Math.floor(Math.random()*fallbacks.length)];
      } catch {
        return fallbacks[Math.floor(Math.random()*fallbacks.length)];
      }
    };

    // ── TOAST ─────────────────────────────────────────────────────────────
    const showToast = (msg, color='var(--br)', icon='') => {
      const t = document.createElement('div');
      t.className = 'dcs-toast';
      t.style.borderLeft = `4px solid ${color}`;
      t.innerHTML = `${icon ? `<span style="font-size:20px;">${icon}</span>` : ''}
        <span style="font-size:14px;color:var(--hp);">${msg}</span>
        <span style="margin-left:auto;cursor:pointer;color:var(--txm);font-size:18px;" onclick="this.parentElement.remove()">×</span>`;
      document.body.appendChild(t);
      setTimeout(() => { t.style.animation='dcToastIn .3s ease reverse'; setTimeout(()=>t.remove(),300); }, 3500);
    };

    // ── FAKE WEBSOCKET EVENTS ─────────────────────────────────────────────
    const wsEvents = [];
    const fakeWS = {
      emit(event, data) {
        wsEvents.push({ event, data, ts: Date.now() });
        if (wsEvents.length > 100) wsEvents.shift();
      },
      on(event, cb) {
        // Simulated — callbacks fire via triggerRandomEvent
      }
    };

    // ── RANDOM BACKGROUND EVENTS ──────────────────────────────────────────
    const randomEventMessages = [
      (u) => `anyone else's internet been trash lately`,
      (u) => `just pushed a new commit 🔥`,
      (u) => `good morning everyone`,
      (u) => `this new update is actually insane`,
      (u) => `who's online rn`,
      (u) => `bro I've been coding for 6 hours straight`,
      (u) => `just got a new PB on the game 🎮`,
      (u) => `anyone wanna vc?`,
      (u) => `the new season just dropped let's gooo`,
      (u) => `I forgor 💀`,
      (u) => `okay I need help with this bug`,
      (u) => `just ate and I'm ready to grind`,
      (u) => `this is the best server ngl`,
      (u) => `y'all see that new meme going around`,
      (u) => `I'm so cooked for this deadline`,
    ];

    let bgEventInterval = null;
    const startBackgroundEvents = () => {
      bgEventInterval = setInterval(async () => {
        if (Math.random() < 0.3) {
          const sv = getServer();
          if (!sv) return;
          const allChs = getAllChannels(sv).filter(c => c.type === 'text');
          if (!allChs.length) return;
          const ch = allChs[Math.floor(Math.random()*allChs.length)];
          const user = fakeUsers[Math.floor(Math.random()*fakeUsers.length)];
          const msgFn = randomEventMessages[Math.floor(Math.random()*randomEventMessages.length)];
          const text = msgFn(user.name);
          addMessage(ch.id, user.name, text, user.av);
          fakeWS.emit('MESSAGE_CREATE', { channel: ch.id, author: user.name, text });
          // Show typing first
          showTyping(ch.id, user.name);
          if (ch.id === state.activeChannel) {
            setTimeout(() => render(), 100);
          }
        }
        // Random status changes
        if (Math.random() < 0.1) {
          const statuses = ['online','idle','dnd','offline'];
          const user = fakeUsers[Math.floor(Math.random()*fakeUsers.length)];
          user.status = statuses[Math.floor(Math.random()*statuses.length)];
          fakeWS.emit('PRESENCE_UPDATE', { user: user.name, status: user.status });
        }
        // Random friend request
        if (Math.random() < 0.05) {
          const names = ['Kai','Luna','Nyx','Orion','Pixel','Raven','Storm','Vex'];
          const name = names[Math.floor(Math.random()*names.length)];
          if (!state.friends.includes(name) && !state.friendReqs.includes(name)) {
            state.friendReqs.push(name);
            showToast(`👋 ${name} sent you a friend request!`, 'var(--br)');
            fakeWS.emit('FRIEND_REQUEST', { from: name });
            save();
          }
        }
      }, 8000 + Math.random()*7000);
    };

    const typingTimers = {};
    const showTyping = (chId, user) => {
      if (!state.typingUsers[chId]) state.typingUsers[chId] = new Set();
      state.typingUsers[chId].add(user);
      clearTimeout(typingTimers[`${chId}_${user}`]);
      typingTimers[`${chId}_${user}`] = setTimeout(() => {
        state.typingUsers[chId]?.delete(user);
        if (chId === state.activeChannel) {
          const typingEl = qs('.dcs-typing');
          if (typingEl) typingEl.innerHTML = renderTyping();
        }
      }, 3000);
      if (chId === state.activeChannel) {
        const typingEl = qs('.dcs-typing');
        if (typingEl) typingEl.innerHTML = renderTyping();
      }
    };

    const renderTyping = () => {
      const users = [...(state.typingUsers[state.activeChannel] || [])];
      if (!users.length) return '';
      const names = users.slice(0,3).join(', ');
      const verb = users.length === 1 ? 'is' : 'are';
      return `<div class="dcs-tdots"><div class="dcs-tdot"></div><div class="dcs-tdot"></div><div class="dcs-tdot"></div></div>
        <span><strong style="color:var(--hp)">${names}</strong> ${verb} typing...</span>`;
    };

    const triggerBotReply = (chId) => {
      if (Math.random() < 0.35) return;
      const sv = getServer();
      let botName, botAv;
      if (state.view === 'dm' || state.view === 'gdm') {
        const dm = getDM();
        botName = dm?.name; botAv = dm?.avatar;
      } else {
        const others = sv?.members.filter(m => m !== state.profile.username) || [];
        const pick = others[Math.floor(Math.random()*others.length)];
        const fu = fakeUsers.find(u => u.name === pick);
        botName = pick; botAv = fu?.av || pick?.[0] || '?';
      }
      if (!botName) return;
      showTyping(chId, botName);
      setTimeout(async () => {
        const text = await fetchAIResponse();
        addMessage(chId, botName, text, botAv);
        // Simulate read receipt
        const msgs = getMsgs(chId);
        if (msgs.length) msgs[msgs.length-1].readBy = [state.profile.username, botName];
        render();
      }, 1200 + Math.random()*2500);
    };

    // ── AUTO-GENERATE COMMUNITY ───────────────────────────────────────────
    const generateCommunity = (template) => {
      const id = 'sv_'+Date.now();
      const newSv = {
        id, name: template.name, icon: template.icon,
        color: '#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'),
        banner: `linear-gradient(135deg,#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')},#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')})`,
        boosts: Math.floor(Math.random()*15), boostLevel: Math.floor(Math.random()*3),
        categories:[
          { id:'cat_'+Date.now(), name:'General', channels:[
            { id:'ch_'+Date.now(),   name:'general',    type:'text', topic:template.desc },
            { id:'ch_'+(Date.now()+1), name:'introductions', type:'text', topic:'Introduce yourself!' },
          ]},
          { id:'cat_'+(Date.now()+2), name:'Voice', channels:[
            { id:'vc_'+Date.now(), name:'Lounge', type:'voice', users:[] },
          ]},
        ],
        roles:{ [state.profile.username]:'owner' },
        members:[state.profile.username, ...fakeUsers.slice(0,Math.floor(Math.random()*4)+2).map(u=>u.name)],
        pinnedMessages:{}, modLog:[],
        memberCount: template.members,
      };
      state.servers.push(newSv);
      state.activeServer = id;
      state.view = 'server';
      state.activeChannel = newSv.categories[0].channels[0].id;
      // Seed some messages
      const ch = newSv.categories[0].channels[0].id;
      fakeUsers.slice(0,3).forEach(u => {
        addMessage(ch, u.name, randomEventMessages[Math.floor(Math.random()*randomEventMessages.length)](u.name), u.av);
      });
      save();
      render();
      showToast(`🎉 Joined ${template.name}!`, 'var(--ok)');
    };

    // ── RENDER ────────────────────────────────────────────────────────────
    const render = () => {
      const sv = getServer();
      const ch = getChannel();
      const dm = getDM();
      const msgs = getMsgs(state.activeChannel);
      const channelName = state.view === 'server' ? ch?.name
                        : state.view === 'friends' ? 'Friends'
                        : dm?.name || 'Unknown';
      const totalUnread = Object.values(state.unread).reduce((a,b)=>a+b,0);

      let lastAuthor = null, lastDate = null;

      const renderServers = () => `
        <div class="dcs-svwrap ${state.view==='friends'?'active':''}" data-action="friends" title="Direct Messages">
          <div class="dcs-pill"></div>
          <div class="dcs-svicon" style="font-size:22px;">${I.dm}</div>
          ${totalUnread > 0 ? `<div class="dcs-svbadge">${totalUnread}</div>` : ''}
        </div>
        <div style="width:32px;height:2px;background:var(--bg-a);margin:4px 0;border-radius:1px;"></div>
        ${state.servers.map(s => {
          const svUnread = getAllChannels(s).reduce((a,c)=>(a+(state.unread[c.id]||0)),0);
          return `<div class="dcs-svwrap ${s.id===state.activeServer&&state.view==='server'?'active':''}" data-svid="${s.id}" title="${s.name}">
            <div class="dcs-pill"></div>
            <div class="dcs-svicon">${s.icon}</div>
            ${svUnread>0?`<div class="dcs-svbadge">${svUnread}</div>`:''}
          </div>`;
        }).join('')}
        <div class="dcs-svwrap" data-action="add-server" title="Add a Server">
          <div class="dcs-svicon" style="color:var(--ok);font-size:26px;font-weight:300;">+</div>
        </div>
        <div class="dcs-svwrap" data-action="explore" title="Explore Communities">
          <div class="dcs-svicon" style="color:var(--ok);font-size:20px;">🧭</div>
        </div>`;

      const renderProfileBar = () => `
        <section class="dcs-profile">
          <div style="position:relative;cursor:pointer;" data-action="self-profile">
            <div class="dcs-av" style="background:var(--br);">${state.profile.avatar}</div>
            <div class="dcs-dot" style="background:${SC[state.profile.status]};"></div>
          </div>
          <div class="dcs-uinfo" data-action="self-profile">
            <div class="dcs-uname">${state.profile.username}
              ${state.profile.nitro ? '<span class="dcs-nitrobadge">NITRO</span>' : ''}
            </div>
            <div class="dcs-utag">${state.profile.customStatus || '#'+state.profile.tag}</div>
          </div>
          <div style="display:flex;gap:2px;">
            <div class="dcs-ibtn ${state.callMuted?'active':''}" data-action="toggle-mute" title="${state.callMuted?'Unmute':'Mute'}">
              ${state.callMuted ? I.micoff : I.mic}
            </div>
            <div class="dcs-ibtn" data-action="open-settings" title="User Settings">${I.settings}</div>
          </div>
        </section>`;

      const renderVoiceBar = () => `
        <div class="dcs-voicebar">
          <div class="dcs-voicestatus">🔊 Voice Connected</div>
          <div style="font-size:12px;color:var(--txm);margin-bottom:6px;">
            ${getAllChannels(sv||{categories:[]}).find(c=>c.id===state.callChannel)?.name || 'Voice Channel'}
          </div>
          <div class="dcs-voiceacts">
            <button class="dcbtn dcbtn-s" style="font-size:12px;padding:4px 8px;" data-action="toggle-mute">
              ${state.callMuted?'🔇 Muted':'🎤 Mute'}
            </button>
            <button class="dcbtn dcbtn-s" style="font-size:12px;padding:4px 8px;" data-action="toggle-deafen">
              ${state.callDeafened?'🔕 Deaf':'🔊 Deafen'}
            </button>
            <button class="dcbtn dcbtn-d" style="font-size:12px;padding:4px 8px;" data-action="leave-call">
              ✕ Disconnect
            </button>
          </div>
        </div>`;

      const renderSidebar = () => {
        if (state.view === 'friends') return renderFriendsSidebar();
        if (state.view === 'dm' || state.view === 'gdm') return renderDMSidebar();
        return renderServerSidebar();
      };

      const renderServerSidebar = () => {
        if (!sv) return '';
        const allChs = getAllChannels(sv);
        return `
          <header class="dcs-svheader" data-action="server-settings">
            <span>${sv.name}</span>
            <span style="font-size:18px;">✓</span>
          </header>
          <div class="dcs-channels">
            ${sv.categories.map(cat => {
              const collapsed = state.collapsedCats[cat.id];
              return `
                <div class="dcs-cat" data-catid="${cat.id}">
                  <span style="font-size:10px;transition:transform .2s;${collapsed?'':'transform:rotate(0deg)'}">${collapsed?'▶':'▼'}</span>
                  ${cat.name}
                  <span class="dcs-ch-act" data-action="add-channel" data-catid="${cat.id}" style="margin-left:auto;" title="Add Channel">+</span>
                </div>
                ${collapsed ? '' : cat.channels.map(c => {
                  const unread = state.unread[c.id] || 0;
                  const isVoice = c.type === 'voice';
                  const inVC = state.inCall && state.callChannel === c.id;
                  return `
                    <div class="dcs-ch ${c.id===state.activeChannel?'active':''}" data-chid="${c.id}" data-chtype="${c.type}">
                      <span style="opacity:.6;flex-shrink:0;">${isVoice ? I.voice : I.hash}</span>
                      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.name}</span>
                      ${inVC ? '<span style="color:var(--ok);font-size:10px;">● LIVE</span>' : ''}
                      ${unread>0&&!isVoice ? `<span class="dcs-ch-badge">${unread}</span>` : ''}
                      <div class="dcs-ch-acts">
                        ${isVoice ? '' : `<span class="dcs-ch-act" data-action="pin-ch" data-chid="${c.id}" title="Pinned">${I.pin}</span>`}
                        <span class="dcs-ch-act" data-action="invite" title="Invite">${I.invite}</span>
                      </div>
                    </div>
                    ${isVoice && c.users && c.users.length ? c.users.map(u=>`
                      <div class="dcs-voiceuser ${Math.random()>.5?'speaking':''}">
                        <span style="font-size:14px;">${fakeUsers.find(f=>f.name===u)?.av||u[0]}</span>
                        <span>${u}</span>
                      </div>`).join('') : ''}`;
                }).join('')}`;
            }).join('')}
          </div>
          ${state.inCall ? renderVoiceBar() : ''}
          ${renderProfileBar()}`;
      };

      const renderDMSidebar = () => `
        <header class="dcs-svheader">
          <span>Direct Messages</span>
        </header>
        <div class="dcs-channels">
          <div style="padding:8px 8px 4px;">
            <input class="dcs-searchinput" style="border-radius:4px;font-size:13px;padding:6px 10px;"
              placeholder="Find or start a conversation" />
          </div>
          <div class="dcs-cat">DIRECT MESSAGES</div>
          ${state.dms.map(dm => `
            <div class="dcs-ch ${state.activeChannel===dm.id&&state.view==='dm'?'active':''}" data-dmid="${dm.id}">
              <div style="position:relative;flex-shrink:0;">
                <div style="width:32px;height:32px;border-radius:50%;background:var(--br);
                  display:flex;align-items:center;justify-content:center;font-size:18px;">${dm.avatar}</div>
                <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;
                  border-radius:50%;background:${SC[dm.status]||SC.offline};border:2px solid var(--bg-s);"></div>
              </div>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${dm.name}</span>
              ${state.unread[dm.id]?`<span class="dcs-ch-badge">${state.unread[dm.id]}</span>`:''}
            </div>`).join('')}
          <div class="dcs-cat">GROUP DMS</div>
          ${state.groupDMs.map(g => `
            <div class="dcs-ch ${state.activeChannel===g.id&&state.view==='gdm'?'active':''}" data-gdmid="${g.id}">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--bg-t);
                display:flex;align-items:center;justify-content:center;font-size:18px;">${g.avatar}</div>
              <span style="flex:1;">${g.name}</span>
              <span style="font-size:11px;color:var(--txm);">${g.members.length}</span>
            </div>`).join('')}
        </div>
        ${renderProfileBar()}`;

      const renderFriendsSidebar = () => `
        <header class="dcs-svheader">
          <span>Friends</span>
        </header>
        <div class="dcs-channels">
          <div style="padding:8px;">
            <button class="dcbtn dcbtn-p" style="width:100%;font-size:13px;" data-action="add-friend">Add Friend</button>
          </div>
          <div class="dcs-cat">ONLINE — ${state.friends.filter(f=>fakeUsers.find(u=>u.name===f&&u.status==='online')).length}</div>
          ${state.friends.map(f => {
            const fu = fakeUsers.find(u=>u.name===f) || { av:f[0], status:'offline', color:'#5865f2' };
            return `<div class="dcs-ch" data-dmopen="${f}">
              <div style="position:relative;flex-shrink:0;">
                <div style="width:32px;height:32px;border-radius:50%;background:${fu.color};
                  display:flex;align-items:center;justify-content:center;font-size:18px;">${fu.av}</div>
                <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;
                  border-radius:50%;background:${SC[fu.status]||SC.offline};border:2px solid var(--bg-s);"></div>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:500;color:var(--hp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f}</div>
                <div style="font-size:12px;color:var(--txm);">${fu.status}</div>
              </div>
            </div>`;
          }).join('')}
          ${state.friendReqs.length ? `
            <div class="dcs-cat">PENDING — ${state.friendReqs.length}</div>
            ${state.friendReqs.map(f=>`
              <div class="dcs-ch" style="justify-content:space-between;">
                <span style="font-size:18px;">👤</span>
                <span style="flex:1;margin-left:8px;">${f}</span>
                <span data-action="accept-friend" data-name="${f}" style="color:var(--ok);cursor:pointer;font-size:18px;margin-right:4px;">✓</span>
                <span data-action="decline-friend" data-name="${f}" style="color:var(--dng);cursor:pointer;font-size:18px;">✗</span>
              </div>`).join('')}` : ''}
        </div>
        ${renderProfileBar()}`;

      const renderVoiceChannel = () => `
        <header class="dcs-chatheader">
          <span style="color:var(--txm);">${I.voice}</span>
          <span class="dcs-chtitle">${ch?.name}</span>
          <div class="dcs-hacts">
            <button class="dcbtn dcbtn-p" style="font-size:13px;" data-action="join-vc" data-chid="${ch?.id}">
              Join Voice Channel
            </button>
          </div>
        </header>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:var(--txm);">
          <div style="font-size:64px;">🔊</div>
          <div style="font-size:20px;font-weight:600;color:var(--hp);">${ch?.name}</div>
          <div style="font-size:14px;">No one is here yet</div>
          <button class="dcbtn dcbtn-p" data-action="join-vc" data-chid="${ch?.id}">Join Voice Channel</button>
        </div>`;

      const renderFriendsView = () => `
        <header class="dcs-chatheader">
          <span style="font-size:20px;">👥</span>
          <span class="dcs-chtitle">Friends</span>
          <div style="display:flex;gap:8px;margin-left:16px;">
            ${['online','all','pending','blocked'].map(t=>`
              <div class="dcs-friendstab ${state.friendsTab===t?'active':''}" data-friendstab="${t}">
                ${t.charAt(0).toUpperCase()+t.slice(1)}
                ${t==='pending'&&state.friendReqs.length?`<span style="background:var(--dng);color:#fff;font-size:10px;padding:1px 5px;border-radius:8px;margin-left:4px;">${state.friendReqs.length}</span>`:''}
              </div>`).join('')}
          </div>
          <div class="dcs-hacts">
            <button class="dcbtn dcbtn-p" style="font-size:13px;" data-action="add-friend">Add Friend</button>
          </div>
        </header>
        <div style="flex:1;overflow-y:auto;padding:16px;">
          ${state.friendsTab === 'pending' ? `
            <div style="margin-bottom:16px;">
              <div style="font-size:12px;font-weight:700;color:var(--txm);text-transform:uppercase;margin-bottom:8px;">Incoming — ${state.friendReqs.length}</div>
              ${state.friendReqs.map(f => `
                <div class="dcs-friendrow">
                  <div style="width:40px;height:40px;border-radius:50%;background:var(--br);display:flex;align-items:center;justify-content:center;font-size:22px;">👤</div>
                  <div style="flex:1;"><div style="font-weight:600;color:var(--hp);">${f}</div><div style="font-size:12px;color:var(--txm);">Incoming Friend Request</div></div>
                  <button class="dcbtn dcbtn-p" style="font-size:12px;padding:4px 12px;margin-right:8px;" data-action="accept-friend" data-name="${f}">Accept</button>
                  <button class="dcbtn dcbtn-s" style="font-size:12px;padding:4px 12px;" data-action="decline-friend" data-name="${f}">Ignore</button>
                </div>`).join('')}
            </div>` : ''}
          ${state.friendsTab === 'blocked' ? `
            <div style="font-size:12px;font-weight:700;color:var(--txm);text-transform:uppercase;margin-bottom:8px;">Blocked — ${state.blocked.length}</div>
            ${state.blocked.length ? state.blocked.map(f=>`
              <div class="dcs-friendrow">
                <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-t);display:flex;align-items:center;justify-content:center;font-size:22px;filter:grayscale(1);">👤</div>
                <div style="flex:1;"><div style="font-weight:600;color:var(--hp);">${f}</div></div>
                <button class="dcbtn dcbtn-s" style="font-size:12px;padding:4px 12px;" data-action="unblock" data-name="${f}">Unblock</button>
              </div>`).join('') : `<div style="text-align:center;color:var(--txm);padding:40px;">No blocked users</div>`}` : ''}
          ${(state.friendsTab === 'online' || state.friendsTab === 'all') ? `
            <div style="font-size:12px;font-weight:700;color:var(--txm);text-transform:uppercase;margin-bottom:8px;">${state.friendsTab === 'online' ? 'Online' : 'All Friends'} — ${state.friends.length}</div>
            ${state.friends.filter(f => state.friendsTab === 'all' || fakeUsers.find(u=>u.name===f&&u.status==='online')).map(f => {
              const fu = fakeUsers.find(u=>u.name===f) || { av:f[0], status:'offline', color:'#5865f2' };
              const dm = state.dms.find(d=>d.name===f);
              return `<div class="dcs-friendrow" data-dmopen="${f}">
                <div style="position:relative;">
                  <div style="width:40px;height:40px;border-radius:50%;background:${fu.color};display:flex;align-items:center;justify-content:center;font-size:22px;">${fu.av}</div>
                  <div style="position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;background:${SC[fu.status]||SC.offline};border:2px solid var(--bg-p);"></div>
                </div>
                <div style="flex:1;">
                  <div style="font-weight:600;color:var(--hp);">${f}</div>
                  <div style="font-size:12px;color:var(--txm);">${fu.status}${dm?.presence ? ` • Playing ${dm.presence.game}` : ''}</div>
                </div>
                <div style="display:flex;gap:8px;">
                  <div class="dcs-ibtn" data-dmopen="${f}" title="Message" style="background:var(--bg-t);">💬</div>
                  <div class="dcs-ibtn" data-action="call-friend" data-name="${f}" title="Call" style="background:var(--bg-t);">📞</div>
                  <div class="dcs-ibtn" data-action="friend-ctx" data-name="${f}" title="More" style="background:var(--bg-t);">⋯</div>
                </div>
              </div>`;
            }).join('')}` : ''}
        </div>`;

      const renderWelcomeBanner = () => {
        if (msgs.length > 0) return '';
        return `<div class="dcs-welcome">
          <div class="dcs-welcome-icon">${state.view === 'server' ? '#' : (getDM()?.avatar || '💬')}</div>
          <div style="font-size:28px;font-weight:700;color:var(--hp);margin-bottom:8px;">
            ${state.view === 'server' ? `Welcome to #${ch?.name}!` : `This is the beginning of your direct message history with ${channelName}`}
          </div>
          <div style="font-size:16px;color:var(--txm);">${state.view === 'server' ? (ch?.topic || 'This is the start of the channel.') : `@${channelName}`}</div>
        </div>`;
      };

      const renderSearchPanel = () => `
        <div class="dcs-searchpanel" id="dc-search-${id}">
          <input class="dcs-searchinput" id="dc-searchinput-${id}" placeholder="Search messages..." autocomplete="off" />
          <div id="dc-searchresults-${id}"><div style="padding:12px 16px;font-size:13px;color:var(--txm);">Type to search messages in this channel</div></div>
        </div>`;

      const renderPinnedPanel = () => {
        const pinned = msgs.filter(m => m.pinned);
        return `<div class="dcs-pinnedpanel" id="dc-pinned-${id}">
          <div style="padding:12px 16px;font-weight:600;color:var(--hp);border-bottom:1px solid var(--dv);display:flex;align-items:center;gap:8px;">
            📌 Pinned Messages
            <span style="margin-left:auto;cursor:pointer;color:var(--txm);" data-action="toggle-pinned">✕</span>
          </div>
          ${pinned.length ? pinned.map(m=>`
            <div class="dcs-pinnedmsg" data-msgid="${m.id}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <div style="width:20px;height:20px;border-radius:50%;background:var(--br);display:flex;align-items:center;justify-content:center;font-size:12px;">${m.avatar||m.author[0]}</div>
                <span style="font-weight:600;color:var(--hp);font-size:13px;">${m.author}</span>
                <span style="font-size:11px;color:var(--txm);">${m.ts}</span>
              </div>
              <div style="font-size:13px;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.text}</div>
            </div>`).join('') : `<div style="padding:24px;text-align:center;color:var(--txm);"><div style="font-size:32px;margin-bottom:8px;">📌</div><div>No pinned messages yet</div></div>`}
        </div>`;
      };

      const renderInput = () => {
        const canSend = hasPermission('send');
        return `<div class="dcs-inputarea">
          <div class="dcs-inputwrap">
            <div class="dcs-attachbtn" data-action="attach" title="Attach File">+</div>
            ${canSend ? `<textarea class="dcs-input" id="dc-input-${id}" rows="1" placeholder="Message ${state.view==='server'?'#':'@'}${channelName}" autocomplete="off"></textarea>` : `<div style="flex:1;padding:12px 0;color:var(--txm);font-size:14px;">You don't have permission to send messages here.</div>`}
            <div class="dcs-inputicon" data-action="open-gif" title="GIF">GIF</div>
            <div class="dcs-inputicon" data-action="open-sticker" title="Stickers">🎭</div>
            <div class="dcs-inputicon" data-action="open-emoji" title="Emoji">😀</div>
          </div>
        </div>`;
      };

      const renderMembers = () => {
        if (!state.membersOpen || state.view !== 'server') return '';
        if (!sv) return '';
        const online  = sv.members.filter(m => fakeUsers.find(u=>u.name===m&&u.status==='online') || m===state.profile.username);
        const offline = sv.members.filter(m => !online.includes(m));
        const renderMember = (name) => {
          const fu = fakeUsers.find(u=>u.name===name);
          const isMe = name === state.profile.username;
          const av = isMe ? state.profile.avatar : (fu?.av || name[0]);
          const color = getUserColor(name);
          const role = getUserRole(name);
          const status = isMe ? state.profile.status : (fu?.status || 'offline');
          return `<div class="dcs-member" data-user="${name}" data-av="${av}">
            <div style="position:relative;flex-shrink:0;">
              <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:18px;">${av}</div>
              <div style="position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;border-radius:50%;background:${SC[status]};border:2px solid var(--bg-s);"></div>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="dcs-memname" style="color:${color};">${name}${isMe?' (you)':''}</div>
              ${ROLES[role] ? `<div style="font-size:11px;color:${ROLES[role].color};">${ROLES[role].name}</div>` : ''}
            </div>
          </div>`;
        };
        return `<div class="dcs-members">
          <div class="dcs-memcat">Online — ${online.length}</div>
          ${online.map(renderMember).join('')}
          ${offline.length ? `<div class="dcs-memcat">Offline — ${offline.length}</div>${offline.map(renderMember).join('')}` : ''}
        </div>`;
      };

      const renderChat = () => {
        if (state.view === 'friends') return renderFriendsView();
        const isVoice = ch?.type === 'voice';
        if (isVoice) return renderVoiceChannel();

        return `
          <header class="dcs-chatheader">
            <span style="color:var(--txm);flex-shrink:0;">
              ${state.view === 'server' ? I.hash : '<span style="font-size:16px;">@</span>'}
            </span>
            <span class="dcs-chtitle">${channelName || ''}</span>
            ${ch?.topic ? `<span class="dcs-chtopic">${ch.topic}</span>` : ''}
            ${state.view === 'dm' ? `
              <div style="margin-left:8px;display:flex;align-items:center;gap:4px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${SC[getDM()?.status||'offline']};"></div>
                <span style="font-size:12px;color:var(--txm);">${getDM()?.status||'offline'}</span>
              </div>` : ''}
            <div class="dcs-hacts">
              ${state.view === 'server' ? `
                <div class="dcs-ibtn" data-action="start-call" title="Start Voice Call">📞</div>
                <div class="dcs-ibtn" data-action="start-stream" title="Go Live">📺</div>
                <div class="dcs-ibtn ${state.pinnedOpen?'active':''}" data-action="toggle-pinned" title="Pinned Messages">${I.pin}</div>
                <div class="dcs-ibtn ${state.membersOpen?'active':''}" data-action="toggle-members" title="Member List">${I.members}</div>` : `
                <div class="dcs-ibtn" data-action="start-call" title="Start Call">📞</div>
                <div class="dcs-ibtn" data-action="start-video" title="Video Call">📹</div>`}
              <div class="dcs-ibtn ${state.searchOpen?'active':''}" data-action="toggle-search" title="Search">${I.search}</div>
              <div class="dcs-ibtn" data-action="open-inbox" title="Inbox">${I.bell}
                ${state.notifications.length ? `<span style="position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:var(--dng);"></span>` : ''}
              </div>
            </div>
          </header>
          ${state.searchOpen ? renderSearchPanel() : ''}
          ${state.pinnedOpen ? renderPinnedPanel() : ''}
          <div class="dcs-msgs" id="dc-msgs-${id}">
            ${renderWelcomeBanner()}
            ${msgs.map((m, idx) => {
              const isConsec = lastAuthor === m.author;
              lastAuthor = m.author;
              const isOwn = m.author === state.profile.username;
              const roleKey = getUserRole(m.author);
              const role = ROLES[roleKey];
              const userColor = getUserColor(m.author);
              const msgReactions = state.reactions[m.id] || {};
              return `
                <div class="dcs-msg ${isConsec ? '' : 'cozy'}" data-msgid="${m.id}" data-author="${m.author}"
                  style="font-size:${state.fontSize}px;"
                  oncontextmenu="this.dispatchEvent(new CustomEvent('dc-ctx',{bubbles:true,detail:{msgId:'${m.id}',author:'${m.author}',x:event.clientX,y:event.clientY}}));event.preventDefault();">
                  ${!isConsec ? `
                    <div class="dcs-msgav" data-user="${m.author}" data-av="${m.avatar||m.author[0]}"
                      style="background:${userColor};">${m.avatar || m.author[0]}</div>` : ''}
                  <div class="dcs-msgbody">
                    ${!isConsec ? `
                      <div class="dcs-msghdr">
                        <span class="dcs-msgauthor" data-user="${m.author}" data-av="${m.avatar||m.author[0]}"
                          style="color:${userColor};">${m.author}</span>
                        ${role ? `<span class="dcs-rolebadge" style="background:${role.color}22;color:${role.color};">${role.name}</span>` : ''}
                        ${m.author === state.profile.username && state.profile.nitro ? '<span class="dcs-nitrobadge" style="font-size:9px;">NITRO</span>' : ''}
                        <span class="dcs-msgtime" title="${new Date().toLocaleDateString()}">${m.ts}</span>
                      </div>` : ''}
                    <div class="dcs-msgtxt">${markdownToHtml(m.text)}</div>
                    ${m.linkPreview || ''}
                    ${Object.keys(msgReactions).length ? `
                      <div class="dcs-reactions">
                        ${Object.entries(msgReactions).map(([emoji, users]) => `
                          <div class="dcs-reaction ${users.includes(state.profile.username)?'mine':''}"
                            data-action="toggle-reaction" data-msgid="${m.id}" data-emoji="${emoji}">
                            ${emoji} <span style="font-size:12px;color:var(--txm);">${users.length}</span>
                          </div>`).join('')}
                      </div>` : ''}
                    ${isOwn && idx === msgs.length-1 ? `
                      <div class="dcs-readreceipt">
                        ${m.readBy && m.readBy.length > 1 ? `✓✓ Read by ${m.readBy.filter(u=>u!==state.profile.username).join(', ')}` : '✓ Sent'}
                      </div>` : ''}
                  </div>
                  <div class="dcs-msgacts">
                    <div class="dcs-actbtn" data-action="react" data-msgid="${m.id}" title="Add Reaction">😀</div>
                    <div class="dcs-actbtn" data-action="reply" data-msgid="${m.id}" data-author="${m.author}" title="Reply">↩</div>
                    <div class="dcs-actbtn" data-action="pin-msg" data-msgid="${m.id}" title="${m.pinned?'Unpin':'Pin'}">📌</div>
                    ${isOwn ? `<div class="dcs-actbtn" data-action="delete-msg" data-msgid="${m.id}" title="Delete" style="color:var(--dng);">🗑</div>` : ''}
                    <div class="dcs-actbtn" data-action="msg-ctx" data-msgid="${m.id}" data-author="${m.author}" title="More">⋯</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <div class="dcs-typing" id="dc-typing-${id}">${renderTyping()}</div>
          ${renderInput()}`;
      };

      // ── ASSEMBLE LAYOUT ──────────────────────────────────────────────
      content.innerHTML = `
        <div class="dc${id}">
          <nav class="dcs-servers">${renderServers()}</nav>
          <aside class="dcs-sidebar">${renderSidebar()}</aside>
          <main class="dcs-chat">${renderChat()}</main>
          ${renderMembers()}
        </div>`;

      // Scroll to bottom
      const msgsEl = getEl(`dc-msgs-${id}`);
      if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

      // Clear unread for active channel
      if (state.unread[state.activeChannel]) {
        delete state.unread[state.activeChannel];
        save();
      }

      bindEvents();
    }; // end render()

    // ── BIND EVENTS ───────────────────────────────────────────────────────
    const bindEvents = () => {

      // ── Data-action dispatcher ──
      content.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (el) handleAction(el.dataset.action, el, e);
      });

      // ── Server navigation ──
      content.querySelectorAll('[data-svid]').forEach(el => {
        el.addEventListener('click', () => {
          state.activeServer = el.dataset.svid;
          state.view = 'server';
          const sv = state.servers.find(s=>s.id===state.activeServer);
          state.activeChannel = getAllChannels(sv)[0]?.id || '';
          render();
        });
      });

      // ── Channel navigation ──
      content.querySelectorAll('[data-chid]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const chtype = el.dataset.chtype;
          state.activeChannel = el.dataset.chid;
          if (chtype === 'voice') {
            state.view = 'server';
            render();
          } else {
            state.view = 'server';
            render();
          }
        });
      });

      // ── DM navigation ──
      content.querySelectorAll('[data-dmid]').forEach(el => {
        el.addEventListener('click', () => {
          state.activeChannel = el.dataset.dmid;
          state.view = 'dm';
          render();
        });
      });

      // ── Group DM navigation ──
      content.querySelectorAll('[data-gdmid]').forEach(el => {
        el.addEventListener('click', () => {
          state.activeChannel = el.dataset.gdmid;
          state.view = 'gdm';
          render();
        });
      });

      // ── Open DM from friend ──
      content.querySelectorAll('[data-dmopen]').forEach(el => {
        el.addEventListener('click', () => {
          const name = el.dataset.dmopen;
          let dm = state.dms.find(d=>d.name===name);
          if (!dm) {
            const fu = fakeUsers.find(u=>u.name===name);
            dm = { id:'dm_'+Date.now(), name, avatar:fu?.av||name[0], status:fu?.status||'offline', bio:'', banner:'#5865F2', messages:[], presence:null };
            state.dms.push(dm);
          }
          state.activeChannel = dm.id;
          state.view = 'dm';
          render();
        });
      });

      // ── Category collapse ──
      content.querySelectorAll('[data-catid]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-action]')) return;
          const catId = el.dataset.catid;
          state.collapsedCats[catId] = !state.collapsedCats[catId];
          render();
        });
      });

      // ── Friends tabs ──
      content.querySelectorAll('[data-friendstab]').forEach(el => {
        el.addEventListener('click', () => {
          state.friendsTab = el.dataset.friendstab;
          render();
        });
      });

      // ── Message input ──
      const input = getEl(`dc-input-${id}`);
      if (input) {
        // Auto-resize textarea
        input.addEventListener('input', () => {
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 200) + 'px';
          // Typing indicator
          showTyping(state.activeChannel, state.profile.username);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            if (!hasPermission('send')) { showToast('You lack permission to send messages.', 'var(--dng)'); return; }
            addMessage(state.activeChannel, state.profile.username, text, state.profile.avatar);
            input.value = '';
            input.style.height = 'auto';
            render();
            triggerBotReply(state.activeChannel);
          }
        });
        input.focus();
      }

      // ── Search ──
      const searchInput = getEl(`dc-searchinput-${id}`);
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.toLowerCase().trim();
          const resultsEl = getEl(`dc-searchresults-${id}`);
          if (!resultsEl) return;
          if (!q) { resultsEl.innerHTML = '<div style="padding:12px 16px;font-size:13px;color:var(--txm);">Type to search...</div>'; return; }
          const msgs = getMsgs(state.activeChannel);
          const results = msgs.filter(m => m.text.toLowerCase().includes(q)).slice(-20).reverse();
          resultsEl.innerHTML = results.length
            ? results.map(m=>`
                <div class="dcs-searchresult" data-msgid="${m.id}">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span style="font-weight:600;color:var(--hp);font-size:13px;">${m.author}</span>
                    <span style="font-size:11px;color:var(--txm);">${m.ts}</span>
                  </div>
                  <div style="font-size:13px;color:var(--tx);">${m.text.substring(0,100)}</div>
                </div>`).join('')
            : '<div style="padding:12px 16px;font-size:13px;color:var(--txm);">No results found</div>';
        });
      }

      // ── Context menu on messages ──
      content.addEventListener('dc-ctx', (e) => {
        const { msgId, author, x, y } = e.detail;
        showMsgContextMenu(x, y, msgId, author);
      });

      // ── User hover cards ──
      content.querySelectorAll('[data-user]').forEach(el => {
        let hoverTimer;
        el.addEventListener('mouseenter', (e) => {
          hoverTimer = setTimeout(() => {
            showHoverCard(e.clientX, e.clientY, el.dataset.user, el.dataset.av);
          }, 500);
        });
        el.addEventListener('mouseleave', () => {
          clearTimeout(hoverTimer);
          setTimeout(() => {
            const hc = document.querySelector('.dc-hovercard');
            if (hc && !hc.matches(':hover')) hc.remove();
          }, 200);
        });
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          showProfilePopout(e.clientX, e.clientY, el.dataset.user, el.dataset.av);
        });
      });

      // ── Reaction toggle ──
      content.querySelectorAll('[data-action="toggle-reaction"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const { msgid, emoji } = el.dataset;
          toggleReaction(msgid, emoji);
        });
      });

      // ── Scroll to bottom button ──
      const msgsEl = getEl(`dc-msgs-${id}`);
      if (msgsEl) {
        msgsEl.addEventListener('scroll', () => {
          const btn = qs('.dcs-scrollbtn');
          if (btn) btn.style.display = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight > 200 ? 'flex' : 'none';
        });
      }
    };

    // ── ACTION HANDLER ────────────────────────────────────────────────────
    const handleAction = (action, el, e) => {
      e.stopPropagation();
      switch (action) {
        case 'friends':
          state.view = 'friends'; render(); break;

        case 'add-server':
          showAddServerModal(); break;

        case 'explore':
          showExploreModal(); break;

        case 'server-settings':
          showServerSettingsModal(); break;

        case 'add-channel':
          showAddChannelModal(el.dataset.catid); break;

        case 'open-settings':
          showSettingsModal(); break;

        case 'self-profile':
          showProfilePopout(e.clientX, e.clientY, state.profile.username, state.profile.avatar); break;

        case 'toggle-members':
          state.membersOpen = !state.membersOpen; render(); break;

        case 'toggle-search':
          state.searchOpen = !state.searchOpen;
          state.pinnedOpen = false;
          render(); break;

        case 'toggle-pinned':
          state.pinnedOpen = !state.pinnedOpen;
          state.searchOpen = false;
          render(); break;

        case 'toggle-mute':
          state.callMuted = !state.callMuted;
          showToast(state.callMuted ? '🔇 Microphone muted' : '🎤 Microphone unmuted', 'var(--txm)');
          render(); break;

        case 'toggle-deafen':
          state.callDeafened = !state.callDeafened;
          showToast(state.callDeafened ? '🔕 Deafened' : '🔊 Undeafened', 'var(--txm)');
          render(); break;

        case 'join-vc':
          joinVoiceChannel(el.dataset.chid); break;

        case 'leave-call':
          leaveVoiceChannel(); break;

        case 'start-call':
          showCallOverlay(false); break;

        case 'start-video':
          showCallOverlay(true); break;

        case 'start-stream':
          startStream(); break;

        case 'attach':
          showAttachMenu(e.clientX, e.clientY); break;

        case 'open-emoji':
          toggleEmojiPicker('emoji'); break;

        case 'open-gif':
          toggleEmojiPicker('gif'); break;

        case 'open-sticker':
          toggleEmojiPicker('sticker'); break;

        case 'react':
          showReactionPicker(el.dataset.msgid, e.clientX, e.clientY); break;

        case 'reply':
          setReplyTarget(el.dataset.msgid, el.dataset.author); break;

        case 'pin-msg': {
          const msgs = getMsgs(state.activeChannel);
          const m = msgs.find(m => m.id == el.dataset.msgid);
          if (m) {
            m.pinned = !m.pinned;
            showToast(m.pinned ? '📌 Message pinned' : '📌 Message unpinned', 'var(--br)');
            save(); render();
          }
          break;
        }

        case 'delete-msg': {
          if (!hasPermission('manage') && getMsgs(state.activeChannel).find(m=>m.id==el.dataset.msgid)?.author !== state.profile.username) {
            showToast('You cannot delete that message.', 'var(--dng)'); break;
          }
          state.messages[state.activeChannel] = getMsgs(state.activeChannel).filter(m => m.id != el.dataset.msgid);
          const sv = getServer();
          if (sv) {
            if (!sv.modLog) sv.modLog = [];
            sv.modLog.unshift({ type:'delete', mod:state.profile.username, target:'message', ts:new Date().toLocaleTimeString() });
          }
          save(); render(); break;
        }

        case 'msg-ctx':
          showMsgContextMenu(e.clientX, e.clientY, el.dataset.msgid, el.dataset.author); break;

        case 'add-friend':
          showAddFriendModal(); break;

        case 'accept-friend': {
          const name = el.dataset.name;
          state.friendReqs = state.friendReqs.filter(f=>f!==name);
          if (!state.friends.includes(name)) state.friends.push(name);
          showToast(`✅ You are now friends with ${name}!`, 'var(--ok)');
          fakeWS.emit('FRIEND_ACCEPT', { user: name });
          save(); render(); break;
        }

        case 'decline-friend': {
          const name = el.dataset.name;
          state.friendReqs = state.friendReqs.filter(f=>f!==name);
          showToast(`Ignored friend request from ${name}`, 'var(--txm)');
          save(); render(); break;
        }

        case 'unblock': {
          const name = el.dataset.name;
          state.blocked = state.blocked.filter(b=>b!==name);
          showToast(`Unblocked ${name}`, 'var(--ok)');
          save(); render(); break;
        }

        case 'call-friend':
          showCallOverlay(false, el.dataset.name); break;

        case 'friend-ctx':
          showFriendContextMenu(e.clientX, e.clientY, el.dataset.name); break;

        case 'open-inbox':
          showInboxModal(); break;

        case 'pin-ch':
          state.pinnedOpen = true;
          state.activeChannel = el.dataset.chid;
          render(); break;

        case 'invite':
          showInviteModal(); break;

        case 'scroll-bottom': {
          const msgsEl = getEl(`dc-msgs-${id}`);
          if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
          break;
        }
      }
    };

    // ── VOICE CHANNEL ─────────────────────────────────────────────────────
    const joinVoiceChannel = (chId) => {
      state.inCall = true;
      state.callChannel = chId;
      const sv = getServer();
      const ch = getAllChannels(sv||{categories:[]}).find(c=>c.id===chId);
      if (ch) {
        if (!ch.users) ch.users = [];
        if (!ch.users.includes(state.profile.username)) ch.users.push(state.profile.username);
        // Add a fake user too
        const fu = fakeUsers[Math.floor(Math.random()*fakeUsers.length)];
        if (!ch.users.includes(fu.name)) ch.users.push(fu.name);
      }
      checkAchievements();
      state.profile.achievements = state.profile.achievements || [];
      if (!state.profile.achievements.includes('first_call')) {
        state.profile.achievements.push('first_call');
        state.profile.xp += 75;
        showToast('📞 Achievement Unlocked: Hello? (+75 XP)', 'var(--gld)');
      }
      showCallOverlay(false);
      save();
    };

    const leaveVoiceChannel = () => {
      const sv = getServer();
      const ch = getAllChannels(sv||{categories:[]}).find(c=>c.id===state.callChannel);
      if (ch && ch.users) ch.users = ch.users.filter(u=>u!==state.profile.username);
      state.inCall = false;
      state.callChannel = null;
      state.streaming = false;
      state.screenShare = false;
      // Remove call overlay
      content.querySelector('.dcs-calloverlay')?.remove();
      showToast('👋 Left voice channel', 'var(--txm)');
      save(); render();
    };

    const showCallOverlay = (video=false, targetName=null) => {
      content.querySelector('.dcs-calloverlay')?.remove();
      const sv = getServer();
      const chName = targetName
        ? `Call with ${targetName}`
        : (getAllChannels(sv||{categories:[]}).find(c=>c.id===state.callChannel)?.name || 'Voice Channel');

      const participants = targetName
        ? [{ name:state.profile.username, av:state.profile.avatar, speaking:true },
           { name:targetName, av:fakeUsers.find(u=>u.name===targetName)?.av||targetName[0], speaking:false }]
        : [
            { name:state.profile.username, av:state.profile.avatar, speaking:true },
            ...fakeUsers.slice(0,2).map(u=>({ name:u.name, av:u.av, speaking:Math.random()>.5 }))
          ];

      const overlay = document.createElement('div');
      overlay.className = 'dcs-calloverlay';
      overlay.innerHTML = `
        <div style="font-size:13px;color:var(--txm);margin-bottom:16px;letter-spacing:.5px;text-transform:uppercase;">
          🔊 ${chName}
        </div>
        <div class="dcs-callgrid">
          ${participants.map(p => `
            <div class="dcs-calltile ${p.speaking?'speaking':''}" id="calltile-${p.name}">
              ${state.screenShare && p.name===state.profile.username ? `
                <div class="dcs-screenshare">
                  <div class="dcs-screenshare-label">LIVE</div>
                  <div style="color:var(--txm);font-size:13px;">Screen Share Active</div>
                  <div style="font-size:48px;margin-top:8px;">🖥️</div>
                </div>` : `
                <div style="font-size:48px;">${p.av}</div>
                <div style="font-size:13px;color:var(--hp);margin-top:8px;font-weight:600;">${p.name}</div>
                ${p.speaking ? '<div style="font-size:11px;color:var(--ok);">● Speaking</div>' : ''}
                ${video ? '<div style="position:absolute;top:8px;right:8px;font-size:16px;">📹</div>' : ''}`}
            </div>`).join('')}
        </div>
        <div class="dcs-callcontrols">
          <div class="dcs-callbtn ${state.callMuted?'muted':'normal'}" data-action="toggle-mute" title="Mute">
            ${state.callMuted ? '🔇' : '🎤'}
          </div>
          <div class="dcs-callbtn ${state.callDeafened?'muted':'normal'}" data-action="toggle-deafen" title="Deafen">
            ${state.callDeafened ? '🔕' : '🔊'}
          </div>
          ${video ? `<div class="dcs-callbtn normal" data-action="toggle-video" title="Camera">📹</div>` : ''}
          <div class="dcs-callbtn normal" data-action="toggle-screenshare" title="Screen Share"
            style="${state.screenShare?'background:var(--ok);':''}" >🖥️</div>
          <div class="dcs-callbtn end" data-action="leave-call" title="End Call">📵</div>
        </div>`;

      content.appendChild(overlay);

      // Wire up overlay buttons
      overlay.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const a = btn.dataset.action;
          if (a === 'leave-call') { leaveVoiceChannel(); }
          else if (a === 'toggle-mute') {
            state.callMuted = !state.callMuted;
            btn.textContent = state.callMuted ? '🔇' : '🎤';
            btn.className = `dcs-callbtn ${state.callMuted?'muted':'normal'}`;
          }
          else if (a === 'toggle-deafen') {
            state.callDeafened = !state.callDeafened;
            btn.textContent = state.callDeafened ? '🔕' : '🔊';
            btn.className = `dcs-callbtn ${state.callDeafened?'muted':'normal'}`;
          }
          else if (a === 'toggle-screenshare') {
            state.screenShare = !state.screenShare;
            btn.style.background = state.screenShare ? 'var(--ok)' : '';
            const tile = overlay.querySelector(`#calltile-${state.profile.username}`);
            if (tile) {
              tile.innerHTML = state.screenShare ? `
                <div class="dcs-screenshare">
                  <div class="dcs-screenshare-label">LIVE</div>
                  <div style="color:var(--txm);font-size:13px;">Screen Share Active</div>
                  <div style="font-size:48px;margin-top:8px;">🖥️</div>
                </div>` : `
                <div style="font-size:48px;">${state.profile.avatar}</div>
                <div style="font-size:13px;color:var(--hp);margin-top:8px;font-weight:600;">${state.profile.username}</div>`;
              if (state.screenShare) {
                showToast('🖥️ Screen share started', 'var(--ok)');
                checkAchievements();
                if (!state.profile.achievements.includes('streamer')) {
                  state.profile.achievements.push('streamer');
                  state.profile.xp += 100;
                  showToast('📺 Achievement Unlocked: Going Live (+100 XP)', 'var(--gld)');
                }
              }
            }
          }
        });
      });

      // Simulate speaking animation
      if (!state.reducedMotion) {
        setInterval(() => {
          overlay.querySelectorAll('.dcs-calltile').forEach(tile => {
            if (Math.random() > 0.6) tile.classList.toggle('speaking');
          });
        }, 2000);
      }
    };

    const startStream = () => {
      state.streaming = !state.streaming;
      if (state.streaming) {
        showToast('📺 You are now live!', 'var(--dng)');
        if (!state.inCall) joinVoiceChannel(state.activeChannel);
      } else {
        showToast('📺 Stream ended', 'var(--txm)');
      }
    };

    // ── EMOJI / GIF / STICKER PICKER ──────────────────────────────────────
    const EMOJI_CATEGORIES = {
      '😀 Smileys': ['😀','😂','🤣','😊','😍','🥰','😎','🤩','😭','😤','🥺','😱','🤔','😴','🤯','🥳','😇','🤗','😏','😒'],
      '👋 People':  ['👋','🤚','✋','🖐','👌','🤌','🤏','✌️','🤞','🤟','🤘','👍','👎','👏','🙌','🤲','🙏','💪','🦾','🫶'],
      '🐱 Animals': ['🐱','🐶','🦊','🐸','🐼','🦄','🐲','🦁','🐯','🐻','🐨','🐮','🐷','🐙','🦋','🐝','🦅','🐬','🦈','🐘'],
      '🍕 Food':    ['🍕','🍔','🌮','🍜','🍣','🍩','🎂','🍦','🧁','🍫','🍿','🥤','☕','🍺','🥂','🍷','🧃','🥛','🍵','🧋'],
      '🎮 Gaming':  ['🎮','🕹️','👾','🎲','🃏','🎯','🏆','🥇','🎪','🎭','🎨','🎬','🎤','🎵','🎸','🎹','🥁','🎺','🎻','🪗'],
      '💻 Tech':    ['💻','🖥️','📱','⌨️','🖱️','🖨️','📷','📸','📹','🎥','📡','🔭','🔬','💡','🔋','💾','💿','📀','🖲️','🕹️'],
      '🌍 Travel':  ['🌍','🌎','🌏','🗺️','🧭','🏔️','🌋','🏕️','🏖️','🏜️','🌅','🌄','🌠','🎆','🎇','🌈','⛅','🌊','🌿','🍀'],
      '❤️ Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️'],
    };

    let emojiPickerOpen = false;
    const toggleEmojiPicker = (tab='emoji') => {
      const existing = qs('.dcs-emojipicker');
      if (existing) { existing.remove(); emojiPickerOpen = false; return; }
      emojiPickerOpen = true;
      state.emojiTab = tab;

      const picker = document.createElement('div');
      picker.className = 'dcs-emojipicker';

      const renderPickerContent = (activeTab, searchQ='') => {
        if (activeTab === 'gif') {
          return `
            <div class="dcs-emojigrid" style="flex-direction:column;gap:8px;">
              ${GIFS.map(g=>`
                <img src="${g}" style="width:100%;border-radius:8px;cursor:pointer;" class="dc-gif-item"
                  data-gif="${g}" alt="gif" />`).join('')}
              <div style="text-align:center;color:var(--txm);font-size:13px;padding:8px;">
                Powered by GIPHY (simulated)
              </div>
            </div>`;
        }
        if (activeTab === 'sticker') {
          return `
            <div class="dcs-emojigrid">
              ${STICKERS.map(s=>`
                <div class="dcs-emojiitem dc-sticker-item" data-sticker="${s}"
                  style="width:60px;height:60px;font-size:40px;">${s}</div>`).join('')}
            </div>`;
        }
        // Emoji tab
        const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
        const filtered = searchQ
          ? allEmojis.filter(e => e.includes(searchQ))
          : null;
        return `
          <div class="dcs-emojigrid">
            ${(filtered || allEmojis).map(e=>`
              <div class="dcs-emojiitem dc-emoji-item" data-emoji="${e}">${e}</div>`).join('')}
          </div>`;
      };

      picker.innerHTML = `
        <div class="dcs-emojitabs">
          <div class="dcs-emojitab ${tab==='emoji'?'active':''}" data-etab="emoji">😀</div>
          <div class="dcs-emojitab ${tab==='gif'?'active':''}" data-etab="gif">GIF</div>
          <div class="dcs-emojitab ${tab==='sticker'?'active':''}" data-etab="sticker">🎭</div>
          ${Object.keys(EMOJI_CATEGORIES).map(cat=>`
            <div class="dcs-emojitab" data-etab="emoji" data-cat="${cat}" title="${cat}"
              style="font-size:14px;">${cat.split(' ')[0]}</div>`).join('')}
        </div>
        <div class="dcs-emojisearch">
          <input id="dc-emoji-search-${id}" placeholder="Search emoji..." autocomplete="off" />
        </div>
        <div id="dc-emoji-content-${id}">${renderPickerContent(tab)}</div>`;

      qs('.dcs-inputarea').appendChild(picker);

      // Tab switching
      picker.querySelectorAll('[data-etab]').forEach(t => {
        t.addEventListener('click', () => {
          picker.querySelectorAll('[data-etab]').forEach(x=>x.classList.remove('active'));
          t.classList.add('active');
          const newTab = t.dataset.etab;
          state.emojiTab = newTab;
          getEl(`dc-emoji-content-${id}`).innerHTML = renderPickerContent(newTab);
          bindPickerItems();
        });
      });

      // Search
      const searchEl = getEl(`dc-emoji-search-${id}`);
      if (searchEl) {
        searchEl.addEventListener('input', () => {
          getEl(`dc-emoji-content-${id}`).innerHTML = renderPickerContent('emoji', searchEl.value);
          bindPickerItems();
        });
      }

      const bindPickerItems = () => {
        picker.querySelectorAll('.dc-emoji-item').forEach(el => {
          el.addEventListener('click', () => {
            const input = getEl(`dc-input-${id}`);
            if (input) { input.value += el.dataset.emoji; input.focus(); }
            picker.remove(); emojiPickerOpen = false;
          });
        });
        picker.querySelectorAll('.dc-sticker-item').forEach(el => {
          el.addEventListener('click', () => {
            addMessage(state.activeChannel, state.profile.username, el.dataset.sticker, state.profile.avatar, false, true);
            picker.remove(); emojiPickerOpen = false;
            render(); triggerBotReply(state.activeChannel);
          });
        });
        picker.querySelectorAll('.dc-gif-item').forEach(el => {
          el.addEventListener('click', () => {
            addMessage(state.activeChannel, state.profile.username, el.dataset.gif, state.profile.avatar, true);
            picker.remove(); emojiPickerOpen = false;
            render(); triggerBotReply(state.activeChannel);
          });
        });
      };
      bindPickerItems();

      // Dismiss on outside click
      setTimeout(() => {
        const dismiss = (e) => {
          if (!picker.contains(e.target)) { picker.remove(); emojiPickerOpen = false; document.removeEventListener('click', dismiss); }
        };
        document.addEventListener('click', dismiss);
      }, 10);
    };

    // ── REACTION PICKER ───────────────────────────────────────────────────
    const showReactionPicker = (msgId, x, y) => {
      document.querySelectorAll('.dc-reaction-picker').forEach(p=>p.remove());
      const quickEmojis = ['👍','👎','❤️','😂','😮','😢','🔥','💯','🎉','✅'];
      const picker = document.createElement('div');
      picker.className = 'dc-reaction-picker dcs-ctx';
      picker.style.cssText = `left:${Math.min(x,window.innerWidth-250)}px;top:${y-50}px;display:flex;flex-wrap:wrap;gap:4px;width:240px;`;
      picker.innerHTML = quickEmojis.map(e=>`
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
          font-size:22px;border-radius:4px;cursor:pointer;" class="dc-rp-item" data-emoji="${e}">${e}</div>`).join('');
      document.body.appendChild(picker);
      picker.querySelectorAll('.dc-rp-item').forEach(el => {
        el.addEventListener('click', () => { toggleReaction(msgId, el.dataset.emoji); picker.remove(); render(); });
        el.addEventListener('mouseenter', () => el.style.background='rgba(255,255,255,.1)');
        el.addEventListener('mouseleave', () => el.style.background='');
      });
      setTimeout(() => {
        const d = (e) => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click',d); } };
        document.addEventListener('click', d);
      }, 10);
    };

    const toggleReaction = (msgId, emoji) => {
      if (!state.reactions[msgId]) state.reactions[msgId] = {};
      if (!state.reactions[msgId][emoji]) state.reactions[msgId][emoji] = [];
      const users = state.reactions[msgId][emoji];
      const idx = users.indexOf(state.profile.username);
      if (idx > -1) users.splice(idx, 1);
      else users.push(state.profile.username);
      if (!users.length) delete state.reactions[msgId][emoji];
      save(); render();
    };

    // ── REPLY ─────────────────────────────────────────────────────────────
    const setReplyTarget = (msgId, author) => {
      const input = getEl(`dc-input-${id}`);
      if (!input) return;
      // Show reply banner above input
      const existing = qs('.dc-reply-banner');
      if (existing) existing.remove();
      const banner = document.createElement('div');
      banner.className = 'dc-reply-banner';
      banner.style.cssText = 'padding:6px 16px;background:var(--bg-t);font-size:13px;color:var(--txm);display:flex;align-items:center;gap:8px;';
      banner.innerHTML = `<span>↩ Replying to <strong style="color:var(--hp);">@${author}</strong></span>
        <span style="margin-left:auto;cursor:pointer;font-size:16px;" id="dc-cancel-reply-${id}">✕</span>`;
      qs('.dcs-inputarea').insertBefore(banner, qs('.dcs-inputwrap'));
      getEl(`dc-cancel-reply-${id}`)?.addEventListener('click', () => banner.remove());
      input.placeholder = `Reply to @${author}...`;
      input.focus();
    };

    // ── ATTACH MENU ───────────────────────────────────────────────────────
    const showAttachMenu = (x, y) => {
      document.querySelectorAll('.dc-attach-menu').forEach(m=>m.remove());
      const menu = document.createElement('div');
      menu.className = 'dc-attach-menu dcs-ctx';
      menu.style.cssText = `left:${x}px;bottom:80px;position:absolute;`;
      menu.innerHTML = `
        <div class="dcs-ctxitem" id="dc-upload-img-${id}">🖼️ Upload Image</div>
        <div class="dcs-ctxitem" id="dc-upload-file-${id}">📄 Upload File</div>
        <div class="dcs-ctxdiv"></div>
        <div class="dcs-ctxitem" id="dc-send-gif-${id}">🎞️ Send GIF</div>`;
      qs('.dcs-inputarea').appendChild(menu);

      getEl(`dc-upload-img-${id}`)?.addEventListener('click', () => {
        menu.remove();
        const fi = document.createElement('input');
        fi.type='file'; fi.accept='image/*';
        fi.onchange = e => {
          const file = e.target.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            addMessage(state.activeChannel, state.profile.username, ev.target.result, state.profile.avatar, true);
            render(); triggerBotReply(state.activeChannel);
          };
          reader.readAsDataURL(file);
        };
        fi.click();
      });

      getEl(`dc-upload-file-${id}`)?.addEventListener('click', () => {
        menu.remove();
        const fi = document.createElement('input');
        fi.type='file';
        fi.onchange = e => {
          const file = e.target.files[0]; if (!file) return;
          addMessage(state.activeChannel, state.profile.username, file.name, state.profile.avatar, false, false, true);
          render(); triggerBotReply(state.activeChannel);
        };
        fi.click();
      });

      getEl(`dc-send-gif-${id}`)?.addEventListener('click', () => {
        menu.remove();
        toggleEmojiPicker('gif');
      });

      setTimeout(() => {
        const d = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click',d); } };
        document.addEventListener('click', d);
      }, 10);
    };

    // ── CONTEXT MENUS ─────────────────────────────────────────────────────
    const showMsgContextMenu = (x, y, msgId, author) => {
      document.querySelectorAll('.dcs-ctx').forEach(c=>c.remove());
      const isOwn = author === state.profile.username;
      const canMod = hasPermission('manage');
      const msg = getMsgs(state.activeChannel).find(m=>m.id==msgId);
      const menu = document.createElement('div');
      menu.className = 'dcs-ctx';
      menu.style.cssText = `left:${Math.min(x,window.innerWidth-200)}px;top:${Math.min(y,window.innerHeight-300)}px;`;
      menu.innerHTML = `
        <div class="dcs-ctxitem" data-ctx="react" data-msgid="${msgId}">😀 Add Reaction</div>
        <div class="dcs-ctxitem" data-ctx="reply" data-msgid="${msgId}" data-author="${author}">↩ Reply</div>
        ${msg?.pinned===false||!msg?.pinned ? `<div class="dcs-ctxitem" data-ctx="pin" data-msgid="${msgId}">📌 Pin Message</div>` : `<div class="dcs-ctxitem" data-ctx="unpin" data-msgid="${msgId}">📌 Unpin Message</div>`}
        <div class="dcs-ctxitem" data-ctx="copy" data-text="${(msg?.text||'').replace(/"/g,'"')}">📋 Copy Text</div>
        <div class="dcs-ctxitem" data-ctx="copy-id" data-msgid="${msgId}">🔗 Copy Message ID</div>
        <div class="dcs-ctxdiv"></div>
        ${isOwn ? `<div class="dcs-ctxitem" data-ctx="edit" data-msgid="${msgId}">✏️ Edit Message</div>` : ''}
        ${isOwn || canMod ? `<div class="dcs-ctxitem danger" data-ctx="delete" data-msgid="${msgId}">🗑️ Delete Message</div>` : ''}
        ${!isOwn ? `
          <div class="dcs-ctxdiv"></div>
          <div class="dcs-ctxitem" data-ctx="profile" data-user="${author}">👤 View Profile</div>
                    <div class="dcs-ctxitem" data-ctx="dm" data-user="${author}">💬 Message ${author}</div>
          <div class="dcs-ctxitem danger" data-ctx="block" data-user="${author}">🚫 Block ${author}</div>` : ''}`;
      document.body.appendChild(menu);

      menu.querySelectorAll('[data-ctx]').forEach(item => {
        item.addEventListener('click', () => {
          menu.remove();
          switch(item.dataset.ctx) {
            case 'react':   showReactionPicker(msgId, x, y); break;
            case 'reply':   setReplyTarget(msgId, author); break;
            case 'pin':
            case 'unpin': {
              const m = getMsgs(state.activeChannel).find(m=>m.id==msgId);
              if (m) { m.pinned = !m.pinned; showToast(m.pinned?'📌 Pinned':'📌 Unpinned','var(--br)'); save(); render(); }
              break;
            }
            case 'copy':
              navigator.clipboard?.writeText(item.dataset.text || '').catch(()=>{});
              showToast('📋 Copied to clipboard','var(--txm)'); break;
            case 'copy-id':
              navigator.clipboard?.writeText(String(msgId)).catch(()=>{});
              showToast('🔗 Message ID copied','var(--txm)'); break;
            case 'edit':    showEditMessageModal(msgId); break;
            case 'delete': {
              state.messages[state.activeChannel] = getMsgs(state.activeChannel).filter(m=>m.id!=msgId);
              const sv = getServer();
              if (sv) { if(!sv.modLog)sv.modLog=[]; sv.modLog.unshift({type:'delete',mod:state.profile.username,target:'message',ts:new Date().toLocaleTimeString()}); }
              save(); render(); break;
            }
            case 'profile': showProfilePopout(x, y, item.dataset.user, fakeUsers.find(u=>u.name===item.dataset.user)?.av||item.dataset.user[0]); break;
            case 'dm': {
              let dm = state.dms.find(d=>d.name===item.dataset.user);
              if (!dm) {
                const fu = fakeUsers.find(u=>u.name===item.dataset.user);
                dm = { id:'dm_'+Date.now(), name:item.dataset.user, avatar:fu?.av||item.dataset.user[0], status:fu?.status||'offline', bio:'', banner:'#5865F2', messages:[], presence:null };
                state.dms.push(dm);
              }
              state.activeChannel = dm.id; state.view = 'dm'; render(); break;
            }
            case 'block': {
              const u = item.dataset.user;
              if (!state.blocked.includes(u)) state.blocked.push(u);
              state.friends = state.friends.filter(f=>f!==u);
              showToast(`🚫 Blocked ${u}`,'var(--dng)'); save(); render(); break;
            }
          }
        });
      });

      setTimeout(() => {
        const d = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click',d); } };
        document.addEventListener('click', d);
      }, 10);
    };

    const showFriendContextMenu = (x, y, name) => {
      document.querySelectorAll('.dcs-ctx').forEach(c=>c.remove());
      const menu = document.createElement('div');
      menu.className = 'dcs-ctx';
      menu.style.cssText = `left:${Math.min(x,window.innerWidth-200)}px;top:${Math.min(y,window.innerHeight-200)}px;`;
      menu.innerHTML = `
        <div class="dcs-ctxitem" data-ctx="dm" data-user="${name}">💬 Message</div>
        <div class="dcs-ctxitem" data-ctx="call" data-user="${name}">📞 Call</div>
        <div class="dcs-ctxitem" data-ctx="profile" data-user="${name}">👤 View Profile</div>
        <div class="dcs-ctxdiv"></div>
        <div class="dcs-ctxitem danger" data-ctx="remove" data-user="${name}">👤 Remove Friend</div>
        <div class="dcs-ctxitem danger" data-ctx="block" data-user="${name}">🚫 Block</div>`;
      document.body.appendChild(menu);
      menu.querySelectorAll('[data-ctx]').forEach(item => {
        item.addEventListener('click', () => {
          menu.remove();
          const u = item.dataset.user;
          switch(item.dataset.ctx) {
            case 'dm': {
              let dm = state.dms.find(d=>d.name===u);
              if (!dm) { const fu=fakeUsers.find(f=>f.name===u); dm={id:'dm_'+Date.now(),name:u,avatar:fu?.av||u[0],status:fu?.status||'offline',bio:'',banner:'#5865F2',messages:[],presence:null}; state.dms.push(dm); }
              state.activeChannel=dm.id; state.view='dm'; render(); break;
            }
            case 'call': showCallOverlay(false, u); break;
            case 'profile': showProfilePopout(x,y,u,fakeUsers.find(f=>f.name===u)?.av||u[0]); break;
            case 'remove': state.friends=state.friends.filter(f=>f!==u); showToast(`Removed ${u} as a friend`,'var(--txm)'); save(); render(); break;
            case 'block': if(!state.blocked.includes(u))state.blocked.push(u); state.friends=state.friends.filter(f=>f!==u); showToast(`🚫 Blocked ${u}`,'var(--dng)'); save(); render(); break;
          }
        });
      });
      setTimeout(() => {
        const d=(e)=>{if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',d);}};
        document.addEventListener('click',d);
      },10);
    };

    // ── HOVER CARD ────────────────────────────────────────────────────────
    const showHoverCard = (x, y, username, avatar) => {
      document.querySelectorAll('.dc-hovercard').forEach(h=>h.remove());
      const isMe = username === state.profile.username;
      const fu = fakeUsers.find(u=>u.name===username);
      const dm = state.dms.find(d=>d.name===username);
      const status = isMe ? state.profile.status : (fu?.status||'offline');
      const bio = isMe ? state.profile.bio : (dm?.bio||'No bio set.');
      const banner = isMe ? state.profile.banner : (dm?.banner||'#5865F2');
      const presence = isMe ? null : dm?.presence;
      const role = getUserRole(username);
      const roleData = ROLES[role];
      const xp = isMe ? state.profile.xp : Math.floor(Math.random()*500);
      const level = isMe ? state.profile.level : Math.floor(xp/200)+1;

      const card = document.createElement('div');
      card.className = 'dc-hovercard dcs-popout';
      card.style.cssText = `left:${Math.min(x+10,window.innerWidth-360)}px;top:${Math.min(y,window.innerHeight-420)}px;width:300px;`;
      card.innerHTML = `
        <div style="height:60px;background:${banner.startsWith('#')?banner:`linear-gradient(135deg,${banner})`};position:relative;">
          <div style="position:absolute;bottom:-20px;left:12px;width:56px;height:56px;border-radius:50%;
            background:var(--br);border:4px solid var(--bg-f);display:flex;align-items:center;
            justify-content:center;font-size:28px;">${avatar}
            <div style="position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;
              background:${SC[status]};border:2px solid var(--bg-f);"></div>
          </div>
        </div>
        <div style="padding:28px 12px 12px;">
          <div style="font-size:18px;font-weight:700;color:var(--hp);">${username}</div>
          ${roleData ? `<div style="display:inline-flex;align-items:center;gap:4px;background:${roleData.color}22;
            color:${roleData.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-top:4px;">
            ${roleData.name}</div>` : ''}
          ${isMe && state.profile.nitro ? '<span class="dcs-nitrobadge" style="margin-left:4px;">NITRO</span>' : ''}
          <div style="height:1px;background:var(--dv);margin:10px 0;"></div>
          <div style="font-size:11px;font-weight:700;color:var(--hs);text-transform:uppercase;margin-bottom:4px;">About Me</div>
          <div style="font-size:13px;color:var(--tx);margin-bottom:10px;">${bio}</div>
          ${presence ? `
            <div style="font-size:11px;font-weight:700;color:var(--hs);text-transform:uppercase;margin-bottom:4px;">Playing</div>
            <div class="dcs-presence">
              <div class="dcs-presence-title">🎮 ${presence.game}</div>
              <div class="dcs-presence-sub">for ${presence.since}</div>
            </div>` : ''}
          <div style="font-size:11px;font-weight:700;color:var(--hs);text-transform:uppercase;margin:10px 0 4px;">Level ${level}</div>
          <div class="dcs-xpbar"><div class="dcs-xpfill" style="width:${(xp%200)/2}%;"></div></div>
          <div style="font-size:11px;color:var(--txm);margin-top:2px;">${xp%200}/200 XP</div>
        </div>`;
      document.body.appendChild(card);
      card.addEventListener('mouseleave', () => card.remove());
    };

    // ── PROFILE POPOUT ────────────────────────────────────────────────────
    const showProfilePopout = (x, y, username, avatar) => {
      document.querySelectorAll('.dcs-popout').forEach(p=>p.remove());
      const isMe = username === state.profile.username;
      const fu = fakeUsers.find(u=>u.name===username);
      const dm = state.dms.find(d=>d.name===username);
      const status = isMe ? state.profile.status : (fu?.status||'offline');
      const bio = isMe ? state.profile.bio : (dm?.bio||'No bio set.');
      const banner = isMe ? state.profile.banner : (dm?.banner||'#5865F2');
      const presence = isMe ? null : dm?.presence;
      const role = getUserRole(username);
      const roleData = ROLES[role];
      const xp = isMe ? state.profile.xp : Math.floor(Math.random()*1000);
      const level = isMe ? state.profile.level : Math.floor(xp/200)+1;
      const badges = isMe ? (state.profile.badges||[]) : ['🎮'];
      const achievements = isMe ? (state.profile.achievements||[]) : ['first_msg'];
      const isFriend = state.friends.includes(username);

      const popout = document.createElement('div');
      popout.className = 'dcs-popout';
      popout.style.cssText = `left:${Math.min(x,window.innerWidth-360)}px;top:${Math.min(y,window.innerHeight-520)}px;width:340px;`;
      popout.innerHTML = `
        <div style="height:80px;background:${banner.startsWith('linear')?banner:`linear-gradient(135deg,${banner},${banner}88)`};position:relative;">
          <div style="position:absolute;bottom:-28px;left:16px;width:72px;height:72px;border-radius:50%;
            background:var(--br);border:6px solid var(--bg-f);display:flex;align-items:center;
            justify-content:center;font-size:36px;">${avatar}
            <div style="position:absolute;bottom:2px;right:2px;width:16px;height:16px;border-radius:50%;
              background:${SC[status]};border:3px solid var(--bg-f);"></div>
          </div>
          ${isMe ? `<div style="position:absolute;top:8px;right:8px;cursor:pointer;background:rgba(0,0,0,.4);
            border-radius:4px;padding:4px 8px;font-size:12px;color:#fff;" data-action="open-settings">Edit Profile</div>` : ''}
        </div>
        <div style="padding:36px 16px 16px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <div>
              <div style="font-size:20px;font-weight:700;color:var(--hp);">${username}</div>
              <div style="font-size:13px;color:var(--txm);">${isMe?'#'+state.profile.tag:username.toLowerCase()+'#'+Math.floor(1000+Math.random()*9000)}</div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              ${badges.map(b=>`<span class="dcs-badge" title="Badge">${b}</span>`).join('')}
              ${isMe&&state.profile.nitro?'<span class="dcs-nitrobadge">NITRO</span>':''}
            </div>
          </div>
          ${isMe&&state.profile.customStatus?`<div style="font-size:13px;color:var(--txm);margin-bottom:8px;">💬 ${state.profile.customStatus}</div>`:''}
          <div style="background:var(--bg-t);border-radius:8px;padding:12px;">
            ${roleData?`<div style="margin-bottom:8px;"><div class="dcs-label" style="margin-bottom:4px;">Role</div>
              <div style="display:inline-flex;align-items:center;gap:4px;background:${roleData.color}22;
                color:${roleData.color};font-size:12px;font-weight:700;padding:2px 8px;border-radius:4px;">
                ${roleData.name}</div></div>`:''}
            <div style="margin-bottom:8px;">
              <div class="dcs-label" style="margin-bottom:4px;">About Me</div>
              <div style="font-size:14px;color:var(--tx);">${bio}</div>
            </div>
            ${presence?`<div style="margin-bottom:8px;">
              <div class="dcs-label" style="margin-bottom:4px;">Currently Playing</div>
              <div class="dcs-presence">
                <div class="dcs-presence-title">🎮 ${presence.game}</div>
                <div class="dcs-presence-sub">for ${presence.since}</div>
              </div></div>`:''}
            <div>
              <div class="dcs-label" style="margin-bottom:4px;">Level ${level} · ${xp} XP</div>
              <div class="dcs-xpbar"><div class="dcs-xpfill" style="width:${(xp%200)/2}%;"></div></div>
            </div>
            ${achievements.length?`<div style="margin-top:8px;">
              <div class="dcs-label" style="margin-bottom:4px;">Achievements</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;">
                ${achievements.map(aid=>{const a=ACHIEVEMENTS.find(x=>x.id===aid);return a?`<span title="${a.name}" style="font-size:20px;cursor:pointer;">${a.icon}</span>`:''}).join('')}
              </div></div>`:''}
          </div>
          ${!isMe?`<div style="display:flex;gap:8px;margin-top:12px;">
            <button class="dcbtn dcbtn-p" style="flex:1;font-size:13px;" id="dc-popout-msg-${id}">
              💬 Message
            </button>
            ${isFriend?`<button class="dcbtn dcbtn-s" style="font-size:13px;" id="dc-popout-call-${id}">📞</button>`
              :`<button class="dcbtn dcbtn-s" style="font-size:13px;" id="dc-popout-addfriend-${id}">Add Friend</button>`}
          </div>`:''}
        </div>`;

      document.body.appendChild(popout);

      // Wire buttons
      getEl(`dc-popout-msg-${id}`)?.addEventListener('click', () => {
        popout.remove();
        let dm = state.dms.find(d=>d.name===username);
        if (!dm) { const fu2=fakeUsers.find(u=>u.name===username); dm={id:'dm_'+Date.now(),name:username,avatar:fu2?.av||username[0],status:fu2?.status||'offline',bio:'',banner:'#5865F2',messages:[],presence:null}; state.dms.push(dm); }
        state.activeChannel=dm.id; state.view='dm'; render();
      });
      getEl(`dc-popout-call-${id}`)?.addEventListener('click', () => { popout.remove(); showCallOverlay(false, username); });
      getEl(`dc-popout-addfriend-${id}`)?.addEventListener('click', () => {
        if (!state.friends.includes(username)) state.friends.push(username);
        showToast(`✅ Friend request sent to ${username}!`,'var(--ok)'); save();
        getEl(`dc-popout-addfriend-${id}`).textContent='✓ Sent'; getEl(`dc-popout-addfriend-${id}`).disabled=true;
      });
      popout.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => { popout.remove(); showSettingsModal(); });

      setTimeout(() => {
        const d=(e)=>{if(!popout.contains(e.target)){popout.remove();document.removeEventListener('click',d);}};
        document.addEventListener('click',d);
      },10);
    };

    // ── EDIT MESSAGE ──────────────────────────────────────────────────────
    const showEditMessageModal = (msgId) => {
      const msg = getMsgs(state.activeChannel).find(m=>m.id==msgId);
      if (!msg) return;
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal">
          <div class="dcs-modal-hdr">Edit Message</div>
          <div class="dcs-modal-body">
            <textarea id="dc-edit-msg-${id}" class="dcinput" style="height:100px;resize:none;">${msg.text}</textarea>
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" id="dc-edit-cancel-${id}">Cancel</button>
            <button class="dcbtn dcbtn-p" id="dc-edit-save-${id}">Save Changes</button>
          </div>
        </div>`;
      content.appendChild(overlay);
      getEl(`dc-edit-cancel-${id}`)?.addEventListener('click', ()=>overlay.remove());
      getEl(`dc-edit-save-${id}`)?.addEventListener('click', ()=>{
        const newText = getEl(`dc-edit-msg-${id}`).value.trim();
        if (newText) { msg.text = newText+'  *(edited)*'; save(); render(); }
        overlay.remove();
      });
    };

    // ── ADD SERVER MODAL ──────────────────────────────────────────────────
    const showAddServerModal = () => {
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal">
          <div class="dcs-modal-hdr" style="text-align:center;padding:24px 24px 0;">Create Your Server</div>
          <div class="dcs-modal-body" style="text-align:center;">
            <p style="color:var(--txm);font-size:14px;margin-bottom:20px;">
              Your server is where you and your friends hang out. Make yours and start talking.
            </p>
            <div style="display:flex;gap:12px;margin-bottom:20px;">
              <div id="dc-sv-type-create" style="flex:1;border:2px solid var(--br);border-radius:8px;padding:16px;cursor:pointer;text-align:center;">
                <div style="font-size:32px;margin-bottom:8px;">🏠</div>
                <div style="font-weight:600;color:var(--hp);">Create My Own</div>
              </div>
              <div id="dc-sv-type-template" style="flex:1;border:2px solid var(--dv);border-radius:8px;padding:16px;cursor:pointer;text-align:center;">
                <div style="font-size:32px;margin-bottom:8px;">📋</div>
                <div style="font-weight:600;color:var(--hp);">Use a Template</div>
              </div>
            </div>
            <div style="text-align:left;">
              <div class="dcs-label">Server Name</div>
              <input type="text" id="dc-new-sv-name-${id}" class="dcinput" value="${state.profile.username}'s server" />
              <div class="dcs-label" style="margin-top:12px;">Server Icon</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;" id="dc-sv-icon-picker-${id}">
                ${['🏠','🎮','🎵','💻','🎨','📚','🌍','⚡','🔥','💎'].map(ic=>
                  `<div style="width:40px;height:40px;border-radius:50%;background:var(--bg-t);display:flex;
                    align-items:center;justify-content:center;font-size:20px;cursor:pointer;border:2px solid transparent;"
                    class="dc-sv-icon-opt" data-icon="${ic}">${ic}</div>`).join('')}
              </div>
            </div>
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" id="dc-sv-back-${id}">Back</button>
            <button class="dcbtn dcbtn-p" id="dc-sv-create-${id}">Create Server</button>
          </div>
        </div>`;
      content.appendChild(overlay);

      let selectedIcon = '🏠';
      overlay.querySelectorAll('.dc-sv-icon-opt').forEach(el => {
        el.addEventListener('click', () => {
          overlay.querySelectorAll('.dc-sv-icon-opt').forEach(x=>x.style.borderColor='transparent');
          el.style.borderColor='var(--br)'; selectedIcon=el.dataset.icon;
        });
      });
      getEl(`dc-sv-back-${id}`)?.addEventListener('click', ()=>overlay.remove());
      getEl(`dc-sv-create-${id}`)?.addEventListener('click', ()=>{
        const name = getEl(`dc-new-sv-name-${id}`).value.trim();
        if (!name) return;
        const newSv = {
          id:'sv_'+Date.now(), name, icon:selectedIcon,
          color:'#'+Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'),
          banner:`linear-gradient(135deg,#5865f2,#7289da)`,
          boosts:0, boostLevel:0,
          categories:[
            { id:'cat_'+Date.now(), name:'Text Channels', channels:[
              { id:'ch_'+Date.now(), name:'general', type:'text', topic:'General chat' },
            ]},
            { id:'cat_'+(Date.now()+1), name:'Voice Channels', channels:[
              { id:'vc_'+Date.now(), name:'General', type:'voice', users:[] },
            ]},
          ],
          roles:{ [state.profile.username]:'owner' },
          members:[state.profile.username],
          pinnedMessages:{}, modLog:[],
        };
        state.servers.push(newSv);
        state.activeServer=newSv.id; state.view='server';
        state.activeChannel=newSv.categories[0].channels[0].id;
        checkAchievements();
        save(); render(); overlay.remove();
        showToast(`🎉 Server "${name}" created!`,'var(--ok)');
      });
    };

    // ── EXPLORE COMMUNITIES ───────────────────────────────────────────────
    const showExploreModal = () => {
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal" style="width:600px;max-height:80vh;">
          <div class="dcs-modal-hdr">Explore Communities</div>
          <div class="dcs-modal-body" style="overflow-y:auto;max-height:60vh;">
            <input class="dcinput" placeholder="Search communities..." style="margin-bottom:16px;" id="dc-explore-search-${id}" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;" id="dc-explore-grid-${id}">
              ${AUTO_COMMUNITIES.map(c=>`
                <div style="background:var(--bg-s);border-radius:12px;overflow:hidden;cursor:pointer;
                  transition:transform .2s;" class="dc-community-card" data-name="${c.name}">
                  <div style="height:60px;background:linear-gradient(135deg,#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')},#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')});
                    display:flex;align-items:center;justify-content:center;font-size:32px;">${c.icon}</div>
                  <div style="padding:12px;">
                    <div style="font-weight:700;color:var(--hp);margin-bottom:4px;">${c.name}</div>
                    <div style="font-size:12px;color:var(--txm);margin-bottom:8px;">${c.desc}</div>
                    <div style="font-size:12px;color:var(--txm);">👥 ${c.members.toLocaleString()} members</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Close</button>
          </div>
        </div>`;
      content.appendChild(overlay);

      overlay.querySelectorAll('.dc-community-card').forEach(card => {
        card.addEventListener('mouseenter', ()=>card.style.transform='scale(1.02)');
        card.addEventListener('mouseleave', ()=>card.style.transform='');
        card.addEventListener('click', ()=>{
          const template = AUTO_COMMUNITIES.find(c=>c.name===card.dataset.name);
          if (template) { overlay.remove(); generateCommunity(template); }
        });
      });

      getEl(`dc-explore-search-${id}`)?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        overlay.querySelectorAll('.dc-community-card').forEach(card => {
          card.style.display = card.dataset.name.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    };

    // ── SERVER SETTINGS ───────────────────────────────────────────────────
    const showServerSettingsModal = () => {
      if (!hasPermission('manage')) { showToast('You lack permission to manage this server.','var(--dng)'); return; }
      const sv = getServer();
      if (!sv) return;
      const modal = document.createElement('div');
      modal.className = 'dcs-settings';
      modal.innerHTML = `
        <div class="dcs-setnav">
          <div class="dcs-setnav-inner">
            <div class="dcs-setsec">Server Settings</div>
            ${['Overview','Roles','Members','Invites','Moderation Log','Boosts'].map(t=>`
              <div class="dcs-setitem ${t==='Overview'?'active':''}" data-svtab="${t}">${t}</div>`).join('')}
            <div class="dcs-setsec">Danger Zone</div>
            <div class="dcs-setitem" data-svtab="Delete" style="color:var(--dng);">Delete Server</div>
          </div>
        </div>
        <div class="dcs-setcontent" id="dc-svsettings-content-${id}">
          <div class="dcs-setclose" onclick="this.closest('.dcs-settings').remove()">${I.close}<div style="font-size:12px;margin-top:4px;font-weight:600;">ESC</div></div>
          ${renderSVSettingsTab('Overview', sv)}
        </div>`;
      content.appendChild(modal);

      modal.querySelectorAll('[data-svtab]').forEach(tab => {
        tab.addEventListener('click', ()=>{
          modal.querySelectorAll('[data-svtab]').forEach(t=>t.classList.remove('active'));
          tab.classList.add('active');
          getEl(`dc-svsettings-content-${id}`).innerHTML = `
            <div class="dcs-setclose" onclick="this.closest('.dcs-settings').remove()">${I.close}<div style="font-size:12px;margin-top:4px;font-weight:600;">ESC</div></div>
            ${renderSVSettingsTab(tab.dataset.svtab, sv)}`;
          bindSVSettingsEvents(sv);
        });
      });
            bindSVSettingsEvents(sv);
    };

    const renderSVSettingsTab = (tab, sv) => {
      switch(tab) {
        case 'Overview': return `
          <h2 style="color:var(--hp);margin-bottom:24px;">Server Overview</h2>
          <div style="background:var(--bg-s);border-radius:8px;overflow:hidden;margin-bottom:16px;">
            <div style="height:100px;background:${sv.banner||'var(--br)'};"></div>
            <div style="padding:16px;">
              <div class="dcs-label">Server Name</div>
              <input type="text" id="dc-sv-name-edit-${id}" class="dcinput" value="${sv.name}" />
              <div class="dcs-label" style="margin-top:12px;">Server Icon</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                ${['🏠','🎮','🎵','💻','🎨','📚','🌍','⚡','🔥','💎'].map(ic=>
                  `<div style="width:40px;height:40px;border-radius:50%;background:var(--bg-t);display:flex;
                    align-items:center;justify-content:center;font-size:20px;cursor:pointer;
                    border:2px solid ${sv.icon===ic?'var(--br)':'transparent'};"
                    class="dc-sv-icon-edit" data-icon="${ic}">${ic}</div>`).join('')}
              </div>
              <div class="dcs-label" style="margin-top:12px;">Banner Color</div>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                ${['linear-gradient(135deg,#5865f2,#7289da)','linear-gradient(135deg,#e74c3c,#c0392b)',
                   'linear-gradient(135deg,#2ecc71,#27ae60)','linear-gradient(135deg,#f0b232,#e67e22)',
                   'linear-gradient(135deg,#9b59b6,#8e44ad)','linear-gradient(135deg,#1abc9c,#16a085)'].map(bg=>
                  `<div style="width:48px;height:32px;border-radius:6px;background:${bg};cursor:pointer;
                    border:2px solid ${sv.banner===bg?'var(--hp)':'transparent'};"
                    class="dc-sv-banner-edit" data-banner="${bg}"></div>`).join('')}
              </div>
            </div>
          </div>
          <button class="dcbtn dcbtn-p" id="dc-sv-save-${id}">Save Changes</button>`;

        case 'Roles': return `
          <h2 style="color:var(--hp);margin-bottom:24px;">Roles</h2>
          ${Object.entries(ROLES).map(([key,role])=>`
            <div style="background:var(--bg-s);border-radius:8px;padding:12px 16px;margin-bottom:8px;
              display:flex;align-items:center;gap:12px;">
              <div style="width:16px;height:16px;border-radius:50%;background:${role.color};flex-shrink:0;"></div>
              <div style="flex:1;">
                <div style="font-weight:600;color:var(--hp);">${role.name}</div>
                <div style="font-size:12px;color:var(--txm);">Permissions: ${role.perms.join(', ')}</div>
              </div>
              <div style="font-size:12px;color:var(--txm);">
                ${sv.members.filter(m=>(sv.roles[m]||'member')===key).length} members
              </div>
            </div>`).join('')}
          <div style="margin-top:16px;">
            <div class="dcs-label" style="margin-bottom:8px;">Assign Role</div>
            <div style="display:flex;gap:8px;">
              <select id="dc-role-member-${id}" class="dcinput" style="flex:1;">
                ${sv.members.map(m=>`<option value="${m}">${m}</option>`).join('')}
              </select>
              <select id="dc-role-value-${id}" class="dcinput" style="flex:1;">
                ${Object.keys(ROLES).map(k=>`<option value="${k}">${ROLES[k].name}</option>`).join('')}
              </select>
              <button class="dcbtn dcbtn-p" id="dc-role-assign-${id}">Assign</button>
            </div>
          </div>`;

        case 'Members': return `
          <h2 style="color:var(--hp);margin-bottom:24px;">Members — ${sv.members.length}</h2>
          ${sv.members.map(m=>{
            const fu=fakeUsers.find(u=>u.name===m);
            const isMe=m===state.profile.username;
            const role=sv.roles[m]||'member';
            return `
              <div style="background:var(--bg-s);border-radius:8px;padding:12px 16px;margin-bottom:8px;
                display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:50%;background:${getUserColor(m)};
                  display:flex;align-items:center;justify-content:center;font-size:20px;">
                  ${isMe?state.profile.avatar:(fu?.av||m[0])}</div>
                <div style="flex:1;">
                  <div style="font-weight:600;color:var(--hp);">${m}${isMe?' (you)':''}</div>
                  <div style="font-size:12px;color:${ROLES[role]?.color||'var(--txm)'};">${ROLES[role]?.name||'Member'}</div>
                </div>
                ${!isMe&&hasPermission('kick')?`
                  <button class="dcbtn dcbtn-s" style="font-size:12px;padding:4px 10px;"
                    data-action-kick="${m}">Kick</button>
                  <button class="dcbtn dcbtn-d" style="font-size:12px;padding:4px 10px;"
                    data-action-ban="${m}">Ban</button>`:''}`+`
              </div>`;
          }).join('')}`;

        case 'Invites': return `
          <h2 style="color:var(--hp);margin-bottom:24px;">Invites</h2>
          <div style="background:var(--bg-s);border-radius:8px;padding:16px;margin-bottom:16px;">
            <div class="dcs-label" style="margin-bottom:8px;">Server Invite Link</div>
            <div style="display:flex;gap:8px;">
              <input class="dcinput" style="flex:1;" value="https://discord.gg/${sv.name.replace(/\s/g,'').toLowerCase().substring(0,8)}" readonly id="dc-invite-link-${id}" />
              <button class="dcbtn dcbtn-p" id="dc-copy-invite-${id}">Copy</button>
            </div>
            <div style="font-size:12px;color:var(--txm);margin-top:8px;">This link never expires</div>
          </div>`;

        case 'Moderation Log': return `
          <h2 style="color:var(--hp);margin-bottom:24px;">Moderation Log</h2>
          ${(sv.modLog||[]).length ? (sv.modLog||[]).slice(0,20).map(log=>`
            <div class="dcs-modlog ${log.type==='warn'?'warn':log.type==='ok'?'ok':''}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;color:var(--hp);">${log.type.toUpperCase()}</span>
                <span style="font-size:11px;color:var(--txm);">${log.ts}</span>
              </div>
              <div style="color:var(--tx);margin-top:2px;">
                <strong>${log.mod}</strong> ${log.type==='delete'?'deleted a':'performed action on'} ${log.target}
              </div>
            </div>`).join('') : `
            <div style="text-align:center;color:var(--txm);padding:40px;">
              <div style="font-size:32px;margin-bottom:8px;">📋</div>
              <div>No moderation actions yet</div>
            </div>`}`;

        case 'Boosts': return `
          <h2 style="color:var(--hp);margin-bottom:24px;">Server Boosts</h2>
          <div class="dcs-boost">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:32px;">🚀</span>
              <div>
                <div style="font-weight:700;color:var(--hp);font-size:16px;">Level ${sv.boostLevel||0}</div>
                <div style="font-size:13px;color:var(--txm);">${sv.boosts||0} boosts</div>
              </div>
            </div>
            <div class="dcs-boost-bar">
              <div class="dcs-boost-fill" style="width:${Math.min(((sv.boosts||0)/14)*100,100)}%;"></div>
            </div>
            <div style="font-size:12px;color:var(--txm);margin-top:6px;">${sv.boosts||0}/14 boosts for Level 3</div>
          </div>
          <div style="margin-top:16px;">
            ${[1,2,3].map(lvl=>`
              <div style="background:var(--bg-s);border-radius:8px;padding:12px 16px;margin-bottom:8px;
                display:flex;align-items:center;gap:12px;opacity:${(sv.boostLevel||0)>=lvl?1:.5};">
                <span style="font-size:24px;">${(sv.boostLevel||0)>=lvl?'✅':'🔒'}</span>
                <div>
                  <div style="font-weight:600;color:var(--hp);">Level ${lvl}</div>
                  <div style="font-size:12px;color:var(--txm);">
                    ${lvl===1?'Animated icon, 100 emoji slots':lvl===2?'Server banner, 150 emoji slots':'Vanity URL, 250 emoji slots, 384kbps audio'}
                  </div>
                </div>
              </div>`).join('')}
          </div>
          <button class="dcbtn dcbtn-p" id="dc-boost-sv-${id}" style="margin-top:8px;">
            🚀 Boost This Server
          </button>`;

        case 'Delete': return `
          <h2 style="color:var(--dng);margin-bottom:24px;">Delete Server</h2>
          <div style="background:rgba(218,55,60,.1);border:1px solid var(--dng);border-radius:8px;padding:16px;margin-bottom:16px;">
            <div style="font-weight:600;color:var(--dng);margin-bottom:8px;">⚠️ This action is irreversible</div>
            <div style="font-size:14px;color:var(--tx);">
              Deleting <strong>${sv.name}</strong> will permanently remove all channels, messages, and members.
            </div>
          </div>
          <div class="dcs-label" style="margin-bottom:8px;">Type the server name to confirm</div>
          <input type="text" id="dc-delete-confirm-${id}" class="dcinput" placeholder="${sv.name}" />
          <button class="dcbtn dcbtn-d" style="margin-top:12px;" id="dc-delete-sv-${id}">Delete Server</button>`;

        default: return `<h2 style="color:var(--hp);">${tab}</h2><p style="color:var(--txm);">Coming soon.</p>`;
      }
    };

    const bindSVSettingsEvents = (sv) => {
      // Overview save
      getEl(`dc-sv-save-${id}`)?.addEventListener('click', ()=>{
        const newName = getEl(`dc-sv-name-edit-${id}`)?.value.trim();
        if (newName) sv.name = newName;
        showToast('✅ Server settings saved','var(--ok)'); save(); render();
      });
      // Icon picker
      content.querySelectorAll('.dc-sv-icon-edit').forEach(el=>{
        el.addEventListener('click', ()=>{
          content.querySelectorAll('.dc-sv-icon-edit').forEach(x=>x.style.borderColor='transparent');
          el.style.borderColor='var(--br)'; sv.icon=el.dataset.icon;
        });
      });
      // Banner picker
      content.querySelectorAll('.dc-sv-banner-edit').forEach(el=>{
        el.addEventListener('click', ()=>{
          content.querySelectorAll('.dc-sv-banner-edit').forEach(x=>x.style.borderColor='transparent');
          el.style.borderColor='var(--hp)'; sv.banner=el.dataset.banner;
        });
      });
      // Role assign
      getEl(`dc-role-assign-${id}`)?.addEventListener('click', ()=>{
        const member = getEl(`dc-role-member-${id}`)?.value;
        const role   = getEl(`dc-role-value-${id}`)?.value;
        if (member && role) {
          sv.roles[member]=role;
          showToast(`✅ Assigned ${ROLES[role].name} to ${member}`,'var(--ok)');
          save();
        }
      });
      // Kick / Ban
      content.querySelectorAll('[data-action-kick]').forEach(el=>{
        el.addEventListener('click', ()=>{
          const m=el.dataset.actionKick;
          sv.members=sv.members.filter(x=>x!==m);
          if(!sv.modLog)sv.modLog=[];
          sv.modLog.unshift({type:'kick',mod:state.profile.username,target:m,ts:new Date().toLocaleTimeString()});
          showToast(`👢 Kicked ${m}`,'var(--wrn)'); save(); render();
        });
      });
      content.querySelectorAll('[data-action-ban]').forEach(el=>{
        el.addEventListener('click', ()=>{
          const m=el.dataset.actionBan;
          sv.members=sv.members.filter(x=>x!==m);
          if(!sv.modLog)sv.modLog=[];
          sv.modLog.unshift({type:'ban',mod:state.profile.username,target:m,ts:new Date().toLocaleTimeString()});
          showToast(`🔨 Banned ${m}`,'var(--dng)'); save(); render();
        });
      });
      // Copy invite
      getEl(`dc-copy-invite-${id}`)?.addEventListener('click', ()=>{
        const link=getEl(`dc-invite-link-${id}`)?.value;
        navigator.clipboard?.writeText(link||'').catch(()=>{});
        showToast('🔗 Invite link copied!','var(--ok)');
      });
      // Boost
      getEl(`dc-boost-sv-${id}`)?.addEventListener('click', ()=>{
        if (!state.profile.nitro) { showToast('You need Nitro to boost servers!','var(--dng)'); return; }
        sv.boosts=(sv.boosts||0)+1;
        sv.boostLevel=sv.boosts>=14?3:sv.boosts>=7?2:sv.boosts>=2?1:0;
        showToast(`🚀 You boosted ${sv.name}!`,'var(--nit)');
        if(!state.profile.achievements.includes('boosted')){
          state.profile.achievements.push('boosted');
          state.profile.xp+=300;
          showToast('🚀 Achievement Unlocked: Booster (+300 XP)','var(--gld)');
        }
        save(); render();
      });
      // Delete server
      getEl(`dc-delete-sv-${id}`)?.addEventListener('click', ()=>{
        const confirm=getEl(`dc-delete-confirm-${id}`)?.value;
        if (confirm!==sv.name) { showToast('Server name does not match','var(--dng)'); return; }
        state.servers=state.servers.filter(s=>s.id!==sv.id);
        state.activeServer=state.servers[0]?.id||'';
        state.activeChannel=getAllChannels(state.servers[0]||{categories:[]})[0]?.id||'';
        showToast(`🗑️ Server "${sv.name}" deleted`,'var(--dng)');
        save(); render();
        content.querySelector('.dcs-settings')?.remove();
      });
    };

    // ── ADD CHANNEL MODAL ─────────────────────────────────────────────────
    const showAddChannelModal = (catId) => {
      if (!hasPermission('manage')) { showToast('You lack permission to add channels.','var(--dng)'); return; }
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal">
          <div class="dcs-modal-hdr">Create Channel</div>
          <div class="dcs-modal-body">
            <div style="display:flex;gap:8px;margin-bottom:16px;">
              <div id="dc-ch-type-text" style="flex:1;border:2px solid var(--br);border-radius:8px;padding:12px;
                cursor:pointer;text-align:center;">
                <div style="font-size:24px;margin-bottom:4px;">#</div>
                <div style="font-size:13px;font-weight:600;color:var(--hp);">Text Channel</div>
              </div>
              <div id="dc-ch-type-voice" style="flex:1;border:2px solid var(--dv);border-radius:8px;padding:12px;
                cursor:pointer;text-align:center;">
                <div style="font-size:24px;margin-bottom:4px;">🔊</div>
                <div style="font-size:13px;font-weight:600;color:var(--hp);">Voice Channel</div>
              </div>
            </div>
            <div class="dcs-label">Channel Name</div>
            <input type="text" id="dc-new-ch-name-${id}" class="dcinput" placeholder="new-channel" />
            <div class="dcs-label" style="margin-top:12px;">Topic (optional)</div>
            <input type="text" id="dc-new-ch-topic-${id}" class="dcinput" placeholder="What's this channel about?" />
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Cancel</button>
            <button class="dcbtn dcbtn-p" id="dc-create-ch-${id}">Create Channel</button>
          </div>
        </div>`;
      content.appendChild(overlay);

      let chType = 'text';
      getEl('dc-ch-type-text')?.addEventListener('click', ()=>{
        chType='text';
        getEl('dc-ch-type-text').style.borderColor='var(--br)';
        getEl('dc-ch-type-voice').style.borderColor='var(--dv)';
      });
      getEl('dc-ch-type-voice')?.addEventListener('click', ()=>{
        chType='voice';
        getEl('dc-ch-type-voice').style.borderColor='var(--br)';
        getEl('dc-ch-type-text').style.borderColor='var(--dv)';
      });
      getEl(`dc-create-ch-${id}`)?.addEventListener('click', ()=>{
        const name  = getEl(`dc-new-ch-name-${id}`)?.value.trim().replace(/\s+/g,'-').toLowerCase();
        const topic = getEl(`dc-new-ch-topic-${id}`)?.value.trim();
        if (!name) return;
        const sv = getServer();
        const cat = sv?.categories.find(c=>c.id===catId);
        if (!cat) return;
        const newCh = { id:'ch_'+Date.now(), name, type:chType, topic, users:[] };
        cat.channels.push(newCh);
        state.activeChannel=newCh.id;
        save(); render(); overlay.remove();
        showToast(`✅ #${name} created`,'var(--ok)');
      });
    };

    // ── ADD FRIEND MODAL ──────────────────────────────────────────────────
    const showAddFriendModal = () => {
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal">
          <div class="dcs-modal-hdr">Add Friend</div>
          <div class="dcs-modal-body">
            <p style="color:var(--txm);font-size:14px;margin-bottom:12px;">
              You can add friends with their Discord username.
            </p>
            <div class="dcs-label">Username</div>
            <input type="text" id="dc-add-friend-input-${id}" class="dcinput" placeholder="Enter a username" />
            <div id="dc-friend-suggestions-${id}" style="margin-top:12px;">
              <div class="dcs-label" style="margin-bottom:8px;">Suggestions</div>
              ${fakeUsers.filter(u=>!state.friends.includes(u.name)).slice(0,4).map(u=>`
                <div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:6px;
                  background:var(--bg-s);margin-bottom:6px;">
                  <div style="width:36px;height:36px;border-radius:50%;background:${u.color};
                    display:flex;align-items:center;justify-content:center;font-size:20px;">${u.av}</div>
                  <div style="flex:1;">
                    <div style="font-weight:600;color:var(--hp);">${u.name}</div>
                    <div style="font-size:12px;color:var(--txm);">${u.status}</div>
                  </div>
                  <button class="dcbtn dcbtn-p" style="font-size:12px;padding:4px 10px;"
                    data-add-suggest="${u.name}">Add</button>
                </div>`).join('')}
            </div>
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Cancel</button>
            <button class="dcbtn dcbtn-p" id="dc-send-friend-req-${id}">Send Friend Request</button>
          </div>
        </div>`;
      content.appendChild(overlay);

      overlay.querySelectorAll('[data-add-suggest]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const name=btn.dataset.addSuggest;
          if (!state.friends.includes(name)) state.friends.push(name);
          btn.textContent='✓ Added'; btn.disabled=true;
          showToast(`✅ Friend request sent to ${name}!`,'var(--ok)'); save();
        });
      });
      getEl(`dc-send-friend-req-${id}`)?.addEventListener('click', ()=>{
        const name=getEl(`dc-add-friend-input-${id}`)?.value.trim();
        if (!name) return;
        if (state.friends.includes(name)) { showToast('Already friends!','var(--txm)'); return; }
        state.friends.push(name);
        showToast(`✅ Friend request sent to ${name}!`,'var(--ok)');
        save(); render(); overlay.remove();
      });
    };

    // ── INVITE MODAL ──────────────────────────────────────────────────────
    const showInviteModal = () => {
      const sv = getServer();
      const link = `https://discord.gg/${(sv?.name||'server').replace(/\s/g,'').toLowerCase().substring(0,8)}`;
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal">
          <div class="dcs-modal-hdr">Invite People</div>
          <div class="dcs-modal-body">
            <div class="dcs-label" style="margin-bottom:8px;">Send a server invite link to a friend</div>
            <div style="display:flex;gap:8px;">
              <input class="dcinput" style="flex:1;" value="${link}" readonly id="dc-inv-link-${id}" />
              <button class="dcbtn dcbtn-p" id="dc-inv-copy-${id}">Copy</button>
            </div>
            <div style="font-size:12px;color:var(--txm);margin-top:8px;">Your invite link expires in 7 days</div>
            <div class="dcs-divider"></div>
            <div class="dcs-label" style="margin-bottom:8px;">Or invite a friend directly</div>
            ${state.friends.slice(0,5).map(f=>{
              const fu=fakeUsers.find(u=>u.name===f)||{av:f[0],color:'#5865f2'};
              return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:6px;
                background:var(--bg-s);margin-bottom:6px;">
                <div style="width:32px;height:32px;border-radius:50%;background:${fu.color};
                  display:flex;align-items:center;justify-content:center;font-size:18px;">${fu.av}</div>
                <span style="flex:1;font-weight:500;color:var(--hp);">${f}</span>
                <button class="dcbtn dcbtn-p" style="font-size:12px;padding:4px 10px;"
                  onclick="this.textContent='✓ Invited';this.disabled=true;
                  this.closest('.dcs-overlay').querySelector('#dc-inv-toast').textContent='Invite sent to ${f}!';">
                  Invite</button>
              </div>`;
            }).join('')}
            <div id="dc-inv-toast" style="font-size:13px;color:var(--ok);min-height:20px;margin-top:4px;"></div>
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Done</button>
          </div>
        </div>`;
      content.appendChild(overlay);
      getEl(`dc-inv-copy-${id}`)?.addEventListener('click', ()=>{
        navigator.clipboard?.writeText(link).catch(()=>{});
        showToast('🔗 Invite link copied!','var(--ok)');
      });
    };

    // ── INBOX MODAL ───────────────────────────────────────────────────────
    const showInboxModal = () => {
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      const notifs = [
        { icon:'👋', text:`${state.friendReqs[0]||'Someone'} sent you a friend request`, time:'2m ago', color:'var(--br)' },
        { icon:'💬', text:'Alice mentioned you in #general', time:'15m ago', color:'var(--ok)' },
        { icon:'📌', text:'A message was pinned in #code-snippets', time:'1h ago', color:'var(--wrn)' },
        { icon:'🚀', text:'Vortarium Dev reached Boost Level 2!', time:'3h ago', color:'var(--nit)' },
        { icon:'🎉', text:'You leveled up to Level '+state.profile.level+'!', time:'5h ago', color:'var(--gld)' },
      ];
      overlay.innerHTML = `
        <div class="dcs-modal" style="width:480px;">
          <div class="dcs-modal-hdr" style="display:flex;align-items:center;justify-content:space-between;">
            <span>Inbox</span>
            <span style="font-size:13px;color:var(--txm);font-weight:400;">${notifs.length} notifications</span>
          </div>
          <div class="dcs-modal-body" style="max-height:400px;overflow-y:auto;">
            ${notifs.map(n=>`
              <div style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:8px;
                margin-bottom:6px;background:var(--bg-s);cursor:pointer;"
                onmouseenter="this.style.background='var(--bg-a)'"
                onmouseleave="this.style.background='var(--bg-s)'">
                <div style="width:36px;height:36px;border-radius:50%;background:${n.color}22;
                  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${n.icon}</div>
                <div style="flex:1;">
                  <div style="font-size:14px;color:var(--tx);">${n.text}</div>
                  <div style="font-size:12px;color:var(--txm);margin-top:2px;">${n.time}</div>
                </div>
              </div>`).join('')}
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Close</button>
            <button class="dcbtn dcbtn-p" onclick="this.closest('.dcs-overlay').remove()">Mark All Read</button>
          </div>
        </div>`;
      content.appendChild(overlay);
    };

    // ── SETTINGS MODAL ────────────────────────────────────────────────────
    const showSettingsModal = () => {
      const modal = document.createElement('div');
      modal.className = 'dcs-settings';
      const tabs = {
        'User Settings': ['My Account','Profile','Privacy & Safety','Authorized Apps'],
                'Billing':       ['Nitro','Server Boost','Gift Inventory'],
        'App Settings':  ['Appearance','Accessibility','Voice & Video','Notifications','Keybinds'],
        'Activity':      ['Activity Status','Game Activity'],
      };

      let activeTab = 'My Account';
      const renderSettingsContent = (tab) => {
        switch(tab) {
          case 'My Account': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">My Account</h2>
            <div style="background:var(--bg-s);border-radius:8px;overflow:hidden;margin-bottom:16px;">
              <div style="height:100px;background:${state.profile.banner.startsWith('linear')?state.profile.banner:`linear-gradient(135deg,${state.profile.banner},${state.profile.banner}88)`};"></div>
              <div style="padding:16px;position:relative;display:flex;justify-content:space-between;align-items:flex-end;">
                <div style="position:absolute;top:-40px;left:16px;width:80px;height:80px;border-radius:50%;
                  background:var(--br);border:6px solid var(--bg-s);display:flex;align-items:center;
                  justify-content:center;font-size:36px;cursor:pointer;" id="dc-set-av-${id}">${state.profile.avatar}</div>
                <div style="margin-top:44px;">
                  <div style="font-size:20px;font-weight:700;color:var(--hp);">${state.profile.username}</div>
                  <div style="font-size:13px;color:var(--txm);">#${state.profile.tag}</div>
                </div>
                <button class="dcbtn dcbtn-p" id="dc-set-save-${id}">Save Changes</button>
              </div>
            </div>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;">
              <div style="margin-bottom:16px;">
                <div class="dcs-label">Display Name</div>
                <input type="text" id="dc-set-name-${id}" class="dcinput" value="${state.profile.username}" />
              </div>
              <div style="margin-bottom:16px;">
                <div class="dcs-label">Custom Status</div>
                <input type="text" id="dc-set-status-${id}" class="dcinput" value="${state.profile.customStatus||''}" placeholder="Set a custom status..." />
              </div>
              <div>
                <div class="dcs-label">About Me</div>
                <textarea id="dc-set-bio-${id}" class="dcinput" style="resize:none;height:80px;">${state.profile.bio}</textarea>
              </div>
            </div>`;

          case 'Profile': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Profile Customization</h2>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;margin-bottom:16px;">
              <div class="dcs-label" style="margin-bottom:8px;">Avatar</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                ${['💻','😎','👾','🦊','🐱','🎭','👻','🚀','🕹️','🎮','🤖','🦁','🐸','🌙','⚡'].map(av=>`
                  <div style="width:48px;height:48px;border-radius:50%;background:var(--bg-t);display:flex;
                    align-items:center;justify-content:center;font-size:24px;cursor:pointer;
                    border:2px solid ${state.profile.avatar===av?'var(--br)':'transparent'};"
                    class="dc-av-opt" data-av="${av}">${av}</div>`).join('')}
              </div>
              <div class="dcs-label" style="margin-bottom:8px;">Profile Banner</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                ${['#5865F2','#e74c3c','#2ecc71','#f0b232','#9b59b6','#1abc9c','#e91e63','#ff5722',
                   'linear-gradient(135deg,#5865f2,#ff73fa)',
                   'linear-gradient(135deg,#f0b232,#e74c3c)',
                   'linear-gradient(135deg,#2ecc71,#1abc9c)',
                   'linear-gradient(135deg,#9b59b6,#5865f2)'].map(b=>`
                  <div style="width:56px;height:36px;border-radius:6px;
                    background:${b.startsWith('linear')?b:b};cursor:pointer;
                    border:2px solid ${state.profile.banner===b?'var(--hp)':'transparent'};"
                    class="dc-banner-opt" data-banner="${b}"></div>`).join('')}
              </div>
              <div class="dcs-label" style="margin-bottom:8px;">Profile Effect</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${[{id:'none',label:'None',preview:'⬜'},
                   {id:'sparkle',label:'Sparkle ✨',preview:'✨'},
                   {id:'fire',label:'Fire 🔥',preview:'🔥'},
                   {id:'rainbow',label:'Rainbow 🌈',preview:'🌈'},
                   {id:'snow',label:'Snow ❄️',preview:'❄️'}].map(ef=>`
                  <div style="padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;
                    background:${state.profile.effect===ef.id?'var(--br)':'var(--bg-t)'};
                    color:${state.profile.effect===ef.id?'#fff':'var(--tx)'};"
                    class="dc-effect-opt" data-effect="${ef.id}">${ef.preview} ${ef.label}</div>`).join('')}
              </div>
            </div>
            <button class="dcbtn dcbtn-p" id="dc-profile-save-${id}">Save Profile</button>`;

          case 'Privacy & Safety': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Privacy & Safety</h2>
            ${[
              {label:'Allow direct messages from server members', key:'allowDMs', val:true},
              {label:'Allow friend requests from server members', key:'allowFriendReqs', val:true},
              {label:'Show current activity to others', key:'showActivity', val:true},
              {label:'Allow screen reader access', key:'screenReader', val:false},
            ].map(s=>`
              <div style="display:flex;align-items:center;justify-content:space-between;
                padding:12px 0;border-bottom:1px solid var(--dv);">
                <div>
                  <div style="font-weight:500;color:var(--hp);">${s.label}</div>
                </div>
                <div class="dcs-toggle ${s.val?'on':''}" data-toggle="${s.key}"></div>
              </div>`).join('')}`;

          case 'Nitro': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Discord Nitro</h2>
            <div class="dcs-nitroupsell">
              <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
                <span style="font-size:48px;">💎</span>
                <div>
                  <div style="font-size:22px;font-weight:700;background:linear-gradient(135deg,#ff73fa,#5865f2);
                    -webkit-background-clip:text;-webkit-text-fill-color:transparent;">Discord Nitro</div>
                  <div style="font-size:14px;color:var(--txm);">Level up your Discord experience</div>
                </div>
              </div>
              ${state.profile.nitro ? `
                <div style="background:rgba(88,101,242,.2);border-radius:8px;padding:12px;margin-bottom:12px;">
                  <div style="font-weight:600;color:var(--hp);">✅ You have Nitro!</div>
                  <div style="font-size:13px;color:var(--txm);margin-top:4px;">Renews on ${new Date(Date.now()+30*24*60*60*1000).toLocaleDateString()}</div>
                </div>` : `
                <button class="dcbtn dcbtn-p" style="width:100%;margin-bottom:12px;" id="dc-buy-nitro-${id}">
                  Subscribe — $9.99/month
                </button>`}
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${[
                  {icon:'🎨',text:'Custom profile themes'},
                  {icon:'😀',text:'Animated avatars'},
                  {icon:'📁',text:'100MB file uploads'},
                  {icon:'🚀',text:'2 server boosts'},
                  {icon:'🎭',text:'Custom emoji anywhere'},
                  {icon:'🎬',text:'HD video streaming'},
                  {icon:'🏷️',text:'Custom tag'},
                  {icon:'💬',text:'Longer messages'},
                ].map(f=>`
                  <div style="display:flex;align-items:center;gap:8px;padding:8px;
                    background:rgba(255,255,255,.05);border-radius:6px;">
                    <span>${f.icon}</span>
                    <span style="font-size:13px;color:var(--tx);">${f.text}</span>
                  </div>`).join('')}
              </div>
            </div>`;

          case 'Appearance': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Appearance</h2>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;margin-bottom:16px;">
              <div class="dcs-label" style="margin-bottom:12px;">Theme</div>
              <div style="display:flex;gap:12px;margin-bottom:16px;">
                ${[{id:'dark',label:'Dark',bg:'#313338',sb:'#2b2d31'},
                   {id:'light',label:'Light',bg:'#ffffff',sb:'#f2f3f5'},
                   {id:'amoled',label:'AMOLED',bg:'#000000',sb:'#111111'}].map(t=>`
                  <div style="cursor:pointer;text-align:center;" class="dc-theme-opt" data-theme="${t.id}">
                    <div class="dcs-themepreview ${state.theme===t.id?'selected':''}">
                      <div style="width:30%;background:${t.sb};"></div>
                      <div style="flex:1;background:${t.bg};"></div>
                    </div>
                    <div style="font-size:13px;color:${state.theme===t.id?'var(--br)':'var(--txm)'};margin-top:4px;">${t.label}</div>
                  </div>`).join('')}
              </div>
              <div class="dcs-label" style="margin-bottom:8px;">Message Display</div>
              <div style="display:flex;gap:8px;margin-bottom:16px;">
                ${['cozy','compact'].map(m=>`
                  <div style="flex:1;padding:10px;border-radius:8px;cursor:pointer;text-align:center;
                    border:2px solid ${state.messageDisplay===m?'var(--br)':'var(--dv)'};"
                    class="dc-display-opt" data-display="${m}">
                    <div style="font-weight:600;color:var(--hp);text-transform:capitalize;">${m}</div>
                    <div style="font-size:12px;color:var(--txm);">${m==='cozy'?'More space between messages':'Compact, information-dense'}</div>
                  </div>`).join('')}
              </div>
              <div class="dcs-label" style="margin-bottom:8px;">Font Size — ${state.fontSize}px</div>
              <input type="range" id="dc-fontsize-${id}" min="12" max="20" value="${state.fontSize}"
                style="width:100%;accent-color:var(--br);" />
              <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--txm);">
                <span>12px</span><span>16px</span><span>20px</span>
              </div>
            </div>`;

          case 'Accessibility': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Accessibility</h2>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;">
              ${[
                {label:'Reduce Motion', desc:'Disables animations and transitions', key:'reducedMotion', val:state.reducedMotion},
                {label:'High Contrast Mode', desc:'Increases contrast for readability', key:'highContrast', val:false},
                {label:'Always Show Link Previews', desc:'Show previews for all links', key:'linkPreviews', val:true},
                {label:'Keyboard Navigation', desc:'Enhanced keyboard shortcuts', key:'keyboardNav', val:false},
              ].map(s=>`
                <div style="display:flex;align-items:flex-start;justify-content:space-between;
                  padding:12px 0;border-bottom:1px solid var(--dv);">
                  <div>
                    <div style="font-weight:500;color:var(--hp);">${s.label}</div>
                    <div style="font-size:12px;color:var(--txm);margin-top:2px;">${s.desc}</div>
                  </div>
                  <div class="dcs-toggle ${s.val?'on':''}" data-toggle="${s.key}" style="margin-left:16px;flex-shrink:0;"></div>
                </div>`).join('')}
            </div>`;

          case 'Voice & Video': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Voice & Video</h2>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;margin-bottom:16px;">
              <div class="dcs-label" style="margin-bottom:8px;">Input Volume</div>
              <input type="range" min="0" max="100" value="80" style="width:100%;accent-color:var(--br);" />
              <div class="dcs-label" style="margin-top:12px;margin-bottom:8px;">Output Volume</div>
              <input type="range" min="0" max="100" value="100" style="width:100%;accent-color:var(--br);" />
              <div class="dcs-label" style="margin-top:12px;margin-bottom:8px;">Noise Suppression</div>
              <div style="display:flex;gap:8px;">
                ${['None','Krisp','Standard'].map(m=>`
                  <div style="flex:1;padding:8px;border-radius:6px;cursor:pointer;text-align:center;
                    border:2px solid ${m==='Krisp'?'var(--br)':'var(--dv)'};">
                    <div style="font-size:13px;color:var(--hp);">${m}</div>
                  </div>`).join('')}
              </div>
            </div>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;">
              ${[
                {label:'Echo Cancellation', val:true},
                {label:'Noise Reduction', val:true},
                {label:'Automatic Gain Control', val:true},
                {label:'Push to Talk', val:false},
              ].map(s=>`
                <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:10px 0;border-bottom:1px solid var(--dv);">
                  <span style="color:var(--hp);">${s.label}</span>
                  <div class="dcs-toggle ${s.val?'on':''}"></div>
                </div>`).join('')}
            </div>`;

          case 'Notifications': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Notifications</h2>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;margin-bottom:16px;">
              <div class="dcs-label" style="margin-bottom:12px;">Desktop Notifications</div>
              ${[
                {label:'Enable Desktop Notifications', val:true},
                {label:'Enable Unread Message Badge', val:true},
                {label:'Mute All Sounds', val:!state.soundEnabled},
                {label:'Push to Talk Release Delay', val:false},
              ].map(s=>`
                <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:10px 0;border-bottom:1px solid var(--dv);">
                  <span style="color:var(--hp);">${s.label}</span>
                  <div class="dcs-toggle ${s.val?'on':''}"></div>
                </div>`).join('')}
            </div>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;">
              <div class="dcs-label" style="margin-bottom:8px;">Notification Sound</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${['Default','Plink','Boop','Ping','None'].map(s=>`
                  <div style="padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;
                    background:${s==='Default'?'var(--br)':'var(--bg-t)'};
                    color:${s==='Default'?'#fff':'var(--tx)'};"
                    onclick="this.parentElement.querySelectorAll('div').forEach(x=>{x.style.background='var(--bg-t)';x.style.color='var(--tx)'});this.style.background='var(--br)';this.style.color='#fff'">
                    ${s}</div>`).join('')}
              </div>
            </div>`;

          case 'Activity Status': return `
            <h2 style="color:var(--hp);margin-bottom:24px;">Activity Status</h2>
            <div style="background:var(--bg-s);border-radius:8px;padding:16px;margin-bottom:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <div>
                  <div style="font-weight:600;color:var(--hp);">Display current activity as status</div>
                  <div style="font-size:13px;color:var(--txm);margin-top:2px;">Shows what you're playing or listening to</div>
                </div>
                <div class="dcs-toggle on"></div>
              </div>
              <div class="dcs-label" style="margin-bottom:8px;">Current Rich Presence</div>
              <div class="dcs-presence">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="font-size:32px;">💻</span>
                  <div>
                    <div class="dcs-presence-title">VS Code</div>
                    <div class="dcs-presence-sub">Editing discord.js</div>
                    <div class="dcs-presence-sub">for 2 hours</div>
                  </div>
                </div>
              </div>
            </div>`;

          default: return `
            <h2 style="color:var(--hp);margin-bottom:24px;">${tab}</h2>
            <div style="color:var(--txm);">This section is coming soon.</div>`;
        }
      };

      modal.innerHTML = `
        <div class="dcs-setnav">
          <div class="dcs-setnav-inner">
            ${Object.entries(tabs).map(([section, items])=>`
              <div class="dcs-setsec">${section}</div>
              ${items.map(t=>`
                <div class="dcs-setitem ${t===activeTab?'active':''}" data-settab="${t}">${t}</div>`).join('')}
            `).join('')}
            <div class="dcs-setsec">Info</div>
            <div class="dcs-setitem" data-settab="Changelog">What's New</div>
            <div class="dcs-setitem" data-settab="Credits">Credits</div>
            <div class="dcs-divider"></div>
            <div class="dcs-setitem" style="color:var(--dng);" data-settab="logout">Log Out</div>
          </div>
        </div>
        <div class="dcs-setcontent" id="dc-settings-content-${id}">
          <div class="dcs-setclose" id="dc-settings-close-${id}">
            ${I.close}<div style="font-size:12px;margin-top:4px;font-weight:600;">ESC</div>
          </div>
          ${renderSettingsContent(activeTab)}
        </div>`;
      content.appendChild(modal);

      const refreshContent = (tab) => {
        const el = getEl(`dc-settings-content-${id}`);
        if (!el) return;
        el.innerHTML = `
          <div class="dcs-setclose" id="dc-settings-close-${id}">
            ${I.close}<div style="font-size:12px;margin-top:4px;font-weight:600;">ESC</div>
          </div>
          ${renderSettingsContent(tab)}`;
        bindSettingsEvents();
      };

      // Tab clicks
      modal.querySelectorAll('[data-settab]').forEach(tab => {
        tab.addEventListener('click', () => {
          if (tab.dataset.settab === 'logout') {
            modal.remove();
            showToast('👋 Logged out (simulated)','var(--txm)');
            return;
          }
          modal.querySelectorAll('[data-settab]').forEach(t=>t.classList.remove('active'));
          tab.classList.add('active');
          activeTab = tab.dataset.settab;
          refreshContent(activeTab);
        });
      });

      const bindSettingsEvents = () => {
        // Close
        getEl(`dc-settings-close-${id}`)?.addEventListener('click', ()=>modal.remove());

        // Account save
        getEl(`dc-set-save-${id}`)?.addEventListener('click', ()=>{
          state.profile.username    = getEl(`dc-set-name-${id}`)?.value.trim()   || state.profile.username;
          state.profile.customStatus= getEl(`dc-set-status-${id}`)?.value.trim() || '';
          state.profile.bio         = getEl(`dc-set-bio-${id}`)?.value           || state.profile.bio;
          showToast('✅ Account saved','var(--ok)'); save(); render();
        });

        // Avatar click cycle
        getEl(`dc-set-av-${id}`)?.addEventListener('click', (e)=>{
          const avs=['💻','😎','👾','🦊','🐱','🎭','👻','🚀','🕹️','🎮','🤖','🦁'];
          const idx = avs.indexOf(state.profile.avatar);
          state.profile.avatar = avs[(idx+1)%avs.length];
          e.target.textContent = state.profile.avatar;
        });

        // Avatar options
        modal.querySelectorAll('.dc-av-opt').forEach(el=>{
          el.addEventListener('click', ()=>{
            modal.querySelectorAll('.dc-av-opt').forEach(x=>x.style.borderColor='transparent');
            el.style.borderColor='var(--br)';
            state.profile.avatar=el.dataset.av;
          });
        });

        // Banner options
        modal.querySelectorAll('.dc-banner-opt').forEach(el=>{
          el.addEventListener('click', ()=>{
            modal.querySelectorAll('.dc-banner-opt').forEach(x=>x.style.borderColor='transparent');
            el.style.borderColor='var(--hp)';
            state.profile.banner=el.dataset.banner;
          });
        });

        // Effect options
        modal.querySelectorAll('.dc-effect-opt').forEach(el=>{
          el.addEventListener('click', ()=>{
            modal.querySelectorAll('.dc-effect-opt').forEach(x=>{
              x.style.background='var(--bg-t)'; x.style.color='var(--tx)';
            });
            el.style.background='var(--br)'; el.style.color='#fff';
            state.profile.effect=el.dataset.effect;
          });
        });

        // Profile save
        getEl(`dc-profile-save-${id}`)?.addEventListener('click', ()=>{
          showToast('✅ Profile saved','var(--ok)'); save(); render();
        });

        // Theme options
        modal.querySelectorAll('.dc-theme-opt').forEach(el=>{
          el.addEventListener('click', ()=>{
            state.theme=el.dataset.theme;
            // Apply theme vars
            const root = content.querySelector(`.dc${id}`);
            if (root) {
              if (state.theme==='light') {
                root.style.setProperty('--bg-p','#ffffff');
                root.style.setProperty('--bg-s','#f2f3f5');
                root.style.setProperty('--bg-t','#e3e5e8');
                root.style.setProperty('--tx','#2e3338');
                root.style.setProperty('--hp','#060607');
                root.style.setProperty('--txm','#4e5058');
              } else if (state.theme==='amoled') {
                root.style.setProperty('--bg-p','#000000');
                root.style.setProperty('--bg-s','#0a0a0a');
                root.style.setProperty('--bg-t','#111111');
                root.style.setProperty('--tx','#dbdee1');
                root.style.setProperty('--hp','#ffffff');
                root.style.setProperty('--txm','#949ba4');
              } else {
                root.style.setProperty('--bg-p','#313338');
                root.style.setProperty('--bg-s','#2b2d31');
                root.style.setProperty('--bg-t','#1e1f22');
                root.style.setProperty('--tx','#dbdee1');
                root.style.setProperty('--hp','#f2f3f5');
                root.style.setProperty('--txm','#949ba4');
              }
            }
            save(); refreshContent('Appearance');
          });
        });

        // Message display
        modal.querySelectorAll('.dc-display-opt').forEach(el=>{
          el.addEventListener('click', ()=>{
            state.messageDisplay=el.dataset.display;
            save(); refreshContent('Appearance');
          });
        });

        // Font size
        getEl(`dc-fontsize-${id}`)?.addEventListener('input', (e)=>{
          state.fontSize=parseInt(e.target.value);
          save();
        });

        // Toggles
        modal.querySelectorAll('.dcs-toggle[data-toggle]').forEach(el=>{
          el.addEventListener('click', ()=>{
            el.classList.toggle('on');
            const key=el.dataset.toggle;
            if (key==='reducedMotion') state.reducedMotion=el.classList.contains('on');
            if (key==='soundEnabled')  state.soundEnabled=el.classList.contains('on');
            save();
          });
        });

        // Buy Nitro
        getEl(`dc-buy-nitro-${id}`)?.addEventListener('click', ()=>{
          state.profile.nitro=true;
          showToast('💎 Welcome to Nitro!','var(--nit)');
          if (!state.profile.achievements.includes('nitro')) {
            state.profile.achievements.push('nitro');
            state.profile.xp+=200;
            showToast('💎 Achievement Unlocked: Nitro Subscriber (+200 XP)','var(--gld)');
          }
          save(); refreshContent('Nitro');
        });
      };

      bindSettingsEvents();

      // ESC key to close
      const escHandler = (e) => { if (e.key==='Escape') { modal.remove(); document.removeEventListener('keydown',escHandler); } };
      document.addEventListener('keydown', escHandler);
    };

    // ── SEED INITIAL MESSAGES ─────────────────────────────────────────────
    const seedMessages = () => {
      const seeds = {
        c3: [
          { author:'Alice',   av:'👩',  text:'hey everyone! 👋' },
          { author:'BotGuy',  av:'🤖',  text:'Hello! I am definitely a real human person.' },
          { author:'Dave',    av:'🧔',  text:'lmaooo 💀' },
          { author:'Alice',   av:'👩',  text:'anyone working on anything cool rn?' },
          { author:'Logan',   av:'💻',  text:'yeah building this discord clone lol' },
          { author:'Eve',     av:'👩‍💻', text:'wait that\'s actually fire **send the repo**' },
          { author:'Dave',    av:'🧔',  text:'W build fr fr' },
          { author:'BotGuy',  av:'🤖',  text:'I have analyzed the codebase. It is... acceptable.' },
          { author:'Alice',   av:'👩',  text:'lol okay BotGuy 😭' },
          { author:'Logan',   av:'💻',  text:'check out this snippet:\n```js\nconst discord = new DiscordClone();\ndiscord.launch();\n```' },
          { author:'Eve',     av:'👩‍💻', text:'okay that\'s actually clean ngl' },
          { author:'Dave',    av:'🧔',  text:'https://github.com check it out' },
        ],
        c4: [
                    { author:'Eve',    av:'👩‍💻', text:'here\'s a useful pattern:\n```js\nconst memoize = fn => {\n  const cache = {};\n  return (...args) => cache[args] ?? (cache[args] = fn(...args));\n};\n```' },
          { author:'Alice',  av:'👩',  text:'saving this 🔥' },
          { author:'Dave',   av:'🧔',  text:'bro I\'ve been looking for this for weeks' },
        ],
        c6: [
          { author:'Dave',  av:'🧔',  text:'server ip is play.vortarium.net' },
          { author:'Eve',   av:'👩‍💻', text:'on my way 🎮' },
          { author:'Alice', av:'👩',  text:'wait for me!!' },
        ],
        dm1: [
          { author:'Alice', av:'👩',  text:'hey!! how\'s the project going?' },
          { author:'Logan', av:'💻',  text:'pretty good actually, almost done with the UI' },
          { author:'Alice', av:'👩',  text:'omg send screenshots when it\'s ready 👀' },
          { author:'Logan', av:'💻',  text:'will do 🔥' },
        ],
        dm2: [
          { author:'BotGuy', av:'🤖', text:'GREETINGS HUMAN. I AM BOTGUY. I AM NORMAL.' },
          { author:'Logan',  av:'💻', text:'sure you are lol' },
          { author:'BotGuy', av:'🤖', text:'I HAVE CALCULATED THAT YOUR CODE IS 94.7% OPTIMAL.' },
        ],
      };

      Object.entries(seeds).forEach(([chId, msgs]) => {
        if (!state.messages[chId] || state.messages[chId].length === 0) {
          msgs.forEach(m => addMessage(chId, m.author, m.text, m.av));
        }
      });
    };

    // ── ACHIEVEMENTS PANEL (accessible from settings) ─────────────────────
    const showAchievementsModal = () => {
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      const earned = state.profile.achievements || [];
      overlay.innerHTML = `
        <div class="dcs-modal" style="width:500px;">
          <div class="dcs-modal-hdr">
            🏆 Achievements
            <span style="font-size:14px;font-weight:400;color:var(--txm);margin-left:8px;">
              ${earned.length}/${ACHIEVEMENTS.length} unlocked
            </span>
          </div>
          <div class="dcs-modal-body" style="max-height:440px;overflow-y:auto;">
            <div style="margin-bottom:12px;">
              <div class="dcs-label" style="margin-bottom:4px;">Total XP</div>
              <div style="font-size:24px;font-weight:700;color:var(--br);">${state.profile.xp} XP</div>
              <div class="dcs-xpbar" style="margin-top:6px;">
                <div class="dcs-xpfill" style="width:${Math.min((state.profile.xp%200)/2,100)}%;"></div>
              </div>
              <div style="font-size:12px;color:var(--txm);margin-top:4px;">
                Level ${state.profile.level} · ${state.profile.xp%200}/200 XP to next level
              </div>
            </div>
            <div class="dcs-divider"></div>
            ${ACHIEVEMENTS.map(a => {
              const unlocked = earned.includes(a.id);
              return `
                <div class="dcs-achievement ${unlocked?'':'locked'}">
                  <div style="font-size:36px;">${a.icon}</div>
                  <div style="flex:1;">
                    <div style="font-weight:600;color:var(--hp);">${a.name}</div>
                    <div style="font-size:13px;color:var(--txm);">${a.desc}</div>
                    <div style="font-size:12px;color:var(--gld);margin-top:2px;">+${a.xp} XP</div>
                  </div>
                  <div style="font-size:20px;">${unlocked ? '✅' : '🔒'}</div>
                </div>`;
            }).join('')}
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Close</button>
          </div>
        </div>`;
      content.appendChild(overlay);
    };

    // ── RICH PRESENCE SIMULATION ──────────────────────────────────────────
    const updateRichPresence = () => {
      const activities = [
        { game:'VS Code',        detail:'Editing discord.js',     since:'2h ago' },
        { game:'Geometry Dash',  detail:'Level: Bloodbath',       since:'45m ago' },
        { game:'Minecraft',      detail:'Survival Mode',          since:'1h ago' },
        { game:'Spotify',        detail:'Listening to Lo-Fi Beats',since:'30m ago' },
        { game:'Chrome',         detail:'Browsing the web',       since:'10m ago' },
      ];
      // Randomly update fake user presences
      state.dms.forEach(dm => {
        if (Math.random() < 0.3) {
          const act = activities[Math.floor(Math.random()*activities.length)];
          dm.presence = { game:act.game, since:act.since };
        }
      });
    };

    // ── FAKE WEBSOCKET EVENT LOG (visible in dev mode) ────────────────────
    const showWSLog = () => {
      const overlay = document.createElement('div');
      overlay.className = 'dcs-overlay';
      overlay.innerHTML = `
        <div class="dcs-modal" style="width:560px;">
          <div class="dcs-modal-hdr">⚡ WebSocket Event Log</div>
          <div class="dcs-modal-body" style="max-height:400px;overflow-y:auto;font-family:monospace;">
            ${wsEvents.length ? wsEvents.slice().reverse().map(e=>`
              <div style="padding:6px 0;border-bottom:1px solid var(--dv);font-size:12px;">
                <span style="color:var(--br);font-weight:700;">${e.event}</span>
                <span style="color:var(--txm);margin-left:8px;">${new Date(e.ts).toLocaleTimeString()}</span>
                <div style="color:var(--tx);margin-top:2px;word-break:break-all;">
                  ${JSON.stringify(e.data).substring(0,120)}
                </div>
              </div>`).join('') : '<div style="color:var(--txm);padding:16px;">No events yet.</div>'}
          </div>
          <div class="dcs-modal-ftr">
            <button class="dcbtn dcbtn-s" onclick="this.closest('.dcs-overlay').remove()">Close</button>
            <button class="dcbtn dcbtn-p" id="dc-ws-fire-${id}">Fire Test Event</button>
          </div>
        </div>`;
      content.appendChild(overlay);
      getEl(`dc-ws-fire-${id}`)?.addEventListener('click', ()=>{
        fakeWS.emit('TEST_EVENT', { message:'Hello from fake WebSocket!', ts:Date.now() });
        showToast('⚡ Test event fired','var(--br)');
        overlay.remove(); showWSLog();
      });
    };

    // ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────
    const keyHandler = (e) => {
      // Only handle if our app is focused
      if (!content.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'k': e.preventDefault(); state.searchOpen=!state.searchOpen; render(); break;
          case ',': e.preventDefault(); showSettingsModal(); break;
          case 'b': e.preventDefault(); state.membersOpen=!state.membersOpen; render(); break;
        }
      }
      if (e.key==='Escape') {
        document.querySelectorAll('.dcs-ctx,.dcs-popout,.dc-hovercard,.dcs-emojipicker,.dc-attach-menu,.dc-reaction-picker').forEach(el=>el.remove());
      }
    };
    document.addEventListener('keydown', keyHandler);

    // ── CLEANUP ON WINDOW CLOSE ───────────────────────────────────────────
    const observer = new MutationObserver(() => {
      if (!document.contains(content)) {
        // Window was closed — clean up
        clearInterval(bgEventInterval);
        document.removeEventListener('keydown', keyHandler);
        document.querySelectorAll('.dcs-ctx,.dcs-popout,.dc-hovercard,.dcs-toast,.dcs-emojipicker').forEach(el=>el.remove());
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList:true, subtree:true });

    // ── INIT ──────────────────────────────────────────────────────────────
    seedMessages();
    render();
    startBackgroundEvents();

    // Stagger some initial fake activity
    setTimeout(() => {
      const sv = getServer();
      if (sv) {
        const ch = getAllChannels(sv).find(c=>c.type==='text');
        if (ch) showTyping(ch.id, 'Alice');
      }
    }, 2000);

    setTimeout(() => {
      updateRichPresence();
      fakeWS.emit('READY', {
        user: state.profile.username,
        guilds: state.servers.map(s=>s.id),
        session_id: Math.random().toString(36).substring(2,10),
      });
    }, 1000);

    setTimeout(() => {
      showToast(`👋 Welcome back, ${state.profile.username}!`, 'var(--br)', '💬');
    }, 500);

    // Periodic rich presence updates
    setInterval(updateRichPresence, 30000);

    // Periodic unread badge refresh
    setInterval(() => {
      const badge = content.querySelector('.dcs-svbadge');
      const total = Object.values(state.unread).reduce((a,b)=>a+b,0);
      if (badge) badge.textContent = total > 0 ? total : '';
    }, 5000);

  } // end launch()
}); // end AppLauncher.register

