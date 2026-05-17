import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, api } from "../api";
import { useI18n } from "../context/useI18n";
import { useAuth } from "../context/useAuth";

function mediaDurationForTracking(el: HTMLMediaElement): number | undefined {
  const d = el.duration;
  if (!Number.isFinite(d) || d <= 0) return undefined;
  return Math.floor(d);
}

type EngagedSample = { wallMs: number; mediaTime: number };

/** Counts only smooth forward playback; skips big seeks so scrub-to-end does not count as listening. */
function accumulatePlaybackEngagement(
  el: HTMLMediaElement,
  engagedRef: { current: number },
  sampleRef: { current: EngagedSample | null },
) {
  if (el.paused || el.seeking) return;
  const ct = el.currentTime;
  const now = performance.now();
  const last = sampleRef.current;
  sampleRef.current = { wallMs: now, mediaTime: ct };
  if (!last) return;
  const dMedia = ct - last.mediaTime;
  const dWall = (now - last.wallMs) / 1000;
  if (dMedia <= 0) return;
  if (dMedia > 4 || dMedia > dWall * 2 + 1) return;
  engagedRef.current += Math.min(dMedia, dWall * 1.5 + 0.5, 2);
}

/** How far ahead of the furthest "honest" listen position a seek is still allowed (scrubber precision). */
const SEEK_FORWARD_SLACK_SEC = 2.5;

/** Extends the furthest timeline reached while not actively seeking (play or pause at a position). */
function updateMaxListenedTimeline(el: HTMLMediaElement, maxRef: { current: number }) {
  if (el.seeking) return;
  maxRef.current = Math.max(maxRef.current, el.currentTime);
}

/** If the user jumped forward past what they have already reached, snap back to that point. */
function clampForwardSeek(el: HTMLMediaElement, maxRef: { current: number }) {
  const cap = maxRef.current;
  const t = el.currentTime;
  if (!Number.isFinite(t) || !Number.isFinite(cap)) return;
  if (t > cap + SEEK_FORWARD_SLACK_SEC) {
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : t;
    el.currentTime = Math.min(Math.max(0, cap), dur);
  }
}

type Preacher = {
  id: number;
  name: string;
};

type Sermon = {
  id: number;
  title: string;
  scripture: string;
  createdDate?: string;
  audioStreamUrl?: string;
  hasDocument?: boolean;
  preacher: { name: string };
};

type SermonDocument = {
  id: number;
  originalName: string;
  folderName?: string;
};

type DocumentFileItem = {
  id: number;
  sermonId: number;
  originalName: string;
  folderName: string;
};

type VideoSermon = {
  id: number;
  title: string;
  scripture: string;
  createdDate?: string;
  description?: string;
  preacher: { name: string };
  videoStreamUrl?: string;
};

type MemberMainTab = "dashboard" | "recentUpload" | "sermons" | "videos" | "documents";

const SEEN_RECENT_UPLOAD_IDS_KEY = "member:seen-recent-upload-ids";
const LEGACY_SEEN_AGNES_IDS_KEY = "member:seen-agnes-sermon-ids";

function seenRecentUploadsKeyForUser(userId: number): string {
  return `${SEEN_RECENT_UPLOAD_IDS_KEY}:${userId}`;
}

function loadSeenRecentUploadIds(userId?: number): Set<number> {
  if (!userId) return new Set();
  try {
    const scopedKey = seenRecentUploadsKeyForUser(userId);
    let raw = localStorage.getItem(scopedKey);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_SEEN_AGNES_IDS_KEY);
      if (raw) {
        // One-time migration from old global key to per-user key.
        localStorage.setItem(scopedKey, raw);
      }
    }
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

function saveSeenRecentUploadIds(userId: number | undefined, ids: Set<number>) {
  if (!userId) return;
  localStorage.setItem(seenRecentUploadsKeyForUser(userId), JSON.stringify([...ids]));
}

