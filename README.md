# boxhacks

Alojamiento temporal de archivos con enlace directo, en la línea de litterbox. El servidor recibe el
archivo, devuelve el enlace al instante y, en segundo plano, lo cifra y lo guarda en Google Drive.
Los archivos caducan solos (tres días por defecto).

## Cómo funciona

```
navegador / curl ──> nginx ──> servidor Node ──> disco local (spool y caché)
                                    │
                                    └── cola ──> cifrado AES-256-GCM ──> Google Drive
```

- **Subida**: el archivo se escribe en el disco del servidor y el enlace funciona de inmediato.
- **Sincronización**: una cola cifra cada archivo por bloques de 1 MiB y lo sube a una carpeta propia
  de Drive con un nombre opaco. Cada archivo tiene su clave, guardada envuelta con la clave maestra.
- **Descarga**: se sirve desde el disco local mientras quepa en la caché. Si ya fue desalojado, se lee
  de Drive descifrando solo los bloques pedidos, así que los rangos (saltar en un vídeo) siguen funcionando.
- **Limpieza**: un proceso borra lo caducado en disco y en Drive, y desaloja de la caché lo menos usado.

Sin credenciales de Drive el servicio funciona igual, solo con el disco local.

## API

Cada archivo vive en `https://box.hacks.win/<nombre>` y también en `<nombre>.<extensión>`.

```bash
# Subir: responde con el enlace en texto plano
curl -T video.mp4 https://box.hacks.win

# Nombre y caducidad a elegir (30m, 12h, 3d... hasta 7d)
curl -T video.mp4 "https://box.hacks.win/video.mp4?slug=demo&expires=1d"
curl -F slug=demo -F expires=1d -F file=@video.mp4 https://box.hacks.win

# Respuesta en JSON
curl -H "Accept: application/json" -T foto.png https://box.hacks.win
```

```python
import requests
url = requests.put("https://box.hacks.win/foto.png", data=open("foto.png", "rb")).text.strip()
```

La primera subida devuelve un token (cabecera `X-Box-Token`, campo `token` en JSON y cookie en el
navegador). Enviándolo como `Authorization: Bearer <token>` las siguientes subidas quedan agrupadas:

| Método y ruta | Qué hace |
| --- | --- |
| `PUT /<archivo>` o `PUT /api/files/<archivo>` | Sube el cuerpo de la petición. Admite `?slug=` y `?expires=`. |
| `POST /` o `POST /api/files` | Sube por formulario (`file`, `slug`, `expires`). |
| `GET /<nombre>` | Descarga. Admite `Range` y `?dl` para forzar la descarga. |
| `GET /api/files` | Lista los archivos del token. |
| `GET /api/files/<nombre>` | Datos de un archivo. |
| `DELETE /api/files/<nombre>` | Lo borra (solo su token). |
| `GET /api/slugs/<nombre>` | Indica si un nombre está libre. |

Los errores llegan como texto (`error: ...`) o, con `Accept: application/json`, como
`{"error": "codigo", "message": "..."}`.

## Desarrollo

Requiere Node 24 o superior.

```bash
npm install
npm run dev     # http://localhost:8795
npm test
```

La configuración va por variables de entorno; `.env.example` las documenta.

## Estructura

```
src/core       configuración y reglas de dominio (nombres, caducidad, tipos)
src/store      SQLite: esquema y consultas
src/storage    disco local, cifrado, cliente de Drive y lectura unificada
src/services   biblioteca, recepción, cola de sincronización y limpieza
src/http       router, identidad, rutas
web            interfaz sin paso de build; el pixel art se genera en web/assets/js/pixel
deploy         systemd, nginx y scripts de publicación
```

## Conectar Google Drive

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto, activa la
   **Google Drive API** y crea credenciales OAuth de tipo **Aplicación de escritorio**.
   Publica la pantalla de consentimiento (en modo de prueba el permiso caduca a los siete días).
2. Con `GDRIVE_CLIENT_ID` y `GDRIVE_CLIENT_SECRET` en `.env`, ejecuta `npm run drive:auth`,
   abre el enlace con la cuenta que guardará los archivos y copia el `GDRIVE_REFRESH_TOKEN` que imprime.
3. Pon las tres variables en `/opt/boxhacks/env` del servidor y reinicia: `systemctl restart boxhacks`.

El permiso pedido (`drive.file`) solo da acceso a lo que crea la propia aplicación, dentro de la
carpeta indicada en `GDRIVE_FOLDER`.

## Despliegue

```bash
BOX_SSH=root@servidor deploy/release.sh
```

Publica el commit actual en `/opt/boxhacks`. En la primera ejecución instala un Node propio, crea el
usuario y el servicio `boxhacks`, pide el certificado y configura nginx. El dominio debe apuntar ya al
servidor, sin proxy, para que las subidas grandes no pasen por el límite de Cloudflare.

La clave maestra se genera en `/opt/boxhacks/env`. Sin ella no se puede leer lo guardado en Drive.
