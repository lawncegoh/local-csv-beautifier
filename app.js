const $ = (id) => document.getElementById(id);

const DEFAULT_OPTIONS = {
  trimCells: true,
  collapseSpaces: true,
  normalizeNulls: true,
  stripQuotes: true,
  headerNormalize: true,
  headerUnique: true,
  removeEmptyRows: true,
  dedupeRows: true,
  normalizeNumbers: true,
  normalizeDates: true,
  delimiter: "auto",
};

const PROFILE_KEY = "local-csv-beautifier-profiles-v1";

let latestOutput = "";
let latestLog = {};
const delimiterCandidates = [",", ";", "\t", "|"];

const els = {
  file: $("csvFile"),
  fileName: $("fileName"),
  text: $("csvText"),
  runBtn: $("runBtn"),
  clearBtn: $("clearBtn"),
  status: $("status"),
  report: $("report"),
  previewOriginal: $("previewOriginal"),
  previewCleaned: $("previewCleaned"),
  template: $("tableTemplate"),
  downloadCsvBtn: $("downloadCsvBtn"),
  downloadLogBtn: $("downloadLogBtn"),
  trimCells: $("optTrimCells"),
  collapseSpaces: $("optCollapseSpaces"),
  normalizeNulls: $("optNormalizeNulls"),
  stripQuotes: $("optStripQuotes"),
  headerNormalize: $("optHeaderNormalize"),
  headerUnique: $("optHeaderUnique"),
  removeEmptyRows: $("optRemoveEmptyRows"),
  dedupeRows: $("optDedupeRows"),
  normalizeNumbers: $("optNormalizeNumbers"),
  normalizeDates: $("optNormalizeDates"),
  delimiter: $("optDelimiter"),
  profileName: $("profileName"),
  saveProfileBtn: $("saveProfileBtn"),
  profileSelect: $("profileSelect"),
  deleteProfileBtn: $("deleteProfileBtn"),
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

function getOptionsFromUi() {
  return {
    trimCells: els.trimCells.checked,
    collapseSpaces: els.collapseSpaces.checked,
    normalizeNulls: els.normalizeNulls.checked,
    stripQuotes: els.stripQuotes.checked,
    headerNormalize: els.headerNormalize.checked,
    headerUnique: els.headerUnique.checked,
    removeEmptyRows: els.removeEmptyRows.checked,
    dedupeRows: els.dedupeRows.checked,
    normalizeNumbers: els.normalizeNumbers.checked,
    normalizeDates: els.normalizeDates.checked,
    delimiter: els.delimiter.value,
  };
}

function setUiFromOptions(options) {
  const normalized = { ...DEFAULT_OPTIONS, ...options };
  els.trimCells.checked = !!normalized.trimCells;
  els.collapseSpaces.checked = !!normalized.collapseSpaces;
  els.normalizeNulls.checked = !!normalized.normalizeNulls;
  els.stripQuotes.checked = !!normalized.stripQuotes;
  els.headerNormalize.checked = !!normalized.headerNormalize;
  els.headerUnique.checked = !!normalized.headerUnique;
  els.removeEmptyRows.checked = !!normalized.removeEmptyRows;
  els.dedupeRows.checked = !!normalized.dedupeRows;
  els.normalizeNumbers.checked = !!normalized.normalizeNumbers;
  els.normalizeDates.checked = !!normalized.normalizeDates;
  els.delimiter.value = normalized.delimiter || "auto";
}

function splitRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && ch === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    rows.push(row);
  }

  return rows;
}

function countDelimiter(text, delimiter) {
  let inQuotes = false;
  let count = 0;
  for (const ch of text) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      count++;
    }
  }
  return count;
}

function detectDelimiter(text) {
  const sample = text.slice(0, 5000);
  const lines = sample.split(/\r?\n/).slice(0, 8);
  if (!lines.length) return ",";
  let best = ",";
  let bestScore = -1;

  for (const delim of delimiterCandidates) {
    let score = 0;
    for (const line of lines) {
      score += countDelimiter(line, delim);
    }
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }

  return best;
}

function parseCSV(text, delimiter) {
  const delimiterToUse = delimiter === "auto" ? detectDelimiter(text) : delimiter;
  return {
    delimiter: delimiterToUse,
    rows: splitRows(text, delimiterToUse),
  };
}

function trimHeader(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "c_$1");
}

function normalizeHeaderList(headers, report, options) {
  const out = [];
  const used = Object.create(null);
  for (let h of headers) {
    const raw = options.headerNormalize ? trimHeader(h) : String(h ?? "").trim();
    let name = raw || "column";
    if (options.headerUnique) {
      const count = used[name] || 0;
      used[name] = count + 1;
      if (count > 0) {
        report.renamed.push(`${name} -> ${name}_${count}`);
        name = `${name}_${count}`;
      }
    } else {
      if (used[name]) {
        report.warnings.push(`Duplicate header detected: ${name}`);
      }
      used[name] = (used[name] || 0) + 1;
    }
    out.push(name);
  }
  return out;
}

