import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBriefcase,
  FiDownload,
  FiEdit3,
  FiMail,
  FiPaperclip,
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
import { buildShowNavItems, canAccessJob, useShowContext } from '../services/accessPolicy';
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

const MAX_MESSAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_MESSAGE_ATTACHMENT_TOTAL_BYTES = 16 * 1024 * 1024;

function getShowIconUrl(show) {
  return show?.iconUrls?.md || show?.iconUrls?.sm || show?.iconUrls?.lg || show?.iconUrl || '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function displayDate(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function cleanFileName(value) {
  const name = String(value || 'attachment').trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return name || 'attachment';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('Failed to read attachment.'));
    reader.readAsDataURL(file);
  });
}

export default function ShowJobDetail() {
  const { showId, jobId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [job, setJob] = useState(null);
  const [allJobs, setAllJobs] = useState([]);
  const [company, setCompany] = useState(emptyCompany);
  const [contacts, setContacts] = useState([]);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [jobForm, setJobForm] = useState({ title: '', description: '', type: 'general', status: 'draft', priority: 'normal' });
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [selectedMemberUser, setSelectedMemberUser] = useState(null);
  const [searchingMember, setSearchingMember] = useState(false);
  const [canInviteNewMember, setCanInviteNewMember] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [messageFiles, setMessageFiles] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState('');

  const canManage = Boolean(ctx.featureAccess?.jobs);

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
    if (!showId || ctx.loading) return undefined;
    if (ctx.jobAccess?.mode === 'selected' && !ctx.isFullManager) {
      const ids = ctx.jobAccess.jobIds || [];
      if (!ids.length) {
        setAllJobs([]);
        return undefined;
      }
      const unsubs = ids.map((id) => onSnapshot(doc(db, 'shows', showId, 'jobs', id), (snap) => {
        setAllJobs((prev) => {
          const rest = prev.filter((item) => item.id !== id);
          return snap.exists() ? [...rest, { id: snap.id, ...snap.data() }] : rest;
        });
      }));
      return () => unsubs.forEach((unsub) => unsub());
    }

    const q = query(collection(db, 'shows', showId, 'jobs'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAllJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => canAccessJob(ctx, item.id)));
    });
    return () => unsub();
  }, [ctx, ctx.isFullManager, ctx.jobAccess, ctx.loading, showId]);

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
    const q = query(collection(db, 'shows', showId, 'jobs', jobId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [jobId, showId]);

  const searchMemberUsers = useCallback(async (term) => {
    const clean = term.trim();
    if (clean.length < 2) {
      setMemberSearchResults([]);
      setCanInviteNewMember(false);
      return;
    }
    setSearchingMember(true);
    try {
      const fn = httpsCallable(functions, 'searchUsers');
      const result = await fn({ query: clean, limit: 8, showId });
      const existingIds = new Set(members.map((member) => member.id));
      setMemberSearchResults((result.data?.users || []).filter((user) => !existingIds.has(user.uid)));
      setCanInviteNewMember(Boolean(result.data?.canInviteNew));
    } catch (err) {
      notify(err?.message || 'Failed to search users.', 'error');
    } finally {
      setSearchingMember(false);
    }
  }, [members, notify, showId]);

  useEffect(() => {
    const term = memberEmail.trim();
    if (term.length < 2) {
      setMemberSearchResults([]);
      setCanInviteNewMember(false);
      return undefined;
    }
    const timer = window.setTimeout(() => searchMemberUsers(term), 220);
    return () => window.clearTimeout(timer);
  }, [memberEmail, searchMemberUsers]);

  useEffect(() => {
    if (!companyLogoFile) {
      setCompanyLogoPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(companyLogoFile);
    setCompanyLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [companyLogoFile]);

  const navItems = useMemo(() => buildShowNavItems({ showId, jobs: allJobs.length ? allJobs : (job ? [job] : []), ctx }), [allJobs, ctx, job, showId]);

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
      notify('Company info updated.', 'success');
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
    const email = selectedMemberUser?.email || memberEmail.trim();
    if (!isValidEmail(email)) return;
    setSavingMember(true);
    try {
      const fn = httpsCallable(functions, 'inviteUser');
      const result = await fn({
        email,
        target: { type: 'job_member', showId, jobId },
      });
      setMemberEmail('');
      setSelectedMemberUser(null);
      setMemberSearchResults([]);
      setCanInviteNewMember(false);
      notify(result.data?.mode === 'existing' ? 'Access granted and notification sent.' : 'Invitation email sent.', 'success');
      setMemberDrawerOpen(false);
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

  const buildMessageFileUploads = async () => {
    const totalBytes = messageFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    if (totalBytes > MAX_MESSAGE_ATTACHMENT_TOTAL_BYTES) {
      throw new Error('Message attachments must be 16 MB or smaller total.');
    }

    return Promise.all(messageFiles.map(async (file) => {
      if ((file.size || 0) > MAX_MESSAGE_ATTACHMENT_BYTES) {
        throw new Error('Each message attachment must be 8 MB or smaller.');
      }
      const fileId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const fileName = cleanFileName(file.name);
      return {
        fileId,
        fileName: file.name || fileName,
        contentType: file.type || 'application/octet-stream',
        size: file.size || 0,
        dataBase64: await fileToBase64(file),
      };
    }));
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!messageBody.trim() && !messageFiles.length) return;
    setSendingMessage(true);
    try {
      const batchId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const fileUploads = await buildMessageFileUploads();
      const fn = httpsCallable(functions, 'sendJobMessage');
      await fn({ showId, jobId, body: messageBody, batchId, fileUploads });
      setMessageBody('');
      setMessageFiles([]);
      notify('Message sent.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to send message.', 'error');
    } finally {
      setSendingMessage(false);
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
      <AppShell title={ctx.show?.name || 'Show'} navItems={navItems} showIconUrl={getShowIconUrl(ctx.show)} showBackButton>
        <div className="show-page-stack">
          <div className="show-page-top-nav">
            <button className="show-btn-outline" type="button" onClick={() => navigate(`/shows/${showId}/jobs`)}>
              <FiArrowLeft /> Jobs
            </button>
          </div>

          <section className="show-hero-card">
            <span className="show-chip"><FiBriefcase /> Job</span>
            <h2 className="show-title">{job?.title || 'Job'}</h2>
            <p className="show-subtitle">{job?.description || 'Company conversation, files, and job details.'}</p>
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
            <h3 style={{ marginTop: 0 }}>Company Info</h3>
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
                  <h3>Company Portal Access</h3>
                  <p className="info-note">Invite company contacts to reply and upload files in this job.</p>
                </div>
                <button className="show-btn" type="button" onClick={() => { setMemberEmail(''); setSelectedMemberUser(null); setMemberSearchResults([]); setCanInviteNewMember(false); setMemberDrawerOpen(true); }}><FiUserPlus /> Invite Contact</button>
              </div>
              <div className="members-grid" style={{ marginTop: 16 }}>
                {members.length === 0 ? <p className="info-note">No company contacts invited yet.</p> : null}
                {members.map((member) => (
                  <article className="member-card" key={member.id}>
                    <div className="member-selected-user">
                      <span className="member-avatar"><FiUser /></span>
                      <div>
                        <strong>{member.displayName || member.email || 'Contact'}</strong>
                        <p className="info-note">{member.companyName || member.email || 'Company contact'}</p>
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
                <h3>Conversation</h3>
                <p className="info-note">Messages notify the other side by email. Replies happen here in the portal.</p>
              </div>
            </div>

            <div className="job-message-list">
              {messages.length === 0 ? <p className="info-note">No messages yet. Start the conversation below.</p> : null}
              {messages.map((message) => (
                <article className={message.senderId === appUser?.id ? 'job-message own' : 'job-message'} key={message.id}>
                  <div className="job-message-head">
                    <strong>{message.senderName || message.senderEmail || 'Message'}</strong>
                    <span>{message.senderRole === 'company' ? 'Company' : 'Manager'} · {displayDate(message.createdAt)}</span>
                  </div>
                  {message.body ? <p>{message.body}</p> : null}
                  {message.attachments?.length ? (
                    <div className="job-attachment-list">
                      {message.attachments.map((attachment) => (
                        <a className="job-attachment" href={attachment.downloadUrl} target="_blank" rel="noreferrer" key={attachment.fileId || attachment.storagePath}>
                          <FiDownload /> {attachment.fileName}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="job-message-meta">
                    {message.email?.attempted ? `Email: ${message.email.sentCount || 0} sent${message.email.failedCount ? `, ${message.email.failedCount} failed` : ''}` : 'Email: no recipients'}
                  </div>
                </article>
              ))}
            </div>

            <form className="job-message-composer" onSubmit={sendMessage}>
              <textarea rows={4} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Write a message..." />
              <div className="job-message-composer-bottom">
                <label className="show-btn-outline job-file-picker">
                  <FiPaperclip /> Attach files
                  <input type="file" multiple onChange={(e) => setMessageFiles(Array.from(e.target.files || []))} />
                </label>
                <button className="show-btn" type="submit" disabled={sendingMessage || (!messageBody.trim() && !messageFiles.length)}>
                  <FiSend /> {sendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>
              {messageFiles.length ? (
                <div className="job-selected-files">
                  {messageFiles.map((file) => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}
                </div>
              ) : null}
            </form>
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

        <RightDrawer open={memberDrawerOpen} title="Invite Contact" eyebrow="Company Portal" onClose={() => setMemberDrawerOpen(false)}>
          <form className="form-grid" onSubmit={inviteMember}>
            <input type="email" value={memberEmail} onChange={(e) => { setMemberEmail(e.target.value); setSelectedMemberUser(null); }} placeholder="Email" required />
            {searchingMember ? <p className="info-note">Searching...</p> : null}
            {memberSearchResults.length ? (
              <div className="member-search-results">
                {memberSearchResults.map((user) => (
                  <button key={user.uid} className="member-search-result" type="button" onClick={() => { setSelectedMemberUser(user); setMemberEmail(user.email || ''); setMemberSearchResults([]); }}>
                    <span className="member-avatar">{String(user.firstName || user.email || '?').charAt(0).toUpperCase()}</span>
                    <span><strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</strong><small>{user.email}</small></span>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedMemberUser ? <p className="info-note">Selected: {selectedMemberUser.email}</p> : null}
            {!selectedMemberUser && canInviteNewMember ? <p className="info-note">Invite new user: {memberEmail.trim()}</p> : null}
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setMemberDrawerOpen(false)}>Close</button><button className="show-btn" type="submit" disabled={savingMember || !isValidEmail(selectedMemberUser?.email || memberEmail)}><FiMail /> {savingMember ? 'Inviting...' : 'Invite Contact'}</button></div>
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
