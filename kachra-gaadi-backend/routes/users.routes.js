const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// Get all users
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id, email, role, created_at');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a user
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Check if user exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) return res.status(400).json({ success: false, message: 'User already exists' });
    
    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase.from('users').insert([{ email, password_hash, role }]).select('id, email, role, created_at');
    
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user role
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const { data, error } = await supabase.from('users').update({ role }).eq('id', id).select('id, email, role, created_at');
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a user
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    // Don't let admin delete themselves
    if (req.user.id === id) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
