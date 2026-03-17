"use client";

import { useEffect, useState } from "react";

type CopyLinkButtonProps = {
  path: string;
  autoCopy?: boolean;
};

export function CopyLinkButton({ path, autoCopy = false }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  useEffect(() => {
    if (!autoCopy) {
      return;
    }

    void handleCopy();
  }, [autoCopy]);

  return (
    <button
      type="button"
      className="button button-secondary"
      onClick={() => void handleCopy()}
    >
      {copied ? "הקישור הועתק" : "העתקת קישור"}
    </button>
  );
}
