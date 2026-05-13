import { Role } from "@prisma/client";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { Request, Response } from "express";
import { listeningProgressPercent } from "../lib/listeningProgress";
import { prisma } from "../lib/prisma";

type PdfDoc = InstanceType<typeof PDFDocument>;

type MediaFilter = "all" | "audio" | "video";

/** Brand palette for Olivet Assembly listening reports (PDF). */
const REPORT_BRAND = {
  navy: "#1e3a8a",
  navyDeep: "#172554",
  goldBar: "#f59e0b",
  headerSub: "#fef3c7",
  tableHeadBg: "#1d4ed8",
  tableHeadText: "#ffffff",
  zebra: "#f1f5f9",
  rowText: "#0f172a",
  muted: "#64748b",
  rule: "#94a3b8",
} as const;

/** Client `public` folder (Vite static assets), relative to this file — works from `src` and compiled `dist`. */
function clientPublicDir(): string {
  return path.resolve(__dirname, "..", "..", "..", "client", "public");
}

/** PNG/JPEG in `client/public`, or `REPORT_LOGO_PATH` in env. SVG is skipped (PDFKit needs raster). */
function resolveReportLogoPath(): string | null {
  const fromEnv = process.env.REPORT_LOGO_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const publicDir = clientPublicDir();
  if (!fs.existsSync(publicDir)) return null;
  const preferred = [
    "olivet-assembly-logo.png",
    "olivet-assembly-logo.jpg",
    "olivet-assembly-logo.jpeg",
    "olivet-logo.png",
    "olivet-logo.jpg",
    "OlivetAssembly.png",
    "OlivetAssembly.jpg",
    "logo.png",
    "logo.jpg",
  ];
  for (const name of preferred) {
    const p = path.join(publicDir, name);
    if (fs.existsSync(p)) return p;
  }
  try {
    const files = fs.readdirSync(publicDir);
    const hit = files.find(
      (f) => /\.(png|jpe?g)$/i.test(f) && (/logo/i.test(f) || /olivet/i.test(f) || /^brand/i.test(f)),
    );
    if (hit) return path.join(publicDir, hit);
  } catch {
    return null;
  }
  return null;
}

function drawReportLetterhead(
  doc: PdfDoc,
  args: {
    logoPath: string | null;
    reportHeading: string;
    media: MediaFilter;
    sermonTitle?: string | null;
    continuation: boolean;
  },
) {
  const w = doc.page.width;
  const bandH = args.continuation ? 34 : 78;
  const padL = doc.page.margins.left;
  const padR = doc.page.margins.right;

  doc.save();
  doc.rect(0, 0, w, bandH).fill(args.continuation ? REPORT_BRAND.navy : REPORT_BRAND.navyDeep);
  doc.rect(0, bandH - 3, w, 3).fill(REPORT_BRAND.goldBar);

  let titleX = padL;
  if (args.logoPath && !args.continuation) {
    try {
      const logoH = 54;
      doc.image(args.logoPath, padL, 11, { height: logoH, fit: [150, logoH] });
      titleX = padL + 158;
    } catch {
      /* unsupported or corrupt image */
    }
  }

  if (args.continuation) {
    doc
      .fillColor("#ffffff")
      .fontSize(11)
      .text("Olivet Assembly — listening report (continued)", padL + 6, 11, {
        width: w - padL - padR - 12,
      });
  } else {
    doc
      .fillColor(REPORT_BRAND.headerSub)
      .fontSize(9.5)
      .text("Olivet Assembly", titleX, 12, { width: w - titleX - padR });
    doc
      .fillColor("#ffffff")
      .fontSize(17)
      .text("Listening & viewing report", titleX, 26, { width: w - titleX - padR });
    doc
      .fillColor("#e2e8f0")
      .fontSize(11)
      .text(`Scope: ${args.reportHeading}`, titleX, 50, { width: w - titleX - padR });
  }
  doc.restore();

  const metaY = bandH + 8;
  doc.fontSize(9).fillColor(REPORT_BRAND.muted);
  const sermonPart = args.sermonTitle ? `  ·  Sermon: ${args.sermonTitle}` : "";
  const meta = args.continuation
    ? `Filter: ${args.media}${sermonPart}`
    : `Generated: ${new Date().toLocaleString()}  ·  Filter: ${args.media}${sermonPart}`;
  doc.text(meta, padL, metaY, { width: w - padL - padR });
  doc.y = metaY + 16;
}

