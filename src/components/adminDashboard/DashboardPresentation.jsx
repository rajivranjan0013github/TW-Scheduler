import { useState, useEffect } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { User } from 'lucide-react';
import PlatformIcon from '../PlatformIcon';
import { API_BASE_URL } from '../../config';

const numberFormat = new Intl.NumberFormat();
export const fallbackAvatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

export const MetricCard = ({ icon: Icon, label, value, note }) => (
  <div className="rounded-xl border border-white/10 bg-[#121215] p-3.5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
        <p className="m-0 mt-1.5 truncate text-2xl font-bold leading-none text-zinc-100 sm:text-3xl">{value}</p>
      </div>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#7831d6]/20 text-[#c4b5fd]">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    {note && <p className="m-0 mt-2 truncate text-xs font-medium text-zinc-400">{note}</p>}
  </div>
);

const CustomChartTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-white/15 bg-[#18181b] px-3.5 py-2.5 text-xs shadow-2xl text-zinc-100 min-w-[140px]">
      <p className="m-0 font-semibold text-[#c4b5fd]">
        {item.dateStr ? item.dateStr : 'Date activity'}
        <span className="ml-1.5 text-xs font-normal text-zinc-400">
          ({item.posts || 0} {item.posts === 1 ? 'post' : 'posts'})
        </span>
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-zinc-300">
        <span className="text-zinc-400">Views:</span>
        <span className="font-bold text-white text-sm">{numberFormat.format(item.views || 0)}</span>
      </div>
    </div>
  );
};

export const DailyViewsChart = ({ data = [], selectedDate = null, onSelectDate }) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartData = data.map((item) => {
    const date = item.dateStr ? new Date(`${item.dateStr}T00:00:00`) : null;
    return {
      ...item,
      label: date ? `${date.getDate()}` : '',
      views: Number(item.views || 0),
      posts: Number(item.posts || 0),
      isSelected: selectedDate === item.dateStr,
    };
  });

  const renderCustomAxisTick = ({ x, y, payload, index }) => {
    if (isMobile) return null;
    const item = chartData[index];
    const postCount = item?.posts || 0;
    const isSelected = item?.isSelected;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={8}
          textAnchor="middle"
          fill={isSelected ? '#c4b5fd' : '#a1a1aa'}
          fontSize={11}
          fontWeight={isSelected ? 700 : 500}
        >
          {payload.value}
        </text>
        {postCount > 0 && (
          <text
            x={0}
            y={0}
            dy={20}
            textAnchor="middle"
            fill={isSelected ? '#c4b5fd' : '#a855f7'}
            fontSize={10}
            fontWeight={700}
          >
            {`${postCount}p`}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-[#121215] p-3.5 shadow-sm">
      <div className="mb-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Last 30 days</p>
          <p className="m-0 mt-0.5 text-base font-semibold text-zinc-100">
            Views by publish day <span className="hidden sm:inline text-xs font-normal text-zinc-400">(Date / Posts)</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate?.(null)}
              className="text-xs font-semibold text-[#c4b5fd] hover:underline"
            >
              Clear date selection
            </button>
          )}
          <p className="m-0 text-xs font-medium text-zinc-400 hidden sm:block">Click any bar to inspect date activity</p>
        </div>
      </div>
      <div className="h-44 w-full cursor-pointer outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none select-none">
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <BarChart data={chartData} margin={{ top: 6, right: 6, bottom: 4, left: 0 }} style={{ outline: 'none' }}>
            <XAxis
              dataKey="label"
              tick={isMobile ? false : renderCustomAxisTick}
              tickLine={false}
              axisLine={false}
              interval={0}
              height={isMobile ? 6 : 30}
            />
            <YAxis
              tick={{ fontSize: isMobile ? 10 : 11, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 32 : 40}
              tickFormatter={(value) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(120, 49, 214, 0.15)' }}
              content={<CustomChartTooltip />}
            />
            <Bar
              dataKey="views"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
              onClick={(entry) => {
                if (entry && entry.dateStr) {
                  onSelectDate?.(selectedDate === entry.dateStr ? null : entry.dateStr);
                }
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isSelected ? '#a855f7' : '#7831d6'}
                  style={{ outline: 'none' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const formatPostTime = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};

const formatPostDateTime = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return `${date.toLocaleDateString([], { dateStyle: 'medium' })}, ${formatPostTime(value)}`;
};

export const ActivityCell = ({ account, selectedTimeRange, selectedRange, selectedGraphDate }) => {
  const getDayTitle = (day) => {
    const dateLabel = day.dateStr
      ? new Date(`${day.dateStr}T00:00:00`).toLocaleDateString([], { dateStyle: 'medium' })
      : 'Unknown date';
    if (!day.posts?.length) return `${dateLabel}\nNo posts`;
    const times = day.posts.map((post, index) => `${index + 1}. ${post.publishedAt ? formatPostDateTime(post.publishedAt) : 'Unknown time'}`);
    return `${dateLabel}\n${times.join('\n')}`;
  };

  if (selectedGraphDate) {
    const activityList = account.last30DaysActivity || account.last7DaysActivity || [];
    const activityDay = activityList.find((day) => day.dateStr === selectedGraphDate);
    const visiblePosts = (activityDay?.posts || []).slice().sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
    const totalPostsCount = activityDay?.count || visiblePosts.length;
    const checkedCount = Math.min(totalPostsCount, 3);

    return (
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((slot) => {
          const post = visiblePosts[slot];
          const hasPost = slot < checkedCount;
          const timeLabel = post?.publishedAt ? formatPostTime(post.publishedAt) : '';
          return (
            <span
              key={slot}
              title={post?.publishedAt ? formatPostDateTime(post.publishedAt) : hasPost ? 'Posted time unavailable' : 'No post'}
              className={`flex h-6 min-w-10 items-center justify-center rounded-md border px-1.5 text-[10px] font-bold leading-none ${hasPost ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-white/10 bg-white/5 text-transparent'}`}
            >
              {hasPost ? timeLabel || '✓' : '✓'}
            </span>
          );
        })}
        {totalPostsCount > 3 && (
          <span className="text-xs font-bold text-zinc-400" title={`${totalPostsCount} posts on ${selectedGraphDate}`}>
            +{totalPostsCount - 3}
          </span>
        )}
      </div>
    );
  }

  if (selectedTimeRange === 'today' || selectedTimeRange === 'yesterday') {
    const activityDay = (account.last7DaysActivity || [])[selectedTimeRange === 'today' ? 0 : 1];
    const visiblePosts = (activityDay?.posts || []).slice().sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
    const checkedCount = Math.min(Number(account[selectedRange.postsKey] || 0), 3);
    return (
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((slot) => {
          const post = visiblePosts[slot];
          const hasPost = slot < checkedCount;
          const timeLabel = post?.publishedAt ? formatPostTime(post.publishedAt) : '';
          return (
            <span
              key={slot}
              title={post?.publishedAt ? formatPostDateTime(post.publishedAt) : hasPost ? 'Posted time unavailable' : 'No post'}
              className={`flex h-6 min-w-10 items-center justify-center rounded-md border px-1.5 text-[10px] font-bold leading-none ${hasPost ? 'border-[#7831d6] bg-[#7831d6] text-white' : 'border-white/10 bg-white/5 text-transparent'}`}
            >
              {hasPost ? timeLabel || '✓' : '✓'}
            </span>
          );
        })}
        {Number(account[selectedRange.postsKey] || 0) > 3 && (
          <span className="text-xs font-bold text-zinc-400" title={`${account[selectedRange.postsKey]} posts in ${selectedRange.label.toLowerCase()}`}>
            +{Number(account[selectedRange.postsKey] || 0) - 3}
          </span>
        )}
      </div>
    );
  }

  if (selectedTimeRange === 'last7Days') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(account.last7DaysActivity || []).map((day) => (
          <span
            key={day.dateStr}
            title={getDayTitle(day)}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${Number(day.count || 0) >= 3 ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-white/10 bg-white/5 text-zinc-300'}`}
          >
            {day.count || 0}
          </span>
        ))}
      </div>
    );
  }

  return <span className="text-sm font-medium text-zinc-200">{numberFormat.format(account[selectedRange.postsKey] || 0)} posts</span>;
};

