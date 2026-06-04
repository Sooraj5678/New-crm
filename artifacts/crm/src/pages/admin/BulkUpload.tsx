import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, ChevronRight, RefreshCw, X, History } from "lucide-react";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react";

async function apiGet(path: string) {
  return customFetch(`/api${path}`);
}

async function apiPost(path: string, body: unknown) {
  return customFetch(`/api${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const TEMPLATE_COLUMNS = ["Lead Name", "Company Name", "Email", "Phone Number", "Country", "State", "City", "Lead Source", "Partner Name", "Account Manager Name", "Notes"];

const CRM_FIELDS = [
  { key: "name", label: "Lead Name", required: true },
  { key: "company", label: "Company Name", required: false },
  { key: "email", label: "Email", required: false },
  { key: "mobile", label: "Phone Number", required: false },
  { key: "country", label: "Country", required: false },
  { key: "state", label: "State", required: false },
  { key: "city", label: "City", required: false },
  { key: "source", label: "Lead Source", required: false },
  { key: "partnerName", label: "Partner Name", required: false },
  { key: "accountManagerName", label: "Account Manager Name", required: false },
  { key: "notes", label: "Notes", required: false },
];

function downloadTemplate() {
  const header = TEMPLATE_COLUMNS.join(",");
  const exampleRow = ["John Smith", "Acme Corp", "john@acme.com", "+1234567890", "USA", "California", "Los Angeles", "Website", "Acme Partners", "Jane Smith", "Interested in Pro plan"].join(",");
  const csv = `${header}\n${exampleRow}`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lead_upload_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
  return { headers, rows };
}

function autoDetectMapping(fileHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const synonyms: Record<string, string[]> = {
    name: ["leadname", "name", "fullname", "contactname"],
    company: ["company", "companyname", "organization", "org"],
    email: ["email", "emailaddress", "mail"],
    mobile: ["phone", "phonenumber", "mobile", "mobilenumber", "contact"],
    country: ["country"],
    state: ["state", "province"],
    city: ["city", "town"],
    source: ["leadsource", "source", "channel"],
    partnerName: ["partnername", "partner"],
    accountManagerName: ["accountmanagername", "accountmanager", "manager"],
    notes: ["notes", "note", "comment", "remarks"],
  };

  fileHeaders.forEach(fh => {
    const normalized = normalize(fh);
    for (const [field, syns] of Object.entries(synonyms)) {
      if (syns.includes(normalized) && !mapping[field]) {
        mapping[field] = fh;
      }
    }
  });
  return mapping;
}

type Step = "upload" | "map" | "validate" | "result";

interface ValidationRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  isDuplicate: boolean;
}

interface ValidationResult {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  rows: ValidationRow[];
}

interface ImportResult {
  batchId: number;
  imported: number;
  failed: number;
  total: number;
  failedRows: { row: number; reason: string }[];
}

interface HistoryBatch {
  id: number; fileName: string; uploadedByName: string;
  totalRecords: number; importedRecords: number;
  failedRecords: number; duplicateRecords: number; status: string; createdAt: string;
}

export default function BulkUpload() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [errorReportBatchId, setErrorReportBatchId] = useState<number | null>(null);
  const [historyErrors, setHistoryErrors] = useState<{ row: number; reason: string }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: history = [], refetch: refetchHistory } = useQuery<HistoryBatch[]>({
    queryKey: ["bulk-upload-history"], queryFn: () => apiGet("/bulk-upload/history"), enabled: showHistory,
  });

  const validateMutation = useMutation({
    mutationFn: (payload: { rows: Record<string, string>[]; fileName: string }) =>
      apiPost("/bulk-upload/validate", payload),
    onSuccess(data) {
      if (data.error) { toast.error(data.error); return; }
      setValidationResult(data);
      setStep("validate");
    },
    onError() { toast.error("Validation failed"); },
  });

  const importMutation = useMutation({
    mutationFn: (payload: { rows: Record<string, string>[]; fileName: string }) =>
      apiPost("/bulk-upload/import", payload),
    onSuccess(data) {
      if (data.error) { toast.error(data.error); return; }
      setImportResult(data);
      setStep("result");
      qc.invalidateQueries({ queryKey: ["bulk-upload-history"] });
      toast.success(`Imported ${data.imported} leads successfully`);
    },
    onError() { toast.error("Import failed"); },
  });

  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setFileHeaders(headers);
      setFileRows(rows);
      setFieldMapping(autoDetectMapping(headers));
      setStep("map");
    };
    reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))) {
      processFile(file);
    } else {
      toast.error("Please upload a CSV file");
    }
  }, []);

  function getMappedRows(): Record<string, string>[] {
    return fileRows.map(row => {
      const obj: Record<string, string> = {};
      CRM_FIELDS.forEach(f => {
        const colHeader = fieldMapping[f.key];
        if (colHeader) {
          const idx = fileHeaders.indexOf(colHeader);
          obj[f.key] = idx >= 0 ? (row[idx] ?? "") : "";
        } else {
          obj[f.key] = "";
        }
      });
      return obj;
    });
  }

  function handleValidate() {
    const mappedRows = getMappedRows();
    validateMutation.mutate({ rows: mappedRows, fileName });
  }

  function handleImport() {
    const mappedRows = getMappedRows();
    const validRows = mappedRows.filter((_, i) => {
      const r = validationResult?.rows[i];
      return r && r.errors.length === 0 && !r.isDuplicate;
    });
    importMutation.mutate({ rows: validRows, fileName });
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setFileHeaders([]);
    setFileRows([]);
    setFieldMapping({});
    setValidationResult(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function loadErrorReport(batchId: number) {
    setErrorReportBatchId(batchId);
    const data = await apiGet(`/bulk-upload/history/${batchId}/error-report`);
    setHistoryErrors(data.errorReport ?? []);
  }

  function downloadErrorReport() {
    if (!importResult?.failedRows?.length) return;
    const csv = ["Row,Reason", ...importResult.failedRows.map(r => `${r.row},"${r.reason}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error_report_${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stepOrder: Step[] = ["upload", "map", "validate", "result"];
  const stepLabels = { upload: "Upload File", map: "Map Columns", validate: "Review", result: "Results" };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bulk Lead Upload</h1>
          <p className="text-sm text-muted-foreground mt-1">Import leads from a CSV file with field mapping and validation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) refetchHistory(); }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
            <History size={16} /> History
          </button>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Download size={16} /> Download Template
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {stepOrder.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              s === step ? "bg-primary text-primary-foreground" :
              stepOrder.indexOf(step) > i ? "text-primary" : "text-muted-foreground"
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                s === step ? "border-primary-foreground bg-primary-foreground/20" :
                stepOrder.indexOf(step) > i ? "border-primary bg-primary text-white" : "border-muted-foreground"
              }`}>{stepOrder.indexOf(step) > i ? "✓" : i + 1}</span>
              {stepLabels[s]}
            </div>
            {i < stepOrder.length - 1 && <ChevronRight size={16} className="text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-card border border-border rounded-xl p-8">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
            }`}
          >
            <FileSpreadsheet size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Drag & drop your CSV file here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse files</p>
            <p className="text-xs text-muted-foreground mt-3">Supports .csv format • Max 10,000 rows</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>
          <div className="mt-4 p-4 bg-muted/40 rounded-lg">
            <p className="text-sm font-medium text-foreground mb-2">Template columns:</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_COLUMNS.map(col => (
                <span key={col} className={`text-xs px-2 py-0.5 rounded-full ${col === "Partner Name" || col === "Account Manager Name" ? "bg-primary/15 text-primary font-medium" : "bg-muted text-muted-foreground"}`}>
                  {col}{col === "Lead Name" || col === "Partner Name" || col === "Account Manager Name" ? " *" : ""}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="text-primary font-medium">Partner Name</span> and <span className="text-primary font-medium">Account Manager Name</span> are required per row.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Map */}
      {step === "map" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Map Columns</h2>
              <p className="text-sm text-muted-foreground">{fileName} · {fileRows.length} rows detected</p>
            </div>
            <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X size={14} /> Start over
            </button>
          </div>

          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
            Map <span className="text-primary font-medium">Partner Name</span> and <span className="text-primary font-medium">Account Manager Name</span> columns from your file — these are required for each lead.
          </div>

          {/* Column mapping table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-1/3">CRM Field</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-1/3">Your Column</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CRM_FIELDS.map(field => {
                  const mapped = fieldMapping[field.key] ?? "";
                  const colIdx = mapped ? fileHeaders.indexOf(mapped) : -1;
                  const preview = colIdx >= 0 ? (fileRows[0]?.[colIdx] ?? "") : "";
                  return (
                    <tr key={field.key} className={`hover:bg-muted/20 ${(field.key === "partnerName" || field.key === "accountManagerName") ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{field.label}</span>
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={mapped}
                          onChange={e => setFieldMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={`w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary ${
                            mapped ? "border-border" : field.required ? "border-destructive/50 bg-destructive/5" : "border-border"
                          }`}
                        >
                          <option value="">-- not mapped --</option>
                          {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{preview || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button onClick={reset} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors">Back</button>
            <button onClick={handleValidate} disabled={validateMutation.isPending}
              className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2 transition-colors">
              {validateMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : null}
              Validate & Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Validate / Review */}
      {step === "validate" && validationResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Records", value: validationResult.totalRecords, color: "text-foreground", bg: "bg-card" },
              { label: "Valid Records", value: validationResult.validRecords, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
              { label: "Invalid Records", value: validationResult.invalidRecords, color: "text-destructive", bg: "bg-destructive/5" },
              { label: "Duplicates", value: validationResult.duplicateRecords, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border border-border rounded-xl p-4 text-center`}>
                <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          {validationResult.rows.some(r => r.errors.length > 0 || r.isDuplicate) && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <AlertCircle size={16} className="text-destructive" />
                <span className="text-sm font-medium">Row Validation Errors</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Row</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {validationResult.rows.filter(r => r.errors.length > 0 || r.isDuplicate).map(row => (
                      <tr key={row.rowIndex} className="hover:bg-muted/10">
                        <td className="px-4 py-2 text-muted-foreground">{row.rowIndex}</td>
                        <td className="px-4 py-2">{(row.data.name as string) || "–"}</td>
                        <td className="px-4 py-2">
                          {row.isDuplicate
                            ? <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertCircle size={12} /> Duplicate</span>
                            : <span className="text-destructive">{row.errors.join("; ")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {validationResult.validRecords > 0
                ? <span className="text-green-600 dark:text-green-400 font-medium">{validationResult.validRecords} valid records will be imported.</span>
                : <span className="text-destructive">No valid records to import.</span>}
              {(validationResult.invalidRecords + validationResult.duplicateRecords) > 0 &&
                <span className="text-muted-foreground ml-2">{validationResult.invalidRecords + validationResult.duplicateRecords} records will be skipped.</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("map")} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors">Back</button>
              <button onClick={handleImport} disabled={importMutation.isPending || validationResult.validRecords === 0}
                className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2 transition-colors">
                {importMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                Import {validationResult.validRecords} Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === "result" && importResult && (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${importResult.failed === 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
              {importResult.failed === 0
                ? <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                : <AlertCircle size={40} className="text-amber-600 dark:text-amber-400" />}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {importResult.failed === 0 ? "Import Complete!" : "Import Finished with Errors"}
            </h2>
            <p className="text-muted-foreground mt-1">{importResult.imported} leads imported successfully</p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[
              { label: "Imported", value: importResult.imported, cls: "text-green-600 dark:text-green-400" },
              { label: "Failed", value: importResult.failed, cls: "text-destructive" },
              { label: "Total", value: importResult.total, cls: "text-foreground" },
            ].map(s => (
              <div key={s.label} className="bg-muted/50 rounded-lg p-3">
                <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            {importResult.failed > 0 && (
              <button onClick={downloadErrorReport}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
                <Download size={16} /> Download Error Report
              </button>
            )}
            <button onClick={reset}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              <Upload size={16} /> Import Another File
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><History size={16} /> Upload History</h2>
            <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No upload history yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    {["File", "Uploaded By", "Total", "Imported", "Failed", "Date", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map(b => (
                    <tr key={b.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[160px] truncate">{b.fileName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.uploadedByName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.totalRecords}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">{b.importedRecords}</td>
                      <td className="px-4 py-3 text-destructive">{b.failedRecords}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(b.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {b.failedRecords > 0 && (
                          <button onClick={() => loadErrorReport(b.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Eye size={12} /> Errors
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errorReportBatchId && historyErrors && (
            <div className="border-t border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-foreground">Error Report</h3>
                <button onClick={() => { setErrorReportBatchId(null); setHistoryErrors(null); }} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
              {historyErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No errors recorded</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {historyErrors.map((e, i) => (
                    <div key={i} className="flex gap-3 text-xs">
                      <span className="text-muted-foreground">Row {e.row}</span>
                      <span className="text-destructive">{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
