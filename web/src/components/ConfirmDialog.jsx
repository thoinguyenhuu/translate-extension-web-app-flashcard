import { useEffect } from "react";

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  isBusy
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isBusy) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onClick={() => {
        if (!isBusy) {
          onCancel();
        }
      }}
    >
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-badge">Delete</div>
        <h2 className="dialog-title" id="confirm-dialog-title">
          {title}
        </h2>
        <p className="dialog-description" id="confirm-dialog-description">
          {description}
        </p>

        <div className="dialog-actions">
          <button
            type="button"
            className="dialog-button dialog-button-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="dialog-button dialog-button-danger"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
