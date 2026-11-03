const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'docs', 'contracts_and_specs');
const files = fs.readdirSync(dir);
console.log('Validating files in:', dir);

let hasErrors = false;

// 1. Check all HTML files
const htmlFiles = files.filter(f => f.endsWith('.html'));
console.log('HTML files found:', htmlFiles.length);

for (const f of htmlFiles) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  
  if (!content.includes('<!DOCTYPE html>')) {
    console.error(f, ': Missing DOCTYPE');
    hasErrors = true;
  }
  if (!content.includes('</html>')) {
    console.error(f, ': Missing </html>');
    hasErrors = true;
  }
  
  // check internal links
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    const link = match[1];
    if (link.startsWith('#') || link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:')) continue;
    const targetFile = link.split('#')[0];
    if (targetFile && !fs.existsSync(path.join(dir, targetFile))) {
      console.error(f, ': Broken link to', targetFile);
      hasErrors = true;
    }
  }

  // check script and link css src
  const srcRegex = /src=["']([^"']+)["']/g;
  while ((match = srcRegex.exec(content)) !== null) {
    const src = match[1];
    if (src.startsWith('http')) continue;
    if (!fs.existsSync(path.join(dir, src))) {
      console.error(f, ': Missing script source', src);
      hasErrors = true;
    }
  }
}

// 2. Check for leftover old price strings
const oldPriceRegexes = [
  { name: '80,000', regex: /80,?000/ },
  { name: '60,000 / 60k', regex: /₹\s*60,?000|60k/i },
  { name: '15,000 / 15k', regex: /₹\s*15,?000|15k/i },
  { name: '75,000 / 75k', regex: /75,?000|75k/i }
];

for (const f of files) {
  if (!f.endsWith('.html') && !f.endsWith('.md') && !f.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const p of oldPriceRegexes) {
    if (p.regex.test(content)) {
      console.warn(f, ': Found old price match', p.name);
      hasErrors = true;
    }
  }
}

if (!hasErrors) {
  console.log('SUCCESS: All files, links, scripts, and price checks passed cleanly!');
} else {
  console.log('Completed with warnings/errors.');
}
