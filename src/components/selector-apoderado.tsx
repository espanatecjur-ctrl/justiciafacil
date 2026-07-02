// ============================================================
//  SelectorApoderado · "Firma por la empresa"
// ------------------------------------------------------------
//  Muestra la lista de apoderados. Al escoger uno, avisa al editor
//  (onSelect) para que copie sus datos al contrato (auto-llenado) y
//  enseña un resumen de la escritura de su poder para verificar.
// ============================================================
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserCheck, ScrollText } from "lucide-react";
import type { Apoderado } from "@/lib/apoderados";

export function SelectorApoderado({
  apoderados,
  value,
  onSelect,
}: {
  apoderados: Apoderado[];
  value: string;
  onSelect: (a: Apoderado | null) => void;
}) {
  const activos = apoderados.filter((a) => a.activo !== false);
  const sel = apoderados.find((a) => a.id === value) ?? null;

  return (
    <Card className="legal-card p-4">
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-[color:var(--teal)]" />
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Firma por la empresa (Apoderado)
        </Label>
      </div>

      <select
        value={value}
        onChange={(e) => {
          const a = apoderados.find((x) => x.id === e.target.value) ?? null;
          onSelect(a);
        }}
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">— Sin apoderado seleccionado —</option>
        {activos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre} · {a.cargo}
          </option>
        ))}
      </select>

      {sel && (
        <div className="mt-3 rounded-md border border-dashed border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ScrollText className="h-3.5 w-3.5 text-[color:var(--teal)]" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--teal)]">
              Datos que se auto-llenan al firmar
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <div className="col-span-2">
              <dt className="text-muted-foreground">Firma como</dt>
              <dd className="font-medium">{sel.nombre} — {sel.cargo}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Tipo de poder</dt>
              <dd className="font-medium">{sel.tipoPoder}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Escritura del poder</dt>
              <dd className="font-medium tabular-nums">
                No. {sel.escrituraNumero}
                {sel.volumen && sel.volumen !== "—" ? ` · Vol. ${sel.volumen}` : ""}
                {sel.libro && sel.libro !== "—" ? ` · Libro ${sel.libro}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha del poder</dt>
              <dd className="font-medium">{sel.fechaPoder}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Notario</dt>
              <dd className="font-medium">
                {sel.notario} · Notaría {sel.numeroNotaria}, {sel.estadoNotaria}
              </dd>
            </div>
          </dl>
          {(sel.escrituraNumero === "0000" || sel.fechaPoder.includes("mes")) && (
            <Badge className="mt-2 bg-amber-100 text-amber-900 text-[10px]">
              Datos de prueba — falta capturar la escritura real
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}
