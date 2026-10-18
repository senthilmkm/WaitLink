const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const bgMatches = [...html.matchAll(/style="([^"]*background[^"]*)"/gi)];
console.log('Total inline style with background:', bgMatches.length);

const bgFound = new Set();
bgMatches.forEach(m => {
  const c = m[1].match(/background(-color)?:\s*([^;]+)/i);
  if (c) bgFound.add(c[2].trim());
});
console.log('Backgrounds used inline:', Array.from(bgFound));
