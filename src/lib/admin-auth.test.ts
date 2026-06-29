import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashSync } from "bcryptjs";

const { mockGet, mockCheckRateLimit } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("./db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ get: mockGet }) }) }) },
  schema: { platformAdmins: {} },
}));

vi.mock("./rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

import {
  signAdminPinPendingToken,
  verifyAdminPinPendingToken,
  signAdminSessionToken,
  verifyAdminSessionToken,
  verifyAdminPinReconfirmation,
} from "./admin-auth";

describe("admin-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4 });
  });

  describe("PIN-pending token (login step 1 -> step 2 handoff)", () => {
    it("round-trips a valid token back to the same adminId", () => {
      const token = signAdminPinPendingToken("admin-123");
      const decoded = verifyAdminPinPendingToken(token);
      expect(decoded).toEqual({ adminId: "admin-123" });
    });

    it("rejects a garbage token", () => {
      expect(verifyAdminPinPendingToken("not-a-real-token")).toBeNull();
    });

    it("rejects a token signed for a different purpose (a real admin session token)", () => {
      const sessionToken = signAdminSessionToken({ adminId: "admin-123", email: "a@b.com", name: "A" });
      // A session token has no `purpose` claim, so it must not be accepted
      // as a pin-pending token even though it's validly signed.
      expect(verifyAdminPinPendingToken(sessionToken)).toBeNull();
    });
  });

  describe("admin session token", () => {
    it("round-trips the full payload", () => {
      const token = signAdminSessionToken({ adminId: "a1", email: "a@b.com", name: "Admin" });
      expect(verifyAdminSessionToken(token)).toEqual(expect.objectContaining({ adminId: "a1", email: "a@b.com", name: "Admin" }));
    });

    it("rejects a garbage token", () => {
      expect(verifyAdminSessionToken("garbage")).toBeNull();
    });
  });

  describe("verifyAdminPinReconfirmation", () => {
    it("succeeds when the PIN matches and the admin is active", () => {
      mockGet.mockReturnValue({ pinHash: hashSync("123456", 10), isActive: true });
      const result = verifyAdminPinReconfirmation("admin-1", "123456");
      expect(result).toEqual({ ok: true });
    });

    it("fails with a generic error when the PIN is wrong", () => {
      mockGet.mockReturnValue({ pinHash: hashSync("123456", 10), isActive: true });
      const result = verifyAdminPinReconfirmation("admin-1", "000000");
      expect(result.ok).toBe(false);
    });

    it("fails when the admin is deactivated, even with the correct PIN", () => {
      mockGet.mockReturnValue({ pinHash: hashSync("123456", 10), isActive: false });
      const result = verifyAdminPinReconfirmation("admin-1", "123456");
      expect(result.ok).toBe(false);
    });

    it("fails when the admin doesn't exist", () => {
      mockGet.mockReturnValue(undefined);
      const result = verifyAdminPinReconfirmation("admin-ghost", "123456");
      expect(result.ok).toBe(false);
    });

    it("is rate-limited by admin id, not by IP — locks out after the configured attempts regardless of caller", () => {
      mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterMs: 60_000 });
      const result = verifyAdminPinReconfirmation("admin-1", "123456");
      expect(result.ok).toBe(false);
      expect(mockCheckRateLimit).toHaveBeenCalledWith("admin-pin-reconfirm:admin-1", expect.objectContaining({ maxAttempts: 5 }));
    });
  });
});
