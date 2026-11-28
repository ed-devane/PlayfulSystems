// Who this walker is. Each browser tab is a separate person, and keeps its
// identity if reloaded. The name is remembered for next time.

export function getId() {
  let id = sessionStorage.getItem('gatewalk.id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('gatewalk.id', id);
  }
  return id;
}

export const savedName = () => localStorage.getItem('gatewalk.name') ?? '';
export const saveName = (name) => localStorage.setItem('gatewalk.name', name);
