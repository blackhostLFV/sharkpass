import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useEvents } from "../lib/state";
import {
  Demo,
  EventCard,
  Icon,
  Round,
  Screen,
  State,
  T,
  Title,
  theme,
} from "../ui";
export default function Search() {
  const resource = useEvents();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todos");
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const events = resource.items.filter(
    (item) =>
      (category === "Todos" || (item.category ?? "Eventos") === category) &&
      normalize(`${item.title} ${item.venue}`).includes(normalize(query)),
  );
  return (
    <Screen>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <Round label="Volver" icon="back" onPress={() => router.back()} />
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: theme.line,
            borderRadius: 24,
            height: 48,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <Icon name="search" />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Buscar eventos"
            placeholder="Busca un evento"
            placeholderTextColor={theme.muted}
            style={{
              flex: 1,
              color: theme.text,
              fontFamily: theme.font,
              fontSize: 12,
            }}
          />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          "Todos",
          ...new Set(resource.items.map((item) => item.category ?? "Eventos")),
        ].map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: item === category }}
            onPress={() => setCategory(item)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: item === category ? theme.accent : theme.line,
            }}
          >
            <T
              style={{ color: item === category ? theme.accent : theme.muted }}
            >
              {item}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      <Title>{query ? "Resultados de búsqueda" : "Descubre eventos"}</Title>
      <State {...resource} />
      <T style={{ color: theme.muted, fontSize: 12 }}>
        {events.length} eventos
      </T>
      {events.map((event) => (
        <EventCard key={event.id} event={event} compact />
      ))}
      {!events.length && !resource.loading && (
        <T>No encontramos eventos. Prueba otra búsqueda.</T>
      )}
      <Demo />
    </Screen>
  );
}
