import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
export default function Summary() {
  return (
    <>
      <Navbar />
      <main className="center">
        <div className="panel">
          <h1>Conversation Summary</h1>
          <p className="muted">This section will be available after the conversation ends.</p>
          <Link to="/" className="btn">Back to home</Link>
        </div>
      </main>
    </>
  );
}
