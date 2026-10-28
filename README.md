# Pitch Your Build

Practice a product pitch out loud against an AI buyer who pushes back, then read three coaching notes from the same call.

There is no account and no database. The brief and the last transcript stay in this browser.

## Architecture

The app never calls a model itself. The browser starts a Vapi web call. Vapi runs the assistant you configure in the dashboard: speech to text, the LLM, and text to speech.

```
Builder's browser (this Next.js app)
  |  mic audio + transcript events, via @vapi-ai/web
  v
Vapi
  |-- transcribes the builder
  |-- fills {{variables}} in the assistant system prompt
  |-- asks the LLM for the buyer's next line
  |-- speaks that line back into the call
  v
Transcript events render on the call screen
  |
  v
Results page reads the transcript after "switching to coach mode"
```

On each call the browser passes the brief as `assistantOverrides.variableValues`. Those keys match the `{{variables}}` in [docs/buyer-prompt.md](docs/buyer-prompt.md):

`buyer_name`, `buyer_role`, `buyer_company_type`, `buyer_personality`, `current_solution`, `product_name`, `product_summary`, `target_customer`, `features`, `pricing`, `objections`.

The three personas (Friendly, Skeptical, Busy exec) are not three assistants. They are three sets of values for the same prompt. See `lib/personas.ts` and `lib/brief.ts`.

Coaching is not a second request. The prompt tells the buyer to say `switching to coach mode` and then three labeled lines. `lib/coaching.ts` parses those lines out of the transcript. Reword the phrase in the prompt and the parser will miss it.

## Screens

| Route | What it does |
| --- | --- |
| `/` | Name, one-line promise, Start practicing |
| `/brief` | Product, customer, pricing, dreaded objections, buyer persona |
| `/call` | Brief summary, call status, live transcript, Start call |
| `/results` | Transcript plus what worked, what to tighten, one line to try next |

Call status is one of: idle, connecting, live, ended.

If `NEXT_PUBLIC_VAPI_PUBLIC_KEY` or `NEXT_PUBLIC_VAPI_ASSISTANT_ID` is missing, the call screen shows a setup notice and does not construct the SDK.

## Project map

```
app/                  routes (server pages, so each screen has a title)
components/           screens and the form, call room, and notes
lib/brief.ts          brief shape and variableValues
lib/personas.ts       the three buyers
lib/storage.ts        localStorage, versioned so a bad value does not crash
lib/use-vapi-call.ts  Web SDK lifecycle and transcript events
lib/coaching.ts       notes parser
docs/buyer-prompt.md  system prompt to paste into Vapi
```

The brief and call screens are client-only (`ssr: false`) because the first render needs `localStorage`. A server render would flash an empty form and then fill it.

## Local setup

1. Install [Node.js](https://nodejs.org/) 22 or newer.
2. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

You can fill the brief and open every screen before Vapi is connected. The call button stays disabled until the env vars are set. On the notes screen, "Preview with a sample call" shows how the three notes are parsed.

## Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Name | Where it comes from | Why it is public |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi dashboard → API keys → public key | The Web SDK dials from the browser. Do not put the private key in this variable. |
| `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | The assistant that uses `docs/buyer-prompt.md` | Tells the SDK which assistant receives the call. |

Restart `npm run dev` after changing `.env.local`. Next inlines `NEXT_PUBLIC_` values when the dev server starts, and again at build time.

In the Vapi dashboard, restrict the public key to the origins you actually use (`http://localhost:3000` and your Vercel domain).

## Vapi assistant

Create one assistant and set:

1. **System prompt** — paste the block from [docs/buyer-prompt.md](docs/buyer-prompt.md).
2. **Model, transcriber, and voice** — the assistant needs all three or the call connects and nobody speaks. Any English voice you like is fine.
3. **Client messages** — leave the default list. It includes `transcript`, which is what the call screen renders. If the transcript stays empty on a live call, add `transcript` back.
4. **First message** — optional. The app overrides it so the opener matches the persona.

Then copy the public key and the assistant id into `.env.local`.

## Deploying on Vercel

This is a standard Next.js app. Import the repo, set the same two environment variables on the project, and deploy.

`NEXT_PUBLIC_` values are baked in at build time. If you add or change them later, redeploy. A new value does not show up on an old build.

No database, auth, or server secret is required for v1.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Parser, variable mapping, and transcript checks |
