import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export default function VideoChat({ gameId, currentUser, opponentId, socket, lastSignal }) {
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

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Handle incoming signals via Socket props
    useEffect(() => {
        if (lastSignal) {
            handleSignalMessage(lastSignal);
        }
    }, [lastSignal]);

    const cleanup = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current && typeof peerConnection.current.close === 'function') {
            peerConnection.current.close();
        }
        peerConnection.current = null;
        pendingOffer.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        setIsCallActive(false);
        setStatus('idle');
    };

    useEffect(() => {
        return cleanup;
    }, []);

    const createPeerConnection = () => {
        if (peerConnection.current && peerConnection.current.close) peerConnection.current.close();

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                sendSignal('candidate', JSON.stringify(event.candidate));
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                toast.warning("Connexion instable...");
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
            toast.error("Impossible d'accéder à la caméra/micro");
            setStatus('idle');
        }
    };

    const handleSignalMessage = async (msg) => {
        const data = msg.data ? JSON.parse(msg.data) : {};

        if (msg.type === 'offer') {
            if (status === 'connected' || status === 'calling') return; 
            setStatus('incoming');
            pendingOffer.current = data;
        } else if (msg.type === 'answer') {
            if (peerConnection.current && peerConnection.current.signalingState !== 'stable') {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data));
                setStatus('connected');
            }
        } else if (msg.type === 'candidate') {
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(data));
                } catch (e) {
                    console.error("Error adding ice candidate", e);
                }
            }
        } else if (msg.type === 'reject') {
            toast.error("Appel refusé");
            cleanup();
        } else if (msg.type === 'hangup') {
            toast.info("Appel terminé");
            cleanup();
        }
    };

    const rejectCall = async () => {
        sendSignal('reject', '{}');
        setStatus('idle');
        peerConnection.current = null;
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
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignal('answer', JSON.stringify(answer));
        } catch (err) {
            console.error("Error answering", err);
            toast.error("Erreur lors de la réponse");
            rejectCall();
        }
    };

    const sendSignal = (type, data) => {
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
        } else {
            // Fallback to HTTP if socket closed? (Rare if in game)
            // For now assume socket is robust
            console.warn("Socket not ready for signal");
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
                    <Video className="w-4 h-4" /> Chat Vidéo
                </h3>
                {status === 'idle' && (
                    <Button size="sm" onClick={startCall} className="bg-[#6b5138] hover:bg-[#5c4430]">
                        <Phone className="w-4 h-4 mr-2" /> Appeler
                    </Button>
                )}
                {status === 'calling' && (
                    <div className="text-xs text-[#6b5138] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Appel en cours...
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
                        <Phone className="w-4 h-4 animate-bounce" /> Appel entrant...
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={rejectCall} className="text-red-600 hover:bg-red-100 hover:text-red-700">
                            Refuser
                        </Button>
                        <Button size="sm" onClick={answerCall} className="bg-green-600 hover:bg-green-700 text-white">
                            Accepter
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
                            <button onClick={toggleMute} className={`p-2 rounded-full shadow-md transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`} title={isMuted ? "Activer micro" : "Couper micro"}>
                                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                            <button onClick={toggleVideo} className={`p-2 rounded-full shadow-md transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'}`} title={isVideoOff ? "Activer caméra" : "Couper caméra"}>
                                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                            </button>
                        </div>
                        <span className="absolute top-1 left-1 text-[10px] text-white/70 bg-black/30 px-1 rounded">Moi</span>
                    </div>
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover" 
                        />
                         <span className="absolute top-1 left-1 text-[10px] text-white/70 bg-black/30 px-1 rounded">Adversaire</span>
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