export const AccountAvatar = ({
  account,
  className = 'h-8 w-8 flex-shrink-0 rounded-full border border-white/10 object-cover shadow-xs',
}) => {
  const rawAvatarUrl = account?.avatarUrl
    || account?.profilePictureUrl
    || account?.profile_picture_url
    || account?.picture
    || '';

  const getProxiedAvatar = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('/') && API_BASE_URL) {
      return `${API_BASE_URL}${trimmed}`;
    }
    if (trimmed.includes('media.thousandpost.com') || trimmed.includes('.r2.dev') || trimmed.includes('.r2.cloudflarestorage.com')) {
      return `${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(trimmed)}`;
    }
    return trimmed;
  };

  const initialAvatar = getProxiedAvatar(rawAvatarUrl);
  const [imageFailed, setImageFailed] = useState(!initialAvatar);
  const [currentAvatar, setCurrentAvatar] = useState(initialAvatar);

  useEffect(() => {
    const next = getProxiedAvatar(rawAvatarUrl);
    setCurrentAvatar(next);
    setImageFailed(!next);
  }, [rawAvatarUrl]);

  if (currentAvatar && !imageFailed) {
    return (
      <img
        src={currentAvatar}
        referrerPolicy="no-referrer"
        alt={`${account?.name || account?.displayName || 'Publishing channel'} avatar`}
        onError={() => {
          if (rawAvatarUrl && !currentAvatar.includes('/api/media/proxy') && API_BASE_URL) {
            setCurrentAvatar(`${API_BASE_URL}/api/media/proxy?url=${encodeURIComponent(rawAvatarUrl)}`);
          } else {
            setImageFailed(true);
          }
        }}
        className={className}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 ${className}`}
    >
      <User className="h-1/2 w-1/2" />
    </span>
  );
};

export const AccountIdentity = ({ account }) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <AccountAvatar account={account} />
    <div className="min-w-0">
      <p className="m-0 truncate text-sm font-semibold text-zinc-100">{account.name}</p>
      <p className="m-0 flex items-center gap-1.5 truncate text-xs text-zinc-400">
        <PlatformIcon platform={account.platform} className="h-4 w-4" />
        <span className="truncate">@{account.username || 'account'}</span>
        <span
          title={account.syncStatus === 'failed' || account.syncStatus === 'partial'
            ? account.syncError || 'Metric synchronization failed'
            : account.lastSyncedAt
              ? `Metrics synced ${new Date(account.lastSyncedAt).toLocaleString()}`
              : 'Metrics have not synced yet'}
          className={`ml-auto h-2 w-2 flex-shrink-0 rounded-full ${account.syncStatus === 'failed'
            ? 'bg-red-500'
            : account.syncStatus === 'partial'
              ? 'bg-amber-500'
            : account.syncStatus === 'running'
              ? 'animate-pulse bg-amber-500'
              : account.syncStatus === 'success'
                ? 'bg-green-500'
                : 'bg-zinc-600'}`}
        />
      </p>
    </div>
  </div>
);
