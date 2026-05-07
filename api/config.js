module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    supabaseUrl:     process.env.SUPABASE_URL      || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
};
