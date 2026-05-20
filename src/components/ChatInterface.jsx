import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send } from "lucide-react";
import { runIntake } from "../lib/gemini";
import { enrichResults } from "../lib/matching";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useGeolocation } from "../hooks/useGeolocation";

export function ChatInterface({ language, onResults }) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const hasGreeted = useRef(false);
  const { coords } = useGeolocation();

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    const newHistory = [
      ...history,
      { role: "user", parts: [{ text }] }
    ];

    if (text !== "start") {
      setMessages(prev => [...prev, { role: "user", content: text }]);
    }
    setHistory(newHistory);
    setInput("");
    setLoading(true);

    try {
      const response = await runIntake(newHistory, language);

      if (response.type === "results") {
        const enriched = enrichResults(
          response.data.matches,
          response.data.reasons,
          coords
        );
        onResults(enriched);
        setHistory(prev => [
          ...prev,
          { role: "model", parts: [{ text: JSON.stringify(response.data) }] }
        ]);
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: "__results__" }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: response.text }
        ]);
        setHistory(prev => [
          ...prev,
          { role: "model", parts: [{ text: response.text }] }
        ]);
      }
    } catch (err) {
      const isRateLimit = err?.message?.includes("429") || err?.status === 429;
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: isRateLimit
            ? "I'm receiving too many requests right now. Please wait a moment and try again."
            : "Something went wrong. Please try again or call 954-563-4357."
        }
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [loading, history, language, coords, onResults]);

  useEffect(() => {
    if (!hasGreeted.current) {
      hasGreeted.current = true;
      sendMessage("start");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const { listening, start: startVoice } = useVoiceInput(
    (text) => sendMessage(text),
    language
  );

  const placeholder =
    language === "es"
      ? "Escribe aqui..."
      : language === "ht"
      ? "Ekri isit..."
      : "Type here...";

  return (
    <div className="chat-shell">
      <div className="message-list">
        {messages.map((msg, i) =>
          msg.content !== "__results__" ? (
            <div
              key={i}
              className={`message-row ${
                msg.role === "user" ? "user" : "assistant"
              }`}
            >
              <div
                className={
                  msg.role === "user" ? "bubble-user" : "bubble-assistant"
                }
              >
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="message-row assistant">
              <div className="bubble-assistant results-bubble">
                Results found - check the Results tab
              </div>
            </div>
          )
        )}
        {loading && (
          <div className="message-row assistant">
            <div className="typing-bubble">
              <div className="typing-dots">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-bar">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder={placeholder}
          className="chat-input"
        />
        <button
          onClick={() => (listening ? null : startVoice())}
          className={`btn-voice ${listening ? "listening" : ""}`}
          title="Voice input"
        >
          <Mic size={18} />
        </button>
        <button
          onClick={() => sendMessage(input)}
          disabled={loading}
          className="btn-send"
          title="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
