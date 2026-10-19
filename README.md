# ChatWave — Simple chat app

This repository contains a simple chat application (client + server) built with React, Node/Express, Socket.IO and MongoDB.

Folders:
- server : Express + Socket.IO backend
- client : React (Vite) frontend

Quick start (local):

1) Backend

cd server
cp .env.example .env
# edit .env if using MongoDB Atlas
npm install
npm run dev

2) Frontend

cd client
npm install
npm run dev

Open the Vite URL (usually http://localhost:5173) and register/login. Create conversations via the API endpoint /api/conversations or use Postman/curl.

Security notes:
- Do NOT commit real secrets. Keep .env out of git.
- Change JWT_SECRET to a strong random value.
