/**
 * Shared constants for edge functions.
 * Single source of truth for forbidden terms, knowledge peildatum and models.
 */

// Datum waarop salaris/collegegeld/CAO data laatst geverifieerd is.
// Update dit bij elke data-refresh; AI gebruikt dit voor "geverifieerd <maand>"-disclaimer.
export const KNOWLEDGE_AS_OF = "mei 2026";

// Termen die de AI nooit mag uitspreken (intern jargon).
export const FORBIDDEN_TERMS: readonly string[] = [
  "fase",
  "intake",
  "slot",
  "detector",
  "peildatum",
  "kennisbank",
  "scenario",
  "als ai",
  "goed dat je dit vraagt",
  "ik begrijp je helemaal",
  "je moet",
  "globaal zo uit",
];

// Modelkeuze per use-case. Centraal zodat we niet per ongeluk preview-models laten staan.
export const MODELS = {
  // Snelle classificatie / phase-detection / korte completions
  fast: "google/gemini-2.5-flash",
  // Hoofdmodel voor orchestrator-replies (publiek + dashboard)
  primary: "google/gemini-2.5-flash",
  // Zware redenering (zelden gebruikt)
  reasoning: "google/gemini-2.5-pro",
} as const;
