import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import CreatorChannels from './CreatorChannels';
import AdminChannels from './AdminChannels';

/**
 * Delegator component for Channels.
 * Directs creators to CreatorChannels and brand managers/admins to AdminChannels.
 */
export const Channels = (props) => {
  const { user } = useAuth();
  const location = useLocation();

  const handlerPreviewContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
    } catch {
      return null;
    }
  })();
  const isHandlerPreview = handlerPreviewContext?.viewAs === 'account_handler' || Boolean(location.state?.previewAsHandler);
  const isCreator = user?.userType === 'account_handler' || isHandlerPreview;

  return isCreator ? <CreatorChannels {...props} /> : <AdminChannels {...props} />;
};

export default Channels;
