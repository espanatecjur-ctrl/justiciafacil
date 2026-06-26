The Netlify deploy errored, with the following guidance provided:

**Diagnosis**  
- The build fails with a Vite parsing error: “[builtin:vite-transform] Unexpected token” in `src/components/buzon-expedientes.tsx` ([log #L61](#L61)).  
- Inspecting the file shows it starts with plain ASCII art (e.g. `-- ====...`) that isn’t wrapped in a valid TypeScript/TSX comment, so Vite treats it as code and errors out.

**Solution**  
Wrap the ASCII art in a valid comment or remove it. Example fix:

```tsx
/*
// ===========================================
// (ASCII art / note here)
// ===========================================
*/
```

(or delete the ASCII art entirely if it isn’t needed). After this change, rerun `npm run build`.

The relevant error logs are:

Line 47: ​
Line 48: $ npm run build
Line 49: > build
Line 50: > vite build && node postbuild.mjs
Line 51: The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsco
Line 52: The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsco
Line 53: The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsco
Line 54: vite v8.1.0 building client environment for production...
Line 55: 
Line 56: transforming...✓ 314 modules transformed.
Line 57: ✗ Build failed in 1.13s
Line 58: error during build:
Line 59: Build failed with 1 error:
Line 60: [builtin:vite-transform] Unexpected token
Line 61:    ╭─[ src/components/buzon-expedientes.tsx:1:4 ]
Line 62:    │
Line 63:  1 │ -- ======
Line 64:    │    ─┬─
Line 65:    │     ╰───
Line 66: ───╯
Line 67: 
Line 68:     at aggregateBindingErrorsIntoJsError (file:///opt/build/repo/node_modules/rolldown/dist/shared/error-T-E9reEy.mjs:48:18)
Line 69:     at unwrapBindingResult (file:///opt/build/repo/node_modules/rolldown/dist/shared/error-T-E9reEy.mjs:18:128)
Line 70:     at #build (file:///opt/build/repo/node_modules/rolldown/dist/shared/rolldown-build-DDMH4mGm.mjs:3256:34)
Line 71:     at async buildEnvironment (file:///opt/build/repo/node_modules/vite/dist/node/chunks/node.js:32575:66)
Line 72:     at async Object.build (file:///opt/build/repo/node_modules/vite/dist/node/chunks/node.js:32997:19)
Line 73:     at async buildStartViteEnvironments (file:///opt/build/repo/node_modules/@tanstack/start-plugin-core/dist/esm/vite/planning.
Line 74:     at async Object.buildApp (file:///opt/build/repo/node_modules/@tanstack/start-plugin-core/dist/esm/vite/plugin.js:113:8)
Line 75:     at async Object.buildApp (file:///opt/build/repo/node_modules/vite/dist/node/chunks/node.js:32989:6)
Line 76:     at async CAC.<anonymous> (file:///opt/build/repo/node_modules/vite/dist/node/cli.js:777:3) {
Line 77:   errors: [Getter/Setter]
Line 78: }
Line 79: Failed during stage 'building site': Build script returned non-zero exit code: 2
Line 80: ​
Line 81: "build.command" failed                                        
Line 82: ────────────────────────────────────────────────────────────────
Line 83: ​
Line 84:   Error message
Line 85:   Command failed with exit code 1: npm run build
Line 86: ​
Line 87:   Error location
Line 88:   In build.command from netlify.toml:
Line 89:   npm run build
Line 90: ​
Line 91:   Resolved config
Line 92:   build:
Line 93:     command: npm run build
Line 94:     commandOrigin: config
Line 95:     publish: /opt/build/repo/dist/client
Line 96:     publishOrigin: config
Line 97:   redirects:
Line 98:     - from: /*
      status: 200
      to: /index.html
Line 99: Build failed due to a user error: Build script returned non-zero exit code: 2
Line 100: Failing build: Failed to build site
Line 101: Finished processing build request in 17.81s
