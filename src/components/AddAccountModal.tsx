import { useEffect, useRef, useState } from "react";
import {
  addTokenAccount,
  fetchProviderConfigs,
  pollAuthFlow,
  startAuthFlow,
  type DeviceFlowStart,
  type ProviderConfigSummary,
} from "../api/github";
import { useI18n } from "../i18n/I18nProvider";
import { useAccounts } from "../contexts/AccountContext";

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "choose" | "device" | "token" | "success";
type DevicePhase = "starting" | "awaiting" | "error";

export function AddAccountModal({ open, onClose }: AddAccountModalProps) {
  const { t } = useI18n();
  const { refresh } = useAccounts();
  const [configs, setConfigs] = useState<ProviderConfigSummary[]>([]);
  const [step, setStep] = useState<Step>("choose");
  const [selected, setSelected] = useState<ProviderConfigSummary | null>(null);
  const [flow, setFlow] = useState<DeviceFlowStart | null>(null);
  const [devicePhase, setDevicePhase] = useState<DevicePhase>("starting");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<number | null>(null);

  function stopPolling() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) {
      stopPolling();
      setStep("choose");
      setSelected(null);
      setFlow(null);
      setToken("");
      setError("");
      setCopied(false);
      setSubmitting(false);
      return;
    }
    void fetchProviderConfigs()
      .then((res) => setConfigs(res.configs))
      .catch((err) => setError((err as Error).message));
  }, [open]);

  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function pickProvider(config: ProviderConfigSummary) {
    setError("");
    setSelected(config);
    if (config.supportsDeviceFlow) {
      setStep("device");
      setDevicePhase("starting");
      try {
        const data = await startAuthFlow();
        setFlow(data);
        setDevicePhase("awaiting");
        const intervalMs = Math.max(2, data.interval) * 1000;
        intervalRef.current = window.setInterval(() => void poll(), intervalMs);
      } catch (err) {
        setDevicePhase("error");
        setError((err as Error).message);
      }
    } else {
      setStep("token");
    }
  }

  async function poll() {
    try {
      const result = await pollAuthFlow();
      if (!("status" in result)) return;
      if (result.status === "ok") {
        stopPolling();
        setStep("success");
        await refresh();
        window.setTimeout(() => onClose(), 800);
        return;
      }
      if (result.status === "expired") {
        stopPolling();
        setDevicePhase("error");
        setError(t("auth.expired"));
        return;
      }
      if (result.status === "denied") {
        stopPolling();
        setDevicePhase("error");
        setError(t("auth.denied"));
        return;
      }
      if (result.status === "error") {
        stopPolling();
        setDevicePhase("error");
        setError(result.error);
      }
    } catch (err) {
      stopPolling();
      setDevicePhase("error");
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
      // clipboard unavailable
    }
  }

  async function submitToken(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const trimmed = token.trim();
    if (!trimmed) {
      setError(t("accounts.tokenRequired"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await addTokenAccount({ providerConfigId: selected.id, token: trimmed });
      setStep("success");
      await refresh();
      window.setTimeout(() => onClose(), 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="add-account-backdrop" role="dialog" aria-modal="true" aria-label={t("accounts.add")}>
      <div className="add-account-card">
        <div className="add-account-header">
          <h2>{t("accounts.add")}</h2>
          <button className="add-account-close" type="button" aria-label={t("common.close")} onClick={onClose}>×</button>
        </div>

        {step === "choose" ? (
          <div className="add-account-providers">
            <p className="auth-status">{t("accounts.pickProvider")}</p>
            {configs.length === 0 && !error ? <p className="auth-hint">{t("common.loading")}</p> : null}
            {configs.map((config) => (
              <button
                key={config.id}
                type="button"
                className="add-account-provider"
                onClick={() => void pickProvider(config)}
              >
                <span className="add-account-provider-label">{config.label}</span>
                <span className="add-account-provider-meta">
                  {config.kind === "github" && config.supportsDeviceFlow
                    ? t("accounts.viaDeviceFlow")
                    : t("accounts.viaToken")}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {step === "device" && devicePhase === "starting" ? (
          <p className="auth-status">{t("auth.requestingCode")}</p>
        ) : null}

        {step === "device" && devicePhase === "awaiting" && flow ? (
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

        {step === "token" && selected ? (
          <form className="add-account-token" onSubmit={(event) => void submitToken(event)}>
            <p className="auth-status">
              {t("accounts.tokenHelp").replace("{provider}", selected.label)}
            </p>
            <a className="auth-link" href={`${selected.webUrl}/user/settings/applications`} target="_blank" rel="noreferrer">
              {selected.webUrl}/user/settings/applications
            </a>
            <label className="add-account-field">
              <span>{t("accounts.tokenLabel")}</span>
              <input
                type="password"
                value={token}
                autoComplete="off"
                onChange={(event) => setToken(event.target.value)}
                placeholder="●●●●●●●●"
                autoFocus
              />
            </label>
            <button className="auth-primary" type="submit" disabled={submitting}>
              {submitting ? t("common.loading") : t("accounts.add")}
            </button>
          </form>
        ) : null}

        {step === "success" ? <p className="auth-status">{t("accounts.added")}</p> : null}

        {error ? <p className="auth-error-line">{error}</p> : null}
      </div>
    </div>
  );
}
