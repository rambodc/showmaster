import { assignManagerToShow } from './api/assignManagerToShow.js';
import { updateShowManagerAccess } from './api/updateShowManagerAccess.js';
import { searchUsers } from './api/searchUsers.js';
import { removeManagerFromShow } from './api/removeManagerFromShow.js';
import { createShow } from './api/createShow.js';
import { setShowIcons, updateShowDetails, uploadShowIcons } from './api/setShowIcons.js';
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
import { removeJobMember, updateJobMemberAccess } from './api/jobMembers.js';
import { draftJobWithAi } from './api/aiJobs.js';
import { acceptInvite, inviteUser, previewInvite, resendInvite } from './api/invitations.js';

// Deployment sentinel: keep this file in sync with exported callable functions.
// Jobs architecture callables are exported here so CI deploys them with functions changes.
export {
  assignManagerToShow,
  updateShowManagerAccess,
  searchUsers,
  removeManagerFromShow,
  createShow,
  setShowIcons,
  uploadShowIcons,
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
  removeJobMember,
  updateJobMemberAccess,
  draftJobWithAi,
  inviteUser,
  resendInvite,
  previewInvite,
  acceptInvite,
};
