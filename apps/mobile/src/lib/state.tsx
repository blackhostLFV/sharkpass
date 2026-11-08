import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert, Platform } from "react-native";

export type Event = {
  id: string;
  title: string;
  description: string;
  venue: string;
  organizer: string;
  category?: string;
  starts_at: string;
  is_demo?: boolean;
  image?: string;
  price_cop?: number;
  types?: { id: string; name: string; price_cop: number; available: number }[];
};
export type Order = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  quantity: number;
  total_cop: number;
  state: string;
  is_demo: boolean;
  tickets?: { id: string; status: string }[];
};
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:3201" : "http://127.0.0.1:3201")
).replace(/\/$/, "");
const DEMO = process.env.EXPO_PUBLIC_DEMO !== "0";
export const demoEvents: Event[] = [
  {
    id: "demo-rio",
    title: "Río Abierto: música al atardecer",
    description:
      "Una tarde de música junto al río. Evento ficticio: no se realizará, no vende ni emite entradas.",
    venue: "Terraza del Río · Barranquilla · DEMO",
    organizer: "Organizador DEMO",
    category: "Música",
    starts_at: "2026-11-14T17:30:00-05:00",
    is_demo: true,
    image: "rio",
    price_cop: 0,
  },
  {
    id: "demo-sabores",
    title: "Sabores del Caribe: una mesa para compartir",
    description:
      "Sabores y recetas del Caribe. Evento ficticio para revisar el diseño, sin venta ni reservas.",
    venue: "Patio Caribe · Puerto Colombia · DEMO",
    organizer: "Organizador DEMO",
    category: "Gastronomía",
    starts_at: "2026-11-21T16:00:00-05:00",
    is_demo: true,
    image: "sabores",
    price_cop: 45000,
  },
];
export const date = (
  value: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "long",
    timeStyle: "short",
  },
) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    ...options,
  }).format(new Date(value));
export const price = (value: number) =>
  value === 0
    ? "Entrada libre"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(value);
type User = { id: string; username: string; fullName?: string };
type State = {
  demo: boolean;
  setDemo: (value: boolean) => void;
  user: User | null;
  ready: boolean;
  onboarded: boolean;
  completeOnboarding: () => Promise<void>;
  api: <T>(
    path: string,
    method?: string,
    body?: unknown,
    extra?: Record<string, string>,
  ) => Promise<T>;
  login: (
    username: string,
    password: string,
    register?: boolean,
    details?: { fullName: string; phone: string },
  ) => Promise<void>;
  updateProfile: (fullName: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  favorites: string[];
  toggleFavorite: (id: string) => Promise<void>;
  token: string | null;
};
const Context = createContext<State | null>(null);
const TOKEN = "sharkpass-session";
export function AppProvider({ children }: PropsWithChildren) {
  const [demo, setDemo] = useState(DEMO),
    [user, setUser] = useState<User | null>(null),
    [token, setToken] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [onboarded, setOnboarded] = useState(Platform.OS === "web"),
    [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (Platform.OS !== "web") {
          const seen = await SecureStore.getItemAsync("sharkpass-onboarded");
          const saved = await SecureStore.getItemAsync(TOKEN);
          const fav = await SecureStore.getItemAsync("sharkpass-favorites");
          if (active) {
            setOnboarded(seen === "1");
            setToken(saved);
            setFavorites(JSON.parse(fav ?? "[]"));
          }
        }
      } catch {
        if (active) {
          setToken(null);
          setFavorites([]);
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const api = useCallback(
    async <T,>(
      path: string,
      method = "GET",
      body?: unknown,
      extra: Record<string, string> = {},
    ): Promise<T> => {
      if (!__DEV__ && !API_URL.startsWith("https://"))
        throw new Error(
          "El servicio de SharkPass aún no está disponible. Vuelve a intentarlo más tarde.",
        );
      const response = await fetch(`${API_URL}/api/${path}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extra,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 && token && path !== "mobile/login") {
          setUser(null);
          setToken(null);
          if (Platform.OS !== "web")
            void SecureStore.deleteItemAsync(TOKEN).catch(() => {});
        }
        throw new Error(data.error ?? "No pudimos completar la solicitud.");
      }
      return data as T;
    },
    [token],
  );
  useEffect(() => {
    let active = true;
    if (!demo && ready)
      api<{ user: User | null }>("me")
        .then((data) => {
          if (active) setUser(data.user);
        })
        .catch(() => {
          if (active) setUser(null);
        });
    return () => {
      active = false;
    };
  }, [api, demo, ready]);
  const login = async (
    username: string,
    password: string,
    register = false,
    details?: { fullName: string; phone: string },
  ) => {
    if (demo)
      throw new Error("DEMO · Cambia al catálogo real para usar una cuenta.");
    if (Platform.OS === "web")
      throw new Error(
        "Esta es una vista de diseño. Abre la web de SharkPass para usar tu cuenta.",
      );
    if (register)
      await api("register", "POST", { email: username, password, ...details });
    const session = await api<{ token: string; user: User }>(
      "mobile/login",
      "POST",
      { email: username, password },
    );
    await SecureStore.setItemAsync(TOKEN, session.token);
    setToken(session.token);
    setUser(session.user);
    if(register){
      try {await api("account/email","POST",{email:username},{Authorization:`Bearer ${session.token}`});}
      catch {/* Account exists; verification can be requested from the profile. */}
    }
  };
  const updateProfile = async (fullName: string, phone: string) => {
    const profile = await api<{ fullName: string; phone: string }>(
      "account/profile",
      "PUT",
      { fullName, phone },
    );
    if (user) setUser({ ...user, fullName: profile.fullName });
  };
  const logout = async () => {
    await api("logout", "POST", {});
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(TOKEN);
    setToken(null);
    setUser(null);
  };
  const toggleFavorite = async (id: string) => {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id];
    try {
      if (Platform.OS !== "web")
        await SecureStore.setItemAsync(
          "sharkpass-favorites",
          JSON.stringify(next),
        );
    } catch {
      Alert.alert("No se pudo guardar", "Vuelve a intentarlo.");
      return;
    }

    setFavorites(next);
  };
  const completeOnboarding = async () => {
    if (Platform.OS !== "web")
      await SecureStore.setItemAsync("sharkpass-onboarded", "1");
    setOnboarded(true);
  };
  return (
    <Context.Provider
      value={{
        demo,
        setDemo,
        user,
        ready,
        onboarded,
        completeOnboarding,
        api,
        login,
        updateProfile,
        logout,
        favorites,
        toggleFavorite,
        token,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider missing");
  return value;
}
export function useEvents() {
  const { demo, api } = useApp();
  const [items, setItems] = useState<Event[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, reload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (demo ? Promise.resolve(demoEvents) : api<Event[]>("events"))
      .then((value) => {
        if (active) setItems(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo, api, revision]);
  return { items, error, loading, retry: () => reload((n) => n + 1) };
}
