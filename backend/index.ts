import express, { type Request, type Response } from "express";
import cors from "cors";
import { env, isProduction } from "./src/env.js";
import { authRouter } from "./src/routes/auth.js";
import { telemetryRouter } from "./src/routes/telemetry.js";
import { piDataRouter } from "./src/routes/pi-data.js";
import { chatRouter } from "./src/routes/chat.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header means a non-browser client (the Raspberry Pi, curl,
      // Northflank's health check) — CORS does not apply to those.
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ msg: "Server is up and running" });
});

app.use("/auth", authRouter);
app.use("/api", telemetryRouter);
app.use(chatRouter);
// Mounted at the root because the cane firmware posts to /pi_data.
app.use(piDataRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ msg: "Route not found" });
});

app.listen(env.PORT, () => {
  console.log(`TremorSense API listening on :${env.PORT} (${env.NODE_ENV})`);
  if (!isProduction) console.log(`CORS origins: ${env.CORS_ORIGINS.join(", ")}`);
});
