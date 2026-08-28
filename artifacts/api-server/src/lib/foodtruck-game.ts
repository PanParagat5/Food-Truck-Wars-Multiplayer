import { randomBytes, randomUUID } from "node:crypto";

export const LOCATIONS = {
  "College Campus": { footfall: 800, segment: "Students" },
  "IT Park": { footfall: 500, segment: "Young Professionals" },
  "Residential Area": { footfall: 400, segment: "Families" },
  "Health Club Zone": { footfall: 300, segment: "Health-conscious" },
} as const;

export const MENUS = {
  "Trendy & Affordable": { segment: "Students", unitCost: 25 },
  "Quality & Convenience": { segment: "Young Professionals", unitCost: 40 },
  "Variety & Hygiene": { segment: "Families", unitCost: 45 },
  "Healthy Options": { segment: "Health-conscious", unitCost: 55 },
} as const;

const SEGMENTS = {
  Students: { min: 40, max: 80 },
  "Young Professionals": { min: 80, max: 150 },
  Families: { min: 100, max: 180 },
  "Health-conscious": { min: 120, max: 200 },
} as const;

export const ROUND_LABELS = [
  "Waiting Room",
  "Launch",
  "Competition Enters",
  "Market Disruption",
  "Final Strategic Battle",
] as const;

export type LocationName = keyof typeof LOCATIONS;
export type MenuName = keyof typeof MENUS;
export type Shock =
  | "None"
  | "Delivery App Discount (-20% footfall)"
  | "College Event Surge (+50% footfall)"
  | "Ingredient Price Spike (+30% unit cost)";
export type GameStatus = "lobby" | "decisions" | "revealed" | "complete";

export type Decision = {
  location: LocationName;
  menu: MenuName;
  price: number;
  promotionSpend: number;
  capacity: number;
};

type Team = {
  id: string;
  token: string;
  name: string;
  seat: number;
  strategicQuality: number;
  collaboration: number;
};

export type RoundResult = Decision & {
  playerId: string;
  segment: string;
  effectiveFootfall: number;
  potentialDemand: number;
  unitsSold: number;
  revenue: number;
  variableCost: number;
  capacityCost: number;
  fixedCost: number;
  profit: number;
  csat: number;
  marketShare: number;
};

type RoundHistory = {
  round: number;
  label: string;
  shock: Shock;
  results: RoundResult[];
};

export type Game = {
  code: string;
  hostName: string;
  hostId: string;
  hostToken: string;
  status: GameStatus;
  activeRound: number;
  shock: Shock;
  teams: Team[];
  decisions: Record<number, Record<string, Decision>>;
  history: RoundHistory[];
  createdAt: number;
};

const STARTING_CAPITAL = 200_000;
const FIXED_COST = 8_000;
const CAPACITY_UNIT_COST = 15;

const games = new Map<string, Game>();

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = randomBytes(5);
    const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    if (!games.has(code)) return code;
  }
  throw new Error("Unable to allocate room code");
}

function makeToken(): string {
  return randomBytes(24).toString("base64url");
}

export function createGame(hostName = "Host Master") {
  const game: Game = {
    code: makeCode(),
    hostName: hostName.trim() || "Host Master",
    hostId: randomUUID(),
    hostToken: makeToken(),
    status: "lobby",
    activeRound: 0,
    shock: "None",
    teams: [],
    decisions: {},
    history: [],
    createdAt: Date.now(),
  };
  games.set(game.code, game);
  return {
    code: game.code,
    token: game.hostToken,
    role: "host" as const,
    playerId: game.hostId,
    name: game.hostName,
  };
}

export function findGame(code: string): Game | undefined {
  return games.get(code.toUpperCase());
}

