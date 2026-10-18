const fs = require('fs');
const app = fs.readFileSync('app.js', 'utf8');
const lines = app.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('openAuthModal') || line.includes('setAuthMode')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
