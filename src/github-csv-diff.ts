import daff from 'daff';
import * as CSV from 'csv-string';

import { last } from './util';

interface HeaderChunk {
  title: string;
}

interface SubHeaderChunk {
  description: string;
}

interface DiffChunk {
  old: string[][];
  new: string[][];
}

interface NonTargetChunk {
  texts: string[][];
}

type Chunk = HeaderChunk | SubHeaderChunk | DiffChunk | NonTargetChunk;

function isDiff(chunk: any): chunk is DiffChunk {
  return chunk.old !== undefined && chunk.new !== undefined;
}

function isNonTarget(chunk: any): chunk is NonTargetChunk {
  return chunk.texts !== undefined;
}

function isHeader(chunk: any): chunk is HeaderChunk {
  return chunk.title !== undefined;
}

function isSubHeader(chunk: any): chunk is SubHeaderChunk {
  return chunk.description !== undefined;
}

function addDiff(chunk: Chunk, line: string[], target: 'old' | 'new' | 'both') {
  if (isDiff(chunk)) {
    if (target === 'old') {
      chunk.old.push(line);
    } else if (target === 'new') {
      chunk.new.push(line);
    } else if (target === 'both') {
      chunk.old.push(line);
      chunk.new.push(line);
    }
  }
}

function buildDiffHtml(chunk: DiffChunk) {
  const oldTable = new daff.TableView(chunk.old);
  const newTable = new daff.TableView(chunk.new);
  const alignment = daff.compareTables(oldTable, newTable).align();
  const dataDiff: never[] = [];
  const tableDiff = new daff.TableView(dataDiff);
  const flags = new daff.CompareFlags();
  flags.always_show_header = false;
  const highlighter = new daff.TableDiff(alignment, flags);
  highlighter.hilite(tableDiff);
  const diff2html = new daff.DiffRender();
  diff2html.render(tableDiff);
  return diff2html.html();
}

const chunks: Array<Chunk> = [];
let isCsv = false;

const pre = document.querySelector('pre')!;
const rawDiff = pre.innerText;
pre.innerHTML = '';

CSV.forEach(rawDiff, ',', (line: string[]) => {
  const [head, ...rest] = line;
  if (!!head && head.match(/^diff\s--git\s.+?.csv\s.+?.csv$/)) {
    isCsv = true;
    chunks.push({ title: '📁 ' + head });
    return;
  } else if (!!head && head.match(/^diff\s--git/)) {
    isCsv = false;
    chunks.push({ texts: [line] });
    return;
  }

  if (!isCsv) {
    const lastData = last(chunks);
    if (isNonTarget(lastData)) lastData.texts.push(line);
    return;
  }

  if (head.startsWith('@@')) {
    const m = CSV.stringify(line).match(/^(@@.+)@@/);
    if (m) chunks.push({ description: m[1] });
    chunks.push({ old: [], new: [] });
    return;
  }

  switch (true) {
    case head.startsWith('+++'):
    case head.startsWith('---'):
      return;
    case head.indexOf('+') === 0:
      return addDiff(last(chunks), [head.replace('+', ' '), ...rest], 'new');
    case head.indexOf('-') === 0:
      return addDiff(last(chunks), [head.replace('-', ' '), ...rest], 'old');
    case head.indexOf(' ') === 0:
      return addDiff(last(chunks), line, 'both');
    default:
      return;
  }
});

// Create a container and add nodes for the chunks before appending it to pre
// https://www.youtube.com/watch?v=Fv9qT9joc0M&list=PL7664379246A246CB#t=4019
const container = document.createElement('div');

for (const chunk of chunks) {
  if (isNonTarget(chunk)) {
    console.log('chunk.texts: ', chunk.texts);
    container.appendChild(document.createTextNode(chunk.texts.join('\n')));
  } else if (isHeader(chunk)) {
    const header = document.createElement('h3');
    header.innerText = chunk.title;
    container.appendChild(header);
  } else if (isSubHeader(chunk)) {
    const subHeader = document.createElement('h4');
    subHeader.innerText = chunk.description;
    container.appendChild(subHeader);
  } else if (isDiff(chunk)) {
    const diffHtml = buildDiffHtml(chunk);
    const div = document.createElement('div');
    div.innerHTML = diffHtml;
    container.appendChild(div);
  }
}

pre.appendChild(container);
