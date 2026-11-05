// Sélection vidéo du coach : séances complètes et gratuites sur YouTube, rangées par thème (tags).
// Chaîne principale : Les Mills (studio, coachs et musique au niveau d'Apple Forme).
// Compléments pour les thèmes que Les Mills ne couvre pas : Heather Robertson (haut / bas du corps,
// haltères ou sans matériel, mobilité) et Yoga With Adriene (yoga, retour au calme par sport).
// Vérifié le 05/11/2026 (titre + chaîne via oEmbed YouTube). Pour ajouter une vidéo : son id YouTube,
// un titre court, le type de séance, la durée réelle et des tags pris dans THEME_TAGS.

export const CHANNELS = {
  lesmills: { name: "Les Mills", url: "https://www.youtube.com/@lesmills" },
  heather: { name: "Heather Robertson", url: "https://www.youtube.com/@HeatherRobertsonCom" },
  adriene: { name: "Yoga With Adriene", url: "https://www.youtube.com/@yogawithadriene" },
} as const;
export type Channel = keyof typeof CHANNELS;

/** Vocabulaire des tags (thèmes, matériel, niveau). */
export const THEME_TAGS = [
  "full body", "haut du corps", "jambes", "fessiers", "dos", "abdos",
  "hiit", "cardio", "boxe", "vélo", "course", "natation", "marche",
  "yoga", "pilates", "mobilité", "étirements", "récup", "échauffement",
  "sans matériel", "haltères", "barre", "faible impact", "débutant", "avancé",
] as const;

export type CatalogVideo = {
  yt: string;
  title: string;
  channel: Channel;
  type: string;
  durationMin: number;
  tags: string[];
};

const V = (yt: string, channel: Channel, type: string, durationMin: number, title: string, tags: string[]): CatalogVideo => ({
  yt,
  channel,
  type,
  durationMin,
  title,
  tags,
});

