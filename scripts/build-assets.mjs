// Build the plugin's bundled style assets from the vendored prompt pack.
//
//   node scripts/build-assets.mjs            # regenerate assets/ from the pack
//   node scripts/build-assets.mjs --check    # verify assets/ is current (no writes)
//
// Output is deterministic: no timestamps, stable ordering, sorted JSON input for
// hashing. Re-running on the same pack must produce byte-identical `index.json`.
//
// Input : code-animation-341-styles-main/ (vendored, third-party pack)
// Output: assets/index.json, assets/styles/*.md, assets/stills/*.jpg,
//         assets/shared/_公共函数.js, assets/LICENSES/**, assets/SOURCES.md
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'code-animation-341-styles-main');
const PROMPTS = path.join(SRC, '风格提示词');
const OUT = path.join(ROOT, 'assets');
const CHECK = process.argv.includes('--check');

const SERIES_ORDER = ['AG', 'M', 'K', 'Z', 'H', 'L', 'V', 'X', 'R', 'O'];
const MIT_PREFIXES = new Set(['L', 'V', 'X']);

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rel = (p) => p.split(path.sep).join('/');

function seriesKeyOf(dirName) {
  // 'A-G_代码样片' -> 'AG'; 'L_Lemo-Opuscar' -> 'L'
  const head = dirName.split('_')[0];
  return head.replace(/[^A-Z]/g, '');
}

