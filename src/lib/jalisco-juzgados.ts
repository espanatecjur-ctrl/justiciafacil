// Catálogo combinado de juzgados de Jalisco: ZMG (zona metro) + Foráneos (municipios).
// Los dos vienen del robot. Cada juzgado trae una bandera "foraneo" para saber
// qué API usa el robot y cómo guardar el nombre_juzgado.

export const ROBOT = "https://robot-boletin-699470444450.us-central1.run.app";

export interface JuzgadoJAL {
  code: string;
  name: string;
  foraneo: boolean;
}

export async function cargarJuzgadosJalisco(): Promise<JuzgadoJAL[]> {
  const [zm, fo] = await Promise.all([
    fetch(`${ROBOT}/jal-judges`).then((r) => r.json()).catch(() => ({ juzgados: [] })),
    fetch(`${ROBOT}/jalf-judges`).then((r) => r.json()).catch(() => ({ juzgados: [] })),
  ]);
  const a: JuzgadoJAL[] = (zm.juzgados || []).map((j: any) => ({ code: j.code, name: (j.name || "").trim(), foraneo: false }));
  const b: JuzgadoJAL[] = (fo.juzgados || []).map((j: any) => ({ code: j.code, name: (j.name || "").trim(), foraneo: true }));
  return [...a, ...b];
}

// Cómo se guarda en caso_juridico.nombre_juzgado (el robot lee el [CÓDIGO] y la palabra "Foráneos")
export function nombreJuzgadoJAL(j: JuzgadoJAL): string {
  return `${j.name} [${j.code}], Jalisco${j.foraneo ? " Foráneos" : ""}`;
}
