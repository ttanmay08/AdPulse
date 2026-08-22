/**
 * Single source of truth for where the dashboard's data comes from.
 *
 * The real API (API Gateway + Lambda, see ../../lambda/query/handler.py) is
 * torn down right now to avoid RDS cost, so this defaults to "" — sample
 * mode — which serves data from the bundled sample dataset via the local
 * query engine (lib/queryEngine.ts) instead of the network.
 *
 * To point the dashboard at a real deployment later, set this to the API's
 * base URL (e.g. from `terraform output -raw api_endpoint`, minus the
 * trailing slash) — either edit the value below or set VITE_API_BASE_URL in
 * a .env file. lib/api.ts then fetches from the real routes instead of
 * running the sample-mode query engine; no other code changes.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

export const IS_SAMPLE_MODE = API_BASE_URL === '';
