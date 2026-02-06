import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  IncomingMessage,
  OutgoingMessage,
  SuggestedQuestion,
  JobSummary,
} from "../types";

// Use relative URL for WebSocket (works with Vite proxy)
const getWebSocketUrl = () => {
  // If VITE_API_URL is set (ngrok), use it directly
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL;
    const wsProtocol = apiUrl.startsWith("https") ? "wss:" : "ws:";
    const cleanUrl = apiUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}//${cleanUrl}/ws`;
  }
  
  // Otherwise use proxy (local dev)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onSuggestion?: (suggestion: SuggestedQuestion) => void;
  onSummary?: (summary: JobSummary) => void;
  onError?: (error: string) => void;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  sendTranscript: (text: string, speaker?: string) => void;
  endCall: () => void;
  clearSession: () => void;
  reconnect: () => void;
}

export function useWebSocket({
  url,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  onSuggestion,
  onSummary,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState("connecting");

    try {
      const wsUrl = url || getWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
        console.log("WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message: IncomingMessage = JSON.parse(event.data);

          switch (message.type) {
            case "suggestion":
              onSuggestion?.(message.data);
              break;
            case "summary":
              onSummary?.(message.data);
              break;
            case "error":
              onError?.(message.message);
              console.error("Server error:", message.message);
              break;
            case "cleared":
              console.log("Session cleared");
              break;
            default:
              console.warn("Unknown message type:", message);
          }
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionState("error");
      };

      ws.onclose = () => {
        setConnectionState("disconnected");
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
          );
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          console.log("Max reconnection attempts reached");
          setConnectionState("error");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setConnectionState("error");
    }
  }, [url, reconnectInterval, maxReconnectAttempts, onSuggestion, onSummary, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState("disconnected");
  }, [maxReconnectAttempts]);

  const sendMessage = useCallback((message: OutgoingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, message not sent");
    }
  }, []);

  const sendTranscript = useCallback(
    (text: string, speaker?: string) => {
      sendMessage({
        type: "transcript",
        text,
        speaker,
        timestamp: Date.now() / 1000,
      });
    },
    [sendMessage]
  );

  const endCall = useCallback(() => {
    sendMessage({ type: "end_call" });
  }, [sendMessage]);

  const clearSession = useCallback(() => {
    sendMessage({ type: "clear" });
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionState,
    sendTranscript,
    endCall,
    clearSession,
    reconnect,
  };
}
