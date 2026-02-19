import {
  TaskStatus,
  TaskStatusDetails,
  TaskResult,
  WaitOptions,
  KIEMediaError,
} from "./types";

interface KIEApiResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
    status?: string;
    progress?: number;
    urls?: string[];
    video_url?: string;
    image_url?: string;
    result?: {
      urls?: string[];
      video_url?: string;
      image_url?: string;
    };
    [key: string]: unknown;
  };
}

export class TaskPoller {
  private baseURL: string;
  private apiKey: string;
  private doFetch: typeof fetch;

  constructor(baseURL: string, apiKey: string, doFetch: typeof fetch) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.doFetch = doFetch;
  }

  async getTaskStatus(taskId: string): Promise<TaskStatusDetails> {
    const res = await this.doFetch(
      `${this.baseURL}/market/common/get-task-detail?taskId=${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      throw new KIEMediaError(
        `Failed to get task status: ${res.status}`,
        res.status
      );
    }

    const data: KIEApiResponse = await res.json();

    if (data.code !== 200) {
      throw new KIEMediaError(data.msg || `API error: ${data.code}`, data.code);
    }

    const status = this.mapStatus(data.data?.status || "pending");
    const result = data.data?.result || data.data;

    return {
      taskId,
      status,
      progress: data.data?.progress,
      result: result
        ? {
            urls: result.urls,
            video_url: result.video_url,
            image_url: result.image_url,
          }
        : undefined,
    };
  }

  async waitForTask(
    taskId: string,
    options: WaitOptions = {}
  ): Promise<TaskResult> {
    const {
      intervalMs = 2000,
      maxAttempts = 150,
      timeoutMs = 300000,
      onProgress,
    } = options;

    const startTime = Date.now();
    let attempts = 0;

    while (attempts < maxAttempts) {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        throw new KIEMediaError(
          `Task polling timeout after ${timeoutMs}ms`,
          408
        );
      }

      const status = await this.getTaskStatus(taskId);
      attempts++;

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === "completed") {
        const urls = status.result?.urls || [];
        const videoUrl = status.result?.video_url;
        const imageUrl = status.result?.image_url;

        return {
          taskId,
          status: "completed",
          urls,
          videoUrl,
          imageUrl,
          metadata: status.result,
        };
      }

      if (status.status === "failed") {
        return {
          taskId,
          status: "failed",
          urls: [],
          error: status.error || "Task failed",
        };
      }

      await this.sleep(intervalMs);
    }

    throw new KIEMediaError(
      `Task polling exceeded max attempts (${maxAttempts})`,
      408
    );
  }

  private mapStatus(apiStatus: string): TaskStatus {
    const statusMap: Record<string, TaskStatus> = {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      success: "completed",
      error: "failed",
    };
    return statusMap[apiStatus.toLowerCase()] || "pending";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
