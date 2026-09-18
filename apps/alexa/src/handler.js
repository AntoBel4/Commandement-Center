import Alexa from 'ask-sdk-core';
import { createHash } from 'node:crypto';

const escapeSpeech = value => value.replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[c]));
const help = 'Vous pouvez dire : ajoute du lait. Ajoutez un article à la fois.';

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
  const link = h => h.responseBuilder
    .speak('Pour ajouter des courses, associez votre compte Maison dans l’application Alexa.')
    .withLinkAccountCard().withShouldEndSession(true).getResponse();
  const handlers = [{
    canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
    handle: h => h.requestEnvelope.context?.System?.user?.accessToken
      ? response(h, 'Bienvenue dans les courses de la maison. ' + help, true) : link(h)
  }, {
    canHandle: h => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(h.requestEnvelope) === 'AjouterCourse',
    async handle(h) {
      const envelope = h.requestEnvelope;
      const token = envelope.context?.System?.user?.accessToken;
      if (typeof token !== 'string' || !token) return link(h);
      const raw = envelope.request.intent.slots?.article?.value;
      const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
      if (!name || name.length > 255 || /[\u0000-\u001f]/.test(name)) {
        return response(h, 'Je n’ai pas identifié l’article. ' + help, true);
      }
      // Keep compound names intact (e.g. "sel et poivre"). No guessed splitting.
      const requestId = envelope.request.requestId;
      if (typeof requestId !== 'string' || !requestId || requestId.length > 512) {
        return response(h, 'Cette demande est invalide. Aucun article ajouté.');
      }
      const key = 'alexa:' + createHash('sha256').update(skillId + ':' + requestId).digest('hex');
      try {
        const result = await fetchImpl(new URL('/api/v1/grocery/batch', base), {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4500),
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token,
            'x-family-id': familyId, 'idempotency-key': key },
          body: JSON.stringify({items: [{name, source: 'alexa'}]})
        });
        if (result.status === 401) return link(h);
        if (result.status === 403) return response(h, 'Le compte associé n’est pas autorisé pour ce foyer.');
        if (!result.ok) throw new Error('API unavailable');
        const body = await result.json();
        if (body.success !== true || body.data?.count !== 1 || body.data?.items?.length !== 1 ||
            typeof body.data.items[0].id !== 'string' || body.data.items[0].name !== name) {
          throw new Error('Invalid acknowledgement');
        }
        return response(h, 'J’ai ajouté ' + escapeSpeech(name) + ' à la liste familiale. Autre chose ?', true);
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
        return response(h, 'À bientôt.');
      }
      if (intent === 'AjouterEvenement') return response(h, 'Les rendez-vous seront disponibles après le raccordement de Google Agenda.');
      return response(h, help, true);
    }
  }];
  return Alexa.SkillBuilders.custom().withSkillId(skillId).addRequestHandlers(...handlers)
    .addErrorHandlers({canHandle: () => true,
      handle: h => response(h, 'Je ne peux pas traiter cette demande pour le moment.')}).create();
}
