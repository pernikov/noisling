import { randomBytes } from 'crypto';

export function createId() {
  return randomBytes(12).toString('hex');
}

export function toIsoDate(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function parseJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function deepGet(object, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], object);
}

export function deepSet(object, path, value) {
  const keys = String(path).split('.');
  let current = object;
  for (const key of keys.slice(0, -1)) {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  }
  current[keys.at(-1)] = value;
}

export function deepUnset(object, path) {
  const keys = String(path).split('.');
  let current = object;
  for (const key of keys.slice(0, -1)) {
    current = current?.[key];
    if (!current || typeof current !== 'object') return;
  }
  delete current[keys.at(-1)];
}

export function cloneDoc(doc) {
  return doc ? JSON.parse(JSON.stringify(doc)) : doc;
}

export function matchesFilter(doc, filter = {}) {
  return Object.entries(filter ?? {}).every(([field, expected]) => {
    if (field === '$or') return expected.some((entry) => matchesFilter(doc, entry));
    if (field === '$and') return expected.every((entry) => matchesFilter(doc, entry));

    const actual = deepGet(doc, field);

    if (expected instanceof RegExp) return valueMatchesRegex(actual, expected);

    if (expected && typeof expected === 'object' && !Array.isArray(expected) && !(expected instanceof Date)) {
      return Object.entries(expected).every(([op, value]) => {
        if (op === '$in') {
          const values = Array.isArray(actual) ? actual.map(String) : [String(actual)];
          return value.map(String).some((candidate) => values.includes(candidate));
        }
        if (op === '$ne') return actual !== value;
        if (op === '$nin') return !value.includes(actual);
        if (op === '$gt') return actual > value;
        if (op === '$gte') return actual >= value;
        if (op === '$lt') return actual < value;
        if (op === '$lte') return actual <= value;
        return false;
      });
    }

    if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
    return String(actual) === String(expected);
  });
}

function valueMatchesRegex(actual, regex) {
  if (Array.isArray(actual)) return actual.some((value) => regex.test(String(value)));
  return regex.test(String(actual ?? ''));
}

export function applyUpdate(doc, update = {}, { isInsert = false } = {}) {
  const next = cloneDoc(doc) ?? {};

  if (!Object.keys(update).some((key) => key.startsWith('$'))) {
    return { ...next, ...update };
  }

  if (isInsert && update.$setOnInsert) {
    for (const [field, value] of Object.entries(update.$setOnInsert)) deepSet(next, field, value);
  }

  if (update.$set) {
    for (const [field, value] of Object.entries(update.$set)) deepSet(next, field, value);
  }

  if (update.$unset) {
    for (const field of Object.keys(update.$unset)) deepUnset(next, field);
  }

  if (update.$inc) {
    for (const [field, value] of Object.entries(update.$inc)) {
      deepSet(next, field, (deepGet(next, field) ?? 0) + value);
    }
  }

  for (const [field, value] of Object.entries(update).filter(([field]) => !field.startsWith('$'))) {
    deepSet(next, field, value);
  }

  if (update.$pull) {
    for (const [field, condition] of Object.entries(update.$pull)) {
      const current = deepGet(next, field);
      if (!Array.isArray(current)) continue;
      if (condition && typeof condition === 'object' && Array.isArray(condition.$in)) {
        const removals = new Set(condition.$in.map(String));
        deepSet(next, field, current.filter((value) => !removals.has(String(value))));
      } else {
        deepSet(next, field, current.filter((value) => String(value) !== String(condition)));
      }
    }
  }

  return next;
}

export class Query {
  constructor(load, { hydrate = (doc) => doc, single = false } = {}) {
    this.load = load;
    this.hydrate = hydrate;
    this.single = single;
    this.sortSpec = null;
    this.skipCount = 0;
    this.limitCount = null;
    this.projection = null;
    this.useLean = false;
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  skip(count) {
    this.skipCount = count;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  select(fields) {
    this.projection = Object.fromEntries(String(fields).split(/\s+/).filter(Boolean).map((field) => [field, 1]));
    return this;
  }

  lean() {
    this.useLean = true;
    return this;
  }

  async exec() {
    let docs = await this.load();
    if (this.single) docs = docs ? [docs] : [];
    docs = docs.map(cloneDoc);

    if (this.sortSpec) docs.sort((a, b) => compareBySort(a, b, this.sortSpec));
    if (this.skipCount) docs = docs.slice(this.skipCount);
    if (this.limitCount !== null) docs = docs.slice(0, this.limitCount);
    if (this.projection) docs = docs.map((doc) => projectDoc(doc, this.projection));
    if (!this.useLean) docs = docs.map(this.hydrate);

    return this.single ? docs[0] ?? null : docs;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

function compareBySort(a, b, sortSpec) {
  for (const [field, direction] of Object.entries(sortSpec)) {
    const aValue = normalizeSortValue(deepGet(a, field));
    const bValue = normalizeSortValue(deepGet(b, field));
    if (aValue < bValue) return direction < 0 ? 1 : -1;
    if (aValue > bValue) return direction < 0 ? -1 : 1;
  }
  return 0;
}

function normalizeSortValue(value) {
  if (Array.isArray(value)) return String(value[0] ?? '').toLowerCase();
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function projectDoc(doc, projection) {
  const projected = {};
  for (const field of Object.keys(projection)) deepSet(projected, field, deepGet(doc, field));
  if (!('_id' in projected) && doc._id !== undefined) projected._id = doc._id;
  return projected;
}
