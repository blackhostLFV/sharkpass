import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../lib/state";
import { Button, T, theme } from "../ui";
const slides = [
  {
    title: "Descubre y vive\nla música en vivo",
    body: "Encuentra experiencias para vivir en persona.",
  },
  {
    title: "Tu próximo plan,\na un toque",
    body: "Explora eventos, consulta la fecha y elige tu entrada.",
  },
  {
    title: "Tu entrada,\nsiempre contigo",
    body: "Cuando tu compra esté confirmada, muestra tu QR al ingresar.",
  },
];
export default function Welcome() {
  const [step, setStep] = useState(0);
  const { completeOnboarding } = useApp();
  const finish = async () => {
    await completeOnboarding();
    router.replace("/");
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Image
        source={require("../../assets/demo/rio-abierto.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["#0d0d0d11", "#0d0d0d00", "#0d0d0d", "#0d0d0d"]}
        locations={[0, 0.4, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView
        style={{ flex: 1, padding: 20, justifyContent: "space-between" }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Image
            source={require("../../assets/brand/sharkpass-official.png")}
            style={{ width: 80, height: 80 }}
            contentFit="contain"
          />
          <Pressable accessibilityRole="button" onPress={() => void finish()}>
            <T style={{ color: theme.text }}>Omitir</T>
          </Pressable>
        </View>
        <View style={{ gap: 16 }}>
          <T style={{ fontSize: 9, textAlign: "center", color: theme.muted }}>
            DEMO · Ilustración generada
          </T>
          <T
            accessibilityRole="header"
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 24,
              lineHeight: 36,
              textAlign: "center",
            }}
          >
            {slides[step].title}
          </T>
          <T style={{ textAlign: "center" }}>{slides[step].body}</T>
          <View
            style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}
          >
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 8,
                  width: i === step ? 40 : 8,
                  borderRadius: 8,
                  backgroundColor: i === step ? theme.accent : "white",
                }}
              />
            ))}
          </View>
          <Button
            label={step === 2 ? "Empezar" : "Continuar"}
            onPress={() => (step === 2 ? void finish() : setStep(step + 1))}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void completeOnboarding().then(() =>
                router.replace({
                  pathname: "/auth",
                  params: { mode: "register" },
                }),
              )
            }
          >
            <T
              style={{
                textAlign: "center",
                paddingVertical: 8,
                color: theme.muted,
              }}
            >
              ¿Aún no tienes cuenta?{" "}
              <T style={{ color: theme.accent }}>Regístrate</T>
            </T>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
