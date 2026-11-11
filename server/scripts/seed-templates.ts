import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../../templates');
fs.mkdirSync(dir, { recursive: true });

async function writeTemplate(filename: string, title: string, blurb: string) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: '{{Full Name}}', bold: true, size: 32 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: '{{Role}}', italics: true, size: 22 })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '{{Location}}' }),
              new TextRun({ text: ' • ' }),
              new TextRun({ text: '{{Phone}}' }),
              new TextRun({ text: ' • ' }),
              new TextRun({ text: '{{Email}}' }),
              new TextRun({ text: ' • ' }),
              new TextRun({ text: '{{LinkedIn}}' }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '{{Summary}}' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '{{Skill Set}}' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Experience', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new TextRun({ text: '{{Company Role}}', bold: true }),
              new TextRun({ text: ' - ' }),
              new TextRun({ text: '{{Company Name}}' }),
              new TextRun({ text: '\t' }),
              new TextRun({ text: '{{Work Period}}', bold: true }),
            ],
          }),
          new Paragraph({ text: '{{Company Bullet}}' }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new TextRun({ text: '{{University}}', bold: true }),
              new TextRun({ text: '\t' }),
              new TextRun({ text: '{{University Location}}', bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '{{Degree}}', italics: true }),
              new TextRun({ text: '\t' }),
              new TextRun({ text: '{{Education Period}}', bold: true }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Certification', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: '{{Certification}}' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: `${title}: ${blurb}`, italics: true, size: 16 })],
          }),
        ],
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(dir, filename), buf);
  console.log('Wrote', path.join(dir, filename));
}

await writeTemplate(
  'Classic.docx',
  'Classic Resume Template',
  'Clean single-column layout for general roles.'
);
await writeTemplate(
  'Modern.docx',
  'Modern Resume Template',
  'Contemporary spacing for product and engineering roles.'
);
await writeTemplate(
  'Compact.docx',
  'Compact Resume Template',
  'Denser layout when space is limited.'
);
