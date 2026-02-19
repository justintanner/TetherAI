import {
  TaskStatus,
  TaskStatusDetails,
  TaskResult,
  WaitOptions,
  KIEMediaError,
  KIETaskState,
} from "./types";

// KIE API response structure from recordInfo endpoint
interface KIEApiResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
    model?: string;
    state?: KIETaskState;
    param?: string;
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    progress?: number;
    createTime?: number;
    updateTime?: number;
    completeTime?: number;
    costTime?: number;
  };
}

// Parsed result from resultJson
interface KIEResultJson {
  resultUrls?: string[];
  [key: string]: unknown;
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
      `${this.baseURL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
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

    const response: KIEApiResponse = await res.json();

    if (response.code !== 200) {
      throw new KIEMediaError(
        response.msg || `API error: ${response.code}`,
        response.code
      );
    }

    const data = response.data;
    if (!data) {
      throw new KIEMediaError("No data in API response", 500);
    }

    // Parse resultJson if present
    let parsedResult: KIEResultJson | undefined;
    if (data.resultJson) {
      try {
        parsedResult = JSON.parse(data.resultJson) as KIEResultJson;
      } catch {
        // Ignore parse errors
      }
    }

    // Map KIE state to internal status
    const status = this.mapStateToStatus(data.state);

    return {
      taskId: data.taskId || taskId,
      status,
      state: data.state,
      progress: data.progress,
      model: data.model,
      param: data.param,
      result: parsedResult
        ? {
            urls: parsedResult.resultUrls,
            resultUrls: parsedResult.resultUrls,
          }
        : undefined,
      error:
        status === "failed"
          ? data.failMsg || `Task failed with code: ${data.failCode}`
          : undefined,
      failCode: data.failCode,
      failMsg: data.failMsg,
      createTime: data.createTime,
      updateTime: data.updateTime,
      completeTime: data.completeTime,
      costTime: data.costTime,
    };
  }

  async waitForTask(
    taskId: string,
    options: WaitOptions = {}
  ): Promise<TaskResult> {
    const {
      intervalMs = 3000, // Start with 3s as recommended by docs
      maxAttempts = 300, // ~15 minutes with 3s interval
      timeoutMs = 900000, // 15 minutes
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
        const urls = status.result?.resultUrls || status.result?.urls || [];

        return {
          taskId,
          status: "completed",
          urls,
          metadata: {
            model: status.model,
            costTime: status.costTime,
            createTime: status.createTime,
            completeTime: status.completeTime,
          },
        };
      }

      if (status.status === "failed") {
        return {
          taskId,
          status: "failed",
          urls: [],
          error: status.failMsg || status.error || "Task failed",
          metadata: {
            failCode: status.failCode,
            model: status.model,
          },
        };
      }

      // Exponential backoff: start at 3s, max 30s
      const backoffDelay = Math.min(
        intervalMs * Math.pow(1.1, attempts),
        30000
      );
      await this.sleep(Math.floor(backoffDelay));
    }

    throw new KIEMediaError(
      `Task polling exceeded max attempts (${maxAttempts})`,
      408
    );
  }

  private mapStateToStatus(state?: KIETaskState): TaskStatus {
    if (!state) return "pending";

    const stateMap: Record<KIETaskState, TaskStatus> = {
      waiting: "pending",
      queuing: "processing",
      generating: "processing",
      success: "completed",
      fail: "failed",
    };

    return stateMap[state] || "pending";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
