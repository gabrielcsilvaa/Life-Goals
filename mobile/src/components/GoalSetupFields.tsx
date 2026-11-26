import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { travelArt } from "../design/goalArt";
import { dashboardTheme as theme } from "../design/dashboard";
import { colors } from "./ui";

export function GoalSetupFields({
  kind,
  setKind,
  destination,
  setDestination,
  cover,
  setCover,
}: {
  kind: string;
  setKind: (value: string) => void;
  destination: string;
  setDestination: (value: string) => void;
  cover: string;
  setCover: (value: string) => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Text
        style={{
          fontFamily: theme.font.medium,
          fontSize: 15,
          color: colors.ink,
        }}
      >
        Qual é o seu objetivo?
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          ["travel", "Viagem"],
          ["reserve", "Reserva"],
          ["other", "Outro"],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: kind === id }}
            onPress={() => setKind(id)}
            style={{
              minHeight: 44,
              paddingHorizontal: 18,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: kind === id ? colors.teal : colors.bg,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: theme.font.body,
                color: kind === id ? theme.color.onOlive : colors.ink,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {kind === "travel" && (
        <>
          <Text
            style={{
              fontFamily: theme.font.body,
              fontSize: 14,
              color: colors.ink,
            }}
          >
            Para onde quer viajar?
          </Text>
          <TextInput
            accessibilityLabel="Destino da viagem"
            value={destination}
            onChangeText={setDestination}
            placeholder="Ex.: Japão, Chile, Itália"
            placeholderTextColor={colors.muted}
            maxLength={65}
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 13,
              minHeight: 52,
              padding: 14,
              color: colors.ink,
              fontFamily: theme.font.body,
              fontSize: 16,
            }}
          />
          <Text
            style={{
              fontFamily: theme.font.body,
              fontSize: 14,
              color: colors.ink,
            }}
          >
            Capa da viagem
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {travelArt.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="radio"
                accessibilityLabel={`Capa ${a.label}`}
                accessibilityState={{ checked: cover === a.id }}
                onPress={() => setCover(a.id)}
                style={{
                  width: 110,
                  padding: 4,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: cover === a.id ? colors.teal : colors.line,
                  gap: 7,
                }}
              >
                <Image
                  source={a.source}
                  contentFit="cover"
                  style={{ width: "100%", height: 62, borderRadius: 7 }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: theme.font.body,
                    color: colors.ink,
                    paddingBottom: 4,
                  }}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
