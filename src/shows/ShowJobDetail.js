import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBriefcase,
  FiEdit3,
  FiMail,
  FiPlus,
  FiSave,
  FiSend,
  FiTrash2,
  FiUpload,
  FiUser,
  FiUserPlus,
} from 'react-icons/fi';
import AppShell from '../components/AppShell';
import RightDrawer from '../components/RightDrawer';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions, storage } from '../firebase';
import { buildShowNavItems, useShowContext } from '../services/accessPolicy';
import { uploadSquareImageSet } from '../services/imageResize';
import './showPages.css';

const emptyCompany = {
  name: '',
  legalName: '',
  type: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  notes: '',
  status: 'draft',
};

const emptyContact = {
  firstName: '',
  lastName: '',
  displayName: '',
  email: '',
  phone: '',
  title: '',
  notes: '',
  isPrimary: false,
};

const emptyRequest = {
  title: '',
  instructions: '',
  dueDate: '',
  status: 'open',
  fieldsText: '',
};

function responseDraftFrom(response = {}) {
  return {
    message: response.message || '',
    fieldValues: response.fieldValues || {},
  };
}

function requestPayloadFrom(form) {
  return {
    title: form.title,
    instructions: form.instructions,
    dueDate: form.dueDate,
    status: form.status,
    fields: String(form.fieldsText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label, type: 'text', required: false })),
  };
}

