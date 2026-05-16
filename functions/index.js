import { createInternalUser } from './api/createInternalUser.js';
import { assignUserToShow, assignManagerToShow } from './api/assignUserToShow.js';
import { updateShowMemberAccess, updateShowManagerAccess } from './api/updateShowMemberAccess.js';
import { searchUsers } from './api/searchUsers.js';
import { removeUserFromShow, removeManagerFromShow } from './api/removeUserFromShow.js';
import { createShow } from './api/createShow.js';
import { setShowIcons, updateShowDetails } from './api/setShowIcons.js';
import {
  createJob,
  updateJob,
  updateJobCompany,
  addJobCompanyContact,
  updateJobCompanyContact,
  removeJobCompanyContact,
  createJobRequest,
  updateJobRequest,
  submitJobRequestResponse,
} from './api/jobs.js';
import { inviteJobMember, removeJobMember, updateJobMemberAccess } from './api/jobMembers.js';
import { draftJobWithAi } from './api/aiJobs.js';

// Deployment sentinel: keep this file in sync with the exported callable functions.
// Jobs architecture callables are exported here so CI deploys them with functions changes.
export {
  createInternalUser,
  assignUserToShow,
  assignManagerToShow,
  updateShowMemberAccess,
  updateShowManagerAccess,
  searchUsers,
  removeUserFromShow,
  removeManagerFromShow,
  createShow,
  setShowIcons,
  updateShowDetails,
  createJob,
  updateJob,
  updateJobCompany,
  addJobCompanyContact,
  updateJobCompanyContact,
  removeJobCompanyContact,
  createJobRequest,
  updateJobRequest,
  submitJobRequestResponse,
  inviteJobMember,
  removeJobMember,
  updateJobMemberAccess,
  draftJobWithAi,
};
