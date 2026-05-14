import { useEffect, useRef, useState } from "react";
import {
  fetchAuthStatus,
  pollAuthFlow,
  startAuthFlow,
  type AuthStatus,
  type DeviceFlowStart,
} from "../api/github";
import appLogo from "../assets/app-logo-mark.svg";
import { useI18n } from "../i18n/I18nProvider";

interface AuthGateProps {
  onAuthenticated: (login: string) => void;
}

type Phase = "idle" | "starting" | "awaiting" | "verifying" | "success" | "error";

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [flow, setFlow] = useState<DeviceFlowStart | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchAuthStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
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
        setPhase("success");
        onAuthenticated(result.login);
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

  async function start() {
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
      // Clipboard may be unavailable; users can copy manually.
    }
  }

  const clientMissing = status?.clientIdConfigured === false;
  const mode = status?.mode ?? "device";
  const externalMode = mode === "gh-cli" || mode === "token";

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo"><img src={appLogo} alt="" /></span>
          <span>GitHub Dashboard</span>
        </div>
        <h1>{t("auth.signIn")}</h1>
        <p className="auth-sub">
          {t("auth.description")}
        </p>

        {externalMode ? (
          <div className="auth-error">
            <strong>
              {mode === "gh-cli"
                ? t("auth.ghCliNotReady")
                : t("auth.tokenMissing")}
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
                <>
                  {t("auth.tokenHelp")}
                </>
              )}
            </p>
            {status?.detail ? <p><small>{status.detail}</small></p> : null}
          </div>
        ) : clientMissing ? (
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

        {!externalMode && (phase === "idle" || phase === "error") ? (
          <button className="auth-primary" onClick={() => void start()} disabled={clientMissing}>
            {t("auth.continue")}
          </button>
        ) : null}

        {phase === "starting" ? <p className="auth-status">{t("auth.requestingCode")}</p> : null}

        {phase === "awaiting" && flow ? (
          <div className="auth-flow">
            <p className="auth-status">
              {t("auth.openVerification")}
            </p>
            <a className="auth-link" href={flow.verificationUri} target="_blank" rel="noreferrer">
              {flow.verificationUri}
            </a>
            <div className="auth-code-row">
              <code className="auth-code">{flow.userCode}</code>
              <button className="auth-secondary" onClick={() => void copyCode()}>
                {copied ? t("auth.copied") : t("auth.copy")}
              </button>
            </div>
            <p className="auth-hint">{t("auth.waiting")}</p>
          </div>
        ) : null}

        {phase === "success" ? (
          <p className="auth-status">{t("auth.success")}</p>
        ) : null}

        {error ? <p className="auth-error-line">{error}</p> : null}
      </div>
    </div>
  );
}
