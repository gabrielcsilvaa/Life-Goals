import { parseViewPreference, restoreAccountView } from "../lib/viewPreference";
import { resumeAccount } from "../lib/resumeAccount";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as api from "../lib/api";
import {
  DemoState,
  demoCommand,
  demoSnapshot,
  initialDemo,
  materializeDemo,
} from "../lib/demo";
import { newKey, today } from "../lib/money";
import { Payload, Snapshot } from "../lib/types";

type Form = { id: string; operation: string; defaults?: Payload } | null;
type Context = {
  mode: "demo" | "live";
  month: string;
  setMonth: (month: string) => void;
  data: Snapshot | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  hidden: boolean;
  setHidden: (v: boolean) => void;
  form: Form;
  openForm: (operation: string, defaults?: Payload) => void;
  closeForm: () => void;
  run: (operation: string, payload: Payload) => Promise<Payload | undefined>;
  notify: (message: string) => void;
  reload: () => Promise<void>;
  signIn: (
    url: string,
    username: string,
    password: string,
    name?: string,
    email?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};
const AppContext = createContext<Context | null>(null);
const DEMO_KEY = "lifegoals-demo-v1";
const DEMO_MONTH_KEY = "lifegoals-demo-month-v1";
const VIEW_KEY = "lifegoals-last-account-view-v1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [month, setMonth] = useState("2027-01");
  const [initial] = useState(() => {
    const demo = initialDemo();
    return { demo, data: demoSnapshot(demo, "2027-01") };
  });
  const [demo, setDemo] = useState<DemoState>(initial.demo);
  const demoRef = useRef(initial.demo);
  const [data, setData] = useState<Snapshot | null>(initial.data);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const userIntent = useRef(0);
  const skipNextReload = useRef(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [hidden, setHidden] = useState(false);
  const [form, setForm] = useState<Form>(null);
  const sequence = useRef(0),
    working = useRef(false);
  const pending = useRef(new Map<string, string>());

  useEffect(() => {
    let mounted = true;
    const intent = userIntent.current;
    const isCurrent = () => mounted && intent === userIntent.current;
    // Local data and saved-account validation are independent, never a loading gate.
    void Promise.all([
      AsyncStorage.getItem(DEMO_KEY),
      AsyncStorage.getItem(DEMO_MONTH_KEY),
    ])
      .then(([raw, savedMonth]) => {
        if (
          savedMonth &&
          /^\d{4}-(0[1-9]|1[0-2])$/.test(savedMonth) &&
          isCurrent()
        )
          setMonth(savedMonth);
        if (raw && isCurrent()) {
          try {
            const restoredDemo = JSON.parse(raw);
            demoRef.current = restoredDemo;
            setDemo(restoredDemo);
          } catch {
            /* Keep the built-in example. */
          }
        }
      })
      .catch(() => {});
    const savedView = AsyncStorage.getItem(VIEW_KEY)
      .then(parseViewPreference)
      .catch(() => null);
    const currentMonth = today().slice(0, 7);
    void resumeAccount(
      api.restoreSession,
      async () =>
        restoreAccountView(
          await savedView,
          api.serverUrl(),
          currentMonth,
          api.getSnapshot,
        ),
      isCurrent,
      (snapshot) => {
        sequence.current++;
        skipNextReload.current = true;
        setData(snapshot);
        setMonth(snapshot.month);
        setMode("live");
        setLoading(false);
        setError("");
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback((): Promise<void> => {
    const current = ++sequence.current;
    const request =
      mode === "demo"
        ? Promise.resolve().then(() => demoSnapshot(demo, month))
        : api.getSnapshot(month);
    return request
      .then((result) => {
        if (current === sequence.current) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (current === sequence.current)
          setError(e instanceof Error ? e.message : "Falha ao carregar.");
      })
      .finally(() => {
        if (current === sequence.current) setLoading(false);
      });
  }, [demo, mode, month]);
  useEffect(() => {
    if (skipNextReload.current) {
      skipNextReload.current = false;
      return;
    }
    void reload();
  }, [reload]);
  useEffect(() => {
    if (mode !== "live") return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => listener.remove();
  }, [mode, reload]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (mode !== "live" || !data || data.month !== month) return;
    void AsyncStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        server: api.serverUrl(),
        username: data.user.username,
        month,
      }),
    ).catch(() => {});
  }, [mode, month, data]);

  async function run(operation: string, payload: Payload) {
    if (working.current) return;
    userIntent.current++;
    const initiatingFormId = form?.id;
    working.current = true;
    setBusy(true);
    setError("");
    const fingerprint = JSON.stringify([operation, payload]);
    const key = pending.current.get(fingerprint) || newKey();
    pending.current.set(fingerprint, key);
    try {
      let result: Payload | undefined;
      if (mode === "demo") {
        const updated = demoCommand(
          materializeDemo(demoRef.current, month),
          operation,
          payload,
        );
        await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(updated));
        demoRef.current = updated;
        setDemo(updated);
        if (operation === "create_goal")
          result = { id: updated.goals[updated.goals.length - 1].id };
      } else {
        result = await api.command(operation, payload, key);
        await reload();
      }
      pending.current.delete(fingerprint);
      setForm((current) => (current?.id === initiatingFormId ? null : current));
      setNotice(
        mode === "demo" ? "Salvo nesta demonstração." : "Operação registrada.",
      );
      return result;
    } catch (e) {
      if (e instanceof api.ApiError && e.status >= 400 && e.status < 500)
        pending.current.delete(fingerprint);
      const message =
        e instanceof Error ? e.message : "Não foi possível salvar.";
      setError(message);
      throw e;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function signIn(
    url: string,
    username: string,
    password: string,
    name?: string,
    email?: string,
  ) {
    userIntent.current++;
    await api.login(url, username, password, name, email);
    // Confirm the database and account work before leaving the isolated demo.
    const currentMonth = today().slice(0, 7);
    const initial = await api.getSnapshot(currentMonth);
    sequence.current++;
    skipNextReload.current = true;
    setData(initial);
    setMonth(currentMonth);
    setMode("live");
    setForm(null);
    setError("");
  }
  async function signOut() {
    userIntent.current++;
    try {
      await api.logout();
    } finally {
      sequence.current++;
      setData(demoSnapshot(demoRef.current, "2027-01"));
      setMode("demo");
      setMonth("2027-01");
      pending.current.clear();
    }
  }
  return (
    <AppContext.Provider
      value={{
        mode,
        month,
        setMonth: (value) => {
          userIntent.current++;
          if (mode === "demo")
            void AsyncStorage.setItem(DEMO_MONTH_KEY, value).catch(() => {});
          setLoading(true);
          setMonth(value);
        },
        data,
        loading,
        busy,
        error,
        notice,
        hidden,
        setHidden,
        form,
        openForm: (operation, defaults) => {
          if (working.current) return;
          userIntent.current++;
          setError("");
          setForm({ id: newKey(), operation, defaults });
        },
        closeForm: () => setForm(null),
        run,
        notify: setNotice,
        reload,
        signIn,
        signOut,
        clearError: () => setError(""),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppProvider ausente.");
  return ctx;
}
