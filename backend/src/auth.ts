import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export interface AuthedUser {
  id: string;
  cane_id: string;
}

// Express's Request type has no slot for our user, so requireAuth attaches it
// under a symbol-free property and handlers read it through `authedUser()`.
interface AuthedRequest extends Request {
  user?: AuthedUser;
}

export function issueToken(user: AuthedUser): string {
  return jwt.sign({ sub: user.id, cane_id: user.cane_id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/** Rejects the request unless it carries a valid `Authorization: Bearer <jwt>`. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ msg: "Missing bearer token" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice("Bearer ".length), env.JWT_SECRET);
    if (typeof payload === "string" || !payload.sub) {
      res.status(401).json({ msg: "Invalid token" });
      return;
    }
    (req as AuthedRequest).user = {
      id: String(payload.sub),
      cane_id: String((payload as jwt.JwtPayload)["cane_id"] ?? ""),
    };
    next();
  } catch {
    res.status(401).json({ msg: "Invalid or expired token" });
  }
}

/** Reads the user attached by requireAuth. Only call inside a guarded route. */
export function authedUser(req: Request): AuthedUser {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error("authedUser() called on an unguarded route");
  return user;
}

/**
 * Guards the cane ingest endpoint. The Pi has no user session; it proves itself
 * with the shared PI_INGEST_KEY and names its cane in the body.
 */
export function requirePiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"];
  if (typeof key !== "string" || key !== env.PI_INGEST_KEY) {
    res.status(401).json({ msg: "Invalid device key" });
    return;
  }
  next();
}
