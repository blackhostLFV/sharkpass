import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useApp, price } from "../lib/state";
import {
  BackHeader,
  Button,
  Demo,
  Screen,
  State,
  T,
  Title,
  theme,
} from "../ui";
type Payment = {
  id: string;
  state: string;
  checkoutUrl?: string;
  orderId?: string;
  totalCop: number;
  environment: string;
};
export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, user, demo } = useApp();
  const [payment, setPayment] = useState<Payment | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (user && !demo)
      api<Payment>(`payments/${id}`)
        .then((data) => {
          if (active) setPayment(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [api, user, demo, id, revision]);
  const refresh = async () => {
    try {
      await api(`payments/${id}/refresh`, "POST", {});
      setRevision((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos consultar el pago.",
      );
    }
  };
  return (
    <Screen>
      <BackHeader title="Estado del pago" />
      {!user || demo ? (
        <T>Consulta tus compras desde una cuenta real.</T>
      ) : (
        <State
          loading={!payment && !error}
          error={error}
          retry={() => setRevision((n) => n + 1)}
        />
      )}{" "}
      {payment && (
        <>
          <Title>
            {payment.state === "confirmed"
              ? "Pago confirmado"
              : payment.state === "pending"
                ? "Pago pendiente"
                : payment.state === "review"
                  ? "Pago en revisión"
                  : "Estado de tu pago"}
          </Title>
          <T>{price(payment.totalCop)}</T>
          {payment.environment === "test" && (
            <T style={{ color: theme.accent }}>SANDBOX · Sin dinero real.</T>
          )}
          <T style={{ color: theme.muted }}>
            Tus entradas aparecerán cuando Wompi confirme el pago. Si todavía
            está pendiente, vuelve a consultar el estado.
          </T>
          {payment.checkoutUrl && (
            <Button
              label="Abrir pago seguro Wompi"
              onPress={() =>
                void Linking.openURL(payment.checkoutUrl!).catch(() =>
                  setError("No pudimos abrir Wompi."),
                )
              }
            />
          )}
          <Button
            secondary
            label="Actualizar estado"
            onPress={() => void refresh()}
          />
          {payment.orderId && payment.state === "confirmed" && (
            <Button
              label="Ver mis entradas"
              onPress={() =>
                router.replace({
                  pathname: "/order",
                  params: { id: payment.orderId },
                })
              }
            />
          )}
        </>
      )}
      <Demo />
    </Screen>
  );
}
