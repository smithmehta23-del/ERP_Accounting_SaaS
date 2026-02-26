require("dotenv").config();

const express = require("express");
const app = express();

const accountsRoute = require("./routes/accounts");

// middleware
app.use(express.json());

// routes
app.use("/api/accounts", accountsRoute);

// server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
