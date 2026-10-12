// Each validator returns { value } on success or { error } with a message for a 400 response.

export const QUESTION_MIN = 5;
export const QUESTION_MAX = 200;
const MAX_INT4 = 2147483647; // largest id a PostgreSQL INTEGER column can hold

export function validateQuestion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }
  if (typeof body.question !== 'string') {
    return { error: 'question is required and must be a string.' };
  }
  const question = body.question.trim();
  if (question.length < QUESTION_MIN || question.length > QUESTION_MAX) {
    return { error: `question must be between ${QUESTION_MIN} and ${QUESTION_MAX} characters.` };
  }
  return { value: question };
}

export function validateChoice(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }
  if (body.choice !== 'yes' && body.choice !== 'no') {
    return { error: 'choice must be "yes" or "no".' };
  }
  return { value: body.choice };
}

export function validatePollId(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > MAX_INT4) {
    return { error: 'Poll id must be a positive whole number.' };
  }
  return { value: Number(raw) };
}
