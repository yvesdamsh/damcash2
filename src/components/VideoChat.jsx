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

export default function VideoChat({ gameId, currentUser, opponentId }) {
    const [isCallActive, setIsCallActive] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, calling, incoming, connected

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const signalingInterval = useRef(null);
    const processedSignals = useRef(new Set());

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

    // Poll for signals
    useEffect(() => {
        if (!gameId || !currentUser || !opponentId) return;

        const checkSignals = async () => {
            try {
                const messages = await base44.entities.SignalMessage.filter({
                    game_id: gameId,
                    recipient_id: currentUser.id
                }, '-created_date', 10); // Get latest

                for (const msg of messages) {
                    if (processedSignals.current.has(msg.id)) continue;
                    processedSignals.current.add(msg.id);

                    await handleSignalMessage(msg);
                }
            } catch (e) {
                console.error("Signaling error", e);
            }
        };

        signalingInterval.current = setInterval(checkSignals, 2000);
        return () => clearInterval(signalingInterval.current);
    }, [gameId, currentUser, opponentId, isCallActive]);

    const cleanup = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }
        setLocalStream(null);
        setRemoteStream(null);
        setIsCallActive(false);
        setStatus('idle');
        processedSignals.current.clear();
    };

    useEffect(() => {
        return cleanup;
    }, []);

    const createPeerConnection = () => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                await sendSignal('candidate', JSON.stringify(event.candidate));
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
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
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await sendSignal('offer', JSON.stringify(offer));
        } catch (err) {
            console.error("Error starting call", err);
            toast.error("Impossible d'accéder à la caméra/micro");
            setStatus('idle');
        }
    };

    const handleSignalMessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (msg.type === 'offer') {
            // Incoming call
            if (status === 'connected') return; 
            setStatus('incoming');
            
            // Auto answer for simplicity in this demo, or could show UI
            // For better UX, we might want to show an "Answer" button, 
            // but to ensure "players can see each other", let's try to set up.
            // Actually, user must interact to allow camera. So we show incoming state.
            toast.info("Appel entrant vidéo...", {
                action: {
                    label: "Répondre",
                    onClick: () => answerCall(data)
                }
            });
        } else if (msg.type === 'answer') {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data));
                setStatus('connected');
            }
        } else if (msg.type === 'candidate') {
            if (peerConnection.current) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(data));
                } catch (e) {
                    console.error("Error adding ice candidate", e);
                }
            }
        }
    };

    const answerCall = async (offer) => {
        try {
            setStatus('connected');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setIsCallActive(true);

            const pc = createPeerConnection();
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendSignal('answer', JSON.stringify(answer));
        } catch (err) {
            console.error("Error answering", err);
            toast.error("Erreur lors de la réponse");
        }
    };

    const sendSignal = async (type, data) => {
        await base44.entities.SignalMessage.create({
            game_id: gameId,
            sender_id: currentUser.id,
            recipient_id: opponentId,
            type: type,
            data: data
        });
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

    const endCall = () => {
        cleanup();
        // Optionally send a "hangup" signal
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
                {status === 'incoming' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 animate-pulse">
                        <Phone className="w-4 h-4 mr-2" /> Répondre
                    </Button>
                )}
                {(status === 'connected' || isCallActive) && (
                    <Button size="sm" variant="destructive" onClick={endCall}>
                        <PhoneOff className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {isCallActive && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video group">
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
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={toggleMute} className={`p-1.5 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/40'}`}>
                                {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            </button>
                            <button onClick={toggleVideo} className={`p-1.5 rounded-full ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/40'}`}>
                                {isVideoOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
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