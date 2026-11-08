import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { date, useApp, type Order } from "../../lib/state";
import { Button, Demo, Screen, State, T, Title, theme, ui } from "../../ui";
export default function Tickets() {
  const { api, user, demo } = useApp();
  const [items, setItems] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (user && !demo) {
      setLoading(true);
      api<Order[]>("orders")
        .then((data) => {
          if (active) setItems(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [api, user, demo, revision]);
  return (
    <Screen>
      <Title>Mis entradas</Title>
      <State
        loading={loading}
        error={error}
        retry={() => setRevision((n) => n + 1)}
      />
      {!user || demo ? (
        <View style={[ui.box, { minHeight: 300, justifyContent: "center" }]}>
          <T style={{ fontSize: 18, fontFamily: "Manrope_600SemiBold" }}>
            Tus experiencias, en un lugar
          </T>
          <T style={{ color: theme.muted }}>
            {demo
              ? "DEMO · No hay compras ni QR emitidos."
              : "Inicia sesión para consultar las entradas de tu cuenta."}
          </T>
          <Button label="Ir a mi cuenta" onPress={() => router.push("/auth")} />
        </View>
      ) : (
        items.map((order) => (
          <View key={order.id} style={ui.box}>
            <Title>{order.title}</Title>
            <T style={{ color: theme.muted, fontSize: 12 }}>
              {date(order.starts_at)} · {order.quantity} entrada(s)
            </T>
            <T>{order.state === "confirmed" ? "Confirmada" : "Cancelada"}</T>
            <Button
              label="Abrir entradas"
              onPress={() =>
                router.push({ pathname: "/order", params: { id: order.id } })
              }
            />
          </View>
        ))
      )}
      {user && !demo && !items.length && !loading && (
        <T>Aún no tienes entradas.</T>
      )}
      <Demo />
    </Screen>
  );
}
