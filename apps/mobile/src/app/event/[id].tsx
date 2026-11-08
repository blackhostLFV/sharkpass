import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { date, demoEvents, price, useApp, type Event } from "../../lib/state";
import {
  Button,
  Cover,
  Demo,
  Round,
  Screen,
  State,
  T,
  Title,
  theme,
  ui,
} from "../../ui";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { demo, api, toggleFavorite } = useApp();
  const [event, setEvent] = useState<Event | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    (demo
      ? Promise.resolve(demoEvents.find((item) => item.id === id) ?? null)
      : api<Event>(`events/${id}`)
    )
      .then((value) => {
        if (active) setEvent(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, demo, api, revision]);
  const footer = event ? (
    <View
      style={{
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: theme.card,
        backgroundColor: theme.background,
        gap: 12,
      }}
    >
      <T style={{ color: theme.muted, fontSize: 12 }}>
        {demo ? "Evento de demostración · Sin venta" : "Selecciona una entrada"}
      </T>
      <Button
        label={demo ? "Ver entrada de ejemplo" : "Elegir entradas"}
        disabled={!demo && !event.types?.some((type) => type.available > 0)}
        onPress={() =>
          router.push({ pathname: "/checkout", params: { id: event.id } })
        }
      />
    </View>
  ) : undefined;
  return (
    <Screen footer={footer}>
      <State
        loading={loading}
        error={error}
        retry={() => setRevision((n) => n + 1)}
      />
      {event && (
        <>
          <View
            style={{
              height: 340,
              marginHorizontal: -20,
              marginTop: -20,
              overflow: "hidden",
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
            }}
          >
            <Cover event={event} />
            <View
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                right: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Round
                label="Volver"
                icon="back"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
              />
              <T
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 18,
                  backgroundColor: "#0d0d0dcc",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                Detalle del evento
              </T>
              <Round
                label="Guardar evento"
                icon="heart"
                onPress={() => void toggleFavorite(event.id)}
              />
            </View>
          </View>
          <T
            accessibilityRole="header"
            style={{
              fontFamily: "Manrope_600SemiBold",
              fontSize: 18,
              lineHeight: 27,
            }}
          >
            {event.title}
          </T>
          <T style={{ color: theme.muted, fontSize: 12 }}>{event.venue}</T>
          <Title>Acerca del evento</Title>
          <T style={{ color: theme.muted }}>{event.description}</T>
          <Title>Fecha y lugar</Title>
          <View style={ui.box}>
            <T>{date(event.starts_at)}</T>
            <T style={{ color: theme.muted }}>{event.venue}</T>
            <T style={{ color: theme.muted }}>Organiza: {event.organizer}</T>
          </View>
          {event.types?.map((type) => (
            <View key={type.id} style={ui.box}>
              <T>{type.name}</T>
              <T>
                {price(type.price_cop)} · {type.available} disponibles
              </T>
            </View>
          ))}
          <Demo />
        </>
      )}
      {!event && !loading && !error && <T>Este evento no está disponible.</T>}
    </Screen>
  );
}
