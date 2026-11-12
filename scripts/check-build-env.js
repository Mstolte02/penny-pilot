// Runs on EAS before every build (the "eas-build-pre-install" npm hook).
// .env is gitignored, so EAS never sees it. Without these values the app quietly falls
// back to demo data, and a tester would see "Penny Pilot Demo" instead of their bank.
// For preview and production builds, a missing value stops the build here instead.

const profile = process.env.EAS_BUILD_PROFILE;
const guarded = profile === 'preview' || profile === 'production';

if (!guarded) {
  process.exit(0);
}

const problems = [];
if (process.env.EXPO_PUBLIC_DATA_SOURCE !== 'supabase') {
  problems.push(`EXPO_PUBLIC_DATA_SOURCE is "${process.env.EXPO_PUBLIC_DATA_SOURCE ?? ''}", not "supabase"`);
}
for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
  if (!process.env[name]) problems.push(`${name} is not set`);
}

if (problems.length > 0) {
  console.error(`\nThe "${profile}" build would run on demo data:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nSet them as EAS environment variables for "${profile}" (expo.dev > project > Environment variables),` +
      `\nor with: eas env:create --environment ${profile} --name <NAME> --value <VALUE> --visibility plaintext\n`
  );
  process.exit(1);
}

console.log(`Build env OK for "${profile}": live Supabase data.`);
