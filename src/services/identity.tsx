import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { syncMayStart } from "../lib/connectivity";
import { invokeCommand } from "./localStore";
import { useDevice } from "./device";
import {
  confirmPlantUser,
  currentPlantUser,
  openWindowsSession,
  readSessionToken,
  storeSessionToken,
  type PlantChoice,
  type PlantUser,
} from "./plantDirectory";

interface WindowsAccount {
  domain: string | null;
  username: string;
}

interface IdentityState {
  user: PlantUser | null;
  token: string | null;
  choices: PlantChoice[];
  ready: boolean;
  needsSelection: boolean;
  refresh: () => Promise<void>;
  selectUser: (userId: string, pin: string) => Promise<void>;
  replaceUser: (user: PlantUser) => void;
  loadChoices: () => Promise<void>;
  clearSession: () => void;
}

const IdentityContext = createContext<IdentityState | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { link } = useDevice();
  const [user, setUser] = useState<PlantUser | null>(null);
  const [token, setToken] = useState<string | null>(readSessionToken());
  const [choices, setChoices] = useState<PlantChoice[]>([]);
  const [ready, setReady] = useState(false);
  const [needsSelection, setNeedsSelection] = useState(false);

  useEffect(() => {
    if (!syncMayStart(link.link)) {
      setNeedsSelection(false);
      setReady(true);
      return;
    }
    let stopped = false;
    const bootstrap = async () => {
      const existing = readSessionToken();
      if (existing) {
        try {
          const current = await currentPlantUser(existing);
          if (!stopped) {
            setToken(existing);
            setUser(current);
            setChoices([]);
            setNeedsSelection(false);
            setReady(true);
          }
          return;
        } catch {
          storeSessionToken(null);
        }
      }
      let account: WindowsAccount = { domain: null, username: "" };
      try {
        account = await invokeCommand<WindowsAccount>("current_windows_account");
      } catch {
        account = { domain: null, username: "" };
      }
      try {
        const result = await openWindowsSession(account.domain, account.username);
        if (stopped) return;
        if (result.kind === "mapped" && result.session) {
          storeSessionToken(result.session.token);
          setToken(result.session.token);
          setUser(result.session.user);
          setChoices([]);
          setNeedsSelection(false);
        } else {
          setToken(null);
          setUser(null);
          setChoices(result.choices ?? []);
          setNeedsSelection(true);
        }
      } catch {
        if (!stopped) {
          setChoices([]);
        }
      } finally {
        if (!stopped) setReady(true);
      }
    };
    void bootstrap();
    return () => {
      stopped = true;
    };
  }, [link.link]);

  const selectUser = async (userId: string, pin: string) => {
    const session = await confirmPlantUser(userId, pin);
    storeSessionToken(session.token);
    setToken(session.token);
    setUser(session.user);
    setChoices([]);
    setNeedsSelection(false);
  };

  return (
    <IdentityContext.Provider
      value={{
        user,
        token,
        choices,
        ready,
        needsSelection,
        refresh: async () => {
          if (!token) return;
          setUser(await currentPlantUser(token));
        },
        selectUser,
        replaceUser: (next) => {
          setUser(next);
          const stored = readSessionToken();
          setToken(stored);
        },
        loadChoices: async () => {
          const result = await openWindowsSession(null, "");
          setChoices(result.choices ?? []);
        },
        clearSession: () => {
          storeSessionToken(null);
          setToken(null);
          setUser(null);
        },
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityState {
  const value = useContext(IdentityContext);
  if (!value) throw new Error("useIdentity must be used within IdentityProvider");
  return value;
}
