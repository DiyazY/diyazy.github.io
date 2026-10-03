// Reads the notify job's environment (see the `notify` job in
// .github/workflows/build.yml). The repo secret RESEND_API_KEY_NOTIFY arrives
// here as RESEND_API_KEY. Errors name missing variables, never values.
import type { NotifyConfig } from './run.ts';

const REQUIRED = ['RESEND_API_KEY', 'NOTIFY_REPLY_TO', 'RESEND_SEGMENT_ID', 'TOPIC_NEW_POSTS_ID'] as const;

export function configFromEnv(env: Record<string, string | undefined>): { apiKey: string; config: NotifyConfig } {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return {
    apiKey: env.RESEND_API_KEY!,
    config: {
      since: env.ANNOUNCE_SINCE, // checked by selectCandidates, which refuses to guess
      segmentId: env.RESEND_SEGMENT_ID!,
      topicId: env.TOPIC_NEW_POSTS_ID!,
      replyTo: env.NOTIFY_REPLY_TO!,
      dryRun: env.DRY_RUN === '1', // the workflow passes `inputs.dry_run && '1' || ''`
    },
  };
}
