// change when real data is used instead of mock
// tiny in-memory store so the lists table and the list detail page
// (separate routes) can share the same mock data

let lists = [];
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getLists() {
  return lists;
}

export function addList(list) {
  lists = [...lists, list];
  notify();
}

export function updateList(id, updater) {
  lists = lists.map((l) => (l.id === id ? updater(l) : l));
  notify();
}

export function removeList(id) {
  lists = lists.filter((l) => l.id !== id);
  notify();
}

export function subscribeLists(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
