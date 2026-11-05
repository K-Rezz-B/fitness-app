import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { BellRing, HeartPulse, KeyRound, ScanFace, Smartphone, Trash2 } from "lucide-react";
import { requireProfile } from "@/lib/session";
import { getPasskeys, getPushSubscriptions } from "@/lib/data";
import { pushConfigured, vapidPublicKey } from "@/lib/push";
import { scriptableWidget } from "@/lib/scriptable";
import { fmtDate } from "@/lib/dates";
import { deletePasskey, generateApiToken, revokeApiToken, saveNotificationPrefs } from "@/app/apple-actions";
import { PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { PushToggle } from "@/components/push-toggle";
import { PasskeyRegisterButton } from "@/components/passkeys";

export const metadata: Metadata = { title: "Apple" };

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] break-all text-ink">{children}</code>
);

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card mb-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Recipe({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="rounded-2xl border border-line bg-surface-2/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="mt-3 space-y-3 text-sm text-ink-2">{children}</div>
    </details>
  );
}

const Steps = ({ children }: { children: ReactNode }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>;

export default async function Integrations() {
  const me = await requireProfile();
  const [keys, subs, h] = await Promise.all([getPasskeys(me.id), getPushSubscriptions(me.id), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const token = me.apiToken;
  const workoutsUrl = `${origin}/api/v1/workouts`;
  const weightsUrl = `${origin}/api/v1/weights`;
  const auth = token ? `Bearer ${token}` : "Bearer <jeton>";

  return (
    <>
      <PageHeader title="Apple" subtitle={`Santé, Watch, notifications, Face ID et widget · profil ${me.name}`} />

      {/* ---------------- Apple Santé ---------------- */}
      <Section icon={<HeartPulse size={18} className="text-cardio" />} title="Apple Santé & Apple Watch (Raccourcis)">
        <p className="mb-4 text-sm text-ink-2">
          L&apos;app <b>Raccourcis</b> envoie toute seule tes séances Apple Watch et tes pesées à FitPulse : plus rien à saisir, le score et le coach se mettent à jour.
        </p>

        <div className="mb-4 rounded-2xl border border-line p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <KeyRound size={16} className="text-accent" /> Ton jeton personnel
          </div>
          {token ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Code>{token}</Code>
                <CopyButton text={token} />
              </div>
              <p className="mb-3 text-xs text-muted">Il donne accès à ce profil : garde-le pour tes raccourcis et ton widget. Le régénérer coupe les anciens raccourcis.</p>
              <div className="flex gap-2">
                <form action={generateApiToken}>
                  <button className="btn-ghost text-xs">Régénérer</button>
                </form>
                <form action={revokeApiToken}>
                  <button className="btn-ghost text-xs text-critical">Désactiver</button>
                </form>
              </div>
            </>
          ) : (
            <form action={generateApiToken}>
              <button className="btn-primary">Générer mon jeton</button>
            </form>
          )}
        </div>

        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="label">URL séances</div>
            <div className="flex items-center gap-2"><Code>{workoutsUrl}</Code><CopyButton text={workoutsUrl} /></div>
          </div>
          <div>
            <div className="label">URL pesées</div>
            <div className="flex items-center gap-2"><Code>{weightsUrl}</Code><CopyButton text={weightsUrl} /></div>
          </div>
          <div className="sm:col-span-2">
            <div className="label">En-tête (les 2 URL)</div>
            <Code>Authorization</Code> = <Code>{auth}</Code>
          </div>
        </div>

        <div className="space-y-3">
          <Recipe title="⌚ Séances Apple Watch — début / fin (recommandé, marche partout)" open>
            <Steps>
              <li>
                Raccourcis › <b>Automatisation</b> › <b>+</b> › <b>Exercice Apple Watch</b> › Lorsque l&apos;exercice : <b>Commence</b> › <b>N&apos;importe quel exercice</b> › <b>Exécuter immédiatement</b>.
              </li>
              <li>
                Action <b>Obtenir le contenu de l&apos;URL</b> : URL <Code>{workoutsUrl}</Code>, Méthode <b>POST</b>, En-têtes <Code>Authorization</Code> = <Code>{auth}</Code>, Corps de la requête <b>JSON</b> avec un champ texte <Code>event</Code> = <Code>start</Code>.
              </li>
              <li>
                2ᵉ automatisation identique, mais <b>Se termine</b> et <Code>event</Code> = <Code>end</Code>. Ajoute ensuite <b>Obtenir la valeur du dictionnaire</b> (clé <Code>message</Code>) puis <b>Afficher la notification</b> : « ✅ Course · 42 min ajoutée à FitPulse ».
              </li>
            </Steps>
            <p>
              <b>Type de séance</b> : sans précision, elle est rangée en « Cardio (autre) » (modifiable dans l&apos;app). Pour un type juste, fais plutôt une automatisation <b>Commence</b> par sport (filtre du déclencheur) avec un champ <Code>type</Code> :{" "}
              <Code>course</Code> <Code>velo</Code> <Code>natation</Code> <Code>marche</Code> <Code>muscu</Code> <Code>crossfit</Code> <Code>hiit</Code> <Code>yoga</Code> <Code>boxe</Code>… Une seule automatisation <b>Se termine</b> suffit.
            </p>
            <p className="text-xs text-muted">Durée calculée entre les deux signaux · calories estimées (MET × ton dernier poids) · RPE 6 par défaut. Au 1ᵉʳ lancement, iOS demande d&apos;autoriser l&apos;accès réseau.</p>
          </Recipe>

          <Recipe title="📋 Variante : séance complète (si « Entraînements » est proposé)">
            <p>
              Dans l&apos;automatisation <b>Se termine</b>, ajoute avant l&apos;envoi <b>Rechercher des échantillons de santé</b> (Type <b>Entraînements</b>, Trier par <b>Date de début</b>, <b>Plus récent d&apos;abord</b>, Limite <b>1</b>), puis envoie en JSON :
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><Code>type</Code> : nom de l&apos;entraînement (« Course en extérieur », « Musculation traditionnelle »… reconnus en FR/EN)</li>
              <li><Code>start</Code> / <Code>end</Code> : dates de début et de fin via <b>Formater la date</b> › <b>ISO 8601</b></li>
              <li>facultatifs : <Code>calories</Code>, <Code>distance</Code> (« 5,2 km » accepté), <Code>heartRateAvg</Code> (→ RPE estimé)</li>
            </ul>
            <p className="text-xs text-muted">Selon la version d&apos;iOS, « Entraînements » n&apos;apparaît pas toujours dans la liste : garde alors la méthode début / fin. Une même séance envoyée 2 fois n&apos;est comptée qu&apos;une fois.</p>
          </Recipe>

          <Recipe title="⚖️ Pesée automatique (balance connectée ou saisie dans Santé)">
            <Steps>
              <li>Automatisation › <b>Heure de la journée</b> (ex. 9:00, chaque jour) › <b>Exécuter immédiatement</b>.</li>
              <li><b>Rechercher des échantillons de santé</b> : Type <b>Poids</b>, Trier par <b>Date de début</b>, <b>Plus récent d&apos;abord</b>, Limite <b>1</b>.</li>
              <li>
                <b>Obtenir le contenu de l&apos;URL</b> : <Code>{weightsUrl}</Code>, POST, même en-tête, JSON : <Code>weightKg</Code> = Échantillons de santé, <Code>date</Code> = Date de début (<b>Formater la date</b> › ISO 8601).
              </li>
            </Steps>
            <p className="text-xs text-muted">La même pesée n&apos;est jamais ajoutée deux fois.</p>
          </Recipe>

          {token && (
            <Recipe title="🧪 Tester depuis le Terminal du Mac">
              <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px] text-ink">{`curl -X POST ${workoutsUrl} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type":"course","durationMin":30,"distance":"5 km"}'`}</pre>
            </Recipe>
          )}
        </div>
      </Section>

      {/* ---------------- Notifications ---------------- */}
      <Section icon={<BellRing size={18} className="text-accent" />} title="Notifications & pastille d'icône">
        <p className="mb-3 text-sm text-ink-2">
          Une notification par jour au maximum, vers 18 h (19 h l&apos;été) : rappel si ta série est en danger ou si une séance prévue n&apos;est pas faite, bilan le dimanche, et alerte quand tu débloques un badge. La pastille de l&apos;icône affiche les séances qu&apos;il te reste pour ton objectif de la semaine.
        </p>
        <div className="mb-4">
          <PushToggle vapidKey={pushConfigured() ? vapidPublicKey() : null} />
        </div>
        <form action={saveNotificationPrefs} className="space-y-2 border-t border-line pt-4 text-sm">
          {[
            { name: "notifyStreak", label: "Rappel du soir (série en danger, séance prévue non faite, objectif hebdo)", on: me.notifyStreak },
            { name: "notifyWeekly", label: "Bilan de la semaine le dimanche", on: me.notifyWeekly },
            { name: "notifyBadges", label: "Nouveau badge débloqué", on: me.notifyBadges },
          ].map((o) => (
            <label key={o.name} className="flex items-center gap-2">
              <input type="checkbox" name={o.name} defaultChecked={o.on} className="h-4 w-4 accent-[var(--color-accent)]" />
              {o.label}
            </label>
          ))}
          <button className="btn-ghost mt-2">Enregistrer</button>
        </form>
        {subs.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Appareils abonnés : {subs.map((s) => `${s.userAgent ?? "Appareil"} (${fmtDate(s.createdAt)})`).join(" · ")}
          </p>
        )}
      </Section>

      {/* ---------------- Face ID ---------------- */}
      <Section icon={<ScanFace size={18} className="text-force" />} title="Face ID / Touch ID">
        <p className="mb-3 text-sm text-ink-2">
          Connecte-toi sans mot de passe. La passkey est rangée dans ton <b>trousseau iCloud</b> : créée sur l&apos;iPhone, elle marche aussi sur ton Mac, et elle ouvre directement ton profil.
        </p>
        <PasskeyRegisterButton />
        {keys.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-2 text-sm">
                <span>🔑 {k.deviceName || "Appareil"}</span>
                <span className="text-xs text-muted">
                  ajoutée le {fmtDate(k.createdAt)}
                  {k.lastUsedAt && ` · utilisée le ${fmtDate(k.lastUsedAt)}`}
                </span>
                <form action={deletePasskey} className="ml-auto">
                  <input type="hidden" name="id" value={k.id} />
                  <button aria-label="Supprimer la passkey" className="text-muted hover:text-critical"><Trash2 size={14} /></button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Le mot de passe reste utilisable. Supprimer une passkey ici empêche de s&apos;en servir pour FitPulse (pense aussi à la retirer de Réglages › Mots de passe).</p>
      </Section>

      {/* ---------------- Widget ---------------- */}
      <Section icon={<Smartphone size={18} className="text-accent-2" />} title="Widget écran d'accueil & verrouillé (Scriptable)">
        {token ? (
          <>
            <Steps>
              <li>Installe <b>Scriptable</b> (App Store, gratuit).</li>
              <li>Dans Scriptable : <b>+</b> › colle le script ci-dessous › nomme-le <b>FitPulse</b>.</li>
              <li>Écran d&apos;accueil › appui long › <b>+</b> › <b>Scriptable</b> › petit ou moyen › touche le widget › Script : <b>FitPulse</b>. Écran verrouillé : Personnaliser › widgets › Scriptable (cercle ou rectangle).</li>
            </Steps>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CopyButton text={scriptableWidget({ apiUrl: `${origin}/api/v1/summary`, token, name: me.name })} />
              <span className="text-xs text-muted">Score, séances de la semaine, série, prochain créneau · mise à jour ~30 min · contient ton jeton, ne le partage pas.</span>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted">Voir le script</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px] text-ink">
                {scriptableWidget({ apiUrl: `${origin}/api/v1/summary`, token: "••••", name: me.name })}
              </pre>
            </details>
          </>
        ) : (
          <p className="text-sm text-ink-2">Génère d&apos;abord ton jeton personnel (section Apple Santé, plus haut) : le widget s&apos;en sert pour lire tes stats.</p>
        )}
      </Section>
    </>
  );
}
