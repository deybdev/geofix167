import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import {
  createReportController,
  getReportByIdController,
  listReportsController,
} from "../controllers/report.controller";

const reportRoutes = new Hono<AppEnv>();

reportRoutes.post("/", createReportController);
reportRoutes.get("/", listReportsController);
reportRoutes.get("/:id", getReportByIdController);

export default reportRoutes;

