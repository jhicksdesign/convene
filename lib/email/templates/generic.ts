// Shim — the actual template lives in `./generic.tsx` (React Email).
// We must specify the .tsx extension here to break the self-resolution loop;
// callers should import `@/lib/email/templates/generic` (extensionless) and
// TypeScript's bundler resolver will pick .ts first → this shim → .tsx target.
export { renderGenericEmail } from "./generic.tsx";
