# Shoot Your Shot

Practice a product pitch out loud against an AI buyer who pushes back, then read three coaching notes from the same call.

A signed-in builder gets three free calls. Each call lasts at most seven minutes. The brief, the transcript, and the coaching notes are stored in Supabase. Without those env vars the screens still open and explain what to set up, and a call cannot start.

## Architecture

The app never calls a model itself. The browser starts a Vapi web call. Vapi runs the assistant you configure in the dashboard: speech to text, the LLM, and text to speech.

```
Builder's browser
  |  1. POST /api/calls  (session cookie)
  v
This server
  |  start_practice_call() in Postgres
  |  locks that user's usage row
  |  refuses the call if they already have 3
  |  otherwise records the call, then returns its id
  v
Browser starts Vapi only after that 200
  |  assistantOverrides.maxDurationSeconds = 420
  |  assistantOverrides.variableValues = the brief
  v
Vapi (speech to text, the LLM, text to speech)
  |
  v
Browser PATCH /api/calls/:id with the transcript
Results page reads the saved notes after "switching to coach mode"
```

On each call the browser passes the brief as `assistantOverrides.variableValues`. Those keys match the `{{variables}}` in [docs/buyer-prompt.md](docs/buyer-prompt.md):

`buyer_name`, `buyer_role`, `buyer_company_type`, `buyer_personality`, `current_solution`, `product_name`, `product_summary`, `target_customer`, `features`, `pricing`, `objections`.

The three personas (Friendly, Skeptical, Busy exec) are not three assistants. They are three sets of values for the same prompt. See `lib/personas.ts` and `lib/brief.ts`.

Coaching is not a second request. The prompt tells the buyer to say `switching to coach mode` and then three labeled lines. `lib/coaching.ts` parses those lines out of the transcript. Reword the phrase in the prompt and the parser will miss it.

## Screens

| Route | What it does |
| --- | --- |
| `/` | Public. Name, one-line promise, Start practicing |
| `/login` | Public. Email magic link and Google |
| `/brief` | Signed in. Product, customer, pricing, objections, persona |
| `/call` | Signed in. Remaining free calls, Start call, live transcript |
| `/results` | Signed in. Past transcripts and the three coaching notes |

Call status is one of: idle, connecting, live, ended.

If `NEXT_PUBLIC_VAPI_PUBLIC_KEY` or `NEXT_PUBLIC_VAPI_ASSISTANT_ID` is missing, the call screen shows a setup notice and does not construct the SDK.

## Project map

```
app/api/calls/        POST authorizes a call, PATCH saves the transcript
app/auth/callback/    exchanges the magic-link or Google code for a session
proxy.ts              refreshes the session and sends anonymous visitors to /login
supabase/migrations/  tables, row-level security, start_practice_call()
lib/limits.ts         3 calls, 420 seconds, the label on the call page
lib/supabase/         browser client, server client, session refresh
docs/buyer-prompt.md  system prompt to paste into Vapi
```

The practice screens are client components fed by the server. Reading the session uses cookies, so that read sits behind a Suspense boundary and the rest of the page can still prerender.

## Local setup

1. Install [Node.js](https://nodejs.org/) 22 or newer.
2. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

You can open every screen before Supabase or Vapi is connected. The pages name the missing env vars, and Start call stays unavailable until both are set. On the notes screen, "Preview with a sample call" shows how the three notes are parsed. That sample stays in the browser. It is not a real call and it does not count.

## Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Name | Where it comes from | Why it is public |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi dashboard → API keys → public key | The Web SDK dials from the browser. Do not put the private key in this variable. |
| `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | The assistant that uses `docs/buyer-prompt.md` | Tells the SDK which assistant receives the call. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Where the browser and the server send auth and database requests. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon public key on that same page | Identifies the project. It is not a secret. Row-level security is what hides other people's rows. Do not put the service-role key here. |

Restart `npm run dev` after changing `.env.local`. Next inlines `NEXT_PUBLIC_` values when the dev server starts, and again at build time.

In the Vapi dashboard, restrict the public key to the origins you actually use (`http://localhost:3000` and your Vercel domain).

## Vapi assistant

Create one assistant and set:

1. **System prompt** — paste the block from [docs/buyer-prompt.md](docs/buyer-prompt.md).
2. **Model, transcriber, and voice** — the assistant needs all three or the call connects and nobody speaks. Any English voice you like is fine.
3. **Client messages** — leave the default list. It includes `transcript`, which is what the call screen renders. If the transcript stays empty on a live call, add `transcript` back.
4. **First message** — optional. The app overrides it so the opener matches the persona.

Then copy the public key and the assistant id into `.env.local`.

## Accounts and the free-call limit

Sign-in is Supabase Auth: an email magic link, or Google. Both return to `/auth/callback`, which stores the session in cookies. `proxy.ts` refreshes that session on each request. `/brief`, `/call`, and `/results` redirect to `/login` when nobody is signed in. The landing page stays public.

In the Supabase dashboard:

1. Run [`supabase/migrations/20261028160000_init.sql`](supabase/migrations/20261028160000_init.sql).
2. Authentication → Providers: turn on Email and Google. Google needs a client id and secret from Google Cloud.
3. Authentication → URL configuration: add your site URL and `http://localhost:3000/auth/callback` (and the same path on the Vercel domain).

Each account gets 3 calls. The browser does not decide that. Start call sends `POST /api/calls`. That route calls `start_practice_call()` in Postgres, which locks the user's usage row, adds one, and inserts a `calls` row. If the count is already 3, the function raises `free_call_limit` and the route answers 403. Only then does the browser start Vapi, with `maxDurationSeconds` set to 420 so the call cannot run past seven minutes. When the call ends, `PATCH /api/calls/:id` stores the transcript, the three coaching notes, the end time, and the duration.

Row-level security is on for `briefs`, `calls`, `usage`, and `waitlist`. Policies allow `auth.uid() = user_id`. Authenticated users can read and update their own calls, but they cannot insert one. The insert happens inside `start_practice_call()`, which is `security definer` and checks the limit itself. Usage has no update policy, so a signed-in user cannot set their own counter back to zero.

The call page shows how many are left, for example `2 of 3 free calls left`. After the third call, Start call is replaced with "You've used your free practice calls". Notes from earlier calls stay on the results page. "Join the waitlist for more calls" writes their email to `waitlist`.

A paid upgrade is not built. Search the repo for `TODO(stripe)`. That is the spot where checkout should raise the cap inside `start_practice_call()` instead of sending people to the waitlist.

The Vapi public key still lives in the browser, because that is how the Web SDK places the call. The app will not dial until the server records the attempt. A private server key that creates the web call itself would close the remaining gap. This version does not do that.

## Deploying on Vercel

This is a standard Next.js app. Import the repo, set the four `NEXT_PUBLIC_` environment variables, and deploy.

`NEXT_PUBLIC_` values are baked in at build time. If you add or change them later, redeploy. A new value does not show up on an old build.

Run the SQL migration on the production Supabase project, and add the production `/auth/callback` URL to the redirect allow list.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Parser, variable mapping, transcript checks, and the free-call limit |
