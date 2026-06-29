import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

import { runCronJob } from "./cron-runner";

describe("runCronJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not retry or alert on success", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);

    await runCronJob("test-job", fn, { retryDelayMs: 0 });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("retries on failure and succeeds without alerting if a later attempt works", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);

    await runCronJob("test-job", fn, { retries: 2, retryDelayMs: 0 });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("reports to Sentry only after all retries are exhausted", async () => {
    const error = new Error("DB locked");
    const fn = vi.fn().mockRejectedValue(error);

    await runCronJob("test-job", fn, { retries: 2, retryDelayMs: 0 });

    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error, { tags: { cronJob: "test-job" } });
  });

  it("defaults to 2 retries (3 attempts total) when not specified", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await runCronJob("test-job", fn, { retryDelayMs: 0 });

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("never throws, even if Sentry reporting itself fails", async () => {
    mockCaptureException.mockImplementation(() => {
      throw new Error("Sentry is down");
    });
    const fn = vi.fn().mockRejectedValue(new Error("job failed"));

    await expect(runCronJob("test-job", fn, { retries: 0, retryDelayMs: 0 })).resolves.toBeUndefined();
  });
});
