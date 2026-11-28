import assert from 'node:assert/strict';
import test from 'node:test';
import { readPosition } from '../server/messages.js';
import { createPeople } from '../server/people.js';
import { csvText } from '../server/positionLog.js';

const good = { type: 'position', id: 'abc', name: 'Sam', lat: 55, lon: -8, accuracy: 1.5, t: 1000, source: 'sim' };
const read = (changes) => readPosition(JSON.stringify({ ...good, ...changes }), 5);

test('accepts a good position and shortens long names', () => {
  assert.equal(read({ name: '  Alexandra ' }).position.name, 'Alexa');
});

test('refuses bad positions', () => {
  for (const changes of [{ lat: 91 }, { lon: '8' }, { accuracy: -1 }, { name: ' ' }, { id: 'a b' }, { source: 'x' }]) {
    assert.ok(read(changes).error, JSON.stringify(changes));
  }
  assert.ok(readPosition('not json', 5).error);
  assert.ok(readPosition('null', 5).error);
});

test('marks people as lost after a while, and limits numbers', () => {
  const people = createPeople({ colours: ['red', 'blue'], staleAfterS: 15, maxPeople: 1 });
  assert.deepEqual(people.update({ id: 'a' }, 0), { isNew: true });
  assert.deepEqual(people.update({ id: 'a' }, 1000), { isNew: false });
  assert.equal(people.update({ id: 'b' }, 1000), null);
  assert.equal(people.list(5000)[0].stale, false);
  assert.equal(people.list(17000)[0].stale, true);
});

test('keeps names safe in the CSV', () => {
  assert.equal(csvText('a "b", c'), '"a ""b"", c"');
  assert.equal(csvText('=1+1'), `"'=1+1"`);
});