function looksNumeric(value) {
  return /^[-+]?(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$/.test(value);
}

function normalizeNumber(value, report) {
  const cleaned = value.replace(/,/g, "").replace(/[ _]/g, "");
  if (looksNumeric(cleaned) && cleaned !== value) {
    report.numberNormalized++;
    return cleaned;
  }
  return cleaned;
}

function normalizeDateValue(value, report) {
  const val = value.trim();
  if (!val) return value;
  if (/\$/.test(val)) {
    return value;
  }

  const d1 = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (d1) return `${d1[1]}-${String(d1[2]).padStart(2, "0")}-${String(d1[3]).padStart(2, "0")}`;

  const d2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (d2) {
    let y = d2[3];
    if (y.length === 2) y = `20${y}`;
    const m = String(d2[1]).padStart(2, "0");
    const d = String(d2[2]).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    if (!Number.isNaN(new Date(iso).getTime())) {
      report.dateNormalized++;
      return iso;
    }
  }

  const d3 = val.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (d3) {
    let y = d3[3];
    if (y.length === 2) y = `20${y}`;
    const m = String(d3[1]).padStart(2, "0");
    const d = String(d3[2]).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    if (!Number.isNaN(new Date(iso).getTime())) {
      report.dateNormalized++;
      return iso;
    }
  }

  return value;
}

function normalizeNullValue(value, report) {
  const token = value.trim().toLowerCase();
  if (
    token === "null" ||
    token === "none" ||
    token === "na" ||
    token === "n/a" ||
    token === "nil" ||
    token === "undefined" ||
    token === "not available" ||
    token === "-" ||
    token === "--"
  ) {
    if (value !== "") {
      report.nullNormalized++;
      return "";
    }
  }
  return value;
}

function collapseWhitespace(value, report) {
  const collapsed = value.replace(/\s+/g, " ");
  if (collapsed !== value) {
    report.spaceCollapsed++;
    return collapsed;
  }
  return value;
}

function stripOuterQuotes(value, report) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && last === first) {
    report.quotesStripped++;
    if (first === '"') {
      return value.slice(1, -1).replace(/""/g, '"');
    }
    return value.slice(1, -1);
  }
  return value;
}

function cleanCell(value, options, report) {
  let cell = String(value ?? "");
  if (options.trimCells) {
    cell = cell.trim();
  }
  if (options.collapseSpaces) {
    cell = collapseWhitespace(cell, report);
  }
  if (options.normalizeNulls) {
    cell = normalizeNullValue(cell, report);
  }
  if (options.stripQuotes) {
    cell = stripOuterQuotes(cell, report);
  }
  if (options.normalizeNumbers && looksNumeric(cell)) {
    cell = normalizeNumber(cell, report);
  }
  if (options.normalizeDates && /\d/.test(cell)) {
    cell = normalizeDateValue(cell, report);
  }
  return cell;
}

function beautifyCSV(text, options) {
  const parse = parseCSV(text, options.delimiter);
  const rawRows = parse.rows.filter((r) => r.some((v) => String(v ?? "").trim() !== ""));
  const report = {
    inputRows: rawRows.length,
    outputRows: 0,
    detectedDelimiter: parse.delimiter,
    removedEmptyRows: 0,
    dedupedRows: 0,
    changedCells: 0,
    headerChanges: 0,
    headerRows: rawRows[0] ? rawRows[0].length : 0,
    renamed: [],
    warnings: [],
    numberNormalized: 0,
    dateNormalized: 0,
    nullNormalized: 0,
    spaceCollapsed: 0,
    quotesStripped: 0,
  };

  if (!rawRows.length) {
    return { outputRows: [], output: "", report, header: [] };
  }

  const inputHeaders = rawRows[0];
  const rawHeaderNames = normalizeHeaderList(inputHeaders, report, options);
  const hasHeaderChanges =
    JSON.stringify(inputHeaders) !== JSON.stringify(rawHeaderNames);
  if (hasHeaderChanges) {
    report.headerChanges++;
  }

  const body = rawRows.slice(1);
  const cleanedRows = [];
  const seenRows = new Set();
  let maxCols = rawHeaderNames.length;
  for (const row of body) {
    maxCols = Math.max(maxCols, row.length);
  }

  for (let i = 0; i < body.length; i++) {
    const row = body[i];
    let cellCount = 0;
    const cleaned = [];

    if (options.removeEmptyRows) {
      const hasValue = row.some((v) => String(v ?? "").trim() !== "");
      if (!hasValue) {
        report.removedEmptyRows++;
        continue;
      }
    }

    for (let idx = 0; idx < maxCols; idx++) {
      const cell = row[idx] ?? "";
      const normalized = cleanCell(cell, options, report);
      const orig = String(cell ?? "");
      if (orig !== normalized) report.changedCells++;
      cleaned.push(normalized);
      if (normalized !== "") cellCount++;
    }

    if (cellCount === 0) {
      report.removedEmptyRows++;
      continue;
    }

    const key = JSON.stringify(cleaned);
    if (options.dedupeRows && seenRows.has(key)) {
      report.dedupedRows++;
      continue;
    }

    seenRows.add(key);
    cleanedRows.push(cleaned);
  }

  const outputRows = [rawHeaderNames, ...cleanedRows];
  report.outputRows = outputRows.length - 1;

  const output = rowsToCsv(outputRows);
  return {
    outputRows,
    output,
    report,
    header: rawHeaderNames,
    sample: outputRows,
    rawRows,
  };
}

