const fs = require('fs');
let err = fs.readFileSync('err2.txt', 'utf8');
// Strip ANSI codes
err = err.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
const lines = err.split('\n');
const relevant = lines.filter(l => l.includes('.jsx') || l.includes('Error') || l.includes('error'));
console.log(relevant.join('\n'));
