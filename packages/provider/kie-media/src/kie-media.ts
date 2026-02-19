import {
  MediaGenerationRequest,
  TaskResponse,
  TaskStatusDetails,
  TaskResult,
  WaitOptions,
  KIEMediaOptions,
  KIEMediaProvider,
  MediaType,
  KIEMediaError,
  KIECreditsResponse,
} from "./types";
import { TaskPoller } from "./polling";

interface KIEApiResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
    [key: string]: unknown;
  };
}

// Supported models configuration
const SUPPORTED_MODELS: Record<
  string,
  { type: MediaType; supported: boolean }
> = {
  "kling-3.0/video": { type: "video", supported: true },
  "grok-imagine/text-to-image": { type: "image", supported: true },
  "grok-imagine/image-to-image": { type: "image", supported: true },
  "grok-imagine/text-to-video": { type: "video", supported: true },
  "grok-imagine/image-to-video": { type: "video", supported: true },
  "nano-banana-pro": { type: "image", supported: true },
};

export function kieMedia(opts: KIEMediaOptions): KIEMediaProvider {
  const baseURL = opts.baseURL ?? "https://api.kie.ai";
  const doFetch = opts.fetch ?? fetch;
  const timeout = opts.timeout ?? 30000;
  const poller = new TaskPoller(baseURL, opts.apiKey, doFetch);

  return {
    async createTask(req: MediaGenerationRequest): Promise<TaskResponse> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        if (!this.validateModel(req.model)) {
          throw new KIEMediaError(`Unsupported model: ${req.model}`, 400);
        }

        const res = await doFetch(`${baseURL}/api/v1/jobs/createTask`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let message = `KIE API error: ${res.status}`;
          try {
            const errorData: unknown = await res.json();
            if (
              typeof errorData === "object" &&
              errorData !== null &&
              "msg" in errorData &&
              typeof (errorData as { msg?: string }).msg === "string"
            ) {
              message = `KIE API error ${res.status}: ${(errorData as { msg: string }).msg}`;
            }
          } catch {
            // ignore parse errors
          }
          throw new KIEMediaError(message, res.status);
        }

        const data: KIEApiResponse = await res.json();

        if (data.code !== 200 || !data.data?.taskId) {
          throw new KIEMediaError(
            data.msg || `API error: ${data.code}`,
            data.code
          );
        }

        return { taskId: data.data.taskId };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof KIEMediaError) throw error;
        throw new KIEMediaError(`Failed to create task: ${error}`, 500);
      }
    },

    async getTaskStatus(taskId: string): Promise<TaskStatusDetails> {
      return poller.getTaskStatus(taskId);
    },

    async waitForTask(
      taskId: string,
      options?: WaitOptions
    ): Promise<TaskResult> {
      return poller.waitForTask(taskId, options);
    },

    async generate(
      req: MediaGenerationRequest,
      options?: WaitOptions
    ): Promise<TaskResult> {
      const { taskId } = await this.createTask(req);
      return this.waitForTask(taskId, options);
    },

    validateModel(modelId: string): boolean {
      return SUPPORTED_MODELS[modelId]?.supported === true;
    },

    getModels(): string[] {
      return Object.keys(SUPPORTED_MODELS).filter(
        (model) => SUPPORTED_MODELS[model].supported
      );
    },

    getModelType(modelId: string): MediaType | null {
      return SUPPORTED_MODELS[modelId]?.type || null;
    },

    async getCredits(): Promise<KIECreditsResponse> {
      const res = await doFetch(`${baseURL}/api/v1/user/credits`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new KIEMediaError(
          `Failed to get credits: ${res.status}`,
          res.status
        );
      }

      interface CreditsApiResponse {
        code: number;
        msg: string;
        data?: {
          balance?: number;
          totalUsed?: number;
          currency?: string;
        };
      }

      const response: CreditsApiResponse = await res.json();

      if (response.code !== 200 || !response.data) {
        throw new KIEMediaError(
          response.msg || `API error: ${response.code}`,
          response.code
        );
      }

      return {
        balance: response.data.balance ?? 0,
        totalUsed: response.data.totalUsed ?? 0,
        currency: response.data.currency ?? "credits",
      };
    },
  };
}
