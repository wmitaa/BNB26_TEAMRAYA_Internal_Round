import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CreateRoom from './pages/CreateRoom.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import ConversationRoom from './pages/ConversationRoom.jsx';
import Summary from './pages/Summary.jsx';
import History from './pages/History.jsx';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateRoom />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/room" element={<ConversationRoom />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/history" element={<History />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
