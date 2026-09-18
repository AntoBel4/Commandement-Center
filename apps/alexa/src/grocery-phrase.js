import {customTypes, normalizeField} from './grocery-dialog.js';

const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/-/g, ' ').trim().replace(/\s+/g, ' ');
const units = new Map(customTypes.find(type => type.name === 'UniteCourse').values.flatMap(({name}) =>
  [name.value, ...name.synonyms].map(alias => [fold(alias), name.value])));
const small = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix sept', 'dix huit', 'dix neuf'];
const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
function words(n) {
  if (n < 20) return small[n];
  if (n < 70) return tens[Math.floor(n / 10)] + (n % 10 ? (n % 10 === 1 ? ' et ' : ' ') + small[n % 10] : '');
  if (n < 80) return 'soixante' + (n === 71 ? ' et ' : ' ') + words(n - 60);
  return 'quatre vingt' + (n === 80 ? 's' : ' ' + words(n - 80));
}
const numbers = new Map(Array.from({length: 100}, (_, n) => [fold(words(n)), n]));
numbers.set('une', 1);
numbers.set('quatre vingt', 80);
function integer(text) {
  if (/^\d+$/.test(text)) return Number(text);
  if (numbers.has(text)) return numbers.get(text);
  const hundreds = /^(?:(un|deux|trois|quatre|cinq|six|sept|huit|neuf) )?cents?(?: (.+))?$/.exec(text);
  if (hundreds && (!hundreds[2] || numbers.has(hundreds[2]))) {
    return (hundreds[1] ? numbers.get(hundreds[1]) : 1) * 100 + (numbers.get(hundreds[2]) ?? 0);
  }
  return undefined;
}
function quantity(text) {
  text = fold(text);
  if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) return Number(text.replace(',', '.'));
  if (/^(?:un |une )?demi[e]?$/.test(text)) return 0.5;
  const decimal = text.split(' virgule ');
  if (decimal.length === 2) {
    const whole = integer(decimal[0]);
    const fraction = /^zero /.test(decimal[1]) ? '0' + integer(decimal[1].slice(5)) : String(integer(decimal[1]));
    if (whole !== undefined && /^\d{1,2}$/.test(fraction)) return Number(whole + '.' + fraction);
    return undefined;
  }
  return integer(text);
}

// SearchQuery must be the only slot in its utterance. Extract explicit details
// here, once at the start of an item; never guess an aisle from the product name.
export function parseArticle(text) {
  const draft = {name: text};
  const aisle = /^(.*?)\s+(?:(?:au|dans le)\s+)?rayon\s+(.+)$/i.exec(text);
  if (aisle?.[1].trim()) {
    const value = normalizeField('rayon', aisle[2]);
    if (value !== undefined) { draft.name = aisle[1].trim(); draft.rayon = value; }
  }
  const tokens = [...draft.name.matchAll(/\S+/g)];
  for (let i = 1; i < Math.min(tokens.length - 1, 9); i++) {
    const unit = units.get(fold(tokens[i][0]));
    if (!unit) continue;
    let amount = quantity(draft.name.slice(0, tokens[i].index).trim());
    if (amount === undefined) continue;
    let name = draft.name.slice(tokens[i].index + tokens[i][0].length).trim();
    const half = /^et demi[e]?\s+/i.exec(name);
    if (half) { amount += 0.5; name = name.slice(half[0].length); }
    name = name.replace(/^(?:de(?:\s+|$)|d['’])/i, '').trim();
    if (!name) break;
    draft.name = name;
    draft.unite = unit;
    const value = normalizeField('quantite', String(amount));
    if (value !== undefined) draft.quantite = value;
    break;
  }
  return draft;
}
