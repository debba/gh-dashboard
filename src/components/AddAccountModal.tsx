import { useEffect, useRef, useState } from "react";
import {
  pollAuthFlow,
  startAuthFlow,
  type DeviceFlowStart,
} from "../api/github";
import { useI18n } from "../i18n/I18nProvider";
import { useAccounts } from "../contexts/AccountContext";

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

type Phase = "idle" | "starting" | "awaiting" | "success" | "error";

export function AddAccountModal({ open, onClose }: AddAccountModalProps) {
  const { t } = useI18n();
  const { refresh } = useAccounts();
  const [phase, setPhase] = useState<Phase>("idle");
  const [flow, setFlow] = useState<DeviceFlowStart | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  function stopPolling() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) {
      stopPolling();
      setPhase("idle");
      setFlow(null);
      setError("");
      setCopied(false);
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void begin();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function poll() {
    try {
      const result = await pollAuthFlow();
      if (!("status" in result)) return;
      if (result.status === "ok") {
        stopPolling();
        setPhase("success");
        await refresh();
        window.setTimeout(() => onClose(), 800);
        return;
      }
      if (result.status === "expired") {
        stopPolling();
        setPhase("error");
        setError(t("auth.expired"));
        return;
      }
      if (result.status === "denied") {
        stopPolling();
        setPhase("error");
        setError(t("auth.denied"));
        return;
      }
      if (result.status === "error") {
        stopPolling();
        setPhase("error");
        setError(result.error);
      }
    } catch (err) {
      stopPolling();
      setPhase("error");
      setError((err as Error).message);
    }
  }

  async function begin() {
    setError("");
    setPhase("starting");
    try {
      const data = await startAuthFlow();
      setFlow(data);
      setPhase("awaiting");
      const intervalMs = Math.max(2, data.interval) * 1000;
      intervalRef.current = window.setInterval(() => void poll(), intervalMs);
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
    }
  }

  async function copyCode() {
    if (!flow) return;
    try {
      await navigator.clipboard.writeText(flow.userCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; users can copy manually
    }
  }

  function retry() {
    startedRef.current = true;
    void begin();
  }

  if (!open) return null;

  return (
    <div className="add-account-backdrop" role="dialog" aria-modal="true" aria-label={t("accounts.add")}>
      <div className="add-account-card">
        <div className="add-account-header">
          <h2>{t("accounts.add")}</h2>
          <button className="add-account-close" type="button" aria-label={t("common.close")} onClick={onClose}>×</button>
        </div>

        {phase === "starting" ? (
          <p className="auth-status">{t("auth.requestingCode")}</p>
        ) : null}

        {phase === "awaiting" && flow ? (
          <div className="auth-flow">
            <p className="auth-status">{t("auth.openVerification")}</p>
            <a className="auth-link" href={flow.verificationUri} target="_blank" rel="noreferrer">
              {flow.verificationUri}
            </a>
            <div className="auth-code-row">
              <code className="auth-code">{flow.userCode}</code>
              <button className="auth-secondary" type="button" onClick={() => void copyCode()}>
                {copied ? t("auth.copied") : t("auth.copy")}
              </button>
            </div>
            <p className="auth-hint">{t("auth.waiting")}</p>
          </div>
        ) : null}

        {phase === "success" ? <p className="auth-status">{t("accounts.added")}</p> : null}

        {phase === "error" ? (
          <>
            <p className="auth-error-line">{error}</p>
            <button className="auth-primary" type="button" onClick={retry}>{t("auth.continue")}</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
