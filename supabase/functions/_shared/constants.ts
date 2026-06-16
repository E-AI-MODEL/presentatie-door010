/**
 * Shared constants for edge functions.
 * Single source of truth for forbidden terms, knowledge peildatum and models.
 */

// (KNOWLEDGE_AS_OF verwijderd — was nergens geïmporteerd; peildatum komt nu uit
//  per-FAQ veld in retrieval.)

// Termen die de AI nooit mag uitspreken (intern jargon).
export const FORBIDDEN_TERMS: readonly string[] = [
  "fase",
  "intake",
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
// "slot" verwijderd: te generiek in Nederlands ("slot van de avond").

// Modelkeuze per use-case. Centraal zodat we niet per ongeluk preview-models laten staan.
export const MODELS = {
  // Snelle classificatie / phase-detection / korte completions
  fast: "google/gemini-2.5-flash",
  // Hoofdmodel voor orchestrator-replies (publiek + dashboard).
  // gpt-5.4: sterker in bronhiërarchie-afweging en anti-bias dan flash.
  primary: "openai/gpt-5.4",
  // Zware redenering (zelden gebruikt)
  reasoning: "openai/gpt-5.4-pro",
} as const;
