import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { 
  useGetGameState, 
  useStartGame, 
  useSubmitDecision, 
  useAdvanceRound,
  useChooseShock,
  useScoreTeams,
  getGetGameStateQueryKey,
  DecisionInputLocation,
  DecisionInputMenu,
  ShockInputShock,
  type GameState,
  type GameSession,
  type Player
} from '@workspace/api-client-react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatINR, cn } from '@/lib/utils';
import { Loader2, Store, Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Award, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Game() {
  const params = useParams();
  const code = params.code as string;
  const [, setLocation] = useLocation();
  const { session } = useGameSession(code);

  useEffect(() => {
    if (!session) {
      setLocation('/');
    }
  }, [session, setLocation]);

  const { data: gameState, isLoading, error } = useGetGameState(code, {
    query: {
      queryKey: getGetGameStateQueryKey(code),
      refetchInterval: 2000, // Poll every 2 seconds
      enabled: !!code && !!session
    },
    request: {
      headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
    }
  });

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4 p-4">
        <AlertTriangle className="text-destructive w-16 h-16" />
        <h2 className="text-2xl font-display font-bold">Failed to load game</h2>
        <Button onClick={() => setLocation('/')}>Return Home</Button>
      </div>
    );
  }

  const isHost = session.role === 'host';
  const me = gameState.players.find(p => p.id === session.playerId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader gameState={gameState} session={session} me={me} />
      
      <main className="flex-1 container mx-auto p-4 md:p-6">
        {gameState.status === 'lobby' && <LobbyView gameState={gameState} session={session} isHost={isHost} />}
        {gameState.status === 'decisions' && <DecisionsView gameState={gameState} session={session} isHost={isHost} />}
        {gameState.status === 'revealed' && <RevealedView gameState={gameState} session={session} isHost={isHost} />}
        {gameState.status === 'complete' && <CompleteView gameState={gameState} session={session} isHost={isHost} />}
      </main>
    </div>
  );
}

