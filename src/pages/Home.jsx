import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Globe2,
  Layers3,
  MapPin,
  MousePointer2,
  Send,
  Sparkles,
  TrendingUp,
  UsersRound,
  WandSparkles,
  Zap,
} from 'lucide-react';

const workflowSteps = [
  {
    number: '01',
    icon: WandSparkles,
    title: 'Generate the campaign',
    text: 'Turn a product brief into hooks, captions, images, and ready-to-edit short-form content.',
  },
  {
    number: '02',
    icon: MousePointer2,
    title: 'Choose distribution',
    text: 'Send approved content to your human poster network or push it into the direct publishing queue.',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Ship, learn, repeat',
    text: 'Keep every channel moving, see what shipped, and use the signal to shape the next batch.',
  },
];

const channelPills = ['IG', 'YT', 'FB', 'TT'];
const featureTabs = ['Generation', 'Campaigns', 'Poster Network', 'Scheduler'];
const generationFormats = [
  {
    title: 'Hook + app showcase',
    badge: 'Reaction hook',
    ratio: '9:16',
    text: 'Creator hook flows into a focused product or app walkthrough.',
    icon: CirclePlay,
    position: { left: '66%', top: '17%' },
  },
  {
    title: 'Multi-slide carousel',
    badge: 'Carousel',
    ratio: '4:5 · 1:1',
    text: 'A swipeable hook, feature story, and final call to action.',
    icon: Layers3,
    position: { left: '66%', top: '58%' },
  },
];
const posterHubs = [
  { city: 'New York', posters: 18, position: { left: '15%', top: '32%' } },
  { city: 'São Paulo', posters: 11, position: { left: '24%', top: '65%' } },
  { city: 'London', posters: 14, position: { left: '38%', top: '25%' } },
  { city: 'Lagos', posters: 9, position: { left: '42%', top: '56%' } },
  { city: 'Mumbai', posters: 22, position: { left: '55%', top: '47%' } },
  { city: 'Singapore', posters: 16, position: { left: '62%', top: '61%' } },
  { city: 'Sydney', posters: 8, position: { left: '66%', top: '75%' } },
];
const activityItems = [
  { label: 'Generated', value: '24 assets', color: '#f3eee5' },
  { label: 'Approved', value: '18 ready', color: '#f3eee5' },
  { label: 'Assigned', value: '12 posters', color: '#d9d3ca' },
  { label: 'Scheduled', value: '8 channels', color: '#d8d2c9' },
  { label: 'Published', value: '32 posts', color: '#bdb7ae' },
];

const BrandMark = ({ compact = false }) => (
  <div className="flex items-center gap-3">
    <span className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} grid shrink-0 place-items-center rounded-[13px] bg-[#f3eee5] text-[#120906] shadow-[0_0_30px_rgba(244,239,231,.18)]`}>
      <Sparkles className="h-4 w-4" strokeWidth={2.7} />
    </span>
    <div>
      <p className="m-0 text-[15px] font-black tracking-[-0.03em] text-[#f5f0e8]">EasyPost</p>
      {!compact && (
        <p className="m-0 mt-0.5 text-[8px] font-black uppercase tracking-[0.22em] text-[#77726c]">
          Generate · Distribute
        </p>
      )}
    </div>
  </div>
);

