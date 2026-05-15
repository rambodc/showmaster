import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiEdit3, FiPlus, FiSave, FiTrash2, FiUpload, FiUser } from 'react-icons/fi';
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

export default function ShowJobDetail() {
  const { showId, jobId } = useParams();
  const appUser = useContext(UserContext);
  const ctx = useShowContext({ showId, appUser });
  const navigate = useNavigate();
  const { notify } = useContext(NoticeContext);
  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(emptyCompany);
  const [contacts, setContacts] = useState([]);
  const [jobForm, setJobForm] = useState({ title: '', description: '', type: 'general', status: 'draft', priority: 'normal' });
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [savingJob, setSavingJob] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false);
  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [companyLogoFile, setCompanyLogoFile] = useState(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState('');

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
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [jobId, showId]);

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
  const canManage = Boolean(ctx.featureAccess?.jobs);

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
      notify(err?.message || 'Failed to add contact.', 'error');
    } finally {
      setSavingContact(false);
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
            <p className="show-subtitle">{job?.description || 'Company is the first active widget for this job.'}</p>
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

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}>Company Contacts</h3>
            {canManage ? <button className="show-btn" type="button" onClick={openAddContact}><FiPlus /> Add Contact</button> : null}

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
                  {canManage ? (
                    <div className="show-actions">
                      <button className="show-btn-outline" type="button" onClick={() => openEditContact(contact)}><FiEdit3 /> Edit</button>
                      <button className="show-btn-danger" type="button" onClick={() => removeContact(contact.id)}><FiTrash2 /> Remove</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
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
            <div className="drawer-actions"><button className="show-btn-outline" type="button" onClick={() => setContactDrawerOpen(false)}>Cancel</button><button className="show-btn" type="submit" disabled={savingContact || (!contactForm.displayName.trim() && !contactForm.email.trim() && !contactForm.firstName.trim())}><FiPlus /> {savingContact ? 'Adding...' : 'Add Contact'}</button></div>
          </form>
        </RightDrawer>
      </AppShell>
    </ShowRoute>
  );
}
