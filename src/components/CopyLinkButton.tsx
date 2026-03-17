"use client";

type CopyLinkButtonProps = {
  path: string;
};

export function CopyLinkButton({ path }: CopyLinkButtonProps) {
  return (
    <button
      type="button"
      className="button button-secondary"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        await navigator.clipboard.writeText(url);
      }}
    >
      העתקת קישור
    </button>
  );
}
