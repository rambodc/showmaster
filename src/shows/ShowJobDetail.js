import React, { useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiPlus, FiSave, FiTrash2, FiUser } from 'react-icons/fi';
import AppShell from '../components/AppShell';
import ShowRoute from '../components/ShowRoute';
import { NoticeContext, UserContext } from '../App';
import { db, functions } from '../firebase';
import { buildShowNavItems, useShowContext } from '../services/accessPolicy';
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

  const navItems = useMemo(() => buildShowNavItems({ showId, ctx }), [ctx, showId]);
  const canManage = Boolean(ctx.isShowAdmin);

  const updateJob = async (event) => {
    event.preventDefault();
    if (!jobForm.title.trim()) return;
    setSavingJob(true);
    try {
      const fn = httpsCallable(functions, 'updateJob');
      await fn({ showId, jobId, ...jobForm });
      notify('Job updated.', 'success');
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
      const fn = httpsCallable(functions, 'updateJobCompany');
      await fn({ showId, jobId, company: companyForm });
      notify('Company widget updated.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to update company.', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const addContact = async (event) => {
    event.preventDefault();
    setSavingContact(true);
    try {
      const fn = httpsCallable(functions, 'addJobCompanyContact');
      await fn({ showId, jobId, contact: contactForm });
      setContactForm(emptyContact);
      notify('Contact added.', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to add contact.', 'error');
    } finally {
      setSavingContact(false);
    }
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
              <h3 style={{ marginTop: 0 }}>Job Summary</h3>
              <form className="form-grid" onSubmit={updateJob}>
                <input value={jobForm.title} onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Job title" required />
                <input value={jobForm.type} onChange={(e) => setJobForm((prev) => ({ ...prev, type: e.target.value }))} placeholder="Type" />
                <select value={jobForm.status} onChange={(e) => setJobForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="waiting">waiting</option>
                  <option value="complete">complete</option>
                  <option value="cancelled">cancelled</option>
                </select>
                <select value={jobForm.priority} onChange={(e) => setJobForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  <option value="normal">normal</option>
                  <option value="low">low</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
                <textarea rows={3} value={jobForm.description} onChange={(e) => setJobForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" />
                <button className="show-btn" type="submit" disabled={savingJob || !jobForm.title.trim()}>
                  <FiSave /> {savingJob ? 'Saving...' : 'Save Job'}
                </button>
              </form>
            </section>
          ) : null}

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}>Company Widget</h3>
            {canManage ? (
              <form className="form-grid" onSubmit={updateCompany}>
                <input value={companyForm.name} onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Company name" />
                <input value={companyForm.legalName} onChange={(e) => setCompanyForm((prev) => ({ ...prev, legalName: e.target.value }))} placeholder="Legal name" />
                <input value={companyForm.type} onChange={(e) => setCompanyForm((prev) => ({ ...prev, type: e.target.value }))} placeholder="Company type" />
                <input value={companyForm.email} onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
                <input value={companyForm.phone} onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
                <input value={companyForm.website} onChange={(e) => setCompanyForm((prev) => ({ ...prev, website: e.target.value }))} placeholder="Website" />
                <input value={companyForm.status} onChange={(e) => setCompanyForm((prev) => ({ ...prev, status: e.target.value }))} placeholder="Status" />
                <textarea rows={2} value={companyForm.address} onChange={(e) => setCompanyForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="Address" />
                <textarea rows={3} value={companyForm.notes} onChange={(e) => setCompanyForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
                <button className="show-btn" type="submit" disabled={savingCompany}>
                  <FiSave /> {savingCompany ? 'Saving...' : 'Save Company'}
                </button>
              </form>
            ) : (
              <div className="member-card">
                <strong>{company.name || 'No company saved'}</strong>
                <p className="info-note">{company.email || company.phone || company.status || 'No company details yet.'}</p>
              </div>
            )}
          </section>

          <section className="show-card">
            <h3 style={{ marginTop: 0 }}>Company Contacts</h3>
            {canManage ? (
              <form className="form-grid" onSubmit={addContact}>
                <input value={contactForm.firstName} onChange={(e) => setContactForm((prev) => ({ ...prev, firstName: e.target.value }))} placeholder="First name" />
                <input value={contactForm.lastName} onChange={(e) => setContactForm((prev) => ({ ...prev, lastName: e.target.value }))} placeholder="Last name" />
                <input value={contactForm.displayName} onChange={(e) => setContactForm((prev) => ({ ...prev, displayName: e.target.value }))} placeholder="Display name" />
                <input value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
                <input value={contactForm.phone} onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
                <input value={contactForm.title} onChange={(e) => setContactForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" />
                <label className="switch-row">
                  <span>Primary contact</span>
                  <input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} />
                </label>
                <textarea rows={2} value={contactForm.notes} onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />
                <button className="show-btn" type="submit" disabled={savingContact || (!contactForm.displayName.trim() && !contactForm.email.trim() && !contactForm.firstName.trim())}>
                  <FiPlus /> {savingContact ? 'Adding...' : 'Add Contact'}
                </button>
              </form>
            ) : null}

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
                    <button className="show-btn-danger" type="button" onClick={() => removeContact(contact.id)}>
                      <FiTrash2 /> Remove
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </AppShell>
    </ShowRoute>
  );
}
