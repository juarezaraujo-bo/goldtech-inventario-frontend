const ROLE_ALIASES = {
  admin_goldtech: 'admin',
  tecnico: 'goldtech_team',
  tecnico_goldtech: 'goldtech_team'
};

export const normalizeRole = (role) => ROLE_ALIASES[role] || role || 'user';

export const getCurrentUser = () => JSON.parse(localStorage.getItem('user') || '{}');

export const isAdminRole = (role) => normalizeRole(role) === 'admin';

export const isGoldtechTeamRole = (role) => ['admin', 'goldtech_team'].includes(normalizeRole(role));

export const getRoleLabel = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'admin') return 'Admin GoldTech';
  if (normalizedRole === 'goldtech_team') return 'Tecnico GoldTech';
  return 'Operador';
};
