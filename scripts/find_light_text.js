const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

const lightColors = ['#a5b4fc', '#c7d2fe', '#bae6fd', '#cbd5e1', '#e2e8f0', '#60a5fa', '#38bdf8', '#06b6d4', '#fbbf24', '#34d399', '#a7f3d0', '#fde68a', '#6ee7b7', '#a78bfa', '#94a3b8'];

let count = 0;
lines.forEach((line, idx) => {
  for (const c of lightColors) {
    if (line.toLowerCase().includes(`color: ${c}`) || line.toLowerCase().includes(`color:${c}`)) {
      count++;
      if (count <= 25) {
        console.log(`L${idx+1} [${c}]: ${line.trim().substring(0, 100)}...`);
      }
      break;
    }
  }
});
console.log('Total lines with light text colors:', count);
