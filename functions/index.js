import { createInternalUser } from './api/createInternalUser.js';
import { assignUserToShow } from './api/assignUserToShow.js';
import { updateShowMemberAccess } from './api/updateShowMemberAccess.js';
import { searchUsers } from './api/searchUsers.js';
import { removeUserFromShow } from './api/removeUserFromShow.js';
import { createShow } from './api/createShow.js';
import { setShowIcons } from './api/setShowIcons.js';
import {
  createJob,
  updateJob,
  updateJobCompany,
  addJobCompanyContact,
  updateJobCompanyContact,
  removeJobCompanyContact,
} from './api/jobs.js';

// Deployment sentinel: keep this file in sync with the exported callable functions.
// Jobs architecture callables are exported here so CI deploys them with functions changes.
export {
  createInternalUser,
  assignUserToShow,
  updateShowMemberAccess,
  searchUsers,
  removeUserFromShow,
  createShow,
  setShowIcons,
  createJob,
  updateJob,
  updateJobCompany,
  addJobCompanyContact,
  updateJobCompanyContact,
  removeJobCompanyContact,
};
