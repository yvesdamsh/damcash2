import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, XCircle, Clipboard, Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'untested', label: 'Untested' },
  { value: 'pass', label: 'Pass' },
  { value: 'issue', label: 'Issue' },
  { value: 'fail', label: 'Fail' },
];

const Section = ({ title, items, setItems, notes, setNotes }) => {
  const iconFor = (s) => {
    if (s === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (s === 'issue') return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    if (s === 'fail') return <XCircle className="w-4 h-4 text-red-600" />;
    return <Loader2 className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="bg-white dark:bg-[#1e1814] border border-[#d4c5b0] dark:border-[#3d2b1f] rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">{iconFor(it.status)}</div>
            <div className="flex-1 text-sm">{it.label}</div>
            <div className="w-36">
              <Select value={it.status} onValueChange={(v) => {
                const next = items.slice();
                next[idx] = { ...it, status: v };
                setItems(next);
              }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <label className="text-xs font-medium opacity-70">Notes</label>
        <textarea
          className="mt-1 w-full min-h-[80px] rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-2 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observations, erreurs console, étapes pour reproduire, etc."
        />
      </div>
    </div>
  );
};

export default function QAReport() {
  const [checkers, setCheckers] = React.useState([
    { label: 'Start new game vs AI (all 4 difficulties)', status: 'untested' },
    { label: 'Verify mandatory captures work', status: 'untested' },
    { label: 'Verify king promotion works', status: 'untested' },
    { label: 'Verify chain captures work', status: 'untested' },
    { label: 'Test resign and draw buttons', status: 'untested' },
    { label: 'Verify game end detection', status: 'untested' },
  ]);
  const [checkersNotes, setCheckersNotes] = React.useState('');

  const [chess, setChess] = React.useState([
    { label: 'Start new game vs AI (all 4 difficulties)', status: 'untested' },
    { label: 'Verify all piece movements', status: 'untested' },
    { label: 'Verify castling works', status: 'untested' },
    { label: 'Verify en passant works', status: 'untested' },
    { label: 'Verify pawn promotion works', status: 'untested' },
    { label: 'Verify check/checkmate detection', status: 'untested' },
    { label: 'Verify Stockfish AI responds correctly', status: 'untested' },
  ]);
  const [chessNotes, setChessNotes] = React.useState('');

  const [theme, setTheme] = React.useState([
    { label: 'Toggle between Checkers/Chess themes', status: 'untested' },
    { label: 'Verify colors change correctly', status: 'untested' },
    { label: 'Verify theme persists after refresh', status: 'untested' },
  ]);
  const [themeNotes, setThemeNotes] = React.useState('');

  const [shop, setShop] = React.useState([
    { label: 'View coin packages', status: 'untested' },
    { label: 'Click "Buy with Stripe" (verify redirect)', status: 'untested' },
    { label: 'Purchase items with coins', status: 'untested' },
    { label: 'Verify balance updates', status: 'untested' },
  ]);
  const [shopNotes, setShopNotes] = React.useState('');

  const [user, setUser] = React.useState([
    { label: 'Login/Logout', status: 'untested' },
    { label: 'View Profile', status: 'untested' },
    { label: 'Update Settings', status: 'untested' },
    { label: 'View Leaderboard', status: 'untested' },
    { label: 'Send Messages', status: 'untested' },
  ]);
  const [userNotes, setUserNotes] = React.useState('');

  const [tournaments, setTournaments] = React.useState([
    { label: 'View tournament list', status: 'untested' },
    { label: 'Join a tournament', status: 'untested' },
    { label: 'View tournament details', status: 'untested' },
  ]);
  const [tournamentNotes, setTournamentNotes] = React.useState('');

  const [works, setWorks] = React.useState('');
  const [issues, setIssues] = React.useState('');
  const [fixes, setFixes] = React.useState('');

  const gatherSection = (title, arr, notes) => {
    const lines = arr.map(a => `- [${a.status === 'pass' ? 'x' : ' '}] ${a.label}${a.status !== 'pass' && a.status !== 'untested' ? ` (${a.status})` : ''}`);
    return `\n## ${title}\n${lines.join('\n')}${notes ? `\n\nNotes:\n${notes}` : ''}`;
  };

  const copyReport = async () => {
    const md = [
      '# QA Report',
      gatherSection('Checkers Game', checkers, checkersNotes),
      gatherSection('Chess Game', chess, chessNotes),
      gatherSection('Theme Switching', theme, themeNotes),
      gatherSection('Shop & Payments', shop, shopNotes),
      gatherSection('User Features', user, userNotes),
      gatherSection('Tournaments', tournaments, tournamentNotes),
      '\n# Summary',
      `\n## What works ✅\n${works || '- N/A'}`,
      `\n## What has issues ⚠️\n${issues || '- N/A'}`,
      `\n## What needs fixing ❌\n${fixes || '- N/A'}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(md);
      alert('QA report copied to clipboard');
    } catch (_) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('QA report copied to clipboard');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">QA Report</h1>
        <Button onClick={copyReport} className="gap-2"><Clipboard className="w-4 h-4" /> Copy Report</Button>
      </div>

      <Section title="1. Test Checkers Game" items={checkers} setItems={setCheckers} notes={checkersNotes} setNotes={setCheckersNotes} />
      <Section title="2. Test Chess Game" items={chess} setItems={setChess} notes={chessNotes} setNotes={setChessNotes} />
      <Section title="3. Test Theme Switching" items={theme} setItems={setTheme} notes={themeNotes} setNotes={setThemeNotes} />
      <Section title="4. Test Shop & Payments" items={shop} setItems={setShop} notes={shopNotes} setNotes={setShopNotes} />
      <Section title="5. Test User Features" items={user} setItems={setUser} notes={userNotes} setNotes={setUserNotes} />
      <Section title="6. Test Tournaments" items={tournaments} setItems={setTournaments} notes={tournamentNotes} setNotes={setTournamentNotes} />

      <div className="bg-white dark:bg-[#1e1814] border border-[#d4c5b0] dark:border-[#3d2b1f] rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">7. Fix & Debug Checklist</h2>
        <ul className="list-disc ml-5 text-sm space-y-1">
          <li>Check browser console for errors</li>
          <li>Check network tab for failed requests</li>
          <li>Verify all pages load correctly</li>
          <li>Test on mobile view</li>
        </ul>
      </div>

      <div className="bg-white dark:bg-[#1e1814] border border-[#d4c5b0] dark:border-[#3d2b1f] rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">8. Report Summary</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium opacity-70">What works ✅</label>
            <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-2 text-sm" value={works} onChange={(e) => setWorks(e.target.value)} placeholder="Features working as expected..." />
          </div>
          <div>
            <label className="text-xs font-medium opacity-70">What has issues ⚠️</label>
            <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-2 text-sm" value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="Bugs, inconsistencies, intermittent problems..." />
          </div>
          <div>
            <label className="text-xs font-medium opacity-70">What needs fixing ❌</label>
            <textarea className="mt-1 w-full min-h-[100px] rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-2 text-sm" value={fixes} onChange={(e) => setFixes(e.target.value)} placeholder="Blocking issues, regressions, broken flows..." />
          </div>
        </div>
      </div>
    </div>
  );
}