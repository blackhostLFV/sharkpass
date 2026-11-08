import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { API_URL, date, useApp, type Order } from "../lib/state";
import { BackHeader, Demo, Screen, State, T, Title, ui, theme } from "../ui";
export default function Ticket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, user, token, demo } = useApp();
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (user && !demo)
      api<Order>(`orders/${id}`)
        .then((data) => {
          if (active) setOrder(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [api, user, demo, id, revision]);
  return (
    <Screen>
      <BackHeader title="Tu entrada" />
      {!user || demo ? (
        <T>Inicia sesión con tu cuenta real para abrir una entrada.</T>
      ) : (
        <State
          loading={!order && !error}
          error={error}
          retry={() => setRevision((n) => n + 1)}
        />
      )}{" "}
      {order && (
        <>
          <Title>{order.title}</Title>
          <T style={{ color: theme.muted }}>
            {date(order.starts_at)} · {order.venue}
          </T>
          {order.tickets?.map((ticket) => (
            <View
              key={ticket.id}
              style={[ui.box, { alignItems: "center", gap: 16 }]}
            >
              <Image
                source={require("../../assets/brand/sharkpass-official.png")}
                style={{ width: 80, height: 80 }}
                contentFit="contain"
              />
              <T style={{ fontFamily: "Manrope_700Bold" }}>
                {ticket.status === "valid"
                  ? "Entrada válida"
                  : ticket.status === "used"
                    ? "Entrada utilizada"
                    : "Entrada anulada"}
              </T>
              {ticket.status === "valid" && (
                <Image
                  source={{
                    uri: `${API_URL}/api/tickets/${ticket.id}/qr`,
                    headers: { Authorization: `Bearer ${token}` },
                  }}
                  style={{ width: 240, height: 240, backgroundColor: "white" }}
                  contentFit="contain"
                  cachePolicy="memory"
                />
              )}
              <T style={{ fontSize: 10, color: theme.muted }}>{ticket.id}</T>
              <T style={{ fontSize: 12 }}>
                Muestra este QR al ingresar. Es individual y admite un solo
                ingreso.
              </T>
            </View>
          ))}
        </>
      )}
      <Demo />
    </Screen>
  );
}
