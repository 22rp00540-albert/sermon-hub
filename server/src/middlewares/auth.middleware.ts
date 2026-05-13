import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  const queryToken =
    typeof req.query.token === "string" ? req.query.token : undefined;

  if (!authHeader?.startsWith("Bearer ") && !queryToken) {
    res.status(401).json({ message: "Missing or invalid token" });
    return;
  }

  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : queryToken!;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number;
      role: string;
    };
    const r = String(decoded.role).toUpperCase();
    const role: Role = r === "ADMIN" ? Role.ADMIN : Role.MEMBER;
    req.user = { userId: decoded.userId, role };
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};

export const requireRole = (role: Role) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
};
