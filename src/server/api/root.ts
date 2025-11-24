import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { postRouter } from "./routers/post";
import { clientRouter } from "./routers/clients";
import { opportunityRouter } from "./routers/opportunity";
import { carRouter } from "./routers/car";
import { notesRouter } from "./routers/notes";

export const appRouter = createTRPCRouter({
  post: postRouter,
  clients: clientRouter,
  opportunity: opportunityRouter,
  car: carRouter,
  notes: notesRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);