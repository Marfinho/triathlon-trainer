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
    vi.stubEnv("OLLAMA_BASE_URL", "");
    expect(isLlmConfigured()).toBe(false);
  });

  it("ist true mit OLLAMA_BASE_URL allein", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    expect(isLlmConfigured()).toBe(true);
  });
});

describe("callLlm – Ollama", () => {
  it("ruft die lokale Ollama-Chat-API auf, wenn nur OLLAMA_BASE_URL gesetzt ist", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.1");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"plan":"ok"}' } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlm("Hallo");

    expect(result).toBe('{"plan":"ok"}');
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      model: "llama3.1",
      messages: [{ role: "user", content: "Hallo" }],
      stream: false,
    });
  });

  it("wirft bei keinem konfigurierten Provider", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "");
    await expect(callLlm("Hallo")).rejects.toThrow(/Keine LLM-API konfiguriert/);
  });

  it("bevorzugt Ollama, auch wenn zusätzlich ein Cloud-Key gesetzt ist", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-irrelevant");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "lokal beantwortet" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callLlm("Hallo");

    expect(result).toBe("lokal beantwortet");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
