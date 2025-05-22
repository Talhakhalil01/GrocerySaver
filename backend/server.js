const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./authenticator');      //Importing auth routes
//Importing MONGODB Models
const User = require('./DB_Models/user');
const Category = require('./DB_Models/category');
const List = require('./DB_Models/list');



// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// CORS Middleware (at the top)
app.use(cors({
    origin: [process.env.CLIENT_URL , 'http://localhost:5173', 'http://localhost:5174', "http://192.168.100.6:5173", "http://192.168.100.6:5174"],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


// Security Middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB successfully'))
.catch((err) => console.error('MongoDB connection error:', err));



// Mounting auth routes them under base path '/api'
app.use('/api', authRoutes.router);



// ========================
// 1. FETCH ALL CATEGORIES (On Dashboard Render)
// ========================
app.get('/api/categories', authRoutes.authenticateToken, async (req, res) => {
    try {
        const categories = await Category.find({ userId: req.user.userId });
       
        res.status(200).json({ status: 'success', data: categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ status: 'error', message: 'Error fetching categories' });
    }
});

// ========================
// 2. FETCH LISTS + ITEMS BY CATEGORY ID (On Category Click)
// ========================
app.get('/api/fetch-lists/:categoryId', authRoutes.authenticateToken, async (req, res) => {
    try {
        const { categoryId } = req.params;
        const lists = await List.find({ categoryId, userId: req.user.userId });
        res.status(200).json({ status: 'success', data: lists });
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ status: 'error', message: 'Error fetching lists' });
    }
});

// ========================
// 3. ADD NEW CATEGORY
// ========================
app.post('/api/add-category', authRoutes.authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ status: 'error', message: 'Category name is required' });
        }

          //Case-insensitive check manually (without schema change)
        const existingCategory = await Category.findOne({
            userId: req.user.userId,
            name: { $regex: `^${name}$`, $options: 'i' } // 'i' = case-insensitive
        });

        if (existingCategory) {
            return res.status(409).json({ status: 'error', message: 'Category already exists with this name' });
        }


        const newCategory = new Category({ name, userId: req.user.userId });
        await newCategory.save();

        res.status(201).json({ status: 'success', message: 'Category added successfully', data: newCategory });
    } catch (error) {
        console.error('Error adding category:', error);


        res.status(500).json({ status: 'error', message: 'Error adding category' });
    }
});



// ========================
// 5. DELETE Category and its Lists
// ========================
app.delete('/api/categories/:categoryId', authRoutes.authenticateToken, async (req, res) => {
    const { categoryId } = req.params;

    try {
        // First, delete all lists under this category
        await List.deleteMany({ categoryId });

        // Then, delete the category itself
        await Category.findByIdAndDelete(categoryId);

        res.status(200).json({ message: 'Category and its lists deleted successfully.' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Failed to delete category', error: error.message });
    }
});


// ========================
// 6. ADD NEW LIST WITH ITEMS (Without Checked Values)
// ========================
app.post('/api/categories/:categoryId/lists', authRoutes.authenticateToken, async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { name, items } = req.body;

        console.log("Names are:",name," and items:",items)

        if (!name || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'List name and items are required' });
        }
        
        const formattedItems = items.map(item => {
            if (typeof item === 'string') {
                return { name: item, quantity: 1, unit: 'pcs', isCompleted: false };
            } else if (typeof item === 'object' && item.name) {
                return {
                    name: item.name,
                    quantity: item.quantity > 0 ? item.quantity : 1,
                    unit: item.unit || 'pcs',  // fallback to 'pcs' if unit is missing
                    isCompleted: item.quantity <= 0
                };
            } else {
                throw new Error("Invalid item format");
            }
        });
        
        

        const newList = new List({
            name,
            categoryId,
            userId: req.user.userId,
            items: formattedItems
        });

        await newList.save();

        res.status(201).json({ status: 'success', message: 'List added successfully', data: newList });
    } catch (error) {
        console.error('Error adding list:', error);

        // 👇 Check for MongoDB Duplicate Key Error
        if (error.code === 11000) {
            return res.status(409).json({
                status: 'error',
                message: 'A list with this name already exists in the selected category.'
            });
        }

        // 👇 Handle item formatting errors
        if (error.message === "Invalid item format") {
            return res.status(400).json({
                status: 'error',
                message: 'One or more items have invalid format.'
            });
        }

        res.status(500).json({ status: 'error', message: 'Error adding list' });
    }
    
});


// ========================
// 7. DELETE LIST AND ITS ITEMS
// ========================
app.delete('/api/delete-lists/:listId', authRoutes.authenticateToken, async (req, res) => {
    try {
        const { listId } = req.params;

        const list = await List.findById(listId);
        if (!list) {
            return res.status(404).json({ status: 'error', message: 'List not found' });
        }

        await List.findByIdAndDelete(listId);

        res.status(200).json({ status: 'success', message: 'List deleted successfully' });
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ status: 'error', message: 'Error deleting list' });
    }
});


// ========================
// 8. DELETE ITEM FROM A LIST
// ========================
app.delete('/api/delete/:listId/item/:itemId', authRoutes.authenticateToken, async (req, res) => {
    try {
        const { listId, itemId } = req.params;

        console.log("List id received:",listId," and item id received:",itemId)

        const updatedList = await List.findOneAndUpdate(
            { _id: listId, userId: req.user.userId },
            { $pull: { items: { _id: itemId } } },
            { new: true }
        );

        if (!updatedList) {
            return res.status(404).json({ status: 'error', message: 'List not found or item not found' });
        }

        res.status(200).json({ status: 'success', message: 'Item deleted successfully', data: updatedList });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Error deleting item' });
    }
});


