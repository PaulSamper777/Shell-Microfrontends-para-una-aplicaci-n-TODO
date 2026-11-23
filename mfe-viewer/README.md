# MFE Viewer (`todo-viewer`)

Microfrontend de **consulta** de la aplicación TODO. Lista las tareas, muestra el detalle de una tarea y su historial de eventos. Está construido como un **Custom Element** en JavaScript puro con Shadow DOM, y se publica como un módulo ES en un bucket de S3.

## Contrato

| Elemento | Valor |
|---|---|
| Etiqueta | `<todo-viewer>` |
| Atributo de entrada | `api-url`: URL base de `/todos`, sin barra final |
| Módulo | `todo-viewer.js` (módulo ES; al importarse registra el elemento) |
| Versión | `export const version = '1.0.0'` (el shell la muestra en el pie) |

### Eventos (en `window`)

| Evento | Dirección | Contenido (`detail`) |
|---|---|---|
| `todo:selected` | Emite | `{ id }` de la tarea elegida |
| `todo:created` | Escucha | TODO creado; recarga la lista |
| `todo:updated` | Escucha | TODO actualizado; recarga la lista y el detalle abierto |
| `todo:deleted` | Escucha | TODO eliminado (con su `id`); recarga la lista y limpia el detalle si era la tarea abierta |

### Operaciones de la API que consume

| Método | Ruta | Uso |
|---|---|---|
| GET | `/todos` | Lista de tareas |
| GET | `/todos/{id}` | Detalle de una tarea |
| GET | `/todos/{id}/history` | Historial de eventos |

El viewer no escribe nada: crear, editar y eliminar es responsabilidad del MFE Editor.

## Decisiones de diseño

- **Shadow DOM:** los estilos no se mezclan con los del shell ni los de otros MFE. Los colores se derivan de `currentColor`, así que se ven bien en tema claro y oscuro.
- **Seguridad:** todo el texto que llega de la API se pinta con `textContent`, nunca con `innerHTML`, para evitar XSS.
- **Limpieza:** los `addEventListener` de `window` se quitan en `disconnectedCallback`.
- **Registro seguro:** `if (!customElements.get('todo-viewer'))` evita el error de doble registro si el módulo se importa dos veces.
- **Estados de interfaz:** cargando, vacío y error (con botón *Reintentar*). Si falla el historial, el detalle de la tarea sigue visible.
- **Respuestas en orden:** si el usuario elige otra tarea mientras carga la anterior, se descarta la respuesta vieja.
- **Sin dependencias:** JavaScript puro, sin frameworks.

## Probar en local

Requiere Python. Desde esta carpeta:

    python -m http.server 8081

Abre `http://localhost:8081/test.html`, pega la URL de la API y pulsa **Cargar viewer**. Los botones *Simular* disparan `todo:created` y `todo:updated`. Para probar sin API real, usa `mock.html` (API simulada en memoria).

## Despliegue (bucket S3 propio, Cuenta C)

Bucket: `mfe-viewer-hance2066` · Región: `us-east-2`.

    B=mfe-viewer-hance2066
    aws s3 mb s3://$B --region us-east-2
    aws s3api put-public-access-block --bucket $B --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
    aws s3api put-bucket-policy --bucket $B --policy file://policy.json
    aws s3api put-bucket-cors --bucket $B --cors-configuration file://cors.json
    aws s3 website s3://$B --index-document todo-viewer.js
    aws s3 cp todo-viewer.js s3://$B/todo-viewer.js --content-type "text/javascript"

`policy.json` permite `s3:GetObject` público sobre el bucket y `cors.json` permite `GET` y `HEAD` desde cualquier origen.

### Verificación

    URL=http://$B.s3-website.us-east-2.amazonaws.com/todo-viewer.js
    curl -sI $URL                                               # 200 OK + Content-Type: text/javascript
    curl -sI -H "Origin: http://example.com" $URL | grep -i access-control

### URL para el `registry.json` del shell

    http://mfe-viewer-hance2066.s3-website.us-east-2.amazonaws.com/todo-viewer.js

### Publicar una nueva versión

1. Cambia `version` en `todo-viewer.js`.
2. Vuelve a ejecutar el `aws s3 cp` de arriba (con el mismo `--content-type`).
3. Recarga con `Ctrl + F5` para saltarte la caché del navegador.

No hace falta tocar el shell ni el otro microfrontend.

## Problemas frecuentes

| Síntoma | Causa probable | Qué revisar |
|---|---|---|
| Error CORS al importar el módulo | El bucket no devuelve `Access-Control-Allow-Origin` | `aws s3api get-bucket-cors` |
| `Failed to load module script: MIME type` | `Content-Type` incorrecto | Subir con `--content-type "text/javascript"` |
| 403 al abrir la URL | Falta la política pública o el bloqueo sigue activo | `get-bucket-policy` y `get-public-access-block` |
| `mixed content` | Shell en HTTPS y MFE en HTTP | Servir todo por HTTPS (CloudFront) |
| El historial sale vacío al crear una tarea | El historial se llena de forma asíncrona (SNS/SQS) | Esperar unos segundos y volver a seleccionar |
| Sigue la versión anterior | Caché del navegador | `Ctrl + F5` o ventana de incógnito |

## Integración de tecnología (Nivel Intermedio)

Esta versión usa JavaScript puro. Si el grupo migra el viewer a un framework (por ejemplo Lit o Svelte), debe seguir exponiéndose como Custom Element `todo-viewer` con el mismo atributo y los mismos eventos, y publicarse compilado (`dist/`).