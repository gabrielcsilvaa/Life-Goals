import React from "react";
import { View } from "react-native";
import { usePathname } from "expo-router";
import { BottomNavigation } from "../features/dashboard/components";
import { dashboardTheme as theme } from "../design/dashboard";
export function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/") return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.wideBackground }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          backgroundColor: theme.color.background,
        }}
      >
        {children}
        {path !== "/goal" && <BottomNavigation />}
      </View>
    </View>
  );
}
