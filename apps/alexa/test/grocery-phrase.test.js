import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle} from '../src/grocery-phrase.js';

test('one phrase extracts explicit quantity, known unit and aisle while preserving the product', () => {
  for (const [text, name, quantite, unite, rayon] of [
    ['deux paquets de pâtes au rayon épicerie', 'pâtes', 2, 'paquet', 'Épicerie'],
    ['2 bouteilles de lait dans le rayon frais', 'lait', 2, 'bouteille', 'Frais'],
    ['un kilo et demi de pommes rayon fruits et légumes', 'pommes', 1.5, 'kg', 'Fruits & légumes'],
    ['un demi kilo de carottes au rayon légumes', 'carottes', 0.5, 'kg', 'Fruits & légumes'],
    ['1,25 litres d’huile au rayon épicerie', 'huile', 1.25, 'litre', 'Épicerie'],
    ['un virgule zéro cinq kg de tomates au rayon fruits', 'tomates', 1.05, 'kg', 'Fruits & légumes'],
    ['vingt et un paquets de mouchoirs au rayon maison', 'mouchoirs', 21, 'paquet', 'Maison'],
    ['quatre-vingt-dix-neuf grammes de sel et poivre au rayon épicerie', 'sel et poivre', 99, 'g', 'Épicerie'],
    ['deux cents grammes de chocolat au rayon épicerie', 'chocolat', 200, 'g', 'Épicerie'],
    ['une boîte de quatre-quarts au rayon boulangerie', 'quatre-quarts', 1, 'boîte', 'Boulangerie']
  ]) assert.deepEqual(parseArticle(text), {name, quantite, unite, rayon}, text);
});

test('partial phrases and ambiguous names never invent details', () => {
  assert.deepEqual(parseArticle('deux bouteilles de lait'), {name:'lait',quantite:2,unite:'bouteille'});
  assert.deepEqual(parseArticle('lait au rayon frais'), {name:'lait',rayon:'Frais'});
  for (const name of ['7 up', 'quatre-quarts', 'sel et poivre', 'le petit paquet de biscuits', 'un kilo de']) {
    assert.deepEqual(parseArticle(name), {name});
  }
  assert.deepEqual(parseArticle('0 paquets de pâtes au rayon épicerie'), {name:'pâtes',unite:'paquet',rayon:'Épicerie'});
  assert.deepEqual(parseArticle('100000000 paquets de pâtes'), {name:'pâtes',unite:'paquet'});
});
