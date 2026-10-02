const { PDFDocument } = PDFLib;
const $ = (id) => document.getElementById(id);
const els = {
  dropzone: $('dropzone'), dropFull: $('drop-full'), dropSlim: $('drop-slim'),
  choose: $('choose'), addMore: $('add-more'), input: $('file-input'),
  empty: $('empty'), orderHint: $('order-hint'), list: $('file-list'), sizeWarning: $('size-warning'),
  status: $('status'), downloadWrap: $('download-wrap'), again: $('download-again'),
  name: $('output-name'), clear: $('clear'), combine: $('combine'), hint: $('combine-hint'),
};
const MSG = {
  encrypted: 'This PDF is password-protected. Remove the password in your PDF viewer, then add it again.',
  damaged: "This file looks damaged and can't be read. Try re-saving or re-downloading it.",
  failed: 'Something went wrong while combining. Remove any files marked in red and try again.',
};
const LARGE = 500 * 1024 * 1024;

let items = [];
let nextId = 1;
let busy = false;
let downloadUrl = null;
let clearTimer = null;
let dragDepth = 0;

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const formatSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const announce = (text) => { els.status.textContent = text; };

async function isPdf(file) {
  if (!file.size) return false;
  try {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    return new TextDecoder('latin1').decode(head).includes('%PDF-');
  } catch {
    return false;
  }
}

async function inspect(item) {
  try {
    const doc = await PDFDocument.load(await item.file.arrayBuffer(), { updateMetadata: false });
    item.pages = doc.getPageCount();
    if (!item.pages) throw new Error('empty');
    item.state = 'ok';
  } catch (err) {
    item.state = 'error';
    item.error = /encrypt/i.test(err?.message) ? MSG.encrypted : MSG.damaged;
  }
  render();
}

async function addFiles(fileList) {
  const files = [...fileList];
  if (busy || !files.length) return;
  const checks = await Promise.all(files.map(isPdf));
  const added = [];
  const skipped = [];
  files.forEach((file, i) => (checks[i] ? added.push({ id: nextId++, file, state: 'reading' }) : skipped.push(file.name)));
  items.push(...added);
  changed();
  const parts = [];
  if (added.length) parts.push(`${plural(added.length, 'file')} added.`);
  const names = skipped.map((n) => `“${n}”`);
  if (names.length === 1) parts.push(`${names[0]} isn't a PDF, so it wasn't added.`);
  else if (names.length) parts.push(`${names.slice(0, -1).join(', ')} and ${names.at(-1)} aren't PDFs, so they weren't added.`);
  announce(parts.join(' '));
  for (const item of added) await inspect(item);
}

function row(item, i) {
  const name = item.file.name;
  const size = formatSize(item.file.size);
  const meta = item.state === 'reading' ? 'Reading…' : item.state === 'ok' ? `${plural(item.pages, 'page')} · ${size}` : size;
  const button = (action, label, text, disabled = false) => {
    const b = el('button', { type: 'button', className: `icon-btn ${action}`, ariaLabel: label, textContent: text, disabled: busy || disabled });
    b.dataset.action = action;
    return b;
  };
  const li = el('li', { className: `file ${item.state}` },
    el('span', { className: 'pos', ariaHidden: 'true', textContent: String(i + 1).padStart(2, '0') }),
    el('div', { className: 'info' },
      el('span', { className: 'name', title: name, textContent: name }),
      el('span', { className: 'meta', textContent: meta }),
      ...(item.error ? [el('span', { className: 'error-msg', textContent: item.error })] : [])),
    el('div', { className: 'controls' },
      button('up', `Move ${name} up`, '↑', i === 0),
      button('down', `Move ${name} down`, '↓', i === items.length - 1),
      button('remove', `Remove ${name}`, '✕')));
  li.dataset.id = item.id;
  return li;
}

