const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join('c:\\Users\\MaquetAntoine\\OneDrive - Bureau Yves Péchard s.a\\Documents\\expertisescodejules\\src\\features\\print\\pdf\\fonts\\Arimo');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = [
  'Arimo-Regular.ttf',
  'Arimo-Bold.ttf',
  'Arimo-Italic.ttf',
  'Arimo-BoldItalic.ttf'
];

const baseUrl = 'https://raw.githubusercontent.com/googlefonts/arimo/main/fonts/ttf/';

const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        fs.unlink(dest, () => reject(new Error(`Failed to download ${url}: ${response.statusCode}`)));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

Promise.all(fonts.map(font => {
  console.log(`Downloading ${font}...`);
  return download(baseUrl + font, path.join(fontsDir, font));
})).then(() => {
  console.log('All fonts downloaded successfully!');
}).catch(err => {
  console.error('Error downloading fonts:', err);
});
