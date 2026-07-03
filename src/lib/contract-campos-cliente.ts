// ============================================================================
//  Campos reutilizables del CLIENTE (Parte 2)
//  --------------------------------------------------------------------------
//  Se comparten entre los machotes de cliente (Prestación DIIPA, Acta,
//  Contrato de Cambio y Carta de Cambio) para no repetir la definición.
//  Solo importa el TIPO de contract-templates (se borra en tiempo de
//  ejecución), así que no crea ciclos.
// ============================================================================
import type { PlantillaCampo } from "./contract-templates";

/** Teléfono y correo del cliente. */
export const clienteContactoCampos: PlantillaCampo[] = [
  { id: "telefonoCliente", label: "Teléfono del Cliente", tipo: "text" },
  { id: "correoCliente", label: "Correo del Cliente", tipo: "text" },
];

/** Estado civil del cliente; si es casado(a), abre régimen, cónyuge y consentimiento. */
export const clienteEstadoCivilCampos: PlantillaCampo[] = [
  { id: "estadoCivilCliente", label: "Estado civil del Cliente", tipo: "select", opciones: ["soltero(a)", "casado(a)", "divorciado(a)", "viudo(a)"] },
  { id: "regimenCliente", label: "Régimen matrimonial", tipo: "select", opciones: ["sociedad conyugal", "separación de bienes"], dependeDe: { campo: "estadoCivilCliente", valor: "casado(a)" } },
  { id: "conyugeCliente", label: "Nombre del cónyuge", tipo: "text", dependeDe: { campo: "estadoCivilCliente", valor: "casado(a)" } },
  { id: "consentimientoConyugalCliente", label: "Cuenta con consentimiento conyugal por escrito", tipo: "checkbox", dependeDe: { campo: "estadoCivilCliente", valor: "casado(a)" } },
];

/** El cliente comparece por apoderado; si sí, abre nombre y datos del poder. */
export const clienteApoderadoCampos: PlantillaCampo[] = [
  { id: "clienteComparecePorApoderado", label: "El Cliente comparece por apoderado", tipo: "checkbox" },
  { id: "nombreApoderadoCliente", label: "Nombre del apoderado del Cliente", tipo: "text", dependeDe: { campo: "clienteComparecePorApoderado", valor: true } },
  { id: "poderApoderadoCliente", label: "Datos del poder (No. de escritura, notario y plaza)", tipo: "textarea", dependeDe: { campo: "clienteComparecePorApoderado", valor: true } },
];

/** Lista de testigos (repetidor sin límite). Se imprimen en el bloque de firmas. */
export const testigosCampo: PlantillaCampo[] = [
  {
    id: "testigos",
    label: "Testigos",
    tipo: "lista",
    ayuda: "Agrega los testigos que necesites; se imprimen en las firmas. (Si no agregas ninguno, no se imprime nada.)",
    subcampos: [
      { id: "nombre", label: "Nombre del testigo", tipo: "text" },
      { id: "identificacion", label: "Identificación (opcional)", tipo: "text" },
    ],
  },
];

/** Texto propuesto y editable de la cláusula de participación de beneficiarios. */
const CLAUSULA_PARTICIPACION_DEFAULT =
  "CLÁUSULA DE PARTICIPACIÓN DE BENEFICIARIOS. El Cliente designa como beneficiarios del presente contrato a las personas señaladas, en los porcentajes de participación indicados. En caso de fallecimiento o imposibilidad del Cliente, los beneficiarios recibirán los derechos y prestaciones derivados de este instrumento en la proporción establecida, debiendo la suma de los porcentajes ser del 100% (cien por ciento). Esta designación podrá ser modificada o revocada por el Cliente en cualquier momento mediante aviso por escrito al Prestador. En lo no previsto, se estará a las disposiciones del Código Civil aplicable en materia de sucesiones y designación de beneficiarios.";

/** Lista de beneficiarios (con % de participación) + cláusula editable. */
export const beneficiariosCampos: PlantillaCampo[] = [
  {
    id: "beneficiarios",
    label: "Beneficiarios del contrato",
    tipo: "lista",
    ayuda: "Agrega beneficiarios con su porcentaje. Se imprimen solo si agregas al menos uno.",
    subcampos: [
      { id: "nombre", label: "Nombre completo", tipo: "text" },
      { id: "parentesco", label: "Parentesco / relación", tipo: "text" },
      { id: "telefono", label: "Teléfono", tipo: "text" },
      { id: "participacion", label: "% de participación", tipo: "number" },
    ],
  },
  {
    id: "clausulaParticipacion",
    label: "Cláusula de participación (editable)",
    tipo: "textarea",
    ayuda: "Propuesta editable. Solo se imprime si hay beneficiarios.",
    valorInicial: CLAUSULA_PARTICIPACION_DEFAULT,
  },
];
