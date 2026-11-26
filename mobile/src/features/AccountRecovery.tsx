import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Muted, colors } from "../components/ui";
import { confirmAccountLink, recoverAccount, demoOnly } from "../lib/api";

export default function AccountRecovery({
  kind,
}: {
  kind: "recover" | "reset" | "verify";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [link] = useState<Record<string, string>>(() =>
    typeof window === "undefined"
      ? {}
      : Object.fromEntries(new URLSearchParams(window.location.hash.slice(1))),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const values = Object.fromEntries(
      new URLSearchParams(window.location.hash.slice(1)),
    );
    if (values.uid && values.token) {
      // Tokens stay in memory, outside server logs, referrers and browser storage.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  async function submit() {
    if (busy || demoOnly) return;
    setBusy(true);
    setMessage("");
    try {
      const result =
        kind === "recover"
          ? await recoverAccount(email)
          : await confirmAccountLink(kind, {
              ...link,
              ...(kind === "reset"
                ? { password, password_confirm: confirmation }
                : {}),
            });
      setPassword("");
      setConfirmation("");
      setMessage(result.message);
      setDone(true);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Não foi possível continuar.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    color: colors.ink,
  };
  return (
    <Screen
      title={
        kind === "recover"
          ? "Recuperar acesso"
          : kind === "reset"
            ? "Nova senha"
            : "Confirmar e-mail"
      }
      subtitle="Proteja o acesso à sua conta."
      showMonth={false}
      onBack={() => router.replace("/settings?section=account")}
    >
      <View style={{ gap: 16 }}>
        {demoOnly ? (
          <Muted>
            Recuperação e contas pessoais não estão disponíveis neste preview.
          </Muted>
        ) : (
          !done && (
            <>
              {kind === "recover" ? (
                <>
                  <Muted>Informe seu e-mail para receber as instruções.</Muted>
                  <TextInput
                    accessibilityLabel="E-mail de recuperação"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    style={input}
                  />
                </>
              ) : !link.token ? (
                <Muted>
                  Abra o link recebido por e-mail. Ele pode ter expirado ou já
                  ter sido utilizado.
                </Muted>
              ) : kind === "reset" ? (
                <>
                  <TextInput
                    accessibilityLabel="Nova senha"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="new-password"
                    style={input}
                  />
                  <TextInput
                    accessibilityLabel="Confirmar nova senha"
                    value={confirmation}
                    onChangeText={setConfirmation}
                    secureTextEntry
                    autoComplete="new-password"
                    style={input}
                  />
                </>
              ) : (
                <Muted>Confirme para vincular este endereço à sua conta.</Muted>
              )}
              <Button
                title={
                  busy
                    ? "Aguarde…"
                    : kind === "recover"
                      ? "Enviar instruções"
                      : kind === "reset"
                        ? "Salvar nova senha"
                        : "Confirmar meu e-mail"
                }
                onPress={() => void submit()}
                disabled={
                  busy ||
                  (kind === "recover"
                    ? !email.trim()
                    : !link.token ||
                      (kind === "reset" &&
                        (!password || password !== confirmation)))
                }
              />
            </>
          )
        )}
        {!!message && (
          <Text accessibilityRole="alert" style={{ color: colors.ink }}>
            {message}
          </Text>
        )}
        {done && (
          <Button
            title="Entrar na minha conta"
            onPress={() => router.replace("/settings?section=account")}
          />
        )}
      </View>
    </Screen>
  );
}