function drawTableHeaderRow(doc: PdfDoc, y: number, left: number, usable: number, widths: number[]) {
  const [wM, wP, wMem, wTit, wPre, wUpd] = widths;
  const h = 22;
  doc.save();
  doc.rect(left, y, usable, h).fill(REPORT_BRAND.tableHeadBg);
  doc.fillColor(REPORT_BRAND.tableHeadText).font("Helvetica-Bold", 8.5);
  let x = left + 5;
  doc.text("Media", x, y + 6, { width: wM - 8 });
  x += wM;
  doc.text("Listen %", x, y + 6, { width: wP - 6 });
  x += wP;
  doc.text("Member", x, y + 6, { width: wMem - 8 });
  x += wMem;
  doc.text("Sermon title", x, y + 6, { width: wTit - 8 });
  x += wTit;
  doc.text("Preacher", x, y + 6, { width: wPre - 8 });
  x += wPre;
  doc.text("Updated", x, y + 6, { width: wUpd - 6 });
  doc.restore();
  doc.font("Helvetica", 8);
  return y + h + 4;
}

const csvCell = (value: string) => {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const normCountry = (c: string) => c.trim().toLowerCase();

/** GET /admin/listening-reports/countries — every country that has at least one member, plus listening stats. */
export const listListeningReportCountries = async (_req: Request, res: Response) => {
  const [members, audioRows, videoRows] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.MEMBER },
      select: { country: true },
    }),
    prisma.listeningSession.findMany({
      where: { user: { role: Role.MEMBER } },
      select: {
        completed: true,
        user: { select: { country: true } },
      },
    }),
    prisma.videoListeningSession.findMany({
      where: { user: { role: Role.MEMBER } },
      select: {
        completed: true,
        user: { select: { country: true } },
      },
    }),
  ]);

  type Bucket = {
    country: string;
    memberCount: number;
    audioTotal: number;
    audioCompleted: number;
    videoTotal: number;
    videoCompleted: number;
  };
  const map = new Map<string, Bucket>();

  const keyToDisplay = new Map<string, string>();
  for (const m of members) {
    const key = normCountry(m.country);
    const raw = m.country.trim() || "—";
    if (!keyToDisplay.has(key)) keyToDisplay.set(key, raw);
  }

  for (const [key, display] of keyToDisplay) {
    const memberCount = members.filter((u) => normCountry(u.country) === key).length;
    map.set(key, {
      country: display,
      memberCount,
      audioTotal: 0,
      audioCompleted: 0,
      videoTotal: 0,
      videoCompleted: 0,
    });
  }

  const touchSession = (rawCountry: string) => {
    const key = normCountry(rawCountry);
    const display = rawCountry.trim() || "—";
    let b = map.get(key);
    if (!b) {
      b = {
        country: display,
        memberCount: 0,
        audioTotal: 0,
        audioCompleted: 0,
        videoTotal: 0,
        videoCompleted: 0,
      };
      map.set(key, b);
    }
    return b;
  };

  for (const row of audioRows) {
    const b = touchSession(row.user.country);
    b.audioTotal += 1;
    if (row.completed) b.audioCompleted += 1;
  }
  for (const row of videoRows) {
    const b = touchSession(row.user.country);
    b.videoTotal += 1;
    if (row.completed) b.videoCompleted += 1;
  }

  const list = Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country));
  res.json(list);
};

const parseMedia = (raw: unknown): MediaFilter => {
  const s = typeof raw === "string" ? raw.toLowerCase() : "all";
  if (s === "audio" || s === "video") return s;
  return "all";
};

