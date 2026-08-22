import { env } from "cloudflare:workers";

let seedPromise: Promise<number> | null = null;

function encodedSeed(): string {
  return [
    env.PROFILE_SEED_01,
    env.PROFILE_SEED_02,
    env.PROFILE_SEED_03,
    env.PROFILE_SEED_04,
    env.PROFILE_SEED_05,
    env.PROFILE_SEED_06,
    env.PROFILE_SEED_07,
    env.PROFILE_SEED_08,
    env.PROFILE_SEED_09,
    env.PROFILE_SEED_10,
  ].filter((value): value is string => Boolean(value)).join("");
}

async function decodeProfiles(encoded: string): Promise<unknown[]> {
  const binary = atob(encoded);
  const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const stream = new Response(compressed).body;
  if (!stream) throw new Error("Profile seed could not be decoded");
  const decompressed = stream.pipeThrough(new DecompressionStream("gzip"));
  const parsed = JSON.parse(await new Response(decompressed).text()) as unknown;
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) {
    throw new Error("Profile seed must contain between 1 and 100 records");
  }
  return parsed;
}

async function seedProfiles(): Promise<number> {
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM profiles")
    .first<{ count: number }>();
  if (Number(count?.count || 0) > 0) return 0;

  const encoded = encodedSeed();
  if (!encoded) return 0;
  const profiles = await decodeProfiles(encoded);
  const importedAt = new Date().toISOString();
  const statements = profiles.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Profile ${index + 1} is invalid`);
    }
    const input = value as Record<string, unknown>;
    const { source: _source, ...withoutSource } = input;
    const fullProfile: Record<string, unknown> = {
      ...withoutSource,
      id: `profile_${index + 1}`,
    };
    if (/reddit|rednote|xiaohongshu|https?:\/\//.test(JSON.stringify(fullProfile).toLowerCase())) {
      throw new Error(`Profile ${index + 1} contains source-platform metadata`);
    }
    const {
      application_results: _applicationResults,
      game_metadata: _gameMetadata,
      ...publicProfile
    } = fullProfile;
    return env.DB.prepare(
      `INSERT INTO profiles (id, sort_order, public_json, full_json, imported_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         sort_order=excluded.sort_order,
         public_json=excluded.public_json,
         full_json=excluded.full_json,
         imported_at=excluded.imported_at`,
    ).bind(
      fullProfile.id,
      index + 1,
      JSON.stringify(publicProfile),
      JSON.stringify(fullProfile),
      importedAt,
    );
  });
  await env.DB.batch(statements);
  return statements.length;
}

export function ensureProfileSeed(): Promise<number> {
  seedPromise ??= seedProfiles().catch((error) => {
    seedPromise = null;
    throw error;
  });
  return seedPromise;
}
