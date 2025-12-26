import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Coins } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WalletBalance() {
    const [balance, setBalance] = useState(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const user = await base44.auth.me();
                if (!user) return;
                const res = await base44.functions.invoke('walletManager', { action: 'get_balance' });
                setBalance(res.data.balance);
            } catch (e) {}
        };
        fetch();
        // Poll balance
        const interval = setInterval(fetch, 30000);
        return () => clearInterval(interval);
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