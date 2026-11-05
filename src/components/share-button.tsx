"use client";
import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Partage natif (iPhone : Messages, WhatsApp…) ou copie dans le presse-papiers à défaut. */
export function ShareButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={async () => {
        if (navigator.share) {
          await navigator.share({ title, text }).catch(() => {});
          return;
        }
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? "Copié !" : "Partager"}
    </button>
  );
}
