const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('rgba(15, 23, 42') || line.includes('rgba(30, 41, 59') || line.includes('rgba(0, 0, 0, 0.3') || line.includes('rgba(0, 0, 0, 0.4') || line.includes('rgba(0, 0, 0, 0.5)')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
