import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { demoEvents, price, useApp, type Event } from "../lib/state";
import {
  BackHeader,
  Button,
  Cover,
  Demo,
  Field,
  Screen,
  State,
  T,
  Title,
  theme,
  ui,
} from "../ui";
export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, user, demo } = useApp();
  const [event, setEvent] = useState<Event | null>(null),
    [selected, setSelected] = useState(""),
    [quantity, setQuantity] = useState(1),
    [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState(false);
  const key = useRef(Crypto.randomUUID());
  useEffect(() => {
    let active = true;
    if (demo) {
      const example = demoEvents.find((item) => item.id === id);
      if (example) {
        setEvent({
          ...example,
          types: [
            {
              id: "demo-general",
              name: "General · DEMO",
              price_cop: example.price_cop ?? 0,
              available: 0,
            },
          ],
        });
        setSelected("demo-general");
      }
      return () => {
        active = false;
      };
    }
    if (!demo)
      Promise.all([
        api<Event>(`events/${id}`),
        api<{ paymentsConfigured: boolean }>("me"),
      ])
        .then(([data, info]) => {
          if (active) {
            setEvent(data);
            setSelected(data.types?.[0]?.id ?? "");
            setConfigured(info.paymentsConfigured);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [api, id, demo]);
  const type = event?.types?.find((item) => item.id === selected);
  const submit = async () => {
    if (!user) {
      router.replace({ pathname: "/auth", params: { returnEvent: id } });
      return;
    }
    if (demo || !type) return;
    setBusy(true);
    setError("");
    try {
      if (type.price_cop > 0) {
        const payment = await api<{ id: string }>(
          "payments/checkout",
          "POST",
          { eventId: id, typeId: type.id, quantity, email },
          { "Idempotency-Key": key.current },
        );
        router.replace({ pathname: "/payment", params: { id: payment.id } });
      } else {
        const order = await api<{ id: string }>(
          "orders",
          "POST",
          { eventId: id, typeId: type.id, quantity },
          { "Idempotency-Key": key.current },
        );
        router.replace({ pathname: "/order", params: { id: order.id } });
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la compra.",
      );
    } finally {
      setBusy(false);
    }
  };
  const footer = event ? (
    <View
      style={{
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: theme.card,
        backgroundColor: theme.background,
      }}
    >
      <Button
        label={
          demo
            ? "Sin venta · Evento DEMO"
            : !user
              ? "Iniciar sesión para continuar"
              : busy
                ? "Preparando…"
                : type?.price_cop
                  ? "Continuar con Wompi"
                  : "Confirmar entradas gratuitas"
        }
        disabled={
          demo ||
          busy ||
          !type ||
          type.available < 1 ||
          (!!user && type.price_cop > 0 && (!configured || !email))
        }
        onPress={() => void submit()}
      />
    </View>
  ) : undefined;
  return (
    <Screen footer={footer}>
      <BackHeader title="Revisar entradas" />
      {!event ? (
        <State loading={!error} error={error} retry={() => router.back()} />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              gap: 16,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: theme.surface,
              alignItems: "center",
            }}
          >
            <View style={{ width: 100, height: 98, overflow: "hidden" }}>
              <Cover event={event} />
            </View>
            <View style={{ flex: 1, gap: 2, paddingRight: 4 }}>
              <T
                numberOfLines={2}
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 18,
                  lineHeight: 26,
                }}
              >
                {event.title}
              </T>
              <T
                numberOfLines={1}
                style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}
              >
                {event.venue}
              </T>
              <T
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 18,
                  lineHeight: 24,
                }}
              >
                {price(type?.price_cop ?? 0)}
              </T>
            </View>
          </View>
          <Title>Tipo de entrada</Title>
          {event.types?.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: item.id === selected }}
              onPress={() => {
                setSelected(item.id);
                setQuantity(1);
                key.current = Crypto.randomUUID();
              }}
              style={[
                ui.box,
                {
                  borderWidth: 1,
                  borderColor: item.id === selected ? theme.accent : theme.line,
                },
              ]}
            >
              <T>{item.name}</T>
              <T>
                {price(item.price_cop)} ·{" "}
                {demo
                  ? "Solo ejemplo, sin venta"
                  : `${item.available} disponibles`}
              </T>
            </Pressable>
          ))}
          <Title>Detalle</Title>
          <View
            style={[
              ui.header,
              {
                borderBottomWidth: 1,
                borderBottomColor: theme.line,
                paddingBottom: 16,
              },
            ]}
          >
            <T style={{ color: theme.muted }}>Cantidad</T>
            <View
              style={{ flexDirection: "row", gap: 20, alignItems: "center" }}
            >
              <Pressable
                accessibilityLabel="Quitar una entrada"
                accessibilityRole="button"
                onPress={() => {
                  setQuantity((n) => Math.max(1, n - 1));
                  key.current = Crypto.randomUUID();
                }}
              >
                <T style={{ fontSize: 24 }}>−</T>
              </Pressable>
              <T>{quantity}</T>
              <Pressable
                accessibilityLabel="Añadir una entrada"
                accessibilityRole="button"
                onPress={() => {
                  setQuantity((n) =>
                    Math.min(6, demo ? 6 : (type?.available ?? 1), n + 1),
                  );
                  key.current = Crypto.randomUUID();
                }}
              >
                <T style={{ fontSize: 24 }}>+</T>
              </Pressable>
            </View>
          </View>
          <View style={ui.header}>
            <T>Total</T>
            <T style={{ fontFamily: "Manrope_700Bold", fontSize: 18 }}>
              {price((type?.price_cop ?? 0) * quantity)}
            </T>
          </View>
          {!!type && type.price_cop > 0 && (
            <>
              <Title>Pago seguro</Title>
              <View style={ui.box}>
                <T>Wompi</T>
                <T style={{ color: theme.muted, fontSize: 12 }}>
                  {configured
                    ? "Continuarás en el checkout seguro de Wompi."
                    : "Wompi pendiente de configuración. Venta no habilitada."}
                </T>
              </View>
              <Field
                label="Correo para tus entradas"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}
          {!!error && <T accessibilityRole="alert">{error}</T>}

          <T style={{ color: theme.muted, fontSize: 12 }}>
            Revisa el total antes de continuar. Tus entradas pagadas aparecerán
            cuando Wompi confirme el pago.
          </T>
        </>
      )}
      <Demo />
    </Screen>
  );
}
