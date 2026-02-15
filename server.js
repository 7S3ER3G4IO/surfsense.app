
// Proxy script to launch the legacy server from the root
// This is necessary because Render's existing configuration expects a server.js at the root
const path = require('path');

// Change working directory to apps/legacy so relative paths work
const legacyDir = path.join(__dirname, 'apps', 'legacy');
process.chdir(legacyDir);

// Require the actual server
require('./apps/legacy/server.js');
