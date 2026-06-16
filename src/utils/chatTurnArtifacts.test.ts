import { describe, expect, it } from "vitest";
import { normalizeTurnArtifacts } from "./chatTurnArtifacts";

describe("normalizeTurnArtifacts", () => {
  it("turns doubt into a choice-help question artifact", () => {
    const artifacts = normalizeTurnArtifacts({
      user_message: "Ik twijfel of onderwijs wel bij me past.",
      actions: [{ label: "Routes", value: "Welke routes zijn er?" }],
    });

    expect(artifacts).toEqual([
      expect.objectContaining({
        kind: "question",
        label: "Help me kiezen",
        source: "doubt",
      }),
    ]);
  });

  it("keeps a source separate from a question", () => {
    const artifacts = normalizeTurnArtifacts({
      user_message: "Welke route past bij mij?",
      actions: [{ label: "Routes", value: "Kun je me door de routes praten?" }],
      links: [{ label: "Routes en opleidingen", href: "/opleidingen" }],
    });

    expect(artifacts.map((a) => a.kind)).toEqual(["question", "source"]);
  });

  it("uses a decision artifact as replacement for question and source artifacts", () => {
    const artifacts = normalizeTurnArtifacts({
      user_message: "ok",
      actions: [{ label: "Routes", value: "Kun je me door de routes praten?" }],
      links: [{ label: "Routes en opleidingen", href: "/opleidingen" }],
      phase_suggestion: {
        from: "interesseren",
        to: "orienteren",
        message: "Wil je verder kijken naar routes?",
        acceptMessage: "Vertel me meer over routes voor mijn situatie.",
      },
    });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      kind: "decision",
      message: "Wil je verder kijken naar routes?",
      acceptValue: "Vertel me meer over routes voor mijn situatie.",
    });
  });

  it("renders useful confidence as non-clickable status", () => {
    const artifacts = normalizeTurnArtifacts({
      user_message: "Ik weet het niet.",
      confidence: 0.42,
      include_status: true,
    });

    expect(artifacts.some((artifact) => artifact.kind === "status")).toBe(true);
    expect(artifacts.find((artifact) => artifact.kind === "status")).toMatchObject({ label: "Nog niet zeker" });
  });

  it("does not suggest the exact question the user just asked", () => {
    const artifacts = normalizeTurnArtifacts({
      user_message: "Hoe ziet zo'n traject er voor mij uit?",
      actions: [
        { label: "Hoe ziet zo'n traject er voor mij uit?", value: "Hoe ziet zo'n traject er voor mij uit?" },
        { label: "Wat kan ik straks ongeveer verdienen?", value: "Wat kan ik straks ongeveer verdienen?" },
      ],
    });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ kind: "question", label: "Wat kan ik straks ongeveer verdienen?" });
  });
});
