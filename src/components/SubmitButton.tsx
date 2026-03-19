"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = ComponentProps<"button"> & {
  pendingLabel?: ReactNode;
};

export function SubmitButton({
  children,
  pendingLabel = "שולח...",
  className = "button button-primary",
  disabled = false,
  type = "submit",
  ...buttonProps
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...buttonProps} className={className} disabled={disabled || pending} type={type}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
