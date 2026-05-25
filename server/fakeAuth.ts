// Stateless fake authentication for Vercel deployment.
// Replaces Replit / Google OAuth with a simple signed-cookie demo login.
//
// Demo users are hardcoded so the app works on Vercel without any database
// or external identity provider. Sessions are stored in a signed cookie
// (HMAC-SHA256) so authentication is fully stateless and survives across
// serverless function invocations.

import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "pv_session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 1 week

function getSecret(): string {
  return process.env.SESSION_SECRET || "pv-pricing-demo-secret-change-me";
}

export interface DemoUser {
  id: number;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
}

// Hardcoded demo users — no database required.
export const DEMO_USERS: DemoUser[] = [
  {
    id: 1,
    username: "admin",
    password: "admin123",
    firstName: "Demo",
    lastName: "Admin",
    email: "admin@demo.local",
    profileImageUrl: null,
    isAdmin: true,
  },
  {
    id: 2,
    username: "user",
    password: "user123",
    firstName: "Demo",
    lastName: "User",
    email: "user@demo.local",
    profileImageUrl: null,
    isAdmin: false,
  },
  {
    id: 3,
    username: "engineer",
    password: "engineer123",
    firstName: "Solar",
    lastName: "Engineer",
    email: "engineer@demo.local",
    profileImageUrl: null,
    isAdmin: false,
  },
];

export interface SessionUser {
  id: number | string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
}

export interface SessionPayload {
  // The full (password-free) user is embedded in the signed cookie so the
  // session is stateless — no DB / demo-user lookup needed. This lets Google
  // and guest sessions work without persisting anything server-side.
  user: SessionUser;
  exp: number;
}

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signSession(payload: SessionPayload): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${base64UrlEncode(sig)}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const provided = base64UrlDecode(sig);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setSessionCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(COOKIE_MAX_AGE / 1000)}`,
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function findUserByUsername(username: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.username.toLowerCase() === username.toLowerCase());
}

function publicUser(u: DemoUser): SessionUser {
  // Don't leak the password.
  const { password: _pw, ...rest } = u;
  return rest;
}

function issueSession(res: Response, user: SessionUser) {
  const token = signSession({ user, exp: Date.now() + COOKIE_MAX_AGE });
  setSessionCookie(res, token);
}

/** Verify a Google Identity Services ID token via Google's tokeninfo
 *  endpoint, then validate the audience, issuer and email. Returns the
 *  decoded claims or throws. Dependency-free; relies on outbound network. */
async function verifyGoogleIdToken(idToken: string, clientId: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let resp: globalThis.Response;
  try {
    resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error("Could not verify Google token");
  const data = (await resp.json()) as Record<string, unknown>;

  const aud = String(data.aud ?? "");
  const iss = String(data.iss ?? "");
  const email = typeof data.email === "string" ? data.email : "";
  const emailVerified = data.email_verified === true || data.email_verified === "true";

  if (aud !== clientId) throw new Error("Google token audience mismatch");
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("Invalid Google token issuer");
  }
  if (!email || !emailVerified) throw new Error("Google account email is not verified");

  return {
    sub: String(data.sub ?? ""),
    email,
    given_name: typeof data.given_name === "string" ? data.given_name : "",
    family_name: typeof data.family_name === "string" ? data.family_name : "",
    picture: typeof data.picture === "string" ? data.picture : null,
  };
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).user = user;
  next();
};

export function getCurrentUser(req: Request): SessionUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = verifySession(token);
  return session ? session.user : null;
}

export function setupAuth(app: Express) {
  // Login (real credentials).
  app.post("/api/login", (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Username and password required" });
    }
    const user = findUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    issueSession(res, publicUser(user));
    res.status(200).json(publicUser(user));
  });

  // One-click demo login — useful so reviewers can try the app without
  // remembering credentials. Pass ?as=admin|user|engineer.
  app.post("/api/demo-login", (req: Request, res: Response) => {
    const as = (req.body?.as ?? req.query?.as ?? "user") as string;
    const user = findUserByUsername(as) ?? findUserByUsername("user")!;
    issueSession(res, publicUser(user));
    res.status(200).json(publicUser(user));
  });

  // Continue as guest — a non-admin, throwaway session (no account needed).
  app.post("/api/guest-login", (_req: Request, res: Response) => {
    const guest: SessionUser = {
      id: "guest",
      username: "guest",
      firstName: "Guest",
      lastName: "",
      email: "",
      profileImageUrl: null,
      isAdmin: false,
    };
    issueSession(res, guest);
    res.status(200).json(guest);
  });

  // Google sign-in — verify the GIS ID token, then issue our signed cookie.
  // Any verified Google account is admitted as a normal (non-admin) user.
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: "Google sign-in is not configured" });
    }
    const credential = req.body?.credential;
    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }
    try {
      const claims = await verifyGoogleIdToken(credential, clientId);
      const user: SessionUser = {
        id: claims.sub,
        username: claims.email,
        firstName: claims.given_name,
        lastName: claims.family_name,
        email: claims.email,
        profileImageUrl: claims.picture,
        isAdmin: false,
      };
      issueSession(res, user);
      res.status(200).json(user);
    } catch (err) {
      res.status(401).json({ message: (err as Error).message || "Google sign-in failed" });
    }
  });

  app.post("/api/logout", (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  });

  // Used by the auth provider on the client.
  app.get("/api/auth/user", (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json(user);
  });

  // Legacy endpoint kept for compatibility with the existing client.
  app.get("/api/user", (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json(user);
  });

  // List of demo accounts for the login screen.
  app.get("/api/demo-users", (_req: Request, res: Response) => {
    res.json(
      DEMO_USERS.map((u) => ({
        username: u.username,
        password: u.password,
        firstName: u.firstName,
        lastName: u.lastName,
        isAdmin: u.isAdmin,
      })),
    );
  });

  // Admin-only "create user" — fake (in-memory) so the UI keeps working.
  app.post("/api/admin/create-user", (req: Request, res: Response, next: NextFunction) => {
    const current = getCurrentUser(req);
    if (!current || !current.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { username, password, isAdmin } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Username and password (min 8 chars) required" });
    }
    if (findUserByUsername(username)) {
      return res.status(400).json({ message: "Username already exists" });
    }
    const newUser: DemoUser = {
      id: DEMO_USERS.length > 0 ? Math.max(...DEMO_USERS.map((u) => u.id)) + 1 : 1,
      username,
      password,
      firstName: username,
      lastName: "",
      email: `${username}@demo.local`,
      profileImageUrl: null,
      isAdmin: Boolean(isAdmin),
    };
    DEMO_USERS.push(newUser);
    res.status(201).json(publicUser(newUser));
  });
}
