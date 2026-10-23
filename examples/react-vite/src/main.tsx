import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DraftForm } from './DraftForm';
const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(<StrictMode><DraftForm /></StrictMode>);
