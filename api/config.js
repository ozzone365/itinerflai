export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    supabaseUrl: process.env.S_URL || "",
    supabaseKey: process.env.S_KEY || "",
    openaiKey: process.env.O_KEY || ""
  });
}
