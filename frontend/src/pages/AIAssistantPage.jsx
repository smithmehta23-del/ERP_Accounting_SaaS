import React, { useEffect, useRef, useState } from "react";
import API from "../api";

const styles = {
  page: {
    height: "calc(100vh - 170px)",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: 20,
  },
  sidebar: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  main: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 6,
  },
  sub: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 20,
  },
  quickBtn: {
    width: "100%",
    textAlign: "left",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "12px 14px",
    marginBottom: 10,
    cursor: "pointer",
    fontWeight: 600,
    color: "#0f172a",
  },
  chatHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid #e2e8f0",
  },
  chatBody: {
    flex: 1,
    overflowY: "auto",
    padding: 20,
    background: "#f8fafc",
  },
  msgWrap: {
    display: "flex",
    marginBottom: 16,
  },
  msg: (role) => ({
    maxWidth: "78%",
    padding: "12px 14px",
    borderRadius: 18,
    background: role === "user" ? "#0f172a" : "#fff",
    color: role === "user" ? "#fff" : "#0f172a",
    border: role === "user" ? "none" : "1px solid #e2e8f0",
    marginLeft: role === "user" ? "auto" : 0,
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  }),
  composer: {
    borderTop: "1px solid #e2e8f0",
    padding: 16,
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    minHeight: 52,
    maxHeight: 140,
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  sendBtn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tag: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e2e8f0",
    fontSize: 12,
    fontWeight: 700,
    marginRight: 8,
    marginTop: 8,
  },
};

function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I’m your ERP AI assistant.\n\nYou can ask me to:\n- create voucher drafts\n- open reports\n- guide invoice intake\n- explain ERP data\n- route you to AI tools",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const quickPrompts = [
    "Paid rent 5000 by bank",
    "Upload invoice",
    "Open bank AI",
    "Show receivables",
    "Open stock summary",
    "Create supplier from invoice",
  ];

  const sendMessage = async (forcedText) => {
    const text = String(forcedText ?? input).trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await API.post("/ai/assistant/chat", {
        message: text,
        history: nextMessages,
      });

      const data = res.data || {};

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Done.",
        },
      ]);
if (data.route) {
  window.location.href = data.route;
}
      if (data.route) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Suggested action: Open ${data.route}`,
          },
        ]);
      }

      if (data.command_type === "voucher_parse" && data.original_message) {
        sessionStorage.setItem("erp_ai_command", data.original_message);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error?.response?.data?.message ||
            "Sorry, I could not process that request.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={styles.title}>AI Assistant</div>
      <div style={styles.sub}>
        Chat with your ERP like ChatGPT and trigger actions across modules.
      </div>

      <div style={styles.page}>
        <div style={styles.sidebar}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Quick prompts</div>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              style={styles.quickBtn}
              onClick={() => sendMessage(prompt)}
            >
              {prompt}
            </button>
          ))}

          <div style={{ marginTop: 16, fontWeight: 800 }}>Capabilities</div>
          <div style={styles.tag}>Voucher AI</div>
          <div style={styles.tag}>Invoice AI</div>
          <div style={styles.tag}>Bank AI</div>
          <div style={styles.tag}>ERP Search</div>
          <div style={styles.tag}>Navigation</div>
        </div>

        <div style={styles.main}>
          <div style={styles.chatHeader}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>ERP Chat Assistant</div>
            <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
              Ask questions, generate actions, and navigate your ERP.
            </div>
          </div>

          <div style={styles.chatBody} ref={bodyRef}>
            {messages.map((msg, idx) => (
              <div key={idx} style={styles.msgWrap}>
                <div style={styles.msg(msg.role)}>
  {msg.content.split("\n").map((line, i) => (
    <div key={i}>{line}</div>
  ))}
</div>
              </div>
            ))}

            {loading ? (
              <div style={styles.msgWrap}>
                <div style={styles.msg("assistant")}>Thinking...</div>
              </div>
            ) : null}
          </div>

          <div style={styles.composer}>
            <textarea
              style={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI anything about your ERP..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button style={styles.sendBtn} onClick={() => sendMessage()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIAssistantPage;