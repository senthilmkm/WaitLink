/**
 * JumpIn phone shell. Loaded only when ?s=jumpin.
 * Removes every listener it adds.
 */
(function (root, factory) {
  const api = factory();
  /* c8 ignore start */
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root && root.document) api.start(root);
  /* c8 ignore end */
})(typeof window !== "undefined" ? window : globalThis, function () {
  /* c8 ignore next */
  const core = typeof require === "function" ? require("./core.js") : globalThis.JumpInCore;
  /* c8 ignore next */
  const ui = typeof require === "function" ? require("./ui-state.js") : globalThis.JumpInUi;
  const cleanups = [];

  function on(target, type, fn) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, fn);
    cleanups.push(function () { target.removeEventListener(type, fn); });
  }

  function el(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function track(doc) {
    let node = doc.getElementById("jumpin-root");
    if (!node) {
      node = el(doc, "div");
      node.id = "jumpin-root";
      doc.body.appendChild(node);
    }
    return node;
  }

  function applyShell(win, rootNode, mode) {
    if (mode === "board" || mode === "posted") {
      rootNode.style.height = "auto";
      rootNode.style.overflow = "visible";
      return;
    }
    const view = win.visualViewport;
    const height = view && view.height ? view.height : (win.innerHeight || 0);
    rootNode.style.height = height + "px";
    rootNode.style.overflow = "hidden";
  }

  function ensureStyle(doc) {
    if (doc.getElementById("jumpin-style")) return;
    const style = el(doc, "style");
    style.id = "jumpin-style";
    style.textContent = [
      "html:has(body.jumpin-on),body.jumpin-on{display:block !important;height:auto;min-height:100%;background:var(--bg-dark,#f1f5f9);color:var(--text-main,#090d16)}",
      "body.jumpin-on{margin:0;overflow:auto}",
      "body.jumpin-on > *:not(#jumpin-root){display:none !important}",
      "#jumpin-root{display:flex;flex-direction:column;width:100%;max-width:100vw;overflow-x:hidden;min-height:100%;background:radial-gradient(circle at top right,#ecfeff 0%,#f8fafc 45%,#f1f5f9 100%);color:var(--text-main,#090d16);font-family:var(--font-family-body,Inter,-apple-system,BlinkMacSystemFont,sans-serif);font-size:16px;line-height:1.5}",
      "#jumpin-root.portal{min-height:100dvh}",
      "#jumpin-root *{box-sizing:border-box}",
      "#jumpin-root a{color:inherit;text-decoration:none}",
      "#jumpin-top,#jumpin-bottom{flex:0 0 auto}",
      "#jumpin-top{position:sticky;top:0;z-index:20;width:100%;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.03)}",
      "#jumpin-top .bar{width:min(1040px,100%);margin:0 auto;display:flex;align-items:center;gap:16px;min-height:64px;padding:12px 24px calc(12px + env(safe-area-inset-top))}",
      "#jumpin-top .brand{display:flex;align-items:center;gap:8px;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-weight:700;font-size:18px}",
      "#jumpin-top .mark{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:rgba(8,145,178,.12)}",
      "#jumpin-top .product{color:var(--primary,#0891b2);font-weight:700}",
      "#jumpin-top nav{margin-left:auto;display:flex;align-items:center;gap:16px}",
      "#jumpin-top nav a{color:var(--text-muted,#1e293b);font-weight:600}",
      "#jumpin-top .title{font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:18px}",
      "#jumpin-root.app-screen{width:100%;height:auto !important;min-height:100dvh;overflow:visible !important;background:var(--bg-dark,#f1f5f9)}",
      "#jumpin-root.app-screen #jumpin-top{display:flex;align-items:center;gap:12px;width:100%;padding:0 16px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root.app-screen #jumpin-top .bar{flex:1;padding:12px 0;min-height:56px}",
      "#jumpin-root.app-screen #jumpin-top .back-btn{flex-shrink:0}",
      "#jumpin-mid{flex:1 1 auto;width:100%;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:none}",
      "#jumpin-root.app-screen #jumpin-mid{flex:1 0 auto;width:100%;max-width:640px;margin:0 auto;padding:24px 20px 28px;overflow:visible}",
      "#jumpin-root.app-screen #jumpin-mid.post-card{width:calc(100% - 32px);max-width:640px;margin:24px auto;padding:28px 32px;background:var(--bg-card,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:0 10px 28px rgba(15,23,42,.07)}",
      "#jumpin-mid .wrap{width:min(1080px,100%);margin:0 auto;padding:28px 24px 16px}",
      "#jumpin-mid .hero{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;margin:0 0 22px;padding:28px 32px;background:linear-gradient(135deg,#ffffff 0%,#f0fdfa 58%,#e0f2fe 100%);border:1px solid #bae6fd;border-top:3px solid var(--primary,#0891b2);border-radius:var(--radius-lg,20px);box-shadow:0 12px 30px rgba(8,145,178,.09)}",
      "#jumpin-mid .hero-eyebrow{display:inline-block;padding:4px 10px;margin:0 0 10px;border-radius:999px;background:rgba(8,145,178,.12);color:#0e7490;font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}",
      "#jumpin-mid .hero .copy{flex:1 1 260px;min-width:0}",
      "#jumpin-mid h1{margin:0 0 8px;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:36px;line-height:1.15;letter-spacing:-0.03em}",
      "#jumpin-mid .hero button{width:auto;min-width:200px;flex:0 0 auto;padding:0 24px;cursor:pointer;box-shadow:0 6px 18px rgba(8,145,178,.24)}",
      "#jumpin-mid .board{display:grid;grid-template-columns:1fr;gap:14px}",
      "@media (min-width:740px){#jumpin-mid .board{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}",
      "@media (min-width:1040px){#jumpin-mid .board{grid-template-columns:repeat(3,minmax(0,1fr))}}",
      "#jumpin-mid .empty{grid-column:1 / -1;padding:32px 24px;text-align:center;background:var(--bg-card,#fff);border:1px dashed #cbd5e1;border-radius:16px;box-shadow:0 4px 14px rgba(15,23,42,.03)}",
      "#jumpin-mid .empty-icon{display:inline-grid;place-items:center;width:44px;height:44px;margin:0 auto 10px;border-radius:12px;background:#ecfeff;border:1px solid #a5f3fc;font-size:20px}",
      "#jumpin-mid .empty .route{margin:0 0 4px}",
      "#jumpin-bottom{width:100%;padding:0 16px calc(16px + env(safe-area-inset-bottom))}",
      "#jumpin-root.portal #jumpin-bottom{margin-top:auto;padding:0;background:var(--bg-card,#fff);border-top:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root .site-foot{width:min(1040px,100%);margin:0 auto;padding:16px 24px calc(16px + env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center;color:var(--text-muted,#1e293b);font-size:14px}",
      "#jumpin-root .site-foot a{color:var(--primary,#0891b2);font-weight:600}",
      "#jumpin-root .site-foot .spacer{margin-left:auto}",
      "#jumpin-root.app-screen #jumpin-bottom{position:sticky;bottom:0;margin-top:auto;padding:14px 20px calc(14px + env(safe-area-inset-bottom));background:var(--bg-card,#fff);border-top:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root.app-screen.form-open #jumpin-bottom,#jumpin-root.app-screen:has(#jumpin-mid input:focus,#jumpin-mid select:focus) #jumpin-bottom{position:static;margin-top:0;padding:8px 16px calc(24px + env(safe-area-inset-bottom));background:transparent;border-top:0}",
      "@media (min-width:701px){#jumpin-root.app-screen #jumpin-mid{padding:36px 24px 20px}#jumpin-root.app-screen #jumpin-bottom{position:static;margin-top:0;padding:8px 24px 32px;background:transparent;border-top:0}}",
      "#jumpin-mid .hero button,#jumpin-bottom button{min-height:52px;border:0;border-radius:var(--radius-md,14px);background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);color:#fff;font-size:17px;font-weight:700;cursor:pointer;transition:transform .12s,box-shadow .15s,filter .15s}",
      "#jumpin-mid .hero button:hover,#jumpin-bottom button:hover{filter:brightness(1.05)}",
      "#jumpin-root.app-screen #jumpin-bottom button{display:block;width:100%;max-width:640px;margin:0 auto}",
      "#jumpin-bottom button:disabled,#jumpin-root .textish:disabled{opacity:.55;cursor:not-allowed}",
      "body.jumpin-android #jumpin-bottom button,body.jumpin-android #jumpin-mid .hero button{border-radius:var(--radius-lg,20px)}",
      "#jumpin-mid .lbl{display:block;margin:0 0 6px;color:var(--text-muted,#1e293b);font-size:14px;font-weight:600}",
      "#jumpin-mid input,#jumpin-mid select{width:100%;min-width:0;max-width:100%;font-size:16px;min-height:44px;margin:0 0 14px;padding:0 12px;scroll-margin-top:88px;scroll-margin-bottom:120px;color:var(--text-main,#090d16);background:var(--bg-input,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-sm,8px)}",
      "#jumpin-mid .confirm{padding:32px 36px;background:var(--bg-card,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:0 10px 28px rgba(15,23,42,.07)}",
      "#jumpin-mid .confirm-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;margin:0 0 12px;border-radius:999px;background:rgba(8,145,178,.1);color:var(--primary,#0891b2);font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}",
      "#jumpin-mid .confirm-badge.pending{background:#fef3c7;color:#92400e}",
      "#jumpin-mid .confirm h1{font-size:28px;margin:0 0 4px}",
      "#jumpin-mid .confirm .route{margin:0 0 6px;font-size:20px}",
      "#jumpin-mid .confirm h1 + .route{margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color,#e2e8f0)}",
      "#jumpin-mid .confirm .muted{margin:4px 0;font-size:15px}",
      "#jumpin-mid .confirm .link-row{margin:6px 0 10px}",
      "#jumpin-mid .confirm .action-row{margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color,#e2e8f0)}",
      "#jumpin-mid .row{display:flex;flex-direction:column;align-items:flex-start;gap:6px;width:100%;text-align:left;min-height:44px;padding:18px;margin:0;background:var(--bg-card,#fff);color:inherit;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 4px 14px rgba(15,23,42,.05);cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}",
      "#jumpin-mid .row:hover{border-color:var(--primary,#0891b2);box-shadow:0 8px 20px rgba(8,145,178,.12);transform:translateY(-1px)}",
      "#jumpin-mid .row.role-driver{border-left:4px solid #4f46e5;background:linear-gradient(180deg,#ffffff 0%,#f8faff 100%)}",
      "#jumpin-mid .row.role-rider{border-left:4px solid #059669;background:linear-gradient(180deg,#ffffff 0%,#f4fbf8 100%)}",
      "#jumpin-mid .card-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;width:100%;margin-top:6px;padding-top:10px;border-top:1px solid #f1f5f9;font-size:13px;color:var(--text-muted,#334155)}",
      "#jumpin-mid .foot-driver{display:inline-flex;align-items:center;gap:7px;font-weight:600;min-width:0}",
      "#jumpin-mid .foot-right{display:inline-flex;align-items:center;gap:8px;font-weight:600;margin-left:auto}",
      "#jumpin-mid .cost-tag{padding:2px 8px;border-radius:999px;background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;font-weight:700;font-size:12px}",
      "#jumpin-mid .mini-av{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:999px;background:rgba(8,145,178,.14);color:#0e7490;font-size:12px;font-weight:700;flex-shrink:0}",
      "#jumpin-mid .info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 14px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px}",
      "#jumpin-mid .info-tile{min-width:0}",
      "#jumpin-mid .info-k{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:0 0 2px}",
      "#jumpin-mid .info-v{font-size:14px;font-weight:600;color:var(--text-main,#090d16);overflow-wrap:anywhere}",
      "#jumpin-mid .post-head{margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0}",
      "#jumpin-mid .post-head h1{font-size:26px;margin:0}",
      "#jumpin-mid .row-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;width:100%}",
      "#jumpin-mid .pill-group{display:inline-flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex:0 0 auto}",
      "#jumpin-mid .status-pill{flex:0 0 auto;white-space:nowrap;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;line-height:1.3;border:1px solid transparent}",
      "#jumpin-mid .status-pill.open{background:rgba(8,145,178,.1);color:var(--primary,#0891b2);border-color:rgba(8,145,178,.22)}",
      "#jumpin-mid .status-pill.last{background:#fffbeb;color:#b45309;border-color:#fde68a}",
      "#jumpin-mid .status-pill.full{background:#fef2f2;color:#be123c;border-color:#fecdd3}",
      "#jumpin-mid .status-pill.driver{background:#eef2ff;color:#3730a3;border-color:#c7d2fe}",
      "#jumpin-mid .status-pill.rider{background:#ecfdf5;color:#047857;border-color:#a7f3d0}",
      "#jumpin-mid .route{font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:18px;font-weight:700;overflow-wrap:anywhere;word-break:break-word}",
      "#jumpin-mid .meta,#jumpin-mid .muted{color:var(--text-muted,#1e293b);font-size:14px;margin:0;overflow-wrap:anywhere}",
      "#jumpin-mid .hint{color:var(--text-muted,#1e293b);font-size:14px;margin:8px 0 0}",
      "#jumpin-root #jumpin-mid .error{color:#dc2626 !important;font-weight:600;font-size:14px;margin:6px 0 12px;padding:8px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;overflow-wrap:anywhere}",
      "@media (max-width:700px){#jumpin-root.app-screen:has(#jumpin-mid input:focus,#jumpin-mid select:focus){padding-bottom:42vh}#jumpin-top .bar{padding:calc(10px + env(safe-area-inset-top)) 14px 10px;gap:8px;min-height:52px}#jumpin-top .brand{font-size:16px}#jumpin-top nav a{display:none}#jumpin-root.app-screen #jumpin-top{padding:0 12px;gap:8px}#jumpin-root.app-screen #jumpin-top .back-btn{min-height:36px;padding:0 10px;font-size:13px}#jumpin-root.app-screen #jumpin-mid{padding:14px 14px calc(20px + env(safe-area-inset-bottom))}#jumpin-root.app-screen #jumpin-mid.post-card{width:calc(100% - 24px);margin:12px auto;padding:18px 16px;border-radius:16px}#jumpin-mid .wrap{padding:16px 12px}#jumpin-mid .hero{padding:18px}#jumpin-mid h1{font-size:26px}#jumpin-mid .confirm{padding:20px 18px;border-radius:16px}#jumpin-mid .confirm h1{font-size:22px}#jumpin-mid .confirm .route{font-size:18px}#jumpin-mid .confirm h1 + .route{margin-top:14px;padding-top:14px}#jumpin-mid .hero button{width:100%}#jumpin-root.app-screen #jumpin-bottom{padding:10px 14px calc(10px + env(safe-area-inset-bottom))}#jumpin-root.app-screen #jumpin-bottom .site-foot{display:none}#jumpin-root .site-foot{padding:14px 16px calc(14px + env(safe-area-inset-bottom));gap:8px 14px}#jumpin-root .site-foot .spacer{margin-left:0;width:100%}}",
      "@media (max-width:480px){#jumpin-mid h1{font-size:24px}#jumpin-mid .row .route{font-size:16px}#jumpin-mid .link-row{flex-wrap:wrap}#jumpin-mid .link-copy{width:100%;justify-content:center}#jumpin-root .action-row button,#jumpin-root .action-row a{flex:1 1 100%;justify-content:center;text-align:center}}",
      "@media (max-width:380px){#jumpin-mid .confirm{padding:16px 14px}#jumpin-mid .confirm h1{font-size:20px}#jumpin-mid .info-grid{grid-template-columns:1fr}}",
      "#jumpin-sheet{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(448px,calc(100% - 32px));max-height:calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;z-index:9999;background:var(--bg-card,#fff);color:var(--text-main,#090d16);padding:20px;border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:0 0 0 100vmax rgba(9,13,22,.5),0 16px 40px rgba(0,0,0,.25)}",
      "#jumpin-sheet p{margin:0 0 12px;font-weight:600}",
      "#jumpin-sheet p.muted{margin:-4px 0 14px;font-weight:400}",
      "#jumpin-sheet button{min-height:44px;margin:6px 10px 0 0}",
      "#jumpin-root .action-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px;align-items:center}",
      "#jumpin-root .action-row select{width:auto;min-width:76px;margin:0;min-height:44px}",
      "#jumpin-root .chip-row{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 14px}",
      "#jumpin-root .chip-btn{background:var(--bg-input,#f8fafc);color:var(--primary,#0891b2);border:1px solid var(--border-color,#cbd5e1);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600;min-height:36px;cursor:pointer}",
      "#jumpin-root .chip-btn:hover{background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .board-search{width:100%;max-width:340px;min-height:40px;margin:0;padding:0 14px;font-size:15px;border:1px solid var(--border-color,#cbd5e1);border-radius:12px;background:var(--bg-card,#fff);color:var(--text-main,#090d16)}",
      "#jumpin-mid .board-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 14px;margin:0 0 14px}",
      "#jumpin-mid .filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%}",
      "#jumpin-mid .filter-chip{flex:0 0 auto;min-height:36px;padding:6px 14px;border-radius:999px;border:1px solid var(--border-color,#cbd5e1);background:var(--bg-card,#fff);color:var(--text-muted,#1e293b);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}",
      "#jumpin-mid .filter-chip.active{background:var(--primary,#0891b2);color:#fff;border-color:var(--primary,#0891b2);box-shadow:0 2px 8px rgba(8,145,178,.22)}",
      "#jumpin-mid .pager{display:flex;align-items:center;justify-content:center;gap:8px;margin:18px 0 6px;flex-wrap:wrap}",
      "#jumpin-mid .pager-btn{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--border-color,#cbd5e1);background:var(--bg-card,#fff);color:var(--primary,#0891b2);font-size:14px;font-weight:700;cursor:pointer}",
      "#jumpin-mid .pager-btn:disabled{opacity:.45;cursor:not-allowed;color:var(--text-muted,#64748b)}",
      "#jumpin-mid .pager-info{font-size:14px;font-weight:600;color:var(--text-muted,#475569);padding:0 6px;white-space:nowrap}",
      "@media (max-width:700px){#jumpin-root .board-search{max-width:100%}#jumpin-mid .filter-row{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}#jumpin-mid .filter-row::-webkit-scrollbar{display:none}}",
      "@media (max-width:519px){#jumpin-mid .pager-edge{display:none}}",
      "#jumpin-root .recovery-box{margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color,#e2e8f0)}",
      "#jumpin-root .section-lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted,#475569);margin:14px 0 6px}",
      "#jumpin-mid .reserve-head{margin:18px 0 12px;padding-top:16px;border-top:1px solid var(--border-color,#e2e8f0);font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:17px;font-weight:700;color:var(--text-main,#090d16)}",
      "#jumpin-root .rider-row{display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--bg-input,#f8fafc);border:1px solid var(--border-color,#e2e8f0);border-radius:10px;font-size:14px;font-weight:600;overflow-wrap:anywhere}",
      "#jumpin-root .msg-row{padding:8px 12px;margin-bottom:6px;background:rgba(8,145,178,.06);border-radius:10px;font-size:14px;color:var(--text-main,#090d16);overflow-wrap:anywhere}",
      "#jumpin-root .textish{background:var(--bg-input,#f8fafc);color:var(--primary,#0891b2);border:1px solid var(--border-color,#cbd5e1);border-radius:10px;padding:0 16px;font-size:14px;font-weight:600;min-height:44px;cursor:pointer}",
      "#jumpin-root .textish:hover{background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .linkish{display:block;background:transparent;color:var(--primary,#0891b2);border:0;padding:6px 0;font-size:14px;font-weight:600;text-align:left;cursor:pointer}",
      "#jumpin-root .linkish:hover{text-decoration:underline}",
      "#jumpin-root button.danger{background:transparent;color:var(--accent-rose,#be123c);border:1px solid #fecdd3;border-radius:10px;padding:0 16px;font-size:15px;font-weight:700;min-height:44px;cursor:pointer}",
      "#jumpin-sheet button.confirm-primary{background:var(--primary,#0891b2);color:#fff;border:0;border-radius:10px;padding:0 18px;font-size:15px;font-weight:700;min-height:44px;cursor:pointer}",
      "@keyframes jumpin-spin{to{transform:rotate(360deg)}}",
      ".jumpin-spin{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:jumpin-spin .7s linear infinite;vertical-align:middle;margin-right:8px}",
      ".jumpin-spin.dark{border-color:rgba(8,145,178,.25);border-top-color:var(--primary,#0891b2)}",
      "#jumpin-mid .support-card{margin-top:14px;padding:12px 14px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:12px;color:#78350f}",
      "#jumpin-mid .support-title{font-weight:700;font-size:14px;margin:0 0 2px;color:#78350f}",
      "#jumpin-mid .support-sub{font-size:13px;margin:0 0 8px;color:#92400e}",
      "#jumpin-mid .support-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid #fde68a;border-radius:8px;padding:6px 10px;font-size:13px;font-weight:700;color:#090d16}",
      "#jumpin-mid .support-copy{background:#f59e0b;color:#fff;border:0;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;min-height:28px;cursor:pointer}",
      "#jumpin-mid .link-row{display:flex;align-items:center;gap:8px;margin:0 0 14px}",
      "#jumpin-mid .link-row input{margin:0;flex:1 1 auto;min-width:0}",
      "#jumpin-mid .link-copy{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;background:var(--bg-input,#f8fafc);color:var(--primary,#0891b2);border:1px solid var(--border-color,#cbd5e1);border-radius:8px;padding:0 12px;min-height:44px;font-size:14px;font-weight:700;cursor:pointer}",
      "#jumpin-mid .link-copy:hover{background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .site-foot .support-foot{flex-basis:100%;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#92400e;font-weight:600;font-size:13px}"
    ].join("");
    doc.head.appendChild(style);
  }

  function mount(win) {
    destroy();
    const doc = win.document;
    doc.body.classList.add("jumpin-on");
    const platform = ui.platformOf(win.navigator && win.navigator.userAgent);
    if (platform === "android") doc.body.classList.add("jumpin-android");
    ensureStyle(doc);
    const rootNode = track(doc);
    const secrets = win.localStorage;
    const cloud = win.JumpInCloud || null;
    let state = Object.assign(ui.blank(), { platform: platform, rides: cloud ? [] : loadRides(secrets) });
    let stopRide = function () { };
    let supportNote = "";
    let groupMeta = { groupId: (cloud && cloud.groupId) || "default", name: "", status: "active", enabled: true };
    let boardQuery = "";
    let boardDateFilter = "all";
    let boardPage = 1;
    const PAGE_SIZE = 12;

    function loadProfile() {
      if (!secrets || !secrets.getItem) return { name: "", phone: "" };
      try {
        const raw = JSON.parse(secrets.getItem("waitlink_jumpin_profile") || "{}");
        return { name: String(raw.name || ""), phone: String(raw.phone || "") };
      } catch (err) {
        return { name: "", phone: "" };
      }
    }

    function saveProfile(name, phone) {
      if (!secrets || !secrets.setItem || !name || !phone) return;
      try {
        secrets.setItem("waitlink_jumpin_profile", JSON.stringify({ name: name, phone: phone }));
      } catch (err) { /* ignore storage quota errors */ }
    }

    function seatsLabel(n) {
      return n === 1 ? "1 seat left" : n + " seats left";
    }

    function whenOf(ride) {
      if (!ride || !ride.departAt) return "";
      try { return core.formatWhen(ride.departAt, ride.timeZone || "UTC"); } catch (err) { return ""; }
    }

    function openRide(rideId) {
      if (!cloud || !rideId) return;
      stopRide();
      stopRide = cloud.watchRide(rideId, function (ride) {
        const kept = state.rides || [];
        if (!ride) {
          state = Object.assign(ui.reduce(state, { type: "ride", ride: { status: "missing", seatsLeft: 0 }, role: "" }), { rides: kept, ride: null });
        } else if (ride.status === "open" && (state.reserveOpen || state.recovery || state.sheet || state.busy || state.mode === "reserved")) {
          state = Object.assign({}, state, {
            rides: kept,
            ride: ride,
            seatsLeft: ride.seatsLeft,
            seatsText: seatsLabel(ride.seatsLeft),
            route: ride.from + " → " + ride.to,
            when: whenOf(ride),
            link: cloud.publicRideUrl(ride.rideId)
          });
          return;
        } else {
          const prevNotice = state.notice;
          const role = cloud.roleFor(ride);
          state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: role }), {
            rides: kept,
            ride: ride,
            reserveOpen: false,
            reserveDraft: null,
            route: ride.from + " → " + ride.to,
            when: whenOf(ride),
            link: cloud.publicRideUrl(ride.rideId),
            notice: ride.status === "open" && (prevNotice === "You have a seat." || /^You have \d+ seats\.$/.test(prevNotice || "") || prevNotice === "Passenger added." || prevNotice === "Seat cancelled." || prevNotice === "Seats updated.") ? prevNotice : ""
          });
        }
        draw();
      }) || function () { };
    }

    function spinText(doc, btn, spinning, busyText, idleText, dark) {
      if (spinning) {
        btn.appendChild(el(doc, "span", dark ? "jumpin-spin dark" : "jumpin-spin"));
        btn.appendChild(doc.createTextNode(busyText));
      } else {
        btn.textContent = idleText;
      }
      if (state.busy) btn.disabled = true;
    }

    function confirmSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      const kind = state.sheet || state.busySheet;
      const isComplete = kind === "complete";
      const title = isComplete ? "Complete this trip?" : (kind === "trip" ? "Cancel this trip?" : "Cancel your seat?");
      sheet.appendChild(el(doc, "p", "", title));
      if (isComplete) sheet.appendChild(el(doc, "p", "muted", "This marks the trip as completed and closes trip messaging."));
      const keep = el(doc, "button", "textish", isComplete ? "Keep open" : (kind === "trip" ? "Keep trip" : "Keep seat"));
      if (state.busy) keep.disabled = true;
      on(keep, "click", function () { state = ui.reduce(state, { type: "keep" }); draw(); });
      sheet.appendChild(keep);
      const idleConfirm = isComplete ? "Complete trip" : (kind === "trip" ? "Cancel trip" : "Cancel seat");
      const busyConfirm = isComplete ? "Completing…" : "Cancelling…";
      const yes = el(doc, "button", isComplete ? "confirm-primary" : "danger");
      spinText(doc, yes, state.busy && state.busyAction === "sheet", busyConfirm, idleConfirm, !isComplete);
      on(yes, "click", function () {
        const ride = state.ride || (state.rideId ? { rideId: state.rideId } : null);
        const sheetKind = state.sheet;
        state = ui.reduce(state, { type: "confirm" });
        const action = state.pendingAction;
        if (cloud && ride && action) {
          state.busy = true;
          state.busyAction = "sheet";
          state.busySheet = sheetKind;
          const isDriverAction = action === "cancel-trip" || action === "complete-trip";
          const secret = isDriverAction ? cloud.tripSecret(ride.rideId) : cloud.seatSecretFor(ride);
          const job = action === "complete-trip"
            ? cloud.completeTrip(ride.rideId, secret)
            : (action === "cancel-trip" ? cloud.cancelTrip(ride.rideId, secret) : cloud.cancelSeat(ride.rideId, secret));
          job.then(function (result) {
            state.busy = false;
            state.busyAction = "";
            state.busySheet = "";
            if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
            else if (action === "complete-trip") {
              const nextRide = Object.assign({}, state.ride || {}, { status: "completed" });
              state = Object.assign({}, state, { status: "completed", notice: "Trip completed.", ride: nextRide });
            }
            else if (action === "cancel-trip") state = Object.assign({}, state, { status: "cancelled", notice: "This trip was cancelled.", link: "" });
            else state = Object.assign({}, state, { mode: "ride", role: "", notice: "Seat cancelled.", reserveOpen: false });
            draw();
          }, function () {
            state.busy = false;
            state.busyAction = "";
            state.busySheet = "";
            state = ui.reduce(state, { type: "fail", error: "Could not complete request. Check the connection and try again." });
            draw();
          });
        }
        draw();
      });
      sheet.appendChild(yes);
      return sheet;
    }

    function rideCard(doc, current) {
      const ride = current.ride;
      const card = el(doc, "section", "confirm");
      if (current.notice) card.appendChild(el(doc, "h1", "", current.notice));
      card.appendChild(el(doc, "p", "route", (ride.from || "") + " → " + (ride.to || "")));
      const whenText = (current.when || whenOf(ride)) + (ride.durationMinutes ? " · Est. " + core.formatDuration(ride.durationMinutes) : "");
      const grid = el(doc, "div", "info-grid");
      function addTile(k, v) {
        const tile = el(doc, "div", "info-tile");
        tile.appendChild(el(doc, "div", "info-k", k));
        tile.appendChild(el(doc, "div", "info-v", v));
        grid.appendChild(tile);
      }
      addTile("Departure", whenText);
      if (ride.seatsLeft != null) addTile("Availability", seatsLabel(ride.seatsLeft));
      if (ride.rideCost > 0) addTile("Ride cost", core.formatCost(ride.rideCost) + " / seat (direct)");
      const tripCode = shortTripId(ride.rideId);
      if (tripCode) addTile("Trip ID", tripCode);
      if (ride.note) addTile("Pickup / Note", ride.note);
      card.appendChild(grid);
      if (ride.driverName) {
        const dRow = el(doc, "div", "rider-row");
        dRow.appendChild(el(doc, "span", "mini-av", ride.driverName.charAt(0).toUpperCase()));
        dRow.appendChild(el(doc, "span", "", "Driver: " + ride.driverName));
        card.appendChild(dRow);
      }
      if (ride.riders && ride.riders.length) {
        const totalReserved = ride.riders.reduce(function (sum, r) { return sum + (Number(r.seats) || 1); }, 0);
        card.appendChild(el(doc, "div", "section-lbl", "Passengers (" + totalReserved + ")"));
        ride.riders.forEach(function (rider) {
          const seatSuffix = rider.seats > 1 ? " (" + rider.seats + " seats)" : "";
          const dropSuffix = rider.dropoff ? " · Drop off: " + rider.dropoff : "";
          const rName = rider.name || "Passenger";
          const rRow = el(doc, "div", "rider-row");
          rRow.appendChild(el(doc, "span", "mini-av", rName.charAt(0).toUpperCase()));
          rRow.appendChild(el(doc, "span", "", rName + seatSuffix + dropSuffix));
          card.appendChild(rRow);
        });
      }
      if (ride.messages && ride.messages.length) {
        card.appendChild(el(doc, "div", "section-lbl", "Trip Updates"));
        ride.messages.forEach(function (message) {
          const who = message.authorName || "";
          card.appendChild(el(doc, "div", "msg-row", (who ? who + ": " : "") + (message.text || "")));
        });
      }
      if (current.status === "pending") card.appendChild(el(doc, "p", "route", "Waiting for approval."));
      if (current.status === "rejected") card.appendChild(el(doc, "p", "route", "This trip was not approved."));
      if (current.status === "cancelled") card.appendChild(el(doc, "p", "route", "This trip was cancelled."));
      if (current.status === "completed") {
        card.appendChild(el(doc, "p", "route", "Trip completed — hope you had a great ride!"));
        if (supportNote) card.appendChild(supportCard(doc, supportNote));
      }
      if (current.status === "open" && ride.seatsLeft === 0) card.appendChild(el(doc, "p", "route", "Full"));
      if (current.reserveOpen) {
        const saved = current.role === "driver" ? { name: "", phone: "" } : loadProfile();
        const draft = current.reserveDraft || {};
        card.appendChild(el(doc, "div", "reserve-head", current.role === "driver" ? "Add a passenger" : "Reserve your seat"));
        card.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Passenger name" : "Your name"));
        const name = el(doc, "input");
        name.name = "name";
        name.value = draft.name != null ? draft.name : (saved.name || "");
        card.appendChild(name);
        card.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Passenger phone" : "Phone"));
        const phone = el(doc, "input");
        phone.name = "phone";
        phone.type = "tel";
        phone.value = draft.phone != null ? draft.phone : (saved.phone || "");
        card.appendChild(phone);
        if ((Number(ride.seatsLeft) || 1) > 1) {
          card.appendChild(el(doc, "label", "lbl", "Seats"));
          const seatSel = el(doc, "select");
          seatSel.name = "seats";
          const maxPick = Math.min(6, Number(ride.seatsLeft) || 1);
          const pickedSeats = Number(draft.seats || 1);
          for (let s = 1; s <= maxPick; s++) {
            const opt = el(doc, "option", "", String(s));
            opt.value = String(s);
            if (s === pickedSeats) opt.selected = true;
            seatSel.appendChild(opt);
          }
          card.appendChild(seatSel);
        }
        card.appendChild(el(doc, "label", "lbl", "Drop off location, optional"));
        const dropoff = el(doc, "input");
        dropoff.name = "dropoff";
        dropoff.type = "text";
        dropoff.placeholder = "e.g. University City";
        if (draft.dropoff) dropoff.value = draft.dropoff;
        card.appendChild(dropoff);
        card.appendChild(el(doc, "p", "hint", "WaitLink will text this number a link to manage their seat, and JumpIn notices."));
        if (current.error) card.appendChild(el(doc, "p", "error", current.error));
        const cancelForm = el(doc, "button", "textish", "Cancel");
        on(cancelForm, "click", function () { state = Object.assign(ui.reduce(state, { type: "reserve-close" }), { reserveDraft: null }); draw(); });
        const formActions = el(doc, "div", "action-row");
        formActions.appendChild(cancelForm);
        card.appendChild(formActions);
      }
      if (current.recovery) {
        const recLabel = current.recovery === "driver"
          ? "Driver phone (used to post this trip)"
          : "Rider phone (used to reserve your seat)";
        card.appendChild(el(doc, "label", "lbl", recLabel));
        const phone = el(doc, "input");
        phone.name = "phone";
        phone.type = "tel";
        card.appendChild(phone);
        if (current.error) card.appendChild(el(doc, "p", "error", current.error));
      }
      if (!current.reserveOpen && (current.role === "driver" || current.role === "rider") && (current.status === "open" || current.status === "pending")) {
        let box = null;
        const hasRiders = !!(ride.riders && ride.riders.length);
        if (current.status === "open" && (current.role === "rider" || hasRiders)) {
          card.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Message passengers" : "Message the driver"));
          const quickRow = el(doc, "div", "chip-row");
          ["On my way", "At pickup spot", "5 min late"].forEach(function (phrase) {
            const chip = el(doc, "button", "chip-btn", phrase);
            chip.type = "button";
            if (state.busy) chip.disabled = true;
            on(chip, "click", function () { sendMessage(phrase); });
            quickRow.appendChild(chip);
          });
          card.appendChild(quickRow);
          const msgRow = el(doc, "div", "link-row");
          box = el(doc, "input");
          box.name = "message";
          box.placeholder = "Write an update (e.g. I am at the pickup spot)";
          msgRow.appendChild(box);
          const sendInline = el(doc, "button", "link-copy");
          sendInline.type = "button";
          spinText(doc, sendInline, state.busy && state.busyAction === "send", "Sending…", "Send", true);
          on(sendInline, "click", function () { sendMessage(box.value); });
          msgRow.appendChild(sendInline);
          card.appendChild(msgRow);
        }
        const actions = el(doc, "div", "action-row");
        const departed = !!(ride.departAt && Date.now() >= ride.departAt);
        if (current.role === "driver") {
          if (current.status === "open" && !departed && ride.seatsLeft > 0) {
            const addPax = el(doc, "button", "textish", "Add passenger");
            on(addPax, "click", function () { state = ui.reduce(state, { type: "reserve-open" }); draw(); });
            actions.appendChild(addPax);
          }
          if (current.status === "open" && departed && hasRiders) {
            const complete = el(doc, "button", "textish", "Complete trip");
            on(complete, "click", function () { state = ui.reduce(state, { type: "complete-ask" }); draw(); });
            actions.appendChild(complete);
          }
          const cancel = el(doc, "button", "textish", "Cancel trip");
          on(cancel, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "driver" }); draw(); });
          actions.appendChild(cancel);
        } else if (cloud && cloud.seatSecretFor(ride) && !departed) {
          const myInfo = cloud.seatInfoFor ? cloud.seatInfoFor(ride) : null;
          const mySeats = (myInfo && Number(myInfo.seats)) || 1;
          const maxTotal = Math.min(6, mySeats + (Number(ride.seatsLeft) || 0));
          if (maxTotal > 1 && cloud.updateSeat) {
            const seatPick = el(doc, "select");
            seatPick.name = "mySeats";
            seatPick.setAttribute("aria-label", "My seats");
            for (let n = 1; n <= maxTotal; n++) {
              const opt = el(doc, "option", "", n === 1 ? "1 seat" : n + " seats");
              opt.value = String(n);
              if (n === mySeats) opt.selected = true;
              seatPick.appendChild(opt);
            }
            actions.appendChild(seatPick);
            const saveSeats = el(doc, "button", "textish");
            spinText(doc, saveSeats, state.busy && state.busyAction === "update-seats", "Updating…", "Update seats", true);
            if (!state.busy && Number(seatPick.value || 1) === mySeats) saveSeats.disabled = true;
            on(seatPick, "change", function () {
              saveSeats.disabled = state.busy || Number(seatPick.value || 1) === mySeats;
            });
            on(saveSeats, "click", function () {
              const nextSeats = Number(seatPick.value || 1);
              if (nextSeats === mySeats) return;
              state.busy = true;
              state.busyAction = "update-seats";
              draw();
              cloud.updateSeat(ride.rideId, cloud.seatSecretFor(ride), nextSeats).then(function (result) {
                state.busy = false;
                state.busyAction = "";
                if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
                else state = ui.reduce(state, { type: "notice", notice: "Seats updated." });
                draw();
              }, function () {
                state.busy = false;
                state.busyAction = "";
                state = ui.reduce(state, { type: "fail", error: "Could not update seats. Check the connection and try again." });
                draw();
              });
            });
            actions.appendChild(saveSeats);
          }
          const cancelSeat = el(doc, "button", "textish", "Cancel my seat");
          on(cancelSeat, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "rider" }); draw(); });
          actions.appendChild(cancelSeat);
        }
        if (current.role === "driver") {
          const forget = el(doc, "button", "textish", "Sign out on this device");
          on(forget, "click", function () {
            cloud.forget(ride);
            state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: "" }), { ride: ride, rides: state.rides || [], when: current.when, link: current.link });
            draw();
          });
          actions.appendChild(forget);
        }
        if (actions.children.length) card.appendChild(actions);
      } else if (!current.reserveOpen && (current.status === "open" || current.status === "pending")) {
        const recBox = el(doc, "div", "recovery-box");
        const seat = el(doc, "button", "linkish", "Rider? Manage seat or message driver");
        on(seat, "click", function () { state = ui.reduce(state, { type: "recovery", role: "rider" }); draw(); });
        const trip = el(doc, "button", "linkish", "Driver? Manage this trip");
        on(trip, "click", function () { state = ui.reduce(state, { type: "recovery", role: "driver" }); draw(); });
        recBox.appendChild(seat);
        recBox.appendChild(trip);
        card.appendChild(recBox);
      }
      if (current.error && !current.reserveOpen && !current.recovery) card.appendChild(el(doc, "p", "error", current.error));
      return card;
    }

    function sendMessage(text) {
      if (!cloud || !state.ride) return;
      const secret = state.role === "driver" ? cloud.tripSecret(state.ride.rideId) : cloud.seatSecretFor(state.ride);
      state.busy = true;
      state.busyAction = "send";
      draw();
      cloud.postMessage(state.ride.rideId, secret, text).then(function (result) {
        state.busy = false;
        state.busyAction = "";
        if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
        draw();
      }, function () {
        state.busy = false;
        state.busyAction = "";
        state = ui.reduce(state, { type: "fail", error: "Could not send message. Check the connection and try again." });
        draw();
      });
    }

    function draw() {
      rootNode.textContent = "";
      const isFormOpen = state.mode === "post" || !!(state.mode === "ride" && (state.reserveOpen || state.recovery));
      rootNode.className = state.mode === "board" ? "portal" : ("app-screen" + (isFormOpen ? " form-open" : ""));
      const top = el(doc, "header");
      top.id = "jumpin-top";
      if (state.mode === "board") brandBar(doc, top, groupMeta);
      else {
        const back = el(doc, "button", "textish back-btn", "Back");
        on(back, "click", function () {
          stopRide();
          const kept = state.rides || [];
          state = ui.reduce(state, { type: "board" });
          state.rides = kept;
          draw();
        });
        top.appendChild(back);
        brandBar(doc, top, groupMeta);
      }
      const mid = el(doc, "main");
      mid.id = "jumpin-mid";
      if (state.mode === "post") mid.className = "post-card";
      on(mid, "focusin", function (e) {
        keepFocusedVisible(e && e.target);
      });
      const bottom = el(doc, "footer");
      bottom.id = "jumpin-bottom";
      let hero = null;
      if (state.mode === "board") {
        const wrap = el(doc, "div", "wrap");
        hero = el(doc, "section", "hero");
        const copy = el(doc, "div", "copy");
        copy.appendChild(el(doc, "span", "hero-eyebrow", groupMeta.name || "Community Carpool"));
        copy.appendChild(el(doc, "h1", "", "Find a seat. Offer a ride."));
        copy.appendChild(el(doc, "p", "muted", "Post a trip. Reserve your seats. No app fees."));
        hero.appendChild(copy);
        wrap.appendChild(hero);
        if (groupMeta.status && groupMeta.status !== "active") {
          const notice = el(doc, "div", "empty");
          notice.style.marginBottom = "14px";
          notice.appendChild(el(doc, "p", "route", groupMeta.status === "pending" ? "Waiting for approval" : (groupMeta.status === "suspended" ? "Group paused" : "Group not found")));
          notice.appendChild(el(doc, "p", "muted", groupMeta.status === "pending" ? "This community group is waiting for platform approval before rides can be posted." : "Check the group link with your community organizer."));
          wrap.appendChild(notice);
        }
        const rides = state.rides || [];
        const list = el(doc, "div", "board");
        const pager = el(doc, "div", "pager");
        function matchesDateFilter(ride, filter, nowMs) {
          if (filter === "all") return true;
          const ts = Number(ride.departAt || 0);
          if (!ts) return false;
          const d = new Date(nowMs);
          const startToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const startTomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
          if (filter === "today") return ts >= startToday && ts < startTomorrow;
          if (filter === "tomorrow") return ts >= startTomorrow && ts < new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2).getTime();
          return ts >= startToday && ts < new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime();
        }
        function paintBoard() {
          list.textContent = "";
          pager.textContent = "";
          const q = boardQuery.trim().toLowerCase();
          const nowMs = Date.now();
          const shown = rides.filter(function (ride) {
            if (!matchesDateFilter(ride, boardDateFilter, nowMs)) return false;
            if (!q) return true;
            return [ride.from, ride.to, ride.driverName, shortTripId(ride.rideId || ride.id)].join(" ").toLowerCase().indexOf(q) !== -1;
          });
          if (!shown.length) {
            const empty = el(doc, "div", "empty");
            const filtered = !!(q || boardDateFilter !== "all");
            empty.appendChild(el(doc, "div", "empty-icon", filtered ? "🔍" : "🚗"));
            empty.appendChild(el(doc, "p", "route", filtered ? "No matching rides" : "No rides yet"));
            empty.appendChild(el(doc, "p", "muted", filtered ? "Try another date or clear the filter." : "Post one trip and it will show up here."));
            if (filtered) {
              const resetBtn = el(doc, "button", "textish", "Show all rides");
              resetBtn.style.marginTop = "12px";
              on(resetBtn, "click", function () {
                boardQuery = "";
                boardDateFilter = "all";
                boardPage = 1;
                draw();
              });
              empty.appendChild(resetBtn);
            }
            list.appendChild(empty);
            return;
          }
          const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
          if (boardPage > totalPages) boardPage = totalPages;
          const start = (boardPage - 1) * PAGE_SIZE;
          const pageItems = shown.slice(start, start + PAGE_SIZE);
          pageItems.forEach(function (ride) {
            const myRole = cloud && cloud.roleFor ? cloud.roleFor(ride) : "";
            const row = el(doc, "button", "row" + (myRole ? " role-" + myRole : ""));
            const head = el(doc, "div", "row-head");
            head.appendChild(el(doc, "div", "route", ride.from + " → " + ride.to));
            const pills = el(doc, "span", "pill-group");
            if (myRole === "driver" || myRole === "rider") {
              pills.appendChild(el(doc, "span", "status-pill " + myRole, myRole === "driver" ? "Your trip" : "Seat booked"));
            }
            const left = ride.seatsLeft == null ? 2 : Number(ride.seatsLeft);
            const pillKind = left === 0 ? "full" : (left === 1 ? "last" : "open");
            const pillText = left === 0 ? "Full" : (left === 1 ? "Last seat" : "Open");
            pills.appendChild(el(doc, "span", "status-pill " + pillKind, pillText));
            head.appendChild(pills);
            row.appendChild(head);
            row.appendChild(el(doc, "div", "meta", (ride.when || whenOf(ride)) + (ride.durationMinutes ? " · Est. " + core.formatDuration(ride.durationMinutes) : "")));
            const foot = el(doc, "div", "card-foot");
            const dName = ride.driverName || "Driver";
            const dWrap = el(doc, "span", "foot-driver");
            dWrap.appendChild(el(doc, "span", "mini-av", dName.charAt(0).toUpperCase()));
            dWrap.appendChild(el(doc, "span", "", dName));
            foot.appendChild(dWrap);
            const right = el(doc, "span", "foot-right");
            right.appendChild(el(doc, "span", "", ride.seats || seatsLabel(ride.seatsLeft)));
            if (ride.rideCost > 0) right.appendChild(el(doc, "span", "cost-tag", core.formatCost(ride.rideCost) + "/seat"));
            foot.appendChild(right);
            row.appendChild(foot);
            on(row, "click", function () {
              if (!cloud) return;
              row.disabled = true;
              right.appendChild(el(doc, "span", "jumpin-spin dark"));
              openRide(ride.rideId || ride.id);
            });
            list.appendChild(row);
          });
          if (totalPages > 1) {
            function addPageBtn(label, targetPage, disabled, edge) {
              const btn = el(doc, "button", "pager-btn" + (edge ? " pager-edge" : ""), label);
              btn.type = "button";
              if (disabled) btn.disabled = true;
              on(btn, "click", function () {
                boardPage = targetPage;
                paintBoard();
                if (list.scrollIntoView) list.scrollIntoView({ behavior: "smooth", block: "start" });
              });
              pager.appendChild(btn);
            }
            addPageBtn("First", 1, boardPage <= 1, true);
            addPageBtn("‹ Prev", Math.max(1, boardPage - 1), boardPage <= 1, false);
            pager.appendChild(el(doc, "span", "pager-info", "Page " + boardPage + " of " + totalPages));
            addPageBtn("Next ›", Math.min(totalPages, boardPage + 1), boardPage >= totalPages, false);
            addPageBtn("Last", totalPages, boardPage >= totalPages, true);
          }
        }
        if (rides.length) {
          const tools = el(doc, "div", "board-tools");
          const filterRow = el(doc, "div", "filter-row");
          [["all", "All"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"]].forEach(function (spec) {
            const chip = el(doc, "button", "filter-chip" + (boardDateFilter === spec[0] ? " active" : ""), spec[1]);
            chip.type = "button";
            on(chip, "click", function () {
              boardDateFilter = spec[0];
              boardPage = 1;
              draw();
            });
            filterRow.appendChild(chip);
          });
          tools.appendChild(filterRow);
          if (rides.length >= 5) {
            const search = el(doc, "input", "board-search");
            search.type = "search";
            search.placeholder = "Search route or city…";
            search.value = boardQuery;
            search.setAttribute("aria-label", "Search rides");
            on(search, "input", function () { boardQuery = search.value || ""; boardPage = 1; paintBoard(); });
            tools.appendChild(search);
          }
          wrap.appendChild(tools);
        }
        paintBoard();
        wrap.appendChild(list);
        wrap.appendChild(pager);
        mid.appendChild(wrap);
      } else if (state.mode === "post") {
        if (state.error && !state.field) mid.appendChild(el(doc, "p", "error", state.error));
        const postHead = el(doc, "div", "post-head");
        postHead.appendChild(el(doc, "span", "hero-eyebrow", "New Trip"));
        postHead.appendChild(el(doc, "h1", "", "Post a ride"));
        mid.appendChild(postHead);
        const fields = [
          ["name", "Your name", "text", "Alex"],
          ["phone", "Phone", "tel", "555 234 5678"],
          ["from", "From", "text", "Library"],
          ["to", "To", "text", "Office"],
          ["date", "Date", "date", ""],
          ["time", "Time", "time", ""]
        ];
        const saved = loadProfile();
        const postInputs = {};
        fields.forEach(function (spec) {
          mid.appendChild(el(doc, "label", "lbl", spec[1]));
          const input = el(doc, "input");
          input.name = spec[0];
          input.type = spec[2];
          if (spec[3]) input.placeholder = spec[3];
          input.autocomplete = spec[0] === "phone" ? "tel" : "on";
          if (state.draft && state.draft[spec[0]]) input.value = state.draft[spec[0]];
          else if (!state.draft && (spec[0] === "name" || spec[0] === "phone") && saved[spec[0]]) input.value = saved[spec[0]];
          postInputs[spec[0]] = input;
          mid.appendChild(input);
          if (state.error && state.field === spec[0]) mid.appendChild(el(doc, "p", "error", state.error));
        });
        const whenChips = el(doc, "div", "chip-row");
        [
          ["Today", 0, true, false],
          ["Tomorrow", 24 * 60, true, false],
          ["In 30m", 30, true, true],
          ["In 1h", 60, true, true],
          ["In 2h", 120, true, true]
        ].forEach(function (spec) {
          const chip = el(doc, "button", "chip-btn", spec[0]);
          chip.type = "button";
          on(chip, "click", function () {
            const zone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
            const p = core.partsInZone(Date.now() + spec[1] * 60000, zone);
            if (spec[2] && postInputs.date) postInputs.date.value = p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0");
            if (spec[3] && postInputs.time) postInputs.time.value = String(p.hour).padStart(2, "0") + ":" + String(p.minute).padStart(2, "0");
          });
          whenChips.appendChild(chip);
        });
        mid.appendChild(whenChips);
        mid.appendChild(el(doc, "label", "lbl", "Seats"));
        const seats = el(doc, "select");
        seats.name = "seats";
        for (let n = 1; n <= 6; n++) {
          const option = el(doc, "option", "", String(n));
          option.value = String(n);
          if (String(n) === String((state.draft && state.draft.seats) || 3)) option.selected = true;
          seats.appendChild(option);
        }
        mid.appendChild(seats);
        mid.appendChild(el(doc, "label", "lbl", "Estimated duration"));
        const dur = el(doc, "select");
        dur.name = "durationMinutes";
        [
          [30, "30 min"],
          [60, "1 hr"],
          [120, "2 hrs"],
          [180, "3 hrs"],
          [240, "4 hrs"],
          [300, "5 hrs"],
          [360, "6 hrs"]
        ].forEach(function (pair) {
          const option = el(doc, "option", "", pair[1]);
          option.value = String(pair[0]);
          if (String(pair[0]) === String((state.draft && state.draft.durationMinutes) || 60)) option.selected = true;
          dur.appendChild(option);
        });
        mid.appendChild(dur);
        mid.appendChild(el(doc, "label", "lbl", "Ride cost per seat ($), optional"));
        const rideCost = el(doc, "input");
        rideCost.name = "rideCost";
        rideCost.type = "number";
        rideCost.min = "0";
        rideCost.max = "500";
        rideCost.step = "0.01";
        rideCost.inputMode = "decimal";
        rideCost.placeholder = "Free (or e.g. 5)";
        if (state.draft && state.draft.rideCost) rideCost.value = state.draft.rideCost;
        mid.appendChild(rideCost);
        if (state.error && state.field === "rideCost") mid.appendChild(el(doc, "p", "error", state.error));
        mid.appendChild(el(doc, "label", "lbl", "Note, optional"));
        const note = el(doc, "input");
        note.name = "note";
        note.type = "text";
        note.placeholder = "South door";
        if (state.draft && state.draft.note) note.value = state.draft.note;
        mid.appendChild(note);
        mid.appendChild(el(doc, "p", "hint", "WaitLink will text this number a link to manage this trip, and JumpIn notices."));
      } else if (state.mode === "posted") {
        const card = el(doc, "section", "confirm");
        card.appendChild(el(doc, "span", "confirm-badge" + (state.status === "pending" ? " pending" : ""), state.status === "pending" ? "Pending approval" : "✓ Trip live"));
        card.appendChild(el(doc, "h1", "", state.notice || "Trip posted."));
        card.appendChild(el(doc, "p", "route", state.route || ""));
        if (state.when) card.appendChild(el(doc, "p", "muted", state.when));
        if (state.seatsText) card.appendChild(el(doc, "p", "muted", state.seatsText));
        const tripCode = shortTripId(state.rideId || (state.ride && state.ride.rideId));
        if (tripCode) card.appendChild(el(doc, "p", "muted", "Trip ID: " + tripCode));
        if (state.link) {
          card.appendChild(el(doc, "p", "section-lbl", "Share trip link"));
          const linkRow = el(doc, "div", "link-row");
          const link = el(doc, "input");
          link.readOnly = true;
          link.value = state.link;
          linkRow.appendChild(link);
          const copyBtn = el(doc, "button", "link-copy", "📋 Copy");
          copyBtn.type = "button";
          copyBtn.setAttribute("aria-label", "Copy link");
          on(copyBtn, "click", function () {
            const clip = win.navigator && win.navigator.clipboard;
            if (clip && clip.writeText) clip.writeText(state.link);
            copyBtn.textContent = "✓ Copied";
          });
          linkRow.appendChild(copyBtn);
          card.appendChild(linkRow);
          card.appendChild(el(doc, "p", "hint", "Send this link to the people riding with you."));
        }
        if (state.smsNote) card.appendChild(el(doc, "p", "hint", state.smsNote));
        if (supportNote) card.appendChild(supportCard(doc, supportNote));
        if (state.error) card.appendChild(el(doc, "p", "error", state.error));
        if (state.role === "driver" && state.status !== "cancelled") {
          const actions = el(doc, "div", "action-row");
          const cancel = el(doc, "button", "textish", "Cancel trip");
          on(cancel, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "driver" }); draw(); });
          actions.appendChild(cancel);
          card.appendChild(actions);
        }
        mid.appendChild(card);
      } else if (state.mode === "reserved") {
        const card = el(doc, "section", "confirm");
        card.appendChild(el(doc, "span", "confirm-badge", "✓ Seat confirmed"));
        card.appendChild(el(doc, "h1", "", state.notice || "You have a seat."));
        card.appendChild(el(doc, "p", "route", state.route || ""));
        if (state.when) card.appendChild(el(doc, "p", "muted", state.when));
        if (state.seatsText) card.appendChild(el(doc, "p", "muted", state.seatsText));
        const tripCode = shortTripId(state.rideId || (state.ride && state.ride.rideId));
        if (tripCode) card.appendChild(el(doc, "p", "muted", "Trip ID: " + tripCode));
        if (state.smsNote) card.appendChild(el(doc, "p", "hint", state.smsNote));
        else card.appendChild(el(doc, "p", "hint", state.role === "driver" ? "Passenger added to this trip." : (state.bookedSeats > 1 ? "We texted you a link to manage your seats." : "We texted you a link to manage your seat.")));
        if (supportNote) card.appendChild(supportCard(doc, supportNote));
        if (state.role === "rider" && state.ride) {
          const actions = el(doc, "div", "action-row");
          const editBtn = el(doc, "button", "textish", "Edit seats");
          on(editBtn, "click", function () {
            state = Object.assign(ui.reduce(state, { type: "ride", ride: state.ride, role: state.role }), {
              ride: state.ride,
              rides: state.rides || [],
              route: state.route,
              when: state.when,
              link: state.link
            });
            draw();
          });
          actions.appendChild(editBtn);
          const cancelBtn = el(doc, "button", "textish", "Cancel reservation");
          on(cancelBtn, "click", function () {
            state = ui.reduce(state, { type: "cancel-ask", role: "rider" });
            draw();
          });
          actions.appendChild(cancelBtn);
          card.appendChild(actions);
        }
        mid.appendChild(card);
      } else if (state.ride) {
        mid.appendChild(rideCard(doc, state));
      } else {
        mid.appendChild(el(doc, "p", "route", rideLine(state)));
      }
      let label = state.mode === "reserved" ? "View trip" : ui.buttonLabel(state);
      if (label === "Post") label = "Post ride";
      if (state.mode === "posted" && state.link) label = "Share on WhatsApp";
      if (label === "Send" && state.role === "rider" && state.mode === "ride" && !state.recovery && !state.reserveOpen) label = "Sign out on this device";
      if (label === "Reserve a seat" && !state.reserveOpen && state.ride && state.ride.departAt && Date.now() >= state.ride.departAt) label = null;
      if (label === "Reserve a seat" && state.reserveOpen) label = state.role === "driver" ? "Confirm passenger" : "Confirm seat";
      if (state.busy && state.mode === "post") label = "Posting…";
      if (state.busy && (label === "Confirm seat" || label === "Confirm passenger")) label = "Reserving…";
      if (state.busy && (label === "Text me a link" || label === "Send message")) label = "Sending…";
      if (label) {
        const button = el(doc, "button", "");
        if (state.busy) button.appendChild(el(doc, "span", "jumpin-spin"));
        button.appendChild(doc.createTextNode(label));
        on(button, "click", function () {
          if (label === "Post a ride") {
            const kept = state.rides || [];
            state = ui.reduce(state, { type: "post" });
            state.rides = kept;
          }
          else if (label === "Post" || label === "Post ride") {
            const values = {};
            mid.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
            if (!values.seats) values.seats = 3;
            values.timeZone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
            const errors = core.postErrors(values);
            const when = errors.error ? null : core.departureError(values.date, values.time, values.timeZone, Date.now(), 30);
            if (errors.error) {
              state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
              state.draft = values;
            } else if (when.error) {
              state = ui.reduce(state, { type: "fail", field: "time", error: when.error });
              state.draft = values;
            } else if (cloud) {
              state.busy = true;
              state.draft = values;
              draw();
              Promise.resolve().then(function () { return cloud.postRide(values); }).then(function (result) {
                state.busy = false;
                if (!result || result.ok === false) {
                  state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not post. Check the connection and try again." });
                  state.draft = values;
                  state.rides = state.rides || [];
                } else {
                  saveProfile(values.name, values.phone);
                  state = postedFromServer(state, result, values, when.departAt);
                }
                draw();
              }, function () {
                state.busy = false;
                state = ui.reduce(state, { type: "fail", error: "Could not post. Check the connection and try again." });
                state.draft = values;
                draw();
              });
              return;
            } else state = rememberRide(win, secrets, state, values, when.departAt);
          } else if (label === "Reserve a seat" && !state.reserveOpen) {
            state = Object.assign(ui.reduce(state, { type: "reserve-open" }), { reserveDraft: null });
          } else if ((label === "Confirm seat" || label === "Confirm passenger") && cloud && state.ride) {
            const values = {};
            mid.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
            const errors = core.reserveErrors(values);
            if (errors.error) {
              state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
              state.reserveDraft = values;
            } else {
              const wasDriver = state.role === "driver";
              state.busy = true;
              state.reserveDraft = values;
              draw();
              cloud.reserveSeat(state.ride.rideId, values, { skipSaveSeat: wasDriver }).then(function (result) {
                state.busy = false;
                if (!result || result.ok === false) {
                  state = ui.reduce(state, { type: "fail", error: (result && result.error) || "Could not reserve. Check the connection and try again." });
                  state.reserveDraft = values;
                } else {
                  if (!wasDriver) saveProfile(values.name, values.phone);
                  const bookedSeats = Number(values.seats || 1);
                  const existingRiders = state.ride.riders || [];
                  const alreadyListed = result.reservationId && existingRiders.some(function (r) { return r.reservationId === result.reservationId; });
                  const nextSeatsLeft = result.seatsLeft != null ? Number(result.seatsLeft) : Math.max(0, Number(state.ride.seatsLeft || 1) - bookedSeats);
                  const ride = Object.assign({}, state.ride, {
                    seatsLeft: nextSeatsLeft,
                    riders: alreadyListed ? existingRiders : existingRiders.concat([{ reservationId: result.reservationId, name: values.name, seats: bookedSeats, dropoff: values.dropoff || "", status: "active" }])
                  });
                  state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: wasDriver ? "driver" : "rider" }), {
                    mode: "reserved",
                    ride: ride,
                    rides: state.rides || [],
                    reserveDraft: null,
                    route: (ride.from || "") + " → " + (ride.to || ""),
                    when: state.when,
                    seatsText: seatsLabel(ride.seatsLeft),
                    bookedSeats: bookedSeats,
                    link: state.link,
                    smsNote: result.textSent === false ? (result.error || "Seat saved on this browser. Text could not be sent right now.") : "",
                    notice: wasDriver ? "Passenger added." : (bookedSeats === 1 ? "You have a seat." : "You have " + bookedSeats + " seats.")
                  });
                }
                draw();
              }, function () {
                state.busy = false;
                state = ui.reduce(state, { type: "fail", error: "Could not reserve. Check the connection and try again." });
                draw();
              });
              return;
            }
          } else if (label === "Text me a link" && cloud && state.ride) {
            const values = {};
            mid.querySelectorAll("input").forEach(function (input) { values[input.name] = input.value; });
            state.busy = true;
            draw();
            cloud.sendManageLink(state.ride.rideId, values.phone, state.recovery === "driver" ? "driver" : "rider").then(function () {
              state.busy = false;
              state = ui.reduce(state, { type: "notice", notice: core.recoveryPhrase() });
              draw();
            }, function () {
              state.busy = false;
              state = ui.reduce(state, { type: "fail", error: "Could not send link. Check the connection and try again." });
              draw();
            });
            return;
          } else if (label === "View trip" && state.ride) {
            state = Object.assign(ui.reduce(state, { type: "ride", ride: state.ride, role: state.role }), {
              ride: state.ride,
              rides: state.rides || [],
              route: state.route,
              when: state.when,
              link: state.link
            });
          } else if (label === "Sign out on this device" && state.ride) {
            if (cloud) cloud.forget(state.ride);
            state = Object.assign(ui.reduce(state, { type: "ride", ride: state.ride, role: "" }), { ride: state.ride, rides: state.rides || [], when: state.when, link: state.link });
          } else if (label === "Send" || label === "Send message") {
            const box = mid.querySelector("input[name=message]");
            sendMessage(box ? box.value : "");
            return;
          } else if (label === "Share on WhatsApp" && state.link) {
            const groupLabel = groupMeta.name ? groupMeta.name + " carpool: " : "JumpIn carpool: ";
            const waUrl = "https://wa.me/?text=" + encodeURIComponent(groupLabel + (state.route || "") + (state.when ? " (" + state.when + ")" : "") + " — Reserve a seat: " + state.link);
            if (win.open) win.open(waUrl, "_blank", "noopener,noreferrer");
          } else if (label === "Copy link") {
            const clip = win.navigator && win.navigator.clipboard;
            const link = state.link || (state.ride && cloud ? cloud.publicRideUrl(state.ride.rideId) : "");
            if (clip && clip.writeText && link) clip.writeText(link);
            state = ui.reduce(state, { type: "notice", notice: "Copied" });
          }
          draw();
        });
        if (state.busy || (state.mode === "board" && groupMeta.status && groupMeta.status !== "active")) button.disabled = true;
        button.className = state.mode === "board" ? "cta" : "";
        if (state.mode === "board" && hero) hero.appendChild(button);
        else bottom.appendChild(button);
      }
      bottom.appendChild(siteFooter(doc, supportNote));
      rootNode.appendChild(top);
      rootNode.appendChild(mid);
      rootNode.appendChild(bottom);
      if (state.sheet || (state.busy && state.busyAction === "sheet")) rootNode.appendChild(confirmSheet(doc));
      applyShell(win, rootNode, state.mode);
      const bad = rootNode.querySelector && rootNode.querySelector(".error");
      if (bad && bad.scrollIntoView) bad.scrollIntoView({ block: "center" });
      if (secrets) secrets.setItem("jumpin-ui-mounted", "1");
    }

    function postedFromServer(current, result, values, departAt) {
      let when = values.date + " " + values.time;
      try { when = core.formatWhen(departAt, values.timeZone || "UTC"); } catch (err) { /* keep the typed date */ }
      const kept = current.rides || [];
      return Object.assign(ui.reduce(current, { type: "notice", notice: result.status === "pending" ? "Waiting for approval." : "Trip posted." }), {
        mode: "posted",
        role: "driver",
        status: result.status || "open",
        route: values.from + " → " + values.to,
        when: when,
        seatsText: seatsLabel(Number(values.seats || 3)),
        link: result.status === "pending" || !result.rideId || !cloud || !cloud.publicRideUrl ? "" : cloud.publicRideUrl(result.rideId),
        rideId: result.rideId,
        ride: { rideId: result.rideId, from: values.from, to: values.to, status: result.status || "open", seatsLeft: Number(values.seats || 3), note: values.note || "", driverName: values.name || "" },
        rides: kept,
        smsNote: result.textSent === false ? (result.error || "Trip posted on this browser. Text could not be sent right now.") : ""
      });
    }

    function connectCloud() {
      if (!cloud) return;
      let stop = function () { };
      try {
        stop = cloud.watchBoard(function (rides) {
          try {
            state.rides = (rides || []).map(function (ride) {
              return { rideId: ride.rideId, from: ride.from, to: ride.to, when: whenOf(ride), seats: (ride.seatsLeft == null ? "" : seatsLabel(ride.seatsLeft)), departAt: ride.departAt, durationMinutes: Number(ride.durationMinutes) || 0, rideCost: Number(ride.rideCost) || 0, note: ride.note || "", driverName: ride.driverName || "" };
            });
            if (state.mode === "board") draw();
          } catch (err) { /* leave the board that is already on screen */ }
        }) || function () { };
      } catch (err) { stop = function () { }; }
      cleanups.push(stop);
      if (cloud.watchGroup) {
        cleanups.push(cloud.watchGroup(function (meta) {
          groupMeta = meta || groupMeta;
          supportNote = (meta && meta.supportNote) || "";
          if (state.mode === "board" || state.mode === "posted" || state.mode === "reserved") draw();
        }));
      } else if (cloud.watchSupportNote) {
        cleanups.push(cloud.watchSupportNote(function (note) {
          supportNote = note || "";
          if (state.mode === "board" || state.mode === "posted" || state.mode === "reserved") draw();
        }));
      }
      const params = new URLSearchParams((win.location && win.location.search) || "");
      const view = params.get("view") || "";
      const rideId = params.get("ride") || "";
      const secret = params.get("k") || "";
      if (view === "trip" && rideId && secret) cloud.saveTrip(rideId, secret);
      if (view === "seat" && params.get("r") && secret) cloud.saveSeat(params.get("r"), secret);
      if (secret && win.history && win.history.replaceState && win.location) {
        params.delete("k");
        const next = params.toString();
        win.history.replaceState({}, "", win.location.pathname + (next ? "?" + next : ""));
      }
      if (rideId && (view === "ride" || view === "trip" || view === "seat")) openRide(rideId);
      if (cloud.prepareAppCheck) {
        try { cloud.prepareAppCheck(); } catch (err) { /* the board still works if App Check cannot start */ }
      }
    }

    function shortTripId(id) {
      const s = String(id || "").replace(/^ride_/, "");
      return s ? "#" + s.slice(-6).toUpperCase() : "";
    }

    function keepFocusedVisible(target) {
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT") && target.scrollIntoView) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    on(win, "resize", function () { applyShell(win, rootNode, state.mode); });
    if (win.visualViewport) on(win.visualViewport, "resize", function () { applyShell(win, rootNode, state.mode); keepFocusedVisible(doc.activeElement); });
    if (win.visualViewport) on(win.visualViewport, "scroll", function () { applyShell(win, rootNode, state.mode); });
    draw();
    connectCloud();
    return { getState: function () { return state; }, setState: function (next) { state = next; draw(); }, root: rootNode };
  }

  function brandBar(doc, top, meta) {
    const gid = meta && meta.groupId && meta.groupId !== "default" ? meta.groupId : "";
    const homeHref = "https://waitlink.app/?s=jumpin" + (gid ? "&g=" + encodeURIComponent(gid) : "");
    const bar = el(doc, "div", "bar");
    const link = el(doc, "a", "brand");
    link.href = homeHref;
    link.appendChild(el(doc, "span", "mark", "⏳"));
    link.appendChild(el(doc, "span", "", "WaitLink"));
    const nav = el(doc, "nav");
    nav.appendChild(el(doc, "span", "product", (meta && meta.name) ? "JumpIn · " + meta.name : "JumpIn"));
    const rides = el(doc, "a", "", "Rides");
    rides.href = homeHref;
    nav.appendChild(rides);
    bar.appendChild(link);
    bar.appendChild(nav);
    top.appendChild(bar);
  }

  function loadRides(storage) {
    if (!storage || !storage.getItem) return [];
    try {
      const list = JSON.parse(storage.getItem("jumpin-rides") || "[]");
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveRides(storage, rides) {
    if (!storage || !storage.setItem) return;
    try { storage.setItem("jumpin-rides", JSON.stringify(rides)); } catch (err) { /* keep the screen if storage is full */ }
  }

  function rememberRide(win, storage, state, values, departAt) {
    const zone = values.timeZone || "UTC";
    let when = values.date + " " + values.time;
    try { when = core.formatWhen(departAt, zone); } catch (err) { /* date text already set */ }
    const seats = String(values.seats || 3);
    const id = core.randomId("ride_");
    const ride = {
      id: id,
      from: values.from,
      to: values.to,
      when: when,
      seats: seats + " seats left"
    };
    const rides = [ride].concat(state.rides || []);
    saveRides(storage, rides);
    return Object.assign(ui.reduce(state, { type: "notice", notice: "Trip posted." }), {
      mode: "posted",
      route: values.from + " → " + values.to,
      when: when,
      seatsText: ride.seats,
      rides: rides
    });
  }

  function supportCard(doc, note) {
    const box = el(doc, "div", "support-card");
    box.appendChild(el(doc, "p", "support-title", "Keep JumpIn free for our community"));
    box.appendChild(el(doc, "p", "support-sub", "Text alerts cost money to send. Chip in $1–$2 to help cover SMS costs:"));
    const row = el(doc, "div", "support-row");
    row.appendChild(el(doc, "span", "", note));
    const copy = el(doc, "button", "support-copy", "Copy");
    on(copy, "click", function () {
      const val = note.replace(/^(zelle|venmo)\s*:\s*/i, "").trim();
      const clip = doc.defaultView && doc.defaultView.navigator && doc.defaultView.navigator.clipboard;
      if (clip && clip.writeText) clip.writeText(val);
      copy.textContent = "Copied!";
    });
    row.appendChild(copy);
    box.appendChild(row);
    return box;
  }

  function siteFooter(doc, supportNote) {
    const foot = el(doc, "div", "site-foot");
    if (supportNote) {
      foot.appendChild(el(doc, "span", "support-foot", "Free community tool — chip in $1–$2 via " + supportNote + " to help cover text costs."));
    }
    foot.appendChild(el(doc, "span", "", "JumpIn by WaitLink"));
    [["Privacy", "/jumpin-privacy.html"], ["Terms", "/jumpin-terms.html"], ["Contact", "/jumpin-contact.html"]].forEach(function (item) {
      const link = el(doc, "a", "", item[0]);
      link.href = item[1];
      foot.appendChild(link);
    });
    foot.appendChild(el(doc, "span", "spacer", "© 2026 WaitLink"));
    return foot;
  }

  function rideLine(state) {
    if (state.notice) return state.notice;
    if (state.route) return state.route;
    if (state.status === "pending") return "Waiting for approval.";
    if (state.status === "rejected") return "This trip was not approved.";
    if (state.status === "cancelled") return "This trip was cancelled.";
    if (state.status === "open" && state.seatsLeft === 0) return "Full";
    if (!state.status) return "Ride";
    return "";
  }

  function destroy() {
    while (cleanups.length) cleanups.pop()();
  }

  function start(win) {
    win.document.body.classList.add("jumpin-on");
    try {
      const rawCloud = (win && win.JumpInCloud) || globalThis.JumpInCloud;
      if (rawCloud && typeof rawCloud.attach === "function") win.JumpInCloud = rawCloud.attach(win);
    } catch (err) { /* draw the board even if the cloud client cannot start */ }
    return mount(win);
  }

  return { mount: mount, destroy: destroy, start: start, listenerCount: function () { return cleanups.length; } };
});
