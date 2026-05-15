import { useEffect, useRef, useState } from "react";
import { useAccounts } from "../contexts/AccountContext";
import { useI18n } from "../i18n/I18nProvider";

export function AccountSwitcher() {
  const { accounts, active, switchAccount } = useAccounts();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (accounts.length <= 1) return null;

  return (
    <div className="account-switcher" ref={ref}>
      <button
        type="button"
        className={`btn account-switcher-btn ${open ? "active" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("accounts.switch")}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="label">{active?.login ?? active?.label ?? t("accounts.select")}</span>
      </button>
      {open ? (
        <div className="account-switcher-popover" role="listbox" aria-label={t("accounts.switch")}>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              role="option"
              aria-selected={account.id === active?.id}
              className={`account-switcher-item ${account.id === active?.id ? "active" : ""}`}
              onClick={async () => {
                setOpen(false);
                try {
                  await switchAccount(account.id);
                } catch {
                  // refresh effect will surface the error
                }
              }}
            >
              <span className="account-switcher-label">{account.login ?? account.label}</span>
              <span className="account-switcher-meta">{account.providerConfigId}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
