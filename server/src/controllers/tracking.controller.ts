import { Request, Response } from "express";
import { z } from "zod";
import { resolveListeningCompletion } from "../lib/listeningCompletion";
import { prisma } from "../lib/prisma";

const progressSchema = z.object({
  progressSeconds: z.number().int().nonnegative(),
  completed: z.boolean().optional(),
  durationSeconds: z.number().int().positive().optional(),
  /** Seconds of actual playback (client); required for trustworthy "completed". */
  engagedWatchSeconds: z.number().min(0).optional(),
});

function mergeMediaDuration(
  incoming: number | undefined,
  previous: number | null | undefined,
): number | null {
  if (incoming != null && incoming >= 1) {
    return Math.max(incoming, previous ?? 0);
  }
  if (previous != null && previous >= 1) return previous;
  return null;
}

function nextCompletedState(args: {
  existingCompleted: boolean;
  existingCompletedAt: Date | null;
  existingProgressSeconds: number;
  clientCompleted: boolean | undefined;
  mergedProgressSeconds: number;
  engagedWatchSeconds: number | undefined;
  mediaDurationSeconds: number | null;
}): { completed: boolean; completedAt: Date | null } {
  if (args.existingCompleted) {
    return { completed: true, completedAt: args.existingCompletedAt };
  }
  const ok = resolveListeningCompletion({
    clientWantsComplete: Boolean(args.clientCompleted),
    progressSeconds: args.mergedProgressSeconds,
    engagedWatchSeconds: args.engagedWatchSeconds,
    previousProgressSeconds: args.existingProgressSeconds,
    previousCompleted: false,
    mediaDurationSeconds: args.mediaDurationSeconds,
  });
  if (!ok) {
    return { completed: false, completedAt: null };
  }
  return { completed: true, completedAt: new Date() };
}

export const saveListeningProgress = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const sermonId = Number(req.params.sermonId);
  if (Number.isNaN(sermonId)) {
    res.status(400).json({ message: "Invalid sermon id" });
    return;
  }

  try {
    const data = progressSchema.parse(req.body);
    const existing = await prisma.listeningSession.findUnique({
      where: {
        userId_sermonId: {
          userId: req.user.userId,
          sermonId,
        },
      },
      select: {
        mediaDurationSeconds: true,
        progressSeconds: true,
        completed: true,
        completedAt: true,
      },
    });
    const mediaDurationSeconds = mergeMediaDuration(data.durationSeconds, existing?.mediaDurationSeconds);
    const mergedProgressSeconds = Math.max(existing?.progressSeconds ?? 0, data.progressSeconds);
    const { completed, completedAt } = nextCompletedState({
      existingCompleted: Boolean(existing?.completed),
      existingCompletedAt: existing?.completedAt ?? null,
      existingProgressSeconds: existing?.progressSeconds ?? 0,
      clientCompleted: data.completed,
      mergedProgressSeconds,
      engagedWatchSeconds: data.engagedWatchSeconds,
      mediaDurationSeconds,
    });

    const updated = await prisma.listeningSession.upsert({
      where: {
        userId_sermonId: {
          userId: req.user.userId,
          sermonId,
        },
      },
      create: {
        userId: req.user.userId,
        sermonId,
        progressSeconds: mergedProgressSeconds,
        completed,
        completedAt,
        mediaDurationSeconds,
      },
      update: {
        progressSeconds: mergedProgressSeconds,
        completed,
        completedAt,
        mediaDurationSeconds,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid payload" });
  }
};

export const saveVideoListeningProgress = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const videoId = Number(req.params.videoId);
  if (Number.isNaN(videoId)) {
    res.status(400).json({ message: "Invalid video id" });
    return;
  }

  try {
    const data = progressSchema.parse(req.body);
    const existing = await prisma.videoListeningSession.findUnique({
      where: {
        userId_videoSermonId: {
          userId: req.user.userId,
          videoSermonId: videoId,
        },
      },
      select: {
        mediaDurationSeconds: true,
        progressSeconds: true,
        completed: true,
        completedAt: true,
      },
    });
    const mediaDurationSeconds = mergeMediaDuration(data.durationSeconds, existing?.mediaDurationSeconds);
    const mergedProgressSeconds = Math.max(existing?.progressSeconds ?? 0, data.progressSeconds);
    const { completed, completedAt } = nextCompletedState({
      existingCompleted: Boolean(existing?.completed),
      existingCompletedAt: existing?.completedAt ?? null,
      existingProgressSeconds: existing?.progressSeconds ?? 0,
      clientCompleted: data.completed,
      mergedProgressSeconds,
      engagedWatchSeconds: data.engagedWatchSeconds,
      mediaDurationSeconds,
    });

    const updated = await prisma.videoListeningSession.upsert({
      where: {
        userId_videoSermonId: {
          userId: req.user.userId,
          videoSermonId: videoId,
        },
      },
      create: {
        userId: req.user.userId,
        videoSermonId: videoId,
        progressSeconds: mergedProgressSeconds,
        completed,
        completedAt,
        mediaDurationSeconds,
      },
      update: {
        progressSeconds: mergedProgressSeconds,
        completed,
        completedAt,
        mediaDurationSeconds,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid payload" });
  }
};
