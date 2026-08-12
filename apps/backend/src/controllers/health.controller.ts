import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { HealthCheckResponse } from "@repo/types";

export const getHealth = async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let dbConnected = false;
  let restaurantCount = 0;
  let dbError: string | undefined;

  try {
    // Perform a lightweight database query to test connectivity
    restaurantCount = await prisma.restaurant.count();
    dbConnected = true;
  } catch (error: unknown) {
    dbConnected = false;
    dbError = error instanceof Error ? error.message : "Database connection failed";
  }

  const status: "ok" | "degraded" | "error" = dbConnected ? "ok" : "degraded";

  const response: HealthCheckResponse = {
    status,
    service: "scan-my-order-backend",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: dbConnected,
      restaurantCount,
      ...(dbError && { error: dbError }),
    },
  };

  const statusCode = dbConnected ? 200 : 503;
  return res.status(statusCode).json(response);
};
