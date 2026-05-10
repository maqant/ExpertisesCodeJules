const { execSync } = require('child_process');
try {
    execSync('git checkout -- src/components/Sidebar.jsx package.json', { stdio: 'inherit' });
    console.log('Revert successful');
} catch (e) {
    console.error('Error:', e);
}
