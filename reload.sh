#!/bin/bash
sudo docker build -t goodcode .
sudo docker stop goodcode
sudo docker rm goodcode
sudo docker run -d -p "80:80" --name goodcode goodcode
