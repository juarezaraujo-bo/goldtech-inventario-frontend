/**
 * Middleware de autenticação para endpoints do Agente Goldtech.
 * Valida o header x-agent-token contra a variável de ambiente AGENT_TOKEN.
 */
const agentAuthMiddleware = (req, res, next) => {
  const token = req.headers['x-agent-token'];

  if (!token) {
    return res.status(401).json({ message: 'Token do agente ausente. Envie o header x-agent-token.' });
  }

  const expectedToken = process.env.AGENT_TOKEN;

  if (!expectedToken) {
    console.error('[AGENT-AUTH] AGENT_TOKEN não configurado no .env');
    return res.status(500).json({ message: 'Configuração de token ausente no servidor.' });
  }

  if (token !== expectedToken) {
    return res.status(401).json({ message: 'Token do agente inválido.' });
  }

  next();
};

module.exports = { agentAuthMiddleware };
