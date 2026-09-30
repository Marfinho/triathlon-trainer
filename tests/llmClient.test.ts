import { describe, it, expect, vi, afterEach } from "vitest";
import { callLlm, isLlmConfigured } from "@/integrations/llm/client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isLlmConfigured", () => {
  it("ist false ohne jeden Provider", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(isLlmConfigured()).toBe(false);
  });

  it("ist true mit OPENAI_API_KEY allein", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(isLlmConfigured()).toBe(true);
  });
});

describe("callLlm", () => {
  it("wirft bei keinem konfigurierten Provider", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(callLlm("Hallo")).rejects.toThrow(/Keine LLM-API konfiguriert/);
  });

  it("bevorzugt Anthropic, wenn beide Keys gesetzt sind", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"plan":"ok"}' }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlm("Hallo");

    expect(result).toBe('{"plan":"ok"}');
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("nutzt OpenAI, wenn nur OPENAI_API_KEY gesetzt ist", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "antwort" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await callLlm("Hallo")).toBe("antwort");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("kürzt lange Fehlertexte des Anbieters", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "x".repeat(5000) }),
    );
    const err = await callLlm("Hallo").catch((e: Error) => e);
    expect((err as Error).message.length).toBeLessThan(600);
  });
});
