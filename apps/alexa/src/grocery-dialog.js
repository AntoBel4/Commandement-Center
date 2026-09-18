// Store only the unfinished item in Alexa's signed session, never the linked token.
export const fields = ['quantite', 'unite', 'rayon'];
export const questions = {
  quantite: 'Quelle quantité ? Vous pouvez dire deux, ou passer.',
  unite: 'Quelle unité ? Par exemple pièce, paquet, kilo ou litre. Vous pouvez dire passer.',
  rayon: 'Quel rayon ? Fruits et légumes, frais, boulangerie, épicerie, maison ou autre. Vous pouvez dire passer.'
};
const fold = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, ' ').trim().replace(/\s+/g, ' ');
export const cleanText = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max && !/[\u0000-\u001f]/.test(value)
  ? value.trim().replace(/\s+/g, ' ') : undefined;
const unitGroups = [
  ['pièce', 'pièces', 'piece', 'pieces', 'unité', 'unités'],
  ['paquet', 'paquets'], ['boîte', 'boîtes', 'boite', 'boites'], ['bouteille', 'bouteilles'],
  ['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes'], ['g', 'gramme', 'grammes'],
  ['litre', 'litres', 'l'], ['cl', 'centilitre', 'centilitres'], ['ml', 'millilitre', 'millilitres'],
  ['pot', 'pots'], ['sachet', 'sachets'], ['barquette', 'barquettes'], ['tranche', 'tranches'],
  ['lot', 'lots'], ['rouleau', 'rouleaux'], ['tablette', 'tablettes'], ['botte', 'bottes']
];
const categoryGroups = [
  ['Fruits & légumes', 'fruits et légumes', 'fruits', 'légumes'],
  ['Frais', 'produits frais', 'produits laitiers', 'laitages'],
  ['Boulangerie', 'pain'], ['Épicerie', 'épicerie salée', 'épicerie sucrée'],
  ['Maison', 'entretien', 'hygiène'], ['Autre', 'autres']
];
const lookup = groups => new Map(groups.flatMap(([value, ...aliases]) => [value, ...aliases].map(alias => [fold(alias), value])));
const units = lookup(unitGroups), categories = lookup(categoryGroups);
export function normalizeField(field, value) {
  const text = cleanText(value, field === 'rayon' ? 100 : 50);
  if (!text) return undefined;
  if (field === 'quantite') {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return undefined;
    const number = Number(text.replace(',', '.'));
    return number > 0 && number <= 99999999.99 ? number : undefined;
  }
  if (field === 'rayon') return categories.get(fold(text));
  // A custom unit remains useful; never infer an unspoken quantity.
  return units.get(fold(text)) ?? text;
}
export function slotValue(slot) {
  const matched = slot?.resolutions?.resolutionsPerAuthority?.find(r => r.status?.code === 'ER_SUCCESS_MATCH');
  return matched?.values?.length === 1 ? matched.values[0].value?.name ?? slot.value : slot?.value;
}
export const nextField = draft => fields.find(field => draft[field] === undefined);
export function readDraft(value) {
  if (!value || !cleanText(value.name, 255) || !cleanText(value.requestId, 512)) return undefined;
  const draft = {name: cleanText(value.name, 255), requestId: value.requestId};
  for (const field of fields) {
    if (value[field] === null) draft[field] = null;
    else if (value[field] !== undefined) {
      const parsed = normalizeField(field, String(value[field]));
      if (parsed === undefined) return undefined;
      draft[field] = parsed;
    }
  }
  return draft;
}
export function updatedIntent(draft) {
  const slots = {article: {name: 'article', value: draft.name, confirmationStatus: 'NONE'}};
  for (const field of fields) {
    slots[field] = {name: field, confirmationStatus: 'NONE'};
    if (draft[field] !== undefined && draft[field] !== null) slots[field].value = String(draft[field]);
  }
  return {name: 'AjouterCourse', confirmationStatus: 'NONE', slots};
}
export const customTypes = [
  {name: 'UniteCourse', values: unitGroups.map(([value, ...aliases]) => ({name: {value, synonyms: [...new Set(aliases)].filter(a => a !== value)}}))},
  {name: 'RayonCourse', values: categoryGroups.map(([value, ...aliases]) => ({name: {value, synonyms: aliases}}))}
];
