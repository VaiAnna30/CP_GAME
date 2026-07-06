# CF Battle Royale

This is a simple real-time multiplayer game based on Codeforces. It's like Tic-Tac-Toe, but you have to solve Codeforces problems to claim squares. I built this as my 3rd project to learn React and Node.js.

## Features

- Real-time gameplay using Socket.io
- Fetches problems from Codeforces API
- Play with your friends

## Tech Stack

- **Frontend:** React, Vite
- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB

## How to run locally

1. Clone the repository
2. Install dependencies for server and client:
   ```bash
   npm run install-all
   ```
3. Create a `.env` file in the `server` folder:
   ```
   PORT=5000
   MONGO_URI=your_mongodb_url
   CLIENT_URL=http://localhost:5173
   CF_API_BASE=https://codeforces.com/api
   ```
4. Run the app:
   ```bash
   npm run dev
   ```

## License
MIT License
