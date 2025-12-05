import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export function useRobustWebSocket(url, options = {}) {
    const {
        onOpen,
        onMessage,
        onClose,
        onError,
        reconnectAttempts = 5,
        reconnectInterval = 3000,
        heartbeatInterval = 30000,
        autoConnect = true
    } = options;

    const [readyState, setReadyState] = useState(WebSocket.CLOSED);
    const wsRef = useRef(null);
    const reconnectCountRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const heartbeatTimerRef = useRef(null);
    const shouldReconnectRef = useRef(autoConnect);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        shouldReconnectRef.current = true;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        // Ensure url starts with / if relative
        const path = url.startsWith('http') || url.startsWith('ws') ? url : `${protocol}//${host}${url.startsWith('/') ? '' : '/'}${url}`;

        console.log(`Connecting to ${path}...`);
        const ws = new WebSocket(path);

        ws.onopen = (event) => {
            console.log(`Connected to ${path}`);
            setReadyState(WebSocket.OPEN);
            reconnectCountRef.current = 0;
            
            // Heartbeat
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'PING' }));
                }
            }, heartbeatInterval);

            if (onOpen) onOpen(event);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'PONG') return;
                if (onMessage) onMessage(event, data);
            } catch (e) {
                if (onMessage) onMessage(event, null);
            }
        };

        ws.onclose = (event) => {
            setReadyState(WebSocket.CLOSED);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            
            if (onClose) onClose(event);

            if (shouldReconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
                const timeout = reconnectInterval * Math.pow(1.5, reconnectCountRef.current);
                console.log(`Disconnected. Reconnecting in ${timeout}ms...`);
                reconnectTimerRef.current = setTimeout(() => {
                    reconnectCountRef.current++;
                    connect();
                }, timeout);
            }
        };

        ws.onerror = (event) => {
            console.error("WebSocket error:", event);
            if (onError) onError(event);
        };

        wsRef.current = ws;
    }, [url, reconnectAttempts, reconnectInterval, heartbeatInterval]);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const send = useCallback((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        if (autoConnect) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [connect, disconnect, autoConnect]);

    return {
        sendMessage: send,
        disconnect,
        connect,
        readyState,
        socket: wsRef.current
    };
}