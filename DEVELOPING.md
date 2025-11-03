# Developing Crypto Vault

## Build outputs and typings

The TypeScript compiler emits JavaScript and declaration files into `dist/`:

```bash
npm run build
```

This command compiles the sources and generates `*.js`, `*.d.ts`, and source maps. Editors and tooling will automatically pick up the declarations because `package.json` exposes them via the `types` field and the ESM `exports` map.

## API documentation

Every exported function ships with rich TSDoc blocks. IDEs such as VS Code display the comments when hovering over symbols, and the same metadata powers typed completions for downstream projects. If you prefer static files, you can run a documentation generator like [TypeDoc](https://typedoc.org/) against the emitted declarations:

```bash
npm run build
npx typedoc --tsconfig tsconfig.docs.json --out docs/api dist/index.d.ts
```

The dedicated `tsconfig.docs.json` file tells TypeDoc to analyse the compiled declaration files in `dist/` without changing the main build configuration. Installing `typedoc` globally or as a dev dependency is optional; the command above uses `npx` so contributors can generate API pages without editing project dependencies.
