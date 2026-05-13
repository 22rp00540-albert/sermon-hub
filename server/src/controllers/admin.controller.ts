import { Role, UserStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const listPendingUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: Role.MEMBER, status: UserStatus.PENDING },
    select: {
      id: true,
      fullName: true,
      email: true,
      country: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(users);
};

export const listMembers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { role: Role.MEMBER },
    select: {
      id: true,
      fullName: true,
      email: true,
      country: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(users);
};

export const approveUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.APPROVED },
  });

  res.json({ message: "User approved", userId: updated.id, status: updated.status });
};

export const rejectUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.REJECTED },
  });

  res.json({ message: "User rejected", userId: updated.id, status: updated.status });
};

export const getAdminMetrics = async (_req: Request, res: Response) => {
  const [members, approvedMembers, preachers, sermons, audioCompleted, videoCompleted] = await Promise.all([
    prisma.user.count({ where: { role: Role.MEMBER } }),
    prisma.user.count({
      where: { role: Role.MEMBER, status: UserStatus.APPROVED },
    }),
    prisma.preacher.count(),
    prisma.sermon.count(),
    prisma.listeningSession.count({ where: { completed: true } }),
    prisma.videoListeningSession.count({ where: { completed: true } }),
  ]);

  res.json({
    members,
    approvedMembers,
    preachers,
    sermons,
    completedSessions: audioCompleted + videoCompleted,
  });
};

export const deleteMember = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }

  const member = await prisma.user.findFirst({
    where: { id: userId, role: Role.MEMBER },
    select: { id: true },
  });
  if (!member) {
    res.status(404).json({ message: "Member not found" });
    return;
  }

  await prisma.user.delete({ where: { id: userId } });
  res.json({ message: "Member deleted", userId });
};
