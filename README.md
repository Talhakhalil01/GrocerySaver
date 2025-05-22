🛒 Grocery Saver App
A fullstack productivity web app designed to help users manage grocery lists efficiently. Users can sign up, log in securely, and create categories (like Vegetables, Snacks, etc.), add lists within those categories, and manage items with full CRUD capabilities.


✨ Features
🔐 User Authentication with JWT (Login / Signup)

📁 Create Categories for organizing your groceries

📝 Create Lists within categories (e.g., "Weekly Shopping")

✅ Add / Update / Delete Items in each list

🧠 Built with a clean state-managed UI and RESTful backend

🧱 Tech Stack
👨‍🎨 Frontend
React.js

Redux (for state management)

HTML & CSS

Axios for API calls

⚙️ Backend
Node.js with Express.js

MongoDB with Mongoose

JWT for Authentication

CORS, Helmet, dotenv, and other middlewares


📁 Project Structure
GrocerySaver/
├── frontend/        # React + Redux app
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/         # Express + MongoDB API
│   ├── DBmodels/
│   ├── authenticator.js
│   ├── server.js
│   └── package.json
│
└── README.md
