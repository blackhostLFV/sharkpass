import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { useApp } from "../../lib/state";
import { Button, Demo, Icon, Screen, T, Title, theme } from "../../ui";
export default function Profile() {
  const { user, logout } = useApp();
  const row = (
    label: string,
    icon: "user" | "lock" | "security",
    section: string,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={() =>
        user
          ? router.push({ pathname: "/settings", params: { section } })
          : router.push("/auth")
      }
      style={{
        minHeight: 52,
        backgroundColor: theme.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon name={icon} />
      <T style={{ flex: 1, color: theme.heading }}>{label}</T>
      <Icon name="arrow" />
    </Pressable>
  );
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingVertical: 8,
        }}
      >
        <Image
          source={require("../../../assets/design/96b60.png")}
          style={{ width: 64, height: 64 }}
          contentFit="contain"
        />
        <View style={{ flex: 1 }}>
          <T style={{ fontFamily: "Manrope_700Bold", fontSize: 18 }}>
            {user?.fullName || user?.username || "Tu perfil"}
          </T>
          <T style={{ fontSize: 12, color: theme.muted }}>
            {user
              ? "Tu cuenta SharkPass"
              : "Inicia sesión para ver tus entradas"}
          </T>
        </View>
      </View>
      {!user && (
        <Button label="Iniciar sesión" onPress={() => router.push("/auth")} />
      )}
      <Title>General</Title>
      {row("Datos de la cuenta", "user", "account")}
      {row("Contraseña y acceso", "lock", "security")}
      <Title>Preferencias</Title>
      {row("Información y políticas", "security", "legal")}
      <Button
        label="Organizar un evento ↗"
        secondary
        onPress={() =>
          router.push({
            pathname: "/settings",
            params: { section: "organizer" },
          })
        }
      />
      {user && (
        <Button
          label="Cerrar sesión"
          secondary
          onPress={() =>
            void logout()
              .then(() => router.replace("/auth"))
              .catch((error) =>
                Alert.alert("No pudimos cerrar la sesión", error.message),
              )
          }
        />
      )}
      <Demo />
    </Screen>
  );
}