/** Exact sermon / video title match (trimmed). Empty = no filter. */
function parseSermonTitleFilter(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

async function memberIdsForCountry(countryParam: string): Promise<number[]> {
  const key = normCountry(countryParam);
  const users = await prisma.user.findMany({
    where: { role: Role.MEMBER },
    select: { id: true, country: true },
  });
  return users.filter((u) => normCountry(u.country) === key).map((u) => u.id);
}

/** All members, or one country — `country=ALL` for every member. */
async function memberIdsForReportScope(countryParam: string): Promise<number[]> {
  const t = countryParam.trim();
  if (t.toUpperCase() === "ALL") {
    const users = await prisma.user.findMany({
      where: { role: Role.MEMBER },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
  return memberIdsForCountry(countryParam);
}

async function loadSessionsForCountry(countryParam: string, media: MediaFilter, sermonTitle?: string) {
  const userIds = await memberIdsForReportScope(countryParam);
  if (userIds.length === 0) {
    return { userIds: [] as number[], audioSessions: [], videoSessions: [] };
  }
  const audioTitleWhere = sermonTitle ? { sermon: { title: sermonTitle } } : {};
  const videoTitleWhere = sermonTitle ? { videoSermon: { title: sermonTitle } } : {};
  const [audioSessions, videoSessions] = await Promise.all([
    media === "video"
      ? []
      : prisma.listeningSession.findMany({
          where: { userId: { in: userIds }, ...audioTitleWhere },
          include: {
            user: { select: { id: true, fullName: true, country: true, phoneNumber: true } },
            sermon: { include: { preacher: { select: { name: true } } } },
          },
          orderBy: { updatedAt: "desc" },
        }),
    media === "audio"
      ? []
      : prisma.videoListeningSession.findMany({
          where: { userId: { in: userIds }, ...videoTitleWhere },
          include: {
            user: { select: { id: true, fullName: true, country: true, phoneNumber: true } },
            videoSermon: { include: { preacher: { select: { name: true } } } },
          },
          orderBy: { updatedAt: "desc" },
        }),
  ]);
  return { userIds, audioSessions, videoSessions };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- prisma include shape
function rowFromAudioLoose(s: any) {
  const mediaDurationSeconds = s.mediaDurationSeconds as number | null;
  const progressPercent = listeningProgressPercent(s.progressSeconds, mediaDurationSeconds, s.completed);
  return {
    id: s.id as number,
    kind: "audio" as const,
    userId: s.userId as number,
    fullName: s.user.fullName as string,
    country: s.user.country as string,
    phoneNumber: s.user.phoneNumber as string,
    contentId: s.sermonId as number,
    title: s.sermon.title as string,
    preacherName: s.sermon.preacher.name as string,
    progressSeconds: s.progressSeconds as number,
    mediaDurationSeconds: mediaDurationSeconds ?? null,
    progressPercent,
    completed: s.completed as boolean,
    completedAt: (s.completedAt as Date | null)?.toISOString() ?? null,
    updatedAt: (s.updatedAt as Date).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowFromVideoLoose(s: any) {
  const mediaDurationSeconds = s.mediaDurationSeconds as number | null;
  const progressPercent = listeningProgressPercent(s.progressSeconds, mediaDurationSeconds, s.completed);
  return {
    id: s.id as number,
    kind: "video" as const,
    userId: s.userId as number,
    fullName: s.user.fullName as string,
    country: s.user.country as string,
    phoneNumber: s.user.phoneNumber as string,
    contentId: s.videoSermonId as number,
    title: s.videoSermon.title as string,
    preacherName: s.videoSermon.preacher.name as string,
    progressSeconds: s.progressSeconds as number,
    mediaDurationSeconds: mediaDurationSeconds ?? null,
    progressPercent,
    completed: s.completed as boolean,
    completedAt: (s.completedAt as Date | null)?.toISOString() ?? null,
    updatedAt: (s.updatedAt as Date).toISOString(),
  };
}

/** GET /admin/listening-reports/sermon-titles?country=…&media=all|audio|video — distinct titles with activity in scope. */
export const listListeningReportSermonTitles = async (req: Request, res: Response) => {
  const countryParam = typeof req.query.country === "string" ? req.query.country.trim() : "";
  if (!countryParam) {
    res.status(400).json({ message: "Query parameter country is required" });
    return;
  }
  const media = parseMedia(req.query.media);
  const userIds = await memberIdsForReportScope(countryParam);
  if (userIds.length === 0) {
    res.json([]);
    return;
  }
  const titles = new Set<string>();
  try {
    if (media !== "video") {
      const audioRows = await prisma.listeningSession.findMany({
        where: { userId: { in: userIds } },
        distinct: ["sermonId"],
        select: { sermonId: true, sermon: { select: { title: true } } },
      });
      for (const r of audioRows) titles.add(r.sermon.title);
    }
    if (media !== "audio") {
      const videoRows = await prisma.videoListeningSession.findMany({
        where: { userId: { in: userIds } },
        distinct: ["videoSermonId"],
        select: { videoSermonId: true, videoSermon: { select: { title: true } } },
      });
      for (const r of videoRows) titles.add(r.videoSermon.title);
    }
  } catch {
    res.status(500).json({ message: "Could not load sermon titles" });
    return;
  }
  res.json([...titles].sort((a, b) => a.localeCompare(b)));
};

/** GET /admin/listening-reports?country=…&media=all|audio|video&sermonTitle=… */
export const listListeningReportRows = async (req: Request, res: Response) => {
  const countryParam = typeof req.query.country === "string" ? req.query.country.trim() : "";
  if (!countryParam) {
    res.status(400).json({ message: "Query parameter country is required" });
    return;
  }
  const media = parseMedia(req.query.media);
  const sermonTitle = parseSermonTitleFilter(req.query.sermonTitle);
  const { userIds, audioSessions, videoSessions } = await loadSessionsForCountry(countryParam, media, sermonTitle);
  if (userIds.length === 0) {
    res.json([]);
    return;
  }

  const rows = [
    ...audioSessions.map((s) => rowFromAudioLoose(s)),
    ...videoSessions.map((s) => rowFromVideoLoose(s)),
  ].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  res.json(rows);
};

/** GET /admin/listening-reports/export?country=…&media=… */
export const exportListeningReportCsv = async (req: Request, res: Response) => {
  const countryParam = typeof req.query.country === "string" ? req.query.country.trim() : "";
  if (!countryParam) {
    res.status(400).json({ message: "Query parameter country is required" });
    return;
  }
  const media = parseMedia(req.query.media);
  const sermonTitle = parseSermonTitleFilter(req.query.sermonTitle);
  const { audioSessions, videoSessions } = await loadSessionsForCountry(countryParam, media, sermonTitle);

  const lines: string[] = [
    [
      "Media",
      "Country",
      "Member name",
      "Phone",
      "Sermon title",
      "Preacher",
      "Progress seconds",
      "Media duration seconds",
      "Progress percent",
      "Completed",
      "Completed at",
      "Last updated",
    ].join(","),
  ];

  for (const s of audioSessions) {
    const r = rowFromAudioLoose(s);
    lines.push(
      [
        csvCell("audio"),
        csvCell(s.user.country),
        csvCell(s.user.fullName),
        csvCell(s.user.phoneNumber),
        csvCell(s.sermon.title),
        csvCell(s.sermon.preacher.name),
        String(s.progressSeconds),
        r.mediaDurationSeconds == null ? "" : String(r.mediaDurationSeconds),
        r.progressPercent == null ? "" : String(r.progressPercent),
        s.completed ? "yes" : "no",
        csvCell(s.completedAt ? s.completedAt.toISOString() : ""),
        csvCell(s.updatedAt.toISOString()),
      ].join(","),
    );
  }
  for (const s of videoSessions) {
    const r = rowFromVideoLoose(s);
    lines.push(
      [
        csvCell("video"),
        csvCell(s.user.country),
        csvCell(s.user.fullName),
        csvCell(s.user.phoneNumber),
        csvCell(s.videoSermon.title),
        csvCell(s.videoSermon.preacher.name),
        String(s.progressSeconds),
        r.mediaDurationSeconds == null ? "" : String(r.mediaDurationSeconds),
        r.progressPercent == null ? "" : String(r.progressPercent),
        s.completed ? "yes" : "no",
        csvCell(s.completedAt ? s.completedAt.toISOString() : ""),
        csvCell(s.updatedAt.toISOString()),
      ].join(","),
    );
  }

  const safeName =
    countryParam.toUpperCase() === "ALL"
      ? "all-countries"
      : countryParam.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "country";
  const body = lines.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="listening-report-${safeName}.csv"`);
  res.send("\uFEFF" + body);
};

/** GET /admin/listening-reports/export-pdf?country=…&media=… */
export const exportListeningReportPdf = async (req: Request, res: Response) => {
  const countryParam = typeof req.query.country === "string" ? req.query.country.trim() : "";
  if (!countryParam) {
    res.status(400).json({ message: "Query parameter country is required" });
    return;
  }
  const media = parseMedia(req.query.media);
  const sermonTitle = parseSermonTitleFilter(req.query.sermonTitle);
  const { userIds, audioSessions, videoSessions } = await loadSessionsForCountry(countryParam, media, sermonTitle);

  const safeName =
    countryParam.toUpperCase() === "ALL"
      ? "all-countries"
      : countryParam.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "country";
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  /** `download=1` forces attachment (may be grabbed by download managers). Default is inline so browsers open the PDF in a tab. */
  const forceAttachment =
    typeof req.query.download === "string" && (req.query.download === "1" || req.query.download === "true");
  res.setHeader(
    "Content-Disposition",
    forceAttachment
      ? `attachment; filename="listening-report-${safeName}.pdf"`
      : `inline; filename="listening-report-${safeName}.pdf"`,
  );
  doc.pipe(res);

  const reportHeading =
    countryParam.toUpperCase() === "ALL" ? "All countries" : countryParam;
  const logoPath = resolveReportLogoPath();
  drawReportLetterhead(doc, {
    logoPath,
    reportHeading,
    media,
    sermonTitle: sermonTitle ?? null,
    continuation: false,
  });
  doc.font("Helvetica", 11).fillColor(REPORT_BRAND.rowText);

  if (userIds.length === 0) {
    doc.moveDown(0.75);
    doc.text(
      countryParam.toUpperCase() === "ALL"
        ? "No members registered in the portal."
        : "No members registered for this country.",
    );
    doc.end();
    return;
  }

  const rows = [
    ...audioSessions.map((s) => rowFromAudioLoose(s)),
    ...videoSessions.map((s) => rowFromVideoLoose(s)),
  ].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  if (rows.length === 0) {
    doc.moveDown(0.75);
    doc.text(
      countryParam.toUpperCase() === "ALL"
        ? "No listening or viewing activity recorded across all members yet."
        : "No listening or viewing activity recorded for this country yet.",
    );
    doc.end();
    return;
  }

  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const wM = usable * 0.065;
  const wP = usable * 0.085;
  const wMem = usable * 0.2;
  const wTit = usable * 0.28;
  const wPre = usable * 0.18;
  const wUpd = usable - wM - wP - wMem - wTit - wPre;
  const widths = [wM, wP, wMem, wTit, wPre, wUpd];
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 32;

  let y = doc.y + 8;
  y = drawTableHeaderRow(doc, y, left, usable, widths);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    doc.font("Helvetica", 7.5);
    const memText = r.fullName;
    const titText = r.title;
    const preText = r.preacherName;
    const hMember = doc.heightOfString(memText, { width: wMem - 8 });
    const hTitle = doc.heightOfString(titText, { width: wTit - 8 });
    const hPre = doc.heightOfString(preText, { width: wPre - 8 });
    const rowH = Math.max(34, hMember, hTitle, hPre) + 12;

    if (y + rowH > bottomLimit) {
      doc.addPage({ layout: "landscape", margin: 40, size: "A4" });
      drawReportLetterhead(doc, {
        logoPath,
        reportHeading,
        media,
        sermonTitle: sermonTitle ?? null,
        continuation: true,
      });
      y = doc.y + 8;
      y = drawTableHeaderRow(doc, y, left, usable, widths);
    }

    doc.save();
    doc.rect(left, y, usable, rowH).fill(i % 2 === 0 ? REPORT_BRAND.zebra : "#ffffff");
    doc.restore();

    const pctLabel = r.completed ? "100%" : r.progressPercent == null ? "—" : `${r.progressPercent}%`;
    const tx = y + 6;
    let x = left + 5;
    doc.font("Helvetica-Bold", 7.5);
    doc
      .fillColor(r.kind === "audio" ? "#1d4ed8" : "#6d28d9")
      .text(r.kind === "audio" ? "Audio" : "Video", x, tx, { width: wM - 8, lineGap: 1 });
    x += wM;
    doc
      .fillColor(r.completed ? "#047857" : REPORT_BRAND.rowText)
      .text(pctLabel, x, tx, { width: wP - 6 });
    x += wP;
    doc.fillColor(REPORT_BRAND.rowText).font("Helvetica", 7.5);
    doc.text(memText, x, tx, { width: wMem - 8, lineGap: 1 });
    x += wMem;
    doc.text(titText, x, tx, { width: wTit - 8, lineGap: 1 });
    x += wTit;
    doc.text(preText, x, tx, { width: wPre - 8, lineGap: 1 });
    x += wPre;
    doc.fillColor(REPORT_BRAND.muted).text(new Date(r.updatedAt).toLocaleString(), x, tx, { width: wUpd - 6 });
    doc.fillColor(REPORT_BRAND.rowText);

    y += rowH;
  }

  doc.end();
};

/** Human-readable total listening time (sum of progress seconds). */
function formatListenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec > 0 ? `${sec}s` : ""}`.trim();
}

type CountryLeaderboardHealth = "strong" | "good" | "watch" | "quiet";

export type CountryLeaderboardRow = {
  rank: number;
  country: string;
  memberCount: number;
  membersWithNoListeningActivity: number;
  audioTotal: number;
  audioCompleted: number;
  videoTotal: number;
  videoCompleted: number;
  totalListenSeconds: number;
  completionPercent: number | null;
  activityHealth: CountryLeaderboardHealth;
};

function activityHealthForCountry(args: {
  memberCount: number;
  membersWithNoListeningActivity: number;
  audioTotal: number;
  videoTotal: number;
  completionPercent: number | null;
}): CountryLeaderboardHealth {
  const totalSessions = args.audioTotal + args.videoTotal;
  if (totalSessions === 0) return "quiet";
  const noRatio = args.membersWithNoListeningActivity / Math.max(1, args.memberCount);
  const cp = args.completionPercent ?? 0;
  if (cp >= 72 && noRatio <= 0.22) return "strong";
  if (cp >= 45 && noRatio <= 0.38) return "good";
  return "watch";
}

function healthLabel(h: CountryLeaderboardHealth): string {
  switch (h) {
    case "strong":
      return "Strong";
    case "good":
      return "Good";
    case "watch":
      return "Needs attention";
    default:
      return "No sessions yet";
  }
}

function healthPdfColor(h: CountryLeaderboardHealth): string {
  switch (h) {
    case "strong":
      return "#047857";
    case "good":
      return "#1d4ed8";
    case "watch":
      return "#b45309";
    default:
      return "#64748b";
  }
}

async function computeCountryLeaderboardRows(): Promise<CountryLeaderboardRow[]> {
  const members = await prisma.user.findMany({
    where: { role: Role.MEMBER },
    select: { id: true, country: true },
  });
  const audioSessions = await prisma.listeningSession.findMany({
    where: { user: { role: Role.MEMBER } },
    select: {
      userId: true,
      progressSeconds: true,
      completed: true,
      user: { select: { country: true } },
    },
  });
  const videoSessions = await prisma.videoListeningSession.findMany({
    where: { user: { role: Role.MEMBER } },
    select: {
      userId: true,
      progressSeconds: true,
      completed: true,
      user: { select: { country: true } },
    },
  });

  const userActivity = new Map<number, { audio: number; video: number }>();
  for (const m of members) {
    userActivity.set(m.id, { audio: 0, video: 0 });
  }

  const memberIdsByKey = new Map<string, Set<number>>();
  const displayByKey = new Map<string, string>();
  for (const m of members) {
    const key = normCountry(m.country);
    if (!memberIdsByKey.has(key)) {
      memberIdsByKey.set(key, new Set());
      displayByKey.set(key, m.country.trim() || "—");
    }
    memberIdsByKey.get(key)!.add(m.id);
  }

  const statsByKey = new Map<
    string,
    {
      audioTotal: number;
      audioCompleted: number;
      videoTotal: number;
      videoCompleted: number;
      totalListenSeconds: number;
    }
  >();
  const touchStats = (key: string) => {
    if (!statsByKey.has(key)) {
      statsByKey.set(key, {
        audioTotal: 0,
        audioCompleted: 0,
        videoTotal: 0,
        videoCompleted: 0,
        totalListenSeconds: 0,
      });
    }
    return statsByKey.get(key)!;
  };

  for (const s of audioSessions) {
    const key = normCountry(s.user.country);
    const st = touchStats(key);
    st.audioTotal += 1;
    if (s.completed) st.audioCompleted += 1;
    st.totalListenSeconds += s.progressSeconds;
    const ua = userActivity.get(s.userId);
    if (ua) ua.audio += 1;
  }
  for (const s of videoSessions) {
    const key = normCountry(s.user.country);
    const st = touchStats(key);
    st.videoTotal += 1;
    if (s.completed) st.videoCompleted += 1;
    st.totalListenSeconds += s.progressSeconds;
    const ua = userActivity.get(s.userId);
    if (ua) ua.video += 1;
  }

  const rows: CountryLeaderboardRow[] = [];
  for (const [key, idSet] of memberIdsByKey) {
    const memberCount = idSet.size;
    let membersWithNoListeningActivity = 0;
    for (const id of idSet) {
      const ua = userActivity.get(id);
      if (ua && ua.audio === 0 && ua.video === 0) membersWithNoListeningActivity += 1;
    }
    const st = statsByKey.get(key) ?? {
      audioTotal: 0,
      audioCompleted: 0,
      videoTotal: 0,
      videoCompleted: 0,
      totalListenSeconds: 0,
    };
    const totalSessions = st.audioTotal + st.videoTotal;
    const completionPercent =
      totalSessions === 0 ? null : Math.round((100 * (st.audioCompleted + st.videoCompleted)) / totalSessions);
    const activityHealth = activityHealthForCountry({
      memberCount,
      membersWithNoListeningActivity,
      audioTotal: st.audioTotal,
      videoTotal: st.videoTotal,
      completionPercent,
    });
    rows.push({
      rank: 0,
      country: displayByKey.get(key) || key,
      memberCount,
      membersWithNoListeningActivity,
      audioTotal: st.audioTotal,
      audioCompleted: st.audioCompleted,
      videoTotal: st.videoTotal,
      videoCompleted: st.videoCompleted,
      totalListenSeconds: st.totalListenSeconds,
      completionPercent,
      activityHealth,
    });
  }

  rows.sort((a, b) => {
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    const ac = a.completionPercent ?? -1;
    const bc = b.completionPercent ?? -1;
    if (bc !== ac) return bc - ac;
    if (b.totalListenSeconds !== a.totalListenSeconds) return b.totalListenSeconds - a.totalListenSeconds;
    return a.country.localeCompare(b.country);
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/** GET /admin/listening-reports/country-leaderboard — ranked by member count (then engagement). */
export const listCountryLeaderboard = async (_req: Request, res: Response) => {
  const rows = await computeCountryLeaderboardRows();
  res.json(rows);
};

/** GET /admin/listening-reports/country-leaderboard/export */
export const exportCountryLeaderboardCsv = async (_req: Request, res: Response) => {
  const rows = await computeCountryLeaderboardRows();
  const lines: string[] = [
    [
      "Rank",
      "Country",
      "Members",
      "Members with no listening activity",
      "Audio completed",
      "Audio total",
      "Video completed",
      "Video total",
      "Completion percent",
      "Total listen seconds",
      "Activity health",
    ].join(","),
  ];
  for (const r of rows) {
    lines.push(
      [
        String(r.rank),
        csvCell(r.country),
        String(r.memberCount),
        String(r.membersWithNoListeningActivity),
        String(r.audioCompleted),
        String(r.audioTotal),
        String(r.videoCompleted),
        String(r.videoTotal),
        r.completionPercent == null ? "" : String(r.completionPercent),
        String(r.totalListenSeconds),
        csvCell(r.activityHealth),
      ].join(","),
    );
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="country-listening-stats.csv"`);
  res.send("\uFEFF" + lines.join("\r\n"));
};

function drawLeaderboardLetterhead(doc: PdfDoc, args: { logoPath: string | null; continuation: boolean }) {
  const w = doc.page.width;
  const bandH = args.continuation ? 34 : 72;
  const padL = doc.page.margins.left;
  const padR = doc.page.margins.right;

  doc.save();
  doc.rect(0, 0, w, bandH).fill(args.continuation ? REPORT_BRAND.navy : REPORT_BRAND.navyDeep);
  doc.rect(0, bandH - 3, w, 3).fill(REPORT_BRAND.goldBar);

  let titleX = padL;
  if (args.logoPath && !args.continuation) {
    try {
      const logoH = 50;
      doc.image(args.logoPath, padL, 11, { height: logoH, fit: [140, logoH] });
      titleX = padL + 150;
    } catch {
      /* skip */
    }
  }

  if (args.continuation) {
    doc
      .fillColor("#ffffff")
      .fontSize(11)
      .text("Olivet Assembly — country statistics (continued)", padL + 6, 11, {
        width: w - padL - padR - 12,
      });
  } else {
    doc
      .fillColor(REPORT_BRAND.headerSub)
      .fontSize(9.5)
      .text("Olivet Assembly", titleX, 12, { width: w - titleX - padR });
    doc
      .fillColor("#ffffff")
      .fontSize(16)
      .text("Country listening statistics", titleX, 26, { width: w - titleX - padR });
    doc
      .fillColor("#e2e8f0")
      .fontSize(10.5)
      .text("Ranked by member count · Completion & engagement overview", titleX, 46, { width: w - titleX - padR });
  }
  doc.restore();

  const metaY = bandH + 8;
  doc.fontSize(9).fillColor(REPORT_BRAND.muted);
  doc.text(`Generated: ${new Date().toLocaleString()}`, padL, metaY, { width: w - padL - padR });
  doc.y = metaY + 16;
}

function drawLeaderboardTableHeader(doc: PdfDoc, y: number, left: number, usable: number, widths: number[]) {
  const [wR, wC, wM, wN, wA, wV, wP, wT, wH] = widths;
  const h = 22;
  doc.save();
  doc.rect(left, y, usable, h).fill(REPORT_BRAND.tableHeadBg);
  doc.fillColor(REPORT_BRAND.tableHeadText).font("Helvetica-Bold", 7);
  let x = left + 4;
  doc.text("#", x, y + 7, { width: wR - 4 });
  x += wR;
  doc.text("Country", x, y + 7, { width: wC - 6 });
  x += wC;
  doc.text("Mem.", x, y + 7, { width: wM - 4 });
  x += wM;
  doc.text("No activity", x, y + 7, { width: wN - 4 });
  x += wN;
  doc.text("Audio (done/tot)", x, y + 7, { width: wA - 4 });
  x += wA;
  doc.text("Video (done/tot)", x, y + 7, { width: wV - 4 });
  x += wV;
  doc.text("Done %", x, y + 7, { width: wP - 4 });
  x += wP;
  doc.text("Listen time", x, y + 7, { width: wT - 4 });
  x += wT;
  doc.text("Status", x, y + 7, { width: wH - 4 });
  doc.restore();
  doc.font("Helvetica", 7);
  return y + h + 4;
}

/** GET /admin/listening-reports/country-leaderboard/export-pdf */
export const exportCountryLeaderboardPdf = async (req: Request, res: Response) => {
  const rows = await computeCountryLeaderboardRows();
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  const forceAttachment =
    typeof req.query.download === "string" && (req.query.download === "1" || req.query.download === "true");
  res.setHeader(
    "Content-Disposition",
    forceAttachment
      ? `attachment; filename="country-listening-stats.pdf"`
      : `inline; filename="country-listening-stats.pdf"`,
  );
  doc.pipe(res);

  const logoPath = resolveReportLogoPath();
  drawLeaderboardLetterhead(doc, { logoPath, continuation: false });
  doc.font("Helvetica", 10).fillColor(REPORT_BRAND.rowText);

  if (rows.length === 0) {
    doc.moveDown(0.75);
    doc.text("No member countries to display yet.");
    doc.end();
    return;
  }

  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const wR = usable * 0.035;
  const wC = usable * 0.2;
  const wM = usable * 0.065;
  const wN = usable * 0.09;
  const wA = usable * 0.12;
  const wV = usable * 0.12;
  const wP = usable * 0.07;
  const wT = usable * 0.11;
  const wH = usable - wR - wC - wM - wN - wA - wV - wP - wT;
  const widths = [wR, wC, wM, wN, wA, wV, wP, wT, wH];
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 28;

  let y = doc.y + 6;
  y = drawLeaderboardTableHeader(doc, y, left, usable, widths);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowH = 26;
    if (y + rowH > bottomLimit) {
      doc.addPage({ layout: "landscape", margin: 36, size: "A4" });
      drawLeaderboardLetterhead(doc, { logoPath, continuation: true });
      y = doc.y + 6;
      y = drawLeaderboardTableHeader(doc, y, left, usable, widths);
    }

    let rowBg = i % 2 === 0 ? REPORT_BRAND.zebra : "#ffffff";
    if (r.rank === 1) rowBg = "#fffbeb";
    else if (r.rank === 2) rowBg = "#f1f5f9";
    else if (r.rank === 3) rowBg = "#fff7ed";
    doc.save();
    doc.rect(left, y, usable, rowH).fill(rowBg);
    doc.restore();

    const tx = y + 6;
    let x = left + 4;
    doc.font("Helvetica-Bold", 8).fillColor("#0f172a").text(String(r.rank), x, tx, { width: wR - 4 });
    x += wR;
    doc.font("Helvetica", 7.5).fillColor(REPORT_BRAND.rowText).text(r.country, x, tx, { width: wC - 6, lineGap: 1 });
    x += wC;
    doc.text(String(r.memberCount), x, tx, { width: wM - 4 });
    x += wM;
    doc
      .fillColor(r.membersWithNoListeningActivity > 0 ? "#b45309" : REPORT_BRAND.muted)
      .text(String(r.membersWithNoListeningActivity), x, tx, { width: wN - 4 });
    x += wN;
    doc.fillColor(REPORT_BRAND.rowText).text(`${r.audioCompleted}/${r.audioTotal}`, x, tx, { width: wA - 4 });
    x += wA;
    doc.text(`${r.videoCompleted}/${r.videoTotal}`, x, tx, { width: wV - 4 });
    x += wV;
    doc
      .fillColor(r.completionPercent == null ? REPORT_BRAND.muted : REPORT_BRAND.rowText)
      .text(r.completionPercent == null ? "—" : `${r.completionPercent}%`, x, tx, { width: wP - 4 });
    x += wP;
    doc.fillColor(REPORT_BRAND.muted).text(formatListenDuration(r.totalListenSeconds), x, tx, { width: wT - 4 });
    x += wT;
    doc.fillColor(healthPdfColor(r.activityHealth)).font("Helvetica-Bold", 7).text(healthLabel(r.activityHealth), x, tx, {
      width: wH - 4,
    });
    doc.fillColor(REPORT_BRAND.rowText).font("Helvetica", 7.5);

    y += rowH;
  }

  doc.font("Helvetica", 8).fillColor(REPORT_BRAND.muted);
  doc.text(
    '"No activity" = members with zero audio and zero video sessions. Listen time = sum of progress seconds across all sessions.',
    left,
    y + 8,
    { width: usable },
  );

  doc.end();
};

export const deleteAudioListeningSession = async (req: Request, res: Response) => {
  const id = Number(req.params.sessionId);
  if (Number.isNaN(id)) {
    res.status(400).json({ message: "Invalid session id" });
    return;
  }
  try {
    await prisma.listeningSession.delete({ where: { id } });
    res.json({ message: "Deleted", id });
  } catch {
    res.status(404).json({ message: "Session not found" });
  }
};

export const deleteVideoListeningSession = async (req: Request, res: Response) => {
  const id = Number(req.params.sessionId);
  if (Number.isNaN(id)) {
    res.status(400).json({ message: "Invalid session id" });
    return;
  }
  try {
    await prisma.videoListeningSession.delete({ where: { id } });
    res.json({ message: "Deleted", id });
  } catch {
    res.status(404).json({ message: "Session not found" });
  }
};
