import { MongoClient, Db } from 'mongodb';
import { env } from './env';

let client: MongoClient;
let db: Db;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
    if (db) return { client, db };

    client = await MongoClient.connect(env.MONGODB_URI);
    db = client.db(env.MONGODB_DB_NAME);

    // Initialize indexes
    await db.collection('pull_request_analyses').createIndex({ repo: 1, number: 1 }, { unique: true });
    await db.collection('issue_snapshots').createIndex({ repo: 1, createdAt: -1 });
    await db.collection('weekly_reports').createIndex({ repo: 1, weekStart: -1 });
    await db.collection('scan_results').createIndex({ repo: 1, createdAt: -1 });

    return { client, db };
}

export async function getCollection(name: string) {
    const { db } = await connectToDatabase();
    return db.collection(name);
}
