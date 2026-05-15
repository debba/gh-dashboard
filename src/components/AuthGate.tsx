import { useEffect, useRef, useState } from "react";
import {
  addTokenAccount,
  fetchAuthStatus,
  fetchProviderConfigs,
  pollAuthFlow,
  startAuthFlow,
  type AuthStatus,
  type DeviceFlowStart,
  type ProviderConfigSummary,
} from "../api/github";
import appLogo from "../assets/app-logo-mark.svg";
import { useI18n } from "../i18n/I18nProvider";

interface AuthGateProps {
  onAuthenticated: (login: string) => void;
}

type Step = "choose" | "device" | "token" | "success";
type DevicePhase = "starting" | "awaiting" | "error";

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<AuthStatus | null>(null);
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

  useEffect(() => {
    void fetchAuthStatus().then(setStatus).catch(() => setStatus(null));
    void fetchProviderConfigs()
      .then((res) => setConfigs(res.configs))
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
  }, []);

  function stopPolling() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function poll() {
    try {
      const result = await pollAuthFlow();
      if (!("status" in result)) return;
      if (result.status === "ok") {
        stopPolling();
        setStep("success");
        onAuthenticated(result.login);
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
      try {
        const refreshed = await fetchAuthStatus();
        onAuthenticated(refreshed.login ?? selected.label);
      } catch {
        onAuthenticated(selected.label);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function backToChoice() {
    stopPolling();
    setStep("choose");
    setSelected(null);
    setFlow(null);
    setToken("");
    setError("");
    setCopied(false);
    setDevicePhase("starting");
  }

  const mode = status?.mode ?? "device";
  const externalMode = mode === "gh-cli" || mode === "token";
  const clientMissing = status?.clientIdConfigured === false && selected?.supportsDeviceFlow;
  const showBack = !externalMode && (step === "device" || step === "token");

  return (
    <div className="auth-gate">
      <div className="auth-aura" aria-hidden="true" />
      <div className="auth-card">
        <header className="auth-brand">
          <span className="auth-brand-logo">
            <img src={appLogo} alt="" />
          </span>
          <span className="auth-brand-text">
            <span className="auth-brand-name">{t("app.title")}</span>
            <span className="auth-brand-tag">{t("auth.brandTag")}</span>
          </span>
        </header>

        {externalMode ? (
          <>
            <h1 className="auth-title">{t("auth.signIn")}</h1>
            <div className="auth-error">
              <strong>
                {mode === "gh-cli" ? t("auth.ghCliNotReady") : t("auth.tokenMissing")}
              </strong>
              <p>
                {mode === "gh-cli" ? (
                  <>
                    {t("auth.ghCliHelp")}{" "}
                    <a href="https://cli.github.com/" target="_blank" rel="noreferrer">gh CLI</a>
                    <br />
                    <code>gh auth login</code>
                    {", "}{t("auth.ghCliReload")}
                  </>
                ) : (
                  <>{t("auth.tokenHelp")}</>
                )}
              </p>
              {status?.detail ? <p><small>{status.detail}</small></p> : null}
            </div>
          </>
        ) : null}

        {!externalMode && step === "choose" ? (
          <>
            <h1 className="auth-title">{t("auth.signIn")}</h1>
            <p className="auth-sub">{t("auth.description")}</p>
            <div className="auth-providers" role="list">
              {configs.length === 0 && !error ? (
                <p className="auth-hint auth-hint-center">{t("common.loading")}</p>
              ) : null}
              {configs.map((config) => (
                <button
                  key={config.id}
                  type="button"
                  role="listitem"
                  className="auth-provider"
                  onClick={() => void pickProvider(config)}
                >
                  <ProviderBadge config={config} />
                  <span className="auth-provider-body">
                    <span className="auth-provider-label">{config.label}</span>
                    <span className="auth-provider-meta">
                      {config.kind === "github" && config.supportsDeviceFlow
                        ? t("accounts.viaDeviceFlow")
                        : t("accounts.viaToken")}
                    </span>
                  </span>
                  <ChevronIcon />
                </button>
              ))}
            </div>
          </>
        ) : null}

        {!externalMode && (step === "device" || step === "token") && selected ? (
          <div className="auth-provider-header">
            <ProviderBadge config={selected} small />
            <span className="auth-provider-header-text">
              <span className="auth-provider-header-label">{selected.label}</span>
              <span className="auth-provider-header-meta">
                {selected.supportsDeviceFlow ? t("accounts.viaDeviceFlow") : t("accounts.viaToken")}
              </span>
            </span>
          </div>
        ) : null}

        {clientMissing && step === "device" ? (
          <div className="auth-error">
            <strong>{t("auth.clientMissing")}</strong>
            <p>
              {t("auth.clientHelp").split("github.com/settings/developers")[0]}
              <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">
                github.com/settings/developers
              </a>
              {t("auth.clientHelp").split("github.com/settings/developers")[1]}
            </p>
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
              <ExternalIcon />
            </a>
            <div className="auth-code-row">
              <code className="auth-code">{flow.userCode}</code>
              <button className="auth-secondary" type="button" onClick={() => void copyCode()}>
                {copied ? t("auth.copied") : t("auth.copy")}
              </button>
            </div>
            <p className="auth-hint">
              <span className="auth-spinner" aria-hidden="true" />
              {t("auth.waiting")}
            </p>
          </div>
        ) : null}

        {step === "token" && selected ? (
          <form className="auth-form" onSubmit={(event) => void submitToken(event)}>
            <p className="auth-status">
              {t("accounts.tokenHelp").replace("{provider}", selected.label)}
            </p>
            <a className="auth-link" href={`${selected.webUrl}/user/settings/applications`} target="_blank" rel="noreferrer">
              {selected.webUrl}/user/settings/applications
              <ExternalIcon />
            </a>
            <label className="auth-field">
              <span>{t("accounts.tokenLabel")}</span>
              <input
                type="password"
                value={token}
                autoComplete="off"
                onChange={(event) => setToken(event.target.value)}
                placeholder="●●●●●●●●●●●●●●●●"
                autoFocus
              />
            </label>
            <button className="auth-primary" type="submit" disabled={submitting}>
              {submitting ? t("common.loading") : t("auth.continue")}
            </button>
          </form>
        ) : null}

        {step === "success" ? (
          <div className="auth-success">
            <span className="auth-success-check" aria-hidden="true">✓</span>
            <p className="auth-status">{t("auth.success")}</p>
          </div>
        ) : null}

        {error ? <p className="auth-error-line">{error}</p> : null}

        {showBack ? (
          <button className="auth-back" type="button" onClick={backToChoice}>
            <span aria-hidden="true">←</span> {t("auth.changeProvider")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProviderBadge({ config, small = false }: { config: ProviderConfigSummary; small?: boolean }) {
  const className = `auth-provider-badge auth-provider-badge-${config.kind}${small ? " auth-provider-badge-sm" : ""}`;
  if (config.kind === "github") {
    return (
      <span className={className} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 5.01 3.24 9.26 7.74 10.76.57.1.78-.25.78-.55v-1.93c-3.15.68-3.81-1.52-3.81-1.52-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.51-.29-5.16-1.26-5.16-5.62 0-1.24.45-2.25 1.18-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.16.91-.25 1.89-.38 2.86-.39.97.01 1.95.14 2.86.39 2.19-1.47 3.15-1.16 3.15-1.16.62 1.57.23 2.73.11 3.02.73.79 1.18 1.8 1.18 3.04 0 4.37-2.65 5.33-5.18 5.61.41.36.78 1.06.78 2.14v3.17c0 .31.21.66.79.55 4.5-1.5 7.74-5.75 7.74-10.76C23.33 5.56 18.27.5 12 .5Z"/>
        </svg>
      </span>
    );
  }
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="9" cy="18" r="2.5" />
        <path d="M6 8.5v3.5a3 3 0 0 0 3 3h0" />
        <path d="M18 8.5v1a4 4 0 0 1-4 4H9" />
        <path d="M9 15.5v0" />
      </svg>
    </span>
  );
}

function ChevronIcon() {
  return (
    <svg className="auth-provider-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </svg>
  );
}
