FROM nginx
COPY index.html /usr/share/nginx/html/
COPY builds /usr/share/nginx/html/builds
COPY fonts /usr/share/nginx/html/fonts
COPY fnt /usr/share/nginx/html/fnt
COPY meshes /usr/share/nginx/html/meshes
