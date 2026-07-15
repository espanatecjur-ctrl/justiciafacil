import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { plantillas, renderContrato, valoresIniciales, type PlantillaCampo } from "@/lib/contract-templates";
import type { ContratoTipo } from "@/lib/legal-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Eye, PenLine, RefreshCw, Save, Check, Mail, X } from "lucide-react";
import { z } from "zod";
import { SelectorApoderado } from "@/components/selector-apoderado";
import { VinculoRegistros } from "@/components/vinculo-registros";
import { EditorWord, textoPlanoAHtml, type EditorWordHandle } from "@/components/editor-word";
import { valoresApoderado, cargarApoderados, APODERADO_KEYS, type Apoderado } from "@/lib/apoderados";
import { guardarContrato, listarCartasCambio, siguienteFolio, marcarEnviado, type ContratoGenerado } from "@/lib/contrato-generado";
import { enviarCorreo, textoABase64 } from "@/lib/enviar-correo";
import { buscarClientesJC, type ClienteJC } from "@/lib/juris-clientes";
import { buscarClientesTlajomulco, type ClienteTlajomulco } from "@/lib/clientes-tlajomulco";

/** Resultado unificado del buscador de clientes: combina la tabla propia de
 *  JusticiaFácil (clientes_tlajomulco) y JurisConecta (solo lectura), para
 *  que el selector del editor los muestre juntos sin importar de dónde vienen. */
interface ClienteResultado {
  id: string;
  nombre: string;
  folio: string | null;
  correo: string | null;
  telefono: string | null;
  domicilio: string | null;
  garantia: string | null;
  curp_rfc: string | null;
  valorOperacion: string | null;
  origen: "JusticiaFácil" | "JurisConecta";
}

const searchSchema = z.object({ tipo: z.string().optional() });

export const Route = createFileRoute("/contratos/editor")({
  head: () => ({ meta: [{ title: "Editor de Contratos — SIGA-DIIPA" }] }),
  validateSearch: searchSchema,
  component: EditorContratos,
});

