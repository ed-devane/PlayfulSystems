// A very small test helper.

export const tests = [];

export const test = (name, run) => tests.push({ name, run });

export function equal(actual, expected, note = '') {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== e) throw new Error(`${note}\nexpected ${e}\n     got ${a}`);
}

export function ok(value, note = 'expected this to be true') {
  if (!value) throw new Error(note);
}
