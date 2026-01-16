import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function PresenceHotfix() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const runFix = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await base44.functions.invoke('updateUserLastSeen', {
        usernames: ['bona', 'missdeecash']
      });
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Auto-run once per session to avoid duplicates
    if (!sessionStorage.getItem('presence_hotfix_ran')) {
      sessionStorage.setItem('presence_hotfix_ran', '1');
      runFix();
    }
  }, []);

  return (
    <div className="max-w-xl mx-auto">
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Presence Hotfix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Met à jour immédiatement last_seen pour: bona et missdeecash.</p>
          <div className="flex gap-2">
            <Button onClick={runFix} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Exécution…' : 'Relancer maintenant'}
            </Button>
          </div>

          {result?.ok && (
            <div className="mt-2 text-sm">
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Mise à jour réussie
              </div>
              <pre className="mt-2 bg-slate-50 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {error && (
            <div className="mt-2 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}