import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";

const AUTHENTICATE_URL = "https://untappd.com/oauth/authenticate/";
const AUTHORIZE_URL = "https://untappd.com/oauth/authorize/";
const DEFAULT_REDIRECT_URL = "http://localhost:8737/callback";
const DEFAULT_TIMEOUT_MS = 180_000;

export interface StoredToken {
  access_token: string;
  created_at: string;
}

export type TokenSource = "env" | "file";

export interface ResolvedToken {
  token: string;
  source: TokenSource;
}

export function getTokenFilePath(): string {
  return (
    process.env.UNTAPPD_TOKEN_PATH ??
    path.join(os.homedir(), ".untappd-mcp-server", "token.json")
  );
}

export function getStoredToken(): string | undefined {
  try {
    const raw = fs.readFileSync(getTokenFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    return parsed.access_token || undefined;
  } catch {
    return undefined;
  }
}

export function saveToken(token: string): string {
  const filePath = getTokenFilePath();
  const stored: StoredToken = {
    access_token: token,
    created_at: new Date().toISOString(),
  };
  // mode is a no-op on Windows; NTFS user-profile ACLs apply there.
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(stored, null, 2), { mode: 0o600 });
  return filePath;
}

export function clearToken(): boolean {
  const filePath = getTokenFilePath();
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Resolve the access token: UNTAPPD_ACCESS_TOKEN env var first, then the
 * saved token file. Deliberately uncached — a token saved mid-session (by the
 * authenticate_untappd tool or the CLI in another process) is picked up on
 * the very next call.
 */
export function resolveAccessToken(): ResolvedToken | undefined {
  const envToken = process.env.UNTAPPD_ACCESS_TOKEN;
  if (envToken) {
    return { token: envToken, source: "env" };
  }
  const fileToken = getStoredToken();
  if (fileToken) {
    return { token: fileToken, source: "file" };
  }
  return undefined;
}

export function maskToken(token: string): string {
  if (token.length <= 8) {
    return "****";
  }
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function getRedirectUrl(): string {
  const redirectUrl = process.env.UNTAPPD_REDIRECT_URL ?? DEFAULT_REDIRECT_URL;
  let parsed: URL;
  try {
    parsed = new URL(redirectUrl);
  } catch {
    throw new Error(
      `UNTAPPD_REDIRECT_URL must be a local http URL, e.g. ${DEFAULT_REDIRECT_URL}`
    );
  }
  const localHosts = ["localhost", "127.0.0.1", "[::1]", "::1"];
  if (parsed.protocol !== "http:" || !localHosts.includes(parsed.hostname)) {
    throw new Error(
      `UNTAPPD_REDIRECT_URL must be a local http URL, e.g. ${DEFAULT_REDIRECT_URL}`
    );
  }
  return redirectUrl;
}

export function buildAuthenticateUrl(
  clientId: string,
  redirectUrl: string,
  state: string
): string {
  const url = new URL(AUTHENTICATE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  // Untappd's OAuth uses redirect_url, not the standard redirect_uri.
  url.searchParams.set("redirect_url", redirectUrl);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(opts: {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  code: string;
}): Promise<string> {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("client_secret", opts.clientSecret);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_url", opts.redirectUrl);
  url.searchParams.set("code", opts.code);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Untappd token exchange timed out");
    }
    throw new Error(
      `Network error during token exchange: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.text();
  let parsed: {
    meta?: { error_detail?: string };
    response?: { access_token?: string };
  } = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    // fall through to the error handling below with the raw body
  }

  if (!response.ok) {
    const detail = parsed.meta?.error_detail ?? body.slice(0, 200);
    throw new Error(`Untappd token exchange failed: ${response.status} ${detail}`);
  }

  const token = parsed.response?.access_token;
  if (!token) {
    throw new Error(
      `Untappd token exchange succeeded but no access_token was returned: ${body.slice(0, 200)}`
    );
  }
  return token;
}

function defaultOpenBrowser(url: string): void {
  const child =
    process.platform === "win32"
      ? // The empty "" title argument is required so `start` doesn't treat
        // the URL as the window title.
        spawn("cmd", ["/c", "start", "", url], {
          detached: true,
          stdio: "ignore",
        })
      : process.platform === "darwin"
        ? spawn("open", [url], { detached: true, stdio: "ignore" })
        : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  child.on("error", () => {
    // Non-fatal: the authorize URL is always logged for manual use.
  });
  child.unref();
}

export interface InteractiveAuthOptions {
  timeoutMs?: number;
  openBrowser?: (url: string) => void | Promise<void>;
  log?: (msg: string) => void;
}

export interface InteractiveAuthResult {
  tokenPath: string;
  maskedToken: string;
  redirectUrl: string;
}

/**
 * Run the full interactive OAuth flow: start a temporary localhost listener
 * on the redirect URL's port, open the user's browser to Untappd's authorize
 * page, wait for the redirect with the authorization code, exchange it for an
 * access token, and persist the token to the token file.
 *
 * The redirect URL must exactly match the Callback URL registered in the
 * user's Untappd app settings.
 */
export async function runInteractiveAuth(
  opts: InteractiveAuthOptions = {}
): Promise<InteractiveAuthResult> {
  const clientId = process.env.UNTAPPD_CLIENT_ID;
  const clientSecret = process.env.UNTAPPD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Interactive auth requires UNTAPPD_CLIENT_ID and UNTAPPD_CLIENT_SECRET"
    );
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // stdout is the MCP transport when running as a server — default to stderr.
  const log = opts.log ?? console.error;
  const openBrowser = opts.openBrowser ?? defaultOpenBrowser;

  const redirectUrl = getRedirectUrl();
  const parsedRedirect = new URL(redirectUrl);
  const port = parseInt(parsedRedirect.port || "80", 10);
  const callbackPath = parsedRedirect.pathname;
  const state = randomUUID();

  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url ?? "/", redirectUrl);
    if (reqUrl.pathname !== callbackPath) {
      res.writeHead(404).end();
      return;
    }
    const error = reqUrl.searchParams.get("error");
    if (error) {
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end("<h3>Authorization was denied — you can close this tab.</h3>");
      rejectCode(new Error("Untappd authorization was denied by the user"));
      return;
    }
    if (reqUrl.searchParams.get("state") !== state) {
      res.writeHead(400).end("State mismatch");
      rejectCode(
        new Error("OAuth state mismatch — possible stale redirect; try again")
      );
      return;
    }
    const code = reqUrl.searchParams.get("code");
    if (!code) {
      res.writeHead(400).end("Missing code");
      rejectCode(new Error("Untappd redirected without an authorization code"));
      return;
    }
    res
      .writeHead(200, { "Content-Type": "text/html" })
      .end(
        "<h3>Authentication complete — you can close this tab and return to your chat or terminal.</h3>"
      );
    resolveCode(code);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use — is another authentication in progress? Close it, or set UNTAPPD_REDIRECT_URL to a different localhost port (and update your Untappd app's Callback URL to match)`
          )
        );
      } else {
        reject(err);
      }
    });
    server.listen(port, () => resolve());
  });

  let timeoutHandle: NodeJS.Timeout | undefined;
  try {
    const authenticateUrl = buildAuthenticateUrl(clientId, redirectUrl, state);
    log(
      `Opening your browser to authorize with Untappd… if it doesn't open, visit:\n${authenticateUrl}`
    );
    await openBrowser(authenticateUrl);

    const code = await Promise.race([
      codePromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(
                `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for Untappd authorization`
              )
            ),
          timeoutMs
        );
      }),
    ]);

    const token = await exchangeCodeForToken({
      clientId,
      clientSecret,
      redirectUrl,
      code,
    });
    const tokenPath = saveToken(token);
    log(`Access token saved to ${tokenPath}`);
    return { tokenPath, maskedToken: maskToken(token), redirectUrl };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    server.closeAllConnections();
    server.close();
  }
}
