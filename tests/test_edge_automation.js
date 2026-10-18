// tests/test_edge_automation.js
// Automated Microsoft Edge Browser Testing for WaitLink (https://waitlink.app/)
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TARGET_URL = process.argv[2] || "https://waitlink.app/";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHttp(url, maxAttempts = 35, interval = 250) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      // wait
    }
    await sleep(interval);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class EdgeCDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.exceptions = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id && this.pending.has(data.id)) {
            const { resolve, reject } = this.pending.get(data.id);
            this.pending.delete(data.id);
            if (data.error) reject(data.error);
            else resolve(data.result);
          } else if (data.method === 'Runtime.consoleAPICalled') {
            const text = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
            this.consoleLogs.push(`[Console ${data.params.type}] ${text}`);
          } else if (data.method === 'Runtime.exceptionThrown') {
            const ex = data.params.exceptionDetails;
            this.exceptions.push(`[Uncaught ${ex.exception?.className || 'Exception'}] ${ex.text} ${ex.exception?.description || ''} at line ${ex.lineNumber}:${ex.columnNumber}`);
          }
        } catch (e) {
          console.error("CDP parse error:", e);
        }
      };
    });
  }

  async send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runEdgeTest({ mode = 'standard', url = TARGET_URL, port = 9222 }) {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Microsoft Edge Test [Mode: ${mode.toUpperCase()}]`);
  console.log(`Target URL: ${url}`);
  console.log(`Edge Binary: ${EDGE_PATH}`);
  console.log(`======================================================`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `edge-test-${mode}-`));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    '--headless=new',
    '--window-size=1280,800',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
  ];

  if (mode === 'inprivate') {
    args.push('-inprivate');
  }

  args.push(url);

  const edgeProcess = spawn(EDGE_PATH, args, { stdio: 'ignore' });

  let cdpClient = null;
  const testResults = {
    mode,
    url,
    success: false,
    details: {},
    consoleLogs: [],
    exceptions: [],
  };

  try {
    const versionData = await waitForHttp(`http://127.0.0.1:${port}/json/version`, 40, 250);
    console.log(`✓ Edge remote debugging connected! Browser: ${versionData.Browser}`);

    // Wait for pages
    let targetPage = null;
    for (let i = 0; i < 30; i++) {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      targetPage = targets.find(t => t.type === 'page' && t.url.includes('waitlink'));
      if (!targetPage) {
        targetPage = targets.find(t => t.type === 'page' && t.url !== 'about:blank');
      }
      if (targetPage && targetPage.webSocketDebuggerUrl) break;
      await sleep(300);
    }

    if (!targetPage) {
      const newTarget = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`)).json();
      targetPage = newTarget;
    }

    console.log(`✓ Found page target: ${targetPage.url} (ID: ${targetPage.id})`);

    cdpClient = new EdgeCDPClient(targetPage.webSocketDebuggerUrl);
    await cdpClient.connect();
    console.log(`✓ WebSocket CDP attached to Edge.`);

    await cdpClient.send('Page.enable');
    await cdpClient.send('Runtime.enable');
    await cdpClient.send('Log.enable');

    console.log(`⏳ Waiting 3.5s for page hydration and script execution...`);
    await sleep(3500);

    // 1. Page Title & Heading
    const pageTitle = await cdpClient.evaluate(`document.title`);
    const h1Text = await cdpClient.evaluate(`document.querySelector('h1')?.innerText?.trim()`);
    console.log(`✓ Page Title: "${pageTitle}"`);
    console.log(`✓ Main Heading (H1): "${h1Text}"`);

    // 2. JavaScript Runtime Health
    const stateType = await cdpClient.evaluate(`typeof window.state`);
    const safeStorageType = await cdpClient.evaluate(`typeof window.SafeStorage`);
    const deskViewMode = await cdpClient.evaluate(`window.state ? window.state.deskViewMode : 'N/A'`);
    const activeView = await cdpClient.evaluate(`window.state ? window.state.activeView : 'N/A'`);
    console.log(`✓ window.state type: ${stateType}`);
    console.log(`✓ window.SafeStorage type: ${safeStorageType}`);
    console.log(`✓ window.state.deskViewMode: ${deskViewMode}`);
    console.log(`✓ window.state.activeView: ${activeView}`);

    console.log(`\n--- Testing Edge Interactivity Actions [${mode.toUpperCase()}] ---`);

    // 3. Test Theme Toggle Button (#theme-toggle-btn)
    const themeBefore = await cdpClient.evaluate(`document.body.classList.contains('light-theme') ? 'light' : 'dark'`);
    const themeResult = await cdpClient.evaluate(`(() => {
      try {
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
          btn.click();
          const themeAfter = document.body.classList.contains('light-theme') ? 'light' : 'dark';
          return { clicked: true, themeBefore: '${themeBefore}', themeAfter, btnLabel: btn.innerText?.trim() };
        }
        return { notFound: true };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log(`✓ Theme Toggle Test:`, JSON.stringify(themeResult));

    // 4. Test Sign In Button Click & Modal Opening (#auth-btn)
    const authModalResult = await cdpClient.evaluate(`(() => {
      try {
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
          authBtn.click();
          const modal = document.getElementById('auth-modal');
          const isVisible = modal && !modal.classList.contains('hidden');
          const title = document.getElementById('auth-modal-title')?.innerText?.trim();
          // Close modal
          if (modal) modal.classList.add('hidden');
          return { clicked: true, modalOpened: isVisible, title };
        }
        return { notFound: true };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log(`✓ Sign In (#auth-btn) Test:`, JSON.stringify(authModalResult));

    // 5. Test "+ Create Shop" Button Click & Register Flow (#header-create-shop-btn)
    const createShopResult = await cdpClient.evaluate(`(() => {
      try {
        const btn = document.getElementById('header-create-shop-btn') || document.querySelector('[onclick*="openCreateShopModal"]');
        if (btn) {
          btn.click();
          const modal = document.getElementById('auth-modal');
          const isVisible = modal && !modal.classList.contains('hidden');
          const title = document.getElementById('auth-modal-title')?.innerText?.trim();
          // Close modal
          if (modal) modal.classList.add('hidden');
          return { clicked: true, modalOpened: isVisible, title };
        }
        return { notFound: true };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log(`✓ Create Shop (#header-create-shop-btn) Test:`, JSON.stringify(createShopResult));

    // 6. Test Live Demo Sandbox Card Click (.hero-card-demo)
    const demoLaunchResult = await cdpClient.evaluate(`(() => {
      try {
        const demoCard = document.querySelector('.hero-card-demo');
        if (demoCard) {
          demoCard.click();
          const activeViewNow = window.state ? window.state.activeView : null;
          const deskVisible = document.getElementById('view-desk') && !document.getElementById('view-desk').classList.contains('hidden');
          return { clicked: true, activeViewNow, deskVisible };
        }
        return { notFound: true };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log(`✓ Live Demo Sandbox (.hero-card-demo) Test:`, JSON.stringify(demoLaunchResult));

    // 7. Test Navigation & View Switching back to Landing (switchView('landing'))
    const switchBackResult = await cdpClient.evaluate(`(() => {
      try {
        if (typeof window.switchView === 'function') {
          window.switchView('landing');
          const landingVisible = document.getElementById('view-landing') && !document.getElementById('view-landing').classList.contains('hidden');
          return { switched: true, landingVisible, activeViewNow: window.state?.activeView };
        }
        return { notFound: true };
      } catch (e) {
        return { error: e.message };
      }
    })()`);
    console.log(`✓ Switch View to Landing Test:`, JSON.stringify(switchBackResult));

    // 8. Test Footer Links Integrity
    const footerLinksAudit = await cdpClient.evaluate(`(() => {
      const footerLinks = Array.from(document.querySelectorAll('footer a, .site-footer a')).map(a => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href')
      }));
      return { totalFooterLinks: footerLinks.length, links: footerLinks };
    })()`);
    console.log(`✓ Footer Links Count: ${footerLinksAudit.totalFooterLinks}`);

    // Capture Screenshot
    const screenshot = await cdpClient.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(__dirname, `edge_screenshot_${mode}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`✓ Screenshot captured and saved to: ${screenshotPath}`);

    testResults.success = true;
    testResults.details = {
      browser: versionData.Browser,
      pageTitle,
      h1Text,
      stateType,
      safeStorageType,
      deskViewMode,
      themeResult,
      authModalResult,
      createShopResult,
      demoLaunchResult,
      switchBackResult,
      footerLinksCount: footerLinksAudit.totalFooterLinks,
      screenshotPath
    };
    testResults.consoleLogs = cdpClient.consoleLogs;
    testResults.exceptions = cdpClient.exceptions;

  } catch (err) {
    console.error(`❌ Edge test failed:`, err);
    testResults.success = false;
    testResults.error = err.message;
  } finally {
    if (cdpClient) cdpClient.close();
    try {
      edgeProcess.kill();
    } catch (e) {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log(`\n--- Edge [${mode.toUpperCase()}] Console Logs & Exceptions ---`);
  console.log(`Exceptions caught: ${testResults.exceptions.length}`);
  testResults.exceptions.forEach(e => console.log(`  🚨 ${e}`));
  console.log(`Console logs captured: ${testResults.consoleLogs.length}`);
  testResults.consoleLogs.slice(0, 10).forEach(l => console.log(`  📝 ${l}`));

  return testResults;
}

async function main() {
  console.log("================================================================================");
  console.log("   WaitLink — Live Microsoft Edge Browser Interactivity & Compatibility Test   ");
  console.log("================================================================================");

  // 1. Run Standard Edge Mode Test
  const standardResults = await runEdgeTest({ mode: 'standard', port: 9222 });

  await sleep(1500);

  // 2. Run InPrivate Edge Mode Test
  const inprivateResults = await runEdgeTest({ mode: 'inprivate', port: 9223 });

  console.log("\n================================================================================");
  console.log("                            FINAL EDGE TEST SUMMARY                             ");
  console.log("================================================================================");
  console.log(`Edge Standard Mode:     ${standardResults.success ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Edge InPrivate Mode:    ${inprivateResults.success ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Standard Exceptions:    ${standardResults.exceptions.length}`);
  console.log(`InPrivate Exceptions:   ${inprivateResults.exceptions.length}`);

  process.exit(standardResults.success && inprivateResults.success ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
