import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export function useRobustWebSocket(url, options = {}) {
    const {
        onOpen,
        onMessage,
        onClose,
        onError,
        reconnectAttempts = 5,
        reconnectInterval = 1000,
        heartbeatInterval = 10000,
        autoConnect = true
    } = options;

    // Use refs for callbacks to avoid reconnects on render
    const onOpenRef = useRef(onOpen);
    const onMessageRef = useRef(onMessage);
    const onCloseRef = useRef(onClose);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onOpenRef.current = onOpen;
        onMessageRef.current = onMessage;
        onCloseRef.current = onClose;
        onErrorRef.current = onError;
    }, [onOpen, onMessage, onClose, onError]);

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
        const isFramed = (()=>{ try { return window.self !== window.top; } catch(_) { return true; }})();
        if (isFramed && host.includes('preview-sandbox')) {
            console.warn('[WS] Skipping WebSocket in preview sandbox iframe');
            return;
        }
        const path = url.startsWith('http') || url.startsWith('ws') ? url : `${protocol}//${host}${url.startsWith('/') ? '' : '/'}${url}`;

        console.log('[WS][CONNECT]', new Date().toISOString(), path);
        const ws = new WebSocket(path);

        ws.onopen = (event) => {
            console.log('[WS][OPEN]', new Date().toISOString(), path);
            setReadyState(WebSocket.OPEN);
            reconnectCountRef.current = 0;
            
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'PING' }));
                }
            }, heartbeatInterval);

            if (onOpenRef.current) onOpenRef.current(event);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'PONG') return;
                if (onMessageRef.current) onMessageRef.current(event, data);
            } catch (e) {
                if (onMessageRef.current) onMessageRef.current(event, null);
            }
        };

        ws.onclose = (event) => {
            setReadyState(WebSocket.CLOSED);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            
            if (onCloseRef.current) onCloseRef.current(event);

            if (shouldReconnectRef.current && reconnectCountRef.current < reconnectAttempts) {
                const timeout = Math.min(reconnectInterval * Math.pow(2, reconnectCountRef.current), 15000);
                console.log('[WS][CLOSE]', new Date().toISOString(), `reconnect in ${timeout}ms`);
                reconnectTimerRef.current = setTimeout(() => {
                    reconnectCountRef.current++;
                    connect();
                }, timeout);
            }
        };

        ws.onerror = (event) => {
            console.error('[WS][ERROR]', new Date().toISOString(), event);
            if (onErrorRef.current) onErrorRef.current(event);
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