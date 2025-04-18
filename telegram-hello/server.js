// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const path = require('path');
const cors = require('cors');

// Create Express app
const app = express();

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname)));

// Parse JSON bodies
app.use(express.json());

// Route to serve the registration form
app.get('/registration', (req, res) => {
  res.sendFile(path.join(__dirname, 'registration-form.html'));
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Kambo Klarity Registration Server is running!');
});

// Start the server
const PORT = process.env.FORM_SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Registration form server is running on port ${PORT}`);
  console.log(`Form URL: http://localhost:${PORT}/registration`);
});