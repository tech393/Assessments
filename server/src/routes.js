import { Router } from 'express';
import {
  AlreadyVotedError,
  PollNotFoundError,
  castVote,
  createPoll,
  getPoll,
  listPolls,
} from './pollRepository.js';
import { validateChoice, validatePollId, validateQuestion } from './validation.js';

export const router = Router();

router.get('/polls', async (req, res) => {
  res.json(await listPolls(req.sessionId));
});

router.post('/polls', async (req, res) => {
  const { value: question, error } = validateQuestion(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await createPoll(question));
});

router.get('/polls/:id', async (req, res) => {
  const { value: id, error } = validatePollId(req.params.id);
  if (error) return res.status(400).json({ error });
  try {
    res.json(await getPoll(id, req.sessionId));
  } catch (err) {
    if (err instanceof PollNotFoundError) return res.status(404).json({ error: 'Poll not found.' });
    throw err;
  }
});

router.post('/polls/:id/vote', async (req, res) => {
  const id = validatePollId(req.params.id);
  if (id.error) return res.status(400).json({ error: id.error });
  const choice = validateChoice(req.body);
  if (choice.error) return res.status(400).json({ error: choice.error });
  try {
    res.status(201).json(await castVote(id.value, req.sessionId, choice.value));
  } catch (err) {
    if (err instanceof PollNotFoundError) return res.status(404).json({ error: 'Poll not found.' });
    if (err instanceof AlreadyVotedError) {
      return res.status(409).json({ error: 'You have already voted on this poll.' });
    }
    throw err;
  }
});
