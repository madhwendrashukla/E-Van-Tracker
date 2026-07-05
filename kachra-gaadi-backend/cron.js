const cron = require('node-cron');
const supabase = require('./config/supabase');

function startCronJobs() {
  // Run everyday at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily location_logs cleanup...');
    try {
      // Calculate timestamp 24 hours ago
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      
      const { data, error } = await supabase
        .from('location_logs')
        .delete()
        .lt('timestamp', cutoff.toISOString());
        
      if (error) {
        console.error('[CRON ERROR] Failed to clean up location_logs:', error);
      } else {
        console.log(`[CRON SUCCESS] Cleaned up location_logs older than ${cutoff.toISOString()}`);
      }
    } catch (err) {
      console.error('[CRON ERROR] Exception during cleanup:', err);
    }
  });
  
  console.log('Cron jobs initialized: Daily cleanup scheduled.');
}

module.exports = { startCronJobs };
