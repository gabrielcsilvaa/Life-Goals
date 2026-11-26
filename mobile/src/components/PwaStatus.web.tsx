import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../state/AppProvider";
import { Button, colors } from "./ui";

export function PwaStatus() {
  const { busy, form } = useApp();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const updating = useRef(false);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    if ("serviceWorker" in navigator && !__DEV__) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaiting(worker);
            });
          });
        })
        .catch(() => {});
    }
    const changed = () => {
      if (updating.current) window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", changed);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      navigator.serviceWorker?.removeEventListener("controllerchange", changed);
    };
  }, []);
  if (!offline && !waiting) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.light, padding: 12, gap: 8 }}
    >
      {offline && (
        <Text style={{ color: colors.ink }}>
          Sem conexão. Operações financeiras precisam de internet.
        </Text>
      )}
      {!!waiting && (
        <Button
          title="Atualização disponível — atualizar"
          disabled={busy || !!form}
          secondary
          onPress={() => {
            updating.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
        />
      )}
    </View>
  );
}
