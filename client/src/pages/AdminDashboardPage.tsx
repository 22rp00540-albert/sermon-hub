import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MutableRefObject, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL, api } from "../api";
import { useI18n } from "../context/useI18n";
import { useAuth } from "../context/useAuth";
import { AFRICAN_COUNTRIES, flagEmoji } from "../data/africanCountries";
import { userVisibleApiError } from "../lib/userVisibleApiError";

type PendingUser = {
  id: number;
  fullName: string;
  email: string;
  country: string;
  phoneNumber: string;
  status: string;
};

type Preacher = {
  id: number;
  name: string;
};

type Sermon = {
  id: number;
  title: string;
  scripture: string;
  description?: string;
  createdDate: string;
  preacher: { name: string };
  hasDocument?: boolean;
  documentsCount?: number;
};

type SermonDocument = {
  id: number;
  sermonId?: number;
  originalName: string;
  folderName?: string;
};

type AdminDocumentFileItem = {
  id: number;
  sermonId: number;
  sermonTitle: string;
  originalName: string;
  folderName: string;
};

type VideoSermon = {
  id: number;
  title: string;
  scripture: string;
  description?: string;
  createdDate: string;
  preacher: { name: string };
};

type ListeningCountryBucket = {
  country: string;
  memberCount: number;
  audioTotal: number;
  audioCompleted: number;
  videoTotal: number;
  videoCompleted: number;
};

type ListeningReportRow = {
  id: number;
  kind: "audio" | "video";
  userId: number;
  fullName: string;
  country: string;
  phoneNumber: string;
  contentId: number;
  title: string;
  preacherName: string;
  progressSeconds: number;
  mediaDurationSeconds?: number | null;
  progressPercent?: number | null;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
};

type CountryLeaderboardRow = {
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
  activityHealth: "strong" | "good" | "watch" | "quiet";
};

const formatListeningSeconds = (total: number) => {
  const t = Math.max(0, Math.floor(total));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Total accumulated progress time (sum of session progress seconds). */
const formatCountryListenDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
};

const leaderboardHealthLabel = (h: CountryLeaderboardRow["activityHealth"]) => {
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
};

type AdminMetrics = {
  members: number;
  approvedMembers: number;
  preachers: number;
  sermons: number;
  completedSessions: number;
};

const findCountryByNameLoose = (name: string) =>
  AFRICAN_COUNTRIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());

const PIE_PALETTE = ["#1d4ed8", "#7c3aed", "#0d9488", "#ea580c", "#d97706", "#2563eb", "#db2777", "#4f46e5"];

type PieSliceData = { label: string; value: number; color: string };

