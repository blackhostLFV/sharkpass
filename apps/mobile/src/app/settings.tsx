import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { API_URL, useApp } from "../lib/state";
import { BackHeader, Button, Field, Screen, T, theme } from "../ui";
export default function Settings() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const { api, user, updateProfile } = useApp();
  const [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [fullName, setFullName] = useState(""),
    [phone, setPhone] = useState("");
  useEffect(() => {
    let active = true;
    if (section === "account" && user)
      api<{ fullName: string; phone: string }>("account/profile")
        .then((profile) => {
          if (active) {
            setFullName(profile.fullName);
            setPhone(profile.phone);
          }
        })
        .catch((error) => {
          if (active) setMessage(error.message);
        });
    return () => {
      active = false;
    };
  }, [api, user?.id, section]);
  const save = async () => {
    try {
      await updateProfile(fullName, phone);
      setMessage("Perfil actualizado.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos guardar los cambios.",
      );
    }
  };
  const verify = async () => {
    try {
      const result = await api<{ message: string }>("account/email", "POST", {
        email,
      });
      setMessage(result.message);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos completar la solicitud.",
      );
    }
  };
  return (
    <Screen>
      <BackHeader
        title={
          section === "account"
            ? "Datos de la cuenta"
            : section === "security"
              ? "Seguridad"
              : section === "organizer"
                ? "Organizar un evento"
                : "Información"
        }
      />
      {section === "account" ? (
        <>
          <T>Usuario: {user?.username ?? "Sin sesión"}</T>
          <Field
            label="Nombre completo"
            value={fullName}
            onChangeText={setFullName}
            maxLength={120}
          />
          <Field
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={24}
          />
          <Button label="Guardar cambios" onPress={() => void save()} />
          <Field
            label="Correo de recuperación"
            placeholder="Tu correo"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button label="Enviar verificación" onPress={() => void verify()} />
          <T style={{ color: theme.muted }}>
            Requiere que el servicio de correo esté configurado.
          </T>
        </>
      ) : section === "security" ? (
        <T>
          La sesión caduca a las 12 horas. Puedes recuperar tu contraseña desde
          el acceso si verificaste tu correo y el servicio está habilitado. No
          compartas el QR de tus entradas.
        </T>
      ) : section === "organizer" ? (
        <>
          <T>
            La gestión de organizadores y el control de ingreso se realizan
            desde la web de SharkPass.
          </T>
          <Button
            label="Abrir espacio del organizador"
            onPress={() =>
              void Linking.openURL(`${API_URL}/?view=organizer`).catch(() =>
                setMessage("No pudimos abrir la web."),
              )
            }
          />
        </>
      ) : (
        <T>
          SharkPass gestiona tus entradas y su acceso al evento. La información
          legal y el canal de ayuda todavía no están publicados en esta versión
          de demostración.
        </T>
      )}
      {!!message && <T accessibilityRole="alert">{message}</T>}
    </Screen>
  );
}
