const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all drivers
router.get('/', authenticateToken, authorizeRole('admin', 'supervisor'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('drivers').select('*');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a driver
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { name, phone, license_number, status } = req.body;
    const { data, error } = await supabase.from('drivers').insert([{ name, phone, license_number, status }]).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a driver
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, status } = req.body;
    const { data, error } = await supabase.from('drivers').update({ name, phone, license_number, status }).eq('id', id).select();
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a driver
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
