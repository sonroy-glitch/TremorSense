import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

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
    } catch {
      // Unavailable or corrupt storage — fall back to the initial value.
    }
    hydrated.current = true;
  }, [key]);
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing or a full quota — the chat just won't persist.
    }
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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const { assistant_message } = await api.askAssistant(trimmed);
      setMessages((m) => [
        ...m,
        { id: `a_${Date.now()}`, role: "assistant", content: assistant_message },
      ]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          content: `I couldn't answer that just now — ${(error as Error).message}`,
        },
      ]);
    } finally {
      setTyping(false);
    }
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
          open
            ? "pointer-events-auto opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 translate-y-2",
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
            disabled={typing}
            aria-label="Message the FOG Assistant"
            className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Send"
            disabled={typing || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
