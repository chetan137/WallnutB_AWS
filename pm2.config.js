/**
 * pm2.config.js
 *
 * PM2 ecosystem config for the Wallnut API on the AWS EC2 box.
 *
 * Usage:
 *   pm2 startOrReload pm2.config.js --update-env   # deploy (start if new, reload if running)
 *   pm2 restart wallnut-api                        # hard restart
 *   pm2 logs wallnut-api                           # tail logs
 *   pm2 save && pm2 startup                        # auto-start on EC2 reboot
 */
module.exports = {
  apps: [
    {
      name:   'wallnut-api',
      script: 'server.js',
      cwd:    __dirname,

      // Single instance — this is a small dashboard API, no need for cluster mode.
      instances: 1,
      exec_mode: 'fork',

      // Safety net against memory leaks, not a hard resource constraint.
      max_memory_restart: '300M',
      restart_delay:       5000,
      max_restarts:         20,

      // Secrets stay in .env (loaded by dotenv inside config/index.js).
      env: {
        NODE_ENV: 'production',
      },

      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file:      'logs/error.log',
      out_file:        'logs/out.log',
      merge_logs:      true,
    },
  ],
};
