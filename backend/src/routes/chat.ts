import { Router, type Request, type Response } from "express";
import Groq from "groq-sdk";
import { env } from "../env.js";
import { authedUser, requireAuth } from "../auth.js";
import { FOG_ASSISTANT_PROMPT } from "../fog-assistant-prompt.js";

export const chatRouter = Router();

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Conversation history, per user. This used to be one module-level array shared
// by every caller, which leaked one user's conversation into another's context.
// It is still in-process memory, so it resets on redeploy and is not shared
// across replicas — fine for short chats, swap for a table if that matters.
const MAX_TURNS = 20;
const conversations = new Map<string, Message[]>();

chatRouter.post("/llm_bot", requireAuth, async (req: Request, res: Response) => {
  const question = String(req.body?.user_question ?? "").trim();
  if (!question) return res.status(400).json({ msg: "user_question is required" });
  if (question.length > 2000) return res.status(413).json({ msg: "Question is too long" });

  const { id } = authedUser(req);
  const history = conversations.get(id) ?? [];

  try {
    const messages: Message[] = [...history, { role: "user", content: question }];
    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [{ role: "system", content: FOG_ASSISTANT_PROMPT }, ...messages],
      temperature: 0.7,
      top_p: 1,
      max_completion_tokens: 2048,
      reasoning_effort: "medium",
    });

    const assistant_message = completion.choices[0]?.message?.content ?? "";
    messages.push({ role: "assistant", content: assistant_message });
    conversations.set(id, messages.slice(-MAX_TURNS * 2));

    return res.status(200).json({ assistant_message });
  } catch (error) {
    console.error("POST /llm_bot failed", error);
    return res.status(502).json({ msg: "The assistant is unavailable right now" });
  }
});

/** Lets the user clear their own chat context. */
chatRouter.delete("/llm_bot", requireAuth, (req: Request, res: Response) => {
  conversations.delete(authedUser(req).id);
  return res.status(200).json({ msg: "Conversation cleared" });
});
