// ESM loader: redirect node:https to our mock module
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'node:https') {
    const url = new URL('./mock-https.mjs', import.meta.url).href;
    return { format: 'module', url };
  }
  return nextResolve(specifier);
}
