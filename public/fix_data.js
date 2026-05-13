const fs = require('fs');

// Read the original data.js to get the other profiles
// Since data.js has `window.PROFILES = [...]`, we can require it by mocking `window`
const script = fs.readFileSync('data.js', 'utf8');
const sandbox = { window: {} };
require('vm').runInNewContext(script, sandbox);
const oldProfiles = sandbox.window.PROFILES;

// Read the new sample.jsonl
const sampleProfile = JSON.parse(fs.readFileSync('uploads/sample.jsonl', 'utf8'));

// We replace the first profile with the sample
oldProfiles[0] = sampleProfile;

// Create the JSONL string
const jsonlLines = oldProfiles.map(p => JSON.stringify(p));
const rawDataString = jsonlLines.join('\\n');

// Write the new data.js
const newDataJs = `// Data loaded as an inline JSONL string to match the prompt's structural requirement.
const rawData = \`${rawDataString}\`;

window.PROFILES = rawData.trim().split('\\n').map(line => JSON.parse(line));
`;

fs.writeFileSync('data.js', newDataJs, 'utf8');
console.log("Fixed data.js");
