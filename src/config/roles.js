const agentRights = ['manageLabels', 'manageTemplates', 'broadcastMessage'];

const allRoles = {
  student: [],
  agent: agentRights,
  super_admin: [
    ...agentRights,
    'getUsers',
    'manageUsers',
    'pinMessage',
    'manageGroupChats',
    'manageBatches',
    'manageBatchDeletion',
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
