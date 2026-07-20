import * as fs from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthenticateUrl,
  clearToken,
  exchangeCodeForToken,
  getRedirectUrl,
  getStoredToken,
  maskToken,
  resolveAccessToken,
  runInteractiveAuth,
  saveToken,
} from "../src/auth.js";
import { setupEnv } from "./helpers.js";

let tempDir: string;

beforeEach(() => {
  setupEnv();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "untappd-auth-"));
  process.env.UNTAPPD_TOKEN_PATH = path.join(tempDir, "token.json");
});

afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function stubExchangeFetch(token = "secret-token-12345") {
  const fn = vi.fn(async (url: string) => {
    return new Response(
      JSON.stringify({ meta: { code: 200 }, response: { access_token: token } }),
      { status: 200 }
    );
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Fake browser: parse state/redirect_url from the authorize URL and issue the callback via node:http (not intercepted by the fetch stub). */
function fakeOpener(overrides: { code?: string; state?: string; error?: string } = {}) {
  return (authUrl: string) => {
    const u = new URL(authUrl);
    const state = overrides.state ?? u.searchParams.get("state");
    const redirect = u.searchParams.get("redirect_url")!;
    const cb = new URL(redirect);
    if (overrides.error) {
      cb.searchParams.set("error", overrides.error);
    } else {
      cb.searchParams.set("code", overrides.code ?? "test-code");
    }
    if (state) cb.searchParams.set("state", state);
    http.get(cb.toString()).on("error", () => {});
  };
}

describe("token store", () => {
  it("round-trips save/get and clear", () => {
    expect(getStoredToken()).toBeUndefined();
    const written = saveToken("tok-abc");
    expect(written).toBe(process.env.UNTAPPD_TOKEN_PATH);
    expect(getStoredToken()).toBe("tok-abc");
    expect(clearToken()).toBe(true);
    expect(getStoredToken()).toBeUndefined();
    expect(clearToken()).toBe(false);
  });

  it("creates the parent directory on save", () => {
    process.env.UNTAPPD_TOKEN_PATH = path.join(tempDir, "nested", "dir", "token.json");
    saveToken("tok");
    expect(getStoredToken()).toBe("tok");
  });

  it("returns undefined for corrupt or empty token files", () => {
    fs.writeFileSync(process.env.UNTAPPD_TOKEN_PATH!, "not json");
    expect(getStoredToken()).toBeUndefined();
    fs.writeFileSync(process.env.UNTAPPD_TOKEN_PATH!, JSON.stringify({}));
    expect(getStoredToken()).toBeUndefined();
  });
});

describe("resolveAccessToken precedence", () => {
  it("returns undefined with neither env nor file", () => {
    expect(resolveAccessToken()).toBeUndefined();
  });

  it("uses the env var with source env", () => {
    process.env.UNTAPPD_ACCESS_TOKEN = "env-tok";
    expect(resolveAccessToken()).toEqual({ token: "env-tok", source: "env" });
  });

  it("falls back to the file with source file", () => {
    saveToken("file-tok");
    expect(resolveAccessToken()).toEqual({ token: "file-tok", source: "file" });
  });

  it("env var beats the file", () => {
    saveToken("file-tok");
    process.env.UNTAPPD_ACCESS_TOKEN = "env-tok";
    expect(resolveAccessToken()).toEqual({ token: "env-tok", source: "env" });
  });
});

describe("URL builders", () => {
  it("buildAuthenticateUrl uses Untappd's redirect_url param name", () => {
    const url = new URL(
      buildAuthenticateUrl("cid", "http://localhost:8737/callback", "st-1")
    );
    expect(url.origin + url.pathname).toBe("https://untappd.com/oauth/authenticate/");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_url")).toBe("http://localhost:8737/callback");
    expect(url.searchParams.get("redirect_uri")).toBeNull();
    expect(url.searchParams.get("state")).toBe("st-1");
  });

  it("getRedirectUrl defaults and honors the env override", () => {
    expect(getRedirectUrl()).toBe("http://localhost:8737/callback");
    process.env.UNTAPPD_REDIRECT_URL = "http://127.0.0.1:9999/cb";
    expect(getRedirectUrl()).toBe("http://127.0.0.1:9999/cb");
  });

  it("getRedirectUrl rejects non-local and non-http URLs", () => {
    process.env.UNTAPPD_REDIRECT_URL = "https://localhost:8737/callback";
    expect(() => getRedirectUrl()).toThrow("must be a local http URL");
    process.env.UNTAPPD_REDIRECT_URL = "http://example.com/callback";
    expect(() => getRedirectUrl()).toThrow("must be a local http URL");
  });

  it("maskToken masks all but the edges", () => {
    expect(maskToken("abcdefghijkl")).toBe("abcd…ijkl");
    expect(maskToken("short")).toBe("****");
  });
});

describe("exchangeCodeForToken", () => {
  it("returns the access token and sends the expected params", async () => {
    const fn = stubExchangeFetch("tok-xyz");
    const token = await exchangeCodeForToken({
      clientId: "cid",
      clientSecret: "csecret",
      redirectUrl: "http://localhost:8737/callback",
      code: "the-code",
    });
    expect(token).toBe("tok-xyz");
    const url = new URL(fn.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://untappd.com/oauth/authorize/");
    expect(url.searchParams.get("client_secret")).toBe("csecret");
    expect(url.searchParams.get("code")).toBe("the-code");
    expect(url.searchParams.get("redirect_url")).toBe("http://localhost:8737/callback");
  });

  it("surfaces meta.error_detail on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ meta: { code: 500, error_detail: "Invalid code" } }),
          { status: 500 }
        )
      )
    );
    await expect(
      exchangeCodeForToken({
        clientId: "cid",
        clientSecret: "cs",
        redirectUrl: "http://localhost:8737/callback",
        code: "bad",
      })
    ).rejects.toThrow("Untappd token exchange failed: 500 Invalid code");
  });

  it("throws when the response has no access_token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ meta: { code: 200 }, response: {} }), {
          status: 200,
        })
      )
    );
    await expect(
      exchangeCodeForToken({
        clientId: "cid",
        clientSecret: "cs",
        redirectUrl: "http://localhost:8737/callback",
        code: "c",
      })
    ).rejects.toThrow("no access_token was returned");
  });
});

