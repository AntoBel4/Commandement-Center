import Alexa from 'ask-sdk-core';
import { createHash } from 'node:crypto';
import {fields, questions, cleanText, normalizeField, slotValue, nextField, readDraft, updatedIntent} from './grocery-dialog.js';

const escapeSpeech = value => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[c]));
const help = 'Dites par exemple : ajoute du lait. Je demande ensuite la quantité, l’unité et le rayon manquants. Vous pouvez dire passer, ou annuler.';

// An Echo identifies the linked account, not the person speaking in the room.
export function createSkill({ skillId, familyId, apiBaseUrl, fetchImpl = fetch }) {
  if (!/^amzn1\.ask\.skill\.[a-zA-Z0-9-]+$/.test(skillId ?? '')) throw new Error('ALEXA_SKILL_ID required');
  if (!/^[0-9a-f-]{36}$/i.test(familyId ?? '')) throw new Error('FAMILY_ID required');
  const base = new URL(apiBaseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid API origin');
  }
  const response = (h, speech, keepOpen = false) => {
    const b = h.responseBuilder.speak(speech).withShouldEndSession(!keepOpen);
    if (keepOpen) b.reprompt(help);
    return b.getResponse();
  };
  const setDraft = (h, draft) => h.attributesManager.setSessionAttributes(draft ? {groceryDraft: draft} : {});
  const getDraft = h => readDraft(h.attributesManager.getSessionAttributes().groceryDraft);
  const ask = (h, draft, prefix = '') => {
    setDraft(h, draft);
    const field = nextField(draft);
    const prompt = prefix + questions[field];
    return h.responseBuilder.speak(prompt).reprompt(questions[field])
      .addElicitSlotDirective(field, updatedIntent(draft)).getResponse();
  };
  const link = h => h.responseBuilder
    .speak('Pour ajouter des courses, associez votre compte Maison dans l’application Alexa.')
    .withLinkAccountCard().withShouldEndSession(true).getResponse();
  const handlers = [{
    canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
    handle(h) {
      setDraft(h);
      return h.requestEnvelope.context?.System?.user?.accessToken
        ? response(h, 'Bienvenue dans les courses de la maison. ' + help, true) : link(h);
    }
  }, {
    canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
      ['AjouterCourse', 'PasserPrecision'].includes(Alexa.getIntentName(h.requestEnvelope)),
    async handle(h) {
      const envelope = h.requestEnvelope;
      const token = envelope.context?.System?.user?.accessToken;
      if (typeof token !== 'string' || !token) { setDraft(h); return link(h); }
      if (!cleanText(envelope.request.requestId, 512)) {
        setDraft(h);
        return response(h, 'Cette demande est invalide. Aucun article ajouté.');
      }
      let draft = getDraft(h);
      if (envelope.request.intent.name === 'PasserPrecision') {
        if (!draft || !nextField(draft)) return response(h, 'Aucune précision en attente. ' + help, true);
        draft[nextField(draft)] = null;
      } else {
        const slots = envelope.request.intent.slots ?? {};
        const name = cleanText(slots.article?.value, 255);
        if (!draft || (name && draft.name !== name)) {
          if (!name) return response(h, 'Je n’ai pas identifié l’article. ' + help, true);
          // Preserve compound names. Each new item gets one stable key for the entire dialogue.
          draft = {name, requestId: envelope.request.requestId};
        }
        for (const field of fields) {
          const raw = slotValue(slots[field]);
          if (raw === undefined || raw === '') continue;
          if (/^(passer|passe|sans précision)$/i.test(raw.trim())) { draft[field] = null; continue; }
          const value = normalizeField(field, raw);
          if (value === undefined) {
            delete draft[field];
            setDraft(h, draft);
            return h.responseBuilder.speak('Je n’ai pas compris cette précision. ' + questions[field])
              .reprompt(questions[field]).addElicitSlotDirective(field, updatedIntent(draft)).getResponse();
          }
          draft[field] = value;
        }
      }
      if (nextField(draft)) return ask(h, draft);
      const {name, requestId} = draft;
      const item = {name, quantity: draft.quantite, unit: draft.unite, category: draft.rayon, source: 'alexa'};
      const key = 'alexa:' + createHash('sha256').update(skillId + ':' + requestId).digest('hex');
      setDraft(h);
      try {
        const result = await fetchImpl(new URL('/api/v1/grocery/batch', base), {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4500),
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token,
            'x-family-id': familyId, 'idempotency-key': key },
          body: JSON.stringify({items: [item]})
        });
        if (result.status === 401) return link(h);
        if (result.status === 403) return response(h, 'Le compte associé n’est pas autorisé pour ce foyer.');
        if (!result.ok) throw new Error('API unavailable');
        const body = await result.json();
        if (body.success !== true || body.data?.count !== 1 || body.data?.items?.length !== 1 ||
            typeof body.data.items[0].id !== 'string' || body.data.items[0].name !== name ||
            body.data.items[0].quantity !== item.quantity || body.data.items[0].unit !== item.unit ||
            body.data.items[0].category !== item.category) {
          throw new Error('Invalid acknowledgement');
        }
        const detail = [draft.quantite === null ? '' : 'quantité ' + String(draft.quantite).replace('.', ','),
          draft.unite === null ? '' : 'unité ' + draft.unite, draft.rayon === null ? '' : 'rayon ' + draft.rayon].filter(Boolean);
        return response(h, 'J’ai ajouté ' + escapeSpeech(name) + (detail.length ? ', ' + escapeSpeech(detail.join(', ')) : '') +
          ' à la liste familiale. Autre chose ?', true);
      } catch {
        // A timeout may happen after commit. Never claim failure or invite a blind retry.
        return response(h, 'Je ne peux pas confirmer l’ajout. Vérifiez la liste dans Maison avant de réessayer.');
      }
    }
  }, {
    canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
    handle: h => h.responseBuilder.getResponse()
  }, {
    canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest',
    handle(h) {
      const intent = Alexa.getIntentName(h.requestEnvelope);
      if (['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NoIntent'].includes(intent)) {
        const pending = getDraft(h);
        setDraft(h);
        return response(h, pending ? 'Ajout annulé. Aucun article ajouté. À bientôt.' : 'À bientôt.');
      }
      const pending = getDraft(h);
      if (pending && nextField(pending)) return ask(h, pending, intent === 'AMAZON.HelpIntent'
        ? 'Dites passer pour ignorer cette précision, ou annuler pour abandonner l’ajout. ' : 'Je n’ai pas compris. ');
      if (intent === 'AjouterEvenement') return response(h, 'Les rendez-vous seront disponibles après le raccordement de Google Agenda.');
      return response(h, help, true);
    }
  }];
  return Alexa.SkillBuilders.custom().withSkillId(skillId).addRequestHandlers(...handlers)
    .addErrorHandlers({canHandle: () => true,
      handle: h => response(h, 'Je ne peux pas traiter cette demande pour le moment.')}).create();
}
