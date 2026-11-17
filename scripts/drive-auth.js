import { createServer } from 'node:http';

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const { GDRIVE_CLIENT_ID: clientId, GDRIVE_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error('Define GDRIVE_CLIENT_ID y GDRIVE_CLIENT_SECRET (en .env o en el entorno) antes de autorizar.');
  process.exit(1);
}

const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',
})}`;

async function exchange(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!data.refresh_token) throw new Error(JSON.stringify(data));
  return data.refresh_token;
}

const server = createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  if (!code) return void res.writeHead(400).end('Falta el codigo de autorizacion.');
  try {
    const refreshToken = await exchange(code);
    res.end('Listo. Ya puedes cerrar esta ventana.');
    console.log(`\nGDRIVE_REFRESH_TOKEN=${refreshToken}\n`);
  } catch (error) {
    res.writeHead(500).end('No se pudo completar la autorizacion.');
    console.error(error.message);
    process.exitCode = 1;
  }
  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Abre este enlace con la cuenta de Google que guardara los archivos:\n\n${consentUrl}\n`);
});
