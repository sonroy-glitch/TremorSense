import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "What is Freezing of Gait?",
  "What triggers a freeze?",
  "How do I break a freeze?",
  "How can I prevent falls?",
];

const initialAssistantGreeting: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi, I'm your FOG Assistant. I can answer questions about Freezing of Gait — what causes it, how to break a freeze safely, and how to prevent falls. What would you like to know?",
};

function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {}
    hydrated.current = true;
  }, [key]);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

export function FloatingChatbot() {
  const [open, setOpen] = useSessionState("ts:chat:open", false);
  const [messages, setMessages] = useSessionState<Message[]>("ts:fog:messages", [
    initialAssistantGreeting,
  ]);
  const [unread, setUnread] = useSessionState("ts:chat:unread", true);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setUnread(false);
  }, [open, setUnread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    // TODO(api): replace with POST /api/chat — the model should be constrained
    // to the FOG knowledge base defined in the system prompt for this assistant.
    setTimeout(() => {
      const reply: Message = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: fogReply(trimmed),
      };
      setMessages((m) => [...m, reply]);
      setTyping(false);
    }, 900);
  };

  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close FOG Assistant" : "Open FOG Assistant"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95",
          !open && "pulse-ring",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread && (
          <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-warn text-[10px] font-bold text-warn-foreground ring-2 ring-background">
            1
          </span>
        )}
      </button>

      <div
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200",
          "bottom-24 right-6 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100dvh-8rem))]",
          "max-sm:inset-x-2 max-sm:bottom-24 max-sm:right-2 max-sm:w-auto max-sm:h-[70dvh]",
          open ? "pointer-events-auto opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2",
        )}
        role="dialog"
        aria-label="FOG Assistant"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold">FOG Assistant</div>
              <div className="text-xs text-muted-foreground">Freezing of Gait guidance</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
              </div>
            </div>
          )}
          {!hasUserMessage && (
            <div className="pt-2">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Try asking:</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-border bg-card p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Freezing of Gait…"
            aria-label="Message the FOG Assistant"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-full" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}

/**
 * Mock reply layer constrained to the FOG knowledge base.
 * When wiring to a real model, use this same content as the system prompt and
 * enforce: "If a user asks a question unrelated to FOG, Parkinson's mobility,
 * or this documentation, reply: 'I can only answer questions related to
 * Freezing of Gait (FOG) and mobility management.'"
 */
function fogReply(q: string): string {
  const l = q.toLowerCase();

  const fogRelated =
    /(fog|freez|gait|parkinson|walk|step|turn|doorway|cue|cane|rollator|medic|levodopa|fall|balance|shuffle|trigger|rescue|metronome|laser|posture|mobility)/.test(
      l,
    );

  if (!fogRelated) {
    return "I can only answer questions related to Freezing of Gait (FOG) and mobility management.";
  }

  if (/(what is|define|meaning|explain).*(fog|freez|gait)/.test(l) || l === "what is freezing of gait?") {
    return "Freezing of Gait (FOG) is a brief, episodic absence or marked reduction of forward progression of the feet despite the intention to walk. People often describe it as their feet feeling 'glued to the floor.' It's a common symptom in Parkinson's disease and related movement disorders.";
  }

  if (/(trigger|cause|when.*happen|why.*freez)/.test(l)) {
    return [
      "Common FOG triggers include:",
      "• Turning — tight or sudden turns while walking",
      "• Doorways & narrow spaces — hallways, crowded rooms",
      "• Approaching a destination — e.g. slowing to sit down",
      "• Cognitive distraction — walking while talking or carrying something",
      "• Stress & anxiety — rushing, crowds, time pressure",
      "• Medication 'OFF' periods when levodopa is wearing off",
    ].join("\n");
  }

  if (/(break|stop|rescue|unfreeze|get out|manage|strateg|overcome|during a freeze)/.test(l)) {
    return [
      "Rescue strategies to break a freeze:",
      "• Stop and reset — don't fight it. Stand tall, breathe, reset posture.",
      "• Shift weight — sway gently side-to-side to unweight the stuck foot.",
      "• Visual cueing — imagine a line on the floor and step over it (or focus on the projected laser line).",
      "• Auditory cueing — count '1, 2, 3, step' aloud, or walk to a metronome/upbeat music.",
      "• Think big — plan one exaggeratedly large, marching step forward instead of shuffling.",
    ].join("\n");
  }

  if (/(fall|safety|prevent|home|clutter|rug|assist)/.test(l)) {
    return [
      "Safety & fall prevention:",
      "• Never fight a freeze — forcing a step often causes the upper body to lean ahead of stuck feet, leading to a forward fall.",
      "• Use assistive devices — rollators, canes, or your FOG-specific cane in high-trigger environments.",
      "• Home modifications — clear hallways of clutter, remove loose rugs, and keep doorway paths wide and unobstructed.",
    ].join("\n");
  }

  if (/(cue|laser|metronome|visual|auditory|music|count)/.test(l)) {
    return "Cueing helps override a freeze. Visual cueing: focus on a line on the floor (or the projected laser line from your cane) and step over it. Auditory cueing: count '1, 2, 3, step' out loud, or walk to a steady metronome or upbeat music.";
  }

  if (/(medic|levodopa|off period|drug|dose)/.test(l)) {
    return "Freezing episodes often cluster during 'OFF' periods when Parkinson's medication (such as levodopa) is wearing off. Any medication adjustments must be discussed with your neurologist — I can't advise on dosing.";
  }

  if (/(doctor|neurologist|advice|diagnos)/.test(l)) {
    return "I provide informational support based on FOG documentation — I don't replace professional medical advice. For medication adjustments or severe fall risks, please consult your neurologist.";
  }

  return "I can help with Freezing of Gait — what it is, common triggers, rescue strategies to break a freeze, and fall-prevention tips. Which of those would you like to explore?";
}
