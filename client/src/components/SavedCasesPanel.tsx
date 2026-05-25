import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, FolderOpen, Trash2, Plus, FileClock, LogIn } from 'lucide-react';

interface SavedCaseSummary {
  id: string;
  name: string;
  customer_type: string | null;
  grid_connection: string | null;
  has_results: boolean;
  created_at: string;
  updated_at: string;
}

interface SavedCaseFull extends SavedCaseSummary {
  state: any;
  results: any;
}

interface SavedCasesPanelProps {
  currentState: any;
  currentResults: any;
  onLoad: (state: any, results: any) => void;
}

function fmtDate(s: string): string {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function SavedCasesPanel({ currentState, currentResults, onLoad }: SavedCasesPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isGuest = !user?.email;

  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const casesQuery = useQuery<SavedCaseSummary[], Error>({
    queryKey: ['/api/cases'],
    enabled: !isGuest,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/cases'] });

  const saveMutation = useMutation<SavedCaseFull, Error, { asNew: boolean }>({
    mutationFn: async ({ asNew }) => {
      const body = { name: name.trim(), state: currentState, results: currentResults ?? null };
      const id = asNew ? null : selectedId;
      const res = id
        ? await apiRequest('PUT', `/api/cases/${id}`, body)
        : await apiRequest('POST', '/api/cases', body);
      return (await res.json()) as SavedCaseFull;
    },
    onSuccess: (data, { asNew }) => {
      setSelectedId(data.id);
      invalidate();
      toast({ title: asNew || !selectedId ? 'Case saved' : 'Case updated', description: `"${data.name}"` });
    },
    onError: (err) => toast({ title: 'Could not save', description: err.message, variant: 'destructive' }),
  });

  const loadMutation = useMutation<SavedCaseFull, Error, string>({
    mutationFn: async (id) => {
      const res = await apiRequest('GET', `/api/cases/${id}`);
      return (await res.json()) as SavedCaseFull;
    },
    onSuccess: (data) => {
      onLoad(data.state, data.results ?? undefined);
      setSelectedId(data.id);
      setName(data.name);
      toast({ title: 'Case loaded', description: `"${data.name}" — opened in Inputs` });
    },
    onError: (err) => toast({ title: 'Could not load', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => { await apiRequest('DELETE', `/api/cases/${id}`); },
    onSuccess: (_v, id) => {
      if (selectedId === id) { setSelectedId(null); setName(''); }
      setConfirmingId(null);
      invalidate();
      toast({ title: 'Case deleted' });
    },
    onError: (err) => toast({ title: 'Could not delete', description: err.message, variant: 'destructive' }),
  });

  if (isGuest) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold mb-1">Saved Cases</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Save your study cases and reopen them any time.
        </p>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <LogIn className="h-10 w-10 mx-auto text-orange-400" />
            <p className="font-medium">Sign in with Google to save your work</p>
            <p className="text-sm text-muted-foreground">
              Guest sessions aren’t saved. Sign in with your Google account to store study cases
              and see them on any device.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cases = casesQuery.data ?? [];
  const canSave = name.trim().length > 0 && !saveMutation.isPending;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Saved Cases</h2>
        <p className="text-sm text-muted-foreground">
          Save the current inputs and results as a study case, then reopen them any time.
        </p>
      </div>

      {/* Save current */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Save className="h-4 w-4 text-orange-400" />
            {selectedId ? 'Save changes to the open case' : 'Save current study case'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Case name (e.g. Villa Amman – 8kWp Net Billing)"
              data-testid="input-case-name"
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) saveMutation.mutate({ asNew: !selectedId }); }}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate({ asNew: !selectedId })}
                disabled={!canSave}
                data-testid="button-save-case"
                className="flex items-center gap-2 whitespace-nowrap"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {selectedId ? 'Update' : 'Save'}
              </Button>
              {selectedId && (
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate({ asNew: true })}
                  disabled={!canSave}
                  className="flex items-center gap-2 whitespace-nowrap"
                  title="Save as a new case instead of updating"
                >
                  <Plus className="h-4 w-4" /> Save as new
                </Button>
              )}
            </div>
          </div>
          {selectedId && (
            <p className="text-xs text-muted-foreground">
              Editing an open case. Use <strong>Update</strong> to overwrite it, or <strong>Save as new</strong> to keep both.{' '}
              <button className="underline" onClick={() => { setSelectedId(null); setName(''); }}>Start a fresh case</button>
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* List */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <FileClock className="h-4 w-4" /> Your study cases
        </h3>

        {casesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : casesQuery.isError ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">
            {/^5\d\d:/.test(casesQuery.error.message)
              ? 'Saving isn’t configured on the server yet. Once the database is connected your cases will appear here.'
              : `Couldn’t load cases: ${casesQuery.error.message}`}
          </CardContent></Card>
        ) : cases.length === 0 ? (
          <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">
            No saved cases yet. Configure a system under <strong>Inputs</strong>, then save it above.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <Card key={c.id} className={selectedId === c.id ? 'border-orange-500/40' : ''} data-testid={`case-${c.id}`}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {c.customer_type && <Badge variant="secondary" className="text-xs">{c.customer_type}</Badge>}
                      {c.grid_connection && <Badge variant="outline" className="text-xs">{c.grid_connection}</Badge>}
                      {c.has_results && <Badge variant="outline" className="text-xs">has results</Badge>}
                      <span className="text-xs text-muted-foreground">Updated {fmtDate(c.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => loadMutation.mutate(c.id)}
                      disabled={loadMutation.isPending}
                      data-testid={`button-load-${c.id}`}
                      className="flex items-center gap-1"
                    >
                      <FolderOpen className="h-4 w-4" /> Open
                    </Button>
                    {confirmingId === c.id ? (
                      <Button
                        size="sm" variant="destructive"
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                      </Button>
                    ) : (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setConfirmingId(c.id); setTimeout(() => setConfirmingId((id) => (id === c.id ? null : id)), 4000); }}
                        title="Delete this case"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
