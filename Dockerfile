# Usar una imagen base de nginx para servir archivos estáticos
FROM nginx:alpine

# Copiar archivos del proyecto al directorio web de nginx
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/

# Exponer el puerto que Railway asignará
EXPOSE 80

# Comando por defecto para ejecutar nginx
CMD ["nginx", "-g", "daemon off;"]
