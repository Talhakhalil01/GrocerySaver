const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  name: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'pcs' },
    isCompleted: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

listSchema.index({ name: 1, userId: 1 }, { unique: true });

listSchema.pre('save', function (next) {
  const itemNames = this.items.map(item => item.name.toLowerCase());
  const hasDuplicates = itemNames.some((name, idx) => itemNames.indexOf(name) !== idx);

  if (hasDuplicates) {
    return next(new Error('Duplicate item names are not allowed in a list.'));
  }

  next();
});

module.exports = mongoose.model('List', listSchema);
