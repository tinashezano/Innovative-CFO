'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions);
      // fall back to selecting the text so the user can copy manually.
      const input = document.getElementById(`copy-${url}`) as HTMLInputElement | null;
      input?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex items-stretch gap-2">
      <input
        id={`copy-${url}`}
        readOnly
        value={url}
        aria-label={label ?? 'Shareable link'}
        className="input flex-1 truncate bg-slate-50 text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={copy} className="btn-secondary shrink-0" aria-label="Copy link">
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
