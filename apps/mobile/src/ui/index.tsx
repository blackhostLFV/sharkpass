import { Image } from "expo-image";
import { router } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextProps,
  type ColorValue,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { date, price, useApp, type Event } from "../lib/state";
export const theme = {
  background: "#0d0d0d",
  surface: "#131313",
  card: "#1a1a1a",
  text: "#ffffff",
  heading: "#ced2e6",
  muted: "#9aa4b3",
  line: "#2a3542",
  accent: "#78e2c5",
  ink: "#092c3a",
  font: "Manrope_400Regular",
};
const icons = {
  home: [require("../../assets/design/054e4.svg"), 24, 24],
  ticket: [require("../../assets/design/fd06a.svg"), 18.165, 19.91],
  heart: [require("../../assets/design/ad15b.svg"), 24, 24],
  profile: [require("../../assets/design/49f8c.svg"), 24, 24],
  back: [require("../../assets/design/37ea9.svg"), 24, 24],
  search: [require("../../assets/design/afe74.svg"), 16.8869, 17.2683],
  filters: [require("../../assets/design/2b6a9.svg"), 20, 20],
  pin: [require("../../assets/design/150e5.svg"), 16, 16],
  eye: [require("../../assets/design/91cf0.svg"), 24, 24],
  user: [require("../../assets/design/be649.svg"), 20, 20],
  lock: [require("../../assets/design/dda18.svg"), 20, 20],
  security: [require("../../assets/design/0c5d4.svg"), 20, 20],
  arrow: [require("../../assets/design/02221.svg"), 18, 18],
  logout: [require("../../assets/design/fa971.svg"), 20, 20],
} as const;
export function Icon({
  name,
  color,
}: {
  name: keyof typeof icons;
  color?: ColorValue;
}) {
  const [source, width, height] = icons[name];
  return (
    <Image
      source={source}
      style={{ width, height }}
      contentFit="contain"
      tintColor={typeof color === "string" ? color : undefined}
    />
  );
}
export function SocialOptions() {
  return (
    <View style={{ gap: 16, alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Image
          source={require("../../assets/design/90f22.svg")}
          style={{ width: 115.5, height: 1 }}
        />
        <T style={{ fontSize: 12, color: theme.muted }}>Continuar con</T>
        <Image
          source={require("../../assets/design/90f22.svg")}
          style={{ width: 115.5, height: 1 }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        {[
          { name: "Google", source: require("../../assets/design/9c3b7.svg") },
          { name: "Apple", source: require("../../assets/design/269f3.svg") },
          {
            name: "Facebook",
            source: require("../../assets/design/1b00a.svg"),
          },
        ].map((item) => (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}: próximamente`}
            disabled
            style={{
              width: 56,
              height: 48,
              borderWidth: 1,
              borderColor: "#697586",
              borderRadius: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Image source={item.source} style={{ width: 24, height: 24 }} />
          </Pressable>
        ))}
      </View>
      <T style={{ fontSize: 10, color: theme.muted }}>
        Acceso social aún no disponible
      </T>
    </View>
  );
}
export function T({ style, ...props }: TextProps) {
  return <Text {...props} style={[ui.text, style]} />;
}
export function Title({ children }: PropsWithChildren) {
  return (
    <T accessibilityRole="header" style={ui.title}>
      {children}
    </T>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        ui.button,
        secondary && ui.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <T style={[ui.buttonLabel, secondary && { color: theme.accent }]}>
        {label}
      </T>
    </Pressable>
  );
}
export function Round({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon: keyof typeof icons;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={ui.round}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontSize: 14 }}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#697586"
        {...props}
        style={[ui.input, props.style]}
      />
    </View>
  );
}
export function Screen({
  children,
  footer,
  padded = true,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <SafeAreaView style={ui.root} edges={["top", "left", "right"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[ui.content, !padded && { paddingTop: 0 }]}
      >
        {children}
      </ScrollView>
      {footer && (
        <SafeAreaView
          edges={["bottom"]}
          style={{ backgroundColor: theme.background }}
        >
          {footer}
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}
export function Demo() {
  const { demo, setDemo } = useApp();
  return (
    <Pressable accessibilityRole="button" onPress={() => setDemo(!demo)}>
      <T style={ui.demo}>
        {demo
          ? "DEMO · Eventos ficticios, sin ventas. Ver catálogo real →"
          : "Catálogo real · Ver demostración visual →"}
      </T>
    </Pressable>
  );
}
export function State({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading) return <ActivityIndicator color={theme.accent} />;
  if (error)
    return (
      <View style={ui.box}>
        <T accessibilityRole="alert">{error}</T>
        <Button label="Reintentar" onPress={retry} />
      </View>
    );
  return null;
}
const covers = {
  rio: require("../../assets/demo/rio-abierto.jpg"),
  sabores: require("../../assets/demo/sabores-caribe.jpg"),
};
export function Cover({ event }: { event: Event }) {
  const source =
    event.image === "rio"
      ? covers.rio
      : event.image === "sabores"
        ? covers.sabores
        : require("../../assets/brand/sharkpass-official.png");
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit={event.image ? "cover" : "contain"}
      />
      {event.is_demo && <T style={ui.demoBadge}>DEMO · Imagen generada</T>}
    </View>
  );
}
export function EventCard({
  event,
  compact = false,
}: {
  event: Event;
  compact?: boolean;
}) {
  const { favorites, toggleFavorite } = useApp();
  const saved = favorites.includes(event.id);
  const amount =
    event.price_cop === undefined ? "Ver entradas" : price(event.price_cop);
  return (
    <View style={[compact ? ui.compact : ui.poster]}>
      {compact && (
        <View style={ui.dateBlock}>
          <T style={ui.dateDay}>{date(event.starts_at, { day: "2-digit" })}</T>
          <T style={ui.dateMonth}>
            {date(event.starts_at, { month: "short" })}
          </T>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver ${event.title}`}
        onPress={() =>
          router.push({ pathname: "/event/[id]", params: { id: event.id } })
        }
        style={compact ? ui.row : undefined}
      >
        <View style={compact ? ui.thumb : ui.cover}>
          <Cover event={event} />
          {!compact && (
            <T style={ui.dateBadge}>
              {date(event.starts_at, { day: "2-digit", month: "short" })}
            </T>
          )}
        </View>
        <View style={compact ? ui.rowInfo : ui.info}>
          <T numberOfLines={2} style={compact ? ui.rowTitle : ui.cardTitle}>
            {event.title}
          </T>
          <View style={ui.location}>
            <Icon name="pin" />
            <T numberOfLines={1} style={ui.meta}>
              {event.venue}
            </T>
          </View>
          <T style={ui.price}>{amount}</T>
        </View>
      </Pressable>
      {!compact && (
        <Pressable
          accessibilityLabel={`${saved ? "Quitar de" : "Añadir a"} favoritos: ${event.title}`}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          onPress={() => void toggleFavorite(event.id)}
          style={[ui.save, saved && { backgroundColor: "#21624e" }]}
        >
          <Icon name="heart" />
        </Pressable>
      )}
    </View>
  );
}
export function BackHeader({ title }: { title: string }) {
  return (
    <View style={ui.header}>
      <Round
        label="Volver"
        icon="back"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      />
      <T style={ui.headerTitle}>{title}</T>
      <View style={{ width: 40 }} />
    </View>
  );
}
export const ui = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: {
    padding: 20,
    paddingBottom: 36,
    gap: 20,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  text: {
    fontFamily: theme.font,
    color: theme.text,
    fontSize: 14,
    lineHeight: 22,
  },
  title: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    lineHeight: 28,
    color: theme.heading,
  },
  button: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
  },
  buttonLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 16,
    color: theme.ink,
  },
  secondary: { backgroundColor: theme.card },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 56,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
    color: theme.text,
    fontFamily: theme.font,
    fontSize: 16,
  },
  box: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  demo: {
    fontSize: 10,
    lineHeight: 16,
    color: theme.muted,
    paddingVertical: 8,
  },
  poster: {
    width: 231,
    padding: 8,
    borderRadius: 16,
    backgroundColor: theme.card,
    gap: 10,
  },
  cover: { height: 160, borderRadius: 10, overflow: "hidden" },
  info: { paddingTop: 10, gap: 6, paddingBottom: 4 },
  cardTitle: { fontFamily: "Manrope_500Medium", fontSize: 16, lineHeight: 24 },
  location: { flexDirection: "row", gap: 4, alignItems: "center" },
  meta: { fontSize: 12, color: theme.muted, flex: 1, lineHeight: 18 },
  price: { fontFamily: "Manrope_700Bold", fontSize: 12, lineHeight: 20 },
  dateBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "#0d0d0dcc",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 12,
  },
  demoBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    fontSize: 8,
    lineHeight: 14,
    backgroundColor: "#0d0d0dcc",
    paddingHorizontal: 5,
    borderRadius: 5,
  },
  save: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0d0d0dcc",
    justifyContent: "center",
    alignItems: "center",
  },
  compact: { width: "100%", flexDirection: "row", gap: 8, minHeight: 98 },
  dateBlock: {
    width: 36,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.accent,
    justifyContent: "flex-end",
  },
  dateDay: {
    textAlign: "center",
    color: theme.ink,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Manrope_500Medium",
  },
  dateMonth: {
    textAlign: "center",
    backgroundColor: theme.ink,
    color: theme.accent,
    fontSize: 12,
    paddingTop: 5,
    paddingBottom: 20,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
    gap: 12,
    backgroundColor: theme.surface,
  },
  thumb: {
    width: 100,
    alignSelf: "stretch",
    minHeight: 98,
    overflow: "hidden",
  },
  rowInfo: {
    flex: 1,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 4,
    justifyContent: "center",
  },
  rowTitle: { fontSize: 17, lineHeight: 24, fontFamily: "Manrope_600SemiBold" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { fontFamily: "Manrope_700Bold", fontSize: 18 },
});
