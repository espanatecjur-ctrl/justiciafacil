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
