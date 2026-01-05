import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/components/utils/logger';

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
    const [latencyMs, setLatencyMs] = useState(null);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const wsRef = useRef(null);
    const reconnectCountRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const heartbeatTimerRef = useRef(null);
    const lastPingRef = useRef(0);
    const pongTimeoutRef = useRef(null);
    const missedPongsRef = useRef(0);
    const shouldReconnectRef = useRef(autoConnect);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        shouldReconnectRef.current = true;
        
        if (!url) {
            logger.warn('[WS] No URL provided, skipping connection');
            return;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const isFramed = (()=>{ try { return window.self !== window.top; } catch(_) { return true; }})();
        if (isFramed && host.includes('preview-sandbox')) {
            logger.warn('[WS] Skipping WebSocket in preview sandbox iframe');
            return;
        }
        const path = url.startsWith('http') || url.startsWith('ws') ? url : `${protocol}//${host}${url.startsWith('/') ? '' : '/'}${url}`;

        logger.log('[WS][CONNECT]', new Date().toISOString(), path);
        const ws = new WebSocket(path);

        ws.onopen = (event) => {
            logger.log('[WS][OPEN]', new Date().toISOString(), path);
            setReadyState(WebSocket.OPEN);
            reconnectCountRef.current = 0;
            
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    // If previous PONG not cleared, count as missed
                    if (pongTimeoutRef.current) {
                        missedPongsRef.current += 1;
                        logger.warn('[WS][HEARTBEAT] PONG missed', missedPongsRef.current);
                        if (missedPongsRef.current >= 3) {
                            logger.error('[WS][HEARTBEAT] Connection unresponsive, forcing reconnect');
                            try { ws.close(); } catch (_) {}
                            return;
                        }
                    }
                    lastPingRef.current = performance.now();
                    ws.send(JSON.stringify({ type: 'PING' }));
                    // Set a timeout waiting for PONG
                    pongTimeoutRef.current = setTimeout(() => {
                        // If not cleared by PONG handler, next tick will treat as missed
                    }, Math.max(heartbeatInterval - 1000, 3000));
                }
            }, heartbeatInterval);

            if (onOpenRef.current) onOpenRef.current(event);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'PONG') {
                    if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null; }
                    missedPongsRef.current = 0;
                    if (lastPingRef.current) {
                        const dt = Math.round(performance.now() - lastPingRef.current);
                        setLatencyMs(dt);
                    }
                    return;
                }
                if (onMessageRef.current) onMessageRef.current(event, data);
            } catch (e) {
                if (onMessageRef.current) onMessageRef.current(event, null);
            }
        };

        ws.onclose = (event) => {
            setReadyState(WebSocket.CLOSED);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            
            if (onCloseRef.current) onCloseRef.current(event);

            if (!shouldReconnectRef.current) return;

            // Enforce reconnect attempts limit
            if (reconnectCountRef.current >= reconnectAttempts) {
                shouldReconnectRef.current = false;
                toast.error('Connection lost', {
                    action: {
                        label: 'Reconnect',
                        onClick: () => {
                            reconnectCountRef.current = 0;
                            shouldReconnectRef.current = true;
                            connect();
                        }
                    }
                });
                return;
            }

            const timeout = Math.min(reconnectInterval * Math.pow(2, reconnectCountRef.current), 30000);
            logger.log('[WS][CLOSE]', new Date().toISOString(), `reconnect in ${timeout}ms (attempt ${reconnectCountRef.current + 1})`);
            reconnectTimerRef.current = setTimeout(() => {
                reconnectCountRef.current++;
                connect();
            }, timeout);
        };

        ws.onerror = (event) => {
            logger.error('[WS][ERROR]', new Date().toISOString(), event);
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
        if (autoConnect && url) {
            connect();
        }
        return () => {
            disconnect();
        };
    }, [connect, disconnect, autoConnect, url]);

    // Browser online/offline awareness
    useEffect(() => {
        const onOnline = () => {
            setIsOnline(true);
            logger.log('[WS] Network online, reconnecting...');
            if (shouldReconnectRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
                reconnectCountRef.current = 0;
                connect();
            }
        };
        const onOffline = () => {
            setIsOnline(false);
            logger.warn('[WS] Network offline');
            toast.warning('Connexion perdue', { description: 'Tentative de reconnexion automatique...' });
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, [connect]);

    return {
        sendMessage: send,
        disconnect,
        connect,
        readyState,
        latencyMs,
        isOnline,
        socket: wsRef.current
    };
}