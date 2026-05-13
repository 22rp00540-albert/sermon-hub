import { Request, Response } from "express";
import { z } from "zod";
import { getMemberVideoSermonsEnabled, setMemberVideoSermonsEnabled } from "../lib/appSettings";
import { publicServerErrorMessage } from "../lib/publicErrorMessage";

export const getMemberLibrarySettings = async (_req: Request, res: Response) => {
  try {
    const memberVideoSermonsEnabled = await getMemberVideoSermonsEnabled();
    res.json({ memberVideoSermonsEnabled });
  } catch (error) {
    console.error(error);
    const raw = error instanceof Error ? error.message : "settings";
    res.status(503).json({ message: publicServerErrorMessage(raw) });
  }
};

const patchMemberVideoSchema = z.object({
  enabled: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => v === true || v === 1),
});

export const patchMemberVideoSermonsSetting = async (req: Request, res: Response) => {
  const parsed = patchMemberVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Request body must include enabled: boolean" });
    return;
  }
  try {
    const memberVideoSermonsEnabled = await setMemberVideoSermonsEnabled(parsed.data.enabled);
    res.json({ memberVideoSermonsEnabled });
  } catch (error) {
    console.error(error);
    const raw = error instanceof Error ? error.message : "settings";
    res.status(503).json({ message: publicServerErrorMessage(raw) });
  }
};