function GameHeader({ gameState, session, me }: { gameState: GameState, session: GameSession, me?: Player }) {
  const isHost = session.role === 'host';
  
  return (
    <header className="bg-card border-b-4 border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground font-display font-bold px-3 py-1 rounded-md text-xl tracking-widest shadow-sm border-2 border-primary-foreground/20">
              {gameState.code}
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight uppercase tracking-wide flex items-center gap-2">
                {session.name}
                {isHost && <Badge variant="secondary" className="ml-2">HOST</Badge>}
              </h1>
              {gameState.status !== 'lobby' && (
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="font-bold text-primary">{gameState.roundLabel}</span>
                  {gameState.shock && gameState.shock !== 'None' && (
                    <Badge variant="destructive" className="scale-75 origin-left">Active Shock</Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {!isHost && me && gameState.status !== 'lobby' && (
            <div className="flex gap-4 md:gap-6 bg-muted/50 p-2 md:px-4 md:py-2 rounded-lg border-2 border-border overflow-x-auto w-full md:w-auto">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start Capital</span>
                <span className="font-display font-bold text-foreground">{formatINR(me.startingCapital)}</span>
              </div>
              <div className="w-0.5 bg-border rounded-full hidden md:block"></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Available Cash</span>
                <span className={cn(
                  "font-display font-bold",
                  me.cashBalance < 0 ? "text-destructive" : "text-green-600"
                )}>
                  {formatINR(me.cashBalance)}
                </span>
              </div>
              {me.roundSpend > 0 && (
                <>
                  <div className="w-0.5 bg-border rounded-full hidden md:block"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Round Spend</span>
                    <span className="font-display font-bold text-destructive">
                      -{formatINR(me.roundSpend)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LobbyView({ gameState, session, isHost }: { gameState: GameState, session: GameSession, isHost: boolean }) {
  const startGame = useStartGame();
  const players = gameState.players.filter(p => !p.isHost);
  const [copied, setCopied] = useState(false);

  const handleStart = () => {
    startGame.mutate({ code: gameState.code, data: { token: session.token } });
  };

  const copyInviteLink = async () => {
    const url = new URL(window.location.href);
    const gamePath = `/game/${encodeURIComponent(gameState.code)}`;
    const gamePathIndex = url.pathname.indexOf(gamePath);
    url.pathname = gamePathIndex >= 0
      ? `${url.pathname.slice(0, gamePathIndex)}/`
      : url.pathname;
    url.search = new URLSearchParams({ room: gameState.code }).toString();
    url.hash = '';

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-4">
        <CardHeader className="text-center pb-8 border-b-2 border-border">
          <CardTitle className="text-4xl md:text-5xl mb-2">Waiting for Teams</CardTitle>
          <p className="text-muted-foreground text-lg">
            Room Code: <span className="font-display font-bold text-foreground text-2xl tracking-widest">{gameState.code}</span>
          </p>
          <p className="text-sm font-bold text-muted-foreground mt-2 uppercase tracking-wider">
            {players.length} / 10 team seats filled
          </p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button type="button" variant="outline" onClick={copyInviteLink} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Invite Link Copied' : 'Copy Invite Link'}
            </Button>
            <span className="text-xs text-muted-foreground">Send this link to all 10 teams</span>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {players.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                No teams have joined yet...
              </div>
            ) : (
              players.map((p) => (
                <div key={p.id} className="bg-muted border-2 border-border rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 relative">
                  <div className={cn(
                    "absolute top-2 right-2 w-3 h-3 rounded-full",
                    p.connected ? "bg-green-500" : "bg-destructive"
                  )} />
                  <Store className="w-8 h-8 text-primary mb-1" />
                  <span className="font-bold font-display line-clamp-1 w-full">{p.name}</span>
                </div>
              ))
            )}
            {players.length > 0 && players.length < 10 && Array.from({ length: 10 - players.length }).map((_, index) => (
              <div key={`open-seat-${index}`} className="border-2 border-dashed border-border rounded-xl p-4 min-h-[104px] flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
                <span className="font-display font-bold text-2xl">+</span>
                <span className="text-xs font-bold uppercase tracking-wider">Open seat</span>
              </div>
            ))}
          </div>
          
          {isHost ? (
            <Button 
              className="w-full h-16 text-xl" 
              onClick={handleStart}
              disabled={players.length === 0 || startGame.isPending}
            >
              {startGame.isPending ? 'Starting...' : 'Start Game'}
            </Button>
          ) : (
            <div className="text-center p-6 bg-secondary/20 border-2 border-secondary text-secondary-foreground rounded-xl font-bold font-display uppercase tracking-wide">
              Waiting for the host to start the game...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DecisionsView({ gameState, session, isHost }: { gameState: GameState, session: GameSession, isHost: boolean }) {
  if (isHost) {
    return <HostDecisionsView gameState={gameState} session={session} />;
  }
  return <PlayerDecisionsView gameState={gameState} session={session} />;
}

function HostDecisionsView({ gameState, session }: { gameState: GameState, session: GameSession }) {
  const advanceRound = useAdvanceRound();
  const chooseShock = useChooseShock();
  const [selectedShock, setSelectedShock] = useState<ShockInputShock>(ShockInputShock.None);
  const { toast } = useToast();
  
  const players = gameState.players.filter(p => !p.isHost);
  const allSubmitted = players.length > 0 && players.every(p => p.submitted);

  const handleAdvance = () => {
    advanceRound.mutate({ code: gameState.code, data: { token: session.token } });
  };

  const handleApplyShock = () => {
    chooseShock.mutate(
      { code: gameState.code, data: { token: session.token, shock: selectedShock } },
      {
        onSuccess: () => toast({ title: "Shock applied to upcoming round." })
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold">Team Status</h2>
        <Button 
          onClick={handleAdvance} 
          disabled={advanceRound.isPending} // allow host to advance even if not all submitted
          variant={allSubmitted ? 'default' : 'outline'}
          size="lg"
        >
          {advanceRound.isPending ? 'Processing...' : 'Advance to Results'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {players.map(p => (
          <Card key={p.id} className={cn("border-2 transition-colors", p.submitted ? "border-green-500 bg-green-50/50" : "border-border")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Store className={p.submitted ? "text-green-600" : "text-muted-foreground"} />
                <span className="font-bold font-display text-lg">{p.name}</span>
              </div>
              {p.submitted ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Decisions Locked</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Strategizing...</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {gameState.activeRound === 3 && (
        <Card className="border-4 border-destructive mt-8 shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-destructive" />
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle /> Market Disruption (Round 3)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <Select 
                value={selectedShock} 
                onChange={(e) => setSelectedShock(e.target.value as ShockInputShock)}
                className="flex-1 border-destructive/30 focus-visible:ring-destructive"
              >
                {Object.values(ShockInputShock).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Button 
                variant="destructive" 
                onClick={handleApplyShock}
                disabled={chooseShock.isPending}
              >
                Apply Disruption
              </Button>
            </div>
            {gameState.shock !== 'None' && (
              <p className="mt-4 text-sm font-bold text-destructive">Current Shock: {gameState.shock}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlayerDecisionsView({ gameState, session }: { gameState: GameState, session: GameSession }) {
  const submitDecision = useSubmitDecision();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const me = gameState.players.find(p => p.id === session.playerId);

  // Form state
  const [location, setLocation] = useState<DecisionInputLocation>(
    (gameState.ownDecision?.location as DecisionInputLocation) || DecisionInputLocation.College_Campus
  );
  const [menu, setMenu] = useState<DecisionInputMenu>(
    (gameState.ownDecision?.menu as DecisionInputMenu) || DecisionInputMenu['Trendy_&_Affordable']
  );
  const [price, setPrice] = useState<number>(gameState.ownDecision?.price || 150);
  const [promotionSpend, setPromotionSpend] = useState<number>(gameState.ownDecision?.promotionSpend || 5000);
  const [capacity, setCapacity] = useState<number>(gameState.ownDecision?.capacity || 100);

  // Effect to update form if ownDecision arrives late (e.g. initial fetch)
  const prevDecisionRef = useRef(gameState.ownDecision);
  useEffect(() => {
    if (gameState.ownDecision && !prevDecisionRef.current) {
      setLocation(gameState.ownDecision.location as DecisionInputLocation);
      setMenu(gameState.ownDecision.menu as DecisionInputMenu);
      setPrice(gameState.ownDecision.price);
      setPromotionSpend(gameState.ownDecision.promotionSpend);
      setCapacity(gameState.ownDecision.capacity);
      prevDecisionRef.current = gameState.ownDecision;
    }
  }, [gameState.ownDecision]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    submitDecision.mutate(
      {
        code: gameState.code,
        data: {
          token: session.token,
          location,
          menu,
          price,
          promotionSpend,
          capacity
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Decisions Locked!", description: "Waiting for other teams." });
        },
        onSettled: () => setIsSubmitting(false)
      }
    );
  };

  const isLocked = me?.submitted;

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
      <Card className="border-4 shadow-xl">
        <CardHeader className="bg-muted/30 border-b-2 border-border pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl font-display">Command Center</CardTitle>
            {isLocked && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-sm py-1"><CheckCircle2 className="w-4 h-4 mr-1" /> Submitted</Badge>}
          </div>
          <p className="text-muted-foreground mt-2">Strategize for {gameState.roundLabel}</p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Product Strategy */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4 border-b-2 border-border pb-2">
                  <Store className="text-primary" />
                  <h3 className="font-display font-bold text-lg uppercase tracking-wide">Positioning</h3>
                </div>
                
                <div className="space-y-3">
                  <Label>Location</Label>
                  <Select 
                    value={location} 
                    onChange={e => setLocation(e.target.value as DecisionInputLocation)}
                    disabled={isLocked}
                  >
                    {Object.values(DecisionInputLocation).map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label>Menu Concept</Label>
                  <Select 
                    value={menu} 
                    onChange={e => setMenu(e.target.value as DecisionInputMenu)}
                    disabled={isLocked}
                  >
                    {Object.values(DecisionInputMenu).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Operations & Finance */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4 border-b-2 border-border pb-2">
                  <DollarSign className="text-secondary" />
                  <h3 className="font-display font-bold text-lg uppercase tracking-wide">Operations</h3>
                </div>

                <div className="space-y-3">
                  <Label>Price per Unit (₹)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={price} 
                    onChange={e => setPrice(Number(e.target.value))}
                    disabled={isLocked}
                    className="font-display font-bold text-lg"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Capacity (Units to Prepare)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={capacity} 
                    onChange={e => setCapacity(Number(e.target.value))}
                    disabled={isLocked}
                    className="font-display font-bold text-lg"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Promotion Spend (₹)</Label>
                  <Input 
                    type="number" 
                    min={0} 
                    value={promotionSpend} 
                    onChange={e => setPromotionSpend(Number(e.target.value))}
                    disabled={isLocked}
                    className="font-display font-bold text-lg"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t-2 border-border">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full text-xl h-16"
                disabled={isLocked || isSubmitting}
                variant={isLocked ? "outline" : "default"}
              >
                {isLocked ? 'Decisions Locked' : (isSubmitting ? 'Locking...' : 'Lock Decisions')}
              </Button>
              {isLocked && (
                <p className="text-center text-sm text-muted-foreground mt-4 font-bold">
                  Waiting for other teams and host to advance...
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RevealedView({ gameState, session, isHost }: { gameState: GameState, session: GameSession, isHost: boolean }) {
  const advanceRound = useAdvanceRound();
  const currentHistory = gameState.history.find(h => h.round === gameState.activeRound);
  
  if (!currentHistory) return <div>Loading results...</div>;

  const results = [...currentHistory.results].sort((a, b) => b.profit - a.profit);

  const handleAdvance = () => {
    advanceRound.mutate({ code: gameState.code, data: { token: session.token } });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-display font-black text-foreground drop-shadow-sm uppercase">Round Results</h2>
          <p className="text-lg text-muted-foreground font-medium mt-1">
            {currentHistory.label} {currentHistory.shock !== 'None' && <span className="text-destructive font-bold">— Shock: {currentHistory.shock}</span>}
          </p>
        </div>
        {isHost && (
          <Button size="lg" onClick={handleAdvance} disabled={advanceRound.isPending} className="w-full md:w-auto h-14">
            {advanceRound.isPending ? 'Advancing...' : 'Next Phase'}
          </Button>
        )}
      </div>

      <Card className="border-4 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-[200px]">Team</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Sold / Cap</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right bg-primary/5 text-primary">Profit</TableHead>
                <TableHead className="text-right">Market Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => {
                const p = gameState.players.find(p => p.id === r.playerId);
                const isMe = p?.id === session.playerId;
                return (
                  <TableRow key={r.playerId} className={cn(isMe && "bg-secondary/10 hover:bg-secondary/20 font-medium")}>
                    <TableCell className="font-display font-bold text-base flex items-center gap-2">
                      {i === 0 && <Award className="w-5 h-5 text-secondary inline" />}
                      {p?.name || 'Unknown'}
                      {isMe && <Badge variant="outline" className="ml-2 bg-background">YOU</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{r.location}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{r.menu}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-display font-bold">
                      {formatINR(r.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(r.unitsSold >= r.capacity && "text-primary font-bold")}>
                        {r.unitsSold}
                      </span>
                      <span className="text-muted-foreground text-xs ml-1">/ {r.capacity}</span>
                    </TableCell>
                    <TableCell className="text-right text-green-700 font-bold">
                      {formatINR(r.revenue)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-display font-bold text-lg bg-primary/5",
                      r.profit < 0 ? "text-destructive" : "text-primary"
                    )}>
                      {r.profit > 0 ? '+' : ''}{formatINR(r.profit)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {(r.marketShare * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function CompleteView({ gameState, session, isHost }: { gameState: GameState, session: GameSession, isHost: boolean }) {
  const { toast } = useToast();
  const scoreTeams = useScoreTeams();
  
  // Local state for host scoring form
  const [scores, setScores] = useState<Record<string, { strategic: number, collab: number }>>(() => {
    const initial: Record<string, { strategic: number, collab: number }> = {};
    gameState.players.filter(p => !p.isHost).forEach(p => {
      // Find current scores from leaderboard if they exist
      const row = gameState.leaderboard.find(l => l.playerId === p.id);
      initial[p.id] = {
        strategic: row?.strategicQuality || 0,
        collab: row?.collaboration || 0
      };
    });
    return initial;
  });

  const handleScoreSubmit = () => {
    const formatted = Object.entries(scores).map(([playerId, s]) => ({
      playerId,
      strategicQuality: s.strategic,
      collaboration: s.collab
    }));

    scoreTeams.mutate(
      { code: gameState.code, data: { token: session.token, scores: formatted } },
      { onSuccess: () => toast({ title: "Scores updated successfully" }) }
    );
  };

  const hasScores = gameState.leaderboard.some(l => l.strategicQuality > 0 || l.collaboration > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-5xl md:text-7xl font-display font-black text-foreground drop-shadow-md">
          FINAL <span className="text-secondary">STANDINGS</span>
        </h2>
        <p className="text-xl text-muted-foreground">The Food Truck Wars have concluded!</p>
      </div>

      <Card className="border-4 shadow-2xl bg-gradient-to-b from-card to-muted/20">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
                <TableHead className="text-primary-foreground font-black text-lg">Rank</TableHead>
                <TableHead className="text-primary-foreground font-black text-lg">Team</TableHead>
                <TableHead className="text-right text-primary-foreground font-black text-lg">Total Profit</TableHead>
                <TableHead className="text-right text-primary-foreground font-black text-lg">Avg Market Share</TableHead>
                <TableHead className="text-right text-primary-foreground font-black text-lg">Avg CSAT</TableHead>
                {hasScores && (
                   <TableHead className="text-right text-primary-foreground font-black text-lg bg-black/10">Final Score</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {gameState.leaderboard.map((row, index) => {
                const isMe = row.playerId === session.playerId;
                return (
                  <TableRow key={row.playerId} className={cn(
                    "text-lg",
                    isMe && "bg-secondary/10 hover:bg-secondary/20",
                    index === 0 && "bg-secondary/5 font-bold"
                  )}>
                    <TableCell className="font-display font-black text-2xl">
                      #{row.rank}
                    </TableCell>
                    <TableCell className="font-bold flex items-center gap-2">
                      {index === 0 && <Award className="text-secondary w-6 h-6" />}
                      {row.name}
                      {isMe && <Badge variant="outline" className="ml-2">YOU</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-display text-green-700 font-bold">
                      {formatINR(row.cumulativeProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.averageMarketShare * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {row.averageCsat.toFixed(1)} / 100
                    </TableCell>
                    {hasScores && (
                      <TableCell className="text-right font-display font-black text-2xl bg-black/5">
                        {row.totalScore.toFixed(1)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {isHost && (
        <Card className="border-4 border-dashed border-primary/50">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="text-primary" /> Instructor Scoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {gameState.players.filter(p => !p.isHost).map(p => (
                <div key={p.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-muted/50 p-4 rounded-xl border border-border">
                  <div className="flex-1 font-bold font-display text-xl">{p.name}</div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="space-y-1 flex-1 md:w-32">
                      <Label className="text-xs">Strategy (0-15)</Label>
                      <Input 
                        type="number" 
                        min={0} max={15} 
                        value={scores[p.id]?.strategic || 0}
                        onChange={(e) => setScores(s => ({ ...s, [p.id]: { ...s[p.id], strategic: Number(e.target.value) } }))}
                      />
                    </div>
                    <div className="space-y-1 flex-1 md:w-32">
                      <Label className="text-xs">Collab (0-10)</Label>
                      <Input 
                        type="number" 
                        min={0} max={10} 
                        value={scores[p.id]?.collab || 0}
                        onChange={(e) => setScores(s => ({ ...s, [p.id]: { ...s[p.id], collab: Number(e.target.value) } }))}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button size="lg" className="w-full text-xl h-16" onClick={handleScoreSubmit} disabled={scoreTeams.isPending}>
                {scoreTeams.isPending ? 'Publishing...' : 'Publish Final Scores'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
