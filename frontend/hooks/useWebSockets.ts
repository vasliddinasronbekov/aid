"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RealtimeMessage<TPayload = Record<string, unknown>> {
  type: "connection_status" | "active_call_alert" | "critical_ai_error" | "feedback_submitted" | "error" | string;
  payload: TPayload;
}

export interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
}

export interface UseWebSocketResult<TMessage extends RealtimeMessage> {
  status: "idle" | "connecting" | "open" | "closed" | "error";
  lastMessage: TMessage | null;
  messages: TMessage[];
  sendMessage: (message: RealtimeMessage) => boolean;
  clearMessages: () => void;
}

export function useWebSockets<TMessage extends RealtimeMessage = RealtimeMessage>({
  url,
  enabled = true,
  maxReconnectAttempts = 12,
  reconnectBaseDelayMs = 600,
}: UseWebSocketOptions): UseWebSocketResult<TMessage> {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const mountedRef = useRef(false);

  const [status, setStatus] = useState<UseWebSocketResult<TMessage>["status"]>("idle");
  const [lastMessage, setLastMessage] = useState<TMessage | null>(null);
  const [messages, setMessages] = useState<TMessage[]>([]);

  const clearMessages = useCallback(() => {
    if (mountedRef.current) {
      setMessages([]);
      setLastMessage(null);
    }
  }, []);

  const sendMessage = useCallback((message: RealtimeMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let effectActive = true;

    const active = () => mountedRef.current && effectActive;

    if (!enabled || typeof window === "undefined") {
      setStatus("idle");
      return () => {
        effectActive = false;
        mountedRef.current = false;
      };
    }

    shouldReconnectRef.current = true;

    const scheduleReconnect = (connect: () => void) => {
      if (!active()) {
        return;
      }
      if (!shouldReconnectRef.current || reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setStatus("closed");
        return;
      }

      reconnectAttemptsRef.current += 1;
      const jitter = Math.floor(Math.random() * 250);
      const delay = Math.min(
        reconnectBaseDelayMs * 2 ** (reconnectAttemptsRef.current - 1) + jitter,
        15000,
      );
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (!active()) {
        return;
      }
      setStatus("connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!active() || socketRef.current !== socket) {
          return;
        }
        reconnectAttemptsRef.current = 0;
        setStatus("open");
        socket.send(JSON.stringify({ type: "ping", payload: { client_ts: new Date().toISOString() } }));
      };

      socket.onmessage = (event) => {
        if (!active() || socketRef.current !== socket) {
          return;
        }
        try {
          const parsed = JSON.parse(event.data) as TMessage;
          setLastMessage(parsed);
          setMessages((current) => [parsed, ...current].slice(0, 60));
        } catch {
          const fallback = {
            type: "error",
            payload: { message: "Unable to parse realtime message" },
          } as unknown as TMessage;
          setLastMessage(fallback);
          setMessages((current) => [fallback, ...current].slice(0, 60));
        }
      };

      socket.onerror = () => {
        if (active() && socketRef.current === socket) {
          setStatus("error");
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (!active()) {
          return;
        }
        if (shouldReconnectRef.current) {
          scheduleReconnect(connect);
        } else {
          setStatus("closed");
        }
      };
    };

    connect();

    return () => {
      effectActive = false;
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [enabled, maxReconnectAttempts, reconnectBaseDelayMs, url]);

  return {
    status,
    lastMessage,
    messages,
    sendMessage,
    clearMessages,
  };
}
