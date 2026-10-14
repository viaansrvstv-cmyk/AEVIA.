import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { PageIntro } from "@/components/site-chrome";
import { askAI } from "@/lib/ai.functions";

export const Route = createFileRoute("/ai-intelligence")({
  head: () => ({
    meta: [
      { title: "AI Intelligence — AEVIA" },
      { name: "description", content: "Ask questions and get considered answers in a calm, distraction-free AI conversation." },
      { property: "og:title", content: "AI Intelligence — AEVIA" },
      { property: "og:description", content: "Ask questions and get considered answers in a calm, distraction-free AI conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chat,
});

type Msg = { role: "user" | "assistant"; content: string };
const SUGGEST = ["Explain how hand tracking works in a browser.", "What does a chargesheet rate actually measure?", "Summarise why small language models matter."];

function Chat() {
  const ask = useServerFn(askAI);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, content: t }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const { reply } = await ask({ data: { messages: next.slice(-20) } });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠ ${e instanceof Error ? e.message : "Something went wrong."}` }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageIntro module="Module 04 · Dialogue" title="AI Intelligence">
        Ask a question and get a considered answer. The conversation stays in this browser tab and is cleared when you leave the page.
      </PageIntro>
      <div className="mx-auto max-w-3xl px-5">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-8">
          <div className="min-h-[320px] space-y-4">
            {msgs.length === 0 && (
              <div className="py-10 text-center">
                <p className="font-display text-4xl">What would you like to know?</p>
                <p className="mt-2 text-muted-foreground">Ask about the modules in this project, or anything else you are researching.</p>
                <div className="mt-6 flex flex-col items-center gap-2">
                  {SUGGEST.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-4 py-2 text-sm transition hover:border-primary hover:text-primary">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${m.role === "user" ? "bg-foreground text-background" : "border border-border bg-background"}`}>{m.content}</div>
              </div>
            ))}
            {busy && <p className="eyebrow animate-pulse">Thinking…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-6 flex gap-2 rounded-full border border-border bg-background p-1.5 focus-within:border-primary">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" className="flex-1 bg-transparent px-4 text-sm outline-none" />
            <button disabled={busy || !input.trim()} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Send</button>
          </form>
        </div>
      </div>
    </>
  );
}