function parseMd(text) {
  const h1 = text.match(/^#\s+(.+)$/m);
  const meta = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^-\s*(分类|长什么样|适合|关键词)\s*[：:]\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  const payloadMatch = text.match(/^##\s*风格提示词\s*\r?\n([\s\S]*?)(?=\r?\n##\s|$)/m);
  const payload = payloadMatch ? payloadMatch[1].trim() : '';
  const hasNumberedSections = /^##\s+\d+\.\s/m.test(text);
  const hasReference = /S\.[A-Z]\d+\s*=\s*\(/.test(text);
  const kind = payload.length <= 5
    ? 'empty'
    : hasReference
      ? 'code-sample'
      : hasNumberedSections
        ? 'spec'
        : 'short';
  return { h1: h1 ? h1[1].trim() : '', meta, payload, kind };
}

function main() {
  if (!fs.existsSync(PROMPTS)) {
    console.error(`missing prompt pack: ${PROMPTS}`);
    process.exit(1);
  }

  const seriesDirs = fs.readdirSync(PROMPTS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => {
      const order = (n) => {
        const i = SERIES_ORDER.indexOf(seriesKeyOf(n));
        return i < 0 ? SERIES_ORDER.length : i;
      };
      return order(a) - order(b) || a.localeCompare(b);
    });

  const styles = [];
  const counts = { styles: 0, stills: 0, emptyPayload: 0, withReferenceImpl: 0, codeSample: 0, spec: 0, short: 0, mit: 0, freeShareNoSell: 0 };
  const idSeen = new Set();
  const writes = new Map(); // relPath -> Buffer, for --check comparison

  for (const dir of seriesDirs) {
    const dirPath = path.join(PROMPTS, dir);
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).filter((e) => e.isFile());
    const mdFiles = entries.filter((e) => e.name.toLowerCase().endsWith('.md')).map((e) => e.name).sort();
    const stillFiles = new Set(entries.filter((e) => e.name.toLowerCase().endsWith('.jpg')).map((e) => e.name));
    const rows = [];
    for (const mdFile of mdFiles) {
      const id = path.basename(mdFile, '.md').split('_')[0].trim();
      if (!id) throw new Error(`cannot derive id from ${mdFile}`);
      if (idSeen.has(id)) throw new Error(`duplicate style id ${id} (${mdFile})`);
      idSeen.add(id);
      const mdPath = path.join(dirPath, mdFile);
      const mdBuf = fs.readFileSync(mdPath);
      const mdText = mdBuf.toString('utf8');
      const parsed = parseMd(mdText);
      const stillSrc = stillFiles.has(path.basename(mdFile, '.md') + '.jpg')
        ? path.join(dirPath, path.basename(mdFile, '.md') + '.jpg')
        : undefined;
      const stillBuf = stillSrc ? fs.readFileSync(stillSrc) : undefined;
      const [category = '', subcategory = ''] = (parsed.meta['分类'] ?? '').split('·').map((s) => s.trim());
      const license = MIT_PREFIXES.has(seriesKeyOf(dir)[0]) ? 'MIT' : 'free-share-no-sell';
      const name = parsed.h1.replace(/^\S+\s*/, '').trim();
      const row = {
        id,
        name,
        series: seriesKeyOf(dir),
        seriesDir: dir,
        category,
        subcategory,
        fit: parsed.meta['适合'] ?? '',
        keywords: (parsed.meta['关键词'] ?? '').split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
        license,
        source: `风格提示词/${dir}/${mdFile}`,
        payloadKind: parsed.kind,
        hasSharedHelpers: parsed.kind === 'code-sample',
        // `prompt` is the card's md 原文 verbatim (Q2 decision: carry the source
        // file, not a compiled instruction). Do not trim or re-shape it.
        prompt: mdText,
        promptPath: `styles/${id}.md`,
        stillPath: stillBuf ? `stills/${id}.jpg` : null,
        bytes: { prompt: mdBuf.length, still: stillBuf ? stillBuf.length : 0 },
        sha256: { prompt: sha256(mdBuf), still: stillBuf ? sha256(stillBuf) : null },
      };
      rows.push(row);
      styles.push(row);

      writes.set(`styles/${id}.md`, mdBuf);
      if (stillBuf) writes.set(`stills/${id}.jpg`, stillBuf);

      counts.styles++;
      if (stillBuf) counts.stills++;
      if (parsed.kind === 'empty') counts.emptyPayload++;
      if (parsed.kind === 'code-sample') { counts.codeSample++; counts.withReferenceImpl++; }
      if (parsed.kind === 'spec') counts.spec++;
      if (parsed.kind === 'short') counts.short++;
      if (license === 'MIT') counts.mit++; else counts.freeShareNoSell++;
    }
    rows.sort((a, b) => (parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10)) || a.id.localeCompare(b.id));
  }

  // Failure-loud assertions: the pack is the contract, drift must not slip through.
  const expected = { styles: 341, stills: 193, emptyPayload: 9, withReferenceImpl: 25, codeSample: 25, spec: 59, short: 248, mit: 105, freeShareNoSell: 236 };
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k] !== v) throw new Error(`count drift ${k}: expected ${v}, got ${counts[k]}`);
  }

  const series = seriesDirs.map((dir) => {
    const key = seriesKeyOf(dir);
    const rows = styles.filter((s) => s.series === key);
    return {
      key,
      dir,
      label: rows[0]?.category ?? dir,
      count: rows.length,
      stills: rows.filter((s) => s.stillPath).length,
    };
  });

  // Preview a sorted styles array (id order is already deterministic per series;
  // keep series order then id order for publishing).
  const index = {
    version: 1,
    source: {
      repo: 'XiaoyeCodes/code-animation-prompts',
      tree: '69ccbea',
      pack: 'code-animation-341-styles-main',
      licenseFiles: ['LICENSES/LICENSE', 'LICENSES/NOTICE.md', 'LICENSES/许可与来源.md', 'LICENSES/第三方许可/'],
    },
    counts,
    series,
    styles,
  };

  const sources = [
    '# 素材来源与许可',
    '',
    '本目录由 `scripts/build-assets.mjs` 从素材包 `code-animation-341-styles-main/`（不入库）生成，勿手改。',
    '',
    `- 风格数：${counts.styles}（MIT ${counts.mit} / free-share-no-sell ${counts.freeShareNoSell}）`,
    `- 缩略图：${counts.stills}`,
    '- 上游：`XiaoyeCodes/code-animation-prompts`；许可原文见 `LICENSES/`。',
    '',
    '| id | 名称 | 系列 | 许可 | 来源 |',
    '|---|---|---|---|---|',
    ...styles.map((s) => `| ${s.id} | ${s.name} | ${s.series} | ${s.license} | ${s.source} |`),
    '',
  ].join('\n');

  writes.set('index.json', Buffer.from(JSON.stringify(index)));
  writes.set('SOURCES.md', Buffer.from(sources, 'utf8'));
  const shared = path.join(PROMPTS, 'A-G_代码样片', '_公共函数.js');
  if (!fs.existsSync(shared)) throw new Error(`missing shared helper: ${shared}`);
  writes.set('shared/_公共函数.js', fs.readFileSync(shared));

  // License files travel with the assets.
  const licensePairs = [
    ['LICENSE', 'LICENSES/LICENSE'],
    ['NOTICE.md', 'LICENSES/NOTICE.md'],
    ['许可与来源.md', 'LICENSES/许可与来源.md'],
  ];
  for (const [from, to] of licensePairs) writes.set(to, fs.readFileSync(path.join(SRC, from)));
  const thirdPartyDir = path.join(SRC, '第三方许可');
  for (const f of fs.readdirSync(thirdPartyDir).sort()) {
    writes.set(`LICENSES/第三方许可/${f}`, fs.readFileSync(path.join(thirdPartyDir, f)));
  }

  if (CHECK) {
    let drift = 0;
    for (const [relPath, buf] of writes) {
      const abs = path.join(OUT, relPath);
      if (!fs.existsSync(abs) || !fs.readFileSync(abs).equals(buf)) {
        console.error(`drift: ${relPath}`);
        drift++;
      }
    }
    // 输出目录只该有 writes 里的文件：手放的、删剩的、系统杂项（忽略）也算漂移。
    const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
    const actual = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (JUNK_FILES.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else actual.push(rel(path.relative(OUT, abs)));
      }
    };
    walk(OUT);
    for (const relPath of actual) {
      if (!writes.has(relPath)) {
        console.error(`drift (unexpected): ${relPath}`);
        drift++;
      }
    }
    if (drift) process.exit(2);
    console.log('assets/ is current');
    return;
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const [relPath, buf] of writes) {
    const abs = path.join(OUT, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }

  const indexBytes = writes.get('index.json').length;
  const totalBytes = [...writes.values()].reduce((n, b) => n + b.length, 0);
  console.log(JSON.stringify({
    files: writes.size,
    indexBytes,
    totalBytes,
    totalMB: Math.round((totalBytes / 1048576) * 10) / 10,
    counts,
    series: series.map((s) => `${s.key}:${s.count}/${s.stills}`),
    out: rel(path.relative(ROOT, OUT)),
  }, null, 2));
}

main();
