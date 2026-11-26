import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "../state/AppProvider";
import { serverUrl } from "../lib/api";

export const travelArt = [
  {
    id: "europe",
    label: "Europa",
    source: require("../../assets/dashboard/italy.png"),
    match: /europa|it[aá]lia|roma|paris|fran[çc]a|portugal|espanha|londres/i,
  },
  {
    id: "africa",
    label: "África",
    source: require("../../assets/travel/africa.png"),
    match: /[aá]frica|marrocos|egito|nam[ií]bia|qu[eê]nia/i,
  },
  {
    id: "asia",
    label: "Ásia",
    source: require("../../assets/travel/asia.png"),
    match: /[aá]sia|jap[aã]o|kyoto|t[oó]quio|china|coreia|tail[aâ]ndia/i,
  },
  {
    id: "north-america",
    label: "América do Norte",
    source: require("../../assets/travel/north-america.png"),
    match:
      /am[eé]rica do norte|estados unidos|eua|canad[aá]|m[eé]xico|nova york|yosemite/i,
  },
  {
    id: "south-america",
    label: "América do Sul",
    source: require("../../assets/travel/south-america.png"),
    match:
      /am[eé]rica do sul|peru|machu picchu|brasil|argentina|chile|col[oô]mbia/i,
  },
  {
    id: "oceania",
    label: "Oceania",
    source: require("../../assets/travel/oceania.png"),
    match: /oceania|austr[aá]lia|sydney|nova zel[aâ]ndia/i,
  },
  {
    id: "antarctica",
    label: "Antártida",
    source: require("../../assets/travel/antarctica.png"),
    match: /ant[aá]rti[dc]a|polo sul/i,
  },
] as const;
const ArtContext = createContext<{
  covers: Record<string, string>;
  save: (id: string, cover: string) => Promise<void>;
} | null>(null);
// Cover choices are device preferences, scoped to the signed-in account and server.
// They are never sent as financial command fields or presented as synced data.
export function GoalArtProvider({ children }: { children: React.ReactNode }) {
  const { mode, data } = useApp();
  const scope = `lifegoals-covers-v1:${mode}:${mode === "live" ? `${serverUrl()}:${data?.user.username}` : "demo"}`;
  const [record, setRecord] = useState<{
    scope: string;
    covers: Record<string, string>;
  }>({ scope: "", covers: {} });
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(scope)
      .then((raw) => {
        if (active) {
          let covers: Record<string, string> = {};
          try {
            if (raw) covers = JSON.parse(raw);
          } catch {
            /* Keep name-based art on malformed local preferences. */
          }
          setRecord({ scope, covers });
        }
      })
      .catch(() => {
        if (active) setRecord({ scope, covers: {} });
      });
    return () => {
      active = false;
    };
  }, [scope]);
  const covers = record.scope === scope ? record.covers : {};
  async function save(id: string, cover: string) {
    const next = { ...covers, [id]: cover };
    await AsyncStorage.setItem(scope, JSON.stringify(next));
    setRecord({ scope, covers: next });
  }
  return (
    <ArtContext.Provider value={{ covers, save }}>
      {children}
    </ArtContext.Provider>
  );
}
export function useGoalArt(name: string, id: string) {
  const context = useContext(ArtContext);
  if (!context) throw new Error("GoalArtProvider ausente.");
  const selected = context.covers[id];
  const art =
    selected === "none"
      ? undefined
      : selected && selected !== "auto"
        ? travelArt.find((a) => a.id === selected)
        : travelArt.find((a) => a.match.test(name)) ||
          (/viagem|travel/i.test(name) ? travelArt[0] : undefined);
  return {
    art,
    selected: selected || "auto",
    save: (cover: string) => context.save(id, cover),
  };
}

export function useGoalArtStore() {
  const context = useContext(ArtContext);
  if (!context) throw new Error("GoalArtProvider ausente.");
  return context;
}
