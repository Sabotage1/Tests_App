"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = ComponentProps<"button"> & {
  confirmMessage?: string;
  pendingLabel?: ReactNode;
};

export function SubmitButton({
  children,
  confirmMessage,
  pendingLabel = "שולח...",
  className = "button button-primary",
  disabled = false,
  onClick,
  type = "submit",
  ...buttonProps
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !pending && !disabled && !window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <button
      {...buttonProps}
      className={className}
      disabled={disabled || pending}
      onClick={handleClick}
      type={type}
    >
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