function escapeCsvField(value, delimiter) {
  const text = String(value ?? "");
  const needsQuotes =
    text.includes(delimiter) ||
    text.includes("\"") ||
    text.includes("\n") ||
    text.includes("\r");
  const escaped = text.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function rowsToCsv(rows) {
  return rows
    .map((row) => row.map((cell) => escapeCsvField(cell, ",")).join(","))
    .join("\n");
}

function buildChangeMap(sourceRows, cleanedRows) {
  const changes = new Set();
  const source = sourceRows || [];
  const cleaned = cleanedRows || [];
  const maxRows = Math.max(source.length, cleaned.length);
  const maxCols = Math.max(
    1,
    ...source.map((r) => (r || []).length),
    ...cleaned.map((r) => (r || []).length)
  );

  for (let row = 0; row < maxRows; row++) {
    const left = source[row] || [];
    const right = cleaned[row] || [];
    for (let col = 0; col < maxCols; col++) {
      if (
        row >= source.length ||
        row >= cleaned.length ||
        String(left[col] ?? "") !== String(right[col] ?? "")
      ) {
        changes.add(`${row}-${col}`);
      }
    }
  }

  return changes;
}

function renderReport(report) {
  const items = [
    ["Source rows", report.inputRows],
    ["Clean rows", report.outputRows],
    ["Detected delimiter", report.detectedDelimiter],
    ["Header changes", report.headerChanges],
    ["Empty rows removed", report.removedEmptyRows],
    ["Duplicate rows removed", report.dedupedRows],
    ["Normalized numbers", report.numberNormalized],
    ["Normalized dates", report.dateNormalized],
    ["Null values normalized", report.nullNormalized],
    ["Whitespace collapses", report.spaceCollapsed],
    ["Quotes stripped", report.quotesStripped],
    ["Cell edits", report.changedCells],
  ];
  els.report.innerHTML = items
    .map(
      ([label, value]) =>
        `<div class="report-card"><strong>${escapeHtml(label)}</strong>${escapeHtml(
          String(value)
        )}</div>`
    )
    .join("");
  if (report.warnings.length || report.renamed.length) {
    const lines = [...report.warnings, ...report.renamed]
      .map((l) => `<li>${escapeHtml(l)}</li>`)
      .join("");
    els.report.insertAdjacentHTML(
      "beforeend",
      `<div class="report-card"><strong>Details</strong><ul>${lines}</ul></div>`
    );
  }
}

function createPreviewTable(rows, title, container, changeMap = new Set()) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.querySelector("h3").textContent = title;
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const t = document.createElement("tr");
  const rowNumberHeader = document.createElement("th");
  rowNumberHeader.className = "row-number";
  rowNumberHeader.textContent = "#";
  t.appendChild(rowNumberHeader);

  const columns = Math.max(1, ...rows.map((r) => r.length));
  const sampleRows = rows.slice(0, 20);
  const headers = rows[0] || [];

  for (let i = 0; i < columns; i++) {
    const cell = document.createElement("th");
    const header = headers[i] != null && headers[i] !== "" ? headers[i] : `col_${i + 1}`;
    cell.textContent = header;
    t.appendChild(cell);
  }
  thead.appendChild(t);
  table.appendChild(thead);

  for (let rowIndex = 1; rowIndex < sampleRows.length; rowIndex++) {
    const row = sampleRows[rowIndex];
    const tr = document.createElement("tr");
    const numberCell = document.createElement("td");
    numberCell.className = "row-number";
    numberCell.textContent = String(rowIndex);
    tr.appendChild(numberCell);
    for (let i = 0; i < columns; i++) {
      const td = document.createElement("td");
      td.textContent = row[i] ?? "";
      if (changeMap.has(`${rowIndex}-${i}`)) {
        td.classList.add("changed-cell");
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const area = node.querySelector(".table-area");
  area.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        area.scrollLeft += event.deltaY;
      }
    },
    { passive: false }
  );
  area.appendChild(table);
  container.appendChild(node);
}

