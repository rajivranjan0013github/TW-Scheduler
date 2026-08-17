import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const editorMediaPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'TW_EDITOR_MEDIA_QUERY_CACHE',
  throttleTime: 1000,
});

export const editorMediaPersistOptions = {
  persister: editorMediaPersister,
  maxAge: 24 * 60 * 60 * 1000,
  buster: 'editor-media-v2-folder-covers',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => (
      query.state.status === 'success'
      && query.queryKey[0] === 'media-library'
      && query.queryKey[1] === 'editor'
    ),
  },
};
