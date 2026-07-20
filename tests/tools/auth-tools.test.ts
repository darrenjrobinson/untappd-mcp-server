import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { registerAuthenticateUntappd } from "../../src/tools/authenticate-untappd.js";
import { registerGetAuthStatus } from "../../src/tools/get-auth-status.js";
import { runInteractiveAuth, saveToken } from "../../src/auth.js";
import {
  captureTools,
  invokeTool,
  mockUntappd,
  setupEnv,
} from "../helpers.js";

// Partial mock: only runInteractiveAuth is replaced. Spreading the original is
// mandatory — client.ts imports resolveAccessToken from the same module.
vi.mock("../../src/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/auth.js")>();
  return { ...actual, runInteractiveAuth: vi.fn() };
});

const runInteractiveAuthMock = runInteractiveAuth as Mock;

let tempDir: string;

beforeEach(() => {
  setupEnv();
  runInteractiveAuthMock.mockReset();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "untappd-authtool-"));
  process.env.UNTAPPD_TOKEN_PATH = path.join(tempDir, "token.json");
});

afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("authenticate_untappd", () => {
  it("short-circuits when an env token is already set", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "env-tok";
    const tool = captureTools(registerAuthenticateUntappd)["authenticate_untappd"];

    const { payload } = await invokeTool(tool, {});

    expect(payload.status).toBe("already_authenticated");
    expect(payload.source).toBe("env");
    expect(runInteractiveAuthMock).not.toHaveBeenCalled();
  });

  it("runs the interactive flow and reports the masked result", async () => {
    const tool = captureTools(registerAuthenticateUntappd)["authenticate_untappd"];
    runInteractiveAuthMock.mockResolvedValue({
      tokenPath: "/tmp/token.json",
      maskedToken: "secr…2345",
      redirectUrl: "http://localhost:8737/callback",
    });

    const { payload } = await invokeTool(tool, {});

    expect(runInteractiveAuthMock).toHaveBeenCalledWith({ timeoutMs: 180000 });
    expect(payload.status).toBe("authenticated");
    expect(payload.source).toBe("file");
    expect(payload.maskedToken).toBe("secr…2345");
    expect(payload.unlockedTools).toContain("get_friend_feed");
    expect(JSON.stringify(payload)).not.toContain("secret-token");
  });

  it("maps timeout_seconds to timeoutMs", async () => {
    const tool = captureTools(registerAuthenticateUntappd)["authenticate_untappd"];
    runInteractiveAuthMock.mockResolvedValue({
      tokenPath: "p",
      maskedToken: "m",
      redirectUrl: "r",
    });

    await invokeTool(tool, { timeout_seconds: 300 });

    expect(runInteractiveAuthMock).toHaveBeenCalledWith({ timeoutMs: 300000 });
  });

  it("propagates flow failures", async () => {
    const tool = captureTools(registerAuthenticateUntappd)["authenticate_untappd"];
    runInteractiveAuthMock.mockRejectedValue(
      new Error("Timed out after 180s waiting for Untappd authorization")
    );

    await expect(invokeTool(tool, {})).rejects.toThrow("Timed out");
  });
});

describe("get_auth_status", () => {
  it("reports unauthenticated with guidance when no token exists", async () => {
    const tool = captureTools(registerGetAuthStatus)["get_auth_status"];
    const { calls } = mockUntappd([]);

    const { payload } = await invokeTool(tool, {});

    expect(payload.authenticated).toBe(false);
    expect(payload.source).toBe("none");
    expect(payload.authenticatedToolsUnlocked).toBe(false);
    expect(payload.howToAuthenticate).toContain("authenticate_untappd");
    expect(calls).toHaveLength(0);
  });

  it("reports the env source with a masked token", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "env-token-abcdef";
    const tool = captureTools(registerGetAuthStatus)["get_auth_status"];
    mockUntappd([]);

    const { payload } = await invokeTool(tool, {});

    expect(payload.authenticated).toBe(true);
    expect(payload.source).toBe("env");
    expect(payload.maskedToken).toBe("env-…cdef");
    expect(JSON.stringify(payload)).not.toContain("env-token-abcdef");
  });

  it("reports the file source when a saved token exists", async () => {
    saveToken("file-token-123456");
    const tool = captureTools(registerGetAuthStatus)["get_auth_status"];
    mockUntappd([]);

    const { payload } = await invokeTool(tool, {});

    expect(payload.authenticated).toBe(true);
    expect(payload.source).toBe("file");
    expect(payload.tokenFilePath).toBe(process.env.UNTAPPD_TOKEN_PATH);
  });

  it("validate:true makes one authenticated API call", async () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "env-tok";
    const tool = captureTools(registerGetAuthStatus)["get_auth_status"];
    const { calls } = mockUntappd([
      { payload: { user: { user_name: "darren" } } },
    ]);

    const { payload } = await invokeTool(tool, { validate: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].pathname).toBe("/v4/user/info");
    expect(calls[0].searchParams.get("access_token")).toBe("env-tok");
    expect(payload.tokenValid).toBe(true);
    expect(payload.validatedUser).toBe("darren");
    expect(payload.rateLimit).toEqual({ limit: 100, remaining: 87 });
  });

  it("validate:true without a token makes no API call", async () => {
    const tool = captureTools(registerGetAuthStatus)["get_auth_status"];
    const { calls } = mockUntappd([]);

    const { payload } = await invokeTool(tool, { validate: true });

    expect(payload.authenticated).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
