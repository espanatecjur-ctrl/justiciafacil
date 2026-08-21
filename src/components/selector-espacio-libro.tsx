// ============================================================
// JusticiaFácil · Selector de espacio del libro
// ------------------------------------------------------------
// Un desplegable chiquito que pregunta EN QUÉ HOJA DEL LIBRO va el
// documento que se está registrando.
//
// PARA QUÉ SIRVE
// Antes, al relacionar un papel con su digital, el documento quedaba
// guardado pero suelto — nadie sabía a qué parte del expediente
// pertenecía. Con esto, en el mismo paso queda acomodado.
//
// SE AUTO-LLENA
// Cuando el usuario escribe el nombre del documento, el clasificador
// adivina el espacio y lo pre-selecciona. El usuario solo confirma o
// lo cambia si se equivocó. No hay que llenar un campo más.
// ============================================================

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { catalogoDelLibro, clasificarDocumento, type EspacioLibro } from "@/lib/libro-carpeta";

interface Props {
  /** Nombre que el usuario escribió — de aquí se adivina el espacio. */
  nombreDocumento: string;
  /** Tipo de asunto elegido en el modal (demanda civil, penal, etc.). */
  tipoAsunto?: string | null;
  /** Espacio elegido ahorita (clave de la subsección), o null. */
  valor: string | null;
  onChange: (subseccionClave: string, apartadoNum: number) => void;
}

export function SelectorEspacioLibro({ nombreDocumento, tipoAsunto, valor, onChange }: Props) {
  const [catalogo, setCatalogo] = useState<EspacioLibro[]>([]);
  const [fueSugerido, setFueSugerido] = useState(false);

  // Trae los espacios del catálogo una sola vez.
  useEffect(() => {
    catalogoDelLibro().then(setCatalogo);
  }, []);

  // Cada vez que cambia el nombre, vuelve a adivinar — pero SOLO si el
  // usuario no ha elegido nada a mano todavía. Si ya eligió, se respeta.
  useEffect(() => {
    if (catalogo.length === 0) return;
    if (valor && !fueSugerido) return; // el usuario decidió: no lo pisamos

    const clave = clasificarDocumento(tipoAsunto ?? null, nombreDocumento);
    const espacio = catalogo.find((e) => e.subseccionClave === clave)
      ?? catalogo.find((e) => e.subseccionClave === "otro");

    if (espacio && espacio.subseccionClave !== valor) {
      setFueSugerido(true);
      onChange(espacio.subseccionClave, espacio.apartadoNum);
    }
  }, [nombreDocumento, tipoAsunto, catalogo]);

  // Agrupa por apartado para que el desplegable se lea como el libro.
  const porApartado = catalogo.reduce<Record<string, EspacioLibro[]>>((acc, e) => {
    const k = `${e.apartadoNum} · ${e.apartadoNombre}`;
    (acc[k] ||= []).push(e);
    return acc;
  }, {});

  function elegir(clave: string) {
    const espacio = catalogo.find((e) => e.subseccionClave === clave);
    if (!espacio) return;
    setFueSugerido(false); // ya lo eligió una persona, deja de adivinarse
    onChange(espacio.subseccionClave, espacio.apartadoNum);
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        ¿En qué espacio del libro va?
      </label>
      <select
        value={valor ?? ""}
        onChange={(e) => elegir(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">— Elige el espacio —</option>
        {Object.entries(porApartado).map(([apartado, espacios]) => (
          <optgroup key={apartado} label={apartado}>
            {espacios.map((e) => (
              <option key={e.subseccionClave} value={e.subseccionClave}>
                {e.subseccionNombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {fueSugerido && valor && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
          <Sparkles className="h-3 w-3" />
          Sugerido por el nombre del documento — cámbialo si no es
        </p>
      )}
    </div>
  );
}
