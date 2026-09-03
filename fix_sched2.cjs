const fs = require('fs');
let code = fs.readFileSync('src/pages/Schedule.jsx', 'utf8');
code = code.replace("notes: \\Invoice for \\ job.\\", "notes: `Invoice for ${jobData.job_type} job.`");
fs.writeFileSync('src/pages/Schedule.jsx', code);
console.log('Fixed Schedule.jsx completely');
