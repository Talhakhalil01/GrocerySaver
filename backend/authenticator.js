const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const dotenv = require('dotenv');
const User = require('./DB_Models/user');
const Category = require('./DB_Models/category');
const List = require('./DB_Models/list');



// Load environment variables
dotenv.config();

// JWT Tokens Secret
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;


const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        console.log("*****NO ACCESS TOKEN IN HEADER*****");
        return res.status(401).json({ 
            status: 'error', 
            message: 'Authentication token missing' 
        });
    }

    try {
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };

        next();
    } catch (error) {
        console.error('Access token verification failed:', error);
        return res.status(401).json({ 
            status: 'error', 
            message: 'Invalid or expired access token' 
        });
    }
};


router.get('/check-auth', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

        if (!token) {
            console.error("======User not logged In=======")
            return res.json({ isAuthenticated: false });
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return res.status(200).json({ isAuthenticated: true });
    } catch (error) {
        console.log("===***User not authenticated***:::",error)
        return res.status(401).json({ 
            isAuthenticated: false,
            status: 'error',
            message: 'Invalid or expired access token' 
        });
        // return res.status(401).json({ isAuthenticated: false });
    }
});

// User Signup Route
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Basic validations
        if (!username || !email || !password) {
            return res.status(400).json({ status: 'error', message: 'All fields are required' });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({ status: 'error', message: 'Email already in use' });
        }

        // Check if username already exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({ status: 'error', message: 'Username already in use' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        // Save user to database
        await newUser.save();
        console.log('New user saved to database:', {
            username: newUser.username,
            email: newUser.email,
            _id: newUser._id
        });

        res.status(201).json({
            status: 'success',
            message: 'User registered successfully'
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// check-username.js
router.post('/check-username', async (req, res) => {
    const { username } = req.body;
    const exists = await User.exists({ username });  // or User.findOne
    return res.json({ exists: !!exists });
  });
  
  // check-email.js
  router.post('/check-email', async (req, res) => {
    const { email } = req.body;
    const exists = await User.exists({ email });
    return res.json({ exists: !!exists });
  });
  
// User Signin Route
router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validations
        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email and password are required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'No account exists with this email' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password' });
        }

        console.log("Access token secret:",ACCESS_TOKEN_SECRET," and Refresh token secret:",REFRESH_TOKEN_SECRET)
        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id, email: user.email },
            ACCESS_TOKEN_SECRET,
            { expiresIn: '1m' } // short-lived
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' } // long-lived
        );

        // Send refresh token as httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        console.log("Cookie generated with sameSite value:",`${process.env.NODE_ENV === 'production' ? 'strict' : 'lax'}`," and secure value:",`${process.env.NODE_ENV === 'production'}`)
       
         // Send access token in response body
         res.status(200).json({
            status: 'success',
            message: 'Login successful',
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });


    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});


router.get('/refresh-token', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    console.log("***********Refresh token API called*******8")
    if (!refreshToken) {
        console.log("No refresh token received")
        return res.status(401).json({ status: 'error', message: 'Refresh token missing' });
    }

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

        // Re-issue a new access token
        const newAccessToken = jwt.sign(
            { userId: decoded.userId },
            ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        );

        console.log("***====Token Refreshed====****")
        res.status(200).json({
            status: 'success',
            accessToken: newAccessToken
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(403).json({ status: 'error', message: 'Invalid or expired refresh token' });
    }
});





// Protected route example (add this after the signin route)
router.get('/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'User not found' 
            });
        }
        
        res.status(200).json({
            status: 'success',
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error' 
        });
    }
});


// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    
    res.status(200).json({ 
        status: 'success', 
        message: 'Logged out successfully' 
    });
});

module.exports = {
    router,
    authenticateToken,
  };
