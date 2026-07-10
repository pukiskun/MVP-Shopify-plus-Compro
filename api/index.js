const app = require('../src/app');
const { setup } = require('../src/config/db-setup');

// Run database migrations on Vercel cold start
let dbReady = setup().catch((err) => {
  console.error('Failed to initialize database on Vercel:', err);
});

module.exports = async (req, res) => {
  await dbReady;
  return app(req, res);
};
