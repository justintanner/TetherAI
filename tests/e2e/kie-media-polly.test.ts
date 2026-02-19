import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Polly } from "@pollyjs/core";
import FetchAdapter from "@pollyjs/adapter-fetch";
import FSPersister from "@pollyjs/persister-fs";
import { kieMedia } from "../../packages/provider/kie-media/dist/src/index";
import { resolve } from "path";

// Register PollyJS adapter and persister
Polly.register(FetchAdapter);
Polly.register(FSPersister);

describe("KIE Media Provider - Real API Tests with PollyJS", () => {
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
      logging: true,
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

  describe("grok-imagine/image-to-video", () => {
    it("should create an image-to-video task successfully", async () => {
      if (!apiKey) {
        console.warn("⚠️  KIE_API_KEY not set, skipping real API test");
        return;
      }

      const provider = kieMedia({ apiKey });

      // Use a sample image URL for testing
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

      // Verify we got a task ID back
      expect(response).toHaveProperty("taskId");
      expect(typeof response.taskId).toBe("string");
      expect(response.taskId.length).toBeGreaterThan(0);

      console.log("✅ Task created successfully with ID:", response.taskId);

      // Optionally check the task status (this will be a second API call)
      const status = await provider.getTaskStatus(response.taskId);
      expect(status).toHaveProperty("taskId");
      expect(status).toHaveProperty("status");
      expect(["PENDING", "PROCESSING", "SUCCESS", "FAILED"]).toContain(
        status.status
      );

      console.log("📊 Task status:", status.status);
    }, 30000); // 30 second timeout for API call
  });
});
