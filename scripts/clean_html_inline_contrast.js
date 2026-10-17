const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace color: #fff or #ffffff with color: var(--text-main) on headings h1-h6
html = html.replace(/<(h[1-6])([^>]*?)color:\s*#(?:fff|ffffff);?([^>]*?)>/gi, (match, tag, before, after) => {
  return `<${tag}${before}color: var(--text-main);${after}>`;
});

// Specific remaining lines
html = html.replace('style="font-weight: 700; color: #fff; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.45rem;"', 'style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.45rem;"');
html = html.replace('style="font-weight: 700; color: #fff; font-size: 1rem; margin: 0;"', 'style="font-weight: 700; color: var(--text-main); font-size: 1rem; margin: 0;"');
html = html.replace('font-size: 1rem; color: #fff;">WaitLink</span>', 'font-size: 1rem; color: var(--text-main);">WaitLink</span>');
html = html.replace('style="font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem;"', 'style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem;"');
html = html.replace('style="font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.65rem;"', 'style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.65rem;"');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully completed full HTML inline contrast cleanup!');