function previewTables(originalRows, cleanedRows) {
  els.previewOriginal.innerHTML = "";
  els.previewCleaned.innerHTML = "";
  const sourceRows = originalRows.length ? originalRows : [[""]];
  const cleanRows = cleanedRows.length ? cleanedRows : [[""]];
  const changes = buildChangeMap(sourceRows, cleanRows);
  createPreviewTable(sourceRows, "Uploaded source (first rows)", els.previewOriginal, new Set());
  createPreviewTable(cleanRows, "Cleaned output (first rows)", els.previewCleaned, changes);
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setStatus(message) {
  els.status.textContent = message;
}

function run() {
  (async () => {
    try {
      const file = els.file.files && els.file.files[0];
      const pasted = els.text.value.trim();
      let text = "";

      if (!file && !pasted) {
        setStatus("Please upload a file or paste CSV text.");
        return;
      }

      if (file) {
        text = await readFileText(file);
      } else {
        text = pasted;
      }

      const options = getOptionsFromUi();
      const beautified = beautifyCSV(text, options);
      if (!beautified.outputRows) {
        setStatus("No rows detected. Make sure the file/text contains valid CSV.");
        return;
      }

      latestOutput = beautified.output;
      latestLog = beautified.report;

      const rawRows = beautified.rawRows;
      const cleanedRows = beautified.sample || [];
      previewTables(rawRows, cleanedRows);
      renderReport(beautified.report);
      setStatus("Cleanup complete. Preview ready. Download files below.");
      els.downloadCsvBtn.disabled = false;
      els.downloadLogBtn.disabled = false;
      els.downloadCsvBtn.onclick = () =>
        downloadFile(`cleaned-${new Date().toISOString().slice(0, 10)}.csv`, latestOutput, "text/csv");
      els.downloadLogBtn.onclick = () =>
        downloadFile(
          `change-log-${new Date().toISOString().slice(0, 10)}.json`,
          JSON.stringify(
            {
              ...latestLog,
              options,
              generatedAt: new Date().toISOString(),
            },
            null,
            2
          ),
          "application/json"
        );
      els.runBtn.disabled = false;
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  })().catch(() => {
    setStatus("Unexpected error while running.");
  });
}

function persistProfileOptions(name, options) {
  const key = PROFILE_KEY;
  const profiles = loadProfiles();
  profiles[name] = options;
  localStorage.setItem(key, JSON.stringify(profiles));
  refreshProfileList();
}

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function refreshProfileList() {
  const profiles = loadProfiles();
  const names = Object.keys(profiles).sort();
  els.profileSelect.innerHTML =
    '<option value="">Load profile…</option>' +
    names.map((name) => `<option value="${name}">${name}</option>`).join("");
}

function loadProfileFromSelect() {
  const selected = els.profileSelect.value;
  if (!selected) return;
  const profiles = loadProfiles();
  if (!profiles[selected]) return;
  setUiFromOptions(profiles[selected]);
  setStatus(`Loaded profile: ${selected}`);
}

function deleteProfile() {
  const selected = els.profileSelect.value;
  if (!selected) return;
  const profiles = loadProfiles();
  if (!profiles[selected]) return;
  delete profiles[selected];
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  refreshProfileList();
  setStatus(`Deleted profile: ${selected}`);
}

function clearForm() {
  els.file.value = "";
  els.fileName.textContent = "No file chosen";
  els.text.value = "";
  els.previewOriginal.innerHTML = "";
  els.previewCleaned.innerHTML = "";
  els.report.innerHTML = "";
  els.status.textContent = "Cleared. Load a CSV and run cleanup.";
  els.downloadCsvBtn.disabled = true;
  els.downloadLogBtn.disabled = true;
  latestOutput = "";
  latestLog = {};
}

els.file.addEventListener("change", () => {
  els.fileName.textContent = els.file.files[0]?.name || "No file chosen";
  if (els.file.files[0]) {
    els.text.value = "";
  }
});

els.runBtn.addEventListener("click", run);
els.clearBtn.addEventListener("click", clearForm);
els.saveProfileBtn.addEventListener("click", () => {
  const name = (els.profileName.value || "").trim();
  if (!name) {
    setStatus("Give profile a name to save it.");
    return;
  }
  persistProfileOptions(name, getOptionsFromUi());
  setStatus(`Saved profile: ${name}`);
});
els.profileSelect.addEventListener("change", loadProfileFromSelect);
els.deleteProfileBtn.addEventListener("click", deleteProfile);
els.text.addEventListener("input", () => {
  if (els.text.value.trim()) {
    els.file.value = "";
    els.fileName.textContent = "No file chosen (using pasted text)";
  }
});

refreshProfileList();
