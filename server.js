// Import packages
require('dotenv').config();
const express = require('express');
const path = require('path');

const websockets = require('./websockets');

// Set PORT variable from our process env file or default to 3000
const PORT = process.env.PORT || 3000;

// Create our express application
const app = express();

// Serve static files from the public folder on /public
app.use('/public', express.static('public'));

// Create an express server running on our port
const server = app.listen(PORT, ()=> {
    console.log(`server running on port ${PORT}`);
});

// Pass the express server to our websockets function where we will enable it to handle websockets
websockets(server);

// Handle a get request and send the index.html file
app.get('/', (req, res)=> {
    res.sendFile(path.join(__dirname, '/views', 'index.html'));
});
