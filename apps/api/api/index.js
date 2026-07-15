// Vercel Functions エントリポイント。
// ビルド済みの dist/ (nest build の出力) を読み込むだけの薄いラッパー。
const { getServer } = require('../dist/vercel-server');

module.exports = async (req, res) => {
  const server = await getServer();
  return server(req, res);
};