export const VIDEO_CATALOG: CatalogVideo[] = [
  // ---------- Les Mills ----------
  V("rmKGUCxvkpQ", "lesmills", "muscu", 54, "BODYPUMP · Force full body", ["full body", "barre"]),
  V("7_r_8iaT2qU", "lesmills", "muscu", 54, "BODYPUMP · Force & endurance à la barre", ["full body", "barre"]),
  V("kPl66RocFDo", "lesmills", "muscu", 30, "BODYPUMP · Barre et poids du corps", ["full body", "barre"]),
  V("UaSjc1jXhGk", "lesmills", "muscu", 21, "BODYPUMP express · Full body", ["full body", "barre"]),
  V("UFs4q9L9iwI", "lesmills", "hiit", 29, "GRIT · HIIT au poids du corps", ["hiit", "full body", "sans matériel"]),
  V("ka2ObfKkN7Y", "lesmills", "hiit", 28, "GRIT · HIIT force & cardio", ["hiit", "full body", "haltères"]),
  V("yDB4Qawt3r8", "lesmills", "hiit", 19, "GRIT · HIIT intense aux haltères", ["hiit", "full body", "haltères"]),
  V("ZMO_XC9w7Lw", "lesmills", "hiit", 30, "GRIT Cardio · 30 min extrême", ["hiit", "cardio", "sans matériel", "avancé"]),
  V("7FZUR7O0Qz0", "lesmills", "hiit", 14, "GRIT · HIIT express", ["hiit", "cardio", "sans matériel"]),
  V("xbABGepKT2o", "lesmills", "boxe", 45, "BODYCOMBAT · 12 rounds", ["boxe", "cardio", "sans matériel"]),
  V("W_mgB-aGN9c", "lesmills", "boxe", 43, "BODYCOMBAT · Pieds-poings 40 min", ["boxe", "cardio", "sans matériel"]),
  V("HPytZF6SZ98", "lesmills", "boxe", 35, "BODYCOMBAT · Kickboxing anti-stress", ["boxe", "cardio", "sans matériel"]),
  V("pGF6YZ3zAIA", "lesmills", "boxe", 33, "BODYCOMBAT · Mouvements simples", ["boxe", "cardio", "sans matériel", "débutant"]),
  V("TfxUYsnWvvQ", "lesmills", "boxe", 20, "BODYCOMBAT · 20 min de combat", ["boxe", "cardio", "sans matériel", "débutant"]),
  V("LHXN64qblos", "lesmills", "boxe", 22, "BODYCOMBAT · Spécial jambes", ["boxe", "jambes", "sans matériel"]),
  V("GWcLgph55Ig", "lesmills", "cardio", 13, "BODYATTACK · Cardio tous niveaux", ["cardio", "sans matériel", "débutant"]),
  V("_FGRAvlWpkc", "lesmills", "cardio", 14, "BODYATTACK · Agilité & endurance", ["cardio", "sans matériel"]),
  V("nEZK3SPClLY", "lesmills", "calisthenics", 13, "CORE · Abdos à la maison", ["abdos", "sans matériel"]),
  V("3LlvMrjLar0", "lesmills", "calisthenics", 16, "CORE · Abdos 15 min", ["abdos"]),
  V("c3XtBws_DNE", "lesmills", "muscu", 14, "CORE · Gainage lesté", ["abdos", "haltères"]),
  V("dFmcnoGlG6I", "lesmills", "calisthenics", 44, "SHAPES · Fessiers, abdos & bras", ["full body", "fessiers", "abdos", "pilates", "faible impact"]),
  V("VMZZs_-f6tU", "lesmills", "calisthenics", 33, "SHAPES · Fessiers & gainage", ["fessiers", "jambes", "abdos", "pilates", "faible impact"]),
  V("fa6L5TfBKSo", "lesmills", "yoga", 28, "BODYBALANCE · Yoga & Pilates", ["yoga", "pilates", "mobilité"]),
  V("Ze3rGvTK1ig", "lesmills", "yoga", 10, "BODYBALANCE · Yoga express", ["yoga", "mobilité"]),
  V("v6V_hM9uvIk", "lesmills", "yoga", 27, "LES MILLS YOGA · Respiration & flow", ["yoga", "récup"]),
  V("spNokm5Fsk8", "lesmills", "velo", 20, "THE TRIP · Vélo immersif", ["vélo", "cardio"]),

  // ---------- Heather Robertson ----------
  V("_t8fJffsZzk", "heather", "muscu", 23, "Haut du corps · Force aux haltères", ["haut du corps", "haltères"]),
  V("uDpz6B0cvto", "heather", "muscu", 25, "Haut du corps · Sculpt haltères", ["haut du corps", "haltères"]),
  V("ev2zHq6-xjY", "heather", "muscu", 43, "Haut du corps · Force 43 min", ["haut du corps", "haltères"]),
  V("LtB4GUJikYw", "heather", "muscu", 33, "Dos & triceps", ["haut du corps", "dos", "haltères"]),
  V("Fu1EcSaMZMY", "heather", "calisthenics", 40, "Haut du corps · HIIT sans matériel", ["haut du corps", "hiit", "sans matériel"]),
  V("d0bUXIJ3mew", "heather", "calisthenics", 11, "Bras · Sans matériel", ["haut du corps", "sans matériel"]),
  V("eemRXHKsGIc", "heather", "muscu", 41, "Leg day · Force bas du corps", ["jambes", "fessiers", "haltères"]),
  V("KgxZiHPBKiM", "heather", "muscu", 37, "Leg day · Haltères uniquement", ["jambes", "fessiers", "haltères"]),
  V("_hYLF7zrLLo", "heather", "muscu", 41, "Bas du corps · Force 38 min", ["jambes", "fessiers", "haltères"]),
  V("7WQRjMjCkvI", "heather", "calisthenics", 36, "Jambes · Sans matériel", ["jambes", "fessiers", "sans matériel"]),
  V("pcJsP4gogsI", "heather", "calisthenics", 32, "Jambes & fessiers · Sans répétition", ["jambes", "fessiers", "sans matériel"]),
  V("sinkIlViPG8", "heather", "muscu", 46, "Full body · Force aux haltères", ["full body", "haltères"]),
  V("pbkrx340TBM", "heather", "muscu", 30, "Full body · Force 30 min", ["full body", "haltères"]),
  V("USi3LmPlj_0", "heather", "muscu", 40, "Total body · Haltères uniquement", ["full body", "haltères"]),
  V("azF7RsPXB2k", "heather", "calisthenics", 35, "Full body · Sans matériel", ["full body", "sans matériel"]),
  V("t1uZG3OhH4c", "heather", "calisthenics", 30, "Full body · Calisthenics", ["full body", "sans matériel"]),
  V("f8GzCmbz6YY", "heather", "hiit", 30, "HIIT full body · Intense", ["hiit", "full body", "sans matériel"]),
  V("kTvHJe6_h1c", "heather", "hiit", 13, "Tabata full body · 12 min", ["hiit", "cardio", "sans matériel"]),
  V("aFBRopKNGfw", "heather", "hiit", 31, "HIIT · Faible impact, sans sauts", ["hiit", "cardio", "full body", "sans matériel", "faible impact", "débutant"]),
  V("Bc6G41KutHE", "heather", "calisthenics", 27, "Gainage · 20 min sans répétition", ["abdos"]),
  V("Qia2ZXEzyLw", "heather", "calisthenics", 11, "Abdos debout · Sans matériel", ["abdos", "sans matériel", "faible impact", "débutant"]),
  V("H7eFjFoGkHY", "heather", "mobilite", 31, "Récup active · Étirements & mobilité", ["mobilité", "étirements", "récup"]),
  V("HWk_m5cs7fc", "heather", "mobilite", 19, "Mobilité full body", ["mobilité", "récup"]),
  V("_tPuCuiG5q8", "heather", "mobilite", 11, "Mobilité express de récup", ["mobilité", "étirements", "récup"]),
  V("zZyosxYeTSE", "heather", "mobilite", 40, "Mobilité & étirements dynamiques", ["mobilité", "échauffement"]),
  V("U3DParHgSMc", "heather", "mobilite", 11, "Bas du dos · Étirements", ["étirements", "dos", "récup"]),

  // ---------- Yoga With Adriene ----------
  V("b1H3xO3x_Js", "adriene", "yoga", 19, "Full Body Flow · 20 min", ["yoga"]),
  V("9kOCY0KNByw", "adriene", "yoga", 39, "Yoga force · Vinyasa 40 min", ["yoga"]),
  V("AB3Y-4a3ZrU", "adriene", "yoga", 36, "Yoga débutant · 30 min", ["yoga", "débutant"]),
  V("2IcWJobNDck", "adriene", "yoga", 22, "Yoga mobilité du matin", ["yoga", "mobilité"]),
  V("GLy2rYHwUqY", "adriene", "yoga", 45, "Total body · Étirement profond", ["yoga", "étirements", "récup"]),
  V("Ho9em79_0qg", "adriene", "yoga", 23, "Hanches & bas du dos", ["yoga", "étirements", "dos", "récup"]),
  V("plL13JF5BHA", "adriene", "yoga", 20, "Yoga pour coureurs", ["yoga", "course", "étirements", "récup"]),
  V("0hTllAb4XGg", "adriene", "yoga", 31, "Runner's yoga · 30 min", ["yoga", "course", "étirements", "récup"]),
  V("vhLbp8ibmEE", "adriene", "mobilite", 8, "Après la course · 7 min", ["course", "étirements", "récup"]),
  V("YWzRE1BiAvw", "adriene", "yoga", 24, "Yoga pour cyclistes", ["yoga", "vélo", "étirements", "récup"]),
  V("WymRLcDo1ek", "adriene", "yoga", 18, "Yoga pour nageurs", ["yoga", "natation", "étirements", "récup"]),
  V("2137wAXvufE", "adriene", "yoga", 27, "Jambes fatiguées", ["yoga", "marche", "étirements", "récup"]),
  V("lxuTCHJSers", "adriene", "mobilite", 12, "Étirements full body · 10 min", ["étirements", "récup"]),
  V("ssk1aBO84Lo", "adriene", "mobilite", 6, "Retour au calme · 6 min", ["étirements", "récup"]),
];

export const catalogUrl = (c: CatalogVideo) => `https://www.youtube.com/watch?v=${c.yt}`;
