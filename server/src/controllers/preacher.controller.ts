import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const preacherSchema = z.object({
  name: z.string().min(2),
  bio: z.string().optional(),
});

export const listPreachers = async (_req: Request, res: Response) => {
  const preachers = await prisma.preacher.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(preachers);
};

export const createPreacher = async (req: Request, res: Response) => {
  try {
    const data = preacherSchema.parse(req.body);
    const preacher = await prisma.preacher.create({ data });
    res.status(201).json(preacher);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
  }
};

export const updatePreacher = async (req: Request, res: Response) => {
  const preacherId = Number(req.params.id);
  if (Number.isNaN(preacherId)) {
    res.status(400).json({ message: "Invalid preacher id" });
    return;
  }

  try {
    const data = preacherSchema.partial().parse(req.body);
    const preacher = await prisma.preacher.update({
      where: { id: preacherId },
      data,
    });
    res.json(preacher);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
  }
};

export const deletePreacher = async (req: Request, res: Response) => {
  const preacherId = Number(req.params.id);
  if (Number.isNaN(preacherId)) {
    res.status(400).json({ message: "Invalid preacher id" });
    return;
  }

  const sermonCount = await prisma.sermon.count({ where: { preacherId } });
  if (sermonCount > 0) {
    res.status(409).json({ message: "Cannot delete preacher with existing sermons" });
    return;
  }

  await prisma.preacher.delete({ where: { id: preacherId } });
  res.json({ message: "Preacher deleted", preacherId });
};
