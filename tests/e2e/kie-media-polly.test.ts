import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Polly } from "@pollyjs/core";
import FetchAdapter from "@pollyjs/adapter-fetch";
import FSPersister from "@pollyjs/persister-fs";
import { kieMedia } from "../../packages/provider/kie-media/dist/src/index";
import { resolve } from "path";

// Register PollyJS adapter and persister
Polly.register(FetchAdapter);
Polly.register(FSPersister);

describe("KIE Media Provider - API Endpoints", () => {
  let polly: Polly;
  const apiKey = process.env.KIE_API_KEY || "";

  beforeEach((context) => {
    const testName = context.task.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();

    polly = new Polly(testName, {
      adapters: ["fetch"],
      persister: "fs",
      persisterOptions: {
        fs: {
          recordingsDir: resolve(__dirname, "recordings/kie-media"),
        },
      },
      mode: "record", // Will record if no recording exists, replay if it does
      recordFailedRequests: true,
      matchRequestsBy: {
        method: true,
        headers: false, // Don't match on headers to avoid API key issues
        body: true,
        order: false,
        url: {
          protocol: true,
          username: false,
          password: false,
          hostname: true,
          port: true,
          pathname: true,
          query: true,
          hash: false,
        },
      },
      logging: false,
    });

    // Hide API key in recordings
    polly.server.any().on("beforePersist", (req, recording) => {
      if (recording.request?.headers) {
        const headers = recording.request.headers as Record<string, string>;
        if (headers.authorization) {
          headers.authorization = "Bearer [REDACTED]";
        }
      }
    });
  });

  afterEach(async () => {
    await polly.stop();
  });

  describe("1. Create Task Endpoint", () => {
    it("POST /api/v1/jobs/createTask - should create a grok-imagine/image-to-video task", async () => {
      if (!apiKey) {
        console.warn("⚠️  KIE_API_KEY not set, skipping real API test");
        return;
      }

      const provider = kieMedia({ apiKey });

      const request = {
        model: "grok-imagine/image-to-video" as const,
        input: {
          image_urls: [
            "https://file.aiquickdraw.com/custom-page/akr/section-images/1762247692373tw5di116.png",
          ],
          prompt:
            "A gentle breeze makes the leaves sway softly. Camera slowly zooms out.",
          mode: "normal" as const,
          duration: "6" as const,
          resolution: "480p" as const,
        },
      };

      const response = await provider.createTask(request);

      expect(response).toHaveProperty("taskId");
      expect(typeof response.taskId).toBe("string");
      expect(response.taskId.length).toBeGreaterThan(0);

      console.log("✅ Create Task Response:", response);
    }, 30000);

    it("POST /api/v1/jobs/createTask - should create a kling-3.0/video task", async () => {
      if (!apiKey) {
        console.warn("⚠️  KIE_API_KEY not set, skipping real API test");
        return;
      }

      const provider = kieMedia({ apiKey });

      const request = {
        model: "kling-3.0/video" as const,
        input: {
          prompt: "A futuristic cityscape at sunset with flying cars",
          sound: false,
          duration: "5" as const,
          aspect_ratio: "16:9" as const,
          mode: "std" as const,
          multi_shots: false,
        },
      };

      const response = await provider.createTask(request);

      expect(response).toHaveProperty("taskId");
      expect(typeof response.taskId).toBe("string");
      expect(response.taskId.length).toBeGreaterThan(0);

      console.log("✅ Create Kling Task Response:", response);
    }, 30000);
  });

  describe("2. Query Task Status Endpoint", () => {
    it("GET /api/v1/jobs/recordInfo - should query task status", async () => {
      if (!apiKey) {
        console.warn("⚠️  KIE_API_KEY not set, skipping real API test");
        return;
      }

      const provider = kieMedia({ apiKey });

      // First create a task to get a valid taskId
      const createResponse = await provider.createTask({
        model: "grok-imagine/text-to-image",
        input: {
          prompt: "A beautiful sunset over mountains",
          aspect_ratio: "16:9",
        },
      });

      expect(createResponse.taskId).toBeDefined();

      // Now query the task status
      const status = await provider.getTaskStatus(createResponse.taskId);

      expect(status).toHaveProperty("taskId");
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("state");
      expect(["pending", "processing", "completed", "failed"]).toContain(
        status.status
      );
      expect(["waiting", "queuing", "generating", "success", "fail"]).toContain(
        status.state
      );

      console.log("✅ Query Task Status Response:", status);
    }, 30000);
  });

  describe("3. Get User Credits Endpoint", () => {
    it("GET /api/v1/user/credits - should retrieve account credits", async () => {
      if (!apiKey) {
        console.warn("⚠️  KIE_API_KEY not set, skipping real API test");
        return;
      }

      const provider = kieMedia({ apiKey });

      const credits = await provider.getCredits();

      expect(credits).toHaveProperty("balance");
      expect(credits).toHaveProperty("totalUsed");
      expect(credits).toHaveProperty("currency");
      expect(typeof credits.balance).toBe("number");
      expect(typeof credits.totalUsed).toBe("number");
      expect(typeof credits.currency).toBe("string");
      expect(credits.balance).toBeGreaterThanOrEqual(0);
      expect(credits.totalUsed).toBeGreaterThanOrEqual(0);

      console.log("✅ Get Credits Response:", credits);
    }, 10000);
  });
});
