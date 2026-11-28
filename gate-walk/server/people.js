// Keeps track of who is where. This is what the gates will read later.

export function createPeople({ colours, staleAfterS, maxPeople }) {
  const people = new Map(); // id -> latest position, colour and arrival time

  return {
    // Records a position. Returns whether this person is new, or null if full.
    update(position, now = Date.now()) {
      const known = people.get(position.id);
      if (!known && people.size >= maxPeople) return null;
      const colour = known?.colour ?? colours[people.size % colours.length];
      people.set(position.id, { ...position, colour, receivedAt: now });
      return { isNew: !known };
    },

    // Everyone, with how long ago they were heard from.
    list(now = Date.now()) {
      return [...people.values()].map(({ receivedAt, ...person }) => {
        const ageS = (now - receivedAt) / 1000;
        return { ...person, ageS, stale: ageS > staleAfterS };
      });
    },
  };
}
