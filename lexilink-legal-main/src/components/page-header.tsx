import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--teal)]">
            {eyebrow}
          </p>
        )}
        <h1 className="section-title mt-1">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "legal" | "teal" | "warning";
}) {
  const toneClass = {
    default: "border-border",
    legal: "border-[color:var(--legal)]/40 [&_.v]:text-[color:var(--legal)]",
    teal: "border-[color:var(--teal)]/40 [&_.v]:text-[color:var(--teal)]",
    warning: "border-amber-400/40 [&_.v]:text-amber-600",
  }[tone];
  return (
    <div className={`legal-card relative overflow-hidden p-4 ${toneClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="v mt-1 font-display text-3xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