function ListeningPieChart({ slices, size = 200 }: { slices: PieSliceData[]; size?: number }) {
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0 || slices.length === 0) {
    return (
      <div className="admin-pie-empty" style={{ width: size, height: size }}>
        <span className="muted">No data</span>
      </div>
    );
  }
  let angleDeg = -90;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const paths: ReactNode[] = [];
  slices.forEach((sl, idx) => {
    if (sl.value <= 0) return;
    const frac = sl.value / total;
    const delta = frac * 360;
    const rad0 = (angleDeg * Math.PI) / 180;
    const rad1 = ((angleDeg + delta) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(rad0);
    const y0 = cy + r * Math.sin(rad0);
    const x1 = cx + r * Math.cos(rad1);
    const y1 = cy + r * Math.sin(rad1);
    const largeArc = delta > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    paths.push(<path key={`${sl.label}-${idx}`} d={d} fill={sl.color} stroke="#ffffff" strokeWidth="1.2" />);
    angleDeg += delta;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="admin-pie-svg" role="img" aria-label="Pie chart">
      {paths}
    </svg>
  );
}

function PieChartBlock({ title, slices, size }: { title: string; slices: PieSliceData[]; size?: number }) {
  const s = size ?? 200;
  const total = slices.reduce((a, x) => a + x.value, 0);
  return (
    <div className="admin-pie-block">
      <h5 className="admin-pie-block-title">{title}</h5>
      <div className="admin-pie-block-inner">
        <ListeningPieChart slices={slices} size={s} />
        <ul className="admin-pie-legend">
          {slices
            .filter((x) => x.value > 0)
            .map((sl, i) => (
              <li key={`${sl.label}-${i}`}>
                <span className="admin-pie-legend-swatch" style={{ background: sl.color }} />
                <span className="admin-pie-legend-label">{sl.label}</span>
                <span className="admin-pie-legend-val">{total ? Math.round((100 * sl.value) / total) : 0}%</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t, tl } = useI18n();
  const navigate = useNavigate();
  const { logout, user, token } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [members, setMembers] = useState<PendingUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [preachers, setPreachers] = useState<Preacher[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "approvals" | "preachers" | "sermons" | "videos" | "documents" | "listeningReports"
  >("dashboard");
  const [memberListView, setMemberListView] = useState<"requests" | "approved" | "rejected" | "all">("requests");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("ALL");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const countryPickerRef = useRef<HTMLDivElement | null>(null);
  const [openedMemberId, setOpenedMemberId] = useState<number | null>(null);
  const [selectedApprovedMemberId, setSelectedApprovedMemberId] = useState<number | null>(null);
  const [preacherName, setPreacherName] = useState("");
  const [showPreacherList, setShowPreacherList] = useState(false);
  const [sermonForm, setSermonForm] = useState({
    title: "",
    scripture: "",
    description: "",
    createdDate: "",
    preacherId: "",
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioInputKey, setAudioInputKey] = useState(0);
  const [isSubmittingSermon, setIsSubmittingSermon] = useState(false);
  const [sermonFormSuccess, setSermonFormSuccess] = useState("");
  const [sermonFormError, setSermonFormError] = useState("");
  const [showSermonList, setShowSermonList] = useState(false);
  const [sermonsLoadError, setSermonsLoadError] = useState("");
  const [videoSermons, setVideoSermons] = useState<VideoSermon[]>([]);
  const [showVideoSermonList, setShowVideoSermonList] = useState(false);
  const [selectedVideoSermonId, setSelectedVideoSermonId] = useState<number | null>(null);
  const [videoForm, setVideoForm] = useState({
    title: "",
    scripture: "",
    description: "",
    createdDate: "",
    preacherId: "",
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [isSubmittingVideoSermon, setIsSubmittingVideoSermon] = useState(false);
  const [videoFormSuccess, setVideoFormSuccess] = useState("");
  const [videoFormError, setVideoFormError] = useState("");
  /** When false, members do not see video sermons in the portal (admins always manage videos here). */
  const [adminMemberVideoSermonsEnabled, setAdminMemberVideoSermonsEnabled] = useState(false);
  const [adminMemberVideoSettingSaving, setAdminMemberVideoSettingSaving] = useState(false);
  const [selectedSermonId, setSelectedSermonId] = useState<number | null>(null);
  const [selectedSermonIdForDocs, setSelectedSermonIdForDocs] = useState("");
  const [documentFolderName, setDocumentFolderName] = useState("");
  const [selectedDocumentFolder, setSelectedDocumentFolder] = useState("");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [, setDocumentsForSelectedSermon] = useState<SermonDocument[]>([]);
  const [allAdminDocumentFiles, setAllAdminDocumentFiles] = useState<AdminDocumentFileItem[]>([]);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [documentUploadProgress, setDocumentUploadProgress] = useState(0);
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false);
  const audioAnimatedProgressRef = useRef(0);
  const videoAnimatedProgressRef = useRef(0);
  const documentAnimatedProgressRef = useRef(0);
  const audioProgressTimerRef = useRef<number | null>(null);
  const videoProgressTimerRef = useRef<number | null>(null);
  const documentProgressTimerRef = useRef<number | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics>({
    members: 0,
    approvedMembers: 0,
    preachers: 0,
    sermons: 0,
    completedSessions: 0,
  });
  const [reportCountries, setReportCountries] = useState<ListeningCountryBucket[]>([]);
  const [reportCountriesLoading, setReportCountriesLoading] = useState(false);
  const [selectedReportCountry, setSelectedReportCountry] = useState<string | null>("ALL");
  const [reportRows, setReportRows] = useState<ListeningReportRow[]>([]);
  const [reportRowsLoading, setReportRowsLoading] = useState(false);
  const [reportMediaFilter, setReportMediaFilter] = useState<"all" | "audio" | "video">("all");
  const [reportSermonTitleFilter, setReportSermonTitleFilter] = useState("");
  const [reportSermonTitles, setReportSermonTitles] = useState<string[]>([]);
  const [reportSermonTitlesLoading, setReportSermonTitlesLoading] = useState(false);
  const [showCountryLeaderboard, setShowCountryLeaderboard] = useState(false);
  const [countryLeaderboard, setCountryLeaderboard] = useState<CountryLeaderboardRow[]>([]);
  const [countryLeaderboardLoading, setCountryLeaderboardLoading] = useState(false);
  const [reportCountryPickerOpen, setReportCountryPickerOpen] = useState(false);
  const reportCountryPickerRef = useRef<HTMLDivElement | null>(null);
  const navItems: Array<{
    key: "dashboard" | "approvals" | "preachers" | "sermons" | "videos" | "documents" | "listeningReports";
    label: string;
  }> = [
    { key: "dashboard", label: t("admin.dashboard") },
    { key: "approvals", label: t("admin.memberRequests") },
    { key: "preachers", label: t("admin.preachers") },
    { key: "sermons", label: t("admin.audioSermons") },
    { key: "videos", label: t("admin.videoSermons") },
    { key: "documents", label: t("admin.documents") },
    { key: "listeningReports", label: t("admin.report") },
  ];
  const activityBars = [
    metrics.members,
    metrics.approvedMembers,
    pendingUsers.length,
    metrics.preachers,
    metrics.sermons,
    metrics.completedSessions,
    Math.max(metrics.approvedMembers - pendingUsers.length, 1),
    Math.max(metrics.sermons - metrics.preachers, 1),
    Math.max(metrics.members - metrics.approvedMembers, 1),
    Math.max(metrics.completedSessions + pendingUsers.length, 1),
  ];
  const maxActivity = Math.max(...activityBars, 1);
  const approvedMembers = useMemo(
    () => members.filter((member) => member.status === "APPROVED"),
    [members],
  );
  const rejectedMembers = useMemo(
    () => members.filter((member) => member.status === "REJECTED"),
    [members],
  );
  const countryOptions = useMemo(
    () => AFRICAN_COUNTRIES.map((c) => c.name),
    [],
  );
  const countryFilterOptions = useMemo(
    () => [
      { name: tl("All countries"), value: "ALL", iso2: "" },
      ...countryOptions.map((country) => ({
        name: country,
        value: country,
        iso2: (findCountryByNameLoose(country)?.iso2 || "").toLowerCase(),
      })),
    ],
    [countryOptions],
  );
  const reportCountryDropdownOptions = useMemo(
    () => [
      { name: tl("All countries"), value: "ALL", iso2: "" },
      ...AFRICAN_COUNTRIES.map((c) => ({
        name: c.name,
        value: c.name,
        iso2: c.iso2.toLowerCase(),
      })),
    ],
    [],
  );
  const countryFilterActive = selectedCountryFilter !== "ALL";
  const memberInCountry = (country: string) =>
    !countryFilterActive || country.trim().toLowerCase() === selectedCountryFilter.trim().toLowerCase();
  const filteredPendingUsers = useMemo(
    () => pendingUsers.filter((member) => memberInCountry(member.country)),
    [pendingUsers, countryFilterActive, selectedCountryFilter],
  );
  const filteredApprovedMembers = useMemo(
    () => approvedMembers.filter((member) => memberInCountry(member.country)),
    [approvedMembers, countryFilterActive, selectedCountryFilter],
  );
  const filteredRejectedMembers = useMemo(
    () => rejectedMembers.filter((member) => memberInCountry(member.country)),
    [rejectedMembers, countryFilterActive, selectedCountryFilter],
  );
  const filteredAllMembers = useMemo(
    () => members.filter((member) => memberInCountry(member.country)),
    [members, countryFilterActive, selectedCountryFilter],
  );
  const selectedReportCountryBucket = useMemo(() => {
    if (!selectedReportCountry) return undefined;
    if (selectedReportCountry.trim().toUpperCase() === "ALL") {
      return reportCountries.reduce(
        (acc, x) => ({
          country: tl("All countries"),
          memberCount: acc.memberCount + x.memberCount,
          audioTotal: acc.audioTotal + x.audioTotal,
          audioCompleted: acc.audioCompleted + x.audioCompleted,
          videoTotal: acc.videoTotal + x.videoTotal,
          videoCompleted: acc.videoCompleted + x.videoCompleted,
        }),
        {
          country: tl("All countries"),
          memberCount: 0,
          audioTotal: 0,
          audioCompleted: 0,
          videoTotal: 0,
          videoCompleted: 0,
        },
      );
    }
    const k = selectedReportCountry.trim().toLowerCase();
    return reportCountries.find((x) => x.country.trim().toLowerCase() === k);
  }, [reportCountries, selectedReportCountry]);
  const selectedReportCountryMemberCount = useMemo(() => {
    if (!selectedReportCountry) return 0;
    if (selectedReportCountry.trim().toUpperCase() === "ALL") return members.length;
    const k = selectedReportCountry.trim().toLowerCase();
    return members.filter((m) => m.country.trim().toLowerCase() === k).length;
  }, [members, selectedReportCountry]);
  const listeningReportCountryLabel = (code: string | null) => {
    if (!code?.trim()) return "";
    return code.trim().toUpperCase() === "ALL" ? tl("All countries") : code.trim();
  };
  const selectedCountryFlag = useMemo(() => {
    if (!countryFilterActive) return "🌍";
    const country = findCountryByNameLoose(selectedCountryFilter);
    if (!country) return "🏳️";
    return flagEmoji(country.iso2) || "🏳️";
  }, [countryFilterActive, selectedCountryFilter]);
  const selectedCountryIso2 = useMemo(() => {
    if (!countryFilterActive) return "";
    return findCountryByNameLoose(selectedCountryFilter)?.iso2?.toLowerCase() || "";
  }, [countryFilterActive, selectedCountryFilter]);
  const selectedCountryFlagImageUrl = selectedCountryIso2
    ? `https://flagcdn.com/w320/${selectedCountryIso2}.png`
    : "";
  const selectedCountryLabel = countryFilterActive ? selectedCountryFilter : tl("All countries");

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const t = event.target as Node;
      if (countryPickerRef.current && !countryPickerRef.current.contains(t)) {
        setCountryPickerOpen(false);
      }
      if (reportCountryPickerRef.current && !reportCountryPickerRef.current.contains(t)) {
        setReportCountryPickerOpen(false);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  useEffect(() => {
    if (activeTab !== "listeningReports") setReportCountryPickerOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "listeningReports") setShowCountryLeaderboard(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "approvals") setCountryPickerOpen(false);
  }, [activeTab]);

  const loadPendingUsers = async () => {
    const { data } = await api.get("/admin/users/pending");
    setPendingUsers(data);
  };
  const loadMembers = async () => {
    const { data } = await api.get("/admin/users");
    setMembers(data);
  };

  const loadPreachers = async () => {
    const { data } = await api.get("/preachers");
    setPreachers(data);
  };

  const loadSermons = useCallback(async () => {
    setSermonsLoadError("");
    try {
      const { data } = await api.get("/sermons");
      setSermons(Array.isArray(data) ? data : []);
    } catch (err) {
      setSermons([]);
      if (axios.isAxiosError(err)) {
        const m = err.response?.data?.message;
        setSermonsLoadError(
          userVisibleApiError(
            typeof m === "string" ? m : err.message,
            tl("Could not load sermons. Is the API running? Are you still logged in?"),
          ),
        );
      } else {
        setSermonsLoadError(tl("Could not load sermons."));
      }
    }
  }, []);

  const loadMetrics = async () => {
    const { data } = await api.get("/admin/metrics");
    setMetrics(data);
  };

  const loadReportCountries = useCallback(async () => {
    setReportCountriesLoading(true);
    try {
      const { data } = await api.get<ListeningCountryBucket[]>("/admin/listening-reports/countries");
      setReportCountries(Array.isArray(data) ? data : []);
    } catch {
      setReportCountries([]);
    } finally {
      setReportCountriesLoading(false);
    }
  }, []);

  const loadReportRows = useCallback(async () => {
    if (!selectedReportCountry) {
      setReportRows([]);
      return;
    }
    setReportRowsLoading(true);
    try {
      const sermonTitle = reportSermonTitleFilter.trim();
      const { data } = await api.get<ListeningReportRow[]>("/admin/listening-reports", {
        params: {
          country: selectedReportCountry,
          media: reportMediaFilter,
          ...(sermonTitle ? { sermonTitle } : {}),
        },
      });
      setReportRows(Array.isArray(data) ? data : []);
    } catch {
      setReportRows([]);
    } finally {
      setReportRowsLoading(false);
    }
  }, [selectedReportCountry, reportMediaFilter, reportSermonTitleFilter]);

  const loadReportSermonTitles = useCallback(async () => {
    if (!selectedReportCountry) {
      setReportSermonTitles([]);
      return;
    }
    setReportSermonTitlesLoading(true);
    try {
      const { data } = await api.get<string[]>("/admin/listening-reports/sermon-titles", {
        params: { country: selectedReportCountry, media: reportMediaFilter },
      });
      setReportSermonTitles(Array.isArray(data) ? data : []);
    } catch {
      setReportSermonTitles([]);
    } finally {
      setReportSermonTitlesLoading(false);
    }
  }, [selectedReportCountry, reportMediaFilter]);

  const loadCountryLeaderboard = useCallback(async () => {
    setCountryLeaderboardLoading(true);
    try {
      const { data } = await api.get<CountryLeaderboardRow[]>("/admin/listening-reports/country-leaderboard");
      setCountryLeaderboard(Array.isArray(data) ? data : []);
    } catch {
      setCountryLeaderboard([]);
    } finally {
      setCountryLeaderboardLoading(false);
    }
  }, []);

  const loadVideoSermons = useCallback(async () => {
    try {
      const { data } = await api.get("/videos");
      setVideoSermons(Array.isArray(data) ? data : []);
    } catch {
      setVideoSermons([]);
    }
  }, []);

  const loadMemberLibrarySettings = useCallback(async () => {
    try {
      const { data } = await api.get<{ memberVideoSermonsEnabled?: boolean }>("/settings/member-library");
      setAdminMemberVideoSermonsEnabled(Boolean(data?.memberVideoSermonsEnabled));
    } catch {
      setAdminMemberVideoSermonsEnabled(false);
    }
  }, []);

  const toggleAdminMemberVideoAccess = async () => {
    const nextEnabled = !adminMemberVideoSermonsEnabled;
    setAdminMemberVideoSettingSaving(true);
    try {
      const { data } = await api.post<{ memberVideoSermonsEnabled?: boolean }>("/settings/member-video-sermons", {
        enabled: nextEnabled,
      });
      setAdminMemberVideoSermonsEnabled(Boolean(data?.memberVideoSermonsEnabled));
      await loadMemberLibrarySettings();
    } catch (err) {
      console.error(err);
      await loadMemberLibrarySettings();
    } finally {
      setAdminMemberVideoSettingSaving(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadPendingUsers();
    void loadMembers();
    void loadPreachers();
    void loadSermons();
    void loadVideoSermons();
    void loadMetrics();
    void loadMemberLibrarySettings();
  }, [token, loadSermons, loadVideoSermons, loadMemberLibrarySettings]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "sermons") {
      void loadSermons();
      setShowSermonList(true);
    }
    if (activeTab === "documents") {
      void loadSermons();
    }
    if (activeTab === "videos") {
      void loadVideoSermons();
      setShowVideoSermonList(true);
    }
    if (activeTab === "listeningReports") {
      void loadReportCountries();
    }
  }, [activeTab, token, loadSermons, loadVideoSermons, loadReportCountries]);

  useEffect(() => {
    if (activeTab !== "listeningReports" || !selectedReportCountry) return;
    void loadReportSermonTitles();
  }, [activeTab, selectedReportCountry, reportMediaFilter, loadReportSermonTitles]);

  useEffect(() => {
    if (activeTab !== "listeningReports" || !selectedReportCountry) return;
    void loadReportRows();
  }, [activeTab, selectedReportCountry, reportMediaFilter, reportSermonTitleFilter, loadReportRows]);

  useEffect(() => {
    if (!showCountryLeaderboard || activeTab !== "listeningReports") return;
    void loadCountryLeaderboard();
  }, [showCountryLeaderboard, activeTab, loadCountryLeaderboard]);

  useEffect(() => {
    if (sermons.length === 0) {
      setSelectedSermonIdForDocs("");
      setDocumentsForSelectedSermon([]);
      setSelectedDocumentFolder("");
      return;
    }
    const firstId = String(sermons[0].id);
    setSelectedSermonIdForDocs(firstId);
  }, [sermons]);

  const loadDocumentsForSermon = useCallback(async (sermonId: string) => {
    if (!sermonId) {
      setDocumentsForSelectedSermon([]);
      setSelectedDocumentFolder("");
      return;
    }
    const { data } = await api.get(`/sermons/${sermonId}/documents`);
    setDocumentsForSelectedSermon(Array.isArray(data) ? data : []);
  }, []);

  const loadAllDocumentsForAdmin = useCallback(async () => {
    if (sermons.length === 0) {
      setAllAdminDocumentFiles([]);
      setSelectedDocumentFolder("");
      return;
    }

    const responses = await Promise.all(
      sermons
        .filter((sermon) => sermon.hasDocument)
        .map(async (sermon) => {
          const { data } = await api.get(`/sermons/${sermon.id}/documents`);
          return (Array.isArray(data) ? data : []).map((doc: SermonDocument) => ({
            id: doc.id,
            sermonId: sermon.id,
            sermonTitle: sermon.title,
            originalName: doc.originalName,
            folderName: doc.folderName || "general",
          }));
        }),
    );

    const merged = responses.flat();
    setAllAdminDocumentFiles(merged);
    const folders = Array.from(new Set(merged.map((doc) => doc.folderName))).sort((a, b) => a.localeCompare(b));
    setSelectedDocumentFolder((prev) => (prev && folders.includes(prev) ? prev : folders[0] || prev));
  }, [sermons]);

  useEffect(() => {
    if (!selectedSermonIdForDocs) return;
    void loadDocumentsForSermon(selectedSermonIdForDocs);
  }, [selectedSermonIdForDocs, loadDocumentsForSermon]);

  useEffect(() => {
    if (activeTab !== "documents") return;
    void loadAllDocumentsForAdmin();
  }, [activeTab, loadAllDocumentsForAdmin]);

  useEffect(() => {
    if (!sermonFormSuccess) return;
    const timer = window.setTimeout(() => {
      setSermonFormSuccess("");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [sermonFormSuccess]);

  useEffect(() => {
    if (!sermonFormError) return;
    const timer = window.setTimeout(() => {
      setSermonFormError("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [sermonFormError]);

  useEffect(() => {
    if (!videoFormSuccess) return;
    const timer = window.setTimeout(() => {
      setVideoFormSuccess("");
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [videoFormSuccess]);

  useEffect(() => {
    if (!videoFormError) return;
    const timer = window.setTimeout(() => {
      setVideoFormError("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [videoFormError]);

  const updateStatus = async (id: number, action: "approve" | "reject") => {
    await api.patch(`/admin/users/${id}/${action}`);
    await loadPendingUsers();
    await loadMembers();
    await loadMetrics();
  };

  const deleteMember = async (id: number) => {
    if (!window.confirm("Delete this member permanently?")) return;
    await api.delete(`/admin/users/${id}`);
    await loadPendingUsers();
    await loadMembers();
    await loadMetrics();
  };

  const submitPreacher = async (e: FormEvent) => {
    e.preventDefault();
    await api.post("/preachers", { name: preacherName });
    setPreacherName("");
    await loadPreachers();
    await loadMetrics();
  };

  const updatePreacherName = async (id: number, currentName: string) => {
    const name = window.prompt("Update preacher name", currentName);
    if (!name || name.trim() === "") return;
    await api.patch(`/preachers/${id}`, { name: name.trim() });
    await loadPreachers();
  };

  const removePreacher = async (id: number) => {
    if (!window.confirm("Delete this preacher?")) return;
    await api.delete(`/preachers/${id}`);
    await loadPreachers();
    await loadMetrics();
  };

  const togglePreacherList = async () => {
    if (!showPreacherList) {
      await loadPreachers();
    }
    setShowPreacherList((prev) => !prev);
  };

  const startAnimatedProgress = (
    timerRef: MutableRefObject<number | null>,
    animatedRef: MutableRefObject<number>,
    setProgress: (value: number) => void,
  ) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    animatedRef.current = 1;
    setProgress(1);
    timerRef.current = window.setInterval(() => {
      const current = animatedRef.current;
      if (current >= 95) return;
      const step = current < 60 ? 1 : current < 85 ? 0.6 : 0.3;
      const next = Math.min(95, current + step);
      animatedRef.current = next;
      setProgress(Math.floor(next));
    }, 180);
  };

  const syncAnimatedProgress = (
    percent: number,
    animatedRef: MutableRefObject<number>,
    setProgress: (value: number) => void,
  ) => {
    const next = Math.max(animatedRef.current, percent, 1);
    animatedRef.current = Math.min(next, 99);
    setProgress(Math.floor(animatedRef.current));
  };

  const finishAnimatedProgress = (
    timerRef: MutableRefObject<number | null>,
    animatedRef: MutableRefObject<number>,
    setProgress: (value: number) => void,
  ) => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    animatedRef.current = 100;
    setProgress(100);
    window.setTimeout(() => {
      animatedRef.current = 0;
      setProgress(0);
    }, 900);
  };

  const stopAnimatedProgress = (
    timerRef: MutableRefObject<number | null>,
    animatedRef: MutableRefObject<number>,
    setProgress: (value: number) => void,
  ) => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    animatedRef.current = 0;
    setProgress(0);
  };

  const submitSermon = async (e: FormEvent) => {
    e.preventDefault();
    setSermonFormSuccess("");
    setSermonFormError("");

    if (!audioFile) {
      setSermonFormError("Please select an audio file before submitting.");
      return;
    }

    let completed = false;
    try {
      setIsSubmittingSermon(true);
      startAnimatedProgress(audioProgressTimerRef, audioAnimatedProgressRef, setAudioUploadProgress);

      const audioUploadData = new FormData();
      audioUploadData.append("audio", audioFile);
      const { data: uploadedAudio } = await api.post("/sermons/audio", audioUploadData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const total = evt.total ?? 0;
          if (!total) return;
          syncAnimatedProgress(
            Math.max(1, Math.min(99, Math.round((evt.loaded * 100) / total))),
            audioAnimatedProgressRef,
            setAudioUploadProgress,
          );
        },
      });

      await api.post("/sermons", {
        title: sermonForm.title,
        scripture: sermonForm.scripture,
        description: sermonForm.description || undefined,
        createdDate: sermonForm.createdDate,
        preacherId: Number(sermonForm.preacherId),
        audioUrl: uploadedAudio.audioUrl as string,
      });
      setSermonForm({
        title: "",
        scripture: "",
        description: "",
        createdDate: "",
        preacherId: "",
      });
      setAudioFile(null);
      setAudioInputKey((prev) => prev + 1);
      completed = true;
      finishAnimatedProgress(audioProgressTimerRef, audioAnimatedProgressRef, setAudioUploadProgress);
      setSermonFormSuccess("Audio uploaded and sermon saved successfully.");
      await loadSermons();
      await loadMetrics();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        setSermonFormError(
          userVisibleApiError(
            typeof message === "string" ? message : undefined,
            "Failed to upload audio and save sermon.",
          ),
        );
      } else {
        setSermonFormError("Failed to upload audio and save sermon.");
      }
    } finally {
      setIsSubmittingSermon(false);
      if (!completed) {
        stopAnimatedProgress(audioProgressTimerRef, audioAnimatedProgressRef, setAudioUploadProgress);
      }
    }
  };

  const submitDocuments = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSermonIdForDocs || documentFiles.length === 0 || !selectedDocumentFolder) return;

    const formData = new FormData();
    formData.append("folderName", selectedDocumentFolder);
    documentFiles.forEach((file) => formData.append("documents", file));

    let completed = false;
    startAnimatedProgress(documentProgressTimerRef, documentAnimatedProgressRef, setDocumentUploadProgress);
    setIsSubmittingDocuments(true);
    try {
      await api.post(`/sermons/${selectedSermonIdForDocs}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const total = evt.total ?? 0;
          if (!total) return;
          syncAnimatedProgress(
            Math.max(1, Math.min(99, Math.round((evt.loaded * 100) / total))),
            documentAnimatedProgressRef,
            setDocumentUploadProgress,
          );
        },
      });
      setDocumentFiles([]);
      completed = true;
      finishAnimatedProgress(documentProgressTimerRef, documentAnimatedProgressRef, setDocumentUploadProgress);
      const { data } = await api.get(`/sermons/${selectedSermonIdForDocs}/documents`);
      setDocumentsForSelectedSermon(data);
      await loadSermons();
      await loadAllDocumentsForAdmin();
    } finally {
      setIsSubmittingDocuments(false);
      if (!completed) {
        stopAnimatedProgress(documentProgressTimerRef, documentAnimatedProgressRef, setDocumentUploadProgress);
      }
    }
  };

  const addDocumentFolder = () => {
    const folder = documentFolderName.trim().toLowerCase();
    if (!folder) return;
    setSelectedDocumentFolder(folder);
    setDocumentFolderName("");
  };

  const openDocumentInBrowser = (sermonId: string, documentId: number) => {
    const tokenQuery = `token=${encodeURIComponent(token ?? "")}`;
    window.open(`${api.defaults.baseURL}/sermons/${sermonId}/document/${documentId}?${tokenQuery}`, "_blank");
  };

  const deleteDocumentFromFolder = async (sermonId: number, documentId: number) => {
    if (!window.confirm("Delete this document?")) return;
    await api.delete(`/sermons/${sermonId}/document/${documentId}`);
    if (selectedSermonIdForDocs && String(sermonId) === selectedSermonIdForDocs) {
      const { data } = await api.get(`/sermons/${selectedSermonIdForDocs}/documents`);
      setDocumentsForSelectedSermon(data);
    }
    await loadAllDocumentsForAdmin();
    await loadSermons();
  };

  const updateSermonTitle = async (sermon: Sermon) => {
    const title = window.prompt("Update sermon title", sermon.title);
    if (!title || title.trim() === "") return;
    await api.patch(`/sermons/${sermon.id}`, { title: title.trim() });
    await loadSermons();
  };

  const removeSermon = async (id: number) => {
    if (!window.confirm("Delete this sermon and its documents?")) return;
    await api.delete(`/sermons/${id}`);
    await loadSermons();
    await loadMetrics();
  };

  const toggleSermonList = async () => {
    if (!showSermonList) {
      await loadSermons();
    }
    setShowSermonList((prev) => !prev);
  };

  const submitVideoSermon = async (e: FormEvent) => {
    e.preventDefault();
    setVideoFormSuccess("");
    setVideoFormError("");

    if (!videoFile) {
      setVideoFormError("Please select a video file before submitting.");
      return;
    }

    let completed = false;
    try {
      setIsSubmittingVideoSermon(true);
      startAnimatedProgress(videoProgressTimerRef, videoAnimatedProgressRef, setVideoUploadProgress);
      const videoUploadData = new FormData();
      videoUploadData.append("video", videoFile);
      const { data: uploadedVideo } = await api.post("/videos/upload", videoUploadData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          const total = evt.total ?? 0;
          if (!total) return;
          syncAnimatedProgress(
            Math.max(1, Math.min(99, Math.round((evt.loaded * 100) / total))),
            videoAnimatedProgressRef,
            setVideoUploadProgress,
          );
        },
      });

      await api.post("/videos", {
        title: videoForm.title,
        scripture: videoForm.scripture,
        description: videoForm.description || undefined,
        createdDate: videoForm.createdDate,
        preacherId: Number(videoForm.preacherId),
        videoUrl: uploadedVideo.videoUrl as string,
      });

      setVideoForm({
        title: "",
        scripture: "",
        description: "",
        createdDate: "",
        preacherId: "",
      });
      setVideoFile(null);
      setVideoInputKey((prev) => prev + 1);
      completed = true;
      finishAnimatedProgress(videoProgressTimerRef, videoAnimatedProgressRef, setVideoUploadProgress);
      setVideoFormSuccess("Video uploaded and sermon saved successfully.");
      await loadVideoSermons();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        setVideoFormError(
          userVisibleApiError(
            typeof message === "string" ? message : undefined,
            "Failed to upload video and save sermon.",
          ),
        );
      } else {
        setVideoFormError("Failed to upload video and save sermon.");
      }
    } finally {
      setIsSubmittingVideoSermon(false);
      if (!completed) {
        stopAnimatedProgress(videoProgressTimerRef, videoAnimatedProgressRef, setVideoUploadProgress);
      }
    }
  };

  const updateVideoSermonTitle = async (video: VideoSermon) => {
    const title = window.prompt("Update video sermon title", video.title);
    if (!title || title.trim() === "") return;
    await api.patch(`/videos/${video.id}`, { title: title.trim() });
    await loadVideoSermons();
  };

  const removeVideoSermon = async (id: number) => {
    if (!window.confirm("Delete this video sermon?")) return;
    await api.delete(`/videos/${id}`);
    await loadVideoSermons();
  };

  const toggleVideoSermonList = async () => {
    if (!showVideoSermonList) {
      await loadVideoSermons();
    }
    setShowVideoSermonList((prev) => !prev);
  };

  const downloadListeningReportCsv = async () => {
    if (!selectedReportCountry) return;
    const sermonTitle = reportSermonTitleFilter.trim();
    try {
      const res = await api.get("/admin/listening-reports/export", {
        params: {
          country: selectedReportCountry,
          media: reportMediaFilter,
          ...(sermonTitle ? { sermonTitle } : {}),
        },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe =
        selectedReportCountry.trim().toUpperCase() === "ALL"
          ? "all_countries"
          : selectedReportCountry.replace(/[^\w\-]+/g, "_").slice(0, 80) || "country";
      a.download = `listening-report-${safe}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  /** Opens the PDF in a new tab (inline disposition) so the browser PDF viewer handles it—avoids third‑party download managers hijacking a forced download. */
  const openListeningReportPdf = () => {
    if (!selectedReportCountry || !token) return;
    const params = new URLSearchParams({
      country: selectedReportCountry,
      media: reportMediaFilter,
      token,
    });
    const st = reportSermonTitleFilter.trim();
    if (st) params.set("sermonTitle", st);
    const url = `${API_BASE_URL}/admin/listening-reports/export-pdf?${params.toString()}`;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      window.alert("Please allow pop-ups for this site to open the PDF, or use Download file below.");
    }
  };

  /** Classic file download (attachment); may be intercepted by browser download extensions. */
  const downloadListeningReportPdfAttachment = async () => {
    if (!selectedReportCountry || !token) return;
    const sermonTitle = reportSermonTitleFilter.trim();
    try {
      const res = await api.get("/admin/listening-reports/export-pdf", {
        params: {
          country: selectedReportCountry,
          media: reportMediaFilter,
          download: "1",
          ...(sermonTitle ? { sermonTitle } : {}),
        },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe =
        selectedReportCountry.trim().toUpperCase() === "ALL"
          ? "all_countries"
          : selectedReportCountry.replace(/[^\w\-]+/g, "_").slice(0, 80) || "country";
      a.download = `listening-report-${safe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const openCountryLeaderboardPdf = () => {
    if (!token) return;
    const params = new URLSearchParams({ token });
    const url = `${API_BASE_URL}/admin/listening-reports/country-leaderboard/export-pdf?${params.toString()}`;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      window.alert("Please allow pop-ups for this site to open the PDF, or use Save PDF file below.");
    }
  };

  const downloadCountryLeaderboardPdf = async () => {
    if (!token) return;
    try {
      const res = await api.get("/admin/listening-reports/country-leaderboard/export-pdf", {
        params: { download: "1" },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "country-listening-stats.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadCountryLeaderboardCsv = async () => {
    try {
      const res = await api.get("/admin/listening-reports/country-leaderboard/export", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "country-listening-stats.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteListeningReportRow = async (row: ListeningReportRow) => {
    if (!window.confirm("Remove this listening record from the report?")) return;
    try {
      const path =
        row.kind === "audio"
          ? `/admin/listening-reports/audio/${row.id}`
          : `/admin/listening-reports/video/${row.id}`;
      await api.delete(path);
      await loadReportRows();
      await loadReportCountries();
      await loadMetrics();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message;
        window.alert(userVisibleApiError(typeof message === "string" ? message : undefined, "Delete failed."));
      } else {
        window.alert("Delete failed.");
      }
    }
  };

  const leaderboardChartSlices = useMemo(() => {
    if (!countryLeaderboard.length) {
      const empty: PieSliceData[] = [];
      return {
        membersByCountry: empty,
        audioProgress: empty,
        videoProgress: empty,
        memberActivity: empty,
        listenTimeByCountry: empty,
      };
    }
    const rows = countryLeaderboard;
    const sortedByMembers = [...rows].sort((a, b) => b.memberCount - a.memberCount);
    const topN = 7;
    const topM = sortedByMembers.slice(0, topN);
    const restM = sortedByMembers.slice(topN);
    const otherMembers = restM.reduce((s, r) => s + r.memberCount, 0);
    const membersByCountry: PieSliceData[] = topM.map((r, i) => ({
      label: r.country,
      value: r.memberCount,
      color: PIE_PALETTE[i % PIE_PALETTE.length],
    }));
    if (otherMembers > 0) {
      membersByCountry.push({ label: "Other countries", value: otherMembers, color: "#94a3b8" });
    }

    let audioDone = 0;
    let audioOpen = 0;
    let videoDone = 0;
    let videoOpen = 0;
    let noActivity = 0;
    let withActivity = 0;
    for (const r of rows) {
      audioDone += r.audioCompleted;
      audioOpen += Math.max(0, r.audioTotal - r.audioCompleted);
      videoDone += r.videoCompleted;
      videoOpen += Math.max(0, r.videoTotal - r.videoCompleted);
      noActivity += r.membersWithNoListeningActivity;
      withActivity += Math.max(0, r.memberCount - r.membersWithNoListeningActivity);
    }
    const audioProgress: PieSliceData[] = [];
    if (audioDone > 0) audioProgress.push({ label: "Audio completed", value: audioDone, color: "#16a34a" });
    if (audioOpen > 0) audioProgress.push({ label: "Audio in progress", value: audioOpen, color: "#cbd5e1" });
    const videoProgress: PieSliceData[] = [];
    if (videoDone > 0) videoProgress.push({ label: "Video completed", value: videoDone, color: "#7c3aed" });
    if (videoOpen > 0) videoProgress.push({ label: "Video in progress", value: videoOpen, color: "#e9d5ff" });

    const memberActivity: PieSliceData[] = [];
    if (withActivity > 0) {
      memberActivity.push({ label: "With listening / viewing", value: withActivity, color: "#0ea5e9" });
    }
    if (noActivity > 0) {
      memberActivity.push({ label: "No activity yet", value: noActivity, color: "#f97316" });
    }

    const sortedByListen = [...rows].sort((a, b) => b.totalListenSeconds - a.totalListenSeconds);
    const topL = sortedByListen.slice(0, 6);
    const restL = sortedByListen.slice(6);
    const otherListen = restL.reduce((s, r) => s + r.totalListenSeconds, 0);
    const listenTimeByCountry: PieSliceData[] = topL
      .filter((r) => r.totalListenSeconds > 0)
      .map((r, i) => ({
        label: r.country,
        value: r.totalListenSeconds,
        color: PIE_PALETTE[(i + 2) % PIE_PALETTE.length],
      }));
    if (otherListen > 0) {
      listenTimeByCountry.push({ label: "Other countries", value: otherListen, color: "#64748b" });
    }

    return { membersByCountry, audioProgress, videoProgress, memberActivity, listenTimeByCountry };
  }, [countryLeaderboard]);

  const adminDocumentsWorkspace =
    sermons.length === 0 ? (
      <p className="muted">{tl("No sermons yet.")}</p>
    ) : !selectedSermonIdForDocs ? (
      <p className="muted">{tl("Preparing documents workspace…")}</p>
    ) : (
      <>
        <div className="row between mt-16">
          <h4 style={{ margin: 0 }}>{tl("Folders")}</h4>
        </div>
        <div className="row mt-16">
          <input
            placeholder={tl("Folder name")}
            value={documentFolderName}
            onChange={(e) => setDocumentFolderName(e.target.value)}
          />
          <button className="btn primary" type="button" onClick={addDocumentFolder}>
            {tl("Add Folder")}
          </button>
        </div>
        <div className="row mt-16">
          {Array.from(new Set(allAdminDocumentFiles.map((doc) => doc.folderName || "general")))
            .sort((a, b) => a.localeCompare(b))
            .concat(
              selectedDocumentFolder &&
                !allAdminDocumentFiles.some((doc) => (doc.folderName || "general") === selectedDocumentFolder)
                ? [selectedDocumentFolder]
                : [],
            )
            .map((folder) => (
              <button
                key={folder}
                className={`btn ${selectedDocumentFolder === folder ? "primary" : ""}`}
                type="button"
                onClick={() => setSelectedDocumentFolder(folder)}
              >
                {folder}
              </button>
            ))}
        </div>

        {selectedDocumentFolder && (
          <div className="mt-16">
            <h4 style={{ margin: 0 }}>{selectedDocumentFolder} {tl("documents")}</h4>
            <form className="grid-2 admin-form-grid mt-16" onSubmit={submitDocuments}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                multiple
                onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                required
              />
              <button className="btn primary" type="submit" disabled={isSubmittingDocuments}>
                {isSubmittingDocuments
                  ? `${tl("Uploading")} ${Math.max(1, documentUploadProgress)}/100%`
                  : `${tl("Upload to")} ${selectedDocumentFolder}`}
              </button>
            </form>

            <div className="member-sheet mt-16">
              <div className="member-sheet-row member-sheet-head">
                <span>No.</span>
                <span>{tl("Document name")}</span>
                <span>{tl("Action")}</span>
              </div>
              {allAdminDocumentFiles
                .filter((doc) => (doc.folderName || "general") === selectedDocumentFolder)
                .map((doc, index) => (
                  <div className="member-sheet-row" key={doc.id}>
                    <span>{index + 1}</span>
                    <span style={{ color: "#000", fontWeight: 600 }}>{doc.originalName}</span>
                    <div className="row">
                      <button className="btn" type="button" onClick={() => openDocumentInBrowser(String(doc.sermonId), doc.id)}>
                        {tl("Open")}
                      </button>
                      <button className="btn danger" type="button" onClick={() => deleteDocumentFromFolder(doc.sermonId, doc.id)}>
                        {tl("Delete")}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </>
    );

  return (
    <div className="dashboard-page dashboard-form-theme">
      <div className="global-brand">
        <img className="global-brand-logo" src="/logo.jpeg" alt="Church logo" />
      </div>
      <button className="dashboard-left-menu-btn" onClick={() => setIsMenuOpen((v) => !v)} aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </button>
      <section className={`dashboard-shell admin-modern-shell ${isMenuOpen ? "" : "sidebar-collapsed"}`}>
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <h3>Admin Portal</h3>
            <p>Content Workspace</p>
          </div>
          <nav className="admin-sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`admin-nav-item ${activeTab === item.key ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(item.key);
                  setIsMenuOpen(false);
                  if (item.key === "sermons" || item.key === "documents") {
                    void loadSermons();
                  }
                  if (item.key === "videos") {
                    void loadVideoSermons();
                    setShowVideoSermonList(true);
                  }
                  if (item.key === "sermons") {
                    setShowSermonList(true);
                  }
                }}
              >
                <span className="admin-nav-dot" aria-hidden="true">
                  ›
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <button
            className="btn admin-logout-btn"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            {t("common.logout")}
          </button>
        </aside>

        <main className="dashboard-main admin-modern-main">
          <header className="admin-topbar">
            <div className="topbar-left">
              <div>
              <small className="muted">Church Media Control Center</small>
              <h2>{user?.fullName ?? tl("Admin")}</h2>
              </div>
            </div>
            <div className="admin-top-meta">
              <span>Administrator</span>
              <strong>Content management</strong>
            </div>
          </header>

          {activeTab === "dashboard" && (
            <>
              <section className="analytics-top-cards mt-16">
                <article className="analytics-metric-card navy">
                  <h3>{tl("Members")}</h3>
                  <strong>{metrics.members}</strong>
                </article>
                <article className="analytics-metric-card">
                  <h3>{tl("Approved")}</h3>
                  <strong>{metrics.approvedMembers}</strong>
                </article>
                <article className="analytics-metric-card">
                  <h3>{tl("Sermons")}</h3>
                  <strong>{metrics.sermons}</strong>
                </article>
                <article className="analytics-metric-card">
                  <h3>{tl("Completed")}</h3>
                  <strong>{metrics.completedSessions}</strong>
                </article>
              </section>

              <section className="analytics-layout mt-16">
                <div className="analytics-main-col">
                  <article className="card analytics-chart-card">
                    <div className="analytics-chart-head">
                      <h3>Result</h3>
                      <button className="btn primary">Check Now</button>
                    </div>
                    <div className="analytics-fake-bars" aria-hidden="true">
                      {activityBars.map((value, index) => (
                        <span key={`${index}-${value}`} style={{ height: `${Math.max(16, (value / maxActivity) * 100)}%` }} />
                      ))}
                    </div>
                  </article>

                  <article className="card analytics-wave-card mt-16">
                    <h3>Overview</h3>
                    <div className="analytics-wave" aria-hidden="true" />
                  </article>
                </div>

                <aside className="analytics-side-col">
                  <article className="card analytics-progress-card">
                    <div className="progress-ring">
                      {`${Math.round((metrics.approvedMembers / Math.max(metrics.members, 1)) * 100)}%`}
                    </div>
                    <p className="muted">Monthly growth</p>
                    <button className="btn primary">Check Now</button>
                  </article>

                  <article className="card stat mt-16">
                    <span>Pending Requests</span>
                    <strong>{pendingUsers.length}</strong>
                  </article>
                  <article className="card stat mt-16">
                    <span>Approved Members</span>
                    <strong>{metrics.approvedMembers}</strong>
                  </article>
                  <article className="card stat mt-16">
                    <span>Published Sermons</span>
                    <strong>{metrics.sermons}</strong>
                  </article>
                </aside>
              </section>
            </>
          )}

          {activeTab === "approvals" && (
            <div className="card panel section-panel mt-16" style={{ overflow: "visible" }}>
              <h3>Member Requests</h3>
              <div className="row between mt-16" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="row" style={{ alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">
                    {selectedCountryFlag}
                  </span>
                  <strong>{selectedCountryLabel}</strong>
                  {selectedCountryFlagImageUrl ? (
                    <img
                      src={selectedCountryFlagImageUrl}
                      alt={`${selectedCountryFilter} flag`}
                      width={56}
                      height={36}
                      style={{ borderRadius: 6, border: "1px solid #cbd5e1", objectFit: "cover" }}
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div
                  className="register-country-custom"
                  style={{ minWidth: 320, flex: "1 1 360px", maxWidth: 560, position: "relative" }}
                  ref={countryPickerRef}
                >
                  <button
                    type="button"
                    className="register-country-search-wrap"
                    style={{ justifyContent: "space-between", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCountryPickerOpen((prev) => !prev);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={countryPickerOpen}
                  >
                    <span className="row" style={{ alignItems: "center", gap: 10 }}>
                      {selectedCountryIso2 ? (
                        <img
                          className="register-country-flag"
                          src={`https://flagcdn.com/h24/${selectedCountryIso2}.png`}
                          alt=""
                          width={32}
                          height={24}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="register-country-flag-fallback" style={{ display: "inline" }} aria-hidden>
                          🌍
                        </span>
                      )}
                      <span className="register-country-name">{selectedCountryLabel}</span>
                    </span>
                    <span aria-hidden="true" style={{ color: "#64748b", fontSize: 18 }}>
                      ▾
                    </span>
                  </button>

                  {countryPickerOpen && (
                    <ul className="register-country-dropdown" role="listbox">
                      {countryFilterOptions.map((country) => (
                        <li key={country.value} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedCountryFilter === country.value}
                            className={`register-country-option${selectedCountryFilter === country.value ? " is-active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCountryFilter(country.value);
                              setMemberListView("all");
                              setCountryPickerOpen(false);
                            }}
                          >
                            <span className="register-country-flag-wrap">
                              {country.iso2 ? (
                                <img
                                  className="register-country-flag"
                                  src={`https://flagcdn.com/h24/${country.iso2}.png`}
                                  alt=""
                                  width={32}
                                  height={24}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <span className="register-country-flag-fallback" style={{ display: "inline" }} aria-hidden>
                                  🌍
                                </span>
                              )}
                            </span>
                            <span className="register-country-name">{country.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="member-subtabs mt-16">
                <button
                  className={`member-subtab ${memberListView === "requests" ? "active" : ""}`}
                  onClick={() => setMemberListView("requests")}
                >
                  Requests ({filteredPendingUsers.length})
                </button>
                <button
                  className={`member-subtab ${memberListView === "approved" ? "active" : ""}`}
                  onClick={() => setMemberListView("approved")}
                >
                  Approved ({filteredApprovedMembers.length})
                </button>
                <button
                  className={`member-subtab ${memberListView === "rejected" ? "active" : ""}`}
                  onClick={() => setMemberListView("rejected")}
                >
                  Rejected ({filteredRejectedMembers.length})
                </button>
                <button
                  className={`member-subtab ${memberListView === "all" ? "active" : ""}`}
                  onClick={() => setMemberListView("all")}
                >
                  All ({filteredAllMembers.length})
                </button>
              </div>

              {memberListView === "requests" &&
                (filteredPendingUsers.length === 0 ? (
                  <p className="muted mt-16">No pending users right now.</p>
                ) : (
                  filteredPendingUsers.map((pendingUser, index) => (
                    <div className="list-item admin-member-item" key={pendingUser.id}>
                      <div>
                        <small className="member-no">No. {index + 1}</small>
                        <strong>{pendingUser.fullName}</strong>
                        <p className="muted">{pendingUser.email}</p>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={() => setOpenedMemberId(openedMemberId === pendingUser.id ? null : pendingUser.id)}>
                          {openedMemberId === pendingUser.id ? "Hide" : "See"}
                        </button>
                      </div>
                      {openedMemberId === pendingUser.id && (
                        <div className="admin-member-expand">
                          <small className="muted">
                            {pendingUser.country} · {pendingUser.phoneNumber}
                          </small>
                          <div className="row mt-16">
                            <button className="btn primary" onClick={() => updateStatus(pendingUser.id, "approve")}>
                              Approve
                            </button>
                            <button className="btn danger" onClick={() => updateStatus(pendingUser.id, "reject")}>
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ))}

              {memberListView === "approved" &&
                (filteredApprovedMembers.length === 0 ? (
                  <p className="muted mt-16">No approved members yet.</p>
                ) : (
                  <>
                    <div className="member-sheet mt-16">
                      <div className="member-sheet-row member-sheet-head">
                        <span>No.</span>
                        <span>Name</span>
                        <span>Email</span>
                        <span>Action</span>
                      </div>
                      {filteredApprovedMembers.map((member, index) => (
                          <div className="member-sheet-row" key={member.id}>
                            <span>{index + 1}</span>
                            <span>{member.fullName}</span>
                            <span>{member.email}</span>
                            <button className="btn" onClick={() => setSelectedApprovedMemberId(member.id)}>
                              View details
                            </button>
                          </div>
                        ))}
                    </div>
                    {selectedApprovedMemberId && (
                      <div className="admin-member-expand mt-16">
                        {(() => {
                          const selected = members.find((member) => member.id === selectedApprovedMemberId);
                          if (!selected) return <p className="muted">Member not found.</p>;
                          return (
                            <>
                              <strong>{selected.fullName}</strong>
                              <p className="muted">{selected.email}</p>
                              <small className="muted">
                                {selected.country} · {selected.phoneNumber} · {selected.status}
                              </small>
                              <div className="row mt-16">
                                <button className="btn danger" onClick={() => deleteMember(selected.id)}>
                                  Delete
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ))}

              {memberListView === "rejected" &&
                (filteredRejectedMembers.length === 0 ? (
                  <p className="muted mt-16">No rejected members.</p>
                ) : (
                  filteredRejectedMembers.map((member, index) => (
                      <div className="list-item admin-member-item" key={member.id}>
                        <div>
                          <small className="member-no">No. {index + 1}</small>
                          <strong>{member.fullName}</strong>
                          <p className="muted">{member.email}</p>
                        </div>
                        <div className="row">
                          <button className="btn" onClick={() => setOpenedMemberId(openedMemberId === member.id ? null : member.id)}>
                            {openedMemberId === member.id ? "Hide" : "See"}
                          </button>
                        </div>
                        {openedMemberId === member.id && (
                          <div className="admin-member-expand">
                            <small className="muted">
                              {member.country} · {member.phoneNumber}
                            </small>
                            <div className="row mt-16">
                              <button className="btn danger" onClick={() => deleteMember(member.id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                ))}

              {memberListView === "all" &&
                (filteredAllMembers.length === 0 ? (
                  <p className="muted mt-16">No members found.</p>
                ) : (
                  <>
                    <div className="member-sheet mt-16">
                      <div className="member-sheet-row member-sheet-head">
                        <span>No.</span>
                        <span>Name</span>
                        <span>Status</span>
                        <span>Action</span>
                      </div>
                      {filteredAllMembers.map((member, index) => (
                        <div className="member-sheet-row" key={member.id}>
                          <span>{index + 1}</span>
                          <span>{member.fullName}</span>
                          <span>{member.status}</span>
                          <button className="btn" onClick={() => setOpenedMemberId(openedMemberId === member.id ? null : member.id)}>
                            {openedMemberId === member.id ? "Hide" : "View"}
                          </button>
                        </div>
                      ))}
                    </div>
                    {openedMemberId && (
                      <div className="admin-member-expand mt-16">
                        {(() => {
                          const selected = members.find((member) => member.id === openedMemberId);
                          if (!selected) return <p className="muted">Member not found.</p>;
                          return (
                            <>
                              <strong>{selected.fullName}</strong>
                              <p className="muted">{selected.email}</p>
                              <small className="muted">
                                {selected.status} · {selected.country} · {selected.phoneNumber}
                              </small>
                              <div className="row mt-16">
                                <button className="btn danger" onClick={() => deleteMember(selected.id)}>
                                  Delete
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                ))}
            </div>
          )}

          {activeTab === "preachers" && (
            <div className="card panel section-panel mt-16">
              <h3>Preacher Management</h3>
              <form className="grid-2 admin-form-grid" onSubmit={submitPreacher}>
                <input placeholder="Preacher name" value={preacherName} onChange={(e) => setPreacherName(e.target.value)} required />
                <button className="btn primary full" type="submit">
                  Add Preacher
                </button>
              </form>
              <div className="row mt-16">
                <button className="btn" type="button" onClick={togglePreacherList}>
                  {showPreacherList ? "Hide All Preachers" : `View All Preachers (${preachers.length})`}
                </button>
              </div>
              {showPreacherList && (
                <div className="mt-16">
                  {preachers.length === 0 ? (
                    <p className="muted">No preachers added yet.</p>
                  ) : (
                    <div className="member-sheet">
                      <div className="member-sheet-row member-sheet-head">
                        <span>No.</span>
                        <span>Name</span>
                        <span>Action</span>
                      </div>
                      {preachers.map((preacher, index) => (
                        <div className="member-sheet-row" key={preacher.id}>
                          <span>{index + 1}</span>
                          <span style={{ color: "#000", fontWeight: 600 }}>{preacher.name}</span>
                          <div className="row">
                            <button className="btn" type="button" onClick={() => updatePreacherName(preacher.id, preacher.name)}>
                              Edit
                            </button>
                            <button className="btn danger" type="button" onClick={() => removePreacher(preacher.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "sermons" && (
            <div className="card panel section-panel mt-16">
              <h3>Audio Sermon Management</h3>
              <form className="grid-2 admin-form-grid mt-16" onSubmit={submitSermon}>
                    <input
                      placeholder="Title"
                      value={sermonForm.title}
                      onChange={(e) => setSermonForm({ ...sermonForm, title: e.target.value })}
                      required
                    />
                    <input
                      placeholder="Scripture"
                      value={sermonForm.scripture}
                      onChange={(e) => setSermonForm({ ...sermonForm, scripture: e.target.value })}
                      required
                    />
                    <input
                      type="date"
                      value={sermonForm.createdDate}
                      onChange={(e) => setSermonForm({ ...sermonForm, createdDate: e.target.value })}
                      required
                    />
                    <select
                      value={sermonForm.preacherId}
                      onChange={(e) => setSermonForm({ ...sermonForm, preacherId: e.target.value })}
                      required
                    >
                      <option value="">Select preacher</option>
                      {preachers.map((preacher) => (
                        <option key={preacher.id} value={preacher.id}>
                          {preacher.name}
                        </option>
                      ))}
                    </select>
                    <input
                      key={audioInputKey}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                      required
                    />
                    <input
                      className="full"
                      placeholder="Description (optional)"
                      value={sermonForm.description}
                      onChange={(e) => setSermonForm({ ...sermonForm, description: e.target.value })}
                    />
                {audioFile && (
                  <small className="muted full">
                    Selected audio: {audioFile.name}
                  </small>
                )}
                {sermonFormError && (
                  <p className="full" style={{ color: "#b91c1c", margin: 0 }}>
                    {sermonFormError}
                  </p>
                )}
                {sermonFormSuccess && (
                  <p className="full" style={{ color: "#166534", margin: 0 }}>
                    {sermonFormSuccess}
                  </p>
                )}
                <button className="btn primary full" type="submit" disabled={isSubmittingSermon}>
                  {isSubmittingSermon ? `Uploading ${Math.max(1, audioUploadProgress)}/100%` : "Add Sermon"}
                </button>
              </form>
              <div className="row between mt-16" style={{ flexWrap: "wrap", gap: 10 }}>
                <button className="btn" type="button" onClick={toggleSermonList}>
                  {showSermonList ? "Hide All Audio Sermons" : `View All Audio Sermons (${sermons.length})`}
                </button>
                <button className="btn primary" type="button" onClick={() => void loadSermons()}>
                  Refresh list
                </button>
              </div>
              {sermonsLoadError ? (
                <p className="full mt-16" style={{ color: "#b91c1c", margin: 0 }}>
                  {sermonsLoadError}{" "}
                  <button type="button" className="btn" onClick={() => void loadSermons()}>
                    Retry
                  </button>
                </p>
              ) : null}
              {showSermonList && (
                <div className="mt-16">
                  {sermons.length === 0 ? (
                    <p className="muted">No audio sermons added yet.</p>
                  ) : (
                    <div className="member-sheet">
                      <div className="member-sheet-row member-sheet-head">
                        <span>No.</span>
                        <span>Title</span>
                        <span>Action</span>
                      </div>
                      {sermons.map((sermon, index) => (
                        <div className="member-sheet-row" key={sermon.id}>
                          <span>{index + 1}</span>
                          <span style={{ color: "#000", fontWeight: 600 }}>{sermon.title}</span>
                          <div className="row">
                            <button
                              className="btn"
                              type="button"
                              onClick={() => setSelectedSermonId(selectedSermonId === sermon.id ? null : sermon.id)}
                            >
                              {selectedSermonId === sermon.id ? "Hide" : "View"}
                            </button>
                            <button className="btn" type="button" onClick={() => updateSermonTitle(sermon)}>
                              Edit
                            </button>
                            <button className="btn danger" type="button" onClick={() => removeSermon(sermon.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedSermonId && (
                    <div className="admin-member-expand mt-16">
                      {(() => {
                        const selected = sermons.find((sermon) => sermon.id === selectedSermonId);
                        if (!selected) return <p className="muted">Sermon not found.</p>;
                        return (
                          <>
                            <strong>{selected.title}</strong>
                            <p className="muted">
                              {selected.preacher.name} · {new Date(selected.createdDate).toLocaleDateString()}
                            </p>
                            <small className="muted">Scripture: {selected.scripture}</small>
                            {selected.description && (
                              <p className="muted mt-16">{selected.description}</p>
                            )}
                            <small className="muted">
                              Documents: {selected.documentsCount ?? 0}
                            </small>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "videos" && (
            <div className="card panel section-panel mt-16">
              <h3>Video Sermon Management</h3>
              <form className="grid-2 admin-form-grid mt-16" onSubmit={submitVideoSermon}>
                <input
                  placeholder="Title"
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  required
                />
                <input
                  placeholder="Scripture"
                  value={videoForm.scripture}
                  onChange={(e) => setVideoForm({ ...videoForm, scripture: e.target.value })}
                  required
                />
                <input
                  type="date"
                  value={videoForm.createdDate}
                  onChange={(e) => setVideoForm({ ...videoForm, createdDate: e.target.value })}
                  required
                />
                <select
                  value={videoForm.preacherId}
                  onChange={(e) => setVideoForm({ ...videoForm, preacherId: e.target.value })}
                  required
                >
                  <option value="">Select preacher</option>
                  {preachers.map((preacher) => (
                    <option key={preacher.id} value={preacher.id}>
                      {preacher.name}
                    </option>
                  ))}
                </select>
                <input
                  key={videoInputKey}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  required
                />
                <input
                  className="full"
                  placeholder="Description (optional)"
                  value={videoForm.description}
                  onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                />
                {videoFile && <small className="muted full">Selected video: {videoFile.name}</small>}
                {videoFormError && (
                  <p className="full" style={{ color: "#b91c1c", margin: 0 }}>
                    {videoFormError}
                  </p>
                )}
                {videoFormSuccess && (
                  <p className="full" style={{ color: "#166534", margin: 0 }}>
                    {videoFormSuccess}
                  </p>
                )}
                <button className="btn primary full" type="submit" disabled={isSubmittingVideoSermon}>
                  {isSubmittingVideoSermon ? `Uploading ${Math.max(1, videoUploadProgress)}/100%` : "Add Video Sermon"}
                </button>
              </form>
              <div className="row between mt-16" style={{ flexWrap: "wrap", gap: 10 }}>
                <button className="btn" type="button" onClick={toggleVideoSermonList}>
                  {showVideoSermonList ? "Hide All Video Sermons" : `View All Video Sermons (${videoSermons.length})`}
                </button>
                <button
                  type="button"
                  className={`btn admin-video-member-toggle-btn ${adminMemberVideoSermonsEnabled ? "" : "primary"}`}
                  disabled={adminMemberVideoSettingSaving}
                  aria-pressed={adminMemberVideoSermonsEnabled}
                  title={
                    adminMemberVideoSermonsEnabled
                      ? "Members will no longer see video sermons"
                      : "Members will see video sermons in their portal"
                  }
                  onClick={() => void toggleAdminMemberVideoAccess()}
                >
                  {adminMemberVideoSettingSaving
                    ? "…"
                    : adminMemberVideoSermonsEnabled
                      ? "Hide for members"
                      : "Show for members"}
                </button>
              </div>
              {showVideoSermonList && (
                <div className="mt-16">
                  {videoSermons.length === 0 ? (
                    <p className="muted">No video sermons added yet.</p>
                  ) : (
                    <div className="member-sheet">
                      <div className="member-sheet-row member-sheet-head">
                        <span>No.</span>
                        <span>Title</span>
                        <span>Action</span>
                      </div>
                      {videoSermons.map((video, index) => (
                        <div className="member-sheet-row" key={video.id}>
                          <span>{index + 1}</span>
                          <span style={{ color: "#000", fontWeight: 600 }}>{video.title}</span>
                          <div className="row">
                            <button
                              className="btn"
                              type="button"
                              onClick={() => setSelectedVideoSermonId(selectedVideoSermonId === video.id ? null : video.id)}
                            >
                              {selectedVideoSermonId === video.id ? "Hide" : "View"}
                            </button>
                            <button className="btn" type="button" onClick={() => updateVideoSermonTitle(video)}>
                              Edit
                            </button>
                            <button className="btn danger" type="button" onClick={() => removeVideoSermon(video.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedVideoSermonId && (
                    <div className="admin-member-expand mt-16">
                      {(() => {
                        const selected = videoSermons.find((video) => video.id === selectedVideoSermonId);
                        if (!selected) return <p className="muted">Video sermon not found.</p>;
                        return (
                          <>
                            <strong>{selected.title}</strong>
                            <p className="muted">
                              {selected.preacher.name} · {new Date(selected.createdDate).toLocaleDateString()}
                            </p>
                            <small className="muted">Scripture: {selected.scripture}</small>
                            {selected.description && <p className="muted mt-16">{selected.description}</p>}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "listeningReports" && (
            <div className="card panel section-panel mt-16 admin-listening-reports">
              <h3>Report</h3>
              {showCountryLeaderboard ? (
                <div className="admin-stats-fullscreen mt-16">
                  <header className="admin-stats-fullscreen-header row between" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <div>
                      <h4 className="admin-stats-fullscreen-title">Country listening statistics</h4>
                      <p className="muted" style={{ margin: "6px 0 0", fontSize: 12, maxWidth: 520, lineHeight: 1.45 }}>
                        Pie charts show how members and listening time are spread across countries. The table ranks each country by member count and engagement.
                      </p>
                    </div>
                    <button type="button" className="btn primary" onClick={() => setShowCountryLeaderboard(false)}>
                      Back to report
                    </button>
                  </header>
                  <div className="admin-stats-charts-grid">
                    <PieChartBlock title="Members by country" slices={leaderboardChartSlices.membersByCountry} size={176} />
                    <PieChartBlock title="Audio sessions" slices={leaderboardChartSlices.audioProgress} size={176} />
                    <PieChartBlock title="Video sessions" slices={leaderboardChartSlices.videoProgress} size={176} />
                    <PieChartBlock title="Member activity" slices={leaderboardChartSlices.memberActivity} size={176} />
                    <PieChartBlock title="Listen time by country" slices={leaderboardChartSlices.listenTimeByCountry} size={176} />
                  </div>
                <div className="admin-leaderboard-panel mt-16">
                  <div className="admin-leaderboard-toolbar row between" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <h4 className="admin-leaderboard-title">Country listening leaderboard</h4>
                      <p className="muted admin-leaderboard-sub" style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.45 }}>
                        Countries are numbered <strong>1, 2, 3…</strong> by <strong>member count</strong> (highest first),
                        then by completion rate and total listening time. <strong>No activity</strong> counts members who
                        never opened an audio or video sermon in the library.
                      </p>
                    </div>
                    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                      <button type="button" className="btn primary" onClick={() => void openCountryLeaderboardPdf()}>
                        Open stats PDF
                      </button>
                      <button type="button" className="btn" onClick={() => void downloadCountryLeaderboardPdf()}>
                        Save stats PDF
                      </button>
                      <button type="button" className="btn" onClick={() => void downloadCountryLeaderboardCsv()}>
                        Download stats CSV
                      </button>
                      <button type="button" className="btn" onClick={() => void loadCountryLeaderboard()}>
                        Refresh stats
                      </button>
                    </div>
                  </div>
                  {countryLeaderboardLoading ? (
                    <p className="muted mt-16">Loading statistics…</p>
                  ) : countryLeaderboard.length === 0 ? (
                    <p className="muted mt-16">No member countries to rank yet.</p>
                  ) : (
                    <div className="admin-leaderboard-table-wrap mt-16">
                      <table className="admin-leaderboard-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Country</th>
                            <th>Members</th>
                            <th>No activity</th>
                            <th>Audio (done / total)</th>
                            <th>Video (done / total)</th>
                            <th>Completion</th>
                            <th>Total listen time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {countryLeaderboard.map((row) => {
                            const iso = findCountryByNameLoose(row.country)?.iso2?.toLowerCase();
                            return (
                              <tr
                                key={row.country}
                                className={`admin-leaderboard-row admin-leaderboard-row--rank-${row.rank <= 3 ? row.rank : "other"}`}
                              >
                                <td>
                                  <span className={`admin-leaderboard-rank admin-leaderboard-rank--${row.rank <= 3 ? row.rank : "n"}`}>
                                    {row.rank}
                                  </span>
                                </td>
                                <td>
                                  <span className="admin-leaderboard-country">
                                    {iso ? (
                                      <img
                                        className="register-country-flag"
                                        src={`https://flagcdn.com/h24/${iso}.png`}
                                        alt=""
                                        width={28}
                                        height={21}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <span className="register-country-flag-fallback" aria-hidden>
                                        🌍
                                      </span>
                                    )}
                                    <span className="admin-leaderboard-country-name">{row.country}</span>
                                  </span>
                                </td>
                                <td>{row.memberCount}</td>
                                <td>
                                  <span className={row.membersWithNoListeningActivity > 0 ? "admin-leaderboard-warn" : "muted"}>
                                    {row.membersWithNoListeningActivity}
                                  </span>
                                </td>
                                <td>
                                  <span className="admin-leaderboard-fraction">
                                    <strong>{row.audioCompleted}</strong>
                                    <span className="muted"> / {row.audioTotal}</span>
                                  </span>
                                </td>
                                <td>
                                  <span className="admin-leaderboard-fraction">
                                    <strong>{row.videoCompleted}</strong>
                                    <span className="muted"> / {row.videoTotal}</span>
                                  </span>
                                </td>
                                <td>{row.completionPercent == null ? "—" : `${row.completionPercent}%`}</td>
                                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                                  {formatCountryListenDuration(row.totalListenSeconds)}
                                </td>
                                <td>
                                  <span className={`admin-lb-health admin-lb-health--${row.activityHealth}`}>
                                    {leaderboardHealthLabel(row.activityHealth)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="admin-listening-layout mt-16">
                <div
                  className="admin-listening-toolbar card admin-listening-countries"
                  style={{ padding: 14, position: "relative", zIndex: 4 }}
                >
                  <div className="admin-listening-toolbar-inner">
                    <div className="admin-listening-toolbar-field">
                      <h4 className="admin-listening-toolbar-label">Country</h4>
                      {reportCountriesLoading ? (
                        <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
                          Updating listening summary…
                        </p>
                      ) : null}
                      <div
                        className="register-country-custom admin-report-country-picker"
                        ref={reportCountryPickerRef}
                        style={{ width: "100%", maxWidth: 480, position: "relative" }}
                      >
                    <button
                      type="button"
                      className="register-country-search-wrap"
                      style={{ justifyContent: "space-between", cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportCountryPickerOpen((prev) => !prev);
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={reportCountryPickerOpen}
                      aria-label="Select country for report"
                    >
                      <span className="row" style={{ alignItems: "center", gap: 10 }}>
                        {(() => {
                          const ac =
                            selectedReportCountry && selectedReportCountry.trim().toUpperCase() !== "ALL"
                              ? findCountryByNameLoose(selectedReportCountry)
                              : undefined;
                          return ac?.iso2 ? (
                            <img
                              className="register-country-flag"
                              src={`https://flagcdn.com/h24/${ac.iso2.toLowerCase()}.png`}
                              alt=""
                              width={32}
                              height={24}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="register-country-flag-fallback" style={{ display: "inline" }} aria-hidden>
                              🌍
                            </span>
                          );
                        })()}
                        <span className="register-country-name">
                          {selectedReportCountry?.trim()
                            ? listeningReportCountryLabel(selectedReportCountry)
                            : "Select country"}
                        </span>
                      </span>
                      <span aria-hidden="true" style={{ color: "#64748b", fontSize: 18 }}>
                        ▾
                      </span>
                    </button>

                    {reportCountryPickerOpen && (
                      <ul className="register-country-dropdown" role="listbox">
                        {reportCountryDropdownOptions.map((country) => (
                          <li key={country.value} role="presentation">
                            <button
                              type="button"
                              role="option"
                              aria-selected={
                                selectedReportCountry != null &&
                                selectedReportCountry.trim().toLowerCase() === country.value.trim().toLowerCase()
                              }
                              className={`register-country-option${
                                selectedReportCountry != null &&
                                selectedReportCountry.trim().toLowerCase() === country.value.trim().toLowerCase()
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportSermonTitleFilter("");
                                setSelectedReportCountry(country.value);
                                setReportCountryPickerOpen(false);
                              }}
                            >
                              <span className="register-country-flag-wrap">
                                {country.iso2 ? (
                                  <img
                                    className="register-country-flag"
                                    src={`https://flagcdn.com/h24/${country.iso2}.png`}
                                    alt=""
                                    width={32}
                                    height={24}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span className="register-country-flag-fallback" style={{ display: "inline" }} aria-hidden>
                                    🌍
                                  </span>
                                )}
                              </span>
                              <span className="register-country-name">{country.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                    </div>
                  <div className="admin-listening-toolbar-stat-wrap">
                    <h4 className="admin-listening-toolbar-label">Statistics</h4>
                    <button type="button" className="btn primary" onClick={() => setShowCountryLeaderboard(true)}>
                      Country statistics
                    </button>
                  </div>
                  </div>
                  {selectedReportCountry && selectedReportCountryMemberCount > 0 ? (
                    <p className="muted admin-listening-toolbar-stats" style={{ fontSize: 12, margin: "12px 0 0", lineHeight: 1.5 }}>
                      <strong>{selectedReportCountryMemberCount}</strong>
                      {selectedReportCountryMemberCount === 1 ? " member" : " members"}
                      {selectedReportCountry.trim().toUpperCase() === "ALL" ? " (all countries)" : ""}
                      {selectedReportCountryBucket ? (
                        <>
                          {" · "}
                          Audio {selectedReportCountryBucket.audioCompleted}/{selectedReportCountryBucket.audioTotal}, Video{" "}
                          {selectedReportCountryBucket.videoCompleted}/{selectedReportCountryBucket.videoTotal}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="admin-listening-detail card" style={{ padding: 16, minWidth: 0 }}>
                  {!selectedReportCountry ? (
                    <p className="muted">Select a country using the selector above.</p>
                  ) : (
                    <>
                      <div className="row between" style={{ flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                        <h4 className="admin-listening-detail-section-title" style={{ margin: 0 }}>
                          Listening activity
                        </h4>
                        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                          <select
                            className="admin-listening-media-select"
                            value={reportMediaFilter}
                            onChange={(e) => {
                              setReportMediaFilter(e.target.value as "all" | "audio" | "video");
                              setReportSermonTitleFilter("");
                            }}
                            aria-label="Media type"
                          >
                            <option value="all">Audio + video</option>
                            <option value="audio">Audio only</option>
                            <option value="video">Video only</option>
                          </select>
                          <label className="admin-listening-media-select-wrap" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200, maxWidth: 360 }}>
                            <span className="muted" style={{ fontSize: 11 }}>
                              Sermon title {reportSermonTitlesLoading ? "(loading…)" : ""}
                            </span>
                            <select
                              className="admin-listening-media-select"
                              style={{ width: "100%" }}
                              value={reportSermonTitleFilter}
                              onChange={(e) => setReportSermonTitleFilter(e.target.value)}
                              aria-label="Filter by sermon title"
                              disabled={!selectedReportCountryMemberCount}
                            >
                              <option value="">All sermons with activity</option>
                              {reportSermonTitles.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="button" className="btn primary" onClick={() => openListeningReportPdf()}>
                            Open PDF
                          </button>
                          <button
                            type="button"
                            className="btn"
                            title="Forces a file download (some browser add-ons may intercept this)"
                            onClick={() => void downloadListeningReportPdfAttachment()}
                          >
                            Save PDF file
                          </button>
                          <button type="button" className="btn" onClick={() => void downloadListeningReportCsv()}>
                            Download CSV
                          </button>
                          <button type="button" className="btn" onClick={() => void loadReportRows()}>
                            Refresh
                          </button>
                        </div>
                      </div>
                      {reportRowsLoading ? (
                        <p className="muted mt-16">Loading rows…</p>
                      ) : reportRows.length === 0 ? (
                        <p className="muted mt-16" style={{ margin: 0 }}>
                          {selectedReportCountryMemberCount > 0
                            ? "No activity yet."
                            : selectedReportCountry.trim().toUpperCase() === "ALL"
                              ? "No members yet."
                              : "No members for this country."}
                        </p>
                      ) : (
                        <div className="admin-listening-table-wrap mt-16">
                          <table className="admin-listening-table">
                            <thead>
                              <tr>
                                <th>Status</th>
                                <th>Media</th>
                                <th>Member</th>
                                <th>Sermon title</th>
                                <th>Preacher</th>
                                <th>Listen %</th>
                                <th>Position</th>
                                <th>Updated</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {reportRows.map((row) => {
                                const pct = row.progressPercent ?? (row.completed ? 100 : null);
                                return (
                                  <tr key={`${row.kind}-${row.id}`}>
                                    <td>
                                      <span
                                        className={`admin-listening-status${row.completed ? " admin-listening-status--done" : " admin-listening-status--partial"}`}
                                        title={row.completed ? "Completed (100%)" : "In progress"}
                                        aria-label={row.completed ? "Completed" : "In progress"}
                                      >
                                        {row.completed ? "✓" : "◐"}
                                      </span>
                                    </td>
                                    <td>{row.kind === "audio" ? "Audio" : "Video"}</td>
                                    <td>
                                      <div className="admin-listening-member">
                                        <strong>{row.fullName}</strong>
                                      </div>
                                    </td>
                                    <td style={{ fontWeight: 600, fontSize: 13 }}>{row.title}</td>
                                    <td className="muted" style={{ fontSize: 13 }}>
                                      {row.preacherName}
                                    </td>
                                    <td>
                                      <div className="admin-listening-pct-cell">
                                        <span className="admin-listening-pct-value">
                                          {pct == null ? "—" : `${pct}%`}
                                        </span>
                                        {pct != null ? (
                                          <div className="admin-listening-pct-bar" aria-hidden="true">
                                            <span style={{ width: `${Math.min(100, pct)}%` }} />
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="muted" style={{ fontSize: 12 }}>
                                      {formatListeningSeconds(row.progressSeconds)}
                                    </td>
                                    <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                                      {new Date(row.updatedAt).toLocaleString()}
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn danger"
                                        onClick={() => void deleteListeningReportRow(row)}
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="card panel section-panel mt-16">
              <h3>{tl("Documents Management")}</h3>
              <div className="mt-16">{adminDocumentsWorkspace}</div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
