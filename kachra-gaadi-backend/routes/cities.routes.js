const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all cities
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('cities').select('*');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new city
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, code, state } = req.body;
    const { data, error } = await supabase.from('cities').insert([{ name, code, state }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a city
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, state } = req.body;
    const { data, error } = await supabase.from('cities').update({ name, code, state }).eq('id', id).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a city
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('cities').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'City deleted successfully' });
  } catch (error) {
    console.error('Error deleting city:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
