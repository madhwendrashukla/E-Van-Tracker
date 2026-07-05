const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all settings
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a setting
router.put('/:key', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const { data, error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select();
      
    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
