import { Link } from 'react-router'

import { EndpointCards } from './cards'

/**
 * `/apps/api-playground` — every endpoint, clickable, with its log line findable.
 *
 * Layout and explanation only; the cards own their own state. The page exists
 * because "the API logs every request to a file" is not a claim anyone can
 * check by reading code — you have to make a call and go look.
 */
export default function ApiPlaygroundPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">API Playground</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every endpoint this API serves, one click each — with the status, the
          duration, and the id that finds it in the log.
        </p>
      </header>

      <section className="border-border text-muted-foreground mb-8 rounded-xl border border-dashed px-5 py-4 text-xs leading-relaxed">
        <p>
          Each response carries an <code>X-Request-Id</code>. Copy it and run{' '}
          <code>grep &lt;id&gt; apps/api/logs/api.log</code> on the host to see
          the request and response the server wrote down — headers masked,
          bodies capped at 2&nbsp;KB.
        </p>
        <p className="mt-2">
          <code>apps/api/logs/activity.log</code> is the same events in plain
          sentences. Both files are on the host already: the API container
          bind-mounts <code>./apps/api</code>, so nothing has to be copied out.
        </p>
      </section>

      <EndpointCards />

      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground mt-10 inline-block text-sm underline"
      >
        ← All apps
      </Link>
    </main>
  )
}
