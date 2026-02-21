import { z } from 'zod';

const optionalUrl = z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().url().optional()
);

const envSchema = z.object({
    GITHUB_TOKEN: z.string().min(1),
    GITHUB_OWNER: z.string().min(1),
    GITHUB_REPO: z.string().optional(),
    MONGODB_URI: z.string().min(1),
    MONGODB_DB_NAME: z.string().default('repo_doctor'),
    REPO_DOCTOR_BOT_NAME: z.string().default('repo-doctor[bot]'),
    ALERT_WEBHOOK_URL: optionalUrl,
    ALERT_SLACK_WEBHOOK_URL: optionalUrl,
    ALERT_DISCORD_WEBHOOK_URL: optionalUrl,
    ALERT_CRON_SECRET: z.string().optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse({
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER || process.env.NEXT_PUBLIC_GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO || '',
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    REPO_DOCTOR_BOT_NAME: process.env.REPO_DOCTOR_BOT_NAME,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    ALERT_SLACK_WEBHOOK_URL: process.env.ALERT_SLACK_WEBHOOK_URL,
    ALERT_DISCORD_WEBHOOK_URL: process.env.ALERT_DISCORD_WEBHOOK_URL,
    ALERT_CRON_SECRET: process.env.ALERT_CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
});
