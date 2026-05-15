import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  activateAccount,
  fetchAccounts,
  removeAccount as removeAccountApi,
  type AccountSummary,
} from "../api/github";
import { invalidate as invalidateClientCache } from "../api/cache";

interface AccountContextValue {
  accounts: AccountSummary[];
  active: AccountSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchAccount: (id: string) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAccounts();
      if (!mounted.current) return;
      setAccounts(data.accounts);
      setActiveId(data.activeId);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError((err as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const switchAccount = useCallback(
    async (id: string) => {
      if (id === activeId) return;
      await activateAccount(id);
      invalidateClientCache();
      await refresh();
    },
    [activeId, refresh],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      await removeAccountApi(id);
      invalidateClientCache();
      await refresh();
    },
    [refresh],
  );

  const active = useMemo(
    () => accounts.find((account) => account.id === activeId) ?? null,
    [accounts, activeId],
  );

  const value = useMemo<AccountContextValue>(
    () => ({ accounts, active, loading, error, refresh, switchAccount, removeAccount }),
    [accounts, active, loading, error, refresh, switchAccount, removeAccount],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccounts(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccounts must be used inside AccountProvider");
  return value;
}

type CapabilityName = keyof NonNullable<AccountSummary["capabilities"]>;

export function useCapability(name: CapabilityName, fallback = true): boolean {
  const { active } = useAccounts();
  if (!active) return fallback;
  const value = active.capabilities?.[name];
  return value === undefined ? fallback : value;
}
