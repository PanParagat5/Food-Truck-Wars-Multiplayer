import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateGame, useJoinGame } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGameSession } from '@/hooks/use-game-session';
import { useToast } from '@/hooks/use-toast';
import { UtensilsCrossed, Users } from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Host state
  const [hostName, setHostName] = useState('');
  const createGame = useCreateGame();

  // Player state
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const joinGame = useJoinGame();

  // We use a temporary dummy session hook just to get the save method
  const { saveSession } = useGameSession();

  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get('room');
    if (room) setJoinCode(room.toUpperCase());
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) return;
    
    createGame.mutate({ data: { hostName } }, {
      onSuccess: (session) => {
        saveSession(session);
        setLocation(`/game/${session.code}`);
      },
      onError: () => {
        toast({
          title: "Failed to create game",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !playerName.trim()) return;
    
    joinGame.mutate({ code: joinCode.toUpperCase(), data: { name: playerName } }, {
      onSuccess: (session) => {
        saveSession(session);
        setLocation(`/game/${session.code}`);
      },
      onError: (err) => {
        toast({
          title: "Failed to join game",
          description: err instanceof Error ? err.message : "Check your room code and try again.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      
      <div className="mb-12 text-center z-10">
        <div className="inline-flex items-center justify-center p-4 bg-primary text-primary-foreground rounded-2xl mb-6 shadow-xl transform -rotate-2">
          <UtensilsCrossed size={48} strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-extrabold text-foreground mb-4 drop-shadow-sm">
          FOOD TRUCK <span className="text-primary">WARS</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-lg mx-auto">
          A competitive multiplayer business strategy game.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
        <Card className="border-4 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-muted w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Users className="text-foreground" size={24} />
            </div>
            <CardTitle className="text-2xl">Join a Game</CardTitle>
            <CardDescription>Enter a room code or use the host's invite link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-code">Room Code</Label>
                <Input 
                  id="room-code" 
                  placeholder="e.g. ABCD" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="font-display uppercase text-lg tracking-widest text-center"
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-name">Team / Player Name</Label>
                <Input 
                  id="player-name" 
                  placeholder="The Spice Boys" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full text-lg h-14" 
                disabled={joinGame.isPending || !joinCode || !playerName}
              >
                {joinGame.isPending ? 'Joining...' : 'Join Game'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-4 shadow-xl border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 text-primary w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <UtensilsCrossed size={24} />
            </div>
            <CardTitle className="text-2xl">Host a Game</CardTitle>
            <CardDescription>Create a room for your classroom</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="host-name">Host Name (Optional)</Label>
                <Input 
                  id="host-name" 
                  placeholder="Professor Smith" 
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <Button 
                  type="submit" 
                  variant="secondary" 
                  className="w-full text-lg h-14"
                  disabled={createGame.isPending}
                >
                  {createGame.isPending ? 'Creating...' : 'Create New Game'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
