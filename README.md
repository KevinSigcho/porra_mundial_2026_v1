# Porra Mundial 2026 - fase de grupos

Web pública para jugar una porra privada con amigos. No usa Excel. Cada persona entra con:

- nombre
- PIN personal
- código de invitación

Después pronostica el marcador de cada uno de los 72 partidos de la fase de grupos del Mundial 2026.

## Qué incluye

- Frontend React + Vite.
- API con Azure Functions dentro de Azure Static Web Apps.
- Persistencia en Azure Table Storage.
- Código de invitación para crear/entrar jugadores.
- Panel admin para cerrar/reabrir la porra.
- Panel admin para meter resultados reales.
- Clasificación automática.

## Puntuación incluida

- Marcador exacto: 3 puntos.
- Signo acertado sin marcador exacto: 1 punto.
- Fallo: 0 puntos.

Puedes cambiarlo en `public/fixtures.json` y `api/src/data/fixtures.json`, campo `rules`.

## Probar en local

Instala dependencias:

```bash
npm install
cd api
npm install
cp local.settings.example.json local.settings.json
cd ..
```

Para probar rápido sin base de datos, deja `STORAGE_CONNECTION_STRING` vacío en `api/local.settings.json`. Los datos vivirán en memoria mientras esté arrancada la API.

Arranca Vite:

```bash
npm run dev
```

En otra terminal, arranca Azure Static Web Apps CLI:

```bash
npx @azure/static-web-apps-cli start http://localhost:5173 --api-location api
```

Abre la URL que indique la CLI, normalmente `http://localhost:4280`.

Con los valores de ejemplo:

- Código de invitación: `amigos2026`
- Código admin: `admin2026-cambialo`

## Desplegar en Azure Static Web Apps

### 1. Crear repositorio en GitHub

```bash
git init
git add .
git commit -m "Porra Mundial 2026 fase de grupos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2. Crear grupo de recursos y Storage

```bash
az login
az group create --name rg-porra-mundial --location westeurope

az storage account create \
  --name porramundial2026store \
  --resource-group rg-porra-mundial \
  --location westeurope \
  --sku Standard_LRS

CONN=$(az storage account show-connection-string \
  --name porramundial2026store \
  --resource-group rg-porra-mundial \
  --query connectionString \
  --output tsv)
```

El nombre del Storage debe ser único globalmente. Si `porramundial2026store` está ocupado, usa otro nombre en minúsculas y sin guiones.

### 3. Crear la Static Web App

Opción cómoda: desde Azure Portal.

1. Create a resource.
2. Static Web App.
3. Conecta GitHub.
4. Selecciona el repositorio y la rama `main`.
5. Build preset: Custom.
6. App location: `/`.
7. API location: `api`.
8. Output location: `dist`.
9. Crear.

Azure creará o usará el workflow de GitHub Actions.

### 4. Configurar variables de entorno en Azure

En Azure Portal, entra en tu Static Web App > Configuration > Application settings y añade:

```text
PUBLIC_JOIN_CODE=elige-un-codigo-para-tus-amigos
ADMIN_CODE=elige-un-codigo-admin-largo
TOKEN_SECRET=elige-un-secreto-largo-aleatorio
STORAGE_CONNECTION_STRING=<connection string del Storage>
TABLE_NAME=PorraMundial2026
```

También puedes configurarlas por CLI:

```bash
az staticwebapp appsettings set \
  --name TU_STATIC_WEB_APP \
  --resource-group rg-porra-mundial \
  --setting-names \
  "PUBLIC_JOIN_CODE=elige-un-codigo-para-tus-amigos" \
  "ADMIN_CODE=elige-un-codigo-admin-largo" \
  "TOKEN_SECRET=elige-un-secreto-largo-aleatorio" \
  "STORAGE_CONNECTION_STRING=$CONN" \
  "TABLE_NAME=PorraMundial2026"
```

### 5. Compartir la web

Comparte con tus amigos:

- URL pública de Azure Static Web Apps.
- Código de invitación `PUBLIC_JOIN_CODE`.

No compartas el `ADMIN_CODE`.

## Cambiar partidos o equipos

Edita estos dos archivos con los mismos cambios:

- `public/fixtures.json`
- `api/src/data/fixtures.json`

`public/fixtures.json` lo usa la web para pintar partidos. `api/src/data/fixtures.json` lo usa la API para validar pronósticos y calcular clasificación.

## Uso recomendado

1. Antes del Mundial, deja la porra abierta.
2. Cada amigo entra y guarda sus 72 marcadores.
3. Antes del primer partido, entra en Admin y pulsa `Cerrar porra`.
4. Después de cada jornada, mete resultados reales en Admin.
5. La clasificación se recalcula automáticamente.
