FROM nginx
COPY index.html /usr/share/nginx/html/
COPY builds /usr/share/nginx/html
COPY fonts /usr/share/nginx/html
COPY fnt /usr/share/nginx/html 
