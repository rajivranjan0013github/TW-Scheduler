import { useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PlatformIcon from '../PlatformIcon';

const numberFormat = new Intl.NumberFormat();
const fallbackAvatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

export const MetricCard = ({ icon: Icon, label, value, note }) => (
  <div className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">{label}</p>
        <p className="m-0 mt-1 truncate text-xl font-semibold leading-none text-[#1d1d1f]">{value}</p>
      </div>
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#f0f7ff] text-[#3478f6]">
        <Icon className="h-3.5 w-3.5" />
      </span>
    </div>
    {note && <p className="m-0 mt-1.5 truncate text-[10px] text-[#8e8e93]">{note}</p>}
  </div>
);

export const DailyViewsChart = ({ data = [], selectedDate = null, onSelectDate }) => {
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

  return (
    <div className="mt-3 rounded-xl border border-[#d2d2d7] bg-white px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">Last 30 days</p>
          <p className="m-0 mt-0.5 text-sm font-semibold text-[#1d1d1f]">Views by publish day</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDate && (
            <button
              type="button"
              onClick={() => onSelectDate?.(null)}
              className="text-[10px] font-semibold text-[#3478f6] hover:underline"
            >
              Clear date selection
            </button>
          )}
          <p className="m-0 text-[10px] font-medium text-[#8e8e93]">Click any bar to inspect date activity</p>
        </div>
      </div>
      <div className="h-36 w-full cursor-pointer outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none select-none">
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} style={{ outline: 'none' }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6e6e73' }} tickLine={false} axisLine={false} interval={0} />
            <YAxis
              tick={{ fontSize: 9, fill: '#6e6e73' }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(value) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(52, 120, 246, 0.08)' }}
              formatter={(value, name) => [name === 'views' ? numberFormat.format(value) : value, name === 'views' ? 'Views' : 'Posts']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.dateStr || ''}
              contentStyle={{ borderRadius: 8, border: '1px solid #d2d2d7', fontSize: 11 }}
            />
            <Bar
              dataKey="views"
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              onClick={(entry) => {
                if (entry && entry.dateStr) {
                  onSelectDate?.(selectedDate === entry.dateStr ? null : entry.dateStr);
                }
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isSelected ? '#10b981' : '#3478f6'}
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
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((slot) => {
          const post = visiblePosts[slot];
          const hasPost = slot < checkedCount;
          const timeLabel = post?.publishedAt ? formatPostTime(post.publishedAt) : '';
          return (
            <span
              key={slot}
              title={post?.publishedAt ? formatPostDateTime(post.publishedAt) : hasPost ? 'Posted time unavailable' : 'No post'}
              className={`flex h-5 min-w-8 items-center justify-center rounded border px-1 text-[8px] font-bold leading-none ${hasPost ? 'border-[#10b981] bg-[#10b981] text-white' : 'border-[#d2d2d7] bg-white text-transparent'}`}
            >
              {hasPost ? timeLabel || '✓' : '✓'}
            </span>
          );
        })}
        {totalPostsCount > 3 && (
          <span className="text-[9px] font-semibold text-[#6e6e73]" title={`${totalPostsCount} posts on ${selectedGraphDate}`}>
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
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((slot) => {
          const post = visiblePosts[slot];
          const hasPost = slot < checkedCount;
          const timeLabel = post?.publishedAt ? formatPostTime(post.publishedAt) : '';
          return (
            <span
              key={slot}
              title={post?.publishedAt ? formatPostDateTime(post.publishedAt) : hasPost ? 'Posted time unavailable' : 'No post'}
              className={`flex h-5 min-w-8 items-center justify-center rounded border px-1 text-[8px] font-bold leading-none ${hasPost ? 'border-[#3478f6] bg-[#3478f6] text-white' : 'border-[#d2d2d7] bg-white text-transparent'}`}
            >
              {hasPost ? timeLabel || '✓' : '✓'}
            </span>
          );
        })}
        {Number(account[selectedRange.postsKey] || 0) > 3 && (
          <span className="text-[9px] font-semibold text-[#6e6e73]" title={`${account[selectedRange.postsKey]} posts in ${selectedRange.label.toLowerCase()}`}>
            +{Number(account[selectedRange.postsKey] || 0) - 3}
          </span>
        )}
      </div>
    );
  }

  if (selectedTimeRange === 'last7Days') {
    return (
      <div className="flex flex-wrap gap-1">
        {(account.last7DaysActivity || []).map((day) => (
          <span
            key={day.dateStr}
            title={getDayTitle(day)}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-semibold ${Number(day.count || 0) >= 3 ? 'border-[#34c759] bg-[#34c759] text-white' : 'border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]'}`}
          >
            {day.count || 0}
          </span>
        ))}
      </div>
    );
  }

  return <span className="text-xs text-[#515154]">{numberFormat.format(account[selectedRange.postsKey] || 0)} posts</span>;
};

export const AccountAvatar = ({ account }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = String(account.name || account.username || '?').trim().charAt(0).toUpperCase() || '?';

  if (!imageFailed) {
    return (
      <img
        src={account.avatarUrl || fallbackAvatarUrl}
        crossOrigin="anonymous"
        alt={`${account.name || 'Publishing channel'} avatar`}
        onError={() => setImageFailed(true)}
        className="h-7 w-7 flex-shrink-0 rounded-full border border-black/10 object-cover"
      />
    );
  }

  return (
    <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[#d2d2d7] bg-[#f0f7ff] text-[11px] font-bold text-[#3478f6]">
      {initial}
    </span>
  );
};

export const AccountIdentity = ({ account }) => (
  <div className="flex min-w-0 items-center gap-2">
    <AccountAvatar account={account} />
    <div className="min-w-0">
      <p className="m-0 truncate font-semibold text-[#1d1d1f]">{account.name}</p>
      <p className="m-0 flex items-center gap-1 truncate text-[10px] text-[#6e6e73]">
        <PlatformIcon platform={account.platform} className="h-3.5 w-3.5" />
        <span className="truncate">@{account.username || 'account'}</span>
        <span
          title={account.syncStatus === 'failed' || account.syncStatus === 'partial'
            ? account.syncError || 'Metric synchronization failed'
            : account.lastSyncedAt
              ? `Metrics synced ${new Date(account.lastSyncedAt).toLocaleString()}`
              : 'Metrics have not synced yet'}
          className={`ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full ${account.syncStatus === 'failed'
            ? 'bg-red-500'
            : account.syncStatus === 'partial'
              ? 'bg-amber-500'
            : account.syncStatus === 'running'
              ? 'animate-pulse bg-amber-500'
              : account.syncStatus === 'success'
                ? 'bg-green-500'
                : 'bg-[#c7c7cc]'}`}
        />
      </p>
    </div>
  </div>
);
