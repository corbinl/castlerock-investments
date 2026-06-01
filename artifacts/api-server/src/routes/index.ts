import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import tradesRouter from "./trades";
import journalsRouter from "./journals";
import importRouter from "./import";
import analyticsRouter from "./analytics";
import insightsRouter from "./insights";
import sessionsRouter from "./sessions";
import strategiesRouter from "./strategies";
import shareRouter from "./share";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(tradesRouter);
router.use(journalsRouter);
router.use(importRouter);
router.use(analyticsRouter);
router.use(insightsRouter);
router.use(sessionsRouter);
router.use(strategiesRouter);
router.use(shareRouter);
router.use(dashboardRouter);

export default router;
