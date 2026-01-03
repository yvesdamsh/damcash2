import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/components/LanguageContext';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { safeJSONParse } from '@/components/utils/errorHandler';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export default function VideoChat({ gameId, currentUser, opponentId, socket, externalSignals, gameStatus }) {
    const { t } = useLanguage();
    const [isCallActive, setIsCallActive] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, calling, incoming, connected

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const pendingOffer = useRef(null);
    const processedSignalsRef = useRef(new Set());
    const iceCandidatesBuffer = useRef([]); // Buffer for candidates arriving before remote description

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isCallActive]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, isCallActive]);

    // Direct Socket Listener for Real-Time Signals (Bypasses React State Batching)
    useEffect(() => {
        if (!socket) return;

        const handleMessage = (event) => {
            const msg = safeJSONParse(event.data, null);
            if (!msg) return;
            if (msg.type === 'SIGNAL') {
                const payload = msg.payload;
                if (payload.recipient_id === currentUser?.id && payload.sender_id !== currentUser?.id) {
                    handleSignalMessage(payload);
                }
            }
        };

        // Use addEventListener to coexist with other listeners
        socket.addEventListener('message', handleMessage);
        return () => socket.removeEventListener('message', handleMessage);
    }, [socket, currentUser]);

    const cleanup = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }
        peerConnection.current = null;
        pendingOffer.current = null;
        iceCandidatesBuffer.current = [];
        setLocalStream(null);
        setRemoteStream(null);
        setIsCallActive(false);
        setStatus('idle');
    };

    useEffect(() => {
        return () => {
            if (isCallActive || status === 'connected' || status === 'calling' || status === 'incoming') {
                try { sendSignal('hangup', '{}'); } catch (e) {}
            }
            cleanup();
        };
    }, [isCallActive, status]);

    useEffect(() => {
        if (gameStatus && gameStatus !== 'playing') {
            if (isCallActive || status === 'connected' || status === 'calling' || status === 'incoming') {
                try { sendSignal('hangup', '{}'); } catch (e) {}
                cleanup();
            }
        }
    }, [gameStatus]);

    const processBufferedCandidates = async () => {
        if (!peerConnection.current || !peerConnection.current.remoteDescription) return;
        
        while (iceCandidatesBuffer.current.length > 0) {
            const candidate = iceCandidatesBuffer.current.shift();
            try {
                await peerConnection.current.addIceCandidate(candidate);
            } catch (e) {
                console.error("Error adding buffered candidate", e);
            }
        }
    };

    useEffect(() => {
        const onUnload = () => {
            if (isCallActive || status === 'connected' || status === 'calling' || status === 'incoming') {
                try { sendSignal('hangup', '{}'); } catch (e) {}
            }
        };
        window.addEventListener('beforeunload', onUnload);
        window.addEventListener('pagehide', onUnload);
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            window.removeEventListener('pagehide', onUnload);
        };
    }, [isCallActive, status]);

    const createPeerConnection = () => {
        if (peerConnection.current) {
            try { peerConnection.current.close(); } catch(e) {}
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal('candidate', JSON.stringify(event.candidate));
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                toast.warning(t('game.connection_unstable'));
                if (pc.iceConnectionState === 'failed') {
                     pc.restartIce();
                }
            }
        };

        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        peerConnection.current = pc;
        return pc;
    };

    const startCall = async () => {
        try {
            setStatus('calling');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setIsCallActive(true);

            const pc = createPeerConnection();
            // Add tracks explicitly for fresh PC
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignal('offer', JSON.stringify(offer));
        } catch (err) {
            console.error("Error starting call", err);
            toast.error(t('game.media_error'));
            setStatus('idle');
        }
    };

    const handleSignalMessage = async (msg) => {
        const data = typeof msg?.data === 'string' ? safeJSONParse(msg.data, {}) : (msg?.data || {});

        if (msg.type === 'offer') {
            if (status === 'connected' || status === 'calling') return; 
            setStatus('incoming');
            pendingOffer.current = data;
        } else if (msg.type === 'answer') {
            if (peerConnection.current && peerConnection.current.signalingState !== 'stable') {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data));
                await processBufferedCandidates();
                setStatus('connected');
            }
        } else if (msg.type === 'candidate') {
            const candidate = new RTCIceCandidate(data);
            if (peerConnection.current && peerConnection.current.remoteDescription && peerConnection.current.remoteDescription.type) {
                try {
                    await peerConnection.current.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding ice candidate", e);
                }
            } else {
                // Buffer candidate if remote description is not set yet
                iceCandidatesBuffer.current.push(candidate);
            }
        } else if (msg.type === 'reject') {
            toast.error(t('game.call_rejected'));
            cleanup();
        } else if (msg.type === 'hangup') {
            toast.info(t('game.call_ended'));
            cleanup();
        }
    };

    const rejectCall = async () => {
        sendSignal('reject', '{}');
        setStatus('idle');
        pendingOffer.current = null;
    };

    const answerCall = async () => {
        try {
            const offer = pendingOffer.current;
            if (!offer) return;

            setStatus('connected');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setIsCallActive(true);

            const pc = createPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await processBufferedCandidates();
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignal('answer', JSON.stringify(answer));
        } catch (err) {
            console.error("Error answering", err);
            toast.error(t('game.answer_error'));
            rejectCall();
        }
    };

    // Handle external signals (from centralized polling/DB)
    useEffect(() => {
        if (externalSignals && externalSignals.length > 0) {
            const processSignals = async () => {
                for (const sig of externalSignals) {
                    if (processedSignalsRef.current.has(sig.id)) continue;
                    processedSignalsRef.current.add(sig.id);

                    handleSignalMessage({ type: sig.type, data: sig.data });
                    
                    // Delete to prevent re-processing
                    try {
                        await base44.entities.SignalMessage.delete(sig.id);
                    } catch(e) {}
                }
            };
            processSignals();
        }
    }, [externalSignals]);

    const sendSignal = async (type, data) => {
        // 1. Send via Socket (Fast)
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'SIGNAL',
                payload: {
                    game_id: gameId,
                    sender_id: currentUser.id,
                    recipient_id: opponentId,
                    type: type,
                    data: data
                }
            }));
        }
        
        // 2. Write to DB (Reliable Backup)
        try {
            await base44.entities.SignalMessage.create({
                game_id: gameId,
                sender_id: currentUser.id,
                recipient_id: opponentId,
                type: type,
                data: data
            });
        } catch (e) {
            console.error("Signal DB save error", e);
        }
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    const endCall = async () => {
        sendSignal('hangup', '{}');
        cleanup();
    };

    if (!opponentId) return null;

    return (
        <div className="bg-white/90 rounded-xl p-4 shadow-md border border-[#d4c5b0]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[#4a3728] flex items-center gap-2">
                    <Video className="w-4 h-4" /> {t('game.video_chat')}
                </h3>
                {status === 'idle' && (
                    <Button size="sm" onClick={startCall} className="bg-[#6b5138] hover:bg-[#5c4430]">
                        <Phone className="w-4 h-4 mr-2" /> {t('game.call')}
                    </Button>
                )}
                {status === 'calling' && (
                    <div className="text-xs text-[#6b5138] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> {t('game.calling')}
                    </div>
                )}
                {(status === 'connected' || isCallActive) && (
                    <Button size="sm" variant="destructive" onClick={endCall}>
                        <PhoneOff className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {status === 'incoming' && (
                <div className="mb-3 p-3 bg-amber-100 border border-amber-300 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-amber-900 font-medium">
                        <Phone className="w-4 h-4 animate-bounce" /> {t('game.incoming_call')}
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={rejectCall} className="text-red-600 hover:bg-red-100 hover:text-red-700">
                            {t('game.decline_call')}
                        </Button>
                        <Button size="sm" onClick={answerCall} className="bg-green-600 hover:bg-green-700 text-white">
                            {t('game.accept_call')}
                        </Button>
                    </div>
                </div>
            )}

            {isCallActive && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video group border border-gray-800">
                        <video 
                            ref={localVideoRef} 
                            autoPlay 
                            muted 
                            playsInline 
                            className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoOff ? 'hidden' : ''}`} 
                        />
                        {isVideoOff && (
                            <div className="absolute inset-0 flex items-center justify-center text-white/50">
                                <VideoOff className="w-8 h-8" />
                            </div>
                        )}
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-10">
                            <button onClick={toggleMute} className={`p-2 rounded-full shadow-md transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`} title={isMuted ? t('game.unmute') : t('game.mute')}>
                                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                            <button onClick={toggleVideo} className={`p-2 rounded-full shadow-md transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`} title={isVideoOff ? t('game.camera_on') : t('game.camera_off')}>
                                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                            </button>
                        </div>
                        <span className="absolute top-1 left-1 text-[10px] text-white/70 bg-black/30 px-1 rounded">{t('game.me')}</span>
                    </div>
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover" 
                        />
                         <span className="absolute top-1 left-1 text-[10px] text-white/70 bg-black/30 px-1 rounded">{t('history.opponent')}</span>
                         {!remoteStream && status === 'connected' && (
                             <div className="absolute inset-0 flex items-center justify-center">
                                 <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
                             </div>
                         )}
                    </div>
                </div>
            )}
        </div>
    );
}