import { createContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type LanguageCode = string;

type I18nContextType = {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  tl: (text: string) => string;
  languageOptions: { code: LanguageCode; label: string }[];
};

const I18N_STORAGE_KEY = "ui_language";

const languageOptions = [
  { code: "en", label: "English" },
] as const;

const literalTranslationsFr: Record<string, string> = {
  "Stream-only secure access": "Acces securise en lecture seule",
  "Library overview": "Vue d'ensemble de la bibliotheque",
  "In library (Audio Sermons)": "Dans la bibliotheque (Sermons audio)",
  "Total uploads": "Total des publications",
  "Recent additions": "Ajouts recents",
  "With documents": "Avec documents",
  "Listening overview": "Vue d'ensemble de l'ecoute",
  "Recent activity": "Activite recente",
  "All uploads": "Toutes les publications",
  "Document folders": "Dossiers de documents",
  "No new sermon.": "Aucun nouveau sermon.",
  "Tap a card to open and listen.": "Touchez une carte pour ouvrir et ecouter.",
  "Filter by Preacher": "Filtrer par predicateur",
  "All preachers": "Tous les predicateurs",
  "Content Access": "Acces au contenu",
  "No sermons found for this filter.": "Aucun sermon trouve pour ce filtre.",
  "Zoom": "Agrandir",
  "Back to Sermon List": "Retour a la liste des sermons",
  "Now Playing": "Lecture en cours",
  "Watch video": "Regarder la video",
  "Document Library": "Bibliotheque de documents",
  "No documents uploaded yet.": "Aucun document televerse pour le moment.",
  "Open": "Ouvrir",
  "No videos yet.": "Aucune video pour le moment.",
  "No videos for this preacher.": "Aucune video pour ce predicateur.",
  "All countries": "Tous les pays",
  "Could not load sermons. Is the API running? Are you still logged in?":
    "Impossible de charger les sermons. Verifiez que l'API fonctionne et que vous etes connecte.",
  "Could not load sermons.": "Impossible de charger les sermons.",
  "No sermons yet.": "Aucun sermon pour le moment.",
  "Preparing documents workspace…": "Preparation de l'espace documents…",
  "Folder name": "Nom du dossier",
  "Add Folder": "Ajouter un dossier",
  "System Admin": "Administrateur systeme",
  "Administration Workspace": "Espace d'administration",
  "Online Audio Sermon Management": "Gestion des sermons audio en ligne",
  "Welcome back": "Bon retour",
  "Manage church content cleanly": "Gerez le contenu de l'eglise proprement",
  Members: "Membres",
  Approved: "Approuves",
  Sermons: "Sermons",
  Completed: "Termines",
  Folders: "Dossiers",
  documents: "documents",
  Uploading: "Televersement",
  "Upload to": "Televerser vers",
  Action: "Action",
  Delete: "Supprimer",
  Admin: "Admin",
  "Documents Management": "Gestion des documents",
};

type TranslationKey =
  | "common.login"
  | "common.register"
  | "common.logout"
  | "common.emailAddress"
  | "common.password"
  | "common.phoneNumber"
  | "common.fullName"
  | "common.forgotPassword"
  | "common.language"
  | "home.title"
  | "home.subtitle"
  | "home.tagline"
  | "home.pill.streaming"
  | "home.pill.protected"
  | "home.pill.ministry"
  | "login.failed"
  | "login.noAccount"
  | "login.registerHere"
  | "register.success"
  | "register.failed"
  | "register.alreadyRegistered"
  | "register.goToLogin"
  | "forgot.title"
  | "forgot.subtitle"
  | "forgot.sendCode"
  | "forgot.wait"
  | "forgot.resetPassword"
  | "forgot.resetSuccess"
  | "forgot.goToLogin"
  | "forgot.startOver"
  | "forgot.backToLogin"
  | "member.portal"
  | "member.library"
  | "member.dashboard"
  | "member.recentUpload"
  | "member.audioSermons"
  | "member.videoSermons"
  | "member.documents"
  | "member.refreshLibrary"
  | "admin.dashboard"
  | "admin.memberRequests"
  | "admin.preachers"
  | "admin.audioSermons"
  | "admin.videoSermons"
  | "admin.documents"
  | "admin.report";

const baseTranslations: Record<TranslationKey, string> = {
    "common.login": "Login",
    "common.register": "Register",
    "common.logout": "Logout",
    "common.emailAddress": "Email address",
    "common.password": "Password",
    "common.phoneNumber": "Phone number",
    "common.fullName": "Full name",
    "common.forgotPassword": "Forgot password?",
    "common.language": "Language",
    "home.title": "Listen to the Word of God",
    "home.subtitle": "Secure. Simple. Online access.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Streaming",
    "home.pill.protected": "Protected",
    "home.pill.ministry": "Ministry",
    "login.failed": "Login failed",
    "login.noAccount": "No account?",
    "login.registerHere": "Register here",
    "register.success": "Registered.",
    "register.failed": "Registration failed",
    "register.alreadyRegistered": "Already registered?",
    "register.goToLogin": "Go to login",
    "forgot.title": "Forgot Password",
    "forgot.subtitle": "Enter your email to receive a 6-digit reset code.",
    "forgot.sendCode": "Send Reset Code",
    "forgot.wait": "Wait",
    "forgot.resetPassword": "Reset Password",
    "forgot.resetSuccess": "Your password was updated. Sign in with your new password.",
    "forgot.goToLogin": "Go to Login",
    "forgot.startOver": "Start Over",
    "forgot.backToLogin": "Back to",
    "member.portal": "Member Portal",
    "member.library": "Media Library",
    "member.dashboard": "Dashboard",
    "member.recentUpload": "Recent upload",
    "member.audioSermons": "Audio sermons",
    "member.videoSermons": "Video sermons",
    "member.documents": "Documents",
    "member.refreshLibrary": "Refresh library",
    "admin.dashboard": "Dashboard",
    "admin.memberRequests": "Member Requests",
    "admin.preachers": "Preachers",
    "admin.audioSermons": "Audio Sermons",
    "admin.videoSermons": "Video Sermons",
    "admin.documents": "Documents",
    "admin.report": "Report",
};

const translations: Record<string, Partial<Record<TranslationKey, string>>> = {
  fr: {
    "common.login": "Connexion",
    "common.register": "Inscription",
    "common.logout": "Deconnexion",
    "common.emailAddress": "Adresse email",
    "common.password": "Mot de passe",
    "common.phoneNumber": "Numero de telephone",
    "common.fullName": "Nom complet",
    "common.forgotPassword": "Mot de passe oublie ?",
    "common.language": "Langue",
    "home.title": "Ecoutez la Parole de Dieu",
    "home.subtitle": "Securise. Simple. Acces en ligne.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Streaming",
    "home.pill.protected": "Protege",
    "home.pill.ministry": "Ministere",
    "login.failed": "Echec de connexion",
    "login.noAccount": "Pas de compte ?",
    "login.registerHere": "Inscrivez-vous ici",
    "register.success": "Inscription reussie.",
    "register.failed": "Echec de l'inscription",
    "register.alreadyRegistered": "Deja inscrit ?",
    "register.goToLogin": "Aller a la connexion",
    "forgot.title": "Mot de passe oublie",
    "forgot.subtitle": "Entrez votre email pour recevoir un code a 6 chiffres.",
    "forgot.sendCode": "Envoyer le code",
    "forgot.wait": "Attendre",
    "forgot.resetPassword": "Reinitialiser le mot de passe",
    "forgot.resetSuccess": "Votre mot de passe est mis a jour. Connectez-vous avec le nouveau mot de passe.",
    "forgot.goToLogin": "Aller a la connexion",
    "forgot.startOver": "Recommencer",
    "forgot.backToLogin": "Retour a",
    "member.portal": "Portail membre",
    "member.library": "Bibliotheque de sermons audio",
    "member.dashboard": "Tableau de bord",
    "member.recentUpload": "Ajouts recents",
    "member.audioSermons": "Sermons audio",
    "member.videoSermons": "Sermons video",
    "member.documents": "Documents",
    "member.refreshLibrary": "Actualiser la bibliotheque",
    "admin.dashboard": "Tableau de bord",
    "admin.memberRequests": "Demandes membres",
    "admin.preachers": "Predicateurs",
    "admin.audioSermons": "Sermons audio",
    "admin.videoSermons": "Sermons video",
    "admin.documents": "Documents",
    "admin.report": "Rapport",
  },
  sw: {
    "common.login": "Ingia",
    "common.register": "Jisajili",
    "common.logout": "Toka",
    "common.emailAddress": "Barua pepe",
    "common.password": "Nenosiri",
    "common.phoneNumber": "Namba ya simu",
    "common.fullName": "Jina kamili",
    "common.forgotPassword": "Umesahau nenosiri?",
    "common.language": "Lugha",
    "home.title": "Sikiliza Neno la Mungu",
    "home.subtitle": "Salama. Rahisi. Upatikanaji mtandaoni.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Mtiririko",
    "home.pill.protected": "Imelindwa",
    "home.pill.ministry": "Huduma",
    "login.failed": "Kuingia kumeshindikana",
    "login.noAccount": "Huna akaunti?",
    "login.registerHere": "Jisajili hapa",
    "register.success": "Umesajiliwa.",
    "register.failed": "Usajili umeshindikana",
    "register.alreadyRegistered": "Umesajiliwa tayari?",
    "register.goToLogin": "Nenda kuingia",
    "forgot.title": "Umesahau nenosiri",
    "forgot.subtitle": "Weka barua pepe yako upokee msimbo wa tarakimu 6.",
    "forgot.sendCode": "Tuma msimbo",
    "forgot.wait": "Subiri",
    "forgot.resetPassword": "Badili nenosiri",
    "forgot.resetSuccess": "Nenosiri limebadilishwa. Ingia tena na nenosiri jipya.",
    "forgot.goToLogin": "Nenda kuingia",
    "forgot.startOver": "Anza upya",
    "forgot.backToLogin": "Rudi kwenye",
    "member.portal": "Lango la washiriki",
    "member.library": "Maktaba ya mahubiri ya sauti",
    "member.dashboard": "Dashibodi",
    "member.recentUpload": "Vilivyopakiwa karibuni",
    "member.audioSermons": "Mahubiri ya sauti",
    "member.videoSermons": "Mahubiri ya video",
    "member.documents": "Nyaraka",
    "member.refreshLibrary": "Sasisha maktaba",
    "admin.dashboard": "Dashibodi",
    "admin.memberRequests": "Maombi ya wanachama",
    "admin.preachers": "Wahubiri",
    "admin.audioSermons": "Mahubiri ya sauti",
    "admin.videoSermons": "Mahubiri ya video",
    "admin.documents": "Nyaraka",
    "admin.report": "Ripoti",
  },
  lg: {
    "common.login": "Yingira",
    "common.register": "Wewandiise",
    "common.logout": "Fuluma",
    "common.emailAddress": "Email",
    "common.password": "Ekigambo kyekyama",
    "common.phoneNumber": "Namba y'essimu",
    "common.fullName": "Erinnya lyo lyonna",
    "common.forgotPassword": "Werabidde ekigambo kyekyama?",
    "common.language": "Olulimi",
    "home.title": "Wuliriza Ekigambo kya Katonda",
    "home.subtitle": "Kyekusigika. Kyangu. Kuli ku mutimbagano.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Okutambuza",
    "home.pill.protected": "Kikuumiddwa",
    "home.pill.ministry": "Obuweereza",
    "login.failed": "Okuyingira kulemye",
    "login.noAccount": "Tolina akawunti?",
    "login.registerHere": "Wewandiise wano",
    "register.success": "Owewandiisiddwa.",
    "register.failed": "Okwewandiisa kulemye",
    "register.alreadyRegistered": "Wewandiisizza dda?",
    "register.goToLogin": "Genda ku yingira",
    "forgot.title": "Werabidde ekigambo kyekyama",
    "forgot.subtitle": "Teeka email yo ofune code ey'obubonero 6.",
    "forgot.sendCode": "Sindika code",
    "forgot.wait": "Linda",
    "forgot.resetPassword": "Kyusa ekigambo kyekyama",
    "forgot.resetSuccess": "Ekigambo kyekyama kikyusiddwa. Yingira n'ekigambo ekipya.",
    "forgot.goToLogin": "Genda ku yingira",
    "forgot.startOver": "Tandika buto",
    "forgot.backToLogin": "Ddayo ku",
    "member.portal": "Omulyango gw'abakkiriza",
    "member.library": "Etterekero ly'enshomesa z'amaloboozi",
    "member.dashboard": "Dashboard",
    "member.recentUpload": "Ebizzeeyo gyebuvuddeko",
    "member.audioSermons": "Enshomesa z'amaloboozi",
    "member.videoSermons": "Enshomesa za vidiyo",
    "member.documents": "Ebiwandiiko",
    "member.refreshLibrary": "Ddamu okutereeza etterekero",
    "admin.dashboard": "Dashboard",
    "admin.memberRequests": "Okusaba kw'abamemba",
    "admin.preachers": "Ababuulizi",
    "admin.audioSermons": "Enshomesa z'amaloboozi",
    "admin.videoSermons": "Enshomesa za vidiyo",
    "admin.documents": "Ebiwandiiko",
    "admin.report": "Lipoota",
  },
  ha: {
    "common.login": "Shiga",
    "common.register": "Yi rajista",
    "common.logout": "Fita",
    "common.emailAddress": "Imel",
    "common.password": "Kalmar sirri",
    "common.phoneNumber": "Lambar waya",
    "common.fullName": "Cikakken suna",
    "common.forgotPassword": "Ka manta kalmar sirri?",
    "common.language": "Harshe",
    "home.title": "Saurari Maganar Allah",
    "home.subtitle": "Tsaro. Sauki. Samun dama ta yanar gizo.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Yawo",
    "home.pill.protected": "Kariya",
    "home.pill.ministry": "Hidima",
    "login.failed": "Shiga ya kasa",
    "login.noAccount": "Baka da asusu?",
    "login.registerHere": "Yi rajista anan",
    "register.success": "An yi rajista.",
    "register.failed": "Rajista ya kasa",
    "register.alreadyRegistered": "An riga an yi rajista?",
    "register.goToLogin": "Je shiga",
    "forgot.title": "An manta kalmar sirri",
    "forgot.subtitle": "Shigar da imel dinka domin samun lambar gyara mai lambobi 6.",
    "forgot.sendCode": "Aika lambar gyara",
    "forgot.wait": "Jira",
    "forgot.resetPassword": "Sake saita kalmar sirri",
    "forgot.resetSuccess": "An sabunta kalmar sirri. Shiga da sabuwar kalmar.",
    "forgot.goToLogin": "Je shiga",
    "forgot.startOver": "Fara daga farko",
    "forgot.backToLogin": "Koma zuwa",
  },
  yo: {
    "common.login": "Wo le",
    "common.register": "Foruko sile",
    "common.logout": "Jade",
    "common.emailAddress": "Imeri",
    "common.password": "Oroigbaniwole",
    "common.phoneNumber": "Nomba foonu",
    "common.fullName": "Oruko kikun",
    "common.forgotPassword": "O gbagbe oroigbaniwole?",
    "common.language": "Ede",
    "home.title": "Gbo Oro Olorun",
    "home.subtitle": "Aabo. Rorun. Wiwo lori ayelujara.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Sisan",
    "home.pill.protected": "Aabo",
    "home.pill.ministry": "Ise-iranse",
    "login.failed": "Wiwole kuna",
    "login.noAccount": "O ko ni akanti?",
    "login.registerHere": "Foruko sile nibi",
    "register.success": "A ti foruko sile.",
    "register.failed": "Iforukosile kuna",
    "register.alreadyRegistered": "Se o ti foruko sile tele?",
    "register.goToLogin": "Lo si wiwole",
    "forgot.title": "Gbagbe oroigbaniwole",
    "forgot.subtitle": "Te imeeli re lati gba kodu atunto oni-nomba 6.",
    "forgot.sendCode": "Fi kodu ranse",
    "forgot.wait": "Duro",
    "forgot.resetPassword": "Tun oroigbaniwole se",
    "forgot.resetSuccess": "A ti tun oroigbaniwole se. Wo le pelu oroigbaniwole tuntun.",
    "forgot.goToLogin": "Lo si wiwole",
    "forgot.startOver": "Bere lati ibere",
    "forgot.backToLogin": "Pada si",
  },
  zu: {
    "common.login": "Ngena",
    "common.register": "Bhalisa",
    "common.logout": "Phuma",
    "common.emailAddress": "Ikheli le-imeyili",
    "common.password": "Iphasiwedi",
    "common.phoneNumber": "Inombolo yocingo",
    "common.fullName": "Igama eligcwele",
    "common.forgotPassword": "Ukhohlwe iphasiwedi?",
    "common.language": "Ulimi",
    "home.title": "Lalela iZwi likaNkulunkulu",
    "home.subtitle": "Kuphephile. Kulula. Ukufinyelela ku-inthanethi.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Ukusakaza",
    "home.pill.protected": "Kuvikelekile",
    "home.pill.ministry": "Umsebenzi",
    "login.failed": "Ukungena kwehlulekile",
    "login.noAccount": "Awunayo i-akhawunti?",
    "login.registerHere": "Bhalisa lapha",
    "register.success": "Ubhalisiwe.",
    "register.failed": "Ukubhalisa kwehlulekile",
    "register.alreadyRegistered": "Usuvele ubhalisile?",
    "register.goToLogin": "Iya ekungeneni",
    "forgot.title": "Ukhohlwe iphasiwedi",
    "forgot.subtitle": "Faka i-imeyili yakho ukuze uthole ikhodi yokusetha kabusha enezinombolo ezi-6.",
    "forgot.sendCode": "Thumela ikhodi",
    "forgot.wait": "Linda",
    "forgot.resetPassword": "Setha kabusha iphasiwedi",
    "forgot.resetSuccess": "Iphasiwedi ibuyekeziwe. Ngena ngephasiwedi entsha.",
    "forgot.goToLogin": "Iya ekungeneni",
    "forgot.startOver": "Qala futhi",
    "forgot.backToLogin": "Buyela ku",
  },
  so: {
    "common.login": "Soo gal",
    "common.register": "Diiwaangeli",
    "common.logout": "Ka bax",
    "common.emailAddress": "Iimayl",
    "common.password": "Fure sir ah",
    "common.phoneNumber": "Lambarka taleefanka",
    "common.fullName": "Magaca oo dhan",
    "common.forgotPassword": "Ma ilowday fure sirta?",
    "common.language": "Luqad",
    "home.title": "Dhagayso Erayga Ilaah",
    "home.subtitle": "Aamin. Fudud. Gelitaan onlayn ah.",
    "home.tagline": "SERMON HUB",
    "home.pill.streaming": "Daawasho toos ah",
    "home.pill.protected": "La ilaaliyay",
    "home.pill.ministry": "Adeeg",
    "login.failed": "Soo galiddu way fashilantay",
    "login.noAccount": "Akoon ma lihid?",
    "login.registerHere": "Halkan iska diiwaangeli",
    "register.success": "Waa la diiwaangeliyey.",
    "register.failed": "Diiwaangelintu way fashilantay",
    "register.alreadyRegistered": "Hore ma isu diiwaangelisay?",
    "register.goToLogin": "Tag bogga soo galida",
    "forgot.title": "Fure sir ah oo la ilaaway",
    "forgot.subtitle": "Geli iimaylkaaga si aad u hesho koodh 6-lambar ah.",
    "forgot.sendCode": "Dir koodhka",
    "forgot.wait": "Sug",
    "forgot.resetPassword": "Dib u deji fure sirta",
    "forgot.resetSuccess": "Fure sirta waa la cusboonaysiiyey. Ku soo gal kan cusub.",
    "forgot.goToLogin": "Tag bogga soo galida",
    "forgot.startOver": "Bilow mar kale",
    "forgot.backToLogin": "Ku noqo",
  },
};

export const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => undefined,
  t: (key) => key,
  tl: (text) => text,
  languageOptions: languageOptions.map((opt) => ({ code: opt.code, label: opt.label })),
});

function safeInitialLanguage(): LanguageCode {
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(safeInitialLanguage);

  const setLanguage = (_lang: LanguageCode) => {
    setLanguageState("en");
    if (typeof window !== "undefined") {
      localStorage.setItem(I18N_STORAGE_KEY, "en");
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translations[language]?.[key] ?? baseTranslations[key] ?? key,
      tl: (text: string) => (language === "fr" ? literalTranslationsFr[text] ?? text : text),
      languageOptions: languageOptions.map((opt) => ({ code: opt.code, label: opt.label })),
    }),
    [language],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language === "fr" ? "fr" : "en";
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
