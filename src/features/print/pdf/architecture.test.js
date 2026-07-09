import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Utilisation d'un chemin relatif pour cibler le dossier des features PDF
const pdfDir = path.resolve(__dirname, '.');

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

describe('Garde-fous Architecture PDF', () => {
  it('ne doit contenir aucune primitive Web ou Context interdit', () => {
    const files = getFilesRecursively(pdfDir);
    const forbiddenPatterns = [
      { regex: /useContext\(/, desc: 'useContext API React' },
      { regex: /createContext\(/, desc: 'createContext API React' },
      { regex: /PDFDownloadLink/, desc: 'PDFDownloadLink non supporté' },
      { regex: /window\.print\(/, desc: 'Impression DOM native' },
      { regex: /html2canvas/, desc: 'Rendu par canvas' },
      { regex: /jspdf/, desc: 'Librairie concurrente jsPDF' },
      { regex: /document\.querySelector/, desc: 'Accès au DOM interdit' },
      { regex: /from ['"]\.\.\/web\//, desc: 'Couplage avec le Web' }
    ];

    files.forEach(file => {
      // Ignorer les fichiers de test
      if (file.includes('.test.')) return;
      
      const content = fs.readFileSync(file, 'utf-8');
      forbiddenPatterns.forEach(({ regex, desc }) => {
        if (regex.test(content)) {
          throw new Error(`VIOLATION ARCHITECTURE: Le fichier ${file} contient le motif interdit (${desc}).`);
        }
      });
    });
    
    expect(true).toBe(true);
  });
});
