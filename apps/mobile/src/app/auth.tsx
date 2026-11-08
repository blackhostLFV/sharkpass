import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../lib/state";
import {
  Button,
  Demo,
  Field,
  Icon,
  Screen,
  SocialOptions,
  T,
  theme,
} from "../ui";
export default function Auth() {
  const { mode: requestedMode, returnEvent } = useLocalSearchParams<{
    mode?: string;
    returnEvent?: string;
  }>();
  const height = useWindowDimensions().height;
  const insets = useSafeAreaInsets();
  const { login, demo, setDemo, api } = useApp();
  const [mode, setMode] = useState<"login" | "register" | "recover">(
      requestedMode === "register" ? "register" : "login",
    ),
    [username, setUsername] = useState(""),
    [fullName, setFullName] = useState(""),
    [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "recover") {
        if (demo) throw new Error("DEMO · No se enviarán correos.");
        const result = await api<{ message: string }>(
          "account/recovery-request",
          "POST",
          { email },
        );
        setError(result.message);
      } else {
        await login(
          username,
          password,
          mode === "register",
          mode === "register" ? { fullName, phone } : undefined,
        );
        if (returnEvent)
          router.replace({
            pathname: "/checkout",
            params: { id: returnEvent },
          });
        else router.replace("/profile");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la solicitud.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <View
        style={{
          minHeight: Math.max(640, height - insets.top - insets.bottom - 56),
          paddingTop: 12,
          gap: 28,
        }}
      >
        <View style={{ gap: 8 }}>
          <T
            accessibilityRole="header"
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 24,
              lineHeight: 36,
            }}
          >
            {mode === "login"
              ? "Bienvenido de nuevo 👋"
              : mode === "register"
                ? "Crea tu cuenta"
                : "¿Olvidaste tu contraseña?"}
          </T>
          <T style={{ color: theme.muted }}>
            {mode === "login"
              ? "Nos alegra verte. Vamos a empezar."
              : mode === "register"
                ? "Crea tu acceso y descubre experiencias."
                : "Recibirás un enlace en tu correo verificado, cuando el servicio de correo esté configurado."}
          </T>
        </View>
        <View style={{ gap: 14 }}>
          {mode === "recover" ? (
            <Field
              label="Correo verificado"
              placeholder="Escribe tu correo"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <>
              {mode === "register" && (
                <>
                  <Field
                    label="Nombre completo"
                    placeholder="Escribe tu nombre"
                    value={fullName}
                    onChangeText={setFullName}
                    maxLength={120}
                  />
                  <Field
                    label="Teléfono"
                    placeholder="Tu número con código de país"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={24}
                  />
                </>
              )}
              <Field
                label="Correo electrónico"
                placeholder="tu@correo.com"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                maxLength={254}
              />
              <View>
                <Field
                  label="Contraseña"
                  placeholder="Escribe tu contraseña"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!visible}
                  autoCapitalize="none"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  style={{ paddingRight: 48 }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    visible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  onPress={() => setVisible(!visible)}
                  style={{ position: "absolute", right: 12, bottom: 16 }}
                >
                  <Icon name="eye" />
                </Pressable>
              </View>
              {mode === "login" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setError("");
                    setMode("recover");
                  }}
                  style={{ alignSelf: "flex-end" }}
                >
                  <T style={{ color: theme.accent }}>
                    ¿Olvidaste tu contraseña?
                  </T>
                </Pressable>
              )}
              {mode === "register" && (
                <T style={{ fontSize: 12, color: theme.muted }}>
                  Al menos 10 caracteres. Entra con tu correo y contraseña.
                </T>
              )}
            </>
          )}
        </View>
        {!!error && (
          <T accessibilityRole="alert" style={{ color: theme.accent }}>
            {error}
          </T>
        )}
        <Button
          disabled={
            busy ||
            (mode === "register" &&
              (fullName.trim().length < 2 ||
                phone.replace(/\D/g, "").length < 10)) ||
            (mode !== "recover" && (!username || password.length < (mode === "register" ? 10 : 1)))
          }
          label={
            busy
              ? "Espera…"
              : mode === "login"
                ? "Iniciar sesión"
                : mode === "register"
                  ? "Crear cuenta"
                  : "Enviar enlace"
          }
          onPress={() => void submit()}
        />
        {mode === "login" && <SocialOptions />}
        <View
          style={{
            marginTop: "auto",
            flexDirection: "row",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <T style={{ color: theme.muted }}>
            {mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}
          </T>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError("");
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            <T style={{ color: theme.accent }}>
              {mode === "login" ? "Regístrate" : "Inicia sesión"}
            </T>
          </Pressable>
        </View>
        <Demo />
      </View>
    </Screen>
  );
}
