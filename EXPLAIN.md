# Shoot Your Shot — Explained

Shoot Your Shot is a voice practice partner for people who build products and need to pitch them. You describe what you built, then you pitch it out loud to an AI buyer who pushes back the way a real prospect would. When the call ends, you get coaching on how you did.

Think of it as a batting cage for sales calls: you get reps, without burning a real lead.

## The problem it solves

Most builders are great at making things and uncomfortable selling them. The usual ways to practice are weak:

- Pitching to friends, who are too nice to push back.
- Rehearsing alone, where nobody asks the hard question.
- Practicing on real prospects, where a bad pitch costs a real opportunity.

Shoot Your Shot gives you a buyer who is polite but skeptical, knows only what you told it about your product, and raises the objections you are most afraid of.

## How it works

1. **Write your brief.** Product name, a one-line summary, who it is for, key features, pricing, and the objections you dread hearing.
2. **Customize your buyer.** Pick a personality (Friendly, Skeptical, Busy exec), a difficulty (Easy, Standard, Tough), and optional questions you want to be asked.
3. **Take the call.** Start a live voice call in the browser, or (once enabled) have the buyer ring your phone. You talk; the buyer listens, asks clarifying questions and pushes back.
4. **Get coached.** At the end the buyer switches to coach mode and gives three notes out loud: what worked, what to tighten, and one line to try on your next call.
5. **Review it.** The transcript and written notes are saved to your account so you can see how you improve call to call.

Every account gets 3 free practice calls, up to 7 minutes each.

## How it helps your sales pitch

- **Objection handling under pressure.** You hear "we already use something like this" or "why not just use ChatGPT?" and have to answer in real time, out loud, not in a doc.
- **Clarity.** Vague answers get called out. If you say "it's for anyone," the buyer asks who it is actually for.
- **Discovery habits.** The buyer opens up when you ask good questions about their problem, which rewards asking before pitching.
- **Closing the next step.** When the buyer says "send me a deck," you practice turning that brush-off into a booked follow-up.
- **Feedback grounded in what you said.** Coaching is based on your actual words in the transcript, not generic sales tips.
- **Repetition with variety.** Changing personality and difficulty means the same pitch gets tested from different angles.

## Who it is for

- Builders and bootcamp grads pitching portfolio projects to employers or early users.
- Founders practicing before investor or customer calls.
- Salespeople learning a new product.

## Tech stack

| Layer | Tool | What it does |
| --- | --- | --- |
| App | Next.js, React, TypeScript, Tailwind | Pages, the brief form, buyer settings, the call screen |
| Auth and data | Supabase (Postgres) | Login, saved briefs and settings, call history, transcripts, free-call limits |
| Voice | Vapi | Speech-to-text, the AI buyer, text-to-speech, browser and phone calls |
| Hosting | Vercel | Public URL and the endpoint that receives end-of-call reports |

## How a call flows

```mermaid
flowchart LR
  A[Seller saves brief and buyer settings] --> B[App checks free calls left]
  B --> C[Vapi starts the buyer with the brief loaded]
  C --> D[Live pitch and objections]
  D --> E[Coach mode: 3 spoken notes]
  E --> F[Vapi sends transcript to the app]
  F --> G[Notes saved to the seller's account]
```

## Safety and fairness

- Free-call limits are enforced on the server, so they can't be bypassed from the browser.
- Private keys stay on the server and are never sent to the browser.
- Phone calls only dial numbers on an approved list until verified numbers are set up.
- Every user can see only their own briefs, calls and notes.

## Status

Built and passing automated tests. Live voice calls, saved transcripts and phone calls are being tested before public launch. Paid plans are planned for later.

Built by Christian Almonte.
