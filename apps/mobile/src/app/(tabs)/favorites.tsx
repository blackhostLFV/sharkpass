import { useApp, useEvents } from "../../lib/state";
import { Demo, EventCard, Screen, State, T, Title, theme } from "../../ui";
export default function Favorites() {
  const { favorites } = useApp();
  const resource = useEvents();
  const items = resource.items.filter((item) => favorites.includes(item.id));
  return (
    <Screen>
      <Title>Favoritos</Title>
      <T style={{ color: theme.muted, fontSize: 12 }}>
        Guardados en este dispositivo.
      </T>
      <State {...resource} />
      {items.map((event) => (
        <EventCard key={event.id} event={event} compact />
      ))}
      {!items.length && !resource.loading && (
        <T>Toca el corazón de un evento para encontrarlo aquí.</T>
      )}
      <Demo />
    </Screen>
  );
}
