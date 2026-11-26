import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import {
  useFonts,
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from "@expo-google-fonts/dm-serif-display";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Frame } from "../components/Frame";
import { CommandSheet } from "../components/CommandSheet";
import { AppProvider } from "../state/AppProvider";
import { GoalArtProvider } from "../design/goalArt";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <GoalArtProvider>
          <StartupShell />
        </GoalArtProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function StartupShell() {
  const [loaded, fontError] = useFonts({
    ...Ionicons.font,
    ...Feather.font,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
  });
  if (!loaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F7F0E8",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#344A35" />
      </View>
    );
  return (
    <>
      <StatusBar style="dark" />
      <Frame>
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </Frame>
      <CommandSheet />
    </>
  );
}