const GenerationFormatsGraph = () => (
  <div className="relative mx-auto w-full max-w-[1000px]">
    <div className="absolute -inset-12 rounded-full bg-[#f3eee5]/10 blur-[90px]" />
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0d0d0b] p-2 shadow-[0_40px_120px_rgba(0,0,0,.62)] sm:p-3">
      <div className="overflow-hidden rounded-[21px] border border-white/[0.09] bg-[#121210]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f3eee5]/15 text-[#d9d3ca]">
              <WandSparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-xs font-black text-[#f5f0e8] sm:text-sm">Generation formats</p>
              <p className="m-0 mt-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#77726c] sm:text-[9px]">One brief · Two creative directions · Ready to build</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#f3eee5]/20 bg-[#f3eee5]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#f3eee5] sm:text-[9px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f3eee5]" />
            2 formats ready
          </span>
        </div>

        <div
          className="relative aspect-[1.32] min-h-[310px] overflow-hidden bg-[#0a0a08] sm:min-h-[430px]"
          aria-label="A campaign brief flowing through the EasyPost format engine into the two currently supported creative formats"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.13) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to right, black, rgba(0,0,0,.62))',
          }} />

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 545" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <path d="M188 272 C224 272 245 272 278 272" stroke="#302d29" strokeWidth="2" />
            {[
              'M390 272 C430 272 426 150 475 150',
              'M390 272 C430 272 426 374 475 374',
            ].map((path) => <path key={`base-${path}`} d={path} stroke="#302d29" strokeWidth="2" />)}
            <path className="distribution-flow" d="M188 272 C224 272 245 272 278 272" stroke="#f3eee5" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 10" />
            {[
              'M390 272 C430 272 426 150 475 150',
              'M390 272 C430 272 426 374 475 374',
            ].map((path, index) => (
              <path
                key={`flow-${path}`}
                className={`distribution-flow ${index % 2 === 0 ? 'distribution-flow-delay' : 'distribution-flow-delay-long'}`}
                d={path}
                stroke="#d9d3ca"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray="7 10"
              />
            ))}
            <circle cx="188" cy="272" r="4" fill="#f3eee5" />
            {[['475', '150'], ['475', '374']].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#d9d3ca" />
            ))}
          </svg>

          <div className="absolute left-[3.5%] top-[31%] w-[22.5%] rounded-xl border border-white/[0.13] bg-[#151513]/95 p-2.5 shadow-[0_16px_50px_rgba(0,0,0,.38)] backdrop-blur-md sm:rounded-2xl sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[6px] font-black uppercase tracking-[0.14em] text-[#8b857e] sm:text-[8px]">Campaign input</span>
              <CheckCircle2 className="h-2.5 w-2.5 text-[#f3eee5] sm:h-3 sm:w-3" />
            </div>
            <p className="m-0 mt-2 text-[8px] font-black leading-tight text-[#f5f0e8] sm:mt-3 sm:text-[11px]">Product URL + creative brief</p>
            <div className="mt-2.5 space-y-1.5 sm:mt-3">
              {['Audience signal', 'Key messaging', 'Brand assets'].map((label) => (
                <div key={label} className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/25 px-1.5 py-1 sm:rounded-lg sm:px-2 sm:py-1.5">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#cfc8bd]" />
                  <span className="text-[5px] font-bold text-[#8f8982] sm:text-[7px]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute left-[38.5%] top-[38%] w-[15.5%] text-center">
            <div className="distribution-node-pulse relative mx-auto grid aspect-square place-items-center rounded-full border border-[#f3eee5]/55 bg-[#171715] shadow-[0_0_42px_rgba(244,239,231,.16)]">
              <div className="absolute inset-[9%] rounded-full border border-dashed border-[#d9d3ca]/35" />
              <WandSparkles className="relative h-[27%] w-[27%] text-[#d9d3ca]" />
            </div>
            <p className="m-0 mt-2 text-[5px] font-black uppercase tracking-[0.12em] text-[#d9d3ca] sm:text-[7px]">Format engine</p>
          </div>

          {generationFormats.map((format) => {
            const FormatIcon = format.icon;
            return (
              <div
                key={format.title}
                className="absolute w-[29%] rounded-lg border border-white/[0.12] bg-[#151513]/95 p-2.5 shadow-[0_12px_34px_rgba(0,0,0,.34)] backdrop-blur-md sm:rounded-xl sm:p-4"
                style={format.position}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.05] text-[#d9d3ca] sm:h-7 sm:w-7 sm:rounded-lg">
                    <FormatIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </span>
                  <span className="text-[5px] font-black text-[#8f8982] sm:text-[6px]">{format.ratio}</span>
                </div>
                <p className="m-0 mt-1.5 line-clamp-2 text-[6px] font-black leading-[1.15] text-[#f5f0e8] sm:mt-2 sm:text-[8px]">{format.title}</p>
                <p className="m-0 mt-1 hidden text-[6px] leading-[1.35] text-[#8f8982] sm:block sm:text-[7px]">{format.text}</p>
                <p className="m-0 mt-1 text-[4.5px] font-black uppercase tracking-[0.08em] text-[#77726c] sm:text-[6px]">{format.badge}</p>
              </div>
            );
          })}

          <div className="absolute bottom-[2.5%] left-[4%] flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/35 px-2.5 py-1.5 backdrop-blur-md sm:px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f3eee5]" />
            <span className="text-[6px] font-black uppercase tracking-[0.12em] text-[#77726c] sm:text-[8px]">Brief → format blueprint → ready-to-build creative</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const WorldwidePosterGraph = () => (
  <div className="relative mx-auto w-full max-w-[1000px]">
    <div className="absolute -inset-12 rounded-full bg-[#f3eee5]/10 blur-[90px]" />
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0d0d0b] p-2 shadow-[0_40px_120px_rgba(0,0,0,.62)] sm:p-3">
      <div className="overflow-hidden rounded-[21px] border border-white/[0.09] bg-[#121210]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f3eee5]/15 text-[#d9d3ca]">
              <Globe2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-xs font-black text-[#f5f0e8] sm:text-sm">Worldwide poster network</p>
              <p className="m-0 mt-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#77726c] sm:text-[9px]">Local creators · Global campaign coverage</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#f3eee5]/20 bg-[#f3eee5]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#f3eee5] sm:text-[9px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f3eee5]" />
            98 posters online
          </span>
        </div>

        <div
          className="relative aspect-[1.32] min-h-[310px] overflow-hidden bg-[#0a0a08] sm:min-h-[430px]"
          aria-label="A world map showing active EasyPost poster hubs across the Americas, Europe, Africa, Asia, and Australia"
        >
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.13) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to right, black, rgba(0,0,0,.62))',
          }} />

          <div className="pointer-events-none absolute left-[4%] top-[3%] h-[92%] w-[67%] rounded-full bg-[radial-gradient(circle_at_38%_35%,rgba(244,239,231,.12),rgba(244,239,231,.025)_48%,transparent_69%)]" />
          <Globe2
            className="pointer-events-none absolute left-[5%] top-[4%] h-[90%] w-[65%] text-[#d9d3ca]/25"
            strokeWidth={0.55}
            aria-hidden="true"
          />

          {posterHubs.map((hub, index) => (
            <div key={hub.city} className="absolute" style={hub.position}>
              <div className="relative">
                <span className="absolute -left-1 -top-1 h-4 w-4 animate-ping rounded-full bg-[#f3eee5]/20" />
                <span className="relative grid h-3 w-3 place-items-center rounded-full border border-[#f3eee5]/70 bg-[#171715] shadow-[0_0_20px_rgba(244,239,231,.32)] sm:h-4 sm:w-4">
                  <span className="h-1 w-1 rounded-full bg-[#f3eee5]" />
                </span>
                <div className={`absolute top-4 whitespace-nowrap rounded-md border border-white/[0.1] bg-[#151513]/90 px-1.5 py-1 shadow-lg backdrop-blur-md sm:top-5 sm:rounded-lg sm:px-2 ${index >= 4 ? '-right-1' : '-left-1'}`}>
                  <p className="m-0 text-[5px] font-black text-[#f5f0e8] sm:text-[7px]">{hub.city}</p>
                  <p className="m-0 mt-0.5 text-[4px] font-bold text-[#77726c] sm:text-[6px]">{hub.posters} posters</p>
                </div>
              </div>
            </div>
          ))}

          <aside className="absolute right-[3%] top-[11%] w-[26%] rounded-xl border border-white/[0.13] bg-[#151513]/95 p-2.5 shadow-[0_16px_50px_rgba(0,0,0,.38)] backdrop-blur-md sm:rounded-2xl sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[6px] font-black text-[#f5f0e8] sm:text-[9px]">
                <UsersRound className="h-2.5 w-2.5 text-[#d9d3ca] sm:h-3.5 sm:w-3.5" />
                Network live
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#f3eee5]" />
            </div>

            <div className="mt-3 flex -space-x-1.5 sm:mt-4 sm:-space-x-2">
              {['M', 'J', 'A', 'S'].map((name, index) => (
                <span key={name} className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#151513] text-[6px] font-black text-[#f8f4ed] sm:h-8 sm:w-8 sm:text-[8px]" style={{ backgroundColor: ['#6f6b66', '#595652', '#817b74', '#a39d95'][index] }}>{name}</span>
              ))}
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#151513] bg-[#29231f] text-[5px] font-black text-[#aaa099] sm:h-8 sm:w-8 sm:text-[7px]">+94</span>
            </div>

            <div className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3 sm:mt-4 sm:space-y-2 sm:pt-4">
              {[
                ['Americas', '29 active'],
                ['Europe + Africa', '23 active'],
                ['Asia Pacific', '46 active'],
              ].map(([region, count]) => (
                <div key={region} className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-1.5 py-1.5 sm:rounded-lg sm:px-2 sm:py-2">
                  <span className="flex min-w-0 items-center gap-1 text-[4.5px] font-bold text-[#aaa49d] sm:text-[6.5px]">
                    <MapPin className="h-2 w-2 shrink-0 text-[#d9d3ca] sm:h-2.5 sm:w-2.5" />
                    <span className="truncate">{region}</span>
                  </span>
                  <span className="shrink-0 text-[4px] font-black uppercase text-[#77726c] sm:text-[6px]">{count}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2.5 sm:mt-4 sm:pt-3">
              <span className="text-[5px] font-bold text-[#8d8881] sm:text-[7px]">Ready for assignment</span>
              <ArrowRight className="h-2.5 w-2.5 text-[#d9d3ca] sm:h-3 sm:w-3" />
            </div>
          </aside>

          <div className="absolute bottom-[3%] left-[4%] flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/35 px-2.5 py-1.5 backdrop-blur-md sm:px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f3eee5]" />
            <span className="text-[6px] font-black uppercase tracking-[0.12em] text-[#77726c] sm:text-[8px]">Assign content to trusted posters worldwide</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DistributionGraph = ({ activeFeature = 'Distribution' }) => (
  <div className="relative mx-auto w-full max-w-[1000px]">
    <div className="absolute -inset-12 rounded-full bg-[#f3eee5]/10 blur-[90px]" />
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0d0d0b] p-2 shadow-[0_40px_120px_rgba(0,0,0,.62)] sm:p-3">
      <div className="overflow-hidden rounded-[21px] border border-white/[0.09] bg-[#121210]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f3eee5]/15 text-[#d9d3ca]">
              <Send className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="m-0 truncate text-xs font-black text-[#f5f0e8] sm:text-sm">{activeFeature} workspace</p>
              <p className="m-0 mt-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#77726c] sm:text-[9px]">Campaign content · Team · Calendar · Channels</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#f3eee5]/20 bg-[#f3eee5]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#f3eee5] sm:text-[9px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f3eee5]" />
            Distributing now
          </span>
        </div>

        <div className="relative aspect-[1.32] min-h-[310px] overflow-hidden bg-[#0a0a08] sm:min-h-[430px]" aria-label="A vertical campaign video connected to the poster network and publishing calendar">
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.13) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            maskImage: 'linear-gradient(to right, black, rgba(0,0,0,.55))',
          }} />

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 545" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <path d="M194 274 C238 274 263 274 302 274" stroke="#302d29" strokeWidth="2" />
            <path d="M398 274 C438 274 432 146 474 146" stroke="#302d29" strokeWidth="2" />
            <path d="M398 274 C438 274 432 394 474 394" stroke="#302d29" strokeWidth="2" />
            <path className="distribution-flow" d="M194 274 C238 274 263 274 302 274" stroke="#f3eee5" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 10" />
            <path className="distribution-flow distribution-flow-delay" d="M398 274 C438 274 432 146 474 146" stroke="#f3eee5" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 10" />
            <path className="distribution-flow distribution-flow-delay-long" d="M398 274 C438 274 432 394 474 394" stroke="#c9c3ba" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="7 10" />
            <circle cx="194" cy="274" r="4" fill="#f3eee5" />
            <circle cx="474" cy="146" r="4" fill="#f3eee5" />
            <circle cx="474" cy="394" r="4" fill="#c9c3ba" />
          </svg>

          <div className="absolute left-[3.5%] top-[12%] w-[23%]">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[14px] border border-[#d9d3ca]/40 bg-gradient-to-br from-[#d8d2c9] via-[#595652] to-[#181817] shadow-[0_18px_55px_rgba(244,239,231,.14)] sm:rounded-[18px]">
              <div className="absolute -right-[22%] top-[13%] h-[42%] w-[75%] rounded-full border-[12px] border-white/10 sm:border-[18px]" />
              <div className="absolute -left-[28%] top-[38%] h-[38%] w-[85%] rotate-12 rounded-[40%] bg-[#c9c3ba]/30 blur-sm" />
              <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between sm:left-3 sm:right-3 sm:top-3">
                <span className="rounded-full border border-white/25 bg-black/25 px-1.5 py-1 text-[6px] font-black uppercase tracking-[0.12em] text-white/85 backdrop-blur-md sm:px-2 sm:text-[7px]">AI video</span>
                <span className="text-[7px] font-black text-white/70 sm:text-[8px]">9:16</span>
              </div>
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur-md sm:h-12 sm:w-12">
                  <CirclePlay className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-2.5 pb-3 pt-12 sm:px-3 sm:pb-4">
                <p className="m-0 text-[6px] font-black uppercase tracking-[0.14em] text-[#e5dfd6] sm:text-[7px]">Hook 01 · Product reel</p>
                <p className="m-0 mt-1 text-[8px] font-black leading-[1.15] text-[#fffdf9] sm:text-[11px]">3 hooks that changed our launch</p>
                <div className="mt-2 flex h-2 items-center gap-[2px]">
                  {[35, 70, 48, 90, 58, 76, 42, 86, 52, 66].map((height, index) => (
                    <span key={`${height}-${index}`} className="w-[2px] rounded-full bg-white/55" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[6px] font-black uppercase tracking-[0.13em] text-[#77726c] sm:text-[8px]">Source video</span>
              <span className="inline-flex items-center gap-1 text-[6px] font-black text-[#f3eee5] sm:text-[8px]"><CheckCircle2 className="h-2.5 w-2.5" /> Approved</span>
            </div>
          </div>

          <div className="absolute left-[41.5%] top-[37%] w-[15%] text-center">
            <div className="distribution-node-pulse relative mx-auto grid aspect-square place-items-center rounded-full border border-[#f3eee5]/55 bg-[#171715] shadow-[0_0_42px_rgba(244,239,231,.16)]">
              <div className="absolute inset-[9%] rounded-full border border-dashed border-[#d9d3ca]/35" />
              <Send className="relative h-[27%] w-[27%] text-[#d9d3ca]" />
            </div>
            <p className="m-0 mt-2 text-[6px] font-black uppercase tracking-[0.13em] text-[#d9d3ca] sm:text-[8px]">Distribution engine</p>
          </div>

          <div className="absolute left-[66%] top-[7%] w-[31%] rounded-xl border border-[#f3eee5]/25 bg-[#151513]/95 p-2.5 shadow-[0_14px_44px_rgba(0,0,0,.35)] backdrop-blur-md sm:rounded-2xl sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[7px] font-black text-[#f5f1ea] sm:gap-2 sm:text-[10px]">
                <UsersRound className="h-3 w-3 text-[#d9d3ca] sm:h-3.5 sm:w-3.5" />
                Poster network
              </span>
              <span className="rounded-full bg-[#f3eee5]/10 px-1.5 py-0.5 text-[5px] font-black uppercase tracking-[0.1em] text-[#f3eee5] sm:text-[7px]">12 people</span>
            </div>
            <div className="mt-2.5 flex -space-x-1.5 sm:mt-4 sm:-space-x-2">
              {['M', 'J', 'A', 'S'].map((name, index) => (
                <span key={name} className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#151513] text-[6px] font-black text-[#f8f4ed] sm:h-8 sm:w-8 sm:text-[8px]" style={{ backgroundColor: ['#6f6b66', '#595652', '#817b74', '#a39d95'][index] }}>{name}</span>
              ))}
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-[#151513] bg-[#29231f] text-[5px] font-black text-[#aaa099] sm:h-8 sm:w-8 sm:text-[7px]">+8</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.07] pt-2 sm:mt-4 sm:pt-3">
              <span className="text-[6px] font-bold text-[#8d7b72] sm:text-[8px]">Assignments active</span>
              <ArrowRight className="h-2.5 w-2.5 text-[#d9d3ca] sm:h-3 sm:w-3" />
            </div>
          </div>

          <div className="absolute left-[66%] top-[57%] w-[31%] rounded-xl border border-[#d8d2c9]/25 bg-[#121016]/95 p-2.5 shadow-[0_14px_44px_rgba(0,0,0,.35)] backdrop-blur-md sm:rounded-2xl sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[7px] font-black text-[#eee9fa] sm:gap-2 sm:text-[10px]">
                <CalendarClock className="h-3 w-3 text-[#d8d2c9] sm:h-3.5 sm:w-3.5" />
                Publishing calendar
              </span>
              <span className="text-[5px] font-black uppercase tracking-[0.1em] text-[#d8d2c9] sm:text-[7px]">8 channels</span>
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-1 sm:mt-4 sm:gap-1.5">
              {channelPills.map((channel, index) => (
                <span key={channel} className="grid aspect-square place-items-center rounded-md border border-white/[0.08] text-[5px] font-black text-[#f4edf9] sm:rounded-lg sm:text-[7px]" style={{ backgroundColor: ['#3f3d3a', '#4b4844', '#55514c', '#1e1e1e'][index] }}>{channel}</span>
              ))}
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.07] pt-2 sm:mt-4 sm:pt-3">
              <span className="flex items-center gap-1 text-[6px] font-bold text-[#827b91] sm:text-[8px]"><Clock3 className="h-2.5 w-2.5" /> Starts 6:30 PM</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d8d2c9]" />
            </div>
          </div>

          <div className="absolute bottom-[3%] left-[34%] flex items-center gap-2 rounded-full border border-white/[0.07] bg-black/35 px-2.5 py-1.5 backdrop-blur-md sm:px-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f3eee5]" />
            <span className="text-[6px] font-black uppercase tracking-[0.12em] text-[#77726c] sm:text-[8px]">Every campaign capability stays connected</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DistributionOptionCard = ({ variant }) => {
  const isHuman = variant === 'human';
  return (
    <article className={`group relative overflow-hidden rounded-[28px] border p-6 transition duration-300 sm:p-8 ${
      isHuman
        ? 'border-[#f3eee5]/25 bg-[#151513] hover:border-[#f3eee5]/45'
        : 'border-[#d8d2c9]/25 bg-[#121016] hover:border-[#d8d2c9]/45'
    }`}>
      <div className={`absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[90px] ${isHuman ? 'bg-[#f3eee5]/15' : 'bg-[#c9c3ba]/15'}`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${isHuman ? 'bg-[#f3eee5] text-[#11110f]' : 'bg-[#d8d2c9] text-[#11110f]'}`}>
            {isHuman ? <UsersRound className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isHuman ? 'text-[#d9d3ca]' : 'text-[#d8d2c9]'}`}>
            {isHuman ? 'Option 01' : 'Option 02'}
          </span>
        </div>
        <h3 className="m-0 mt-7 text-3xl font-black tracking-[-0.05em] text-[#f5f0e8] sm:text-4xl">
          {isHuman ? 'Send to human posters.' : 'Schedule it directly.'}
        </h3>
        <p className="m-0 mt-4 max-w-lg text-sm leading-6 text-[#9c958d] sm:text-base">
          {isHuman
            ? 'Assign approved content to real account handlers, track acceptance, and keep every deliverable accountable.'
            : 'Connect brand channels, set the cadence, and let the publishing queue carry the campaign across the calendar.'}
        </p>

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-black/25 p-3">
          {isHuman ? (
            <div className="space-y-2">
              {['Maya · Beauty', 'Jordan · Fitness', 'Alex · Lifestyle'].map((poster, index) => (
                <div key={poster} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f3eee5]/15 text-[9px] font-black text-[#d9d3ca]">{poster[0]}</span>
                    <div>
                      <p className="m-0 text-[10px] font-black text-[#e8e1d8]">{poster}</p>
                      <p className="m-0 mt-0.5 text-[8px] text-[#77726c]">{index + 2} posts assigned</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#f3eee5]/10 px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-[#f3eee5]">Ready</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-1.5">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                  <div key={`${day}-${index}`} className="text-center">
                    <span className="text-[7px] font-black text-[#65605a]">{day}</span>
                    <div className={`mt-2 rounded-lg border py-3 ${index === 3 ? 'border-[#d8d2c9]/50 bg-[#d8d2c9]/15' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                      <span className={`mx-auto block h-1.5 w-1.5 rounded-full ${[0, 2, 3, 5].includes(index) ? 'bg-[#d8d2c9]' : 'bg-white/10'}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-3">
                <span className="flex items-center gap-2 text-[9px] font-black text-[#d9d1e7]">
                  <CirclePlay className="h-3.5 w-3.5 text-[#d8d2c9]" />
                  Product reel · 6:30 PM
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#d8d2c9]">Queued</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const Home = () => {
  const [activeFeature, setActiveFeature] = useState('Generation');

  return (
  <div className="h-screen overflow-y-auto bg-[#080807] text-[#f5f0e8] selection:bg-[#f3eee5] selection:text-[#11110f]">
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#080807]/85 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <BrandMark />

        <nav className="hidden items-center gap-7 md:flex">
          <a href="#workflow" className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f8982] transition hover:text-[#f5f0e8]">How it works</a>
          <a href="#distribution" className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f8982] transition hover:text-[#f5f0e8]">Distribution</a>
          <a href="#platform" className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f8982] transition hover:text-[#f5f0e8]">Platform</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden rounded-xl px-4 py-2.5 text-xs font-black text-[#b7b0a8] transition hover:bg-white/[0.05] hover:text-[#f5f0e8] sm:inline-flex">
            Sign in
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[#f3eee5] px-4 py-2.5 text-xs font-black text-[#11110f] shadow-[0_10px_35px_rgba(244,239,231,.16)] transition hover:-translate-y-0.5 hover:bg-[#fffdf9]"
          >
            Start creating
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden px-6 pb-4 pt-24 md:pt-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#f3eee5]/8 blur-[130px]" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="group inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold text-white/75">
            <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#11110f]">New</span>
            <span>Generate and distribute from one workspace</span>
            <ArrowRight className="h-3 w-3 text-white/45 transition-transform group-hover:translate-x-0.5" />
          </div>

          <h1 className="m-0 mt-6 max-w-3xl text-[3.4rem] font-black leading-[0.95] tracking-[-0.065em] text-[#f5f0e8] sm:text-6xl md:text-7xl">
            Generate.
            <span className="block text-[#cfc8bd]">Distribute.</span>
          </h1>

          <p className="m-0 mt-5 max-w-xl text-base leading-7 text-[#8f8982] md:text-lg">
            Create campaign-ready content, then publish it through human posters or direct scheduling—all from one connected workspace.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-[18px] bg-[#f3eee5] px-6 py-3.5 text-sm font-black text-[#11110f] transition hover:bg-[#fffdf9]"
              >
                Start creating for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#examples"
                className="inline-flex items-center gap-2 rounded-[18px] border border-white/[0.1] bg-white/[0.03] px-6 py-3.5 text-sm font-bold text-[#d6d0c8] transition hover:bg-white/[0.06]"
              >
                See how it distributes
              </a>
            </div>
            <p className="m-0 text-[10px] font-bold text-[#625e59]">Create once · Human or direct distribution</p>
          </div>
        </div>
      </section>

      <div id="examples" className="pt-8 md:pt-14">
        <div className="relative isolate overflow-hidden border-b border-white/[0.08]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: '#0d0d0b',
              backgroundImage:
                'radial-gradient(circle at center, rgba(244,239,231,.12) 0, rgba(244,239,231,0) 42%), radial-gradient(rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 12px 12px',
              maskImage: 'linear-gradient(to bottom, black 0%, black 78%, transparent 100%)',
            }}
          />

          <div className="relative z-10 h-20 md:h-28">
            <div className="absolute inset-x-0 top-0 flex justify-center">
              <div className="relative rounded-b-3xl bg-[#080807] px-4 py-3">
                <div className="flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full p-1 scrollbar-none">
                  {featureTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveFeature(tab)}
                      aria-pressed={activeFeature === tab}
                      className={activeFeature === tab
                        ? 'relative shrink-0 rounded-full border border-white/[0.12] bg-[#131311] px-4 py-2 text-xs font-bold text-[#f5f0e8] shadow-sm'
                        : 'relative shrink-0 rounded-full px-4 py-2 text-xs font-bold text-[#716c66] transition hover:text-[#cfc8bf]'}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="absolute -left-10 top-0 h-10 w-10 rounded-tr-[34px] shadow-[12px_-12px_0_0_#080807]" />
                <div className="absolute -right-10 top-0 h-10 w-10 rounded-tl-[34px] shadow-[-12px_-12px_0_0_#080807]" />
              </div>
            </div>
          </div>

          <section className="relative z-10 pb-24 pt-2 md:pb-32 md:pt-6">
            <div className="mx-auto w-[94%] max-w-6xl">
              {activeFeature === 'Generation' && <GenerationFormatsGraph />}
              {activeFeature === 'Poster Network' && <WorldwidePosterGraph />}
              {activeFeature !== 'Generation' && activeFeature !== 'Poster Network' && (
                <DistributionGraph activeFeature={activeFeature} />
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="border-b border-white/[0.08] bg-[#080807] py-10">
        <div className="mx-auto mb-6 max-w-2xl px-5 text-center">
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#6f6a64]">The full publishing loop</p>
          <h2 className="m-0 mt-3 text-2xl font-black tracking-[-0.04em] text-[#f5f0e8]">One campaign. Every destination visible.</h2>
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-center gap-2 px-5">
          {activityItems.map((item) => (
            <div key={item.label} className="flex min-w-[160px] items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#11110f] px-4 py-3">
              <span className="h-8 w-1 rounded-full" style={{ backgroundColor: item.color }} />
              <div>
                <p className="m-0 text-[10px] font-black text-[#ded7ce]">{item.label}</p>
                <p className="m-0 mt-0.5 text-[9px] font-bold text-[#67625d]">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section id="workflow" className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div>
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#d9d3ca]">The workflow</p>
              <h2 className="m-0 mt-4 text-[clamp(2.6rem,5vw,5.4rem)] font-black leading-[.92] tracking-[-0.065em] text-[#f5f0e8]">
                Generate once. Distribute two ways.
              </h2>
            </div>
            <p className="m-0 max-w-2xl text-base leading-7 text-[#8f8982] lg:justify-self-end lg:text-lg">
              Build a complete content batch, approve it, then choose the best distribution method for every campaign: trusted human posters or direct scheduling.
            </p>
          </div>

          <div className="mt-12 grid overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#11110f] lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <article key={step.number} className={`relative p-7 sm:p-9 ${index !== 2 ? 'border-b border-white/[0.08] lg:border-b-0 lg:border-r' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.09] bg-white/[0.04] text-[#d9d3ca]">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-4xl font-black tracking-[-0.06em] text-white/[0.07]">{step.number}</span>
                </div>
                <h3 className="m-0 mt-10 text-xl font-black tracking-[-0.035em] text-[#eee8df]">{step.title}</h3>
                <p className="m-0 mt-3 text-sm leading-6 text-[#87817a]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="distribution" className="border-y border-white/[0.08] bg-[#0d0d0b] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mx-auto max-w-3xl text-center">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#d9d3ca]">Choose how to distribute</p>
            <h2 className="m-0 mt-4 text-[clamp(2.7rem,5.4vw,5.8rem)] font-black leading-[.9] tracking-[-0.065em] text-[#f5f0e8]">
              Human posters.
              <span className="block text-[#7f7972]">Or direct scheduling.</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <DistributionOptionCard variant="human" />
            <DistributionOptionCard variant="direct" />
          </div>
        </div>
      </section>

      <section id="platform" className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f3eee5]/20 bg-[#f3eee5]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#f3eee5]">
              <Zap className="h-3 w-3" />
              Built for volume
            </span>
            <h2 className="m-0 mt-5 text-[clamp(2.8rem,5.2vw,5.7rem)] font-black leading-[.9] tracking-[-0.065em] text-[#f5f0e8]">
              Stop managing tools.
              <span className="block text-[#f3eee5]">Start moving content.</span>
            </h2>
            <p className="m-0 mt-6 max-w-xl text-base leading-7 text-[#8f8982]">
              Campaigns, generated assets, poster assignments, channel queues, and publishing status stay connected from the first idea to the final post.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Campaign control', 'Keep products, formats, creative, and channels inside one campaign workspace.', Layers3],
              ['Bulk content studio', 'Generate and refine multiple short-form assets without losing the campaign context.', WandSparkles],
              ['Poster operations', 'Assign work to account handlers and see what is accepted, ready, or live.', UsersRound],
              ['Publishing queue', 'Control timing and channel delivery from one operational calendar.', CalendarClock],
            ].map(([title, text, Icon], index) => (
              <article key={title} className={`rounded-[22px] border border-white/[0.09] bg-[#11110f] p-6 transition hover:-translate-y-1 hover:border-white/20 ${index === 1 || index === 2 ? 'sm:translate-y-5 sm:hover:translate-y-4' : ''}`}>
                <Icon className={`h-5 w-5 ${index % 2 === 0 ? 'text-[#d9d3ca]' : 'text-[#d8d2c9]'}`} />
                <h3 className="m-0 mt-7 text-base font-black text-[#eee8df]">{title}</h3>
                <p className="m-0 mt-2 text-xs leading-5 text-[#817b74]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
        <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-[32px] border border-[#f3eee5]/25 bg-[#f3eee5] px-6 py-14 text-center shadow-[0_30px_100px_rgba(244,239,231,.14)] sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -left-10 -top-24 h-72 w-72 rounded-full border-[48px] border-[#210d07]/10" />
          <div className="pointer-events-none absolute -bottom-28 -right-10 h-72 w-72 rounded-full border-[48px] border-[#210d07]/10" />
          <div className="relative mx-auto max-w-4xl">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#542012]">Your next campaign is waiting</p>
            <h2 className="m-0 mt-5 text-[clamp(2.8rem,6vw,6.5rem)] font-black leading-[.88] tracking-[-0.07em] text-[#180a06]">
              Generate it. Distribute it. Grow.
            </h2>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-[#11110f] px-6 py-4 text-sm font-black text-[#f8f4ed] shadow-[0_18px_45px_rgba(0,0,0,.24)] transition hover:-translate-y-0.5 hover:bg-[#1d1d1b]"
            >
              Enter EasyPost
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-white/[0.08] bg-[#0b0b09] px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <BrandMark compact />
          <p className="m-0 mt-4 max-w-md text-xs leading-5 text-[#6f6a64]">
            The content generation and distribution workspace for teams that need to ship more.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#77726c]">
          <Link to="/privacy-policy" className="transition hover:text-[#f5f0e8]">Privacy</Link>
          <Link to="/terms-and-conditions" className="transition hover:text-[#f5f0e8]">Terms</Link>
          <Link to="/login" className="transition hover:text-[#f5f0e8]">Sign in</Link>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1440px] flex-col gap-2 border-t border-white/[0.07] pt-5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#4f4b47] sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 EasyPost</span>
        <span>Generate · Distribute · Publish</span>
      </div>
    </footer>
  </div>
  );
};

export default Home;
