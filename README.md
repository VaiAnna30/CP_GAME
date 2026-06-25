# ⚔️ CF Battle Royale

![CF Battle Royale](https://img.shields.io/badge/Status-Live-success)
![Codeforces](https://img.shields.io/badge/Powered_by-Codeforces-blue)
![React](https://img.shields.io/badge/Frontend-React-61DAFB)
![NodeJS](https://img.shields.io/badge/Backend-Node.js-339933)

**CF Battle Royale** is a real-time, competitive programming multiplayer game that turns Codeforces problem-solving into a strategic game of Tic-Tac-Toe. Compete against friends by solving algorithms to claim territory on the board!

**🎮 Play Live:** [https://cp-battle-royale.onrender.com/](https://cp-battle-royale.onrender.com/)

---

## 🚀 Features

- **Real-Time Multiplayer Sync:** Built with WebSockets (`Socket.io`) to ensure sub-second game state synchronization across concurrent clients.
- **Live Codeforces Integration:** Automatically polls Codeforces submission data (`user.status`) to instantly detect when a player successfully solves a problem and claims a cell.
- **Strategic Board Generation:** Uses a custom positional algorithm that maps harder problems to strategically advantageous grid cells (e.g., corners) and easier problems to the center, ensuring fair and competitive gameplay.
- **Resilient API Polling Engine:** Mitigates the strict Codeforces API rate-limits by implementing an in-memory `NodeCache` layer and an exponential backoff strategy (using `Bottleneck`) to guarantee zero IP bans.
- **Algorithmic Tie-Breakers:** Built-in match engine to resolve draws based on cells claimed and total solve times.

## 🛠 Tech Stack

### Frontend
- **Framework:** React.js (Vite)
- **State Management:** Zustand
- **Real-time Communication:** Socket.io-client

### Backend
- **Runtime & Framework:** Node.js, Express.js
- **Database:** MongoDB (Mongoose)
- **Real-time Server:** Socket.io
- **API Resilience:** Node-Cache (Caching layer), Bottleneck (Rate limiting & backoff)

---

## ⚙️ How It Works (Under the Hood)

1. **The Board Algorithm:** When a match is created, the server fetches problems within a specific rating range from Codeforces. It stratifies these problems into difficulty buckets. To balance the Tic-Tac-Toe mechanics, corners are assigned 'Hard' problems, edges get 'Medium', and the center gets 'Easy'.
2. **The Polling Engine:** Once the match starts, the `CFPoller` service actively monitors the `user.status` endpoint for all active players.
3. **Handling Rate Limits:** To prevent getting blocked by Codeforces (HTTP 429), the server uses a strict 1-request-per-2-seconds queue, paired with local caching for static problem sets.
4. **Claiming a Cell:** If a player receives an "Accepted" verdict on a problem matching an unclaimed cell on the board, the server processes the claim, evaluates win conditions, and instantly broadcasts the updated state via WebSockets.

---

## 💻 Local Development Setup

To run this project locally, you'll need Node.js and a MongoDB connection string.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/codeforces_Game.git
cd codeforces_Game
```

### 2. Install Dependencies
Run the built-in script to install dependencies for the root, server, and client simultaneously:
```bash
npm run install-all
```

### 3. Environment Variables
Create a `.env` file in the `server` directory and add the following:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173
CF_API_BASE=https://codeforces.com/api
CF_POLL_INTERVAL=4000
```

### 4. Start the Application
Run both the frontend and backend concurrently:
```bash
npm run dev
```

- **Client** will run on `http://localhost:5173`
- **Server** will run on `http://localhost:5000`

---

## 🤝 Contributing
Feel free to fork the repository, open issues, and submit pull requests. If you have an idea for a new game mode or feature, I'd love to hear it!

## 📜 License
This project is open-source and available under the [MIT License](LICENSE).