export function joinGame(game: Game, name: string) {
  if (game.status !== "lobby") throw new Error("This game has already started");
  if (game.teams.length >= 10) throw new Error("All ten player seats are filled");
  const cleanName = name.trim();
  if (game.teams.some((team) => team.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error("That team name is already taken");
  }
  const team: Team = {
    id: randomUUID(),
    token: makeToken(),
    name: cleanName,
    seat: game.teams.length + 1,
    strategicQuality: 0,
    collaboration: 0,
  };
  game.teams.push(team);
  return {
    code: game.code,
    token: team.token,
    role: "player" as const,
    playerId: team.id,
    name: team.name,
  };
}

export function assertHost(game: Game, token: string): void {
  if (token !== game.hostToken) throw new Error("Only the host master can do that");
}

export function findTeamByToken(game: Game, token: string): Team {
  const team = game.teams.find((candidate) => candidate.token === token);
  if (!team) throw new Error("Player session not found");
  return team;
}

export function startGame(game: Game): void {
  if (game.status !== "lobby") throw new Error("The game has already started");
  if (game.teams.length === 0) throw new Error("At least one player must join first");
  game.activeRound = 1;
  game.status = "decisions";
  game.decisions[1] = {};
}

export function submitDecision(game: Game, team: Team, decision: Decision): void {
  if (game.status !== "decisions") throw new Error("Decisions are currently locked");
  if (game.activeRound < 1 || game.activeRound > 4) throw new Error("No active round");
  const committedSpend =
    decision.promotionSpend + decision.capacity * CAPACITY_UNIT_COST + FIXED_COST;
  const balance = cashBalance(game, team.id);
  if (committedSpend > balance) {
    throw new Error(
      `This plan commits ₹${Math.round(committedSpend).toLocaleString("en-IN")}, but only ₹${Math.round(balance).toLocaleString("en-IN")} remains`,
    );
  }
  game.decisions[game.activeRound] ??= {};
  game.decisions[game.activeRound][team.id] = {
    ...decision,
    capacity: Math.round(decision.capacity),
  };
}

function roundMultipliers(shock: Shock) {
  return {
    footfall:
      shock === "Delivery App Discount (-20% footfall)"
        ? 0.8
        : shock === "College Event Surge (+50% footfall)"
          ? 1.5
          : 1,
    cost: shock === "Ingredient Price Spike (+30% unit cost)" ? 1.3 : 1,
  };
}

export function resolveRound(game: Game): void {
  if (game.status !== "decisions") throw new Error("This round is not accepting decisions");
  const roundDecisions = game.decisions[game.activeRound] ?? {};
  const missing = game.teams.filter((team) => !roundDecisions[team.id]);
  if (missing.length > 0) {
    throw new Error(`Waiting for ${missing.map((team) => team.name).join(", ")}`);
  }

  const locationCounts = new Map<string, number>();
  Object.values(roundDecisions).forEach((decision) => {
    locationCounts.set(decision.location, (locationCounts.get(decision.location) ?? 0) + 1);
  });
  const multipliers = roundMultipliers(game.activeRound === 3 ? game.shock : "None");

  const results = game.teams.map((team): RoundResult => {
    const decision = roundDecisions[team.id];
    const location = LOCATIONS[decision.location];
    const menu = MENUS[decision.menu];
    const band = SEGMENTS[location.segment];
    const menuMatch = menu.segment === location.segment ? 1.2 : 0.8;
    const priceFit =
      decision.price >= band.min && decision.price <= band.max
        ? 1.15
        : decision.price >= band.min * 0.7 && decision.price <= band.max * 1.3
          ? 1
          : 0.7;
    const promotionMultiplier = 1 + Math.min(decision.promotionSpend / 50_000, 1) * 0.2;
    const effectiveFootfall =
      (location.footfall / (locationCounts.get(decision.location) ?? 1)) * multipliers.footfall;
    const potentialDemand = effectiveFootfall * 0.4 * menuMatch * priceFit * promotionMultiplier;
    const unitsSold = Math.min(potentialDemand, decision.capacity);
    const revenue = unitsSold * decision.price;
    const variableCost = unitsSold * menu.unitCost * multipliers.cost;
    const capacityCost = decision.capacity * CAPACITY_UNIT_COST;
    const profit = revenue - variableCost - capacityCost - FIXED_COST - decision.promotionSpend;
    const csat = Math.min(
      100,
      Math.max(
        0,
        60 + (priceFit - 1) * 50 + (menuMatch - 1) * 50 + (unitsSold < potentialDemand ? -10 : 5),
      ),
    );
    return {
      playerId: team.id,
      ...decision,
      segment: location.segment,
      effectiveFootfall,
      potentialDemand,
      unitsSold,
      revenue,
      variableCost,
      capacityCost,
      fixedCost: FIXED_COST,
      profit,
      csat,
      marketShare: 0,
    };
  });

  const totalUnits = results.reduce((sum, result) => sum + result.unitsSold, 0);
  results.forEach((result) => {
    result.marketShare = totalUnits > 0 ? result.unitsSold / totalUnits : 0;
  });
  game.history.push({
    round: game.activeRound,
    label: ROUND_LABELS[game.activeRound],
    shock: game.activeRound === 3 ? game.shock : "None",
    results,
  });
  game.status = "revealed";
}

export function advanceGame(game: Game): void {
  if (game.status === "decisions") {
    resolveRound(game);
    return;
  }
  if (game.status !== "revealed") throw new Error("The game cannot advance right now");
  if (game.activeRound >= 4) {
    game.status = "complete";
    return;
  }
  game.activeRound += 1;
  game.status = "decisions";
  game.decisions[game.activeRound] = {};
  if (game.activeRound === 3) game.shock = "None";
}

export function setShock(game: Game, shock: Shock): void {
  if (game.activeRound !== 3 || game.status !== "decisions") {
    throw new Error("Market shocks can only be chosen during round three");
  }
  game.shock = shock;
}

export function setScores(
  game: Game,
  scores: Array<{ playerId: string; strategicQuality: number; collaboration: number }>,
): void {
  for (const score of scores) {
    const team = game.teams.find((candidate) => candidate.id === score.playerId);
    if (!team) continue;
    team.strategicQuality = Math.round(score.strategicQuality);
    team.collaboration = Math.round(score.collaboration);
  }
}

function resultsFor(game: Game, teamId: string): RoundResult[] {
  return game.history.flatMap((round) =>
    round.results.filter((result) => result.playerId === teamId),
  );
}

function cumulativeProfit(game: Game, teamId: string): number {
  return resultsFor(game, teamId).reduce((sum, result) => sum + result.profit, 0);
}

function cashBalance(game: Game, teamId: string): number {
  return STARTING_CAPITAL + cumulativeProfit(game, teamId);
}

function latestResult(game: Game, teamId: string): RoundResult | undefined {
  return resultsFor(game, teamId).at(-1);
}

function scale(value: number, values: number[], maxPoints: number): number {
  if (values.length === 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? maxPoints / 2 : ((value - min) / (max - min)) * maxPoints;
}

export function leaderboard(game: Game) {
  const raw = game.teams.map((team) => {
    const results = resultsFor(game, team.id);
    const first = results[0];
    const last = results.at(-1);
    const revenueGrowth =
      first && last && first.revenue !== 0 ? (last.revenue - first.revenue) / first.revenue : 0;
    return {
      playerId: team.id,
      name: team.name,
      cumulativeProfit: cumulativeProfit(game, team.id),
      revenueGrowth,
      averageMarketShare:
        results.length > 0
          ? results.reduce((sum, result) => sum + result.marketShare, 0) / results.length
          : 0,
      averageCsat:
        results.length > 0
          ? results.reduce((sum, result) => sum + result.csat, 0) / results.length
          : 0,
      strategicQuality: team.strategicQuality,
      collaboration: team.collaboration,
    };
  });
  const profits = raw.map((row) => row.cumulativeProfit);
  const growth = raw.map((row) => row.revenueGrowth);
  const shares = raw.map((row) => row.averageMarketShare);
  const scored = raw.map((row) => ({
    ...row,
    totalScore:
      scale(row.cumulativeProfit, profits, 30) +
      scale(row.revenueGrowth, growth, 15) +
      scale(row.averageMarketShare, shares, 15) +
      (row.averageCsat / 100) * 15 +
      row.strategicQuality +
      row.collaboration,
  }));
  return scored
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

export function publicState(game: Game, token?: string) {
  const viewerTeam = token ? game.teams.find((team) => team.token === token) : undefined;
  const isHost = token === game.hostToken;
  const board = leaderboard(game);
  const activeDecisions = game.decisions[game.activeRound] ?? {};
  const previousDecision =
    viewerTeam && game.activeRound > 1
      ? game.decisions[game.activeRound - 1]?.[viewerTeam.id]
      : undefined;
  const ownDecision = viewerTeam
    ? activeDecisions[viewerTeam.id] ?? previousDecision ?? null
    : null;

  return {
    code: game.code,
    status: game.status,
    activeRound: game.activeRound,
    roundLabel: ROUND_LABELS[game.activeRound],
    shock: game.shock,
    viewerRole: isHost ? ("host" as const) : ("player" as const),
    viewerPlayerId: isHost ? game.hostId : (viewerTeam?.id ?? ""),
    players: game.teams.map((team) => {
      const latest = latestResult(game, team.id);
      const row = board.find((entry) => entry.playerId === team.id);
      return {
        id: team.id,
        name: team.name,
        seat: team.seat,
        isHost: false,
        connected: true,
        submitted: Boolean(activeDecisions[team.id]),
        latestProfit: latest?.profit ?? 0,
        latestRevenue: latest?.revenue ?? 0,
        cumulativeProfit: cumulativeProfit(game, team.id),
        totalScore: row?.totalScore ?? 0,
        startingCapital: STARTING_CAPITAL,
        cashBalance: cashBalance(game, team.id),
        roundSpend: latest
          ? latest.promotionSpend + latest.variableCost + latest.capacityCost + latest.fixedCost
          : 0,
      };
    }),
    ownDecision,
    history: game.status === "decisions" ? game.history : game.history,
    leaderboard: board,
  };
}
