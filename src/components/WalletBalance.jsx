import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { safeInvoke } from '@/utils/safeInvoke';
import { Coins } from 'lucide-react';
import { Link } from 'react-router-dom';

// Simple in-memory cache to avoid hammering backend
let __balanceCache = { value: null, ts: 0, pending: null };

 export default function WalletBalance() {
    const [balance, setBalance] = useState(null);

    useEffect(() => {
        const loadBalance = async (force = false) => {
            try {
                // Skip when tab not visible unless forced
                if (document.hidden && !force) return;

                const user = await base44.auth.me();
                if (!user) return;

                const now = Date.now();
                // Serve cached value if fresh (<60s)
                if (__balanceCache.value !== null && now - __balanceCache.ts < 60000 && !force) {
                    setBalance(__balanceCache.value);
                    return;
                }

                // If a request is in-flight, await it
                if (__balanceCache.pending) {
                    const result = await __balanceCache.pending;
                    setBalance(result.balance);
                    return;
                }

                // Issue a single request and share the promise
                const p = (async () => {
                    const result = await safeInvoke('walletManager', { action: 'get_balance' }, {
                      fallbackData: { balance: 0 },
                      retries: 2,
                      logErrors: false
                    });
                    return { balance: (result?.data?.balance ?? 0), ts: Date.now() };
                })();
                __balanceCache.pending = p;
                const { balance: b, ts } = await p;
                __balanceCache = { value: b, ts, pending: null };
                setBalance(b);
            } catch (e) {
                __balanceCache.pending = null;
            }
        };

        // Initial load (force even if hidden to warm cache)
        loadBalance(true);

        // Poll every 60s when visible
        const interval = setInterval(() => loadBalance(false), 60000);

        const onVisibility = () => { if (!document.hidden) loadBalance(false); };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    if (balance === null) return null;

    return (
        <Link to="/Wallet" className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2c1e12]/50 hover:bg-[#2c1e12] rounded-full text-[#e8dcc5] transition-colors border border-yellow-500/30">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-bold font-mono">{balance}</span>
            <span className="text-xs text-yellow-500/80">D$</span>
        </Link>
    );
}