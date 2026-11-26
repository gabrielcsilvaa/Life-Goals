import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <View style={{ flex: 1, padding: 32, justifyContent: "center", gap: 20 }}>
      <Text>Página não encontrada.</Text>
      <Link href="/">Voltar ao início</Link>
    </View>
  );
}
