import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const clients = new Map(); // tournamentId -> Set of sockets

export default async function handler(req) {
    if (req.headers.get("upgrade") !== "websocket") {
        return new Response(null, { status: 501 });
    }

    const url = new URL(req.url);
    const tournamentId = url.searchParams.get('tournamentId');

    if (!tournamentId) {
        return new Response(null, { status: 400 });
    }

    // Allow simple HTTP POST fanout for presence updates (so lobby sees seats instantly)
    if (req.method === 'POST') {
        try {
            const body = await req.json().catch(() => ({}));
            const { type, payload, tournamentId: bodyTid } = body || {};
            const tid = tournamentId || bodyTid;
            const tournamentClients = clients.get(tid);
            if (type && tournamentClients) {
                for (const client of tournamentClients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type, payload }));
                    }
                }
            }
            return Response.json({ ok: true });
        } catch (e) {
            return Response.json({ error: e.message }, { status: 500 });
        }
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
        if (!clients.has(tournamentId)) {
            clients.set(tournamentId, new Set());
        }
        clients.get(tournamentId).add(socket);
        console.log(`Client connected to tournament ${tournamentId}`);
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Broadcast to all clients in the tournament
            if (data.type === 'CHAT_MESSAGE') {
                const tournamentClients = clients.get(tournamentId);
                if (tournamentClients) {
                    for (const client of tournamentClients) {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'CHAT_MESSAGE',
                                payload: data.payload
                            }));
                        }
                    }
                }
                
                // Persist message
                // Note: In a real prod env, we might want to do this via a separate API call 
                // or use the service role here if we had the user context (we don't easily have auth context in raw socket open without token)
                // For simplicity, the frontend will likely call create() API AND send socket message, 
                // OR we just broadcast here and let frontend persist.
                // BETTER PATTERN: Frontend persists via API, API/Frontend sends socket message.
                // Here we act as a relay.
            }
        } catch (e) {
            console.error("Socket error", e);
        }
    };

    socket.onclose = () => {
        const tournamentClients = clients.get(tournamentId);
        if (tournamentClients) {
            tournamentClients.delete(socket);
            if (tournamentClients.size === 0) {
                clients.delete(tournamentId);
            }
        }
    };

    return response;
}

Deno.serve(handler);