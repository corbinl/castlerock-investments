import { useState, useRef } from "react";
import { usePreviewImport, useConfirmImport, useListImportBatches, getListImportBatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type PreviewRow = {
  rowIndex: number; symbol: string; direction: string; entryDate: string;
  exitDate?: string | null; entryPrice: number; exitPrice?: number | null;
  quantity: number; pnl?: number | null; isDuplicate: boolean;
  raw: Record<string, string>;
};

type PreviewResult = {
  sessionId: string; detectedFormat: string; rows: PreviewRow[];
  errors: { rowIndex: number; field: string; message: string }[];
  totalRows: number; validRows: number; duplicateRows: number;
};

export default function Import() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [brokerFormat, setBrokerFormat] = useState("generic");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const previewImport = usePreviewImport();
  const confirmImport = useConfirmImport();
  const { data: batches } = useListImportBatches({ query: { queryKey: getListImportBatchesQueryKey() } });

  const handleFile = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("brokerFormat", brokerFormat);
    previewImport.mutate({ data: fd as unknown as { file: File; brokerFormat?: string; accountId?: number } }, {
      onSuccess: (res) => { setPreview(res); setStep("preview"); },
      onError: () => toast({ title: "Parse error", description: "Could not parse the CSV file.", variant: "destructive" }),
    });
  };

  const handleConfirm = () => {
    if (!preview) return;
    confirmImport.mutate(
      { data: { sessionId: preview.sessionId, skipDuplicates, brokerFormat, rows: preview.rows } },
      {
        onSuccess: (res) => {
          toast({ title: `Imported ${res.savedCount} trades`, description: res.skippedCount > 0 ? `${res.skippedCount} duplicates skipped` : undefined });
          setStep("done");
          qc.invalidateQueries({ queryKey: getListImportBatchesQueryKey() });
        },
        onError: () => toast({ title: "Import failed", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">CSV Import</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "preview", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? "bg-primary text-primary-foreground" : step === "done" && i < 2 || (step === "preview" && i === 0) ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
            <span className={step === s ? "font-medium" : "text-muted-foreground capitalize"}>{s}</span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Label>Broker Format</Label>
                <Select value={brokerFormat} onValueChange={setBrokerFormat}>
                  <SelectTrigger className="w-48" data-testid="select-broker-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Generic CSV</SelectItem>
                    <SelectItem value="mt4">MetaTrader 4</SelectItem>
                    <SelectItem value="mt5">MetaTrader 5</SelectItem>
                    <SelectItem value="ibkr">Interactive Brokers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                data-testid="dropzone"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Drag & drop CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" data-testid="input-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {previewImport.isPending && <div className="text-center text-sm text-muted-foreground animate-pulse">Parsing CSV...</div>}
            </CardContent>
          </Card>

          {/* Import history */}
          {batches && batches.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Import History</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {["File", "Format", "Date", "Rows", "Errors"].map((h) => <th key={h} className="text-left px-5 py-2 text-xs text-muted-foreground uppercase">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {batches.map((b) => (
                      <tr key={b.id} data-testid={`batch-row-${b.id}`} className="hover:bg-muted/20">
                        <td className="px-5 py-2.5 flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-muted-foreground" />{b.filename}</td>
                        <td className="px-5 py-2.5"><Badge variant="secondary" className="text-xs">{b.brokerFormat}</Badge></td>
                        <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{new Date(b.importedAt).toLocaleDateString()}</td>
                        <td className="px-5 py-2.5 font-mono text-xs">{b.rowCount}</td>
                        <td className="px-5 py-2.5">{b.errorCount > 0 ? <Badge variant="destructive" className="text-xs">{b.errorCount}</Badge> : <CheckCircle className="w-3.5 h-3.5 text-success" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2"><Badge variant="secondary">{preview.detectedFormat}</Badge><span className="text-muted-foreground">format detected</span></div>
              <span><span className="font-semibold font-mono">{preview.totalRows}</span> <span className="text-muted-foreground">total rows</span></span>
              <span className="text-success font-semibold font-mono">{preview.validRows} valid</span>
              {preview.duplicateRows > 0 && <span className="text-yellow-500 font-semibold font-mono">{preview.duplicateRows} duplicates</span>}
              {preview.errors.length > 0 && <span className="text-destructive font-semibold font-mono">{preview.errors.length} errors</span>}
              <label className="flex items-center gap-2 cursor-pointer ml-auto">
                <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} data-testid="checkbox-skip-duplicates" className="accent-primary" />
                <span className="text-muted-foreground">Skip duplicates</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    {["#", "Symbol", "Dir", "Entry Date", "Entry $", "Exit $", "Qty", "P&L", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground uppercase font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.map((row) => (
                    <tr key={row.rowIndex} className={`hover:bg-muted/20 ${row.isDuplicate ? "opacity-50" : ""}`} data-testid={`preview-row-${row.rowIndex}`}>
                      <td className="px-3 py-2 text-muted-foreground">{row.rowIndex + 1}</td>
                      <td className="px-3 py-2 font-semibold">{row.symbol}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={`text-xs ${row.direction === "long" ? "border-success text-success" : "border-destructive text-destructive"}`}>{row.direction}</Badge></td>
                      <td className="px-3 py-2 font-mono">{row.entryDate}</td>
                      <td className="px-3 py-2 font-mono">${row.entryPrice?.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono">{row.exitPrice ? `$${row.exitPrice.toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2 font-mono">{row.quantity}</td>
                      <td className={`px-3 py-2 font-mono font-semibold ${row.pnl != null && row.pnl >= 0 ? "text-success" : row.pnl != null ? "text-destructive" : ""}`}>{row.pnl != null ? `$${row.pnl.toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2">{row.isDuplicate ? <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500">Duplicate</Badge> : <CheckCircle className="w-3 h-3 text-success" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
            <Button onClick={handleConfirm} disabled={confirmImport.isPending} data-testid="button-confirm-import">
              {confirmImport.isPending ? "Importing..." : `Import ${skipDuplicates ? preview.validRows - preview.duplicateRows : preview.validRows} trades`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-success mx-auto" />
            <h2 className="text-lg font-semibold">Import complete</h2>
            <p className="text-muted-foreground">Your trades have been imported successfully.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setStep("upload")}>Import another file</Button>
              <Button onClick={() => window.location.href = "/trades"} data-testid="button-view-trades">View trades</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