describe("runInteractiveAuth", () => {
  it("completes the full flow and saves the token", async () => {
    const port = await getFreePort();
    process.env.UNTAPPD_REDIRECT_URL = `http://127.0.0.1:${port}/callback`;
    const fn = stubExchangeFetch("secret-token-12345");

    const result = await runInteractiveAuth({
      openBrowser: fakeOpener(),
      log: () => {},
    });

    expect(result.tokenPath).toBe(process.env.UNTAPPD_TOKEN_PATH);
    expect(result.maskedToken).toBe("secr…2345");
    expect(getStoredToken()).toBe("secret-token-12345");
    const exchangeUrl = new URL(fn.mock.calls[0][0] as string);
    expect(exchangeUrl.searchParams.get("code")).toBe("test-code");
  });

  it("rejects when the user denies authorization", async () => {
    const port = await getFreePort();
    process.env.UNTAPPD_REDIRECT_URL = `http://127.0.0.1:${port}/callback`;
    stubExchangeFetch();

    await expect(
      runInteractiveAuth({
        openBrowser: fakeOpener({ error: "access_denied" }),
        log: () => {},
      })
    ).rejects.toThrow("authorization was denied");
    expect(getStoredToken()).toBeUndefined();
  });

  it("rejects on a state mismatch", async () => {
    const port = await getFreePort();
    process.env.UNTAPPD_REDIRECT_URL = `http://127.0.0.1:${port}/callback`;
    stubExchangeFetch();

    await expect(
      runInteractiveAuth({
        openBrowser: fakeOpener({ state: "wrong-state" }),
        log: () => {},
      })
    ).rejects.toThrow("state mismatch");
  });

  it("times out and releases the port", async () => {
    const port = await getFreePort();
    process.env.UNTAPPD_REDIRECT_URL = `http://127.0.0.1:${port}/callback`;

    await expect(
      runInteractiveAuth({ timeoutMs: 200, openBrowser: () => {}, log: () => {} })
    ).rejects.toThrow("Timed out");

    // The listener must be torn down — binding the port again should work.
    await new Promise<void>((resolve, reject) => {
      const srv = net.createServer();
      srv.once("error", reject);
      srv.listen(port, () => srv.close(() => resolve()));
    });
  });

  it("reports a friendly error when the port is in use", async () => {
    const port = await getFreePort();
    process.env.UNTAPPD_REDIRECT_URL = `http://127.0.0.1:${port}/callback`;
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(port, resolve));

    try {
      await expect(
        runInteractiveAuth({ openBrowser: () => {}, log: () => {} })
      ).rejects.toThrow(`Port ${port} is already in use`);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  it("throws early without client credentials", async () => {
    delete process.env.UNTAPPD_CLIENT_ID;
    await expect(runInteractiveAuth({ log: () => {} })).rejects.toThrow(
      "Interactive auth requires UNTAPPD_CLIENT_ID and UNTAPPD_CLIENT_SECRET"
    );
  });
});
