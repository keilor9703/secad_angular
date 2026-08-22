// Elimina recursivamente las carpetas "tests" dentro de node_modules/zod.
// Reemplaza el postinstall anterior (basado en PowerShell), que solo
// funcionaba en Windows y hacía fallar `npm ci` en Linux/macOS (incluida
// la CI de GitHub Actions, que corre en ubuntu-latest).
const fs = require('fs');
const path = require('path');

function removeTestDirs(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === 'tests') {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      removeTestDirs(fullPath);
    }
  }
}

removeTestDirs(path.join(__dirname, '..', 'node_modules', 'zod'));
