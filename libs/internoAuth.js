import crypto from "crypto";
import { cookies } from "next/headers";

export const INTERNO_COOKIE = "pos_interno_token";
const SESSION_HOURS = 8;

function getSecret() {
  return (
    process.env.INTERNO_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "pos-interno-dev-only"
  );
}

function signPayload(payload) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
  return Buffer.from(JSON.stringify({ body, signature })).toString("base64url");
}

function verifyToken(token) {
  if (!token) return null;

  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(parsed.body)
      .digest("hex");

    if (expected !== parsed.signature) return null;

    const payload = JSON.parse(parsed.body);
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (payload.role !== "master") return null;

    return payload;
  } catch {
    return null;
  }
}

export function createInternoToken() {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  return signPayload({ role: "master", exp });
}

export async function setInternoCookie() {
  const token = createInternoToken();
  const cookieStore = await cookies();

  cookieStore.set(INTERNO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function clearInternoCookie() {
  const cookieStore = await cookies();
  cookieStore.set(INTERNO_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function getInternoSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(INTERNO_COOKIE)?.value;
  return verifyToken(token);
}

export async function requireInternoSession() {
  const session = await getInternoSession();
  if (!session) {
    return { error: true, session: null };
  }
  return { error: false, session };
}
