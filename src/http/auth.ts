import type { NextFunction, Request, RequestHandler, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      adoPat?: string;
    }
  }
}

function unauthorized(res: Response) {
  res.setHeader("WWW-Authenticate", "Bearer");
  res.status(401).json({
    jsonrpc: "2.0",
    error: {
      code: -32001,
      message: "Unauthorized",
    },
    id: null,
  });
}

export function createBearerAuthMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;

    if (!authorization) {
      unauthorized(res);
      return;
    }

    const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    req.adoPat = bearerToken || authorization.trim();
    next();
  };
}
