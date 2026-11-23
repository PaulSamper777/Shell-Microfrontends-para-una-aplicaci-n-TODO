# Shell – TODO Microfrontends

## Descripción
Aplicación contenedora que carga los microfrontends Editor y Viewer desde las direcciones definidas en registry.json. La configuración de la API se encuentra en config.json.

## Archivos
- index.html: estructura de la página y espacios donde se muestran los microfrontends.
- shell.js: carga la configuración y el registro, importa los microfrontends y los coloca en sus espacios.
- config.json: dirección base de la API.
- registry.json: nombre, etiqueta, espacio, versión y URL de cada microfrontend.

## Requisitos
- AWS CLI configurado con permisos para cargar archivos al bucket S3.
- Bucket S3 configurado para alojamiento de sitio web estático.
- URLs públicas de Editor y Viewer, con permisos de lectura y CORS compatibles con el origen del Shell.

## Despliegue
1. Configurar config.json con la URL de la API.
2. Configurar registry.json con las URLs públicas reales de Editor y Viewer.
3. Desde la carpeta shell, ejecutar:

aws s3 cp . s3://paul-shell-mfe-2026-633212682914/ --recursive --region us-east-1

4. Abrir el endpoint de sitio web estático del bucket para comprobar la aplicación.

## Pruebas
- Abrir el sitio Shell.
- Comprobar que Editor y Viewer aparecen.
- Crear una tarea y verificar que se refleje en Viewer.
- Revisar la consola y Network para detectar errores.

## Seguridad
No incluir claves ni credenciales AWS en el código fuente.
