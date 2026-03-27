const fs = await import('fs');
const path = await import('path');

const src = path.join(import.meta.dirname, '..', 'src', 'weread');
const dist = path.join(import.meta.dirname, '..', 'dist', 'weread');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

// Copy YAML files if any
const yamlFiles = fs.readdirSync(src).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
for (const file of yamlFiles) {
  fs.copyFileSync(path.join(src, file), path.join(dist, file));
  console.log(`Copied ${file}`);
}

console.log('Assets copied');