// ========================
// 9. TOGGLE ITEM STATUS
// ========================
app.patch('/api/items/:itemId/toggle', authRoutes.authenticateToken, async (req, res) => {
    const { itemId } = req.params;

    try {
        const list = await List.findOne({ 'items._id': itemId });

        if (!list) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const item = list.items.id(itemId);
        item.isCompleted = !item.isCompleted;

        await list.save();

        res.status(200).json({ message: 'Item toggled successfully', updatedItem: item });
    } catch (error) {
        console.error('Error toggling item:', error);
        res.status(500).json({ message: 'Error toggling item', error });
    }
});

// ========================
// 10. UPDATE LIST WITH NEW ITEMS
// ========================
app.patch('/api/updatelist/:listID', authRoutes.authenticateToken, async (req, res) => {
    try {
        const { listID } = req.params;
        const { items } = req.body;

        if (!listID || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'List ID and items are required' });
        }

        const list = await List.findById(listID);
        if (!list) {
            return res.status(404).json({ status: 'error', message: 'List not found' });
        }

        const existingItems = list.items;

        // Store any unit conflicts
        const unitConflicts = [];

        for (let newItem of items) {
            let formatted = {};

            if (typeof newItem === 'string') {
                formatted = { name: newItem.trim(), quantity: 1, unit: 'pcs', isCompleted: false };
            } else if (typeof newItem === 'object' && newItem.name) {
                formatted = {
                    name: newItem.name.trim(),
                    quantity: newItem.quantity > 0 ? newItem.quantity : 1,
                    unit: newItem.unit || 'pcs',
                    isCompleted: newItem.quantity <= 0
                };
            } else {
                continue;
            }

            const nameLower = formatted.name.toLowerCase();

            const exactMatchIndex = existingItems.findIndex(item =>
                item.name.trim().toLowerCase() === nameLower &&
                item.unit === formatted.unit
            );

            const nameConflictIndex = existingItems.findIndex(item =>
                item.name.trim().toLowerCase() === nameLower &&
                item.unit !== formatted.unit
            );

            if (exactMatchIndex !== -1) {
                // Increase quantity for same name and unit
                existingItems[exactMatchIndex].quantity += formatted.quantity;
            } else if (nameConflictIndex !== -1) {
                // Unit conflict — store conflict info
                unitConflicts.push({
                    name: formatted.name,
                    existingUnit: existingItems[nameConflictIndex].unit,
                    newUnit: formatted.unit
                });
            } else {
                // Add new item
                existingItems.push(formatted);
            }
        }

        // If conflicts exist, return error
        if (unitConflicts.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Unit conflict detected for items:${unitConflicts}`,
                conflicts: unitConflicts
            });
        }

        // Save list
        list.items = existingItems;
        const updatedList = await list.save();

        res.status(200).json({
            status: 'success',
            message: 'List updated successfully',
            data: updatedList
        });

    } catch (error) {
        console.error('Error updating list:', error);
        res.status(500).json({ status: 'error', message: 'Error updating list' });
    }
});


// ========================
//11: Update an exisitng Item
// ========================
app.patch('/api/updateItem/:listID/:itemID', authRoutes.authenticateToken, async (req, res) => {
    const { listID, itemID } = req.params;
    const { updatedItem } = req.body;

    try {
        if (!updatedItem || !updatedItem.name || updatedItem.quantity == null || !updatedItem.unit) {
            return res.status(400).json({ status: 'error', message: 'Incomplete item data' });
        }

        // Fetch the list first
        const list = await List.findById(listID);
        if (!list) {
            return res.status(404).json({ status: 'error', message: 'List not found' });
        }

       // Get the current item
        const currentItem = list.items.find(item => item._id.toString() === itemID);

        // If no changes in name, skip duplicate check
        const normalizedNewName = updatedItem.name.trim().toLowerCase();
        const normalizedCurrentName = currentItem?.name.trim().toLowerCase();

        // console.log("current name:",normalizedCurrentName," and named to be uupdated with is:",normalizedNewName," and list id:",listID, " and item id:",itemID)

        if (normalizedNewName !== normalizedCurrentName) {
            // Only check for duplicates if name is actually changing
            const hasDuplicate = list.items.some(item =>
                item._id.toString() !== itemID &&
                item.name.trim().toLowerCase() === normalizedNewName
            );

            if (hasDuplicate) {
                return res.status(400).json({ status: 'error', message: 'Item name already exists in the list (case-insensitive)' });
            }
        }


        // Find and update the specific item
        const itemToUpdate = list.items.id(itemID);
        if (!itemToUpdate) {
            return res.status(404).json({ status: 'error', message: 'Item not found in the list' });
        }

        itemToUpdate.name = updatedItem.name;
        itemToUpdate.quantity = updatedItem.quantity;
        itemToUpdate.unit = updatedItem.unit;

        await list.save();

        res.status(200).json({
            status: 'success',
            message: 'Item updated successfully',
            data: list
        });

    } catch (error) {
        console.error('Error updating list item:', error);
        res.status(500).json({ status: 'error', message: 'Error updating item' });
    }
});




// Test route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Handle 404 routes
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT || 5000, () => {
    console.log(`Server is running on port ${PORT}`);
});
