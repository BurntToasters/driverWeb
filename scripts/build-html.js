const fs = require('fs');
const path = require('path');
const nunjucks = require('nunjucks');

const rootDir = path.resolve(__dirname, '..');
const templatesDir = path.join(rootDir, 'templates');

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(templatesDir, { noCache: true }),
  { autoescape: false }
);

const pages = [
  { template: 'pages/index.njk', output: 'index.html' },
  { template: 'pages/chipset.njk', output: 'chipset.html' },
  { template: 'pages/contact.njk', output: 'contact.html' },
  { template: 'pages/audio.njk', output: 'audio.html' },
  { template: 'pages/network.njk', output: 'network.html' },
  { template: 'pages/404.njk', output: '404.html' },
  { template: 'pages/display/index.njk', output: 'display/index.html' },
  { template: 'pages/display/laptop.njk', output: 'display/laptop.html' },
  { template: 'pages/display/warn.njk', output: 'display/warn.html' },
  { template: 'pages/info/about-stabledrivers.njk', output: 'info/about-stabledrivers.html' }
];

for (const page of pages) {
  const rendered = env.render(page.template, {});
  const outputPath = path.join(rootDir, page.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered);
  process.stdout.write(`Rendered ${page.output}\n`);
}
