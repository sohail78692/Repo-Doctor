import { z } from 'zod';

const envSchema = z.object({
    GITHUB_TOKEN: z.string().min(1),
    GITHUB_OWNER: z.string().min(1),
    GITHUB_REPO: z.string().optional(),
    MONGODB_URI: z.string().min(1),
    MONGODB_DB_NAME: z.string().default('repo_doctor'),
    REPO_DOCTOR_BOT_NAME: z.string().default('repo-doctor[bot]'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = envSchema.parse({
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_OWNER: process.env.GITHUB_OWNER || process.env.NEXT_PUBLIC_GITHUB_OWNER,
    GITHUB_REPO: process.env.GITHUB_REPO || process.env.NEXT_PUBLIC_GITHUB_REPO || '',
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    REPO_DOCTOR_BOT_NAME: process.env.REPO_DOCTOR_BOT_NAME,
    NODE_ENV: process.env.NODE_ENV,
});