function CampoControl({
  campo,
  valor,
  onChange,
}: {
  campo: PlantillaCampo;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (campo.tipo) {
    case "textarea":
      return <Textarea value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case "select":
      return (
        <select
          value={(valor as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {campo.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox checked={!!valor} onCheckedChange={(v) => onChange(!!v)} id={campo.id} />
          <Label htmlFor={campo.id} className="text-sm font-normal">Sí</Label>
        </div>
      );
    case "number":
      return <Input type="number" value={(valor as number) ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")} />;
    case "date":
      return <Input type="date" value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "lista": {
      const filas = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      const sub = campo.subcampos ?? [];
      const setFilas = (nuevo: Record<string, unknown>[]) => onChange(nuevo);
      return (
        <div className="space-y-2">
          {filas.map((fila, i) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
              <div className="space-y-1.5">
                {sub.map((sc) => (
                  <div key={sc.id}>
                    <label className="text-[11px] text-muted-foreground">{sc.label}</label>
                    <CampoControl
                      campo={sc}
                      valor={fila[sc.id]}
                      onChange={(v) => {
                        const copia = filas.map((f) => ({ ...f }));
                        copia[i] = { ...copia[i], [sc.id]: v };
                        setFilas(copia);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFilas([...filas, {}])}
            className="rounded-md border border-dashed border-input px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted"
          >
            + Agregar {campo.label.toLowerCase()}
          </button>
        </div>
      );
    }
    case "vinculo":
      return <VinculoRegistros fuente={campo.fuente ?? "clientes"} valor={valor} onChange={(v) => onChange(v)} />;
    case "imagen": {
      const url = typeof valor === "string" ? valor : "";
      const onArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onChange(String(reader.result));
        reader.readAsDataURL(file);
        e.target.value = "";
      };
      return (
        <div className="flex items-center gap-3">
          {url ? (
            <>
              <img src={url} alt="Ficha" className="h-16 w-16 rounded border border-border object-cover" />
              <label className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Cambiar ficha
                <input type="file" accept="image/*" className="hidden" onChange={onArchivo} />
              </label>
              <button type="button" onClick={() => onChange("")} className="text-xs font-medium text-red-600 hover:underline">
                Quitar
              </button>
            </>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted">
              + Agregar Ficha
              <input type="file" accept="image/*" className="hidden" onChange={onArchivo} />
            </label>
          )}
        </div>
      );
    }
    default:
      return <Input value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function EditorContratos() {
  const { tipo: tipoQuery } = Route.useSearch();
  const [tipo, setTipo] = useState<ContratoTipo>((tipoQuery as ContratoTipo) || "prestacion_servicios");
  const [custom, setCustom] = useState<import("@/lib/contract-templates").PlantillaContrato | null>(null);
  useEffect(() => {
    if (!plantillas.find((p) => p.tipo === tipo)) {
      import("@/lib/plantilla-custom").then((m) => m.obtenerPlantillaCustom(tipo).then(setCustom));
    } else {
      setCustom(null);
    }
  }, [tipo]);
  const plantilla = useMemo(() => plantillas.find((p) => p.tipo === tipo) ?? custom ?? plantillas[0], [tipo, custom]);
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [apoderadoId, setApoderadoId] = useState<string>("");

  // ---- Leer INE/RFC/CURP y autollenar (IA) ----
  // Detecta qué "partes" tiene la plantilla actual (Cliente, ParteA, ParteB,
  // Garante, Cónyuge, etc.) mirando los sufijos de los campos de nombre.
  const partesDetectadas = useMemo(() => {
    const sufijos = new Set<string>();
    for (const c of plantilla.campos) {
      const m = c.id.match(/^nombre([A-Z][A-Za-z]*)$/);
      if (m) sufijos.add(m[1]);
    }
    return Array.from(sufijos);
  }, [plantilla]);
  const [parteId, setParteId] = useState<string>("");
  useEffect(() => { setParteId(partesDetectadas[0] || ""); }, [partesDetectadas.join(",")]);
  const inputIdRef = useRef<HTMLInputElement>(null);
  const [leyendoId, setLeyendoId] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);

  const archivoABase64 = (file: File): Promise<{ base64: string; mime: string }> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({ base64: String(r.result).split(",")[1] || "", mime: file.type || "application/pdf" });
      r.onerror = () => reject(new Error("No se pudo leer el archivo."));
      r.readAsDataURL(file);
    });

  const leerIdentificacion = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setLeyendoId(true); setErrorId(null); setOkId(null);
    try {
      const documentos = await Promise.all(Array.from(files).map(async (f) => ({ nombre: f.name, ...(await archivoABase64(f)) })));
      const r = await fetch("/.netlify/functions/leer-identificacion", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentos }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) { setErrorId(data.error || `Error ${r.status}`); return; }
      const d = data.datos || {};
      // Solo llena los campos de la PARTE elegida, y solo si están vacíos.
      const sufijo = parteId;
      const asignar: Record<string, unknown> = {};
      const posibles: [string, any][] = [
        [`nombre${sufijo}`, d.nombre_completo],
        [`rfc${sufijo}`, d.rfc],
        [`curp${sufijo}`, d.curp],
        [`domicilio${sufijo}`, d.domicilio],
        [`fechaNacimiento${sufijo}`, d.fecha_nacimiento],
      ];
      let llenados = 0;
      for (const [campoId, valor] of posibles) {
        const existe = plantilla.campos.some((c) => c.id === campoId);
        if (existe && valor && !valores[campoId]) { asignar[campoId] = valor; llenados++; }
      }
      // Caso especial: si la plantilla trae un solo campo "rfc/curp" combinado (rfcParteB, etc.)
      const rfcCurpCombo = `rfc${sufijo}`;
      if (plantilla.campos.some((c) => c.id === rfcCurpCombo && c.label.toLowerCase().includes("curp")) && !valores[rfcCurpCombo] && (d.rfc || d.curp)) {
        asignar[rfcCurpCombo] = d.rfc || d.curp; llenados++;
      }
      setValores((s) => ({ ...s, ...asignar }));
      setOkId(llenados > 0
        ? `✓ Se llenaron ${llenados} campo(s) de "${sufijo || "la parte elegida"}" con lo leído (${d.tipo_documento_detectado || "documento"}).`
        : "La IA leyó el documento pero no encontró campos vacíos para llenar en esta parte (o ya estaban llenos).");
    } catch (e) {
      setErrorId(String((e as Error)?.message || e));
    } finally {
      setLeyendoId(false);
      if (inputIdRef.current) inputIdRef.current.value = "";
    }
  };

  // ---- Subir CUALQUIER documento (PDF/Word) y autollenar (IA) ----
  // A diferencia de leerIdentificacion (que solo lee INE/RFC/CURP con un
  // esquema fijo), esto sirve para CUALQUIER plantilla: manda los campos
  // de la plantilla abierta (id + etiqueta + opciones) y la IA regresa lo
  // que encuentre explícitamente en el documento. Solo llena lo que esté
  // vacío — nunca pisa lo que ya capturaste a mano.
  const inputDocRef = useRef<HTMLInputElement>(null);
  const [leyendoDoc, setLeyendoDoc] = useState(false);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);
  const [okDoc, setOkDoc] = useState<string | null>(null);

  const leerDocumentoGenerico = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setLeyendoDoc(true); setErrorDoc(null); setOkDoc(null);
    try {
      const documentos = await Promise.all(Array.from(files).map(async (f) => ({ nombre: f.name, ...(await archivoABase64(f)) })));
      // Solo campos "de texto" tiene sentido pedírselos a la IA (no imágenes,
      // no vínculos a otros registros, no listas de renglones dinámicos).
      const campos = plantilla.campos
        .filter((c) => ["text", "textarea", "number", "date", "select"].includes(c.tipo))
        .map((c) => ({ id: c.id, label: c.label, opciones: c.opciones }));
      const r = await fetch("/.netlify/functions/leer-documento-generico", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentos, campos }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) { setErrorDoc(data.error || `Error ${r.status}`); return; }
      const d = data.datos || {};
      const asignar: Record<string, unknown> = {};
      let llenados = 0;
      // Campos que suenan a dinero (monto, valor, precio, importe, honorarios,
      // renta, salario, apartado, finiquito, garantia…) se formatean con
      // comas de miles y 2 decimales al copiarse, igual que en el catálogo.
      const esCampoDinero = (id: string) => /monto|valor|precio|importe|honorario|renta|salario|finiquito/i.test(id);
      for (const c of campos) {
        const valor = d[c.id];
        if (valor !== undefined && valor !== null && valor !== "" && !valores[c.id]) {
          asignar[c.id] = esCampoDinero(c.id) ? formatoMoneda(valor) : valor;
          llenados++;
        }
      }
      setValores((s) => ({ ...s, ...asignar }));
      setOkDoc(llenados > 0
        ? `✓ Se llenaron ${llenados} campo(s) a partir del documento subido.`
        : "La IA leyó el documento pero no encontró datos que calzaran con los campos vacíos de esta plantilla.");
    } catch (e) {
      setErrorDoc(String((e as Error)?.message || e));
    } finally {
      setLeyendoDoc(false);
      if (inputDocRef.current) inputDocRef.current.value = "";
    }
  };

  // Apoderados desde Supabase (con la lista de prueba como respaldo inicial).
  const [apoderados, setApoderados] = useState<Apoderado[]>([]);
  useEffect(() => { cargarApoderados().then(setApoderados); }, []);

  // Cartas de Cambio registradas, para auto-llenar el Contrato (Parte C).
  const [cartas, setCartas] = useState<ContratoGenerado[]>([]);
  useEffect(() => {
    if (tipo === "contrato_cambio") listarCartasCambio().then(setCartas);
  }, [tipo]);

  // ── Elegir cliente (JusticiaFácil + JurisConecta) y autollenar ─────────────
  // Busca por nombre/correo/teléfono/folio/domicilio en la tabla propia de
  // JusticiaFácil (clientes_tlajomulco) y en JurisConecta (solo lectura) a la
  // vez, y junta los resultados. Al elegir uno, llena nombre/teléfono/correo/
  // domicilio (y valorOperacion si la tabla propia lo trae) de la parte
  // "Cliente" — y, si la plantilla es de Tlajomulco y la garantía del cliente
  // hace match con una ficha del catálogo, la elige sola también.
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState<ClienteResultado[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteElegido, setClienteElegido] = useState<ClienteResultado | null>(null);
  useEffect(() => {
    const q = busquedaCliente.trim();
    if (q.length < 2) { setResultadosCliente([]); return; }
    let vivo = true;
    setBuscandoCliente(true);
    const t = setTimeout(() => {
      Promise.all([buscarClientesTlajomulco(q), buscarClientesJC(q)]).then(([locales, jc]) => {
        if (!vivo) return;
        // Primero los de la tabla propia de JusticiaFácil (prioridad), luego JurisConecta.
        const combinados: ClienteResultado[] = [
          ...locales.map((c) => ({
            id: `local-${c.id}`, nombre: c.nombre, folio: null, correo: c.correo, telefono: c.telefono,
            domicilio: c.domicilio, garantia: c.domicilio, curp_rfc: null,
            valorOperacion: c.valor_operacion != null ? String(c.valor_operacion) : null,
            origen: "JusticiaFácil" as const,
          })),
          ...jc.map((c) => ({
            id: `jc-${c.id}`, nombre: c.nombre ?? "", folio: c.folio, correo: c.email, telefono: c.telefono,
            domicilio: c.domicilio, garantia: c.garantia, curp_rfc: c.curp_rfc,
            valorOperacion: null as string | null,
            origen: "JurisConecta" as const,
          })),
        ];
        setResultadosCliente(combinados);
        setBuscandoCliente(false);
      });
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [busquedaCliente]);

  const normaliza = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  // Formatea montos con comas de miles y 2 decimales (ej. "235000" -> "235,000.00")
  // para cuando se copian valores automáticamente (catálogo, cliente, IA).
  // Si ya viene con formato, o no es un número reconocible, lo deja tal cual.
  const formatoMoneda = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "";
    const limpio = String(v).replace(/,/g, "").trim();
    const n = Number(limpio);
    if (Number.isNaN(n)) return String(v);
    return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function elegirCliente(c: ClienteResultado) {
    setClienteElegido(c);
    setBusquedaCliente("");
    setResultadosCliente([]);
    const sufijo = "Cliente"; // la mayoría de los machotes usan nombreCliente/telefonoCliente/correoCliente
    const asignar: Record<string, unknown> = {};
    const posibles: [string, unknown][] = [
      [`nombre${sufijo}`, c.nombre],
      [`telefono${sufijo}`, c.telefono],
      [`correo${sufijo}`, c.correo],
      [`domicilio${sufijo}`, c.domicilio],
      [`rfc${sufijo}`, c.curp_rfc],
      [`curp${sufijo}`, c.curp_rfc],
    ];
    for (const [campoId, valor] of posibles) {
      const existe = plantilla.campos.some((x) => x.id === campoId);
      if (existe && valor) asignar[campoId] = valor;
    }
    // Si la tabla propia ya trae el valor de la operación verificado, y la
    // plantilla tiene ese campo vacío, se llena también (con comas de miles).
    if (c.valorOperacion && plantilla.campos.some((x) => x.id === "valorOperacion") && !valores.valorOperacion) {
      asignar.valorOperacion = formatoMoneda(c.valorOperacion);
    }
    setValores((v) => ({ ...v, ...asignar }));

    // Si es un machote de Tlajomulco y la garantía del cliente calza con una
    // ficha del catálogo (por calle/número), la selecciona sola.
    if (esTlajomulco && catalogo.length && c.garantia) {
      const gNorm = normaliza(c.garantia);
      const match = catalogo.find((p) => gNorm.includes(normaliza(p.calle)));
      if (match) elegirDelCatalogo(match.id);
    }
  }

  // ── Catálogo Tlajomulco (Fraccionamiento San Antonio) ──────────────────────
  // Solo aplica a los machotes del "apartado Tlajomulco". Se carga aparte
  // (import perezoso) porque trae las fotos de las 50 fichas y pesa varios MB;
  // así no se descarga en los demás contratos.
  const TIPOS_TLAJOMULCO: ContratoTipo[] = ["acta_entrega_posesion", "instruccion_notarial_diipa", "promesa_invasores", "cesion_adjudicataria"];
  const esTlajomulco = TIPOS_TLAJOMULCO.includes(tipo);
  const RECOMENDADA_ID = "las-primaveras-28-21";
  const [catalogo, setCatalogo] = useState<import("@/lib/catalogo-tlajomulco").PropiedadCatalogo[]>([]);
  const [catalogoId, setCatalogoId] = useState("");
  useEffect(() => {
    if (esTlajomulco && catalogo.length === 0) {
      import("@/lib/catalogo-tlajomulco").then((m) => setCatalogo(m.catalogoTlajomulco));
    }
  }, [esTlajomulco, catalogo.length]);

  // Al elegir una ficha del catálogo, llena los campos que reconozca el machote
  // activo (cada uno usa nombres de campo un poco distintos) y la ficha
  // fotográfica — por eso escribe TODAS las llaves posibles; las que el
  // machote no usa simplemente no se imprimen.
  function elegirDelCatalogo(id: string) {
    setCatalogoId(id);
    const p = catalogo.find((x) => x.id === id);
    if (!p) return;
    const partes = p.calle.split(" ");
    const numero = partes[partes.length - 1];
    const nombreCalle = partes.slice(0, -1).join(" ");
    setValores((v) => ({
      ...v,
      nombreGarantia: p.calle,
      manzana: p.manzana,
      lote: p.lote,
      calleInmueble: nombreCalle,
      numeroInmueble: numero,
      domicilioGarantia: `${p.calle}, Manzana ${p.manzana}, Lote ${p.lote}, ${p.fraccionamiento}, C.P. ${p.cp}, ${p.municipio}`,
      estatusInmueble: `${p.estatusOcupacion} · ${p.estatusObra}`,
      superficieConstruccion: p.construccion,
      superficieTerreno: p.terreno,
      fraccionamiento: `${p.fraccionamiento}, ${p.municipio}`,
      fichaFotografica: p.ficha,
      // Montos verificados (Relación de Cobros Tlajomulco) — solo si esta
      // ficha ya tiene operación registrada; si no, no se tocan estos campos.
      // Se formatean con comas de miles y 2 decimales al copiarse.
      ...(p.valorOperacion ? { valorOperacion: formatoMoneda(p.valorOperacion) } : {}),
      ...(p.montoApartado ? { montoApartado: formatoMoneda(p.montoApartado), estadoApartado: p.estadoApartado } : {}),
      ...(p.montoPagoUno ? { montoPagoUno: formatoMoneda(p.montoPagoUno), estadoPagoUno: p.estadoPagoUno } : {}),
      ...(p.montoPagoDos ? { montoPagoDos: formatoMoneda(p.montoPagoDos), estadoPagoDos: p.estadoPagoDos } : {}),
      ...(p.montoFiniquito ? { montoFiniquito: formatoMoneda(p.montoFiniquito), estadoFiniquito: p.estadoFiniquito } : {}),
    }));
  }

  // Copia los datos de una Carta registrada al Contrato (mismo mapeo que el Paquete).
  function autollenarDesdeCarta(v: Record<string, unknown>) {
    setValores((cur) => {
      const nuevo = { ...cur };
      Object.values(APODERADO_KEYS).forEach((k) => { if (v[k] != null) nuevo[k] = v[k]; });
      if (v.nombreCliente) nuevo.nombreCliente = v.nombreCliente;
      if (v.folioContratoAnterior) nuevo.folioContratoAnterior = v.folioContratoAnterior;
      if (v.valorOperacion) nuevo.valorOperacion = v.valorOperacion;
      if (v.garantiaCambio) nuevo.garantiaNueva = v.garantiaCambio;
      return nuevo;
    });
  }
  const [modo, setModo] = useState<"preview" | "word">("preview");
  // "Semilla" = el contrato ya llenado que se carga al editor Word.
  // Se congela al entrar (o al Regenerar) para no borrar los cambios manuales.
  const [semillaWord, setSemillaWord] = useState<string>("");
  const [claveWord, setClaveWord] = useState(0);
  // Referencia al editor Word para pedirle su contenido REAL justo antes de
  // descargar/enviar (no guardamos ese HTML en estado para no re-renderizar
  // toda la pantalla en cada tecleo — eso era lo que rompía la edición).
  const editorWordRef = useRef<EditorWordHandle | null>(null);

  // Al escoger un apoderado, se copian sus datos a `valores` (auto-llenado).
  // Al quitarlo, se borran esas mismas llaves.
  // Pasa los datos de la Carta de Cambio al Contrato de Cambio (Paquete de Cambio).
  // Conserva el apoderado y mapea los campos que comparten.
  function llenarContrato() {
    setValores((v) => {
      const nuevo: Record<string, unknown> = {};
      Object.values(APODERADO_KEYS).forEach((k) => { if (v[k] != null) nuevo[k] = v[k]; });
      if (v.nombreCliente) nuevo.nombreCliente = v.nombreCliente;
      if (v.folioContratoAnterior) nuevo.folioContratoAnterior = v.folioContratoAnterior;
      if (v.valorOperacion) nuevo.valorOperacion = v.valorOperacion;
      if (v.garantiaCambio) nuevo.garantiaNueva = v.garantiaCambio; // la garantía del cambio
      return nuevo;
    });
    setTipo("contrato_cambio");
    setModo("preview");
    setFolioGuardado(null);
    setFechaGenerado(null);
    setFechaEnviado(null);
  }

  function seleccionarApoderado(a: Apoderado | null) {
    setApoderadoId(a?.id ?? "");
    setValores((s) => {
      const limpio = { ...s };
      Object.values(APODERADO_KEYS).forEach((k) => delete limpio[k]);
      return a ? { ...limpio, ...valoresApoderado(a) } : limpio;
    });
  }

  const camposVisibles = plantilla.campos.filter((c) => {
    if (!c.dependeDe) return true;
    return valores[c.dependeDe.campo] === c.dependeDe.valor;
  });

  // Siembra valores por defecto (p. ej. la cláusula de participación editable)
  // sin pisar lo que ya haya escrito la persona.
  useEffect(() => {
    const defs = valoresIniciales(plantilla);
    setValores((v) => {
      const merged = { ...v };
      for (const k in defs) if (merged[k] === undefined) merged[k] = defs[k];
      return merged;
    });
  }, [plantilla]);

  const cuerpo = renderContrato(plantilla, valores);

  // Guardar el documento con folio real (Parte A/D).
  const [guardando, setGuardando] = useState(false);
  const [folioGuardado, setFolioGuardado] = useState<string | null>(null);

  // ── Parte 1: encabezado (folio en vivo · fechas · quién solicita) ──────────
  // Folio de vista previa: se calcula al elegir el tipo; el real se fija al guardar.
  const [folioPreview, setFolioPreview] = useState<string>("");
  useEffect(() => {
    let vivo = true;
    siguienteFolio(tipo).then((f) => { if (vivo) setFolioPreview(f); });
    return () => { vivo = false; };
  }, [tipo, folioGuardado]);

  // Fechas que se registran solas.
  const [fechaGenerado, setFechaGenerado] = useState<string | null>(null);
  const [fechaEnviado, setFechaEnviado] = useState<string | null>(null);

  // Campos INTERNOS (no se imprimen en el documento): quién solicita y a nombre de quién.
  const [solicitadoPor, setSolicitadoPor] = useState("");
  const [aNombreDe, setANombreDe] = useState("");

  const fmtFechaHora = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : null;

  // Registra el documento una sola vez y devuelve su folio (o el ya asignado).
  async function obtenerFolio(): Promise<string | null> {
    if (folioGuardado) return folioGuardado;
    setGuardando(true);
    const apo = apoderados.find((a) => a.id === apoderadoId);
    const cuantiaNum = parseFloat(String(valores.valorOperacion ?? "").replace(/[^0-9.]/g, "")) || null;
    const folioDoc = String(valores.folioCarta ?? valores.numeroOficio ?? "").trim();
    const ahoraIso = new Date().toISOString();
    const r = await guardarContrato({
      tipo,
      nombre_documento: plantilla.nombre,
      titulo: plantilla.nombre + (folioDoc ? ` — ${folioDoc}` : ""),
      nombre_cliente: String(valores.nombreCliente ?? ""),
      apoderado: apo?.nombre ?? "",
      // Los campos internos (quién solicita) viajan dentro de `valores` — no se imprimen.
      valores: { ...valores, solicitadoPor, aNombreDe } as Record<string, unknown>,
      cuerpo,
      cuantia: cuantiaNum,
      estado: "generado",
      fecha_generado: ahoraIso,
    });
    setGuardando(false);
    if (r.ok && r.folio) { setFolioGuardado(r.folio); setFechaGenerado(ahoraIso); return r.folio; }
    return null;
  }

  async function guardar() {
    const folio = await obtenerFolio();
    if (!folio) window.alert("No se pudo guardar. ¿Corriste el SQL de contrato_generado en el proyecto correcto?");
  }

  // Encabezado de folio que se estampa en cada documento exportado/impreso.
  // Incluye fecha de elaboración y, si ya se mandó, fecha de envío por correo.
  function encabezadoFolio(folio: string | null) {
    if (!folio) return "BORRADOR — documento sin folio registrado";
    const elab = fmtFechaHora(fechaGenerado) ?? new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    const env = fmtFechaHora(fechaEnviado);
    return `Folio: ${folio}    ·    Elaborado: ${elab}${env ? `    ·    Enviado: ${env}` : ""}`;
  }

  // Enviar por correo (sin auto-envío): el mensaje se arma en su propio banner.
  const [mostrarEnviar, setMostrarEnviar] = useState(false);
  const [correoPara, setCorreoPara] = useState("");
  const [asuntoMail, setAsuntoMail] = useState("");
  const [mensajeMail, setMensajeMail] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ccMail, setCcMail] = useState("");
  const [ccoMail, setCcoMail] = useState("");
  const [enviandoSistema, setEnviandoSistema] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState("");

  // Arma el documento como archivo Word (.doc) en base64, para adjuntarlo.
  // OJO: usa contenidoActualHtml() — lo que de verdad está en pantalla
  // (ediciones a mano + ficha ya insertada), no los datos en crudo.
  function construirAdjuntoWord(folio: string | null) {
    const enc = encabezadoFolio(folio);
    const contenido = contenidoActualHtml();
    const html =
      `\ufeff<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>` +
      `<head><meta charset='utf-8'><title>${plantilla.nombre}</title>` +
      `<style>@page{size:21.59cm 27.94cm;margin:2.5cm}body{font-family:'Georgia',serif;font-size:12pt;line-height:1.5;color:#000}img{max-width:100%}</style></head>` +
      `<body><p style="text-align:right;font-size:9pt;color:#555">${enc}</p>` +
      `<h2 style="text-align:center;text-transform:uppercase">${plantilla.nombre}</h2>` +
      `${contenido}</body></html>`;
    return { nombre: `${(folio ?? plantilla.nombre).replace(/\s+/g, "_")}.doc`, tipo: "application/msword", base64: textoABase64(html) };
  }

  // Arma el documento como PDF real (jsPDF se carga solo al enviar).
  // El texto sale completo del machote; si ya se adjuntó la ficha
  // fotográfica, se agrega como página final (jsPDF no puede insertar el
  // resto de las ediciones a mano hechas en el editor — para eso, usa
  // "Imprimir / PDF" desde dentro del editor, ese sí sale con todo).
  async function construirAdjuntoPdf(folio: string | null) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margen = 56;
    const ancho = doc.internal.pageSize.getWidth() - margen * 2;
    const altoPag = doc.internal.pageSize.getHeight();
    let y = margen;
    // Folio + fechas (elaborado / enviado)
    doc.setFont("times", "italic"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(encabezadoFolio(folio), margen, y, { maxWidth: ancho });
    y += 20;
    // Título
    doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(0);
    doc.text(plantilla.nombre.toUpperCase(), doc.internal.pageSize.getWidth() / 2, y, { align: "center", maxWidth: ancho });
    y += 26;
    // Cuerpo
    doc.setFont("times", "normal"); doc.setFontSize(11);
    const ficha = typeof valores.fichaFotografica === "string" && (valores.fichaFotografica as string).startsWith("data:")
      ? (valores.fichaFotografica as string) : null;
    const textoPdf = ficha ? cuerpo.split(MARCADOR_FICHA).join("(fotografía anexa en la última página de este PDF)") : cuerpo;
    const lineas = doc.splitTextToSize(textoPdf, ancho);
    for (const linea of lineas) {
      if (y > altoPag - margen) { doc.addPage(); y = margen; }
      doc.text(linea, margen, y);
      y += 15;
    }
    // Ficha fotográfica: página aparte, centrada y a escala.
    if (ficha) {
      try {
        doc.addPage();
        const props = doc.getImageProperties(ficha);
        const formato = ficha.startsWith("data:image/png") ? "PNG" : "JPEG";
        const wMax = ancho, hMax = altoPag - margen * 2;
        const escala = Math.min(wMax / props.width, hMax / props.height, 1);
        const w = props.width * escala, h = props.height * escala;
        doc.addImage(ficha, formato, margen + (wMax - w) / 2, margen, w, h);
      } catch { /* si el formato de imagen no es compatible con jsPDF, se omite sin tronar el envío */ }
    }
    const base64 = doc.output("datauristring").split(",")[1];
    return { nombre: `${(folio ?? plantilla.nombre).replace(/\s+/g, "_")}.pdf`, tipo: "application/pdf", base64 };
  }

  async function enviarDesdeSistema() {
    if (!correoPara.trim()) { setResultadoEnvio("Escribe al menos un correo en 'Para'."); return; }
    setEnviandoSistema(true);
    setResultadoEnvio("");
    const folio = await obtenerFolio();
    const word = construirAdjuntoWord(folio);
    const pdf = await construirAdjuntoPdf(folio);
    const r = await enviarCorreo({
      para: correoPara,
      cc: ccMail,
      cco: ccoMail,
      asunto: asuntoMail,
      mensaje: mensajeMail,
      folio: folio,
      adjuntos: [word, pdf],
    });
    setEnviandoSistema(false);
    if (r.ok) {
      const iso = new Date().toISOString();
      setFechaEnviado(iso);
      if (folio) await marcarEnviado(folio, iso);
    }
    setResultadoEnvio(r.ok ? "Enviado ✓ (con Word y PDF adjuntos)" : `No se pudo enviar: ${r.error || "revisa la configuración de Resend en Netlify"}`);
  }

  async function abrirEnviar() {
    const folio = await obtenerFolio(); // registra y asegura folio
    setAsuntoMail(`${plantilla.nombre}${folio ? ` — Folio ${folio}` : ""}`);
    setMensajeMail(
      `Estimado(a):\n\n` +
      `Adjunto el documento "${plantilla.nombre}"${folio ? ` con folio ${folio}` : ""} para su revisión.\n\n` +
      `[ Recuerda ADJUNTAR el archivo descargado (Word o PDF) antes de enviar. ]\n\n` +
      `Atentamente,\nDIIPA · Inmuebles Accesibles`,
    );
    setCopiado(false);
    setMostrarEnviar(true);
  }

  const linkGmail = () =>
    `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(correoPara)}&su=${encodeURIComponent(asuntoMail)}&body=${encodeURIComponent(mensajeMail)}`;
  const linkOutlook = () =>
    `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(correoPara)}&subject=${encodeURIComponent(asuntoMail)}&body=${encodeURIComponent(mensajeMail)}`;
  const linkMailto = () =>
    `mailto:${encodeURIComponent(correoPara)}?subject=${encodeURIComponent(asuntoMail)}&body=${encodeURIComponent(mensajeMail)}`;

  async function copiarMensaje() {
    try {
      await navigator.clipboard.writeText(`Para: ${correoPara}\nAsunto: ${asuntoMail}\n\n${mensajeMail}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* nada */ }
  }

  // Reelaborar: si venimos de la tabla con datos guardados, los cargamos (Parte E).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("reelaborar_contrato");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.tipo) setTipo(d.tipo as ContratoTipo);
        if (d.valores) setValores(d.valores as Record<string, unknown>);
        setFolioGuardado(null); // reelaborar = documento nuevo, folio nuevo
        sessionStorage.removeItem("reelaborar_contrato");
      }
    } catch { /* nada */ }
  }, []);

  // Marca en el machote de Acta de Entrega-Recepción de Posesión donde va la
  // fotografía del ANEXO. Al pasar a Editar, si ya se adjuntó la ficha
  // (campo tipo "imagen"), se cambia sola por la imagen real.
  const MARCADOR_FICHA = "[FOTOGRAFÍA DE LA GARANTÍA — se inserta automáticamente al agregar la ficha]";
  function construirSemillaWord(): string {
    let html = textoPlanoAHtml(cuerpo);
    const ficha = valores.fichaFotografica;
    if (typeof ficha === "string" && ficha.startsWith("data:")) {
      html = html.split(MARCADOR_FICHA).join(
        `<img src="${ficha}" style="max-width:420px;display:block;margin:10px auto"/>`,
      );
    }
    return html;
  }
  // Lo que hay que usar AHORA MISMO para descargar/enviar: si ya se entró al
  // editor, se le pide al editor su contenido REAL en este instante (con
  // ediciones a mano); si no, se arma fresco desde los datos (con la ficha).
  function contenidoActualHtml(): string {
    if (modo === "word") {
      const h = editorWordRef.current?.obtenerHtml();
      if (h) return h;
    }
    return construirSemillaWord();
  }
  // Entrar al editor: registra folio y congela el contrato actual.
  async function entrarWord() {
    await obtenerFolio();
    setSemillaWord(construirSemillaWord());
    setClaveWord((k) => k + 1);
    setModo("word");
  }
  // Regenerar: vuelve a cargar desde los datos (descarta cambios manuales).
  function regenerarWord() {
    if (!window.confirm("Esto vuelve a armar el documento desde los datos y se perderán los cambios que hiciste a mano. ¿Continuar?")) return;
    setSemillaWord(construirSemillaWord());
    setClaveWord((k) => k + 1);
  }

  async function exportarTxt() {
    const folio = await obtenerFolio();
    const texto = `${encabezadoFolio(folio)}\n\n${cuerpo}`;
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(folio ?? plantilla.nombre).replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarHtml() {
    const folio = await obtenerFolio();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${plantilla.nombre}</title>
<style>body{font-family:'Libre Baskerville',Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;line-height:1.7;color:#1a1a1a}
h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
.folio{text-align:right;font-size:11px;color:#555;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:14px}
pre{white-space:pre-wrap;font-family:inherit;font-size:14px}</style></head>
<body><div class="folio">${encabezadoFolio(folio)}</div><h1>${plantilla.nombre}</h1><pre>${cuerpo.replace(/</g, "&lt;")}</pre></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(folio ?? plantilla.nombre).replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function imprimir() {
    const folio = await obtenerFolio();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${plantilla.nombre}</title>
<style>body{font-family:'Libre Baskerville',Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;line-height:1.7}
h1{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
.folio{text-align:right;font-size:10px;color:#555;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:12px}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px}</style></head>
<body><div class="folio">${encabezadoFolio(folio)}</div><h1>${plantilla.nombre}</h1><pre>${cuerpo.replace(/</g, "&lt;")}</pre>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Editor de Contratos"
        description="Selecciona una plantilla, llena los datos y exporta el documento listo para revisión o firma."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {folioGuardado ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                <Check className="h-3.5 w-3.5" /> Guardado · {folioGuardado}
              </span>
            ) : folioPreview ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900" title="Número tentativo; se fija al generar">
                Se asignará · {folioPreview}
              </span>
            ) : null}
            <Button onClick={guardar} disabled={guardando} className="bg-[#0B1E3A] hover:bg-[#0B1E3A]/90 text-white">
              <Save className="h-4 w-4 mr-1.5" /> {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="outline" onClick={exportarTxt}><Download className="h-4 w-4 mr-1.5" /> TXT</Button>
            <Button variant="outline" onClick={exportarHtml}><Download className="h-4 w-4 mr-1.5" /> HTML</Button>
            <Button onClick={imprimir} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              <FileText className="h-4 w-4 mr-1.5" /> Imprimir / PDF
            </Button>
            <Button onClick={abrirEnviar} className="bg-[#C2A24C] hover:bg-[#C2A24C]/90 text-[#0B1E3A]">
              <Mail className="h-4 w-4 mr-1.5" /> Enviar
            </Button>
          </div>
        }
      />

      {mostrarEnviar && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => !enviandoSistema && setMostrarEnviar(false)}>
          <div className="my-4 w-[94vw] max-w-6xl rounded-xl bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-base font-bold text-[#0B1E3A]">
                <Mail className="h-5 w-5" /> Enviar por correo
              </p>
              <button onClick={() => setMostrarEnviar(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Columna izquierda: formulario */}
              <div className="grid content-start gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Para (correo)</label>
                  <input type="email" value={correoPara} onChange={(e) => setCorreoPara(e.target.value)} placeholder="correo@cliente.com"
                    className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Asunto</label>
                  <input value={asuntoMail} onChange={(e) => setAsuntoMail(e.target.value)}
                    className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Copia (CC)</label>
                    <input value={ccMail} onChange={(e) => setCcMail(e.target.value)} placeholder="opcional"
                      className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Copia oculta (CCO)</label>
                    <input value={ccoMail} onChange={(e) => setCcoMail(e.target.value)} placeholder="escondidos"
                      className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Mensaje</label>
                  <textarea value={mensajeMail} onChange={(e) => setMensajeMail(e.target.value)} rows={12}
                    className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Columna derecha: vista previa del documento */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Vista previa del documento que se enviará</label>
                <div className="mt-0.5 h-[62vh] overflow-y-auto rounded-md border border-border bg-[oklch(0.99_0.005_85)] p-5">
                  <p className="mb-1 text-right text-[11px] text-muted-foreground">{folioGuardado ? `Folio: ${folioGuardado}` : folioPreview ? `Se asignará: ${folioPreview}` : "Se registrará al enviar"}</p>
                  <p className="mb-3 text-center text-sm font-bold uppercase">{plantilla.nombre}</p>
                  <pre className="whitespace-pre-wrap font-display text-[13px] leading-relaxed text-foreground">{cuerpo}</pre>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Se adjuntan automáticamente <b>Word</b> y <b>PDF</b>.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button onClick={enviarDesdeSistema} disabled={enviandoSistema} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
                <Mail className="h-4 w-4 mr-1.5" /> {enviandoSistema ? "Enviando…" : "Enviar desde el sistema"}
              </Button>
              {resultadoEnvio && (
                <span className={`text-xs font-medium ${resultadoEnvio.startsWith("Enviado") ? "text-emerald-700" : "text-red-700"}`}>{resultadoEnvio}</span>
              )}
              <span className="flex-1" />
              <span className="text-[11px] text-muted-foreground">o abrir en:</span>
              <Button variant="outline" size="sm" onClick={() => window.open(linkGmail(), "_blank")}>Gmail</Button>
              <Button variant="outline" size="sm" onClick={() => window.open(linkOutlook(), "_blank")}>Outlook</Button>
              <Button variant="outline" size="sm" onClick={copiarMensaje}>{copiado ? "Copiado ✓" : "Copiar"}</Button>
            </div>
          </div>
        </div>
      )}

      <Card className="legal-card p-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Plantilla</Label>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as ContratoTipo);
            const a = apoderados.find((x) => x.id === apoderadoId);
            setValores(a ? { ...valoresApoderado(a) } : {});
            setFolioGuardado(null);
            setFechaGenerado(null);
            setFechaEnviado(null);
          }}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {plantillas.map((p) => <option key={p.tipo} value={p.tipo}>{p.nombre}</option>)}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">{plantilla.descripcion}</p>
      </Card>

      <Card className="legal-card p-4">
        <p className="font-display font-bold text-sm mb-3">
          Encabezado del contrato{" "}
          <span className="text-[11px] font-normal text-muted-foreground">(uso interno — no se imprime en el documento)</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs font-medium">Folio</Label>
            <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm">
              {folioGuardado ? folioGuardado : folioPreview ? `Se asignará: ${folioPreview}` : "…"}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Solicitado por</Label>
            <Input className="mt-1" value={solicitadoPor} onChange={(e) => setSolicitadoPor(e.target.value)} placeholder="Quién pide el contrato" />
          </div>
          <div>
            <Label className="text-xs font-medium">A nombre de / para quién</Label>
            <Input className="mt-1" value={aNombreDe} onChange={(e) => setANombreDe(e.target.value)} placeholder="Nombre (texto libre)" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          <b>Elaborado</b> y <b>Enviado</b> se registran solos: al generar y al mandar por correo.
          {fechaGenerado && ` · Elaborado: ${fmtFechaHora(fechaGenerado)}`}
          {fechaEnviado && ` · Enviado: ${fmtFechaHora(fechaEnviado)}`}
        </p>
      </Card>

      <SelectorApoderado
        apoderados={apoderados}
        value={apoderadoId}
        onSelect={seleccionarApoderado}
      />

      <div className="rounded-lg border border-purple-200 bg-purple-50/40 px-4 py-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-purple-800">
          🔍 Elegir cliente (JusticiaFácil / JurisConecta) y autollenar
        </label>
        {clienteElegido ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-900">
              {clienteElegido.nombre}{clienteElegido.folio ? ` · ${clienteElegido.folio}` : ""}
              <span className="ml-1 text-[10px] font-normal text-purple-500">({clienteElegido.origen})</span>
            </span>
            <button type="button" onClick={() => { setClienteElegido(null); }}
              className="text-xs text-purple-700 underline">
              cambiar
            </button>
          </div>
        ) : (
          <div className="relative mt-1">
            <input
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Nombre, correo, teléfono o folio del cliente…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {buscandoCliente && <p className="mt-1 text-[11px] text-muted-foreground">Buscando…</p>}
            {resultadosCliente.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-purple-200 bg-white shadow-lg">
                {resultadosCliente.map((c) => (
                  <button key={c.id} type="button" onClick={() => elegirCliente(c)}
                    className="block w-full border-b border-purple-100 px-3 py-2 text-left text-xs last:border-0 hover:bg-purple-50">
                    <span className="font-medium text-purple-900">{c.nombre}</span>
                    {c.folio && <span className="ml-1 text-purple-600">· {c.folio}</span>}
                    <span className="ml-1 rounded bg-purple-50 px-1 text-[9px] font-semibold text-purple-500">{c.origen}</span>
                    <br />
                    <span className="text-muted-foreground">{[c.correo, c.telefono, c.garantia].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mt-1 text-[11px] text-purple-700">
          Busca al cliente ya dado de alta en JusticiaFácil o JurisConecta y llena solo(a) nombre, teléfono, correo y domicilio de esta plantilla.
          {esTlajomulco && " Si su garantía calza con una ficha del catálogo de abajo, también se elige sola."}
        </p>
      </div>

      {esTlajomulco && (
        <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-4 py-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--teal)]">
            Catálogo Tlajomulco (Fraccionamiento San Antonio)
          </label>
          <select
            value={catalogoId}
            onChange={(e) => elegirDelCatalogo(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {catalogo.length ? `— Elige una de las ${catalogo.length} fichas —` : "Cargando catálogo…"}
            </option>
            {catalogo.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === RECOMENDADA_ID ? "★ " : ""}{p.calle} — Manzana {p.manzana}, Lote {p.lote} · {p.estatusOcupacion} / {p.estatusObra}
                {p.clienteReferencia ? ` · ${p.clienteReferencia}` : ""}{p.valorOperacion ? ` · $${Number(p.valorOperacion).toLocaleString("es-MX")}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-[color:var(--teal)]/80">
            Llena garantía, manzana, lote, domicilio, superficie, estatus y la ficha fotográfica de una sola vez.
            {" "}★ = recomendada (Las Primaveras 28: terminada, con la información más completa de las 50).
            {" "}Las fichas con cliente y $ ya traen también el estado de cuenta verificado (apartado, 35%, 50%, finiquito).
          </p>
        </div>
      )}

      {tipo === "contrato_cambio" && (
        <div className="rounded-lg border border-[color:var(--gold,#C2A24C)]/40 bg-amber-50/60 px-4 py-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Auto-llenar desde una Carta de Cambio registrada
          </label>
          <select
            defaultValue=""
            onChange={(e) => {
              const c = cartas.find((x) => x.id === e.target.value);
              if (c?.valores) autollenarDesdeCarta(c.valores as Record<string, unknown>);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {cartas.length ? "— Escoge una carta registrada —" : "No hay cartas guardadas todavía"}
            </option>
            {cartas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.folio || "s/folio"} · {c.nombre_cliente || "sin cliente"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-amber-800/80">
            Jala cliente, folio anterior, garantía y valor de la carta que escojas. Lo demás lo completas abajo.
          </p>
        </div>
      )}

      {tipo === "carta_cambio" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-4 py-3">
          <p className="text-sm text-foreground/80">
            <span className="font-semibold">Paquete de Cambio:</span> al terminar la Carta, pasa sus datos al Contrato de Cambio (cliente, folio anterior, garantía y valor).
          </p>
          <Button onClick={llenarContrato} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <FileText className="h-4 w-4 mr-1.5" /> Llenar Contrato de Cambio →
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="legal-card">
          <CardContent className="p-5 max-h-[70vh] overflow-y-auto">
            <p className="font-display font-bold text-base mb-4">Datos del contrato</p>

            {partesDetectadas.length > 0 && (
              <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <p className="text-xs font-semibold text-purple-900">📎 Subir INE / RFC / CURP y autollenar (IA)</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={parteId} onChange={(e) => setParteId(e.target.value)}
                    className="h-8 rounded-md border border-purple-300 bg-white px-2 text-xs">
                    {partesDetectadas.map((s) => {
                      const campoNombre = plantilla.campos.find((c) => c.id === `nombre${s}`);
                      return <option key={s} value={s}>{campoNombre?.label || s}</option>;
                    })}
                  </select>
                  <button type="button" onClick={() => inputIdRef.current?.click()} disabled={leyendoId}
                    className="inline-flex items-center gap-1.5 rounded-md bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-60">
                    {leyendoId ? "✨ Leyendo…" : "✨ Subir y leer"}
                  </button>
                  <input ref={inputIdRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => leerIdentificacion(e.target.files)} />
                </div>
                <p className="mt-1 text-[11px] text-purple-700">Elige a qué parte pertenece la identificación, sube la foto/PDF (puedes subir varias a la vez: INE, RFC, CURP) y se llenan solo los campos vacíos de esa parte.</p>
                {errorId && <p className="mt-1 text-[11px] text-red-600">{errorId}</p>}
                {okId && <p className="mt-1 text-[11px] text-emerald-700">{okId}</p>}
              </div>
            )}

            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold text-amber-900">✨ Subir cualquier documento y autollenar (IA)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => inputDocRef.current?.click()} disabled={leyendoDoc}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60">
                  {leyendoDoc ? "✨ Leyendo…" : "✨ Subir y leer"}
                </button>
                <input ref={inputDocRef} type="file" accept=".pdf,.doc,.docx,image/*" multiple className="hidden" onChange={(e) => leerDocumentoGenerico(e.target.files)} />
              </div>
              <p className="mt-1 text-[11px] text-amber-700">Sube un acta, contrato firmado, listado de datos, etc. (PDF, Word o foto — hasta 4 a la vez) y se llenan solos los campos vacíos de este formulario que la IA encuentre explícitamente en el documento.</p>
              {errorDoc && <p className="mt-1 text-[11px] text-red-600">{errorDoc}</p>}
              {okDoc && <p className="mt-1 text-[11px] text-emerald-700">{okDoc}</p>}
            </div>

            <div className="space-y-3">
              {camposVisibles.map((c) => (
                <div key={c.id}>
                  <Label className="text-xs font-medium">
                    {c.label}{c.requerido && <span className="text-[color:var(--legal)] ml-0.5">*</span>}
                  </Label>
                  <div className="mt-1">
                    <CampoControl campo={c} valor={valores[c.id]} onChange={(v) => setValores((s) => ({ ...s, [c.id]: v }))} />
                  </div>
                  {c.ayuda && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.ayuda}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="legal-card bg-[oklch(0.99_0.005_85)]">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setModo("preview")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${modo === "preview" ? "bg-[color:var(--teal)] text-white" : "bg-background text-foreground/70 hover:bg-muted"}`}
                >
                  <Eye className="h-3.5 w-3.5" /> Vista previa
                </button>
                <button
                  onClick={entrarWord}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${modo === "word" ? "bg-[color:var(--teal)] text-white" : "bg-background text-foreground/70 hover:bg-muted"}`}
                >
                  <PenLine className="h-3.5 w-3.5" /> Editar
                </button>
              </div>
              {modo === "word" && (
                <Button variant="outline" size="sm" onClick={regenerarWord} title="Volver a armar desde los datos">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerar
                </Button>
              )}
            </div>

            {modo === "preview" ? (
              <>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1">Vista previa</p>
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-center mb-6">{plantilla.nombre}</h2>
                <pre className="whitespace-pre-wrap font-display text-[13px] leading-relaxed text-foreground">{cuerpo}</pre>
                <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground">
                  <div><div className="border-t border-foreground/50 pt-1">Parte A</div></div>
                  <div><div className="border-t border-foreground/50 pt-1">Parte B</div></div>
                </div>
              </>
            ) : (
              <EditorWord ref={editorWordRef} key={claveWord} initialHtml={semillaWord} titulo={plantilla.nombre} folio={folioGuardado} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
