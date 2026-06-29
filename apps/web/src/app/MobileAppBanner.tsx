'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import appIconPng from './app-icon.png';

export function MobileAppBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-50 sm:hidden">
      <div className="bg-background/90 flex items-center gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur">
        <Image
          src={appIconPng}
          alt="ensemble app icon"
          width={44}
          height={44}
          className="h-11 w-11 flex-shrink-0 rounded-[22%] shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-primary truncate text-sm font-semibold">Take ensemble with you</p>
          <p className="text-muted-foreground truncate text-xs">Practice anywhere with the iOS app</p>
        </div>
        <a
          href="https://apps.apple.com/us/app/ensemble-language/id6770618195"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-white"
          aria-label="Download ensemble on the App Store"
        >
          Get app
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
