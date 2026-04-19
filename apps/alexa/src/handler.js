import Alexa from 'ask-sdk-core';

const API_BASE_URL = process.env.FAMILY_API_BASE_URL;

async function postToBackend(path, payload) {
  if (!API_BASE_URL) {
    throw new Error('FAMILY_API_BASE_URL is not configured');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Backend call failed with status ${response.status}`);
  }

  return response.json();
}

const AjouterEvenementHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AjouterEvenement';
  },
  async handle(handlerInput) {
    try {
      const slots = handlerInput.requestEnvelope.request.intent.slots;
      const payload = {
        title: slots.title?.value,
        date: slots.date?.value,
        time: slots.time?.value,
        person: slots.person?.value,
        location: slots.location?.value,
        source: 'alexa'
      };

      await postToBackend('/api/v1/events', payload);
      const speakOutput = `D'accord, j'ai ajouté ${payload.title || 'cet événement'}. Voulez-vous autre chose ?`;
      return handlerInput.responseBuilder.speak(speakOutput).reprompt('Autre chose ?').getResponse();
    } catch {
      return handlerInput.responseBuilder
        .speak("Désolé, je n'ai pas compris. Pouvez-vous reformuler votre demande ?")
        .getResponse();
    }
  }
};

const AjouterCourseHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AjouterCourse';
  },
  async handle(handlerInput) {
    try {
      const slots = handlerInput.requestEnvelope.request.intent.slots;
      const rawItems = slots.items?.value || '';
      const items = rawItems.split(/,| et /i).map((entry) => entry.trim()).filter(Boolean);

      await postToBackend('/api/v1/grocery/batch', {
        items: items.map((name) => ({ name, source: 'alexa' }))
      });

      const speakOutput = `J'ai ajouté ${items.length} article${items.length > 1 ? 's' : ''} à la liste de courses. Autre chose ?`;
      return handlerInput.responseBuilder.speak(speakOutput).reprompt('Autre chose ?').getResponse();
    } catch {
      return handlerInput.responseBuilder
        .speak("Désolé, je n'ai pas compris. Pouvez-vous reformuler votre demande ?")
        .getResponse();
    }
  }
};

const HelpHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Vous pouvez me demander de créer un événement ou ajouter des courses.')
      .reprompt('Que souhaitez-vous faire ?')
      .getResponse();
  }
};

const FallbackHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Désolé, je n'ai pas compris. Pouvez-vous reformuler votre demande ?")
      .getResponse();
  }
};

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(AjouterEvenementHandler, AjouterCourseHandler, HelpHandler, FallbackHandler)
  .create();
