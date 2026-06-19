# Segurança operacional das Functions

## Segredo Gemini

Configure o segredo antes de publicar as Functions:

```bash
firebase functions:secrets:set GEMINI_KEY
firebase deploy --only functions
```

`GEMINI_KEY` nunca deve ser colocado em arquivos de frontend, `.env` versionado ou no código. As Functions v2 acessam o segredo apenas nas três funções que usam Gemini.

## Primeiro administrador

As telas administrativas e as regras do Firebase usam exclusivamente a custom claim `admin: true`. Antes de publicar as regras, conceda a claim a um UID conhecido, com credenciais administrativas locais configuradas:

```bash
cd functions
set ADMIN_UID=uid-do-administrador
node scripts/set-admin-claim.js
```

No PowerShell, use `$env:ADMIN_UID = 'uid-do-administrador'`. Depois, o administrador precisa sair e entrar novamente para receber um novo token.
