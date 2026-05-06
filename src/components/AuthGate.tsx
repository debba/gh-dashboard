import { useEffect, useRef, useState } from "react";
import {
  fetchAuthStatus,
  pollAuthFlow,
  startAuthFlow,
  type AuthStatus,
  type DeviceFlowStart,
} from "../api/github";
import appLogo from "../assets/app-logo-mark.svg";

interface AuthGateProps {
  onAuthenticated: (login: string) => void;
}

type Phase = "idle" | "starting" | "awaiting" | "verifying" | "success" | "error";

export function AuthGate({ onAuthenticated }: AuthGateProps) {
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
        setError("Device code expired. Please start again.");
        return;
      }
      if (result.status === "denied") {
        stopPolling();
        setPhase("error");
        setError("Access was denied.");
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
        <h1>Sign in with GitHub</h1>
        <p className="auth-sub">
          This dashboard reads your repositories and issues via the GitHub API. Authorize the app
          to continue.
        </p>

        {externalMode ? (
          <div className="auth-error">
            <strong>
              {mode === "gh-cli"
                ? "Authentication via gh CLI is not ready."
                : "GITHUB_TOKEN is not available."}
            </strong>
            <p>
              {mode === "gh-cli" ? (
                <>
                  The server is configured with <code>GH_AUTH_MODE=gh-cli</code>. Make sure the{" "}
                  <a href="https://cli.github.com/" target="_blank" rel="noreferrer">gh CLI</a>
                  {" "}is installed and you are signed in:
                  <br />
                  <code>gh auth login</code>
                  {", "}then reload this page.
                </>
              ) : (
                <>
                  The server is configured with <code>GH_AUTH_MODE=token</code>. Export a personal
                  access token as <code>GITHUB_TOKEN</code> and restart the server.
                </>
              )}
            </p>
            {status?.detail ? <p><small>{status.detail}</small></p> : null}
          </div>
        ) : clientMissing ? (
          <div className="auth-error">
            <strong>GITHUB_CLIENT_ID is not set.</strong>
            <p>
              Register an OAuth App at{" "}
              <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">
                github.com/settings/developers
              </a>
              , enable Device Flow, then export <code>GITHUB_CLIENT_ID</code> and restart the
              server. Alternatively, set <code>GH_AUTH_MODE=gh-cli</code> to reuse your local
              {" "}<code>gh</code> CLI session, or <code>GH_AUTH_MODE=token</code> with a
              {" "}<code>GITHUB_TOKEN</code>.
            </p>
          </div>
        ) : null}

        {!externalMode && (phase === "idle" || phase === "error") ? (
          <button className="auth-primary" onClick={() => void start()} disabled={clientMissing}>
            Continue with GitHub
          </button>
        ) : null}

        {phase === "starting" ? <p className="auth-status">Requesting device code…</p> : null}

        {phase === "awaiting" && flow ? (
          <div className="auth-flow">
            <p className="auth-status">
              Open the GitHub verification page and enter the code below.
            </p>
            <a className="auth-link" href={flow.verificationUri} target="_blank" rel="noreferrer">
              {flow.verificationUri}
            </a>
            <div className="auth-code-row">
              <code className="auth-code">{flow.userCode}</code>
              <button className="auth-secondary" onClick={() => void copyCode()}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="auth-hint">Waiting for authorization…</p>
          </div>
        ) : null}

        {phase === "success" ? (
          <p className="auth-status">Authenticated. Loading dashboard…</p>
        ) : null}

        {error ? <p className="auth-error-line">{error}</p> : null}
      </div>
    </div>
  );
}