function render() {
  const active = document.activeElement;
  const keep = els.list.contains(active) && { id: active.closest('li').dataset.id, action: active.dataset.action };
  els.list.replaceChildren(...items.map(row));
  if (keep) {
    const li = els.list.querySelector(`[data-id="${keep.id}"]`);
    const target = li?.querySelector(`[data-action="${keep.action}"]`);
    const other = li?.querySelector(`[data-action="${keep.action === 'up' ? 'down' : 'up'}"]`);
    (target?.disabled && other && !other.disabled ? other : target)?.focus();
  }

  const has = items.length > 0;
  const ok = items.filter((x) => x.state === 'ok');
  els.empty.hidden = has;
  els.orderHint.hidden = !has;
  els.dropFull.hidden = has;
  els.dropSlim.hidden = !has;
  els.dropzone.classList.toggle('slim', has);
  els.sizeWarning.hidden = ok.reduce((sum, x) => sum + x.file.size, 0) <= LARGE;
  els.combine.disabled = busy || ok.length < 2 || items.some((x) => x.state === 'reading');
  els.hint.hidden = ok.length >= 2;
  els.clear.disabled = busy || !has;
  els.choose.disabled = els.addMore.disabled = els.name.disabled = busy;
  if (document.activeElement === els.choose && has) els.addMore.focus();
  if (document.activeElement === els.addMore && !has) els.choose.focus();
}

function invalidateDownload() {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = null;
  els.downloadWrap.hidden = true;
}

function changed() {
  invalidateDownload();
  render();
}

function resetClear() {
  clearTimeout(clearTimer);
  clearTimer = null;
  els.clear.textContent = 'Clear all';
}

function outputName() {
  const name = els.name.value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  if (!name || /^\.pdf$/i.test(name)) return 'combined.pdf';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

async function combine() {
  const files = items.filter((x) => x.state === 'ok').map((x) => x.file);
  const name = outputName();
  els.name.value = name;
  busy = true;
  resetClear();
  invalidateDownload();
  els.combine.textContent = 'Combining…';
  els.combine.classList.add('busy');
  render();
  announce(`Combining ${files.length} files…`);
  try {
    const out = await PDFDocument.create();
    for (const file of files) {
      const src = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      (await out.copyPages(src, src.getPageIndices())).forEach((page) => out.addPage(page));
    }
    downloadUrl = URL.createObjectURL(new Blob([await out.save()], { type: 'application/pdf' }));
    Object.assign(els.again, { href: downloadUrl, download: name });
    els.downloadWrap.hidden = false;
    els.again.click();
    announce(`Done! ${name} (${plural(out.getPageCount(), 'page')}) has been downloaded.`);
  } catch {
    announce(MSG.failed);
  } finally {
    busy = false;
    els.combine.textContent = 'Combine PDFs';
    els.combine.classList.remove('busy');
    render();
    els.combine.focus();
  }
}

els.list.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button || busy) return;
  const i = items.findIndex((x) => String(x.id) === button.closest('li').dataset.id);
  const item = items[i];
  if (button.dataset.action === 'remove') {
    items.splice(i, 1);
    changed();
    const next = items[i] ?? items[i - 1];
    if (next) els.list.querySelector(`[data-id="${next.id}"] .remove`).focus();
    else els.choose.focus();
    announce(`${item.file.name} removed.`);
    return;
  }
  const j = button.dataset.action === 'up' ? i - 1 : i + 1;
  [items[i], items[j]] = [items[j], items[i]];
  changed();
  announce(`${item.file.name} moved to position ${j + 1} of ${items.length}.`);
});

els.choose.addEventListener('click', () => els.input.click());
els.addMore.addEventListener('click', () => els.input.click());
els.input.addEventListener('change', () => {
  addFiles(els.input.files);
  els.input.value = '';
});
els.clear.addEventListener('click', () => {
  if (!clearTimer) {
    els.clear.textContent = 'Click again to clear';
    clearTimer = setTimeout(resetClear, 3000);
    return;
  }
  resetClear();
  items = [];
  changed();
  announce('All files removed.');
  els.choose.focus();
});
els.combine.addEventListener('click', combine);

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  els.dropzone.classList.add('over');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth > 0) return;
  dragDepth = 0;
  els.dropzone.classList.remove('over');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.dropzone.classList.remove('over');
  if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
});

render();