export default function ShowJobDetail() {
  const { showId, jobId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(emptyCompany);
  const [contacts, setContacts] = useState([]);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [responsesByRequest, setResponsesByRequest] = useState({});
  const [responseDrafts, setResponseDrafts] = useState({});
  const [jobForm, setJobForm] = useState({ title: '', description: '', type: 'general', status: 'draft', priority: 'normal' });
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [memberForm, setMemberForm] = useState({ email: '', displayName: '', companyName: '' });
  const [requestForm, setRequestForm] = useState(emptyRequest);
  const [savingJob, setSavingJob] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [savingResponseId, setSavingResponseId] = useState('');
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [requestDrawerOpen, setRequestDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState('');

  const canManage = Boolean(ctx.featureAccess?.jobs);
  const isMemberOnly = Boolean(ctx.hasMemberAccess && !canManage && !ctx.isSuperAdmin && !ctx.isFullManager);

  useEffect(() => {
    if (!showId || !jobId) return undefined;
    const unsub = onSnapshot(doc(db, 'shows', showId, 'jobs', jobId), (snap) => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setJob(data);
      if (data) {
        setJobForm({
          title: data.title || '',
          description: data.description || '',
          type: data.type || 'general',
          status: data.status || 'draft',
          priority: data.priority || 'normal',
        });
      }
    });
    return () => unsub();
  }, [jobId, showId]);

  useEffect(() => {
    if (!showId || !jobId) return undefined;
    const unsub = onSnapshot(doc(db, 'shows', showId, 'jobs', jobId, 'widgets', 'company'), (snap) => {
      const next = snap.exists() ? { ...emptyCompany, ...snap.data() } : emptyCompany;
      setCompany(next);
      setCompanyForm(next);
    });
    return () => unsub();
  }, [jobId, showId]);

  useEffect(() => {
    if (!showId || !jobId) return undefined;
    const q = query(collection(db, 'shows', showId, 'jobs', jobId, 'widgets', 'company', 'contacts'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [jobId, showId]);

  useEffect(() => {
    if (!showId || !jobId || !canManage) {
      setMembers([]);
      return undefined;
    }
    const unsub = onSnapshot(collection(db, 'shows', showId, 'jobs', jobId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [canManage, jobId, showId]);

  useEffect(() => {
    if (!showId || !jobId) return undefined;
    const q = query(collection(db, 'shows', showId, 'jobs', jobId, 'widgets', 'requests', 'records'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [jobId, showId]);

  useEffect(() => {
    if (!showId || !jobId || !requests.length || !appUser?.id) {
      setResponsesByRequest({});
      return undefined;
    }
    const unsubs = requests.map((requestItem) => {
      if (canManage) {
        return onSnapshot(collection(db, 'shows', showId, 'jobs', jobId, 'widgets', 'requests', 'records', requestItem.id, 'responses'), (snap) => {
          setResponsesByRequest((prev) => ({
            ...prev,
            [requestItem.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          }));
        });
      }
      return onSnapshot(doc(db, 'shows', showId, 'jobs', jobId, 'widgets', 'requests', 'records', requestItem.id, 'responses', appUser.id), (snap) => {
        const response = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
        setResponsesByRequest((prev) => ({ ...prev, [requestItem.id]: response }));
        if (snap.exists()) {
          setResponseDrafts((prev) => ({
            ...prev,
            [requestItem.id]: prev[requestItem.id] || responseDraftFrom(snap.data()),
          }));
        }
      });
    });
    return () => unsubs.forEach((unsub) => unsub());
  }, [appUser?.id, canManage, jobId, requests, showId]);

  useEffect(() => {
    if (!companyLogoFile) {
      setCompanyLogoPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(companyLogoFile);
    setCompanyLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [companyLogoFile]);

  const navItems = useMemo(() => buildShowNavItems({ showId, jobs: job ? [job] : [], ctx }), [ctx, job, showId]);

  const updateJob = async (event) => {
    event.preventDefault();
    if (!jobForm.title.trim()) return;
    setSavingJob(true);
    try {
      const fn = httpsCallable(functions, 'updateJob');
      await fn({ showId, jobId, ...jobForm });
      notify('Job updated.', 'success');
      setJobDrawerOpen(false);
    } catch (err) {
      notify(err?.message || 'Failed to update job.', 'error');
    } finally {
      setSavingJob(false);
    }
  };

  const updateCompany = async (event) => {
    event.preventDefault();
    setSavingCompany(true);
    try {
      let logoUrls = companyForm.logoUrls || null;
      if (companyLogoFile) {
        logoUrls = await uploadSquareImageSet({
          storage,
          file: companyLogoFile,
          basePath: `shows/${showId}/jobs/${jobId}/company-logo`,
          prefix: 'logo',
        });
      }
      const fn = httpsCallable(functions, 'updateJobCompany');
      await fn({ showId, jobId, company: { ...companyForm, logoUrls } });
      notify('Company widget updated.', 'success');
      setCompanyLogoFile(null);
      setCompanyDrawerOpen(false);
    } catch (err) {
      notify(err?.message || 'Failed to update company.', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const saveContact = async (event) => {
    event.preventDefault();
    setSavingContact(true);
    try {
      const fn = httpsCallable(functions, editingContact ? 'updateJobCompanyContact' : 'addJobCompanyContact');
      await fn({ showId, jobId, contactId: editingContact?.id, contact: contactForm });
      setContactForm(emptyContact);
      setEditingContact(null);
      notify(editingContact ? 'Contact updated.' : 'Contact added.', 'success');
      setContactDrawerOpen(false);
    } catch (err) {
      notify(err?.message || 'Failed to save contact.', 'error');
    } finally {
      setSavingContact(false);
    }
  };

  const inviteMember = async (event) => {
    event.preventDefault();
    if (!memberForm.email.trim()) return;
    setSavingMember(true);
    setInviteLink('');
    try {
      const fn = httpsCallable(functions, 'inviteJobMember');
      const result = await fn({ showId, jobId, ...memberForm });
      setInviteLink(result.data?.passwordResetLink || '');
      setMemberForm({ email: '', displayName: '', companyName: '' });
      notify('Member invited. Share the setup link with them.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to invite member.', 'error');
    } finally {
      setSavingMember(false);
    }
  };

  const removeMember = async (member) => {
    const confirmed = window.confirm(`Remove ${member.email || member.displayName || 'this member'} from this job?`);
    if (!confirmed) return;
    try {
      const fn = httpsCallable(functions, 'removeJobMember');
      await fn({ showId, jobId, userId: member.id });
      notify('Member removed.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove member.', 'error');
    }
  };

  const saveRequest = async (event) => {
    event.preventDefault();
    if (!requestForm.title.trim()) return;
    setSavingRequest(true);
    try {
      const fn = httpsCallable(functions, editingRequest ? 'updateJobRequest' : 'createJobRequest');
      await fn({
        showId,
        jobId,
        requestId: editingRequest?.id,
        request: requestPayloadFrom(requestForm),
      });
      setRequestForm(emptyRequest);
      setEditingRequest(null);
      setRequestDrawerOpen(false);
      notify(editingRequest ? 'Request updated.' : 'Request created.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to save request.', 'error');
    } finally {
      setSavingRequest(false);
    }
  };

  const submitResponse = async (requestItem) => {
    const draft = responseDrafts[requestItem.id] || { message: '', fieldValues: {} };
    setSavingResponseId(requestItem.id);
    try {
      const fn = httpsCallable(functions, 'submitJobRequestResponse');
      await fn({ showId, jobId, requestId: requestItem.id, ...draft });
      notify('Response submitted.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to submit response.', 'error');
    } finally {
      setSavingResponseId('');
    }
  };

  const openAddContact = () => {
    setEditingContact(null);
    setContactForm(emptyContact);
    setContactDrawerOpen(true);
  };

  const openEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({ ...emptyContact, ...contact });
    setContactDrawerOpen(true);
  };

  const openAddRequest = () => {
    setEditingRequest(null);
    setRequestForm(emptyRequest);
    setRequestDrawerOpen(true);
  };

  const openEditRequest = (requestItem) => {
    setEditingRequest(requestItem);
    setRequestForm({
      title: requestItem.title || '',
      instructions: requestItem.instructions || '',
      dueDate: requestItem.dueDate || '',
      status: requestItem.status || 'open',
      fieldsText: (requestItem.fields || []).map((field) => field.label).join('\n'),
    });
    setRequestDrawerOpen(true);
  };

  const removeContact = async (contactId) => {
    const confirmed = window.confirm('Remove this contact?');
    if (!confirmed) return;
    try {
      const fn = httpsCallable(functions, 'removeJobCompanyContact');
      await fn({ showId, jobId, contactId });
      notify('Contact removed.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to remove contact.', 'error');
    }
  };

  return (
    <ShowRoute permission="view_show">
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showBackButton>
        <div className="show-page-stack">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/jobs`)}>
              <FiArrowLeft /> Jobs
            </button>
          </div>

          <section className="show-hero-card">
            <span className="show-chip"><FiBriefcase /> Job</span>
            <h2 className="show-title">{job?.title || 'Job'}</h2>
            <p className="show-subtitle">{job?.description || 'Company and requests are active widgets for this job.'}</p>
          </section>

          {!job ? <section className="show-card"><p className="info-note">Loading job...</p></section> : null}

          {job && canManage ? (
            <section className="show-card">
              <div className="member-list-toolbar">
                <div>
                  <h3>Job Summary</h3>
                  <p className="info-note">Status: {job.status || 'draft'} · Type: {job.type || 'general'} · Priority: {job.priority || 'normal'}</p>
                </div>
                <button className="show-btn-outline" type="button" onClick={() => setJobDrawerOpen(true)}><FiEdit3 /> Edit Job</button>
              </div>
            </section>
          ) : null}

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}>Company Widget</h3>
            <div className="member-card">
              <div className="member-selected-user">
                <span className="member-avatar large">
                  {company.logoUrls?.sm ? <img src={company.logoUrls.sm} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <FiBriefcase />}
                </span>
                <div>
                  <strong>{company.name || 'No company saved'}</strong>
                  <p className="info-note">{company.email || company.phone || company.status || 'No company details yet.'}</p>
                </div>
              </div>
              {canManage ? <button className="show-btn-outline" type="button" onClick={() => setCompanyDrawerOpen(true)}><FiEdit3 /> Edit Company</button> : null}
            </div>
          </section>

          {canManage ? (
            <section className="show-card">
              <div className="member-list-toolbar">
                <div>
                  <h3>Job Members</h3>
                  <p className="info-note">Invite company reps to respond to this job only.</p>
                </div>
                <button className="show-btn" type="button" onClick={() => { setInviteLink(''); setMemberDrawerOpen(true); }}><FiUserPlus /> Invite Member</button>
              </div>
              <div className="members-grid" style={{ marginTop: 16 }}>
                {members.length === 0 ? <p className="info-note">No job members invited yet.</p> : null}
                {members.map((member) => (
                  <article className="member-card" key={member.id}>
                    <div className="member-selected-user">
                      <span className="member-avatar"><FiUser /></span>
                      <div>
                        <strong>{member.displayName || member.email || 'Member'}</strong>
                        <p className="info-note">{member.companyName || member.email || 'Company rep'}</p>
                      </div>
                    </div>
                    <button className="show-btn-danger" type="button" onClick={() => removeMember(member)}><FiTrash2 /> Remove</button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="show-card">
            <div className="member-list-toolbar">
              <div>
                <h3>Requests</h3>
                <p className="info-note">{isMemberOnly ? 'Respond to manager requests for this job.' : 'Create requests for assigned company reps.'}</p>
              </div>
              {canManage ? <button className="show-btn" type="button" onClick={openAddRequest}><FiPlus /> Add Request</button> : null}
            </div>
            <div className="members-grid" style={{ marginTop: 16 }}>
              {requests.length === 0 ? <p className="info-note">No requests yet.</p> : null}
              {requests.map((requestItem) => {
                const responses = responsesByRequest[requestItem.id] || [];
                const ownDraft = responseDrafts[requestItem.id] || { message: '', fieldValues: {} };
                return (
                  <article className="member-card" key={requestItem.id}>
                    <div>
                      <strong>{requestItem.title || 'Request'}</strong>
                      <p className="info-note">{requestItem.instructions || 'No instructions'}</p>
                      <div className="show-compact-meta">
                        <span>Status: {requestItem.status || 'open'}</span>
                        {requestItem.dueDate ? <span>Due: {requestItem.dueDate}</span> : null}
                        <span>Responses: {responses.length}</span>
                      </div>
                    </div>
                    {canManage ? (
                      <>
                        <button className="show-btn-outline" type="button" onClick={() => openEditRequest(requestItem)}><FiEdit3 /> Edit Request</button>
                        <div className="form-grid" style={{ marginTop: 12 }}>
                          {responses.length === 0 ? <p className="info-note">No responses submitted.</p> : null}
                          {responses.map((response) => (
                            <div className="member-card" key={response.id}>
                              <strong>{response.displayName || response.email || 'Member response'}</strong>
                              <p className="info-note">{response.message || 'No message'}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="form-grid" style={{ marginTop: 12 }}>
                        {(requestItem.fields || []).map((field) => (
                          <input
                            key={field.label}
                            value={ownDraft.fieldValues?.[field.label] || ''}
                            onChange={(e) => setResponseDrafts((prev) => ({
                              ...prev,
                              [requestItem.id]: {
                                ...ownDraft,
                                fieldValues: { ...(ownDraft.fieldValues || {}), [field.label]: e.target.value },
                              },
                            }))}
                            placeholder={field.label}
                          />
                        ))}
                        <textarea
                          rows={3}
                          value={ownDraft.message}
                          onChange={(e) => setResponseDrafts((prev) => ({
                            ...prev,
                            [requestItem.id]: { ...ownDraft, message: e.target.value },
                          }))}
                          placeholder="Response message"
                        />
                        <button className="show-btn" type="button" onClick={() => submitResponse(requestItem)} disabled={savingResponseId === requestItem.id}>
                          <FiSend /> {savingResponseId === requestItem.id ? 'Submitting...' : 'Submit Response'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {canManage ? (
            <section className="show-card">
              <h3 style={{ marginTop: 0 }}>Company Contacts</h3>
              <button className="show-btn" type="button" onClick={openAddContact}><FiPlus /> Add Contact</button>
              <div className="members-grid" style={{ marginTop: 16 }}>
                {contacts.length === 0 ? <p className="info-note">No contacts added yet.</p> : null}
                {contacts.map((contact) => (
                  <article className="member-card" key={contact.id}>
                    <div className="member-selected-user">
                      <span className="member-avatar"><FiUser /></span>
                      <div>
                        <strong>{contact.displayName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact'}</strong>
                        <p className="info-note">{contact.title || contact.email || contact.phone || 'No details'}</p>
                        {contact.isPrimary ? <span className="member-module-chip">Primary</span> : null}
                      </div>
                    </div>
                    <div className="show-actions">
                      <button className="show-btn-outline" type="button" onClick={() => openEditContact(contact)}><FiEdit3 /> Edit</button>
                      <button className="show-btn-danger" type="button" onClick={() => removeContact(contact.id)}><FiTrash2 /> Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <RightDrawer open={jobDrawerOpen} title="Edit Job" eyebrow="Jobs" onClose={() => setJobDrawerOpen(false)}>
          <form className="form-grid" onSubmit={updateJob}>
            <input value={jobForm.title} onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Job title" required />
            <input value={jobForm.type} onChange={(e) => setJobForm((prev) => ({ ...prev, type: e.target.value }))} placeholder="Type" />
            <select value={jobForm.status} onChange={(e) => setJobForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="draft">draft</option><option value="active">active</option><option value="waiting">waiting</option><option value="complete">complete</option><option value="cancelled">cancelled</option>
            </select>
            <select value={jobForm.priority} onChange={(e) => setJobForm((prev) => ({ ...prev, priority: e.target.value }))}>
              <option value="normal">normal</option><option value="low">low</option><option value="high">high</option><option value="urgent">urgent</option>
            </select>
            <textarea rows={3} value={jobForm.description} onChange={(e) => setJobForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" />
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setJobDrawerOpen(false)}>Cancel</button><button className="show-btn" type="submit" disabled={savingJob || !jobForm.title.trim()}><FiSave /> {savingJob ? 'Saving...' : 'Save Job'}</button></div>
          </form>
        </RightDrawer>

        <RightDrawer open={memberDrawerOpen} title="Invite Member" eyebrow="Job Members" onClose={() => setMemberDrawerOpen(false)}>
          <form className="form-grid" onSubmit={inviteMember}>
            <input type="email" value={memberForm.email} onChange={(e) => setMemberForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" required />
            <input value={memberForm.displayName} onChange={(e) => setMemberForm((prev) => ({ ...prev, displayName: e.target.value }))} placeholder="Display name" />
            <input value={memberForm.companyName} onChange={(e) => setMemberForm((prev) => ({ ...prev, companyName: e.target.value }))} placeholder="Company name" />
            {inviteLink ? (
              <label className="member-form-label">
                <span>Setup link</span>
                <textarea rows={4} value={inviteLink} readOnly />
              </label>
            ) : null}
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setMemberDrawerOpen(false)}>Close</button><button className="show-btn" type="submit" disabled={savingMember || !memberForm.email.trim()}><FiMail /> {savingMember ? 'Inviting...' : 'Generate Invite'}</button></div>
          </form>
        </RightDrawer>

        <RightDrawer open={requestDrawerOpen} title={editingRequest ? 'Edit Request' : 'Add Request'} eyebrow="Requests" onClose={() => setRequestDrawerOpen(false)}>
          <form className="form-grid" onSubmit={saveRequest}>
            <input value={requestForm.title} onChange={(e) => setRequestForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Request title" required />
            <input value={requestForm.dueDate} onChange={(e) => setRequestForm((prev) => ({ ...prev, dueDate: e.target.value }))} placeholder="Due date" />
            <select value={requestForm.status} onChange={(e) => setRequestForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="open">open</option><option value="waiting">waiting</option><option value="complete">complete</option><option value="cancelled">cancelled</option>
            </select>
            <textarea rows={4} value={requestForm.instructions} onChange={(e) => setRequestForm((prev) => ({ ...prev, instructions: e.target.value }))} placeholder="Instructions" />
            <textarea rows={4} value={requestForm.fieldsText} onChange={(e) => setRequestForm((prev) => ({ ...prev, fieldsText: e.target.value }))} placeholder="Optional response fields, one per line" />
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setRequestDrawerOpen(false)}>Cancel</button><button className="show-btn" type="submit" disabled={savingRequest || !requestForm.title.trim()}><FiSave /> {savingRequest ? 'Saving...' : 'Save Request'}</button></div>
          </form>
        </RightDrawer>

        <RightDrawer open={companyDrawerOpen} title="Edit Company" eyebrow="Company" onClose={() => setCompanyDrawerOpen(false)}>
          <form className="form-grid" onSubmit={updateCompany}>
            <input value={companyForm.name} onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Company name" />
            <input value={companyForm.legalName} onChange={(e) => setCompanyForm((prev) => ({ ...prev, legalName: e.target.value }))} placeholder="Legal name" />
            <input value={companyForm.type} onChange={(e) => setCompanyForm((prev) => ({ ...prev, type: e.target.value }))} placeholder="Company type" />
            <input value={companyForm.email} onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
            <input value={companyForm.phone} onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
            <input value={companyForm.website} onChange={(e) => setCompanyForm((prev) => ({ ...prev, website: e.target.value }))} placeholder="Website" />
            <input value={companyForm.status} onChange={(e) => setCompanyForm((prev) => ({ ...prev, status: e.target.value }))} placeholder="Status" />
            <label className="switch-row"><span><FiUpload /> Company logo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCompanyLogoFile(e.target.files?.[0] || null)} /></label>
            {companyLogoPreview ? <img src={companyLogoPreview} alt="Company logo preview" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid #bae6fd' }} /> : null}
            <textarea rows={2} value={companyForm.address} onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="Address" />
            <textarea rows={3} value={companyForm.notes} onChange={(e) => setCompanyForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setCompanyDrawerOpen(false)}>Cancel</button><button className="show-btn" type="submit" disabled={savingCompany}><FiSave /> {savingCompany ? 'Saving...' : 'Save Company'}</button></div>
          </form>
        </RightDrawer>

        <RightDrawer open={contactDrawerOpen} title={editingContact ? 'Edit Contact' : 'Add Contact'} eyebrow="Company" onClose={() => { setContactDrawerOpen(false); setEditingContact(null); }}>
          <form className="form-grid" onSubmit={saveContact}>
            <input value={contactForm.firstName} onChange={(e) => setContactForm((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="First name" />
            <input value={contactForm.lastName} onChange={(e) => setContactForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Last name" />
            <input value={contactForm.displayName} onChange={(e) => setContactForm((prev) => ({ ...prev, displayName: e.target.value }))} placeholder="Display name" />
            <input value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
            <input value={contactForm.phone} onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
            <input value={contactForm.title} onChange={(e) => setContactForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" />
            <label className="switch-row"><span>Primary contact</span><input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} /></label>
            <textarea rows={2} value={contactForm.notes} onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setContactDrawerOpen(false)}>Cancel</button><button className="show-btn" type="submit" disabled={savingContact || (!contactForm.displayName.trim() && !contactForm.email.trim() && !contactForm.firstName.trim())}><FiPlus /> {savingContact ? 'Saving...' : 'Save Contact'}</button></div>
          </form>
        </RightDrawer>
      </AppShell>
    </ShowRoute>
  );
}
