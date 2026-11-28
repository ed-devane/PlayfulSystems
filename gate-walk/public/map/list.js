// The list of people above the map.

export function showList(element, people) {
  element.replaceChildren(...people.map((person) => {
    const item = document.createElement('li');
    item.classList.toggle('lost', person.stale);
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = person.stale ? '#888' : person.colour;
    const text = document.createElement('span');
    const practice = person.source === 'sim' ? ' (practice)' : '';
    const seen = person.stale ? `LOST, last heard ${Math.round(person.ageS)} s ago` : 'live';
    text.textContent = `${person.name}${practice}: ±${person.accuracy.toFixed(1)} m, ${seen}`;
    item.append(swatch, text);
    return item;
  }));
}
