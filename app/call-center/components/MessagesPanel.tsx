"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getTwilioSendAction } from "../smsActions";

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string | null;
  created_at: string;
  status: string;
};

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function MessagesPanel({
  callerPhone,
  callId,
}: {
  callerPhone: string;
  callId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load existing messages for this phone number
  useEffect(() => {
    const client = getClient();
    (async () => {
      const { data } = await client
        .from("messages")
        .select("id, direction, from_number, to_number, body, created_at, status")
        .or(`from_number.eq.${callerPhone},to_number.eq.${callerPhone}`)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    })();
  }, [callerPhone]);

  // Realtime: listen for new messages
  useEffect(() => {
    const client = getClient();
    const channel = client
      .channel(`messages-${callerPhone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.from_number === callerPhone || msg.to_number === callerPhone) {
            setMessages((prev) => [...prev, msg]);
          }
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [callerPhone]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const result = await getTwilioSendAction(callerPhone, text, callId);
    setSending(false);
    if (result.ok) {
      setDraft("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Text Messages</h3>
          {messages.length > 0 && (
            <span className="text-[11px] text-slate-400 tabular-nums">
              {messages.length} {messages.length === 1 ? "msg" : "msgs"}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">{callerPhone}</span>
      </div>

      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            No texts with this number yet.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-slate-100 p-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 text-sm px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:ring-blue-400 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="px-3 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";
  const time = new Date(message.created_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-snug ${
          isOutbound
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-800"
        }`}
      >
        <div>{message.body}</div>
        <div
          className={`text-[10px] mt-1 ${
            isOutbound ? "text-blue-200" : "text-slate-400"
          }`}
        >
          {time}
          {isOutbound && message.status === "failed" && (
            <span className="ml-1 text-red-300">Failed</span>
          )}
        </div>
      </div>
    </div>
  );
}
