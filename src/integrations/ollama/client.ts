/**
 * Ollama REST-Client für lokale LLM-Inference.
 *
 * Verbindet sich zu einem lokalen Ollama-Service (z.B. http://localhost:11434)
 * und sendet Prompts an ein konfiguriertes Modell.
 */

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  system?: string;
  options?: Record<string, number | boolean | string>;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaEmbedRequest {
  model: string;
  input: string | string[];
}

export interface OllamaEmbedResponse {
  embeddings: number[][];
}

export interface OllamaClient {
  generate(request: OllamaGenerateRequest): Promise<string>;
  listModels(): Promise<string[]>;
}

export interface OllamaClientConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class HttpOllamaClient implements OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OllamaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generate(request: OllamaGenerateRequest): Promise<string> {
    const payload: OllamaGenerateRequest = {
      model: request.model || this.model,
      prompt: request.prompt,
      stream: request.stream ?? false,
      system: request.system,
      options: request.options,
    };

    const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      throw new Error(
        `Ollama generate error ${response.status}: ${error}`,
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data.response;
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, {
      method: "GET",
      headers: {
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama list models error ${response.status}`);
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models.map((m) => m.name);
  }
}
