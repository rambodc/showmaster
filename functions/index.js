import { createInternalUser } from './api/createInternalUser.js';
import { assignManagerToShow } from './api/assignManagerToShow.js';
import { updateShowManagerAccess } from './api/updateShowManagerAccess.js';
import { searchUsers } from './api/searchUsers.js';
import { removeManagerFromShow } from './api/removeManagerFromShow.js';
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

// Deployment sentinel: keep this file in sync with exported callable functions.
// Jobs architecture callables are exported here so CI deploys them with functions changes.
export {
  createInternalUser,
  assignManagerToShow,
  updateShowManagerAccess,
  searchUsers,
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
