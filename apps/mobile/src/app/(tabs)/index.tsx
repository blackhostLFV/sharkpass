import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useApp, useEvents } from "../../lib/state";
import {
  Button,
  Demo,
  EventCard,
  Icon,
  Round,
  Screen,
  State,
  T,
  Title,
  theme,
  ui,
} from "../../ui";
export default function Home() {
  const { user } = useApp();
  const resource = useEvents();
  const [category, setCategory] = useState("Todos");
  const wide = useWindowDimensions().width >= 900;
  const categories = [
    "Todos",
    ...new Set(resource.items.map((item) => item.category ?? "Eventos")),
  ];
  const events = resource.items.filter(
    (item) => category === "Todos" || (item.category ?? "Eventos") === category,
  );
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image
          source={require("../../../assets/design/2fff0.png")}
          style={{ width: 46.829, height: 48 }}
        />
        <View style={{ flex: 1 }}>
          <T
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 16,
              color: theme.heading,
            }}
          >
            {user
              ? `Hola, ${user.fullName || user.username}`
              : "Descubre con SharkPass"}
          </T>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Icon name="pin" />
            <T style={{ color: theme.muted }}>Barranquilla, Colombia</T>
          </View>
        </View>
        <Round
          label="Mi perfil"
          icon="profile"
          onPress={() => router.push("/profile")}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buscar eventos"
        onPress={() => router.push("/search")}
        style={{
          height: 40,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: theme.line,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
        }}
      >
        <Icon name="search" />
        <T style={{ fontSize: 12, color: theme.muted, flex: 1 }}>
          Busca un evento
        </T>
        <Icon name="filters" />
      </Pressable>
      <State {...resource} />
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 14 }}>
          <View style={ui.header}>
            <Title>Eventos destacados</Title>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/search")}
            >
              <T style={{ color: theme.accent }}>Ver todos</T>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {categories.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
                onPress={() => setCategory(item)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: category === item ? theme.accent : theme.line,
                  backgroundColor:
                    category === item ? theme.accent : "transparent",
                }}
              >
                <T
                  style={{ color: category === item ? theme.ink : theme.muted }}
                >
                  {item}
                </T>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 16 }}
          >
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ScrollView>
          {!events.length && !resource.loading && (
            <T style={{ color: theme.muted }}>
              Aún no hay eventos publicados en esta categoría.
            </T>
          )}
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 14 }}>
          <Title>Próximos eventos</Title>
          {[...events]
            .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
            .map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          <View style={ui.box}>
            <T style={{ fontFamily: "Manrope_600SemiBold" }}>
              Pitch Competition by Shark Caribe
            </T>
            <T style={{ color: theme.accent, fontSize: 12 }}>
              25 NOV · En preparación
            </T>
            <T style={{ color: theme.muted, fontSize: 12 }}>
              Hotel Dann Carlton Barranquilla · Salón Laureles. Hora, precios y
              cupos pendientes. Venta aún no habilitada.
            </T>
          </View>
        </View>
      </View>
      <Demo />
    </Screen>
  );
}
