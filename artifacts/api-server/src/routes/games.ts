import { Router, type IRouter } from "express";
import {
  AdvanceRoundBody,
  AdvanceRoundParams,
  AdvanceRoundResponse,
  ChooseShockBody,
  ChooseShockParams,
  ChooseShockResponse,
  CreateGameBody,
  CreateGameResponse,
  GetGameStateParams,
  GetGameStateResponse,
  JoinGameBody,
  JoinGameParams,
  JoinGameResponse,
  ScoreTeamsBody,
  ScoreTeamsParams,
  ScoreTeamsResponse,
  StartGameBody,
  StartGameParams,
  StartGameResponse,
  SubmitDecisionBody,
  SubmitDecisionParams,
  SubmitDecisionResponse,
} from "@workspace/api-zod";
import {
  advanceGame,
  assertHost,
  createGame,
  findGame,
  findTeamByToken,
  joinGame,
  publicState,
  setScores,
  setShock,
  startGame,
  submitDecision,
} from "../lib/foodtruck-game";

const router: IRouter = Router();

function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

router.post("/games", (req, res): void => {
  const parsed = CreateGameBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.status(201).json(CreateGameResponse.parse(createGame(parsed.data.hostName)));
});

router.post("/games/:code/join", (req, res): void => {
  const params = JoinGameParams.safeParse(req.params);
  const body = JoinGameBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Enter a valid room code and team name" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  try {
    res.json(JoinGameResponse.parse(joinGame(game, body.data.name)));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.get("/games/:code/state", (req, res): void => {
  const params = GetGameStateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid room code" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  const token = bearerToken(req.headers.authorization);
  res.json(GetGameStateResponse.parse(publicState(game, token)));
});

router.post("/games/:code/start", (req, res): void => {
  const params = StartGameParams.safeParse(req.params);
  const body = StartGameBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  try {
    assertHost(game, body.data.token);
    startGame(game);
    res.json(StartGameResponse.parse(publicState(game, body.data.token)));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/games/:code/decisions", (req, res): void => {
  const params = SubmitDecisionParams.safeParse(req.params);
  const body = SubmitDecisionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Check every decision value and try again" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  try {
    const team = findTeamByToken(game, body.data.token);
    submitDecision(game, team, {
      location: body.data.location,
      menu: body.data.menu,
      price: body.data.price,
      promotionSpend: body.data.promotionSpend,
      capacity: body.data.capacity,
    });
    res.json(SubmitDecisionResponse.parse(publicState(game, body.data.token)));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/games/:code/advance", (req, res): void => {
  const params = AdvanceRoundParams.safeParse(req.params);
  const body = AdvanceRoundBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  try {
    assertHost(game, body.data.token);
    advanceGame(game);
    res.json(AdvanceRoundResponse.parse(publicState(game, body.data.token)));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/games/:code/shock", (req, res): void => {
  const params = ChooseShockParams.safeParse(req.params);
  const body = ChooseShockBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid market shock" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  try {
    assertHost(game, body.data.token);
    setShock(game, body.data.shock);
    res.json(ChooseShockResponse.parse(publicState(game, body.data.token)));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/games/:code/scores", (req, res): void => {
  const params = ScoreTeamsParams.safeParse(req.params);
  const body = ScoreTeamsBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Scores must be within the allowed ranges" });
    return;
  }
  const game = findGame(params.data.code);
  if (!game) {
    res.status(404).json({ error: "Game room not found" });
    return;
  }
  try {
    assertHost(game, body.data.token);
    setScores(game, body.data.scores);
    res.json(ScoreTeamsResponse.parse(publicState(game, body.data.token)));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

export default router;
