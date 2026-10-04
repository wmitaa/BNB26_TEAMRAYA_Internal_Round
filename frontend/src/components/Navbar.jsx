import { Link, NavLink } from 'react-router-dom';
export const Logo = () => <Link to="/" className="logo" aria-label="Roundtable home"><span className="logo-mark" aria-hidden="true" />ROUNDTABLE</Link>;
export default function Navbar() {
  return (
    <header className="nav">
      <Logo />
      <nav aria-label="Main" className="nav-links">
        <NavLink to="/history">Past Conversations</NavLink>
        <NavLink to="/create">Create Room</NavLink>
        <NavLink to="/join" className="btn btn-sm">Join Room</NavLink>
      </nav>
    </header>
  );
}
