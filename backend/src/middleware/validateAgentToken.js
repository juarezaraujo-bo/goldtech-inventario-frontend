module.exports = function validateAgentToken(req, res, next) {
  const token = req.headers["x-agent-token"];

  if (!token) {
    return res.status(401).json({ message: "Agent token não informado" });
  }

  if (token !== process.env.AGENT_TOKEN) {
    return res.status(403).json({ message: "Agent token inválido" });
  }

  next();
};
