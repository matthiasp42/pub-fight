import { useState } from 'react';
import { api } from '../api/client';

export function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api.auth(password);
      if (result.success) {
        localStorage.setItem('sessionId', result.sessionId);
        onLogin();
      } else {
        setError(result.error || 'Invalid password');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Pub Fight</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          style={styles.input}
          autoFocus
          disabled={loading}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Joining...' : 'Enter'}
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px'
  },
  title: {
    fontSize: '3rem',
    marginBottom: '2rem',
    textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: '300px'
  },
  input: {
    padding: '1rem',
    fontSize: '1.2rem',
    borderRadius: '12px',
    border: '2px solid #4a4a6a',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    textAlign: 'center'
  },
  button: {
    padding: '1rem',
    fontSize: '1.2rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: 'bold',
    transition: 'transform 0.1s'
  },
  error: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: '0.5rem'
  }
};
