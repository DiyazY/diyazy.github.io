// Entry point for the `notify` job in .github/workflows/build.yml:
//   node scripts/notify.ts <path/to/posts.json>
// Settings come from the environment (see src/notify/config.ts); DRY_RUN=1
// only reports. Logs are public: never print secrets or addresses.
import { appendFileSync, readFileSync } from 'node:fs';
import type { Fetch } from '../src/env.ts';
import { configFromEnv } from '../src/notify/config.ts';
import { parsePosts } from '../src/notify/posts.ts';
import { publicErrorMessage, redact, runNotify } from '../src/notify/run.ts';
import { ResendError, createResendClient } from '../src/resend.ts';

const postsPath = process.argv[2];
if (!postsPath) {
  console.error('Usage: node scripts/notify.ts <path/to/posts.json>');
  process.exit(1);
}

const fetchFn: Fetch = (input, init) => fetch(input, init);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

try {
  const { apiKey, config } = configFromEnv(process.env);
  const posts = parsePosts(JSON.parse(readFileSync(postsPath, 'utf8')));
  const result = await runNotify(posts, config, {
    resend: createResendClient({ apiKey, fetch: fetchFn, sleep }),
    fetch: fetchFn,
    sleep,
    now: () => new Date(),
    log: (line) => console.log(line),
    summary: (markdown) => {
      if (summaryFile) appendFileSync(summaryFile, `${markdown}\n`);
    },
  });
  console.log(`done: ${result.scheduled} scheduled`);
} catch (err) {
  console.error(publicErrorMessage(err));
  // A bug (not an API answer) is easier to fix with its stack; still redacted.
  if (err instanceof Error && !(err instanceof ResendError) && err.stack) console.error(redact(err.stack));
  process.exit(1);
}