export default function MemberDashboardPage() {
  const { t, tl, language } = useI18n();
  const navigate = useNavigate();
  const { logout, token, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MemberMainTab>("dashboard");
  const [preachers, setPreachers] = useState<Preacher[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [selectedPreacherId, setSelectedPreacherId] = useState("");
  const [selectedVideoPreacherId, setSelectedVideoPreacherId] = useState("");
  const [activeSermonId, setActiveSermonId] = useState<number | null>(null);
  const [isListeningZoomed, setIsListeningZoomed] = useState(false);
  const [isZoomStarted, setIsZoomStarted] = useState(false);
  const [lastProgressSent, setLastProgressSent] = useState(0);
  const [docsTabFolder, setDocsTabFolder] = useState<string>("");
  const [allDocumentFiles, setAllDocumentFiles] = useState<DocumentFileItem[]>([]);
  const [videoSermons, setVideoSermons] = useState<VideoSermon[]>([]);
  /** Snapshot while full-screen viewer is open (so changing preacher filter does not drop the stream). */
  const [zoomSessionVideo, setZoomSessionVideo] = useState<VideoSermon | null>(null);
  const [isVideoZoomed, setIsVideoZoomed] = useState(false);
  const [isVideoZoomStarted, setIsVideoZoomStarted] = useState(false);
  const [videoIsBuffering, setVideoIsBuffering] = useState(false);
  /** Loaded from API; when false, video sermons are hidden for members (admin-controlled). */
  const [memberVideoSermonsEnabled, setMemberVideoSermonsEnabled] = useState(false);
  const [seenRecentUploadIds, setSeenRecentUploadIds] = useState<Set<number>>(new Set());
  /** Full library for Recent Upload + header counts (unaffected by preacher filter on Audio Sermons). */
  const [sermonsForMessages, setSermonsForMessages] = useState<Sermon[]>([]);

  const loadData = async (preacherId?: string) => {
    const preacherQuery = preacherId ? `?preacherId=${preacherId}` : "";
    try {
      const [preacherResponse, sermonResponse] = await Promise.all([
        api.get("/preachers"),
        api.get(`/sermons${preacherQuery}`),
      ]);
      setPreachers(preacherResponse.data);
      setSermons(sermonResponse.data);
      if (!preacherId) {
        setSermonsForMessages(sermonResponse.data);
      }
    } catch {
      setPreachers([]);
      setSermons([]);
      if (!preacherId) {
        setSermonsForMessages([]);
      }
    }
  };

  const loadMemberLibrarySettings = useCallback(async () => {
    try {
      const { data } = await api.get<{ memberVideoSermonsEnabled?: boolean }>("/settings/member-library");
      setMemberVideoSermonsEnabled(Boolean(data?.memberVideoSermonsEnabled));
    } catch {
      setMemberVideoSermonsEnabled(false);
    }
  }, []);

  useEffect(() => {
    setSeenRecentUploadIds(loadSeenRecentUploadIds(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!token) {
      setPreachers([]);
      setSermons([]);
      setSermonsForMessages([]);
      setVideoSermons([]);
      setMemberVideoSermonsEnabled(false);
      setSeenRecentUploadIds(new Set());
      return;
    }
    void loadData();
    void loadMemberLibrarySettings();
  }, [token, loadMemberLibrarySettings]);

  /** Pick up admin toggle without full page reload (tab focus + light polling). */
  useEffect(() => {
    if (!token) return;
    const tick = () => void loadMemberLibrarySettings();
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    const intervalId = window.setInterval(tick, 12_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(intervalId);
    };
  }, [token, loadMemberLibrarySettings]);

  const refreshSermonsForMessages = async () => {
    try {
      const { data } = await api.get("/sermons");
      setSermonsForMessages(data);
    } catch {
      setSermonsForMessages([]);
    }
  };

  const closeVideoZoom = useCallback(() => {
    setIsVideoZoomed(false);
    setIsVideoZoomStarted(false);
    setZoomSessionVideo(null);
    setVideoIsBuffering(false);
    zoomVideoRef.current?.pause();
  }, []);

  useEffect(() => {
    if (memberVideoSermonsEnabled) return;
    closeVideoZoom();
    setActiveTab((tab) => (tab === "videos" ? "dashboard" : tab));
  }, [memberVideoSermonsEnabled, closeVideoZoom]);

  const loadVideoSermons = useCallback(async (preacherId?: string) => {
    try {
      const q = preacherId ? `?preacherId=${encodeURIComponent(preacherId)}` : "";
      const { data } = await api.get(`/videos${q}`);
      setVideoSermons(Array.isArray(data) ? data : []);
    } catch {
      setVideoSermons([]);
    }
  }, []);

  const streamSermon = async (sermonId: number) => {
    await api.post(`/tracking/sermons/${sermonId}/progress`, { progressSeconds: 0 });
    setActiveSermonId(sermonId);
    setIsListeningZoomed(false);
    setIsZoomStarted(false);
    setLastProgressSent(0);
  };

  const zoomAudioRef = useRef<HTMLAudioElement | null>(null);
  const zoomVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastVideoProgressSentRef = useRef(0);
  const audioEngagedSecondsRef = useRef(0);
  const audioEngagedSampleRef = useRef<EngagedSample | null>(null);
  const videoEngagedSecondsRef = useRef(0);
  const videoEngagedSampleRef = useRef<EngagedSample | null>(null);
  const audioMaxListenedTimeRef = useRef(0);
  const videoMaxListenedTimeRef = useRef(0);

  const loadAllDocumentFolders = async () => {
    const sourceSermons = sermonsForMessages.length > 0 ? sermonsForMessages : sermons;
    const targetSermons = sourceSermons.filter((sermon) => sermon.hasDocument);
    if (targetSermons.length === 0) {
      setAllDocumentFiles([]);
      setDocsTabFolder("");
      return;
    }

    const responses = await Promise.all(
      targetSermons.map(async (sermon) => {
        const { data } = await api.get(`/sermons/${sermon.id}/documents`);
        return (data as SermonDocument[]).map((doc) => ({
          id: doc.id,
          sermonId: sermon.id,
          originalName: doc.originalName,
          folderName: doc.folderName || "general",
        }));
      }),
    );

    const merged = responses.flat();
    setAllDocumentFiles(merged);
    const folders = Array.from(new Set(merged.map((doc) => doc.folderName))).sort((a, b) => a.localeCompare(b));
    setDocsTabFolder((prev) => (prev && folders.includes(prev) ? prev : folders[0] || ""));
  };

  useEffect(() => {
    if (activeTab !== "documents") return;
    loadAllDocumentFolders();
  }, [activeTab, sermons]);

  useEffect(() => {
    if (activeTab !== "videos") {
      setIsVideoZoomed(false);
      setIsVideoZoomStarted(false);
      setZoomSessionVideo(null);
      setVideoIsBuffering(false);
    }
  }, [activeTab]);

  useEffect(() => {
    lastVideoProgressSentRef.current = 0;
    videoEngagedSecondsRef.current = 0;
    videoEngagedSampleRef.current = null;
    videoMaxListenedTimeRef.current = 0;
  }, [zoomSessionVideo?.id]);

  useEffect(() => {
    audioEngagedSecondsRef.current = 0;
    audioEngagedSampleRef.current = null;
    audioMaxListenedTimeRef.current = 0;
    setLastProgressSent(0);
  }, [activeSermonId]);

  useEffect(() => {
    if (!isVideoZoomStarted) {
      videoEngagedSecondsRef.current = 0;
      videoEngagedSampleRef.current = null;
    }
  }, [isVideoZoomStarted]);

  useEffect(() => {
    if (activeTab !== "videos" || !isVideoZoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVideoZoom();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeTab, isVideoZoomed, closeVideoZoom]);

  useEffect(() => {
    if (!token || activeTab !== "videos" || !memberVideoSermonsEnabled) return;
    void loadVideoSermons(selectedVideoPreacherId || undefined);
  }, [token, activeTab, selectedVideoPreacherId, loadVideoSermons, memberVideoSermonsEnabled]);

  const viewDocument = (sermonId: number, documentId: number) => {
    window.open(
      `${API_BASE_URL}/sermons/${sermonId}/document/${documentId}?token=${encodeURIComponent(token ?? "")}`,
      "_blank",
    );
  };

  const handleAudioTimeUpdate = async (el: HTMLAudioElement) => {
    if (!activeSermonId) return;
    accumulatePlaybackEngagement(el, audioEngagedSecondsRef, audioEngagedSampleRef);
    updateMaxListenedTimeline(el, audioMaxListenedTimeRef);
    const seconds = el.currentTime;
    if (seconds - lastProgressSent < 10) return;
    setLastProgressSent(seconds);
    const durationSeconds = mediaDurationForTracking(el);
    await api.post(`/tracking/sermons/${activeSermonId}/progress`, {
      progressSeconds: Math.floor(seconds),
      ...(durationSeconds ? { durationSeconds } : {}),
    });
  };

  const handleVideoTimeUpdate = (el: HTMLVideoElement) => {
    accumulatePlaybackEngagement(el, videoEngagedSecondsRef, videoEngagedSampleRef);
    if (!zoomSessionVideo) return;
    updateMaxListenedTimeline(el, videoMaxListenedTimeRef);
    const seconds = el.currentTime;
    if (seconds - lastVideoProgressSentRef.current < 10) return;
    lastVideoProgressSentRef.current = seconds;
    const durationSeconds = mediaDurationForTracking(el);
    void api.post(`/tracking/videos/${zoomSessionVideo.id}/progress`, {
      progressSeconds: Math.floor(seconds),
      ...(durationSeconds ? { durationSeconds } : {}),
    });
  };

  const handleVideoEnded = () => {
    if (!zoomSessionVideo) return;
    const el = zoomVideoRef.current;
    if (!el) return;
    const durationSeconds = mediaDurationForTracking(el);
    const progressSeconds = durationSeconds ?? Math.floor(el.currentTime);
    const engagedWatchSeconds = Math.floor(videoEngagedSecondsRef.current);
    void api.post(`/tracking/videos/${zoomSessionVideo.id}/progress`, {
      progressSeconds,
      completed: true,
      engagedWatchSeconds,
      ...(durationSeconds ? { durationSeconds } : {}),
    });
    if (durationSeconds != null) {
      videoMaxListenedTimeRef.current = Math.max(videoMaxListenedTimeRef.current, durationSeconds);
    } else {
      videoMaxListenedTimeRef.current = Math.max(videoMaxListenedTimeRef.current, el.currentTime);
    }
  };

  const touchAudioMaxListened = (el: HTMLAudioElement) => {
    if (!activeSermonId) return;
    updateMaxListenedTimeline(el, audioMaxListenedTimeRef);
  };

  const onAudioSeekedClamp = (el: HTMLAudioElement) => {
    if (!activeSermonId) return;
    clampForwardSeek(el, audioMaxListenedTimeRef);
  };

  const touchVideoMaxListened = (el: HTMLVideoElement) => {
    if (!zoomSessionVideo) return;
    updateMaxListenedTimeline(el, videoMaxListenedTimeRef);
  };

  const onVideoSeekedClamp = (el: HTMLVideoElement) => {
    if (!zoomSessionVideo) return;
    clampForwardSeek(el, videoMaxListenedTimeRef);
  };

  const buildAudioStreamSrc = (sermon: Sermon) => {
    const tokenQuery = `token=${encodeURIComponent(token ?? "")}`;
    if (!sermon.audioStreamUrl) {
      return `${API_BASE_URL}/sermons/${sermon.id}/stream?${tokenQuery}`;
    }
    if (sermon.audioStreamUrl.startsWith("http://") || sermon.audioStreamUrl.startsWith("https://")) {
      return `${sermon.audioStreamUrl}?${tokenQuery}`;
    }
    if (sermon.audioStreamUrl.startsWith("/api/")) {
      const origin = API_BASE_URL.replace(/\/api\/v1$/, "");
      return `${origin}${sermon.audioStreamUrl}?${tokenQuery}`;
    }
    return `${API_BASE_URL}${sermon.audioStreamUrl.startsWith("/") ? "" : "/"}${sermon.audioStreamUrl}?${tokenQuery}`;
  };

  const buildVideoStreamSrc = (video: VideoSermon) => {
    const tokenQuery = `token=${encodeURIComponent(token ?? "")}`;
    if (!video.videoStreamUrl) {
      return `${API_BASE_URL}/videos/${video.id}/stream?${tokenQuery}`;
    }
    if (video.videoStreamUrl.startsWith("http://") || video.videoStreamUrl.startsWith("https://")) {
      return `${video.videoStreamUrl}?${tokenQuery}`;
    }
    if (video.videoStreamUrl.startsWith("/api/")) {
      const origin = API_BASE_URL.replace(/\/api\/v1$/, "");
      return `${origin}${video.videoStreamUrl}?${tokenQuery}`;
    }
    return `${API_BASE_URL}${video.videoStreamUrl.startsWith("/") ? "" : "/"}${video.videoStreamUrl}?${tokenQuery}`;
  };

  /** Full catalog count in header (not affected by preacher filter on Audio Sermons). */
  const catalogSermons = useMemo(
    () => (sermonsForMessages.length > 0 ? sermonsForMessages : sermons),
    [sermonsForMessages, sermons],
  );

  const recentForDashboard = useMemo(
    () =>
      [...catalogSermons]
        .sort((a, b) => {
          const aDate = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const bDate = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return bDate - aDate;
        })
        .slice(0, 6),
    [catalogSermons],
  );

  const dashboardBars = useMemo(
    () => [
      catalogSermons.length,
      recentForDashboard.length,
      preachers.length,
      Math.max(catalogSermons.filter((s) => s.hasDocument).length, 1),
      Math.max(catalogSermons.length - recentForDashboard.length, 1),
      Math.max(preachers.length + recentForDashboard.length, 1),
      Math.max(catalogSermons.length * 2, 1),
      Math.max(recentForDashboard.length * 2, 1),
      Math.max(preachers.length * 2, 1),
      Math.max(catalogSermons.length + preachers.length, 1),
    ],
    [catalogSermons, recentForDashboard, preachers],
  );

  const maxDashboardBar = Math.max(...dashboardBars, 1);

  /** Any library upload not yet opened from Recent Upload (newest first, capped). */
  const unseenRecentUploads = useMemo(() => {
    return sermonsForMessages
      .filter((s) => !seenRecentUploadIds.has(s.id))
      .sort((a, b) => {
        const aDate = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const bDate = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 30);
  }, [sermonsForMessages, seenRecentUploadIds]);

  const unseenRecentUploadCount = unseenRecentUploads.length;

  const markRecentUploadSeen = (sermonId: number) => {
    setSeenRecentUploadIds((prev) => {
      if (prev.has(sermonId)) return prev;
      const next = new Set(prev);
      next.add(sermonId);
      saveSeenRecentUploadIds(user?.id, next);
      return next;
    });
  };

  /** Clear notification, reload full library (clear preacher filter), open Audio Sermons and play. */
  const openUploadMessageAndListen = async (sermonId: number) => {
    markRecentUploadSeen(sermonId);
    setSelectedPreacherId("");
    await loadData(undefined);
    setActiveTab("sermons");
    await streamSermon(sermonId);
  };

  const activeSermon = activeSermonId ? sermons.find((sermon) => sermon.id === activeSermonId) || null : null;
  if (activeTab === "sermons" && activeSermon && isListeningZoomed) {
    return (
      <div className="member-audio-zoom-page">
        <header className="member-zoom-top-bar">
          <button
            type="button"
            className="member-zoom-exit-btn"
            onClick={() => {
              setIsListeningZoomed(false);
              setIsZoomStarted(false);
            }}
          >
            Exit Zoom
          </button>
        </header>
        <div className="member-audio-zoom-inner">
          <div className="member-zoom-content">
            <div className="member-zoom-content-body mt-16">
            <h2 className="member-zoom-title">{activeSermon.title}</h2>
            <div className="member-zoom-meta">
              <span className="member-zoom-meta-scripture">{activeSermon.scripture}</span>
              <span className="member-zoom-meta-preacher">{activeSermon.preacher.name}</span>
              <span className="member-zoom-meta-date">
                {activeSermon.createdDate ? new Date(activeSermon.createdDate).toLocaleDateString() : ""}
              </span>
            </div>

            <div className="member-zoom-audio-label">Audio - English Version</div>
            <div className="member-zoom-media-stage">
              {!isZoomStarted && (
                <button
                  type="button"
                  className="member-zoom-start-btn"
                  aria-label="Start listening"
                  onClick={async () => {
                    setIsZoomStarted(true);
                    try {
                      await zoomAudioRef.current?.play();
                    } catch {
                      // Browser autoplay restrictions may require a second click on controls.
                    }
                  }}
                >
                  <svg className="member-zoom-start-btn-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <polygon points="7,5 19,12 7,19" fill="currentColor" />
                  </svg>
                </button>
              )}
            </div>
            <div className="member-zoom-audio-wrap">
              <audio
                ref={zoomAudioRef}
                controls
                controlsList="nodownload noplaybackrate"
                className="audio-player"
                src={buildAudioStreamSrc(activeSermon)}
                onTimeUpdate={(e) => void handleAudioTimeUpdate(e.currentTarget)}
                onPause={(e) => touchAudioMaxListened(e.currentTarget)}
                onSeeked={(e) => onAudioSeekedClamp(e.currentTarget)}
                onEnded={(e) => {
                  const el = e.currentTarget;
                  const durationSeconds = mediaDurationForTracking(el);
                  const progressSeconds = durationSeconds ?? Math.floor(el.currentTime);
                  const engagedWatchSeconds = Math.floor(audioEngagedSecondsRef.current);
                  void api.post(`/tracking/sermons/${activeSermon.id}/progress`, {
                    progressSeconds,
                    completed: true,
                    engagedWatchSeconds,
                    ...(durationSeconds ? { durationSeconds } : {}),
                  });
                  if (durationSeconds != null) {
                    audioMaxListenedTimeRef.current = Math.max(audioMaxListenedTimeRef.current, durationSeconds);
                  } else {
                    audioMaxListenedTimeRef.current = Math.max(audioMaxListenedTimeRef.current, el.currentTime);
                  }
                }}
              />
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "videos" && zoomSessionVideo && isVideoZoomed && memberVideoSermonsEnabled) {
    return (
      <div className="member-audio-zoom-page member-video-zoom-page">
        <div className="member-video-zoom-shell">
          <div className="member-video-zoom-card">
            <header className="member-zoom-top-bar member-zoom-top-bar--video">
              <span className="member-zoom-exit-hint">Esc</span>
              <button type="button" className="member-zoom-exit-btn" onClick={closeVideoZoom}>
                Exit
              </button>
            </header>
            <div className="member-audio-zoom-inner">
              <div className="member-zoom-content">
                <div className="member-zoom-content-body member-video-zoom-body">
                  <h2 className="member-zoom-title member-zoom-title--video">{zoomSessionVideo.title?.trim() || "—"}</h2>
                  <div className="member-zoom-meta member-zoom-meta--video-spread" role="group" aria-label="Sermon details">
                    <span className="member-zoom-meta-scripture">{zoomSessionVideo.scripture}</span>
                    <span className="member-zoom-meta-preacher">{zoomSessionVideo.preacher.name}</span>
                    <span className="member-zoom-meta-date">
                      {zoomSessionVideo.createdDate
                        ? new Date(zoomSessionVideo.createdDate).toLocaleDateString(language === "fr" ? "fr-FR" : undefined)
                        : ""}
                    </span>
                  </div>
                  <div className="member-zoom-video-full">
                    <video
                      key={zoomSessionVideo.id}
                      ref={zoomVideoRef}
                      controls
                      controlsList="nodownload"
                      playsInline
                      preload="metadata"
                      className="member-zoom-video-player"
                      style={{ pointerEvents: isVideoZoomStarted ? "auto" : "none" }}
                      src={buildVideoStreamSrc(zoomSessionVideo)}
                      onWaiting={() => setVideoIsBuffering(true)}
                      onPlaying={() => setVideoIsBuffering(false)}
                      onCanPlay={() => setVideoIsBuffering(false)}
                      onTimeUpdate={(e) => {
                        if (!isVideoZoomStarted) return;
                        handleVideoTimeUpdate(e.currentTarget);
                      }}
                      onPause={(e) => touchVideoMaxListened(e.currentTarget)}
                      onSeeked={(e) => onVideoSeekedClamp(e.currentTarget)}
                      onEnded={handleVideoEnded}
                    />
                    {videoIsBuffering && isVideoZoomStarted ? (
                      <div className="member-zoom-video-buffer" role="status" aria-label="Loading video">
                        <span className="member-zoom-video-buffer-ring" aria-hidden />
                      </div>
                    ) : null}
                    {!isVideoZoomStarted && (
                      <div className="member-zoom-video-overlay" aria-hidden={false}>
                        <div className="member-zoom-video-overlay-inner">
                          <button
                            type="button"
                            className="member-zoom-start-btn member-zoom-start-btn--video"
                            aria-label="Start video"
                            onClick={async () => {
                              setIsVideoZoomStarted(true);
                              try {
                                await zoomVideoRef.current?.play();
                              } catch {
                                // Autoplay may require using the native controls.
                              }
                            }}
                          >
                            <svg className="member-zoom-start-btn-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                              <polygon points="7,5 19,12 7,19" fill="currentColor" />
                            </svg>
                          </button>
                          <p className="member-zoom-video-start-hint">Tap play</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="member-video-zoom-single-cover" aria-hidden="true">
                    <span className="member-video-zoom-cover-icon">
                      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page dashboard-form-theme">
      <div className="global-brand">
        <img className="global-brand-logo" src="/logo.jpeg" alt="Church logo" />
      </div>
      <section className={`dashboard-shell admin-modern-shell member-modern-shell ${isMenuOpen ? "" : "sidebar-collapsed"}`}>
        <aside className="admin-sidebar member-sidebar">
          <div className="admin-sidebar-brand">
            <h3>{t("member.portal")}</h3>
            <p>{t("member.library")}</p>
          </div>
          <nav className="admin-sidebar-nav">
            <button
              className={`admin-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("dashboard");
                setIsMenuOpen(false);
                void refreshSermonsForMessages();
              }}
            >
              <span className="admin-nav-dot" aria-hidden="true">
                ›
              </span>
              <span className="member-nav-text">{t("member.dashboard")}</span>
            </button>
            <button
              className={`admin-nav-item ${activeTab === "recentUpload" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("recentUpload");
                setIsMenuOpen(false);
                void refreshSermonsForMessages();
              }}
            >
              <span className="admin-nav-dot" aria-hidden="true">
                ›
              </span>
              <span className="member-nav-upload-row">
                <span className="member-nav-text">{t("member.recentUpload")}</span>
                {unseenRecentUploadCount > 0 ? (
                  <span className="member-upload-nav-badge" aria-label={`${unseenRecentUploadCount} new`}>
                    ({unseenRecentUploadCount})
                  </span>
                ) : null}
              </span>
            </button>
            <button
              className={`admin-nav-item ${activeTab === "sermons" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("sermons");
                setIsMenuOpen(false);
                void refreshSermonsForMessages();
              }}
            >
              <span className="admin-nav-dot" aria-hidden="true">
                ›
              </span>
              <span className="member-nav-text">{t("member.audioSermons")}</span>
            </button>
            {memberVideoSermonsEnabled ? (
              <button
                className={`admin-nav-item ${activeTab === "videos" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("videos");
                  setIsMenuOpen(false);
                  void loadVideoSermons(selectedVideoPreacherId || undefined);
                }}
              >
                <span className="admin-nav-dot" aria-hidden="true">
                  ›
                </span>
                <span className="member-nav-text">{t("member.videoSermons")}</span>
              </button>
            ) : null}
            <button
              className={`admin-nav-item ${activeTab === "documents" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("documents");
                setIsMenuOpen(false);
                void refreshSermonsForMessages();
              }}
            >
              <span className="admin-nav-dot" aria-hidden="true">
                ›
              </span>
              <span className="member-nav-text">{t("member.documents")}</span>
            </button>
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
              <button
                type="button"
                className="dashboard-left-menu-btn"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMenuOpen}
              >
                <span />
                <span />
                <span />
              </button>
              <div>
              <small className="muted">{tl("Stream-only secure access")}</small>
              <h2 className="member-page-h2">
                {activeTab === "dashboard" ? (
                  t("member.dashboard")
                ) : activeTab === "recentUpload" ? (
                  <span className="member-page-title-row">
                    <span>{t("member.recentUpload")}</span>
                    {unseenRecentUploadCount > 0 ? (
                      <span className="member-upload-title-badge" aria-label={`${unseenRecentUploadCount} new`}>
                        ({unseenRecentUploadCount})
                      </span>
                    ) : null}
                  </span>
                ) : activeTab === "sermons" ? (
                  t("member.audioSermons")
                ) : activeTab === "videos" ? (
                  t("member.videoSermons")
                ) : (
                  t("member.documents")
                )}
              </h2>
              </div>
            </div>
            <div className="admin-top-meta" style={{ flexWrap: "wrap", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
              {activeTab !== "videos" ? (
                <span>
                  {activeTab === "dashboard" ? tl("Library overview") : tl("In library (Audio Sermons)")}
                </span>
              ) : null}
              <strong>
                {activeTab === "videos" ? `${videoSermons.length} videos` : `${catalogSermons.length} uploads`}
              </strong>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void loadData(selectedPreacherId || undefined);
                  void refreshSermonsForMessages();
                  void loadMemberLibrarySettings();
                  void loadVideoSermons(selectedVideoPreacherId || undefined);
                }}
              >
                {t("member.refreshLibrary")}
              </button>
            </div>
          </header>

          {activeTab === "dashboard" && (
            <>
              <section className="analytics-top-cards mt-16">
                <article className="analytics-metric-card navy">
                  <h3>{tl("Total uploads")}</h3>
                  <strong>{catalogSermons.length}</strong>
                </article>
                <article className="analytics-metric-card">
                  <h3>{tl("Recent additions")}</h3>
                  <strong>{recentForDashboard.length}</strong>
                </article>
                <article className="analytics-metric-card">
                  <h3>{t("admin.preachers")}</h3>
                  <strong>{preachers.length}</strong>
                </article>
                <article className="analytics-metric-card">
                  <h3>{tl("With documents")}</h3>
                  <strong>{catalogSermons.filter((s) => s.hasDocument).length}</strong>
                </article>
              </section>

              <section className="analytics-layout mt-16">
                <div className="analytics-main-col">
                  <article className="card analytics-chart-card">
                    <div className="analytics-chart-head">
                      <h3>{tl("Listening overview")}</h3>
                    </div>
                    <div className="analytics-fake-bars" aria-hidden="true">
                      {dashboardBars.map((value, index) => (
                        <span
                          key={`${index}-${value}`}
                          style={{ height: `${Math.max(16, (value / maxDashboardBar) * 100)}%` }}
                        />
                      ))}
                    </div>
                  </article>
                </div>

                <aside className="analytics-side-col">
                  <article className="card analytics-progress-card">
                    <div className="progress-ring">
                      {`${Math.round((recentForDashboard.length / Math.max(catalogSermons.length, 1)) * 100)}%`}
                    </div>
                    <p className="muted">{tl("Recent activity")}</p>
                  </article>

                  <article className="card stat mt-16">
                    <span>{tl("Recent additions")}</span>
                    <strong>{recentForDashboard.length}</strong>
                  </article>
                  <article className="card stat mt-16">
                    <span>{tl("All uploads")}</span>
                    <strong>{catalogSermons.length}</strong>
                  </article>
                  <article className="card stat mt-16">
                    <span>{tl("Document folders")}</span>
                    <strong>{catalogSermons.filter((s) => s.hasDocument).length}</strong>
                  </article>
                </aside>
              </section>
            </>
          )}

          {activeTab === "recentUpload" && (
            <section className="card panel section-panel mt-16 member-sermon-board member-dashboard-recent-only">
              <h3 className="member-dashboard-recent-heading">Recent upload</h3>

              {unseenRecentUploadCount === 0 ? (
                <p className="muted member-upload-empty">{tl("No new sermon.")}</p>
              ) : (
                <>
                  <p className="muted member-dashboard-recent-sub">{tl("Tap a card to open and listen.")}</p>
                  <ul className="member-agnes-message-list">
                    {unseenRecentUploads.map((sermon) => (
                      <li key={sermon.id}>
                        <button
                          type="button"
                          className="member-audio-upload-card"
                          onClick={() => {
                            setIsMenuOpen(false);
                            void openUploadMessageAndListen(sermon.id);
                          }}
                        >
                          <div className="member-audio-upload-card-title-row member-audio-upload-card-title-row--center">
                            <span className="member-audio-upload-card-title member-audio-upload-card-title--hero">
                              {sermon.title?.trim() || "—"}
                            </span>
                          </div>
                          <div className="member-audio-upload-meta member-audio-upload-meta--spread" aria-label="Details">
                            <span className="member-audio-upload-meta-line member-audio-upload-meta-scripture">
                              {sermon.scripture || "—"}
                            </span>
                            <span className="member-audio-upload-meta-line member-audio-upload-meta-preacher">
                              {sermon.preacher.name}
                            </span>
                            <span className="member-audio-upload-meta-line member-audio-upload-meta-date">
                              {sermon.createdDate
                                ? new Date(sermon.createdDate).toLocaleDateString(undefined, { dateStyle: "medium" })
                                : "—"}
                            </span>
                          </div>
                          <span className="member-audio-upload-play-bar member-audio-upload-play-bar--compact member-audio-upload-play-bar--below">
                            Audio - English Version
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {activeTab === "sermons" && (
            <>
              <div className="card section-panel mt-16">
                <div className="row between" style={{ alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ minWidth: "220px", flex: "1 1 320px" }}>
                    <small className="muted">{tl("Filter by Preacher")}</small>
                    <select
                      value={selectedPreacherId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedPreacherId(value);
                        loadData(value || undefined);
                      }}
                    >
                      <option value="">{tl("All preachers")}</option>
                      {preachers.map((preacher) => (
                        <option key={preacher.id} value={preacher.id}>
                          {preacher.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <small className="muted">{tl("Content Access")}</small>
                    <strong style={{ display: "block" }}>{sermons.length} sermon(s)</strong>
                  </div>
                </div>
              </div>

              <div className="card panel section-panel mt-16 member-sermon-board">
                <h3>Audio sermons</h3>
                {sermons.length === 0 ? (
                  <p className="muted">{tl("No sermons found for this filter.")}</p>
                ) : activeSermon ? (
                  <div className="member-listening-fullscreen mt-16">
                    <div className="member-audio-upload-card-title-row member-audio-upload-card-title-row--center">
                      <strong className="member-audio-upload-card-title member-audio-upload-card-title--hero">
                        {activeSermon.title?.trim() || "—"}
                      </strong>
                    </div>
                    <div className="row between">
                      <div>
                        <div className="member-sermon-meta mt-16">
                          <span>{activeSermon.scripture}</span>
                          <span>{activeSermon.preacher.name}</span>
                          <span>{activeSermon.createdDate ? new Date(activeSermon.createdDate).toLocaleDateString() : ""}</span>
                        </div>
                      </div>
                      <div className="row">
                        <button className="btn" onClick={() => setIsListeningZoomed(true)}>
                          {tl("Zoom")}
                        </button>
                        <button className="btn" onClick={() => setActiveSermonId(null)}>
                          {tl("Back to Sermon List")}
                        </button>
                      </div>
                    </div>

                    <div className="mt-16 member-now-playing">
                      <div className="member-now-playing-head">
                        <span className="member-now-playing-badge">{tl("Now Playing")}</span>
                        <small className="muted">{activeSermon.preacher.name}</small>
                      </div>
                      <div className="member-audio-wrap">
                        <audio
                          controls
                          controlsList="nodownload noplaybackrate"
                          autoPlay
                          className="audio-player"
                          src={buildAudioStreamSrc(activeSermon)}
                          onTimeUpdate={(e) => void handleAudioTimeUpdate(e.currentTarget)}
                          onPause={(e) => touchAudioMaxListened(e.currentTarget)}
                          onSeeked={(e) => onAudioSeekedClamp(e.currentTarget)}
                          onEnded={(e) => {
                            const el = e.currentTarget;
                            const durationSeconds = mediaDurationForTracking(el);
                            const progressSeconds = durationSeconds ?? Math.floor(el.currentTime);
                            const engagedWatchSeconds = Math.floor(audioEngagedSecondsRef.current);
                            void api.post(`/tracking/sermons/${activeSermon.id}/progress`, {
                              progressSeconds,
                              completed: true,
                              engagedWatchSeconds,
                              ...(durationSeconds ? { durationSeconds } : {}),
                            });
                            if (durationSeconds != null) {
                              audioMaxListenedTimeRef.current = Math.max(audioMaxListenedTimeRef.current, durationSeconds);
                            } else {
                              audioMaxListenedTimeRef.current = Math.max(audioMaxListenedTimeRef.current, el.currentTime);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  sermons.map((sermon) => (
                    <div className="member-audio-sermon-card list-item member-sermon-item" key={sermon.id}>
                      <div className="member-audio-upload-card-title-row member-audio-upload-card-title-row--center">
                        <strong className="member-audio-upload-card-title member-audio-upload-card-title--hero">
                          {sermon.title?.trim() || "—"}
                        </strong>
                      </div>
                      <div className="member-audio-upload-meta member-audio-upload-meta--spread" aria-label="Details">
                        <span className="member-audio-upload-meta-line member-audio-upload-meta-scripture">
                          {sermon.scripture || "—"}
                        </span>
                        <span className="member-audio-upload-meta-line member-audio-upload-meta-preacher">
                          {sermon.preacher.name}
                        </span>
                        <span className="member-audio-upload-meta-line member-audio-upload-meta-date">
                              {sermon.createdDate
                                ? new Date(sermon.createdDate).toLocaleDateString(language === "fr" ? "fr-FR" : undefined, {
                                    dateStyle: "medium",
                                  })
                                : "—"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="member-audio-upload-play-bar member-audio-upload-play-bar--compact member-audio-upload-play-bar--below"
                        onClick={() => void streamSermon(sermon.id)}
                      >
                        Audio - English Version
                      </button>
                      {activeSermonId === sermon.id && (
                        <div className="mt-16 member-now-playing">
                          <div className="member-now-playing-head">
                        <span className="member-now-playing-badge">{tl("Now Playing")}</span>
                            <small className="muted">{sermon.preacher.name}</small>
                          </div>
                          <div className="member-audio-wrap">
                            <audio
                              controls
                              controlsList="nodownload noplaybackrate"
                              autoPlay
                              className="audio-player"
                              src={buildAudioStreamSrc(sermon)}
                              onTimeUpdate={(e) => void handleAudioTimeUpdate(e.currentTarget)}
                              onPause={(e) => touchAudioMaxListened(e.currentTarget)}
                              onSeeked={(e) => onAudioSeekedClamp(e.currentTarget)}
                              onEnded={(e) => {
                                const el = e.currentTarget;
                                const durationSeconds = mediaDurationForTracking(el);
                                const progressSeconds = durationSeconds ?? Math.floor(el.currentTime);
                                const engagedWatchSeconds = Math.floor(audioEngagedSecondsRef.current);
                                void api.post(`/tracking/sermons/${sermon.id}/progress`, {
                                  progressSeconds,
                                  completed: true,
                                  engagedWatchSeconds,
                                  ...(durationSeconds ? { durationSeconds } : {}),
                                });
                                if (durationSeconds != null) {
                                  audioMaxListenedTimeRef.current = Math.max(audioMaxListenedTimeRef.current, durationSeconds);
                                } else {
                                  audioMaxListenedTimeRef.current = Math.max(audioMaxListenedTimeRef.current, el.currentTime);
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === "videos" && memberVideoSermonsEnabled && (
            <>
              <div className="card section-panel mt-16 member-video-filter-card">
                <select
                  className="member-video-preacher-select"
                  value={selectedVideoPreacherId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedVideoPreacherId(value);
                    void loadVideoSermons(value || undefined);
                  }}
                  aria-label="Preacher"
                >
                  <option value="">{tl("All preachers")}</option>
                  {preachers.map((preacher) => (
                    <option key={preacher.id} value={String(preacher.id)}>
                      {preacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="card panel section-panel mt-16 member-sermon-board">
                <h3 className="member-video-list-heading">{t("member.videoSermons")}</h3>
              {videoSermons.length === 0 ? (
                <p className="muted">{selectedVideoPreacherId ? tl("No videos for this preacher.") : tl("No videos yet.")}</p>
              ) : (
                videoSermons.map((video) => (
                  <div className="member-audio-sermon-card list-item member-sermon-item" key={video.id}>
                    <div className="member-audio-upload-card-title-row member-audio-upload-card-title-row--center">
                      <strong className="member-audio-upload-card-title member-audio-upload-card-title--hero">
                        {video.title?.trim() || "—"}
                      </strong>
                    </div>
                    <div className="member-audio-upload-meta member-audio-upload-meta--spread" aria-label="Details">
                      <span className="member-audio-upload-meta-line member-audio-upload-meta-scripture">
                        {video.scripture || "—"}
                      </span>
                      <span className="member-audio-upload-meta-line member-audio-upload-meta-preacher">
                        {video.preacher.name}
                      </span>
                      <span className="member-audio-upload-meta-line member-audio-upload-meta-date">
                        {video.createdDate
                          ? new Date(video.createdDate).toLocaleDateString(language === "fr" ? "fr-FR" : undefined, {
                              dateStyle: "medium",
                            })
                          : "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="member-audio-upload-play-bar member-audio-upload-play-bar--compact member-audio-upload-play-bar--below"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setZoomSessionVideo(video);
                        setIsVideoZoomed(true);
                        setIsVideoZoomStarted(false);
                        setVideoIsBuffering(false);
                      }}
                    >
                      {tl("Watch video")}
                    </button>
                  </div>
                ))
              )}
              </div>
            </>
          )}

          {activeTab === "documents" && (
            <>
              <div className="card panel section-panel mt-16 member-sermon-board">
                <div className="row between">
                  <h3>{tl("Document Library")}</h3>
                  <small className="muted">
                    {Array.from(new Set(allDocumentFiles.map((doc) => doc.folderName))).length} folder(s)
                  </small>
                </div>
                {allDocumentFiles.length === 0 ? (
                  <p className="muted">{tl("No documents uploaded yet.")}</p>
                ) : (
                  <div className="mt-16">
                    <div className="row">
                      {Array.from(new Set(allDocumentFiles.map((doc) => doc.folderName)))
                        .sort((a, b) => a.localeCompare(b))
                        .map((folder) => (
                          <button
                            key={folder}
                            className={`btn ${docsTabFolder === folder ? "primary" : ""}`}
                            onClick={() => setDocsTabFolder(folder)}
                          >
                            {folder}
                          </button>
                        ))}
                    </div>
                    {docsTabFolder && (
                      <div className="member-sheet mt-16">
                        <div className="member-sheet-row member-sheet-head">
                          <span>No.</span>
                          <span>Document Name</span>
                          <span>Action</span>
                        </div>
                        {allDocumentFiles
                          .filter((doc) => doc.folderName === docsTabFolder)
                          .map((doc, index) => (
                            <div className="member-sheet-row" key={doc.id}>
                              <span>{index + 1}</span>
                              <span style={{ color: "#000", fontWeight: 600 }}>{doc.originalName}</span>
                              <button className="btn" onClick={() => viewDocument(doc.sermonId, doc.id)}>
                                {tl("Open")}
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </section>
    </div>
  );
}
