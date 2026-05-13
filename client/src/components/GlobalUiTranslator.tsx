import { useEffect } from "react";
import { useI18n } from "../context/useI18n";

const EN_TO_FR: Record<string, string> = {
  Dashboard: "Tableau de bord",
  "Member Requests": "Demandes membres",
  Preachers: "Predicateurs",
  "Audio Sermons": "Sermons audio",
  "Video Sermons": "Sermons video",
  Documents: "Documents",
  Report: "Rapport",
  "Recent upload": "Ajouts recents",
  "Audio sermons": "Sermons audio",
  "Video sermons": "Sermons video",
  Videos: "Videos",
  Logout: "Deconnexion",
  "Refresh library": "Actualiser la bibliotheque",
  "All preachers": "Tous les predicateurs",
  "All countries": "Tous les pays",
  "No videos yet.": "Aucune video pour le moment.",
  "No videos for this preacher.": "Aucune video pour ce predicateur.",
  "No sermons yet.": "Aucun sermon pour le moment.",
  "No new sermon.": "Aucun nouveau sermon.",
  "Document Library": "Bibliotheque de documents",
  Open: "Ouvrir",
  Zoom: "Agrandir",
  "Now Playing": "Lecture en cours",
  "Back to Sermon List": "Retour a la liste des sermons",
  "Watch video": "Regarder la video",
  "Total uploads": "Total des publications",
  "Recent additions": "Ajouts recents",
  "With documents": "Avec documents",
  "Listening overview": "Vue d'ensemble de l'ecoute",
  "Recent activity": "Activite recente",
  "All uploads": "Toutes les publications",
  "Document folders": "Dossiers de documents",
  "Folder name": "Nom du dossier",
  "Add Folder": "Ajouter un dossier",
  "Login failed": "Echec de connexion",
  "Registration failed": "Echec de l'inscription",
  "Registered.": "Inscription reussie.",
  "Send Reset Code": "Envoyer le code",
  "Reset Password": "Reinitialiser le mot de passe",
  "Start Over": "Recommencer",
  "Go to Login": "Aller a la connexion",
  Login: "Connexion",
  Register: "Inscription",
  Language: "Langue",
};

const FR_TO_EN: Record<string, string> = Object.fromEntries(Object.entries(EN_TO_FR).map(([en, fr]) => [fr, en]));

function replaceText(text: string, toFr: boolean): string {
  const exact = toFr ? EN_TO_FR[text] : FR_TO_EN[text];
  if (exact) return exact;
  if (toFr) {
    return text
      .replace(/(\d+)\s+videos\b/g, "$1 videos")
      .replace(/(\d+)\s+uploads\b/g, "$1 publications")
      .replace(/\bWait\s+(\d+)s\b/g, "Attendre $1s");
  }
  return text.replace(/(\d+)\s+publications\b/g, "$1 uploads").replace(/\bAttendre\s+(\d+)s\b/g, "Wait $1s");
}

function translateDom(toFr: boolean) {
  const root = document.body;
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (!n.nodeValue) continue;
    if (!n.nodeValue.trim()) continue;
    textNodes.push(n);
  }

  for (const n of textNodes) {
    const raw = n.nodeValue ?? "";
    const next = replaceText(raw, toFr);
    if (next !== raw) n.nodeValue = next;
  }

  const elements = Array.from(root.querySelectorAll("input,button,select,option,textarea,[placeholder],[title],[aria-label]"));
  for (const el of elements) {
    for (const attr of ["placeholder", "title", "aria-label"] as const) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      const next = replaceText(v, toFr);
      if (next !== v) el.setAttribute(attr, next);
    }
    if (el instanceof HTMLInputElement && typeof el.value === "string" && el.value.trim()) {
      const next = replaceText(el.value, toFr);
      if (next !== el.value) el.value = next;
    }
  }
}

export default function GlobalUiTranslator() {
  const { language } = useI18n();

  useEffect(() => {
    const toFr = language === "fr";
    translateDom(toFr);
    const observer = new MutationObserver(() => translateDom(toFr));
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "value"],
    });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
