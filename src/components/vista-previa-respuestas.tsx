// ============================================================
// VistaPreviaRespuestas · muestra TODO lo capturado en el
// cuestionario de URRJ (posición Actor), agrupado por hito, en
// modo solo lectura. Se usa en la ficha (ficha-urrj.tsx) y en la
// pantalla de elegir posición (dictaminador-posicion.tsx) para
// que se pueda ver lo ya llenado sin reabrir el proceso.
// ============================================================

const GRUPOS_RESPUESTAS: { titulo: string; campos: { clave: string; etiqueta: string }[] }[] = [
  {
    titulo: "Datos básicos",
    campos: [
      { clave: "numeroCredito", etiqueta: "Número de crédito" },
      { clave: "juzgado", etiqueta: "Juzgado" },
      { clave: "ubicacion", etiqueta: "Ubicación" },
      { clave: "deudor", etiqueta: "Deudor" },
      { clave: "quienCede", etiqueta: "Quién cede" },
      { clave: "queCede", etiqueta: "Qué cede" },
      { clave: "tipoJuicio", etiqueta: "Tipo de juicio" },
      { clave: "estado", etiqueta: "Estado" },
    ],
  },
  {
    titulo: "H1 · Registral",
    campos: [
      { clave: "hipotecaInscrita", etiqueta: "Hipoteca inscrita" },
      { clave: "prelacion", etiqueta: "Prelación" },
      { clave: "propietario", etiqueta: "Propietario" },
      { clave: "anotaciones", etiqueta: "Anotaciones" },
    ],
  },
  {
    titulo: "H2 · Estado procesal",
    campos: [
      { clave: "etapa", etiqueta: "Etapa" },
      { clave: "sentenciaFirme", etiqueta: "Sentencia firme" },
      { clave: "situacion", etiqueta: "Situación" },
      { clave: "ultimaActuacion", etiqueta: "Última actuación" },
      { clave: "ultimaActuacionTexto", etiqueta: "Texto de la última actuación" },
      { clave: "declaradoRebeldia", etiqueta: "Declarado rebeldía" },
      { clave: "hayAdjudicacionDirecta", etiqueta: "Adjudicación directa" },
      { clave: "adjudicacionFirme", etiqueta: "Adjudicación firme" },
      { clave: "hayIncidenteNulidad", etiqueta: "Incidente de nulidad" },
      { clave: "sentenciaEjecutoria", etiqueta: "Sentencia ejecutoriada" },
      { clave: "detalleProcesal", etiqueta: "Detalle procesal" },
    ],
  },
  {
    titulo: "H3 · Prescripción y caducidad",
    campos: [
      { clave: "ultimoPago", etiqueta: "Último pago" },
      { clave: "emplazado", etiqueta: "Emplazado" },
      { clave: "fechaEmplazamiento", etiqueta: "Fecha de emplazamiento" },
      { clave: "tipoAccion", etiqueta: "Tipo de acción" },
      { clave: "convenioRatificado", etiqueta: "Convenio ratificado" },
      { clave: "convenioFecha", etiqueta: "Fecha del convenio" },
      { clave: "plazoPrescManual", etiqueta: "Plazo prescripción (manual)" },
      { clave: "plazoCaducManual", etiqueta: "Plazo caducidad (manual)" },
    ],
  },
  {
    titulo: "H4 · Posesión",
    campos: [
      { clave: "quienPosee", etiqueta: "Quién posee" },
      { clave: "inicioPosesion", etiqueta: "Inicio de posesión" },
      { clave: "buenaFe", etiqueta: "Buena fe" },
      { clave: "demandaDespojo", etiqueta: "Demanda de despojo" },
      { clave: "interpelacionJV", etiqueta: "Interpelación judicial" },
      { clave: "interpelacionJVFecha", etiqueta: "Fecha de interpelación" },
      { clave: "interpelacionTipo", etiqueta: "Tipo de interpelación" },
      { clave: "interpelacionExpediente", etiqueta: "Expediente de interpelación" },
      { clave: "interpelacionJuzgado", etiqueta: "Juzgado de interpelación" },
    ],
  },
  {
    titulo: "H5 · Cargas ocultas",
    campos: [
      { clave: "predial", etiqueta: "Predial" },
      { clave: "agua", etiqueta: "Agua" },
      { clave: "condominio", etiqueta: "Condominio" },
      { clave: "fiscales", etiqueta: "Fiscales" },
      { clave: "laborales", etiqueta: "Laborales" },
      { clave: "otrosGravamenes", etiqueta: "Otros gravámenes" },
    ],
  },
  {
    titulo: "H6 · Financiero / viabilidad",
    campos: [
      { clave: "capital", etiqueta: "Capital" },
      { clave: "tasaOrd", etiqueta: "Tasa ordinaria" },
      { clave: "tasaMor", etiqueta: "Tasa moratoria" },
      { clave: "dias", etiqueta: "Días" },
      { clave: "aplicarIVA", etiqueta: "Aplicar IVA" },
      { clave: "gastos", etiqueta: "Gastos" },
      { clave: "valorUDI", etiqueta: "Valor UDI" },
      { clave: "fechaCorte", etiqueta: "Fecha de corte" },
      { clave: "valorComercial", etiqueta: "Valor comercial" },
      { clave: "precioCesion", etiqueta: "Precio de cesión" },
      { clave: "costosOperativos", etiqueta: "Costos operativos" },
      { clave: "margenObjetivo", etiqueta: "Margen objetivo" },
    ],
  },
  {
    titulo: "Anotaciones del abogado",
    campos: [{ clave: "anotacionesHumanas", etiqueta: "Anotaciones" }],
  },
];

export function VistaPreviaRespuestas({ datos }: { datos: any }) {
  if (!datos) return <p className="text-muted-foreground">Sin datos capturados todavía.</p>;
  const grupos = GRUPOS_RESPUESTAS.map((g) => ({
    ...g,
    llenos: g.campos.filter((c) => {
      const v = datos[c.clave];
      return v !== undefined && v !== null && String(v).trim() !== "";
    }),
  })).filter((g) => g.llenos.length > 0);

  const hallazgos: string[] = Array.isArray(datos.hallazgos) ? datos.hallazgos : [];
  const precio = datos.precio;

  if (grupos.length === 0 && hallazgos.length === 0 && !precio?.precioPiso) {
    return <p className="text-muted-foreground">Sin respuestas capturadas todavía en el cuestionario.</p>;
  }

  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <div key={g.titulo} className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <p className="mb-1 font-semibold text-foreground">{g.titulo}</p>
          <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
            {g.llenos.map((c) => (
              <div key={c.clave} className="text-muted-foreground">
                {c.etiqueta}: <span className="text-foreground">{String(datos[c.clave])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {hallazgos.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <p className="mb-1 font-semibold text-foreground">Hallazgos del boletín</p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {hallazgos.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}
      {precio?.precioPiso && (
        <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
          <p className="mb-1 font-semibold text-[color:var(--teal)]">Precio (Contabilidad)</p>
          <div className="text-muted-foreground">Precio piso: <span className="text-foreground">${precio.precioPiso}</span> · Honorarios: <span className="text-foreground">{precio.honorariosPct || 0}%</span></div>
        </div>
      )}
    </div>
  );
}
