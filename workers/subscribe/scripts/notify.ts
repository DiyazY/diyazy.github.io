// Entry point for the `notify` job in .github/workflows/build.yml:
//   node scripts/notify.ts <path/to/posts.json>
// Env: RESEND_API_KEY, NOTIFY_REPLY_TO (secrets); ANNOUNCE_SINCE,
// RESEND_SEGMENT_ID, TOPIC_NEW_POSTS_ID (repo variables); DRY_RUN=1 to only
// report. Logs are public: never print secrets or addresses.
import { appendFileSync, readFileSync } from 'node:fs';
import type { Fetch } from '../src/env.ts';
import { parsePosts } from '../src/notify/posts.ts';
import { runNotify } from '../src/notify/run.ts';
import { createResendClient } from '../src/resend.ts';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

const postsPath = process.argv[2];
if (!postsPath) {
  console.error('Usage: node scripts/notify.ts <path/to/posts.json>');
  process.exit(1);
}

const fetchFn: Fetch = (input, init) => fetch(input, init);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

try {
  const posts = parsePosts(JSON.parse(readFileSync(postsPath, 'utf8')));
  const result = await runNotify(
    posts,
    {
      since: process.env.ANNOUNCE_SINCE,
      segmentId: required('RESEND_SEGMENT_ID'),
      topicId: required('TOPIC_NEW_POSTS_ID'),
      replyTo: required('NOTIFY_REPLY_TO'),
      dryRun: process.env.DRY_RUN === '1',
    },
    {
      resend: createResendClient({ apiKey: required('RESEND_API_KEY'), fetch: fetchFn, sleep }),
      fetch: fetchFn,
      sleep,
      now: () => new Date(),
      log: (line) => console.log(line),
      summary: (markdown) => {
        if (summaryFile) appendFileSync(summaryFile, `${markdown}\n`);
      },
    },
  );
  console.log(`done: ${result.scheduled} scheduled`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
