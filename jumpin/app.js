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
    if (!target.tagName) cleanups.push(function () { target.removeEventListener(type, fn); });
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
      "#jumpin-root{display:flex;flex-direction:column;width:100%;max-width:100vw;overflow-x:hidden;min-height:100%;background:radial-gradient(circle at top right,#ecfeff 0%,#f8fafc 45%,#f1f5f9 100%);color:var(--text-main,#090d16);font-family:var(--font-family-body,Inter,-apple-system,BlinkMacSystemFont,sans-serif);font-size:16px;line-height:1.5;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior-y:contain}",
      "#jumpin-root.portal{min-height:100dvh}",
      "#jumpin-root *{box-sizing:border-box}",
      "#jumpin-root a{color:inherit;text-decoration:none}",
      "#jumpin-top,#jumpin-bottom{flex:0 0 auto}",
      "#jumpin-top{position:sticky;top:0;z-index:20;width:100%;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.03)}",
      "#jumpin-top .bar{width:min(1040px,100%);margin:0 auto;display:flex;align-items:center;gap:16px;min-height:64px;padding:calc(12px + env(safe-area-inset-top)) 24px 12px}",
      "#jumpin-top .brand{display:flex;align-items:center;gap:8px;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-weight:700;font-size:18px}",
      "#jumpin-top .mark{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:rgba(8,145,178,.12)}",
      "#jumpin-top .product{color:var(--primary,#0891b2);font-weight:700}",
      "#jumpin-top nav{margin-left:auto;display:flex;align-items:center;gap:16px}",
      "#jumpin-top nav a{color:var(--text-muted,#1e293b);font-weight:600}",
      "#jumpin-top .title{font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:18px}",
      "#jumpin-root.app-screen{width:100%;height:auto !important;min-height:100dvh;overflow:visible !important;background:var(--bg-dark,#f1f5f9)}",
      "#jumpin-root.app-screen #jumpin-top{display:flex;align-items:center;gap:12px;width:100%;padding:env(safe-area-inset-top) 16px 0;background:var(--bg-card,#fff);border-bottom:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root.app-screen #jumpin-top .bar{flex:1;padding:12px 0;min-height:56px}",
      "#jumpin-root.app-screen #jumpin-top .back-btn{flex-shrink:0;display:inline-flex;align-items:center;gap:2px;border:0;background:transparent;color:var(--primary,#0891b2);font-size:16px;font-weight:600;padding:6px 4px;cursor:pointer}",
      "#jumpin-root.app-screen #jumpin-top .back-btn::before{content:\"‹\";font-size:24px;line-height:1;font-weight:400;margin-top:-2px}",
      "#jumpin-root.app-screen #jumpin-top .screen-title{display:none}",
      "@keyframes jumpin-mid-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes jumpin-sheet-in{from{opacity:0}to{opacity:1}}",
      "@keyframes jumpin-sheet-up{from{opacity:0}to{opacity:1}}",
      "#jumpin-mid{flex:1 1 auto;width:100%;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:none}",
      "#jumpin-root.app-screen #jumpin-mid{flex:1 0 auto;width:100%;max-width:640px;margin:0 auto;padding:24px 20px 28px;overflow:visible}",
      "#jumpin-root.app-screen #jumpin-mid.anim-in{animation:jumpin-mid-in .16s ease-out}",
      "#jumpin-root.app-screen #jumpin-mid.post-card{width:calc(100% - 32px);max-width:460px;margin:20px auto;padding:0;background:transparent;border:0;box-shadow:none}",
      "#jumpin-mid .post-section{background:var(--bg-card,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 4px 14px rgba(15,23,42,.05)}",
      "#jumpin-mid .post-section input:last-child{margin-bottom:0}",
      "#jumpin-mid .route-field{position:relative;padding-left:22px}",
      "#jumpin-mid .route-dot{position:absolute;left:2px;top:36px;width:10px;height:10px;border-radius:50%;background:#0891b2}",
      "#jumpin-mid .route-dot.from::after{content:'';position:absolute;left:4px;top:12px;width:2px;height:52px;background:#cbd5e1}",
      "#jumpin-mid .route-dot.to{top:38px;border-radius:3px;background:#0f172a}",
      "#jumpin-root .seat-pills{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:0 0 14px}",
      "#jumpin-root .seat-pill{min-height:40px;padding:0;border:1px solid var(--border-color,#cbd5e1);border-radius:10px;background:var(--bg-input,#f8fafc);color:var(--text-main,#090d16);font-size:15px;font-weight:700;cursor:pointer;transition:background-color .12s,border-color .12s,color .12s}",
      "#jumpin-root .seat-pill.active{background:var(--primary,#0891b2);border-color:var(--primary,#0891b2);color:#fff;box-shadow:0 2px 8px rgba(8,145,178,.22)}",
      "#jumpin-root .seat-pill:disabled{opacity:.35;cursor:not-allowed;background:#f1f5f9}",
      "#jumpin-mid .ride-sec{display:contents}",
      "#jumpin-mid .driver-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;margin-left:auto}",
      "@keyframes jumpin-shimmer{0%,100%{opacity:.5}50%{opacity:1}}",
      "#jumpin-mid .skel-card{padding:16px;background:var(--bg-card,#fff);border:1px solid #e2e8f0;border-radius:16px;animation:jumpin-shimmer 1.1s ease-in-out infinite}",
      "#jumpin-mid .skel-line{height:14px;border-radius:8px;background:#e2e8f0;margin-bottom:8px}",
      "#jumpin-mid .skel-line.w70{width:70%}",
      "#jumpin-mid .skel-line.w45{width:45%;margin-bottom:0}",
      "#jumpin-root .row:active,#jumpin-root .chip-btn:active,#jumpin-root .seat-pill:active,#jumpin-mid .filter-chip:active{transform:scale(0.97)}",
      "#jumpin-mid .msg-row{background:#f1f5f9;border-radius:14px;padding:9px 12px;margin:6px 0;font-size:14px;color:var(--text-main,#0f172a)}",
      "#jumpin-mid .confirm .link-box-sep{margin-top:14px;padding-top:14px;border-top:1px dashed #cbd5e1}",
      "#jumpin-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10000;padding:8px 16px;border-radius:999px;background:#0f172a;color:#fff;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(15,23,42,.25);pointer-events:none}",
      "#jumpin-mid .driver-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 12px;margin-bottom:12px;border-bottom:1px solid #f1f5f9}",
      "#jumpin-mid .driver-summary-txt{font-size:14px;font-weight:600;color:var(--text-main,#090d16);overflow-wrap:anywhere}",
      "#jumpin-mid .wrap{width:min(1080px,100%);margin:0 auto;padding:28px 24px 16px}",
      "#jumpin-mid .hero{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;margin:0 0 22px;padding:28px 32px;background:linear-gradient(135deg,#ffffff 0%,#f0fdfa 58%,#e0f2fe 100%);border:1px solid #bae6fd;border-top:3px solid var(--primary,#0891b2);border-radius:var(--radius-lg,20px);box-shadow:0 12px 30px rgba(8,145,178,.09)}",
      "#jumpin-mid .hero-eyebrow{display:inline-block;padding:4px 10px;margin:0 0 10px;border-radius:999px;background:rgba(8,145,178,.12);color:#0e7490;font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase}",
      "#jumpin-mid .hero .copy{flex:1 1 260px;min-width:0}",
      "#jumpin-mid h1{margin:0 0 8px;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:36px;line-height:1.15;letter-spacing:-0.03em}",
      "#jumpin-mid .hero-org{margin:10px 0 0;font-size:13px;color:#475569}",
      "#jumpin-mid .hero-org a{color:var(--primary,#0891b2);font-weight:700;text-decoration:underline;text-underline-offset:2px}",
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
      "#jumpin-root.app-screen #jumpin-bottom{position:sticky;bottom:0;margin-top:auto;padding:12px 16px calc(16px + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid var(--border-color,#cbd5e1)}",
      "#jumpin-root.app-screen.form-open #jumpin-bottom,#jumpin-root.app-screen:has(#jumpin-mid input:focus,#jumpin-mid select:focus) #jumpin-bottom{position:static;margin-top:0;padding:8px 16px calc(96px + env(safe-area-inset-bottom));background:transparent;border-top:0;backdrop-filter:none;-webkit-backdrop-filter:none}",
      "@media (min-width:701px){#jumpin-root.app-screen #jumpin-mid{padding:36px 24px 20px}#jumpin-root.app-screen #jumpin-bottom{position:static;margin-top:0;padding:8px 24px 32px;background:transparent;border-top:0}}",
      "#jumpin-mid .hero button,#jumpin-bottom button{min-height:52px;border:0;border-radius:var(--radius-md,14px);background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);color:#fff;font-size:17px;font-weight:700;cursor:pointer;transition:transform .12s,box-shadow .15s,filter .15s}",
      "#jumpin-mid .hero button:hover,#jumpin-bottom button:hover{filter:brightness(1.05)}",
      "#jumpin-root.app-screen #jumpin-bottom button{display:block;width:100%;max-width:460px;margin:0 auto}",
      "#jumpin-bottom button:disabled,#jumpin-root .textish:disabled{opacity:.55;cursor:not-allowed}",
      "body.jumpin-android #jumpin-bottom button,body.jumpin-android #jumpin-mid .hero button{border-radius:var(--radius-lg,20px)}",
      "#jumpin-mid .lbl{display:block;margin:0 0 6px;color:var(--text-muted,#1e293b);font-size:14px;font-weight:600}",
      "#jumpin-mid input,#jumpin-mid select{width:100%;min-width:0;max-width:100%;font-size:16px;min-height:44px;margin:0 0 14px;padding:0 12px;scroll-margin-top:88px;scroll-margin-bottom:120px;color:var(--text-main,#090d16);background:var(--bg-input,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-sm,8px)}",
      "#jumpin-root input,#jumpin-root textarea{user-select:text;-webkit-user-select:text;-webkit-touch-callout:default}",
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
      "#jumpin-root .dur-stepper{display:flex;align-items:center;gap:10px;margin:0 0 14px}",
      "#jumpin-root .dur-btn{min-width:52px;min-height:44px;padding:0 14px;border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-sm,8px);background:var(--bg-card,#fff);color:var(--primary,#0891b2);font-size:18px;font-weight:700;cursor:pointer}",
      "#jumpin-root .dur-btn:hover:not(:disabled){background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .dur-btn:disabled{opacity:.4;cursor:not-allowed;color:#64748b}",
      "#jumpin-root .dur-val{flex:1;min-height:44px;display:grid;place-items:center;padding:0 12px;background:#f8fafc;border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-sm,8px);font-size:16px;font-weight:700;color:var(--text-main,#090d16)}",
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
      "#jumpin-root *{-webkit-tap-highlight-color:transparent}",
      "#jumpin-root button:active{transform:scale(0.98)}",
      "#jumpin-root .jumpin-mobile-bar{display:none}",
      "#jumpin-top nav .jumpin-nav-install{display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:4px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}",
      "#jumpin-top nav .jumpin-nav-install:hover{border-color:var(--primary,#0891b2);color:var(--primary-dark,#0e7490)}",
      "#jumpin-top nav .jumpin-nav-info{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;min-height:32px;padding:0;border-radius:999px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:14px;font-weight:700;cursor:pointer}",
      "#jumpin-top nav .jumpin-nav-info:hover{border-color:var(--primary,#0891b2);color:var(--primary-dark,#0e7490)}",
      "#jumpin-root #jumpin-mid .error{color:#dc2626 !important;font-weight:600;font-size:14px;margin:6px 0 12px;padding:8px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;overflow-wrap:anywhere}",
      "#jumpin-root .error,#jumpin-sheet .error{color:#dc2626 !important;font-weight:600;font-size:14px;margin:6px 0 12px;padding:8px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;overflow-wrap:anywhere}",
      "#jumpin-root #jumpin-mid input.input-invalid,#jumpin-root #jumpin-mid textarea.input-invalid{border-color:#dc2626 !important;background:#fef2f2 !important}",
      "@media (max-width:700px){#jumpin-root.app-screen:has(#jumpin-mid input:focus,#jumpin-mid select:focus){padding-bottom:42vh}#jumpin-top .bar{padding:calc(10px + env(safe-area-inset-top)) 14px 10px;gap:8px;min-height:52px}#jumpin-top .brand{font-size:16px}#jumpin-top nav a{display:none}#jumpin-root.app-screen #jumpin-top{padding:calc(8px + env(safe-area-inset-top)) 12px 8px;gap:8px}#jumpin-root.app-screen #jumpin-top .bar{display:none}#jumpin-root.app-screen #jumpin-top .screen-title{display:block;flex:1;text-align:center;font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:17px;font-weight:700;padding-right:54px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#jumpin-root.app-screen #jumpin-top .back-btn{min-height:36px;padding:0 4px;font-size:15px}#jumpin-root.app-screen #jumpin-mid{padding:10px 12px calc(36px + env(safe-area-inset-bottom))}#jumpin-root.portal #jumpin-mid{padding-bottom:16px}#jumpin-root.portal #jumpin-bottom{padding-bottom:calc(56px + env(safe-area-inset-bottom))}#jumpin-root .jumpin-mobile-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:5px 10px max(6px,env(safe-area-inset-bottom));background:rgba(255,255,255,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid #cbd5e1;box-shadow:0 -4px 18px rgba(15,23,42,.08)}#jumpin-root .jumpin-mobile-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;padding:4px;border:0;border-radius:10px;background:transparent;color:#475569;font-size:11px;font-weight:700;cursor:pointer}#jumpin-root .jumpin-mobile-tab.active{background:#ecfeff;color:#0e7490}#jumpin-root .jumpin-mobile-tab .ico{font-size:16px;line-height:1}#jumpin-root.app-screen #jumpin-mid.post-card{width:calc(100% - 24px);margin:10px auto;padding:0;background:transparent;border:0;box-shadow:none}#jumpin-mid .wrap{padding:10px 12px 12px}#jumpin-mid .hero{padding:0 2px;margin:0 0 8px;background:transparent;border:0;box-shadow:none;gap:0}#jumpin-mid .hero .copy{width:100%}#jumpin-mid .hero .hero-eyebrow,#jumpin-mid .hero h1,#jumpin-mid .hero .hero-org{display:none}#jumpin-mid .hero p.muted{font-size:12px;font-style:italic;line-height:1.3;margin:4px 0 0 2px;color:#475569}#jumpin-mid .hero-badges{width:100%;justify-content:space-between;margin-bottom:0;gap:8px}#jumpin-root .hero-start-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:999px;background:#fff;border:1px solid #cbd5e1;color:var(--primary-dark,#0e7490);font-size:12.5px;font-weight:700;white-space:nowrap;box-shadow:0 1px 3px rgba(15,23,42,.04)}#jumpin-mid .post-head{margin:0 0 10px;padding:0;border:0}#jumpin-mid .post-head h1{display:none}#jumpin-mid .board{gap:10px}#jumpin-mid .row{padding:12px 14px;gap:4px;border-radius:14px}#jumpin-mid .row .route{font-size:15px;line-height:1.25}#jumpin-mid .row .meta{font-size:12.5px;line-height:1.3}#jumpin-mid .row .card-foot{margin-top:2px;padding-top:0;border-top:0;font-size:12.5px;gap:4px 8px}#jumpin-mid .row .mini-av{display:none}#jumpin-mid .row .status-pill{padding:2px 8px;font-size:11px}#jumpin-mid .confirm{padding:20px 18px;border-radius:16px}#jumpin-mid .confirm.ride-detail{padding:0;background:transparent;border:0;box-shadow:none}#jumpin-mid .confirm.ride-detail .ride-sec{display:block;background:var(--bg-card,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:0 3px 10px rgba(15,23,42,.04)}#jumpin-mid .confirm.ride-detail .ride-sec > *:first-child{margin-top:0}#jumpin-mid .confirm.ride-detail .ride-sec > *:last-child{margin-bottom:0}#jumpin-mid .confirm h1{font-size:22px}#jumpin-mid .confirm .route{font-size:18px}#jumpin-mid .confirm h1 + .route{margin-top:14px;padding-top:14px}#jumpin-mid .hero button.cta{display:none}#jumpin-root.app-screen #jumpin-bottom{padding:12px 14px calc(28px + env(safe-area-inset-bottom))}#jumpin-root.app-screen.form-open #jumpin-bottom{padding:8px 14px calc(96px + env(safe-area-inset-bottom))}#jumpin-root .site-foot{display:none}#jumpin-sheet{top:auto;bottom:0;left:0;right:0;transform:none;width:100%;max-width:100%;border-radius:20px 20px 0 0;padding:10px 18px calc(28px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(0,0,0,.18)}#jumpin-sheet.anim-in{animation:jumpin-sheet-up .18s cubic-bezier(.2,.8,.2,1)}#jumpin-sheet::before{content:'';display:block;width:38px;height:4px;border-radius:999px;background:#cbd5e1;margin:0 auto 12px}}",
      "@media (max-width:480px){#jumpin-mid h1{font-size:24px}#jumpin-mid .row .route{font-size:16px}#jumpin-mid .link-row{flex-wrap:wrap}#jumpin-mid .link-copy{width:100%;justify-content:center}#jumpin-mid .link-row.link-row-inline{flex-wrap:nowrap}#jumpin-mid .link-row.link-row-inline .link-copy{width:auto;min-width:44px;padding:0 12px}#jumpin-root .action-row button,#jumpin-root .action-row a{flex:1 1 100%;justify-content:center;text-align:center}}",
      "@media (max-width:380px){#jumpin-mid .confirm{padding:16px 14px}#jumpin-mid .confirm.ride-detail{padding:0}#jumpin-mid .confirm h1{font-size:20px}}",
      "#jumpin-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(9,13,22,.48)}",
      "#jumpin-sheet{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(448px,calc(100% - 32px));max-height:calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:auto;z-index:9999;background:var(--bg-card,#fff);color:var(--text-main,#090d16);padding:20px;border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-lg,20px);box-shadow:0 16px 40px rgba(0,0,0,.22)}#jumpin-sheet.anim-in{animation:jumpin-sheet-in .16s ease-out}",
      "#jumpin-sheet p{margin:0 0 12px;font-weight:600}",
      "#jumpin-sheet p.muted{margin:-4px 0 14px;font-weight:400}",
      "#jumpin-sheet .lbl{display:block;margin:0 0 4px;font-size:13px;font-weight:600;color:var(--text-muted,#1e293b)}",
      "#jumpin-sheet input{width:100%;min-width:0;max-width:100%;font-size:16px;min-height:44px;margin:0 0 12px;padding:0 12px;color:var(--text-main,#090d16);background:var(--bg-input,#fff);border:1px solid var(--border-color,#cbd5e1);border-radius:var(--radius-sm,8px)}",
      "#jumpin-sheet .hint{font-size:13px;color:var(--text-muted,#475569);margin:-4px 0 10px}",
      "#jumpin-sheet .error{font-size:13px;color:#be123c;margin:0 0 10px;font-weight:600}",
      "#jumpin-sheet .error{font-size:13.5px;color:#dc2626 !important;margin:4px 0 10px;font-weight:600}",
      "#jumpin-sheet button{min-height:44px;margin:6px 10px 0 0}",
      "#jumpin-sheet .seat-pills button,#jumpin-sheet .dur-stepper button{min-height:40px;margin:0}",
      "#jumpin-sheet .sheet-menu{display:grid;gap:8px;margin:0 0 12px}",
      "#jumpin-sheet .sheet-item{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:48px;margin:0;padding:12px 14px;border:1px solid var(--border-color,#e2e8f0);border-radius:12px;background:var(--bg-input,#f8fafc);color:var(--text-main,#090d16);font-size:15px;font-weight:600;text-align:left;cursor:pointer}",
      "#jumpin-sheet .sheet-item.danger{color:#be123c;background:#fff1f2;border-color:#fecdd3}",
      "#jumpin-sheet.compact-info{padding:12px 16px calc(18px + env(safe-area-inset-bottom))}",
      "@media (min-width:701px){#jumpin-sheet.compact-info{width:min(360px,calc(100% - 32px));padding:16px}}",
      "#jumpin-sheet.compact-info>p:first-child{font-size:14px;margin:0 0 8px}",
      "#jumpin-sheet.compact-info .sheet-menu{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 8px}",
      "#jumpin-sheet.compact-info .sheet-item{min-height:36px;padding:6px 10px;border-radius:10px;font-size:13px;justify-content:center;text-align:center}",
      "#jumpin-sheet.compact-info .sheet-item:last-child{grid-column:1 / -1}",
      "#jumpin-sheet.compact-info .hint,#jumpin-sheet.compact-info p.muted{font-size:12px;line-height:1.35;margin:0 0 8px}",
      "#jumpin-sheet.compact-info .action-row{margin-top:8px}",
      "#jumpin-sheet.compact-info .action-row button{min-height:38px;font-size:14px;border-radius:10px}",
      "#jumpin-sheet.info-detail{max-height:82dvh;display:flex;flex-direction:column}",
      "#jumpin-sheet .sheet-back{min-height:34px;margin:0;padding:0 4px;border:0;background:transparent;color:var(--primary,#0891b2);font-size:15px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:2px}",
      "#jumpin-sheet .info-body{overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:58dvh;padding-right:2px}",
      "#jumpin-sheet .info-card{padding:10px 12px;margin:0 0 8px;border:1px solid var(--border-color,#e2e8f0);border-radius:12px;background:var(--bg-input,#f8fafc)}",
      "#jumpin-sheet .info-card strong{display:block;font-size:13px;margin:0 0 3px;color:var(--text-main,#090d16)}",
      "#jumpin-sheet .info-card span{display:block;font-size:12.5px;line-height:1.45;color:var(--text-muted,#475569)}",
      "#jumpin-sheet .info-ext{display:inline-block;margin:4px 0 0;font-size:12.5px;font-weight:700;color:var(--primary,#0891b2)}",
      "#jumpin-sheet .sheet-pax-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--border-color,#e2e8f0);border-radius:12px;background:var(--bg-input,#f8fafc)}",
      "#jumpin-sheet .sheet-pax-info{min-width:0;flex:1;font-size:14px;font-weight:600;overflow-wrap:anywhere}",
      "#jumpin-sheet .sheet-pax-actions{display:inline-flex;align-items:center;gap:6px;flex-shrink:0}",
      "#jumpin-sheet .sheet-pax-actions button{min-height:36px;margin:0}",
      "#jumpin-sheet .sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px}",
      "#jumpin-sheet .sheet-head p{margin:0;font-weight:700;font-size:16px}",
      "#jumpin-sheet .sheet-x{min-width:36px;min-height:36px;margin:0;padding:0;border:1px solid var(--border-color,#e2e8f0);border-radius:999px;background:var(--bg-input,#f8fafc);color:var(--text-muted,#475569);font-size:16px;font-weight:700;cursor:pointer;display:grid;place-items:center}",
      "#jumpin-root .action-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px;align-items:center}",
      "#jumpin-root .secondary-action-row{margin-top:12px;padding-top:10px;border-top:1px solid var(--border-color,#e2e8f0)}",
      "#jumpin-root .form-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;box-sizing:border-box;align-items:start}",
      "#jumpin-root .form-pair>div{min-width:0;width:100%}",
      "#jumpin-root .form-pair input,#jumpin-root .form-pair select{width:100%;max-width:100%;min-width:0;height:44px;box-sizing:border-box}",
      "#jumpin-root .form-pair input[type=\"date\"],#jumpin-root .form-pair input[type=\"time\"]{display:block;width:100%;min-width:0;max-width:100%;height:44px;line-height:42px;-webkit-appearance:none;appearance:none;background:var(--bg-input,#f8fafc);border:1px solid var(--border-color,#cbd5e1);border-radius:12px;font-weight:600;padding:0 12px;text-align:left}",
      "#jumpin-root .form-pair .dur-stepper{width:100%;gap:6px}",
      "#jumpin-root .form-pair .dur-btn{min-width:40px;padding:0 10px}",
      "#jumpin-root .form-pair .dur-val{min-width:0;padding:0 6px;font-size:14px}",
      "@media (max-width:600px){#jumpin-root .hero{padding:16px 14px;margin-bottom:12px}#jumpin-root .hero h1{font-size:22px;margin:6px 0 4px}}",
      "@media (max-width:360px){#jumpin-root .form-pair{grid-template-columns:1fr}}",
      "#jumpin-root .action-row select{width:auto;min-width:76px;margin:0;min-height:44px}",
      "#jumpin-root .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 14px}",
      "#jumpin-root .hero-badges{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}",
      "#jumpin-root .hero-badges .hero-eyebrow{margin:0}",
      "#jumpin-root .hero-group-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;background:linear-gradient(135deg,#0891b2 0%,#0e7490 100%);color:#fff;font-size:12.5px;font-weight:700;letter-spacing:.01em;box-shadow:0 2px 8px rgba(8,145,178,.22)}",
      "@media (min-width:701px){#jumpin-root .hero-start-pill{display:none}}",
      "#jumpin-root .chip-btn{background:var(--bg-input,#f8fafc);color:var(--primary,#0891b2);border:1px solid var(--border-color,#cbd5e1);border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;min-height:30px;cursor:pointer}",
      "#jumpin-root .chip-btn.active{background:var(--primary,#0891b2);border-color:var(--primary,#0891b2);color:#fff;box-shadow:0 2px 8px rgba(8,145,178,.22)}",
      "#jumpin-root .dt-pill{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;margin:0 0 8px;padding:0 12px;border:1px solid var(--border-color,#cbd5e1);border-radius:12px;background:var(--bg-input,#f8fafc);color:var(--text-main,#090d16);font-size:15px;font-weight:600;text-align:left;cursor:pointer}",
      "#jumpin-root .dt-pill.open{border-color:var(--primary,#0891b2);background:#ecfeff}",
      "#jumpin-root .dt-pill.input-invalid{border-color:#dc2626 !important;background:#fef2f2 !important}",
      "#jumpin-root .dt-drawer{margin:0 0 12px;padding:8px;border:1px solid var(--border-color,#cbd5e1);border-radius:12px;background:var(--bg-card,#fff);box-shadow:0 6px 18px rgba(15,23,42,.08)}",
      "#jumpin-root .dt-days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:200px;overflow-y:auto;-webkit-overflow-scrolling:touch}",
      "#jumpin-root .dt-wheel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}",
      "#jumpin-root .dt-col{display:flex;flex-direction:column;gap:4px;max-height:152px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px}",
      "#jumpin-root .dt-opt{min-height:34px;margin:0;padding:4px 8px;border:1px solid var(--border-color,#e2e8f0);border-radius:9px;background:var(--bg-input,#f8fafc);color:var(--text-main,#090d16);font-size:13px;font-weight:600;cursor:pointer;text-align:center}",
      "#jumpin-root .dt-opt.active{background:var(--primary,#0891b2);border-color:var(--primary,#0891b2);color:#fff}",
      "#jumpin-root .dt-done{width:100%;min-height:36px;margin:8px 0 0;padding:6px 12px;border:0;border-radius:9px;background:var(--primary,#0891b2);color:#fff;font-size:13px;font-weight:700;cursor:pointer}",
      "#jumpin-root .action-row.row-split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
      "#jumpin-root .action-row.row-split button{width:100%;min-width:0;margin:0;justify-content:center;text-align:center}",
      "#jumpin-ptr{display:flex;align-items:center;justify-content:center;overflow:hidden;height:0;opacity:0;font-size:12.5px;font-weight:700;color:var(--primary,#0891b2);transition:height .15s,opacity .15s}",
      "#jumpin-root .chip-btn:hover{background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .board-search{width:100%;max-width:340px;min-height:40px;margin:0;padding:0 14px;font-size:15px;border:1px solid var(--border-color,#cbd5e1);border-radius:12px;background:var(--bg-card,#fff);color:var(--text-main,#090d16)}",
      "#jumpin-mid .board-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 14px;margin:0 0 14px}",
      "#jumpin-mid .filter-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap;max-width:100%}",
      "#jumpin-mid .filter-chip{flex:0 0 auto;min-height:36px;padding:6px 10px;border-radius:999px;border:1px solid var(--border-color,#cbd5e1);background:var(--bg-card,#fff);color:var(--text-muted,#1e293b);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}",
      "#jumpin-mid .filter-chip.active{background:var(--primary,#0891b2);color:#fff;border-color:var(--primary,#0891b2);box-shadow:0 2px 8px rgba(8,145,178,.22)}",
      "#jumpin-mid .pager{display:flex;align-items:center;justify-content:center;gap:8px;margin:18px 0 6px;flex-wrap:wrap}",
      "#jumpin-mid .pager-btn{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--border-color,#cbd5e1);background:var(--bg-card,#fff);color:var(--primary,#0891b2);font-size:14px;font-weight:700;cursor:pointer}",
      "#jumpin-mid .pager-btn:disabled{opacity:.45;cursor:not-allowed;color:var(--text-muted,#64748b)}",
      "#jumpin-mid .pager-info{font-size:14px;font-weight:600;color:var(--text-muted,#475569);padding:0 6px;white-space:nowrap}",
      "@media (max-width:700px){#jumpin-mid .board-tools{flex-wrap:nowrap;gap:8px;margin:0 0 10px}#jumpin-root .board-search{flex:0 1 138px;min-width:108px;max-width:150px;min-height:34px;padding:4px 10px;font-size:13px}#jumpin-mid .filter-row{flex:1 1 auto;min-width:0;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:4px;padding-bottom:0}#jumpin-mid .filter-chip{min-height:34px;padding:4px 8px;font-size:12px}#jumpin-mid .filter-row::-webkit-scrollbar{display:none}}",
      "@media (max-width:519px){#jumpin-mid .pager-edge{display:none}}",
      "#jumpin-root .recovery-box{margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color,#e2e8f0)}",
      "#jumpin-root .section-lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted,#475569);margin:14px 0 6px}",
      "#jumpin-mid .reserve-head{margin:18px 0 12px;padding-top:16px;border-top:1px solid var(--border-color,#e2e8f0);font-family:var(--font-family-heading,Outfit,Inter,sans-serif);font-size:17px;font-weight:700;color:var(--text-main,#090d16)}",
      "#jumpin-root .rider-row{display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:8px 12px;margin-bottom:6px;background:var(--bg-input,#f8fafc);border:1px solid var(--border-color,#e2e8f0);border-radius:10px;font-size:14px;font-weight:600;overflow-wrap:anywhere}",
      "#jumpin-root .rider-ack-btn,#jumpin-root .rider-ack-pill{margin-left:auto;flex:0 0 auto;padding:0 10px;border-radius:999px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}",
      "#jumpin-root .rider-ack-btn{min-width:40px;min-height:34px;font-size:12px;cursor:pointer;transition:transform .12s,background-color .15s}",
      "#jumpin-root .rider-ack-pill{min-height:28px;font-size:12px}",
      "#jumpin-root .rider-ack-btn.unseen,#jumpin-root .rider-ack-pill.unseen{background:#fef3c7;border:1px solid #f59e0b;color:#92400e}",
      "#jumpin-root .rider-ack-btn.seen,#jumpin-root .rider-ack-pill.seen{background:#dcfce7;border:1px solid #86efac;color:#15803d}",
      "#jumpin-root .msg-row{padding:8px 12px;margin-bottom:6px;background:rgba(8,145,178,.06);border-radius:10px;font-size:14px;color:var(--text-main,#090d16);overflow-wrap:anywhere}",
      "#jumpin-root .textish{background:var(--bg-input,#f8fafc);color:var(--primary,#0891b2);border:1px solid var(--border-color,#cbd5e1);border-radius:10px;padding:0 16px;font-size:14px;font-weight:600;min-height:44px;cursor:pointer}",
      "#jumpin-root .textish:hover{background:rgba(8,145,178,.08);border-color:var(--primary,#0891b2)}",
      "#jumpin-root .linkish{display:block;background:transparent;color:var(--primary,#0891b2);border:0;padding:6px 0;font-size:14px;font-weight:600;text-align:left;cursor:pointer}",
      "#jumpin-root .linkish:hover{text-decoration:underline}",
      "#jumpin-root button.danger{background:transparent;color:var(--accent-rose,#be123c);border:1px solid #fecdd3;border-radius:10px;padding:0 16px;font-size:15px;font-weight:700;min-height:44px;cursor:pointer}",
      "#jumpin-sheet button.confirm-primary,#jumpin-sheet a.confirm-primary{display:inline-flex;align-items:center;justify-content:center;background:var(--primary,#0891b2);color:#fff;border:0;border-radius:10px;padding:0 18px;font-size:15px;font-weight:700;min-height:44px;cursor:pointer;text-decoration:none}",
      "#jumpin-sheet ul.member-list{margin:8px 0 14px;padding-left:18px;font-size:14px;color:var(--text-muted,#334155);line-height:1.5}",
      "#jumpin-sheet ul.member-list li{margin:4px 0}",
      "#jumpin-sheet a.mail-link{color:var(--primary,#0891b2);font-weight:700;text-decoration:underline}",
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
      "#jumpin-root .site-foot .support-foot{flex-basis:100%;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#92400e;font-weight:600;font-size:13px}",
      "body.jumpin-ios #jumpin-root{background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"Segoe UI\",Roboto,sans-serif}",
      "body.jumpin-ios #jumpin-top{background:rgba(249,249,249,.86);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(60,60,67,.2);box-shadow:none}",
      "body.jumpin-ios #jumpin-mid .hero{background:#ffffff;border:0.5px solid rgba(60,60,67,.16);border-top:0.5px solid rgba(60,60,67,.16);border-radius:16px;box-shadow:none}",
      "body.jumpin-ios #jumpin-mid h1{font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",sans-serif;letter-spacing:-.025em}",
      "body.jumpin-ios #jumpin-mid .filter-row{background:#e5e5ea;padding:2px;border-radius:10px;gap:1px}",
      "body.jumpin-ios #jumpin-mid .filter-chip{border:0;background:transparent;border-radius:8px;min-height:32px;padding:4px 8px;color:#1c1c1e;box-shadow:none}",
      "body.jumpin-ios #jumpin-mid .filter-chip.active{background:#ffffff;color:#0891b2;box-shadow:0 1px 4px rgba(0,0,0,.12)}",
      "body.jumpin-ios #jumpin-root .board-search{background:#e5e5ea;border:0;border-radius:10px;min-height:36px}",
      "body.jumpin-ios #jumpin-mid .row{background:#ffffff;border:0.5px solid rgba(60,60,67,.16);border-radius:14px;box-shadow:none}",
      "body.jumpin-ios #jumpin-mid .row:active{background:#e5e5ea;transform:scale(0.988)}",
      "body.jumpin-ios #jumpin-mid .row-head::after{content:\"›\";color:#c7c7cc;font-size:20px;font-weight:600;line-height:1;margin-left:4px;align-self:center}",
      "body.jumpin-ios #jumpin-mid .confirm,body.jumpin-ios #jumpin-root.app-screen #jumpin-mid.post-card{border:0.5px solid rgba(60,60,67,.16);border-radius:16px;box-shadow:none}",
      "body.jumpin-ios #jumpin-mid .hero button,body.jumpin-ios #jumpin-bottom button{background:#0891b2;border-radius:14px;box-shadow:none}",
      "body.jumpin-ios #jumpin-root.portal #jumpin-bottom{background:rgba(249,249,249,.86);backdrop-filter:blur(20px);border-top:0.5px solid rgba(60,60,67,.2)}",
      "@media (max-width:700px){body.jumpin-ios #jumpin-sheet{top:auto;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:24px 20px calc(24px + env(safe-area-inset-bottom))}body.jumpin-ios #jumpin-sheet::before{content:\"\";display:block;width:38px;height:4px;border-radius:999px;background:#d1d1d6;margin:-10px auto 14px}}"
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
    let platformNotice = { platformEnabled: true, iosThemeEnabled: false, needARideEnabled: false, maintenanceMessage: "" };
    let driverEditOpen = false;
    let extrasOpen = false;
    let updatesOpen = false;
    let boardLoaded = !cloud;
    function syncIosTheme() {
      if (!doc.body || !doc.body.classList) return;
      if (platformNotice.iosThemeEnabled) doc.body.classList.add("jumpin-ios");
      else doc.body.classList.remove("jumpin-ios");
    }
    let memberModal = null;
    function openMemberModal(result) {
      if (!result || !result.memberDenied) return;
      memberModal = {
        groupName: groupMeta.name || "Its-OK",
        contactEmail: result.contactEmail || groupMeta.contactEmail || "",
        isDefault: !groupMeta.groupId || groupMeta.groupId === "default"
      };
    }
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

    function loadRecentRoutes() {
      if (!secrets || !secrets.getItem) return [];
      try {
        const arr = JSON.parse(secrets.getItem("waitlink_jumpin_routes") || "[]");
        return Array.isArray(arr) ? arr.slice(0, 3) : [];
      } catch (err) { return []; }
    }

    function saveRecentRoute(from, to) {
      if (!secrets || !secrets.setItem || !from || !to) return;
      try {
        const list = loadRecentRoutes().filter(function (r) { return r && (r.from !== from || r.to !== to); });
        list.unshift({ from: from, to: to });
        secrets.setItem("waitlink_jumpin_routes", JSON.stringify(list.slice(0, 3)));
      } catch (err) { /* ignore storage quota errors */ }
    }

    function showToast(msg) {
      if (!doc.body) return;
      const prev = doc.getElementById("jumpin-toast");
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
      const t = el(doc, "div", "", msg);
      t.id = "jumpin-toast";
      doc.body.appendChild(t);
      if (win.setTimeout) {
        const tid = win.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2000);
        cleanups.push(function () { if (win.clearTimeout) win.clearTimeout(tid); if (t.parentNode) t.parentNode.removeChild(t); });
      }
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
      updatesOpen = false;
      stopRide = cloud.watchRide(rideId, function (ride) {
        const kept = state.rides || [];
        if (!ride) {
          state = Object.assign(ui.reduce(state, { type: "ride", ride: { status: "missing", seatsLeft: 0 }, role: "" }), { rides: kept, ride: null });
        } else if (ride.status === "open" && (state.reserveOpen || state.editOpen || state.waitlistOpen || state.driverSheet || state.recovery || state.sheet || state.busy || state.mode === "reserved")) {
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
            notice: ride.status === "open" && (prevNotice === "You have a seat." || /^You have \d+ seats\.$/.test(prevNotice || "") || prevNotice === "Passenger added." || prevNotice === "Seat cancelled." || prevNotice === "Seats updated." || prevNotice === "Trip updated." || prevNotice === "Passenger removed." || prevNotice === "Passenger seats updated." || prevNotice === "You're on the waitlist! We'll text you if a seat opens.") ? prevNotice : ""
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

    function buildSeatStepper(doc, host, name, minVal, maxVal, initialVal, formatLabel, onPick) {
      const hidden = el(doc, "input");
      hidden.type = "hidden";
      hidden.name = name;
      let val = Number(initialVal);
      if (!Number.isFinite(val) || val < minVal || val > maxVal) val = minVal;
      hidden.value = String(val);
      const wrap = el(doc, "div", "dur-stepper");
      const minus = el(doc, "button", "dur-btn", "−");
      minus.type = "button";
      minus.setAttribute("aria-label", "Decrease seats");
      const readout = el(doc, "div", "dur-val", formatLabel(val));
      const plus = el(doc, "button", "dur-btn", "+");
      plus.type = "button";
      plus.setAttribute("aria-label", "Increase seats");
      function sync() {
        hidden.value = String(val);
        readout.textContent = formatLabel(val);
        minus.disabled = val <= minVal || state.busy;
        plus.disabled = val >= maxVal || state.busy;
        if (onPick) onPick(val);
      }
      on(minus, "click", function () { if (val > minVal) { val -= 1; sync(); } });
      on(plus, "click", function () { if (val < maxVal) { val += 1; sync(); } });
      sync();
      wrap.appendChild(minus);
      wrap.appendChild(readout);
      wrap.appendChild(plus);
      host.appendChild(hidden);
      host.appendChild(wrap);
      return hidden;
    }

    function confirmSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      const kind = state.sheet || state.busySheet;
      const isComplete = kind === "complete";
      const isRemove = kind === "remove";
      const target = state.removeTarget || {};
      const curTargetSeats = Number(target.seats) || 1;
      const maxKeep = Math.min(6, curTargetSeats + (Number((state.ride || {}).seatsLeft) || 0));
      const multiRemove = isRemove && maxKeep > 1;
      let keepSeatsPick = 0;
      const title = isComplete
        ? "Complete this trip?"
        : (multiRemove
          ? ("Adjust or remove " + (target.name || "passenger") + "?")
          : (isRemove ? ("Remove " + (target.name || "passenger") + "?") : (kind === "trip" ? "Cancel this trip?" : "Cancel your seat?")));
      sheet.appendChild(el(doc, "p", "", title));
      if (isComplete) sheet.appendChild(el(doc, "p", "muted", "This marks the trip as completed and closes trip messaging."));
      if (isRemove && !multiRemove) {
        sheet.appendChild(el(doc, "p", "muted", "This frees 1 seat and sends them a short SMS."));
      }
      if (multiRemove) {
        sheet.appendChild(el(doc, "p", "muted", "Currently " + curTargetSeats + (curTargetSeats === 1 ? " seat" : " seats") + " reserved. Adjust seats (0 to remove):"));
      }
      const keep = el(doc, "button", "textish", isComplete ? "Keep open" : (isRemove ? "Cancel" : (kind === "trip" ? "Keep trip" : "Keep seat")));
      if (state.busy) keep.disabled = true;
      on(keep, "click", function () { state = ui.reduce(state, { type: "keep" }); draw(); });
      const yes = el(doc, "button", isComplete ? "confirm-primary" : "danger");
      function refreshRemoveBtn(k) {
        keepSeatsPick = k;
        if (!multiRemove || state.busy) return;
        yes.className = k === 0 ? "danger" : "confirm-primary";
        yes.textContent = k === 0 ? "Remove all" : "Save seats";
      }
      if (multiRemove) {
        buildSeatStepper(doc, sheet, "keepSeats", 0, maxKeep, 0, function (v) {
          return v === 0 ? "0 (Remove all)" : (v === 1 ? "1 seat" : v + " seats");
        }, refreshRemoveBtn);
      }
      sheet.appendChild(keep);
      const idleConfirm = isComplete ? "Complete trip" : (multiRemove ? "Remove all" : (isRemove ? "Remove" : (kind === "trip" ? "Cancel trip" : "Cancel seat")));
      const busyConfirm = isComplete ? "Completing…" : (multiRemove && keepSeatsPick > 0 ? "Saving…" : (isRemove ? "Removing…" : "Cancelling…"));
      spinText(doc, yes, state.busy && state.busyAction === "sheet", busyConfirm, idleConfirm, !isComplete);
      on(yes, "click", function () {
        const ride = state.ride || (state.rideId ? { rideId: state.rideId } : null);
        const sheetKind = state.sheet;
        const removeTarget = state.removeTarget;
        const chosenKeep = multiRemove ? keepSeatsPick : undefined;
        state = ui.reduce(state, { type: "confirm" });
        const action = state.pendingAction;
        if (cloud && ride && action) {
          state.busy = true;
          state.busyAction = "sheet";
          state.busySheet = sheetKind;
          const isDriverAction = action === "cancel-trip" || action === "complete-trip" || action === "remove-rider";
          const secret = isDriverAction ? cloud.tripSecret(ride.rideId) : cloud.seatSecretFor(ride);
          const job = action === "complete-trip"
            ? cloud.completeTrip(ride.rideId, secret)
            : (action === "remove-rider"
              ? cloud.removeRider(ride.rideId, secret, removeTarget && removeTarget.reservationId, chosenKeep)
              : (action === "cancel-trip" ? cloud.cancelTrip(ride.rideId, secret) : cloud.cancelSeat(ride.rideId, secret)));
          job.then(function (result) {
            state.busy = false;
            state.busyAction = "";
            state.busySheet = "";
            state.removeTarget = null;
            if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
            else if (action === "complete-trip") {
              const nextRide = Object.assign({}, state.ride || {}, { status: "completed" });
              state = Object.assign({}, state, { status: "completed", notice: "Trip completed.", ride: nextRide });
            } else if (action === "remove-rider") {
              const nextRide = Object.assign({}, state.ride || {}, result && result.ride ? result.ride : {
                seatsLeft: result && result.seatsLeft != null ? result.seatsLeft : (Number((state.ride || {}).seatsLeft) || 0) + (curTargetSeats - (chosenKeep || 0)),
                riders: ((state.ride || {}).riders || []).map(function (r) {
                  if (removeTarget && r.reservationId === removeTarget.reservationId && chosenKeep > 0) return Object.assign({}, r, { seats: chosenKeep });
                  return r;
                }).filter(function (r) { return !removeTarget || chosenKeep > 0 || r.reservationId !== removeTarget.reservationId; })
              });
              state = Object.assign(ui.reduce(state, { type: "ride", ride: nextRide, role: "driver" }), {
                ride: nextRide,
                rides: state.rides || [],
                when: state.when,
                link: state.link,
                notice: chosenKeep > 0 ? "Passenger seats updated." : "Passenger removed."
              });
            }
            else if (action === "cancel-trip") state = Object.assign({}, state, { status: "cancelled", notice: "This trip was cancelled.", link: "" });
            else state = Object.assign({}, state, { mode: "ride", role: "", notice: "Seat cancelled.", reserveOpen: false });
            draw();
          }, function () {
            state.busy = false;
            state.busyAction = "";
            state.busySheet = "";
            state.removeTarget = null;
            state = ui.reduce(state, { type: "fail", error: "Could not complete request. Check the connection and try again." });
            draw();
          });
        }
        draw();
      });
      sheet.appendChild(yes);
      return sheet;
    }

    function editSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const ride = state.ride || {};
      const draft = state.editDraft || {};
      const tz = ride.timeZone || (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
      const bookedSeats = (ride.riders || []).reduce(function (sum, r) { return sum + (Number(r.seats) || 1); }, 0);
      sheet.appendChild(el(doc, "p", "", "Edit trip details"));
      const editPair = el(doc, "div", "form-pair");
      const editDateCol = el(doc, "div");
      const editTimeCol = el(doc, "div");
      const editDrawerHost = el(doc, "div");
      editDateCol.appendChild(el(doc, "label", "lbl", "Date"));
      const dateIn = el(doc, "input");
      dateIn.name = "date";
      dateIn.type = "hidden";
      dateIn.value = draft.date != null ? draft.date : core.formatDateInput(ride.departAt, tz);
      editDateCol.appendChild(dateIn);
      attachDatePicker(doc, editDateCol, dateIn, state.error && state.field === "date", null, editDrawerHost);
      if (state.error && state.field === "date") editDateCol.appendChild(el(doc, "p", "error", state.error));
      editTimeCol.appendChild(el(doc, "label", "lbl", "Departure time"));
      const timeIn = el(doc, "input");
      timeIn.name = "time";
      timeIn.type = "hidden";
      timeIn.value = draft.time != null ? draft.time : core.formatTimeInput(ride.departAt, tz);
      editTimeCol.appendChild(timeIn);
      attachTimePicker(doc, editTimeCol, timeIn, state.error && state.field === "time", null, editDrawerHost);
      if (state.error && state.field === "time") editTimeCol.appendChild(el(doc, "p", "error", state.error));
      editPair.appendChild(editDateCol);
      editPair.appendChild(editTimeCol);
      sheet.appendChild(editPair);
      sheet.appendChild(editDrawerHost);
      const curLeft = ride.seatsLeft != null ? Number(ride.seatsLeft) : Math.max(0, (Number(ride.seatsTotal) || 1) - bookedSeats);
      const maxLeft = Math.max(0, 6 - bookedSeats);
      const minLeft = bookedSeats > 0 ? 0 : 1;
      sheet.appendChild(el(doc, "label", "lbl", bookedSeats > 0 ? "Seats left" : "Total seats"));
      buildSeatStepper(doc, sheet, "seatsLeft", minLeft, maxLeft, draft.seatsLeft != null ? draft.seatsLeft : curLeft, function (v) {
        if (bookedSeats > 0) return v === 0 ? "0 (Full)" : (v === 1 ? "1 seat left" : v + " seats left");
        return v === 1 ? "1 seat" : v + " seats";
      });
      if (bookedSeats > 0) {
        sheet.appendChild(el(doc, "p", "hint", (bookedSeats === 1 ? "1 seat already reserved" : bookedSeats + " seats already reserved") + " · max 6 total."));
      }
      if (state.error && state.field === "seats") sheet.appendChild(el(doc, "p", "error", state.error));
      sheet.appendChild(el(doc, "label", "lbl", "Pickup note, optional"));
      const noteIn = el(doc, "input");
      noteIn.name = "note";
      noteIn.type = "text";
      noteIn.maxLength = 280;
      noteIn.placeholder = "e.g. Meet by North entrance";
      noteIn.value = draft.note != null ? draft.note : (ride.note || "");
      if (state.error && state.field === "note") noteIn.className = "input-invalid";
      sheet.appendChild(noteIn);
      if (state.error && state.field === "note") sheet.appendChild(el(doc, "p", "error", state.error));
      if (bookedSeats > 0) {
        sheet.appendChild(el(doc, "p", "hint", "Reserved riders get a short SMS if time or pickup note changes."));
      }
      if (state.error && !state.field) sheet.appendChild(el(doc, "p", "error", state.error));
      const editRow = el(doc, "div", "action-row row-split");
      editRow.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px;";
      const cancelBtn = el(doc, "button", "textish", "Cancel");
      cancelBtn.type = "button";
      cancelBtn.style.cssText = "width:100%;min-width:0;margin:0;";
      if (state.busy) cancelBtn.disabled = true;
      on(cancelBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "edit-close" }), { editDraft: null }); draw(); });
      const saveBtn = el(doc, "button", "confirm-primary");
      saveBtn.type = "button";
      saveBtn.style.cssText = "width:100%;min-width:0;margin:0;";
      spinText(doc, saveBtn, state.busy && state.busyAction === "edit", "Saving…", "Save changes", false);
      editRow.appendChild(saveBtn);
      editRow.appendChild(cancelBtn);
      sheet.appendChild(editRow);
      on(saveBtn, "click", function () {
        if (!cloud || !state.ride) return;
        const values = {};
        sheet.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
        values.seats = String(bookedSeats + Number(values.seatsLeft != null ? values.seatsLeft : curLeft));
        values.timeZone = tz;
        const errors = core.editErrors(values);
        const when = errors.error ? null : core.departureError(values.date, values.time, tz, Date.now(), 30);
        if (errors.error) {
          state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
          state.editDraft = values;
          draw();
        } else if (when.error) {
          state = ui.reduce(state, { type: "fail", field: "time", error: when.error });
          state.editDraft = values;
          draw();
        } else {
          state.busy = true;
          state.busyAction = "edit";
          state.editDraft = values;
          saveBtn.disabled = true;
          cancelBtn.disabled = true;
          saveBtn.textContent = "Saving…";
          cloud.editRide(state.ride.rideId, cloud.tripSecret(state.ride.rideId), values).then(function (result) {
            state.busy = false;
            state.busyAction = "";
            if (!result || result.ok === false) {
              state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not update trip. Check the connection and try again." });
              state.editDraft = values;
            } else {
              const updatedRide = Object.assign({}, state.ride, result.ride || {});
              state = Object.assign(ui.reduce(state, { type: "ride", ride: updatedRide, role: "driver" }), {
                ride: updatedRide,
                rides: state.rides || [],
                editDraft: null,
                when: core.formatWhen(updatedRide.departAt, updatedRide.timeZone || tz),
                link: state.link,
                notice: result.unchanged ? "No changes made." : "Trip updated."
              });
            }
            draw();
          }, function () {
            state.busy = false;
            state.busyAction = "";
            state = ui.reduce(state, { type: "fail", error: "Could not update trip. Check the connection and try again." });
            state.editDraft = values;
            draw();
          });
        }
      });
      return sheet;
    }

    function manageTripSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const ride = state.ride || {};
      const departed = !!(ride.departAt && Date.now() >= ride.departAt);
      const hasRiders = !!(ride.riders && ride.riders.length);
      const msgClosed = !!(ride.departAt && Date.now() >= ride.departAt + ((Number(ride.durationMinutes) || 0) * 60000) + 60 * 60000);
      sheet.appendChild(el(doc, "p", "", "Manage trip"));
      const menu = el(doc, "div", "sheet-menu");
      if ((state.status === "open" || state.status === "pending") && !departed) {
        const editBtn = el(doc, "button", "sheet-item", "✏️ Edit trip");
        editBtn.type = "button";
        on(editBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "edit-open" }), { editDraft: null }); draw(); });
        menu.appendChild(editBtn);
      }
      if (state.status === "open" && departed && hasRiders) {
        const completeBtn = el(doc, "button", "sheet-item", "✓ Complete trip");
        completeBtn.type = "button";
        on(completeBtn, "click", function () { state = ui.reduce(state, { type: "complete-ask" }); draw(); });
        menu.appendChild(completeBtn);
      }
      if (state.status !== "cancelled") {
        const retBtn = el(doc, "button", "sheet-item", "↩️ Post return trip");
        retBtn.type = "button";
        on(retBtn, "click", function () { state = ui.reduce(state, { type: "driver-sheet-close" }); stopRide(); startReturnTrip(ride); });
        menu.appendChild(retBtn);
      }
      if (state.status !== "open" || !msgClosed) {
        const cancelBtn = el(doc, "button", "sheet-item danger", "✕ Cancel trip");
        cancelBtn.type = "button";
        on(cancelBtn, "click", function () { state = ui.reduce(state, { type: "cancel-ask", role: "driver" }); draw(); });
        menu.appendChild(cancelBtn);
      }
      sheet.appendChild(menu);
      const closeBtn = el(doc, "button", "textish", "Close");
      closeBtn.type = "button";
      on(closeBtn, "click", function () { state = ui.reduce(state, { type: "driver-sheet-close" }); draw(); });
      sheet.appendChild(closeBtn);
      return sheet;
    }

    function returnTripSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const draft = state.draft || {};
      const head = el(doc, "div", "sheet-head");
      head.appendChild(el(doc, "p", "", "Post return trip"));
      const xBtn = el(doc, "button", "sheet-x", "✕");
      xBtn.type = "button";
      xBtn.setAttribute("aria-label", "Close");
      if (state.busy) xBtn.disabled = true;
      on(xBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "driver-sheet-close" }), { draft: null }); draw(); });
      head.appendChild(xBtn);
      sheet.appendChild(head);
      function addField(label, name, type, val, ph) {
        sheet.appendChild(el(doc, "label", "lbl", label));
        const inp = el(doc, "input");
        inp.name = name;
        if (type) inp.type = type === "date" || type === "time" ? "hidden" : type;
        if (ph) inp.placeholder = ph;
        inp.value = val || "";
        if (state.error && state.field === name && type !== "date" && type !== "time") inp.className = "input-invalid";
        sheet.appendChild(inp);
        if (type === "date") attachDatePicker(doc, sheet, inp, state.error && state.field === name);
        else if (type === "time") attachTimePicker(doc, sheet, inp, state.error && state.field === name);
        if (state.error && state.field === name) sheet.appendChild(el(doc, "p", "error", state.error));
      }
      addField("Your name", "name", "text", draft.name);
      addField("Phone (US/Canada)", "phone", "tel", draft.phone);
      addField("From", "from", "text", draft.from);
      addField("To", "to", "text", draft.to);
      addField("Date", "date", "date", draft.date);
      addField("Departure time", "time", "time", draft.time);
      sheet.appendChild(el(doc, "label", "lbl", "Seats"));
      buildSeatStepper(doc, sheet, "seats", 1, 6, Number(draft.seats || 3), function (v) { return v === 1 ? "1 seat" : v + " seats"; });
      addField("Pickup note, optional", "note", "text", draft.note, "e.g. Meet by North entrance");
      addField("Ride cost per seat (optional, $)", "rideCost", "number", draft.rideCost, "0");
      if (state.error && !state.field) sheet.appendChild(el(doc, "p", "error", state.error));
      const postBtn = el(doc, "button", "confirm-primary");
      postBtn.type = "button";
      postBtn.style.width = "100%";
      spinText(doc, postBtn, state.busy && state.busyAction === "return-post", "Posting…", "Post return trip", false);
      on(postBtn, "click", function () {
        const values = { durationMinutes: String(draft.durationMinutes || 60) };
        sheet.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
        values.timeZone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
        const errors = core.postErrors(values);
        const when = errors.error ? null : core.departureError(values.date, values.time, values.timeZone, Date.now(), 30);
        if (errors.error) {
          state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
          state.draft = values;
          draw();
        } else if (when.error) {
          state = ui.reduce(state, { type: "fail", field: "time", error: when.error });
          state.draft = values;
          draw();
        } else if (cloud) {
          state.busy = true;
          state.busyAction = "return-post";
          state.draft = values;
          draw();
          Promise.resolve().then(function () { return cloud.postRide(values); }).then(function (result) {
            state.busy = false;
            state.busyAction = "";
            if (!result || result.ok === false) {
              state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not post. Check the connection and try again." });
              state.draft = values;
              openMemberModal(result);
            } else {
              saveProfile(values.name, values.phone);
              saveRecentRoute(values.from, values.to);
              state = postedFromServer(state, result, values, when.departAt);
            }
            draw();
          }, function () {
            state.busy = false;
            state.busyAction = "";
            state = ui.reduce(state, { type: "fail", error: "Could not post. Check the connection and try again." });
            state.draft = values;
            draw();
          });
        }
      });
      sheet.appendChild(postBtn);
      return sheet;
    }

    function waitlistSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const head = el(doc, "div", "sheet-head");
      head.appendChild(el(doc, "p", "", "Notify me if a seat opens"));
      const xBtn = el(doc, "button", "sheet-x", "✕");
      xBtn.type = "button";
      xBtn.setAttribute("aria-label", "Close");
      if (state.busy) xBtn.disabled = true;
      on(xBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "waitlist-close" }), { waitlistPhone: "" }); draw(); });
      head.appendChild(xBtn);
      sheet.appendChild(head);
      sheet.appendChild(el(doc, "p", "muted", "We'll send 1 text if a seat opens before departure."));
      sheet.appendChild(el(doc, "label", "lbl", "Phone (US/Canada)"));
      const saved = loadProfile();
      const phoneIn = el(doc, "input");
      phoneIn.name = "phone";
      phoneIn.type = "tel";
      phoneIn.value = state.waitlistPhone != null ? state.waitlistPhone : (saved.phone || "");
      if (state.error && state.field === "phone") phoneIn.className = "input-invalid";
      sheet.appendChild(phoneIn);
      if (state.error) sheet.appendChild(el(doc, "p", "error", state.error));
      const cancelBtn = el(doc, "button", "textish", "Cancel");
      cancelBtn.type = "button";
      if (state.busy) cancelBtn.disabled = true;
      on(cancelBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "waitlist-close" }), { waitlistPhone: "" }); draw(); });
      sheet.appendChild(cancelBtn);
      const notifyBtn = el(doc, "button", "confirm-primary");
      notifyBtn.type = "button";
      spinText(doc, notifyBtn, state.busy && state.busyAction === "waitlist", "Saving…", "Notify me", false);
      on(notifyBtn, "click", function () {
        if (!cloud || !state.ride) return;
        const val = phoneIn.value;
        const parsed = core.normalizePhone(val);
        if (!parsed.ok) {
          state = ui.reduce(state, { type: "fail", field: "phone", error: parsed.error });
          state.waitlistPhone = val;
          draw();
          return;
        }
        state.busy = true;
        state.busyAction = "waitlist";
        state.waitlistPhone = val;
        draw();
        cloud.joinWaitlist(state.ride.rideId, val).then(function (result) {
          state.busy = false;
          state.busyAction = "";
          if (!result || result.ok === false) {
            state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not join waitlist. Check the connection and try again." });
            openMemberModal(result);
          } else {
            state = Object.assign(ui.reduce(state, { type: "waitlist-close" }), {
              waitlistPhone: "",
              notice: "You're on the waitlist! We'll text you if a seat opens."
            });
          }
          draw();
        }, function () {
          state.busy = false;
          state.busyAction = "";
          state = ui.reduce(state, { type: "fail", error: "Could not join waitlist. Check the connection and try again." });
          draw();
        });
      });
      sheet.appendChild(notifyBtn);
      return sheet;
    }

    function managePassengersSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const ride = state.ride || {};
      const departed = !!(ride.departAt && Date.now() >= ride.departAt);
      const riders = ride.riders || [];
      if (state.driverSheet === "passengers-add") {
        const draft = state.reserveDraft || {};
        const maxAdd = Math.max(1, Math.min(6, Number(ride.seatsLeft) || 1));
        sheet.appendChild(el(doc, "p", "", "Add passenger"));
        sheet.appendChild(el(doc, "label", "lbl", "Passenger name"));
        const nameIn = el(doc, "input");
        nameIn.name = "name";
        nameIn.value = draft.name || "";
        if (state.error && state.field === "name") nameIn.className = "input-invalid";
        sheet.appendChild(nameIn);
        if (state.error && state.field === "name") sheet.appendChild(el(doc, "p", "error", state.error));
        sheet.appendChild(el(doc, "label", "lbl", "Passenger phone (US/Canada)"));
        const phoneIn = el(doc, "input");
        phoneIn.name = "phone";
        phoneIn.type = "tel";
        phoneIn.value = draft.phone || "";
        if (state.error && state.field === "phone") phoneIn.className = "input-invalid";
        sheet.appendChild(phoneIn);
        if (state.error && state.field === "phone") sheet.appendChild(el(doc, "p", "error", state.error));
        if (maxAdd > 1) {
          sheet.appendChild(el(doc, "label", "lbl", "Seats"));
          buildSeatStepper(doc, sheet, "seats", 1, maxAdd, draft.seats || 1, function (v) {
            return v === 1 ? "1 seat" : v + " seats";
          });
        }
        sheet.appendChild(el(doc, "label", "lbl", "Drop off location, optional"));
        const dropIn = el(doc, "input");
        dropIn.name = "dropoff";
        dropIn.type = "text";
        dropIn.placeholder = "e.g. University City";
        dropIn.value = draft.dropoff || "";
        sheet.appendChild(dropIn);
        if (state.error && state.field !== "name" && state.field !== "phone") sheet.appendChild(el(doc, "p", "error", state.error));
        const backBtn = el(doc, "button", "textish", "Back");
        backBtn.type = "button";
        if (state.busy) backBtn.disabled = true;
        on(backBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "driver-sheet", which: "passengers" }), { reserveDraft: null }); draw(); });
        sheet.appendChild(backBtn);
        const addSaveBtn = el(doc, "button", "confirm-primary");
        addSaveBtn.type = "button";
        spinText(doc, addSaveBtn, state.busy && state.busyAction === "add-pax", "Adding…", "Confirm passenger", false);
        on(addSaveBtn, "click", function () {
          if (!cloud || !state.ride) return;
          const values = {};
          sheet.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
          const errors = core.reserveErrors(values);
          if (errors.error) {
            state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
            state.reserveDraft = values;
            draw();
            return;
          }
          state.busy = true;
          state.busyAction = "add-pax";
          state.reserveDraft = values;
          draw();
          cloud.reserveSeat(state.ride.rideId, values, { skipSaveSeat: true }).then(function (result) {
            state.busy = false;
            state.busyAction = "";
            if (!result || result.ok === false) {
              state = ui.reduce(state, { type: "fail", error: (result && result.error) || "Could not add passenger. Check the connection and try again." });
              state.reserveDraft = values;
            } else {
              const bookedSeats = Number(values.seats || 1);
              const existingRiders = state.ride.riders || [];
              const alreadyListed = result.reservationId && existingRiders.some(function (r) { return r.reservationId === result.reservationId; });
              const nextSeatsLeft = result.seatsLeft != null ? Number(result.seatsLeft) : Math.max(0, Number(state.ride.seatsLeft || 1) - bookedSeats);
              const updatedRide = Object.assign({}, state.ride, {
                seatsLeft: nextSeatsLeft,
                riders: alreadyListed ? existingRiders : existingRiders.concat([{ reservationId: result.reservationId, name: values.name, seats: bookedSeats, dropoff: values.dropoff || "", driverSeenAt: Date.now(), status: "active" }])
              });
              state = Object.assign(ui.reduce(state, { type: "ride", ride: updatedRide, role: "driver" }), {
                ride: updatedRide,
                rides: state.rides || [],
                reserveDraft: null,
                when: state.when,
                link: state.link,
                notice: "Passenger added."
              });
            }
            draw();
          }, function () {
            state.busy = false;
            state.busyAction = "";
            state = ui.reduce(state, { type: "fail", error: "Could not add passenger. Check the connection and try again." });
            draw();
          });
        });
        sheet.appendChild(addSaveBtn);
        return sheet;
      }
      sheet.appendChild(el(doc, "p", "", "Manage passengers"));
      const menu = el(doc, "div", "sheet-menu");
      if (state.status === "open" && !departed && ride.seatsLeft > 0) {
        const addBtn = el(doc, "button", "sheet-item", "➕ Add passenger");
        addBtn.type = "button";
        on(addBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "driver-sheet", which: "passengers-add" }), { reserveDraft: null }); draw(); });
        menu.appendChild(addBtn);
      }
      riders.forEach(function (rider) {
        const row = el(doc, "div", "sheet-pax-row");
        const rName = rider.name || "Passenger";
        const seatSuffix = rider.seats > 1 ? " (" + rider.seats + " seats)" : " (1 seat)";
        row.appendChild(el(doc, "div", "sheet-pax-info", rName + seatSuffix));
        const paxActs = el(doc, "div", "sheet-pax-actions");
        if (cloud && cloud.ackRider && rider.reservationId) {
          paxActs.appendChild(buildAckButton(doc, ride, rider));
        }
        if (state.status === "open" && !departed && cloud && cloud.removeRider && rider.reservationId) {
          const adjBtn = el(doc, "button", "textish", "Adjust / Remove");
          adjBtn.type = "button";
          on(adjBtn, "click", function () { state = ui.reduce(state, { type: "remove-ask", rider: rider }); draw(); });
          paxActs.appendChild(adjBtn);
        }
        row.appendChild(paxActs);
        menu.appendChild(row);
      });
      if (!menu.children.length) {
        sheet.appendChild(el(doc, "p", "muted", "No passengers on this trip yet."));
      } else {
        sheet.appendChild(menu);
      }
      const closeBtn = el(doc, "button", "textish", "Close");
      closeBtn.type = "button";
      on(closeBtn, "click", function () { state = ui.reduce(state, { type: "driver-sheet-close" }); draw(); });
      sheet.appendChild(closeBtn);
      return sheet;
    }

    function returnTripSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const draft = state.draft || {};
      const head = el(doc, "div", "sheet-head");
      head.appendChild(el(doc, "p", "", "Post return trip"));
      const xBtn = el(doc, "button", "sheet-x", "✕");
      xBtn.type = "button";
      xBtn.setAttribute("aria-label", "Close");
      if (state.busy) xBtn.disabled = true;
      on(xBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "driver-sheet-close" }), { draft: null }); draw(); });
      head.appendChild(xBtn);
      sheet.appendChild(head);
      function addField(label, name, type, val, ph) {
        sheet.appendChild(el(doc, "label", "lbl", label));
        const inp = el(doc, "input");
        inp.name = name;
        if (type) inp.type = type === "date" || type === "time" ? "hidden" : type;
        if (ph) inp.placeholder = ph;
        inp.value = val || "";
        if (state.error && state.field === name && type !== "date" && type !== "time") inp.className = "input-invalid";
        sheet.appendChild(inp);
        if (type === "date") attachDatePicker(doc, sheet, inp, state.error && state.field === name);
        else if (type === "time") attachTimePicker(doc, sheet, inp, state.error && state.field === name);
        if (state.error && state.field === name) sheet.appendChild(el(doc, "p", "error", state.error));
      }
      addField("Your name", "name", "text", draft.name);
      addField("Phone (US/Canada)", "phone", "tel", draft.phone);
      addField("From", "from", "text", draft.from);
      addField("To", "to", "text", draft.to);
      addField("Date", "date", "date", draft.date);
      addField("Departure time", "time", "time", draft.time);
      sheet.appendChild(el(doc, "label", "lbl", "Seats"));
      buildSeatStepper(doc, sheet, "seats", 1, 6, Number(draft.seats || 3), function (v) { return v === 1 ? "1 seat" : v + " seats"; });
      addField("Pickup note, optional", "note", "text", draft.note, "e.g. Meet by North entrance");
      addField("Ride cost per seat (optional, $)", "rideCost", "number", draft.rideCost, "0");
      if (state.error && !state.field) sheet.appendChild(el(doc, "p", "error", state.error));
      const postBtn = el(doc, "button", "confirm-primary");
      postBtn.type = "button";
      postBtn.style.width = "100%";
      spinText(doc, postBtn, state.busy && state.busyAction === "return-post", "Posting…", "Post return trip", false);
      on(postBtn, "click", function () {
        const values = { durationMinutes: String(draft.durationMinutes || 60) };
        sheet.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
        values.timeZone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
        const errors = core.postErrors(values);
        const when = errors.error ? null : core.departureError(values.date, values.time, values.timeZone, Date.now(), 30);
        if (errors.error) {
          state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
          state.draft = values;
          draw();
        } else if (when.error) {
          state = ui.reduce(state, { type: "fail", field: "time", error: when.error });
          state.draft = values;
          draw();
        } else if (cloud) {
          state.busy = true;
          state.busyAction = "return-post";
          state.draft = values;
          draw();
          Promise.resolve().then(function () { return cloud.postRide(values); }).then(function (result) {
            state.busy = false;
            state.busyAction = "";
            if (!result || result.ok === false) {
              state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not post. Check the connection and try again." });
              state.draft = values;
              openMemberModal(result);
            } else {
              saveProfile(values.name, values.phone);
              saveRecentRoute(values.from, values.to);
              state = postedFromServer(state, result, values, when.departAt);
            }
            draw();
          }, function () {
            state.busy = false;
            state.busyAction = "";
            state = ui.reduce(state, { type: "fail", error: "Could not post. Check the connection and try again." });
            state.draft = values;
            draw();
          });
        }
      });
      sheet.appendChild(postBtn);
      return sheet;
    }

    function waitlistSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const head = el(doc, "div", "sheet-head");
      head.appendChild(el(doc, "p", "", "Notify me if a seat opens"));
      const xBtn = el(doc, "button", "sheet-x", "✕");
      xBtn.type = "button";
      xBtn.setAttribute("aria-label", "Close");
      if (state.busy) xBtn.disabled = true;
      on(xBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "waitlist-close" }), { waitlistPhone: "" }); draw(); });
      head.appendChild(xBtn);
      sheet.appendChild(head);
      sheet.appendChild(el(doc, "p", "muted", "We'll send 1 text if a seat opens before departure."));
      sheet.appendChild(el(doc, "label", "lbl", "Phone (US/Canada)"));
      const saved = loadProfile();
      const phoneIn = el(doc, "input");
      phoneIn.name = "phone";
      phoneIn.type = "tel";
      phoneIn.value = state.waitlistPhone != null ? state.waitlistPhone : (saved.phone || "");
      if (state.error && state.field === "phone") phoneIn.className = "input-invalid";
      sheet.appendChild(phoneIn);
      if (state.error) sheet.appendChild(el(doc, "p", "error", state.error));
      const cancelBtn = el(doc, "button", "textish", "Cancel");
      cancelBtn.type = "button";
      if (state.busy) cancelBtn.disabled = true;
      on(cancelBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "waitlist-close" }), { waitlistPhone: "" }); draw(); });
      sheet.appendChild(cancelBtn);
      const notifyBtn = el(doc, "button", "confirm-primary");
      notifyBtn.type = "button";
      spinText(doc, notifyBtn, state.busy && state.busyAction === "waitlist", "Saving…", "Notify me", false);
      on(notifyBtn, "click", function () {
        if (!cloud || !state.ride) return;
        const val = phoneIn.value;
        const parsed = core.normalizePhone(val);
        if (!parsed.ok) {
          state = ui.reduce(state, { type: "fail", field: "phone", error: parsed.error });
          state.waitlistPhone = val;
          draw();
          return;
        }
        state.busy = true;
        state.busyAction = "waitlist";
        state.waitlistPhone = val;
        draw();
        cloud.joinWaitlist(state.ride.rideId, val).then(function (result) {
          state.busy = false;
          state.busyAction = "";
          if (!result || result.ok === false) {
            state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not join waitlist. Check the connection and try again." });
            openMemberModal(result);
          } else {
            state = Object.assign(ui.reduce(state, { type: "waitlist-close" }), {
              waitlistPhone: "",
              notice: "You're on the waitlist! We'll text you if a seat opens."
            });
          }
          draw();
        }, function () {
          state.busy = false;
          state.busyAction = "";
          state = ui.reduce(state, { type: "fail", error: "Could not join waitlist. Check the connection and try again." });
          draw();
        });
      });
      sheet.appendChild(notifyBtn);
      return sheet;
    }

    function memberSheet(doc) {
      const sheet = el(doc, "div");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.appendChild(el(doc, "p", "", "Members-Only Community \u2014 " + memberModal.groupName + " group"));
      sheet.appendChild(el(doc, "p", "muted", "Only approved members of " + memberModal.groupName + " group can post rides or reserve seats on this board."));
      const ul = el(doc, "ul", "member-list");
      const liJoin = el(doc, "li", "", "Want to join " + memberModal.groupName + " group? Reach out to the organizer");
      if (memberModal.contactEmail) {
        liJoin.appendChild(doc.createTextNode(" at "));
        String(memberModal.contactEmail).split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (addr, idx) {
          if (idx > 0) liJoin.appendChild(doc.createTextNode(", "));
          const mail = el(doc, "a", "mail-link", addr);
          mail.href = "mailto:" + addr;
          liJoin.appendChild(mail);
        });
      }
      liJoin.appendChild(doc.createTextNode(" to get added."));
      ul.appendChild(liJoin);
      if (memberModal.isDefault) {
        ul.appendChild(el(doc, "li", "", "Belong to a different neighborhood group? Open the private ?g= link shared by your organizer."));
      }
      ul.appendChild(el(doc, "li", "", "Organizing your own neighborhood? Start a new private group below."));
      sheet.appendChild(ul);
      const row = el(doc, "div", "action-row");
      const start = el(doc, "a", "confirm-primary", "Start a Group");
      start.href = "/jumpin-admin.html?tab=groups";
      const closeBtn = el(doc, "button", "textish", "Close");
      closeBtn.type = "button";
      on(closeBtn, "click", function () { memberModal = null; draw(); });
      row.appendChild(start);
      row.appendChild(closeBtn);
      sheet.appendChild(row);
      return sheet;
    }

    let deferredInstall = null;
    let installModal = false;
    let infoView = "";
    let prevMode = "";
    let prevSheetOpen = false;
    let postRole = "driver";

    function claimRequestSheet(doc) {
      const sheet = el(doc, "section");
      sheet.id = "jumpin-sheet";
      sheet.setAttribute("aria-modal", "true");
      const ride = state.ride || {};
      const draft = state.claimDraft || {};
      const saved = loadProfile();
      const head = el(doc, "div", "sheet-head");
      head.appendChild(el(doc, "p", "", "Offer to drive"));
      const xBtn = el(doc, "button", "sheet-x", "✕");
      xBtn.type = "button";
      xBtn.setAttribute("aria-label", "Close");
      if (state.busy) xBtn.disabled = true;
      on(xBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "claim-close" }), { claimDraft: null }); draw(); });
      head.appendChild(xBtn);
      sheet.appendChild(head);
      sheet.appendChild(el(doc, "p", "muted", (ride.from || "") + " → " + (ride.to || "") + " · " + (state.when || whenOf(ride))));
      if (ride.rideCost > 0) sheet.appendChild(el(doc, "p", "hint", "Rider offered: " + core.formatCost(ride.rideCost) + " / seat (direct)"));
      sheet.appendChild(el(doc, "label", "lbl", "Your name"));
      const nameIn = el(doc, "input");
      nameIn.name = "name";
      nameIn.type = "text";
      nameIn.placeholder = "Alex";
      nameIn.value = draft.name != null ? draft.name : (saved.name || "");
      if (state.error && state.field === "name") nameIn.className = "input-invalid";
      sheet.appendChild(nameIn);
      if (state.error && state.field === "name") sheet.appendChild(el(doc, "p", "error", state.error));
      sheet.appendChild(el(doc, "label", "lbl", "Phone (US/Canada)"));
      const phoneIn = el(doc, "input");
      phoneIn.name = "phone";
      phoneIn.type = "tel";
      phoneIn.placeholder = "555 234 5678";
      phoneIn.value = draft.phone != null ? draft.phone : (saved.phone || "");
      if (state.error && state.field === "phone") phoneIn.className = "input-invalid";
      sheet.appendChild(phoneIn);
      if (state.error && state.field === "phone") sheet.appendChild(el(doc, "p", "error", state.error));
      const minSeats = Math.max(1, Number(ride.seatsRequested) || 1);
      sheet.appendChild(el(doc, "label", "lbl", "Total seats in car (min " + minSeats + ")"));
      buildSeatPills(doc, sheet, "seats", 6, draft.seats != null ? draft.seats : Math.max(minSeats, 3), minSeats);
      if (state.error && state.field === "seats") sheet.appendChild(el(doc, "p", "error", state.error));
      sheet.appendChild(el(doc, "label", "lbl", "Estimated duration"));
      const durIn = el(doc, "input");
      durIn.type = "hidden";
      durIn.name = "durationMinutes";
      let durMins = Number(draft.durationMinutes || 60);
      if (!Number.isFinite(durMins) || durMins < 30) durMins = 30;
      if (durMins > 900) durMins = 900;
      durIn.value = String(durMins);
      const durStep = el(doc, "div", "dur-stepper");
      const minusD = el(doc, "button", "dur-btn", "−");
      minusD.type = "button";
      const durVal = el(doc, "div", "dur-val");
      const plusD = el(doc, "button", "dur-btn", "+");
      plusD.type = "button";
      function syncClaimDur(next) {
        durMins = Math.max(30, Math.min(900, next));
        durIn.value = String(durMins);
        durVal.textContent = core.formatDuration(durMins);
        minusD.disabled = durMins <= 30;
        plusD.disabled = durMins >= 900;
      }
      syncClaimDur(durMins);
      on(minusD, "click", function () { syncClaimDur(durMins - 30); });
      on(plusD, "click", function () { syncClaimDur(durMins + 30); });
      durStep.appendChild(minusD);
      durStep.appendChild(durVal);
      durStep.appendChild(plusD);
      sheet.appendChild(durIn);
      sheet.appendChild(durStep);
      sheet.appendChild(el(doc, "label", "lbl", "Pickup note, optional"));
      const noteIn = el(doc, "input");
      noteIn.name = "note";
      noteIn.type = "text";
      noteIn.placeholder = "e.g. Blue Honda at main entrance";
      noteIn.value = draft.note != null ? draft.note : "";
      sheet.appendChild(noteIn);
      if (state.error && !state.field) sheet.appendChild(el(doc, "p", "error", state.error));
      const row = el(doc, "div", "action-row row-split");
      row.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px;";
      const offerBtn = el(doc, "button", "confirm-primary");
      offerBtn.type = "button";
      offerBtn.style.cssText = "width:100%;min-width:0;margin:0;";
      spinText(doc, offerBtn, state.busy && state.busyAction === "claim", "Confirming…", "Confirm & offer ride", false);
      const cancelBtn = el(doc, "button", "textish", "Cancel");
      cancelBtn.type = "button";
      cancelBtn.style.cssText = "width:100%;min-width:0;margin:0;";
      if (state.busy) cancelBtn.disabled = true;
      on(cancelBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "claim-close" }), { claimDraft: null }); draw(); });
      row.appendChild(offerBtn);
      row.appendChild(cancelBtn);
      sheet.appendChild(row);
      on(offerBtn, "click", function () {
        if (!cloud || !state.ride) return;
        const values = {};
        sheet.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
        const errors = core.claimErrors(values, minSeats);
        if (errors.error) {
          state = ui.reduce(state, { type: "fail", field: errors.field, error: errors.error });
          state.claimDraft = values;
          draw();
          return;
        }
        state.busy = true;
        state.busyAction = "claim";
        state.claimDraft = values;
        draw();
        cloud.claimRideRequest(state.ride.rideId, values).then(function (result) {
          state.busy = false;
          state.busyAction = "";
          if (!result || result.ok === false) {
            state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not claim request. Check the connection and try again." });
            state.claimDraft = values;
            openMemberModal(result);
          } else {
            saveProfile(values.name, values.phone);
            const updatedRide = Object.assign({}, state.ride, result.ride || {});
            state = Object.assign(ui.reduce(state, { type: "ride", ride: updatedRide, role: "driver" }), {
              ride: updatedRide,
              rides: state.rides || [],
              claimDraft: null,
              when: whenOf(updatedRide),
              link: cloud.publicRideUrl(updatedRide.rideId),
              notice: "You're driving! Rider notified."
            });
          }
          draw();
        }, function () {
          state.busy = false;
          state.busyAction = "";
          state = ui.reduce(state, { type: "fail", error: "Could not claim request. Check the connection and try again." });
          state.claimDraft = values;
          draw();
        });
      });
      return sheet;
    }
    function canInstallApp() {
      const ua = (win.navigator && win.navigator.userAgent) || "";
      const standalone = !!((win.matchMedia && win.matchMedia("(display-mode: standalone)").matches) || (win.navigator && win.navigator.standalone));
      const isIos = /iPad|iPhone|iPod/i.test(ua);
      return !standalone && !!(deferredInstall || isIos);
    }
    on(win, "beforeinstallprompt", function (e) {
      if (e && e.preventDefault) e.preventDefault();
      deferredInstall = e;
      draw();
    });
    function installSheet(doc) {
      const box = el(doc, "div");
      box.id = "jumpin-sheet";
      box.appendChild(el(doc, "p", "", "Add JumpIn to Home Screen"));
      box.appendChild(el(doc, "p", "muted", "On iPhone/iPad Safari: tap Share (⬆️) at the bottom, then tap 'Add to Home Screen'. On Android Chrome: open the browser menu (⋮) and tap 'Install app' or 'Add to Home screen'."));
      const row = el(doc, "div", "action-row");
      const ok = el(doc, "button", "confirm-primary", "Got it");
      ok.type = "button";
      ok.style.width = "100%";
      ok.style.margin = "0";
      ok.style.cursor = "pointer";
      on(ok, "click", function () { installModal = false; draw(); });
      row.appendChild(ok);
      box.appendChild(row);
      return box;
    }

    const INFO_DOCS = {
      faq: {
        title: "FAQ",
        href: "/jumpin-faq.html",
        label: "Open full FAQ page ↗",
        items: [
          ["No app or login needed", "Post a ride or reserve seats in seconds — no download or password required. Manage links arrive by SMS."],
          ["Neighborhood ?g= boards", "Each community can use its own private ?g= link. Open boards allow anyone; Members-Only boards restrict posting and booking to approved phones."],
          ["Free community tool", "JumpIn charges zero app or booking fees. Any optional ride cost shown is settled directly between driver and rider."],
          ["Drivers: Edit, Confirm, Return", "Tap Manage trip or Manage passengers on your ride to edit time/seats, confirm riders, post a return trip, or complete/cancel."],
          ["Riders: Reserve, Waitlist, Message", "Tap a trip to reserve seats, join the seat-open waitlist on full trips, or message the driver before or during the ride."],
          ["Phone privacy & SMS opt-out", "Phone numbers are hashed and hidden from riders and visitors. Reply STOP to any JumpIn text to opt out anytime."]
        ]
      },
      privacy: {
        title: "Privacy Policy",
        href: "/jumpin-privacy.html",
        label: "Open full Privacy page ↗",
        items: [
          ["1. Information we collect", "Trip route, departure time, seats, optional notes, and phone numbers used solely for seat coordination and SMS manage links."],
          ["2. Phone protection", "Phone numbers are stored securely with SHA-256 hashes for lookups and are never displayed publicly on the board or ride pages."],
          ["3. SMS alerts & opt-out", "Texts are sent only for trip/seat confirmations, updates, and driver-rider messages. Reply STOP anytime to stop SMS alerts."],
          ["4. Automatic retention", "Completed and expired trips and associated rider records are automatically purged after the retention window."],
          ["5. Privacy questions", "Email senthil930@gmail.com for any data or privacy request."]
        ]
      },
      terms: {
        title: "Terms of Use",
        href: "/jumpin-terms.html",
        label: "Open full Terms page ↗",
        items: [
          ["1. Community carpool", "JumpIn is a volunteer coordination board for local communities. Always verify who you ride with."],
          ["2. Offline settlements", "WaitLink does not process payments. Any gas-share or cost note is arranged directly between driver and rider."],
          ["3. Driver & rider conduct", "Drivers and riders are responsible for accurate trip details, timely cancellations, and respectful communication."],
          ["4. SMS & carrier rates", "Standard carrier message rates may apply. Reply STOP to opt out of SMS notifications."],
          ["5. Moderation & liability", "Group organizers and platform admins may remove trips or block abusive numbers. WaitLink provides the tool as-is without liability for rides."]
        ]
      }
    };

    function infoSheet(doc) {
      const box = el(doc, "div", infoView === "menu" ? "compact-info" : "info-detail");
      box.id = "jumpin-sheet";
      if (infoView === "menu") {
        box.appendChild(el(doc, "p", "", "About JumpIn"));
        const menu = el(doc, "div", "sheet-menu");
        [["FAQ", "faq"], ["Privacy", "privacy"], ["Terms", "terms"], ["Contact", "contact"]].forEach(function (item) {
          const b = el(doc, "button", "sheet-item", item[0]);
          b.type = "button";
          on(b, "click", function () { infoView = item[1]; draw(); });
          menu.appendChild(b);
        });
        const start = el(doc, "a", "sheet-item", "Start a Group");
        start.href = "/jumpin-admin.html?tab=groups";
        menu.appendChild(start);
        box.appendChild(menu);
        if (groupMeta && groupMeta.supportNote) {
          box.appendChild(el(doc, "p", "hint", "Free community tool — chip in $1–$2 via " + groupMeta.supportNote + " to help cover text costs."));
        }
        box.appendChild(el(doc, "p", "muted", "JumpIn by WaitLink · © 2026 WaitLink"));
        const row = el(doc, "div", "action-row");
        const ok = el(doc, "button", "confirm-primary", "Close");
        ok.type = "button";
        ok.style.width = "100%";
        ok.style.margin = "0";
        ok.style.cursor = "pointer";
        on(ok, "click", function () { infoView = ""; draw(); });
        row.appendChild(ok);
        box.appendChild(row);
        return box;
      }
      const head = el(doc, "div", "sheet-head");
      const backBtn = el(doc, "button", "sheet-back", "‹ Back");
      backBtn.type = "button";
      on(backBtn, "click", function () { infoView = "menu"; draw(); });
      head.appendChild(backBtn);
      const spec = INFO_DOCS[infoView];
      head.appendChild(el(doc, "p", "", spec ? spec.title : "Contact & Support"));
      const xBtn = el(doc, "button", "sheet-x", "✕");
      xBtn.type = "button";
      xBtn.setAttribute("aria-label", "Close");
      on(xBtn, "click", function () { infoView = ""; draw(); });
      head.appendChild(xBtn);
      box.appendChild(head);
      const body = el(doc, "div", "info-body");
      if (spec) {
        spec.items.forEach(function (entry) {
          const card = el(doc, "div", "info-card");
          card.appendChild(el(doc, "strong", "", entry[0]));
          card.appendChild(el(doc, "span", "", entry[1]));
          body.appendChild(card);
        });
        const ext = el(doc, "a", "info-ext", spec.label);
        ext.href = spec.href;
        body.appendChild(ext);
      } else {
        [
          ["Direct Support Email", "senthil930@gmail.com — reach out for help, feedback, or to report a safety concern."],
          ["Lost Manage Link?", "Open the trip page and tap \"Driver? Manage this trip\" or \"Rider? Manage seat\" to get a fresh SMS link."],
          ["SMS Opt-Out", "Reply STOP to any JumpIn text message to stop receiving SMS alerts immediately."],
          ["Start a Private Group", "Want an isolated board for your neighborhood, HOA, or school? Tap below to set one up."]
        ].forEach(function (entry) {
          const card = el(doc, "div", "info-card");
          card.appendChild(el(doc, "strong", "", entry[0]));
          card.appendChild(el(doc, "span", "", entry[1]));
          body.appendChild(card);
        });
        const cRow = el(doc, "div", "action-row");
        cRow.style.marginTop = "10px";
        const mailBtn = el(doc, "a", "confirm-primary", "Email Support");
        mailBtn.href = "mailto:senthil930@gmail.com";
        const copyBtn = el(doc, "button", "textish", "Copy Email");
        copyBtn.type = "button";
        on(copyBtn, "click", function () {
          const clip = win.navigator && win.navigator.clipboard;
          if (clip && clip.writeText) clip.writeText("senthil930@gmail.com");
          showToast("Email copied");
        });
        cRow.appendChild(mailBtn);
        cRow.appendChild(copyBtn);
        body.appendChild(cRow);
        const grpLink = el(doc, "a", "info-ext", "Continue to Group Setup ↗");
        grpLink.href = "/jumpin-admin.html?tab=groups";
        body.appendChild(grpLink);
      }
      box.appendChild(body);
      return box;
    }

    function buildAckButton(doc, ride, rider) {
      const seen = !!rider.driverSeenAt;
      const rName = rider.name || "Passenger";
      const ackBtn = el(doc, "button", "rider-ack-btn " + (seen ? "seen" : "unseen"), seen ? "✓ Confirmed" : "Tap to confirm");
      ackBtn.type = "button";
      ackBtn.setAttribute("title", seen ? "Confirmed — tap to mark pending" : "New rider — tap to confirm");
      ackBtn.setAttribute("aria-label", seen ? (rName + " confirmed") : ("Confirm " + rName));
      on(ackBtn, "click", function () {
        const prevSeen = rider.driverSeenAt || 0;
        const nextSeen = !prevSeen;
        rider.driverSeenAt = nextSeen ? Date.now() : 0;
        draw();
        Promise.resolve(cloud.ackRider(ride.rideId, cloud.tripSecret(ride.rideId), rider.reservationId, nextSeen)).then(function (res) {
          if (!res || res.ok === false) {
            rider.driverSeenAt = prevSeen;
            state = ui.reduce(state, { type: "fail", error: (res && res.error) || "Could not update rider status." });
            draw();
          }
        }, function () {
          rider.driverSeenAt = prevSeen;
          draw();
        });
      });
      return ackBtn;
    }

    function buildCancelRequestButton(doc, ride, whenVal, linkVal) {
      const cancelReqBtn = el(doc, "button", "textish");
      cancelReqBtn.type = "button";
      spinText(doc, cancelReqBtn, state.busy && state.busyAction === "cancel-req", "Cancelling…", "✕ Cancel request", true);
      on(cancelReqBtn, "click", function () {
        if (!cloud || !cloud.cancelRideRequest) return;
        state.busy = true;
        state.busyAction = "cancel-req";
        draw();
        cloud.cancelRideRequest(ride.rideId, cloud.seatSecretFor(ride)).then(function (res) {
          state.busy = false;
          state.busyAction = "";
          if (!res || res.ok === false) {
            const errText = (res && res.error) || "Could not cancel request.";
            if (errText.indexOf("manage link") !== -1 && cloud.forget) {
              cloud.forget(ride);
              state = Object.assign(ui.reduce(ui.reduce(state, { type: "ride", ride: ride, role: "" }), { type: "recovery", role: "rider" }), {
                ride: ride,
                rides: state.rides || [],
                when: whenVal,
                link: linkVal,
                error: "Your manage link was refreshed elsewhere. Enter your phone to get a fresh link."
              });
            } else {
              state = ui.reduce(state, { type: "fail", error: errText });
            }
          } else {
            const nextRide = Object.assign({}, ride, { status: "cancelled", seatsLeft: 0 });
            state = Object.assign(ui.reduce(state, { type: "ride", ride: nextRide, role: "" }), { ride: nextRide, notice: "Request cancelled." });
          }
          draw();
        }, function () {
          state.busy = false;
          state.busyAction = "";
          state = ui.reduce(state, { type: "fail", error: "Could not cancel request." });
          draw();
        });
      });
      return cancelReqBtn;
    }

    function rideCard(doc, current) {
      const ride = current.ride;
      const card = el(doc, "section", "confirm ride-detail");
      const secTop = el(doc, "div", "ride-sec");
      const badgeMap = { pending: ["Pending approval", " pending"], completed: ["✓ Completed", ""], cancelled: ["Cancelled", ""], rejected: ["Not approved", ""] };
      if (badgeMap[current.status]) secTop.appendChild(el(doc, "span", "confirm-badge" + badgeMap[current.status][1], badgeMap[current.status][0]));
      if (current.notice) secTop.appendChild(el(doc, "h1", "", current.notice));
      secTop.appendChild(el(doc, "p", "route", (ride.from || "") + " → " + (ride.to || "")));
      const whenText = (current.when || whenOf(ride)) + (ride.kind !== "request" && ride.durationMinutes ? " · Est. " + core.formatDuration(ride.durationMinutes) : "");
      const grid = el(doc, "div", "info-grid");
      function addTile(k, v) {
        const tile = el(doc, "div", "info-tile");
        tile.appendChild(el(doc, "div", "info-k", k));
        tile.appendChild(el(doc, "div", "info-v", v));
        grid.appendChild(tile);
      }
      addTile("Departure", whenText);
      if (ride.kind === "request") {
        addTile("Requested by", ride.requesterName || "Rider");
        const reqSeats = Number(ride.seatsRequested) || 1;
        addTile("Seats needed", reqSeats === 1 ? "1 seat" : reqSeats + " seats");
      } else if (ride.seatsLeft != null) {
        addTile("Availability", seatsLabel(ride.seatsLeft));
      }
      if (ride.rideCost > 0) addTile(ride.kind === "request" ? "Willing to chip in" : "Ride cost", core.formatCost(ride.rideCost) + " / seat (direct)");
      const tripCode = shortTripId(ride.rideId);
      if (tripCode) addTile("Trip ID", tripCode);
      if (ride.note) addTile("Pickup / Note", ride.note);
      secTop.appendChild(grid);
      if (current.status === "pending") secTop.appendChild(el(doc, "p", "route", "Waiting for approval."));
      if (current.status === "rejected") secTop.appendChild(el(doc, "p", "route", "This trip was not approved."));
      if (current.status === "cancelled") secTop.appendChild(el(doc, "p", "route", "This trip was cancelled."));
      if (current.status === "completed") {
        secTop.appendChild(el(doc, "p", "route", "Trip completed — hope you had a great ride!"));
        if (supportNote) secTop.appendChild(supportCard(doc, supportNote));
      }
      if (ride.kind === "request" && current.status === "open") {
        if (current.role === "requester") {
          secTop.appendChild(el(doc, "p", "muted", "Waiting for a driver — share this link so a driver can offer a ride."));
          const shareUrl = current.link || (cloud && cloud.publicRideUrl && ride.rideId ? cloud.publicRideUrl(ride.rideId) : "");
          if (shareUrl) {
            const linkRow = el(doc, "div", "link-row link-row-inline");
            linkRow.style.marginTop = "8px";
            const linkIn = el(doc, "input");
            linkIn.readOnly = true;
            linkIn.value = shareUrl;
            linkRow.appendChild(linkIn);
            const copyIcon = el(doc, "button", "link-copy", "📋");
            copyIcon.type = "button";
            copyIcon.setAttribute("aria-label", "Copy link");
            copyIcon.title = "Copy link";
            on(copyIcon, "click", function () {
              const clip = win.navigator && win.navigator.clipboard;
              if (clip && clip.writeText) clip.writeText(shareUrl);
              copyIcon.textContent = "✓ Copied";
              showToast("Copied!");
              if (win.setTimeout) {
                const tid = win.setTimeout(function () { copyIcon.textContent = "📋"; }, 2000);
                cleanups.push(function () { if (win.clearTimeout) win.clearTimeout(tid); });
              }
            });
            linkRow.appendChild(copyIcon);
            secTop.appendChild(linkRow);
          }
          const reqRow = el(doc, "div", "action-row");
          reqRow.appendChild(buildCancelRequestButton(doc, ride, current.when, current.link));
          secTop.appendChild(reqRow);
          if (cloud && cloud.forget) {
            const reqOutRow = el(doc, "div", "secondary-action-row");
            const reqOutBtn = el(doc, "button", "linkish", "Sign out on this device");
            reqOutBtn.type = "button";
            on(reqOutBtn, "click", function () {
              cloud.forget(ride);
              state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: "" }), { ride: ride, rides: state.rides || [], when: current.when, link: current.link });
              draw();
            });
            reqOutRow.appendChild(reqOutBtn);
            secTop.appendChild(reqOutRow);
          }
        } else if (!current.role) {
          secTop.appendChild(el(doc, "p", "muted", "No driver yet — tap I can drive below to offer a ride."));
        }
      }
      if (current.status === "open" && ride.seatsLeft === 0 && ride.kind !== "request") {
        secTop.appendChild(el(doc, "p", "route", "Full"));
        const fullDeparted = !!(ride.departAt && Date.now() >= ride.departAt);
        if (!fullDeparted && !current.role && !current.reserveOpen && !current.recovery && cloud && cloud.joinWaitlist) {
          const wlRow = el(doc, "div", "action-row");
          const wlBtn = el(doc, "button", "textish", "Notify me if a seat opens");
          wlBtn.type = "button";
          on(wlBtn, "click", function () { state = Object.assign(ui.reduce(state, { type: "waitlist-open" }), { waitlistPhone: null }); draw(); });
          wlRow.appendChild(wlBtn);
          secTop.appendChild(wlRow);
        }
      }
      if (!current.reserveOpen && current.role === "driver" && (current.status === "open" || current.status === "pending")) {
        const topActions = el(doc, "div", "action-row");
        const mTrip = el(doc, "button", "textish", "Manage trip");
        mTrip.type = "button";
        on(mTrip, "click", function () { state = ui.reduce(state, { type: "driver-sheet", which: "trip" }); draw(); });
        topActions.appendChild(mTrip);
        if (current.status === "open" && !(ride.claimedFromRequest && ride.seatsLeft === 0 && (!ride.riders || ride.riders.length <= 1))) {
          const mPax = el(doc, "button", "textish", "Manage passengers");
          mPax.type = "button";
          on(mPax, "click", function () { state = ui.reduce(state, { type: "driver-sheet", which: "passengers" }); draw(); });
          topActions.appendChild(mPax);
        }
        secTop.appendChild(topActions);
      }
      card.appendChild(secTop);
      const secPeople = el(doc, "div", "ride-sec");
      if (ride.driverName && current.role !== "driver") {
        const dRow = el(doc, "div", "rider-row");
        dRow.appendChild(el(doc, "span", "mini-av", ride.driverName.charAt(0).toUpperCase()));
        dRow.appendChild(el(doc, "span", "", ride.driverName));
        dRow.appendChild(el(doc, "span", "driver-tag", "Driver"));
        secPeople.appendChild(dRow);
      }
      if (ride.riders && ride.riders.length) {
        const totalReserved = ride.riders.reduce(function (sum, r) { return sum + (Number(r.seats) || 1); }, 0);
        secPeople.appendChild(el(doc, "div", "section-lbl", "Passengers (" + totalReserved + ")"));
        if (current.role === "driver") {
          const unseenCount = ride.riders.filter(function (r) { return !r.driverSeenAt; }).length;
          if (unseenCount > 0) {
            const note = el(doc, "p", "hint", unseenCount === 1 ? "1 new passenger — tap Confirm so they know you saw their seat." : unseenCount + " new passengers — tap Confirm so they know you saw their seats.");
            note.style.cssText = "margin:0 0 8px;font-size:12.5px;color:#92400e;";
            secPeople.appendChild(note);
          }
        }
        ride.riders.forEach(function (rider) {
          const seatSuffix = rider.seats > 1 ? " (" + rider.seats + " seats)" : "";
          const dropSuffix = rider.dropoff ? " · Drop off: " + rider.dropoff : "";
          const rName = rider.name || "Passenger";
          const rRow = el(doc, "div", "rider-row");
          rRow.appendChild(el(doc, "span", "mini-av", rName.charAt(0).toUpperCase()));
          rRow.appendChild(el(doc, "span", "", rName + seatSuffix + dropSuffix));
          const seen = !!rider.driverSeenAt;
          if (current.role === "driver" && cloud && cloud.ackRider && rider.reservationId) {
            rRow.appendChild(buildAckButton(doc, ride, rider));
          } else {
            rRow.appendChild(el(doc, "span", "rider-ack-pill " + (seen ? "seen" : "unseen"), seen ? "✓ Confirmed" : "⏳ Pending"));
          }
          secPeople.appendChild(rRow);
        });
      }
      if (secPeople.children.length) card.appendChild(secPeople);
      const secChat = el(doc, "div", "ride-sec");
      if (ride.messages && ride.messages.length) {
        const upHead = el(doc, "div");
        upHead.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:" + (updatesOpen ? "6px" : "0") + ";";
        const upLbl = el(doc, "div", "section-lbl", "💬 Trip Updates (" + ride.messages.length + ")");
        upLbl.style.margin = "0";
        upHead.appendChild(upLbl);
        const upToggle = el(doc, "button", "chip-btn", updatesOpen ? "Hide ▴" : "Show ▾");
        upToggle.type = "button";
        on(upToggle, "click", function () { updatesOpen = !updatesOpen; draw(); });
        upHead.appendChild(upToggle);
        secChat.appendChild(upHead);
        if (updatesOpen) {
          ride.messages.forEach(function (message) {
            const who = message.authorName || "";
            secChat.appendChild(el(doc, "div", "msg-row", (who ? who + ": " : "") + (message.text || "")));
          });
        }
      }
      if (current.reserveOpen) {
        const secRes = el(doc, "div", "ride-sec");
        const saved = current.role === "driver" ? { name: "", phone: "" } : loadProfile();
        const draft = current.reserveDraft || {};
        secRes.appendChild(el(doc, "div", "reserve-head", current.role === "driver" ? "Add a passenger" : "Reserve your seat"));
        secRes.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Passenger name" : "Your name"));
        const name = el(doc, "input");
        name.name = "name";
        name.value = draft.name != null ? draft.name : (saved.name || "");
        if (current.error && current.field === "name") name.className = "input-invalid";
        secRes.appendChild(name);
        if (current.error && current.field === "name") secRes.appendChild(el(doc, "p", "error", current.error));
        secRes.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Passenger phone (US/Canada)" : "Phone (US/Canada)"));
        const phone = el(doc, "input");
        phone.name = "phone";
        phone.type = "tel";
        phone.value = draft.phone != null ? draft.phone : (saved.phone || "");
        if (current.error && current.field === "phone") phone.className = "input-invalid";
        secRes.appendChild(phone);
        if (current.error && current.field === "phone") secRes.appendChild(el(doc, "p", "error", current.error));
        if ((Number(ride.seatsLeft) || 1) > 1) {
          secRes.appendChild(el(doc, "label", "lbl", "Seats"));
          buildSeatPills(doc, secRes, "seats", Math.min(6, Number(ride.seatsLeft) || 1), draft.seats || 1);
        }
        secRes.appendChild(el(doc, "label", "lbl", "Drop off location, optional"));
        const dropoff = el(doc, "input");
        dropoff.name = "dropoff";
        dropoff.type = "text";
        dropoff.placeholder = "e.g. University City";
        if (draft.dropoff) dropoff.value = draft.dropoff;
        secRes.appendChild(dropoff);
        secRes.appendChild(el(doc, "p", "hint", "WaitLink will text this number a link to manage their seat, and JumpIn notices."));
        if (current.error && current.field !== "name" && current.field !== "phone") secRes.appendChild(el(doc, "p", "error", current.error));
        const cancelForm = el(doc, "button", "textish", "Cancel");
        on(cancelForm, "click", function () { state = Object.assign(ui.reduce(state, { type: "reserve-close" }), { reserveDraft: null }); draw(); });
        const formActions = el(doc, "div", "action-row");
        formActions.appendChild(cancelForm);
        secRes.appendChild(formActions);
        card.appendChild(secRes);
      }
      if (current.recovery) {
        const secRec = el(doc, "div", "ride-sec");
        const recLabel = current.recovery === "driver"
          ? "Driver phone (US/Canada, used to post this trip)"
          : (ride.kind === "request" ? "Rider phone (US/Canada, used to post this request)" : "Rider phone (US/Canada, used to reserve your seat)");
        secRec.appendChild(el(doc, "label", "lbl", recLabel));
        const phone = el(doc, "input");
        phone.name = "phone";
        phone.type = "tel";
        if (current.error) phone.className = "input-invalid";
        secRec.appendChild(phone);
        if (current.error) secRec.appendChild(el(doc, "p", "error", current.error));
        const cancelRec = el(doc, "button", "textish", "Cancel");
        on(cancelRec, "click", function () { state = ui.reduce(state, { type: "recovery-close" }); draw(); });
        const recActions = el(doc, "div", "action-row");
        recActions.appendChild(cancelRec);
        secRec.appendChild(recActions);
        card.appendChild(secRec);
      }
      const msgClosed = !!(ride.departAt && Date.now() >= ride.departAt + ((Number(ride.durationMinutes) || 0) * 60000) + 60 * 60000);
      if (!current.reserveOpen && !current.editOpen && (current.role === "driver" || current.role === "rider") && (current.status === "open" || current.status === "pending")) {
        let box = null;
        const hasRiders = !!(ride.riders && ride.riders.length);
        if (current.status === "open" && !msgClosed && (current.role === "rider" || hasRiders)) {
          secChat.appendChild(el(doc, "label", "lbl", current.role === "driver" ? "Message passengers" : "Message the driver"));
          const quickRow = el(doc, "div", "chip-row");
          ["On my way", "At pickup spot", "5 min late"].forEach(function (phrase) {
            const chip = el(doc, "button", "chip-btn", phrase);
            chip.type = "button";
            if (state.busy) chip.disabled = true;
            on(chip, "click", function () { sendMessage(phrase); });
            quickRow.appendChild(chip);
          });
          secChat.appendChild(quickRow);
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
          secChat.appendChild(msgRow);
        }
        if (secChat.children.length) card.appendChild(secChat);
        const secActions = el(doc, "div", "ride-sec");
        const actions = el(doc, "div", "action-row");
        const departed = !!(ride.departAt && Date.now() >= ride.departAt);
        if (current.role !== "driver" && cloud && cloud.seatSecretFor(ride) && !departed) {
          const myInfo = cloud.seatInfoFor ? cloud.seatInfoFor(ride) : null;
          const mySeats = (myInfo && Number(myInfo.seats)) || 1;
          const maxTotal = Math.min(6, mySeats + (Number(ride.seatsLeft) || 0));
          if (maxTotal > 1 && cloud.updateSeat) {
            secActions.appendChild(el(doc, "label", "lbl", "Your seats"));
            const mySeatInput = buildSeatPills(doc, secActions, "mySeats", maxTotal, mySeats);
            const saveSeats = el(doc, "button", "textish");
            spinText(doc, saveSeats, state.busy && state.busyAction === "update-seats", "Updating…", "Update seats", true);
            on(saveSeats, "click", function () {
              const nextSeats = Number(mySeatInput.value || mySeats);
              if (nextSeats === mySeats) return;
              state.busy = true;
              state.busyAction = "update-seats";
              draw();
              cloud.updateSeat(ride.rideId, cloud.seatSecretFor(ride), nextSeats).then(function (result) {
                state.busy = false;
                state.busyAction = "";
                if (result && result.ok === false) state = ui.reduce(state, { type: "fail", error: result.error });
                else {
                  const nextRide = (result && result.ride) ? Object.assign({}, ride, result.ride) : ride;
                  state = Object.assign(ui.reduce(state, { type: "ride", ride: nextRide, role: current.role }), { ride: nextRide, rides: state.rides || [], when: current.when, link: current.link, notice: "Seats updated." });
                }
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
        if (actions.children.length) secActions.appendChild(actions);
        if (current.role === "driver") {
          const secRow = el(doc, "div", "secondary-action-row");
          const forget = el(doc, "button", "linkish", "Sign out on this device");
          on(forget, "click", function () {
            cloud.forget(ride);
            state = Object.assign(ui.reduce(state, { type: "ride", ride: ride, role: "" }), { ride: ride, rides: state.rides || [], when: current.when, link: current.link });
            draw();
          });
          secRow.appendChild(forget);
          secActions.appendChild(secRow);
        }
        if (secActions.children.length) card.appendChild(secActions);
      } else {
        if (secChat.children.length) card.appendChild(secChat);
        if (!current.reserveOpen && !current.editOpen && !current.recovery && current.role !== "requester" && !msgClosed && (current.status === "open" || current.status === "pending")) {
          const secRecBox = el(doc, "div", "ride-sec");
          const recBox = el(doc, "div", "recovery-box");
          const seat = el(doc, "button", "linkish", ride.kind === "request" ? "Posted this request? Text me a manage link" : "Rider? Manage seat or message driver");
          on(seat, "click", function () {
            state = ui.reduce(state, { type: "recovery", role: "rider" });
            draw();
            const b = rootNode.querySelector && rootNode.querySelector("#jumpin-bottom");
            if (b && b.scrollIntoView) b.scrollIntoView({ behavior: "smooth", block: "end" });
          });
          recBox.appendChild(seat);
          if (ride.kind !== "request") {
            const trip = el(doc, "button", "linkish", "Driver? Manage this trip");
            on(trip, "click", function () {
              state = ui.reduce(state, { type: "recovery", role: "driver" });
              draw();
              const b = rootNode.querySelector && rootNode.querySelector("#jumpin-bottom");
              if (b && b.scrollIntoView) b.scrollIntoView({ behavior: "smooth", block: "end" });
            });
            recBox.appendChild(trip);
          }
          secRecBox.appendChild(recBox);
          card.appendChild(secRecBox);
        }
      }
      if (current.error && !current.reserveOpen && !current.editOpen && !current.recovery) card.appendChild(el(doc, "p", "error", current.error));
      return card;
    }

    function sendMessage(text) {
      if (!cloud || !state.ride) return;
      if (!String(text || "").trim()) {
        state = ui.reduce(state, { type: "fail", error: "Enter a message." });
        draw();
        return;
      }
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
      syncIosTheme();
      doc.title = (groupMeta && groupMeta.groupId && groupMeta.groupId !== "default" && groupMeta.name) ? ("JumpIn — " + groupMeta.name) : "JumpIn — Community Carpool";
      let savedFocus = null;
      const activeEl = doc.activeElement;
      if (activeEl && rootNode.contains && rootNode.contains(activeEl) && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        let selStart = null;
        let selEnd = null;
        try { selStart = activeEl.selectionStart; selEnd = activeEl.selectionEnd; } catch (err) { /* selection not supported on date/time/number */ }
        savedFocus = {
          name: activeEl.name || "",
          isBoardSearch: !!(activeEl.className && String(activeEl.className).indexOf("board-search") !== -1),
          value: activeEl.value,
          selStart: selStart,
          selEnd: selEnd
        };
      }
      const prevMsgEl = !state.busy && rootNode.querySelector ? rootNode.querySelector("input[name=message]") : null;
      const unsentMessage = prevMsgEl && prevMsgEl.value ? prevMsgEl.value : "";
      rootNode.textContent = "";
      const isFormOpen = state.mode === "post" || !!(state.mode === "ride" && (state.reserveOpen || state.editOpen || state.recovery));
      rootNode.className = state.mode === "board" ? "portal" : ("app-screen" + (isFormOpen ? " form-open" : ""));
      const top = el(doc, "header");
      top.id = "jumpin-top";
      if (state.mode === "board") brandBar(doc, top, groupMeta, canInstallApp() ? function () {
        if (deferredInstall && deferredInstall.prompt) {
          deferredInstall.prompt();
          deferredInstall = null;
          draw();
        } else {
          installModal = true;
          draw();
        }
      } : null, function () {
        infoView = "menu";
        draw();
      });
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
        const screenTitle = state.mode === "post" ? "Post a ride" : (state.mode === "posted" ? ((state.role === "requester" || (state.ride && state.ride.kind === "request")) ? "Request posted" : "Trip posted") : "Trip details");
        top.appendChild(el(doc, "span", "screen-title", screenTitle));
        brandBar(doc, top, groupMeta);
      }
      const mid = el(doc, "main");
      mid.id = "jumpin-mid";
      const modeChanged = state.mode !== prevMode;
      const midClasses = [];
      if (state.mode === "post") midClasses.push("post-card");
      if (modeChanged) midClasses.push("anim-in");
      if (midClasses.length) mid.className = midClasses.join(" ");
      on(mid, "focusin", function (e) {
        keepFocusedVisible(e && e.target);
      });
      const bottom = el(doc, "footer");
      bottom.id = "jumpin-bottom";
      let hero = null;
      if (state.mode === "board") {
        const ptr = el(doc, "div");
        ptr.id = "jumpin-ptr";
        top.appendChild(ptr);
        const wrap = el(doc, "div", "wrap");
        hero = el(doc, "section", "hero");
        const copy = el(doc, "div", "copy");
        const badges = el(doc, "div", "hero-badges");
        badges.appendChild(el(doc, "span", "hero-eyebrow", "Community Carpool"));
        badges.appendChild(el(doc, "span", "hero-group-pill", "📍 " + (groupMeta.name || "Its-OK")));
        copy.appendChild(badges);
        copy.appendChild(el(doc, "h1", "", "Find a seat. Offer a ride."));
        copy.appendChild(el(doc, "p", "muted", "Post a trip. Reserve your seats. No app fees."));
        if (!groupMeta.groupId || groupMeta.groupId === "default") {
          const startPill = el(doc, "a", "hero-start-pill", "+ Start a Group");
          startPill.href = "/jumpin-admin.html?tab=groups";
          badges.appendChild(startPill);
          const orgLine = el(doc, "p", "hero-org", "Want a private board for your neighborhood? ");
          const orgLink = el(doc, "a", "", "Start a Group →");
          orgLink.href = "/jumpin-admin.html?tab=groups";
          orgLine.appendChild(orgLink);
          copy.appendChild(orgLine);
        }
        hero.appendChild(copy);
        wrap.appendChild(hero);
        if (groupMeta.status && groupMeta.status !== "active") {
          const notice = el(doc, "div", "empty");
          notice.style.marginBottom = "14px";
          notice.appendChild(el(doc, "p", "route", groupMeta.status === "pending" ? "Waiting for approval" : (groupMeta.status === "suspended" ? "Group paused" : "Group not found")));
          notice.appendChild(el(doc, "p", "muted", groupMeta.status === "pending" ? "This community group is waiting for platform approval before rides can be posted." : "Check the group link with your community organizer."));
          wrap.appendChild(notice);
        }
        if (platformNotice.platformEnabled === false || platformNotice.maintenanceMessage) {
          const banner = el(doc, "div", "support-card");
          banner.style.margin = "0 0 14px";
          banner.appendChild(el(doc, "p", "support-title", platformNotice.platformEnabled === false ? "Maintenance Mode" : "Platform Notice"));
          banner.appendChild(el(doc, "p", "support-sub", platformNotice.maintenanceMessage || "JumpIn is temporarily paused for maintenance."));
          wrap.appendChild(banner);
        }
        const rides = state.rides || [];
        const visibleRides = rides;
        const list = el(doc, "div", "board");
        const pager = el(doc, "div", "pager");
        function matchesDateFilter(ride, filter, nowMs) {
          if (filter === "all") return true;
          if (filter === "need_driver") return ride.kind === "request";
          if (filter === "mine") return !!(cloud && cloud.roleFor && cloud.roleFor(ride));
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
          const shown = visibleRides.filter(function (ride) {
            if (!matchesDateFilter(ride, boardDateFilter, nowMs)) return false;
            if (!q) return true;
            return [ride.from, ride.to, ride.driverName, ride.requesterName, shortTripId(ride.rideId || ride.id)].join(" ").toLowerCase().indexOf(q) !== -1;
          });
          if (!shown.length) {
            if (groupMeta.status && groupMeta.status !== "active") return;
            if (!boardLoaded && !q && boardDateFilter === "all") {
              for (let s = 0; s < 3; s++) {
                const sk = el(doc, "div", "skel-card");
                sk.appendChild(el(doc, "div", "skel-line w70"));
                sk.appendChild(el(doc, "div", "skel-line w45"));
                list.appendChild(sk);
              }
              return;
            }
            const empty = el(doc, "div", "empty");
            const filtered = !!(q || boardDateFilter !== "all");
            empty.appendChild(el(doc, "div", "empty-icon", filtered ? "🔍" : "🚗"));
            empty.appendChild(el(doc, "p", "route", filtered ? "No matching rides" : "No rides yet"));
            empty.appendChild(el(doc, "p", "muted", filtered ? "Try another date or clear the filter." : "Post one trip and it will show up here."));
            const emptyBtn = el(doc, "button", "textish", filtered ? "Show all rides" : "Offer a ride");
            emptyBtn.style.marginTop = "12px";
            on(emptyBtn, "click", function () {
              if (filtered) {
                boardQuery = "";
                boardDateFilter = "all";
                boardPage = 1;
                draw();
              } else {
                const kept = state.rides || [];
                state = ui.reduce(state, { type: "post" });
                state.rides = kept;
                draw();
              }
            });
            empty.appendChild(emptyBtn);
            list.appendChild(empty);
            return;
          }
          const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
          if (boardPage > totalPages) boardPage = totalPages;
          const start = (boardPage - 1) * PAGE_SIZE;
          const pageItems = shown.slice(start, start + PAGE_SIZE);
          pageItems.forEach(function (ride) {
            const myRole = cloud && cloud.roleFor ? cloud.roleFor(ride) : "";
            const isReq = ride.kind === "request";
            const row = el(doc, "button", "row" + (isReq ? " role-rider" : (myRole ? " role-" + myRole : "")));
            const head = el(doc, "div", "row-head");
            head.appendChild(el(doc, "div", "route", ride.from + " → " + ride.to));
            const pills = el(doc, "span", "pill-group");
            if (isReq) {
              pills.appendChild(el(doc, "span", "status-pill rider", "🙋 Needs a driver"));
            } else {
              if (myRole === "driver" || myRole === "rider") {
                pills.appendChild(el(doc, "span", "status-pill " + myRole, myRole === "driver" ? "Your trip" : "Seat booked"));
              }
              const left = ride.seatsLeft == null ? 2 : Number(ride.seatsLeft);
              const pillKind = left === 0 ? "full" : (left === 1 ? "last" : "open");
              const pillText = left === 0 ? "Full" : (left === 1 ? "Last seat" : "Open");
              pills.appendChild(el(doc, "span", "status-pill " + pillKind, pillText));
            }
            head.appendChild(pills);
            row.appendChild(head);
            row.appendChild(el(doc, "div", "meta", (ride.when || whenOf(ride)) + (!isReq && ride.durationMinutes ? " · Est. " + core.formatDuration(ride.durationMinutes) : "")));
            const foot = el(doc, "div", "card-foot");
            const dName = isReq ? ("Requested by " + (ride.requesterName || "Rider")) : (ride.driverName || "Driver");
            const dWrap = el(doc, "span", "foot-driver");
            dWrap.appendChild(el(doc, "span", "mini-av", dName.charAt(0).toUpperCase()));
            dWrap.appendChild(el(doc, "span", "", dName));
            foot.appendChild(dWrap);
            const right = el(doc, "span", "foot-right");
            const reqSeats = Number(ride.seatsRequested) || 1;
            right.appendChild(el(doc, "span", "", isReq ? (reqSeats === 1 ? "1 seat needed" : reqSeats + " seats needed") : (ride.seats || seatsLabel(ride.seatsLeft))));
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
        if (visibleRides.length) {
          const tools = el(doc, "div", "board-tools");
          const filterRow = el(doc, "div", "filter-row");
          const filterNow = Date.now();
          const filterSpecs = [["all", "All"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"]];
          if (platformNotice.needARideEnabled || visibleRides.some(function (ride) { return ride.kind === "request"; })) {
            filterSpecs.splice(1, 0, ["need_driver", "Need a driver"]);
          }
          const myCount = cloud && cloud.roleFor ? visibleRides.filter(function (ride) { return !!cloud.roleFor(ride); }).length : 0;
          if (myCount > 0) filterSpecs.splice(1, 0, ["mine", "My Trips"]);
          filterSpecs.forEach(function (spec) {
            const count = visibleRides.filter(function (ride) { return matchesDateFilter(ride, spec[0], filterNow); }).length;
            const chip = el(doc, "button", "filter-chip" + (boardDateFilter === spec[0] ? " active" : ""), spec[1] + " (" + count + ")");
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
        if (!platformNotice.needARideEnabled) postRole = "driver";
        function savePostDraft() {
          const draft = Object.assign({}, state.draft || {});
          mid.querySelectorAll("input, select").forEach(function (inp) {
            if (inp.name) draft[inp.name] = inp.value;
          });
          state.draft = draft;
        }
        if (state.error && !state.field) mid.appendChild(el(doc, "p", "error", state.error));
        const postHead = el(doc, "div", "post-head");
        const postBadges = el(doc, "div", "hero-badges");
        postBadges.appendChild(el(doc, "span", "hero-eyebrow", postRole === "rider" ? "Ride Request" : "New Trip"));
        postBadges.appendChild(el(doc, "span", "hero-group-pill", "📍 " + (groupMeta.name || "Its-OK")));
        postHead.appendChild(postBadges);
        postHead.appendChild(el(doc, "h1", "", postRole === "rider" ? "Request a ride" : "Post a ride"));
        if (platformNotice.needARideEnabled) {
          const rolePills = el(doc, "div", "seat-pills");
          rolePills.style.cssText = "grid-template-columns:repeat(2,minmax(0,1fr));margin:10px 0 0;";
          [["driver", "🚗 I'm driving"], ["rider", "🙋 I need a ride"]].forEach(function (pair) {
            const rb = el(doc, "button", "seat-pill" + (postRole === pair[0] ? " active" : ""), pair[1]);
            rb.type = "button";
            on(rb, "click", function () { savePostDraft(); postRole = pair[0]; draw(); });
            rolePills.appendChild(rb);
          });
          postHead.appendChild(rolePills);
        }
        if (groupMeta.membersOnly) {
          const sub = el(doc, "p", "muted", "For approved " + (groupMeta.name || "Its-OK") + " members only");
          sub.style.fontStyle = "italic";
          sub.style.marginTop = "4px";
          postHead.appendChild(sub);
        }
        mid.appendChild(postHead);
        const routeFields = [
          ["from", "From", "text", "Library"],
          ["to", "To", "text", "Office"]
        ];
        const driverFields = [
          ["name", "Your name", "text", "Alex"],
          ["phone", "Phone (US/Canada)", "tel", "555 234 5678"]
        ];
        const saved = loadProfile();
        const defaultZone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
        const defaultParts = !state.draft ? core.partsInZone(roundUp30(Date.now() + 60 * 60000), defaultZone) : null;
        const postInputs = {};
        function buildPostField(spec, host) {
          if (spec[0] === "to") {
            const toHead = el(doc, "div");
            toHead.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin:0 0 6px;";
            const toLbl = el(doc, "label", "lbl", spec[1]);
            toLbl.style.margin = "0";
            toHead.appendChild(toLbl);
            const swapBtn = el(doc, "button", "chip-btn", "⇅ Swap");
            swapBtn.type = "button";
            swapBtn.style.cssText = "min-height:28px;padding:2px 10px;font-size:12px;";
            swapBtn.setAttribute("aria-label", "Swap From and To");
            on(swapBtn, "click", function () {
              const tmp = postInputs.from.value;
              postInputs.from.value = postInputs.to.value;
              postInputs.to.value = tmp;
            });
            toHead.appendChild(swapBtn);
            host.appendChild(toHead);
          } else {
            host.appendChild(el(doc, "label", "lbl", spec[1]));
          }
          const input = el(doc, "input");
          input.name = spec[0];
          const isDt = spec[0] === "date" || spec[0] === "time";
          input.type = isDt ? "hidden" : spec[2];
          if (spec[3]) input.placeholder = spec[3];
          input.autocomplete = spec[0] === "phone" ? "tel" : "on";
          if (state.draft && state.draft[spec[0]]) input.value = state.draft[spec[0]];
          else if (!state.draft && (spec[0] === "name" || spec[0] === "phone") && saved[spec[0]]) input.value = saved[spec[0]];
          else if (defaultParts && spec[0] === "date") input.value = defaultParts.year + "-" + String(defaultParts.month).padStart(2, "0") + "-" + String(defaultParts.day).padStart(2, "0");
          else if (defaultParts && spec[0] === "time") input.value = String(defaultParts.hour).padStart(2, "0") + ":" + String(defaultParts.minute).padStart(2, "0");
          postInputs[spec[0]] = input;
          if (state.error && state.field === spec[0] && !isDt) input.className = "input-invalid";
          host.appendChild(input);
          if (spec[0] === "date") attachDatePicker(doc, host, input, state.error && state.field === "date", function () { syncWhenChips(); }, spec[4]);
          else if (spec[0] === "time") attachTimePicker(doc, host, input, state.error && state.field === "time", function () { syncWhenChips(); }, spec[4]);
          if (state.error && state.field === spec[0]) host.appendChild(el(doc, "p", "error", state.error));
        }
        const secRoute = el(doc, "section", "post-section");
        const recent = loadRecentRoutes();
        if (recent.length) {
          const rRow = el(doc, "div", "chip-row");
          recent.forEach(function (rt) {
            const rb = el(doc, "button", "chip-btn", rt.from + " → " + rt.to);
            rb.type = "button";
            on(rb, "click", function () {
              if (postInputs.from) postInputs.from.value = rt.from;
              if (postInputs.to) postInputs.to.value = rt.to;
            });
            rRow.appendChild(rb);
          });
          secRoute.appendChild(rRow);
        }
        routeFields.forEach(function (spec) {
          const rf = el(doc, "div", "route-field");
          rf.appendChild(el(doc, "span", "route-dot " + spec[0]));
          buildPostField(spec, rf);
          secRoute.appendChild(rf);
        });
        mid.appendChild(secRoute);
        const secSched = el(doc, "section", "post-section");
        const dtPair = el(doc, "div", "form-pair");
        const dateCol = el(doc, "div");
        const timeCol = el(doc, "div");
        const dtDrawerHost = el(doc, "div");
        buildPostField(["date", "Date", "date", "", dtDrawerHost], dateCol);
        buildPostField(["time", "Time", "time", "", dtDrawerHost], timeCol);
        dtPair.appendChild(dateCol);
        dtPair.appendChild(timeCol);
        secSched.appendChild(dtPair);
        secSched.appendChild(dtDrawerHost);
        const whenChips = el(doc, "div", "chip-row");
        const whenBtns = [];
        let pickedWhen = "";
        function syncWhenChips() {
          const zone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
          const nowMs = Date.now();
          const todayP = core.partsInZone(nowMs, zone);
          const tomP = core.partsInZone(nowMs + 24 * 60 * 60000, zone);
          const todayStr = todayP.year + "-" + String(todayP.month).padStart(2, "0") + "-" + String(todayP.day).padStart(2, "0");
          const tomStr = tomP.year + "-" + String(tomP.month).padStart(2, "0") + "-" + String(tomP.day).padStart(2, "0");
          const curDate = postInputs.date ? postInputs.date.value : "";
          whenBtns.forEach(function (pair) {
            const isDay = (pair[0] === "Today" && curDate === todayStr) || (pair[0] === "Tomorrow" && curDate === tomStr);
            const active = pickedWhen ? pair[0] === pickedWhen : isDay;
            pair[1].className = "chip-btn" + (active ? " active" : "");
          });
        }
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
            const nowMs = Date.now();
            const targetMs = spec[1] > 0 ? roundUp30(nowMs + spec[1] * 60000) : nowMs;
            const p = core.partsInZone(targetMs, zone);
            const dateStr = p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0");
            if (spec[2] && postInputs.date) postInputs.date.value = dateStr;
            if (spec[3] && postInputs.time) {
              postInputs.time.value = String(p.hour).padStart(2, "0") + ":" + String(p.minute).padStart(2, "0");
            } else if (spec[0] === "Today" && postInputs.time) {
              const chosen = postInputs.time.value ? core.wallTimeToUtc(dateStr, postInputs.time.value, zone) : 0;
              if (!chosen || chosen <= nowMs) {
                const fp = core.partsInZone(roundUp30(nowMs + 30 * 60000), zone);
                postInputs.time.value = String(fp.hour).padStart(2, "0") + ":" + String(fp.minute).padStart(2, "0");
              }
            }
            pickedWhen = spec[0];
            if (postInputs.date && postInputs.date._syncDt) postInputs.date._syncDt();
            if (postInputs.time && postInputs.time._syncDt) postInputs.time._syncDt();
            syncWhenChips();
          });
          whenBtns.push([spec[0], chip]);
          whenChips.appendChild(chip);
        });
        if (postInputs.date) on(postInputs.date, "change", function () { pickedWhen = ""; syncWhenChips(); });
        if (postInputs.time) on(postInputs.time, "change", function () { pickedWhen = ""; syncWhenChips(); });
        syncWhenChips();
        secSched.appendChild(whenChips);
        secSched.appendChild(el(doc, "label", "lbl", postRole === "rider" ? "Seats needed" : "Seats"));
        buildSeatPills(doc, secSched, "seats", postRole === "rider" ? 4 : 6, (state.draft && state.draft.seats) || (postRole === "rider" ? 1 : 3));
        if (postRole !== "rider") {
          secSched.appendChild(el(doc, "label", "lbl", "Estimated duration"));
          const dur = el(doc, "input");
          dur.type = "hidden";
          dur.name = "durationMinutes";
          let durMins = Number((state.draft && state.draft.durationMinutes) || 30);
          if (!Number.isFinite(durMins) || durMins < 30) durMins = 30;
          if (durMins > 900) durMins = 900;
          dur.value = String(durMins);
          const stepper = el(doc, "div", "dur-stepper");
          stepper.style.marginBottom = "0";
          const minusDur = el(doc, "button", "dur-btn", "−");
          minusDur.type = "button";
          minusDur.setAttribute("aria-label", "Decrease duration by 30 minutes");
          const durReadout = el(doc, "div", "dur-val");
          const plusDur = el(doc, "button", "dur-btn", "+");
          plusDur.type = "button";
          plusDur.setAttribute("aria-label", "Increase duration by 30 minutes");
          function syncDur(next) {
            durMins = Math.max(30, Math.min(900, next));
            dur.value = String(durMins);
            durReadout.textContent = core.formatDuration(durMins);
            minusDur.disabled = durMins <= 30;
            plusDur.disabled = durMins >= 900;
          }
          syncDur(durMins);
          on(minusDur, "click", function () { syncDur(durMins - 30); });
          on(plusDur, "click", function () { syncDur(durMins + 30); });
          stepper.appendChild(minusDur);
          stepper.appendChild(durReadout);
          stepper.appendChild(plusDur);
          secSched.appendChild(dur);
          secSched.appendChild(stepper);
          const durChips = el(doc, "div", "chip-row");
          durChips.style.marginBottom = "0";
          [["30m", 30], ["1h", 60], ["2h", 120], ["3h", 180]].forEach(function (spec) {
            const dc = el(doc, "button", "chip-btn", spec[0]);
            dc.type = "button";
            on(dc, "click", function () { syncDur(spec[1]); });
            durChips.appendChild(dc);
          });
          secSched.appendChild(durChips);
        }
        mid.appendChild(secSched);
        const secDriver = el(doc, "section", "post-section");
        const hasSavedDriver = !!(saved.name && saved.phone);
        const driverFieldErr = !!(state.error && (state.field === "name" || state.field === "phone"));
        if (hasSavedDriver && !driverEditOpen && !driverFieldErr) {
          const dSum = el(doc, "div", "driver-summary");
          const dName = (state.draft && state.draft.name) || saved.name;
          const dPhone = (state.draft && state.draft.phone) || saved.phone;
          dSum.appendChild(el(doc, "span", "driver-summary-txt", "Posting as " + dName + " · " + dPhone));
          const editBtn = el(doc, "button", "chip-btn", "Edit");
          editBtn.type = "button";
          on(editBtn, "click", function () { savePostDraft(); driverEditOpen = true; draw(); });
          dSum.appendChild(editBtn);
          secDriver.appendChild(dSum);
          [["name", dName], ["phone", dPhone]].forEach(function (pair) {
            const hi = el(doc, "input");
            hi.type = "hidden";
            hi.name = pair[0];
            hi.value = pair[1];
            secDriver.appendChild(hi);
          });
        } else {
          driverFields.forEach(function (spec) { buildPostField(spec, secDriver); });
        }
        const showExtras = extrasOpen || !!(state.draft && (state.draft.rideCost || state.draft.note)) || !!(state.error && state.field === "rideCost");
        if (showExtras) {
          secDriver.appendChild(el(doc, "label", "lbl", postRole === "rider" ? "Willing to chip in ($ / seat), optional" : "Ride cost per seat ($), optional"));
          const rideCost = el(doc, "input");
          rideCost.name = "rideCost";
          rideCost.type = "number";
          rideCost.min = "0";
          rideCost.max = "500";
          rideCost.step = "0.01";
          rideCost.inputMode = "decimal";
          rideCost.placeholder = "Free (or e.g. 5)";
          if (state.draft && state.draft.rideCost) rideCost.value = state.draft.rideCost;
          secDriver.appendChild(rideCost);
          if (state.error && state.field === "rideCost") secDriver.appendChild(el(doc, "p", "error", state.error));
          secDriver.appendChild(el(doc, "label", "lbl", "Note, optional"));
          const note = el(doc, "input");
          note.name = "note";
          note.type = "text";
          note.placeholder = "South door";
          if (state.draft && state.draft.note) note.value = state.draft.note;
          secDriver.appendChild(note);
        } else {
          const exBtn = el(doc, "button", "chip-btn", "+ Add price or pickup note");
          exBtn.type = "button";
          exBtn.style.marginBottom = "8px";
          on(exBtn, "click", function () { savePostDraft(); extrasOpen = true; draw(); });
          secDriver.appendChild(exBtn);
          [["rideCost", ""], ["note", ""]].forEach(function (pair) {
            const hi = el(doc, "input");
            hi.type = "hidden";
            hi.name = pair[0];
            hi.value = pair[1];
            secDriver.appendChild(hi);
          });
        }
        secDriver.appendChild(el(doc, "p", "hint", "WaitLink will text this number a link to manage this trip, and JumpIn notices."));
        mid.appendChild(secDriver);
      } else if (state.mode === "posted") {
        const isReqPosted = state.role === "requester" || (state.ride && state.ride.kind === "request");
        const card = el(doc, "section", "confirm");
        card.appendChild(el(doc, "span", "confirm-badge" + (state.status === "pending" ? " pending" : ""), state.status === "pending" ? "Pending approval" : (isReqPosted ? "✓ Request live" : "✓ Trip live")));
        card.appendChild(el(doc, "h1", "", state.notice || (isReqPosted ? "Ride request posted." : "Trip posted.")));
        card.appendChild(el(doc, "p", "route", state.route || ""));
        if (state.when) card.appendChild(el(doc, "p", "muted", state.when));
        if (state.seatsText) card.appendChild(el(doc, "p", "muted", state.seatsText));
        const tripCode = shortTripId(state.rideId || (state.ride && state.ride.rideId));
        if (tripCode) card.appendChild(el(doc, "p", "muted", "Trip ID: " + tripCode));
        if (state.link) {
          const shareLbl = el(doc, "p", "section-lbl link-box-sep", isReqPosted ? "Share request link" : "Share trip link");
          card.appendChild(shareLbl);
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
            showToast("Link copied!");
            if (win.setTimeout) {
              const tid = win.setTimeout(function () { copyBtn.textContent = "📋 Copy"; }, 2000);
              cleanups.push(function () { if (win.clearTimeout) win.clearTimeout(tid); });
            }
          });
          linkRow.appendChild(copyBtn);
          card.appendChild(linkRow);
          card.appendChild(el(doc, "p", "hint", isReqPosted ? "Share this link with drivers so someone can offer a ride. Use your texted link if opening from another app." : "Share this link with riders. Use your texted link if opening from another app."));
        }
        if (state.smsNote) card.appendChild(el(doc, "p", "hint", state.smsNote));
        else if (!state.link) card.appendChild(el(doc, "p", "hint", "Use your texted link if opening from another app."));
        if (supportNote) card.appendChild(supportCard(doc, supportNote));
        if (state.error) card.appendChild(el(doc, "p", "error", state.error));
        if (isReqPosted && state.ride && state.status !== "cancelled") {
          const actions = el(doc, "div", "action-row");
          const viewReq = el(doc, "button", "textish", "View request");
          on(viewReq, "click", function () {
            const r = state.ride;
            state = Object.assign(ui.reduce(state, { type: "ride", ride: r, role: "requester" }), {
              ride: r,
              rides: state.rides || [],
              when: state.when,
              link: state.link
            });
            draw();
          });
          actions.appendChild(viewReq);
          actions.appendChild(buildCancelRequestButton(doc, state.ride, state.when, state.link));
          card.appendChild(actions);
        } else if (state.role === "driver" && state.status !== "cancelled") {
          const actions = el(doc, "div", "action-row");
          if (state.ride && (state.status === "open" || state.status === "pending")) {
            const editPosted = el(doc, "button", "textish", "Edit trip");
            on(editPosted, "click", function () {
              const r = state.ride;
              state = Object.assign(ui.reduce(ui.reduce(state, { type: "ride", ride: r, role: "driver" }), { type: "edit-open" }), {
                ride: r,
                rides: state.rides || [],
                when: state.when,
                link: state.link,
                editDraft: null
              });
              draw();
            });
            actions.appendChild(editPosted);
          }
          const retBtn = el(doc, "button", "textish", "Post return trip");
          on(retBtn, "click", function () { startReturnTrip(state.ride); });
          actions.appendChild(retBtn);
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
        if (state.smsNote) {
          card.appendChild(el(doc, "p", "hint", state.smsNote));
          card.appendChild(el(doc, "p", "hint", "Use your texted link if opening from another app."));
        } else {
          card.appendChild(el(doc, "p", "hint", state.role === "driver" ? "Passenger added to this trip." : ((state.bookedSeats > 1 ? "We texted your manage link for these seats" : "We texted your manage link for this seat") + " (use it if opening from another app).")));
        }
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
        const card = el(doc, "section", "confirm");
        card.appendChild(el(doc, "span", "confirm-badge", state.status === "missing" ? "Link expired" : "Trip status"));
        card.appendChild(el(doc, "h1", "", state.status === "missing" ? "Trip unavailable" : rideLine(state)));
        card.appendChild(el(doc, "p", "muted", "This trip link has expired or the trip is no longer available."));
        mid.appendChild(card);
      }
      let label = state.mode === "reserved" ? "View trip" : ui.buttonLabel(state);
      if (label === "Post") label = postRole === "rider" ? "Post ride request" : "Post ride";
      if (state.mode === "ride" && state.ride && state.ride.kind === "request" && !state.recovery && !state.claimOpen && !state.sheet && !state.editOpen && !state.waitlistOpen && !state.driverSheet) {
        if (state.status === "open" && !state.role && platformNotice.needARideEnabled) label = "🚗 I can drive";
        else if (state.status === "open" && state.role === "requester" && state.link) label = "Share on WhatsApp";
        else label = "Close";
      }
      if (state.mode === "posted" && state.link) label = "Share on WhatsApp";
      if (label === "Send" && state.role === "rider" && state.mode === "ride" && !state.recovery && !state.reserveOpen) label = "Sign out on this device";
      if (label === "Reserve a seat" && !state.reserveOpen && state.ride && state.ride.departAt && Date.now() >= state.ride.departAt) label = null;
      if (label === "Copy link" && state.mode === "ride" && state.role === "driver" && state.ride && Number(state.ride.seatsLeft) === 0) label = "Close";
      if (!label && state.mode === "ride") label = "Close";
      if (state.mode === "board" && groupMeta.status && groupMeta.status !== "active") label = null;
      if (label === "Reserve a seat" && state.reserveOpen) label = state.role === "driver" ? "Confirm passenger" : "Confirm seat";
      if (state.busy && state.mode === "post") label = "Posting…";
      if (state.busy && label === "Save changes") label = "Saving…";
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
          else if (label === "🚗 I can drive") {
            state = Object.assign(ui.reduce(state, { type: "claim-open" }), { claimDraft: null });
          }
          else if (label === "Post" || label === "Post ride" || label === "Post ride request") {
            const isReqPost = label === "Post ride request";
            const values = {};
            mid.querySelectorAll("input, select").forEach(function (input) { values[input.name] = input.value; });
            if (!values.seats) values.seats = isReqPost ? 1 : 3;
            values.timeZone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
            const errors = isReqPost ? core.requestErrors(values) : core.postErrors(values);
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
              Promise.resolve().then(function () { return isReqPost ? cloud.postRideRequest(values) : cloud.postRide(values); }).then(function (result) {
                state.busy = false;
                if (!result || result.ok === false) {
                  state = ui.reduce(state, { type: "fail", field: result && result.field, error: (result && result.error) || "Could not post. Check the connection and try again." });
                  state.draft = values;
                  state.rides = state.rides || [];
                  openMemberModal(result);
                } else {
                  saveProfile(values.name, values.phone);
                  saveRecentRoute(values.from, values.to);
                  extrasOpen = false;
                  driverEditOpen = false;
                  postRole = "driver";
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
                  openMemberModal(result);
                } else {
                  if (!wasDriver) saveProfile(values.name, values.phone);
                  const bookedSeats = Number(values.seats || 1);
                  const existingRiders = state.ride.riders || [];
                  const alreadyListed = result.reservationId && existingRiders.some(function (r) { return r.reservationId === result.reservationId; });
                  const nextSeatsLeft = result.seatsLeft != null ? Number(result.seatsLeft) : Math.max(0, Number(state.ride.seatsLeft || 1) - bookedSeats);
                  const ride = Object.assign({}, state.ride, {
                    seatsLeft: nextSeatsLeft,
                    riders: alreadyListed ? existingRiders : existingRiders.concat([{ reservationId: result.reservationId, name: values.name, seats: bookedSeats, dropoff: values.dropoff || "", driverSeenAt: wasDriver ? Date.now() : 0, status: "active" }])
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
            const parsed = core.normalizePhone(values.phone);
            if (!parsed.ok) {
              state = ui.reduce(state, { type: "fail", field: "phone", error: parsed.error });
              draw();
              return;
            }
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
            const actionPrompt = (state.ride && state.ride.kind === "request") ? " — Can anyone drive? " : " — Reserve a seat: ";
            const msg = encodeURIComponent(groupLabel + (state.route || "") + (state.when ? " (" + state.when + ")" : "") + actionPrompt + state.link);
            const isMobile = platform === "android" || platform === "ios";
            if (isMobile && win.location) win.location.href = "whatsapp://send?text=" + msg;
            else if (win.open) win.open("https://wa.me/?text=" + msg, "_blank", "noopener,noreferrer");
          } else if (label === "Copy link") {
            const clip = win.navigator && win.navigator.clipboard;
            const link = state.link || (state.ride && cloud ? cloud.publicRideUrl(state.ride.rideId) : "");
            if (clip && clip.writeText && link) clip.writeText(link);
            state = ui.reduce(state, { type: "notice", notice: "Copied" });
          } else if (label === "Close") {
            stopRide();
            const kept = state.rides || [];
            state = ui.reduce(state, { type: "board" });
            state.rides = kept;
          }
          draw();
        });
        if (state.busy) button.disabled = true;
        button.className = state.mode === "board" ? "cta" : "";
        if (state.mode === "board" && hero) hero.appendChild(button);
        else bottom.appendChild(button);
      }
      bottom.appendChild(siteFooter(doc, supportNote));
      rootNode.appendChild(top);
      rootNode.appendChild(mid);
      rootNode.appendChild(bottom);
      if (state.mode === "board" && (!groupMeta.status || groupMeta.status === "active")) {
        const mbar = el(doc, "nav", "jumpin-mobile-bar");
        mbar.setAttribute("aria-label", "Quick navigation");
        const ridesTab = el(doc, "button", "jumpin-mobile-tab active");
        ridesTab.type = "button";
        ridesTab.appendChild(el(doc, "span", "ico", "🚗"));
        ridesTab.appendChild(el(doc, "span", "", "Rides"));
        on(ridesTab, "click", function () {
          if (win.scrollTo) win.scrollTo({ top: 0, behavior: "smooth" });
        });
        const postTab = el(doc, "button", "jumpin-mobile-tab");
        postTab.type = "button";
        postTab.appendChild(el(doc, "span", "ico", "➕"));
        postTab.appendChild(el(doc, "span", "", "Post Ride"));
        on(postTab, "click", function () {
          const kept = state.rides || [];
          state = ui.reduce(state, { type: "post" });
          state.rides = kept;
          draw();
        });
        mbar.appendChild(ridesTab);
        mbar.appendChild(postTab);
        rootNode.appendChild(mbar);
      }
      let activeSheet = null;
      if (state.sheet || (state.busy && state.busyAction === "sheet")) activeSheet = confirmSheet(doc);
      else if (state.waitlistOpen) activeSheet = waitlistSheet(doc);
      else if (state.claimOpen && !state.role) activeSheet = claimRequestSheet(doc);
      else if (state.editOpen && state.role === "driver") activeSheet = editSheet(doc);
      else if (state.driverSheet === "trip" && state.role === "driver") activeSheet = manageTripSheet(doc);
      else if (state.driverSheet === "return" && state.role === "driver") activeSheet = returnTripSheet(doc);
      else if ((state.driverSheet === "passengers" || state.driverSheet === "passengers-add") && state.role === "driver") activeSheet = managePassengersSheet(doc);
      else if (memberModal) activeSheet = memberSheet(doc);
      else if (installModal) activeSheet = installSheet(doc);
      else if (infoView) activeSheet = infoSheet(doc);
      if (activeSheet) {
        if (!prevSheetOpen) activeSheet.className = (activeSheet.className ? activeSheet.className + " " : "") + "anim-in";
        rootNode.appendChild(activeSheet);
        const bd = el(doc, "div");
        bd.id = "jumpin-backdrop";
        rootNode.appendChild(bd);
      }
      prevMode = state.mode;
      prevSheetOpen = !!activeSheet;
      applyShell(win, rootNode, state.mode);
      if (unsentMessage && rootNode.querySelector) {
        const nextMsgEl = rootNode.querySelector("input[name=message]");
        if (nextMsgEl && !nextMsgEl.value) nextMsgEl.value = unsentMessage;
      }
      if (savedFocus && rootNode.querySelector) {
        const restoreEl = savedFocus.isBoardSearch
          ? rootNode.querySelector("input.board-search")
          : (savedFocus.name ? rootNode.querySelector("input[name=\"" + savedFocus.name + "\"], textarea[name=\"" + savedFocus.name + "\"]") : null);
        if (restoreEl) {
          if ((savedFocus.name === "message" || savedFocus.isBoardSearch) && savedFocus.value != null && restoreEl.value !== savedFocus.value) {
            restoreEl.value = savedFocus.value;
          }
          if (restoreEl.focus) {
            try { restoreEl.focus({ preventScroll: true }); } catch (err) { restoreEl.focus(); }
          }
          if (savedFocus.selStart != null && savedFocus.selEnd != null && restoreEl.setSelectionRange) {
            try { restoreEl.setSelectionRange(savedFocus.selStart, savedFocus.selEnd); } catch (err) { /* ignore non-selectable input types */ }
          }
        }
      }
      const bad = rootNode.querySelector && rootNode.querySelector(".error");
      if (bad && bad.scrollIntoView) bad.scrollIntoView({ block: "center" });
      if (secrets) secrets.setItem("jumpin-ui-mounted", "1");
    }

    function postedFromServer(current, result, values, departAt) {
      let when = values.date + " " + values.time;
      try { when = core.formatWhen(departAt, values.timeZone || "UTC"); } catch (err) { /* keep the typed date */ }
      const kept = current.rides || [];
      const isReq = result.kind === "request";
      const reqSeats = Number(values.seats || 1);
      return Object.assign(ui.reduce(current, { type: "notice", notice: isReq ? "Ride request posted." : (result.status === "pending" ? "Waiting for approval." : "Trip posted.") }), {
        mode: "posted",
        role: isReq ? "requester" : "driver",
        status: result.status || "open",
        route: values.from + " → " + values.to,
        when: when,
        seatsText: isReq ? (reqSeats === 1 ? "1 seat needed" : reqSeats + " seats needed") : seatsLabel(Number(values.seats || 3)),
        link: result.status === "pending" || !result.rideId || !cloud || !cloud.publicRideUrl ? "" : cloud.publicRideUrl(result.rideId),
        rideId: result.rideId,
        ride: isReq
          ? { rideId: result.rideId, kind: "request", from: values.from, to: values.to, departAt: departAt, status: result.status || "open", seatsLeft: reqSeats, seatsRequested: reqSeats, rideCost: Number(values.rideCost) || 0, note: values.note || "", requesterName: values.name || "", requesterReservationId: result.reservationId || "" }
          : { rideId: result.rideId, kind: "offer", from: values.from, to: values.to, departAt: departAt, status: result.status || "open", seatsLeft: Number(values.seats || 3), rideCost: Number(values.rideCost) || 0, note: values.note || "", driverName: values.name || "" },
        rides: kept,
        smsNote: result.textSent === false ? (result.error || (isReq ? "Request posted on this browser. Text could not be sent right now." : "Trip posted on this browser. Text could not be sent right now.")) : ""
      });
    }

    function connectCloud() {
      if (!cloud) return;
      let stop = function () { };
      try {
        stop = cloud.watchBoard(function (rides) {
          boardLoaded = true;
          try {
            state.rides = (rides || []).map(function (ride) {
              return { rideId: ride.rideId, kind: ride.kind || "offer", claimedFromRequest: !!ride.claimedFromRequest, from: ride.from, to: ride.to, when: whenOf(ride), seats: (ride.seatsLeft == null ? "" : seatsLabel(ride.seatsLeft)), seatsLeft: ride.seatsLeft == null ? 0 : Number(ride.seatsLeft), seatsRequested: Number(ride.seatsRequested) || 0, departAt: ride.departAt, durationMinutes: Number(ride.durationMinutes) || 0, rideCost: Number(ride.rideCost) || 0, note: ride.note || "", driverName: ride.driverName || "", requesterName: ride.requesterName || "", requesterReservationId: ride.requesterReservationId || "" };
            });
            if (state.mode === "board") draw();
          } catch (err) { /* leave the board that is already on screen */ }
        }) || function () { };
      } catch (err) { boardLoaded = true; stop = function () { }; }
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
      if (cloud.watchPlatformNotice) {
        cleanups.push(cloud.watchPlatformNotice(function (notice) {
          platformNotice = notice || { platformEnabled: true, iosThemeEnabled: false, maintenanceMessage: "" };
          syncIosTheme();
          if (state.mode === "board") draw();
        }));
      }
      const params = new URLSearchParams((win.location && win.location.search) || "");
      const view = params.get("view") || "";
      const rideId = params.get("ride") || "";
      const secret = params.get("k") || "";
      if (view === "trip" && rideId && secret) cloud.saveTrip(rideId, secret);
      if (view === "seat" && params.get("r") && secret) cloud.saveSeat(params.get("r"), secret);
      if (secret) params.delete("k");
      if (win.history && win.history.replaceState && win.location && (secret || params.get("s") === "jumpin")) {
        params.delete("s");
        const next = params.toString();
        win.history.replaceState({}, "", "/jumpin" + (next ? "?" + next : ""));
      }
      if (rideId && (view === "ride" || view === "trip" || view === "seat")) openRide(rideId);
      if (cloud.prepareAppCheck) {
        try { cloud.prepareAppCheck(); } catch (err) { /* the board still works if App Check cannot start */ }
      }
    }

    function formatDatePill(ymd) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) return "📅 Select date";
      const zone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
      const now = Date.now();
      const tP = core.partsInZone(now, zone);
      const mP = core.partsInZone(now + 24 * 60 * 60000, zone);
      const tStr = tP.year + "-" + String(tP.month).padStart(2, "0") + "-" + String(tP.day).padStart(2, "0");
      const mStr = mP.year + "-" + String(mP.month).padStart(2, "0") + "-" + String(mP.day).padStart(2, "0");
      if (ymd === tStr) return "📅 Today";
      if (ymd === mStr) return "📅 Tomorrow";
      const p = ymd.split("-");
      const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const mos = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return "📅 " + days[dt.getDay()] + ", " + mos[dt.getMonth()] + " " + Number(p[2]);
    }

    function formatTimePill(hm) {
      if (!/^\d{2}:\d{2}$/.test(String(hm || ""))) return "🕒 Select time";
      const parts = hm.split(":");
      const h24 = Number(parts[0]);
      const m = parts[1];
      return "🕒 " + (h24 % 12 || 12) + ":" + m + " " + (h24 >= 12 ? "PM" : "AM");
    }

    function closeSiblingDrawers(drawerHost, keepDrawer) {
      if (!drawerHost || !drawerHost.children) return;
      Array.prototype.forEach.call(drawerHost.children, function (c) {
        if (c !== keepDrawer && c.style) c.style.display = "none";
      });
    }

    function attachDatePicker(doc, host, input, invalid, onPick, drawerHost) {
      const btn = el(doc, "button", "dt-pill" + (invalid ? " input-invalid" : ""), formatDatePill(input.value));
      btn.type = "button";
      const drawer = el(doc, "div", "dt-drawer");
      drawer.style.display = "none";
      const daysWrap = el(doc, "div", "dt-days");
      const zone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
      const now = Date.now();
      const opts = [];
      for (let i = 0; i < 60; i++) {
        const p = core.partsInZone(now + i * 24 * 60 * 60000, zone);
        const ymd = p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0");
        const label = i === 0 ? "Today" : (i === 1 ? "Tomorrow" : formatDatePill(ymd).replace("📅 ", ""));
        const opt = el(doc, "button", "dt-opt" + (input.value === ymd ? " active" : ""), label);
        opt.type = "button";
        on(opt, "click", function () {
          input.value = ymd;
          sync();
          drawer.style.display = "none";
          btn.className = "dt-pill";
          if (onPick) onPick();
        });
        opts.push([ymd, opt]);
        daysWrap.appendChild(opt);
      }
      drawer.appendChild(daysWrap);
      function sync() {
        btn.textContent = formatDatePill(input.value);
        opts.forEach(function (pair) { pair[1].className = "dt-opt" + (input.value === pair[0] ? " active" : ""); });
      }
      input._syncDt = sync;
      on(btn, "click", function () {
        const open = drawer.style.display !== "none";
        closeSiblingDrawers(drawerHost, drawer);
        drawer.style.display = open ? "none" : "block";
        btn.className = "dt-pill" + (open ? "" : " open") + (invalid ? " input-invalid" : "");
      });
      host.appendChild(btn);
      (drawerHost || host).appendChild(drawer);
    }

    function attachTimePicker(doc, host, input, invalid, onPick, drawerHost) {
      const btn = el(doc, "button", "dt-pill" + (invalid ? " input-invalid" : ""), formatTimePill(input.value));
      btn.type = "button";
      const drawer = el(doc, "div", "dt-drawer");
      drawer.style.display = "none";
      const wheel = el(doc, "div", "dt-wheel");
      const hCol = el(doc, "div", "dt-col");
      const mCol = el(doc, "div", "dt-col");
      const apCol = el(doc, "div", "dt-col");
      let curH24 = 9;
      let curMin = "00";
      let curAp = "AM";
      let curH12 = 9;
      let pickedH = false;
      let pickedM = false;
      let pickedAp = false;
      const hBtns = [];
      const mBtns = [];
      const apBtns = [];
      function closeDrawer() {
        drawer.style.display = "none";
        btn.className = "dt-pill" + (invalid ? " input-invalid" : "");
      }
      function commit() {
        const h24 = curAp === "PM" ? (curH12 === 12 ? 12 : curH12 + 12) : (curH12 === 12 ? 0 : curH12);
        input.value = String(h24).padStart(2, "0") + ":" + curMin;
        sync();
        if (onPick) onPick();
        if (pickedH && pickedM && pickedAp) closeDrawer();
      }
      function sync() {
        const parts = String(input.value || "09:00").split(":");
        curH24 = Number(parts[0]) || 0;
        curMin = parts[1] || "00";
        curAp = curH24 >= 12 ? "PM" : "AM";
        curH12 = curH24 % 12 || 12;
        btn.textContent = formatTimePill(input.value);
        hBtns.forEach(function (pair) { pair[1].className = "dt-opt" + (pair[0] === curH12 ? " active" : ""); });
        mBtns.forEach(function (pair) { pair[1].className = "dt-opt" + (pair[0] === curMin ? " active" : ""); });
        apBtns.forEach(function (pair) { pair[1].className = "dt-opt" + (pair[0] === curAp ? " active" : ""); });
      }
      for (let h = 1; h <= 12; h++) {
        (function (val) {
          const b = el(doc, "button", "dt-opt", String(val));
          b.type = "button";
          on(b, "click", function () { curH12 = val; pickedH = true; commit(); });
          hBtns.push([val, b]);
          hCol.appendChild(b);
        })(h);
      }
      for (let m = 0; m < 60; m += 5) {
        (function (val) {
          const b = el(doc, "button", "dt-opt", val);
          b.type = "button";
          on(b, "click", function () { curMin = val; pickedM = true; commit(); });
          mBtns.push([val, b]);
          mCol.appendChild(b);
        })(String(m).padStart(2, "0"));
      }
      ["AM", "PM"].forEach(function (ap) {
        const b = el(doc, "button", "dt-opt", ap);
        b.type = "button";
        on(b, "click", function () { curAp = ap; pickedAp = true; commit(); });
        apBtns.push([ap, b]);
        apCol.appendChild(b);
      });
      wheel.appendChild(hCol);
      wheel.appendChild(mCol);
      wheel.appendChild(apCol);
      drawer.appendChild(wheel);
      const doneBtn = el(doc, "button", "dt-done", "Done");
      doneBtn.type = "button";
      on(doneBtn, "click", closeDrawer);
      drawer.appendChild(doneBtn);
      sync();
      input._syncDt = sync;
      on(btn, "click", function () {
        const open = drawer.style.display !== "none";
        closeSiblingDrawers(drawerHost, drawer);
        if (!open) { pickedH = false; pickedM = false; pickedAp = false; }
        drawer.style.display = open ? "none" : "block";
        btn.className = "dt-pill" + (open ? "" : " open") + (invalid ? " input-invalid" : "");
      });
      host.appendChild(btn);
      (drawerHost || host).appendChild(drawer);
    }

    function buildSeatPills(doc, host, name, maxPick, initialVal, minPick) {
      const hidden = el(doc, "input");
      hidden.type = "hidden";
      hidden.name = name;
      const floor = minPick != null ? Math.max(0, Number(minPick)) : 1;
      const start = floor === 0 ? 0 : 1;
      let picked = initialVal != null && initialVal !== "" ? Number(initialVal) : floor;
      if (!Number.isFinite(picked) || picked < floor || picked > maxPick) picked = floor;
      hidden.value = String(picked);
      const wrap = el(doc, "div", "seat-pills");
      wrap.style.gridTemplateColumns = "repeat(" + Math.max(1, maxPick - start + 1) + ",minmax(0,1fr))";
      const btns = [];
      for (let n = start; n <= maxPick; n++) {
        const b = el(doc, "button", "seat-pill" + (n === picked ? " active" : ""), String(n));
        b.type = "button";
        b.setAttribute("aria-label", n === 1 ? "1 seat" : n + " seats");
        on(b, "click", function () {
          picked = n;
          hidden.value = String(n);
          btns.forEach(function (btn, idx) { btn.className = "seat-pill" + (start + idx === n ? " active" : ""); });
        });
        btns.push(b);
        wrap.appendChild(b);
      }
      host.appendChild(hidden);
      host.appendChild(wrap);
      return hidden;
    }

    function roundUp30(ms) {
      return Math.ceil(ms / (30 * 60000)) * 30 * 60000;
    }

    function startReturnTrip(ride) {
      const r = ride || {};
      const zone = (win.Intl && win.Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
      const baseMs = Math.max(Date.now() + 60 * 60000, (Number(r.departAt) || Date.now()) + 4 * 60 * 60000);
      const p = core.partsInZone(roundUp30(baseMs), zone);
      const kept = state.rides || [];
      const saved = loadProfile();
      const draft = {
        name: r.driverName || saved.name || "",
        phone: saved.phone || "",
        from: r.to || "",
        to: r.from || "",
        date: p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0"),
        time: String(p.hour).padStart(2, "0") + ":" + String(p.minute).padStart(2, "0"),
        seats: String(r.seatsTotal || r.seatsLeft || 3),
        durationMinutes: Number(r.durationMinutes) || 30,
        rideCost: r.rideCost ? String(r.rideCost) : "",
        note: r.note || ""
      };
      if (state.mode === "ride" && state.role === "driver" && r.rideId) {
        state = ui.reduce(state, { type: "driver-sheet", which: "return" });
      } else {
        state = ui.reduce(state, { type: "post" });
      }
      state.rides = kept;
      state.draft = draft;
      draw();
    }

    function shortTripId(id) {
      const s = String(id || "").replace(/^ride_/, "");
      return s ? "#" + s.slice(-6).toUpperCase() : "";
    }

    function keepFocusedVisible(target) {
      if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && target.tagName !== "SELECT") || !target.scrollIntoView) return;
      if (typeof target.getBoundingClientRect === "function") {
        const rect = target.getBoundingClientRect();
        const vh = (win.visualViewport && win.visualViewport.height) || win.innerHeight || 0;
        if (vh && rect.top >= 64 && rect.bottom <= vh - 16) return;
        target.scrollIntoView({ behavior: "auto", block: "nearest" });
        return;
      }
      target.scrollIntoView({ behavior: "auto", block: "nearest" });
    }

    on(win, "resize", function () { applyShell(win, rootNode, state.mode); });
    if (win.visualViewport) on(win.visualViewport, "resize", function () { applyShell(win, rootNode, state.mode); keepFocusedVisible(doc.activeElement); });
    if (win.visualViewport) on(win.visualViewport, "scroll", function () { applyShell(win, rootNode, state.mode); });
    let ptrY = 0;
    let ptrPull = 0;
    on(rootNode, "touchstart", function (e) {
      const topY = win.scrollY || (doc.documentElement && doc.documentElement.scrollTop) || 0;
      const modalOpen = !!(state.sheet || state.waitlistOpen || state.claimOpen || state.editOpen || state.driverSheet || memberModal || installModal || infoView);
      ptrY = state.mode === "board" && topY <= 0 && !modalOpen && e && e.touches && e.touches[0] ? e.touches[0].clientY : 0;
      ptrPull = 0;
    });
    on(rootNode, "touchmove", function (e) {
      if (!ptrY || !e || !e.touches || !e.touches[0]) return;
      const dy = e.touches[0].clientY - ptrY;
      ptrPull = dy > 0 ? Math.min(dy * 0.45, 52) : 0;
      const ptrEl = rootNode.querySelector ? rootNode.querySelector("#jumpin-ptr") : null;
      if (ptrEl) {
        ptrEl.style.height = Math.round(ptrPull) + "px";
        ptrEl.style.opacity = ptrPull > 10 ? "1" : "0";
        ptrEl.textContent = ptrPull >= 36 ? "↻ Release to refresh" : (ptrPull > 0 ? "↓ Pull to refresh" : "");
      }
    });
    on(rootNode, "touchend", function () {
      if (!ptrY) return;
      const shouldRefresh = ptrPull >= 36;
      ptrY = 0;
      ptrPull = 0;
      const ptrEl = rootNode.querySelector ? rootNode.querySelector("#jumpin-ptr") : null;
      if (ptrEl) { ptrEl.style.height = "0"; ptrEl.style.opacity = "0"; ptrEl.textContent = ""; }
      if (shouldRefresh) { draw(); showToast("Rides up to date"); }
    });
    draw();
    connectCloud();
    return { getState: function () { return state; }, setState: function (next) { state = next; draw(); }, root: rootNode };
  }

  function brandBar(doc, top, meta, onInstall, onInfo) {
    const gid = meta && meta.groupId && meta.groupId !== "default" ? meta.groupId : "";
    const homeHref = "https://waitlink.app/jumpin" + (gid ? "?g=" + encodeURIComponent(gid) : "");
    const bar = el(doc, "div", "bar");
    const link = el(doc, "a", "brand");
    link.href = homeHref;
    const mark = el(doc, "span", "mark");
    const markImg = doc.createElement("img");
    markImg.src = "/assets/jumpin-icon-192.png?v=2";
    markImg.alt = "JumpIn";
    markImg.style.width = "100%";
    markImg.style.height = "100%";
    markImg.style.borderRadius = "inherit";
    markImg.style.display = "block";
    mark.appendChild(markImg);
    link.appendChild(mark);
    link.appendChild(el(doc, "span", "", "JumpIn"));
    const nav = el(doc, "nav");
    if (onInstall) {
      const instBtn = el(doc, "button", "jumpin-nav-install", "📲 Add to Home");
      instBtn.type = "button";
      on(instBtn, "click", onInstall);
      nav.appendChild(instBtn);
    }
    const rides = el(doc, "a", "", "Rides");
    rides.href = homeHref;
    nav.appendChild(rides);
    const startGroup = el(doc, "a", "", "Start a Group");
    startGroup.href = "/jumpin-admin.html?tab=groups";
    nav.appendChild(startGroup);
    if (onInfo) {
      const infoBtn = el(doc, "button", "jumpin-nav-info", "?");
      infoBtn.type = "button";
      infoBtn.setAttribute("aria-label", "App info");
      on(infoBtn, "click", onInfo);
      nav.appendChild(infoBtn);
    }
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
    const credit = el(doc, "span", "");
    credit.appendChild(doc.createTextNode("JumpIn by "));
    const wl = el(doc, "a", "", "WaitLink");
    wl.href = "https://waitlink.app";
    credit.appendChild(wl);
    foot.appendChild(credit);
    [["FAQ", "/jumpin-faq.html"], ["Privacy", "/jumpin-privacy.html"], ["Terms", "/jumpin-terms.html"], ["Contact", "/jumpin-contact.html"]].forEach(function (item) {
      const link = el(doc, "a", "", item[0]);
      link.href = item[1];
      foot.appendChild(link);
    });
    foot.appendChild(el(doc, "span", "spacer", "© 2026 WaitLink"));
    if (supportNote) {
      foot.appendChild(el(doc, "span", "support-foot", "Free community tool — chip in $1–$2 via " + supportNote + " to help cover text costs."));
    }
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
