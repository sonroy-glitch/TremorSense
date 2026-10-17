import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../prisma/client.js";
import { authedUser, issueToken, requireAuth } from "../auth.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CANE_ID_RE = /^TS-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function publicUser(user: { id: string; name: string; email: string; cane_id: string }) {
  return { id: user.id, name: user.name, email: user.email, cane_id: user.cane_id };
}

authRouter.post("/signup", async (req: Request, res: Response) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const cane_id = String(req.body?.cane_id ?? "").trim().toUpperCase();

  if (!name) return res.status(400).json({ msg: "Name is required" });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ msg: "Enter a valid email" });
  if (password.length < 8)
    return res.status(400).json({ msg: "Password must be at least 8 characters" });
  if (!CANE_ID_RE.test(cane_id))
    return res.status(400).json({ msg: "Cane ID must look like TS-XXXX-XXXX" });

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { cane_id }] },
    });
    if (existing) {
      return res.status(409).json({
        msg: existing.email === email ? "An account with that email already exists" : "That cane is already paired to another account",
      });
    }

    const user = await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 10), cane_id },
    });
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("POST /auth/signup failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});

authRouter.post("/signin", async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password)
    return res.status(400).json({ msg: "Email and password are required" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // Same response for "no such user" and "wrong password" so the endpoint
    // can't be used to enumerate which emails have accounts.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ msg: "Invalid email or password" });
    }
    return res.status(200).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error("POST /auth/signin failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});

authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: authedUser(req).id } });
    if (!user) return res.status(404).json({ msg: "Account no longer exists" });
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    console.error("GET /auth/me failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});

authRouter.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
  const email =
    req.body?.email === undefined ? undefined : String(req.body.email).trim().toLowerCase();

  if (name !== undefined && !name) return res.status(400).json({ msg: "Name cannot be empty" });
  if (email !== undefined && !EMAIL_RE.test(email))
    return res.status(400).json({ msg: "Enter a valid email" });

  try {
    const user = await prisma.user.update({
      where: { id: authedUser(req).id },
      data: { ...(name !== undefined && { name }), ...(email !== undefined && { email }) },
    });
    return res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    console.error("PATCH /auth/me failed", error);
    return res.status(500).json({ msg: "Internal server error" });
  }
});
