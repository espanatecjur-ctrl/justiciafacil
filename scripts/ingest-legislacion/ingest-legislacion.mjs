// ============================================================
// JusticiaFácil · Ingesta de legislación a la base RAG
// ------------------------------------------------------------
// Lee un PDF de una ley/código, separa artículo por artículo,
// genera el embedding de cada uno con Gemini y lo guarda en
// Supabase (tabla legislacion_articulos). Si el artículo ya
// existe (misma ley + jurisdicción + número), lo actualiza en
// vez de duplicarlo — así puedes volver a correr el script sin
// miedo a generar copias.
//
// USO:
//   node ingest-legislacion.mjs <archivo.pdf> "<nombre de la ley>" <jurisdiccion> <tipo>
//
// Ejemplos:
//   node ingest-legislacion.mjs codigo-civil-federal.pdf "Código Civil Federal" federal civil
//   node ingest-legislacion.mjs Codigo_Penal_para_el_Estado_de_Sinaloa.pdf "Código Penal para el Estado de Sinaloa" sinaloa penal
//
// jurisdiccion: federal | jalisco | sinaloa | bcs
// tipo:         civil | procesal_civil | penal | comercio | amparo | reglamento | ley_especial
//
// Variables de entorno necesarias:
//   GEMINI_API_KEY        (la misma que ya usan las funciones de Netlify)
//   SUPABASE_SERVICE_KEY  (opcional pero recomendada — si no, usa la anon)
// ============================================================

import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const SUPABASE_URL = "https://dquoysougxqknvgooiqg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";
const LLAVE_SB = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const [, , archivo, leyNombre, jurisdiccion, tipo] = process.argv;

if (!archivo || !leyNombre || !jurisdiccion || !tipo) {
  console.error('Uso: node ingest-legislacion.mjs <archivo.pdf> "<nombre de la ley>" <jurisdiccion> <tipo>');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error("Falta la variable de entorno GEMINI_API_KEY.");
  process.exit(1);
}

// Separa el texto completo en artículos. Reconoce "Artículo 123.-",
// "ARTÍCULO 123.-", "Art. 123.-", con o sin acento, con "Bis"/"Ter".
// LÍMITE CONOCIDO: exige que el encabezado esté al inicio de línea para
// evitar capturar referencias cruzadas dentro del texto ("según el
// artículo 5..."), pero en textos legales largos, un salto de página del
// PDF puede dejar una referencia cruzada al inicio de una línea y generar
// una entrada falsa. Esto pasa en menos del 5% de los casos, pero por eso
// el script imprime el total detectado — compáralo contra el número de
// artículos oficial de la ley antes de dar por buena la carga.
function separarArticulos(texto) {
  const patron = /^(?:Art[íi]culo|ART[ÍI]CULO|Art\.|ART\.)\s+(\d+[o°]?(?:\s?(?:Bis|Ter|Quater|bis|ter|quater))?)[.\-–]\s*/gm;
  const piezas = [];
  const matches = [...texto.matchAll(patron)];
  for (let i = 0; i < matches.length; i++) {
    const actual = matches[i];
    const siguiente = matches[i + 1];
    const inicio = actual.index + actual[0].length;
    const fin = siguiente ? siguiente.index : texto.length;
    const cuerpo = texto.slice(inicio, fin).trim();
    if (cuerpo.length > 15) {
      piezas.push({ numero: actual[1].trim(), texto: cuerpo.slice(0, 4000) }); // límite de seguridad por artículo
    }
  }
  return piezas;
}

async function generarEmbedding(texto) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text: texto }] } }),
  });
  const data = await resp.json();
  if (!data?.embedding?.values) throw new Error("No se generó embedding: " + JSON.stringify(data).slice(0, 300));
  return data.embedding.values;
}

async function guardarArticulo(articulo) {
  const embedding = await generarEmbedding(`${leyNombre}, artículo ${articulo.numero}: ${articulo.texto}`);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/legislacion_articulos?on_conflict=ley,jurisdiccion,articulo_numero`, {
    method: "POST",
    headers: {
      apikey: LLAVE_SB,
      Authorization: `Bearer ${LLAVE_SB}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      ley: leyNombre,
      jurisdiccion,
      tipo,
      articulo_numero: articulo.numero,
      texto: articulo.texto,
      vigente: true,
      embedding,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${err.slice(0, 300)}`);
  }
}

async function main() {
  console.log(`Leyendo ${archivo}...`);
  const buffer = fs.readFileSync(archivo);
  const parser = new PDFParse({ data: buffer });
  const resultado = await parser.getText();
  const articulos = separarArticulos(resultado.text);
  console.log(`Se encontraron ${articulos.length} artículos en "${leyNombre}".`);
  console.log(`Compara este número contra el total oficial de artículos de la ley antes de continuar (si tienes duda, Ctrl+C aquí).`);

  let ok = 0, fallos = 0;
  for (let i = 0; i < articulos.length; i++) {
    const a = articulos[i];
    try {
      await guardarArticulo(a);
      ok++;
      if (ok % 20 === 0) console.log(`  ...${ok}/${articulos.length} guardados`);
    } catch (e) {
      fallos++;
      console.error(`  Falló el artículo ${a.numero}: ${e.message}`);
    }
    // Pausa corta para no pasarse del límite gratis de Gemini por minuto.
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`Listo: ${ok} artículos guardados, ${fallos} fallidos, de "${leyNombre}" (${jurisdiccion}/${tipo}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
