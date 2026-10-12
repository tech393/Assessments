// All database access for polls and votes lives here. Routes never import Prisma directly.
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

export class AlreadyVotedError extends Error {}
export class PollNotFoundError extends Error {}

function withResults(poll, counts, myVote) {
  const yes = counts.YES ?? 0;
  const no = counts.NO ?? 0;
  const total = yes + no;
  // Round yes, then derive no, so the two always add up to exactly 100.
  const yesPercent = total === 0 ? 0 : Math.round((yes / total) * 100);
  const noPercent = total === 0 ? 0 : 100 - yesPercent;
  return {
    id: poll.id,
    question: poll.question,
    createdAt: poll.createdAt,
    yes,
    no,
    total,
    yesPercent,
    noPercent,
    myVote: myVote ? myVote.toLowerCase() : null,
  };
}

async function countsByPoll(pollIds) {
  const rows = await prisma.vote.groupBy({
    by: ['pollId', 'choice'],
    where: { pollId: { in: pollIds } },
    _count: { _all: true },
  });
  const map = new Map();
  for (const row of rows) {
    const entry = map.get(row.pollId) ?? {};
    entry[row.choice] = row._count._all;
    map.set(row.pollId, entry);
  }
  return map;
}

async function myVotesByPoll(pollIds, sessionId) {
  const rows = await prisma.vote.findMany({
    where: { pollId: { in: pollIds }, sessionId },
    select: { pollId: true, choice: true },
  });
  return new Map(rows.map((r) => [r.pollId, r.choice]));
}

export async function createPoll(question) {
  const poll = await prisma.poll.create({ data: { question } });
  return withResults(poll, {}, null);
}

export async function listPolls(sessionId) {
  const polls = await prisma.poll.findMany({ orderBy: { createdAt: 'desc' } });
  const ids = polls.map((p) => p.id);
  const [counts, mine] = await Promise.all([countsByPoll(ids), myVotesByPoll(ids, sessionId)]);
  return polls.map((p) => withResults(p, counts.get(p.id) ?? {}, mine.get(p.id)));
}

export async function getPoll(id, sessionId) {
  const poll = await prisma.poll.findUnique({ where: { id } });
  if (!poll) throw new PollNotFoundError();
  const [counts, mine] = await Promise.all([countsByPoll([id]), myVotesByPoll([id], sessionId)]);
  return withResults(poll, counts.get(id) ?? {}, mine.get(id));
}

export async function castVote(pollId, sessionId, choice) {
  try {
    // No "has this session voted?" pre-check: the unique (pollId, sessionId) index decides,
    // which stays correct even when two requests arrive at the same moment.
    await prisma.vote.create({ data: { pollId, sessionId, choice: choice.toUpperCase() } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') throw new AlreadyVotedError();
      if (err.code === 'P2003') throw new PollNotFoundError();
    }
    throw err;
  }
  return getPoll(pollId, sessionId);
}
