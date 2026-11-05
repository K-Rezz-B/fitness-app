import { PROFILE_EMOJIS } from "@/lib/constants";

/** Choix d'avatar (radios natives, sans JS) → champ `emoji` du formulaire. */
export function EmojiPicker({ value }: { value?: string }) {
  const current = value && PROFILE_EMOJIS.includes(value) ? value : PROFILE_EMOJIS[0];
  return (
    <fieldset>
      <legend className="label">Avatar</legend>
      <div className="grid grid-cols-6 gap-2">
        {PROFILE_EMOJIS.map((e) => (
          <label key={e} className="cursor-pointer">
            <input type="radio" name="emoji" value={e} defaultChecked={e === current} className="peer sr-only" />
            <span className="grid aspect-square place-items-center rounded-2xl border border-line bg-surface-2 text-2xl transition peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
              {e}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
