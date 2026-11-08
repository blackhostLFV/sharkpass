import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, theme } from "../../ui";
export default function Layout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.card,
          height: 68 + insets.bottom,
          paddingTop: 5,
          paddingBottom: Math.max(5, insets.bottom),
        },
        tabBarLabelStyle: {
          fontFamily: "Manrope_500Medium",
          fontSize: 11,
          lineHeight: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Mis entradas",
          tabBarIcon: ({ color }) => <Icon name="ticket" color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favoritos",
          tabBarIcon: ({ color }) => <Icon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <Icon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
