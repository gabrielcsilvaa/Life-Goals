import { categoryKind } from "../lib/categoryRules";
import { router, useLocalSearchParams } from "expo-router";
import { dashboardTheme as theme } from "../design/dashboard";
import SettingsHub from "./SettingsHub";
import Planning from "./Planning";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as api from "../lib/api";
import { Connection } from "../lib/types";
import { useApp } from "../state/AppProvider";
import {
  Amount,
  Button,
  Card,
  Heading,
  Icon,
  Muted,
  Screen,
  colors,
} from "../components/ui";

export default function Settings() {
  const { section, register } = useLocalSearchParams<{
    section?: string;
    register?: string;
  }>();
  const { mode } = useApp();
  if (api.demoOnly && section)
    return (
      <Screen
        title="Demonstração online"
        subtitle="Preview com dados fictícios."
        showMonth={false}
        onBack={() => router.replace("/")}
      >
        <Muted>
          Contas pessoais ficam desativadas neste ambiente. Nenhuma conexão ao
          banco real é realizada.
        </Muted>
        <Button
          title="Explorar o exemplo"
          onPress={() => router.replace("/")}
        />
      </Screen>
    );
  if (!section) return <SettingsHub />;
  if (section === "cards") return <Planning />;
  return (
    <SettingsDetail
      key={`${mode}:${section}:${register || ""}`}
      section={section}
    />
  );
}
function SettingsDetail({ section }: { section: string }) {
  const params = useLocalSearchParams<{ register?: string }>();
  const { data, mode, signIn, signOut, hidden, setHidden, openForm } = useApp();
  const [url, setUrl] = useState(api.serverUrl()),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [name, setName] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [register, setRegister] = useState(params.register === "1"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]),
    [connectionName, setConnectionName] = useState(""),
    [write, setWrite] = useState(false);
  const [token, setToken] = useState(""),
    [revoke, setRevoke] = useState<Connection | null>(null);
  useEffect(() => {
    let current = true;
    if (mode !== "live") return;
    if (section === "mcp")
      void api
        .getConnections()
        .then((items) => {
          if (current) setConnections(items);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [mode, section]);
  async function auth() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(
        url,
        username.trim(),
        password,
        register ? name.trim() : undefined,
        register ? email.trim() : undefined,
      );
      setPassword("");
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.createConnection(connectionName, write);
      setToken(result.token);
      setConnectionName("");
      setConnections(await api.getConnections());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar conexão.");
    } finally {
      setBusy(false);
    }
  }
  async function confirmRevoke() {
    if (!revoke || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.revokeConnection(revoke.id);
      setRevoke(null);
      setConnections(await api.getConnections());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao revogar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={
        section === "accounts"
          ? "Minhas contas"
          : section === "categories"
            ? "Categorias"
            : section === "mcp"
              ? "Conexões com IA"
              : "Minha conta"
      }
      subtitle={
        section === "account"
          ? "Seu perfil e suas preferências."
          : "Suas contas, preferências e conexões."
      }
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/settings")
      }
      showMonth={false}
    >
      {section === "account" && (
        <Card
          style={mode === "live" ? { borderWidth: 0, padding: 0 } : undefined}
        >
          <Heading
            title={
              mode === "demo"
                ? register
                  ? "Criar minha conta"
                  : "Entrar na minha conta"
                : data?.user.name || "Seu perfil"
            }
            detail={
              mode === "demo"
                ? register
                  ? "Sua conta começa vazia, sem importar o exemplo de 2027."
                  : "Acesse seus registros pessoais."
                : `@${data?.user.username || ""} · Conta pessoal`
            }
          />
          {mode === "demo" ? (
            <View style={{ gap: 15 }}>
              <Muted>
                Escolha seus dados de acesso ao Life Goals. Seus registros serão
                salvos na sua conta pessoal.
              </Muted>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdvanced(!advanced)}
                style={{ minHeight: 40, justifyContent: "center" }}
              >
                <Text
                  style={{
                    color: colors.muted,
                    fontFamily: theme.font.body,
                    fontSize: 12,
                  }}
                >
                  Configuração de conexão {advanced ? "−" : "+"}
                </Text>
              </Pressable>
              {[
                ...(__DEV__ && advanced
                  ? [["Servidor da API", url, setUrl]]
                  : []),
                ...(register
                  ? [
                      ["Seu nome", name, setName],
                      ["E-mail", email, setEmail],
                    ]
                  : []),
                ...(!register
                  ? [["E-mail ou usuário", username, setUsername]]
                  : []),
                ["Senha", password, setPassword],
              ].map(([label, value, setter]) => (
                <View key={String(label)} style={{ gap: 7 }}>
                  <Text style={styles.label}>{String(label)}</Text>
                  <TextInput
                    accessibilityLabel={String(label)}
                    style={styles.input}
                    value={String(value)}
                    onChangeText={setter as (v: string) => void}
                    autoCapitalize="none"
                    keyboardType={
                      label === "E-mail" ? "email-address" : "default"
                    }
                    autoCorrect={false}
                    secureTextEntry={label === "Senha"}
                    autoComplete={
                      label === "Senha"
                        ? register
                          ? "new-password"
                          : "current-password"
                        : label === "E-mail"
                          ? "email"
                          : label === "Usuário"
                            ? "username"
                            : "off"
                    }
                  />
                </View>
              ))}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <Button
                  title={
                    busy
                      ? "Conectando…"
                      : register
                        ? "Criar minha conta"
                        : "Entrar na minha conta"
                  }
                  disabled={
                    busy ||
                    (!register && !username.trim()) ||
                    !password ||
                    (register && (!name.trim() || !email.trim()))
                  }
                  onPress={() => void auth()}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setRegister(!register);
                    setError("");
                  }}
                >
                  <Text style={{ color: colors.teal, fontSize: 12 }}>
                    {register ? "Já tenho uma conta" : "Quero criar uma conta"}
                  </Text>
                </Pressable>
              </View>
              <Button
                title="Esqueci minha senha"
                secondary
                onPress={() => router.push("/recover-account")}
              />
            </View>
          ) : (
            <>
              <View style={{ gap: 16 }}>
                <Text selectable style={styles.label}>
                  {data?.user.email || "E-mail ainda não vinculado"}
                </Text>
                <Muted>
                  {data?.user.email_verified
                    ? "E-mail confirmado"
                    : "Confirme seu e-mail para recuperar a conta com segurança."}
                </Muted>
                {!data?.user.email_verified && (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.label}>
                      Vincular ou confirmar e-mail
                    </Text>
                    <TextInput
                      accessibilityLabel="E-mail para confirmação"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                    />
                    <TextInput
                      accessibilityLabel="Senha atual para confirmar e-mail"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      style={styles.input}
                    />
                    <Button
                      title="Enviar confirmação de e-mail"
                      secondary
                      disabled={!email.trim() || !password || busy}
                      onPress={() => {
                        setBusy(true);
                        void api
                          .bindEmail(email, password)
                          .then((r) => {
                            setError(r.message);
                            setPassword("");
                          })
                          .catch((e) => setError(e.message))
                          .finally(() => setBusy(false));
                      }}
                    />
                  </View>
                )}
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Icon name="shield-checkmark-outline" color={colors.teal} />
                  <Text style={styles.label}>Acesso individual</Text>
                </View>
                <Muted>Seus registros são salvos na sua conta pessoal.</Muted>
                <Text style={styles.label}>Preferências</Text>
                <Button
                  title={
                    hidden
                      ? "Mostrar valores financeiros"
                      : "Ocultar valores financeiros"
                  }
                  secondary
                  onPress={() => setHidden(!hidden)}
                />
                <Muted>
                  Fuso horário: {data?.user.timezone || "America/Sao_Paulo"}
                </Muted>
                <Button
                  title="Gerenciar conexões com IA"
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/settings",
                      params: { section: "mcp" },
                    })
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: advanced }}
                  onPress={() => setAdvanced(!advanced)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={styles.label}>
                    Configuração avançada {advanced ? "−" : "+"}
                  </Text>
                </Pressable>
                {advanced && (
                  <View style={{ gap: 8 }}>
                    <Muted>Servidor de dados</Muted>
                    <Text selectable style={styles.label}>
                      {api.serverUrl()}
                    </Text>
                    <Muted>
                      Altere a conexão somente ao entrar em uma conta.
                    </Muted>
                  </View>
                )}
              </View>
              <Button
                title="Sair da conta"
                secondary
                onPress={() => {
                  void signOut().catch(() =>
                    setError(
                      "Não foi possível confirmar a saída. Verifique a conexão e tente novamente.",
                    ),
                  );
                }}
              />
            </>
          )}
        </Card>
      )}
      {section === "accounts" && (
        <Button
          title="Próximo: minhas categorias"
          secondary
          onPress={() =>
            router.push({
              pathname: "/settings",
              params: { section: "categories" },
            })
          }
        />
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.red, padding: 12 }}
        >
          {error}
        </Text>
      )}
      {section === "accounts" && (
        <Card>
          <Heading
            title="Contas acompanhadas"
            detail="Saldos informados e movimentações registradas"
            action={
              <Button
                title="Adicionar conta"
                secondary
                onPress={() => openForm("create_account")}
              />
            }
          />
          {data?.accounts.map((a) => (
            <View
              key={a.id}
              style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
            >
              <Icon name="wallet-outline" color={colors.teal} />
              <Text style={{ flex: 1, color: colors.ink, fontSize: 13 }}>
                {a.name}
              </Text>
              <Amount value={a.balance} size={17} />
            </View>
          ))}
          {!data?.accounts.length && (
            <Muted>Cadastre uma conta e seu saldo inicial para começar.</Muted>
          )}
        </Card>
      )}
      {section === "categories" && (
        <Card>
          <Heading
            title="Categorias"
            detail="Uma organização que acompanha a sua rotina"
            action={
              <Button
                title="Nova categoria"
                secondary
                onPress={() => openForm("create_category")}
              />
            }
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {data?.categories.map((c) => (
              <View
                key={c.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.bg,
                  padding: 11,
                  borderRadius: 12,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: c.color,
                  }}
                />
                <Text style={{ fontSize: 12, color: colors.ink }}>
                  {c.name}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
      {section === "account" && mode === "live" && !data?.accounts.length && (
        <Card>
          <Heading
            title="Começar com um exemplo"
            detail="Opcional: importar previsões editáveis de 2027, sem pagamentos ou aportes inventados."
          />
          <Button
            title="Adicionar planejamento de exemplo"
            secondary
            onPress={() => openForm("load_example")}
          />
        </Card>
      )}
      {section === "categories" && !!data?.categories.length && (
        <Card>
          <Heading
            title="Editar categorias"
            detail="Os lançamentos mantêm os vínculos ao editar um nome."
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {data.categories.map((c) => (
              <Button
                key={c.id}
                title={c.name}
                secondary
                onPress={() =>
                  openForm("update_category", {
                    category_id: c.id,
                    kind: categoryKind(c),
                    name: c.name,
                    color: c.color,
                    archived: c.archived,
                  })
                }
              />
            ))}
          </View>
        </Card>
      )}
      {section === "mcp" && (
        <Card>
          <Heading
            title="Conexões com IA"
            detail="Opcional. O aplicativo funciona integralmente sem conectar uma IA."
          />
          <Muted>
            O servidor segue o protocolo MCP, independente de fornecedor.
            Claude, Codex e outros clientes podem se conectar quando suportam o
            transporte e a autenticação disponíveis. GPT ou DeepSeek precisam de
            um cliente com suporte a ferramentas MCP.
          </Muted>
          {mode === "demo" ? (
            <View
              style={{
                padding: 16,
                backgroundColor: colors.bg,
                borderRadius: 10,
                gap: 10,
              }}
            >
              <Icon name="link-outline" color={colors.teal} />
              <Text style={{ color: colors.ink, fontWeight: "500" }}>
                Nenhuma IA conectada
              </Text>
              <Muted>
                Entre na conta real para criar e revogar conexões. Você pode
                autorizar um cliente de IA por OAuth ou criar um token pessoal.
              </Muted>
            </View>
          ) : (
            <>
              {connections.map((c) => (
                <View
                  key={c.id}
                  style={{
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                    paddingVertical: 12,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.ink,
                      }}
                    >
                      {c.name}
                    </Text>
                    {!c.revoked_at && (
                      <Button
                        title="Revogar"
                        danger
                        onPress={() => setRevoke(c)}
                      />
                    )}
                  </View>
                  <Muted>
                    {c.scopes.includes("finance:write")
                      ? "Consultar e registrar finanças"
                      : "Somente consulta"}{" "}
                    ·{" "}
                    {c.revoked_at
                      ? "Revogada"
                      : new Date(c.expires_at) < new Date()
                        ? "Expirada"
                        : "Ativa"}
                  </Muted>
                  <Muted>
                    {c.last_used_at
                      ? `Último uso: ${new Date(c.last_used_at).toLocaleString("pt-BR")}`
                      : "Ainda não utilizada"}
                  </Muted>
                </View>
              ))}
              <Text style={styles.label}>Nome da nova conexão</Text>
              <TextInput
                accessibilityLabel="Nome da conexão MCP"
                value={connectionName}
                onChangeText={setConnectionName}
                placeholder="Ex.: Claude no notebook"
                style={styles.input}
                maxLength={80}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: write }}
                onPress={() => setWrite(!write)}
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <Icon
                  name={write ? "checkbox" : "square-outline"}
                  color={colors.teal}
                />
                <Text style={{ flex: 1, color: colors.ink, fontSize: 12 }}>
                  Permitir também registrar e editar dados financeiros
                </Text>
              </Pressable>
              <Muted>
                A conexão expira em 30 dias. Você pode revogá-la a qualquer
                momento. Ao criar, você autoriza as permissões selecionadas.
              </Muted>
              <Button
                title="Criar conexão MCP"
                disabled={!connectionName.trim() || busy}
                onPress={() => void create()}
              />
            </>
          )}
        </Card>
      )}
      <Modal
        visible={!!token || !!revoke}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setToken("");
          setRevoke(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView contentContainerStyle={{ gap: 20 }}>
              <Heading
                title={
                  token ? "Sua conexão foi criada" : "Revogar esta conexão?"
                }
              />
              <Muted>
                {token
                  ? "Este segredo só aparece uma vez. Guarde em um local seguro e configure no cliente escolhido. Não o compartilhe em conversas."
                  : `${revoke?.name} perderá o acesso. Os registros já criados serão preservados.`}
              </Muted>
              {!!token && (
                <Text selectable style={styles.secret}>
                  {token}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <Button
                  title={token ? "Guardei, fechar" : "Voltar"}
                  secondary
                  onPress={() => {
                    setToken("");
                    setRevoke(null);
                  }}
                />
                {!!revoke && (
                  <Button
                    title="Confirmar revogação"
                    disabled={busy}
                    danger
                    onPress={() => void confirmRevoke()}
                  />
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  label: { color: colors.ink, fontSize: 14, fontFamily: theme.font.body },
  input: {
    minHeight: 48,
    padding: 12,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#29251F88",
    padding: 25,
  },
  modal: {
    maxWidth: 500,
    width: "100%",
    padding: 25,
    borderRadius: 20,
    backgroundColor: colors.bg,
  },
  secret: {
    fontFamily: "monospace",
    fontSize: 13,
    padding: 15,
    backgroundColor: colors.bg,
    color: colors.ink,
  },
});
