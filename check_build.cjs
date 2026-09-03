const { execSync } = require('child_process');
try {
  execSync('npm run build', { stdio: 'pipe', encoding: 'utf8' });
  console.log("Success");
} catch(e) {
  console.log(e.stdout || e.stderr || e.message);
}
